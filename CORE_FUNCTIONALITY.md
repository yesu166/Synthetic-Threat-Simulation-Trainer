# SIH26247 — What the simulator is actually demonstrating

## The problem in simple words

The problem is not "make a drone game."

The training challenge is:

A trainee needs to operate in a simulated airspace where multiple aerial contacts can appear,
sensor information can be uncertain, and the trainee must notice, interpret and classify those
contacts correctly and quickly.

The system must then measure the trainee and make the next training scenario harder or easier
based on performance.

## Core loop

SCENARIO
  ↓
SYNTHETIC AERIAL CONTACTS
  ↓
SIMULATED SENSOR EVIDENCE
  ↓
TRAINEE OBSERVES
  ↓
DETECTION / CLASSIFICATION DECISION
  ↓
EVALUATION
  ↓
SCORE + REACTION TIME + CONFIDENCE
  ↓
ADAPTIVE NEXT SCENARIO
  ↓
AFTER-ACTION REVIEW

## What each graphic means

- Radar station: simulated sensor source.
- Radar sweep: continuous airspace monitoring.
- Drone: synthetic aerial contact, not a real-world operational model.
- Watch towers/base: training environment and spatial context.
- HUD: sensor evidence and trainee telemetry.
- Green detection events: successful observation/classification.
- Yellow phase messages: scenario changes.
- Difficulty: adaptive training state.
- Training Insight: what the system has learned about the trainee.

## Scenario state machine

MONITOR
→ CONTACT
→ AMBIGUITY
→ SURGE
→ ASSESSMENT
→ next adaptive cycle

The simulator changes sensor noise, dropout probability and contact density by phase.

It does not simply set "anomaly=true". Evidence is generated first, then the evaluation layer
decides whether the contact is reliably observable.

## Why adaptive training matters

A fixed sequence means every trainee gets the same challenge.

Adaptive training means:

Good performance → more ambiguity / more simultaneous contacts.
Poor performance → slightly reduced complexity / reinforcement.

That is the AI-training story the judges should see.

## 36-hour MVP

Must-have:
1. 3D environment
2. Synthetic aerial contacts
3. Sensor evidence simulation
4. Detection/classification
5. Scoring
6. Adaptive difficulty
7. After-action review

Nice-to-have:
- instructor scenario editor
- recorded replay
- AI-generated scenario descriptions
- trainee performance dashboard
- persistent training history
