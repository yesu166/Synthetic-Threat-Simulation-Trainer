export class SessionRecorder {
  constructor({ maxEvents = 50000 } = {}) {
    this.maxEvents = maxEvents;
    this.reset();
  }

  record(event) {
    const entry = Object.freeze({
      sequence: this.nextSequence++,
      ...event
    });
    this.events.push(entry);
    if (this.events.length > this.maxEvents) {
      const removed = this.events.length - this.maxEvents;
      this.events.splice(0, removed);
      this.truncatedEvents += removed;
    }
    return entry;
  }

  reset(metadata = {}) {
    this.events = [];
    this.nextSequence = 1;
    this.truncatedEvents = 0;
    this.startedAt = new Date().toISOString();
    this.metadata = { ...metadata };
  }

  export({ scenario, metrics, decisions = [] } = {}) {
    return {
      format: "spectra-session",
      schemaVersion: 1,
      metadata: {
        ...this.metadata,
        startedAt: this.startedAt,
        exportedAt: new Date().toISOString(),
        eventCount: this.events.length,
        truncatedEvents: this.truncatedEvents
      },
      scenario: scenario || null,
      metrics: metrics || null,
      decisions,
      events: this.events.map((event) => ({ ...event }))
    };
  }
}
