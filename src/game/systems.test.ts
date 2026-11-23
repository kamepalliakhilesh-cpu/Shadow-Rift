import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttackTokenPool,
  applyXpGain,
  computeAttackDamage,
  computeSmartAimAngle,
  isCircleWalkable,
  moveWithDungeonCollision,
} from './combatMath';
import {
  INITIAL_MATERIALS,
  STARTER_ARMOR_ID,
  STARTER_WEAPON_ID,
  canAffordRecipe,
  executeCraft,
  getRecipeById,
} from './crafting';
import { generateDungeonFloor, isDungeonConnected } from './dungeonGen';
import { ParticlePool3D } from './particleKinematics';
import {
  SKILL_NODES,
  canUnlockSkill,
  computeSkillBonuses,
  unlockSkill,
} from './skillTree';
import type { MaterialInventory } from './types';
import { buildDungeonWallSegments } from './wallGeometry';

test('procedural dungeon generator produces connected themed floors with entrance, exit, traps, and material nodes', () => {
  const floor1 = generateDungeonFloor(1, 1001);
  const floor2 = generateDungeonFloor(2, 1001);
  const floor3 = generateDungeonFloor(3, 1001);

  assert.equal(isDungeonConnected(floor1), true);
  assert.equal(isDungeonConnected(floor2), true);
  assert.equal(isDungeonConnected(floor3), true);

  // Distinct themes across consecutive floors with same seed
  assert.notEqual(floor1.theme.id, floor2.theme.id);
  assert.notEqual(floor2.theme.id, floor3.theme.id);

  // Variable room count within expected range (4-7)
  assert.ok(floor1.rooms.length >= 4 && floor1.rooms.length <= 7);
  assert.ok(floor3.rooms.length >= 5 && floor3.rooms.length <= 7);

  // Clear entrance & exit rooms
  const entrance = floor1.rooms.find((r) => r.id === floor1.entranceRoomId);
  const exit = floor1.rooms.find((r) => r.id === floor1.exitRoomId);
  assert.ok(entrance && entrance.kind === 'entrance');
  assert.ok(exit && exit.kind === 'boss');
  assert.notEqual(floor1.entranceRoomId, floor1.exitRoomId);

  // Traps & harvestable environmental material nodes exist
  assert.ok(floor1.traps.length >= 3, 'Dungeon should place environmental traps');
  assert.ok(floor1.nodes.length >= 4, 'Dungeon should place harvestable material nodes');

  // Spawn point is strictly walkable and clear of pillars & traps
  assert.equal(
    isCircleWalkable(floor1.spawnX, floor1.spawnY, 16, floor1.walkableRects),
    true
  );
  for (const trap of floor1.traps) {
    const d = Math.hypot(trap.x - floor1.spawnX, trap.y - floor1.spawnY);
    assert.ok(d > 140, 'No trap should spawn on top of the player');
  }
});

test('crafting system enforces materials, forge proximity, gear equipping, and potions', () => {
  const richInv: MaterialInventory = {
    shadow_iron: 8,
    rift_shard: 6,
    ember_ash: 6,
    vital_essence: 5,
  };

  const cleaver = getRecipeById('weapon_obsidian_greatsword')!;
  assert.equal(canAffordRecipe(richInv, cleaver), true);

  // Cannot smith weapon away from Forge
  const awayRes = executeCraft({
    recipeId: 'weapon_obsidian_greatsword',
    inventory: richInv,
    craftedIds: [STARTER_WEAPON_ID, STARTER_ARMOR_ID],
    equippedWeaponId: STARTER_WEAPON_ID,
    equippedArmorId: STARTER_ARMOR_ID,
    atForge: false,
  });
  assert.equal(awayRes.success, false);

  // Can smith and auto-equip weapon at Forge
  const forgeRes = executeCraft({
    recipeId: 'weapon_obsidian_greatsword',
    inventory: richInv,
    craftedIds: [STARTER_WEAPON_ID, STARTER_ARMOR_ID],
    equippedWeaponId: STARTER_WEAPON_ID,
    equippedArmorId: STARTER_ARMOR_ID,
    atForge: true,
  });
  assert.equal(forgeRes.success, true);
  assert.equal(forgeRes.nextEquippedWeaponId, 'weapon_obsidian_greatsword');
  assert.equal(forgeRes.nextInventory.shadow_iron, 4);
  assert.equal(forgeRes.nextInventory.ember_ash, 4);

  // Potions can be brewed even away from Forge (field alchemy)
  const potionRes = executeCraft({
    recipeId: 'potion_siphon_flask',
    inventory: INITIAL_MATERIALS,
    craftedIds: [STARTER_WEAPON_ID, STARTER_ARMOR_ID],
    equippedWeaponId: STARTER_WEAPON_ID,
    equippedArmorId: STARTER_ARMOR_ID,
    atForge: false,
  });
  assert.equal(potionRes.success, true);
  assert.equal(potionRes.consumableTriggered?.kind, 'flask');
  assert.equal(potionRes.nextInventory.vital_essence, 0);
});

test('skill tree enforces prerequisites across Combat, Magic, and Utility branches and derives bonuses', () => {
  // Verify all 3 branches are represented
  const branches = new Set(SKILL_NODES.map((n) => n.branch));
  assert.deepEqual(branches, new Set(['combat', 'magic', 'utility']));

  // Cannot skip straight to Tier 2 without Tier 1
  assert.equal(canUnlockSkill('magic_astral_lance', [], 3), false);
  assert.equal(canUnlockSkill('magic_conduit', [], 3), true);

  const step1 = unlockSkill('magic_conduit', [], 2);
  assert.equal(step1.success, true);
  assert.equal(step1.nextPoints, 1);

  const step2 = unlockSkill('magic_astral_lance', step1.nextUnlocked, step1.nextPoints);
  assert.equal(step2.success, true);
  assert.equal(step2.nextPoints, 0);

  const bonuses = computeSkillBonuses(step2.nextUnlocked);
  assert.equal(bonuses.astralLanceUnlocked, true);
  assert.equal(bonuses.essenceGainMultiplier, 1.4);

  // Capstone unlocks once a Tier 2 prerequisite is owned and points exist
  assert.equal(canUnlockSkill('magic_singularity', step2.nextUnlocked, 1), true);
  assert.equal(canUnlockSkill('magic_singularity', step2.nextUnlocked, 0), false);
});

test('combat math calculates combo finishers, crits, frontal shields, XP leveling, and attack tokens', () => {
  const normal = computeAttackDamage({
    baseAttack: 20,
    comboStep: 1,
    attackMultiplier: 1.0,
    critChance: 0.1,
    critDamageMultiplier: 1.65,
    rngRoll: 0.9,
  });
  assert.equal(normal.damage, 20);
  assert.equal(normal.isCrit, false);

  const finisherCrit = computeAttackDamage({
    baseAttack: 20,
    comboStep: 3,
    attackMultiplier: 1.2,
    critChance: 0.5,
    critDamageMultiplier: 2.0,
    rngRoll: 0.1,
  });
  assert.equal(finisherCrit.isCrit, true);
  assert.ok(finisherCrit.damage > normal.damage * 2);

  const shielded = computeAttackDamage({
    baseAttack: 20,
    comboStep: 1,
    attackMultiplier: 1.0,
    critChance: 0,
    critDamageMultiplier: 1.65,
    rngRoll: 0.9,
    targetShieldedFront: true,
  });
  assert.equal(shielded.wasBlocked, true);
  assert.ok(shielded.damage < 12);

  // XP leveling grants level ups cleanly
  const xpRes = applyXpGain(1, 0, 130);
  assert.ok(xpRes.levelsGained >= 1);
  assert.ok(xpRes.level >= 2);

  // Attack token pool limits concurrent crowd attackers
  const pool = new AttackTokenPool(2);
  assert.equal(pool.request('e1'), true);
  assert.equal(pool.request('e2'), true);
  assert.equal(pool.request('e3'), false);
  pool.release('e1');
  assert.equal(pool.request('e3'), true);

  // Wall-sliding movement keeps actor inside walkable bounds
  const floor = generateDungeonFloor(1, 42);
  const res = moveWithDungeonCollision({
    x: floor.spawnX,
    y: floor.spawnY,
    dx: 12,
    dy: 0,
    radius: 16,
    walkableRects: floor.walkableRects,
    pillars: floor.rooms[0].pillars,
  });
  assert.equal(res.x, floor.spawnX + 12);
});

test('3D particle pool spawns weapon impact, spell cast, and enemy death bursts with gravity and floor bounce', () => {
  const pool = new ParticlePool3D(120, 60, 12);

  // 1. Weapon impact sparks & crit ring
  pool.emitWeaponImpact(0, 0, 0.5, '#f5c469', true, true, false);
  const afterImpact = pool.countActive();
  assert.ok(afterImpact.shards >= 20, 'Crit weapon impact should emit directional spark burst');
  assert.ok(afterImpact.rings >= 2, 'Crit finisher should emit tilted impact ring + floor shockwave');
  assert.ok(afterImpact.wisps >= 4, 'Crit finisher should emit rising heat wisps');

  // 2. Spell cast (Rift Nova)
  pool.clear();
  pool.emitSpellCast('nova', 2, -3, 0, '#c084fc', 4.5);
  const afterNova = pool.countActive();
  assert.ok(afterNova.shards >= 30, 'Rift Nova should emit radial arcane crystal shards');
  assert.ok(afterNova.rings >= 2, 'Rift Nova should emit staggered twin 3D shockwave rings');
  assert.ok(afterNova.wisps >= 10, 'Rift Nova should emit arcane wisps');

  // 3. Enemy death shatter + gravity & floor bounce physics
  pool.clear();
  pool.emitEnemyDeath(0, 0, 0.6, '#3b2d52', '#c084fc', false);
  const afterDeath = pool.countActive();
  assert.ok(afterDeath.shards >= 20, 'Enemy death should emit tumbling 3D debris chunks');
  assert.ok(afterDeath.wisps >= 10, 'Enemy death should emit ascending spectral soul wisps');
  assert.ok(afterDeath.rings >= 1, 'Enemy death should emit ground dissolve ring');

  // Simulate 0.6s and ensure no shard falls below the stone floor (y >= 0.05) and particles eventually expire
  for (let step = 0; step < 30; step++) {
    pool.step(0.02);
    for (const s of pool.shards) {
      if (s.active) {
        assert.ok(s.y >= 0.049, '3D debris shards must bounce on floor at y >= 0.05');
      }
    }
  }
  for (let step = 0; step < 80; step++) {
    pool.step(0.025);
  }
  const afterExpire = pool.countActive();
  assert.equal(afterExpire.shards, 0);
  assert.equal(afterExpire.wisps, 0);
  assert.equal(afterExpire.rings, 0);
});

test('3D dungeon wall builder frames rooms and corridors without blocking any corridor doorway', () => {
  const floor = generateDungeonFloor(2, 2025);
  const segments = buildDungeonWallSegments(floor, 28);
  assert.ok(segments.length >= floor.rooms.length * 4, 'Should generate outer masonry walls for all rooms');

  // Ensure no generated wall segment overlaps the center line of any corridor doorway
  for (const corridor of floor.corridors) {
    const cx = corridor.rect.x + corridor.rect.w / 2;
    const cy = corridor.rect.y + corridor.rect.h / 2;
    for (const seg of segments) {
      const overlapsCenter =
        cx > seg.x + 1 &&
        cx < seg.x + seg.w - 1 &&
        cy > seg.y + 1 &&
        cy < seg.y + seg.h - 1;
      assert.equal(
        overlapsCenter,
        false,
        `Wall segment (${seg.x},${seg.y},${seg.w},${seg.h}) must never block corridor center (${cx},${cy})`
      );
    }
  }
});

import { ShadowRiftAudio } from './audio';
import { askVoidOracle, getStoredGeminiKey, setStoredGeminiKey } from './oracleAI';

test('mobile smart auto-aim prioritizes nearest enemy, then nearby material node, then joystick vector', () => {
  // 1. Nearest enemy within range wins over farther enemy & joystick direction
  const angEnemy = computeSmartAimAngle({
    playerX: 100,
    playerY: 100,
    currentAim: 0,
    moveX: 0,
    moveY: -1,
    enemies: [
      { x: 350, y: 100 },
      { x: 100, y: 220 }, // 120px south (+PI/2)
    ],
    nodes: [{ x: 130, y: 100 }],
  });
  assert.ok(Math.abs(angEnemy - Math.PI / 2) < 0.001);

  // 2. When no enemies are in range, nearest harvestable node within 155px is targeted
  const angNode = computeSmartAimAngle({
    playerX: 100,
    playerY: 100,
    currentAim: 0,
    moveX: 0,
    moveY: -1,
    enemies: [{ x: 900, y: 900 }],
    nodes: [{ x: 20, y: 100 }], // 80px west (PI)
  });
  assert.ok(Math.abs(Math.abs(angNode) - Math.PI) < 0.001);

  // 3. When no targets are nearby, falls back to virtual joystick angle
  const angStick = computeSmartAimAngle({
    playerX: 100,
    playerY: 100,
    currentAim: 0,
    moveX: 0,
    moveY: -0.9,
    enemies: [],
    nodes: [],
  });
  assert.ok(Math.abs(angStick + Math.PI / 2) < 0.001);
});

test('procedural audio handles master, sfx, and music volume clamping & mute state', () => {
  const audio = new ShadowRiftAudio();
  assert.equal(audio.isMuted(), false);

  audio.toggleMute();
  assert.equal(audio.isMuted(), true);

  audio.setMuted(false);
  assert.equal(audio.isMuted(), false);

  audio.setMasterVolume(1.5); // Should clamp to 1
  assert.equal(audio.getMasterVolume(), 1);

  audio.setMasterVolume(-0.5); // Should clamp to 0
  assert.equal(audio.getMasterVolume(), 0);

  audio.setSfxVolume(0.75);
  assert.equal(audio.getSfxVolume(), 0.75);

  audio.setMusicVolume(0.4);
  assert.equal(audio.getMusicVolume(), 0.4);

  audio.destroy();
});

test('void oracle provides atmospheric prophecy and persists key correctly', async () => {
  // Test fallback rune prophecy
  const oracleResult = await askVoidOracle({
    floorNumber: 2,
    themeId: 'ember_forge',
    themeName: 'Ember Forge',
    roomKind: 'combat',
    level: 3,
    kills: 14,
    hpPct: 0.85,
  });

  assert.ok(oracleResult.text.length > 10);
  assert.equal(oracleResult.source, 'rune_cache');

  // Test key setter/getter
  setStoredGeminiKey('test-mock-key-12345');
  assert.equal(getStoredGeminiKey(), 'test-mock-key-12345');

  // Clear key
  setStoredGeminiKey('');
  assert.equal(getStoredGeminiKey(), '');
});



