import { MATERIALS, MATERIAL_LIST } from '../game/crafting';
import type { ActiveOverlay, HudSnapshot } from '../game/types';
import {
  DashIcon,
  FlaskIcon,
  ForgeIcon,
  LanceIcon,
  MaterialIcon,
  NovaIcon,
  SkillTreeIcon,
  SlashIcon,
} from './Icons';

interface GameHudProps {
  hud: HudSnapshot;
  activeOverlay: ActiveOverlay;
  touchMode?: boolean;
  onOpenOverlay: (overlay: ActiveOverlay) => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onTriggerNova: () => void;
  onTriggerLance: () => void;
  onTriggerFlask: () => void;
}

export function GameHud({
  hud,
  activeOverlay,
  touchMode = false,
  onOpenOverlay,
  onTogglePause,
  onToggleMute,
  onTriggerNova,
  onTriggerLance,
  onTriggerFlask,
}: GameHudProps) {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const ghostPct = Math.max(0, Math.min(100, (hud.ghostHp / Math.max(1, hud.maxHp)) * 100));
  const shieldPct = Math.max(0, Math.min(100, (hud.shield / Math.max(1, hud.maxShield)) * 100));
  const essencePct = Math.max(0, Math.min(100, (hud.essence / Math.max(1, hud.maxEssence)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpToNext)) * 100));
  const lowHp = hpPct <= 30;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between safe-pad sm:p-5">
      {/* Peripheral Critical Low-HP Vignette */}
      {lowHp && (
        <div
          className="pointer-events-none fixed inset-0 transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 110px rgba(220, 38, 38, 0.42)',
          }}
        />
      )}

      {/* TOP ROW: Left Vitality Cluster | Center Boss/Banner | Right Floor + Minimap + Utilities */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-4 w-full">
        {/* TOP-LEFT: Vitality, Essence, Level/XP & Material Strip */}
        <div className="flex flex-col gap-1 sm:gap-2 w-[152px] sm:w-[258px] md:w-[274px] shrink-0">
          <div className="obsidian-panel px-2 sm:px-3.5 py-1.5 sm:py-2.5">
            {/* HP Header */}
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.12em] text-[#c99b52] uppercase">
                Vitality
              </span>
              <span className="font-mono-num text-[11px] sm:text-sm font-bold text-[#f7f0e2]">
                {hud.hp}
                <span className="text-[#9488a6] font-medium">/{hud.maxHp}</span>
                {hud.shield > 0 && (
                  <span className="text-[#60a5fa] ml-1">+{hud.shield}</span>
                )}
              </span>
            </div>

            {/* HP Track with Delayed Ghost Damage Bar & Shield Overlay */}
            <div className="relative h-2 sm:h-3 w-full bg-[#0c0a13] border border-[#3a324d] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#f59e0b]/75 transition-[width] duration-150"
                style={{ width: `${ghostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#dc2626] transition-[width] duration-75"
                style={{ width: `${hpPct}%` }}
              />
              {hud.shield > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-[#60a5fa]/70"
                  style={{ width: `${shieldPct}%` }}
                />
              )}
            </div>

            {/* Rift Essence Bar */}
            <div className="flex items-center gap-1 sm:gap-2 mt-1.5 sm:mt-2">
              <span className="text-[8px] sm:text-[10px] font-semibold tracking-[0.08em] text-[#c084fc] uppercase w-9 sm:w-12 shrink-0">
                Essence
              </span>
              <div className="relative h-1.5 sm:h-2 flex-1 bg-[#0c0a13] border border-[#322947] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#9333ea]"
                  style={{ width: `${essencePct}%` }}
                />
              </div>
              <span className="font-mono-num text-[10px] sm:text-[11px] font-semibold text-[#e9d5ff] w-5 sm:w-7 text-right">
                {hud.essence}
              </span>
            </div>

            {/* Level & XP Progress */}
            <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5">
              <span className="font-mono-num text-[9px] sm:text-[11px] font-bold text-[#f5c469] w-9 sm:w-12 shrink-0">
                LVL {hud.level}
              </span>
              <div className="relative h-1.5 flex-1 bg-[#0c0a13] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#34d399]"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <span className="font-mono-num text-[9px] sm:text-[10px] text-[#a7f3d0] w-9 sm:w-12 text-right">
                {hud.xp}/{hud.xpToNext}
              </span>
            </div>
          </div>

          {/* Compact Material Pouch Row (unboxed quiet metadata with 1-to-1 SVG icons) */}
          <div className="flex items-center gap-2 sm:gap-3 px-0.5 text-[10px] sm:text-xs font-mono-num text-[#e6dccb] hud-text-shadow">
            {MATERIAL_LIST.map((mat) => (
              <div
                key={mat}
                className="flex items-center gap-0.5 sm:gap-1"
                title={MATERIALS[mat].name}
              >
                <MaterialIcon material={mat} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{hud.materials[mat]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP-CENTER: Boss Health Bar OR Transient Floor/Room Banner */}
        <div className="hidden lg:flex flex-col items-center flex-1 max-w-md pt-0.5">
          {hud.bossActive ? (
            <div className="w-full obsidian-panel px-4 py-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-display text-sm font-bold tracking-wider text-[#fde68a]">
                  {hud.bossName}
                </span>
                <span className="font-mono-num text-xs text-[#fca5a5]">
                  {hud.bossHp} / {hud.bossMaxHp}
                </span>
              </div>
              <div className="relative h-3 w-full bg-[#0d0a14] border border-[#7f1d1d] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#b91c1c] transition-[width] duration-75"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ) : hud.statusBanner ? (
            <div className="px-4 py-1.5 bg-[#14111d]/92 border border-[#c99b52]/40 text-xs tracking-wide text-[#f5deb3] text-center">
              {hud.statusBanner}
            </div>
          ) : null}
        </div>

        {/* TOP-RIGHT: Floor & Score + Utility Buttons + Live Dungeon Minimap */}
        <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
            {/* Skill Tree Toggle Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open Skill Tree (K)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenOverlay(activeOverlay === 'skills' ? 'none' : 'skills');
              }}
              className={`relative h-[42px] min-w-[42px] sm:h-10 px-2 sm:px-3 flex items-center justify-center gap-1 sm:gap-2 text-xs font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                activeOverlay === 'skills'
                  ? 'bg-[#c99b52] text-[#110e18] border border-[#fde68a]'
                  : 'obsidian-socket text-[#f4ede1] hover:border-[#f5c469]'
              }`}
            >
              <SkillTreeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Skills</span>
              <span className="hidden md:inline font-mono-num text-[10px] opacity-80">[K]</span>
              {hud.skillPoints > 0 && (
                <span className="font-mono-num text-[10px] sm:text-[11px] font-bold text-[#fde047]">
                  +{hud.skillPoints}
                </span>
              )}
            </button>

            {/* Crafting Forge Toggle Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open Rift Forge (C)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenOverlay(activeOverlay === 'crafting' ? 'none' : 'crafting');
              }}
              className={`h-[42px] min-w-[42px] sm:h-10 px-2 sm:px-3 flex items-center justify-center gap-1 sm:gap-2 text-xs font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                activeOverlay === 'crafting'
                  ? 'bg-[#c99b52] text-[#110e18] border border-[#fde68a]'
                  : hud.nearForge
                    ? 'obsidian-socket border-[#f5c469] text-[#fef3c7]'
                    : 'obsidian-socket text-[#f4ede1] hover:border-[#f5c469]'
              }`}
            >
              <ForgeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Forge</span>
              <span className="hidden md:inline font-mono-num text-[10px] opacity-80">[C]</span>
            </button>

            {/* Void Oracle Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Void Oracle (O)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenOverlay(activeOverlay === 'oracle' ? 'none' : 'oracle');
              }}
              className={`h-[42px] min-w-[42px] sm:h-10 px-2 sm:px-2.5 flex items-center justify-center gap-1 text-xs font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                activeOverlay === 'oracle'
                  ? 'bg-[#7c3aed] text-white border border-[#c084fc]'
                  : 'obsidian-socket text-[#d8b4fe] hover:border-[#a855f7]'
              }`}
            >
              <span>👁</span>
              <span className="hidden md:inline">Oracle</span>
            </button>

            {/* Codex Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Codex & Bestiary (B)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenOverlay(activeOverlay === 'codex' ? 'none' : 'codex');
              }}
              className={`h-[42px] min-w-[42px] sm:h-10 px-2 sm:px-2.5 flex items-center justify-center gap-1 text-xs font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                activeOverlay === 'codex'
                  ? 'bg-[#c99b52] text-[#110e18] border border-[#fde68a]'
                  : 'obsidian-socket text-[#f5c469] hover:border-[#f5c469]'
              }`}
            >
              <span>📜</span>
              <span className="hidden md:inline">Codex</span>
            </button>

            {/* Mute Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label={hud.muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-[42px] h-[42px] sm:w-10 sm:h-10 obsidian-socket flex items-center justify-center text-[#e6dccb] hover:border-[#f5c469] cursor-pointer shrink-0"
            >
              {hud.muted ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path d="M5 9H9L14 5V19L9 15H5V9Z" fill="currentColor" />
                  <path d="M17 9L21 15M21 9L17 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path d="M5 9H9L14 5V19L9 15H5V9Z" fill="currentColor" />
                  <path d="M17 8.5C18.5 10 18.5 14 17 15.5M19.5 6C22 8.8 22 15.2 19.5 18" stroke="#c99b52" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </button>

            {/* Pause Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Game (P)"
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              className="w-[42px] h-[42px] sm:w-10 sm:h-10 obsidian-socket flex items-center justify-center text-[#e6dccb] hover:border-[#f5c469] cursor-pointer shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Floor, Theme & Score Metadata + Live Dungeon Minimap */}
          <div className="obsidian-panel px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-3">
            <div className="text-right">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-[#c99b52] font-semibold">
                <span className="sm:hidden">F{hud.floorNumber}</span>
                <span className="hidden sm:inline">Floor {hud.floorNumber} · {hud.themeName}</span>
              </div>
              <div className="font-mono-num text-sm sm:text-lg font-bold text-[#f7f0e2] leading-tight">
                {hud.score.toLocaleString()}
              </div>
              <div className="text-[9px] sm:text-[10px] font-mono-num text-[#a69cb8]">
                Rooms {hud.roomsCleared}/{hud.totalCombatRooms}
              </div>
            </div>
            <DungeonMinimap rooms={hud.minimapRooms} accent={hud.themeAccent} />
          </div>
        </div>
      </div>

      {/* Mobile Compact Boss Bar (visible on narrow mobile viewports when Boss is active) */}
      {hud.bossActive && (
        <div className="lg:hidden mx-auto w-full max-w-xs obsidian-panel px-3 py-1.5 -mt-1">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-display text-xs font-bold tracking-wider text-[#fde68a] truncate">
              {hud.bossName}
            </span>
            <span className="font-mono-num text-[10px] text-[#fca5a5] ml-2 shrink-0">
              {hud.bossHp}/{hud.bossMaxHp}
            </span>
          </div>
          <div className="relative h-2 w-full bg-[#0d0a14] border border-[#7f1d1d] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#b91c1c] transition-[width] duration-75"
              style={{
                width: `${Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* BOTTOM ROW: Desktop Keyboard Ability Sockets (hidden when MobileTouchControls owns the thumb zones) */}
      {!touchMode && (
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-2 pointer-events-auto">
          {/* Primary Slash */}
          <div className="obsidian-socket w-14 h-14 flex flex-col items-center justify-center relative">
            <SlashIcon className="w-6 h-6" />
            <span className="font-mono-num text-[9px] text-[#d6cbb8] mt-0.5">LMB</span>
          </div>

          {/* Shadow Dash with Charge Pips */}
          <div className="obsidian-socket w-14 h-14 flex flex-col items-center justify-center relative overflow-hidden">
            {hud.dashCharges < hud.maxDashCharges && (
              <div
                className="absolute bottom-0 inset-x-0 bg-[#a78bfa]/20 pointer-events-none"
                style={{ height: `${hud.dashRechargeRatio * 100}%` }}
              />
            )}
            <DashIcon className="w-6 h-6 relative z-10" />
            <span className="font-mono-num text-[9px] text-[#d6cbb8] mt-0.5 relative z-10">
              SPACE
            </span>
            <div className="absolute top-1 right-1 flex gap-0.5">
              {Array.from({ length: hud.maxDashCharges }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 ${
                    idx < hud.dashCharges ? 'bg-[#c084fc]' : 'bg-[#2d2640]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Rift Nova [Q] */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cast Rift Nova (Q)"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerNova();
            }}
            className={`obsidian-socket w-14 h-14 flex flex-col items-center justify-center relative cursor-pointer ${
              hud.essence >= hud.novaCost && hud.novaCooldown <= 0
                ? 'border-[#a78bfa]'
                : 'opacity-55'
            }`}
          >
            <NovaIcon className="w-6 h-6" />
            <span className="font-mono-num text-[9px] text-[#d6cbb8] mt-0.5">
              {hud.novaCooldown > 0 ? `${hud.novaCooldown.toFixed(1)}s` : 'Q · 35'}
            </span>
          </button>

          {/* Astral Lance [V] (Active skill unlocked from Magic Skill Tree) */}
          {hud.lanceUnlocked && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Cast Astral Lance (V)"
              onClick={(e) => {
                e.currentTarget.blur();
                onTriggerLance();
              }}
              className={`obsidian-socket w-14 h-14 flex flex-col items-center justify-center relative cursor-pointer ${
                hud.essence >= hud.lanceCost && hud.lanceCooldown <= 0
                  ? 'border-[#c084fc]'
                  : 'opacity-55'
              }`}
            >
              <LanceIcon className="w-6 h-6" />
              <span className="font-mono-num text-[9px] text-[#d6cbb8] mt-0.5">
                {hud.lanceCooldown > 0 ? `${hud.lanceCooldown.toFixed(1)}s` : 'V · 25'}
              </span>
            </button>
          )}

          {/* Siphon Flask [E] */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Drink Siphon Flask (E)"
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerFlask();
            }}
            className={`obsidian-socket w-14 h-14 flex flex-col items-center justify-center relative cursor-pointer ${
              hud.flaskCharges > 0 ? 'border-[#34d399]/75' : 'opacity-45'
            }`}
          >
            <FlaskIcon className="w-6 h-6" />
            <span className="font-mono-num text-[9px] text-[#d6cbb8] mt-0.5">E</span>
            <span className="absolute top-0.5 right-1 font-mono-num text-[10px] font-bold text-[#34d399]">
              {hud.flaskCharges}
            </span>
          </button>
        </div>

        {/* Bottom-Right Subtle Status Readout */}
        <div className="hidden sm:flex flex-col items-end gap-1 text-xs hud-text-shadow">
          {hud.furyTimer > 0 && (
            <div className="font-mono-num text-[#fb923c] font-semibold">
              Ember Fury +35% ATK · {hud.furyTimer}s
            </div>
          )}
          <div className="text-[11px] text-[#b8adc9]">
            {hud.nearForge
              ? 'Press [F] or [C] to craft at the Rift Forge'
              : hud.nearExit && hud.exitUnlocked
                ? 'Press [F] to step through the Rift Exit'
                : 'Explore corridors · Slash ore nodes · Defeat the Floor Guardian'}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function DungeonMinimap({
  rooms,
  accent,
}: {
  rooms: HudSnapshot['minimapRooms'];
  accent: string;
}) {
  if (rooms.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    if (r.gridX < minX) minX = r.gridX;
    if (r.gridX > maxX) maxX = r.gridX;
    if (r.gridY < minY) minY = r.gridY;
    if (r.gridY > maxY) maxY = r.gridY;
  }

  const step = 18;
  const pad = 12;
  const vw = Math.max(48, (maxX - minX) * step + pad * 2 + 12);
  const vh = Math.max(48, (maxY - minY) * step + pad * 2 + 12);
  const posOf = (gx: number, gy: number) => ({
    x: pad + 6 + (gx - minX) * step,
    y: pad + 6 + (gy - minY) * step,
  });

  const drawnEdges = new Set<string>();

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className="w-[56px] h-[50px] sm:w-[74px] sm:h-[64px] bg-[#0c0a13] border border-[#322b44] shrink-0"
      aria-label="Dungeon Minimap"
    >
      {/* Corridor edges */}
      {rooms.map((r) =>
        r.neighbors.map((nbId) => {
          const a = Math.min(r.id, nbId);
          const b = Math.max(r.id, nbId);
          const key = `${a}-${b}`;
          if (drawnEdges.has(key)) return null;
          drawnEdges.add(key);
          const nb = rooms.find((x) => x.id === nbId);
          if (!nb) return null;
          const p1 = posOf(r.gridX, r.gridY);
          const p2 = posOf(nb.gridX, nb.gridY);
          return (
            <line
              key={key}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#4a4161"
              strokeWidth="2.5"
            />
          );
        })
      )}

      {/* Room Nodes */}
      {rooms.map((r) => {
        const p = posOf(r.gridX, r.gridY);
        const fill = r.current
          ? '#f5c469'
          : r.kind === 'boss'
            ? r.cleared
              ? '#c084fc'
              : '#dc2626'
            : r.kind === 'entrance'
              ? '#34d399'
              : r.kind === 'treasure'
                ? '#eab308'
                : r.cleared
                  ? '#475569'
                  : r.discovered
                    ? accent
                    : '#262135';
        return (
          <rect
            key={r.id}
            x={p.x - 5}
            y={p.y - 5}
            width="10"
            height="10"
            rx="1.5"
            fill={fill}
            stroke={r.current ? '#ffffff' : '#0e0c14'}
            strokeWidth={r.current ? '1.5' : '1'}
          />
        );
      })}
    </svg>
  );
}
