# SIH26247 — Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    3D TRAINING WORLD                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Base    │  │  Radar   │  │  Towers  │  │  Synthetic   │   │
│  │  Env     │  │  Station │  │          │  │  Contacts    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SIMULATION ENGINE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Scenario    │  │  Contact     │  │  Environment         │  │
│  │  Manager     │  │  Behavior    │  │  Conditions          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SENSOR ENGINE                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Radar       │  │  Visual/EO   │  │  RF (Optional)       │  │
│  │  Simulation  │  │  Simulation  │  │  Simulation          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SENSOR FUSION                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Weighted Fusion: Radar(35%) + Visual(30%) + Motion(25%)   │ │
│  │  + RF(10%) → Combined Confidence + Track Quality           │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRACKING (Kalman-style)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Predict → Measure → Update → Track Quality                │ │
│  │  State: [x, y, z, vx, vy, vz] + Covariance Matrix          │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRAINEE INTERFACE                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Observe │  │  Select  │  │ Classify │  │  Submit      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EVALUATION ENGINE                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Accuracy │  │ Reaction │  │ False    │  │ Confidence   │   │
│  │ Precision│  │ Time     │  │ Alarms   │  │ Calibration  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADAPTIVE TRAINING ENGINE                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Skill Vector → Weakness ID → Scenario Recommendation      │ │
│  │  Difficulty Adjustment (gradual, explained)                │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AAR / INSTRUCTOR                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │Performance│  │ Sensor   │  │ Decision │  │ Training     │   │
│  │ Summary  │  │ Analysis │  │ History  │  │ Recommendation│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Simulation Engine (`src/main.js`)
- **Scenario Manager**: Phase-based scenario progression (MONITOR → CONTACT → AMBIGUITY → SURGE → ASSESSMENT)
- **Contact Behavior System**: 8 distinct behaviors (CRUISE, LOITER, APPROACH, DEPART, ERRATIC, CROSSING, SLOW, FAST)
- **Environment**: Procedural terrain, instanced vegetation, military base structures

### 2. Sensor Engine
- **Radar**: Range-based detection with configurable noise and dropout
- **Visual/EO**: Line-of-sight with atmospheric degradation
- **RF**: Intermittent signal intelligence simulation
- **Configurable Parameters**: Range, noise, dropout chance per scenario phase

### 3. Sensor Fusion
- **Weighted Evidence Combination**: Configurable weights (radar: 35%, visual: 30%, motion: 25%, RF: 10%)
- **Track Quality Integration**: Kalman filter track quality feeds into fusion
- **Actionability Threshold**: Minimum confidence for trainee decision

### 4. Tracking (Kalman-style Filter)
- **State Vector**: Position (x, y, z) + Velocity (vx, vy, vz)
- **Covariance Tracking**: Uncertainty propagation through prediction/update cycles
- **Track Quality Metrics**: Recency, measurement count, prediction uncertainty
- **History Buffer**: 60-frame track history for visualization

### 5. Trainee Interface
- **Contact Selection**: Q/E cycling through actionable contacts
- **Classification**: 3 options (UNKNOWN, BENIGN AIR CONTACT, SYNTHETIC UAS)
- **Explicit Submission**: 1/2/3 keys — no auto-scoring
- **Reaction Timing**: Measured from actionable detection to decision

### 6. Evaluation Engine
- **Metrics**: Accuracy, Precision, Recall, F1-Score, Reaction Time
- **Confidence Calibration**: Overconfidence/underconfidence detection with penalties
- **Decision History**: Full audit trail with evidence and outcomes

### 7. Adaptive Training Engine
- **Skill Vector**: 6 dimensions (detection, classification, reaction, sensor interpretation, consistency, confidence calibration)
- **Weakness Identification**: Multi-factor analysis of skill gaps
- **Personalized Scenarios**: Behavior pool selection based on weakness
- **Explainable Adaptation**: Every difficulty change has explicit reasoning

### 8. After-Action Review (AAR)
- **Mission Summary**: Score, difficulty, duration, contacts
- **Performance Metrics**: All evaluation metrics with trends
- **Sensor Analysis**: Per-sensor reliability breakdown
- **Decision History**: Individual decision audit
- **Skill Profile**: Radar chart of skill vector
- **Training Recommendation**: Specific next exercise with rationale
- **Adaptive Explanation**: Why difficulty changed

## Data Flow

```
Contact Spawns
      ↓
Sensor Observations Generated (per frame)
      ↓
Sensor Fusion Computes Combined Confidence
      ↓
Kalman Track Updated with Measurement
      ↓
Track Quality + Fusion → Evidence Displayed to Trainee
      ↓
Trainee Selects Contact → Reviews Evidence → Submits Classification (1/2/3)
      ↓
Evaluation: Compare to Ground Truth → Score + Reaction Time + Calibration
      ↓
Skill Vector Updated → Weakness Analyzed
      ↓
Scenario Cycle Complete → Difficulty Adapted → Next Scenario Generated
      ↓
AAR Generated with Full Analysis
```

## Performance Optimizations

- **InstancedMesh**: Vegetation (trees, bushes, rocks) — 750+ instances
- **Shared Materials**: 15 reusable materials with procedural textures
- **Procedural Textures**: Canvas-generated 256px tiles, no external assets
- **DPR Capping**: Max 1.25, dynamic reduction under load
- **Shadow Map**: 1536px, limited camera bounds
- **Tactical Radar**: Canvas-based, 10 FPS throttle
- **Animation Loop**: Single requestAnimationFrame, ordered updates