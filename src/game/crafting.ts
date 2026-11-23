import type { CraftingRecipe, MaterialId, MaterialInventory } from './types';

export interface MaterialMeta {
  id: MaterialId;
  name: string;
  shortName: string;
  color: string;
  source: string;
}

export const MATERIALS: Record<MaterialId, MaterialMeta> = {
  shadow_iron: {
    id: 'shadow_iron',
    name: 'Shadow Iron',
    shortName: 'Iron',
    color: '#94a3b8',
    source: 'Ore veins & Sentinels',
  },
  rift_shard: {
    id: 'rift_shard',
    name: 'Rift Shard',
    shortName: 'Shard',
    color: '#a78bfa',
    source: 'Astral crystals & Acolytes',
  },
  ember_ash: {
    id: 'ember_ash',
    name: 'Ember Ash',
    shortName: 'Ash',
    color: '#fb923c',
    source: 'Ember urns & Stalkers',
  },
  vital_essence: {
    id: 'vital_essence',
    name: 'Vital Essence',
    shortName: 'Vital',
    color: '#34d399',
    source: 'Shrines & fallen foes',
  },
};

export const MATERIAL_LIST: MaterialId[] = [
  'shadow_iron',
  'rift_shard',
  'ember_ash',
  'vital_essence',
];

export const INITIAL_MATERIALS: MaterialInventory = {
  shadow_iron: 2,
  rift_shard: 1,
  ember_ash: 2,
  vital_essence: 2,
};

export const STARTER_WEAPON_ID = 'weapon_shadowfang';
export const STARTER_ARMOR_ID = 'armor_drifter';

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // WEAPONS
  {
    id: STARTER_WEAPON_ID,
    name: 'Shadowfang Blade',
    slot: 'weapon',
    description: 'Balanced obsidian steel carried by initiates of the Rift.',
    statSummary: 'Base Blade · +0 ATK',
    cost: {},
    accent: '#e5b96c',
    weaponStats: {
      bonusAttack: 0,
      bonusCrit: 0,
      reachMultiplier: 1.0,
      essenceGainBonus: 0,
      bladeColor: '#f5c469',
    },
  },
  {
    id: 'weapon_obsidian_greatsword',
    name: 'Obsidian Cleaver',
    slot: 'weapon',
    description: 'Heavy forged basalt blade with wider sweeping arcs.',
    statSummary: '+14 ATK · +18% Reach',
    cost: { shadow_iron: 4, ember_ash: 2 },
    accent: '#fb923c',
    weaponStats: {
      bonusAttack: 14,
      bonusCrit: 0.05,
      reachMultiplier: 1.18,
      essenceGainBonus: 0,
      bladeColor: '#fb923c',
    },
  },
  {
    id: 'weapon_astral_edge',
    name: 'Astral Edge',
    slot: 'weapon',
    description: 'Crystalline edge resonating with dimensional essence.',
    statSummary: '+11 ATK · +18% Crit · +30% Essence',
    cost: { shadow_iron: 3, rift_shard: 4 },
    accent: '#a78bfa',
    weaponStats: {
      bonusAttack: 11,
      bonusCrit: 0.18,
      reachMultiplier: 1.08,
      essenceGainBonus: 0.3,
      bladeColor: '#c084fc',
    },
  },
  {
    id: 'weapon_sovereign_riftblade',
    name: 'Sovereign Riftblade',
    slot: 'weapon',
    description: 'Masterwork relic that unleashes a piercing shadow wave on combo finishers.',
    statSummary: '+24 ATK · +15% Crit · Finisher Wave',
    cost: { shadow_iron: 6, rift_shard: 5, ember_ash: 4 },
    accent: '#f5c469',
    weaponStats: {
      bonusAttack: 24,
      bonusCrit: 0.15,
      reachMultiplier: 1.22,
      essenceGainBonus: 0.25,
      bladeColor: '#fde047',
      waveOnFinisher: true,
    },
  },

  // ARMOR
  {
    id: STARTER_ARMOR_ID,
    name: 'Drifter Cloak',
    slot: 'armor',
    description: 'Weathered shadowcloth woven for swift passage.',
    statSummary: 'Base Mantle · +0 HP',
    cost: {},
    accent: '#94a3b8',
    armorStats: {
      bonusMaxHp: 0,
      damageReduction: 0,
      moveSpeedBonus: 0,
      bonusDashCharges: 0,
      cloakColor: '#3b3454',
    },
  },
  {
    id: 'armor_basalt_plate',
    name: 'Basalt Wardplate',
    slot: 'armor',
    description: 'Layered obsidian pauldrons that blunt heavy dungeon blows.',
    statSummary: '+45 Max HP · 18% Armor',
    cost: { shadow_iron: 4, vital_essence: 2 },
    accent: '#94a3b8',
    armorStats: {
      bonusMaxHp: 45,
      damageReduction: 0.18,
      moveSpeedBonus: 0,
      bonusDashCharges: 0,
      cloakColor: '#475569',
    },
  },
  {
    id: 'armor_phantom_shroud',
    name: 'Phantom Shroud',
    slot: 'armor',
    description: 'Phase-woven mantle granting swift stride and an extra Shadow Dash.',
    statSummary: '+25 Max HP · +14% Speed · +1 Dash',
    cost: { rift_shard: 3, ember_ash: 3 },
    accent: '#a78bfa',
    armorStats: {
      bonusMaxHp: 25,
      damageReduction: 0.08,
      moveSpeedBonus: 0.14,
      bonusDashCharges: 1,
      cloakColor: '#5b3c88',
    },
  },

  // CONSUMABLES & POTIONS
  {
    id: 'potion_siphon_flask',
    name: 'Siphon Flask',
    slot: 'consumable',
    description: 'Distills Vital Essence into a healing draught (+1 Flask charge).',
    statSummary: '+1 Heal Charge (45% HP on [E])',
    cost: { vital_essence: 2, ember_ash: 1 },
    accent: '#34d399',
    consumableEffect: {
      kind: 'flask',
      value: 1,
    },
  },
  {
    id: 'potion_aegis_ward',
    name: 'Aegis Wardstone',
    slot: 'consumable',
    description: 'Encases you in an absorbing arcane barrier until shattered.',
    statSummary: '+45 Arcane Shield',
    cost: { shadow_iron: 2, rift_shard: 1 },
    accent: '#60a5fa',
    consumableEffect: {
      kind: 'aegis_ward',
      value: 45,
    },
  },
  {
    id: 'potion_fury_elixir',
    name: 'Ember Fury Elixir',
    slot: 'consumable',
    description: 'Volatile draught granting +35% Attack Damage for 35 seconds.',
    statSummary: '+35% ATK for 35s',
    cost: { ember_ash: 2, vital_essence: 1 },
    accent: '#f97316',
    consumableEffect: {
      kind: 'fury_elixir',
      value: 0.35,
      duration: 35,
    },
  },
];

export function getRecipeById(id: string): CraftingRecipe | undefined {
  return CRAFTING_RECIPES.find((r) => r.id === id);
}

export function canAffordRecipe(
  inventory: MaterialInventory,
  recipe: CraftingRecipe
): boolean {
  for (const [mat, qty] of Object.entries(recipe.cost)) {
    if ((qty ?? 0) > (inventory[mat as MaterialId] ?? 0)) {
      return false;
    }
  }
  return true;
}

export function deductRecipeCost(
  inventory: MaterialInventory,
  recipe: CraftingRecipe
): MaterialInventory {
  const next: MaterialInventory = { ...inventory };
  for (const [mat, qty] of Object.entries(recipe.cost)) {
    const key = mat as MaterialId;
    next[key] = Math.max(0, (next[key] ?? 0) - (qty ?? 0));
  }
  return next;
}

export interface CraftResult {
  success: boolean;
  reason?: string;
  nextInventory: MaterialInventory;
  nextCraftedIds: string[];
  nextEquippedWeaponId: string;
  nextEquippedArmorId: string;
  consumableTriggered?: CraftingRecipe['consumableEffect'];
}

export function executeCraft(params: {
  recipeId: string;
  inventory: MaterialInventory;
  craftedIds: string[];
  equippedWeaponId: string;
  equippedArmorId: string;
  atForge: boolean;
}): CraftResult {
  const recipe = getRecipeById(params.recipeId);
  if (!recipe) {
    return {
      success: false,
      reason: 'Recipe not found',
      nextInventory: params.inventory,
      nextCraftedIds: params.craftedIds,
      nextEquippedWeaponId: params.equippedWeaponId,
      nextEquippedArmorId: params.equippedArmorId,
    };
  }

  // Already crafted gear can simply be re-equipped anywhere at zero cost
  if (recipe.slot !== 'consumable' && params.craftedIds.includes(recipe.id)) {
    return {
      success: true,
      nextInventory: params.inventory,
      nextCraftedIds: params.craftedIds,
      nextEquippedWeaponId:
        recipe.slot === 'weapon' ? recipe.id : params.equippedWeaponId,
      nextEquippedArmorId:
        recipe.slot === 'armor' ? recipe.id : params.equippedArmorId,
    };
  }

  // Smithing weapons/armor requires standing near the Rift Forge (potions can be brewed in the field too)
  if (recipe.slot !== 'consumable' && !params.atForge) {
    return {
      success: false,
      reason: 'Stand near the Rift Forge to smith weapons and armor',
      nextInventory: params.inventory,
      nextCraftedIds: params.craftedIds,
      nextEquippedWeaponId: params.equippedWeaponId,
      nextEquippedArmorId: params.equippedArmorId,
    };
  }

  if (!canAffordRecipe(params.inventory, recipe)) {
    return {
      success: false,
      reason: 'Insufficient materials',
      nextInventory: params.inventory,
      nextCraftedIds: params.craftedIds,
      nextEquippedWeaponId: params.equippedWeaponId,
      nextEquippedArmorId: params.equippedArmorId,
    };
  }

  const nextInventory = deductRecipeCost(params.inventory, recipe);
  if (recipe.slot === 'consumable') {
    return {
      success: true,
      nextInventory,
      nextCraftedIds: params.craftedIds,
      nextEquippedWeaponId: params.equippedWeaponId,
      nextEquippedArmorId: params.equippedArmorId,
      consumableTriggered: recipe.consumableEffect,
    };
  }

  const nextCraftedIds = params.craftedIds.includes(recipe.id)
    ? params.craftedIds
    : [...params.craftedIds, recipe.id];

  return {
    success: true,
    nextInventory,
    nextCraftedIds,
    nextEquippedWeaponId:
      recipe.slot === 'weapon' ? recipe.id : params.equippedWeaponId,
    nextEquippedArmorId:
      recipe.slot === 'armor' ? recipe.id : params.equippedArmorId,
  };
}
