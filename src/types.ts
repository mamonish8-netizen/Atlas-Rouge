export type CloneArchetypeId = 'tank' | 'assault' | 'ranger' | 'teknician' | 'medic';

export interface CloneArchetype {
  id: CloneArchetypeId;
  name: string;
  code: string;
  role: string;
  passiveLabel: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  meleeMult: number;
  speedMult: number;
  bowSpeedMult: number;
  repairMult: number;
  harvestMult: number;
  maxHpBonus: number;
  armorBonus: number;
  healPowerMult: number;
  passiveRegen: number;
}

export const CLONE_ARCHETYPES: Record<CloneArchetypeId, CloneArchetype> = {
  tank: {
    id: 'tank',
    name: 'Tank',
    code: 'TNK-01',
    role: 'Armored Juggernaut',
    passiveLabel: '+30% Max HP & +20% Armor Mitigation',
    primaryHex: '#f59e0b',
    secondaryHex: '#453224',
    accentHex: '#fde68a',
    primaryColor: 0xf59e0b,
    secondaryColor: 0x453224,
    accentColor: 0xfde68a,
    meleeMult: 1.05,
    speedMult: 0.96,
    bowSpeedMult: 1.0,
    repairMult: 1.0,
    harvestMult: 1.0,
    maxHpBonus: 0.3,
    armorBonus: 0.2,
    healPowerMult: 1.0,
    passiveRegen: 0,
  },
  assault: {
    id: 'assault',
    name: 'Assault',
    code: 'ASL-02',
    role: 'Close-Quarters Striker',
    passiveLabel: '+25% Melee & Hatchet Damage',
    primaryHex: '#dc2626',
    secondaryHex: '#1f2937',
    accentHex: '#fca5a5',
    primaryColor: 0xdc2626,
    secondaryColor: 0x1f2937,
    accentColor: 0xfca5a5,
    meleeMult: 1.25,
    speedMult: 1.04,
    bowSpeedMult: 1.0,
    repairMult: 1.0,
    harvestMult: 1.0,
    maxHpBonus: 0.05,
    armorBonus: 0,
    healPowerMult: 1.0,
    passiveRegen: 0,
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    code: 'RNG-03',
    role: 'Recon & Marksman',
    passiveLabel: '+18% Move Speed & +25% Bow Draw Speed',
    primaryHex: '#10b981',
    secondaryHex: '#a89068',
    accentHex: '#6ee7b7',
    primaryColor: 0x10b981,
    secondaryColor: 0xa89068,
    accentColor: 0x6ee7b7,
    meleeMult: 1.0,
    speedMult: 1.18,
    bowSpeedMult: 1.25,
    repairMult: 1.0,
    harvestMult: 1.0,
    maxHpBonus: 0,
    armorBonus: 0,
    healPowerMult: 1.0,
    passiveRegen: 0,
  },
  teknician: {
    id: 'teknician',
    name: 'Teknician',
    code: 'TEK-04',
    role: 'Biosphere Engineer',
    passiveLabel: '+30% Beacon Repair & +25% Resource Yield',
    primaryHex: '#06b6d4',
    secondaryHex: '#334155',
    accentHex: '#a5f3fc',
    primaryColor: 0x06b6d4,
    secondaryColor: 0x334155,
    accentColor: 0xa5f3fc,
    meleeMult: 1.0,
    speedMult: 1.0,
    bowSpeedMult: 1.0,
    repairMult: 1.3,
    harvestMult: 1.25,
    maxHpBonus: 0,
    armorBonus: 0,
    healPowerMult: 1.0,
    passiveRegen: 0,
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    code: 'MED-05',
    role: 'Bio-Support Specialist',
    passiveLabel: '+40% Stim Healing, Passive HP Regen & +2 Stims',
    primaryHex: '#e2e8f0',
    secondaryHex: '#0f766e',
    accentHex: '#5eead4',
    primaryColor: 0xe2e8f0,
    secondaryColor: 0x0f766e,
    accentColor: 0x5eead4,
    meleeMult: 1.0,
    speedMult: 1.05,
    bowSpeedMult: 1.0,
    repairMult: 1.1,
    harvestMult: 1.0,
    maxHpBonus: 0.1,
    armorBonus: 0.05,
    healPowerMult: 1.4,
    passiveRegen: 1.6,
  },
};

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type AppScreen = 'loading' | 'lobby' | 'playing';

export type GamePhase =
  | 'jungle'
  | 'elevator_ready'
  | 'elevator_cutscene'
  | 'boss_wake'
  | 'boss_fight'
  | 'victory'
  | 'defeat';

export type ToolSlotId = 'pickaxe' | 'hatchet' | 'bow' | 'stim';

export interface InventoryState {
  wood: number;
  stone: number;
  fiber: number;
  metal: number;
  refinedAlloy: number;
  arrows: number;
  stims: number;
  hasPickaxe: boolean;
  hasHatchet: boolean;
  hasBow: boolean;
  hasArmor: boolean;
  pickaxeTier: 1 | 2 | 3;
  hatchetTier: 1 | 2 | 3;
  armorTier: 0 | 1 | 2 | 3;
}

export interface CraftingRecipe {
  id: 'pickaxe' | 'hatchet' | 'bow' | 'arrows' | 'armor' | 'stim';
  name: string;
  category: 'Tool' | 'Weapon' | 'Ammo' | 'Armor' | 'Medical';
  description: string;
  cost: { wood: number; stone: number; fiber: number };
  oneTime: boolean;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'pickaxe',
    name: 'Stone Pickaxe',
    category: 'Tool',
    description: '2.2x rock & alien metal mining speed with 4-combo strikes.',
    cost: { wood: 4, stone: 3, fiber: 2 },
    oneTime: true,
  },
  {
    id: 'hatchet',
    name: 'Stone Hatchet',
    category: 'Weapon',
    description: '2.2x timber harvest speed and 4-hit melee cleave combo.',
    cost: { wood: 3, stone: 2, fiber: 3 },
    oneTime: true,
  },
  {
    id: 'bow',
    name: 'Wooden Bow',
    category: 'Weapon',
    description: 'Essential ranged weapon for flying Sky-Pterons & hovering ATLAS (+8 arrows).',
    cost: { wood: 5, stone: 0, fiber: 6 },
    oneTime: true,
  },
  {
    id: 'arrows',
    name: 'Arrow Bundle (x10)',
    category: 'Ammo',
    description: 'Craft 10 flint-tipped arrows for the Wooden Bow.',
    cost: { wood: 2, stone: 2, fiber: 2 },
    oneTime: false,
  },
  {
    id: 'armor',
    name: 'Hide & Bark Armor (Tier 1)',
    category: 'Armor',
    description: 'Reduces all incoming hazard & creature damage by 35%.',
    cost: { wood: 6, stone: 2, fiber: 8 },
    oneTime: true,
  },
  {
    id: 'stim',
    name: 'Bio-Fiber Med Patch',
    category: 'Medical',
    description: 'Restores 45 HP immediately when activated from hotbar slot 4.',
    cost: { wood: 0, stone: 0, fiber: 4 },
    oneTime: false,
  },
];

export interface PartyMember {
  id: string;
  name: string;
  archetype: CloneArchetypeId;
  ready: boolean;
  isHost: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  isAlive: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hasArmor: boolean;
  activeSlot: ToolSlotId;
  isDashing: boolean;
  isAttacking: boolean;
  attackCombo: number;
}

export interface BeaconStatus {
  id: number;
  label: string;
  x: number;
  y: number;
  z: number;
  isFloating: boolean;
  progress: number;
  repaired: boolean;
  woodDeposited: number;
  stoneDeposited: number;
  metalDeposited: number;
  woodRequired: number;
  stoneRequired: number;
  metalRequired: number;
}

export interface ProjectedLabel {
  id: string;
  name: string;
  archetype: CloneArchetypeId;
  screenX: number;
  screenY: number;
  distance: number;
  hp: number;
  maxHp: number;
  isSpeaking: boolean;
  visible: boolean;
}

export interface EnemyHudLabel {
  id: string;
  name: string;
  screenX: number;
  screenY: number;
  hp: number;
  maxHp: number;
  visible: boolean;
}

export interface BossHudState {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
  stage: number; // 1..7
  maxStages: number;
  immune: boolean;
  resting: boolean; // Descended & vulnerable to melee!
  subtitle: string;
  subtitleSpeaker: 'ATLAS' | 'SYSTEM';
}

export interface RunStats {
  elapsedSeconds: number;
  enemiesDefeated: number;
  beaconsRepaired: number;
  resourcesHarvested: number;
  damageDealt: number;
  revivesOrHeals: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  isSlowed: boolean;
  nearForge: boolean;
  activeSlot: ToolSlotId;
  inventory: InventoryState;
  bowCharge: number;
  isAiming: boolean;
  isDashing: boolean;
  pointerLocked: boolean;
  interactPrompt: string | null;
  interactProgress: number;
  beacons: BeaconStatus[];
  boss: BossHudState;
  cutsceneLine: string | null;
  renderResolutionLabel: string;
  minimapEntities: {
    playerX: number;
    playerZ: number;
    playerYaw: number;
    forgeX: number;
    forgeZ: number;
    teammates: Array<{ id: string; x: number; z: number; color: string }>;
    beacons: Array<{ id: number; x: number; y: number; z: number; repaired: boolean; isFloating: boolean }>;
    enemies: Array<{ x: number; z: number; isFlying: boolean }>;
  };
  projectedLabels: ProjectedLabel[];
  enemyLabels: EnemyHudLabel[];
  damageFlash: number;
  hitMarker: number;
  stats: RunStats;
}
