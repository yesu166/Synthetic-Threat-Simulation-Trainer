import { SeededRandom } from "./random.js";
import { FixedStepClock } from "./clock.js";
import { createScenario, DEFAULT_SCENARIO } from "./scenario.js";
import { sampleSensors } from "./sensors.js";
import { TrackManager } from "./track-manager.js";
import { SessionRecorder } from "./recorder.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const vector = (value) => ({ x: Number(value?.x) || 0, y: Number(value?.y) || 0, z: Number(value?.z) || 0 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function createSimulationEngine(options = {}) {
  let scenario = createScenario({
    ...DEFAULT_SCENARIO,
    ...(options.scenario || {}),
    seed: String(options.seed ?? options.scenario?.seed ?? DEFAULT_SCENARIO.seed)
  });
  let rng = new SeededRandom(scenario.seed);
  let clock = new FixedStepClock({ stepSeconds: 1 / 60, maxSubSteps: 8, maxFrameSeconds: 0.25 });
  let tracker = new TrackManager(scenario.tracking);
  let recorder = new SessionRecorder();
  let sensorState = new Map();
  let latestReports = new Map();
  let latestTruth = new Map();
  let latestFrame = { time: 0, observationsByTarget: new Map(), tracks: [], measurements: [], events: [] };
  let decisions = [];
  let counters = emptyCounters();

  function emptyCounters() {
    return {
      opportunities: 0,
      detections: 0,
      falseAlarms: 0,
      localizationSquaredError: 0,
      localizationSamples: 0,
      frames: 0,
      decisions: 0,
      correctDecisions: 0,
      missedTargets: 0
    };
  }

  function recordEvents(events) {
    for (const event of events) recorder.record(event);
  }

  function sampleStep(snapshotProvider, dt, time) {
    const snapshot = typeof snapshotProvider === "function" ? snapshotProvider(time) : snapshotProvider;
    const contacts = (snapshot?.contacts || []).filter((contact) => contact && contact.active !== false);
    const normalizedContacts = contacts.map((contact) => ({
      id: String(contact.id),
      position: vector(contact.position),
      velocity: vector(contact.velocity),
      type: String(contact.type || "UNKNOWN"),
      behavior: String(contact.behavior || "unspecified")
    }));
    const truth = new Map(normalizedContacts.map((contact) => [contact.id, contact]));
    latestTruth = truth;

    const sampled = sampleSensors({
      contacts: normalizedContacts,
      observerPosition: vector(snapshot?.observerPosition),
      radarOrigin: vector(snapshot?.radarOrigin || snapshot?.observerPosition),
      timestamp: time,
      scenario,
      rng,
      sensorState
    });

    for (const event of sampled.events) {
      if (event.type === "sensor-opportunity") counters.opportunities++;
      if (event.type === "measurement") counters.detections++;
      if (event.type === "false-alarm") counters.falseAlarms++;
    }
    for (const measurement of sampled.measurements) {
      if (!measurement.falseAlarm && measurement.targetId !== null) {
        const target = truth.get(String(measurement.targetId));
        if (target) {
          counters.localizationSquaredError += distance(measurement.position, target.position) ** 2;
          counters.localizationSamples++;
        }
      }
    }

    // Tracks consume measurements without evaluator labels; targetId is stripped by TrackManager.
    const tracks = tracker.update(sampled.measurements, time);
    const observationsByTarget = new Map();
    for (const contact of normalizedContacts) {
      const reports = sampled.reportsByTarget.get(contact.id) || [];
      const weights = scenario.sensors;
      let weighted = 0;
      let total = 0;
      let radar = null;
      let visual = null;
      let rf = null;
      let measuredX = 0;
      let measuredY = 0;
      let measuredZ = 0;
      let measuredWeight = 0;

      for (const report of reports) {
        const reportWeight = weights[report.sensor].weight;
        weighted += report.confidence * reportWeight;
        total += reportWeight;
        if (report.sensor === "radar") radar = report;
        if (report.sensor === "visual") visual = report;
        if (report.sensor === "rf") rf = report;
        const w = Math.max(0.05, report.confidence) / Math.max(0.01, report.variance);
        measuredX += report.position.x * w;
        measuredY += report.position.y * w;
        measuredZ += report.position.z * w;
        measuredWeight += w;
      }

      const measuredPosition = measuredWeight > 0
        ? { x: measuredX / measuredWeight, y: measuredY / measuredWeight, z: measuredZ / measuredWeight }
        : null;
      const nearestTrack = measuredPosition ? nearestFrom(tracks, measuredPosition) : null;
      const fusion = total > 0 ? clamp(weighted / total, 0, 1) : 0;
      const report = {
        targetId: contact.id,
        distance: distance(contact.position, vector(snapshot?.observerPosition)),
        range: distance(contact.position, vector(snapshot?.observerPosition)),
        radarVisible: !!radar,
        visualVisible: !!visual,
        rfVisible: !!rf,
        radarConfidence: radar?.confidence || 0,
        visualConfidence: visual?.confidence || 0,
        rfConfidence: rf?.confidence || 0,
        motionConfidence: nearestTrack ? clamp(1 - nearestTrack.uncertainty / 60, 0, 1) : 0,
        fusion,
        trackQuality: nearestTrack?.confidence || 0,
        trackEstimate: nearestTrack?.position || null,
        trackId: nearestTrack?.id || null,
        measuredPosition,
        isActionable: fusion >= 0.2 && (!!radar || !!visual),
        sensorAgeSeconds: Math.min(
          radar ? time - radar.timestamp : Infinity,
          visual ? time - visual.timestamp : Infinity,
          rf ? time - rf.timestamp : Infinity
        )
      };
      observationsByTarget.set(contact.id, report);
    }

    // Target-free public tracks; no class label or true target ID is exposed.
    const publicTracks = tracks.map((track) => ({ ...track, position: { ...track.position }, velocity: { ...track.velocity } }));
    counters.frames++;
    recordEvents(sampled.events);
    recorder.record({
      type: "simulation-step",
      time,
      contacts: normalizedContacts.length,
      measurementCount: sampled.measurements.length,
      trackCount: publicTracks.length
    });
    latestFrame = {
      time,
      observationsByTarget,
      tracks: publicTracks,
      measurements: sampled.measurements.map((measurement) => ({
        sensor: measurement.sensor,
        position: { ...measurement.position },
        confidence: measurement.confidence,
        timestamp: measurement.timestamp,
        falseAlarm: measurement.falseAlarm
      })),
      events: sampled.events.map((event) => ({ ...event }))
    };
  }

  function nearestFrom(tracks, position) {
    let best = null;
    let bestDistance = Infinity;
    for (const track of tracks) {
      const d = distance(track.position, position);
      if (d < bestDistance) {
        best = track;
        bestDistance = d;
      }
    }
    return best;
  }

  function advance(realDelta, snapshotProvider) {
    clock.advance(realDelta, (dt, time) => sampleStep(snapshotProvider, dt, time));
    return latestFrame;
  }

  function recordDecision({ targetId, label, confidence = 0 }) {
    const target = latestTruth.get(String(targetId));
    const correct = !!target && String(label) === target.type;
    const decision = {
      type: "trainee-decision",
      time: clock.simulationTime,
      targetId: String(targetId),
      label: String(label),
      confidence: clamp(Number(confidence) || 0, 0, 1),
      correct,
      expected: target?.type || null
    };
    decisions.push(decision);
    counters.decisions++;
    if (correct) counters.correctDecisions++;
    recorder.record(decision);
    return { ...decision };
  }

  function diagnostics() {
    return {
      seed: scenario.seed,
      simulationTime: Number(clock.simulationTime.toFixed(3)),
      frames: counters.frames,
      sensorOpportunities: counters.opportunities,
      detections: counters.detections,
      detectionRate: counters.opportunities ? counters.detections / counters.opportunities : 0,
      falseAlarms: counters.falseAlarms,
      falseAlarmsPerMinute: clock.simulationTime > 0 ? counters.falseAlarms * 60 / clock.simulationTime : 0,
      localizationRmse: counters.localizationSamples ? Math.sqrt(counters.localizationSquaredError / counters.localizationSamples) : null,
      localizationSamples: counters.localizationSamples,
      activeTracks: tracker.snapshot().length,
      decisions: counters.decisions,
      decisionAccuracy: counters.decisions ? counters.correctDecisions / counters.decisions : null,
      droppedClockSeconds: clock.droppedSeconds
    };
  }

  function exportSession() {
    return recorder.export({
      scenario,
      metrics: diagnostics(),
      decisions: decisions.map((item) => ({ ...item }))
    });
  }

  function reset(seed = scenario.seed, scenarioOverrides = {}) {
    scenario = createScenario({ ...scenario, ...scenarioOverrides, seed: String(seed) });
    rng = new SeededRandom(scenario.seed);
    clock = new FixedStepClock({ stepSeconds: 1 / 60, maxSubSteps: 8, maxFrameSeconds: 0.25 });
    tracker = new TrackManager(scenario.tracking);
    sensorState = new Map();
    latestReports = new Map();
    latestTruth = new Map();
    latestFrame = { time: 0, observationsByTarget: new Map(), tracks: [], measurements: [], events: [] };
    decisions = [];
    counters = emptyCounters();
    recorder = new SessionRecorder();
    recorder.metadata = { seed: scenario.seed, scenarioId: scenario.id };
  }

  recorder.metadata = { seed: scenario.seed, scenarioId: scenario.id };

  return {
    get scenario() { return scenario; },
    rng,
    random: () => rng.next(),
    advance,
    recordDecision,
    diagnostics,
    exportSession,
    reset,
    getFrame: () => latestFrame,
    getTracks: () => tracker.snapshot(),
    nearestTrack: (position, maxDistance) => tracker.nearest(position, maxDistance),
    getEvents: () => recorder.events.map((event) => ({ ...event }))
  };
}
