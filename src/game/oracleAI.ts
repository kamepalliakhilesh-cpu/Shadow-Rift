import { GoogleGenAI } from '@google/genai';

const STORAGE_API_KEY = 'shadow_rift_gemini_api_key';
let memoryFallbackKey = '';

export function getStoredGeminiKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const custom = localStorage.getItem(STORAGE_API_KEY);
      if (custom) return custom.trim();
    }
  } catch {
    // Ignore storage errors in restricted or test environments
  }
  if (memoryFallbackKey) return memoryFallbackKey;

  const envKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY);
  return typeof envKey === 'string' ? envKey.trim() : '';
}

export function setStoredGeminiKey(key: string): void {
  const trimmed = key.trim();
  memoryFallbackKey = trimmed;
  try {
    if (typeof localStorage !== 'undefined') {
      if (trimmed) {
        localStorage.setItem(STORAGE_API_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_API_KEY);
      }
    }
  } catch {
    // Ignore storage errors in restricted or test environments
  }
}

// Built-in ancient runes fallback when offline or no API key configured
const FALLBACK_PROPHECIES: Record<string, string[]> = {
  obsidian_catacombs: [
    'The obsidian walls absorb your footsteps, but not your heartbeat. Beware the stone that watches.',
    'Where spikes recede into stone, the shadow acolytes gather their crimson tithe. Dash through the seam.',
    'A cold gale rises from the lower crypts. Conserve your flask; steel alone will not mend what is sundered.',
  ],
  ember_forge: [
    'The hearth fire of the Sovereign hungers for slag. Gather ember ash before approaching the anvils.',
    'Molten iron flows like blood beneath the floor tiles. The geysers erupt on a steady cadence—count three breaths.',
    'The weapons forged here carry the heat of ancient stars. Strike with conviction, or be consumed by the blast.',
  ],
  astral_sanctum: [
    'The astral rift blurs reality and reflection. The Astral Lance penetrates multiple foes in a single celestial line.',
    'Spectral sentinels fear the radiance of the Rift Nova. Shatter their wards before they invoke the singularity.',
    'Time bends where starlight touches void dust. Keep moving, for still targets belong to the void.',
  ],
  blighted_crypt: [
    'Decay here is conscious. Slay the acolytes first, lest they resurrect the bone-gilded stalkers.',
    'Malakor waits in the deepest fold of the rift. Guard your flanks, for the Sovereign strikes with twin shadow blades.',
    'The miasma slows both blade and breath. Cleanse your path with rapid consecutive dash strikes.',
  ],
};

export async function askVoidOracle(params: {
  floorNumber: number;
  themeId: string;
  themeName: string;
  roomKind: string;
  level: number;
  kills: number;
  hpPct: number;
}): Promise<{ text: string; source: 'gemini' | 'rune_cache' }> {
  const apiKey = getStoredGeminiKey();

  if (!apiKey) {
    const list = FALLBACK_PROPHECIES[params.themeId] || FALLBACK_PROPHECIES.obsidian_catacombs;
    const randomPick = list[Math.floor(Math.random() * list.length)];
    return {
      text: randomPick,
      source: 'rune_cache',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are the ancient Void Oracle whispering to a wandering warrior inside the procedural dark fantasy RPG "Shadow Rift".
Floor: ${params.floorNumber} (${params.themeName})
Current Room: ${params.roomKind}
Warrior Level: ${params.level}, Slain: ${params.kills}, Health: ${Math.round(params.hpPct * 100)}%

Provide a brief (1 to 2 sentences maximum), cryptic, dark-fantasy prophecy or tactical clue suited for this floor and the looming confrontation with Sovereign Malakor. Speak in an ominous, mythic, eldritch tone. Avoid cheerful greetings.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const candidateText = response.text?.trim();
    if (candidateText) {
      return { text: candidateText, source: 'gemini' };
    }
  } catch (err) {
    console.warn('Gemini Void Oracle query failed, using rune prophecy fallback:', err);
  }

  const list = FALLBACK_PROPHECIES[params.themeId] || FALLBACK_PROPHECIES.obsidian_catacombs;
  const randomPick = list[Math.floor(Math.random() * list.length)];
  return {
    text: randomPick,
    source: 'rune_cache',
  };
}

export async function generateForgeItemLore(itemName: string, slot: string): Promise<string> {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) {
    return `Forged within the resonance of the dimensional rift, bound by ancient smithing runes.`;
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Write a single sentence of atmospheric dark-fantasy flavor text/lore for a newly crafted ${slot} called "${itemName}" in the game Shadow Rift.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || `Tempered in shadow iron and quenched in celestial starlight.`;
  } catch {
    return `Tempered in shadow iron and quenched in celestial starlight.`;
  }
}
