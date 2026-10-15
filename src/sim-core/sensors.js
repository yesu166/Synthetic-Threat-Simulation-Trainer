const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const vectorOf = (value) => ({
  x: Number(value?.x) || 0,
  y: Number(value?.y) || 0,
  z: Number(value?.z) || 0
});

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function sampleSensors({ contacts, observerPosition, radarOrigin, timestamp, scenario, rng, sensorState }) {
  const measurements = [];
  const reportsByTarget = new Map();
  const events = [];
  const origins = { radar: vectorOf(radarOrigin || observerPosition), visual: vectorOf(observerPosition), rf: vectorOf(radarOrigin || observerPosition) };
  const sensorNames = ["radar", "visual", "rf"];

  for (const sensorName of sensorNames) {
    const config = scenario.sensors[sensorName];
    if (!config.enabled) continue;
    const previous = sensorState.get(sensorName);
    if (previous !== undefined && timestamp - previous < config.periodSeconds - 1e-9) continue;
    sensorState.set(sensorName, timestamp);

    for (const contact of contacts) {
      const position = vectorOf(contact.position);
      const range = distance(position, origins[sensorName]);
      if (range > config.range) continue;
      events.push({ type: "sensor-opportunity", time: timestamp, sensor: sensorName, targetId: contact.id, range });
      const rangeRatio = range / config.range;
      const probability = clamp(config.detectionProbability * (1 - 0.45 * rangeRatio * rangeRatio), 0, 1);
      if (rng.next() > probability) {
        events.push({ type: "missed-detection", time: timestamp, sensor: sensorName, targetId: contact.id });
        continue;
      }

      const sigma = config.positionStdDev * (1 + rangeRatio * 0.65);
      const measuredPosition = {
        x: position.x + rng.normal(0, sigma),
        y: position.y + rng.normal(0, sigma * 0.75),
        z: position.z + rng.normal(0, sigma)
      };
      const confidence = clamp(probability * (1 - rangeRatio * 0.3) + rng.normal(0, 0.035), 0.02, 1);
      const measurement = {
        sensor: sensorName,
        position: measuredPosition,
        variance: Math.max(0.01, sigma * sigma),
        confidence,
        timestamp,
        // targetId is evaluator metadata only; TrackManager deliberately strips it.
        targetId: contact.id,
        falseAlarm: false
      };
      measurements.push(measurement);
      const list = reportsByTarget.get(contact.id) || [];
      list.push(measurement);
      reportsByTarget.set(contact.id, list);
      events.push({ type: "measurement", time: timestamp, sensor: sensorName, targetId: contact.id, confidence });
    }

    if (rng.next() < config.falseAlarmProbability) {
      const falsePosition = {
        x: origins[sensorName].x + rng.range(-config.range, config.range),
        y: Math.max(0, origins[sensorName].y + rng.range(-25, 65)),
        z: origins[sensorName].z + rng.range(-config.range, config.range)
      };
      measurements.push({
        sensor: sensorName,
        position: falsePosition,
        variance: Math.max(1, config.positionStdDev * config.positionStdDev * 2),
        confidence: rng.range(0.15, 0.55),
        timestamp,
        targetId: null,
        falseAlarm: true
      });
      events.push({ type: "false-alarm", time: timestamp, sensor: sensorName });
    }
  }

  return { measurements, reportsByTarget, events };
}
