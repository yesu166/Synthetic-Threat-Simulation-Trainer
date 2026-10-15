const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function makeAxis(position, variance) {
  return { p: position, v: 0, pp: Math.max(variance, 0.01), pv: 0, vv: 25 };
}

function predictAxis(axis, dt, q) {
  const pp = axis.pp + dt * (axis.pv + axis.pv) + dt * dt * axis.vv + q * dt * dt * dt / 3;
  const pv = axis.pv + dt * axis.vv + q * dt * dt / 2;
  const vv = axis.vv + q * dt;
  axis.p += axis.v * dt;
  axis.pp = pp;
  axis.pv = pv;
  axis.vv = vv;
}

function updateAxis(axis, measurement, measurementVariance) {
  const innovationVariance = axis.pp + measurementVariance;
  if (!(innovationVariance > 0)) return;
  const kp = axis.pp / innovationVariance;
  const kv = axis.pv / innovationVariance;
  const innovation = measurement - axis.p;
  axis.p += kp * innovation;
  axis.v += kv * innovation;
  const oldPp = axis.pp;
  const oldPv = axis.pv;
  axis.pp = Math.max(1e-6, (1 - kp) * oldPp);
  axis.pv = (1 - kp) * oldPv;
  axis.vv = Math.max(1e-6, axis.vv - kv * oldPv);
}

export class TrackManager {
  constructor(config = {}) {
    this.config = {
      associationGate: config.associationGate ?? 36,
      processNoise: config.processNoise ?? 1.8,
      measurementVariance: config.measurementVariance ?? 9,
      confirmHits: config.confirmHits ?? 3,
      lostAfterSeconds: config.lostAfterSeconds ?? 4
    };
    this.tracks = new Map();
    this.nextId = 1;
    this.lastTimestamp = 0;
  }

  update(measurements = [], timestamp = 0) {
    const dt = Math.max(0, Math.min(timestamp - this.lastTimestamp, 0.5));
    for (const track of this.tracks.values()) {
      for (const axis of [track.x, track.y, track.z]) predictAxis(axis, dt, this.config.processNoise);
      track.age += dt;
      track.coasting = true;
    }

    // High-confidence observations get first opportunity to associate.
    const sorted = [...measurements].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    for (const measurement of sorted) {
      const clean = {
        position: {
          x: Number(measurement.position?.x),
          y: Number(measurement.position?.y),
          z: Number(measurement.position?.z)
        },
        variance: Number.isFinite(measurement.variance) ? measurement.variance : this.config.measurementVariance,
        confidence: clamp(Number(measurement.confidence) || 0, 0, 1),
        sensor: String(measurement.sensor || "unknown"),
        timestamp,
        // Never propagate evaluator-only labels such as targetId into the track.
      };
      if (![clean.position.x, clean.position.y, clean.position.z].every(Number.isFinite)) continue;
      const candidate = this._findAssociation(clean.position);
      if (candidate) {
        const variance = Math.max(0.01, clean.variance / Math.max(0.1, clean.confidence));
        updateAxis(candidate.x, clean.position.x, variance);
        updateAxis(candidate.y, clean.position.y, variance);
        updateAxis(candidate.z, clean.position.z, variance);
        candidate.hits++;
        candidate.measurementCount++;
        candidate.lastMeasurementTime = timestamp;
        candidate.coasting = false;
        candidate.sensors.add(clean.sensor);
        candidate.history.push({ time: timestamp, x: candidate.x.p, y: candidate.y.p, z: candidate.z.p });
        if (candidate.history.length > 60) candidate.history.shift();
        candidate.residuals.push(distance(candidate.position, clean.position));
        if (candidate.residuals.length > 60) candidate.residuals.shift();
      } else {
        const variance = Math.max(0.01, clean.variance / Math.max(0.1, clean.confidence));
        const track = {
          id: "T-" + String(this.nextId++).padStart(3, "0"),
          x: makeAxis(clean.position.x, variance),
          y: makeAxis(clean.position.y, variance),
          z: makeAxis(clean.position.z, variance),
          createdAt: timestamp,
          lastMeasurementTime: timestamp,
          age: 0,
          hits: 1,
          measurementCount: 1,
          coasting: false,
          sensors: new Set([clean.sensor]),
          residuals: [],
          history: [{ time: timestamp, x: clean.position.x, y: clean.position.y, z: clean.position.z }]
        };
        this.tracks.set(track.id, track);
      }
    }

    for (const [id, track] of this.tracks) {
      if (timestamp - track.lastMeasurementTime > this.config.lostAfterSeconds) this.tracks.delete(id);
    }
    this.lastTimestamp = timestamp;
    return this.snapshot();
  }

  _findAssociation(position) {
    let best = null;
    let bestDistance = Infinity;
    for (const track of this.tracks.values()) {
      const d = distance(track.position, position);
      const uncertainty = Math.sqrt(Math.max(1, track.x.pp + track.y.pp + track.z.pp));
      const gate = this.config.associationGate + uncertainty * 2;
      if (d <= gate && d < bestDistance) {
        best = track;
        bestDistance = d;
      }
    }
    return best;
  }

  snapshot() {
    return [...this.tracks.values()].map((track) => {
      const position = { x: track.x.p, y: track.y.p, z: track.z.p };
      const velocity = { x: track.x.v, y: track.y.v, z: track.z.v };
      const uncertainty = Math.sqrt(Math.max(0, track.x.pp + track.y.pp + track.z.pp));
      const timeSinceUpdate = Math.max(0, this.lastTimestamp - track.lastMeasurementTime);
      return {
        id: track.id,
        position,
        velocity,
        covariance: { x: track.x.pp, y: track.y.pp, z: track.z.pp },
        uncertainty,
        confidence: clamp((track.hits / this.config.confirmHits) * Math.exp(-timeSinceUpdate / this.config.lostAfterSeconds), 0, 1),
        status: track.hits >= this.config.confirmHits ? (timeSinceUpdate > 0.75 ? "COASTING" : "CONFIRMED") : "TENTATIVE",
        age: track.age,
        hits: track.hits,
        sensors: [...track.sensors],
        history: track.history.map((point) => ({ ...point })),
        lastMeasurementTime: track.lastMeasurementTime
      };
    }).sort((a, b) => a.id.localeCompare(b.id));
  }

  nearest(position, maxDistance = Infinity) {
    let best = null;
    let bestDistance = maxDistance;
    for (const track of this.snapshot()) {
      const d = distance(track.position, position);
      if (d < bestDistance) {
        best = track;
        bestDistance = d;
      }
    }
    return best ? { ...best, distance: bestDistance } : null;
  }

  reset() {
    this.tracks.clear();
    this.nextId = 1;
    this.lastTimestamp = 0;
  }
}
