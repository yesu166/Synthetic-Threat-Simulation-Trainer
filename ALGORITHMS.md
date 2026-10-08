# SIH26247 — Algorithms Reference

## 1. Sensor Observation Model

### Radar Observation
```
radarVisible = (distance < radarRange) AND (random > dropoutChance)

radarConfidence = radarVisible ? clamp(1 - distance/radarRange + N(0, radarNoise), 0, 1) : 0
```

### Visual/EO Observation
```
visualVisible = (distance < visualRange) AND (random > dropoutChance * 0.6)

visualConfidence = visualVisible ? clamp(1 - distance/visualRange + N(0, visualNoise), 0, 1) : 0
```

### RF Observation (Optional)
```
rfVisible = random > 0.7
rfConfidence = rfVisible ? clamp(0.3 + random * 0.4, 0, 1) : 0
```

### Motion Consistency
```
IF track.measurementCount > 2:
    predicted = track.getPredictedPosition(0.5)
    actual = contact.position
    error = ||predicted - actual||
    motionConfidence = clamp(1 - error / 20, 0, 1)
ELSE:
    motionConfidence = 0.5
```

## 2. Sensor Fusion

### Weighted Linear Fusion
```
totalWeight = w_radar + w_visual + w_motion + w_rf
fusion = clamp(
    (radarConfidence * w_radar + 
     visualConfidence * w_visual + 
     motionConfidence * w_motion + 
     rfConfidence * w_rf) / totalWeight,
    0, 1
)
```

**Default Weights**: radar=0.35, visual=0.30, motion=0.25, rf=0.10

### Actionability Threshold
```
isActionable = (fusion >= minConfidenceThreshold) AND (radarVisible OR visualVisible)
```
Default threshold: 0.15

## 3. Kalman-Style Tracking

### State Representation
```
State: [x, y, z, vx, vy, vz]
Covariance: diagonal matrix [px, py, pz, pvx, pvy, pvz]
```

### Prediction Step (per frame)
```
x' = x + vx * dt
y' = y + vy * dt
z' = z + vz * dt

px' = px + q * dt
py' = py + q * dt
pz' = pz + q * dt
pvx' = pvx + q * dt * 0.1
pvy' = pvy + q * dt * 0.1
pvz' = pvz + q * dt * 0.1

predictionUncertainty = min((px + py + pz) / 30, 1.0)
```

Where q = processNoise (default: 0.5)

### Update Step (on measurement)
```
measurement = [mx, my, mz] with confidence c

r = measurementNoise / max(0.1, c)  // measurementNoise default: 1.0

Kx = px / (px + r)
Ky = py / (py + r)
Kz = pz / (pz + r)

x = x + Kx * (mx - x)
y = y + Ky * (my - y)
z = z + Kz * (mz - z)

px = px * (1 - Kx)
py = py * (1 - Ky)
pz = pz * (1 - Kz)

// Velocity estimation from innovation
vx += Kx * (mx - x) / dt * 0.3
vy += Ky * (my - y) / dt * 0.3
vz += Kz * (mz - z) / dt * 0.3

confidence = min(confidence + 0.05, 1.0)
predictionUncertainty = max(predictionUncertainty - 0.1, 0.1)
measurementCount++
```

### Track Quality Score
```
recency = clamp(1 - (now - lastUpdate) / maxPredictionAge, 0, 1)
measurementFactor = clamp(measurementCount / 10, 0, 1)
uncertaintyFactor = 1 - predictionUncertainty

quality = clamp(recency * 0.4 + measurementFactor * 0.3 + uncertaintyFactor * 0.3, 0, 1)
```

Default maxPredictionAge: 5.0 seconds

### Position Prediction
```
predicted(dt) = [x + vx*dt, y + vy*dt, z + vz*dt]
```

## 4. Contact Behaviors

### Behavior Parameters
Each contact has behavior-specific parameters initialized at spawn:

| Behavior | Speed Mult | Altitude | Radius | Special |
|----------|-----------|----------|--------|---------|
| CRUISE | 1.0 | 35-55m | 80-160m | Circular patrol |
| LOITER | 0.4 | 20-40m | 30-80m | Tight orbit |
| APPROACH | 1.3 | 25-45m | - | Direct to target |
| DEPART | 1.2 | 40-70m | - | Direct away |
| ERRATIC | 0.6-1.4 | 15-65m | - | Random waypoints |
| CROSSING | 1.1 | 30-50m | - | Linear transit |
| SLOW | 0.35 | 15-35m | - | Slow patrol |
| FAST | 1.8 | 40-70m | - | High-speed transit |

### Behavior Update (per frame)
Each behavior implements `updateBehavior(dt)` to compute `this.target` position, then a common pursuit controller:

```
toTarget = target - position
desired = normalize(toTarget) * speed
velocity = lerp(velocity, desired, 1 - 0.01^dt)
position += velocity * dt
```

## 5. Classification (Evidence-Based)

### Evidence Classification (NOT ground truth)
```
IF no sensor contact:
    return "UNKNOWN"
ELSE:
    combined = (fusion + trackQuality) / 2
    IF combined > 0.75:     return "SYNTHETIC UAS"
    IF combined > 0.50:     return "POSSIBLE UAS"
    IF combined > 0.30:     return "LOW-CONFIDENCE CONTACT"
    ELSE:                   return "UNKNOWN"
```

**Critical**: Classification uses ONLY sensor evidence, never ground truth.

### Ground Truth (for evaluation only)
```
truthLabel = contact.contactType  // "BENIGN AIR CONTACT" or "SYNTHETIC UAS"
```

## 6. Trainee Decision Scoring

### Reaction Time
```
reactionTime = max(0.4, now - contact.actionableTime)
```
Where `actionableTime` = first moment fusion ≥ threshold AND sensor contact exists

### Correctness
```
correct = (traineeLabel === truthLabel)
```

### Confidence Calibration
```
IF correct:
    IF confidence > 0.85:  penalty = 0      // Well-calibrated high confidence
    IF confidence < 0.40:  penalty = -5     // Underconfident
ELSE:
    IF confidence > 0.85:  penalty = -15    // Overconfident (severe)
    IF confidence < 0.40:  penalty = -5     // Appropriately uncertain
    ELSE:                  penalty = -10    // Moderate confidence, wrong
```

### Score Calculation
```
reactionScore = clamp(100 - reactionTime * 8, 15, 100)
evidenceScore = fusion * 100
trackScore = trackQuality * 100
multiplier = 1 + (difficulty - 1) * 0.18

points = round(
    (correct ? 55 : -20) +
    (correct ? reactionScore*0.3 + evidenceScore*0.2 + trackScore*0.15 : -reactionScore*0.08) +
    calibrationPenalty
) * multiplier

score = max(0, score + points)
```

## 7. Metrics Computation

### Precision, Recall, F1
```
TP = correctDecisions
FP = falseAlarms
FN = missedContacts

precision = TP / (TP + FP) * 100  (or 100 if TP+FP=0)
recall = TP / (TP + FN) * 100     (or 100 if TP+FN=0)
f1 = 2 * precision * recall / (precision + recall)  (or 0 if both 0)
```

### Running Averages
```
averageReaction = sum(reactionTimes) / count
averageDecisionTime = reactionSum / decisions
```

## 8. Skill Vector Update

Exponential moving update with learning rate α = 0.15:

```
skill = clamp(skill + α * (evidence - skill), 0, 1)
```

| Skill | Evidence Signal |
|-------|-----------------|
| Detection | 1 - detectLatency/30 (when first detected) |
| Classification | (correct ? 1 : 0) * fusion |
| Reaction | 1 - reactionTime/15 |
| Sensor Interpretation | correct ? fusion : (1 - fusion) |
| Consistency | recentCorrectRate (last 10 decisions) |
| Confidence Calibration | 1 - |fusion - (correct ? 1 : 0)| |

## 9. Weakness Analysis

### Skill-Based Thresholds
```
IF detectionSkill < 0.45:          weakness = "detection"
IF classificationSkill < 0.45:     weakness = "classification"
IF reactionSkill < 0.45:           weakness = "reaction"
IF sensorInterpretationSkill < 0.45: weakness = "sensorInterpretation"
IF consistencySkill < 0.45:        weakness = "consistency"
IF confidenceCalibration < 0.45:   weakness = "confidenceCalibration"
```

### Metric-Based Thresholds
```
IF recall < 60:                   weakness = "missedContacts"
IF precision < 60:                weakness = "falseAlarms"
IF averageDecisionTime > 10:      weakness = "slowReaction"
```

### Selection
Most severe weakness (highest severity score) selected.

## 10. Adaptive Difficulty

### Difficulty Change Rules
```
detectionRate = contactsCorrect / contactsSeen
avgReaction = reactionSum / detections

IF detectionRate > 0.75 AND avgReaction < 8 AND precision > 75:
    Δdifficulty = +0.35  // Increase
ELSE IF detectionRate < 0.40 OR precision < 55:
    Δdifficulty = -0.20  // Decrease
ELSE IF recall < 60:
    Δdifficulty = -0.10  // Slight decrease
ELSE IF confidenceCalibration < 0.40:
    Δdifficulty = -0.10  // Slight decrease
ELSE:
    Δdifficulty = +0.10  // Gradual increase

difficulty = clamp(difficulty + Δdifficulty, 1.0, 5.0)
```

### Behavior Pool Selection by Weakness
| Weakness | Behavior Pool (Priority Order) |
|----------|--------------------------------|
| detection / missedContacts | CROSSING, APPROACH, CRUISE, LOITER |
| classification / falseAlarms | ERRATIC, SLOW, LOITER, CROSSING |
| reaction / slowReaction | FAST, APPROACH, CROSSING, ERRATIC |
| sensorInterpretation | ERRATIC, CROSSING, APPROACH, DEPART, SLOW, FAST |
| consistency | CRUISE, LOITER, CRUISE, LOITER |
| confidenceCalibration | CRUISE, APPROACH, CROSSING, LOITER |
| (none) | All behaviors |

## 11. Scenario Generation (Deterministic)

### Seed-Based Generation
```
scenarioSeed = "SIH-26247-042"
// Used with seeded PRNG for reproducible scenarios
```

### Phase Configuration
| Phase | Duration | Sensor Noise | Contacts Active |
|-------|----------|--------------|-----------------|
| MONITOR | 12s | radar=0.16, visual=0.10, dropout=0.025 | 2 |
| CONTACT | 15s | radar=0.16, visual=0.10, dropout=0.025 | 3 |
| AMBIGUITY | 14s | radar=0.25, visual=0.18, dropout=0.06 | 4 |
| SURGE | 18s | radar=0.20, visual=0.14, dropout=0.04 | 5 |
| ASSESSMENT | 10s | radar=0.16, visual=0.10, dropout=0.025 | 3 |

## 12. Tactical Radar Rendering

### Coordinate Transform
```
radarStation = [0, 0, -130]
relX = contact.x
relZ = contact.z + 130
dist = sqrt(relX² + relZ²)
angle = atan2(relX, relZ)  // North-up
screenX = centerX + sin(angle) * (dist / range) * radius
screenY = centerY - cos(angle) * (dist / range) * radius
```

### Display Elements
- **Range Rings**: 4 concentric circles at 25%, 50%, 75%, 100% range
- **Ownship**: Center green dot with ring
- **Contacts**: Colored blips (green=UAS, yellow=Benign, orange=Selected)
- **Track History**: Faded line connecting measurement history
- **Velocity Vector**: Arrow from contact showing speed/direction
- **Sweep Line**: Rotating radial synchronized with 3D radar

## 13. Confidence Calibration Theory

### Calibration Error
```
ECE (Expected Calibration Error) ≈ mean(|confidence - accuracy|) per bin
```

### Training Implications
- **Overconfident** (high confidence, low accuracy): Reduce ambiguity, increase feedback
- **Underconfident** (low confidence, high accuracy): Build confidence with clearer evidence
- **Well-calibrated**: Confidence matches accuracy → optimal decision-making

The system penalizes overconfidence more heavily (-15 vs -5) to discourage guessing.