// Mulberry32-based deterministic PRNG. A seed reproduces the same simulation draws.
function hashSeed(seed) {
  const value = String(seed ?? "SPECTRA-001");
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  constructor(seed = "SPECTRA-001") {
    this.seed = String(seed);
    this.state = hashSeed(this.seed) || 0x6d2b79f5;
    this._normalSpare = null;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  integer(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  normal(mean = 0, standardDeviation = 1) {
    if (this._normalSpare !== null) {
      const spare = this._normalSpare;
      this._normalSpare = null;
      return mean + spare * standardDeviation;
    }
    let u = 0;
    let v = 0;
    while (u <= Number.EPSILON) u = this.next();
    while (v <= Number.EPSILON) v = this.next();
    const magnitude = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    this._normalSpare = magnitude * Math.sin(angle);
    return mean + magnitude * Math.cos(angle) * standardDeviation;
  }

  fork(label) {
    return new SeededRandom(this.seed + "::" + String(label));
  }

  reset(seed = this.seed) {
    this.seed = String(seed);
    this.state = hashSeed(this.seed) || 0x6d2b79f5;
    this._normalSpare = null;
  }
}
