/**
 * Pure zero-GC 3D particle pool kinematics & high-impact combat emitters
 * for weapon impacts, spell casts, and multi-stage enemy death animations.
 */

export const MAX_SHARD_PARTICLES = 520;
export const MAX_WISP_PARTICLES = 240;
export const MAX_SHOCKWAVE_RINGS = 32;

export interface ShardParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  gravity: number;
  drag: number;
  bounce: number;
  alignVelocity: boolean;
  life: number;
  maxLife: number;
  colorHex: number;
}

export interface WispParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  growRate: number;
  swirlRadius: number;
  swirlSpeed: number;
  swirlAngle: number;
  originX: number;
  originZ: number;
  life: number;
  maxLife: number;
  colorHex: number;
}

export interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  z: number;
  startRadius: number;
  endRadius: number;
  riseSpeed: number;
  thickness: number;
  life: number;
  maxLife: number;
  colorHex: number;
  tiltX: number;
  tiltZ: number;
}

export type SpellCastVfxKind =
  | 'nova'
  | 'lance'
  | 'lance_trail'
  | 'dash'
  | 'heal'
  | 'levelup'
  | 'boss_phase'
  | 'clone_blast'
  | 'forge'
  | 'skill_unlock';

export function parseHexColor(cssHex: string, fallback = 0xf5c469): number {
  const clean = cssHex.trim().replace('#', '');
  if (clean.length === 6) {
    const n = parseInt(clean, 16);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export class ParticlePool3D {
  public readonly shards: ShardParticle[] = [];
  public readonly wisps: WispParticle[] = [];
  public readonly rings: ShockwaveRing[] = [];

  private shardCursor = 0;
  private wispCursor = 0;
  private ringCursor = 0;

  constructor(
    maxShards = MAX_SHARD_PARTICLES,
    maxWisps = MAX_WISP_PARTICLES,
    maxRings = MAX_SHOCKWAVE_RINGS
  ) {
    for (let i = 0; i < maxShards; i++) {
      this.shards.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        scaleZ: 0.1,
        gravity: 16,
        drag: 0.94,
        bounce: 0.45,
        alignVelocity: false,
        life: 0,
        maxLife: 1,
        colorHex: 0xffffff,
      });
    }

    for (let i = 0; i < maxWisps; i++) {
      this.wisps.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.2,
        growRate: 0.8,
        swirlRadius: 0,
        swirlSpeed: 0,
        swirlAngle: 0,
        originX: 0,
        originZ: 0,
        life: 0,
        maxLife: 1,
        colorHex: 0xa78bfa,
      });
    }

    for (let i = 0; i < maxRings; i++) {
      this.rings.push({
        active: false,
        x: 0,
        y: 0.08,
        z: 0,
        startRadius: 0.2,
        endRadius: 2,
        riseSpeed: 0,
        thickness: 0.12,
        life: 0,
        maxLife: 0.35,
        colorHex: 0xa78bfa,
        tiltX: 0,
        tiltZ: 0,
      });
    }
  }

  public clear(): void {
    for (const s of this.shards) s.active = false;
    for (const w of this.wisps) w.active = false;
    for (const r of this.rings) r.active = false;
  }

  public countActive(): { shards: number; wisps: number; rings: number } {
    let shards = 0;
    let wisps = 0;
    let rings = 0;
    for (const s of this.shards) if (s.active) shards++;
    for (const w of this.wisps) if (w.active) wisps++;
    for (const r of this.rings) if (r.active) rings++;
    return { shards, wisps, rings };
  }

  public spawnShard(init: Partial<ShardParticle> & { x: number; y: number; z: number }): void {
    const s = this.shards[this.shardCursor];
    this.shardCursor = (this.shardCursor + 1) % this.shards.length;
    s.active = true;
    s.x = init.x;
    s.y = init.y;
    s.z = init.z;
    s.vx = init.vx ?? 0;
    s.vy = init.vy ?? 3;
    s.vz = init.vz ?? 0;
    s.rotX = init.rotX ?? Math.random() * Math.PI * 2;
    s.rotY = init.rotY ?? Math.random() * Math.PI * 2;
    s.rotZ = init.rotZ ?? Math.random() * Math.PI * 2;
    s.spinX = init.spinX ?? (Math.random() - 0.5) * 14;
    s.spinY = init.spinY ?? (Math.random() - 0.5) * 14;
    s.spinZ = init.spinZ ?? (Math.random() - 0.5) * 14;
    s.scaleX = init.scaleX ?? 0.08;
    s.scaleY = init.scaleY ?? 0.08;
    s.scaleZ = init.scaleZ ?? 0.08;
    s.gravity = init.gravity ?? 18;
    s.drag = init.drag ?? 0.94;
    s.bounce = init.bounce ?? 0.42;
    s.alignVelocity = init.alignVelocity ?? false;
    s.maxLife = init.maxLife ?? 0.45;
    s.life = s.maxLife;
    s.colorHex = init.colorHex ?? 0xf5c469;
  }

  public spawnWisp(init: Partial<WispParticle> & { x: number; y: number; z: number }): void {
    const w = this.wisps[this.wispCursor];
    this.wispCursor = (this.wispCursor + 1) % this.wisps.length;
    w.active = true;
    w.x = init.x;
    w.y = init.y;
    w.z = init.z;
    w.originX = init.originX ?? init.x;
    w.originZ = init.originZ ?? init.z;
    w.vx = init.vx ?? 0;
    w.vy = init.vy ?? 1.8;
    w.vz = init.vz ?? 0;
    w.size = init.size ?? 0.22;
    w.growRate = init.growRate ?? 0.9;
    w.swirlRadius = init.swirlRadius ?? 0;
    w.swirlSpeed = init.swirlSpeed ?? 0;
    w.swirlAngle = init.swirlAngle ?? Math.random() * Math.PI * 2;
    w.maxLife = init.maxLife ?? 0.6;
    w.life = w.maxLife;
    w.colorHex = init.colorHex ?? 0xa78bfa;
  }

  public spawnRing(init: Partial<ShockwaveRing> & { x: number; z: number }): void {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.active = true;
    r.x = init.x;
    r.y = init.y ?? 0.1;
    r.z = init.z;
    r.startRadius = init.startRadius ?? 0.25;
    r.endRadius = init.endRadius ?? 2.2;
    r.riseSpeed = init.riseSpeed ?? 0;
    r.thickness = init.thickness ?? 0.11;
    r.maxLife = init.maxLife ?? 0.34;
    r.life = r.maxLife;
    r.colorHex = init.colorHex ?? 0xa78bfa;
    r.tiltX = init.tiltX ?? 0;
    r.tiltZ = init.tiltZ ?? 0;
  }

  /**
   * High-impact directional 3D weapon impact sparks, slash shards, and crit/guard bursts.
   */
  public emitWeaponImpact(
    wx: number,
    wz: number,
    slashAngle: number,
    bladeCssColor: string,
    isCrit: boolean,
    isFinisher: boolean,
    blocked: boolean
  ): void {
    const bladeHex = parseHexColor(bladeCssColor, 0xf5c469);
    const sparkColor = blocked ? 0x93c5fd : isCrit ? 0xfde047 : bladeHex;
    const secondaryColor = blocked ? 0xe2e8f0 : isCrit ? 0xf97316 : 0xef4444;
    const sparkCount = blocked ? 14 : isCrit ? 26 : isFinisher ? 20 : 12;

    // Directional fan of hot velocity-stretched sparks spraying along impact tangent
    for (let i = 0; i < sparkCount; i++) {
      const spread = blocked ? 2.2 : isCrit ? 2.5 : 1.5;
      const dir = slashAngle + (Math.random() - 0.5) * spread;
      const speed = (blocked ? 4.5 : isCrit ? 7.5 : 5.4) * (0.45 + Math.random() * 0.85);
      const isHotCore = i % 3 === 0;
      this.spawnShard({
        x: wx + (Math.random() - 0.5) * 0.25,
        y: 0.72 + (Math.random() - 0.5) * 0.35,
        z: wz + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(dir) * speed,
        vy: 2.2 + Math.random() * (isCrit ? 5.6 : 3.6),
        vz: Math.sin(dir) * speed,
        scaleX: isHotCore ? 0.055 : 0.042,
        scaleY: isHotCore ? 0.055 : 0.042,
        scaleZ: isCrit ? 0.34 : 0.24,
        gravity: 22,
        drag: 0.94,
        bounce: 0.52,
        alignVelocity: true,
        maxLife: 0.24 + Math.random() * 0.28,
        colorHex: isHotCore ? 0xfffbeb : i % 2 === 0 ? sparkColor : secondaryColor,
      });
    }

    // Impact slash burst ring tilted dynamically in 3D space
    this.spawnRing({
      x: wx,
      y: 0.75,
      z: wz,
      startRadius: 0.16,
      endRadius: blocked ? 1.1 : isCrit ? 2.1 : 1.25,
      thickness: isCrit ? 0.14 : 0.08,
      maxLife: isCrit ? 0.3 : 0.2,
      colorHex: sparkColor,
      tiltX: (Math.random() - 0.5) * 0.55,
      tiltZ: (Math.random() - 0.5) * 0.55,
    });

    if (isCrit || isFinisher) {
      // Secondary fiery floor shockwave ring + rising heat wisps
      this.spawnRing({
        x: wx,
        y: 0.09,
        z: wz,
        startRadius: 0.3,
        endRadius: isCrit ? 2.6 : 2.0,
        thickness: 0.11,
        maxLife: 0.32,
        colorHex: secondaryColor,
      });
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI * 2;
        this.spawnWisp({
          x: wx + Math.cos(ang) * 0.3,
          y: 0.45 + Math.random() * 0.4,
          z: wz + Math.sin(ang) * 0.3,
          vx: Math.cos(ang) * 1.4,
          vy: 1.8 + Math.random() * 1.6,
          vz: Math.sin(ang) * 1.4,
          size: 0.18,
          growRate: 1.2,
          maxLife: 0.38,
          colorHex: sparkColor,
        });
      }
    }
  }

  /**
   * Rich 3D spell-cast particle systems for Rift Nova, Astral Lance, Shadow Dash,
   * Siphon Flask, Level-Up, Boss Phase II, Shadow Decoy, and Rift Forge crafting.
   */
  public emitSpellCast(
    kind: SpellCastVfxKind,
    wx: number,
    wz: number,
    angle: number,
    cssColor: string,
    worldRadius = 4.2
  ): void {
    const colorHex = parseHexColor(cssColor, 0xa78bfa);

    if (kind === 'nova' || kind === 'boss_phase' || kind === 'clone_blast') {
      const isBoss = kind === 'boss_phase';
      const primary = isBoss ? 0xef4444 : colorHex;
      const accent = isBoss ? 0xf59e0b : 0xfde047;

      // Twin staggered 3D shockwave rings (ground wave + rising arcane halo)
      this.spawnRing({
        x: wx,
        y: 0.12,
        z: wz,
        startRadius: 0.4,
        endRadius: worldRadius,
        thickness: 0.18,
        maxLife: 0.42,
        colorHex: primary,
      });
      this.spawnRing({
        x: wx,
        y: 0.35,
        z: wz,
        startRadius: 0.3,
        endRadius: worldRadius * 0.82,
        riseSpeed: 2.2,
        thickness: 0.11,
        maxLife: 0.38,
        colorHex: accent,
      });

      // Radial eruption of arcane crystal shards & rising rune wisps
      const shardCount = isBoss ? 44 : kind === 'nova' ? 36 : 22;
      for (let i = 0; i < shardCount; i++) {
        const ang = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = worldRadius * (1.25 + Math.random() * 1.15);
        this.spawnShard({
          x: wx + Math.cos(ang) * 0.35,
          y: 0.45 + Math.random() * 0.45,
          z: wz + Math.sin(ang) * 0.35,
          vx: Math.cos(ang) * speed,
          vy: 2.4 + Math.random() * 4.5,
          vz: Math.sin(ang) * speed,
          scaleX: 0.06,
          scaleY: 0.06,
          scaleZ: 0.28,
          gravity: 13,
          drag: 0.93,
          bounce: 0.5,
          alignVelocity: true,
          maxLife: 0.36 + Math.random() * 0.3,
          colorHex: i % 3 === 0 ? accent : primary,
        });
      }

      const wispCount = isBoss ? 18 : 14;
      for (let i = 0; i < wispCount; i++) {
        const ang = (i / wispCount) * Math.PI * 2;
        this.spawnWisp({
          x: wx + Math.cos(ang) * 0.5,
          y: 0.2 + Math.random() * 0.4,
          z: wz + Math.sin(ang) * 0.5,
          vx: Math.cos(ang) * (worldRadius * 0.65),
          vy: 2.2 + Math.random() * 2.4,
          vz: Math.sin(ang) * (worldRadius * 0.65),
          size: 0.22,
          growRate: 1.4,
          maxLife: 0.52,
          colorHex: i % 2 === 0 ? primary : 0xe9d5ff,
        });
      }
      return;
    }

    if (kind === 'lance') {
      // Cast muzzle ring + focused forward arcane burst
      this.spawnRing({
        x: wx + Math.cos(angle) * 0.5,
        y: 0.85,
        z: wz + Math.sin(angle) * 0.5,
        startRadius: 0.15,
        endRadius: 1.35,
        thickness: 0.11,
        maxLife: 0.24,
        colorHex,
        tiltX: Math.PI / 2,
        tiltZ: -angle,
      });
      for (let i = 0; i < 16; i++) {
        const spread = (Math.random() - 0.5) * 0.7;
        const speed = 4.5 + Math.random() * 5.5;
        this.spawnShard({
          x: wx + Math.cos(angle) * 0.4,
          y: 0.85 + (Math.random() - 0.5) * 0.25,
          z: wz + Math.sin(angle) * 0.4,
          vx: Math.cos(angle + spread) * speed,
          vy: (Math.random() - 0.3) * 2.2,
          vz: Math.sin(angle + spread) * speed,
          scaleX: 0.045,
          scaleY: 0.045,
          scaleZ: 0.32,
          gravity: 4,
          drag: 0.94,
          bounce: 0.3,
          alignVelocity: true,
          maxLife: 0.28 + Math.random() * 0.18,
          colorHex: i % 3 === 0 ? 0xf5d0fe : colorHex,
        });
      }
      return;
    }

    if (kind === 'lance_trail') {
      this.spawnShard({
        x: wx + (Math.random() - 0.5) * 0.22,
        y: 0.82 + (Math.random() - 0.5) * 0.18,
        z: wz + (Math.random() - 0.5) * 0.22,
        vx: -Math.cos(angle) * (1.2 + Math.random() * 1.4),
        vy: 0.5 + Math.random() * 1.1,
        vz: -Math.sin(angle) * (1.2 + Math.random() * 1.4),
        scaleX: 0.04,
        scaleY: 0.04,
        scaleZ: 0.18,
        gravity: 3,
        drag: 0.92,
        bounce: 0.2,
        alignVelocity: true,
        maxLife: 0.24,
        colorHex,
      });
      return;
    }

    if (kind === 'dash') {
      // Swirling amethyst shadow mist & foot sparks behind the dash
      this.spawnRing({
        x: wx,
        y: 0.1,
        z: wz,
        startRadius: 0.2,
        endRadius: 1.35,
        thickness: 0.08,
        maxLife: 0.25,
        colorHex: 0xa78bfa,
      });
      for (let i = 0; i < 10; i++) {
        const ang = angle + Math.PI + (Math.random() - 0.5) * 1.4;
        this.spawnWisp({
          x: wx + (Math.random() - 0.5) * 0.35,
          y: 0.25 + Math.random() * 0.7,
          z: wz + (Math.random() - 0.5) * 0.35,
          vx: Math.cos(ang) * (1.5 + Math.random() * 2.2),
          vy: 0.9 + Math.random() * 1.4,
          vz: Math.sin(ang) * (1.5 + Math.random() * 2.2),
          size: 0.2,
          growRate: 1.1,
          maxLife: 0.36,
          colorHex: i % 2 === 0 ? 0xa78bfa : 0x6366f1,
        });
      }
      return;
    }

    if (kind === 'heal' || kind === 'levelup' || kind === 'forge' || kind === 'skill_unlock') {
      const primary =
        kind === 'heal'
          ? 0x34d399
          : kind === 'levelup'
            ? 0xfde047
            : kind === 'forge'
              ? 0xf59e0b
              : 0xc084fc;
      const count = kind === 'levelup' ? 24 : 16;

      this.spawnRing({
        x: wx,
        y: 0.12,
        z: wz,
        startRadius: 0.35,
        endRadius: kind === 'levelup' ? 3.2 : 2.1,
        riseSpeed: 1.8,
        thickness: 0.12,
        maxLife: 0.55,
        colorHex: primary,
      });

      // Ascending helical spirit particles swirling up around the hero
      for (let i = 0; i < count; i++) {
        const startAng = (i / count) * Math.PI * 2;
        this.spawnWisp({
          x: wx,
          y: 0.15 + Math.random() * 0.5,
          z: wz,
          originX: wx,
          originZ: wz,
          vy: 2.3 + Math.random() * 2.2,
          size: 0.14 + Math.random() * 0.08,
          growRate: -0.1,
          swirlRadius: 0.75 + Math.random() * 0.45,
          swirlSpeed: 6.5,
          swirlAngle: startAng,
          maxLife: 0.65 + Math.random() * 0.35,
          colorHex: i % 3 === 0 ? 0xffffff : primary,
        });
      }

      if (kind === 'forge' || kind === 'levelup') {
        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2.5 + Math.random() * 4;
          this.spawnShard({
            x: wx,
            y: 0.8,
            z: wz,
            vx: Math.cos(ang) * spd,
            vy: 3.5 + Math.random() * 4.5,
            vz: Math.sin(ang) * spd,
            scaleX: 0.06,
            scaleY: 0.06,
            scaleZ: 0.16,
            gravity: 16,
            bounce: 0.55,
            alignVelocity: true,
            maxLife: 0.55 + Math.random() * 0.3,
            colorHex: primary,
          });
        }
      }
    }
  }

  /**
   * Dramatic multi-stage 3D enemy death burst:
   * - Tumbling obsidian/armor crystal shards that bounce off the stone floor
   * - Rising spectral soul smoke plumes
   * - Ground dissolve & rift energy shockwave rings
   */
  public emitEnemyDeath(
    wx: number,
    wz: number,
    worldRadius: number,
    primaryCssColor: string,
    accentCssColor: string,
    isBoss: boolean
  ): void {
    const primaryHex = parseHexColor(primaryCssColor, 0x3b2d52);
    const accentHex = parseHexColor(accentCssColor, 0xc084fc);

    // Ground shatter & soul release rings
    this.spawnRing({
      x: wx,
      y: 0.1,
      z: wz,
      startRadius: worldRadius * 0.5,
      endRadius: isBoss ? 5.8 : Math.max(2.1, worldRadius * 3.6),
      thickness: isBoss ? 0.22 : 0.12,
      maxLife: isBoss ? 0.65 : 0.42,
      colorHex: accentHex,
    });

    if (isBoss) {
      this.spawnRing({
        x: wx,
        y: 0.4,
        z: wz,
        startRadius: 0.6,
        endRadius: 4.5,
        riseSpeed: 2.6,
        thickness: 0.16,
        maxLife: 0.6,
        colorHex: 0xfde047,
      });
    }

    // Tumbling 3D fractured armor/obsidian debris chunks with gravity & floor bounce
    const chunkCount = isBoss ? 54 : 22;
    for (let i = 0; i < chunkCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (isBoss ? 5.2 : 3.2) * (0.4 + Math.random() * 1.0);
      const isGlowingCore = i % 3 === 0;
      const sz = (isBoss ? 0.16 : 0.11) * (0.65 + Math.random() * 0.85);
      this.spawnShard({
        x: wx + (Math.random() - 0.5) * worldRadius * 0.9,
        y: 0.45 + Math.random() * (isBoss ? 1.8 : 0.95),
        z: wz + (Math.random() - 0.5) * worldRadius * 0.9,
        vx: Math.cos(ang) * spd,
        vy: 3.4 + Math.random() * (isBoss ? 6.8 : 4.2),
        vz: Math.sin(ang) * spd,
        scaleX: sz,
        scaleY: sz * (0.7 + Math.random() * 0.7),
        scaleZ: sz * (0.8 + Math.random() * 0.8),
        gravity: 20,
        drag: 0.96,
        bounce: 0.48,
        alignVelocity: false,
        maxLife: 0.55 + Math.random() * (isBoss ? 0.55 : 0.35),
        colorHex: isGlowingCore ? accentHex : i % 5 === 0 ? 0xfde047 : primaryHex,
      });
    }

    // Rising spectral soul-smoke wisps ascending out of the shattered enemy
    const wispCount = isBoss ? 24 : 11;
    for (let i = 0; i < wispCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.spawnWisp({
        x: wx + Math.cos(ang) * worldRadius * 0.5,
        y: 0.25 + Math.random() * 0.55,
        z: wz + Math.sin(ang) * worldRadius * 0.5,
        originX: wx,
        originZ: wz,
        vx: Math.cos(ang) * 0.85,
        vy: 2.0 + Math.random() * 2.4,
        vz: Math.sin(ang) * 0.85,
        size: isBoss ? 0.34 : 0.22,
        growRate: 1.15,
        swirlRadius: 0.35 + Math.random() * 0.35,
        swirlSpeed: 4.5,
        swirlAngle: ang,
        maxLife: 0.55 + Math.random() * 0.35,
        colorHex: i % 2 === 0 ? accentHex : 0xe9d5ff,
      });
    }
  }

  public emitNodeHit(wx: number, wz: number, cssColor: string, shattered: boolean): void {
    const hex = parseHexColor(cssColor, 0xcbd5e1);
    const count = shattered ? 22 : 9;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (shattered ? 4.2 : 2.6) * (0.4 + Math.random() * 0.8);
      const sz = 0.08 + Math.random() * 0.08;
      this.spawnShard({
        x: wx,
        y: 0.5 + Math.random() * 0.4,
        z: wz,
        vx: Math.cos(ang) * spd,
        vy: 3.0 + Math.random() * 3.5,
        vz: Math.sin(ang) * spd,
        scaleX: sz,
        scaleY: sz,
        scaleZ: sz * 1.3,
        gravity: 22,
        drag: 0.95,
        bounce: 0.5,
        alignVelocity: false,
        maxLife: 0.45 + Math.random() * 0.3,
        colorHex: i % 3 === 0 ? 0xfef3c7 : hex,
      });
    }
    if (shattered) {
      this.spawnRing({
        x: wx,
        y: 0.1,
        z: wz,
        startRadius: 0.25,
        endRadius: 1.85,
        thickness: 0.1,
        maxLife: 0.35,
        colorHex: hex,
      });
    }
  }

  public emitTrapBurst(wx: number, wz: number, cssColor: string): void {
    const hex = parseHexColor(cssColor, 0xfb923c);
    this.spawnRing({
      x: wx,
      y: 0.08,
      z: wz,
      startRadius: 0.2,
      endRadius: 1.4,
      thickness: 0.09,
      maxLife: 0.3,
      colorHex: hex,
    });
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.spawnShard({
        x: wx + Math.cos(ang) * 0.3,
        y: 0.15,
        z: wz + Math.sin(ang) * 0.3,
        vx: Math.cos(ang) * (1.5 + Math.random() * 2),
        vy: 3.8 + Math.random() * 3.4,
        vz: Math.sin(ang) * (1.5 + Math.random() * 2),
        scaleX: 0.045,
        scaleY: 0.045,
        scaleZ: 0.22,
        gravity: 17,
        bounce: 0.35,
        alignVelocity: true,
        maxLife: 0.35 + Math.random() * 0.2,
        colorHex: hex,
      });
    }
  }

  public emitAmbientEmber(wx: number, wy: number, wz: number, cssColor: string): void {
    const hex = parseHexColor(cssColor, 0xf59e0b);
    this.spawnWisp({
      x: wx + (Math.random() - 0.5) * 0.3,
      y: wy,
      z: wz + (Math.random() - 0.5) * 0.3,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 1.2 + Math.random() * 1.1,
      vz: (Math.random() - 0.5) * 0.5,
      size: 0.07 + Math.random() * 0.05,
      growRate: -0.05,
      maxLife: 0.7 + Math.random() * 0.5,
      colorHex: hex,
    });
  }

  public step(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);

    // Step shards with gravity, drag, tumbling spin, and floor bounce
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      if (!s.active) continue;
      s.life -= clampedDt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      const dragPow = Math.pow(s.drag, clampedDt * 60);
      s.vx *= dragPow;
      s.vz *= dragPow;
      s.vy -= s.gravity * clampedDt;

      s.x += s.vx * clampedDt;
      s.y += s.vy * clampedDt;
      s.z += s.vz * clampedDt;

      // Floor collision & damped bounce at y = 0.05
      if (s.y < 0.05) {
        s.y = 0.05;
        if (s.vy < -0.6) {
          s.vy = -s.vy * s.bounce;
          s.vx *= 0.72;
          s.vz *= 0.72;
        } else {
          s.vy = 0;
          s.vx *= 0.85;
          s.vz *= 0.85;
        }
      }

      if (!s.alignVelocity) {
        s.rotX += s.spinX * clampedDt;
        s.rotY += s.spinY * clampedDt;
        s.rotZ += s.spinZ * clampedDt;
      }
    }

    // Step wisps with optional helical swirl
    for (let i = 0; i < this.wisps.length; i++) {
      const w = this.wisps[i];
      if (!w.active) continue;
      w.life -= clampedDt;
      if (w.life <= 0) {
        w.active = false;
        continue;
      }
      w.y += w.vy * clampedDt;
      if (w.swirlRadius > 0) {
        w.swirlAngle += w.swirlSpeed * clampedDt;
        w.originX += w.vx * clampedDt;
        w.originZ += w.vz * clampedDt;
        const t = 1 - w.life / w.maxLife;
        const r = w.swirlRadius * (1 - t * 0.45);
        w.x = w.originX + Math.cos(w.swirlAngle) * r;
        w.z = w.originZ + Math.sin(w.swirlAngle) * r;
      } else {
        w.x += w.vx * clampedDt;
        w.z += w.vz * clampedDt;
        w.vx *= Math.exp(-2.4 * clampedDt);
        w.vz *= Math.exp(-2.4 * clampedDt);
      }
    }

    // Step shockwave rings
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.life -= clampedDt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      r.y += r.riseSpeed * clampedDt;
    }
  }
}
