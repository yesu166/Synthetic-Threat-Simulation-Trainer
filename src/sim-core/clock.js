// Fixed-step clock decouples simulation sampling from render frame rate.
export class FixedStepClock {
  constructor({ stepSeconds = 1 / 60, maxSubSteps = 8, maxFrameSeconds = 0.25 } = {}) {
    if (!(stepSeconds > 0)) throw new RangeError("stepSeconds must be positive");
    if (!Number.isInteger(maxSubSteps) || maxSubSteps < 1) throw new RangeError("maxSubSteps must be a positive integer");
    this.stepSeconds = stepSeconds;
    this.maxSubSteps = maxSubSteps;
    this.maxFrameSeconds = maxFrameSeconds;
    this.accumulator = 0;
    this.simulationTime = 0;
    this.steps = 0;
    this.droppedSeconds = 0;
  }

  advance(frameSeconds, onStep) {
    if (!Number.isFinite(frameSeconds) || frameSeconds < 0) {
      throw new RangeError("frameSeconds must be a finite non-negative number");
    }
    const accepted = Math.min(frameSeconds, this.maxFrameSeconds);
    this.droppedSeconds += Math.max(0, frameSeconds - accepted);
    this.accumulator += accepted;
    let count = 0;
    while (this.accumulator + 1e-12 >= this.stepSeconds && count < this.maxSubSteps) {
      this.accumulator -= this.stepSeconds;
      this.simulationTime += this.stepSeconds;
      this.steps++;
      count++;
      onStep(this.stepSeconds, this.simulationTime);
    }
    if (count === this.maxSubSteps && this.accumulator >= this.stepSeconds) {
      const remainder = this.accumulator % this.stepSeconds;
      this.droppedSeconds += this.accumulator - remainder;
      this.accumulator = remainder;
    }
    return count;
  }

  reset() {
    this.accumulator = 0;
    this.simulationTime = 0;
    this.steps = 0;
    this.droppedSeconds = 0;
  }
}
