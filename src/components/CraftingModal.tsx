import { useState } from 'react';
import {
  CRAFTING_RECIPES,
  MATERIALS,
  MATERIAL_LIST,
  canAffordRecipe,
} from '../game/crafting';
import type { GearSlot, HudSnapshot, MaterialId } from '../game/types';
import { ForgeIcon, MaterialIcon } from './Icons';

interface CraftingModalProps {
  hud: HudSnapshot;
  onCraft: (recipeId: string) => { success: boolean; reason?: string };
  onClose: () => void;
}

export function CraftingModal({ hud, onCraft, onClose }: CraftingModalProps) {
  const [tab, setTab] = useState<GearSlot>('weapon');
  const [feedback, setFeedback] = useState<string>('');

  const filtered = CRAFTING_RECIPES.filter((r) => r.slot === tab);

  const handleAction = (recipeId: string, name: string) => {
    const res = onCraft(recipeId);
    if (res.success) {
      setFeedback(`Crafted & equipped ${name}`);
    } else if (res.reason) {
      setFeedback(res.reason);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#08060e]/82 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rift Forge Crafting Station"
    >
      <div className="obsidian-panel w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c99b52]/25">
          <div className="flex items-center gap-3">
            <ForgeIcon className="w-6 h-6" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-wider text-[#f7f0e2]">
                Rift Forge
              </h2>
              <p className="text-xs text-[#b8adc9]">
                {hud.nearForge
                  ? 'Connected to Sanctuary Anvil · All Weapons, Armor & Potions available'
                  : 'Field Alchemy Mode · Brew Potions anywhere, or return to the Entrance Forge for Gear'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-[#e6dccb] border border-[#4a405e] hover:border-[#f5c469] cursor-pointer whitespace-nowrap shrink-0"
          >
            Close [Esc]
          </button>
        </div>

        {/* Collected Materials Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-[#100d18] border-b border-[#c99b52]/18">
          {MATERIAL_LIST.map((mat) => {
            const meta = MATERIALS[mat];
            return (
              <div key={mat} className="flex items-center gap-2.5">
                <MaterialIcon material={mat} className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] text-[#b8adc9] truncate">{meta.name}</div>
                  <div className="font-mono-num text-sm font-bold text-[#f7f0e2]">
                    {hud.materials[mat]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-2">
          <div className="flex items-center gap-1.5 bg-[#0e0b15] p-1 border border-[#2f2842]">
            {(
              [
                ['weapon', 'Weapons'],
                ['armor', 'Armor'],
                ['consumable', 'Potions & Wards'],
              ] as const
            ).map(([slot, label]) => (
              <button
                key={slot}
                type="button"
                onClick={() => {
                  setTab(slot);
                  setFeedback('');
                }}
                className={`px-4 py-1.5 text-xs font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  tab === slot
                    ? 'bg-[#c99b52] text-[#110e18]'
                    : 'text-[#c2b8d1] hover:text-[#f7f0e2]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {feedback && (
            <span className="text-xs font-medium text-[#fde68a] truncate">
              {feedback}
            </span>
          )}
        </div>

        {/* Recipe List */}
        <div className="flex-1 overflow-y-auto touch-scroll-y px-4 sm:px-6 py-3 space-y-3">
          {filtered.map((recipe) => {
            const owned =
              recipe.slot !== 'consumable' && hud.craftedIds.includes(recipe.id);
            const equipped =
              recipe.id === hud.equippedWeaponId ||
              recipe.id === hud.equippedArmorId;
            const affordable = canAffordRecipe(hud.materials, recipe);
            const requiresForge = recipe.slot !== 'consumable' && !owned && !hud.nearForge;
            const canClick = owned ? !equipped : affordable && !requiresForge;

            const costEntries = Object.entries(recipe.cost) as Array<[MaterialId, number]>;

            return (
              <div
                key={recipe.id}
                className={`p-4 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  equipped
                    ? 'bg-[#1f1a2e] border-[#c99b52]'
                    : 'bg-[#151220] border-[#2e2742]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className="w-2.5 h-2.5 shrink-0"
                      style={{ backgroundColor: recipe.accent }}
                    />
                    <h3 className="font-display text-base font-bold text-[#f7f0e2]">
                      {recipe.name}
                    </h3>
                    <span className="text-xs font-mono-num text-[#e5b96c]">
                      {recipe.statSummary}
                    </span>
                  </div>
                  <p className="text-xs text-[#b8adc9] leading-relaxed">
                    {recipe.description}
                  </p>
                  {costEntries.length > 0 && !owned && (
                    <div className="flex items-center gap-4 pt-1 text-xs font-mono-num">
                      {costEntries.map(([mat, qty]) => {
                        const have = hud.materials[mat] ?? 0;
                        const enough = have >= qty;
                        return (
                          <span
                            key={mat}
                            className={`inline-flex items-center gap-1 ${
                              enough ? 'text-[#d6cbb8]' : 'text-[#f87171]'
                            }`}
                          >
                            <MaterialIcon material={mat} className="w-3.5 h-3.5" />
                            <span>
                              {have}/{qty} {MATERIALS[mat].shortName}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => handleAction(recipe.id, recipe.name)}
                    className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase whitespace-nowrap shrink-0 transition-colors ${
                      equipped
                        ? 'bg-[#2a243b] text-[#c99b52] border border-[#c99b52]/50 cursor-default'
                        : canClick
                          ? 'bg-[#c99b52] hover:bg-[#dfb26b] text-[#110e18] cursor-pointer'
                          : 'bg-[#1d192a] text-[#6d6480] border border-[#2f2842] cursor-not-allowed'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip'
                        : requiresForge
                          ? 'Need Forge'
                          : recipe.slot === 'consumable'
                            ? 'Brew'
                            : 'Forge'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
