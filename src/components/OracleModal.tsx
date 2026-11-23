import { useEffect, useState } from 'react';
import type { HudSnapshot } from '../game/types';
import { askVoidOracle, getStoredGeminiKey, setStoredGeminiKey } from '../game/oracleAI';

interface OracleModalProps {
  hud: HudSnapshot;
  onClose: () => void;
}

export function OracleModal({ hud, onClose }: OracleModalProps) {
  const [whisper, setWhisper] = useState<string>('');
  const [source, setSource] = useState<'gemini' | 'rune_cache'>('rune_cache');
  const [loading, setLoading] = useState<boolean>(true);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getStoredGeminiKey());
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState<boolean>(false);

  const fetchWhisper = async () => {
    setLoading(true);
    const result = await askVoidOracle({
      floorNumber: hud.floorNumber,
      themeId: hud.minimapRooms.find((r) => r.current)?.kind || 'obsidian_catacombs',
      themeName: hud.themeName,
      roomKind: hud.currentRoomKind,
      level: hud.level,
      kills: hud.kills,
      hpPct: hud.hp / Math.max(1, hud.maxHp),
    });
    setWhisper(result.text);
    setSource(result.source);
    setLoading(false);
  };

  useEffect(() => {
    fetchWhisper();
  }, [hud.floorNumber]);

  const handleSaveKey = () => {
    setStoredGeminiKey(apiKeyInput);
    setSavedKeySuccess(true);
    setTimeout(() => setSavedKeySuccess(false), 2000);
    fetchWhisper();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07050d]/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Void Oracle"
    >
      <div className="obsidian-panel relative w-full max-w-lg p-6 sm:p-8 text-center border border-[#c084fc]/35 shadow-[0_0_40px_rgba(147,51,234,0.22)]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#a69cb8] hover:text-[#f7f0e2] text-xl font-bold cursor-pointer"
          aria-label="Close Oracle"
        >
          ✕
        </button>

        {/* Oracle Sigil & Title */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full border border-[#c084fc]/50 bg-[#170e28] flex items-center justify-center shadow-[0_0_18px_rgba(192,132,252,0.3)]">
            <span className="text-2xl text-[#c084fc]">👁</span>
          </div>
        </div>

        <h2 className="font-display text-2xl font-bold tracking-widest text-[#f5f3ff] mb-1">
          Void Oracle
        </h2>
        <p className="text-xs text-[#b8adc9] tracking-wider mb-5">
          Eldritch Whispers from Floor {hud.floorNumber} · {hud.themeName}
        </p>

        {/* Main Prophecy Box */}
        <div className="relative p-5 my-4 bg-[#110c1c]/90 border border-[#a855f7]/30 rounded-sm min-h-[96px] flex items-center justify-center">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[#d8b4fe] animate-pulse">
              <span>Communing with the astral void...</span>
            </div>
          ) : (
            <p className="text-sm sm:text-base font-serif italic text-[#f3e8ff] leading-relaxed">
              "{whisper}"
            </p>
          )}
        </div>

        {/* Source Badge */}
        <div className="flex items-center justify-between text-[11px] text-[#9383aa] mb-6 px-1">
          <span>
            Source:{' '}
            <strong className={source === 'gemini' ? 'text-[#38bdf8]' : 'text-[#f5c469]'}>
              {source === 'gemini' ? 'Gemini 2.5 AI' : 'Ancient Rune Archive'}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-[#c084fc] hover:underline cursor-pointer"
          >
            {showKeyConfig ? 'Hide API Settings' : 'Configure Gemini API Key'}
          </button>
        </div>

        {/* API Key Drawer */}
        {showKeyConfig && (
          <div className="p-3 mb-5 bg-[#170f26] border border-[#7e22ce]/40 text-left text-xs text-[#d8b4fe]">
            <label className="block mb-1 text-[11px] uppercase tracking-wider font-semibold text-[#e9d5ff]">
              Google Gemini API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Paste AI Studio API key here"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-[#0b0814] border border-[#581c87] text-[#f5f3ff] text-xs focus:outline-none focus:border-[#c084fc]"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-3 py-1.5 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold cursor-pointer"
              >
                Save
              </button>
            </div>
            {savedKeySuccess && (
              <p className="text-[11px] text-[#34d399] mt-1">Key saved! Re-communing with Gemini...</p>
            )}
            <p className="text-[10px] text-[#a69cb8] mt-2">
              Keys are stored locally in your browser. Leave blank to use the offline rune archive.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={fetchWhisper}
            className="flex-1 py-2.5 bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:opacity-50 text-[#f5f3ff] font-display font-semibold text-sm tracking-wider cursor-pointer border border-[#c084fc]/50 shadow-[0_0_15px_rgba(124,58,237,0.35)]"
          >
            Seek Another Whisper
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1b1528] hover:bg-[#251e36] text-[#e2d8ee] text-sm font-semibold border border-[#3f315a] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
