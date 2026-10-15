export const DEFAULT_SCENARIO = Object.freeze({
  schemaVersion: 1,
  id: "SPECTRA-BASELINE-01",
  name: "Baseline sensor observation",
  seed: "SPECTRA-001",
  durationSeconds: 30,
  contacts: 6,
  sensors: {
    radar: { enabled: true, range: 190, periodSeconds: 0.5, detectionProbability: 0.88, positionStdDev: 4.0, falseAlarmProbability: 0.012, weight: 0.4 },
    visual: { enabled: true, range: 92, periodSeconds: 0.12, detectionProbability: 0.92, positionStdDev: 1.8, falseAlarmProbability: 0.004, weight: 0.4 },
    rf: { enabled: true, range: 150, periodSeconds: 0.8, detectionProbability: 0.42, positionStdDev: 12.0, falseAlarmProbability: 0.018, weight: 0.2 }
  },
  tracking: { associationGate: 36, processNoise: 1.8, measurementVariance: 9, confirmHits: 3, lostAfterSeconds: 4 }
});

function finiteInRange(value, min, max, field, errors) {
  if (!Number.isFinite(value) || value < min || value > max) {
    errors.push(field + " must be between " + min + " and " + max);
    return false;
  }
  return true;
}

export function validateScenario(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Scenario must be an object"], scenario: null };
  }
  const scenario = structuredCloneSafe(input);
  if (scenario.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (typeof scenario.id !== "string" || !scenario.id.trim()) errors.push("id is required");
  if (typeof scenario.name !== "string" || !scenario.name.trim()) errors.push("name is required");
  if (typeof scenario.seed !== "string" && typeof scenario.seed !== "number") errors.push("seed must be a string or number");
  finiteInRange(scenario.durationSeconds, 1, 3600, "durationSeconds", errors);
  finiteInRange(scenario.contacts, 1, 50, "contacts", errors);
  if (!scenario.sensors || !scenario.tracking) errors.push("sensors and tracking configuration are required");
  for (const sensorName of ["radar", "visual", "rf"]) {
    const sensor = scenario.sensors && scenario.sensors[sensorName];
    if (!sensor || typeof sensor !== "object") {
      errors.push("sensors." + sensorName + " is required");
      continue;
    }
    finiteInRange(sensor.range, 1, 5000, "sensors." + sensorName + ".range", errors);
    finiteInRange(sensor.periodSeconds, 0.02, 60, "sensors." + sensorName + ".periodSeconds", errors);
    finiteInRange(sensor.detectionProbability, 0, 1, "sensors." + sensorName + ".detectionProbability", errors);
    finiteInRange(sensor.positionStdDev, 0, 250, "sensors." + sensorName + ".positionStdDev", errors);
    finiteInRange(sensor.falseAlarmProbability, 0, 1, "sensors." + sensorName + ".falseAlarmProbability", errors);
    finiteInRange(sensor.weight, 0, 1, "sensors." + sensorName + ".weight", errors);
    if (typeof sensor.enabled !== "boolean") errors.push("sensors." + sensorName + ".enabled must be boolean");
  }
  if (scenario.tracking) {
    finiteInRange(scenario.tracking.associationGate, 1, 500, "tracking.associationGate", errors);
    finiteInRange(scenario.tracking.processNoise, 0.001, 100, "tracking.processNoise", errors);
    finiteInRange(scenario.tracking.measurementVariance, 0.01, 10000, "tracking.measurementVariance", errors);
    finiteInRange(scenario.tracking.confirmHits, 1, 20, "tracking.confirmHits", errors);
    finiteInRange(scenario.tracking.lostAfterSeconds, 0.2, 120, "tracking.lostAfterSeconds", errors);
  }
  const weightTotal = scenario.sensors
    ? ["radar", "visual", "rf"].reduce((sum, name) => sum + (Number(scenario.sensors[name]?.weight) || 0), 0)
    : 0;
  if (weightTotal <= 0) errors.push("At least one sensor weight must be greater than zero");
  return { valid: errors.length === 0, errors, scenario: errors.length === 0 ? scenario : null };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createScenario(overrides = {}) {
  const base = structuredCloneSafe(DEFAULT_SCENARIO);
  const merged = {
    ...base,
    ...overrides,
    sensors: { ...base.sensors, ...(overrides.sensors || {}) },
    tracking: { ...base.tracking, ...(overrides.tracking || {}) }
  };
  for (const sensorName of ["radar", "visual", "rf"]) {
    merged.sensors[sensorName] = {
      ...base.sensors[sensorName],
      ...((overrides.sensors || {})[sensorName] || {})
    };
  }
  const result = validateScenario(merged);
  if (!result.valid) throw new Error("Invalid scenario: " + result.errors.join("; "));
  return result.scenario;
}
