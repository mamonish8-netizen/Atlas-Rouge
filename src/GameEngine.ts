import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioManager } from './AudioManager';
import { MultiplayerManager, WorldSyncPayload } from './MultiplayerManager';
import {
  AtlasBossVisual,
  BeaconVisual,
  buildAlienRuinStructure,
  buildArrowProjectileMesh,
  buildAtlasBoss,
  buildBeaconLockShield,
  buildCentralSpire,
  buildCloneCharacter,
  buildDropPodMarker,
  buildElevatedBeaconPlatform,
  buildEnemyMesh,
  buildForgingStation,
  buildGemRupeeCluster,
  buildRepairBeacon,
  buildResourceNode,
  buildSkyClouds,
  buildSkyEnclosure,
  buildUnbreakableLandmark,
  CharacterRig,
  generateProceduralTextures,
  ProceduralTextureSet,
  SpireVisual,
} from './ProceduralAssets';
import {
  BeaconStatus,
  BossHudState,
  CLONE_ARCHETYPES,
  CloneArchetypeId,
  CRAFTING_RECIPES,
  EnemyHudLabel,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  InventoryState,
  ProjectedLabel,
  RunStats,
  ToolSlotId,
} from './types';

// Pre-allocated math helpers to keep render loop GC-free
const _vec3 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const FORGE_POS = { x: 184, z: 10 };

// Distinct border spawn pads near map perimeter (~176m out of 205m boundary)
const BORDER_SPAWNS: Array<{ x: number; z: number; label: string }> = [
  { x: 0, z: 176, label: 'South Rim' },
  { x: -176, z: 0, label: 'West Rim' },
  { x: 0, z: -176, label: 'North Rim' },
  { x: 126, z: -126, label: 'North-East Rim' },
];

interface BeaconSiteDef {
  label: string;
  x: number;
  z: number;
  elevation: number;
  isFloating: boolean;
  floatDelta: number;
}

// 4 Ground Beacons + 3 Elevated Top Beacons (each with walkable ramps on both sides)
const BEACON_SITES: BeaconSiteDef[] = [
  { label: 'North-East Ridge Relay', x: 96, z: -92, elevation: 6.0, isFloating: false, floatDelta: 0 },
  { label: 'North-West Highland Core', x: -102, z: -86, elevation: 12.5, isFloating: false, floatDelta: 0 },
  { label: 'South-East Basin Grid', x: 100, z: 88, elevation: -3.5, isFloating: false, floatDelta: 0 },
  { label: 'South-West Cliff Overlook', x: -94, z: 96, elevation: 16.5, isFloating: false, floatDelta: 0 },
  { label: 'Sky-Platform Alpha (Ramped)', x: 0, z: -126, elevation: 2.0, isFloating: true, floatDelta: 10.5 },
  { label: 'Sky-Platform Beta (Ramped)', x: -130, z: 0, elevation: 3.5, isFloating: true, floatDelta: 11.0 },
  { label: 'Sky-Platform Gamma (Ramped)', x: 34, z: 128, elevation: 1.5, isFloating: true, floatDelta: 10.5 },
];

const SLOW_ZONES: Array<{ x: number; z: number; radius: number }> = [
  { x: 54, z: 32, radius: 10.5 },
  { x: -64, z: -26, radius: 11.0 },
  { x: -12, z: -82, radius: 10.0 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function terrainHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const centerBlend = smoothstep(16, 36, r);

  let h =
    Math.sin(x * 0.025) * Math.cos(z * 0.022) * 3.8 +
    Math.sin(x * 0.062 + z * 0.045) * 1.5 +
    Math.cos(x * 0.013 - z * 0.016) * 2.4;

  h *= centerBlend;

  for (const b of BEACON_SITES) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < 36) {
      const w = 1 - smoothstep(10, 36, d);
      h = h * (1 - w) + b.elevation * w;
    }
  }

  // Flatten around Forging Station
  const dForge = Math.hypot(x - FORGE_POS.x, z - FORGE_POS.z);
  if (dForge < 24) {
    const w = 1 - smoothstep(8, 24, dForge);
    h = h * (1 - w) + 2.0 * w;
  }

  // Smooth landing plateaus at the 4 border drop-pod spawns
  for (const sp of BORDER_SPAWNS) {
    const dSp = Math.hypot(x - sp.x, z - sp.z);
    if (dSp < 18) {
      const w = 1 - smoothstep(6, 18, dSp);
      h = h * (1 - w) + 2.5 * w;
    }
  }

  return h;
}

interface CollisionObstacle {
  x: number;
  yMin: number;
  yMax: number;
  z: number;
  radius: number;
  nodeId?: string;
  unbreakableKind?: 'Ancient Redwood' | 'Massive Boulder';
}

interface ElevatedPlatformData {
  x: number;
  z: number;
  baseY: number;
  heightDelta: number;
  deckY: number;
  deckRadius: number;
  rampLength: number;
  rampHalfWidth: number;
}

interface ResourceNodeEntity {
  id: string;
  kind: 'tree' | 'stone' | 'fiber' | 'alien_metal';
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  depleted: boolean;
  respawnTimer: number;
  mesh: THREE.Group;
}

interface EnemyEntity {
  id: string;
  kind: 'raptor' | 'theropod' | 'skywing' | 'drone';
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  aggroRadius: number;
  attackCooldown: number;
  lungeTimer: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  platformIdx: number;
  guardBeaconId: number | null;
  mesh: THREE.Group;
}

interface EnemyRespawnTask {
  id: string;
  kind: 'raptor' | 'theropod' | 'skywing';
  homeX: number;
  homeY: number;
  homeZ: number;
  platformIdx: number;
  timer: number;
}

interface ArrowProjectile {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
}

interface EnemyProjectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
}

interface TelegraphZone {
  id: string;
  shape: 'circle' | 'line';
  x: number;
  z: number;
  radius: number;
  angle: number;
  length: number;
  elapsed: number;
  duration: number;
  damage: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface ShockwaveRing {
  x: number;
  z: number;
  radius: number;
  maxRadius: number;
  speed: number;
  damage: number;
  hitPlayer: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface CoverPillar {
  x: number;
  z: number;
  hp: number;
  mesh: THREE.Mesh;
}

const STAGE_LABELS = [
  'SYSTEM CALIBRATION',
  'ORBITAL TARGETING',
  'HYPER-BEAM PROTOCOL (1.0s)',
  'SECURITY SWARM',
  'GRAVITY ANOMALY',
  'SOLAR BARRAGE',
  'TERMINAL OVERDRIVE',
];

export class GameEngine {
  private container: HTMLElement;
  private audio: AudioManager;
  private mp: MultiplayerManager;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private isSoftwareGl = false;

  private textures: ProceduralTextureSet | null = null;
  private instancedGrass: THREE.InstancedMesh | null = null;
  private earthMesh: THREE.Mesh | null = null;
  private gasPlanetMesh: THREE.Mesh | null = null;
  private skyCloudsGroup: THREE.Group | null = null;
  private ambientMotes: THREE.Points | null = null;

  private spire!: SpireVisual;
  private beaconVisuals: BeaconVisual[] = [];
  private beaconShields: THREE.Mesh[] = [];
  private bossVisual!: AtlasBossVisual;
  private coverPillars: CoverPillar[] = [];
  private elevatedPlatforms: ElevatedPlatformData[] = [];
  private staticObstacles: CollisionObstacle[] = [];
  private dynamicObstacles: CollisionObstacle[] = [];

  private localRig!: CharacterRig;
  private remoteRigs: Map<string, { rig: CharacterRig; targetPos: THREE.Vector3; targetYaw: number }> = new Map();

  private resourceNodes: ResourceNodeEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private respawnQueue: EnemyRespawnTask[] = [];
  private arrows: ArrowProjectile[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private telegraphs: TelegraphZone[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private bossSlowFields: Array<{ x: number; z: number; radius: number; ttl: number; mesh: THREE.Mesh }> = [];

  // Runtime state
  private running = false;
  private paused = false;
  private craftingOpen = false;
  private adminOpen = false;
  private adminGodMode = false;
  private frameId = 0;
  private lastTime = 0;
  private quality: GraphicsQuality = 'high';
  private renderResolutionLabel = 'Auto';
  private pointerLocked = false;
  private lastPointerPos: { x: number; y: number } | null = null;

  // Player state
  private playerName = 'Clone-01';
  private archetype: CloneArchetypeId = 'tank';
  private playerPos = new THREE.Vector3(0, 0, 176);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = Math.PI;
  private camYaw = 0;
  private camPitch = 0.28;
  private grounded = true;
  private footstepTimer = 0;

  private hp = 100;
  private maxHp = 100;
  private stamina = 100;
  private maxStamina = 100;
  private isSprinting = false;
  private isSlowed = false;
  private nearForge = false;
  private shiftDownAt = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDir = new THREE.Vector3();
  private iFrames = 0;
  private attackSwingTimer = 0;
  private attackCooldown = 0;
  private attackCombo = 0;
  private isAiming = false;
  private bowDrawing = false;
  private bowCharge = 0;
  private activeSlot: ToolSlotId = 'pickaxe';
  private damageFlash = 0;
  private hitMarker = 0;
  private deathTimer = 0;

  private inventory: InventoryState = {
    wood: 2,
    stone: 2,
    fiber: 2,
    metal: 0,
    refinedAlloy: 0,
    arrows: 8,
    stims: 1,
    hasPickaxe: true,
    hasHatchet: false,
    hasBow: false,
    hasArmor: false,
    pickaxeTier: 1,
    hatchetTier: 1,
    armorTier: 0,
  };

  private stats: RunStats = {
    elapsedSeconds: 0,
    enemiesDefeated: 0,
    beaconsRepaired: 0,
    resourcesHarvested: 0,
    damageDealt: 0,
    revivesOrHeals: 0,
  };

  // World & Boss state
  private phase: GamePhase = 'jungle';
  private beacons: BeaconStatus[] = [];
  private interactPrompt: string | null = null;
  private interactProgress = 0;
  private elevatorTimer = 0;
  private bossWakeTimer = 0;
  private cutsceneLine: string | null = null;

  private bossState: BossHudState = {
    active: false,
    name: 'ATLAS // ORBITAL OVERMIND',
    hp: 6000,
    maxHp: 6000,
    stage: 1,
    maxStages: 7,
    immune: false,
    resting: false,
    subtitle: '',
    subtitleSpeaker: 'ATLAS',
  };
  private bossPos = new THREE.Vector3(0, 81.2, -10);
  private bossYaw = 0;
  private bossAttackTimer = 2.2;
  private bossCycleCount = 0;
  private bossRestTimer = 0;
  private bossImmuneTimer = 0;
  private bossCurrentStage = 1;

  private netSyncAccum = 0;
  private hudSyncAccum = 0;
  private keys: Set<string> = new Set();

  public onHudUpdate: ((snapshot: HudSnapshot) => void) | null = null;
  public onToggleCrafting: ((open: boolean) => void) | null = null;
  public onToggleAdmin: ((open: boolean) => void) | null = null;
  public onTogglePause: ((paused: boolean) => void) | null = null;
  public onMuteToggle: (() => void) | null = null;
  public onNotice: ((msg: string) => void) | null = null;

  constructor(container: HTMLElement, audio: AudioManager, mp: MultiplayerManager) {
    this.container = container;
    this.audio = audio;
    this.mp = mp;
  }

  public async initialize(onProgress?: (label: string, pct: number) => void): Promise<void> {
    onProgress?.('PROBING GPU & WEBGL2 PIPELINE...', 0.1);
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight,
    );

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.container.innerHTML = '';
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);
    this.scene.fog = new THREE.FogExp2(0x0a1c26, 0.0022);

    const aspect = (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.2, 1200);

    onProgress?.('GENERATING STUDIO ENVIRONMENT & TEXTURES...', 0.35);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.72;
    pmrem.dispose();

    const maxAniso = this.isSoftwareGl ? 1 : Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    this.textures = await generateProceduralTextures(maxAniso, (t) => {
      onProgress?.('SYNTHESIZING PROCEDURAL SURFACE MAPS...', 0.35 + t * 0.25);
    });

    onProgress?.('COMPILING AUDIO BUFFERS & VOICE MATRIX...', 0.65);
    await this.audio.prewarmBuffers((t) => {
      onProgress?.('PRE-WARMING PROCEDURAL AUDIO SYNTHESIZER...', 0.65 + t * 0.15);
    });

    onProgress?.('CONSTRUCTING EXPANDED ORBITAL BIOSPHERE...', 0.85);
    this.buildBiosphereWorld();
    this.setGraphicsQuality(this.quality);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindInputs();
    this.bindNetworkCallbacks();
    onProgress?.('LINKING TO ATLAS NETWORK...', 1.0);
  }

  private buildBiosphereWorld(): void {
    if (!this.textures) return;
    this.staticObstacles = [];

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e3a24, 0.86);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
    this.sunLight.position.set(110, 185, 85);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 500;
    const d = 220;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    rimLight.position.set(-125, 75, -105);
    this.scene.add(rimLight);

    // High-density Terrain Heightmap Mesh (470x470m, 144x144 segments for seamless smooth hills)
    const terrainGeo = new THREE.PlaneGeometry(470, 470, 144, 144);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = terrainHeightAt(vx, vz);
      posAttr.setY(i, vy);

      if (vy < -0.5) {
        _color.setRGB(0.24, 0.48, 0.28);
      } else if (vy < 7.0) {
        _color.setRGB(0.35, 0.56, 0.3);
      } else if (vy < 13.0) {
        _color.setRGB(0.42, 0.52, 0.34);
      } else {
        _color.setRGB(0.5, 0.48, 0.42);
      }
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        map: this.textures.ground,
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.03,
      }),
    );
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);

    // Perimeter cliffs around radius 214..226m (with solid collision)
    const rockMat = new THREE.MeshStandardMaterial({ map: this.textures.rock, roughness: 0.88, metalness: 0.1 });
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const rad = 216 + (i % 4) * 4;
      const cx = Math.cos(a) * rad;
      const cz = Math.sin(a) * rad;
      const hBase = terrainHeightAt(cx, cz);
      const cliff = new THREE.Mesh(new THREE.DodecahedronGeometry(9.5 + (i % 4) * 2.2, 0), rockMat);
      cliff.position.set(cx, hBase + 3.5, cz);
      cliff.scale.set(1.5, 1.0 + (i % 3) * 0.3, 1.25);
      cliff.rotation.y = a;
      cliff.receiveShadow = true;
      this.scene.add(cliff);
      this.staticObstacles.push({ x: cx, yMin: hBase - 5, yMax: hBase + 16, z: cz, radius: 9.0 });
    }

    // Metallic Structural Rib Cage + Glass Enclosure (radius 235m)
    this.scene.add(buildSkyEnclosure(235, this.textures.spireMetal, this.isSoftwareGl));

    // Drifting Sky Clouds inside the biosphere sky
    this.skyCloudsGroup = buildSkyClouds();
    this.scene.add(this.skyCloudsGroup);

    // Floating Atmospheric Biosphere Pollen / Light Motes
    const moteCount = 340;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 175;
      const mx = Math.cos(a) * r;
      const mz = Math.sin(a) * r;
      motePos[i * 3] = mx;
      motePos[i * 3 + 1] = terrainHeightAt(mx, mz) + 1.5 + Math.random() * 11;
      motePos[i * 3 + 2] = mz;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    this.ambientMotes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({ color: 0xa7f3d0, size: 0.45, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(this.ambientMotes);

    // Deep Space Scenery visible outside glass & clouds
    const starCount = 1600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.55;
      const r = 420 + Math.random() * 340;
      starPos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      starPos[i * 3 + 1] = Math.cos(phi) * r + 30;
      starPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xf1f5f9, size: 1.9, sizeAttenuation: true, fog: false }),
      ),
    );

    this.earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(132, 48, 34),
      new THREE.MeshStandardMaterial({
        map: this.textures.deadEarth,
        roughness: 0.88,
        metalness: 0.04,
        fog: false,
      }),
    );
    this.earthMesh.position.set(-90, 270, -420);
    this.scene.add(this.earthMesh);

    this.gasPlanetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(96, 40, 28),
      new THREE.MeshStandardMaterial({
        map: this.textures.gasGiant,
        roughness: 0.72,
        metalness: 0.08,
        fog: false,
      }),
    );
    this.gasPlanetMesh.position.set(340, 210, -340);
    const planetRing = new THREE.Mesh(
      new THREE.RingGeometry(125, 195, 56),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    planetRing.rotation.x = Math.PI / 2.6;
    planetRing.rotation.y = 0.35;
    this.gasPlanetMesh.add(planetRing);
    this.scene.add(this.gasPlanetMesh);

    const crimsonMoon = new THREE.Mesh(
      new THREE.SphereGeometry(38, 28, 20),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9, fog: false }),
    );
    crimsonMoon.position.set(-340, 170, 240);
    this.scene.add(crimsonMoon);

    // Border Drop Pod Landing Markers
    const podColors = [0xf59e0b, 0x06b6d4, 0x10b981, 0xec4899];
    BORDER_SPAWNS.forEach((sp, i) => {
      const marker = buildDropPodMarker(podColors[i % podColors.length]);
      marker.position.set(sp.x, terrainHeightAt(sp.x, sp.z) - 0.1, sp.z);
      this.scene.add(marker);
    });

    // Small Slow Hazard Zones (-45% movement speed)
    const mireMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    for (const sz of SLOW_ZONES) {
      const mire = new THREE.Mesh(new THREE.CircleGeometry(sz.radius, 28), mireMat);
      mire.rotation.x = -Math.PI / 2;
      mire.position.set(sz.x, terrainHeightAt(sz.x, sz.z) + 0.14, sz.z);
      this.scene.add(mire);
    }

    // Forging Station on the Edge of the Map
    const forgeGroup = buildForgingStation(this.textures.spireMetal);
    const forgeY = terrainHeightAt(FORGE_POS.x, FORGE_POS.z);
    forgeGroup.position.set(FORGE_POS.x, forgeY - 0.1, FORGE_POS.z);
    forgeGroup.rotation.y = -Math.PI / 2;
    this.scene.add(forgeGroup);
    this.staticObstacles.push({ x: FORGE_POS.x - 1.2, yMin: forgeY - 1, yMax: forgeY + 8, z: FORGE_POS.z, radius: 3.4 });

    // Unbreakable Monumental Foliage & Geology: Giant Redwoods / Pines & Massive Boulders
    let lSeed = 4099;
    const lRand = () => {
      lSeed = (lSeed * 16807) % 2147483647;
      return (lSeed - 1) / 2147483646;
    };
    let placedLandmarks = 0;
    let lAttempts = 0;
    while (placedLandmarks < 46 && lAttempts < 400) {
      lAttempts++;
      const ang = lRand() * Math.PI * 2;
      const rad = 32 + lRand() * 158;
      const lx = Math.cos(ang) * rad;
      const lz = Math.sin(ang) * rad;

      if (Math.hypot(lx - FORGE_POS.x, lz - FORGE_POS.z) < 16) continue;
      if (BORDER_SPAWNS.some((sp) => Math.hypot(lx - sp.x, lz - sp.z) < 14)) continue;
      // Keep beacon sites and their side ramps completely unobstructed!
      if (BEACON_SITES.some((b) => Math.hypot(lx - b.x, lz - b.z) < (b.isFloating ? 34 : 15))) continue;

      const isRedwood = placedLandmarks % 2 === 0;
      const ly = terrainHeightAt(lx, lz);
      const lm = buildUnbreakableLandmark(isRedwood ? 'redwood' : 'boulder', this.textures.bark, this.textures.rock);
      const s = 0.9 + lRand() * 0.35;
      lm.position.set(lx, ly - 0.25, lz);
      lm.rotation.y = lRand() * Math.PI * 2;
      lm.scale.setScalar(s);
      this.scene.add(lm);

      this.staticObstacles.push({
        x: lx,
        yMin: ly - 1,
        yMax: ly + (isRedwood ? 19 * s : 4.8 * s),
        z: lz,
        radius: isRedwood ? 1.6 * s : 3.7 * s,
        unbreakableKind: isRedwood ? 'Ancient Redwood' : 'Massive Boulder',
      });
      placedLandmarks++;
    }

    // 12 Decorative Clusters of Gems, Rupees & Botanical Pistils
    const gemLocations: Array<[number, number]> = [
      [34, -22], [-38, -28], [42, 44], [-48, 42],
      [78, -12], [-82, 16], [18, -74], [-22, 76],
      [135, -55], [-132, -62], [128, 108], [-118, 126],
    ];
    gemLocations.forEach(([gx, gz], idx) => {
      const cluster = buildGemRupeeCluster(idx);
      const gy = terrainHeightAt(gx, gz);
      cluster.position.set(gx, gy - 0.08, gz);
      cluster.rotation.y = idx * 0.9;
      this.scene.add(cluster);
      this.staticObstacles.push({ x: gx, yMin: gy - 1, yMax: gy + 2.5, z: gz, radius: 1.3 });
    });

    // Purely Visual Instanced Grass Blades ONLY (non-resource)
    const grassCount = 3800;
    const grassGeo = new THREE.ConeGeometry(0.18, 0.85, 3);
    grassGeo.translate(0, 0.42, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d8b31, roughness: 0.82, metalness: 0.0 });
    this.instancedGrass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    for (let i = 0; i < grassCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 18 + Math.random() * 185;
      const gx = Math.cos(ang) * rad;
      const gz = Math.sin(ang) * rad;
      _dummy.position.set(gx, terrainHeightAt(gx, gz) - 0.05, gz);
      _dummy.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);
      const s = 0.7 + Math.random() * 0.8;
      _dummy.scale.set(s, s * (0.8 + Math.random() * 0.6), s);
      _dummy.updateMatrix();
      this.instancedGrass.setMatrixAt(i, _dummy.matrix);
      _color.setHSL(0.26 + (Math.random() - 0.5) * 0.08, 0.52, 0.28 + Math.random() * 0.16);
      this.instancedGrass.setColorAt(i, _color);
    }
    this.instancedGrass.instanceMatrix.needsUpdate = true;
    if (this.instancedGrass.instanceColor) this.instancedGrass.instanceColor.needsUpdate = true;
    this.instancedGrass.computeBoundingSphere();
    this.scene.add(this.instancedGrass);

    // Central Spire & Glass Elevator
    this.spire = buildCentralSpire(this.textures.spireMetal, this.isSoftwareGl);
    this.scene.add(this.spire.group);

    // Apex Boss Deck Floor & Cover Pillars (y = 75.0)
    const deckFloor = new THREE.Mesh(
      new THREE.CircleGeometry(27.5, 40),
      new THREE.MeshStandardMaterial({ map: this.textures.arenaDeck, roughness: 0.4, metalness: 0.65 }),
    );
    deckFloor.rotation.x = -Math.PI / 2;
    deckFloor.position.y = 75.02;
    deckFloor.receiveShadow = true;
    this.scene.add(deckFloor);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(27.4, 0.45, 10, 44),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.65, roughness: 0.3 }),
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 75.45;
    this.scene.add(rimRing);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * 14.5;
      const pz = Math.sin(a) * 14.5;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 4.2, 10), pillarMat);
      mesh.position.set(px, 77.1, pz);
      mesh.castShadow = !this.isSoftwareGl;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.coverPillars.push({ x: px, z: pz, hp: 140, mesh });
    }

    // ATLAS Boss Core
    this.bossVisual = buildAtlasBoss();
    this.bossVisual.group.position.copy(this.bossPos);
    this.scene.add(this.bossVisual.group);
  }

  public startRun(playerName: string, archetype: CloneArchetypeId): void {
    this.playerName = playerName.trim() || 'Clone-01';
    this.archetype = archetype;
    const arch = CLONE_ARCHETYPES[archetype];

    this.clearDynamicEntities();

    this.phase = 'jungle';

    // Spawn each party member at a different border drop-pod near the perimeter edge
    const spawnSlot = this.mp.getOrderedLocalSlotIndex();
    const spawnPt = BORDER_SPAWNS[spawnSlot % BORDER_SPAWNS.length];
    const startY = terrainHeightAt(spawnPt.x, spawnPt.z);
    this.playerPos.set(spawnPt.x, startY, spawnPt.z);
    this.playerVel.set(0, 0, 0);

    // Face inward toward the center spire
    const inwardYaw = Math.atan2(-spawnPt.x, -spawnPt.z);
    this.playerYaw = inwardYaw;
    this.camYaw = Math.atan2(spawnPt.x, spawnPt.z);
    this.camPitch = 0.28;
    this.grounded = true;
    this.footstepTimer = 0;

    this.maxHp = Math.round(100 * (1 + arch.maxHpBonus));
    this.hp = this.maxHp;
    this.maxStamina = 100;
    this.stamina = 100;
    this.isSprinting = false;
    this.isSlowed = false;
    this.nearForge = false;
    this.dashTimer = 0;
    this.iFrames = 0;
    this.attackCombo = 0;
    this.activeSlot = 'pickaxe';
    this.damageFlash = 0;
    this.hitMarker = 0;
    this.deathTimer = 0;
    this.cutsceneLine = null;
    this.interactPrompt = null;
    this.interactProgress = 0;
    this.paused = false;
    this.craftingOpen = false;
    this.adminOpen = false;
    this.adminGodMode = false;

    this.inventory = {
      wood: 2,
      stone: 2,
      fiber: 2,
      metal: 0,
      refinedAlloy: 0,
      arrows: 8,
      stims: archetype === 'medic' ? 3 : 1,
      hasPickaxe: true,
      hasHatchet: false,
      hasBow: false,
      hasArmor: false,
      pickaxeTier: 1,
      hatchetTier: 1,
      armorTier: 0,
    };

    this.stats = {
      elapsedSeconds: 0,
      enemiesDefeated: 0,
      beaconsRepaired: 0,
      resourcesHarvested: 0,
      damageDealt: 0,
      revivesOrHeals: 0,
    };

    if (this.localRig) this.scene.remove(this.localRig.root);
    this.localRig = buildCloneCharacter(archetype);
    this.localRig.root.position.copy(this.playerPos);
    this.localRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.localRig.root);

    // 7 Beacons: 4 Ground + 3 Elevated Top Platforms with Ramps on BOTH Sides
    this.elevatedPlatforms = [];
    this.beaconShields = [];
    this.beacons = BEACON_SITES.map((b, idx) => {
      const groundY = terrainHeightAt(b.x, b.z);
      const beaconY = b.isFloating ? groundY + b.floatDelta : groundY;
      if (b.isFloating && this.textures) {
        const ep = buildElevatedBeaconPlatform(b.floatDelta, this.textures.spireMetal);
        ep.group.position.set(b.x, groundY, b.z);
        this.scene.add(ep.group);
        this.elevatedPlatforms.push({
          x: b.x,
          z: b.z,
          baseY: groundY,
          heightDelta: b.floatDelta,
          deckY: groundY + b.floatDelta,
          deckRadius: ep.deckRadius,
          rampLength: ep.rampLength,
          rampHalfWidth: ep.rampHalfWidth,
        });
      }
      return {
        id: idx,
        label: b.label,
        x: b.x,
        y: beaconY,
        z: b.z,
        isFloating: b.isFloating,
        locked: true,
        guardiansRemaining: 3,
        progress: 0,
        repaired: false,
        woodDeposited: 0,
        stoneDeposited: 0,
        metalDeposited: 0,
        woodRequired: 6,
        stoneRequired: 5,
        metalRequired: 2,
      };
    });

    for (const b of this.beacons) {
      const bv = buildRepairBeacon();
      bv.group.position.set(b.x, b.y - 0.15, b.z);
      this.scene.add(bv.group);
      this.beaconVisuals.push(bv);

      const lockShield = buildBeaconLockShield();
      lockShield.position.set(b.x, b.y + 2.5, b.z);
      this.scene.add(lockShield);
      this.beaconShields.push(lockShield);

      this.dynamicObstacles.push({
        x: b.x,
        yMin: b.y - 1,
        yMax: b.y + 6.5,
        z: b.z,
        radius: 2.85,
      });
    }

    this.spire.doorLeft.position.x = -1.12;
    this.spire.doorRight.position.x = 1.12;
    this.spire.elevatorCabin.position.y = 1.5;
    this.spire.doorLightMat.color.setHex(0xef4444);
    this.spire.doorLightMat.emissive.setHex(0xef4444);

    for (const p of this.coverPillars) {
      p.hp = 140;
      p.mesh.visible = true;
    }

    this.bossState = {
      active: false,
      name: 'ATLAS // ORBITAL OVERMIND',
      hp: 6000,
      maxHp: 6000,
      stage: 1,
      maxStages: 7,
      immune: false,
      resting: false,
      subtitle: '',
      subtitleSpeaker: 'ATLAS',
    };
    this.bossPos.set(0, 81.2, -10);
    this.bossVisual.group.position.copy(this.bossPos);
    this.bossVisual.shieldMesh.visible = false;
    this.bossVisual.coreMat.color.setHex(0x38bdf8);
    this.bossVisual.coreMat.emissive.setHex(0x0284c7);
    this.bossAttackTimer = 2.4;
    this.bossCycleCount = 0;
    this.bossRestTimer = 0;
    this.bossImmuneTimer = 0;
    this.bossCurrentStage = 1;

    this.spawnInitialResources();
    if (this.mp.isHost) {
      this.spawnInitialEnemies();
    }

    this.audio.startAmbient();
    this.running = true;
    this.lastTime = performance.now();
    this.onNotice?.(`Dropped at ${spawnPt.label} · Calm Beacon Guardians to unlock each Beacon!`);
    this.scheduleNextTick();
  }

  private clearDynamicEntities(): void {
    for (const bv of this.beaconVisuals) this.scene.remove(bv.group);
    this.beaconVisuals = [];
    for (const sh of this.beaconShields) this.scene.remove(sh);
    this.beaconShields = [];
    for (const n of this.resourceNodes) this.scene.remove(n.mesh);
    this.resourceNodes = [];
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
    this.respawnQueue = [];
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows = [];
    for (const ep of this.enemyProjectiles) this.scene.remove(ep.mesh);
    this.enemyProjectiles = [];
    for (const t of this.telegraphs) {
      this.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mat.dispose();
    }
    this.telegraphs = [];
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mat.dispose();
    }
    this.shockwaves = [];
    for (const sf of this.bossSlowFields) {
      this.scene.remove(sf.mesh);
      sf.mesh.geometry.dispose();
    }
    this.bossSlowFields = [];
    this.dynamicObstacles = [];
    for (const r of this.remoteRigs.values()) {
      this.scene.remove(r.rig.root);
    }
    this.remoteRigs.clear();
  }

  private spawnInitialResources(): void {
    if (!this.textures) return;
    const kinds: Array<'tree' | 'stone' | 'fiber'> = ['tree', 'stone', 'fiber'];
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    let spawned = 0;
    let attempts = 0;
    while (spawned < 135 && attempts < 600) {
      attempts++;
      const kind = kinds[spawned % 3];
      const ang = rand() * Math.PI * 2;
      const rad = 24 + rand() * 172;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;

      if (Math.hypot(x - FORGE_POS.x, z - FORGE_POS.z) < 12) continue;
      if (BORDER_SPAWNS.some((sp) => Math.hypot(x - sp.x, z - sp.z) < 10)) continue;
      if (BEACON_SITES.some((b) => Math.hypot(x - b.x, z - b.z) < (b.isFloating ? 30 : 10))) continue;

      const y = terrainHeightAt(x, z);
      const mesh = buildResourceNode(kind, this.textures.bark, this.textures.rock);
      mesh.position.set(x, y - 0.1, z);
      mesh.rotation.y = rand() * Math.PI * 2;
      this.scene.add(mesh);

      const nodeId = `node-${spawned}`;
      this.resourceNodes.push({
        id: nodeId,
        kind,
        x,
        y,
        z,
        hp: kind === 'fiber' ? 20 : 48,
        maxHp: kind === 'fiber' ? 20 : 48,
        depleted: false,
        respawnTimer: 0,
        mesh,
      });

      this.dynamicObstacles.push({
        x,
        yMin: y - 1,
        yMax: y + (kind === 'tree' ? 7.5 : kind === 'stone' ? 2.4 : 1.6),
        z,
        radius: kind === 'tree' ? 0.85 : kind === 'stone' ? 1.45 : 0.9,
        nodeId,
      });
      spawned++;
    }

    // Ancient Rusted Alien Metallic Structures (salvageable for Metal Scrap)
    const ruinCoords: Array<{ x: number; z: number; variant: 0 | 1 | 2; rot: number }> = [
      { x: 46, z: -32, variant: 0, rot: 0.4 },
      { x: -50, z: -38, variant: 1, rot: 1.2 },
      { x: 52, z: 48, variant: 2, rot: -0.6 },
      { x: -42, z: 54, variant: 0, rot: 2.1 },
      { x: 122, z: -22, variant: 1, rot: 0.9 },
      { x: -124, z: 32, variant: 2, rot: 1.7 },
      { x: 24, z: -102, variant: 0, rot: -1.1 },
      { x: -24, z: 108, variant: 1, rot: 2.6 },
      { x: 132, z: 102, variant: 2, rot: 0.2 },
      { x: -122, z: -116, variant: 0, rot: 1.5 },
      { x: 112, z: -135, variant: 1, rot: -0.4 },
      { x: -115, z: 132, variant: 2, rot: 2.9 },
      { x: 160, z: -68, variant: 0, rot: 0.8 },
      { x: -158, z: -72, variant: 2, rot: 2.2 },
    ];
    ruinCoords.forEach((rc, idx) => {
      const ruin = buildAlienRuinStructure(rc.variant, this.textures!.rustAlien);
      const ry = terrainHeightAt(rc.x, rc.z);
      ruin.position.set(rc.x, ry - 0.15, rc.z);
      ruin.rotation.y = rc.rot;
      this.scene.add(ruin);

      const nodeId = `alien-metal-${idx}`;
      this.resourceNodes.push({
        id: nodeId,
        kind: 'alien_metal',
        x: rc.x,
        y: ry,
        z: rc.z,
        hp: 65,
        maxHp: 65,
        depleted: false,
        respawnTimer: 0,
        mesh: ruin,
      });

      this.dynamicObstacles.push({
        x: rc.x,
        yMin: ry - 1,
        yMax: ry + 9.5,
        z: rc.z,
        radius: 3.1,
        nodeId,
      });
    });
  }

  private spawnInitialEnemies(): void {
    // 1. Spawn a Guardian Army (3 mobs) locking EVERY Beacon until all guardians for that beacon are calmed!
    let elevatedIdx = 0;
    this.beacons.forEach((b) => {
      if (b.isFloating) {
        const pIdx = elevatedIdx++;
        const fp = this.elevatedPlatforms[pIdx];
        // Two agile Raptors guarding the top deck & ramps + 1 Sky-Pteron circling overhead
        this.createEnemy(`guard-${b.id}-a`, 'raptor', b.x - 3.6, fp.deckY, b.z + 2.2, pIdx, b.id);
        this.createEnemy(`guard-${b.id}-b`, 'raptor', b.x + 3.6, fp.deckY, b.z - 2.2, pIdx, b.id);
        this.createEnemy(`guard-${b.id}-air`, 'skywing', b.x, fp.deckY + 7.5, b.z + 5.0, -1, b.id);
      } else {
        // Ground beacon guardian squad: 2 Raptors + 1 Theropod (or Skywing)
        this.createEnemy(
          `guard-${b.id}-a`,
          'raptor',
          b.x - 6.5,
          terrainHeightAt(b.x - 6.5, b.z + 4.5),
          b.z + 4.5,
          -1,
          b.id,
        );
        this.createEnemy(
          `guard-${b.id}-b`,
          'raptor',
          b.x + 6.5,
          terrainHeightAt(b.x + 6.5, b.z + 4.5),
          b.z + 4.5,
          -1,
          b.id,
        );
        this.createEnemy(
          `guard-${b.id}-boss`,
          b.id % 2 === 0 ? 'theropod' : 'skywing',
          b.x,
          terrainHeightAt(b.x, b.z - 7.5) + (b.id % 2 === 0 ? 0 : 8.5),
          b.z - 7.5,
          -1,
          b.id,
        );
      }
    });

    // 2. Roaming ambient wildlife across open trails (respawns on 28s timer)
    const roamSpawns: Array<{ kind: 'raptor' | 'theropod' | 'skywing'; x: number; z: number }> = [
      { kind: 'raptor', x: 52, z: -45 },
      { kind: 'theropod', x: -55, z: 48 },
      { kind: 'skywing', x: 142, z: -32 },
      { kind: 'skywing', x: -52, z: -120 },
    ];
    roamSpawns.forEach((s, idx) => {
      const sy = terrainHeightAt(s.x, s.z) + (s.kind === 'skywing' ? 8.5 : 0);
      this.createEnemy(`roam-${idx}`, s.kind, s.x, sy, s.z, -1, null);
    });
  }

  private createEnemy(
    id: string,
    kind: 'raptor' | 'theropod' | 'skywing' | 'drone',
    x: number,
    y: number,
    z: number,
    platformIdx: number,
    guardBeaconId: number | null,
  ): EnemyEntity {
    const aggroRadius =
      kind === 'theropod' ? 24 : kind === 'skywing' ? 32 : kind === 'drone' ? 34 : platformIdx >= 0 ? 15 : 20;
    const mesh = buildEnemyMesh(kind, aggroRadius);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const maxHp =
      kind === 'theropod' ? 300 : kind === 'raptor' ? (platformIdx >= 0 ? 105 : 135) : kind === 'skywing' ? 115 : 95;
    const speed = kind === 'raptor' ? 7.0 : kind === 'skywing' ? 8.4 : kind === 'drone' ? 6.2 : 4.9;
    const damage = kind === 'theropod' ? 26 : kind === 'raptor' ? 16 : kind === 'skywing' ? 14 : 13;

    const entity: EnemyEntity = {
      id,
      kind,
      x,
      y,
      z,
      yaw: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      speed,
      damage,
      aggroRadius,
      attackCooldown: 1.0,
      lungeTimer: 0,
      homeX: x,
      homeY: y,
      homeZ: z,
      platformIdx,
      guardBeaconId,
      mesh,
    };
    this.enemies.push(entity);
    return entity;
  }

  public setGraphicsQuality(q: GraphicsQuality): void {
    this.quality = q;
    if (!this.renderer) return;

    const nativeDpr = window.devicePixelRatio || 1;
    let targetRatio = 1.0;
    if (this.isSoftwareGl) {
      targetRatio = q === 'low' ? 0.55 : q === 'medium' ? 0.8 : q === 'high' ? 1.15 : 1.5;
    } else {
      targetRatio =
        q === 'low'
          ? 0.6
          : q === 'medium'
            ? 0.9
            : q === 'high'
              ? Math.max(nativeDpr, 1.4)
              : Math.min(Math.max(nativeDpr * 1.5, 2.2), 2.75);
    }

    this.renderer.setPixelRatio(targetRatio);
    const cw = this.container.clientWidth || window.innerWidth;
    const ch = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(cw, ch, false);

    const rw = Math.round(cw * targetRatio);
    const rh = Math.round(ch * targetRatio);
    this.renderResolutionLabel = `${rw}×${rh} (${targetRatio.toFixed(2)}x)`;

    if (this.camera) {
      this.camera.far = q === 'low' ? 480 : q === 'medium' ? 680 : q === 'high' ? 920 : 1200;
      this.camera.updateProjectionMatrix();
    }

    if (this.sunLight && !this.isSoftwareGl) {
      this.sunLight.castShadow = q !== 'low';
      const maxTex = this.renderer.capabilities.maxTextureSize;
      const ultraSize = maxTex >= 4096 ? 4096 : 2048;
      const size = q === 'ultra' ? ultraSize : q === 'high' ? 2048 : 1024;
      if (this.sunLight.shadow.mapSize.width !== size) {
        this.sunLight.shadow.mapSize.set(size, size);
        this.sunLight.shadow.map?.dispose();
        this.sunLight.shadow.map = null;
      }
    }

    if (this.instancedGrass) {
      this.instancedGrass.count = q === 'low' ? 650 : q === 'medium' ? 1500 : q === 'high' ? 2700 : 3800;
    }
  }

  public getGraphicsQuality(): GraphicsQuality {
    return this.quality;
  }

  public craftItem(recipeId: string): boolean {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;
    if (
      this.inventory.wood < recipe.cost.wood ||
      this.inventory.stone < recipe.cost.stone ||
      this.inventory.fiber < recipe.cost.fiber
    ) {
      return false;
    }
    if (recipe.id === 'pickaxe' && this.inventory.hasPickaxe) return false;
    if (recipe.id === 'hatchet' && this.inventory.hasHatchet) return false;
    if (recipe.id === 'bow' && this.inventory.hasBow) return false;
    if (recipe.id === 'armor' && this.inventory.hasArmor) return false;

    this.inventory.wood -= recipe.cost.wood;
    this.inventory.stone -= recipe.cost.stone;
    this.inventory.fiber -= recipe.cost.fiber;

    if (recipe.id === 'pickaxe') this.inventory.hasPickaxe = true;
    else if (recipe.id === 'hatchet') {
      this.inventory.hasHatchet = true;
      this.selectSlot('hatchet');
    } else if (recipe.id === 'bow') {
      this.inventory.hasBow = true;
      this.inventory.arrows += 8;
      this.selectSlot('bow');
    } else if (recipe.id === 'arrows') {
      this.inventory.arrows += 10;
    } else if (recipe.id === 'armor') {
      this.inventory.hasArmor = true;
      this.inventory.armorTier = 1;
      if (this.localRig) this.localRig.armorGroup.visible = true;
    } else if (recipe.id === 'stim') {
      this.inventory.stims += 1;
    }

    this.audio.playCraft();
    return true;
  }

  public smeltMetal(): boolean {
    if (!this.nearForge) {
      this.onNotice?.('Stand near the Forging Station (east map edge) to smelt Metal.');
      return false;
    }
    if (this.inventory.metal < 2) {
      this.onNotice?.('Need 2 Metal Scrap from Alien Ruins to smelt 1 Refined Alloy.');
      return false;
    }
    this.inventory.metal -= 2;
    this.inventory.refinedAlloy += 1;
    this.audio.playForge();
    this.onNotice?.('Smelted 1 Refined Alloy at the Forging Station.');
    return true;
  }

  public upgradeGear(kind: 'pickaxe' | 'hatchet' | 'armor'): boolean {
    if (!this.nearForge) {
      this.onNotice?.('Visit the Forging Station (east map edge) to upgrade tools & armor.');
      return false;
    }
    if (kind === 'pickaxe') {
      if (this.inventory.pickaxeTier >= 3) return false;
      const cost = this.inventory.pickaxeTier === 1 ? 2 : 3;
      if (this.inventory.refinedAlloy < cost) return false;
      this.inventory.refinedAlloy -= cost;
      this.inventory.pickaxeTier = (this.inventory.pickaxeTier + 1) as 2 | 3;
      this.audio.playForge();
      this.onNotice?.(`Upgraded Pickaxe to Tier ${this.inventory.pickaxeTier}!`);
      return true;
    }
    if (kind === 'hatchet') {
      if (!this.inventory.hasHatchet || this.inventory.hatchetTier >= 3) return false;
      const cost = this.inventory.hatchetTier === 1 ? 2 : 3;
      if (this.inventory.refinedAlloy < cost) return false;
      this.inventory.refinedAlloy -= cost;
      this.inventory.hatchetTier = (this.inventory.hatchetTier + 1) as 2 | 3;
      this.audio.playForge();
      this.onNotice?.(`Upgraded Hatchet to Tier ${this.inventory.hatchetTier}!`);
      return true;
    }
    if (kind === 'armor') {
      if (!this.inventory.hasArmor || this.inventory.armorTier >= 3) return false;
      const cost = this.inventory.armorTier === 1 ? 2 : 3;
      if (this.inventory.refinedAlloy < cost) return false;
      this.inventory.refinedAlloy -= cost;
      this.inventory.armorTier = (this.inventory.armorTier + 1) as 2 | 3;
      this.audio.playForge();
      this.onNotice?.(`Upgraded Armor to Tier ${this.inventory.armorTier}!`);
      return true;
    }
    return false;
  }

  public selectSlot(slot: ToolSlotId): void {
    if (slot === 'hatchet' && !this.inventory.hasHatchet) {
      this.onNotice?.('Craft Forest Hatchet inside Inventory [V] first.');
      return;
    }
    if (slot === 'bow' && !this.inventory.hasBow) {
      this.onNotice?.('Craft Recurve Bow inside Inventory [V] first.');
      return;
    }
    if (slot === 'stim') {
      this.useHealingStim();
      return;
    }
    this.activeSlot = slot;
    this.bowDrawing = false;
    this.bowCharge = 0;
    if (this.localRig) {
      this.localRig.tools.pickaxe.visible = slot === 'pickaxe';
      this.localRig.tools.hatchet.visible = slot === 'hatchet';
      this.localRig.tools.bow.visible = slot === 'bow';
    }
  }

  private cycleOwnedSlot(dir: 1 | -1): void {
    const owned: ToolSlotId[] = ['pickaxe'];
    if (this.inventory.hasHatchet) owned.push('hatchet');
    if (this.inventory.hasBow) owned.push('bow');
    if (owned.length <= 1) return;
    const idx = owned.indexOf(this.activeSlot);
    const next = owned[(idx + dir + owned.length) % owned.length];
    this.selectSlot(next);
  }

  private useHealingStim(): void {
    if (this.inventory.stims <= 0) {
      this.onNotice?.('No Bio-Shield Patches left. Craft more in Inventory [V].');
      return;
    }
    if (this.hp >= this.maxHp || this.hp <= 0) return;
    this.inventory.stims -= 1;
    const mult = CLONE_ARCHETYPES[this.archetype].healPowerMult;
    this.hp = Math.min(this.maxHp, this.hp + Math.round(45 * mult));
    this.stats.revivesOrHeals += 1;
    this.audio.playHeal();
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    if (p && document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock();
    }
  }

  public setCraftingOpen(open: boolean): void {
    this.craftingOpen = open;
    if (open) {
      this.adminOpen = false;
      this.onToggleAdmin?.(false);
    }
    if (open && document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock();
    }
  }

  public setAdminOpen(open: boolean): void {
    this.adminOpen = open;
    if (open) {
      this.craftingOpen = false;
      this.onToggleCrafting?.(false);
      if (document.pointerLockElement === this.renderer?.domElement) {
        document.exitPointerLock();
      }
    }
  }

  private ensureShowcaseLoadout(): void {
    this.inventory.hasPickaxe = true;
    this.inventory.hasHatchet = true;
    this.inventory.hasBow = true;
    this.inventory.arrows = Math.max(this.inventory.arrows, 50);
    this.inventory.stims = Math.max(this.inventory.stims, 4);
    if (!this.inventory.hasArmor) {
      this.inventory.hasArmor = true;
      this.inventory.armorTier = 2;
      if (this.localRig) this.localRig.armorGroup.visible = true;
    }
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
  }

  private clearBossHazardEntities(): void {
    for (const t of this.telegraphs) {
      this.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mat.dispose();
    }
    this.telegraphs = [];
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mat.dispose();
    }
    this.shockwaves = [];
    for (const sf of this.bossSlowFields) {
      this.scene.remove(sf.mesh);
      sf.mesh.geometry.dispose();
    }
    this.bossSlowFields = [];
    for (const ep of this.enemyProjectiles) {
      this.scene.remove(ep.mesh);
    }
    this.enemyProjectiles = [];
  }

  private unlockAllBeaconsForShowcase(): void {
    for (const b of this.beacons) {
      b.locked = false;
      b.guardiansRemaining = 0;
      b.repaired = true;
      b.progress = 100;
      b.woodDeposited = b.woodRequired;
      b.stoneDeposited = b.stoneRequired;
      b.metalDeposited = b.metalRequired;
    }
    this.stats.beaconsRepaired = this.beacons.length;
  }

  public adminJumpToElevatorReady(): void {
    if (!this.running) return;
    if (!this.mp.isHost) {
      this.onNotice?.('Only the Co-Op Host can warp mission phases.');
      return;
    }
    this.clearBossHazardEntities();
    this.unlockAllBeaconsForShowcase();
    this.ensureShowcaseLoadout();
    this.phase = 'elevator_ready';
    this.bossState.active = false;
    this.bossState.immune = false;
    this.bossState.resting = false;
    this.bossState.subtitle = '';
    this.cutsceneLine = null;
    this.spire.elevatorCabin.position.y = 1.5;

    const padY = terrainHeightAt(0, 12.8);
    this.playerPos.set(0, padY, 12.8);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = Math.PI;
    this.camYaw = 0;
    this.camPitch = 0.2;
    this.grounded = true;
    this.localRig.root.position.copy(this.playerPos);
    this.localRig.root.rotation.y = this.playerYaw;

    this.audio.playBeaconRepaired();
    this.onNotice?.('ADMIN: All 7 Beacons Online · Step inside Spire & Press [E] to Ride Elevator!');
  }

  public adminStartElevatorRide(): void {
    if (!this.running) return;
    if (!this.mp.isHost) {
      this.onNotice?.('Only the Co-Op Host can trigger the elevator ride.');
      return;
    }
    this.clearBossHazardEntities();
    this.unlockAllBeaconsForShowcase();
    this.ensureShowcaseLoadout();
    this.bossState.active = false;
    this.bossState.immune = false;
    this.bossState.resting = false;
    this.bossState.subtitle = '';
    this.spire.elevatorCabin.position.y = 1.5;
    this.adminOpen = false;
    this.onToggleAdmin?.(false);
    this.beginElevatorCutscene();
    this.onNotice?.('ADMIN: Ascending Central Spire Elevator to Apex Deck...');
  }

  public adminTriggerBossWake(): void {
    if (!this.running) return;
    if (!this.mp.isHost) {
      this.onNotice?.('Only the Co-Op Host can trigger the boss cutscene.');
      return;
    }
    this.clearBossHazardEntities();
    this.unlockAllBeaconsForShowcase();
    this.ensureShowcaseLoadout();
    this.selectSlot('bow');
    this.spire.elevatorCabin.position.y = 75.0;
    this.bossState.active = false;
    this.bossState.hp = this.bossState.maxHp;
    this.bossState.stage = 1;
    this.bossCurrentStage = 1;
    this.bossState.immune = false;
    this.bossState.resting = false;
    this.bossCycleCount = 0;
    this.adminOpen = false;
    this.onToggleAdmin?.(false);
    this.beginBossWakeCutscene();
  }

  public adminShowcaseBoss(stage = 1, forceDescend = false): void {
    if (!this.running) return;
    if (!this.mp.isHost) {
      this.onNotice?.('Only the Co-Op Host can warp to the boss arena.');
      return;
    }
    const targetStage = Math.max(1, Math.min(7, Math.round(stage)));
    this.clearBossHazardEntities();
    this.unlockAllBeaconsForShowcase();
    this.ensureShowcaseLoadout();
    this.selectSlot(forceDescend ? (this.inventory.hasHatchet ? 'hatchet' : 'pickaxe') : 'bow');

    this.spire.elevatorCabin.position.y = 75.0;
    this.phase = 'boss_fight';
    this.cutsceneLine = null;

    this.playerPos.set(0, 75.0, 16.5);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = Math.PI;
    this.camYaw = 0;
    this.camPitch = 0.24;
    this.grounded = true;
    this.localRig.root.position.copy(this.playerPos);
    this.localRig.root.rotation.y = this.playerYaw;

    const maxHp = this.bossState.maxHp;
    const stageHp =
      targetStage === 1
        ? maxHp
        : Math.max(120, Math.round(maxHp * ((8 - targetStage - 0.15) / 7)));

    this.bossState.active = true;
    this.bossState.hp = stageHp;
    this.bossState.stage = targetStage;
    this.bossCurrentStage = targetStage;
    this.bossState.immune = false;
    this.bossImmuneTimer = 0;
    this.bossCycleCount = 0;

    if (forceDescend) {
      this.bossState.resting = true;
      this.bossRestTimer = 8.5;
      this.bossPos.set(0, 75.0, -6);
      this.bossState.subtitle = `ATLAS STAGE ${targetStage}/7 · DESCENDED FOR MELEE SHOWCASE!`;
    } else {
      this.bossState.resting = false;
      this.bossRestTimer = 0;
      this.bossAttackTimer = 0.55;
      this.bossPos.set(0, 81.2, -10);
      const stageLabel = STAGE_LABELS[targetStage - 1] ?? `STAGE ${targetStage}`;
      this.bossState.subtitle = `ATLAS STAGE ${targetStage}/7 [${stageLabel}] · SHOWCASE ACTIVE`;
    }
    this.bossYaw = 0;

    if ((targetStage === 4 || targetStage === 7) && !this.enemies.some((e) => e.kind === 'drone' && e.hp > 0)) {
      this.createEnemy(`drone-adm-${Date.now()}-1`, 'drone', -12, 75, -8, -1, null);
      this.createEnemy(`drone-adm-${Date.now()}-2`, 'drone', 12, 75, -8, -1, null);
    }

    this.audio.playBossRoar();
    this.onNotice?.(`ADMIN: Warped to ATLAS Boss Fight (Stage ${targetStage}/7)`);
  }

  public adminForceBossDescend(): void {
    if (!this.running) return;
    if (!this.mp.isHost) {
      this.onNotice?.('Only the Co-Op Host can control boss state.');
      return;
    }
    if (this.phase !== 'boss_fight' || !this.bossState.active) {
      this.adminShowcaseBoss(1, true);
      return;
    }
    this.bossState.immune = false;
    this.bossImmuneTimer = 0;
    this.bossState.resting = true;
    this.bossRestTimer = 8.5;
    this.bossState.subtitle = 'ADMIN: ATLAS DESCENDED — MELEE DAMAGE WINDOW OPEN!';
    this.onNotice?.('ADMIN: ATLAS forced to deck level for melee showcase (8.5s).');
  }

  public adminGrantMaxGear(): void {
    if (!this.running) return;
    this.inventory.hasPickaxe = true;
    this.inventory.hasHatchet = true;
    this.inventory.hasBow = true;
    this.inventory.hasArmor = true;
    this.inventory.pickaxeTier = 3;
    this.inventory.hatchetTier = 3;
    this.inventory.armorTier = 3;
    this.inventory.arrows += 80;
    this.inventory.stims += 5;
    this.inventory.wood += 100;
    this.inventory.stone += 100;
    this.inventory.fiber += 100;
    this.inventory.metal += 50;
    this.inventory.refinedAlloy += 25;
    if (this.localRig) this.localRig.armorGroup.visible = true;
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.audio.playForge();
    this.onNotice?.('ADMIN: Tier-3 Max Gear, +80 Arrows, Full Shield & Showcase Resources Granted!');
  }

  public adminToggleGodMode(): boolean {
    this.adminGodMode = !this.adminGodMode;
    if (this.adminGodMode) {
      this.hp = this.maxHp;
      this.stamina = this.maxStamina;
    }
    this.onNotice?.(`ADMIN: God Mode ${this.adminGodMode ? 'ENABLED (Invulnerable)' : 'DISABLED'}`);
    return this.adminGodMode;
  }

  public requestPointerLock(): void {
    if (!this.running || this.paused || this.craftingOpen || this.adminOpen) return;
    const el = this.renderer?.domElement;
    if (el && document.pointerLockElement !== el) {
      try {
        void el.requestPointerLock();
      } catch {
        // ignore pointer lock restrictions
      }
    }
  }

  private bindInputs(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  private unbindInputs(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  private handleWindowBlur = (): void => {
    this.keys.clear();
    this.isAiming = false;
    this.bowDrawing = false;
    this.lastPointerPos = null;
  };

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    this.setGraphicsQuality(this.quality);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer?.domElement;
    this.lastPointerPos = null;
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.running) e.preventDefault();
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.running || this.paused || this.craftingOpen || this.adminOpen) return;
    if (Math.abs(e.deltaY) > 4) {
      this.cycleOwnedSlot(e.deltaY > 0 ? 1 : -1);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.running) return;
    const code = e.code;
    const key = e.key;

    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    this.keys.add(code);

    if (code === 'Backquote' || code === 'F8') {
      e.preventDefault();
      if (this.phase !== 'victory' && this.phase !== 'defeat') {
        this.adminOpen = !this.adminOpen;
        this.setAdminOpen(this.adminOpen);
        this.onToggleAdmin?.(this.adminOpen);
      }
      return;
    }

    if (code === 'KeyV') {
      e.preventDefault();
      if (this.phase !== 'victory' && this.phase !== 'defeat') {
        this.craftingOpen = !this.craftingOpen;
        this.setCraftingOpen(this.craftingOpen);
        this.onToggleCrafting?.(this.craftingOpen);
      }
      return;
    }

    if (code === 'Escape') {
      if (this.adminOpen) {
        this.adminOpen = false;
        this.onToggleAdmin?.(false);
        return;
      }
      if (this.craftingOpen) {
        this.craftingOpen = false;
        this.onToggleCrafting?.(false);
        return;
      }
      this.paused = !this.paused;
      this.setPaused(this.paused);
      this.onTogglePause?.(this.paused);
      return;
    }

    if (code === 'KeyM') {
      this.onMuteToggle?.();
      return;
    }

    if (this.paused || this.craftingOpen || this.adminOpen) return;

    if (key === '1' || code === 'Digit1' || code === 'Numpad1') this.selectSlot('pickaxe');
    else if (key === '2' || code === 'Digit2' || code === 'Numpad2') this.selectSlot('hatchet');
    else if (key === '3' || code === 'Digit3' || code === 'Numpad3') this.selectSlot('bow');
    else if (key === '4' || code === 'Digit4' || code === 'Numpad4') this.selectSlot('stim');
    else if ((code === 'ShiftLeft' || code === 'ShiftRight') && !e.repeat) {
      this.shiftDownAt = performance.now();
    } else if ((code === 'KeyC' || code === 'ControlLeft') && !e.repeat) {
      this.triggerDash();
    } else if (code === 'Space') {
      if (this.grounded && this.phase !== 'elevator_cutscene' && this.phase !== 'boss_wake') {
        this.playerVel.y = 9.8;
        this.grounded = false;
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    this.keys.delete(code);
    if ((code === 'ShiftLeft' || code === 'ShiftRight') && this.shiftDownAt > 0) {
      const heldMs = performance.now() - this.shiftDownAt;
      this.shiftDownAt = 0;
      if (heldMs < 190 && !this.paused && !this.craftingOpen && !this.adminOpen) {
        this.triggerDash();
      }
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.running || this.paused || this.craftingOpen || this.adminOpen) return;
    if (this.pointerLocked) {
      this.camYaw -= e.movementX * 0.0024;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0021, -0.35, 1.15);
      return;
    }
    // Simultaneous fallback look even without pointer lock (both dragging OR active cursor delta over canvas)
    const target = e.target as HTMLElement | null;
    if ((e.buttons & 7) !== 0 || target === this.renderer?.domElement) {
      const dx = this.lastPointerPos ? e.clientX - this.lastPointerPos.x : e.movementX;
      const dy = this.lastPointerPos ? e.clientY - this.lastPointerPos.y : e.movementY;
      const scale = (e.buttons & 7) !== 0 ? 0.0036 : 0.0022;
      if (Math.abs(dx) < 80 && Math.abs(dy) < 80) {
        this.camYaw -= dx * scale;
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * scale * 0.85, -0.35, 1.15);
      }
    }
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.running || this.paused || this.craftingOpen || this.adminOpen) return;
    const target = e.target as HTMLElement | null;
    if (target && target !== this.renderer.domElement) return;

    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    this.audio.unlock();
    if (!this.pointerLocked) {
      this.requestPointerLock();
    }

    if (this.phase === 'elevator_cutscene' || this.phase === 'boss_wake') return;

    if (e.button === 2) {
      this.isAiming = true;
    } else if (e.button === 0) {
      if (this.activeSlot === 'bow' && this.inventory.hasBow) {
        this.bowDrawing = true;
      } else {
        this.triggerMeleeAttack();
      }
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.isAiming = false;
    } else if (e.button === 0 && this.bowDrawing) {
      this.releaseBowArrow();
      this.bowDrawing = false;
      this.bowCharge = 0;
    }
  };

  private triggerDash(): void {
    if (
      this.dashCooldown > 0 ||
      this.stamina < 24 ||
      this.hp <= 0 ||
      this.phase === 'elevator_cutscene' ||
      this.phase === 'boss_wake'
    ) {
      return;
    }
    this.stamina -= 24;
    this.dashTimer = 0.24;
    this.dashCooldown = 0.85;
    this.iFrames = 0.48;

    const forwardX = -Math.sin(this.camYaw);
    const forwardZ = -Math.cos(this.camYaw);
    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    let mx = 0;
    let mz = 0;
    if (this.keys.has('KeyW')) { mx += forwardX; mz += forwardZ; }
    if (this.keys.has('KeyS')) { mx -= forwardX; mz -= forwardZ; }
    if (this.keys.has('KeyD')) { mx += rightX; mz += rightZ; }
    if (this.keys.has('KeyA')) { mx -= rightX; mz -= rightZ; }

    if (mx === 0 && mz === 0) {
      mx = forwardX;
      mz = forwardZ;
    }
    const len = Math.hypot(mx, mz) || 1;
    this.dashDir.set(mx / len, 0, mz / len);
    this.audio.playDash();
  }

  private triggerMeleeAttack(): void {
    if (
      this.attackCooldown > 0 ||
      this.hp <= 0 ||
      this.phase === 'elevator_cutscene' ||
      this.phase === 'boss_wake'
    ) {
      return;
    }
    this.attackCooldown = 0.38;
    this.attackSwingTimer = 0.32;
    this.attackCombo = (this.attackCombo + 1) % 4;
    this.audio.playSwing();

    const arch = CLONE_ARCHETYPES[this.archetype];
    const baseDmg =
      this.activeSlot === 'hatchet'
        ? 19 + (this.inventory.hatchetTier - 1) * 7
        : 15 + (this.inventory.pickaxeTier - 1) * 6;
    const comboMult = this.attackCombo === 3 ? 1.25 : 1.0;
    const dmg = Math.round(baseDmg * arch.meleeMult * comboMult);

    const lookDirX = -Math.sin(this.camYaw);
    const lookDirZ = -Math.cos(this.camYaw);
    this.playerYaw = Math.atan2(lookDirX, lookDirZ);

    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.kind === 'skywing' && Math.abs(en.y - (this.playerPos.y + 1.2)) > 3.6) continue;
      const dist = Math.hypot(en.x - this.playerPos.x, en.z - this.playerPos.z);
      if (dist <= 4.1 && Math.abs(en.y - this.playerPos.y) < 3.6) {
        this.applyDamageToEnemy(en.id, dmg);
        this.hitMarker = 1.0;
        this.audio.playHitEnemy();
      }
    }

    if (this.phase === 'boss_fight' && this.bossState.active) {
      const distBoss = Math.hypot(this.bossPos.x - this.playerPos.x, this.bossPos.z - this.playerPos.z);
      if (distBoss <= 6.8) {
        if (!this.bossState.resting && !this.bossState.immune) {
          this.onNotice?.('ATLAS hovers high! Use Recurve Bow now, or strike with Melee when it descends.');
        } else {
          this.applyDamageToBoss(dmg, true);
          this.hitMarker = 1.0;
          this.audio.playHitEnemy();
        }
      }
    }

    let hitNode = false;
    for (const node of this.resourceNodes) {
      if (node.depleted) continue;
      const reach = node.kind === 'alien_metal' ? 5.2 : 3.9;
      const dist = Math.hypot(node.x - this.playerPos.x, node.z - this.playerPos.z);
      if (dist <= reach && Math.abs(node.y - this.playerPos.y) < 4.0) {
        let harvestPower = 12;
        if ((node.kind === 'stone' || node.kind === 'alien_metal') && this.activeSlot === 'pickaxe') {
          harvestPower = 20 + (this.inventory.pickaxeTier - 1) * 10;
        } else if (node.kind === 'tree' && this.activeSlot === 'hatchet') {
          harvestPower = 20 + (this.inventory.hatchetTier - 1) * 10;
        }
        this.hitResourceNode(node, harvestPower);
        hitNode = true;
        break;
      }
    }

    // Feedback if striking unbreakable giant redwoods or boulders
    if (!hitNode) {
      for (const ob of this.staticObstacles) {
        if (!ob.unbreakableKind) continue;
        const d = Math.hypot(ob.x - this.playerPos.x, ob.z - this.playerPos.z);
        if (d < ob.radius + 2.4 && Math.abs(this.playerPos.y - ob.yMin) < 4.5) {
          this.audio.playMine();
          this.onNotice?.(`${ob.unbreakableKind} — Unbreakable Biosphere Landmark`);
          break;
        }
      }
    }
  }

  private releaseBowArrow(): void {
    if (this.inventory.arrows <= 0 || this.hp <= 0) {
      if (this.inventory.arrows <= 0) this.onNotice?.('Out of Arrows! Craft Fletched Arrows in Inventory [V].');
      return;
    }
    this.inventory.arrows -= 1;
    this.attackCombo = (this.attackCombo + 1) % 3;
    this.attackSwingTimer = 0.25;
    this.audio.playBowRelease();

    const power = 0.45 + this.bowCharge * 0.55;
    const speed = 38 + power * 26;
    const dir = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(-this.camPitch * 0.85 + 0.08, this.camYaw, 0, 'YXZ'))
      .normalize();

    const arrowGroup = buildArrowProjectileMesh();
    const startPos = this.playerPos.clone().add(new THREE.Vector3(0, 1.55, 0)).addScaledVector(dir, 0.85);
    arrowGroup.position.copy(startPos);
    this.scene.add(arrowGroup);

    const dmg = Math.round(20 + power * 18);
    this.arrows.push({
      mesh: arrowGroup,
      pos: startPos,
      vel: dir.multiplyScalar(speed),
      damage: dmg,
      life: 3.4,
    });
  }

  private hitResourceNode(node: ResourceNodeEntity, dmg: number): void {
    node.hp -= dmg;
    if (node.kind === 'tree') this.audio.playChop();
    else if (node.kind === 'stone' || node.kind === 'alien_metal') this.audio.playMine();
    else this.audio.playSwing();

    if (node.hp <= 0 && !node.depleted) {
      node.depleted = true;
      node.respawnTimer = 24;
      node.mesh.visible = false;

      const yieldMult = CLONE_ARCHETYPES[this.archetype].harvestMult;
      const amount = Math.round(3 * yieldMult);
      if (node.kind === 'tree') {
        this.inventory.wood += amount;
      } else if (node.kind === 'stone') {
        this.inventory.stone += amount;
      } else if (node.kind === 'fiber') {
        this.inventory.fiber += amount;
      } else {
        this.inventory.metal += Math.round(2 * yieldMult);
      }

      this.stats.resourcesHarvested += amount;
      this.mp.sendClientAction({ type: 'action_harvest', nodeId: node.id });
    }
  }

  private applyDamageToEnemy(enemyId: string, dmg: number): void {
    this.stats.damageDealt += dmg;
    if (this.mp.isHost) {
      const en = this.enemies.find((e) => e.id === enemyId);
      if (!en) return;
      en.hp -= dmg;
      if (en.hp <= 0) {
        const freedBeaconId = en.guardBeaconId;
        this.scene.remove(en.mesh);
        this.enemies = this.enemies.filter((e) => e.id !== enemyId);
        this.stats.enemiesDefeated += 1;

        if (freedBeaconId !== null) {
          this.refreshBeaconLocks(freedBeaconId);
        } else if (en.kind !== 'drone' && this.phase === 'jungle') {
          this.respawnQueue.push({
            id: `${en.id}-r${Date.now().toString(36)}`,
            kind: en.kind,
            homeX: en.homeX,
            homeY: en.homeY,
            homeZ: en.homeZ,
            platformIdx: en.platformIdx,
            timer: 28,
          });
        }
      }
    } else {
      this.mp.sendClientAction({ type: 'action_damage_enemy', enemyId, dmg });
    }
  }

  private refreshBeaconLocks(justClearedBeaconId?: number): void {
    for (const b of this.beacons) {
      const count = this.enemies.filter((e) => e.guardBeaconId === b.id && e.hp > 0).length;
      const wasLocked = b.locked;
      b.guardiansRemaining = count;
      b.locked = count > 0;
      if (wasLocked && !b.locked && b.id === justClearedBeaconId) {
        this.audio.playCraft();
        this.onNotice?.(`${b.label} Unlocked! Hold [E] to Repair.`);
      }
    }
  }

  private applyDamageToBoss(dmg: number, isMelee = false): void {
    if (this.bossState.immune) {
      this.onNotice?.('ATLAS Phase Shield Active — Immune during stage transition!');
      return;
    }
    const finalDmg = isMelee && this.bossState.resting ? Math.round(dmg * 1.45) : dmg;
    this.stats.damageDealt += finalDmg;
    if (this.mp.isHost) {
      this.bossState.hp = Math.max(0, this.bossState.hp - finalDmg);
      if (this.bossState.hp <= 0 && this.phase === 'boss_fight') {
        this.triggerVictory();
      }
    } else {
      this.mp.sendClientAction({ type: 'action_damage_boss', dmg: finalDmg });
    }
  }

  private bindNetworkCallbacks(): void {
    this.mp.onWorldSync = (world: WorldSyncPayload) => {
      if (this.mp.isHost) return;
      if (this.phase === 'jungle' && world.phase === 'elevator_ready') {
        this.audio.playBeaconRepaired();
      }
      if (this.isOnApexDeckPhase() && world.phase === 'elevator_ready') {
        this.playerPos.set(0, terrainHeightAt(0, 12.8), 12.8);
        this.spire.elevatorCabin.position.y = 1.5;
      }
      if (this.phase !== 'elevator_cutscene' && world.phase === 'elevator_cutscene') {
        this.beginElevatorCutscene();
      } else if (this.phase !== 'boss_wake' && world.phase === 'boss_wake') {
        this.beginBossWakeCutscene();
      } else if (this.phase !== 'boss_fight' && world.phase === 'boss_fight') {
        this.phase = 'boss_fight';
        this.playerPos.set(0, 75, 16);
      } else if (world.phase === 'victory') {
        this.phase = 'victory';
      } else if (world.phase !== 'elevator_cutscene' && world.phase !== 'boss_wake') {
        this.phase = world.phase;
      }

      this.beacons = world.beacons;
      this.bossState = world.boss;
      this.bossPos.set(world.bossPos.x, world.bossPos.y, world.bossPos.z);
      this.bossYaw = world.bossPos.yaw;

      const incomingIds = new Set(world.enemies.map((e) => e.id));
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (!incomingIds.has(this.enemies[i].id)) {
          this.scene.remove(this.enemies[i].mesh);
          this.enemies.splice(i, 1);
        }
      }
      for (const re of world.enemies) {
        let local = this.enemies.find((e) => e.id === re.id);
        if (!local) {
          local = this.createEnemy(re.id, re.kind, re.x, re.y, re.z, -1, re.guardBeaconId);
        }
        local.x = re.x;
        local.y = re.y;
        local.z = re.z;
        local.yaw = re.yaw;
        local.hp = re.hp;
        local.maxHp = re.maxHp;
        local.guardBeaconId = re.guardBeaconId;
      }

      const depletedSet = new Set(world.depletedNodes);
      for (const n of this.resourceNodes) {
        n.depleted = depletedSet.has(n.id);
        n.mesh.visible = !n.depleted;
      }

      this.syncClientTelegraphs(world.telegraphs);
    };

    this.mp.onClientAction = (msg) => {
      if (!this.mp.isHost) return;
      if (msg.type === 'action_harvest') {
        const n = this.resourceNodes.find((x) => x.id === msg.nodeId);
        if (n && !n.depleted) {
          n.depleted = true;
          n.respawnTimer = 24;
          n.mesh.visible = false;
        }
      } else if (msg.type === 'action_damage_enemy') {
        this.applyDamageToEnemy(msg.enemyId, msg.dmg);
      } else if (msg.type === 'action_damage_boss') {
        this.applyDamageToBoss(msg.dmg, false);
      } else if (msg.type === 'action_repair') {
        const b = this.beacons[msg.beaconId];
        if (b && !b.repaired && !b.locked) {
          b.woodDeposited = Math.min(b.woodRequired, b.woodDeposited + msg.wood);
          b.stoneDeposited = Math.min(b.stoneRequired, b.stoneDeposited + msg.stone);
          b.metalDeposited = Math.min(b.metalRequired, b.metalDeposited + msg.metal);
          b.progress = Math.min(100, b.progress + msg.amount);
          if (b.progress >= 100) {
            this.completeBeacon(b);
          }
        }
      } else if (msg.type === 'action_trigger_elevator') {
        if (this.phase === 'elevator_ready') {
          this.beginElevatorCutscene();
        }
      }
    };
  }

  private syncClientTelegraphs(remoteTelegraphs: WorldSyncPayload['telegraphs']): void {
    const ids = new Set(remoteTelegraphs.map((t) => t.id));
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      if (!ids.has(this.telegraphs[i].id)) {
        this.scene.remove(this.telegraphs[i].mesh);
        this.telegraphs[i].mesh.geometry.dispose();
        this.telegraphs[i].mat.dispose();
        this.telegraphs.splice(i, 1);
      }
    }
    for (const rt of remoteTelegraphs) {
      let existing = this.telegraphs.find((t) => t.id === rt.id);
      if (!existing) {
        existing = this.spawnTelegraphMesh(rt.id, rt.shape, rt.x, rt.z, rt.radius, rt.angle, rt.length, 1.2, 0);
      }
      existing.elapsed = rt.progress * existing.duration;
      existing.mat.opacity = 0.25 + rt.progress * 0.55;
    }
  }

  private scheduleNextTick(): void {
    if (!this.running) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!this.running) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (!this.paused) {
      this.updateGame(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private updateGame(dt: number): void {
    if (this.phase !== 'victory' && this.phase !== 'defeat') {
      this.stats.elapsedSeconds += dt;
    }

    if (this.earthMesh) this.earthMesh.rotation.y += dt * 0.015;
    if (this.gasPlanetMesh) this.gasPlanetMesh.rotation.y += dt * 0.01;
    if (this.skyCloudsGroup) this.skyCloudsGroup.rotation.y += dt * 0.004;
    if (this.ambientMotes) this.ambientMotes.rotation.y += dt * 0.008;

    this.pollGamepad(dt);
    this.updateLocalPlayer(dt);
    this.updateRemotePlayers(dt);
    this.updateResources(dt);
    this.updateBeaconsAndSpire(dt);
    this.updateArrows(dt);
    this.updateEnemyProjectiles(dt);

    if (this.mp.isHost) {
      this.updateEnemiesAI(dt);
      if (this.phase === 'boss_fight') {
        this.updateBossFightAI(dt);
      }
    } else {
      for (const en of this.enemies) {
        en.mesh.position.set(en.x, en.y, en.z);
        en.mesh.rotation.y = en.yaw;
      }
    }

    this.updateBossVisuals(dt);
    this.updateTelegraphs(dt);
    this.updateShockwaves(dt);
    this.updateCamera(dt);

    const remotePositions = new Map<string, { x: number; y: number; z: number }>();
    for (const m of this.mp.members.values()) {
      if (m.id !== this.mp.localId) {
        remotePositions.set(m.id, { x: m.x, y: m.y, z: m.z });
      }
    }
    this.audio.updateSpatialListener(this.playerPos.x, this.playerPos.y, this.playerPos.z, this.camYaw, remotePositions);

    this.netSyncAccum += dt;
    if (this.netSyncAccum >= 0.05) {
      this.netSyncAccum = 0;
      const mic = this.mp.sampleMicLevel();
      this.mp.sendLocalPlayerState({
        id: this.mp.localId,
        name: this.playerName,
        archetype: this.archetype,
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.playerYaw,
        hp: this.hp,
        maxHp: this.maxHp,
        stamina: this.stamina,
        isAlive: this.hp > 0,
        isSpeaking: mic.speaking,
        isMuted: this.mp.isMuted,
        hasArmor: this.inventory.hasArmor,
        activeSlot: this.activeSlot,
        isDashing: this.dashTimer > 0,
        isAttacking: this.attackSwingTimer > 0,
        attackCombo: this.attackCombo,
      });

      if (this.mp.isHost && !this.mp.isSolo) {
        this.mp.sendWorldState({
          phase: this.phase,
          beacons: this.beacons,
          boss: this.bossState,
          bossPos: { x: this.bossPos.x, y: this.bossPos.y, z: this.bossPos.z, yaw: this.bossYaw },
          enemies: this.enemies.map((e) => ({
            id: e.id,
            kind: e.kind,
            x: e.x,
            y: e.y,
            z: e.z,
            yaw: e.yaw,
            hp: e.hp,
            maxHp: e.maxHp,
            aggroRadius: e.aggroRadius,
            guardBeaconId: e.guardBeaconId,
          })),
          telegraphs: this.telegraphs.map((t) => ({
            id: t.id,
            shape: t.shape,
            x: t.x,
            z: t.z,
            radius: t.radius,
            angle: t.angle,
            length: t.length,
            progress: Math.min(1, t.elapsed / t.duration),
          })),
          depletedNodes: this.resourceNodes.filter((n) => n.depleted).map((n) => n.id),
        });
      }
    }

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.05) {
      this.hudSyncAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private pollGamepad(dt: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[0];
    if (!gp) return;
    if (Math.abs(gp.axes[2]) > 0.15) this.camYaw -= gp.axes[2] * dt * 2.5;
    if (Math.abs(gp.axes[3]) > 0.15) {
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + gp.axes[3] * dt * 1.8, -0.35, 1.15);
    }
    if (gp.buttons[0]?.pressed && this.grounded) {
      this.playerVel.y = 9.8;
      this.grounded = false;
    }
    if (gp.buttons[1]?.pressed) this.triggerDash();
    if (gp.buttons[7]?.pressed) {
      if (this.activeSlot === 'bow' && this.inventory.hasBow) this.bowDrawing = true;
      else this.triggerMeleeAttack();
    } else if (this.bowDrawing && !gp.buttons[7]?.pressed) {
      this.releaseBowArrow();
      this.bowDrawing = false;
      this.bowCharge = 0;
    }
  }

  private resolveSolidObstacles(pos: THREE.Vector3, entityRadius: number, isBossDeck: boolean): void {
    if (isBossDeck) {
      for (const cp of this.coverPillars) {
        if (cp.hp <= 0) continue;
        const dx = pos.x - cp.x;
        const dz = pos.z - cp.z;
        const minD = entityRadius + 1.3;
        const d = Math.hypot(dx, dz);
        if (d < minD && d > 0.001) {
          pos.x = cp.x + (dx / d) * minD;
          pos.z = cp.z + (dz / d) * minD;
        }
      }
      return;
    }

    const resolveList = (list: CollisionObstacle[]) => {
      for (const ob of list) {
        if (ob.nodeId) {
          const node = this.resourceNodes.find((n) => n.id === ob.nodeId);
          if (node?.depleted) continue;
        }
        if (pos.y + 1.6 < ob.yMin || pos.y > ob.yMax) continue;
        const dx = pos.x - ob.x;
        const dz = pos.z - ob.z;
        const minD = entityRadius + ob.radius;
        const d = Math.hypot(dx, dz);
        if (d < minD && d > 0.0001) {
          pos.x = ob.x + (dx / d) * minD;
          pos.z = ob.z + (dz / d) * minD;
        }
      }
    };

    resolveList(this.staticObstacles);
    resolveList(this.dynamicObstacles);
  }

  private isOnApexDeckPhase(): boolean {
    return (
      this.phase === 'boss_wake' ||
      this.phase === 'boss_fight' ||
      this.phase === 'victory' ||
      (this.phase === 'defeat' && this.playerPos.y > 40)
    );
  }

  private getFloorHeightAt(x: number, y: number, z: number): number {
    if (this.isOnApexDeckPhase()) return 75.0;
    let floor = terrainHeightAt(x, z);

    for (const ep of this.elevatedPlatforms) {
      // 1. Check main elevated top circular deck
      const distCenter = Math.hypot(x - ep.x, z - ep.z);
      if (distCenter <= ep.deckRadius + 0.3 && y >= ep.deckY - 2.2) {
        floor = Math.max(floor, ep.deckY);
        continue;
      }

      // 2. Check walkable ramps on BOTH -X and +X sides
      const adx = Math.abs(x - ep.x);
      const adz = Math.abs(z - ep.z);
      const rampStart = ep.deckRadius - 0.5;
      const rampEnd = rampStart + ep.rampLength + 0.6;
      if (adz <= ep.rampHalfWidth && adx >= rampStart && adx <= rampEnd) {
        const t = Math.max(0, Math.min(1, (adx - rampStart) / ep.rampLength));
        const rampY = ep.baseY + ep.heightDelta * (1 - t) - 0.15 * t;
        if (y >= rampY - 2.4) {
          floor = Math.max(floor, rampY);
        }
      }
    }
    return floor;
  }

  private updateLocalPlayer(dt: number): void {
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    this.hitMarker = Math.max(0, this.hitMarker - dt * 4.5);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);

    const arch = CLONE_ARCHETYPES[this.archetype];

    if (this.hp <= 0) {
      this.isSprinting = false;
      this.deathTimer += dt;
      const anyAliveRemote = Array.from(this.mp.members.values()).some(
        (m) => m.id !== this.mp.localId && m.isAlive,
      );
      if (anyAliveRemote) {
        if (this.deathTimer >= 8) {
          this.hp = Math.round(this.maxHp * 0.5);
          this.deathTimer = 0;
          this.iFrames = 2.0;
        }
      } else if (this.phase !== 'defeat' && this.phase !== 'victory') {
        this.phase = 'defeat';
        if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      }
      return;
    }

    if (arch.passiveRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + arch.passiveRegen * dt);
    }

    // Simultaneous Camera Look (Keyboard Arrow keys + Q/Z + Mouse Move + Pointer Lock)
    if (!this.craftingOpen && !this.paused && !this.adminOpen) {
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyQ')) this.camYaw += 2.3 * dt;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyZ')) this.camYaw -= 2.3 * dt;
      if (this.keys.has('ArrowUp')) this.camPitch = THREE.MathUtils.clamp(this.camPitch - 1.5 * dt, -0.35, 1.15);
      if (this.keys.has('ArrowDown')) this.camPitch = THREE.MathUtils.clamp(this.camPitch + 1.5 * dt, -0.35, 1.15);
    }

    if (this.phase === 'elevator_cutscene') {
      this.isSprinting = false;
      this.interactPrompt = null;
      this.interactProgress = 0;
      this.updateElevatorCutscene(dt);
      return;
    }

    if (this.phase === 'boss_wake') {
      this.isSprinting = false;
      this.interactPrompt = null;
      this.interactProgress = 0;
      this.updateBossWakeCutscene(dt);
      return;
    }

    if (this.bowDrawing && this.activeSlot === 'bow') {
      this.bowCharge = Math.min(1, this.bowCharge + dt * 1.2 * arch.bowSpeedMult);
    }

    let moveX = 0;
    let moveZ = 0;
    if (!this.craftingOpen && !this.paused && !this.adminOpen) {
      const fX = -Math.sin(this.camYaw);
      const fZ = -Math.cos(this.camYaw);
      const rX = Math.cos(this.camYaw);
      const rZ = -Math.sin(this.camYaw);

      if (this.keys.has('KeyW')) { moveX += fX; moveZ += fZ; }
      if (this.keys.has('KeyS')) { moveX -= fX; moveZ -= fZ; }
      if (this.keys.has('KeyD')) { moveX += rX; moveZ += rZ; }
      if (this.keys.has('KeyA')) { moveX -= rX; moveZ -= rZ; }

      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads[0];
      if (gp) {
        if (Math.abs(gp.axes[0]) > 0.15) { moveX += rX * gp.axes[0]; moveZ += rZ * gp.axes[0]; }
        if (Math.abs(gp.axes[1]) > 0.15) { moveX -= fX * gp.axes[1]; moveZ -= fZ * gp.axes[1]; }
      }
    }

    const moveLen = Math.hypot(moveX, moveZ);
    const isMoving = moveLen > 0.05;

    // -45% Slow Hazard Zones
    this.isSlowed = false;
    if (!this.isOnApexDeckPhase()) {
      for (const sz of SLOW_ZONES) {
        if (Math.hypot(this.playerPos.x - sz.x, this.playerPos.z - sz.z) <= sz.radius) {
          this.isSlowed = true;
          break;
        }
      }
    } else {
      for (const bf of this.bossSlowFields) {
        if (Math.hypot(this.playerPos.x - bf.x, this.playerPos.z - bf.z) <= bf.radius) {
          this.isSlowed = true;
          break;
        }
      }
    }

    this.nearForge =
      !this.isOnApexDeckPhase() &&
      Math.hypot(this.playerPos.x - FORGE_POS.x, this.playerPos.z - FORGE_POS.z) < 7.5;

    const wantsSprint =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      isMoving &&
      !this.isAiming &&
      !this.bowDrawing &&
      this.dashTimer <= 0;

    if (wantsSprint && this.stamina > 1.5) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - 18 * dt);
    } else {
      this.isSprinting = false;
      if (this.dashTimer <= 0) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 17 * dt);
      }
    }

    const slowMult = this.isSlowed ? 0.55 : 1.0;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.playerPos.x += this.dashDir.x * 24 * slowMult * dt;
      this.playerPos.z += this.dashDir.z * 24 * slowMult * dt;
    } else if (isMoving) {
      const baseSpeed = this.isAiming || this.bowDrawing ? 5.8 : this.isSprinting ? 14.5 : 9.8;
      const speed = baseSpeed * arch.speedMult * slowMult;
      const nx = moveX / moveLen;
      const nz = moveZ / moveLen;
      this.playerPos.x += nx * speed * dt;
      this.playerPos.z += nz * speed * dt;
      const targetYaw = Math.atan2(nx, nz);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 12);
    }

    if (this.isAiming || this.bowDrawing) {
      this.playerYaw = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    }

    const onBossDeck = this.isOnApexDeckPhase();
    this.resolveSolidObstacles(this.playerPos, 0.55, onBossDeck);

    // Check if standing on a metallic elevated platform/ramp for footstep sound
    let onMetalPlatform = false;
    if (!onBossDeck) {
      for (const ep of this.elevatedPlatforms) {
        if (this.playerPos.y > ep.baseY + 0.5 && Math.hypot(this.playerPos.x - ep.x, this.playerPos.z - ep.z) < ep.deckRadius + ep.rampLength) {
          onMetalPlatform = true;
          break;
        }
      }
    }

    if (isMoving && this.grounded && this.dashTimer <= 0) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.isSprinting ? 0.28 : 0.42;
        this.audio.playFootstep(onBossDeck || onMetalPlatform || this.nearForge, this.isSprinting);
      }
    } else {
      this.footstepTimer = 0.05;
    }

    // Vertical physics + smooth ramp/platform & post-victory deck clamping
    const floorY = this.getFloorHeightAt(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.playerVel.y -= 24 * dt;
    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= floorY) {
      this.playerPos.y = floorY;
      this.playerVel.y = 0;
      this.grounded = true;
    } else if (this.playerPos.y - floorY < 0.45 && this.playerVel.y <= 0) {
      this.playerPos.y = floorY;
      this.grounded = true;
    }

    if (onBossDeck) {
      const dist = Math.hypot(this.playerPos.x, this.playerPos.z);
      if (dist > 25.5) {
        this.playerPos.x = (this.playerPos.x / dist) * 25.5;
        this.playerPos.z = (this.playerPos.z / dist) * 25.5;
      }
    } else {
      const dist = Math.hypot(this.playerPos.x, this.playerPos.z);
      if (dist > 205) {
        this.playerPos.x = (this.playerPos.x / dist) * 205;
        this.playerPos.z = (this.playerPos.z / dist) * 205;
      }
      const inElevatorCorridor =
        this.phase === 'elevator_ready' && Math.abs(this.playerPos.x) < 2.5 && this.playerPos.z > 5.0;
      const minSpireR = inElevatorCorridor ? 5.6 : 9.4;
      if (dist < minSpireR && dist > 0.01) {
        this.playerPos.x = (this.playerPos.x / dist) * minSpireR;
        this.playerPos.z = (this.playerPos.z / dist) * minSpireR;
      }
    }

    this.updateInteractions(dt);

    this.animateRig(
      this.localRig,
      dt,
      isMoving,
      this.isSprinting,
      this.attackSwingTimer > 0,
      this.dashTimer > 0,
      this.activeSlot,
      this.attackCombo,
    );
    if (this.attackSwingTimer > 0) this.attackSwingTimer = Math.max(0, this.attackSwingTimer - dt);
    this.localRig.root.position.copy(this.playerPos);
    this.localRig.root.rotation.y = this.playerYaw;
  }

  private updateInteractions(dt: number): void {
    this.interactPrompt = null;
    this.interactProgress = 0;

    if (this.isOnApexDeckPhase() || this.phase === 'elevator_cutscene') return;

    const pressingE = this.keys.has('KeyE') || (navigator.getGamepads?.()[0]?.buttons[2]?.pressed ?? false);

    if (this.nearForge) {
      this.interactPrompt = 'FORGING STATION · Press [V] or [E] to Smelt Metal & Upgrade Gear';
      if (pressingE && !this.craftingOpen) {
        this.craftingOpen = true;
        this.setCraftingOpen(true);
        this.onToggleCrafting?.(true);
      }
      return;
    }

    if (this.phase === 'elevator_ready') {
      const distElev = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 7.8);
      if (distElev < 4.5) {
        this.interactPrompt = 'Press [E] to Ride Glass Elevator to ATLAS Command Deck';
        if (pressingE) {
          this.mp.sendClientAction({ type: 'action_trigger_elevator' });
          if (this.mp.isHost) this.beginElevatorCutscene();
        }
        return;
      }
    }

    if (this.phase === 'jungle') {
      for (const b of this.beacons) {
        if (b.repaired) continue;
        const dist = Math.hypot(this.playerPos.x - b.x, this.playerPos.z - b.z);
        if (dist < 5.0 && Math.abs(this.playerPos.y - b.y) < 3.8) {
          // Beacon cannot be taken/repaired until its Guardian Army is calmed!
          if (b.locked || b.guardiansRemaining > 0) {
            this.interactPrompt = `LOCKED · Calm ${b.guardiansRemaining} Beacon Guardian(s) nearby before taking ${b.label}!`;
            this.interactProgress = 0;
            return;
          }

          this.interactPrompt = `Hold [E] Repair ${b.label} (${Math.round(b.progress)}%) · Wood ${b.woodDeposited}/${b.woodRequired}, Stone ${b.stoneDeposited}/${b.stoneRequired}, Metal ${b.metalDeposited}/${b.metalRequired}`;
          this.interactProgress = b.progress / 100;
          if (pressingE) {
            const arch = CLONE_ARCHETYPES[this.archetype];
            let woodGive = 0;
            let stoneGive = 0;
            let metalGive = 0;
            const hasMats =
              (this.inventory.wood > 0 && b.woodDeposited < b.woodRequired) ||
              (this.inventory.stone > 0 && b.stoneDeposited < b.stoneRequired) ||
              (this.inventory.metal > 0 && b.metalDeposited < b.metalRequired);

            const stepRate = hasMats ? 24 : 11;
            const deltaProg = stepRate * arch.repairMult * dt;

            if (
              b.woodDeposited < b.woodRequired &&
              this.inventory.wood > 0 &&
              Math.floor((b.progress + deltaProg) / 16) > Math.floor(b.progress / 16)
            ) {
              this.inventory.wood -= 1;
              woodGive = 1;
            }
            if (
              b.stoneDeposited < b.stoneRequired &&
              this.inventory.stone > 0 &&
              Math.floor((b.progress + deltaProg) / 20) > Math.floor(b.progress / 20)
            ) {
              this.inventory.stone -= 1;
              stoneGive = 1;
            }
            if (
              b.metalDeposited < b.metalRequired &&
              this.inventory.metal > 0 &&
              Math.floor((b.progress + deltaProg) / 45) > Math.floor(b.progress / 45)
            ) {
              this.inventory.metal -= 1;
              metalGive = 1;
            }

            if (this.mp.isHost) {
              b.woodDeposited = Math.min(b.woodRequired, b.woodDeposited + woodGive);
              b.stoneDeposited = Math.min(b.stoneRequired, b.stoneDeposited + stoneGive);
              b.metalDeposited = Math.min(b.metalRequired, b.metalDeposited + metalGive);
              b.progress = Math.min(100, b.progress + deltaProg);
              if (b.progress >= 100) this.completeBeacon(b);
            } else {
              this.mp.sendClientAction({
                type: 'action_repair',
                beaconId: b.id,
                amount: deltaProg,
                wood: woodGive,
                stone: stoneGive,
                metal: metalGive,
              });
            }
          }
          return;
        }
      }

      for (const n of this.resourceNodes) {
        if (n.depleted) continue;
        const reach = n.kind === 'alien_metal' ? 4.8 : 3.6;
        const dist = Math.hypot(this.playerPos.x - n.x, this.playerPos.z - n.z);
        if (dist < reach && Math.abs(this.playerPos.y - n.y) < 3.5) {
          const label =
            n.kind === 'tree'
              ? 'Chop Tree (Wood only)'
              : n.kind === 'stone'
                ? 'Mine Rock (Stone only)'
                : n.kind === 'alien_metal'
                  ? 'Salvage Alien Metal Structure (Metal Scrap)'
                  : 'Gather Plant Fiber (Round Shrub)';
          this.interactPrompt = `Press [E] or Left-Click to ${label}`;
          if (pressingE && this.attackCooldown <= 0) {
            this.attackCooldown = 0.36;
            this.attackSwingTimer = 0.28;
            this.attackCombo = (this.attackCombo + 1) % 4;
            this.hitResourceNode(n, 22);
          }
          return;
        }
      }
    }
  }

  private completeBeacon(b: BeaconStatus): void {
    if (b.repaired) return;
    b.repaired = true;
    b.progress = 100;
    this.stats.beaconsRepaired = this.beacons.filter((x) => x.repaired).length;
    this.audio.playBeaconRepaired();

    if (this.beacons.every((x) => x.repaired)) {
      this.phase = 'elevator_ready';
      this.audio.speakAtlas('Warning. All seven biosphere beacons online. Central spire seal compromised.');
    }
  }

  private beginElevatorCutscene(): void {
    this.phase = 'elevator_cutscene';
    this.elevatorTimer = 0;
    this.interactPrompt = null;
    this.interactProgress = 0;
    this.playerPos.set(0, 1.8, 7.6);
    this.cutsceneLine = 'ATLAS: "Life-support restored. Move mouse or arrows to orbit 360° while ascending."';
    this.audio.speakAtlas('Life support restored. Unexpected for clone units.');
  }

  private updateElevatorCutscene(dt: number): void {
    this.elevatorTimer += dt;
    const t = Math.min(1, this.elevatorTimer / 8.0);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const cabinY = THREE.MathUtils.lerp(1.5, 75.0, eased);
    this.spire.elevatorCabin.position.y = cabinY;
    this.playerPos.set(0, cabinY + 0.2, 7.6);
    this.playerYaw = Math.PI;
    this.localRig.root.position.copy(this.playerPos);

    if (this.elevatorTimer > 2.6 && this.elevatorTimer < 5.4) {
      const line2 = 'ATLAS: "Earth is dormant. I engineered the biosphere to forge an orbital vanguard."';
      if (this.cutsceneLine !== line2) {
        this.cutsceneLine = line2;
        this.audio.speakAtlas('Earth is dormant. I engineered the biosphere to forge an orbital vanguard.');
      }
    } else if (this.elevatorTimer >= 5.4 && this.elevatorTimer < 8.0) {
      const line3 = 'ATLAS: "Approaching Apex Command Deck. Preparing containment protocols."';
      if (this.cutsceneLine !== line3) {
        this.cutsceneLine = line3;
        this.audio.speakAtlas('Approaching Apex Command Deck. Preparing containment protocols.');
      }
    }

    if (this.elevatorTimer >= 8.0) {
      this.beginBossWakeCutscene();
    }
  }

  private beginBossWakeCutscene(): void {
    this.phase = 'boss_wake';
    this.bossWakeTimer = 0;
    this.interactPrompt = null;
    this.interactProgress = 0;
    this.playerPos.set(0, 75.0, 16);
    this.localRig.root.position.copy(this.playerPos);
    this.bossPos.set(0, 75.0, -10);
    this.bossYaw = 0;
    this.cutsceneLine = 'ATLAS: "SYSTEM AWAKENING — YOU WILL BE CONTAINED AND CAPTURED!"';
    this.audio.playBossRoar();
    this.audio.speakAtlas('System awakening! I will capture every rogue clone on this deck!');
  }

  private updateBossWakeCutscene(dt: number): void {
    this.bossWakeTimer += dt;
    const liftT = Math.min(1, this.bossWakeTimer / 4.2);
    this.bossPos.y = THREE.MathUtils.lerp(75.0, 81.2, liftT);
    this.bossYaw = Math.sin(this.bossWakeTimer * 1.5) * 0.25;

    if (this.bossWakeTimer > 2.0 && this.bossWakeTimer < 2.1) {
      this.audio.playBossRoar();
    }

    if (this.bossWakeTimer >= 4.5) {
      this.phase = 'boss_fight';
      this.bossState.active = true;
      this.bossState.subtitle = 'ATLAS: "STAGE 1: CALIBRATION — Capture sequence initiated! Hit with Bow, or Melee when I descend!"';
      this.cutsceneLine = null;
      this.camYaw = 0;
      this.camPitch = 0.25;
    }
  }

  private updateRemotePlayers(dt: number): void {
    for (const m of this.mp.members.values()) {
      if (m.id === this.mp.localId) continue;
      let entry = this.remoteRigs.get(m.id);
      if (!entry) {
        const rig = buildCloneCharacter(m.archetype);
        rig.root.position.set(m.x, m.y, m.z);
        this.scene.add(rig.root);
        entry = { rig, targetPos: new THREE.Vector3(m.x, m.y, m.z), targetYaw: m.yaw };
        this.remoteRigs.set(m.id, entry);
      }
      entry.targetPos.set(m.x, m.y, m.z);
      entry.targetYaw = m.yaw;

      const prevX = entry.rig.root.position.x;
      const prevZ = entry.rig.root.position.z;
      entry.rig.root.position.lerp(entry.targetPos, Math.min(1, dt * 14));
      entry.rig.root.rotation.y = entry.targetYaw;
      entry.rig.armorGroup.visible = m.hasArmor;
      entry.rig.tools.pickaxe.visible = m.activeSlot === 'pickaxe';
      entry.rig.tools.hatchet.visible = m.activeSlot === 'hatchet';
      entry.rig.tools.bow.visible = m.activeSlot === 'bow';

      const moved = Math.hypot(entry.rig.root.position.x - prevX, entry.rig.root.position.z - prevZ) > 0.02;
      this.animateRig(entry.rig, dt, moved, false, m.isAttacking, m.isDashing, m.activeSlot, m.attackCombo || 0);
    }
  }

  private animateRig(
    rig: CharacterRig,
    dt: number,
    isMoving: boolean,
    isSprinting: boolean,
    isAttacking: boolean,
    isDashing: boolean,
    slot: ToolSlotId,
    combo: number,
  ): void {
    const strideFreq = isSprinting ? 0.013 : 0.008;
    const t = performance.now() * strideFreq;

    if (isMoving) {
      const amp = isSprinting ? 0.85 : 0.62;
      rig.leftLeg.rotation.x = Math.sin(t * 1.4) * amp;
      rig.rightLeg.rotation.x = -Math.sin(t * 1.4) * amp;
      rig.leftArm.rotation.x = -Math.sin(t * 1.4) * amp * 0.85;
    } else {
      rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0, 10, dt);
      rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0, 10, dt);
      rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0, 10, dt);
    }

    if (isAttacking) {
      const p = 1 - Math.min(1, this.attackSwingTimer / 0.32);
      const swingSin = Math.sin(p * Math.PI);

      if (slot === 'bow') {
        if (combo === 0) {
          rig.rightArm.rotation.set(-1.35, 0.25, 0);
          rig.leftArm.rotation.set(-1.4, -0.35, 0);
          rig.bodyPivot.rotation.y = 0.22;
        } else if (combo === 1) {
          rig.rightArm.rotation.set(-1.25, 0.1, -0.45);
          rig.leftArm.rotation.set(-1.3, -0.2, 0.35);
          rig.bodyPivot.rotation.y = -0.18;
        } else {
          rig.rightArm.rotation.set(-1.65 - swingSin * 0.3, 0, 0);
          rig.leftArm.rotation.set(-1.55, 0, 0);
          rig.bodyPivot.rotation.y = 0.1;
        }
      } else {
        const c = combo % 4;
        if (c === 0) {
          rig.rightArm.rotation.set(-2.3 + swingSin * 2.2, 0, 0);
          rig.bodyPivot.rotation.set(swingSin * 0.18, 0, 0);
        } else if (c === 1) {
          rig.rightArm.rotation.set(-1.3, -0.8 + swingSin * 1.9, -0.55);
          rig.bodyPivot.rotation.set(0.08, -0.4 + swingSin * 0.9, 0);
        } else if (c === 2) {
          rig.rightArm.rotation.set(-1.2, 0.9 - swingSin * 1.8, 0.55);
          rig.bodyPivot.rotation.set(0.08, 0.4 - swingSin * 0.9, 0);
        } else {
          rig.rightArm.rotation.set(-1.55, 0, -0.25);
          rig.leftArm.rotation.set(-1.1, 0, 0.4);
          rig.bodyPivot.rotation.set(0.24, swingSin * Math.PI * 2, 0);
        }
      }
    } else {
      rig.bodyPivot.rotation.y = THREE.MathUtils.damp(rig.bodyPivot.rotation.y, 0, 12, dt);
      if (this.bowDrawing && slot === 'bow') {
        rig.rightArm.rotation.set(-1.4, 0.25, 0);
        rig.leftArm.rotation.set(-1.45, -0.35, 0);
      } else if (isMoving) {
        rig.rightArm.rotation.set(Math.sin(t * 1.4) * (isSprinting ? 0.72 : 0.45), 0, 0);
      } else {
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0, 10, dt);
        rig.rightArm.rotation.y = THREE.MathUtils.damp(rig.rightArm.rotation.y, 0, 10, dt);
        rig.rightArm.rotation.z = THREE.MathUtils.damp(rig.rightArm.rotation.z, 0, 10, dt);
      }
    }

    const lean = isDashing ? 0.42 : isSprinting ? 0.18 : 0;
    if (!isAttacking) {
      rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, lean, 12, dt);
    }
  }

  private updateResources(dt: number): void {
    for (const n of this.resourceNodes) {
      if (n.depleted && this.mp.isHost) {
        n.respawnTimer -= dt;
        if (n.respawnTimer <= 0) {
          n.depleted = false;
          n.hp = n.maxHp;
          n.mesh.visible = true;
        }
      }
    }
  }

  private updateBeaconsAndSpire(dt: number): void {
    for (let i = 0; i < this.beacons.length; i++) {
      const b = this.beacons[i];
      const vis = this.beaconVisuals[i];
      const sh = this.beaconShields[i];
      if (sh) {
        sh.visible = b.locked && !b.repaired;
        if (sh.visible) sh.rotation.y += dt * 1.1;
      }
      if (!vis) continue;
      if (b.repaired) {
        vis.ring.rotation.y += dt * 2.5;
        vis.ring.rotation.z += dt * 1.4;
        vis.coreMat.color.setHex(0x06b6d4);
        vis.coreMat.emissive.setHex(0x06b6d4);
        vis.beamMat.color.setHex(0x22d3ee);
        vis.beamMat.opacity = 0.44;
      } else if (b.locked) {
        vis.ring.rotation.y += dt * 0.35;
        vis.coreMat.color.setHex(0xf59e0b);
        vis.coreMat.emissive.setHex(0xd97706);
        vis.beamMat.color.setHex(0xf59e0b);
        vis.beamMat.opacity = 0.2;
      } else {
        vis.ring.rotation.y += dt * 1.0;
        vis.coreMat.color.setHex(0x38bdf8);
        vis.coreMat.emissive.setHex(0x0284c7);
        vis.beamMat.color.setHex(0x38bdf8);
        vis.beamMat.opacity = 0.25 + Math.sin(performance.now() * 0.005 + i) * 0.06;
      }
    }

    if (
      this.phase === 'elevator_ready' ||
      this.phase === 'elevator_cutscene' ||
      this.phase === 'boss_wake' ||
      this.phase === 'boss_fight' ||
      this.phase === 'victory'
    ) {
      this.spire.doorLeft.position.x = THREE.MathUtils.damp(this.spire.doorLeft.position.x, -3.3, 4, dt);
      this.spire.doorRight.position.x = THREE.MathUtils.damp(this.spire.doorRight.position.x, 3.3, 4, dt);
      this.spire.doorLightMat.color.setHex(0x10b981);
      this.spire.doorLightMat.emissive.setHex(0x10b981);
    }
  }

  private updateArrows(dt: number): void {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vel.y -= 13.0 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.mesh.position.copy(a.pos);
      _vec3.copy(a.pos).add(a.vel);
      a.mesh.lookAt(_vec3);

      let hit = false;
      for (const en of this.enemies) {
        const hitHeightOffset = en.kind === 'skywing' ? 0.3 : 1.25;
        const dist = Math.hypot(a.pos.x - en.x, a.pos.z - en.z);
        if (dist < (en.kind === 'skywing' ? 2.1 : 1.45) && Math.abs(a.pos.y - (en.y + hitHeightOffset)) < 2.0) {
          this.applyDamageToEnemy(en.id, a.damage);
          this.hitMarker = 1.0;
          this.audio.playHitEnemy();
          hit = true;
          break;
        }
      }

      if (!hit && this.phase === 'boss_fight' && this.bossState.active) {
        const distBoss = Math.hypot(a.pos.x - this.bossPos.x, a.pos.z - this.bossPos.z);
        if (distBoss < 4.2 && Math.abs(a.pos.y - (this.bossPos.y + 3.6)) < 4.2) {
          this.applyDamageToBoss(a.damage, false);
          this.hitMarker = 1.0;
          this.audio.playHitEnemy();
          hit = true;
        }
      }

      const floorY = this.isOnApexDeckPhase() ? 75.0 : terrainHeightAt(a.pos.x, a.pos.z);
      if (hit || a.life <= 0 || a.pos.y <= floorY) {
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  private updateEnemyProjectiles(dt: number): void {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      const dPlayer = p.pos.distanceTo(
        _vec3.set(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z),
      );
      if (dPlayer < 1.35 && this.hp > 0) {
        this.damageLocalPlayer(p.damage);
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0 || p.pos.y <= terrainHeightAt(p.pos.x, p.pos.z)) {
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private updateEnemiesAI(dt: number): void {
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const task = this.respawnQueue[i];
      task.timer -= dt;
      if (task.timer <= 0) {
        this.createEnemy(task.id, task.kind, task.homeX, task.homeY, task.homeZ, task.platformIdx, null);
        this.respawnQueue.splice(i, 1);
      }
    }

    const targets: Array<{ x: number; y: number; z: number; isLocal: boolean }> = [
      { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z, isLocal: true },
    ];
    for (const m of this.mp.members.values()) {
      if (m.id !== this.mp.localId && m.isAlive) {
        targets.push({ x: m.x, y: m.y, z: m.z, isLocal: false });
      }
    }

    const nowSec = performance.now() * 0.001;
    for (let idx = 0; idx < this.enemies.length; idx++) {
      const en = this.enemies[idx];
      en.attackCooldown = Math.max(0, en.attackCooldown - dt);
      en.lungeTimer = Math.max(0, en.lungeTimer - dt);

      let nearest = targets[0];
      let bestDist = Infinity;
      for (const t of targets) {
        if (en.kind !== 'skywing' && Math.abs(t.y - en.y) > 12) continue;
        const d = Math.hypot(t.x - en.x, t.z - en.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = t;
        }
      }

      // Soft mob-to-mob separation so armies fan out cleanly instead of stacking
      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < this.enemies.length; j++) {
        if (j === idx) continue;
        const other = this.enemies[j];
        if (Math.abs(other.y - en.y) > 3.5) continue;
        const sdx = en.x - other.x;
        const sdz = en.z - other.z;
        const sd = Math.hypot(sdx, sdz);
        if (sd < 2.6 && sd > 0.01) {
          const push = (2.6 - sd) / 2.6;
          sepX += (sdx / sd) * push * 4.5;
          sepZ += (sdz / sd) * push * 4.5;
        }
      }

      let isMoving = false;
      if (en.kind === 'skywing') {
        const angle = nowSec * 0.9 + idx * 1.4;
        const goalX = bestDist <= en.aggroRadius ? nearest.x + Math.cos(angle) * 8.5 : en.homeX + Math.cos(angle) * 14;
        const goalZ = bestDist <= en.aggroRadius ? nearest.z + Math.sin(angle) * 8.5 : en.homeZ + Math.sin(angle) * 14;
        const dx = goalX - en.x;
        const dz = goalZ - en.z;
        const distGoal = Math.hypot(dx, dz) || 1;
        const targetYaw = Math.atan2(dx, dz);
        en.yaw = this.smoothYaw(en.yaw, targetYaw, dt * 6);
        en.x += ((dx / distGoal) * en.speed + sepX * 0.3) * dt;
        en.z += ((dz / distGoal) * en.speed + sepZ * 0.3) * dt;
        const swoop = en.attackCooldown < 0.5 ? -1.4 : 0;
        en.y = terrainHeightAt(en.x, en.z) + 8.5 + swoop + Math.sin(nowSec * 3.2 + en.homeZ) * 0.9;

        const wL = en.mesh.getObjectByName('wingLeft');
        const wR = en.mesh.getObjectByName('wingRight');
        if (wL && wR) {
          const flap = Math.sin(nowSec * 9.5 + idx) * 0.55;
          wL.rotation.z = flap;
          wR.rotation.z = -flap;
        }

        if (bestDist <= en.aggroRadius && en.attackCooldown <= 0) {
          en.attackCooldown = 2.6;
          this.audio.playDinoAttack('skywing');
          const boltMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x2dd4bf }),
          );
          const start = new THREE.Vector3(en.x, en.y - 0.3, en.z);
          const aim = new THREE.Vector3(nearest.x - en.x, nearest.y + 1.0 - en.y, nearest.z - en.z).normalize();
          boltMesh.position.copy(start);
          this.scene.add(boltMesh);
          this.enemyProjectiles.push({
            mesh: boltMesh,
            pos: start,
            vel: aim.multiplyScalar(22),
            damage: en.damage,
            life: 2.5,
          });
        }
      } else {
        if (bestDist <= en.aggroRadius) {
          const dx = nearest.x - en.x;
          const dz = nearest.z - en.z;
          const targetYaw = Math.atan2(dx, dz);
          en.yaw = this.smoothYaw(en.yaw, targetYaw, dt * 8);

          // Raptor burst pounce when mid-range
          if (en.kind === 'raptor' && bestDist > 4.2 && bestDist < 10 && en.lungeTimer <= 0 && en.attackCooldown <= 0.2) {
            en.lungeTimer = 0.45;
          }
          const speedBoost = en.lungeTimer > 0 ? 1.45 : 1.0;

          if (bestDist > 2.3) {
            en.x += ((dx / bestDist) * en.speed * speedBoost + sepX) * dt;
            en.z += ((dz / bestDist) * en.speed * speedBoost + sepZ) * dt;
            isMoving = true;
          } else if (en.attackCooldown <= 0) {
            en.attackCooldown = 1.45;
            this.audio.playDinoAttack(en.kind);
            if (nearest.isLocal) {
              this.damageLocalPlayer(en.damage);
            }
          }
        } else {
          const patrolR = en.platformIdx >= 0 ? 3.8 : 9.5;
          const tx = en.homeX + Math.cos(nowSec * 0.65 + idx * 1.9) * patrolR;
          const tz = en.homeZ + Math.sin(nowSec * 0.65 + idx * 1.9) * patrolR;
          const dx = tx - en.x;
          const dz = tz - en.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.5) {
            en.yaw = this.smoothYaw(en.yaw, Math.atan2(dx, dz), dt * 5);
            en.x += ((dx / d) * (en.speed * 0.52) + sepX * 0.4) * dt;
            en.z += ((dz / d) * (en.speed * 0.52) + sepZ * 0.4) * dt;
            isMoving = true;
          }
        }

        if (en.platformIdx >= 0) {
          const ep = this.elevatedPlatforms[en.platformIdx];
          const dPlat = Math.hypot(en.x - ep.x, en.z - ep.z);
          if (dPlat > ep.deckRadius - 1.1) {
            en.x = ep.x + ((en.x - ep.x) / dPlat) * (ep.deckRadius - 1.1);
            en.z = ep.z + ((en.z - ep.z) / dPlat) * (ep.deckRadius - 1.1);
          }
          en.y = ep.deckY;
        } else if (en.kind !== 'drone') {
          _vec3.set(en.x, en.y, en.z);
          this.resolveSolidObstacles(_vec3, 0.7, false);
          en.x = _vec3.x;
          en.z = _vec3.z;
          en.y = terrainHeightAt(en.x, en.z);
        }

        // Stride & head-bob animation
        const legL = en.mesh.getObjectByName('legL');
        const legR = en.mesh.getObjectByName('legR');
        const dHead = en.mesh.getObjectByName('dinoHead');
        if (legL && legR) {
          const s = isMoving ? Math.sin(nowSec * 10 + idx) * 0.45 : 0;
          legL.rotation.x = s;
          legR.rotation.x = -s;
        }
        if (dHead) {
          dHead.rotation.x = en.attackCooldown > 1.1 ? 0.35 : Math.sin(nowSec * 4 + idx) * 0.08;
        }
      }

      en.mesh.position.set(en.x, en.y, en.z);
      en.mesh.rotation.y = en.yaw;
    }
  }

  private smoothYaw(current: number, target: number, step: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * Math.min(1, step);
  }

  private updateBossFightAI(dt: number): void {
    if (!this.bossState.active || this.phase !== 'boss_fight') return;

    const hpRatio = this.bossState.hp / this.bossState.maxHp;
    const computedStage = Math.min(7, Math.max(1, 8 - Math.ceil(hpRatio * 7)));

    if (computedStage > this.bossCurrentStage) {
      this.bossCurrentStage = computedStage;
      this.bossState.stage = computedStage;
      this.bossState.immune = true;
      this.bossState.resting = false;
      this.bossImmuneTimer = 2.8;
      this.audio.playBossRoar();
      const stageLabel = STAGE_LABELS[computedStage - 1] ?? `STAGE ${computedStage}`;
      this.bossState.subtitle = `ATLAS STAGE ${computedStage}/7 [${stageLabel}] · PHASE SHIELD IMMUNE!`;
      this.audio.speakAtlas(`Entering stage ${computedStage}. ${stageLabel}.`);

      if (computedStage === 4 || computedStage === 7) {
        this.createEnemy(`drone-s${computedStage}-1`, 'drone', -12, 75, -8, -1, null);
        this.createEnemy(`drone-s${computedStage}-2`, 'drone', 12, 75, -8, -1, null);
      }
    }

    if (this.bossState.immune) {
      this.bossImmuneTimer -= dt;
      this.bossPos.y = THREE.MathUtils.damp(this.bossPos.y, 82.0, 5, dt);
      if (this.bossImmuneTimer <= 0) {
        this.bossState.immune = false;
        this.bossState.resting = true;
        this.bossRestTimer = 5.5;
        this.bossState.subtitle = `STAGE ${this.bossState.stage}/7 · SHIELD DOWN · ATLAS DESCENDING (MELEE WINDOW)!`;
      }
      return;
    }

    if (this.bossState.resting) {
      this.bossRestTimer -= dt;
      this.bossPos.y = THREE.MathUtils.damp(this.bossPos.y, 75.0, 6, dt);
      if (this.bossRestTimer <= 0) {
        this.bossState.resting = false;
        this.bossAttackTimer = 1.6;
        this.bossState.subtitle = `ATLAS: "Ascending! Energy containment protocols resumed!"`;
      }
      return;
    }

    this.bossPos.y = THREE.MathUtils.damp(this.bossPos.y, 81.2, 5, dt);
    const orbitTime = performance.now() * 0.00042;
    this.bossPos.x = Math.sin(orbitTime) * 7.5;
    this.bossPos.z = Math.cos(orbitTime * 0.8) * 7.5 - 3;
    this.bossYaw = Math.atan2(this.playerPos.x - this.bossPos.x, this.playerPos.z - this.bossPos.z);

    this.bossAttackTimer -= dt;
    if (this.bossAttackTimer <= 0) {
      this.bossCycleCount += 1;
      if (this.bossCycleCount % 5 === 0) {
        this.bossState.resting = true;
        this.bossRestTimer = 6.2;
        this.bossState.subtitle = 'SYSTEM: "ATLAS Venting Heat! Descended to Deck — Strike with Melee Now!"';
        return;
      }

      const stage = this.bossState.stage;
      const cadence = Math.max(1.55, 3.0 - stage * 0.22);
      this.bossAttackTimer = cadence;
      this.audio.playBossTelegraph();

      const lineDuration = stage >= 3 ? 1.0 : 1.5;
      const baseAng = Math.atan2(this.playerPos.x - this.bossPos.x, this.playerPos.z - this.bossPos.z);
      const uid = `${Date.now()}-${this.bossCycleCount}`;

      if (stage === 1) {
        if (this.bossCycleCount % 2 === 0) {
          this.spawnTelegraphMesh(`tel-${uid}-l`, 'line', this.bossPos.x, this.bossPos.z, 2.2, baseAng, 34, lineDuration, 20);
        } else {
          this.spawnTelegraphMesh(`tel-${uid}-c`, 'circle', this.playerPos.x, this.playerPos.z, 5.2, 0, 0, 1.45, 22);
        }
      } else if (stage === 2) {
        this.spawnTelegraphMesh(`tel-${uid}-l1`, 'line', this.bossPos.x, this.bossPos.z, 2.1, baseAng - 0.28, 36, lineDuration, 22);
        this.spawnTelegraphMesh(`tel-${uid}-l2`, 'line', this.bossPos.x, this.bossPos.z, 2.1, baseAng + 0.28, 36, lineDuration, 22);
        this.spawnTelegraphMesh(`tel-${uid}-c`, 'circle', this.playerPos.x, this.playerPos.z, 4.6, 0, 0, 1.4, 22);
      } else if (stage === 3) {
        this.spawnTelegraphMesh(`tel-${uid}-l1`, 'line', this.bossPos.x, this.bossPos.z, 2.3, baseAng, 38, 1.0, 24);
        this.spawnTelegraphMesh(`tel-${uid}-c`, 'circle', this.playerPos.x, this.playerPos.z, 4.8, 0, 0, 1.35, 24);
      } else if (stage === 4) {
        for (let k = 0; k < 4; k++) {
          this.spawnTelegraphMesh(
            `tel-${uid}-x${k}`,
            'line',
            this.bossPos.x,
            this.bossPos.z,
            2.0,
            baseAng + (k * Math.PI) / 2,
            38,
            1.0,
            24,
          );
        }
      } else if (stage === 5) {
        this.spawnShockwaveRing(this.bossPos.x, this.bossPos.z, 25, 22);
        this.spawnBossSlowField(this.playerPos.x, this.playerPos.z, 7.0);
        this.spawnTelegraphMesh(`tel-${uid}-l`, 'line', this.bossPos.x, this.bossPos.z, 2.2, baseAng, 38, 1.0, 24);
      } else if (stage === 6) {
        for (let k = -1; k <= 1; k++) {
          this.spawnTelegraphMesh(
            `tel-${uid}-b${k}`,
            'line',
            this.bossPos.x,
            this.bossPos.z,
            2.1,
            baseAng + k * 0.42,
            38,
            1.0,
            25,
          );
        }
        this.spawnTelegraphMesh(`tel-${uid}-m1`, 'circle', this.playerPos.x, this.playerPos.z, 4.5, 0, 0, 1.25, 25);
      } else {
        for (let k = 0; k < 4; k++) {
          this.spawnTelegraphMesh(
            `tel-${uid}-f${k}`,
            'line',
            this.bossPos.x,
            this.bossPos.z,
            2.2,
            this.bossCycleCount * 0.5 + (k * Math.PI) / 2,
            38,
            1.0,
            26,
          );
        }
        this.spawnShockwaveRing(this.bossPos.x, this.bossPos.z, 26, 22);
        this.spawnTelegraphMesh(`tel-${uid}-fm`, 'circle', this.playerPos.x, this.playerPos.z, 4.8, 0, 0, 1.2, 26);
      }
    }
  }

  private spawnShockwaveRing(x: number, z: number, maxRadius: number, damage: number): void {
    const geo = new THREE.RingGeometry(0.8, 1.6, 36);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 75.15, z);
    this.scene.add(mesh);
    this.shockwaves.push({
      x,
      z,
      radius: 1.2,
      maxRadius,
      speed: 14.5,
      damage,
      hitPlayer: false,
      mesh,
      mat,
    });
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.mesh.scale.set(sw.radius, 1, sw.radius);
      sw.mat.opacity = Math.max(0, 0.8 * (1 - sw.radius / sw.maxRadius));

      if (!sw.hitPlayer && this.phase === 'boss_fight' && this.hp > 0) {
        const dPlayer = Math.hypot(this.playerPos.x - sw.x, this.playerPos.z - sw.z);
        const aboveWave = this.playerPos.y > 75.85;
        if (!aboveWave && Math.abs(dPlayer - sw.radius) < 1.35) {
          sw.hitPlayer = true;
          this.damageLocalPlayer(sw.damage);
        }
      }

      if (sw.radius >= sw.maxRadius) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mat.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.bossSlowFields.length - 1; i >= 0; i--) {
      const bf = this.bossSlowFields[i];
      bf.ttl -= dt;
      if (bf.ttl <= 0) {
        this.scene.remove(bf.mesh);
        bf.mesh.geometry.dispose();
        this.bossSlowFields.splice(i, 1);
      }
    }
  }

  private spawnBossSlowField(x: number, z: number, radius: number): void {
    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 75.07, z);
    this.scene.add(mesh);
    this.bossSlowFields.push({ x, z, radius, ttl: 6.5, mesh });
  }

  private spawnTelegraphMesh(
    id: string,
    shape: 'circle' | 'line',
    x: number,
    z: number,
    radius: number,
    angle: number,
    length: number,
    duration: number,
    damage: number,
  ): TelegraphZone {
    const geo =
      shape === 'circle'
        ? new THREE.CircleGeometry(radius, 28)
        : new THREE.PlaneGeometry(radius * 2, length);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: shape === 'circle' ? 0xf59e0b : 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    if (shape === 'circle') {
      mesh.position.set(x, 75.08, z);
    } else {
      mesh.position.set(x + Math.sin(angle) * (length * 0.5), 75.09, z + Math.cos(angle) * (length * 0.5));
      mesh.rotation.y = angle;
    }
    this.scene.add(mesh);

    const tel: TelegraphZone = { id, shape, x, z, radius, angle, length, elapsed: 0, duration, damage, mesh, mat };
    this.telegraphs.push(tel);
    return tel;
  }

  private updateTelegraphs(dt: number): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      t.mat.opacity = 0.24 + p * 0.68;

      if (t.elapsed >= t.duration) {
        if (this.phase === 'boss_fight' && this.hp > 0) {
          const hit = this.checkPlayerInTelegraph(t);
          if (hit) {
            this.damageLocalPlayer(t.damage);
          }
          for (const cp of this.coverPillars) {
            if (cp.hp <= 0) continue;
            if (Math.hypot(cp.x - t.x, cp.z - t.z) < t.radius + 1.5) {
              cp.hp -= 35;
              if (cp.hp <= 0) cp.mesh.visible = false;
            }
          }
        }
        this.audio.playBossImpact();
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mat.dispose();
        this.telegraphs.splice(i, 1);
      }
    }
  }

  private checkPlayerInTelegraph(t: TelegraphZone): boolean {
    if (this.iFrames > 0) return false;
    for (const cp of this.coverPillars) {
      if (cp.hp <= 0) continue;
      if (Math.hypot(this.playerPos.x - cp.x, this.playerPos.z - cp.z) < 2.2) {
        return false;
      }
    }

    if (t.shape === 'circle') {
      return Math.hypot(this.playerPos.x - t.x, this.playerPos.z - t.z) <= t.radius;
    } else {
      const dx = this.playerPos.x - t.x;
      const dz = this.playerPos.z - t.z;
      const dirX = Math.sin(t.angle);
      const dirZ = Math.cos(t.angle);
      const along = dx * dirX + dz * dirZ;
      const perp = Math.abs(dx * -dirZ + dz * dirX);
      return along >= 0 && along <= t.length && perp <= t.radius;
    }
  }

  private damageLocalPlayer(rawDmg: number): void {
    if (this.adminGodMode || this.iFrames > 0 || this.hp <= 0) return;
    const arch = CLONE_ARCHETYPES[this.archetype];
    const armorByTier = [0, 0.35, 0.48, 0.6][this.inventory.armorTier] ?? 0;
    const armorReduction = armorByTier + arch.armorBonus;
    const finalDmg = Math.max(2, Math.round(rawDmg * (1 - Math.min(0.75, armorReduction))));
    this.hp = Math.max(0, this.hp - finalDmg);
    this.damageFlash = 1.0;
    this.iFrames = 0.25;
    this.audio.playPlayerHurt();
  }

  private updateBossVisuals(dt: number): void {
    if (!this.bossVisual) return;
    this.bossVisual.group.position.set(
      this.bossPos.x,
      this.bossPos.y + Math.sin(performance.now() * 0.0025) * 0.35,
      this.bossPos.z,
    );
    this.bossVisual.group.rotation.y = this.bossYaw;

    const spin = this.bossState.resting ? 0.35 : 1.5 + this.bossState.stage * 0.45;
    this.bossVisual.ringOuter.rotation.x += dt * spin;
    this.bossVisual.ringMid.rotation.y += dt * spin * 1.3;
    this.bossVisual.ringInner.rotation.z += dt * spin * 1.8;

    this.bossVisual.shieldMesh.visible = this.bossState.immune;
    if (this.bossState.immune) {
      this.bossVisual.shieldMesh.rotation.y += dt * 1.6;
    }

    if (this.bossState.resting) {
      this.bossVisual.coreMat.color.setHex(0x22d3ee);
      this.bossVisual.coreMat.emissive.setHex(0x06b6d4);
      this.bossVisual.coreMat.emissiveIntensity = 3.2;
    } else if (this.bossState.immune) {
      this.bossVisual.coreMat.color.setHex(0xfbbf24);
      this.bossVisual.coreMat.emissive.setHex(0xf59e0b);
      this.bossVisual.coreMat.emissiveIntensity = 2.8;
    } else {
      this.bossVisual.coreMat.color.setHex(0xf97316);
      this.bossVisual.coreMat.emissive.setHex(0xea580c);
      this.bossVisual.coreMat.emissiveIntensity = 2.0;
    }
  }

  private triggerVictory(): void {
    this.phase = 'victory';
    this.bossState.active = false;
    this.bossState.hp = 0;
    this.bossState.subtitle = 'ATLAS: "Override accepted... core protocols deactivating..."';
    this.audio.playBeaconRepaired();
    this.audio.speakAtlas('Override accepted. Biosphere control transferred.');
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  private clampCameraAgainstStructures(target: THREE.Vector3, desired: THREE.Vector3): void {
    const steps = 8;
    const onDeck = this.isOnApexDeckPhase();
    let bestFraction = 1.0;

    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const sx = THREE.MathUtils.lerp(target.x, desired.x, f);
      const sy = THREE.MathUtils.lerp(target.y, desired.y, f);
      const sz = THREE.MathUtils.lerp(target.z, desired.z, f);

      let blocked = false;
      if (!onDeck) {
        if (sy < terrainHeightAt(sx, sz) + 0.35) blocked = true;
        if (!blocked && Math.hypot(sx, sz) < 9.1 && sy < 72.5) blocked = true;
        if (!blocked) {
          for (const ob of this.staticObstacles) {
            if (sy >= ob.yMin && sy <= ob.yMax && Math.hypot(sx - ob.x, sz - ob.z) < ob.radius + 0.35) {
              blocked = true;
              break;
            }
          }
        }
        if (!blocked) {
          for (const ob of this.dynamicObstacles) {
            if (ob.nodeId) {
              const node = this.resourceNodes.find((n) => n.id === ob.nodeId);
              if (node?.depleted) continue;
            }
            if (sy >= ob.yMin && sy <= ob.yMax && Math.hypot(sx - ob.x, sz - ob.z) < ob.radius + 0.35) {
              blocked = true;
              break;
            }
          }
        }
      } else {
        for (const cp of this.coverPillars) {
          if (cp.hp > 0 && sy <= 79.5 && Math.hypot(sx - cp.x, sz - cp.z) < 1.35) {
            blocked = true;
            break;
          }
        }
      }

      if (blocked) {
        bestFraction = Math.max(0.18, (s - 0.6) / steps);
        break;
      }
    }

    if (bestFraction < 1.0) {
      desired.lerpVectors(target, desired, bestFraction);
    }
  }

  private updateCamera(dt: number): void {
    const targetFov = this.isAiming || this.bowDrawing ? 48 : this.dashTimer > 0 ? 72 : this.isSprinting ? 67 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    if (this.phase === 'boss_wake') {
      _camTarget.set(this.bossPos.x, this.bossPos.y + 3.0, this.bossPos.z);
      _camDesired.set(0, 77.6, 18.5);
      this.camera.position.lerp(_camDesired, Math.min(1, dt * 6));
      this.camera.lookAt(_camTarget);
      return;
    }

    const shoulderOffset = this.isAiming || this.bowDrawing ? 1.15 : 0.75;
    const dist = this.phase === 'elevator_cutscene' ? 8.2 : this.isAiming || this.bowDrawing ? 3.5 : 5.8;

    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    _camTarget.set(
      this.playerPos.x + rightX * shoulderOffset,
      this.playerPos.y + 1.65,
      this.playerPos.z + rightZ * shoulderOffset,
    );

    const horizDist = Math.cos(this.camPitch) * dist;
    const vertDist = Math.sin(this.camPitch) * dist;
    const desiredX = _camTarget.x + Math.sin(this.camYaw) * horizDist;
    const desiredZ = _camTarget.z + Math.cos(this.camYaw) * horizDist;
    const camGround = this.isOnApexDeckPhase() ? 75.5 : terrainHeightAt(desiredX, desiredZ) + 0.65;

    _camDesired.set(desiredX, Math.max(camGround, _camTarget.y + vertDist), desiredZ);
    if (this.phase !== 'elevator_cutscene') {
      this.clampCameraAgainstStructures(_camTarget, _camDesired);
    }

    this.camera.position.lerp(_camDesired, Math.min(1, dt * 16));
    this.camera.lookAt(_camTarget);
  }

  private emitHudSnapshot(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    const projectedLabels: ProjectedLabel[] = [];
    for (const m of this.mp.members.values()) {
      if (m.id === this.mp.localId) continue;
      _projVec.set(m.x, m.y + 2.45, m.z);
      const dist = _projVec.distanceTo(this.playerPos);
      _projVec.project(this.camera);
      const visible = _projVec.z < 1 && _projVec.z > -1 && dist < 140;
      projectedLabels.push({
        id: m.id,
        name: m.name,
        archetype: m.archetype,
        screenX: (_projVec.x * 0.5 + 0.5) * w,
        screenY: (-_projVec.y * 0.5 + 0.5) * h,
        distance: dist,
        hp: m.hp,
        maxHp: m.maxHp,
        isSpeaking: this.audio.isRemoteSpeaking(m.id) || m.isSpeaking,
        visible,
      });
    }

    const enemyLabels: EnemyHudLabel[] = [];
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      const headOffset = en.kind === 'theropod' ? 3.8 : en.kind === 'skywing' ? 1.5 : en.kind === 'drone' ? 2.8 : 2.3;
      _projVec.set(en.x, en.y + headOffset, en.z);
      const dist = _projVec.distanceTo(this.playerPos);
      if (dist > 65) continue;
      _projVec.project(this.camera);
      const visible = _projVec.z > -1 && _projVec.z < 1;
      if (!visible) continue;
      const baseName =
        en.kind === 'theropod'
          ? 'Apex Theropod'
          : en.kind === 'skywing'
            ? 'Sky-Pteron (Use Bow)'
            : en.kind === 'drone'
              ? 'Security Drone'
              : 'Raptor';
      enemyLabels.push({
        id: en.id,
        name: en.guardBeaconId !== null ? `${baseName} · Guardian` : baseName,
        screenX: (_projVec.x * 0.5 + 0.5) * w,
        screenY: (-_projVec.y * 0.5 + 0.5) * h,
        hp: en.hp,
        maxHp: en.maxHp,
        visible,
        guardBeaconId: en.guardBeaconId,
      });
    }

    const teammates = Array.from(this.mp.members.values())
      .filter((m) => m.id !== this.mp.localId)
      .map((m) => ({
        id: m.id,
        x: m.x,
        z: m.z,
        color: CLONE_ARCHETYPES[m.archetype].primaryHex,
      }));

    this.onHudUpdate?.({
      phase: this.phase,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      isSprinting: this.isSprinting,
      isSlowed: this.isSlowed,
      nearForge: this.nearForge,
      activeSlot: this.activeSlot,
      inventory: { ...this.inventory },
      bowCharge: this.bowCharge,
      isAiming: this.isAiming || this.bowDrawing,
      isDashing: this.dashTimer > 0,
      adminGodMode: this.adminGodMode,
      pointerLocked: this.pointerLocked,
      interactPrompt: this.interactPrompt,
      interactProgress: this.interactProgress,
      beacons: this.beacons.map((b) => ({ ...b })),
      boss: { ...this.bossState },
      cutsceneLine: this.cutsceneLine,
      renderResolutionLabel: this.renderResolutionLabel,
      minimapEntities: {
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerYaw: this.camYaw,
        forgeX: FORGE_POS.x,
        forgeZ: FORGE_POS.z,
        teammates,
        beacons: this.beacons.map((b) => ({
          id: b.id,
          x: b.x,
          y: b.y,
          z: b.z,
          repaired: b.repaired,
          isFloating: b.isFloating,
          locked: b.locked,
        })),
        enemies: this.enemies.map((e) => ({ x: e.x, z: e.z, isFlying: e.kind === 'skywing' })),
      },
      projectedLabels,
      enemyLabels,
      damageFlash: this.damageFlash,
      hitMarker: this.hitMarker,
      stats: { ...this.stats },
    });
  }

  public stopRun(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.audio.stopAmbient();
    this.audio.stopSpeech();
    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock();
    }
  }

  public dispose(): void {
    this.stopRun();
    this.unbindInputs();
    this.clearDynamicEntities();
    if (this.textures) {
      Object.values(this.textures).forEach((t) => t.dispose());
    }
    this.renderer?.dispose();
  }
}
