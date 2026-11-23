import { ShadowRiftAudio } from './audio';
import {
  AttackTokenPool,
  applyXpGain,
  clamp,
  computeAttackDamage,
  computeSmartAimAngle,
  isPointInRect,
  moveWithDungeonCollision,
  normalizeAngle,
  xpRequiredForLevel,
} from './combatMath';
import {
  CRAFTING_RECIPES,
  INITIAL_MATERIALS,
  STARTER_ARMOR_ID,
  STARTER_WEAPON_ID,
  executeCraft,
  getRecipeById,
} from './crafting';
import { createRng, generateDungeonFloor } from './dungeonGen';
import { ShadowRiftScene3D } from './scene3d';
import { computeSkillBonuses, unlockSkill } from './skillTree';
import type {
  ActiveOverlay,
  DungeonFloor,
  DungeonRoom,
  EnemyEntity,
  EnemyKind,
  FloatingNumberSlot,
  GameOutcome,
  GamePhase,
  HudSnapshot,
  MaterialId,
  MaterialInventory,
  NovaEffect,
  PickupDrop,
  ProjectileEntity,
  ShadowCloneEntity,
  SlashEffect,
} from './types';

const STORAGE_KEY = 'shadow_rift_records_v1';
const MIDRUN_STORAGE_KEY = 'shadow_rift_midrun_v1';
const MAX_FLOATING = 64;
const TARGET_FINAL_FLOOR = 3; // Floor 3 hosts the climactic Sovereign confrontation (and players can keep descending endlessly!)

interface MidRunSaveData {
  floorNumber: number;
  seed: number;
  score: number;
  kills: number;
  elapsedSeconds: number;
  level: number;
  xp: number;
  skillPoints: number;
  unlockedSkills: string[];
  materials: MaterialInventory;
  equippedWeaponId: string;
  equippedArmorId: string;
  craftedIds: string[];
  flaskCharges: number;
  furyTimer: number;
  hp: number;
  maxHp: number;
  shield: number;
  essence: number;
  px: number;
  py: number;
}

interface SavedRecords {
  bestScore: number;
  bestFloor: number;
}

function loadRecords(): SavedRecords {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestScore: 0, bestFloor: 1 };
    const parsed = JSON.parse(raw) as Partial<SavedRecords>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestFloor: typeof parsed.bestFloor === 'number' ? parsed.bestFloor : 1,
    };
  } catch {
    return { bestScore: 0, bestFloor: 1 };
  }
}

function saveRecords(rec: SavedRecords): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    // Ignore storage quota errors
  }
}

export class ShadowRiftEngine {
  private container: HTMLDivElement;
  private scene3d: ShadowRiftScene3D;
  private domCanvas: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private cancelNextFrame: (() => void) | null = null;
  private lastTimestamp = 0;

  private audio = new ShadowRiftAudio();
  private tokenPool = new AttackTokenPool(3);
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onOverlayRequest: (overlay: ActiveOverlay) => void;

  // Game state
  private phase: GamePhase = 'title';
  private outcome: GameOutcome = null;
  private overlay: ActiveOverlay = 'none';
  private defeatDelayTimer = 0;
  private pendingDefeat = false;

  private floor!: DungeonFloor;
  private floorNumber = 1;
  private elapsedSeconds = 0;
  private simTime = 0;
  private hitstopTimer = 0;
  private trauma = 0;

  // Camera
  private cameraX = 0;
  private cameraY = 0;

  // Player state
  private px = 0;
  private py = 0;
  private pvx = 0;
  private pvy = 0;
  private pRadius = 16;
  private aimAngle = 0;
  private pScaleX = 1;
  private pScaleY = 1;
  private pWalkPhase = 0;
  private pHitFlash = 0;
  private pInvulnTimer = 0;
  private hp = 120;
  private maxHp = 120;
  private ghostHp = 120;
  private shield = 0;
  private maxShield = 60;
  private essence = 35;
  private maxEssence = 100;
  private level = 1;
  private xp = 0;
  private xpToNext = xpRequiredForLevel(1);
  private skillPoints = 1; // Start with 1 skill point so players can immediately invest in a branch!
  private unlockedSkills: string[] = [];

  // Gear & Crafting
  private materials: MaterialInventory = { ...INITIAL_MATERIALS };
  private craftedIds: string[] = [STARTER_WEAPON_ID, STARTER_ARMOR_ID];
  private equippedWeaponId = STARTER_WEAPON_ID;
  private equippedArmorId = STARTER_ARMOR_ID;
  private flaskCharges = 2;
  private maxFlaskCharges = 4;
  private furyTimer = 0;

  // Combat cooldowns & buffers
  private comboStep: 1 | 2 | 3 = 1;
  private comboResetTimer = 0;
  private attackCooldown = 0;
  private attackSwingTimer = 0;
  private attackBuffer = 0;

  private dashCharges = 2;
  private maxDashCharges = 2;
  private dashRechargeTimer = 0;
  private dashTimer = 0;
  private dashDirX = 1;
  private dashDirY = 0;
  private dashBuffer = 0;
  private dashHitIds = new Set<string>();
  private afterimages: Array<{ x: number; y: number; alpha: number; angle: number }> = [];

  private novaCooldown = 0;
  private lanceCooldown = 0;
  private slowTimer = 0;

  // Score & stats
  private score = 0;
  private bestScore = 0;
  private bestFloor = 1;
  private kills = 0;
  private statusBanner = '';
  private statusBannerTimer = 0;

  // Entities
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private pickups: PickupDrop[] = [];
  private clones: ShadowCloneEntity[] = [];
  private slashes: SlashEffect[] = [];
  private novas: NovaEffect[] = [];
  private floatingNumbers: FloatingNumberSlot[] = [];
  private floatingCursor = 0;
  private idCounter = 1;

  // Input hub (held vs edge-triggered + Android virtual touch inputs)
  private keysHeld = new Set<string>();
  private pointerClientX = 640;
  private pointerClientY = 360;
  private pointerWorldX = 0;
  private pointerWorldY = 0;
  private mouseLeftHeld = false;
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualAttackHeld = false;
  private touchInputActive = false;
  private lastFrameDt = 1 / 60;

  // Throttled HUD emitter
  private hudEmitAccum = 0;

  constructor(
    container: HTMLDivElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onOverlayRequest: (overlay: ActiveOverlay) => void
  ) {
    this.container = container;
    this.scene3d = new ShadowRiftScene3D(container);
    this.domCanvas = this.scene3d.getDomElement();
    this.onHudUpdate = onHudUpdate;
    this.onOverlayRequest = onOverlayRequest;

    const saved = loadRecords();
    this.bestScore = saved.bestScore;
    this.bestFloor = saved.bestFloor;

    for (let i = 0; i < MAX_FLOATING; i++) {
      this.floatingNumbers.push({
        active: false,
        x: 0,
        y: 0,
        vy: -38,
        text: '',
        color: '#fff',
        scale: 1,
        life: 0,
        maxLife: 0.75,
      });
    }

    this.resetRunState();
    this.bindEvents();
    this.handleResize();
    this.emitHud(true);
    this.syncLoopState();
  }

  public focusCanvas(): void {
    this.domCanvas.focus();
  }

  public destroy(): void {
    this.stopLoop();
    this.audio.destroy();
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.domCanvas.removeEventListener('mousemove', this.handleMouseMove);
    this.domCanvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.domCanvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.scene3d.dispose();
  }

  public setOverlay(next: ActiveOverlay): void {
    this.overlay = next;
    this.clearInputs();
    this.needsStaticRedraw = true;
    this.syncLoopState();
    this.emitHud(true);
  }

  public startNewRun(): void {
    this.clearMidRunSave();
    this.resetRunState();
    this.phase = 'playing';
    this.outcome = null;
    this.overlay = 'none';
    this.onOverlayRequest('none');
    document.body.dataset.state = 'playing';
    this.clearInputs();
    this.audio.setAmbientTheme(this.floor.theme.id);
    this.audio.resumeAmbient();
    this.showBanner(`${this.floor.theme.name} — ${this.floor.theme.subtitle}`);
    this.needsStaticRedraw = true;
    this.syncLoopState();
    this.emitHud(true);
  }

  public continueEndless(): void {
    this.phase = 'playing';
    this.outcome = null;
    this.overlay = 'none';
    this.onOverlayRequest('none');
    document.body.dataset.state = 'playing';
    this.descendToNextFloor();
    this.audio.resumeAmbient();
    this.syncLoopState();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      if (this.overlay !== 'none') {
        this.overlay = 'none';
        this.onOverlayRequest('none');
        this.syncLoopState();
        this.emitHud(true);
        return;
      }
      this.phase = 'paused';
      document.body.dataset.state = 'paused';
      this.audio.pauseAmbient();
      this.saveMidRun();
      this.clearInputs();
      this.needsStaticRedraw = true;
      this.syncLoopState();
      this.emitHud(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      document.body.dataset.state = 'playing';
      this.audio.resumeAmbient();
      this.clearInputs();
      this.syncLoopState();
      this.emitHud(true);
    }
  }

  public resumeGame(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      document.body.dataset.state = 'playing';
      this.audio.resumeAmbient();
      this.clearInputs();
      this.syncLoopState();
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.saveMidRun();
    this.audio.stopAmbient();
    this.phase = 'title';
    this.outcome = null;
    this.overlay = 'none';
    this.onOverlayRequest('none');
    document.body.dataset.state = 'title';
    this.clearInputs();
    this.syncLoopState();
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    const muted = this.audio.toggleMute();
    this.emitHud(true);
    return muted;
  }

  public getMasterVolume(): number {
    return this.audio.getMasterVolume();
  }

  public setMasterVolume(v: number): void {
    this.audio.setMasterVolume(v);
    this.emitHud(true);
  }

  public getSfxVolume(): number {
    return this.audio.getSfxVolume();
  }

  public setSfxVolume(v: number): void {
    this.audio.setSfxVolume(v);
    this.emitHud(true);
  }

  public getMusicVolume(): number {
    return this.audio.getMusicVolume();
  }

  public setMusicVolume(v: number): void {
    this.audio.setMusicVolume(v);
    this.emitHud(true);
  }

  public hasMidRunSave(): boolean {
    try {
      return Boolean(localStorage.getItem(MIDRUN_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  public saveMidRun(): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    if (this.pendingDefeat || this.hp <= 0) return;
    try {
      const data: MidRunSaveData = {
        floorNumber: this.floorNumber,
        seed: this.floor.seed,
        score: this.score,
        kills: this.kills,
        elapsedSeconds: this.elapsedSeconds,
        level: this.level,
        xp: this.xp,
        skillPoints: this.skillPoints,
        unlockedSkills: [...this.unlockedSkills],
        materials: { ...this.materials },
        equippedWeaponId: this.equippedWeaponId,
        equippedArmorId: this.equippedArmorId,
        craftedIds: [...this.craftedIds],
        flaskCharges: this.flaskCharges,
        furyTimer: this.furyTimer,
        hp: this.hp,
        maxHp: this.maxHp,
        shield: this.shield,
        essence: this.essence,
        px: this.px,
        py: this.py,
      };
      localStorage.setItem(MIDRUN_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }

  public clearMidRunSave(): void {
    try {
      localStorage.removeItem(MIDRUN_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  public resumeMidRun(): boolean {
    try {
      const raw = localStorage.getItem(MIDRUN_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as MidRunSaveData;
      if (!data || typeof data.floorNumber !== 'number') return false;

      this.floorNumber = data.floorNumber;
      this.floor = generateDungeonFloor(data.floorNumber, data.seed);
      this.scene3d.buildFloor(this.floor);

      this.px = data.px || this.floor.spawnX;
      this.py = data.py || this.floor.spawnY;
      this.pvx = 0;
      this.pvy = 0;
      this.cameraX = this.px;
      this.cameraY = this.py;
      this.pointerWorldX = this.px + 120;
      this.pointerWorldY = this.py;

      this.score = data.score || 0;
      this.kills = data.kills || 0;
      this.elapsedSeconds = data.elapsedSeconds || 0;
      this.level = data.level || 1;
      this.xp = data.xp || 0;
      this.xpToNext = xpRequiredForLevel(this.level);
      this.skillPoints = data.skillPoints || 0;
      this.unlockedSkills = data.unlockedSkills || [];
      this.materials = data.materials || { ...INITIAL_MATERIALS };
      this.equippedWeaponId = data.equippedWeaponId || STARTER_WEAPON_ID;
      this.equippedArmorId = data.equippedArmorId || STARTER_ARMOR_ID;
      this.craftedIds = data.craftedIds || [STARTER_WEAPON_ID, STARTER_ARMOR_ID];
      this.flaskCharges = data.flaskCharges ?? 2;
      this.furyTimer = data.furyTimer || 0;

      this.recomputeDerivedCaps();
      this.hp = Math.min(this.maxHp, data.hp || this.maxHp);
      this.ghostHp = this.hp;
      this.shield = data.shield || 0;
      this.essence = data.essence || 40;
      this.dashCharges = this.maxDashCharges;
      this.dashRechargeTimer = 0;

      this.enemies = [];
      this.pickups = [];
      this.projectiles = [];
      this.clones = [];
      this.afterimages = [];
      this.floatingNumbers = [];

      this.phase = 'playing';
      this.outcome = null;
      this.overlay = 'none';
      this.onOverlayRequest('none');
      document.body.dataset.state = 'playing';
      this.clearInputs();
      this.audio.setAmbientTheme(this.floor.theme.id);
      this.audio.resumeAmbient();
      this.showBanner(`Resumed Floor ${this.floorNumber} (${this.floor.theme.name})`);
      this.needsStaticRedraw = true;
      this.syncLoopState();
      this.emitHud(true);
      return true;
    } catch (e) {
      console.warn('Failed to resume mid-run save:', e);
      return false;
    }
  }

  public craftItem(recipeId: string): { success: boolean; reason?: string } {
    const res = executeCraft({
      recipeId,
      inventory: this.materials,
      craftedIds: this.craftedIds,
      equippedWeaponId: this.equippedWeaponId,
      equippedArmorId: this.equippedArmorId,
      atForge: this.isNearForge(),
    });

    if (!res.success) {
      return { success: false, reason: res.reason };
    }

    const oldMaxHp = this.maxHp;
    this.materials = res.nextInventory;
    this.craftedIds = res.nextCraftedIds;
    this.equippedWeaponId = res.nextEquippedWeaponId;
    this.equippedArmorId = res.nextEquippedArmorId;
    this.recomputeDerivedCaps();

    if (this.maxHp > oldMaxHp) {
      this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMaxHp));
      this.ghostHp = this.hp;
    }

    if (res.consumableTriggered) {
      if (res.consumableTriggered.kind === 'flask') {
        this.flaskCharges = Math.min(
          this.maxFlaskCharges,
          this.flaskCharges + res.consumableTriggered.value
        );
      } else if (res.consumableTriggered.kind === 'aegis_ward') {
        this.shield = Math.min(
          this.maxShield,
          this.shield + res.consumableTriggered.value
        );
      } else if (res.consumableTriggered.kind === 'fury_elixir') {
        this.furyTimer = Math.max(
          this.furyTimer,
          res.consumableTriggered.duration ?? 35
        );
      }
    }

    this.audio.playForgeCraft();
    this.scene3d.emitSpellCastPx('forge', this.px, this.py, this.aimAngle, '#f5c469', 95);
    const recipe = getRecipeById(recipeId);
    if (recipe) {
      this.spawnFloatingText(this.px, this.py - 28, `${recipe.name}`, '#fde68a', 1.15);
    }
    this.needsStaticRedraw = true;
    this.emitHud(true);
    return { success: true };
  }

  public investSkill(nodeId: string): boolean {
    const res = unlockSkill(nodeId, this.unlockedSkills, this.skillPoints);
    if (!res.success) return false;
    this.unlockedSkills = res.nextUnlocked;
    this.skillPoints = res.nextPoints;
    this.recomputeDerivedCaps();
    this.audio.playSkillUnlock();
    this.scene3d.emitSpellCastPx('skill_unlock', this.px, this.py, this.aimAngle, '#a78bfa', 100);
    this.needsStaticRedraw = true;
    this.emitHud(true);
    return true;
  }

  public triggerFlask(): void {
    if (this.phase !== 'playing' || this.overlay !== 'none') return;
    if (this.flaskCharges <= 0 || this.hp >= this.maxHp) return;
    this.flaskCharges--;
    const healAmt = Math.round(this.maxHp * 0.45);
    this.hp = Math.min(this.maxHp, this.hp + healAmt);
    this.ghostHp = Math.max(this.ghostHp, this.hp);
    this.audio.playHeal();
    this.scene3d.emitSpellCastPx('heal', this.px, this.py, this.aimAngle, '#34d399', 80);
    this.spawnFloatingText(this.px, this.py - 24, `+${healAmt} HP`, '#34d399', 1.15);
    this.emitHud(true);
  }

  public triggerNova(): void {
    if (this.phase !== 'playing' || this.overlay !== 'none') return;
    const cost = 35;
    if (this.novaCooldown > 0 || this.essence < cost) return;

    const bonuses = computeSkillBonuses(this.unlockedSkills);
    this.essence -= cost;
    this.novaCooldown = 2.4;

    const radius = Math.round(145 * bonuses.novaRadiusMultiplier);
    const baseDmg = Math.round(this.getEffectiveAttack() * 1.9 * bonuses.novaDamageMultiplier);

    this.novas.push({
      x: this.px,
      y: this.py,
      maxRadius: radius,
      life: 0.36,
      maxLife: 0.36,
      color: '#a78bfa',
    });

    this.audio.playNova();
    this.trauma = Math.min(1, this.trauma + 0.52);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.045);
    this.scene3d.emitSpellCastPx('nova', this.px, this.py, this.aimAngle, '#c084fc', radius);

    // Damage & stagger enemies in radius
    for (const enemy of this.enemies) {
      if (enemy.state === 'dying') continue;
      const dx = enemy.x - this.px;
      const dy = enemy.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + enemy.radius) {
        const ang = Math.atan2(dy, dx);
        if (bonuses.voidSingularity) {
          // Pull inward first
          enemy.vx -= Math.cos(ang) * 260;
          enemy.vy -= Math.sin(ang) * 260;
        } else {
          enemy.vx += Math.cos(ang) * 320;
          enemy.vy += Math.sin(ang) * 320;
        }
        this.damageEnemy(enemy, baseDmg, false, true, '#c084fc');
        if (enemy.hp > 0 && enemy.kind !== 'boss_malakor') {
          this.tokenPool.release(enemy.id);
          enemy.hasToken = false;
          enemy.state = 'stunned';
          enemy.stateTimer = bonuses.novaStunDuration;
          enemy.stateDuration = bonuses.novaStunDuration;
        }
      }
    }

    // Also harvest material nodes inside nova
    for (const node of this.floor.nodes) {
      if (node.harvested) continue;
      if (Math.hypot(node.x - this.px, node.y - this.py) <= radius) {
        this.hitMaterialNode(node, 2);
      }
    }

    this.emitHud(true);
  }

  public setVirtualMove(dx: number, dy: number): void {
    this.touchInputActive = true;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      this.virtualMoveX = dx / len;
      this.virtualMoveY = dy / len;
    } else {
      this.virtualMoveX = dx;
      this.virtualMoveY = dy;
    }
    if (len > 0.15) {
      this.aimAngle = Math.atan2(this.virtualMoveY, this.virtualMoveX);
    }
  }

  public setVirtualAttackHeld(held: boolean): void {
    this.touchInputActive = true;
    this.virtualAttackHeld = held;
    if (held && this.phase === 'playing' && this.overlay === 'none') {
      this.applySmartTouchAim();
      this.attackBuffer = 0.14;
    }
  }

  public triggerDash(): void {
    if (this.phase !== 'playing' || this.overlay !== 'none') return;
    this.touchInputActive = true;
    this.dashBuffer = 0.14;
  }

  public triggerInteract(): void {
    if (this.phase !== 'playing' || this.overlay !== 'none') return;
    this.handleInteract();
  }

  private vibrate(ms: number): void {
    if (!this.touchInputActive) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch {
      // Ignore vibrate restrictions
    }
  }

  private applySmartTouchAim(): void {
    const livingEnemies = this.enemies.filter((e) => e.state !== 'dying');
    const activeNodes = this.floor.nodes.filter((n) => !n.harvested);
    this.aimAngle = computeSmartAimAngle({
      playerX: this.px,
      playerY: this.py,
      currentAim: this.aimAngle,
      moveX: this.virtualMoveX,
      moveY: this.virtualMoveY,
      enemies: livingEnemies,
      nodes: activeNodes,
    });
  }

  public triggerAstralLance(): void {
    if (this.phase !== 'playing' || this.overlay !== 'none') return;
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    if (!bonuses.astralLanceUnlocked) return;
    const cost = 25;
    if (this.lanceCooldown > 0 || this.essence < cost) return;

    if (this.touchInputActive) {
      this.applySmartTouchAim();
    }

    this.essence -= cost;
    this.lanceCooldown = 1.6;
    const speed = 720;
    const dmg = Math.round(this.getEffectiveAttack() * 1.65);

    this.projectiles.push({
      id: `proj_${this.idCounter++}`,
      fromPlayer: true,
      kind: 'astral_lance',
      x: this.px + Math.cos(this.aimAngle) * 20,
      y: this.py + Math.sin(this.aimAngle) * 20,
      vx: Math.cos(this.aimAngle) * speed,
      vy: Math.sin(this.aimAngle) * speed,
      radius: 12,
      damage: dmg,
      life: 0.9,
      maxLife: 0.9,
      color: '#c084fc',
      pierce: true,
      hitIds: new Set<string>(),
    });

    this.audio.playLance();
    this.vibrate(18);
    this.trauma = Math.min(1, this.trauma + 0.28);
    this.scene3d.emitSpellCastPx('lance', this.px, this.py, this.aimAngle, '#c084fc', 80);
    this.emitHud(true);
  }

  private resetRunState(): void {
    this.floorNumber = 1;
    this.elapsedSeconds = 0;
    this.simTime = 0;
    this.hitstopTimer = 0;
    this.trauma = 0;
    this.pendingDefeat = false;
    this.defeatDelayTimer = 0;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpRequiredForLevel(1);
    this.skillPoints = 1;
    this.unlockedSkills = [];

    this.materials = { ...INITIAL_MATERIALS };
    this.craftedIds = [STARTER_WEAPON_ID, STARTER_ARMOR_ID];
    this.equippedWeaponId = STARTER_WEAPON_ID;
    this.equippedArmorId = STARTER_ARMOR_ID;
    this.flaskCharges = 2;
    this.furyTimer = 0;
    this.shield = 0;
    this.essence = 40;
    this.score = 0;
    this.kills = 0;

    this.recomputeDerivedCaps();
    this.hp = this.maxHp;
    this.ghostHp = this.maxHp;
    this.dashCharges = this.maxDashCharges;
    this.dashRechargeTimer = 0;
    this.novaCooldown = 0;
    this.lanceCooldown = 0;
    this.comboStep = 1;
    this.attackCooldown = 0;
    this.attackBuffer = 0;
    this.dashBuffer = 0;
    this.slowTimer = 0;

    this.loadFloor(1);
  }

  private loadFloor(floorNum: number): void {
    this.floorNumber = floorNum;
    this.floor = generateDungeonFloor(floorNum);
    this.px = this.floor.spawnX;
    this.py = this.floor.spawnY;
    this.pvx = 0;
    this.pvy = 0;
    this.cameraX = this.px;
    this.cameraY = this.py;
    this.pointerWorldX = this.px + 120;
    this.pointerWorldY = this.py;

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.clones = [];
    this.slashes = [];
    this.novas = [];
    this.afterimages = [];
    this.tokenPool.clear();
    this.scene3d.buildFloor(this.floor);
    this.audio.setAmbientTheme(this.floor.theme.id);
    if (this.phase === 'playing') {
      this.saveMidRun();
    }

    if (floorNum > this.bestFloor) {
      this.bestFloor = floorNum;
      saveRecords({ bestScore: this.bestScore, bestFloor: this.bestFloor });
    }
  }

  private descendToNextFloor(): void {
    const nextFloor = this.floorNumber + 1;
    this.flaskCharges = Math.min(this.maxFlaskCharges, this.flaskCharges + 1);
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.25));
    this.ghostHp = Math.max(this.ghostHp, this.hp);
    this.loadFloor(nextFloor);
    this.audio.playRoomClear();
    this.showBanner(`Floor ${nextFloor} · ${this.floor.theme.name}`);
    this.emitHud(true);
  }

  private recomputeDerivedCaps(): void {
    const armor = getRecipeById(this.equippedArmorId)?.armorStats;
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    this.maxHp = 120 + (this.level - 1) * 16 + (armor?.bonusMaxHp ?? 0);
    this.hp = Math.min(this.hp, this.maxHp);
    this.maxDashCharges = 2 + (armor?.bonusDashCharges ?? 0) + bonuses.bonusDashCharges;
    this.dashCharges = Math.min(this.dashCharges, this.maxDashCharges);
  }

  private getEffectiveAttack(): number {
    const weapon = getRecipeById(this.equippedWeaponId)?.weaponStats;
    const base = 18 + (this.level - 1) * 4 + (weapon?.bonusAttack ?? 0);
    const furyMult = this.furyTimer > 0 ? 1.35 : 1.0;
    return base * furyMult;
  }

  private getCurrentRoom(): DungeonRoom | null {
    for (const room of this.floor.rooms) {
      if (isPointInRect(this.px, this.py, room)) {
        return room;
      }
    }
    return null;
  }

  private getLockedRoom(): DungeonRoom | null {
    for (const room of this.floor.rooms) {
      if (room.locked) return room;
    }
    return null;
  }

  private isNearForge(): boolean {
    return (
      Math.hypot(
        this.px - this.floor.forgePos.x,
        this.py - this.floor.forgePos.y
      ) < 165
    );
  }

  private isExitUnlocked(): boolean {
    const exitRoom = this.floor.rooms[this.floor.exitRoomId];
    return Boolean(exitRoom && exitRoom.cleared);
  }

  private isNearExit(): boolean {
    return (
      Math.hypot(
        this.px - this.floor.exitPos.x,
        this.py - this.floor.exitPos.y
      ) < 95
    );
  }

  private showBanner(text: string): void {
    this.statusBanner = text;
    this.statusBannerTimer = 2.6;
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.domCanvas.addEventListener('mousemove', this.handleMouseMove);
    this.domCanvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.domCanvas.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private needsStaticRedraw = true;

  private handleResize = (): void => {
    this.scene3d.resize();
    this.needsStaticRedraw = true;
    if (this.phase !== 'title') {
      this.render();
      this.needsStaticRedraw = false;
    }
  };

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    return this.scene3d.screenToWorldPx(clientX, clientY);
  }

  private clearInputs(): void {
    this.keysHeld.clear();
    this.mouseLeftHeld = false;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualAttackHeld = false;
  }

  private handleBlur = (): void => {
    this.clearInputs();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.clearInputs();
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private hasPointerMoved = false;

  private handleMouseMove = (e: MouseEvent): void => {
    this.hasPointerMoved = true;
    this.touchInputActive = false;
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.pointerWorldX = world.x;
    this.pointerWorldY = world.y;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing' || this.overlay !== 'none') return;
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.pointerWorldX = world.x;
    this.pointerWorldY = world.y;
    this.aimAngle = Math.atan2(world.y - this.py, world.x - this.px);

    if (e.button === 0) {
      this.mouseLeftHeld = true;
      this.attackBuffer = 0.13;
    } else if (e.button === 2) {
      this.triggerNova();
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeftHeld = false;
  };

  private handleBeforeUnload = (): void => {
    this.saveMidRun();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;

    if (this.phase === 'title') {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        if (this.hasMidRunSave()) {
          this.resumeMidRun();
        } else {
          this.startNewRun();
        }
      }
      return;
    }

    if (code === 'Escape') {
      e.preventDefault();
      if (this.overlay !== 'none') {
        this.overlay = 'none';
        this.onOverlayRequest('none');
        this.syncLoopState();
        this.emitHud(true);
      } else if (this.phase === 'playing' || this.phase === 'paused') {
        this.togglePause();
      }
      return;
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (code === 'KeyP' && (this.phase === 'playing' || this.phase === 'paused')) {
      if (this.overlay === 'none') {
        this.togglePause();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    if (code === 'KeyC') {
      e.preventDefault();
      const next: ActiveOverlay = this.overlay === 'crafting' ? 'none' : 'crafting';
      this.overlay = next;
      this.onOverlayRequest(next);
      this.clearInputs();
      this.needsStaticRedraw = true;
      this.syncLoopState();
      this.emitHud(true);
      return;
    }

    if (code === 'KeyK') {
      e.preventDefault();
      const next: ActiveOverlay = this.overlay === 'skills' ? 'none' : 'skills';
      this.overlay = next;
      this.onOverlayRequest(next);
      this.clearInputs();
      this.needsStaticRedraw = true;
      this.syncLoopState();
      this.emitHud(true);
      return;
    }

    if (code === 'KeyB') {
      e.preventDefault();
      const next: ActiveOverlay = this.overlay === 'codex' ? 'none' : 'codex';
      this.overlay = next;
      this.onOverlayRequest(next);
      this.clearInputs();
      this.needsStaticRedraw = true;
      this.syncLoopState();
      this.emitHud(true);
      return;
    }

    if (code === 'KeyO') {
      e.preventDefault();
      const next: ActiveOverlay = this.overlay === 'oracle' ? 'none' : 'oracle';
      this.overlay = next;
      this.onOverlayRequest(next);
      this.clearInputs();
      this.needsStaticRedraw = true;
      this.syncLoopState();
      this.emitHud(true);
      return;
    }

    if (this.overlay !== 'none') return;

    const alreadyHeld = this.keysHeld.has(code);
    this.keysHeld.add(code);

    if (alreadyHeld) return;

    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
      e.preventDefault();
      this.dashBuffer = 0.13;
    } else if (code === 'KeyJ') {
      this.attackBuffer = 0.13;
    } else if (code === 'KeyQ') {
      this.triggerNova();
    } else if (code === 'KeyV' || code === 'Digit2') {
      this.triggerAstralLance();
    } else if (code === 'KeyE') {
      this.triggerFlask();
    } else if (code === 'KeyF') {
      this.handleInteract();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleInteract(): void {
    if (this.isNearForge()) {
      this.overlay = 'crafting';
      this.onOverlayRequest('crafting');
      this.clearInputs();
      this.emitHud(true);
      return;
    }
    if (this.isNearExit() && this.isExitUnlocked()) {
      if (this.floorNumber === TARGET_FINAL_FLOOR) {
        // Trigger Victory screen on clearing Floor 3 Sovereign Boss (with Endless Rift option!)
        this.phase = 'gameover';
        this.outcome = 'victory';
        document.body.dataset.state = 'gameover';
        this.audio.playVictory();
        this.clearInputs();
        this.clearMidRunSave();
        this.audio.stopAmbient();
        this.emitHud(true);
      } else {
        this.descendToNextFloor();
      }
      return;
    }
    // Harvest nearest node in reach with [F] as well as slashing
    for (const node of this.floor.nodes) {
      if (node.harvested) continue;
      if (Math.hypot(node.x - this.px, node.y - this.py) < 76) {
        this.hitMaterialNode(node, 2);
        return;
      }
    }
  }

  private stopLoop(): void {
    if (this.cancelNextFrame !== null) {
      this.cancelNextFrame();
      this.cancelNextFrame = null;
    }
  }

  private syncLoopState(): void {
    const shouldRun = this.phase === 'playing' && this.overlay === 'none';
    if (shouldRun) {
      if (this.cancelNextFrame === null) {
        this.startLoop();
      }
    } else {
      this.stopLoop();
      if (this.phase !== 'title' && this.needsStaticRedraw) {
        this.lastFrameDt = 0;
        this.render();
        this.needsStaticRedraw = false;
      }
    }
  }

  private startLoop(): void {
    this.lastTimestamp = performance.now();

    const tick = () => {
      this.cancelNextFrame = null;
      if (this.phase !== 'playing' || this.overlay !== 'none') {
        return;
      }
      const now = performance.now();
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      this.lastFrameDt = dt;

      this.update(dt);
      this.render();

      if (this.phase === 'playing' && this.overlay === 'none') {
        this.cancelNextFrame = this.scene3d.afterDraw(tick);
      }
    };

    // Draw frame 0 synchronously so the 3D scene is visible immediately upon entering the Rift
    this.lastFrameDt = 1 / 60;
    this.render();
    this.cancelNextFrame = this.scene3d.afterDraw(tick);
  }

  private prevGamepadButtons: boolean[] = [];

  private pollGamepad(dt: number): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      const candidate = gamepads[i];
      if (candidate && candidate.connected) {
        gp = candidate;
        break;
      }
    }
    if (!gp) return;

    const btn = (index: number): boolean =>
      Boolean(gp?.buttons[index]?.pressed || (gp?.buttons[index]?.value ?? 0) > 0.5);
    const wasPressed = (index: number): boolean => {
      const isNow = btn(index);
      const was = Boolean(this.prevGamepadButtons[index]);
      return isNow && !was;
    };

    if (this.phase === 'title') {
      if (wasPressed(0) || wasPressed(9)) {
        if (this.hasMidRunSave()) {
          this.resumeMidRun();
        } else {
          this.startNewRun();
        }
      }
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    if (this.phase === 'gameover') {
      if (wasPressed(0) || wasPressed(9)) {
        if (this.outcome === 'victory') {
          this.continueEndless();
        } else {
          this.startNewRun();
        }
      }
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    if (wasPressed(9)) {
      this.togglePause();
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    if (wasPressed(8)) {
      this.setOverlay(this.overlay === 'skills' ? 'none' : 'skills');
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    if (wasPressed(14)) {
      this.setOverlay(this.overlay === 'crafting' ? 'none' : 'crafting');
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    if (wasPressed(15)) {
      this.setOverlay(this.overlay === 'codex' ? 'none' : 'codex');
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    if (this.phase !== 'playing' || this.overlay !== 'none') {
      this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
      return;
    }

    const deadzone = 0.18;
    let moveX = gp.axes[0] ?? 0;
    let moveY = gp.axes[1] ?? 0;
    if (Math.hypot(moveX, moveY) < deadzone) {
      moveX = 0;
      moveY = 0;
    }
    if (btn(12)) moveY = -1;
    if (btn(13)) moveY = 1;
    if (btn(14)) moveX = -1;
    if (btn(15)) moveX = 1;

    if (moveX !== 0 || moveY !== 0) {
      this.virtualMoveX = moveX;
      this.virtualMoveY = moveY;
    }

    const aimX = gp.axes[2] ?? 0;
    const aimY = gp.axes[3] ?? 0;
    if (Math.hypot(aimX, aimY) > deadzone) {
      this.aimAngle = Math.atan2(aimY, aimX);
      this.pointerWorldX = this.px + Math.cos(this.aimAngle) * 160;
      this.pointerWorldY = this.py + Math.sin(this.aimAngle) * 160;
    } else if (Math.hypot(moveX, moveY) > deadzone) {
      this.aimAngle = Math.atan2(moveY, moveX);
      this.pointerWorldX = this.px + Math.cos(this.aimAngle) * 160;
      this.pointerWorldY = this.py + Math.sin(this.aimAngle) * 160;
    }

    if (wasPressed(2) || (btn(7) && !(this.prevGamepadButtons[7] ?? false))) {
      this.attackBuffer = 0.13;
    }
    if (wasPressed(1) || (btn(6) && !(this.prevGamepadButtons[6] ?? false))) {
      this.dashBuffer = 0.13;
    }
    if (wasPressed(5)) {
      this.triggerNova();
    }
    if (wasPressed(4)) {
      this.triggerAstralLance();
    }
    if (wasPressed(3)) {
      this.triggerFlask();
    }
    if (wasPressed(0)) {
      this.handleInteract();
    }

    this.prevGamepadButtons = gp.buttons.map((b) => b.pressed || (b.value ?? 0) > 0.5);
  }

  private update(dt: number): void {
    this.pollGamepad(dt);
    this.simTime += dt;

    // Camera shake & hit flashes tick in real dt even during hitstop
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    if (this.pHitFlash > 0) this.pHitFlash = Math.max(0, this.pHitFlash - dt);
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer = Math.max(0, this.statusBannerTimer - dt);
      if (this.statusBannerTimer === 0) this.statusBanner = '';
    }

    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    }

    if (this.phase !== 'playing' || this.overlay !== 'none') {
      return;
    }

    // Brief dramatic beat before Game Over modal on defeat
    if (this.pendingDefeat) {
      this.defeatDelayTimer -= dt;
      this.updateFloatingNumbers(dt);
      if (this.defeatDelayTimer <= 0) {
        this.pendingDefeat = false;
        this.phase = 'gameover';
        this.outcome = 'defeat';
        document.body.dataset.state = 'gameover';
        this.clearInputs();
        this.clearMidRunSave();
        this.audio.stopAmbient();
        this.emitHud(true);
      }
      return;
    }

    // Hitstop freezes simulation physics briefly on heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    this.elapsedSeconds += dt;

    // Ghost HP trailing bar
    if (this.ghostHp > this.hp) {
      this.ghostHp = Math.max(this.hp, this.ghostHp - dt * 42);
    } else {
      this.ghostHp = this.hp;
    }

    if (this.furyTimer > 0) this.furyTimer = Math.max(0, this.furyTimer - dt);
    if (this.slowTimer > 0) this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.pInvulnTimer > 0) this.pInvulnTimer = Math.max(0, this.pInvulnTimer - dt);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackSwingTimer > 0) this.attackSwingTimer = Math.max(0, this.attackSwingTimer - dt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
      if (this.comboResetTimer === 0) this.comboStep = 1;
    }
    if (this.novaCooldown > 0) this.novaCooldown = Math.max(0, this.novaCooldown - dt);
    if (this.lanceCooldown > 0) this.lanceCooldown = Math.max(0, this.lanceCooldown - dt);
    if (this.attackBuffer > 0) this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    if (this.dashBuffer > 0) this.dashBuffer = Math.max(0, this.dashBuffer - dt);

    // Passive Essence trickle
    this.essence = Math.min(this.maxEssence, this.essence + dt * 2.2);

    // Dash charge recharge
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    const dashRechargeDur = 1.55 * bonuses.dashCooldownMultiplier;
    if (this.dashCharges < this.maxDashCharges) {
      this.dashRechargeTimer += dt;
      if (this.dashRechargeTimer >= dashRechargeDur) {
        this.dashRechargeTimer -= dashRechargeDur;
        this.dashCharges++;
      }
    } else {
      this.dashRechargeTimer = 0;
    }

    // Update aim from desktop mouse raycast (when not actively using touch controls)
    if (this.hasPointerMoved && !this.touchInputActive) {
      const world = this.screenToWorld(this.pointerClientX, this.pointerClientY);
      this.pointerWorldX = world.x;
      this.pointerWorldY = world.y;
      this.aimAngle = Math.atan2(
        this.pointerWorldY - this.py,
        this.pointerWorldX - this.px
      );
    } else if (this.touchInputActive && (this.virtualAttackHeld || this.attackBuffer > 0)) {
      this.applySmartTouchAim();
    }

    this.updatePlayerMovement(dt);
    this.processBufferedActions();
    this.checkRoomEncounterActivation();
    this.updateTraps(dt);
    this.updateEnemies(dt);
    this.updateClones(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateVisualEffects(dt);
    this.updateFloatingNumbers(dt);

    // Smooth camera follow with slight aim lead
    const leadX = Math.cos(this.aimAngle) * 32;
    const leadY = Math.sin(this.aimAngle) * 32;
    const damp = 1 - Math.exp(-8.5 * dt);
    this.cameraX += (this.px + leadX - this.cameraX) * damp;
    this.cameraY += (this.py + leadY - this.cameraY) * damp;

    // Throttled HUD update (~12Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private updatePlayerMovement(dt: number): void {
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    const armor = getRecipeById(this.equippedArmorId)?.armorStats;
    const lockedRoom = this.getLockedRoom();
    const allPillars = this.floor.rooms.flatMap((r) => r.pillars);

    // Decay squash/stretch smoothly back to 1
    const sDamp = 1 - Math.exp(-14 * dt);
    this.pScaleX += (1 - this.pScaleX) * sDamp;
    this.pScaleY += (1 - this.pScaleY) * sDamp;

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      const dashSpeed = 760;
      const move = moveWithDungeonCollision({
        x: this.px,
        y: this.py,
        dx: this.dashDirX * dashSpeed * dt,
        dy: this.dashDirY * dashSpeed * dt,
        radius: this.pRadius,
        walkableRects: this.floor.walkableRects,
        pillars: allPillars,
        lockedRoomBounds: lockedRoom,
      });
      this.px = move.x;
      this.py = move.y;

      this.afterimages.push({
        x: this.px,
        y: this.py,
        alpha: 0.75,
        angle: this.aimAngle,
      });

      // Phase Step capstone: dashing through enemies damages them & restores essence
      if (bonuses.phaseStepDamage) {
        for (const e of this.enemies) {
          if (e.state === 'dying' || this.dashHitIds.has(e.id)) continue;
          if (Math.hypot(e.x - this.px, e.y - this.py) < e.radius + this.pRadius + 14) {
            this.dashHitIds.add(e.id);
            const dmg = Math.round(this.getEffectiveAttack() * 0.9);
            this.damageEnemy(e, dmg, false, true, '#34d399');
            this.essence = Math.min(this.maxEssence, this.essence + 15);
          }
        }
      }
      return;
    }

    let ix = this.virtualMoveX;
    let iy = this.virtualMoveY;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) iy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) iy += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) ix -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) ix += 1;

    const inputLen = Math.hypot(ix, iy);
    if (inputLen > 1) {
      ix /= inputLen;
      iy /= inputLen;
    }

    const baseSpeed = 265 * bonuses.moveSpeedMultiplier * (1 + (armor?.moveSpeedBonus ?? 0));
    const speed = this.slowTimer > 0 ? baseSpeed * 0.56 : baseSpeed;

    const targetVx = ix * speed;
    const targetVy = iy * speed;
    const accel = 1 - Math.exp(-18 * dt);
    this.pvx += (targetVx - this.pvx) * accel;
    this.pvy += (targetVy - this.pvy) * accel;

    const prevX = this.px;
    const prevY = this.py;
    const moved = moveWithDungeonCollision({
      x: this.px,
      y: this.py,
      dx: this.pvx * dt,
      dy: this.pvy * dt,
      radius: this.pRadius,
      walkableRects: this.floor.walkableRects,
      pillars: allPillars,
      lockedRoomBounds: lockedRoom,
    });
    this.px = moved.x;
    this.py = moved.y;

    // Gait synced to distance traveled so hero never skates
    const distMoved = Math.hypot(this.px - prevX, this.py - prevY);
    this.pWalkPhase += distMoved * 0.14;
  }

  private processBufferedActions(): void {
    // Dash takes priority over slash for crisp dodge-canceling
    if (this.dashBuffer > 0 && this.dashCharges > 0 && this.dashTimer <= 0) {
      this.dashBuffer = 0;
      this.executeDash();
      return;
    }

    if (
      (this.attackBuffer > 0 || this.mouseLeftHeld || this.virtualAttackHeld) &&
      this.attackCooldown <= 0 &&
      this.dashTimer <= 0
    ) {
      this.attackBuffer = 0;
      if (this.touchInputActive) {
        this.applySmartTouchAim();
      }
      this.executeSlash();
    }
  }

  private executeDash(): void {
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    this.dashCharges--;
    this.dashTimer = 0.16;
    this.pInvulnTimer = Math.max(this.pInvulnTimer, 0.24);
    this.dashHitIds.clear();

    let dx = this.virtualMoveX;
    let dy = this.virtualMoveY;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) dy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) dy += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) dx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) dx += 1;

    if (Math.hypot(dx, dy) < 0.15) {
      dx = Math.cos(this.aimAngle);
      dy = Math.sin(this.aimAngle);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }
    this.dashDirX = dx;
    this.dashDirY = dy;
    this.pScaleX = 1.26;
    this.pScaleY = 0.76;

    if (bonuses.shadowCloneOnDash) {
      this.clones.push({
        x: this.px,
        y: this.py,
        timer: 0.65,
        maxTimer: 0.65,
        damage: Math.round(this.getEffectiveAttack() * 1.3),
        radius: 86,
      });
    }

    this.audio.playDash();
    this.vibrate(14);
    this.scene3d.emitSpellCastPx(
      'dash',
      this.px,
      this.py,
      Math.atan2(dy, dx),
      '#a78bfa',
      64
    );
  }

  private executeSlash(): void {
    const weapon = getRecipeById(this.equippedWeaponId)?.weaponStats;
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    const step = this.comboStep;
    const isFinisher = step === 3;
    const isWhirlwind = isFinisher && bonuses.whirlwindFinisher;

    const reach = Math.round(
      (isFinisher ? 92 : 76) * (weapon?.reachMultiplier ?? 1)
    );
    const arc = isWhirlwind ? Math.PI * 2 : isFinisher ? 2.45 : 1.75;

    this.attackCooldown = isFinisher ? 0.36 : 0.22;
    this.attackSwingTimer = 0.16;
    this.comboResetTimer = 0.85;
    this.comboStep = step === 1 ? 2 : step === 2 ? 3 : 1;

    // Slight forward combat lunge
    this.pvx += Math.cos(this.aimAngle) * (isFinisher ? 150 : 90);
    this.pvy += Math.sin(this.aimAngle) * (isFinisher ? 150 : 90);
    this.pScaleX = isFinisher ? 1.2 : 1.12;
    this.pScaleY = isFinisher ? 0.84 : 0.9;

    const bladeColor = weapon?.bladeColor ?? '#f5c469';
    this.slashes.push({
      x: this.px,
      y: this.py,
      angle: this.aimAngle,
      arc,
      radius: reach,
      life: 0.16,
      maxLife: 0.16,
      color: isFinisher ? '#fde047' : bladeColor,
      isFinisher,
      isWhirlwind,
    });

    // Subtle blade-edge swing sparks along the 3D slash arc
    const tipX = this.px + Math.cos(this.aimAngle) * (reach * 0.65);
    const tipY = this.py + Math.sin(this.aimAngle) * (reach * 0.65);
    this.scene3d.emitSpellCastPx(
      'lance_trail',
      tipX,
      tipY,
      this.aimAngle + Math.PI * 0.5,
      isFinisher ? '#fde047' : bladeColor,
      40
    );

    // Sovereign Riftblade unleashes a piercing shadow wave on combo finisher!
    if (isFinisher && weapon?.waveOnFinisher) {
      this.projectiles.push({
        id: `proj_${this.idCounter++}`,
        fromPlayer: true,
        kind: 'shadow_wave',
        x: this.px + Math.cos(this.aimAngle) * 26,
        y: this.py + Math.sin(this.aimAngle) * 26,
        vx: Math.cos(this.aimAngle) * 520,
        vy: Math.sin(this.aimAngle) * 520,
        radius: 22,
        damage: Math.round(this.getEffectiveAttack() * 1.15),
        life: 0.6,
        maxLife: 0.6,
        color: '#fde047',
        pierce: true,
        hitIds: new Set<string>(),
      });
    }

    this.audio.playSlash(step);

    // Hit enemies in arc
    let hitAnyHeavy = false;
    const critChance = 0.12 + (weapon?.bonusCrit ?? 0) + bonuses.critChanceBonus;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dying') continue;
      const dx = enemy.x - this.px;
      const dy = enemy.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + enemy.radius) continue;

      const angleToEnemy = Math.atan2(dy, dx);
      const diff = Math.abs(normalizeAngle(angleToEnemy - this.aimAngle));
      if (!isWhirlwind && diff > arc / 2 + 0.25) continue;

      // Check Sentinel frontal shield
      let shieldedFront = false;
      if (enemy.kind === 'sentinel') {
        const angleToPlayer = Math.atan2(this.py - enemy.y, this.px - enemy.x);
        const frontDiff = Math.abs(normalizeAngle(angleToPlayer - enemy.facing));
        shieldedFront = frontDiff < 1.05;
      }

      const dmgRes = computeAttackDamage({
        baseAttack: this.getEffectiveAttack(),
        comboStep: step,
        attackMultiplier: bonuses.attackMultiplier,
        critChance,
        critDamageMultiplier: bonuses.critDamageMultiplier,
        rngRoll: Math.random(),
        targetShieldedFront: shieldedFront,
      });

      const kbForce = isFinisher ? 310 : 170;
      const kbScale = enemy.kind === 'boss_malakor' ? 0.22 : enemy.kind === 'sentinel' ? 0.45 : 1.0;
      enemy.vx += Math.cos(angleToEnemy) * kbForce * kbScale;
      enemy.vy += Math.sin(angleToEnemy) * kbForce * kbScale;

      this.damageEnemy(
        enemy,
        dmgRes.damage,
        dmgRes.isCrit,
        !dmgRes.wasBlocked,
        dmgRes.isCrit ? '#fbbf24' : dmgRes.wasBlocked ? '#94a3b8' : '#fff7ed',
        dmgRes.wasBlocked,
        angleToEnemy,
        bladeColor,
        isFinisher
      );

      // Executioner Rift shockwave on crit
      if (dmgRes.isCrit && bonuses.executionerShockwave) {
        this.novas.push({
          x: enemy.x,
          y: enemy.y,
          maxRadius: 72,
          life: 0.22,
          maxLife: 0.22,
          color: '#ef4444',
        });
        for (const other of this.enemies) {
          if (other.id === enemy.id || other.state === 'dying') continue;
          if (Math.hypot(other.x - enemy.x, other.y - enemy.y) < 76) {
            this.damageEnemy(other, Math.round(dmgRes.damage * 0.45), false, true, '#fb7185');
          }
        }
      }

      // Generate Rift Essence
      const essenceGain =
        (isFinisher ? 11 : 7) *
        (1 + (weapon?.essenceGainBonus ?? 0)) *
        bonuses.essenceGainMultiplier;
      this.essence = Math.min(this.maxEssence, this.essence + essenceGain);

      if (isFinisher || dmgRes.isCrit) hitAnyHeavy = true;
    }

    // Hit harvestable material nodes in arc
    for (const node of this.floor.nodes) {
      if (node.harvested) continue;
      const dx = node.x - this.px;
      const dy = node.y - this.py;
      if (Math.hypot(dx, dy) > reach + node.radius) continue;
      const diff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - this.aimAngle));
      if (!isWhirlwind && diff > arc / 2 + 0.3) continue;
      this.hitMaterialNode(node, 1);
    }

    if (hitAnyHeavy) {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.048);
      this.trauma = Math.min(1, this.trauma + 0.34);
    }
  }

  private hitMaterialNode(node: DungeonFloor['nodes'][number], dmg: number): void {
    if (node.harvested) return;
    node.hp -= dmg;
    node.hitFlash = 0.09;
    this.audio.playHit(false, true);
    const shattered = node.hp <= 0;
    this.scene3d.emitNodeHitPx(node.x, node.y, node.material, shattered);

    if (shattered) {
      node.harvested = true;
      const bonuses = computeSkillBonuses(this.unlockedSkills);
      const count = node.yieldAmount + (Math.random() < bonuses.materialDropBonus ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        this.pickups.push({
          id: `drop_${this.idCounter++}`,
          kind: 'material',
          material: node.material,
          amount: 1,
          x: node.x,
          y: node.y,
          vx: Math.cos(ang) * (70 + Math.random() * 60),
          vy: Math.sin(ang) * (70 + Math.random() * 60),
          age: 0,
        });
      }
      this.spawnFloatingText(node.x, node.y - 16, 'Harvested!', '#fde68a', 0.95);
    }
  }

  private damageEnemy(
    enemy: EnemyEntity,
    damage: number,
    isCrit: boolean,
    heavySound: boolean,
    color: string,
    blocked = false,
    impactAngle = this.aimAngle,
    bladeColor = '#f5c469',
    isFinisher = false
  ): void {
    if (enemy.state === 'dying') return;
    enemy.hp -= damage;
    enemy.hitFlash = 0.08;
    enemy.scaleX = 1.24;
    enemy.scaleY = 0.78;

    this.audio.playHit(isCrit || heavySound, blocked);
    this.scene3d.emitWeaponImpactPx(
      enemy.x,
      enemy.y,
      impactAngle,
      bladeColor,
      isCrit,
      isFinisher,
      blocked
    );
    this.spawnFloatingText(
      enemy.x + (Math.random() - 0.5) * 14,
      enemy.y - enemy.radius - 6,
      blocked ? `${damage} (Guard)` : isCrit ? `${damage}!` : `${damage}`,
      color,
      isCrit ? 1.25 : 0.95
    );

    // Boss Phase 2 transition at 50% HP
    if (
      enemy.kind === 'boss_malakor' &&
      enemy.bossPhase === 1 &&
      enemy.hp > 0 &&
      enemy.hp <= enemy.maxHp * 0.5
    ) {
      enemy.bossPhase = 2;
      enemy.speed *= 1.18;
      this.hitstopTimer = 0.075;
      this.trauma = Math.min(1, this.trauma + 0.65);
      this.novas.push({
        x: enemy.x,
        y: enemy.y,
        maxRadius: 170,
        life: 0.45,
        maxLife: 0.45,
        color: '#ef4444',
      });
      this.scene3d.emitSpellCastPx('boss_phase', enemy.x, enemy.y, 0, '#ef4444', 180);
      this.showBanner('Malakor Enters Phase II — Rift Unbound!');
      this.audio.playNova();
    }

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.state = 'dying';
      enemy.deathTimer = enemy.kind === 'boss_malakor' ? 0.65 : 0.45;
      this.tokenPool.release(enemy.id);
      enemy.hasToken = false;
      this.handleEnemyKilled(enemy);
    }
  }

  private handleEnemyKilled(enemy: EnemyEntity): void {
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    this.kills++;
    this.score += enemy.scoreValue;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveRecords({ bestScore: this.bestScore, bestFloor: this.bestFloor });
    }

    if (bonuses.bloodlustOnKill) {
      this.hp = Math.min(this.maxHp, this.hp + 7);
      this.spawnFloatingText(this.px, this.py - 26, '+7 HP', '#34d399', 0.95);
    }

    this.hitstopTimer = Math.max(this.hitstopTimer, enemy.kind === 'boss_malakor' ? 0.085 : 0.045);
    this.trauma = Math.min(1, this.trauma + (enemy.kind === 'boss_malakor' ? 0.78 : 0.28));
    this.scene3d.emitEnemyDeathPx(enemy);

    // Drop Soul Orbs (XP + Essence)
    const orbCount = enemy.kind === 'boss_malakor' ? 6 : 2;
    for (let i = 0; i < orbCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.pickups.push({
        id: `drop_${this.idCounter++}`,
        kind: 'soul',
        amount: Math.round(enemy.xpValue / orbCount),
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(ang) * (65 + Math.random() * 65),
        vy: Math.sin(ang) * (65 + Math.random() * 65),
        age: 0,
      });
    }

    // Material drops tailored to enemy archetype
    const dropMat: MaterialId =
      enemy.kind === 'sentinel' || enemy.kind === 'lancer'
        ? 'shadow_iron'
        : enemy.kind === 'acolyte' || enemy.kind === 'boss_malakor'
          ? 'rift_shard'
          : Math.random() < 0.55
            ? 'ember_ash'
            : 'vital_essence';

    const dropChance = enemy.kind === 'boss_malakor' ? 1 : 0.62 + bonuses.materialDropBonus;
    if (Math.random() < dropChance) {
      const qty = enemy.kind === 'boss_malakor' ? 3 : 1;
      for (let i = 0; i < qty; i++) {
        const ang = Math.random() * Math.PI * 2;
        this.pickups.push({
          id: `drop_${this.idCounter++}`,
          kind: 'material',
          material: dropMat,
          amount: 1,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(ang) * 90,
          vy: Math.sin(ang) * 90,
          age: 0,
        });
      }
    }

    // Occasional Ember Heart drop
    if (Math.random() < (enemy.kind === 'boss_malakor' ? 1 : 0.16)) {
      this.pickups.push({
        id: `drop_${this.idCounter++}`,
        kind: 'heart',
        amount: 24,
        x: enemy.x,
        y: enemy.y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        age: 0,
      });
    }

    // Check if the room is now cleared
    const room = this.floor.rooms.find((r) => r.id === enemy.roomId);
    if (room && !room.cleared) {
      const remaining = this.enemies.filter(
        (e) => e.roomId === room.id && e.state !== 'dying'
      ).length;
      if (remaining === 0) {
        room.cleared = true;
        room.locked = false;
        this.audio.playRoomClear();
        this.score += room.kind === 'boss' ? 500 : 120;
        this.saveMidRun();
        if (room.kind === 'boss') {
          this.showBanner('Guardian Slain · Rift Exit Unsealed!');
        } else if (room.kind === 'treasure') {
          this.showBanner('Treasure Vault Cleared · Harvest the Nodes!');
        } else {
          this.showBanner('Chamber Cleared');
        }
        this.emitHud(true);
      }
    }
  }

  private checkRoomEncounterActivation(): void {
    const room = this.getCurrentRoom();
    if (!room) return;

    if (!room.discovered) {
      room.discovered = true;
      this.emitHud(true);
    }

    if (room.spawned || room.cleared) return;

    // Wait until player is safely inside the room doorway before sealing
    const pad = 42;
    if (
      this.px > room.x + pad &&
      this.px < room.x + room.w - pad &&
      this.py > room.y + pad &&
      this.py < room.y + room.h - pad
    ) {
      room.spawned = true;
      room.locked = true;
      this.spawnRoomEnemies(room);
      if (room.kind === 'boss') {
        this.showBanner(`Boss Encounter · Malakor, Sovereign of the Seam`);
      }
      this.emitHud(true);
    }
  }

  private spawnRoomEnemies(room: DungeonRoom): void {
    const rng = createRng(this.floor.seed + room.id * 97);
    const scaleHp = 1 + (this.floorNumber - 1) * 0.34;
    const scaleDmg = 1 + (this.floorNumber - 1) * 0.22;

    if (room.kind === 'boss') {
      this.enemies.push({
        id: `enemy_${this.idCounter++}`,
        kind: 'boss_malakor',
        name:
          this.floorNumber === 1
            ? 'Malakor, Rift Warden'
            : this.floorNumber === 2
              ? 'Malakor, Ashen Arbiter'
              : 'Malakor, Sovereign of the Seam',
        roomId: room.id,
        x: room.cx,
        y: room.cy - 40,
        vx: 0,
        vy: 0,
        radius: 30,
        hp: Math.round(310 * scaleHp),
        maxHp: Math.round(310 * scaleHp),
        speed: 112,
        damage: Math.round(20 * scaleDmg),
        facing: Math.PI / 2,
        state: 'move',
        stateTimer: 1.2,
        stateDuration: 1.2,
        attackCooldown: 1.4,
        hasToken: false,
        hitFlash: 0,
        scaleX: 1,
        scaleY: 1,
        walkPhase: 0,
        targetX: room.cx,
        targetY: room.cy,
        bossPhase: 1,
        bossPatternIndex: 0,
        xpValue: 110,
        scoreValue: 450,
        deathTimer: 0,
        strafeDir: 1,
      });
      return;
    }

    const pool: EnemyKind[] =
      this.floorNumber === 1
        ? ['stalker', 'acolyte', 'lancer', 'sentinel']
        : ['stalker', 'acolyte', 'lancer', 'sentinel', 'lancer', 'acolyte'];

    const count = Math.max(2, Math.min(7, Math.round(room.enemyBudget * 0.65)));

    for (let i = 0; i < count; i++) {
      const kind = pool[Math.floor(rng() * pool.length)];
      // Spawn at least 170px away from player so player always has reaction space
      let ex = room.cx;
      let ey = room.cy;
      for (let a = 0; a < 20; a++) {
        const cx = room.x + 80 + rng() * (room.w - 160);
        const cy = room.y + 80 + rng() * (room.h - 160);
        if (Math.hypot(cx - this.px, cy - this.py) < 175) continue;
        const hitsPillar = room.pillars.some(
          (p) => cx > p.x - 28 && cx < p.x + p.w + 28 && cy > p.y - 28 && cy < p.y + p.h + 28
        );
        if (hitsPillar) continue;
        ex = cx;
        ey = cy;
        break;
      }

      const stats = this.enemyStatsFor(kind, scaleHp, scaleDmg);
      this.enemies.push({
        id: `enemy_${this.idCounter++}`,
        kind,
        name: stats.name,
        roomId: room.id,
        x: ex,
        y: ey,
        vx: 0,
        vy: 0,
        radius: stats.radius,
        hp: stats.hp,
        maxHp: stats.hp,
        speed: stats.speed,
        damage: stats.damage,
        facing: Math.atan2(this.py - ey, this.px - ex),
        state: 'move',
        stateTimer: 0.5 + rng() * 0.6,
        stateDuration: 0.6,
        attackCooldown: 0.7 + rng() * 0.7,
        hasToken: false,
        hitFlash: 0,
        scaleX: 1,
        scaleY: 1,
        walkPhase: 0,
        targetX: this.px,
        targetY: this.py,
        xpValue: stats.xp,
        scoreValue: stats.score,
        deathTimer: 0,
        strafeDir: rng() > 0.5 ? 1 : -1,
      });
    }
  }

  private enemyStatsFor(kind: EnemyKind, hpScale: number, dmgScale: number) {
    switch (kind) {
      case 'stalker':
        return {
          name: 'Shade Stalker',
          radius: 15,
          hp: Math.round(46 * hpScale),
          speed: 175,
          damage: Math.round(12 * dmgScale),
          xp: 18,
          score: 65,
        };
      case 'acolyte':
        return {
          name: 'Rift Acolyte',
          radius: 16,
          hp: Math.round(52 * hpScale),
          speed: 118,
          damage: Math.round(14 * dmgScale),
          xp: 22,
          score: 85,
        };
      case 'lancer':
        return {
          name: 'Obsidian Lancer',
          radius: 18,
          hp: Math.round(74 * hpScale),
          speed: 122,
          damage: Math.round(18 * dmgScale),
          xp: 28,
          score: 110,
        };
      case 'sentinel':
      default:
        return {
          name: 'Umbral Sentinel',
          radius: 21,
          hp: Math.round(98 * hpScale),
          speed: 88,
          damage: Math.round(20 * dmgScale),
          xp: 34,
          score: 135,
        };
    }
  }

  private updateTraps(dt: number): void {
    for (const trap of this.floor.traps) {
      trap.timer = (trap.timer + dt) % trap.cyclePeriod;
      const telegraphStart = trap.cyclePeriod * 0.58;
      const activeStart = trap.cyclePeriod * 0.78;

      const prevState = trap.state;
      if (trap.timer >= activeStart) {
        trap.state = 'active';
      } else if (trap.timer >= telegraphStart) {
        trap.state = 'telegraph';
      } else {
        trap.state = 'idle';
      }

      if (prevState !== 'active' && trap.state === 'active') {
        trap.triggeredHitIds.clear();
        if (Math.hypot(trap.x - this.px, trap.y - this.py) < 420) {
          this.scene3d.emitTrapBurstPx(
            trap.x,
            trap.y,
            trap.kind === 'void_geyser' ? '#fb923c' : '#a78bfa'
          );
        }
      }

      if (trap.state === 'active') {
        // Check player hit
        if (
          !trap.triggeredHitIds.has('player') &&
          Math.hypot(this.px - trap.x, this.py - trap.y) < trap.radius + this.pRadius - 4
        ) {
          trap.triggeredHitIds.add('player');
          if (trap.kind === 'shadow_snare') {
            this.slowTimer = 1.6;
            this.damagePlayer(trap.damage);
          } else {
            this.damagePlayer(trap.damage);
          }
        }

        // Traps can also hurt careless enemies!
        for (const e of this.enemies) {
          if (e.state === 'dying' || trap.triggeredHitIds.has(e.id)) continue;
          if (Math.hypot(e.x - trap.x, e.y - trap.y) < trap.radius + e.radius - 4) {
            trap.triggeredHitIds.add(e.id);
            this.damageEnemy(e, Math.round(trap.damage * 0.8), false, false, '#fb923c');
          }
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    const lockedRoom = this.getLockedRoom();
    const allPillars = this.floor.rooms.flatMap((r) => r.pillars);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.state === 'dying') {
        e.deathTimer -= dt;
        if (e.deathTimer <= 0) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // Damp squash/stretch & knockback velocity
      const sDamp = 1 - Math.exp(-12 * dt);
      e.scaleX += (1 - e.scaleX) * sDamp;
      e.scaleY += (1 - e.scaleY) * sDamp;
      e.vx *= Math.exp(-8 * dt);
      e.vy *= Math.exp(-8 * dt);

      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);
      const angleToPlayer = Math.atan2(dy, dx);

      let moveX = e.vx;
      let moveY = e.vy;

      if (e.state === 'stunned') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'move';
        }
      } else if (e.state === 'recover') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'move';
        }
      } else if (e.state === 'windup') {
        e.stateTimer -= dt;
        if (e.kind === 'acolyte') {
          // Track slightly during early windup
          if (e.stateTimer > e.stateDuration * 0.35) {
            e.facing = angleToPlayer;
          }
        }
        if (e.stateTimer <= 0) {
          this.triggerEnemyAttack(e);
        }
      } else if (e.state === 'attack') {
        e.stateTimer -= dt;
        if (e.kind === 'lancer' || e.kind === 'stalker') {
          const chargeSpeed = e.kind === 'lancer' ? 540 : 410;
          moveX += Math.cos(e.facing) * chargeSpeed;
          moveY += Math.sin(e.facing) * chargeSpeed;
          if (dist < e.radius + this.pRadius + 4) {
            this.damagePlayer(e.damage);
            e.state = 'recover';
            e.stateTimer = 0.55;
            this.tokenPool.release(e.id);
            e.hasToken = false;
          }
        }
        if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = e.kind === 'lancer' ? 0.65 : 0.4;
          this.tokenPool.release(e.id);
          e.hasToken = false;
        }
      } else {
        // Distinct Movement & Decision Policies per Archetype
        if (e.kind === 'stalker') {
          // Agile chaser/flanker
          e.facing = angleToPlayer;
          if (dist > 82) {
            const flankAngle = angleToPlayer + Math.sin(this.simTime * 2.5 + e.radius) * 0.42;
            moveX += Math.cos(flankAngle) * e.speed;
            moveY += Math.sin(flankAngle) * e.speed;
          } else if (e.attackCooldown <= 0 && this.tokenPool.request(e.id)) {
            e.hasToken = true;
            e.state = 'windup';
            e.stateDuration = 0.34;
            e.stateTimer = 0.34;
            this.audio.playTelegraph();
          }
        } else if (e.kind === 'acolyte') {
          // Ranged kiter: retreats if too close, strafes at ideal distance
          e.facing = angleToPlayer;
          if (dist < 175) {
            moveX -= Math.cos(angleToPlayer) * e.speed;
            moveY -= Math.sin(angleToPlayer) * e.speed;
          } else if (dist > 310) {
            moveX += Math.cos(angleToPlayer) * e.speed * 0.85;
            moveY += Math.sin(angleToPlayer) * e.speed * 0.85;
          } else {
            const strafeAng = angleToPlayer + (Math.PI / 2) * e.strafeDir;
            moveX += Math.cos(strafeAng) * e.speed * 0.72;
            moveY += Math.sin(strafeAng) * e.speed * 0.72;
          }
          if (e.attackCooldown <= 0 && dist < 390 && this.tokenPool.request(e.id)) {
            e.hasToken = true;
            e.state = 'windup';
            e.stateDuration = 0.56;
            e.stateTimer = 0.56;
            this.audio.playTelegraph();
          }
        } else if (e.kind === 'lancer') {
          // Line-of-sight charger
          e.facing = angleToPlayer;
          if (dist > 220) {
            moveX += Math.cos(angleToPlayer) * e.speed;
            moveY += Math.sin(angleToPlayer) * e.speed;
          } else if (e.attackCooldown <= 0 && this.tokenPool.request(e.id)) {
            e.hasToken = true;
            e.state = 'windup';
            e.stateDuration = 0.64;
            e.stateTimer = 0.64;
            this.audio.playTelegraph();
          }
        } else if (e.kind === 'sentinel') {
          // Slow armored heavy that turns gradually (so player can flank behind shield!)
          const diff = normalizeAngle(angleToPlayer - e.facing);
          e.facing += clamp(diff, -2.1 * dt, 2.1 * dt);
          if (dist > 72) {
            moveX += Math.cos(angleToPlayer) * e.speed;
            moveY += Math.sin(angleToPlayer) * e.speed;
          } else if (e.attackCooldown <= 0 && this.tokenPool.request(e.id)) {
            e.hasToken = true;
            e.state = 'windup';
            e.stateDuration = 0.68;
            e.stateTimer = 0.68;
            this.audio.playTelegraph();
          }
        } else if (e.kind === 'boss_malakor') {
          e.facing = angleToPlayer;
          if (dist > 155) {
            moveX += Math.cos(angleToPlayer) * e.speed;
            moveY += Math.sin(angleToPlayer) * e.speed;
          } else {
            const orbitAng = angleToPlayer + Math.PI / 2;
            moveX += Math.cos(orbitAng) * e.speed * 0.6;
            moveY += Math.sin(orbitAng) * e.speed * 0.6;
          }

          if (e.attackCooldown <= 0) {
            const pat = ((e.bossPatternIndex ?? 0) + 1) % 3;
            e.bossPatternIndex = pat;
            e.targetX = this.px;
            e.targetY = this.py;
            e.state = 'windup';
            e.stateDuration = e.bossPhase === 2 ? 0.56 : 0.72;
            e.stateTimer = e.stateDuration;
            this.audio.playTelegraph();
          }
        }
      }

      // Soft separation between enemies so they don't stack on one pixel
      for (const other of this.enemies) {
        if (other.id === e.id || other.state === 'dying') continue;
        const sdx = e.x - other.x;
        const sdy = e.y - other.y;
        const sdist = Math.hypot(sdx, sdy);
        const minSep = e.radius + other.radius + 4;
        if (sdist > 0.01 && sdist < minSep) {
          const push = (minSep - sdist) * 4.5;
          moveX += (sdx / sdist) * push;
          moveY += (sdy / sdist) * push;
        }
      }

      const moved = moveWithDungeonCollision({
        x: e.x,
        y: e.y,
        dx: moveX * dt,
        dy: moveY * dt,
        radius: e.radius,
        walkableRects: this.floor.walkableRects,
        pillars: allPillars,
        lockedRoomBounds: lockedRoom && lockedRoom.id === e.roomId ? lockedRoom : null,
      });
      e.x = moved.x;
      e.y = moved.y;

      // Wall bonk stops Lancer charge into recover
      if (moved.hitWall && e.state === 'attack' && e.kind === 'lancer') {
        e.state = 'recover';
        e.stateTimer = 0.85;
        this.tokenPool.release(e.id);
        e.hasToken = false;
        this.trauma = Math.min(1, this.trauma + 0.18);
        this.scene3d.emitWeaponImpactPx(e.x, e.y, e.facing + Math.PI, '#94a3b8', false, false, true);
      }
    }
  }

  private triggerEnemyAttack(e: EnemyEntity): void {
    if (e.kind === 'stalker') {
      e.state = 'attack';
      e.stateTimer = 0.22;
      e.attackCooldown = 1.25;
    } else if (e.kind === 'lancer') {
      e.state = 'attack';
      e.stateTimer = 0.45;
      e.attackCooldown = 2.1;
    } else if (e.kind === 'acolyte') {
      const speed = 340;
      this.projectiles.push({
        id: `proj_${this.idCounter++}`,
        fromPlayer: false,
        kind: 'void_bolt',
        x: e.x + Math.cos(e.facing) * 18,
        y: e.y + Math.sin(e.facing) * 18,
        vx: Math.cos(e.facing) * speed,
        vy: Math.sin(e.facing) * speed,
        radius: 7,
        damage: e.damage,
        life: 1.8,
        maxLife: 1.8,
        color: '#ef4444',
        pierce: false,
        hitIds: new Set<string>(),
      });
      e.state = 'recover';
      e.stateTimer = 0.45;
      e.attackCooldown = 1.95;
      this.tokenPool.release(e.id);
      e.hasToken = false;
    } else if (e.kind === 'sentinel') {
      this.novas.push({
        x: e.x,
        y: e.y,
        maxRadius: 88,
        life: 0.28,
        maxLife: 0.28,
        color: '#ef4444',
      });
      if (Math.hypot(this.px - e.x, this.py - e.y) < 88 + this.pRadius) {
        this.damagePlayer(e.damage);
      }
      this.trauma = Math.min(1, this.trauma + 0.26);
      this.audio.playHit(true);
      e.state = 'recover';
      e.stateTimer = 0.7;
      e.attackCooldown = 2.2;
      this.tokenPool.release(e.id);
      e.hasToken = false;
    } else if (e.kind === 'boss_malakor') {
      const pat = e.bossPatternIndex ?? 0;
      const isP2 = e.bossPhase === 2;
      if (pat === 0) {
        // Fan of Void Orbs
        const bolts = isP2 ? 7 : 5;
        const spread = isP2 ? 1.5 : 1.05;
        for (let b = 0; b < bolts; b++) {
          const ang = e.facing - spread / 2 + (spread * b) / (bolts - 1);
          this.projectiles.push({
            id: `proj_${this.idCounter++}`,
            fromPlayer: false,
            kind: 'boss_orb',
            x: e.x + Math.cos(ang) * 26,
            y: e.y + Math.sin(ang) * 26,
            vx: Math.cos(ang) * (isP2 ? 340 : 285),
            vy: Math.sin(ang) * (isP2 ? 340 : 285),
            radius: 9,
            damage: e.damage,
            life: 2.2,
            maxLife: 2.2,
            color: isP2 ? '#fb7185' : '#c084fc',
            pierce: false,
            hitIds: new Set<string>(),
          });
        }
        this.audio.playLance();
      } else if (pat === 1) {
        // Teleport Slam onto telegraphed spot
        this.scene3d.emitSpellCastPx('dash', e.x, e.y, 0, '#a78bfa', 90);
        e.x = e.targetX;
        e.y = e.targetY;
        this.novas.push({
          x: e.x,
          y: e.y,
          maxRadius: 128,
          life: 0.34,
          maxLife: 0.34,
          color: '#ef4444',
        });
        this.scene3d.emitSpellCastPx('boss_phase', e.x, e.y, 0, '#ef4444', 128);
        if (Math.hypot(this.px - e.x, this.py - e.y) < 128 + this.pRadius) {
          this.damagePlayer(Math.round(e.damage * 1.25));
        }
        this.trauma = Math.min(1, this.trauma + 0.5);
        this.audio.playNova();
      } else {
        // Radial Nova Ring of Orbs
        const ringCount = isP2 ? 12 : 8;
        for (let k = 0; k < ringCount; k++) {
          const ang = (k / ringCount) * Math.PI * 2 + this.simTime;
          this.projectiles.push({
            id: `proj_${this.idCounter++}`,
            fromPlayer: false,
            kind: 'boss_orb',
            x: e.x + Math.cos(ang) * 24,
            y: e.y + Math.sin(ang) * 24,
            vx: Math.cos(ang) * 255,
            vy: Math.sin(ang) * 255,
            radius: 8,
            damage: e.damage,
            life: 2.4,
            maxLife: 2.4,
            color: '#ef4444',
            pierce: false,
            hitIds: new Set<string>(),
          });
        }
        this.audio.playNova();
      }
      e.state = 'recover';
      e.stateTimer = isP2 ? 0.55 : 0.78;
      e.attackCooldown = isP2 ? 1.35 : 1.85;
    }
  }

  private damagePlayer(rawDamage: number): void {
    if (this.pInvulnTimer > 0 || this.pendingDefeat || this.phase !== 'playing') {
      return;
    }

    const armor = getRecipeById(this.equippedArmorId)?.armorStats;
    const reduced = Math.max(
      1,
      Math.round(rawDamage * (1 - (armor?.damageReduction ?? 0)))
    );

    let remaining = reduced;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
      this.spawnFloatingText(this.px, this.py - 28, `-${absorbed} Ward`, '#60a5fa', 0.95);
    }

    if (remaining > 0) {
      this.hp = Math.max(0, this.hp - remaining);
      this.spawnFloatingText(this.px, this.py - 20, `-${remaining}`, '#ef4444', 1.15);
    }

    this.pHitFlash = 0.09;
    this.pInvulnTimer = 0.65;
    this.pScaleX = 1.25;
    this.pScaleY = 0.78;
    this.trauma = Math.min(1, this.trauma + 0.52);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.045);
    this.audio.playHurt();
    this.scene3d.emitWeaponImpactPx(this.px, this.py, this.aimAngle + Math.PI, '#ef4444', true, false, false);

    if (this.hp <= 0) {
      this.pendingDefeat = true;
      this.defeatDelayTimer = 0.55;
      this.audio.playDefeat();
      this.scene3d.emitSpellCastPx('boss_phase', this.px, this.py, 0, '#ef4444', 120);
    }

    this.emitHud(true);
  }

  private updateClones(dt: number): void {
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      c.timer -= dt;
      if (c.timer <= 0) {
        this.novas.push({
          x: c.x,
          y: c.y,
          maxRadius: c.radius,
          life: 0.25,
          maxLife: 0.25,
          color: '#a78bfa',
        });
        this.audio.playHit(true);
        this.scene3d.emitSpellCastPx('clone_blast', c.x, c.y, 0, '#c084fc', c.radius);
        for (const e of this.enemies) {
          if (e.state === 'dying') continue;
          if (Math.hypot(e.x - c.x, e.y - c.y) <= c.radius + e.radius) {
            this.damageEnemy(e, c.damage, false, true, '#c084fc');
          }
        }
        this.clones.splice(i, 1);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const allPillars = this.floor.rooms.flatMap((r) => r.pillars);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Emit continuous glittering 3D comet trail behind player spells
      if (p.fromPlayer && Math.random() < 0.65) {
        this.scene3d.emitSpellCastPx(
          'lance_trail',
          p.x,
          p.y,
          Math.atan2(p.vy, p.vx),
          p.color,
          30
        );
      }

      // Wall / pillar collision
      let insideWalkable = false;
      for (const r of this.floor.walkableRects) {
        if (isPointInRect(p.x, p.y, r)) {
          insideWalkable = true;
          break;
        }
      }
      const hitPillar = allPillars.some((pil) => isPointInRect(p.x, p.y, pil));
      if (!insideWalkable || hitPillar || p.life <= 0) {
        this.scene3d.emitWeaponImpactPx(p.x, p.y, Math.atan2(p.vy, p.vx), p.color, false, false, false);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let consumed = false;
        for (const e of this.enemies) {
          if (e.state === 'dying' || p.hitIds.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
            p.hitIds.add(e.id);
            this.damageEnemy(
              e,
              p.damage,
              false,
              true,
              p.color,
              false,
              Math.atan2(p.vy, p.vx),
              p.color,
              true
            );
            if (!p.pierce) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.projectiles.splice(i, 1);
        }
      } else {
        if (Math.hypot(this.px - p.x, this.py - p.y) < this.pRadius + p.radius) {
          this.damagePlayer(p.damage);
          this.scene3d.emitWeaponImpactPx(p.x, p.y, Math.atan2(p.vy, p.vx), p.color, false, false, false);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private updatePickups(dt: number): void {
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    const magnetRadius = 115 * bonuses.pickupMagnetMultiplier;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;
      p.vx *= Math.exp(-6 * dt);
      p.vy *= Math.exp(-6 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < magnetRadius && p.age > 0.14) {
        const pull = 440;
        p.x += (dx / Math.max(1, dist)) * pull * dt;
        p.y += (dy / Math.max(1, dist)) * pull * dt;
      }

      if (dist < this.pRadius + 14) {
        if (p.kind === 'soul') {
          this.essence = Math.min(
            this.maxEssence,
            this.essence + 6 * bonuses.essenceGainMultiplier
          );
          const xpRes = applyXpGain(this.level, this.xp, p.amount);
          this.level = xpRes.level;
          this.xp = xpRes.xp;
          this.xpToNext = xpRes.xpToNext;
          if (xpRes.levelsGained > 0) {
            this.skillPoints += xpRes.levelsGained;
            this.recomputeDerivedCaps();
            this.hp = Math.min(this.maxHp, this.hp + 25 * xpRes.levelsGained);
            this.ghostHp = Math.max(this.ghostHp, this.hp);
            this.audio.playSkillUnlock();
            this.scene3d.emitSpellCastPx('levelup', this.px, this.py, 0, '#fde047', 120);
            this.spawnFloatingText(
              this.px,
              this.py - 32,
              `LEVEL ${this.level}! +${xpRes.levelsGained} Skill Pt`,
              '#fde047',
              1.25
            );
            this.showBanner(`Level ${this.level} Reached · Press [K] for Skill Tree`);
          } else {
            this.audio.playPickup(false);
          }
        } else if (p.kind === 'material' && p.material) {
          this.materials[p.material] = (this.materials[p.material] ?? 0) + p.amount;
          this.audio.playPickup(true);
          this.spawnFloatingText(
            this.px,
            this.py - 22,
            `+${p.amount} ${p.material.replace('_', ' ')}`,
            '#fde68a',
            0.9
          );
        } else if (p.kind === 'heart') {
          this.hp = Math.min(this.maxHp, this.hp + p.amount);
          this.ghostHp = Math.max(this.ghostHp, this.hp);
          this.audio.playHeal();
          this.spawnFloatingText(this.px, this.py - 22, `+${p.amount} HP`, '#34d399', 1.0);
        }

        this.pickups.splice(i, 1);
        this.emitHud(true);
      }
    }
  }

  private updateVisualEffects(dt: number): void {
    for (const node of this.floor.nodes) {
      if (node.hitFlash > 0) node.hitFlash = Math.max(0, node.hitFlash - dt);
    }

    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }

    for (let i = this.novas.length - 1; i >= 0; i--) {
      this.novas[i].life -= dt;
      if (this.novas[i].life <= 0) this.novas.splice(i, 1);
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].alpha -= dt * 4.5;
      if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1
  ): void {
    const slot = this.floatingNumbers[this.floatingCursor];
    this.floatingCursor = (this.floatingCursor + 1) % MAX_FLOATING;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vy = -42;
    slot.text = text;
    slot.color = color;
    slot.scale = scale;
    slot.maxLife = 0.85;
    slot.life = slot.maxLife;
  }

  private updateFloatingNumbers(dt: number): void {
    for (let i = 0; i < MAX_FLOATING; i++) {
      const f = this.floatingNumbers[i];
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.active = false;
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= Math.exp(-2.8 * dt);
    }
  }

  private render(): void {
    const weapon = getRecipeById(this.equippedWeaponId)?.weaponStats;
    const armor = getRecipeById(this.equippedArmorId)?.armorStats;

    this.scene3d.renderFrame({
      time: this.simTime,
      dt: this.lastFrameDt,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      trauma: this.trauma,
      floor: this.floor,
      player: {
        x: this.px,
        y: this.py,
        vx: this.pvx,
        vy: this.pvy,
        radius: this.pRadius,
        aimAngle: this.aimAngle,
        scaleX: this.pScaleX,
        scaleY: this.pScaleY,
        walkPhase: this.pWalkPhase,
        hitFlash: this.pHitFlash,
        invulnTimer: this.pInvulnTimer,
        dashing: this.dashTimer > 0,
        comboStep: this.comboStep,
        attackSwingTimer: this.attackSwingTimer,
        bladeColor: weapon?.bladeColor ?? '#f5c469',
        cloakColor: armor?.cloakColor ?? '#3b3454',
        shield: this.shield,
        afterimages: this.afterimages,
      },
      enemies: this.enemies,
      projectiles: this.projectiles,
      pickups: this.pickups,
      clones: this.clones,
      slashes: this.slashes,
      novas: this.novas,
      floatingNumbers: this.floatingNumbers,
      pointerWorldX: this.pointerWorldX,
      pointerWorldY: this.pointerWorldY,
      nearForge: this.isNearForge(),
      nearExit: this.isNearExit(),
      exitUnlocked: this.isExitUnlocked(),
      isPlaying: this.phase === 'playing' && this.overlay === 'none',
      showReticle: this.hasPointerMoved && !this.touchInputActive,
    });
  }

  public getHudSnapshot(): HudSnapshot {
    const bonuses = computeSkillBonuses(this.unlockedSkills);
    const dashRechargeDur = 1.55 * bonuses.dashCooldownMultiplier;
    const currentRoom = this.getCurrentRoom();
    const boss = this.enemies.find(
      (e) => e.kind === 'boss_malakor' && e.state !== 'dying'
    );
    const combatRooms = this.floor.rooms.filter((r) => r.kind !== 'entrance');
    const clearedRooms = combatRooms.filter((r) => r.cleared).length;

    return {
      phase: this.phase,
      outcome: this.outcome,
      floorNumber: this.floorNumber,
      maxTargetFloor: TARGET_FINAL_FLOOR,
      themeName: this.floor.theme.name,
      themeAccent: this.floor.theme.accentColor,
      hp: Math.round(this.hp),
      maxHp: Math.round(this.maxHp),
      ghostHp: Math.round(this.ghostHp),
      shield: Math.round(this.shield),
      maxShield: this.maxShield,
      essence: Math.round(this.essence),
      maxEssence: this.maxEssence,
      level: this.level,
      xp: Math.round(this.xp),
      xpToNext: this.xpToNext,
      skillPoints: this.skillPoints,
      unlockedSkills: [...this.unlockedSkills],
      dashCharges: this.dashCharges,
      maxDashCharges: this.maxDashCharges,
      dashRechargeRatio:
        this.dashCharges >= this.maxDashCharges
          ? 1
          : clamp(this.dashRechargeTimer / dashRechargeDur, 0, 1),
      novaCost: 35,
      novaCooldown: Number(this.novaCooldown.toFixed(1)),
      lanceUnlocked: bonuses.astralLanceUnlocked,
      lanceCost: 25,
      lanceCooldown: Number(this.lanceCooldown.toFixed(1)),
      flaskCharges: this.flaskCharges,
      maxFlaskCharges: this.maxFlaskCharges,
      furyTimer: Math.ceil(this.furyTimer),
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      bestFloor: this.bestFloor,
      kills: this.kills,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      materials: { ...this.materials },
      equippedWeaponId: this.equippedWeaponId,
      equippedArmorId: this.equippedArmorId,
      craftedIds: [...this.craftedIds],
      nearForge: this.isNearForge(),
      nearExit: this.isNearExit(),
      exitUnlocked: this.isExitUnlocked(),
      currentRoomKind: currentRoom?.kind ?? 'entrance',
      roomsCleared: clearedRooms,
      totalCombatRooms: combatRooms.length,
      bossActive: Boolean(boss),
      bossName: boss?.name ?? '',
      bossHp: Math.round(boss?.hp ?? 0),
      bossMaxHp: Math.round(boss?.maxHp ?? 1),
      bossPhase: boss?.bossPhase ?? 1,
      muted: this.audio.isMuted(),
      masterVolume: this.audio.getMasterVolume(),
      sfxVolume: this.audio.getSfxVolume(),
      musicVolume: this.audio.getMusicVolume(),
      hasMidRunSave: this.hasMidRunSave(),
      statusBanner: this.statusBanner,
      minimapRooms: this.floor.rooms.map((r) => ({
        id: r.id,
        kind: r.kind,
        gridX: r.gridX,
        gridY: r.gridY,
        discovered: r.discovered,
        cleared: r.cleared,
        current: currentRoom?.id === r.id,
        neighbors: r.neighbors,
      })),
    };
  }

  private emitHud(force: boolean): void {
    if (!force && this.phase === 'title') return;
    this.onHudUpdate(this.getHudSnapshot());
  }
}

export { CRAFTING_RECIPES };
