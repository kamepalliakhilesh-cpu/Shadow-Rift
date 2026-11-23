import type { HudSnapshot } from '../game/types';

interface StatusModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onContinueEndless: () => void;
  onReturnTitle: () => void;
  onSetMasterVolume?: (v: number) => void;
  onSetSfxVolume?: (v: number) => void;
  onSetMusicVolume?: (v: number) => void;
  onToggleMute?: () => void;
  onOpenCodex?: () => void;
  onOpenOracle?: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StatusModal({
  hud,
  onResume,
  onRestart,
  onContinueEndless,
  onReturnTitle,
  onSetMasterVolume,
  onSetSfxVolume,
  onSetMusicVolume,
  onToggleMute,
  onOpenCodex,
  onOpenOracle,
}: StatusModalProps) {
  if (hud.phase === 'paused') {
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-[#08060e]/85 p-4 animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Game Paused"
      >
        <div className="obsidian-panel w-full max-w-md p-6 text-center border border-[#c99b52]/30 shadow-[0_0_35px_rgba(0,0,0,0.85)]">
          <h2 className="font-display text-2xl font-bold tracking-widest text-[#f7f0e2] mb-1">
            Paused
          </h2>
          <p className="text-xs text-[#b8adc9] mb-4">
            Floor {hud.floorNumber} · {hud.themeName}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5 py-2.5 border-y border-[#c99b52]/20">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a69cb8]">Score</div>
              <div className="font-mono-num text-lg font-bold text-[#f7f0e2]">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a69cb8]">Level</div>
              <div className="font-mono-num text-lg font-bold text-[#f5c469]">
                {hud.level}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a69cb8]">Slain</div>
              <div className="font-mono-num text-lg font-bold text-[#e2d8ee]">
                {hud.kills}
              </div>
            </div>
          </div>

          {/* Audio Volume Sliders */}
          <div className="p-3 mb-5 bg-[#120d20] border border-[#2f2347] text-left text-xs space-y-2.5">
            <div className="flex items-center justify-between text-[#d6c9e8] font-semibold text-[11px] uppercase tracking-wider">
              <span>Audio Levels</span>
              {onToggleMute && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="text-xs text-[#f5c469] hover:underline cursor-pointer"
                >
                  {hud.muted ? '🔇 Unmute' : '🔊 Mute (M)'}
                </button>
              )}
            </div>

            {onSetMasterVolume && (
              <div>
                <div className="flex justify-between text-[10px] text-[#a69cb8] mb-0.5">
                  <span>Master Volume</span>
                  <span className="font-mono">{Math.round(hud.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={hud.masterVolume}
                  onChange={(e) => onSetMasterVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#c99b52] cursor-pointer"
                />
              </div>
            )}

            {onSetMusicVolume && (
              <div>
                <div className="flex justify-between text-[10px] text-[#a69cb8] mb-0.5">
                  <span>Music / Ambient Drone</span>
                  <span className="font-mono">{Math.round(hud.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={hud.musicVolume}
                  onChange={(e) => onSetMusicVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#a855f7] cursor-pointer"
                />
              </div>
            )}

            {onSetSfxVolume && (
              <div>
                <div className="flex justify-between text-[10px] text-[#a69cb8] mb-0.5">
                  <span>Sound Effects</span>
                  <span className="font-mono">{Math.round(hud.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={hud.sfxVolume}
                  onChange={(e) => onSetSfxVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#38bdf8] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Quick Access to Oracle & Codex */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {onOpenOracle && (
              <button
                type="button"
                onClick={onOpenOracle}
                className="py-2 px-3 bg-[#24133d] hover:bg-[#341b57] text-[#e9d5ff] border border-[#7e22ce]/50 text-xs font-semibold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>👁</span> Void Oracle
              </button>
            )}
            {onOpenCodex && (
              <button
                type="button"
                onClick={onOpenCodex}
                className="py-2 px-3 bg-[#1e192c] hover:bg-[#2b243e] text-[#f5c469] border border-[#c99b52]/40 text-xs font-semibold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📜</span> Bestiary (B)
              </button>
            )}
          </div>

          {/* Primary Pause Actions */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 bg-[#c99b52] hover:bg-[#dfb26b] text-[#110e18] font-display font-bold tracking-wider cursor-pointer"
            >
              Resume (Esc)
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2 bg-[#1b1729] hover:bg-[#241f36] text-[#f4ede1] border border-[#403759] text-xs font-semibold cursor-pointer"
            >
              Restart Descent
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-1.5 text-xs text-[#a69cb8] hover:text-[#f4ede1] cursor-pointer"
            >
              Save & Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'gameover') {
    const isVictory = hud.outcome === 'victory';
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-[#08060e]/85 p-4 animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={isVictory ? 'Rift Conquered' : 'Fallen in the Rift'}
      >
        <div className="obsidian-panel w-full max-w-md p-7 text-center border border-[#c99b52]/40 shadow-[0_0_40px_rgba(0,0,0,0.88)]">
          <h2
            className={`font-display text-2xl font-bold tracking-widest mb-1 ${
              isVictory ? 'text-[#f5c469]' : 'text-[#ef4444]'
            }`}
          >
            {isVictory ? 'Rift Conquered' : 'Claimed by the Rift'}
          </h2>
          <p className="text-xs text-[#b8adc9] mb-6">
            {isVictory
              ? `Cleared ${hud.maxTargetFloor} Procedural Dungeons · Best Score ${hud.bestScore.toLocaleString()}`
              : `Reached Floor ${hud.floorNumber} (${hud.themeName}) · Best Floor ${hud.bestFloor}`}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-7 py-3 border-y border-[#c99b52]/20">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a69cb8]">Score</div>
              <div className="font-mono-num text-lg font-bold text-[#f7f0e2]">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a69cb8]">Time</div>
              <div className="font-mono-num text-lg font-bold text-[#e2d8ee]">
                {formatTime(hud.elapsedSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a69cb8]">
                {isVictory ? 'Level' : 'Slain'}
              </div>
              <div className="font-mono-num text-lg font-bold text-[#f5c469]">
                {isVictory ? hud.level : hud.kills}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {isVictory && (
              <button
                type="button"
                onClick={onContinueEndless}
                className="w-full py-3 bg-[#7c3aed] hover:bg-[#8b5cf6] text-[#f5f3ff] font-display font-bold tracking-wider cursor-pointer"
              >
                Descend Endless Floor {hud.floorNumber + 1}
              </button>
            )}
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="w-full py-3 bg-[#c99b52] hover:bg-[#dfb26b] text-[#110e18] font-display font-bold tracking-wider cursor-pointer"
            >
              {isVictory ? 'Play Again' : 'Try Again'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2 text-xs text-[#a69cb8] hover:text-[#f4ede1] cursor-pointer"
            >
              Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
