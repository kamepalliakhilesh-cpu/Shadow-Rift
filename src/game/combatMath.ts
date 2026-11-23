import type { Rect } from './types';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function xpRequiredForLevel(level: number): number {
  return Math.round(55 + (level - 1) * 40 + Math.pow(level - 1, 1.35) * 18);
}

export function applyXpGain(
  currentLevel: number,
  currentXp: number,
  gainedXp: number
): { level: number; xp: number; levelsGained: number; xpToNext: number } {
  let level = currentLevel;
  let xp = currentXp + gainedXp;
  let levelsGained = 0;

  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level++;
    levelsGained++;
  }

  return {
    level,
    xp,
    levelsGained,
    xpToNext: xpRequiredForLevel(level),
  };
}

export interface DamageCalcInput {
  baseAttack: number;
  comboStep: 1 | 2 | 3;
  attackMultiplier: number;
  critChance: number;
  critDamageMultiplier: number;
  rngRoll: number;
  targetShieldedFront?: boolean;
  bypassShield?: boolean;
}

export interface DamageCalcResult {
  damage: number;
  isCrit: boolean;
  wasBlocked: boolean;
}

export function computeAttackDamage(input: DamageCalcInput): DamageCalcResult {
  const comboMult =
    input.comboStep === 3 ? 1.45 : input.comboStep === 2 ? 1.12 : 1.0;
  const isCrit = input.rngRoll < input.critChance;
  let raw = input.baseAttack * comboMult * input.attackMultiplier;
  if (isCrit) {
    raw *= input.critDamageMultiplier;
  }
  const wasBlocked = Boolean(input.targetShieldedFront && !input.bypassShield);
  if (wasBlocked) {
    raw *= 0.42;
  }
  return {
    damage: Math.max(1, Math.round(raw)),
    isCrit,
    wasBlocked,
  };
}

export function isPointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function isCircleWalkable(
  x: number,
  y: number,
  radius: number,
  walkableRects: ReadonlyArray<Rect>,
  lockedRoomBounds?: Rect | null
): boolean {
  if (lockedRoomBounds) {
    return (
      x - radius >= lockedRoomBounds.x + 8 &&
      x + radius <= lockedRoomBounds.x + lockedRoomBounds.w - 8 &&
      y - radius >= lockedRoomBounds.y + 8 &&
      y + radius <= lockedRoomBounds.y + lockedRoomBounds.h - 8
    );
  }

  const pts = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];

  for (const [px, py] of pts) {
    let insideAny = false;
    for (let i = 0; i < walkableRects.length; i++) {
      if (isPointInRect(px, py, walkableRects[i])) {
        insideAny = true;
        break;
      }
    }
    if (!insideAny) return false;
  }
  return true;
}

export function resolveCircleRectPush(
  cx: number,
  cy: number,
  radius: number,
  rect: Rect
): { x: number; y: number; collided: boolean } {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) {
    return { x: cx, y: cy, collided: false };
  }

  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const overlap = radius - dist;
    return {
      x: cx + (dx / dist) * overlap,
      y: cy + (dy / dist) * overlap,
      collided: true,
    };
  }

  // Center inside rect: push out along nearest edge
  const leftPen = cx - rect.x;
  const rightPen = rect.x + rect.w - cx;
  const topPen = cy - rect.y;
  const bottomPen = rect.y + rect.h - cy;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
  if (minPen === leftPen) return { x: rect.x - radius, y: cy, collided: true };
  if (minPen === rightPen) return { x: rect.x + rect.w + radius, y: cy, collided: true };
  if (minPen === topPen) return { x: cx, y: rect.y - radius, collided: true };
  return { x: cx, y: rect.y + rect.h + radius, collided: true };
}

export function moveWithDungeonCollision(params: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  walkableRects: ReadonlyArray<Rect>;
  pillars: ReadonlyArray<Rect>;
  lockedRoomBounds?: Rect | null;
}): { x: number; y: number; hitWall: boolean } {
  let nx = params.x;
  let ny = params.y;
  let hitWall = false;

  // Axis-separated movement allows crisp wall sliding
  if (isCircleWalkable(nx + params.dx, ny, params.radius, params.walkableRects, params.lockedRoomBounds)) {
    nx += params.dx;
  } else {
    hitWall = true;
  }

  if (isCircleWalkable(nx, ny + params.dy, params.radius, params.walkableRects, params.lockedRoomBounds)) {
    ny += params.dy;
  } else {
    hitWall = true;
  }

  // Push out of interior pillars
  for (let i = 0; i < params.pillars.length; i++) {
    const res = resolveCircleRectPush(nx, ny, params.radius, params.pillars[i]);
    if (res.collided) {
      nx = res.x;
      ny = res.y;
      hitWall = true;
    }
  }

  return { x: nx, y: ny, hitWall };
}

export class AttackTokenPool {
  private readonly maxTokens: number;
  private holders = new Set<string>();

  constructor(maxTokens = 3) {
    this.maxTokens = maxTokens;
  }

  request(entityId: string): boolean {
    if (this.holders.has(entityId)) return true;
    if (this.holders.size >= this.maxTokens) return false;
    this.holders.add(entityId);
    return true;
  }

  release(entityId: string): void {
    this.holders.delete(entityId);
  }

  clear(): void {
    this.holders.clear();
  }

  activeCount(): number {
    return this.holders.size;
  }
}

export interface AimTargetPoint {
  x: number;
  y: number;
}

/**
 * Computes mobile/touch auto-aim angle:
 * 1. Prioritizes the nearest living enemy within enemyRange (default 360px).
 * 2. Otherwise aims toward the nearest harvestable material node within nodeRange (default 155px).
 * 3. Otherwise follows the virtual joystick direction if actively pushed, else preserves currentAim.
 */
export function computeSmartAimAngle(params: {
  playerX: number;
  playerY: number;
  currentAim: number;
  moveX: number;
  moveY: number;
  enemies: ReadonlyArray<AimTargetPoint>;
  nodes?: ReadonlyArray<AimTargetPoint>;
  enemyRange?: number;
  nodeRange?: number;
}): number {
  const maxEnemyDist = params.enemyRange ?? 360;
  let bestEnemyDist = maxEnemyDist;
  let bestEnemy: AimTargetPoint | null = null;

  for (let i = 0; i < params.enemies.length; i++) {
    const e = params.enemies[i];
    const d = Math.hypot(e.x - params.playerX, e.y - params.playerY);
    if (d < bestEnemyDist) {
      bestEnemyDist = d;
      bestEnemy = e;
    }
  }
  if (bestEnemy) {
    return Math.atan2(bestEnemy.y - params.playerY, bestEnemy.x - params.playerX);
  }

  if (params.nodes && params.nodes.length > 0) {
    const maxNodeDist = params.nodeRange ?? 155;
    let bestNodeDist = maxNodeDist;
    let bestNode: AimTargetPoint | null = null;
    for (let i = 0; i < params.nodes.length; i++) {
      const n = params.nodes[i];
      const d = Math.hypot(n.x - params.playerX, n.y - params.playerY);
      if (d < bestNodeDist) {
        bestNodeDist = d;
        bestNode = n;
      }
    }
    if (bestNode) {
      return Math.atan2(bestNode.y - params.playerY, bestNode.x - params.playerX);
    }
  }

  if (Math.hypot(params.moveX, params.moveY) > 0.15) {
    return Math.atan2(params.moveY, params.moveX);
  }

  return params.currentAim;
}

