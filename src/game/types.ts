export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type GameOutcome = 'victory' | 'defeat' | null;
export type ActiveOverlay = 'none' | 'crafting' | 'skills' | 'codex' | 'oracle';

export type DungeonThemeId =
  | 'obsidian_catacombs'
  | 'ember_forge'
  | 'astral_sanctum'
  | 'blighted_crypt';

export interface DungeonTheme {
  id: DungeonThemeId;
  name: string;
  subtitle: string;
  voidBg: string;
  floorPrimary: string;
  floorSecondary: string;
  floorGrout: string;
  wallTop: string;
  wallFace: string;
  wallHighlight: string;
  accentColor: string;
  torchColor: string;
  ambientGlow: string;
  trapTypes: TrapKind[];
  materialBias: MaterialId;
}

export type RoomKind = 'entrance' | 'combat' | 'treasure' | 'trap_gauntlet' | 'boss';

export type TrapKind = 'spikes' | 'void_geyser' | 'shadow_snare';

export interface TrapEntity {
  id: string;
  kind: TrapKind;
  x: number;
  y: number;
  radius: number;
  cyclePeriod: number;
  phaseOffset: number;
  timer: number;
  state: 'idle' | 'telegraph' | 'active';
  damage: number;
  roomId: number;
  triggeredHitIds: Set<string>;
}

export type MaterialId = 'shadow_iron' | 'rift_shard' | 'ember_ash' | 'vital_essence';

export type MaterialInventory = Record<MaterialId, number>;

export interface MaterialNode {
  id: string;
  material: MaterialId;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  yieldAmount: number;
  roomId: number;
  hitFlash: number;
  harvested: boolean;
}

export interface PickupDrop {
  id: string;
  kind: 'soul' | 'material' | 'heart';
  material?: MaterialId;
  amount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DungeonRoom {
  id: number;
  kind: RoomKind;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  neighbors: number[];
  discovered: boolean;
  cleared: boolean;
  locked: boolean;
  pillars: Rect[];
  braziers: Array<{ x: number; y: number }>;
  enemyBudget: number;
  spawned: boolean;
}

export interface Corridor {
  fromRoomId: number;
  toRoomId: number;
  rect: Rect;
  horizontal: boolean;
}

export interface DungeonFloor {
  floorNumber: number;
  seed: number;
  theme: DungeonTheme;
  tileSize: number;
  rooms: DungeonRoom[];
  corridors: Corridor[];
  wallRects: Rect[];
  walkableRects: Rect[];
  entranceRoomId: number;
  exitRoomId: number;
  spawnX: number;
  spawnY: number;
  forgePos: { x: number; y: number };
  exitPos: { x: number; y: number };
  traps: TrapEntity[];
  nodes: MaterialNode[];
}

export type GearSlot = 'weapon' | 'armor' | 'consumable';

export interface CraftingRecipe {
  id: string;
  name: string;
  slot: GearSlot;
  description: string;
  statSummary: string;
  cost: Partial<MaterialInventory>;
  accent: string;
  weaponStats?: {
    bonusAttack: number;
    bonusCrit: number;
    reachMultiplier: number;
    essenceGainBonus: number;
    bladeColor: string;
    waveOnFinisher?: boolean;
  };
  armorStats?: {
    bonusMaxHp: number;
    damageReduction: number;
    moveSpeedBonus: number;
    bonusDashCharges: number;
    cloakColor: string;
  };
  consumableEffect?: {
    kind: 'flask' | 'aegis_ward' | 'fury_elixir';
    value: number;
    duration?: number;
  };
}

export type SkillBranch = 'combat' | 'magic' | 'utility';

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  tier: 1 | 2 | 3;
  column: number; // 0 = center, -1 = left sub-branch, 1 = right sub-branch
  name: string;
  kind: 'passive' | 'active';
  summary: string;
  prerequisites: string[];
  cost: number;
}

export interface DerivedSkillBonuses {
  attackMultiplier: number;
  critChanceBonus: number;
  critDamageMultiplier: number;
  whirlwindFinisher: boolean;
  bloodlustOnKill: boolean;
  executionerShockwave: boolean;
  essenceGainMultiplier: number;
  astralLanceUnlocked: boolean;
  novaRadiusMultiplier: number;
  novaDamageMultiplier: number;
  novaStunDuration: number;
  voidSingularity: boolean;
  moveSpeedMultiplier: number;
  dashCooldownMultiplier: number;
  shadowCloneOnDash: boolean;
  materialDropBonus: number;
  pickupMagnetMultiplier: number;
  bonusDashCharges: number;
  phaseStepDamage: boolean;
}

export type EnemyKind = 'stalker' | 'acolyte' | 'lancer' | 'sentinel' | 'boss_malakor';

export type EnemyState = 'idle' | 'move' | 'windup' | 'attack' | 'recover' | 'stunned' | 'dying';

export interface EnemyEntity {
  id: string;
  kind: EnemyKind;
  name: string;
  roomId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  facing: number;
  state: EnemyState;
  stateTimer: number;
  stateDuration: number;
  attackCooldown: number;
  hasToken: boolean;
  hitFlash: number;
  scaleX: number;
  scaleY: number;
  walkPhase: number;
  targetX: number;
  targetY: number;
  bossPhase?: 1 | 2;
  bossPatternIndex?: number;
  xpValue: number;
  scoreValue: number;
  deathTimer: number;
  strafeDir: number;
}

export interface ProjectileEntity {
  id: string;
  fromPlayer: boolean;
  kind: 'void_bolt' | 'astral_lance' | 'shadow_wave' | 'boss_orb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  pierce: boolean;
  hitIds: Set<string>;
}

export interface ShadowCloneEntity {
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  damage: number;
  radius: number;
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  isFinisher: boolean;
  isWhirlwind: boolean;
}

export interface NovaEffect {
  x: number;
  y: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
  drag: number;
}

export interface FloatingNumberSlot {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  outcome: GameOutcome;
  floorNumber: number;
  maxTargetFloor: number;
  themeName: string;
  themeAccent: string;
  hp: number;
  maxHp: number;
  ghostHp: number;
  shield: number;
  maxShield: number;
  essence: number;
  maxEssence: number;
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  unlockedSkills: string[];
  dashCharges: number;
  maxDashCharges: number;
  dashRechargeRatio: number;
  novaCost: number;
  novaCooldown: number;
  lanceUnlocked: boolean;
  lanceCost: number;
  lanceCooldown: number;
  flaskCharges: number;
  maxFlaskCharges: number;
  furyTimer: number;
  score: number;
  bestScore: number;
  bestFloor: number;
  kills: number;
  elapsedSeconds: number;
  materials: MaterialInventory;
  equippedWeaponId: string;
  equippedArmorId: string;
  craftedIds: string[];
  nearForge: boolean;
  nearExit: boolean;
  exitUnlocked: boolean;
  currentRoomKind: RoomKind;
  roomsCleared: number;
  totalCombatRooms: number;
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: 1 | 2;
  muted: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  hasMidRunSave: boolean;
  statusBanner: string;
  minimapRooms: Array<{
    id: number;
    kind: RoomKind;
    gridX: number;
    gridY: number;
    discovered: boolean;
    cleared: boolean;
    current: boolean;
    neighbors: number[];
  }>;
}
