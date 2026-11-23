import type { DungeonTheme, DungeonThemeId } from './types';

export const DUNGEON_THEMES: Record<DungeonThemeId, DungeonTheme> = {
  obsidian_catacombs: {
    id: 'obsidian_catacombs',
    name: 'Obsidian Catacombs',
    subtitle: 'Fractured basalt vaults above the seam',
    voidBg: '#0b0912',
    floorPrimary: '#1c1926',
    floorSecondary: '#221f2e',
    floorGrout: '#12101a',
    wallTop: '#2a2538',
    wallFace: '#161320',
    wallHighlight: '#504569',
    accentColor: '#c99b52',
    torchColor: '#f59e0b',
    ambientGlow: 'rgba(157, 127, 247, 0.08)',
    trapTypes: ['spikes', 'shadow_snare'],
    materialBias: 'shadow_iron',
  },
  ember_forge: {
    id: 'ember_forge',
    name: 'Ember Foundry',
    subtitle: 'Sunken smelteries of molten rift slag',
    voidBg: '#120a0a',
    floorPrimary: '#24191b',
    floorSecondary: '#2c1f21',
    floorGrout: '#170f10',
    wallTop: '#382527',
    wallFace: '#1e1315',
    wallHighlight: '#7a493c',
    accentColor: '#f97316',
    torchColor: '#fb923c',
    ambientGlow: 'rgba(249, 115, 22, 0.09)',
    trapTypes: ['void_geyser', 'spikes'],
    materialBias: 'ember_ash',
  },
  astral_sanctum: {
    id: 'astral_sanctum',
    name: 'Astral Sanctum',
    subtitle: 'Shattered observatory of violet stone',
    voidBg: '#0b0916',
    floorPrimary: '#1b1830',
    floorSecondary: '#231f3d',
    floorGrout: '#110f21',
    wallTop: '#312b54',
    wallFace: '#17142b',
    wallHighlight: '#6d5db5',
    accentColor: '#a78bfa',
    torchColor: '#c084fc',
    ambientGlow: 'rgba(167, 139, 250, 0.11)',
    trapTypes: ['void_geyser', 'shadow_snare'],
    materialBias: 'rift_shard',
  },
  blighted_crypt: {
    id: 'blighted_crypt',
    name: 'Blighted Ossuary',
    subtitle: 'Overgrown tombs seeped in jade mist',
    voidBg: '#09110f',
    floorPrimary: '#172320',
    floorSecondary: '#1d2c28',
    floorGrout: '#0f1715',
    wallTop: '#263b35',
    wallFace: '#121f1c',
    wallHighlight: '#4b786a',
    accentColor: '#34d399',
    torchColor: '#2dd4bf',
    ambientGlow: 'rgba(52, 211, 153, 0.09)',
    trapTypes: ['shadow_snare', 'spikes', 'void_geyser'],
    materialBias: 'vital_essence',
  },
};

export const THEME_ORDER: DungeonThemeId[] = [
  'obsidian_catacombs',
  'ember_forge',
  'astral_sanctum',
  'blighted_crypt',
];

export function getThemeForFloor(floorNumber: number, seed = 0): DungeonTheme {
  const index = Math.abs(floorNumber - 1 + seed) % THEME_ORDER.length;
  return DUNGEON_THEMES[THEME_ORDER[index]];
}
