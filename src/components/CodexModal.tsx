import { useState } from 'react';

interface CodexModalProps {
  onClose: () => void;
}

type CodexTab = 'bestiary' | 'themes' | 'controls';

export function CodexModal({ onClose }: CodexModalProps) {
  const [tab, setTab] = useState<CodexTab>('bestiary');

  const bestiaryEntries = [
    {
      id: 'stalker',
      name: 'Rift Stalker',
      category: 'Melee Swarm',
      threat: 'Moderate',
      accent: '#a855f7',
      icon: '🐺',
      hp: '55 - 90',
      description:
        'Feral void hounds that lurk in shadows and leap aggressively at their prey. Vulnerable to combo finishers and Rift Nova stuns.',
      tactics: 'Back-step when they crouch to pounce, then punish during their recovery frames.',
    },
    {
      id: 'acolyte',
      name: 'Void Acolyte',
      category: 'Ranged Caster',
      threat: 'High',
      accent: '#ec4899',
      icon: '🧙‍♂️',
      hp: '45 - 75',
      description:
        'Cultists channel shadowy homing projectiles and teleport away when pressured in close-quarters melee combat.',
      tactics: 'Close the gap using Dash to negate their range advantage. Astral Lance pierces their defensive barriers.',
    },
    {
      id: 'lancer',
      name: 'Shadow Lancer',
      category: 'Heavy Skirmisher',
      threat: 'Severe',
      accent: '#38bdf8',
      icon: '🗡️',
      hp: '95 - 150',
      description:
        'Armored phantoms wielding elongated energy halberds. They charge in straight lines with devastating thrust attacks.',
      tactics: 'Wait for the red line telegraph and sidestep or dash perpendicular to their charge path.',
    },
    {
      id: 'sentinel',
      name: 'Obsidian Sentinel',
      category: 'Tank Guardian',
      threat: 'Extreme',
      accent: '#f59e0b',
      icon: '🛡️',
      hp: '160 - 240',
      description:
        'Living stone constructs that raise frontal energy shields, deflecting all forward melee attacks unless flanked.',
      tactics: 'Dash behind them while they are locked in shield mode to deliver critical back-strikes.',
    },
    {
      id: 'boss_malakor',
      name: 'Sovereign Malakor',
      category: 'Floor 3 Arch-Demon',
      threat: 'Cataclysmic',
      accent: '#ef4444',
      icon: '👑',
      hp: '650+',
      description:
        'The dark overlord of the dimensional rift. Dual-wields shadow Greatswords and summons radial wave bursts in Phase 2.',
      tactics: 'Patience is paramount. Save full dash charges to evade his triple-slash combo and spinning void tempest.',
    },
  ];

  const themeEntries = [
    {
      id: 'obsidian_catacombs',
      name: 'Obsidian Catacombs',
      accent: '#9333ea',
      materials: 'Shadow Iron & Vital Essence',
      traps: 'Floor Spikes (Cadence: 3.2s)',
      lore: 'Ancient subterranean chambers carved from volcanic glass. The walls hum with resonant void energy.',
    },
    {
      id: 'ember_forge',
      name: 'Ember Forge',
      accent: '#f97316',
      materials: 'Ember Ash & Shadow Iron',
      traps: 'Void Geysers & Molten Slag',
      lore: 'The scorched industrial foundry of the Sovereign. Molten iron flows through conduits beneath your boots.',
    },
    {
      id: 'astral_sanctum',
      name: 'Astral Sanctum',
      accent: '#38bdf8',
      materials: 'Rift Shards & Astral Dust',
      traps: 'Shadow Snares & Gravity Wells',
      lore: 'A fractured cathedral suspended over an open dimensional rift where celestial light pierces absolute darkness.',
    },
    {
      id: 'blighted_crypt',
      name: 'Blighted Crypt',
      accent: '#10b981',
      materials: 'Vital Essence & Miasma Crystals',
      traps: 'Toxic Geysers & Spectral Spikes',
      lore: 'The final sanctum preceding Malakor’s throne. Necrotic energy permeates every stone, resurrecting ancient bones.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07050d]/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Rift Codex"
    >
      <div className="obsidian-panel relative w-full max-w-2xl max-h-[90vh] flex flex-col p-6 text-left border border-[#c99b52]/40 shadow-[0_0_40px_rgba(201,155,82,0.22)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#c99b52]/20 mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-widest text-[#f7f0e2]">
              Rift Codex & Bestiary
            </h2>
            <p className="text-xs text-[#b8adc9]">
              Field Guide to the Monsters, Dungeons, and Mechanics of Shadow Rift
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#a69cb8] hover:text-[#f7f0e2] text-xl font-bold cursor-pointer"
            aria-label="Close Codex"
          >
            ✕
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 mb-4 border-b border-[#2d2542] pb-2">
          <button
            type="button"
            onClick={() => setTab('bestiary')}
            className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
              tab === 'bestiary'
                ? 'bg-[#c99b52] text-[#110e18]'
                : 'bg-[#1b1528] text-[#b8adc9] hover:text-[#f4ede1]'
            }`}
          >
            Bestiary
          </button>
          <button
            type="button"
            onClick={() => setTab('themes')}
            className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
              tab === 'themes'
                ? 'bg-[#c99b52] text-[#110e18]'
                : 'bg-[#1b1528] text-[#b8adc9] hover:text-[#f4ede1]'
            }`}
          >
            Dungeon Themes
          </button>
          <button
            type="button"
            onClick={() => setTab('controls')}
            className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
              tab === 'controls'
                ? 'bg-[#c99b52] text-[#110e18]'
                : 'bg-[#1b1528] text-[#b8adc9] hover:text-[#f4ede1]'
            }`}
          >
            Controls & Gamepad
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {tab === 'bestiary' && (
            <div className="space-y-3">
              {bestiaryEntries.map((enemy) => (
                <div
                  key={enemy.id}
                  className="p-3.5 bg-[#120e1e] border border-[#382d52] hover:border-[#634e8f] transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{enemy.icon}</span>
                      <h3
                        className="font-display text-base font-bold tracking-wide"
                        style={{ color: enemy.accent }}
                      >
                        {enemy.name}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#201833] text-[#cfc4df] border border-[#483769]">
                        {enemy.category}
                      </span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-[10px] text-[#8e82a3] uppercase mr-1">Threat:</span>
                      <strong style={{ color: enemy.accent }}>{enemy.threat}</strong>
                    </div>
                  </div>
                  <p className="text-xs text-[#d1c6df] mb-2">{enemy.description}</p>
                  <div className="text-[11px] text-[#f5c469] bg-[#1a1329] p-2 border-l-2 border-[#f5c469]">
                    <strong>Counter-Tactic:</strong> {enemy.tactics}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'themes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themeEntries.map((theme) => (
                <div
                  key={theme.id}
                  className="p-3.5 bg-[#120e1e] border border-[#382d52] flex flex-col justify-between"
                >
                  <div>
                    <h3
                      className="font-display text-base font-bold tracking-wide mb-1"
                      style={{ color: theme.accent }}
                    >
                      {theme.name}
                    </h3>
                    <p className="text-xs text-[#cfc4df] mb-3">{theme.lore}</p>
                  </div>
                  <div className="pt-2 border-t border-[#291f3d] text-[11px] space-y-1 text-[#a69cb8]">
                    <div>
                      <span className="text-[#f5c469]">Harvest Nodes:</span> {theme.materials}
                    </div>
                    <div>
                      <span className="text-[#f87171]">Hazard Traps:</span> {theme.traps}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'controls' && (
            <div className="space-y-4 text-xs text-[#d8cde6]">
              <div className="p-3 bg-[#140f22] border border-[#4a396b]">
                <h4 className="font-display text-sm font-bold text-[#f5c469] mb-2">
                  🎮 Gamepad / Controller Mapping
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div><strong>Left Stick:</strong> Move Warrior</div>
                  <div><strong>Right Stick:</strong> Aim Direction</div>
                  <div><strong>X / RT / Trigger:</strong> Slash Combo</div>
                  <div><strong>B / LT / Bumper:</strong> Dash (I-Frames)</div>
                  <div><strong>RB:</strong> Rift Nova Spell</div>
                  <div><strong>LB:</strong> Astral Lance Spell</div>
                  <div><strong>Y / D-Pad Up:</strong> Quaff Flask</div>
                  <div><strong>A / Cross:</strong> Interact / Forge / Exit</div>
                  <div><strong>Start:</strong> Pause / Resume</div>
                  <div><strong>Select:</strong> Skill Tree Overlay</div>
                  <div><strong>D-Pad Left:</strong> Rift Forge Overlay</div>
                  <div><strong>D-Pad Right:</strong> Open Codex</div>
                </div>
              </div>

              <div className="p-3 bg-[#140f22] border border-[#4a396b]">
                <h4 className="font-display text-sm font-bold text-[#38bdf8] mb-2">
                  ⌨️ Keyboard & Mouse Controls
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div><strong>WASD / Arrows:</strong> Move</div>
                  <div><strong>Mouse Cursor:</strong> Aim</div>
                  <div><strong>Left Click / J:</strong> Slash Combo</div>
                  <div><strong>Space / Shift:</strong> Dash</div>
                  <div><strong>Q:</strong> Rift Nova</div>
                  <div><strong>V / 2:</strong> Astral Lance</div>
                  <div><strong>E:</strong> Flask</div>
                  <div><strong>F:</strong> Interact</div>
                  <div><strong>C:</strong> Rift Forge</div>
                  <div><strong>K:</strong> Skill Tree</div>
                  <div><strong>B:</strong> Codex & Bestiary</div>
                  <div><strong>Esc / P:</strong> Pause</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#c99b52]/20 mt-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#c99b52] hover:bg-[#dfb26b] text-[#110e18] font-display font-semibold text-xs tracking-wider cursor-pointer"
          >
            Close Codex
          </button>
        </div>
      </div>
    </div>
  );
}
