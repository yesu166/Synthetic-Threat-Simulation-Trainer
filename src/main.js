
import * as THREE from "three";
import "./style.css";

/*
  SIH26247 — AI-Enabled Drone & Counter-Drone Threat Simulation Trainer
  Stable synthetic training prototype.

  Design goals:
  - No external textures or network dependencies.
  - No undefined shared materials.
  - Instanced vegetation for performance.
  - Limited dynamic objects/lights.
  - Observer + Drone Pilot modes.
  - Synthetic threat detection/tracking/evaluation.
  - Strong visual military-training-base presentation.
  - Safe game-like simulation only.
*/

const CONFIG = {
  terrainSize: 520,
  terrainSegments: 96,
  treeCount: 420,
  rockCount: 110,
  bushCount: 220,
  droneCount: 8,
  maxPixelRatio: 1.25,
  shadowMapSize: 1536,
  fogNear: 150,
  fogFar: 500,
  textureSize: 256,
  textureAnisotropy: 2,
  enableShadows: true,
  
  // Sensor fusion weights (configurable)
  fusionWeights: {
    radar: 0.35,
    visual: 0.30,
    motion: 0.25,
    rf: 0.10,
  },
  
  // Tracking parameters
  tracker: {
    processNoise: 0.5,
    measurementNoise: 1.0,
    maxPredictionAge: 5.0,
  },
  
  // Scenario generation
  scenarioSeed: "SIH-26247-042",
  
  // FPV Camera & Flight Control
  camera: {
    // Mouse look
    mouseSensitivity: 0.0022,
    pitchMin: -1.4, // ~ -80 degrees
    pitchMax: 1.4,  // ~ +80 degrees
    
    // Smoothing
    yawSmoothing: 15.0,      // Higher = snappier
    pitchSmoothing: 15.0,
    
    // Movement physics
    acceleration: 80.0,      // m/s^2
    deceleration: 12.0,      // drag when no input
    maxSpeed: 45.0,          // m/s
    maxVerticalSpeed: 20.0,  // m/s
    
    // FPV mode
    fpvOffset: new THREE.Vector3(0, 0.3, 1.8), // Relative to drone body
    
    // Chase mode
    chaseDistance: 18.0,
    chaseHeight: 6.0,
    chaseSmoothing: 8.0,
    chaseLookAhead: 4.0,
    
    // Visual effects
    maxBankAngle: 0.3,       // ~17 degrees max visual roll
    bankSmoothing: 5.0,
    fovBase: 70,
    fovMax: 82,
    fovSpeed: 35.0,          // Speed at which FOV reaches max
    fovSmoothing: 3.0,
    
    // Camera shake
    shakeEnabled: true,
    shakeIntensity: 0.008,
  },
  
  // Mobile Controls
  mobile: {
    enabled: false,          // Set to true on touch devices
    joystickSize: 140,       // Base size in px (clamped by CSS)
    deadzone: 0.08,          // Input deadzone
    lookSensitivity: 0.0035, // Right stick look sensitivity
    responseCurve: 1.2,      // Gentle curve for precision
  },
};

const state = {
  mode: "observer",
  running: true,
  elapsed: 0,
  score: 0,
  detections: 0,
  correctClassifications: 0,
  falseAlarms: 0,
  reactionSum: 0,
  selectedThreat: null,
  selectedIndex: 0,
  scenarioTime: 0,
  lastDecisionKey: null,
  difficulty: 1,
  mouseLocked: false,
  keys: new Set(),
  radarAngle: 0,
  lastFrame: performance.now(),
  fps: 60,
  fpsAccumulator: 0,
  fpsFrames: 0,
  messageTimer: 0,
  decisionCount: 0,
  lastDecision: null,
  lastRadarRender: 0,

  // Instructor/scenario layer
  scenario: {
    id: "AIRSPACE-01",
    name: "Baseline Perimeter Sweep",
    phase: "monitor",
    phaseTime: 0,
    elapsed: 0,
    active: true,
    objective: "Detect and classify all synthetic aerial contacts.",
    completed: false,
    seed: CONFIG.scenarioSeed,
  },

  // Training metrics
  metrics: {
    contactsSeen: 0,
    contactsDetected: 0,
    contactsCorrect: 0,
    falseAlarms: 0,
    missedContacts: 0,
    averageReaction: 0,
    confidence: 0,
    attention: 100,
    stress: 0,
    precision: 100,
    decisions: 0,
    correctDecisions: 0,
    wrongDecisions: 0,
    averageDecisionTime: 0,
    recall: 0,
    f1Score: 0,
  },

  // Trainee skill vector for personalized adaptation
  skillVector: {
    detectionSkill: 0.5,
    classificationSkill: 0.5,
    reactionSkill: 0.5,
    sensorInterpretationSkill: 0.5,
    consistencySkill: 0.5,
    confidenceCalibration: 0.5,
  },

  // Sensor uncertainty is deliberate: the trainee must interpret evidence.
  sensorModel: {
    radarRange: 190,
    visualRange: 92,
    radarNoise: 0.16,
    visualNoise: 0.10,
    dropoutChance: 0.025,
  },

  // Fusion configuration
  fusionConfig: {
    weights: { ...CONFIG.fusionWeights },
    minConfidenceThreshold: 0.15,
  },

  afterAction: [],
  
  // Track management
  tracks: new Map(),
  trackIdCounter: 0,
  
  // Performance tracking
  reactionTimes: [],
  confidenceHistory: [],
  
  // Scenario generator
  scenarioGenerator: null,
  
  // Weakness analysis
  detectedWeakness: null,
  nextScenarioRecommendation: null,

  // Camera & Flight Control
  camera: {
    // Current camera mode: "observer" | "pilot" | "fpv" | "chase"
    mode: "observer",
    // For observer/pilot: free camera
    yaw: 0,
    pitch: -0.05,
    targetYaw: 0,
    targetPitch: -0.05,
    // For fpv/chase: attached to drone
    fpvDroneId: 1,
    // Movement physics (for observer/pilot/fpv)
    velocity: new THREE.Vector3(),
    // Visual effects
    bankAngle: 0,
    targetBankAngle: 0,
    currentFov: CONFIG.camera.fovBase,
    targetFov: CONFIG.camera.fovBase,
    // Pointer lock hint
    pointerLockHintShown: false,
    // Reusable vectors
    _tmpVec3: new THREE.Vector3(),
    _tmpVec3_2: new THREE.Vector3(),
    _tmpQuat: new THREE.Quaternion(),
    _tmpEuler: new THREE.Euler(),
  },

  // Mobile Controls
  mobile: {
    enabled: false,
    leftJoystick: {
      pointerId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      active: false,
    },
    rightJoystick: {
      pointerId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      active: false,
    },
    // Normalized input values (same as keyboard/mouse)
    moveX: 0,      // -1 to 1 (left/right strafe)
    moveY: 0,      // -1 to 1 (forward/backward)
    lookX: 0,      // -1 to 1 (yaw)
    lookY: 0,      // -1 to 1 (pitch)
    vertInput: 0,  // -1 to 1 (up/down)
  },
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd2f2);
scene.fog = new THREE.Fog(0x8fd2f2, CONFIG.fogNear, CONFIG.fogFar);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  900
);
camera.position.set(0, 9, 75);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
renderer.shadowMap.enabled = CONFIG.enableShadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);


// ---------- LOW-COST PROCEDURAL SURFACE DETAIL ----------
function makeTileTexture(draw, repeatX, repeatY) {
  const size = CONFIG.textureSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: false });
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = CONFIG.textureAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function speckled(base, accents, repeatX = 8, repeatY = 8) {
  return makeTileTexture((ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = accents[i % accents.length];
      ctx.globalAlpha = 0.10 + Math.random() * 0.20;
      const r = 0.35 + Math.random() * 1.4;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, repeatX, repeatY);
}

function concreteTex() {
  return makeTileTexture((ctx, s) => {
    ctx.fillStyle = "#777c78";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = i % 2 ? "#a0a49f" : "#4e5551";
      ctx.globalAlpha = 0.10 + Math.random() * 0.18;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 1 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(25,30,28,.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const p = (s / 4) * i;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
    }
  }, 3, 3);
}

const TEX = {
  grass: speckled("#426b3d", ["#2c5032", "#64804a", "#758c50"], 12, 12),
  dirt: speckled("#6e573e", ["#4a3829", "#896f4e", "#a08058"], 8, 8),
  asphalt: speckled("#272b2d", ["#191d1e", "#4e5354", "#626666"], 6, 6),
  concrete: concreteTex(),
  olive: speckled("#4f5948", ["#303a30", "#69735a", "#273027"], 5, 5),
  metal: speckled("#606966", ["#313836", "#8b918e", "#4b5250"], 4, 4),
};

// ---------- MATERIAL FACTORY ----------

const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: 0x47723e, roughness: 1 }),
  grassDark: new THREE.MeshStandardMaterial({ color: 0x315d36, roughness: 1 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x765f42, roughness: 1 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x252a2c, roughness: 0.92 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x858b88, roughness: 0.88 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x59605e, roughness: 0.9 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x56634e, roughness: 0.9 }),
  oliveDark: new THREE.MeshStandardMaterial({ color: 0x354335, roughness: 0.95 }),
  green: new THREE.MeshStandardMaterial({ color: 0x27482f, roughness: 0.95 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e8df, roughness: 0.75 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf0c642, roughness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xff3434, emissive: 0x3b0000 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff8c24, emissive: 0x2d1200 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x29a9ff, emissive: 0x05263d }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x36e7ff, emissive: 0x083743 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x20282a, metalness: 0.65, roughness: 0.38 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x727a78, metalness: 0.65, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x5e8f98,
    transparent: true,
    opacity: 0.58,
    roughness: 0.12,
    metalness: 0.15,
  }),
  black: new THREE.MeshStandardMaterial({ color: 0x111516, roughness: 0.7 }),
};
for (const [name, texture] of [
  ["grass", TEX.grass], ["grassDark", TEX.grass], ["dirt", TEX.dirt],
  ["asphalt", TEX.asphalt], ["concrete", TEX.concrete], ["concreteDark", TEX.concrete],
  ["olive", TEX.olive], ["oliveDark", TEX.olive], ["green", TEX.grass],
  ["metal", TEX.metal], ["darkMetal", TEX.metal]
]) {
  MAT[name].map = texture;
  MAT[name].needsUpdate = true;
}


// ---------- LIGHTING ----------

const hemi = new THREE.HemisphereLight(0xdff5ff, 0x263827, 2.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5d8, 3.0);
sun.position.set(-100, 150, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
sun.shadow.bias = -0.0002;
scene.add(sun);

// ---------- HELPERS ----------

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  return m;
}

function addBox(parent, size, material, position, rotation = [0, 0, 0], cast = true) {
  const m = mesh(new THREE.BoxGeometry(...size), material, position, rotation);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function addCylinder(parent, radiusTop, radiusBottom, height, material, position, segments = 12) {
  const m = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, position);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function addTexturedLikePanel(parent, width, height, material, position) {
  const p = addBox(parent, [width, height, 0.12], material, position, [0, 0, 0], false);
  return p;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// ---------- SKY / TERRAIN ----------

function createSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0x91d5f4, side: THREE.BackSide })
  );
  scene.add(sky);

  // Bright cloud cards. Cheap geometry, no texture requests.
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const count = 3 + Math.floor(Math.random() * 5);
    for (let j = 0; j < count; j++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(rand(5, 11), 10, 6),
        cloudMat
      );
      puff.scale.y = rand(0.35, 0.7);
      puff.position.set(j * rand(4, 8), rand(-2, 2), rand(-3, 3));
      g.add(puff);
    }
    g.position.set(rand(-240, 240), rand(75, 125), rand(-280, -80));
    g.rotation.y = rand(0, Math.PI);
    scene.add(g);
  }
}

function createTerrain() {
  const geo = new THREE.PlaneGeometry(
    CONFIG.terrainSize,
    CONFIG.terrainSize,
    CONFIG.terrainSegments,
    CONFIG.terrainSegments
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const waves =
      Math.sin(x * 0.025) * 0.8 +
      Math.cos(z * 0.018) * 0.7 +
      Math.sin((x + z) * 0.045) * 0.35;
    pos.setY(i, Math.max(-1.2, waves));
  }
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(geo, MAT.grass);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Large clear training apron.
  addBox(
    scene,
    [145, 0.5, 105],
    MAT.asphalt,
    [0, -0.2, -55],
    [0, 0, 0],
    false
  );

  // Road network.
  addBox(scene, [28, 0.18, 420], MAT.asphalt, [150, 0.0, 0], [0, 0, 0], false);
  addBox(scene, [420, 0.18, 25], MAT.asphalt, [0, 0.02, 115], [0, 0, 0], false);

  createRoadMarkings();
  createMountains();
}

function createRoadMarkings() {
  const markMat = new THREE.MeshBasicMaterial({ color: 0xe2d46b });
  const group = new THREE.Group();

  for (let z = -90; z <= 100; z += 15) {
    group.add(addBox(group, [1.0, 0.04, 6], markMat, [150, 0.12, z], [0, 0, 0], false));
  }

  for (let x = -160; x <= 160; x += 16) {
    group.add(addBox(group, [7, 0.04, 0.9], markMat, [x, 0.13, 115], [0, 0, 0], false));
  }

  scene.add(group);
}

function createMountains() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x58705d, roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const h = rand(35, 85);
    const r = rand(20, 45);
    const mountain = mesh(
      new THREE.ConeGeometry(r, h, 7),
      mat,
      [rand(-280, 280), h / 2 - 1, rand(-320, -190)]
    );
    mountain.scale.x = rand(1.2, 2.0);
    mountain.scale.z = rand(0.7, 1.4);
    mountain.receiveShadow = true;
    scene.add(mountain);
  }
}

// ---------- VEGETATION / ROCKS ----------

function createInstancedVegetation() {
  const treeTrunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.4, 6);
  const treeLeafGeo = new THREE.ConeGeometry(2.4, 6.5, 7);

  const trunks = new THREE.InstancedMesh(treeTrunkGeo, MAT.dirt, CONFIG.treeCount);
  const leaves = new THREE.InstancedMesh(treeLeafGeo, MAT.green, CONFIG.treeCount);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  leaves.castShadow = true;
  leaves.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let placed = 0;
  let tries = 0;

  while (placed < CONFIG.treeCount && tries < CONFIG.treeCount * 30) {
    tries++;
    const x = rand(-245, 245);
    const z = rand(-245, 245);

    // Keep central base/apron and roads open.
    if (Math.abs(x) < 95 && z > -125 && z < 30) continue;
    if (Math.abs(x - 150) < 25) continue;
    if (Math.abs(z - 115) < 15) continue;

    const s = rand(0.65, 1.45);
    const y = 2.1;

    dummy.position.set(x, y, z);
    dummy.scale.set(s, s * rand(0.85, 1.2), s);
    dummy.rotation.y = rand(0, Math.PI);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);

    dummy.position.y = 6.0 * s;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    leaves.setMatrixAt(placed, dummy.matrix);

    placed++;
  }

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  scene.add(trunks, leaves);

  // Bushes.
  const bushGeo = new THREE.IcosahedronGeometry(1.5, 1);
  const bushes = new THREE.InstancedMesh(bushGeo, MAT.grassDark, CONFIG.bushCount);
  bushes.castShadow = true;
  bushes.receiveShadow = true;

  for (let i = 0; i < CONFIG.bushCount; i++) {
    let x = rand(-240, 240);
    let z = rand(-240, 240);
    if (Math.abs(x) < 105 && z > -140 && z < 35) {
      x += x < 0 ? -70 : 70;
    }
    dummy.position.set(x, 1.0, z);
    const s = rand(0.45, 1.25);
    dummy.scale.set(s * 1.4, s, s);
    dummy.rotation.set(rand(-0.15, 0.15), rand(0, Math.PI), rand(-0.15, 0.15));
    dummy.updateMatrix();
    bushes.setMatrixAt(i, dummy.matrix);
  }
  bushes.instanceMatrix.needsUpdate = true;
  scene.add(bushes);

  // Rocks.
  const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, MAT.concreteDark, CONFIG.rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;

  for (let i = 0; i < CONFIG.rockCount; i++) {
    const x = rand(-245, 245);
    const z = rand(-245, 245);
    dummy.position.set(x, 0.7, z);
    const s = rand(0.4, 2.1);
    dummy.scale.set(s * 1.5, s * rand(0.5, 1), s);
    dummy.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);
}

// ---------- BASE BUILDINGS ----------

function createBuilding({
  position,
  size,
  body = MAT.concrete,
  roof = MAT.oliveDark,
  label = "FACILITY",
  windows = true,
}) {
  const g = new THREE.Group();
  g.position.set(...position);

  addBox(g, size, body, [0, size[1] / 2, 0]);
  addBox(g, [size[0] * 1.04, 0.8, size[2] * 1.04], roof, [0, size[1] + 0.4, 0]);

  // Front facade panels.
  const frontZ = size[2] / 2 + 0.06;
  for (let x = -size[0] / 2 + 3; x < size[0] / 2 - 2; x += 5) {
    addBox(g, [2.8, 1.7, 0.1], windows ? MAT.glass : MAT.concreteDark, [x, size[1] * 0.55, frontZ], [0, 0, 0], false);
  }

  // Entrance.
  addBox(g, [4.2, 5.2, 0.2], MAT.darkMetal, [0, 2.6, frontZ + 0.05], [0, 0, 0], false);
  addBox(g, [3.3, 4.3, 0.25], MAT.glass, [0, 2.55, frontZ + 0.2], [0, 0, 0], false);

  // Rooftop equipment.
  addCylinder(g, 0.7, 0.7, 2.5, MAT.darkMetal, [size[0] * 0.28, size[1] + 1.7, 0]);
  addBox(g, [4, 0.4, 2], MAT.darkMetal, [-size[0] * 0.28, size[1] + 1.0, 0]);

  // Sign board.
  addBox(g, [size[0] * 0.42, 1.0, 0.15], MAT.black, [0, size[1] - 1.2, frontZ + 0.12], [0, 0, 0], false);

  scene.add(g);
  return g;
}

function createHangar(position, rotationY = 0) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.rotation.y = rotationY;

  addBox(g, [46, 13, 28], MAT.olive, [0, 6.5, 0]);
  addBox(g, [47, 0.9, 29], MAT.oliveDark, [0, 13.45, 0]);

  // Large front doors.
  for (let i = -2; i <= 2; i++) {
    addBox(g, [8.5, 10.5, 0.45], i % 2 ? MAT.concreteDark : MAT.darkMetal, [i * 8.8, 5.4, 14.25]);
  }

  // Door rails.
  addBox(g, [45, 0.35, 0.45], MAT.metal, [0, 0.9, 14.6]);
  addBox(g, [45, 0.35, 0.45], MAT.metal, [0, 11.1, 14.6]);

  // Side vents.
  for (let z = -9; z <= 9; z += 6) {
    addBox(g, [0.2, 3.2, 3.6], MAT.glass, [-23.2, 7.4, z], [0, 0, 0], false);
    addBox(g, [0.2, 3.2, 3.6], MAT.glass, [23.2, 7.4, z], [0, 0, 0], false);
  }

  scene.add(g);
}

function createCommandCenter() {
  createBuilding({
    position: [-65, 0, -55],
    size: [42, 14, 27],
    body: MAT.concrete,
    roof: MAT.oliveDark,
    label: "COMMAND",
  });

  createBuilding({
    position: [70, 0, -52],
    size: [34, 11, 24],
    body: MAT.olive,
    roof: MAT.oliveDark,
    label: "OPS",
  });

  createHangar([-5, 0, -62], 0);
  createHangar([35, 0, -105], 0.03);

  // Control tower base.
  const g = new THREE.Group();
  g.position.set(100, 0, -80);

  addBox(g, [12, 23, 12], MAT.concreteDark, [0, 11.5, 0]);
  addBox(g, [14, 2.8, 14], MAT.oliveDark, [0, 24, 0]);
  addBox(g, [12, 4.5, 12], MAT.glass, [0, 26.8, 0], [0, 0, 0], false);
  addBox(g, [15, 0.8, 15], MAT.oliveDark, [0, 29.2, 0]);

  scene.add(g);
}

function createWatchTower(position) {
  const g = new THREE.Group();
  g.position.set(...position);

  for (const x of [-3.4, 3.4]) {
    for (const z of [-3.4, 3.4]) {
      addCylinder(g, 0.22, 0.28, 18, MAT.darkMetal, [x, 9, z], 8);
    }
  }

  addBox(g, [8, 0.6, 8], MAT.metal, [0, 5.2, 0]);
  addBox(g, [8, 0.6, 8], MAT.metal, [0, 15.2, 0]);
  addBox(g, [8.5, 0.55, 8.5], MAT.oliveDark, [0, 18.2, 0]);

  // Glass observation room.
  addBox(g, [7.6, 4.2, 0.15], MAT.glass, [0, 16.9, 3.85], [0, 0, 0], false);
  addBox(g, [7.6, 4.2, 0.15], MAT.glass, [0, 16.9, -3.85], [0, 0, 0], false);
  addBox(g, [0.15, 4.2, 7.6], MAT.glass, [3.85, 16.9, 0], [0, 0, 0], false);
  addBox(g, [0.15, 4.2, 7.6], MAT.glass, [-3.85, 16.9, 0], [0, 0, 0], false);

  // Roof beacon.
  addCylinder(g, 0.18, 0.18, 2.2, MAT.darkMetal, [0, 20.3, 0], 8);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), MAT.red);
  beacon.position.set(0, 21.5, 0);
  g.add(beacon);

  // Ladder.
  for (let y = 6; y < 16; y += 1.4) {
    addBox(g, [4.5, 0.18, 0.18], MAT.metal, [0, y, 3.8], [0, 0, 0], false);
  }

  scene.add(g);
}

function createRadarStation(position) {
  const g = new THREE.Group();
  g.position.set(...position);

  addCylinder(g, 2.8, 3.4, 2.2, MAT.concreteDark, [0, 1.1, 0], 16);
  addCylinder(g, 0.65, 0.85, 25, MAT.darkMetal, [0, 13, 0], 12);

  const dish = new THREE.Group();
  dish.position.set(0, 24, 0);
  addCylinder(dish, 4.0, 3.1, 0.5, MAT.metal, [0, 0, 0], 24);
  dish.rotation.x = -0.55;

  const feed = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    MAT.red
  );
  feed.position.set(0, 2.8, 0);
  dish.add(feed);
  g.add(dish);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.16, 8, 32),
    MAT.cyan
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 24.5;
  g.add(ring);

  scene.add(g);
  return { group: g, dish };
}

function createFence() {
  const fenceMat = new THREE.MeshStandardMaterial({
    color: 0x30383a,
    metalness: 0.5,
    roughness: 0.65,
  });

  const posts = [];
  for (let x = -130; x <= 130; x += 10) {
    posts.push([x, 2.2, -15]);
    posts.push([x, 2.2, 30]);
  }
  for (let z = -15; z <= 30; z += 10) {
    posts.push([-130, 2.2, z]);
    posts.push([130, 2.2, z]);
  }

  const geo = new THREE.CylinderGeometry(0.12, 0.15, 4.4, 6);
  const inst = new THREE.InstancedMesh(geo, fenceMat, posts.length);
  const dummy = new THREE.Object3D();

  posts.forEach((p, i) => {
    dummy.position.set(...p);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  scene.add(inst);

  // Horizontal rails.
  addBox(scene, [260, 0.16, 0.16], fenceMat, [0, 2.7, -15], [0, 0, 0], false);
  addBox(scene, [260, 0.16, 0.16], fenceMat, [0, 1.4, -15], [0, 0, 0], false);
  addBox(scene, [260, 0.16, 0.16], fenceMat, [0, 2.7, 30], [0, 0, 0], false);
  addBox(scene, [260, 0.16, 0.16], fenceMat, [0, 1.4, 30], [0, 0, 0], false);
}

// ---------- VEHICLES / HELIPAD ----------

function createVehicle(position, scale = 1) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.scale.setScalar(scale);

  addBox(g, [6.2, 1.5, 3.0], MAT.oliveDark, [0, 1.25, 0]);
  addBox(g, [3.2, 1.6, 2.5], MAT.olive, [0, 2.6, -0.1]);
  addBox(g, [2.5, 1.2, 2.2], MAT.glass, [0, 3.0, 0.0], [0, 0, 0], false);

  for (const x of [-2.1, 2.1]) {
    for (const z of [-1.45, 1.45]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 0.55, 12),
        MAT.black
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.8, z);
      g.add(wheel);
    }
  }

  scene.add(g);
}

function createHelipad() {
  const g = new THREE.Group();
  g.position.set(-55, 0.1, 65);

  addCylinder(g, 29, 29, 0.35, MAT.concreteDark, [0, 0, 0], 48);

  const h = addBox(g, [16, 0.12, 5], MAT.white, [0, 0.25, 0], [0, 0, 0], false);
  h.rotation.z = 0;
  addBox(g, [5, 0.13, 16], MAT.white, [0, 0.26, 0], [0, 0, 0], false);

  scene.add(g);
}

// ---------- TRACKING (Kalman-style) ----------

class TrackState {
  constructor(id, initialPos, initialVel, timestamp) {
    this.id = id;
    this.x = initialPos.x; // position x
    this.y = initialPos.y; // position y
    this.z = initialPos.z; // position z
    this.vx = initialVel.x; // velocity x
    this.vy = initialVel.y; // velocity y
    this.vz = initialVel.z; // velocity z
    this.lastUpdate = timestamp;
    this.age = 0;
    this.measurementCount = 0;
    this.confidence = 0.5;
    this.predictionUncertainty = 1.0;
    this.covariance = {
      px: 10, py: 10, pz: 10,
      pvx: 5, pvy: 5, pvz: 5,
    };
    this.history = []; // track history for display
    this.associatedContact = null;
  }

  // Predict step
  predict(dt) {
    // State transition: x = x + vx*dt, etc.
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    
    this.age += dt;
    
    // Increase covariance (uncertainty grows with prediction)
    const q = CONFIG.tracker.processNoise;
    this.covariance.px += q * dt;
    this.covariance.py += q * dt;
    this.covariance.pz += q * dt;
    this.covariance.pvx += q * dt * 0.1;
    this.covariance.pvy += q * dt * 0.1;
    this.covariance.pvz += q * dt * 0.1;
    
    this.predictionUncertainty = Math.min(
      (this.covariance.px + this.covariance.py + this.covariance.pz) / 30,
      1.0
    );
    
    // Store prediction for history
    this.history.push({ x: this.x, y: this.y, z: this.z, predicted: true, t: state.elapsed });
    if (this.history.length > 60) this.history.shift();
  }

  // Update step with measurement
  update(measurement, measurementConfidence) {
    const r = CONFIG.tracker.measurementNoise / Math.max(0.1, measurementConfidence);
    
    // Kalman gain (simplified scalar for each dimension)
    const kx = this.covariance.px / (this.covariance.px + r);
    const ky = this.covariance.py / (this.covariance.py + r);
    const kz = this.covariance.pz / (this.covariance.pz + r);
    
    // Innovation
    const ix = measurement.x - this.x;
    const iy = measurement.y - this.y;
    const iz = measurement.z - this.z;
    
    // Update state
    this.x += kx * ix;
    this.y += ky * iy;
    this.z += kz * iz;
    
    // Update covariance
    this.covariance.px *= (1 - kx);
    this.covariance.py *= (1 - ky);
    this.covariance.pz *= (1 - kz);
    
    // Estimate velocity from innovation
    const dt = Math.max(0.001, state.elapsed - this.lastUpdate);
    if (dt > 0) {
      this.vx += (kx * ix) / dt * 0.3;
      this.vy += (ky * iy) / dt * 0.3;
      this.vz += (kz * iz) / dt * 0.3;
    }
    
    this.lastUpdate = state.elapsed;
    this.measurementCount++;
    this.confidence = clamp(this.confidence + 0.05, 0, 1);
    this.predictionUncertainty = Math.max(0.1, this.predictionUncertainty - 0.1);
    
    // Store measurement for history
    this.history.push({ x: this.x, y: this.y, z: this.z, predicted: false, t: state.elapsed });
    if (this.history.length > 60) this.history.shift();
  }

  // Get track quality score
  getQuality() {
    const recency = clamp(1 - (state.elapsed - this.lastUpdate) / CONFIG.tracker.maxPredictionAge, 0, 1);
    const measurementFactor = clamp(this.measurementCount / 10, 0, 1);
    const uncertaintyFactor = 1 - this.predictionUncertainty;
    return clamp((recency * 0.4 + measurementFactor * 0.3 + uncertaintyFactor * 0.3), 0, 1);
  }

  getPredictedPosition(dt = 0) {
    return {
      x: this.x + this.vx * dt,
      y: this.y + this.vy * dt,
      z: this.z + this.vz * dt,
    };
  }

  getPosition() {
    return { x: this.x, y: this.y, z: this.z };
  }

  getVelocity() {
    return { x: this.vx, y: this.vy, z: this.vz };
  }
}

// ---------- CONTACT BEHAVIORS ----------

const CONTACT_BEHAVIORS = {
  CRUISE: "cruise",
  LOITER: "loiter",
  APPROACH: "approach",
  DEPART: "depart",
  ERRATIC: "erratic",
  CROSSING: "crossing",
  SLOW: "slow",
  FAST: "fast",
};

function createBehaviorParams(behavior, difficulty) {
  const baseSpeed = 5.5 + difficulty * 0.8;
  const params = {
    speed: baseSpeed,
    altitude: rand(24, 62),
    radius: rand(45, 145),
    angle: rand(0, Math.PI * 2),
    phase: rand(0, Math.PI * 2),
    targetAltitude: rand(24, 62),
    targetPosition: null,
    waypoints: [],
    waypointIndex: 0,
    erraticTimer: 0,
    erraticInterval: rand(1, 3),
    crossingDirection: rand(0, 1) > 0.5 ? 1 : -1,
  };

  switch (behavior) {
    case CONTACT_BEHAVIORS.CRUISE:
      params.speed = baseSpeed * 1.0;
      params.altitude = rand(35, 55);
      params.radius = rand(80, 160);
      break;
    case CONTACT_BEHAVIORS.LOITER:
      params.speed = baseSpeed * 0.4;
      params.altitude = rand(20, 40);
      params.radius = rand(30, 80);
      break;
    case CONTACT_BEHAVIORS.APPROACH:
      params.speed = baseSpeed * 1.3;
      params.targetPosition = new THREE.Vector3(
        rand(-50, 50),
        rand(25, 45),
        rand(-50, 50)
      );
      break;
    case CONTACT_BEHAVIORS.DEPART:
      params.speed = baseSpeed * 1.2;
      params.targetPosition = new THREE.Vector3(
        rand(-200, 200),
        rand(40, 70),
        rand(-200, 200)
      );
      break;
    case CONTACT_BEHAVIORS.ERRATIC:
      params.speed = baseSpeed * rand(0.6, 1.4);
      params.erraticInterval = rand(0.8, 2.5);
      break;
    case CONTACT_BEHAVIORS.CROSSING:
      params.speed = baseSpeed * 1.1;
      params.altitude = rand(30, 50);
      params.targetPosition = new THREE.Vector3(
        params.crossingDirection * 200,
        params.altitude,
        rand(-100, 100)
      );
      break;
    case CONTACT_BEHAVIORS.SLOW:
      params.speed = baseSpeed * 0.35;
      params.altitude = rand(15, 35);
      break;
    case CONTACT_BEHAVIORS.FAST:
      params.speed = baseSpeed * 1.8;
      params.altitude = rand(40, 70);
      break;
  }

  return params;
}

class SyntheticContact {
  constructor(id, behavior = CONTACT_BEHAVIORS.LOITER) {
    this.id = id;
    this.behavior = behavior;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.rotors = [];
    this.rings = [];
    this.velocity = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.active = true;
    this.detected = false;
    this.decisionMade = false;
    this.lastObservation = null;
    this.contactType = rand(0, 1) > 0.7 ? "BENIGN AIR CONTACT" : "SYNTHETIC UAS";
    this.spawnTime = state.elapsed;
    this.actionableTime = null; // When contact first became detectable
    this.firstDetectedTime = null;
    this.classification = null;
    this.traineeConfidence = null;
    
    // Behavior parameters
    this.params = createBehaviorParams(behavior, state.difficulty);
    this.initialPosition = new THREE.Vector3();
    
    this.build();
    this.initializePosition();
    scene.add(this.group);
    
    // Create associated track
    this.trackId = ++state.trackIdCounter;
    const initialPos = this.group.position.clone();
    const initialVel = new THREE.Vector3(0, 0, 0);
    this.track = new TrackState(this.trackId, initialPos, initialVel, state.elapsed);
    this.track.associatedContact = this;
    state.tracks.set(this.trackId, this.track);
  }

  build() {
    const body = addBox(this.body, [3.6, 0.75, 2.4], MAT.darkMetal, [0, 0, 0]);
    body.castShadow = true;

    addBox(this.body, [1.7, 0.5, 1.4], MAT.oliveDark, [0, 0.45, 0]);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 10, 6),
      MAT.black
    );
    nose.scale.set(1.2, 0.55, 1.5);
    nose.position.set(0, -0.1, -1.25);
    this.body.add(nose);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const arm = addBox(
          this.body,
          [0.35, 0.25, 2.2],
          MAT.metal,
          [sx * 1.75, 0.15, sz * 1.15],
          [0, sx * 0.12, 0]
        );

        const rotorGroup = new THREE.Group();
        rotorGroup.position.set(sx * 1.85, 0.45, sz * 1.15);

        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8),
          MAT.darkMetal
        );
        mast.position.y = 0.1;
        rotorGroup.add(mast);

        const rotor = new THREE.Group();
        const bladeA = addBox(rotor, [3.0, 0.08, 0.13], MAT.black, [0, 0, 0], [0, 0, 0], false);
        const bladeB = addBox(rotor, [0.13, 0.08, 3.0], MAT.black, [0, 0, 0], [0, 0, 0], false);
        rotorGroup.add(rotor);
        this.rotors.push(rotor);

        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          sz > 0 ? MAT.red : MAT.blue
        );
        led.position.set(0, -0.22, 0);
        rotorGroup.add(led);

        this.body.add(rotorGroup);
      }
    }

    if (this.contactType === "BENIGN AIR CONTACT") {
      this.body.scale.setScalar(0.58);
      this.group.position.y += 8;
    }

    this.group.add(this.body);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x27dfff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });

    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.4 + i * 1.3, 0.05, 8, 40),
        ringMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.5 - i * 0.2;
      this.group.add(ring);
      this.rings.push(ring);
    }
  }

  initializePosition() {
    const p = this.params;
    switch (this.behavior) {
      case CONTACT_BEHAVIORS.CRUISE:
      case CONTACT_BEHAVIORS.LOITER:
      case CONTACT_BEHAVIORS.SLOW:
      case CONTACT_BEHAVIORS.FAST:
        this.group.position.set(
          Math.cos(p.angle) * p.radius,
          p.altitude,
          Math.sin(p.angle) * p.radius - 30
        );
        this.initialPosition.copy(this.group.position);
        break;
      case CONTACT_BEHAVIORS.APPROACH:
        this.group.position.set(
          rand(-200, 200),
          p.altitude,
          rand(-200, -100)
        );
        this.initialPosition.copy(this.group.position);
        break;
      case CONTACT_BEHAVIORS.DEPART:
        this.group.position.set(
          rand(-50, 50),
          p.altitude,
          rand(-50, 50)
        );
        this.initialPosition.copy(this.group.position);
        break;
      case CONTACT_BEHAVIORS.ERRATIC:
        this.group.position.set(
          Math.cos(p.angle) * p.radius,
          p.altitude,
          Math.sin(p.angle) * p.radius - 30
        );
        this.initialPosition.copy(this.group.position);
        break;
      case CONTACT_BEHAVIORS.CROSSING:
        this.group.position.set(
          -p.crossingDirection * 200,
          p.altitude,
          rand(-100, 100)
        );
        this.initialPosition.copy(this.group.position);
        break;
    }
  }

  updateBehavior(dt) {
    const p = this.params;
    
    switch (this.behavior) {
      case CONTACT_BEHAVIORS.CRUISE:
        p.angle += dt * 0.12;
        this.target.set(
          Math.cos(p.angle + p.phase) * p.radius,
          p.altitude + Math.sin(state.elapsed * 0.7 + p.phase) * 3.0,
          Math.sin(p.angle + p.phase) * p.radius - 30
        );
        break;
        
      case CONTACT_BEHAVIORS.LOITER:
        p.angle += dt * 0.18;
        this.target.set(
          Math.cos(p.angle) * p.radius,
          p.altitude + Math.sin(state.elapsed * 1.2) * 2.0,
          Math.sin(p.angle) * p.radius - 30
        );
        break;
        
      case CONTACT_BEHAVIORS.APPROACH:
        if (p.targetPosition) {
          this.target.copy(p.targetPosition);
          // Slow down as approaching
          const dist = this.group.position.distanceTo(this.target);
          if (dist < 10) {
            p.speed *= 0.98;
          }
        }
        break;
        
      case CONTACT_BEHAVIORS.DEPART:
        if (p.targetPosition) {
          this.target.copy(p.targetPosition);
        }
        break;
        
      case CONTACT_BEHAVIORS.ERRATIC:
        p.erraticTimer += dt;
        if (p.erraticTimer >= p.erraticInterval) {
          p.erraticTimer = 0;
          p.erraticInterval = rand(0.8, 2.5);
          p.targetAltitude = rand(15, 65);
          p.speed = (5.5 + state.difficulty * 0.8) * rand(0.6, 1.4);
          this.target.set(
            this.group.position.x + rand(-30, 30),
            p.targetAltitude,
            this.group.position.z + rand(-30, 30)
          );
        }
        if (!this.target || this.group.position.distanceTo(this.target) < 5) {
          this.target.set(
            this.group.position.x + rand(-40, 40),
            p.targetAltitude,
            this.group.position.z + rand(-40, 40)
          );
        }
        break;
        
      case CONTACT_BEHAVIORS.CROSSING:
        if (p.targetPosition) {
          this.target.copy(p.targetPosition);
        }
        break;
        
      case CONTACT_BEHAVIORS.SLOW:
        p.angle += dt * 0.05;
        this.target.set(
          Math.cos(p.angle) * p.radius,
          p.altitude + Math.sin(state.elapsed * 0.3) * 1.5,
          Math.sin(p.angle) * p.radius - 30
        );
        break;
        
      case CONTACT_BEHAVIORS.FAST:
        p.angle += dt * 0.25;
        this.target.set(
          Math.cos(p.angle + p.phase) * p.radius,
          p.altitude + Math.sin(state.elapsed * 1.5 + p.phase) * 5.0,
          Math.sin(p.angle + p.phase) * p.radius - 30
        );
        break;
    }
  }

  update(dt) {
    if (!this.active) return;

    this.updateBehavior(dt);

    const toTarget = this.target.clone().sub(this.group.position);
    const desired = toTarget.normalize().multiplyScalar(this.params.speed);
    this.velocity.lerp(desired, 1 - Math.pow(0.01, dt));
    this.group.position.addScaledVector(this.velocity, dt);

    const look = this.group.position.clone().add(this.velocity);
    this.group.lookAt(look);
    this.body.rotation.z = clamp(-this.velocity.x * 0.035, -0.35, 0.35);
    this.body.rotation.x = clamp(this.velocity.z * 0.025, -0.3, 0.3);

    for (const rotor of this.rotors) rotor.rotation.y += dt * 32;
    for (const ring of this.rings) ring.rotation.z += dt * 0.8;

    // Update track prediction
    this.track.predict(dt);
  }

  distanceToCamera() {
    return this.group.position.distanceTo(camera.position);
  }

  getTrackQuality() {
    return this.track.getQuality();
  }

  getTrackPrediction(dt = 2.0) {
    return this.track.getPredictedPosition(dt);
  }
}

const contacts = [];

function createContacts() {
  const behaviors = [
    CONTACT_BEHAVIORS.LOITER,
    CONTACT_BEHAVIORS.CRUISE,
    CONTACT_BEHAVIORS.APPROACH,
    CONTACT_BEHAVIORS.DEPART,
    CONTACT_BEHAVIORS.ERRATIC,
    CONTACT_BEHAVIORS.CROSSING,
    CONTACT_BEHAVIORS.SLOW,
    CONTACT_BEHAVIORS.FAST,
  ];
  
  for (let i = 0; i < CONFIG.droneCount; i++) {
    const behavior = behaviors[i % behaviors.length];
    contacts.push(new SyntheticContact(i + 1, behavior));
  }
}

// ---------- RADAR ----------

const radar = {
  group: null,
  sweep: null,
  dish: null,
};

function createRadar() {
  const result = createRadarStation([0, 0, -130]);
  radar.group = result.group;
  radar.dish = result.dish;

  const sweepMat = new THREE.MeshBasicMaterial({
    color: 0x35ffae,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const sweepGeo = new THREE.CircleGeometry(38, 32, 0, Math.PI / 7);
  radar.sweep = new THREE.Mesh(sweepGeo, sweepMat);
  radar.sweep.rotation.x = -Math.PI / 2;
  radar.sweep.position.set(0, 25, -130);
  scene.add(radar.sweep);
  
  // Initialize tactical radar canvas
  initTacticalRadar();
}

// Tactical radar display
let tacticalRadarCtx = null;
const TACTICAL_RADAR_RANGE = 300; // meters

function initTacticalRadar() {
  const canvas = $("tacticalRadar");
  if (canvas) {
    tacticalRadarCtx = canvas.getContext("2d");
    // Initial render
    renderTacticalRadar();
  }
}

function renderTacticalRadar() {
  if (!tacticalRadarCtx) return;
  
  const ctx = tacticalRadarCtx;
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 10;
  
  // Clear
  ctx.clearRect(0, 0, width, height);
  
  // Background
  ctx.fillStyle = "rgba(5, 18, 12, 0.9)";
  ctx.fillRect(0, 0, width, height);
  
  // Range rings
  ctx.strokeStyle = "rgba(52, 255, 146, 0.15)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const r = (radius / 4) * i;
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Crosshairs
  ctx.strokeStyle = "rgba(52, 255, 146, 0.25)";
  ctx.beginPath();
  ctx.moveTo(centerX, 10);
  ctx.lineTo(centerX, height - 10);
  ctx.moveTo(10, centerY);
  ctx.lineTo(width - 10, centerY);
  ctx.stroke();
  
  // Cardinal directions
  ctx.fillStyle = "rgba(52, 255, 146, 0.5)";
  ctx.font = "8px Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillText("N", centerX, 18);
  ctx.fillText("S", centerX, height - 4);
  ctx.textAlign = "left";
  ctx.fillText("E", width - 12, centerY + 3);
  ctx.textAlign = "right";
  ctx.fillText("W", 12, centerY + 3);
  ctx.textAlign = "center";
  
  // Range labels
  ctx.font = "7px Inter, Arial";
  ctx.fillStyle = "rgba(52, 255, 146, 0.4)";
  for (let i = 1; i <= 4; i++) {
    const r = (radius / 4) * i;
    const rangeKm = (TACTICAL_RADAR_RANGE * i / 4 / 1000).toFixed(1);
    ctx.fillText(`${rangeKm}km`, centerX + r + 3, centerY - 2);
  }
  
  // Ownship (center)
  ctx.fillStyle = "#34ff92";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#34ff92";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw contacts
  for (const contact of contacts) {
    if (!contact.active) continue;
    
    // Convert world position to radar coordinates (relative to radar station at 0,0,-130)
    const relX = contact.group.position.x;
    const relZ = contact.group.position.z + 130; // Radar is at z=-130
    const dist = Math.sqrt(relX * relX + relZ * relZ);
    
    if (dist > TACTICAL_RADAR_RANGE) continue;
    
    // Radar coordinates: x = east, y = north (inverted for screen)
    const angle = Math.atan2(relX, relZ); // atan2(x, z) for north-up
    const r = (dist / TACTICAL_RADAR_RANGE) * radius;
    const px = centerX + Math.sin(angle) * r;
    const py = centerY - Math.cos(angle) * r;
    
    // Determine contact color and style
    let color = "#34ff92"; // Default green for contacts
    let isSelected = contact === state.selectedThreat;
    let hasTrack = contact.track && contact.track.measurementCount > 0;
    
    if (contact.contactType === "BENIGN AIR CONTACT") {
      color = "#ffcc00"; // Yellow for benign
    } else if (contact.decisionMade) {
      color = contact.classification === contact.contactType ? "#34ff92" : "#ff4444";
    }
    
    if (isSelected) {
      color = "#ff8800"; // Orange for selected
    }
    
    // Draw contact blip
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, isSelected ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw track history if available
    if (hasTrack && contact.track.history.length > 1) {
      ctx.strokeStyle = color + "80";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      for (const h of contact.track.history) {
        if (h.predicted) continue;
        const hRelX = h.x;
        const hRelZ = h.z + 130;
        const hDist = Math.sqrt(hRelX * hRelX + hRelZ * hRelZ);
        if (hDist > TACTICAL_RADAR_RANGE) continue;
        const hAngle = Math.atan2(hRelX, hRelZ);
        const hr = (hDist / TACTICAL_RADAR_RANGE) * radius;
        const hpx = centerX + Math.sin(hAngle) * hr;
        const hpy = centerY - Math.cos(hAngle) * hr;
        if (first) {
          ctx.moveTo(hpx, hpy);
          first = false;
        } else {
          ctx.lineTo(hpx, hpy);
        }
      }
      ctx.stroke();
    }
    
    // Draw velocity vector
    if (contact.track && (contact.track.vx !== 0 || contact.track.vz !== 0)) {
      const velLen = Math.sqrt(contact.track.vx * contact.track.vx + contact.track.vz * contact.track.vz);
      if (velLen > 0.5) {
        const velAngle = Math.atan2(contact.track.vx, contact.track.vz);
        const velR = Math.min(velLen * 2, 20);
        const vpx = px + Math.sin(velAngle) * velR;
        const vpy = py - Math.cos(velAngle) * velR;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(vpx, vpy);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(vpx, vpy);
        ctx.lineTo(vpx - Math.sin(velAngle - 0.5) * 5, vpy + Math.cos(velAngle - 0.5) * 5);
        ctx.lineTo(vpx - Math.sin(velAngle + 0.5) * 5, vpy + Math.cos(velAngle + 0.5) * 5);
        ctx.fill();
      }
    }
    
    // Contact ID label
    if (isSelected || hasTrack) {
      ctx.fillStyle = color;
      ctx.font = "7px Inter, Arial";
      ctx.textAlign = "left";
      ctx.fillText(`${contact.id}`, px + 8, py + 3);
    }
  }
  
  // Draw radar sweep
  if (radar.sweep && radar.sweep.rotation) {
    const sweepAngle = radar.sweep.rotation.z || 0;
    ctx.strokeStyle = "rgba(52, 255, 146, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.sin(sweepAngle) * radius,
      centerY - Math.cos(sweepAngle) * radius
    );
    ctx.stroke();
    
    // Sweep glow
    ctx.fillStyle = "rgba(52, 255, 146, 0.1)";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, sweepAngle - 0.3, sweepAngle + 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- HUD ----------

const hud = document.createElement("div");
hud.id = "hud";
hud.innerHTML = `
  <div class="topbar">
    <div class="brand">
      <div class="brand-title">SIH 26247</div>
      <div class="brand-sub">SYNTHETIC THREAT SIMULATION TRAINER</div>
    </div>
    <div class="status">
      <span class="dot"></span>
      SYSTEM ONLINE
    </div>
  </div>

  <div class="left-panel panel">
    <div class="panel-title">TRAINING TELEMETRY</div>
    <div class="row"><span>MODE</span><b id="mode">OBSERVER</b></div>
    <div class="row"><span>SCENARIO</span><b id="scenario">AIRSPACE-01</b></div>
    <div class="row"><span>DIFFICULTY</span><b id="difficulty">1</b></div>
    <div class="row"><span>THREATS</span><b id="threats">0</b></div>
    <div class="row"><span>DECISIONS</span><b id="detected">0</b></div>
    <div class="row"><span>SCORE</span><b id="score">0000</b></div>
  </div>

  <div class="right-panel panel">
    <div class="panel-title">SENSOR FUSION</div>
    <div class="sensor"><span>RADAR</span><i><em id="radarBar"></em></i></div>
    <div class="sensor"><span>EO/IR</span><i><em id="eoBar"></em></i></div>
    <div class="sensor"><span>TRACKING</span><i><em id="trackBar"></em></i></div>
    <div class="classification" id="classification">NO ACTIVE TRACK</div>
    <div class="selected-contact" id="selectedContact">NO ACTIVE CONTACT</div>
    <div class="decision-hint" id="decisionHint">Q / E to inspect contacts • 1 / 2 / 3 to classify</div>
    <div class="decision-buttons">
      <span><kbd>1</kbd> UNKNOWN</span>
      <span><kbd>2</kbd> BENIGN AIR CONTACT</span>
      <span><kbd>3</kbd> SYNTHETIC UAS</span>
    </div>
  </div>

  <div class="tactical-radar-panel panel" id="tacticalRadarPanel">
    <div class="panel-title">TACTICAL RADAR</div>
    <canvas id="tacticalRadar" width="200" height="200"></canvas>
    <div class="radar-legend">
      <span class="radar-legend-item"><em class="radar-dot ownship"></em>OWNSHIP</span>
      <span class="radar-legend-item"><em class="radar-dot contact"></em>CONTACT</span>
      <span class="radar-legend-item"><em class="radar-dot selected"></em>SELECTED</span>
      <span class="radar-legend-item"><em class="radar-dot track"></em>TRACK</span>
    </div>
  </div>

  <div class="bottom-left panel controls">
    <b>CONTROLS</b>
    <span>W / S — FORWARD / BACKWARD</span>
    <span>A / D — STRAFE LEFT / RIGHT</span>
    <span>SPACE — ASCEND</span>
    <span>SHIFT — DESCEND</span>
    <span>MOUSE — LOOK</span>
    <span>ESC — RELEASE MOUSE</span>
    <span>TAB — CYCLE CAMERA MODE</span>
    <span>Q / E — SELECT CONTACT / DRONE</span>
    <span>1 / 2 / 3 — CLASSIFY</span>
    <span>F2 — AFTER-ACTION REVIEW</span>
    <span>R — RESET SCENARIO</span>
    <span>CLICK — LOCK CURSOR</span>
  </div>

  <!-- Mobile Joystick Controls (hidden on desktop) -->
  <div class="mobile-controls" id="mobileControls">
    <!-- Left Joystick - Movement -->
    <div class="mobile-joystick left-joystick" id="leftJoystick" role="button" aria-label="Movement control">
      <div class="joystick-base">
        <div class="joystick-stick" id="leftStick"></div>
        <div class="joystick-center"></div>
      </div>
      <div class="joystick-label">FLIGHT</div>
    </div>

    <!-- Right Joystick - Camera Look -->
    <div class="mobile-joystick right-joystick" id="rightJoystick" role="button" aria-label="Camera control">
      <div class="joystick-base">
        <div class="joystick-stick" id="rightStick"></div>
        <div class="joystick-center"></div>
      </div>
      <div class="joystick-label">CAMERA</div>
    </div>

    <!-- Mobile action buttons -->
    <div class="mobile-actions">
      <button class="mobile-btn" id="mobileBtnAscend" aria-label="Ascend">⬆</button>
      <button class="mobile-btn" id="mobileBtnDescend" aria-label="Descend">⬇</button>
      <button class="mobile-btn" id="mobileBtnCycleMode" aria-label="Cycle camera mode">⟳</button>
      <button class="mobile-btn" id="mobileBtnCycleContact" aria-label="Cycle contact/drone">⇄</button>
      <button class="mobile-btn primary" id="mobileBtnClassify1" aria-label="Classify UNKNOWN">1</button>
      <button class="mobile-btn primary" id="mobileBtnClassify2" aria-label="Classify BENIGN">2</button>
      <button class="mobile-btn primary" id="mobileBtnClassify3" aria-label="Classify UAS">3</button>
      <button class="mobile-btn danger" id="mobileBtnAAR" aria-label="After-Action Review">AAR</button>
    </div>
  </div>

  <div class="crosshair">
    <span></span><span></span><span></span><span></span>
  </div>

  <div class="after-action panel">
    <div class="panel-title">TRAINING INSIGHT</div>
    <div class="insight-row"><span>ATTENTION</span><b id="attention">100%</b></div>
    <div class="insight-row"><span>CONFIDENCE</span><b id="confidence">0%</b></div>
    <div class="insight-row"><span>PRECISION</span><b id="precision">100%</b></div>
    <div class="insight-row"><span>AVG REACTION</span><b id="avgReaction">—</b></div>
    <div class="insight-row"><span>SCENARIO PHASE</span><b id="phase">MONITOR</b></div>
    <div class="insight-note" id="objective">Detect and classify all synthetic aerial contacts.</div>
  </div>

  <div id="aarModal" class="aar-modal">
    <div class="aar-card">
      <div class="aar-head">
        <div>
          <div class="aar-kicker">AFTER-ACTION REVIEW</div>
          <div class="aar-title">AIRSPACE-01 / TRAINING PERFORMANCE</div>
        </div>
        <button id="aarClose">CLOSE</button>
      </div>
      <div class="aar-grid">
        <div><span>SCORE</span><b id="aarScore">0</b></div>
        <div><span>CORRECT</span><b id="aarCorrect">0/0</b></div>
        <div><span>PRECISION</span><b id="aarPrecision">100%</b></div>
        <div><span>AVG REACTION</span><b id="aarReaction">—</b></div>
        <div><span>DIFFICULTY</span><b id="aarDifficulty">1.0</b></div>
      </div>
      <div class="aar-section">
        <div class="aar-kicker">TRAINING RECOMMENDATION</div>
        <p id="aarRecommendation">Complete a scenario cycle to receive an adaptive recommendation.</p>
      </div>
      <div class="aar-section">
        <div class="aar-kicker">RECENT EVENT TIMELINE</div>
        <div id="aarTimeline" class="aar-timeline"></div>
      </div>
      <div class="aar-footer">Synthetic training only • decision quality is evaluated from simulated evidence.</div>
    </div>
  </div>
  <div id="eventLog" class="event-log"></div>
  <div id="toast" class="toast"></div>
`;
document.body.appendChild(hud);

const $ = (id) => document.getElementById(id);
$("aarClose")?.addEventListener("click", closeAAR);

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  state.messageTimer = 2.2;
}

function logEvent(message, type = "") {
  const log = $("eventLog");
  const row = document.createElement("div");
  row.className = `event ${type}`;
  row.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  log.prepend(row);
  while (log.children.length > 5) log.removeChild(log.lastChild);
}

// ---------- INPUT ----------

function cycleContact(direction) {
  const active = contacts.filter(c => c.active);
  if (!active.length) return;
  let index = active.indexOf(state.selectedThreat);
  if (index < 0) index = 0;
  index = (index + direction + active.length) % active.length;
  state.selectedThreat = active[index];
  toast(`CONTACT ${String(state.selectedThreat.id).padStart(2, "0")} SELECTED`);
}

function resetScenario() {
  state.score = 0;
  state.detections = 0;
  state.correctClassifications = 0;
  state.falseAlarms = 0;
  state.reactionSum = 0;
  state.decisionCount = 0;
  state.lastDecision = null;
  state.metrics.contactsSeen = 0;
  state.metrics.contactsDetected = 0;
  state.metrics.contactsCorrect = 0;
  state.metrics.falseAlarms = 0;
  state.metrics.missedContacts = 0;
  state.metrics.decisions = 0;
  state.metrics.correctDecisions = 0;
  state.metrics.wrongDecisions = 0;
  state.metrics.averageDecisionTime = 0;
  state.metrics.recall = 0;
  state.metrics.f1Score = 0;
  state.difficulty = 1;
  state.reactionTimes = [];
  state.confidenceHistory = [];
  state.tracks.clear();
  state.trackIdCounter = 0;
  state.skillVector = {
    detectionSkill: 0.5,
    classificationSkill: 0.5,
    reactionSkill: 0.5,
    sensorInterpretationSkill: 0.5,
    consistencySkill: 0.5,
    confidenceCalibration: 0.5,
  };
  state.detectedWeakness = null;
  state.nextScenarioRecommendation = null;
  
  // Reset camera state
  state.camera.mode = "observer";
  state.camera.yaw = 0;
  state.camera.pitch = -0.05;
  state.camera.targetYaw = 0;
  state.camera.targetPitch = -0.05;
  state.camera.velocity.set(0, 0, 0);
  state.camera.bankAngle = 0;
  state.camera.targetBankAngle = 0;
  state.camera.currentFov = CONFIG.camera.fovBase;
  state.camera.targetFov = CONFIG.camera.fovBase;
  state.camera.fpvDroneId = 1;
  camera.fov = CONFIG.camera.fovBase;
  camera.updateProjectionMatrix();
  
  for (const c of contacts) {
    c.detected = false;
    c.decisionMade = false;
    c.spawnTime = state.elapsed;
    c.actionableTime = null;
    c.firstDetectedTime = null;
    c.classification = null;
    c.traineeConfidence = null;
    // Reset track
    if (c.track) {
      c.track.x = c.group.position.x;
      c.track.y = c.group.position.y;
      c.track.z = c.group.position.z;
      c.track.vx = 0;
      c.track.vy = 0;
      c.track.vz = 0;
      c.track.lastUpdate = state.elapsed;
      c.track.age = 0;
      c.track.measurementCount = 0;
      c.track.confidence = 0.5;
      c.track.predictionUncertainty = 1.0;
      c.track.covariance = { px: 10, py: 10, pz: 10, pvx: 5, pvy: 5, pvz: 5 };
      c.track.history = [];
    }
  }
  scenarioPhaseIndex = 0;
  enterScenarioPhase(0);
  logEvent("Training session reset — baseline difficulty restored.", "phase");
  toast("SCENARIO RESET");
}

function openAAR() {
  const modal = $("aarModal");
  if (!modal) return;
  
  const avgReaction = state.reactionTimes.length > 0
    ? state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length
    : 0;
  const bestReaction = state.reactionTimes.length > 0
    ? Math.min(...state.reactionTimes)
    : 0;
  
  // Sensor analysis
  const radarDecisions = state.confidenceHistory.filter(h => h.confidence > 0.5).length;
  const visualDecisions = state.confidenceHistory.filter(h => h.confidence > 0.3).length;
  const avgFusion = state.confidenceHistory.length > 0
    ? state.confidenceHistory.reduce((a, b) => a + b.confidence, 0) / state.confidenceHistory.length
    : 0;
  
  $("aarScore").textContent = String(Math.floor(state.score));
  $("aarCorrect").textContent =
    `${state.metrics.correctDecisions}/${state.metrics.decisions}`;
  $("aarPrecision").textContent =
    `${Math.round(state.metrics.precision)}%`;
  $("aarReaction").textContent =
    state.metrics.decisions ? `${avgReaction.toFixed(1)}s (best: ${bestReaction.toFixed(1)}s)` : "—";
  $("aarDifficulty").textContent = state.difficulty.toFixed(1);
  
  // Enhanced recommendation with weakness details
  const rec = state.nextScenarioRecommendation || { focus: "General Proficiency", exercise: "Balanced scenario", reason: "Continue training." };
  const weakness = state.detectedWeakness ? `Primary weakness: ${state.detectedWeakness.replace(/([A-Z])/g, ' $1').trim()}.` : "";
  $("aarRecommendation").textContent =
    `${rec.focus}: ${rec.exercise}. ${rec.reason} ${weakness}`;
  
  // Build detailed timeline
  const timelineEntries = state.afterAction.slice(-12).map(item => {
    const icon = item.severity === "good" ? "✓" : item.severity === "warn" ? "⚠" : item.severity === "phase" ? "◆" : "•";
    const timeStr = item.t ? `${(item.t / 60).toFixed(0)}:${(item.t % 60).toFixed(0).padStart(2, "0")}` : "";
    return `<div class="aar-event"><span>${icon}</span>[${timeStr}] ${item.message}</div>`;
  }).join("");
  
  // Add sensor analysis section
  const sensorAnalysis = `
    <div class="aar-section">
      <div class="aar-kicker">SENSOR ANALYSIS</div>
      <div class="aar-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div><span>AVG FUSION</span><b>${(avgFusion * 100).toFixed(0)}%</b></div>
        <div><span>RADAR RELIABILITY</span><b>${radarDecisions > 0 ? ((state.confidenceHistory.filter(h => h.confidence > 0.5 && h.correct).length / radarDecisions) * 100).toFixed(0) : 0}%</b></div>
        <div><span>VISUAL RELIABILITY</span><b>${visualDecisions > 0 ? ((state.confidenceHistory.filter(h => h.confidence > 0.3 && h.correct).length / visualDecisions) * 100).toFixed(0) : 0}%</b></div>
      </div>
      <div style="margin-top: 10px; font-size: 10px; color: rgba(226,255,236,0.78);">
        Sensor fusion weights: Radar ${(state.fusionConfig.weights.radar*100).toFixed(0)}% • Visual ${(state.fusionConfig.weights.visual*100).toFixed(0)}% • Motion ${(state.fusionConfig.weights.motion*100).toFixed(0)}% • RF ${(state.fusionConfig.weights.rf*100).toFixed(0)}%
      </div>
    </div>
  `;
  
  // Add decision history
  const decisionHistory = state.confidenceHistory.map((h, i) => {
    const result = h.correct ? "✓" : "✗";
    return `<div class="aar-event" style="font-size: 8px;"><span>${result}</span>Decision ${i+1}: Conf ${(h.confidence*100).toFixed(0)}% • ${h.correct ? "Correct" : "Wrong"}</div>`;
  }).slice(-8).join("");
  
  const decisionHistorySection = state.confidenceHistory.length > 0 ? `
    <div class="aar-section">
      <div class="aar-kicker">DECISION HISTORY</div>
      <div class="aar-timeline">${decisionHistory}</div>
    </div>
  ` : "";
  
  // Add skill vector
  const sv = state.skillVector;
  const skillSection = `
    <div class="aar-section">
      <div class="aar-kicker">SKILL PROFILE</div>
      <div class="aar-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div><span>DETECTION</span><b>${(sv.detectionSkill*100).toFixed(0)}%</b></div>
        <div><span>CLASSIFICATION</span><b>${(sv.classificationSkill*100).toFixed(0)}%</b></div>
        <div><span>REACTION</span><b>${(sv.reactionSkill*100).toFixed(0)}%</b></div>
        <div><span>SENSOR INTERP.</span><b>${(sv.sensorInterpretationSkill*100).toFixed(0)}%</b></div>
        <div><span>CONSISTENCY</span><b>${(sv.consistencySkill*100).toFixed(0)}%</b></div>
        <div><span>CONF CALIBRATION</span><b>${(sv.confidenceCalibration*100).toFixed(0)}%</b></div>
      </div>
    </div>
  `;
  
  // Add adaptation explanation
  const adaptationSection = `
    <div class="aar-section">
      <div class="aar-kicker">ADAPTIVE EXPLANATION</div>
      <p style="font-size: 11px; line-height: 1.6; color: rgba(226,255,236,0.78);">
        Next difficulty: ${state.difficulty.toFixed(1)} (${state.difficulty > 2 ? "INCREASED" : state.difficulty < 1.5 ? "DECREASED" : "MAINTAINED"})<br>
        Scenario seed: ${state.scenario.seed}<br>
        Contacts for next cycle: ${contacts.filter(c => c.active).length}<br>
        Sensor noise: Radar ${(state.sensorModel.radarNoise*100).toFixed(0)}% • Visual ${(state.sensorModel.visualNoise*100).toFixed(0)}% • Dropout ${(state.sensorModel.dropoutChance*100).toFixed(1)}%
      </p>
    </div>
  `;
  
  // Build timeline with all sections
  $("aarTimeline").innerHTML = timelineEntries + sensorAnalysis + decisionHistorySection + skillSection + adaptationSection;
  
  modal.classList.add("show");
  
  // Disable camera controls when AAR is open
  if (state.mouseLocked) {
    document.exitPointerLock();
  }
}

function closeAAR() {
  $("aarModal")?.classList.remove("show");
  // Re-enable pointer lock hint
  state.camera.pointerLockHintShown = false;
}

function onKeyDown(e) {
  // Don't capture gameplay keys when typing in inputs or when AAR is open
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || $("aarModal")?.classList.contains("show")) {
    return;
  }
  
  state.keys.add(e.code);

  // Camera mode switching
  if (e.code === "Tab") {
    e.preventDefault();
    cycleCameraMode();
  }
  
  // Cycle FPV drone when in FPV/Chase mode
  if (state.camera.mode === "fpv" || state.camera.mode === "chase") {
    if (e.code === "KeyQ") cycleFpvDrone(-1);
    if (e.code === "KeyE") cycleFpvDrone(1);
  } else {
    // Observer/Pilot mode: Q/E still cycle contacts for selection
    if (e.code === "KeyQ") cycleContact(-1);
    if (e.code === "KeyE") cycleContact(1);
  }

  // Classification keys (1/2/3) - work in all modes
  if (["Digit1", "Digit2", "Digit3"].includes(e.code)) {
    state.lastDecisionKey = e.code;
    evaluateSelectedContact();
  }

  if (e.code === "F2") {
    e.preventDefault();
    openAAR();
  }

  if (e.code === "Escape") {
    closeAAR();
    if (state.mouseLocked) {
      document.exitPointerLock();
    }
  }
  
  if (e.code === "KeyR" && !state.mouseLocked) resetScenario();
}

function onKeyUp(e) {
  state.keys.delete(e.code);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// Pointer Lock handling
renderer.domElement.addEventListener("click", () => {
  if (!$("aarModal")?.classList.contains("show")) {
    renderer.domElement.requestPointerLock?.();
  }
});

document.addEventListener("pointerlockchange", () => {
  state.mouseLocked = document.pointerLockElement === renderer.domElement;
  // Reset pitch/yaw targets when unlocking to prevent jump
  if (!state.mouseLocked) {
    state.camera.targetYaw = state.camera.yaw;
    state.camera.targetPitch = state.camera.pitch;
  }
});

document.addEventListener("mousemove", (e) => {
  if (!state.mouseLocked) return;
  if ($("aarModal")?.classList.contains("show")) return;
  
  const sensitivity = CONFIG.camera.mouseSensitivity;
  state.camera.targetYaw -= e.movementX * sensitivity;
  state.camera.targetPitch -= e.movementY * sensitivity;
  state.camera.targetPitch = clamp(state.camera.targetPitch, CONFIG.camera.pitchMin, CONFIG.camera.pitchMax);
});

// ===== MOBILE JOYSTICK HANDLING =====

// Device detection
function detectMobileControls() {
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isMobileViewport = window.innerWidth <= 1024 && window.innerHeight <= 1024;
  const isPhone = hasTouch && (window.innerWidth < 900 || window.innerHeight < 900);
  
  // Enable mobile controls on touch devices with phone-like viewports
  state.mobile.enabled = isPhone;
  
  const mobileControlsEl = $("mobileControls");
  if (mobileControlsEl) {
    if (state.mobile.enabled) {
      mobileControlsEl.classList.add("active");
      // Hide desktop controls hint on mobile
      const controlsEl = document.querySelector(".controls");
      if (controlsEl) controlsEl.style.display = "none";
    } else {
      mobileControlsEl.classList.remove("active");
      const controlsEl = document.querySelector(".controls");
      if (controlsEl) controlsEl.style.display = "";
    }
  }
  
  logEvent(`Mobile controls: ${state.mobile.enabled ? "ENABLED" : "DISABLED"}`);
}

// Call on init and resize
detectMobileControls();
window.addEventListener("resize", () => {
  detectMobileControls();
});

// Joystick geometry helpers
function getJoystickCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function clampJoystick(x, y, radius) {
  const dist = Math.sqrt(x * x + y * y);
  if (dist > radius) {
    const factor = radius / dist;
    return { x: x * factor, y: y * factor };
  }
  return { x, y };
}

function applyDeadzone(value, deadzone) {
  if (Math.abs(value) < deadzone) return 0;
  // Apply response curve for better precision at low inputs
  const sign = value > 0 ? 1 : -1;
  const absVal = Math.abs(value);
  const curved = Math.pow(absVal, CONFIG.mobile.responseCurve);
  return sign * curved;
}

// Left Joystick - Movement
const leftJoystickEl = $("leftJoystick");
const leftStickEl = $("leftStick");

if (leftJoystickEl && leftStickEl) {
  leftJoystickEl.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    if (state.mobile.leftJoystick.active) return;
    
    e.preventDefault();
    leftJoystickEl.setPointerCapture(e.pointerId);
    
    const center = getJoystickCenter(leftJoystickEl);
    state.mobile.leftJoystick.pointerId = e.pointerId;
    state.mobile.leftJoystick.startX = center.x;
    state.mobile.leftJoystick.startY = center.y;
    state.mobile.leftJoystick.currentX = 0;
    state.mobile.leftJoystick.currentY = 0;
    state.mobile.leftJoystick.active = true;
    
    leftJoystickEl.querySelector(".joystick-base").classList.add("active");
  });
  
  leftJoystickEl.addEventListener("pointermove", (e) => {
    if (!state.mobile.enabled) return;
    if (state.mobile.leftJoystick.pointerId !== e.pointerId) return;
    if (!state.mobile.leftJoystick.active) return;
    
    e.preventDefault();
    const center = getJoystickCenter(leftJoystickEl);
    const rect = leftJoystickEl.getBoundingClientRect();
    const radius = rect.width / 2;
    
    let dx = e.clientX - center.x;
    let dy = e.clientY - center.y;
    
    // Clamp to joystick radius
    const clamped = clampJoystick(dx, dy, radius);
    dx = clamped.x;
    dy = clamped.y;
    
    // Normalize to -1..1
    const normX = dx / radius;
    const normY = -dy / radius; // Invert Y: up = forward
    
    // Apply deadzone and response curve
    state.mobile.moveX = applyDeadzone(normX, CONFIG.mobile.deadzone);
    state.mobile.moveY = applyDeadzone(normY, CONFIG.mobile.deadzone);
    
    // Update visual stick position
    state.mobile.leftJoystick.currentX = dx;
    state.mobile.leftJoystick.currentY = dy;
    leftStickEl.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  
  function releaseLeftJoystick(e) {
    if (state.mobile.leftJoystick.pointerId !== e.pointerId) return;
    if (!state.mobile.leftJoystick.active) return;
    
    leftJoystickEl.releasePointerCapture(e.pointerId);
    state.mobile.leftJoystick.active = false;
    state.mobile.leftJoystick.pointerId = null;
    state.mobile.moveX = 0;
    state.mobile.moveY = 0;
    state.mobile.leftJoystick.currentX = 0;
    state.mobile.leftJoystick.currentY = 0;
    leftStickEl.style.transform = "translate(0, 0)";
    leftJoystickEl.querySelector(".joystick-base").classList.remove("active");
  }
  
  leftJoystickEl.addEventListener("pointerup", releaseLeftJoystick);
  leftJoystickEl.addEventListener("pointercancel", releaseLeftJoystick);
  leftJoystickEl.addEventListener("pointerleave", releaseLeftJoystick);
}

// Right Joystick - Camera Look
const rightJoystickEl = $("rightJoystick");
const rightStickEl = $("rightStick");

if (rightJoystickEl && rightStickEl) {
  rightJoystickEl.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    if (state.mobile.rightJoystick.active) return;
    
    e.preventDefault();
    rightJoystickEl.setPointerCapture(e.pointerId);
    
    const center = getJoystickCenter(rightJoystickEl);
    state.mobile.rightJoystick.pointerId = e.pointerId;
    state.mobile.rightJoystick.startX = center.x;
    state.mobile.rightJoystick.startY = center.y;
    state.mobile.rightJoystick.currentX = 0;
    state.mobile.rightJoystick.currentY = 0;
    state.mobile.rightJoystick.active = true;
    
    rightJoystickEl.querySelector(".joystick-base").classList.add("active");
  });
  
  rightJoystickEl.addEventListener("pointermove", (e) => {
    if (!state.mobile.enabled) return;
    if (state.mobile.rightJoystick.pointerId !== e.pointerId) return;
    if (!state.mobile.rightJoystick.active) return;
    
    e.preventDefault();
    const center = getJoystickCenter(rightJoystickEl);
    const rect = rightJoystickEl.getBoundingClientRect();
    const radius = rect.width / 2;
    
    let dx = e.clientX - center.x;
    let dy = e.clientY - center.y;
    
    // Clamp to joystick radius
    const clamped = clampJoystick(dx, dy, radius);
    dx = clamped.x;
    dy = clamped.y;
    
    // Normalize to -1..1
    const normX = dx / radius;
    const normY = -dy / radius; // Invert Y: up = look up
    
    // Apply deadzone and response curve
    state.mobile.lookX = applyDeadzone(normX, CONFIG.mobile.deadzone);
    state.mobile.lookY = applyDeadzone(normY, CONFIG.mobile.deadzone);
    
    // Update visual stick position
    state.mobile.rightJoystick.currentX = dx;
    state.mobile.rightJoystick.currentY = dy;
    rightStickEl.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  
  function releaseRightJoystick(e) {
    if (state.mobile.rightJoystick.pointerId !== e.pointerId) return;
    if (!state.mobile.rightJoystick.active) return;
    
    rightJoystickEl.releasePointerCapture(e.pointerId);
    state.mobile.rightJoystick.active = false;
    state.mobile.rightJoystick.pointerId = null;
    state.mobile.lookX = 0;
    state.mobile.lookY = 0;
    state.mobile.rightJoystick.currentX = 0;
    state.mobile.rightJoystick.currentY = 0;
    rightStickEl.style.transform = "translate(0, 0)";
    rightJoystickEl.querySelector(".joystick-base").classList.remove("active");
  }
  
  rightJoystickEl.addEventListener("pointerup", releaseRightJoystick);
  rightJoystickEl.addEventListener("pointercancel", releaseRightJoystick);
  rightJoystickEl.addEventListener("pointerleave", releaseRightJoystick);
}

// Mobile Action Buttons
const mobileBtnAscend = $("mobileBtnAscend");
const mobileBtnDescend = $("mobileBtnDescend");
const mobileBtnCycleMode = $("mobileBtnCycleMode");
const mobileBtnCycleContact = $("mobileBtnCycleContact");
const mobileBtnClassify1 = $("mobileBtnClassify1");
const mobileBtnClassify2 = $("mobileBtnClassify2");
const mobileBtnClassify3 = $("mobileBtnClassify3");
const mobileBtnAAR = $("mobileBtnAAR");

// Prevent default touch behavior on buttons
[mobileBtnAscend, mobileBtnDescend, mobileBtnCycleMode, mobileBtnCycleContact, 
 mobileBtnClassify1, mobileBtnClassify2, mobileBtnClassify3, mobileBtnAAR].forEach(btn => {
  if (btn) {
    btn.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    btn.addEventListener("touchend", (e) => e.preventDefault(), { passive: false });
  }
});

if (mobileBtnAscend) {
  mobileBtnAscend.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    state.mobile.vertInput = 1;
  });
  mobileBtnAscend.addEventListener("pointerup", () => { state.mobile.vertInput = 0; });
  mobileBtnAscend.addEventListener("pointercancel", () => { state.mobile.vertInput = 0; });
  mobileBtnAscend.addEventListener("pointerleave", () => { state.mobile.vertInput = 0; });
}

if (mobileBtnDescend) {
  mobileBtnDescend.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    state.mobile.vertInput = -1;
  });
  mobileBtnDescend.addEventListener("pointerup", () => { state.mobile.vertInput = 0; });
  mobileBtnDescend.addEventListener("pointercancel", () => { state.mobile.vertInput = 0; });
  mobileBtnDescend.addEventListener("pointerleave", () => { state.mobile.vertInput = 0; });
}

if (mobileBtnCycleMode) {
  mobileBtnCycleMode.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    cycleCameraMode();
  });
}

if (mobileBtnCycleContact) {
  mobileBtnCycleContact.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    if (state.camera.mode === "fpv" || state.camera.mode === "chase") {
      cycleFpvDrone(1);
    } else {
      cycleContact(1);
    }
  });
}

if (mobileBtnClassify1) {
  mobileBtnClassify1.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    state.lastDecisionKey = "Digit1";
    evaluateSelectedContact();
  });
}

if (mobileBtnClassify2) {
  mobileBtnClassify2.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    state.lastDecisionKey = "Digit2";
    evaluateSelectedContact();
  });
}

if (mobileBtnClassify3) {
  mobileBtnClassify3.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    state.lastDecisionKey = "Digit3";
    evaluateSelectedContact();
  });
}

if (mobileBtnAAR) {
  mobileBtnAAR.addEventListener("pointerdown", (e) => {
    if (!state.mobile.enabled) return;
    e.preventDefault();
    openAAR();
  });
}

// Prevent scrolling on joystick areas
document.addEventListener("touchmove", (e) => {
  if (!state.mobile.enabled) return;
  // Allow scrolling on non-control areas
  const target = e.target;
  if (target.closest(".mobile-controls")) {
    e.preventDefault();
  }
}, { passive: false });

// Camera mode cycling
function cycleCameraMode() {
  const modes = ["observer", "pilot", "fpv", "chase"];
  const currentIndex = modes.indexOf(state.camera.mode);
  const nextIndex = (currentIndex + 1) % modes.length;
  state.camera.mode = modes[nextIndex];
  
  // Update HUD
  const modeLabels = {
    observer: "OBSERVER",
    pilot: "PILOT",
    fpv: "FPV",
    chase: "CHASE"
  };
  $("mode").textContent = modeLabels[state.camera.mode] || state.camera.mode.toUpperCase();
  
  // When entering FPV/Chase, select first active drone
  if (state.camera.mode === "fpv" || state.camera.mode === "chase") {
    const activeContacts = contacts.filter(c => c.active);
    if (activeContacts.length > 0) {
      state.camera.fpvDroneId = activeContacts[0].id;
      // Sync camera yaw/pitch to drone orientation for smooth transition
      const drone = activeContacts[0];
      state.camera.yaw = drone.group.rotation.y;
      state.camera.pitch = clamp(drone.group.rotation.x, CONFIG.camera.pitchMin, CONFIG.camera.pitchMax);
      state.camera.targetYaw = state.camera.yaw;
      state.camera.targetPitch = state.camera.pitch;
    }
    toast(`${modeLabels[state.camera.mode]} MODE — DRONE ${String(state.camera.fpvDroneId).padStart(2, "0")}`);
  } else {
    toast(`${modeLabels[state.camera.mode]} MODE ENABLED`);
  }
  logEvent(`Camera mode: ${state.camera.mode.toUpperCase()}`);
}

// Cycle FPV drone
function cycleFpvDrone(direction) {
  const activeContacts = contacts.filter(c => c.active);
  if (!activeContacts.length) return;
  
  const currentIndex = activeContacts.findIndex(c => c.id === state.camera.fpvDroneId);
  let nextIndex = (currentIndex + direction + activeContacts.length) % activeContacts.length;
  state.camera.fpvDroneId = activeContacts[nextIndex].id;
  
  // Smooth transition: keep current camera orientation, will lerp to new drone
  toast(`FPV DRONE ${String(state.camera.fpvDroneId).padStart(2, "0")} SELECTED`);
}

// ---------- CAMERA & MOVEMENT ----------

// Smooth interpolation helper
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function lerpAngle(start, end, factor) {
  // Handle angle wrapping
  let diff = end - start;
  diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
  return start + diff * factor;
}

function updateCamera(dt) {
  const cam = state.camera;
  const mobile = state.mobile;
  const smoothing = 1 - Math.exp(-dt * CONFIG.camera.yawSmoothing);
  const pitchSmoothing = 1 - Math.exp(-dt * CONFIG.camera.pitchSmoothing);
  
  // Mobile look input (right joystick)
  if (mobile.enabled && (mobile.lookX !== 0 || mobile.lookY !== 0)) {
    const lookSensitivity = CONFIG.mobile.lookSensitivity;
    cam.targetYaw -= mobile.lookX * lookSensitivity * 60 * dt; // Convert to per-second
    cam.targetPitch -= mobile.lookY * lookSensitivity * 60 * dt;
    cam.targetPitch = clamp(cam.targetPitch, CONFIG.camera.pitchMin, CONFIG.camera.pitchMax);
  }
  
  // Smooth yaw/pitch toward targets
  cam.yaw = lerpAngle(cam.yaw, cam.targetYaw, smoothing);
  cam.pitch = lerp(cam.pitch, cam.targetPitch, pitchSmoothing);
  
  // Update camera rotation
  camera.rotation.set(cam.pitch, cam.yaw, 0, "YXZ");
}

function updateObserver(dt) {
  updateCamera(dt);
  const cam = state.camera;
  const mobile = state.mobile;
  
  // Compute forward/right from camera yaw (FIXED: camera looks down -Z, so forward is -cos, -sin)
  const forward = state.camera._tmpVec3.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  const right = state.camera._tmpVec3_2.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  
  const move = state.camera._tmpVec3_2.set(0, 0, 0); // reuse
  
  // Keyboard input
  if (state.keys.has("KeyW")) move.add(forward);
  if (state.keys.has("KeyS")) move.sub(forward);
  if (state.keys.has("KeyD")) move.add(right);
  if (state.keys.has("KeyA")) move.sub(right);
  
  // Mobile input (add to keyboard input)
  if (mobile.enabled && (mobile.moveX !== 0 || mobile.moveY !== 0)) {
    if (mobile.moveY !== 0) move.addScaledVector(forward, mobile.moveY);
    if (mobile.moveX !== 0) move.addScaledVector(right, mobile.moveX);
  }
  
  if (move.lengthSq() > 0) move.normalize();
  
  // Velocity-based movement with acceleration
  const accel = CONFIG.camera.acceleration;
  const decel = CONFIG.camera.deceleration;
  const maxSpeed = CONFIG.camera.maxSpeed;
  const maxVertSpeed = CONFIG.camera.maxVerticalSpeed;
  const vel = cam.velocity;
  
  // Horizontal acceleration
  if (move.lengthSq() > 0) {
    vel.x = lerp(vel.x, move.x * maxSpeed, 1 - Math.exp(-dt * accel / maxSpeed));
    vel.z = lerp(vel.z, move.z * maxSpeed, 1 - Math.exp(-dt * accel / maxSpeed));
  } else {
    // Deceleration (drag)
    vel.x = lerp(vel.x, 0, 1 - Math.exp(-dt * decel));
    vel.z = lerp(vel.z, 0, 1 - Math.exp(-dt * decel));
  }
  
  // Vertical movement
  let vertInput = 0;
  if (state.keys.has("Space")) vertInput += 1;
  if (state.keys.has("ShiftLeft") || state.keys.has("ShiftRight")) vertInput -= 1;
  // Mobile vertical input
  if (mobile.enabled) vertInput += mobile.vertInput;
  
  if (vertInput !== 0) {
    vel.y = lerp(vel.y, vertInput * maxVertSpeed, 1 - Math.exp(-dt * accel / maxVertSpeed));
  } else {
    vel.y = lerp(vel.y, 0, 1 - Math.exp(-dt * decel));
  }
  
  // Apply velocity
  camera.position.addScaledVector(vel, dt);
  
  // Clamp position
  camera.position.y = clamp(camera.position.y, 2.2, 90);
  camera.position.x = clamp(camera.position.x, -245, 245);
  camera.position.z = clamp(camera.position.z, -245, 245);
  
  // Update visual banking based on lateral acceleration
  let latAccel = (state.keys.has("KeyA") ? -1 : 0) + (state.keys.has("KeyD") ? 1 : 0);
  if (mobile.enabled) latAccel += mobile.moveX;
  cam.targetBankAngle = latAccel * CONFIG.camera.maxBankAngle;
  cam.bankAngle = lerp(cam.bankAngle, cam.targetBankAngle, 1 - Math.exp(-dt * CONFIG.camera.bankSmoothing));
  camera.rotation.z = cam.bankAngle;
}

function updatePilot(dt) {
  updateCamera(dt);
  const cam = state.camera;
  const mobile = state.mobile;
  
  // 6DOF movement with camera-relative directions
  const forward = state.camera._tmpVec3.set(
    -Math.sin(cam.yaw) * Math.cos(cam.pitch),
    -Math.sin(cam.pitch),
    -Math.cos(cam.yaw) * Math.cos(cam.pitch)
  );
  const right = state.camera._tmpVec3_2.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  const up = new THREE.Vector3(0, 1, 0);
  
  const move = state.camera._tmpVec3_2.set(0, 0, 0); // reuse
  
  // Keyboard input
  if (state.keys.has("KeyW")) move.add(forward);
  if (state.keys.has("KeyS")) move.sub(forward);
  if (state.keys.has("KeyD")) move.add(right);
  if (state.keys.has("KeyA")) move.sub(right);
  if (state.keys.has("Space")) move.add(up);
  if (state.keys.has("ControlLeft") || state.keys.has("ControlRight")) move.sub(up);
  
  // Mobile input
  if (mobile.enabled && (mobile.moveX !== 0 || mobile.moveY !== 0)) {
    if (mobile.moveY !== 0) move.addScaledVector(forward, mobile.moveY);
    if (mobile.moveX !== 0) move.addScaledVector(right, mobile.moveX);
    if (mobile.vertInput !== 0) move.addScaledVector(up, mobile.vertInput);
  }
  
  if (move.lengthSq() > 0) move.normalize();
  
  // Velocity-based movement
  const accel = CONFIG.camera.acceleration;
  const decel = CONFIG.camera.deceleration;
  const maxSpeed = CONFIG.camera.maxSpeed;
  const maxVertSpeed = CONFIG.camera.maxVerticalSpeed;
  const vel = cam.velocity;
  
  if (move.lengthSq() > 0) {
    vel.x = lerp(vel.x, move.x * maxSpeed, 1 - Math.exp(-dt * accel / maxSpeed));
    vel.y = lerp(vel.y, move.y * maxVertSpeed, 1 - Math.exp(-dt * accel / maxVertSpeed));
    vel.z = lerp(vel.z, move.z * maxSpeed, 1 - Math.exp(-dt * accel / maxSpeed));
  } else {
    vel.x = lerp(vel.x, 0, 1 - Math.exp(-dt * decel));
    vel.y = lerp(vel.y, 0, 1 - Math.exp(-dt * decel));
    vel.z = lerp(vel.z, 0, 1 - Math.exp(-dt * decel));
  }
  
  camera.position.addScaledVector(vel, dt);
  
  // Clamp
  camera.position.y = clamp(camera.position.y, 6, 130);
  camera.position.x = clamp(camera.position.x, -245, 245);
  camera.position.z = clamp(camera.position.z, -245, 245);
  
  // Banking
  let latAccel = (state.keys.has("KeyA") ? -1 : 0) + (state.keys.has("KeyD") ? 1 : 0);
  if (mobile.enabled) latAccel += mobile.moveX;
  cam.targetBankAngle = latAccel * CONFIG.camera.maxBankAngle;
  cam.bankAngle = lerp(cam.bankAngle, cam.targetBankAngle, 1 - Math.exp(-dt * CONFIG.camera.bankSmoothing));
  camera.rotation.z = cam.bankAngle;
}

function getFpvDrone() {
  return contacts.find(c => c.id === state.camera.fpvDroneId && c.active);
}

function updateFPV(dt) {
  const drone = getFpvDrone();
  const cam = state.camera;
  const mobile = state.mobile;
  if (!drone) {
    // Fallback to observer if no drone
    state.camera.mode = "observer";
    updateObserver(dt);
    return;
  }
  
  // Control the drone directly
  const forward = state.camera._tmpVec3.set(
    -Math.sin(drone.group.rotation.y) * Math.cos(drone.group.rotation.x),
    -Math.sin(drone.group.rotation.x),
    -Math.cos(drone.group.rotation.y) * Math.cos(drone.group.rotation.x)
  );
  const right = state.camera._tmpVec3_2.set(Math.cos(drone.group.rotation.y), 0, -Math.sin(drone.group.rotation.y));
  
  const move = state.camera._tmpVec3_2.set(0, 0, 0);
  
  // Keyboard input
  if (state.keys.has("KeyW")) move.add(forward);
  if (state.keys.has("KeyS")) move.sub(forward);
  if (state.keys.has("KeyD")) move.add(right);
  if (state.keys.has("KeyA")) move.sub(right);
  if (state.keys.has("Space")) move.y += 1;
  if (state.keys.has("ShiftLeft") || state.keys.has("ShiftRight")) move.y -= 1;
  
  // Mobile input
  if (mobile.enabled && (mobile.moveX !== 0 || mobile.moveY !== 0 || mobile.vertInput !== 0)) {
    if (mobile.moveY !== 0) move.addScaledVector(forward, mobile.moveY);
    if (mobile.moveX !== 0) move.addScaledVector(right, mobile.moveX);
    if (mobile.vertInput !== 0) move.y += mobile.vertInput;
  }
  
  if (move.lengthSq() > 0) move.normalize();
  
  // Apply to drone's target/velocity (reuse drone's existing physics)
  const droneSpeed = drone.params.speed;
  const desired = move.clone().multiplyScalar(droneSpeed * 2.0); // Scale for direct control
  drone.velocity.lerp(desired, 1 - Math.exp(-dt * 10.0));
  
  // Update drone orientation based on movement
  if (drone.velocity.lengthSq() > 0.01) {
    const look = drone.group.position.clone().add(drone.velocity);
    drone.group.lookAt(look);
    // Banking
    drone.body.rotation.z = clamp(-drone.velocity.x * 0.05, -0.4, 0.4);
    drone.body.rotation.x = clamp(drone.velocity.z * 0.03, -0.35, 0.35);
  } else {
    // Return to level
    drone.body.rotation.z = lerp(drone.body.rotation.z, 0, 1 - Math.exp(-dt * 3));
    drone.body.rotation.x = lerp(drone.body.rotation.x, 0, 1 - Math.exp(-dt * 3));
  }
  
  // Camera attached to drone with offset
  const camOffset = CONFIG.camera.fpvOffset.clone();
  camOffset.applyQuaternion(drone.group.quaternion);
  camera.position.copy(drone.group.position).add(camOffset);
  
  // Camera rotation follows drone + mouse look offset
  camera.rotation.set(
    drone.group.rotation.x + cam.pitch,
    drone.group.rotation.y + cam.yaw,
    drone.group.rotation.z + cam.bankAngle,
    "YXZ"
  );
  
  // Visual banking based on drone roll
  cam.bankAngle = lerp(cam.bankAngle, drone.group.rotation.z * 0.5, 1 - Math.exp(-dt * CONFIG.camera.bankSmoothing));
  
  // Dynamic FOV based on speed
  const speed = drone.velocity.length();
  cam.targetFov = CONFIG.camera.fovBase + (CONFIG.camera.fovMax - CONFIG.camera.fovBase) * clamp(speed / CONFIG.camera.fovSpeed, 0, 1);
  cam.currentFov = lerp(cam.currentFov, cam.targetFov, 1 - Math.exp(-dt * CONFIG.camera.fovSmoothing));
  camera.fov = cam.currentFov;
  camera.updateProjectionMatrix();
}

function updateChase(dt) {
  const drone = getFpvDrone();
  const cam = state.camera;
  if (!drone) {
    state.camera.mode = "observer";
    updateObserver(dt);
    return;
  }
  
  // Desired camera position: behind and above drone
  const back = state.camera._tmpVec3.set(
    -Math.sin(drone.group.rotation.y),
    0,
    -Math.cos(drone.group.rotation.y)
  );
  const up = new THREE.Vector3(0, 1, 0);
  
  const desiredPos = state.camera._tmpVec3_2.copy(drone.group.position)
    .addScaledVector(back, CONFIG.camera.chaseDistance)
    .addScaledVector(up, CONFIG.camera.chaseHeight);
  
  // Look ahead point
  const lookAhead = state.camera._tmpVec3.set(
    -Math.sin(drone.group.rotation.y) * CONFIG.camera.chaseLookAhead,
    drone.velocity.y * 0.5,
    -Math.cos(drone.group.rotation.y) * CONFIG.camera.chaseLookAhead
  ).add(drone.group.position);
  
  // Smooth camera position
  const smoothing = 1 - Math.exp(-dt * CONFIG.camera.chaseSmoothing);
  camera.position.lerp(desiredPos, smoothing);
  
  // Camera looks at look-ahead point
  camera.lookAt(lookAhead);
  
  // Extract yaw/pitch from camera matrix for mouse look offset
  cam._tmpEuler.setFromQuaternion(camera.quaternion, "YXZ");
  cam.yaw = cam._tmpEuler.y;
  cam.pitch = cam._tmpEuler.x;
  cam.targetYaw = cam.yaw;
  cam.targetPitch = cam.pitch;
  
  // Dynamic FOV
  const speed = drone.velocity.length();
  cam.targetFov = CONFIG.camera.fovBase + (CONFIG.camera.fovMax - CONFIG.camera.fovBase) * clamp(speed / CONFIG.camera.fovSpeed, 0, 1);
  cam.currentFov = lerp(cam.currentFov, cam.targetFov, 1 - Math.exp(-dt * CONFIG.camera.fovSmoothing));
  camera.fov = cam.currentFov;
  camera.updateProjectionMatrix();
}

// ---------- DETECTION / EVALUATION ----------

function addAfterAction(message, severity = "info") {
  state.afterAction.push({
    t: state.elapsed,
    message,
    severity,
  });
  if (state.afterAction.length > 30) state.afterAction.shift();
}

function sensorObservation(contact, distance) {
  const s = state.sensorModel;
  const fc = state.fusionConfig;

  const radarVisible =
    distance < s.radarRange &&
    Math.random() > s.dropoutChance;

  const visualVisible =
    distance < s.visualRange &&
    Math.random() > s.dropoutChance * 0.6;

  const radarConfidence = radarVisible
    ? clamp(1 - distance / s.radarRange + (Math.random() - 0.5) * s.radarNoise, 0, 1)
    : 0;

  const visualConfidence = visualVisible
    ? clamp(1 - distance / s.visualRange + (Math.random() - 0.5) * s.visualNoise, 0, 1)
    : 0;

  // Motion consistency: how well predicted track matches observation
  let motionConfidence = 0.5;
  if (contact.track && contact.track.measurementCount > 2) {
    const pred = contact.track.getPredictedPosition(0.5);
    const actual = contact.group.position;
    const predError = Math.sqrt(
      Math.pow(pred.x - actual.x, 2) +
      Math.pow(pred.y - actual.y, 2) +
      Math.pow(pred.z - actual.z, 2)
    );
    motionConfidence = clamp(1 - predError / 20, 0, 1);
  }

  // Simulated RF evidence (optional)
  const rfVisible = Math.random() > 0.7;
  const rfConfidence = rfVisible ? clamp(0.3 + Math.random() * 0.4, 0, 1) : 0;

  // Weighted fusion using configurable weights
  const totalWeight = fc.weights.radar + fc.weights.visual + fc.weights.motion + fc.weights.rf;
  const fusion = clamp(
    (radarConfidence * fc.weights.radar +
     visualConfidence * fc.weights.visual +
     motionConfidence * fc.weights.motion +
     rfConfidence * fc.weights.rf) / totalWeight,
    0,
    1
  );

  // Track quality
  const trackQuality = contact.track ? contact.track.getQuality() : 0;

  // Determine if this contact is now "actionable" (has sufficient evidence)
  const isActionable = fusion >= fc.minConfidenceThreshold && (radarVisible || visualVisible);

  return {
    radarVisible,
    visualVisible,
    rfVisible,
    radarConfidence,
    visualConfidence,
    rfConfidence,
    motionConfidence,
    fusion,
    trackQuality,
    isActionable,
    distance,
  };
}

function classifySyntheticContact(contact, observation) {
  // Training classification is deliberately high-level.
  // It demonstrates uncertainty and evidence fusion rather than real-world tactics.
  // Classification is based ONLY on sensor evidence, never on ground truth.
  if (!observation.radarVisible && !observation.visualVisible && !observation.rfVisible) {
    return "UNKNOWN";
  }

  // Use fusion confidence and sensor evidence for classification
  // This simulates what a trainee would infer from the evidence
  const fusion = observation.fusion;
  const trackQuality = observation.trackQuality;
  const combined = (fusion + trackQuality) / 2;

  if (combined > 0.75) return "SYNTHETIC UAS";
  if (combined > 0.5) return "POSSIBLE UAS";
  if (combined > 0.3) return "LOW-CONFIDENCE CONTACT";
  return "UNKNOWN";
}

function truthLabel(contact) {
  return contact.contactType || "SYNTHETIC UAS";
}

function decisionLabel(code) {
  return ({
    Digit1: "UNKNOWN",
    Digit2: "BENIGN AIR CONTACT",
    Digit3: "SYNTHETIC UAS",
  })[code] || null;
}

function scoreTraineeDecision(contact, label, observation) {
  if (!contact || contact.decisionMade || !label || !observation) return;

  contact.decisionMade = true;
  contact.detected = true;
  contact.classification = label;
  contact.traineeConfidence = observation.fusion;

  // Reaction time from when contact became actionable (detectable)
  const reaction = contact.actionableTime
    ? Math.max(0.4, state.elapsed - contact.actionableTime)
    : Math.max(0.4, state.elapsed - contact.spawnTime);
  
  const truth = truthLabel(contact);
  const correct = label === truth;

  state.decisionCount++;
  state.metrics.decisions++;
  state.reactionTimes.push(reaction);
  state.confidenceHistory.push({ confidence: observation.fusion, correct });
  
  if (correct) {
    state.metrics.correctDecisions++;
    state.correctClassifications++;
    state.metrics.contactsCorrect++;
  } else {
    state.metrics.wrongDecisions++;
    if (truth === "BENIGN AIR CONTACT") {
      state.metrics.falseAlarms++;
      state.falseAlarms++;
    }
  }

  state.metrics.contactsDetected++;
  state.metrics.contactsSeen = state.decisionCount;
  state.reactionSum += reaction;
  state.metrics.averageDecisionTime =
    state.reactionSum / Math.max(1, state.decisionCount);

  // Update precision, recall, F1
  const tp = state.metrics.correctDecisions;
  const fp = state.metrics.falseAlarms;
  const fn = state.metrics.missedContacts;
  state.metrics.precision = tp + fp > 0 ? clamp((tp / (tp + fp)) * 100, 0, 100) : 100;
  state.metrics.recall = tp + fn > 0 ? clamp((tp / (tp + fn)) * 100, 0, 100) : 100;
  state.metrics.f1Score = state.metrics.precision + state.metrics.recall > 0
    ? 2 * state.metrics.precision * state.metrics.recall / (state.metrics.precision + state.metrics.recall)
    : 0;

  // Confidence calibration analysis
  const traineeConf = observation.fusion;
  let calibrationPenalty = 0;
  if (correct) {
    if (traineeConf > 0.85) {
      // High confidence + correct = good calibration
      calibrationPenalty = 0;
    } else if (traineeConf < 0.4) {
      // Low confidence + correct = underconfident
      calibrationPenalty = -5;
    }
  } else {
    if (traineeConf > 0.85) {
      // High confidence + wrong = overconfident (penalty)
      calibrationPenalty = -15;
    } else if (traineeConf < 0.4) {
      // Low confidence + wrong = appropriate uncertainty
      calibrationPenalty = -5;
    } else {
      calibrationPenalty = -10;
    }
  }

  const reactionScore = clamp(100 - reaction * 8, 15, 100);
  const evidenceScore = observation.fusion * 100;
  const trackScore = observation.trackQuality * 100;
  const multiplier = 1 + (state.difficulty - 1) * 0.18;
  const points = Math.round(
    ((correct ? 55 : -20) +
      (correct ? reactionScore * 0.3 + evidenceScore * 0.2 + trackScore * 0.15 : -reactionScore * 0.08) +
      calibrationPenalty) *
      multiplier
  );

  state.score = Math.max(0, state.score + points);
  state.lastDecision = {
    id: contact.id, label, truth, correct, reaction,
    confidence: observation.fusion, trackQuality: observation.trackQuality,
    calibrationPenalty, time: state.elapsed
  };

  // Update track with measurement
  if (contact.track) {
    contact.track.update(contact.group.position, observation.fusion);
  }

  // Update skill vector
  updateSkillVector(contact, label, observation, correct, reaction);

  addAfterAction(
    correct
      ? `Contact ${String(contact.id).padStart(2, "0")} classified correctly as ${label} in ${reaction.toFixed(1)}s (conf: ${(observation.fusion*100).toFixed(0)}%).`
      : `Contact ${String(contact.id).padStart(2, "0")} classified as ${label}; expected ${truth}. Conf: ${(observation.fusion*100).toFixed(0)}%.`,
    correct ? "good" : "warn"
  );
  logEvent(
    `DECISION ${String(contact.id).padStart(2, "0")} • ${label} • ${correct ? "CORRECT" : "REVIEW"} • ${points >= 0 ? "+" : ""}${points}`,
    correct ? "good" : "warn"
  );
  toast(correct ? "DECISION CORRECT" : "DECISION NEEDS REVIEW");
}

function evaluateSelectedContact() {
  const contact = state.selectedThreat;
  if (!contact || !contact.active) {
    toast("SELECT A CONTACT FIRST");
    return;
  }
  const observation = contact.lastObservation;
  if (!observation || (!observation.radarVisible && !observation.visualVisible && !observation.rfVisible)) {
    toast("INSUFFICIENT SENSOR EVIDENCE");
    return;
  }
  const label = decisionLabel(state.lastDecisionKey);
  if (label) scoreTraineeDecision(contact, label, observation);
}

function updateSkillVector(contact, label, observation, correct, reaction) {
  const sv = state.skillVector;
  const alpha = 0.15; // Learning rate
  
  // Detection skill: based on how quickly contacts are detected
  if (contact.firstDetectedTime) {
    const detectLatency = contact.firstDetectedTime - contact.spawnTime;
    sv.detectionSkill = clamp(sv.detectionSkill + alpha * (clamp(1 - detectLatency / 30, 0, 1) - sv.detectionSkill), 0, 1);
  }
  
  // Classification skill: accuracy weighted by evidence quality
  sv.classificationSkill = clamp(sv.classificationSkill + alpha * ((correct ? 1 : 0) * observation.fusion - sv.classificationSkill), 0, 1);
  
  // Reaction skill: inverse of reaction time (normalized)
  const reactionNorm = clamp(1 - reaction / 15, 0, 1);
  sv.reactionSkill = clamp(sv.reactionSkill + alpha * (reactionNorm - sv.reactionSkill), 0, 1);
  
  // Sensor interpretation: how well fusion confidence matches correctness
  const interpretationQuality = correct ? observation.fusion : (1 - observation.fusion);
  sv.sensorInterpretationSkill = clamp(sv.sensorInterpretationSkill + alpha * (interpretationQuality - sv.sensorInterpretationSkill), 0, 1);
  
  // Consistency: low variance in decisions
  const recentCorrect = state.confidenceHistory.slice(-10).filter(h => h.correct).length / Math.max(1, state.confidenceHistory.slice(-10).length);
  sv.consistencySkill = clamp(sv.consistencySkill + alpha * (recentCorrect - sv.consistencySkill), 0, 1);
  
  // Confidence calibration: how well confidence predicts correctness
  const calibrationError = Math.abs(observation.fusion - (correct ? 1 : 0));
  sv.confidenceCalibration = clamp(sv.confidenceCalibration + alpha * ((1 - calibrationError) - sv.confidenceCalibration), 0, 1);
}

function updateDetection(dt) {
  let nearest = null;
  let nearestDistance = Infinity;
  let nearestObs = null;
  let visibleCount = 0;
  let actionableCount = 0;

  for (const contact of contacts) {
    if (!contact.active) continue;

    const distance = contact.distanceToCamera();
    const observation = sensorObservation(contact, distance);
    contact.lastObservation = observation;

    // Track when contact first becomes actionable
    if (observation.isActionable && !contact.actionableTime) {
      contact.actionableTime = state.elapsed;
    }
    if ((observation.radarVisible || observation.visualVisible) && !contact.firstDetectedTime) {
      contact.firstDetectedTime = state.elapsed;
    }

    if (observation.radarVisible || observation.visualVisible || observation.rfVisible) visibleCount++;
    if (observation.isActionable) actionableCount++;

    // Update track with measurement
    if (contact.track && (observation.radarVisible || observation.visualVisible)) {
      contact.track.update(contact.group.position, observation.fusion);
    }

    // Prefer contacts that have not yet been assessed.
    const priorityDistance = contact.decisionMade ? distance + 10000 : distance;
    if (observation.fusion > 0 && priorityDistance < nearestDistance) {
      nearest = contact;
      nearestDistance = distance;
      nearestObs = observation;
    }
  }

  if (!nearest) {
    nearest = contacts.find(c => c.active && !c.decisionMade) ||
              contacts.find(c => c.active) ||
              null;
    if (nearest) {
      nearestDistance = nearest.distanceToCamera();
      nearestObs = nearest.lastObservation;
    }
  }

  // Do NOT auto-score. The trainee must submit a decision with 1/2/3.
  state.selectedThreat = nearest;

  if (nearest && nearestObs) {
    $("eoBar").style.width = `${Math.round(nearestObs.visualConfidence * 100)}%`;
    $("trackBar").style.width = `${Math.round(nearestObs.fusion * 100)}%`;
    $("radarBar").style.width = `${Math.round(nearestObs.radarConfidence * 100)}%`;

    // Add detailed sensor evidence display
    updateSensorEvidenceDisplay(nearest, nearestObs);

    const evidenceLabel = classifySyntheticContact(nearest, nearestObs);
    $("classification").textContent =
      `TRACK ${String(nearest.id).padStart(2, "0")}  |  EVIDENCE: ${evidenceLabel}`;
    $("selectedContact").textContent =
      `CONTACT ${String(nearest.id).padStart(2, "0")} • ${nearest.decisionMade ? "ASSESSED" : "AWAITING DECISION"}`;
    $("decisionHint").textContent =
      nearest.decisionMade
        ? "Q / E to inspect another contact."
        : "Press 1 / 2 / 3 to submit your classification.";
  } else {
    $("radarBar").style.width = "10%";
    $("eoBar").style.width = "8%";
    $("trackBar").style.width = "10%";
    clearSensorEvidenceDisplay();
    $("classification").textContent = "NO RELIABLE CONTACT";
    $("selectedContact").textContent = "NO ACTIVE CONTACT";
    $("decisionHint").textContent = "Wait for a synthetic contact.";
  }

  state.metrics.attention = clamp(
    100 - Math.max(
      0,
      contacts.filter(c => c.active && !c.decisionMade).length - visibleCount
    ) * 5,
    42,
    100
  );

  state.metrics.stress = clamp(
    actionableCount * 12 + state.difficulty * 6,
    0,
    100
  );

  const decisions = Math.max(1, state.metrics.decisions);
  state.metrics.confidence = clamp(
    (state.metrics.correctDecisions / decisions) * 100,
    0,
    100
  );
  state.metrics.precision = clamp(
    100 - (state.metrics.wrongDecisions / decisions) * 100,
    0,
    100
  );

  $("threats").textContent = contacts.filter(c => c.active).length;
  $("detected").textContent = state.metrics.correctDecisions;
  $("score").textContent = String(Math.floor(state.score)).padStart(4, "0");
  $("difficulty").textContent = state.difficulty.toFixed(1);
  $("attention").textContent = `${Math.round(state.metrics.attention)}%`;
  $("confidence").textContent = `${Math.round(state.metrics.confidence)}%`;
  $("precision").textContent = `${Math.round(state.metrics.precision)}%`;
  $("avgReaction").textContent =
    state.metrics.decisions ? `${state.metrics.averageDecisionTime.toFixed(1)}s` : "—";
  $("phase").textContent = state.scenario.phase.toUpperCase();
  $("objective").textContent = state.scenario.objective;

  window.__SIH_TRAINING_STATE__ = {
    scenario: state.scenario,
    metrics: state.metrics,
    skillVector: state.skillVector,
    selectedContact: nearest ? {
      id: nearest.id,
      distance: Number(nearestDistance.toFixed(1)),
      evidence: nearestObs ? Number(nearestObs.fusion.toFixed(2)) : 0,
      trackQuality: nearestObs ? Number(nearestObs.trackQuality.toFixed(2)) : 0,
      assessed: !!nearest.decisionMade,
      behavior: nearest.behavior,
      contactType: nearest.contactType,
    } : null,
  };
}

function updateSensorEvidenceDisplay(contact, observation) {
  // Create or update detailed sensor evidence panel
  let detailEl = $("sensorDetail");
  if (!detailEl) {
    detailEl = document.createElement("div");
    detailEl.id = "sensorDetail";
    detailEl.className = "sensor-detail";
    const rightPanel = document.querySelector(".right-panel");
    rightPanel?.appendChild(detailEl);
  }
  
  const trackPred = contact.track ? contact.track.getPredictedPosition(1.0) : null;
  const predStr = trackPred 
    ? `X:${trackPred.x.toFixed(1)} Y:${trackPred.y.toFixed(1)} Z:${trackPred.z.toFixed(1)}`
    : "—";
  
  detailEl.innerHTML = `
    <div class="sensor-detail-title">SENSOR EVIDENCE — CONTACT ${String(contact.id).padStart(2, "0")}</div>
    <div class="sensor-row"><span>RANGE</span><b>${observation.distance.toFixed(1)}m</b></div>
    <div class="sensor-row"><span>ALTITUDE</span><b>${contact.group.position.y.toFixed(1)}m</b></div>
    <div class="sensor-row"><span>SPEED</span><b>${contact.params.speed.toFixed(1)}m/s</b></div>
    <div class="sensor-row"><span>BEHAVIOR</span><b>${contact.behavior}</b></div>
    <hr style="border-color:rgba(255,255,255,0.1);margin:8px 0">
    <div class="sensor-row"><span>RADAR</span><b>${(observation.radarConfidence*100).toFixed(0)}%</b> ${observation.radarVisible ? "●" : "○"}</div>
    <div class="sensor-row"><span>EO/IR</span><b>${(observation.visualConfidence*100).toFixed(0)}%</b> ${observation.visualVisible ? "●" : "○"}</div>
    <div class="sensor-row"><span>MOTION</span><b>${(observation.motionConfidence*100).toFixed(0)}%</b></div>
    <div class="sensor-row"><span>RF</span><b>${(observation.rfConfidence*100).toFixed(0)}%</b> ${observation.rfVisible ? "●" : "○"}</div>
    <div class="sensor-row"><span>TRACK Q</span><b>${(observation.trackQuality*100).toFixed(0)}%</b></div>
    <hr style="border-color:rgba(255,255,255,0.1);margin:8px 0">
    <div class="sensor-row"><span>FUSION</span><b>${(observation.fusion*100).toFixed(0)}%</b></div>
    <div class="sensor-row"><span>PRED(1s)</span><b>${predStr}</b></div>
    <div class="sensor-row"><span>ACTIONABLE</span><b>${observation.isActionable ? "YES" : "NO"}</b></div>
  `;
}

function clearSensorEvidenceDisplay() {
  const detailEl = $("sensorDetail");
  if (detailEl) detailEl.remove();
}

// ---------- SCENARIO ADAPTATION ----------

const SCENARIO_PHASES = [
  {
    name: "monitor",
    duration: 12,
    message: "Baseline airspace monitoring. Establish situational awareness.",
  },
  {
    name: "contact",
    duration: 15,
    message: "Multiple synthetic contacts entering the training area.",
  },
  {
    name: "ambiguity",
    duration: 14,
    message: "Sensor confidence is reduced. Cross-check available evidence.",
  },
  {
    name: "surge",
    duration: 18,
    message: "Scenario intensity increased. Prioritize the most relevant contacts.",
  },
  {
    name: "assessment",
    duration: 10,
    message: "Scenario assessment phase. Review detection performance.",
  },
];

let scenarioPhaseIndex = 0;

function enterScenarioPhase(index) {
  const phase = SCENARIO_PHASES[index];
  if (!phase) return;

  state.scenario.phase = phase.name;
  state.scenario.phaseTime = 0;

  logEvent(`PHASE: ${phase.name.toUpperCase()} — ${phase.message}`, "warn");
  toast(phase.name.toUpperCase());

  addAfterAction(phase.message, "phase");
}

function adaptThreatPopulation() {
  const phase = state.scenario.phase;

  // We keep the total number of meshes fixed for performance.
  // Instead, phase logic activates/deactivates existing synthetic contacts.
  const desired =
    phase === "monitor" ? 2 :
    phase === "contact" ? 3 :
    phase === "ambiguity" ? 4 :
    phase === "surge" ? 5 :
    3;

  contacts.forEach((contact, index) => {
    contact.active = index < desired;

    if (contact.active && contact.spawnTime === 0) {
      contact.spawnTime = state.elapsed;
    }
  });
}

function updateScenario(dt) {
  state.scenario.elapsed += dt;
  state.scenario.phaseTime += dt;

  const phase = SCENARIO_PHASES[scenarioPhaseIndex];

  if (state.scenario.phaseTime >= phase.duration) {
    scenarioPhaseIndex++;

    if (scenarioPhaseIndex >= SCENARIO_PHASES.length) {
      scenarioPhaseIndex = 0;
      state.scenario.completed = true;

      const averageReaction =
        state.detections > 0
          ? state.reactionSum / state.detections
          : 0;

      // Calculate missed contacts (active but not decided)
      const activeContacts = contacts.filter(c => c.active);
      const undecidedContacts = activeContacts.filter(c => !c.decisionMade);
      state.metrics.missedContacts = undecidedContacts.length;

      addAfterAction(
        `Scenario cycle complete. Score ${Math.floor(state.score)}, average reaction ${averageReaction.toFixed(1)}s.`,
        "good"
      );

      logEvent("Scenario cycle complete — preparing next adaptive cycle.", "good");

      // Analyze weaknesses for personalized adaptation
      const weakness = analyzeWeaknesses();
      state.detectedWeakness = weakness;
      const recommendation = generateRecommendation(weakness);
      state.nextScenarioRecommendation = recommendation;

      // Difficulty responds to performance, not merely elapsed time.
      const detectionRate =
        state.metrics.contactsSeen > 0
          ? state.metrics.contactsCorrect / state.metrics.contactsSeen
          : 0;

      let difficultyChange = 0;
      let adaptationReason = "";

      if (detectionRate > 0.75 && averageReaction < 8 && state.metrics.precision > 75) {
        difficultyChange = 0.35;
        adaptationReason = "Performance threshold met. Next cycle increases ambiguity and contact density.";
      } else if (detectionRate < 0.4 || state.metrics.precision < 55) {
        difficultyChange = -0.2;
        adaptationReason = "Performance below target. Next cycle reduces complexity for skill reinforcement.";
      } else if (state.metrics.recall < 60) {
        difficultyChange = -0.1;
        adaptationReason = "Low detection rate. Reducing contact density to improve monitoring.";
      } else if (state.skillVector.confidenceCalibration < 0.4) {
        difficultyChange = -0.1;
        adaptationReason = "Confidence calibration issues. Reducing ambiguity for clearer evidence.";
      } else {
        // Maintain or slight increase
        difficultyChange = 0.1;
        adaptationReason = "Steady performance. Gradually increasing challenge.";
      }

      if (difficultyChange !== 0) {
        state.difficulty = clamp(state.difficulty + difficultyChange, 1, 5);
        addAfterAction(adaptationReason, "phase");
      }

      // Regenerate contacts with new behaviors based on difficulty and weakness
      regenerateContactsForNextCycle(weakness);

      // Reset per-cycle metrics but preserve skill vector
      state.metrics.contactsSeen = 0;
      state.metrics.contactsDetected = 0;
      state.metrics.contactsCorrect = 0;
      state.metrics.falseAlarms = 0;
      state.metrics.missedContacts = 0;
      for (const c of contacts) {
        c.decisionMade = false;
        c.detected = false;
        c.spawnTime = state.elapsed;
        c.actionableTime = null;
        c.firstDetectedTime = null;
        c.classification = null;
        c.traineeConfidence = null;
        // Reset track
        if (c.track) {
          c.track.x = c.group.position.x;
          c.track.y = c.group.position.y;
          c.track.z = c.group.position.z;
          c.track.vx = 0;
          c.track.vy = 0;
          c.track.vz = 0;
          c.track.lastUpdate = state.elapsed;
          c.track.age = 0;
          c.track.measurementCount = 0;
          c.track.confidence = 0.5;
          c.track.predictionUncertainty = 1.0;
          c.track.covariance = { px: 10, py: 10, pz: 10, pvx: 5, pvy: 5, pvz: 5 };
          c.track.history = [];
        }
      }
      openAAR();
      state.scenario.completed = false;
    }

    enterScenarioPhase(scenarioPhaseIndex);
  }

  adaptThreatPopulation();

  // Scenario-specific sensor conditions.
  if (state.scenario.phase === "ambiguity") {
    state.sensorModel.radarNoise = 0.25;
    state.sensorModel.visualNoise = 0.18;
    state.sensorModel.dropoutChance = 0.06;
  } else if (state.scenario.phase === "surge") {
    state.sensorModel.radarNoise = 0.20;
    state.sensorModel.visualNoise = 0.14;
    state.sensorModel.dropoutChance = 0.04;
  } else {
    state.sensorModel.radarNoise = 0.16;
    state.sensorModel.visualNoise = 0.10;
    state.sensorModel.dropoutChance = 0.025;
  }
}

function analyzeWeaknesses() {
  const sv = state.skillVector;
  const metrics = state.metrics;
  const weaknesses = [];
  
  if (sv.detectionSkill < 0.45) weaknesses.push({ type: "detection", severity: 1 - sv.detectionSkill });
  if (sv.classificationSkill < 0.45) weaknesses.push({ type: "classification", severity: 1 - sv.classificationSkill });
  if (sv.reactionSkill < 0.45) weaknesses.push({ type: "reaction", severity: 1 - sv.reactionSkill });
  if (sv.sensorInterpretationSkill < 0.45) weaknesses.push({ type: "sensorInterpretation", severity: 1 - sv.sensorInterpretationSkill });
  if (sv.consistencySkill < 0.45) weaknesses.push({ type: "consistency", severity: 1 - sv.consistencySkill });
  if (sv.confidenceCalibration < 0.45) weaknesses.push({ type: "confidenceCalibration", severity: 1 - sv.confidenceCalibration });
  
  // Also check metrics
  if (metrics.recall < 60) weaknesses.push({ type: "missedContacts", severity: (60 - metrics.recall) / 60 });
  if (metrics.precision < 60) weaknesses.push({ type: "falseAlarms", severity: (60 - metrics.precision) / 60 });
  if (metrics.averageDecisionTime > 10) weaknesses.push({ type: "slowReaction", severity: Math.min((metrics.averageDecisionTime - 10) / 10, 1) });
  
  if (weaknesses.length === 0) return null;
  
  // Return the most severe weakness
  weaknesses.sort((a, b) => b.severity - a.severity);
  return weaknesses[0].type;
}

function generateRecommendation(weakness) {
  const recommendations = {
    detection: {
      focus: "Detection Speed",
      exercise: "High-frequency contact identification with reduced sensor noise",
      reason: "Trainee takes too long to initially detect contacts. Practice rapid scanning.",
    },
    classification: {
      focus: "Classification Accuracy",
      exercise: "Ambiguous low-confidence contacts requiring careful evidence evaluation",
      reason: "High false-alarm rate indicates difficulty discriminating between contact types.",
    },
    reaction: {
      focus: "Reaction Time",
      exercise: "Time-pressured multi-contact scenarios with clear evidence",
      reason: "Slow decision-making under pressure. Practice rapid assessment with clear sensor data.",
    },
    sensorInterpretation: {
      focus: "Sensor Evidence Interpretation",
      exercise: "Multi-sensor fusion drills with conflicting radar/visual/RF evidence",
      reason: "Difficulty synthesizing multi-source sensor data into coherent picture.",
    },
    consistency: {
      focus: "Decision Consistency",
      exercise: "Repeated similar contact patterns to build recognition heuristics",
      reason: "Inconsistent decisions on similar contacts. Pattern recognition needs reinforcement.",
    },
    confidenceCalibration: {
      focus: "Confidence Calibration",
      exercise: "Scenarios with known ground truth for confidence feedback training",
      reason: "Confidence levels don't match actual accuracy. Over/under-confidence detected.",
    },
    missedContacts: {
      focus: "Situational Awareness",
      exercise: "Multi-contact monitoring with staggered appearance timing",
      reason: "Contacts being missed entirely. Improve scanning patterns and attention distribution.",
    },
    falseAlarms: {
      focus: "Discrimination",
      exercise: "Benign vs. threat discrimination with subtle evidence differences",
      reason: "High false-alarm rate. Practice distinguishing ambiguous contacts from threats.",
    },
    slowReaction: {
      focus: "Decision Speed",
      exercise: "Rapid classification drills with decreasing decision windows",
      reason: "Average reaction time exceeds threshold. Train faster evidence processing.",
    },
  };
  
  return recommendations[weakness] || {
    focus: "General Proficiency",
    exercise: "Balanced scenario with mixed contact types and sensor conditions",
    reason: "Continue current training progression with gradual difficulty increase.",
  };
}

function regenerateContactsForNextCycle(weakness) {
  const behaviorPool = getBehaviorPoolForWeakness(weakness);
  
  contacts.forEach((contact, index) => {
    // Reassign behavior from appropriate pool
    const newBehavior = behaviorPool[index % behaviorPool.length];
    contact.behavior = newBehavior;
    contact.params = createBehaviorParams(newBehavior, state.difficulty);
    contact.contactType = rand(0, 1) > 0.7 ? "BENIGN AIR CONTACT" : "SYNTHETIC UAS";
    contact.initializePosition();
    contact.group.position.copy(contact.initialPosition);
    contact.velocity.set(0, 0, 0);
    
    // Update visual for benign contacts
    if (contact.contactType === "BENIGN AIR CONTACT") {
      contact.body.scale.setScalar(0.58);
      contact.group.position.y = contact.initialPosition.y + 8;
    } else {
      contact.body.scale.setScalar(1);
      contact.group.position.y = contact.initialPosition.y;
    }
  });
}

function getBehaviorPoolForWeakness(weakness) {
  const basePool = [
    CONTACT_BEHAVIORS.LOITER,
    CONTACT_BEHAVIORS.CRUISE,
    CONTACT_BEHAVIORS.APPROACH,
    CONTACT_BEHAVIORS.DEPART,
    CONTACT_BEHAVIORS.ERRATIC,
    CONTACT_BEHAVIORS.CROSSING,
    CONTACT_BEHAVIORS.SLOW,
    CONTACT_BEHAVIORS.FAST,
  ];
  
  if (!weakness) return basePool;
  
  switch (weakness) {
    case "detection":
    case "missedContacts":
      // More crossing and approach behaviors - enter airspace predictably
      return [CONTACT_BEHAVIORS.CROSSING, CONTACT_BEHAVIORS.APPROACH, CONTACT_BEHAVIORS.CRUISE, CONTACT_BEHAVIORS.LOITER];
    case "classification":
    case "falseAlarms":
      // More erratic and slow - ambiguous signatures
      return [CONTACT_BEHAVIORS.ERRATIC, CONTACT_BEHAVIORS.SLOW, CONTACT_BEHAVIORS.LOITER, CONTACT_BEHAVIORS.CROSSING];
    case "reaction":
    case "slowReaction":
      // More fast and approach - time pressure
      return [CONTACT_BEHAVIORS.FAST, CONTACT_BEHAVIORS.APPROACH, CONTACT_BEHAVIORS.CROSSING, CONTACT_BEHAVIORS.ERRATIC];
    case "sensorInterpretation":
      // Mix of all with emphasis on varying signatures
      return [CONTACT_BEHAVIORS.ERRATIC, CONTACT_BEHAVIORS.CROSSING, CONTACT_BEHAVIORS.APPROACH, CONTACT_BEHAVIORS.DEPART, CONTACT_BEHAVIORS.SLOW, CONTACT_BEHAVIORS.FAST];
    case "consistency":
      // Repeated patterns
      return [CONTACT_BEHAVIORS.CRUISE, CONTACT_BEHAVIORS.LOITER, CONTACT_BEHAVIORS.CRUISE, CONTACT_BEHAVIORS.LOITER];
    case "confidenceCalibration":
      // Clear evidence contacts
      return [CONTACT_BEHAVIORS.CRUISE, CONTACT_BEHAVIORS.APPROACH, CONTACT_BEHAVIORS.CROSSING, CONTACT_BEHAVIORS.LOITER];
    default:
      return basePool;
  }
}

// ---------- DECORATIVE BASE DETAILS ----------

function createBaseDetails() {
  createWatchTower([-120, 0, 0]);
  createWatchTower([120, 0, 0]);
  createWatchTower([-120, 0, -120]);
  createWatchTower([120, 0, -120]);

  createRadar();

  createVehicle([-85, 0, 20], 1.0);
  createVehicle([-65, 0, 20], 0.9);
  createVehicle([72, 0, 18], 1.05);
  createVehicle([94, 0, 18], 0.85);

  createHelipad();

  // Floodlight poles.
  for (const [x, z] of [[-105, -5], [105, -5], [-105, 25], [105, 25]]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    addCylinder(g, 0.18, 0.25, 14, MAT.darkMetal, [0, 7, 0], 8);
    const head = addBox(g, [1.4, 0.55, 0.7], MAT.white, [0, 14, 0], [0, 0, 0], false);
    scene.add(g);
  }

  // Training gate.
  const gate = new THREE.Group();
  gate.position.set(0, 0, 30);
  addBox(gate, [42, 1, 1.2], MAT.oliveDark, [0, 10, 0]);
  addBox(gate, [3, 10, 2], MAT.concreteDark, [-20, 5, 0]);
  addBox(gate, [3, 10, 2], MAT.concreteDark, [20, 5, 0]);
  addBox(gate, [5, 0.35, 0.35], MAT.yellow, [0, 8, 0], [0, 0, 0], false);
  scene.add(gate);
}

// ---------- INITIALIZATION ----------

function initialize() {
  createSky();
  createTerrain();
  createInstancedVegetation();
  createCommandCenter();
  createBaseDetails();
  createFence();
  createContacts();

  // Initialize camera
  camera.position.set(0, 9, 75);
  camera.rotation.set(-0.05, 0, 0, "YXZ");
  state.camera.yaw = 0;
  state.camera.pitch = -0.05;
  state.camera.targetYaw = 0;
  state.camera.targetPitch = -0.05;
  state.camera.velocity.set(0, 0, 0);

  logEvent("Simulation environment initialized", "good");
  logEvent("Synthetic threat scenario ready", "good");
  toast("TRAINING ENVIRONMENT READY — CLICK TO LOCK CURSOR");
}

enterScenarioPhase(0);
initialize();

// Set initial mode display
$("mode").textContent = "OBSERVER";

// ---------- ANIMATION ----------

function animate(now) {
  requestAnimationFrame(animate);

  const rawDt = Math.max(0.001, (now - state.lastFrame) / 1000);
  const dt = Math.min(rawDt, 0.05);
  state.lastFrame = now;

  state.elapsed += dt;

  // FPS monitor.
  state.fpsAccumulator += dt;
  state.fpsFrames++;
  if (state.fpsAccumulator > 1) {
    state.fps = state.fpsFrames / state.fpsAccumulator;
    state.fpsAccumulator = 0;
    state.fpsFrames = 0;
    const scale = state.fps < 42 ? 0.82 : state.fps < 52 ? 0.92 : 1.0;
    renderer.setPixelRatio(
      Math.min((window.devicePixelRatio || 1) * scale, CONFIG.maxPixelRatio)
    );
  }

  // Camera mode handling
  switch (state.camera.mode) {
    case "observer":
      updateObserver(dt);
      break;
    case "pilot":
      updatePilot(dt);
      break;
    case "fpv":
      updateFPV(dt);
      break;
    case "chase":
      updateChase(dt);
      break;
    default:
      updateObserver(dt);
  }

  for (const contact of contacts) contact.update(dt);

  // Update radar sweep
  state.radarAngle += dt * 0.8;
  if (radar.sweep) {
    radar.sweep.rotation.z = state.radarAngle;
    if (radar.dish) radar.dish.rotation.z = state.radarAngle;
  }

  updateDetection(dt);
  updateScenario(dt);

  // Render tactical radar (throttled to 10 FPS for performance)
  if (!state.lastRadarRender || state.elapsed - state.lastRadarRender > 0.1) {
    renderTacticalRadar();
    state.lastRadarRender = state.elapsed;
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) $("toast").classList.remove("show");
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// ---------- RESIZE ----------

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio)
  );
});
