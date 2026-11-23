import { useCallback, useEffect, useRef, useState } from 'react';
import { CodexModal } from './components/CodexModal';
import { CraftingModal } from './components/CraftingModal';
import { GameHud } from './components/GameHud';
import { MobileTouchControls } from './components/MobileTouchControls';
import { OracleModal } from './components/OracleModal';
import { SkillTreeModal } from './components/SkillTreeModal';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { ShadowRiftEngine } from './game/engine';
import type { ActiveOverlay, HudSnapshot } from './game/types';

function detectMobileOrTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const smallViewport = window.innerWidth <= 920 || window.innerHeight <= 520;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return coarse || (hasTouch && smallViewport) || window.innerWidth <= 768 || window.innerHeight <= 500;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShadowRiftEngine | null>(null);
  const sawTouchRef = useRef<boolean>(false);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [overlay, setOverlay] = useState<ActiveOverlay>('none');
  const [touchMode, setTouchMode] = useState<boolean>(() => detectMobileOrTouch());

  useEffect(() => {
    const updateTouchMode = () => {
      setTouchMode(sawTouchRef.current || detectMobileOrTouch());
    };
    const handleFirstTouch = () => {
      sawTouchRef.current = true;
      setTouchMode(true);
    };

    window.addEventListener('touchstart', handleFirstTouch, { passive: true, once: true });
    window.addEventListener('resize', updateTouchMode);
    updateTouchMode();

    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('resize', updateTouchMode);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.state = 'title';
    const container = mountRef.current;
    if (!container) return;

    const engine = new ShadowRiftEngine(
      container,
      (snapshot) => {
        setHud(snapshot);
      },
      (requestedOverlay) => {
        setOverlay(requestedOverlay);
      }
    );
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewRun();
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewRun();
    engineRef.current?.focusCanvas();
  }, []);

  const handleResumeRun = useCallback(() => {
    engineRef.current?.resumeMidRun();
    engineRef.current?.focusCanvas();
  }, []);

  const handleOpenOverlay = useCallback((next: ActiveOverlay) => {
    setOverlay(next);
    engineRef.current?.setOverlay(next);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setOverlay('none');
    engineRef.current?.setOverlay('none');
    engineRef.current?.focusCanvas();
  }, []);

  const handleCraft = useCallback((recipeId: string) => {
    if (!engineRef.current) return { success: false, reason: 'Engine unavailable' };
    return engineRef.current.craftItem(recipeId);
  }, []);

  const handleUnlockSkill = useCallback((nodeId: string) => {
    if (!engineRef.current) return false;
    return engineRef.current.investSkill(nodeId);
  }, []);

  const handleVirtualMove = useCallback((dx: number, dy: number) => {
    engineRef.current?.setVirtualMove(dx, dy);
  }, []);

  const handleVirtualAttackHeld = useCallback((held: boolean) => {
    engineRef.current?.setVirtualAttackHeld(held);
  }, []);

  const handleVirtualDash = useCallback(() => {
    engineRef.current?.triggerDash();
  }, []);

  const handleVirtualInteract = useCallback(() => {
    engineRef.current?.triggerInteract();
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#0e0c14]">
      {/* Isolated Full-Viewport 3D WebGL Mount */}
      <div className="fixed inset-0 z-0">
        <div ref={mountRef} className="w-full h-full" />
        <div
          className="pointer-events-none fixed inset-0 z-[3]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0) 58%, rgba(7,5,12,0.48) 100%)',
          }}
        />
      </div>

      {/* Animated Title Screen */}
      {(!hud || hud.phase === 'title') && (
        <TitleScreen
          bestScore={hud?.bestScore ?? 0}
          bestFloor={hud?.bestFloor ?? 1}
          isTouchDevice={touchMode}
          hasMidRunSave={hud?.hasMidRunSave ?? engineRef.current?.hasMidRunSave() ?? false}
          onStart={handleStart}
          onResume={handleResumeRun}
          onOpenCodex={() => handleOpenOverlay('codex')}
        />
      )}

      {/* Playing / Paused World-Matched HUD */}
      {hud && hud.phase !== 'title' && (
        <GameHud
          hud={hud}
          activeOverlay={overlay}
          touchMode={touchMode}
          onOpenOverlay={handleOpenOverlay}
          onTogglePause={() => engineRef.current?.togglePause()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onTriggerNova={() => engineRef.current?.triggerNova()}
          onTriggerLance={() => engineRef.current?.triggerAstralLance()}
          onTriggerFlask={() => engineRef.current?.triggerFlask()}
        />
      )}

      {/* Android / Mobile Multi-Touch Virtual Controls */}
      {hud && hud.phase === 'playing' && overlay === 'none' && touchMode && (
        <MobileTouchControls
          hud={hud}
          onMove={handleVirtualMove}
          onAttackHeld={handleVirtualAttackHeld}
          onDash={handleVirtualDash}
          onNova={() => engineRef.current?.triggerNova()}
          onLance={() => engineRef.current?.triggerAstralLance()}
          onFlask={() => engineRef.current?.triggerFlask()}
          onInteract={handleVirtualInteract}
        />
      )}

      {/* Crafting Station Modal */}
      {hud && hud.phase === 'playing' && overlay === 'crafting' && (
        <CraftingModal
          hud={hud}
          onCraft={handleCraft}
          onClose={handleCloseOverlay}
        />
      )}

      {/* Three-Branch Skill Tree Modal */}
      {hud && hud.phase === 'playing' && overlay === 'skills' && (
        <SkillTreeModal
          hud={hud}
          onUnlock={handleUnlockSkill}
          onClose={handleCloseOverlay}
        />
      )}

      {/* Rift Codex & Bestiary Modal */}
      {overlay === 'codex' && (
        <CodexModal onClose={handleCloseOverlay} />
      )}

      {/* Void Oracle (Gemini AI) Modal */}
      {hud && overlay === 'oracle' && (
        <OracleModal hud={hud} onClose={handleCloseOverlay} />
      )}

      {/* Pause / Victory / Defeat Modals */}
      {hud && (hud.phase === 'paused' || hud.phase === 'gameover') && (
        <StatusModal
          hud={hud}
          onResume={() => {
            engineRef.current?.resumeGame();
            engineRef.current?.focusCanvas();
          }}
          onRestart={handleStart}
          onContinueEndless={() => {
            engineRef.current?.continueEndless();
            engineRef.current?.focusCanvas();
          }}
          onReturnTitle={() => engineRef.current?.returnToTitle()}
          onSetMasterVolume={(v) => engineRef.current?.setMasterVolume(v)}
          onSetSfxVolume={(v) => engineRef.current?.setSfxVolume(v)}
          onSetMusicVolume={(v) => engineRef.current?.setMusicVolume(v)}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onOpenCodex={() => handleOpenOverlay('codex')}
          onOpenOracle={() => handleOpenOverlay('oracle')}
        />
      )}
    </div>
  );
}
