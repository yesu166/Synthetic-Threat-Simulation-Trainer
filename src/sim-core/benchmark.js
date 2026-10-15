import { createSimulationEngine } from "./engine.js";
import { createScenario, DEFAULT_SCENARIO } from "./scenario.js";
import { SeededRandom } from "./random.js";

export async function runMonteCarloBenchmark({ runs = 100, seed = "SPECTRA-BENCH", durationSeconds = 8, onProgress, scenarioOverrides = {} } = {}) {
  const runCount = Math.max(1, Math.min(500, Math.floor(runs)));
  const seconds = Math.max(1, Math.min(120, Number(durationSeconds) || 8));
  const summaries = [];
  for (let index = 0; index < runCount; index++) {
    const runSeed = String(seed) + "-" + String(index + 1).padStart(3, "0");
    const scenario = createScenario({
      ...DEFAULT_SCENARIO,
      ...scenarioOverrides,
      seed: runSeed,
      durationSeconds: seconds,
      contacts: 5
    });
    const engine = createSimulationEngine({ scenario, seed: runSeed });
    const fixtureRng = new SeededRandom(runSeed + "-world");
    const starts = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      x: fixtureRng.range(-105, 105),
      y: fixtureRng.range(15, 55),
      z: fixtureRng.range(-105, 105),
      phase: fixtureRng.range(0, Math.PI * 2),
      type: i % 3 === 0 ? "BENIGN AIR CONTACT" : "SYNTHETIC UAS"
    }));
    const dt = 1 / 60;
    for (let tick = 0; tick < seconds * 60; tick++) {
      const time = (tick + 1) * dt;
      engine.advance(dt, () => ({
        observerPosition: { x: 0, y: 20, z: 0 },
        radarOrigin: { x: 0, y: 20, z: 0 },
        contacts: starts.map((contact) => ({
          id: contact.id,
          type: contact.type,
          position: {
            x: contact.x + Math.sin(time * 0.25 + contact.phase) * 8,
            y: contact.y + Math.sin(time * 0.45 + contact.phase) * 2,
            z: contact.z + Math.cos(time * 0.25 + contact.phase) * 8
          },
          velocity: { x: 0, y: 0, z: 0 },
          active: true
        }))
      }));
    }
    summaries.push(engine.diagnostics());
    if (typeof onProgress === "function") onProgress(index + 1, runCount);
    if (index % 5 === 4) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const mean = (key) => summaries.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / summaries.length;
  const sortedRmse = summaries.map((item) => item.localizationRmse).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    schemaVersion: 1,
    seed,
    runs: runCount,
    durationSeconds: seconds,
    aggregate: {
      meanDetectionRate: mean("detectionRate"),
      meanFalseAlarmsPerMinute: mean("falseAlarmsPerMinute"),
      meanLocalizationRmse: sortedRmse.length ? sortedRmse.reduce((a, b) => a + b, 0) / sortedRmse.length : null,
      p95LocalizationRmse: sortedRmse.length ? sortedRmse[Math.min(sortedRmse.length - 1, Math.floor(sortedRmse.length * 0.95))] : null,
      meanActiveTracks: mean("activeTracks")
    },
    runs: summaries
  };
}
