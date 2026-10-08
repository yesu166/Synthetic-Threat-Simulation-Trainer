# Synthetic Threat Simulation Trainer

> **An immersive browser-based 3D simulation and training platform for drone operation, aerial observation, synthetic threat recognition, decision-making, and performance evaluation.**

The **Synthetic Threat Simulation Trainer** is a real-time interactive 3D training environment designed to simulate drone operations and aerial-contact scenarios in a controlled, repeatable, and measurable virtual environment.

Instead of relying entirely on physical drones, training ranges, and manually recreated scenarios, the platform provides a software-based environment where users can **operate a simulated drone, observe aerial contacts, analyze simulated evidence, make explicit classifications, receive performance feedback, and progressively train against more challenging scenarios.**

The project combines:

- Real-time 3D rendering
- FPV-style drone controls
- Mouse-look camera interaction
- Synthetic aerial contacts
- Situational awareness
- Contact classification
- Decision evaluation
- Reaction-time measurement
- Performance scoring
- Adaptive training
- After-Action Review
- Browser-based deployment
- Performance-oriented rendering

The central idea is simple:

> **Create a repeatable synthetic environment where users can practice observation and decision-making, measure their performance, learn from mistakes, and progressively improve.**

---

# Table of Contents

- [Project Overview](#project-overview)
- [Why This Project](#why-this-project)
- [Core Training Loop](#core-training-loop)
- [Key Features](#key-features)
- [User Experience](#user-experience)
- [Drone Controls](#drone-controls)
- [Camera System](#camera-system)
- [Synthetic Aerial Contacts](#synthetic-aerial-contacts)
- [Decision and Classification System](#decision-and-classification-system)
- [Performance Evaluation](#performance-evaluation)
- [Adaptive Training](#adaptive-training)
- [After-Action Review](#after-action-review)
- [3D Environment](#3d-environment)
- [Technical Architecture](#technical-architecture)
- [System Flow](#system-flow)
- [Technology Stack](#technology-stack)
- [Performance Engineering](#performance-engineering)
- [Design Principles](#design-principles)
- [Real-World Applications](#real-world-applications)
- [Future Enhancements](#future-enhancements)
- [Product Evolution](#product-evolution)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Development](#development)
- [Production Build](#production-build)
- [Controls Reference](#controls-reference)
- [Safety and Responsible Use](#safety-and-responsible-use)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Project Vision](#project-vision)

---

# Project Overview

The Synthetic Threat Simulation Trainer is a **browser-based 3D simulation platform** that combines immersive drone interaction with structured training and evaluation.

The application provides a simulated environment containing:

- A detailed 3D training area
- Interactive drone flight
- FPV-style camera control
- Multiple synthetic aerial contacts
- Radar-style situational awareness
- Contact selection
- Contact classification
- Performance measurement
- Adaptive scenario difficulty
- After-Action Review

The platform is designed around the concept that simulation should not only reproduce an environment — it should also **measure the decisions made inside that environment**.

A trainee is therefore not simply flying around a 3D scene.

The trainee is expected to:

1. Observe.
2. Understand.
3. Decide.
4. Submit a classification.
5. Receive an evaluation.
6. Learn from the result.
7. Attempt a more appropriate scenario.

---

# Why This Project

Physical drone training can introduce several practical challenges:

- Equipment cost
- Battery limitations
- Maintenance
- Limited training space
- Weather dependency
- Safety requirements
- Instructor availability
- Difficulty reproducing identical scenarios
- Difficulty collecting consistent performance data

A software simulator can provide a complementary training environment where scenarios can be repeated consistently.

For example, a trainee could experience the same scenario multiple times while changing:

- Number of aerial contacts
- Movement patterns
- Observation difficulty
- Time pressure
- Environmental conditions
- Decision complexity

This creates an environment for **repeatable practice and measurable improvement**.

---

# Core Training Loop

The entire application is designed around one central loop:

```text
┌───────────────────┐
│      SCENARIO     │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│ 3D ENVIRONMENT    │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│ AERIAL CONTACTS   │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│    OBSERVATION    │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│     ANALYSIS      │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│ TRAINEE DECISION  │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│    EVALUATION     │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│     METRICS       │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│ ADAPTIVE TRAINING │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  AFTER-ACTION     │
│     REVIEW        │
└─────────┬─────────┘
          │
          └──────────→ NEXT SCENARIO
```

This produces a continuous:

**Observe → Decide → Measure → Learn → Repeat**

workflow.

---

# Key Features

## 1. Immersive 3D Simulation

The simulator provides a real-time 3D environment containing:

- Terrain
- Roads
- Ground surfaces
- Buildings
- Training structures
- Vegetation
- Environmental objects
- Synthetic drones
- Atmospheric presentation

The objective is to provide sufficient spatial context for realistic observation and decision-making without requiring a physical training range.

---

## 2. FPV-Style Drone Operation

The platform supports an immersive first-person flight experience.

The drone responds to:

- Keyboard movement
- Mouse-look
- Smooth acceleration
- Momentum
- Directional movement
- Camera rotation
- Visual pitch/roll response

The flight experience is designed to feel responsive while remaining lightweight enough for browser-based execution.

---

## 3. Multiple Camera Perspectives

The simulator supports multiple perspectives depending on the current experience.

Possible views include:

- FPV
- Pilot
- Chase
- Observer

The FPV camera provides an immersive operator perspective, while external camera modes provide better situational awareness of the simulated environment.

---

## 4. Synthetic Aerial Contacts

The simulator introduces synthetic aerial contacts into the environment.

These contacts provide the basis for the training problem.

The user must observe available information and decide what the contact represents.

Contacts can be evaluated using attributes such as:

- Position
- Movement
- Direction
- Distance
- Velocity
- Scenario state
- Classification state
- Simulated observation information

All contacts are synthetic.

---

## 5. Explicit Trainee Decision

One of the most important design choices is that the simulator does **not automatically make the trainee's decision**.

The user must explicitly select a contact and submit a classification.

The current classification workflow includes:

```text
UNKNOWN
      ↓
BENIGN AIR CONTACT
      ↓
SYNTHETIC UAS
```

The evaluation engine then determines whether the trainee's decision matches the scenario ground truth.

This creates an actual assessment loop rather than a purely visual simulation.

---

# User Experience

A typical training session follows this sequence:

### Step 1 — Enter the Simulation

The user enters the 3D environment.

### Step 2 — Take Control

The user operates the simulated drone using keyboard and mouse controls.

### Step 3 — Observe

The user scans the environment for aerial contacts.

### Step 4 — Select

The user selects a contact for closer observation.

### Step 5 — Analyze

The user considers the available simulated information.

### Step 6 — Classify

The user explicitly chooses a classification.

### Step 7 — Evaluate

The simulator determines whether the decision was correct.

### Step 8 — Measure

The system records performance information.

### Step 9 — Review

The user opens the After-Action Review.

### Step 10 — Continue

The training system can adjust the difficulty of future scenarios.

---

# Drone Controls

| Key / Input | Function |
|---|---|
| `W` | Move forward |
| `S` | Move backward |
| `A` | Move left |
| `D` | Move right |
| `Mouse` | Look / camera control |
| `Space` | Ascend when enabled |
| `Shift` | Descend when enabled |
| `Q` | Select previous contact |
| `E` | Select next contact |
| `1` | UNKNOWN |
| `2` | BENIGN AIR CONTACT |
| `3` | SYNTHETIC UAS |
| `F2` | Open After-Action Review |
| `ESC` | Release mouse pointer lock |

### Important Control Rule

```text
W = FORWARD
S = BACKWARD
A = LEFT
D = RIGHT
```

The simulator intentionally avoids the common problem of inverted forward/backward movement.

---

# Camera System

The camera system is designed around an FPV-style experience.

## Mouse Look

The mouse controls:

- Horizontal camera rotation
- Vertical camera rotation

Pointer Lock is used to provide continuous mouse movement while flying.

`ESC` releases pointer lock.

## Camera Smoothing

The camera uses smoothing to avoid abrupt visual movement.

The objective is to create:

```text
Mouse Input
     ↓
Target Rotation
     ↓
Smoothing
     ↓
Camera Rotation
```

rather than directly applying every mouse event as a sudden camera movement.

## FPV Camera

The FPV camera is positioned close to the drone's forward-facing viewpoint.

This gives the user the perception of sitting inside the drone rather than looking at it from outside.

## Camera Motion

Camera movement can respond subtly to drone movement.

Possible effects include:

- Pitch response
- Roll response
- Speed-based visual behavior
- Small camera banking effects
- Smooth transitions

These effects are intentionally restrained to avoid unnecessary motion sickness.

---

# Synthetic Aerial Contacts

Synthetic contacts are the central interaction objects in the training environment.

They allow the application to transform a 3D flight simulator into a decision-making platform.

A contact can have:

```text
Position
Velocity
Direction
Distance
Visibility
Scenario State
Ground Truth
Observation State
Classification State
```

The simulator can then use these properties to create different levels of training difficulty.

---

# Decision and Classification System

The trainee can select an aerial contact and explicitly classify it.

Current decision categories include:

### UNKNOWN

Used when the available information is insufficient for a confident classification.

### BENIGN AIR CONTACT

Represents a non-threatening synthetic aerial contact.

### SYNTHETIC UAS

Represents a synthetic unmanned aerial system within the training scenario.

The system compares the submitted decision with the scenario's known ground truth.

This allows the platform to calculate performance objectively.

---

# Performance Evaluation

The simulator tracks training performance using measurable indicators.

Examples include:

- Correct decisions
- Incorrect decisions
- Reaction time
- Classification precision
- Scenario score
- Overall performance
- Severity of incorrect decisions

The objective is to transform:

```text
USER ACTION
     ↓
MEASURABLE EVENT
     ↓
EVALUATION
     ↓
TRAINING FEEDBACK
```

rather than simply displaying a final score.

---

# Reaction Time

Reaction time is an important training metric.

The simulator can measure the time between relevant scenario/contact events and the trainee's explicit decision.

This enables future analysis such as:

```text
Scenario A
Reaction: 2.4 sec
Result: Correct

Scenario B
Reaction: 5.1 sec
Result: Correct

Scenario C
Reaction: 1.8 sec
Result: Incorrect
```

This becomes more useful when collected across many sessions.

---

# Adaptive Training

The simulator includes an adaptive difficulty layer.

The goal is to avoid giving every trainee exactly the same difficulty regardless of performance.

A simplified concept is:

```text
Performance
     ↓
Skill Assessment
     ↓
Difficulty Adjustment
     ↓
Next Scenario
```

If performance is consistently strong, future scenarios can become more challenging.

If performance is weak, the system can provide scenarios that reinforce the relevant skill before increasing complexity.

The current approach favors transparent rules over unexplained black-box behavior.

---

# After-Action Review

The **After-Action Review (AAR)** converts a simulation session into a learning experience.

The review can present:

- Decisions
- Correct classifications
- Incorrect classifications
- Reaction times
- Performance score
- Scenario severity
- Training observations
- Areas requiring improvement

The purpose is not simply to tell the user that they were wrong.

The purpose is to help answer:

> **What happened, what did I decide, how did I perform, and what should I improve?**

---

# 3D Environment

The visual environment is designed to provide context for the simulation.

It includes elements such as:

- Terrain
- Grass
- Dirt
- Roads
- Concrete
- Buildings
- Vegetation
- Training structures
- Synthetic drones
- Environmental details

Procedural and reusable materials can be used to reduce the need for large external asset files.

This helps keep the application lightweight.

---

# Drone Visual Design

The simulated drones are represented with multiple visual components rather than a single primitive object.

Depending on the model, visual components can include:

- Central body
- Arms
- Motors
- Propeller hubs
- Propellers
- Camera housing
- Lens
- Antenna
- Landing supports
- Structural panels
- Battery compartment
- Warning markings

Propellers can be animated to reinforce the perception of active flight.

---

# Technical Architecture

The application can be understood as several cooperating systems.

```text
┌───────────────────────────────┐
│            UI / HUD           │
│ Radar • Metrics • Controls    │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       INPUT / CONTROLS        │
│ Keyboard • Mouse • PointerLock│
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│        CAMERA SYSTEM          │
│ FPV • Chase • Observer        │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       3D SIMULATION           │
│ World • Drone • Environment   │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│    CONTACT / SENSOR MODEL     │
│ Synthetic observations        │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       DECISION ENGINE         │
│ Selection • Classification    │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│      EVALUATION ENGINE        │
│ Accuracy • Reaction • Score   │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       ADAPTIVE TRAINING       │
│ Difficulty • Progression      │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       AFTER-ACTION REVIEW     │
│ Feedback • Metrics • Learning │
└───────────────────────────────┘
```

---

# System Flow

The complete runtime flow is:

```text
Application Start
      ↓
Initialize Renderer
      ↓
Initialize Environment
      ↓
Initialize Drone
      ↓
Initialize Camera
      ↓
Initialize Synthetic Contacts
      ↓
Start Scenario
      ↓
User Observes Environment
      ↓
Contact Selected
      ↓
Simulated Evidence Available
      ↓
User Makes Decision
      ↓
Evaluation
      ↓
Metrics Updated
      ↓
Scenario Continues
      ↓
AAR
      ↓
Difficulty Adaptation
      ↓
Next Scenario
```

---

# Technology Stack

## Frontend

- HTML
- CSS
- JavaScript

## 3D Rendering

- Three.js
- WebGL

## Development Tooling

- Vite
- Node.js
- npm

## Browser APIs

- Pointer Lock API
- WebGL

The architecture intentionally remains browser-first so that the simulator can run without requiring a dedicated desktop simulation engine.

---

# Performance Engineering

Real-time 3D graphics can become expensive quickly.

The project therefore emphasizes performance alongside visual quality.

## Optimization Techniques

### Shared Geometry

Repeated objects can reuse geometry rather than creating independent geometry for every instance.

### Shared Materials

Similar objects reuse materials wherever possible.

### Instanced Rendering

Repeated vegetation and environment objects can use instancing to reduce draw overhead.

### Texture Reuse

Procedural and shared textures reduce memory usage and network dependencies.

### Pixel Ratio Control

The renderer limits device pixel ratio to avoid excessive GPU workload on high-density displays.

### Shadow Budget

Shadow-map resolution is controlled rather than allowing unlimited shadow quality.

### Dynamic Performance Adaptation

The renderer can respond to poor frame rates by reducing rendering workload.

### Reusable Objects

Per-frame allocations are minimized to reduce garbage collection pressure.

---

# Performance Philosophy

The goal is not:

> Maximum polygons.

The goal is:

> **Maximum training value per unit of computation.**

A stable simulation with responsive controls is more useful than an extremely detailed environment that causes poor frame rates.

---

# Real-World Applications

The platform has potential applications beyond a demonstration project.

## 1. Drone Operator Familiarization

The simulator can provide a low-risk environment for learning:

- Basic flight interaction
- Camera orientation
- Spatial awareness
- Observation
- Control familiarity

before physical equipment is introduced.

---

## 2. Repeatable Training

Instructors can recreate controlled scenarios without rebuilding a physical training environment.

A scenario can be repeated with consistent conditions.

---

## 3. Performance Assessment

The platform can record objective indicators such as:

- Accuracy
- Reaction time
- Decision quality
- Scenario performance

This can support more structured evaluation.

---

## 4. Classroom Training

A browser-based simulator can potentially be deployed across multiple computers for classroom demonstrations and practical exercises.

---

## 5. Instructor-Assisted Training

Future versions can provide instructor dashboards showing:

- Trainee progress
- Scenario history
- Weak areas
- Performance trends
- Training recommendations

---

## 6. Scenario Research

The platform can be used to experiment with how changes in:

- Information availability
- Environmental complexity
- Number of contacts
- Time pressure
- Scenario difficulty

affect human decision-making.

---

# Real-World Implementation Potential

A mature version of the platform could follow this architecture:

```text
                TRAINING PLATFORM
                       │
       ┌───────────────┼───────────────┐
       ↓               ↓               ↓
   Simulator      Instructor       Analytics
       │             Console           │
       │               │               │
       └───────────────┼───────────────┘
                       ↓
                Training Database
                       ↓
                Skill Profiles
                       ↓
             Personalized Training
```

This would transform the application from a standalone simulator into a complete training ecosystem.

---

# Future Enhancements

## 1. Advanced Synthetic Sensors

Future versions can simulate multiple evidence sources:

- Visual
- Infrared-style
- Radar-like
- Acoustic

Each source could introduce:

- Noise
- Uncertainty
- Occlusion
- False positives
- False negatives

The objective would be to make decisions more dependent on evidence quality rather than simple object visibility.

---

# 2. Multi-Sensor Fusion

A future fusion layer could combine multiple synthetic sources:

```text
        Visual
          │
        Infrared
          │
        Radar
          │
       Acoustic
          │
          ▼
   ┌──────────────┐
   │ Fusion Engine│
   └──────┬───────┘
          ↓
   Contact Estimate
          ↓
    Confidence
          ↓
    Classification
```

---

# 3. Advanced Tracking

Future tracking capabilities could include:

- Track history
- Velocity estimation
- Predicted position
- Track confidence
- Lost-track handling
- Uncertainty visualization

---

# 4. Scenario Editor

An instructor-facing scenario editor could allow configuration of:

- Environment
- Number of contacts
- Contact behavior
- Difficulty
- Time limits
- Ground truth
- Evaluation criteria
- Visibility
- Environmental conditions

This would make the platform configurable rather than dependent on fixed scenarios.

---

# 5. Instructor Dashboard

A future dashboard could display:

```text
TRAINEE PERFORMANCE

Accuracy       ████████████░  87%
Reaction Time  █████████░░░  72%
Precision      ██████████░░  81%

Weak Area:
Contact classification

Recommended:
Intermediate observation scenario
```

---

# 6. Persistent Training Profiles

A backend could eventually store:

- User profiles
- Session history
- Performance metrics
- Scenario results
- Skill progression
- AAR reports

This enables long-term analytics.

---

# 7. AI-Assisted Personalization

AI can eventually assist with:

- Scenario generation
- Personalized training recommendations
- Performance pattern detection
- AAR summaries
- Difficulty calibration

However, AI should remain explainable and grounded in measurable simulation data.

The system should not use AI simply because AI is available.

---

# 8. Multiplayer Training

Future versions could support multiple users in the same synthetic environment.

Possible roles:

- Operator
- Observer
- Instructor
- Coordinator

This would require synchronized simulation state and robust session management.

---

# 9. VR / AR

The 3D architecture could eventually support:

- VR headsets
- Motion controllers
- Immersive flight interfaces
- AR-assisted training

VR should be introduced only if the added immersion provides measurable training value.

---

# 10. Digital Twin Research

A future version could investigate controlled digital representations of:

- Training environments
- Drone platforms
- Sensor configurations
- Environmental conditions
- Airspace constraints

Such integrations would require validation, authorization, safety controls, and appropriate data governance.

---

# Product Evolution

The project can evolve through four major stages.

## Stage 1 — Simulator

```text
3D Environment
      +
Drone Controls
      +
Camera
      +
Synthetic Contacts
```

---

## Stage 2 — Training Platform

```text
Simulator
    +
Scenarios
    +
Evaluation
    +
Metrics
    +
Adaptive Difficulty
    +
AAR
```

---

## Stage 3 — Instructor Platform

```text
Training
   +
User Profiles
   +
Scenario Authoring
   +
Analytics
   +
Instructor Dashboard
```

---

## Stage 4 — Simulation Ecosystem

```text
Instructor Platform
        +
Advanced Sensors
        +
Sensor Fusion
        +
AI Personalization
        +
Multiplayer
        +
VR / AR
```

The long-term objective is not to create the largest simulator.

It is to create the most **useful, measurable, explainable, and scalable training experience**.

---

# Project Structure

The exact source structure may evolve as the application develops.

A recommended organization is:

```text
Synthetic-Threat-Simulation-Trainer/
│
├── public/
│
├── src/
│   ├── main/
│   │
│   ├── simulation/
│   │   ├── environment
│   │   ├── drone
│   │   └── scenario
│   │
│   ├── camera/
│   │   ├── fpv
│   │   ├── chase
│   │   └── observer
│   │
│   ├── controls/
│   │   ├── keyboard
│   │   └── mouse
│   │
│   ├── contacts/
│   │   ├── contact generation
│   │   ├── tracking
│   │   └── observations
│   │
│   ├── evaluation/
│   │   ├── classification
│   │   ├── scoring
│   │   └── metrics
│   │
│   ├── adaptive/
│   │   └── difficulty
│   │
│   └── ui/
│       ├── HUD
│       ├── radar
│       └── AAR
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── EVALUATION.md
│   ├── PERFORMANCE.md
│   ├── ROADMAP.md
│   └── SAFETY.md
│
├── index.html
├── package.json
├── vite.config.*
├── README.md
└── LICENSE
```

---

# Installation

## Requirements

Install:

- Node.js
- npm
- A modern WebGL-capable browser

Recommended browsers:

- Chrome
- Edge
- Firefox

---

## Clone the Repository

```bash
git clone https://github.com/yesu166/Synthetic-Threat-Simulation-Trainer.git
```

Move into the project:

```bash
cd Synthetic-Threat-Simulation-Trainer
```

Install dependencies:

```bash
npm install
```

---

# Development

Start the development server:

```bash
npm run dev
```

Vite will display the local development URL.

Open that URL in a modern browser.

---

# Production Build

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

# Controls Reference

| Input | Action |
|---|---|
| `W` | Forward |
| `S` | Backward |
| `A` | Left |
| `D` | Right |
| Mouse | Look |
| `Space` | Ascend |
| `Shift` | Descend |
| `Q` | Previous contact |
| `E` | Next contact |
| `1` | Unknown |
| `2` | Benign air contact |
| `3` | Synthetic UAS |
| `F2` | After-Action Review |
| `ESC` | Release pointer lock |

---

# Design Principles

## Simulation Over Decoration

Every major system should contribute to the training objective.

Visual quality matters, but it should support the experience rather than become the experience.

---

## Human Decision First

The trainee should make the actual classification.

The system should evaluate the decision rather than silently making it.

---

## Explainability Over Black Boxes

Adaptive training should be understandable.

The trainee should be able to understand why their performance changed and why the next scenario is more or less difficult.

---

## Smallest Useful MVP

New features should be added only when they improve:

- Training value
- Measurement
- Realism
- Usability
- Scalability

More code does not automatically mean a better simulator.

---

## Performance Is a Feature

A simulator that looks good but runs poorly provides a weak training experience.

Responsive interaction is therefore treated as a core feature.

---

# Safety and Responsible Use

This project is a **synthetic software training environment**.

It does not directly control:

- Real drones
- Weapons
- Countermeasure systems
- Operational military systems

The simulated aerial contacts and scenarios are synthetic.

The platform should remain focused on:

- Education
- Simulation
- Training
- Observation
- Decision-making research
- Performance evaluation

Any future connection to real-world hardware or operational infrastructure should require:

- Explicit authorization
- Safety validation
- Human oversight
- Cybersecurity controls
- Access controls
- Data governance
- Appropriate testing

---

# Limitations

This project is a simulation and should not be interpreted as a certified operational training system.

It does not replace:

- Professional instruction
- Physical drone training
- Certified equipment
- Operational procedures
- Safety training
- Real-world validation

Simulation performance should be treated as a training indicator rather than a guarantee of real-world performance.

---

# Roadmap

## Phase 1 — Core Simulation

- [x] Browser-based 3D environment
- [x] Drone interaction
- [x] FPV camera
- [x] Mouse-look
- [x] Keyboard movement
- [x] Synthetic aerial contacts
- [x] HUD
- [x] Radar-style awareness

---

## Phase 2 — Training

- [x] Explicit classification
- [x] Decision evaluation
- [x] Reaction-time measurement
- [x] Performance scoring
- [x] Adaptive difficulty
- [x] After-Action Review

---

## Phase 3 — Instructor Platform

- [ ] Scenario editor
- [ ] Instructor dashboard
- [ ] Persistent trainee profiles
- [ ] Session history
- [ ] Performance graphs
- [ ] Report generation

---

## Phase 4 — Advanced Simulation

- [ ] Multi-sensor simulation
- [ ] Sensor fusion
- [ ] Track confidence
- [ ] Environmental uncertainty
- [ ] Advanced scenario generation

---

## Phase 5 — Scalable Training Ecosystem

- [ ] Backend
- [ ] Multi-user sessions
- [ ] Persistent analytics
- [ ] AI-assisted personalization
- [ ] VR/AR
- [ ] Controlled external integrations

---

# Contributing

Contributions are welcome.

Before adding a feature, consider:

1. Does it improve training value?
2. Does it improve realism?
3. Does it improve measurement?
4. Does it improve usability?
5. Does it introduce unnecessary complexity?
6. Does it negatively affect performance?

For larger changes, document the design before implementation.

---

# License

This project is released under the **MIT License**.

See [`LICENSE`](./LICENSE) for details.

---

# Project Vision

The long-term vision is to transform the simulator from a browser-based 3D application into a **complete synthetic training ecosystem**.

The foundation is:

```text
SIMULATION
    ↓
OBSERVATION
    ↓
DECISION
    ↓
EVALUATION
    ↓
FEEDBACK
    ↓
ADAPTATION
    ↓
IMPROVEMENT
```

The most important question is not:

> "How many features does the simulator have?"

It is:

> **"Can the system help a trainee practice, measure, understand, and improve their decisions?"**

That principle should guide every future development decision.

---

# Repository

**GitHub:**

https://github.com/yesu166/Synthetic-Threat-Simulation-Trainer

**Project:** Synthetic Threat Simulation Trainer

**Status:** Active Development

---

## Built With

**JavaScript · Three.js · WebGL · Vite · HTML · CSS**

---

> **Build the simulation. Measure the decision. Learn from the result. Improve through repetition.**