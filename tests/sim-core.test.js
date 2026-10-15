import test from "node:test";
import assert from "node:assert/strict";
import { SeededRandom } from "../src/sim-core/random.js";
import { FixedStepClock } from "../src/sim-core/clock.js";
import { createScenario, validateScenario } from "../src/sim-core/scenario.js";
import { TrackManager } from "../src/sim-core/track-manager.js";
import { createSimulationEngine } from "../src/sim-core/engine.js";
import { runMonteCarloBenchmark } from "../src/sim-core/benchmark.js";

function runTrace(seed) {
  const scenario = createScenario({ seed, durationSeconds: 3 });
  const engine = createSimulationEngine({ scenario });
  const dt = 1 / 60;
  for (let tick = 0; tick < 180; tick++) {
    const time = (tick + 1) * dt;
    engine.advance(dt, () => ({
      observerPosition: { x: 0, y: 10, z: 0 },
      radarOrigin: { x: 0, y: 10, z: 0 },
      contacts: [{
        id: "truth-1",
        type: "BENIGN AIR CONTACT",
        position: { x: 20 + Math.sin(time) * 3, y: 15, z: -35 + time },
        velocity: { x: 0, y: 0, z: 1 },
        active: true
      }]
    }));
  }
  return { diagnostics: engine.diagnostics(), tracks: engine.getTracks() };
}

test("seeded PRNG repeats values and Gaussian samples", () => {
  const left = new SeededRandom("alpha");
  const right = new SeededRandom("alpha");
  assert.deepEqual(Array.from({ length: 30 }, () => left.next()), Array.from({ length: 30 }, () => right.next()));
  left.reset("alpha");
  right.reset("alpha");
  assert.deepEqual(Array.from({ length: 20 }, () => left.normal()), Array.from({ length: 20 }, () => right.normal()));
});

test("fixed-step clock produces equal steps for equivalent frame partitions", () => {
  const first = new FixedStepClock({ stepSeconds: 1 / 60, maxSubSteps: 10 });
  const second = new FixedStepClock({ stepSeconds: 1 / 60, maxSubSteps: 10 });
  let firstSteps = 0;
  let secondSteps = 0;
  for (let i = 0; i < 60; i++) first.advance(1 / 60, () => firstSteps++);
  for (let i = 0; i < 30; i++) second.advance(1 / 30, () => secondSteps++);
  assert.equal(firstSteps, 60);
  assert.equal(secondSteps, 60);
  assert.equal(first.simulationTime, second.simulationTime);
});

test("scenario validator rejects unsupported sensor ranges", () => {
  const scenario = createScenario();
  scenario.sensors.radar.range = -5;
  const result = validateScenario(scenario);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("sensors.radar.range")));
});

test("tracker estimates noisy measurements without exposing evaluator labels", () => {
  const tracker = new TrackManager({ confirmHits: 2, associationGate: 50 });
  tracker.update([{ sensor: "radar", targetId: "secret-truth", position: { x: 10, y: 12, z: 20 }, variance: 2, confidence: 0.9 }], 1 / 60);
  const tracks = tracker.update([{ sensor: "visual", targetId: "secret-truth", position: { x: 11, y: 12, z: 21 }, variance: 1, confidence: 0.95 }], 2 / 60);
  assert.equal(tracks.length, 1);
  assert.ok(Math.abs(tracks[0].position.x - 11) < 2);
  assert.equal("targetId" in tracks[0], false);
  assert.ok(Number.isFinite(tracks[0].uncertainty));
});

test("engine produces reproducible diagnostics for the same seed and trace", () => {
  const first = runTrace("repeat-me");
  const second = runTrace("repeat-me");
  assert.deepEqual(first.diagnostics, second.diagnostics);
  assert.deepEqual(first.tracks, second.tracks);
  assert.ok(first.diagnostics.localizationSamples > 0);
  assert.ok(first.diagnostics.frames > 0);
});

test("different seeds change noisy measurements", () => {
  const first = runTrace("seed-a");
  const second = runTrace("seed-b");
  assert.notDeepEqual(first.tracks, second.tracks);
});

test("decisions are recorded with evaluator outcome and included in export", () => {
  const engine = createSimulationEngine({ seed: "decision-test" });
  engine.advance(1 / 60, () => ({
    observerPosition: { x: 0, y: 10, z: 0 },
    contacts: [{ id: "a", type: "SYNTHETIC UAS", position: { x: 10, y: 15, z: 10 }, active: true }]
  }));
  const decision = engine.recordDecision({ targetId: "a", label: "SYNTHETIC UAS", confidence: 0.8 });
  assert.equal(decision.correct, true);
  const exported = engine.exportSession();
  assert.equal(exported.format, "spectra-session");
  assert.equal(exported.decisions.length, 1);
  assert.ok(exported.events.length > 0);
});

test("Monte Carlo benchmark returns bounded aggregate metrics", async () => {
  const report = await runMonteCarloBenchmark({ runs: 2, durationSeconds: 1, seed: "test-bench" });
  assert.equal(report.runs.length, 2);
  assert.ok(report.aggregate.meanDetectionRate >= 0 && report.aggregate.meanDetectionRate <= 1);
  assert.ok(report.aggregate.meanFalseAlarmsPerMinute >= 0);
});
