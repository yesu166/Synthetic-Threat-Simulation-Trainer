# SPECTRA Simulation Core

SPECTRA (Synthetic Perception, Evaluation, Tracking & Replay Architecture) is the deterministic synthetic simulation layer used by the browser trainer.

## Data boundary

- **World truth** exists in the game objects and in evaluator-only scenario data.
- **Sensor models** emit noisy, timestamped measurements and occasional synthetic false alarms. The measurement payload sent to the tracker deliberately excludes the evaluator's target ID.
- **Track manager** performs nearest-neighbour gated association and a constant-velocity Kalman-style position/velocity update with per-axis covariance.
- **HUD** should show observations and estimates, not hidden class labels or a direct readout of ground-truth coordinates.
- **Evaluator** compares an explicitly submitted trainee decision against scenario truth and stores the result in the session event log.

This is a lightweight educational model, not a validated radar/EO/IR simulator. Sensor probabilities, noise and track association are configurable approximations and must not be presented as real sensor performance.

## Determinism

A scenario's seed initializes a deterministic PRNG. The sensor simulation advances on a fixed 1/60-second clock, independent of render cadence. Reproducible engine results require the same seed, simulation version, scenario configuration and truth-state trace. The rendering loop also uses fixed steps to reduce frame-rate-dependent physics differences.

## Session export

The createSimulationEngine API exportSession method returns a JSON object with the scenario, diagnostic metrics, trainee decisions, and a bounded sequence of simulation events. It includes schema and format version fields for future migration.

## Metrics

- Detection rate: emitted measurements divided by in-range sensor opportunities, across the configured synthetic sensors.
- False alarms per minute: synthetic false-alarm reports scaled by elapsed simulation time.
- Localization RMSE: root mean square distance between synthetic noisy measurements and their simulator ground-truth positions. It is an offline evaluation metric; the HUD must not show truth coordinates.
- Decision accuracy: correct explicit trainee classifications divided by recorded decisions.

These definitions are prototype metrics, not certification metrics. Comparisons should use matched scenario seeds and the same simulation version.

## Monte Carlo benchmark

The runMonteCarloBenchmark API runs independent seeded scenarios and aggregates detection rate, false alarms per minute, localization RMSE, and active tracks. The results are useful for regression testing and comparing versions of this synthetic model; they are not evidence of real-world operational performance.

## Test

Run npm test for unit tests covering the PRNG, fixed-step clock, scenario validation, tracking, seeded repeatability, event export and the Monte Carlo runner.
