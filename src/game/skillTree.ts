import type { DerivedSkillBonuses, SkillBranch, SkillNode } from './types';

export const SKILL_BRANCH_META: Record<
  SkillBranch,
  { name: string; color: string; subtitle: string }
> = {
  combat: {
    name: 'Combat',
    color: '#e5a94c',
    subtitle: 'Blade mastery, cleaves & execution',
  },
  magic: {
    name: 'Magic',
    color: '#a78bfa',
    subtitle: 'Rift Essence, Nova & Astral Lance',
  },
  utility: {
    name: 'Utility',
    color: '#34d399',
    subtitle: 'Shadow Dash, decoys & scavenging',
  },
};

export const SKILL_NODES: SkillNode[] = [
  // COMBAT BRANCH
  {
    id: 'combat_keen_edge',
    branch: 'combat',
    tier: 1,
    column: 0,
    name: 'Keen Edge',
    kind: 'passive',
    summary: '+20% Slash Damage and +8% Critical Strike chance.',
    prerequisites: [],
    cost: 1,
  },
  {
    id: 'combat_whirlwind',
    branch: 'combat',
    tier: 2,
    column: -1,
    name: 'Whirlwind Finisher',
    kind: 'passive',
    summary: 'Your 3rd combo strike sweeps 360° around you with heavy knockback.',
    prerequisites: ['combat_keen_edge'],
    cost: 1,
  },
  {
    id: 'combat_bloodlust',
    branch: 'combat',
    tier: 2,
    column: 1,
    name: 'Siphon Edge',
    kind: 'passive',
    summary: 'Slaying an enemy restores +7 HP immediately.',
    prerequisites: ['combat_keen_edge'],
    cost: 1,
  },
  {
    id: 'combat_executioner',
    branch: 'combat',
    tier: 3,
    column: 0,
    name: 'Executioner Rift',
    kind: 'passive',
    summary: 'Critical strikes deal 2.15× damage and trigger a crimson shockwave.',
    prerequisites: ['combat_whirlwind', 'combat_bloodlust'],
    cost: 1,
  },

  // MAGIC BRANCH
  {
    id: 'magic_conduit',
    branch: 'magic',
    tier: 1,
    column: 0,
    name: 'Essence Conduit',
    kind: 'passive',
    summary: '+40% Rift Essence generated from sword strikes and soul orbs.',
    prerequisites: [],
    cost: 1,
  },
  {
    id: 'magic_astral_lance',
    branch: 'magic',
    tier: 2,
    column: -1,
    name: 'Astral Lance',
    kind: 'active',
    summary: 'Unlocks Active Skill [V]: fire a piercing arcane beam toward cursor.',
    prerequisites: ['magic_conduit'],
    cost: 1,
  },
  {
    id: 'magic_supernova',
    branch: 'magic',
    tier: 2,
    column: 1,
    name: 'Supernova',
    kind: 'passive',
    summary: 'Rift Nova [Q] gains +35% radius, +35% damage, and stuns foes for 1.2s.',
    prerequisites: ['magic_conduit'],
    cost: 1,
  },
  {
    id: 'magic_singularity',
    branch: 'magic',
    tier: 3,
    column: 0,
    name: 'Void Singularity',
    kind: 'passive',
    summary: 'Rift Nova pulls nearby foes inward and hits with +25% bonus arcane blast.',
    prerequisites: ['magic_astral_lance', 'magic_supernova'],
    cost: 1,
  },

  // UTILITY BRANCH
  {
    id: 'utility_fleetfoot',
    branch: 'utility',
    tier: 1,
    column: 0,
    name: 'Fleetfoot',
    kind: 'passive',
    summary: '+12% Movement Speed and -20% Shadow Dash recharge time.',
    prerequisites: [],
    cost: 1,
  },
  {
    id: 'utility_shadow_clone',
    branch: 'utility',
    tier: 2,
    column: -1,
    name: 'Shadow Decoy',
    kind: 'active',
    summary: 'Shadow Dash leaves an unstable phantom that detonates after 0.65s.',
    prerequisites: ['utility_fleetfoot'],
    cost: 1,
  },
  {
    id: 'utility_scavenger',
    branch: 'utility',
    tier: 2,
    column: 1,
    name: 'Rift Scavenger',
    kind: 'passive',
    summary: '+45% bonus Material drop rate and +65% pickup magnet radius.',
    prerequisites: ['utility_fleetfoot'],
    cost: 1,
  },
  {
    id: 'utility_phase_step',
    branch: 'utility',
    tier: 3,
    column: 0,
    name: 'Phase Step',
    kind: 'passive',
    summary: '+1 Max Dash Charge; dashing through foes deals shadow damage & restores Essence.',
    prerequisites: ['utility_shadow_clone', 'utility_scavenger'],
    cost: 1,
  },
];

export function getSkillNode(id: string): SkillNode | undefined {
  return SKILL_NODES.find((n) => n.id === id);
}

/**
 * Tier 3 capstone requires at least ONE of its Tier 2 prerequisites so players can
 * specialize down either sub-path without being forced to buy both Tier 2 nodes.
 */
export function arePrerequisitesMet(
  node: SkillNode,
  unlockedIds: ReadonlyArray<string>
): boolean {
  if (node.prerequisites.length === 0) return true;
  if (node.tier === 3) {
    return node.prerequisites.some((req) => unlockedIds.includes(req));
  }
  return node.prerequisites.every((req) => unlockedIds.includes(req));
}

export function canUnlockSkill(
  nodeId: string,
  unlockedIds: ReadonlyArray<string>,
  availablePoints: number
): boolean {
  const node = getSkillNode(nodeId);
  if (!node) return false;
  if (unlockedIds.includes(node.id)) return false;
  if (availablePoints < node.cost) return false;
  return arePrerequisitesMet(node, unlockedIds);
}

export function unlockSkill(
  nodeId: string,
  unlockedIds: ReadonlyArray<string>,
  availablePoints: number
): { success: boolean; nextUnlocked: string[]; nextPoints: number } {
  if (!canUnlockSkill(nodeId, unlockedIds, availablePoints)) {
    return {
      success: false,
      nextUnlocked: [...unlockedIds],
      nextPoints: availablePoints,
    };
  }
  const node = getSkillNode(nodeId)!;
  return {
    success: true,
    nextUnlocked: [...unlockedIds, node.id],
    nextPoints: availablePoints - node.cost,
  };
}

export function computeSkillBonuses(
  unlockedIds: ReadonlyArray<string>
): DerivedSkillBonuses {
  const has = (id: string) => unlockedIds.includes(id);

  return {
    attackMultiplier: has('combat_keen_edge') ? 1.2 : 1.0,
    critChanceBonus: has('combat_keen_edge') ? 0.08 : 0,
    critDamageMultiplier: has('combat_executioner') ? 2.15 : 1.65,
    whirlwindFinisher: has('combat_whirlwind'),
    bloodlustOnKill: has('combat_bloodlust'),
    executionerShockwave: has('combat_executioner'),
    essenceGainMultiplier: has('magic_conduit') ? 1.4 : 1.0,
    astralLanceUnlocked: has('magic_astral_lance'),
    novaRadiusMultiplier: has('magic_supernova') ? 1.35 : 1.0,
    novaDamageMultiplier:
      (has('magic_supernova') ? 1.35 : 1.0) *
      (has('magic_singularity') ? 1.25 : 1.0),
    novaStunDuration: has('magic_supernova') ? 1.2 : 0.35,
    voidSingularity: has('magic_singularity'),
    moveSpeedMultiplier: has('utility_fleetfoot') ? 1.12 : 1.0,
    dashCooldownMultiplier: has('utility_fleetfoot') ? 0.8 : 1.0,
    shadowCloneOnDash: has('utility_shadow_clone'),
    materialDropBonus: has('utility_scavenger') ? 0.45 : 0,
    pickupMagnetMultiplier: has('utility_scavenger') ? 1.65 : 1.0,
    bonusDashCharges: has('utility_phase_step') ? 1 : 0,
    phaseStepDamage: has('utility_phase_step'),
  };
}
