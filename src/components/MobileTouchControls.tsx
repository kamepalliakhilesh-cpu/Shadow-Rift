import { useRef, useState } from 'react';
import type { HudSnapshot } from '../game/types';
import {
  DashIcon,
  FlaskIcon,
  ForgeIcon,
  LanceIcon,
  NovaIcon,
  SlashIcon,
} from './Icons';

interface MobileTouchControlsProps {
  hud: HudSnapshot;
  onMove: (dx: number, dy: number) => void;
  onAttackHeld: (held: boolean) => void;
  onDash: () => void;
  onNova: () => void;
  onLance: () => void;
  onFlask: () => void;
  onInteract: () => void;
}

const STICK_MAX_RADIUS = 44;

export function MobileTouchControls({
  hud,
  onMove,
  onAttackHeld,
  onDash,
  onNova,
  onLance,
  onFlask,
  onInteract,
}: MobileTouchControlsProps) {
  // Multi-touch pointer tracking for floating left-thumb analog joystick
  const stickPointerId = useRef<number | null>(null);
  const stickOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);
  const [stickCenter, setStickCenter] = useState<{ x: number; y: number } | null>(null);
  const [stickKnob, setStickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const attackPointerId = useRef<number | null>(null);
  const [attackPressed, setAttackPressed] = useState(false);

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    stickPointerId.current = e.pointerId;

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    stickOrigin.current = { x: e.clientX, y: e.clientY };
    setStickCenter({ x: localX, y: localY });
    setStickKnob({ x: 0, y: 0 });
    setStickActive(true);
    onMove(0, 0);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const rawDx = e.clientX - stickOrigin.current.x;
    const rawDy = e.clientY - stickOrigin.current.y;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(dist, STICK_MAX_RADIUS);
    const angle = Math.atan2(rawDy, rawDx);

    const kx = dist > 0.5 ? Math.cos(angle) * clampedDist : 0;
    const ky = dist > 0.5 ? Math.sin(angle) * clampedDist : 0;
    setStickKnob({ x: kx, y: ky });

    // Apply small deadzone (14%) for rock-steady stopping
    const normMag = clampedDist / STICK_MAX_RADIUS;
    if (normMag < 0.14) {
      onMove(0, 0);
    } else {
      const scaled = (normMag - 0.14) / 0.86;
      onMove(Math.cos(angle) * scaled, Math.sin(angle) * scaled);
    }
  };

  const releaseStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    stickPointerId.current = null;
    setStickActive(false);
    setStickCenter(null);
    setStickKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const handleAttackDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    attackPointerId.current = e.pointerId;
    setAttackPressed(true);
    onAttackHeld(true);
  };

  const releaseAttack = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (attackPointerId.current !== e.pointerId) return;
    e.preventDefault();
    attackPointerId.current = null;
    setAttackPressed(false);
    onAttackHeld(false);
  };

  const novaReady = hud.essence >= hud.novaCost && hud.novaCooldown <= 0;
  const lanceReady = hud.essence >= hud.lanceCost && hud.lanceCooldown <= 0;
  const showInteract = hud.nearForge || (hud.nearExit && hud.exitUnlocked);

  return (
    <div
      data-testid="mobile-touch-controls"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-25 flex items-end justify-between px-3 pb-3 sm:px-5 sm:pb-5"
      style={{
        paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      {/* LEFT THUMB ZONE: Floating / Anchored Analog Movement Joystick */}
      <div
        data-testid="touch-joystick-zone"
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        className="pointer-events-auto relative w-[154px] h-[148px] [@media(max-height:460px)]:h-[126px] touch-none select-none"
        aria-label="Movement Joystick"
      >
        {/* Resting / Active Ring */}
        <div
          className="absolute w-[112px] h-[112px] rounded-full border transition-opacity duration-150 flex items-center justify-center"
          style={{
            left: stickCenter ? `${stickCenter.x - 56}px` : '14px',
            top: stickCenter ? `${stickCenter.y - 56}px` : '14px',
            backgroundColor: stickActive
              ? 'rgba(18, 14, 28, 0.72)'
              : 'rgba(14, 11, 22, 0.54)',
            borderColor: stickActive
              ? 'rgba(245, 196, 105, 0.78)'
              : 'rgba(201, 155, 82, 0.42)',
            boxShadow: stickActive
              ? '0 0 24px rgba(201, 155, 82, 0.22), inset 0 0 18px rgba(8, 6, 14, 0.85)'
              : 'inset 0 0 14px rgba(8, 6, 14, 0.75)',
          }}
        >
          {/* Cardinal micro ticks */}
          <span className="absolute top-2 w-1.5 h-1.5 rotate-45 bg-[#c99b52]/45" />
          <span className="absolute bottom-2 w-1.5 h-1.5 rotate-45 bg-[#c99b52]/45" />
          <span className="absolute left-2 w-1.5 h-1.5 rotate-45 bg-[#c99b52]/45" />
          <span className="absolute right-2 w-1.5 h-1.5 rotate-45 bg-[#c99b52]/45" />

          {/* Analog Thumbstick Knob */}
          <div
            className="w-[46px] h-[46px] rounded-full border-2 flex items-center justify-center"
            style={{
              transform: `translate3d(${stickKnob.x}px, ${stickKnob.y}px, 0)`,
              backgroundColor: stickActive ? '#c99b52' : 'rgba(34, 28, 49, 0.92)',
              borderColor: stickActive ? '#fde68a' : 'rgba(245, 196, 105, 0.65)',
              boxShadow: stickActive
                ? '0 0 18px rgba(245, 196, 105, 0.55)'
                : '0 4px 10px rgba(0, 0, 0, 0.65)',
            }}
          >
            <span
              className="w-2.5 h-2.5 rotate-45"
              style={{ backgroundColor: stickActive ? '#110e18' : '#f5c469' }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT THUMB ZONE: Ergonomic ARPG Action Cluster (all hitboxes >= 48x48px) */}
      <div className="pointer-events-none relative w-[204px] h-[184px] [@media(max-height:460px)]:h-[162px] shrink-0">
        {/* Contextual Interact Trigger (Forge / Rift Portal) */}
        {showInteract && (
          <button
            type="button"
            data-testid="touch-interact-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInteract();
            }}
            className="pointer-events-auto absolute -top-9 right-1 [@media(max-height:460px)]:top-auto [@media(max-height:460px)]:bottom-3 [@media(max-height:460px)]:right-[172px] min-h-[44px] px-4 flex items-center gap-2 rounded-full bg-[#c99b52] active:scale-95 text-[#110e18] font-display text-xs font-bold tracking-wider uppercase border border-[#fde68a] shadow-[0_6px_20px_rgba(0,0,0,0.65)] transition-transform touch-none whitespace-nowrap"
          >
            <ForgeIcon className="w-4 h-4 shrink-0" />
            <span>{hud.nearForge ? 'Open Forge' : 'Enter Portal'}</span>
          </button>
        )}

        {/* Siphon Flask (Top-Right of arc) */}
        <button
          type="button"
          data-testid="touch-flask-btn"
          aria-label="Drink Siphon Flask"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFlask();
          }}
          className={`pointer-events-auto absolute top-2 right-2 w-[52px] h-[52px] rounded-full obsidian-socket flex flex-col items-center justify-center active:scale-90 transition-transform touch-none ${
            hud.flaskCharges > 0 ? 'border-[#34d399]' : 'opacity-45'
          }`}
        >
          <FlaskIcon className="w-5 h-5" />
          <span className="font-mono-num text-[10px] font-bold text-[#34d399] leading-none mt-0.5">
            {hud.flaskCharges}
          </span>
        </button>

        {/* Rift Nova (Upper-Left of Slash arc) */}
        <button
          type="button"
          data-testid="touch-nova-btn"
          aria-label="Cast Rift Nova"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNova();
          }}
          className={`pointer-events-auto absolute top-[26px] right-[72px] w-[56px] h-[56px] rounded-full obsidian-socket flex flex-col items-center justify-center active:scale-90 transition-transform touch-none ${
            novaReady
              ? 'border-[#c084fc] shadow-[0_0_16px_rgba(167,139,250,0.38)]'
              : 'opacity-50'
          }`}
        >
          <NovaIcon className="w-6 h-6" />
          <span className="font-mono-num text-[9px] font-semibold text-[#e9d5ff] leading-none mt-0.5">
            {hud.novaCooldown > 0 ? `${hud.novaCooldown.toFixed(1)}s` : 'NOVA'}
          </span>
        </button>

        {/* Astral Lance (Unlocked Magic Tree skill — Left-Upper arc) */}
        {hud.lanceUnlocked && (
          <button
            type="button"
            data-testid="touch-lance-btn"
            aria-label="Cast Astral Lance"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLance();
            }}
            className={`pointer-events-auto absolute top-[62px] right-[136px] w-[52px] h-[52px] rounded-full obsidian-socket flex flex-col items-center justify-center active:scale-90 transition-transform touch-none ${
              lanceReady
                ? 'border-[#e879f9] shadow-[0_0_14px_rgba(232,121,249,0.35)]'
                : 'opacity-50'
            }`}
          >
            <LanceIcon className="w-5 h-5" />
            <span className="font-mono-num text-[9px] font-semibold text-[#f5d0fe] leading-none mt-0.5">
              {hud.lanceCooldown > 0 ? `${hud.lanceCooldown.toFixed(1)}s` : 'LANCE'}
            </span>
          </button>
        )}

        {/* Shadow Dash (Bottom-Left of Slash arc) */}
        <button
          type="button"
          data-testid="touch-dash-btn"
          aria-label="Shadow Dash"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDash();
          }}
          className={`pointer-events-auto absolute bottom-2 right-[96px] w-[58px] h-[58px] rounded-full obsidian-socket overflow-hidden flex flex-col items-center justify-center active:scale-90 transition-transform touch-none ${
            hud.dashCharges > 0 ? 'border-[#a78bfa]' : 'opacity-55'
          }`}
        >
          {hud.dashCharges < hud.maxDashCharges && (
            <div
              className="absolute bottom-0 inset-x-0 bg-[#a78bfa]/25 pointer-events-none"
              style={{ height: `${hud.dashRechargeRatio * 100}%` }}
            />
          )}
          <DashIcon className="w-6 h-6 relative z-10" />
          <div className="flex gap-1 mt-0.5 relative z-10">
            {Array.from({ length: hud.maxDashCharges }).map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full ${
                  idx < hud.dashCharges ? 'bg-[#c084fc]' : 'bg-[#2d2640]'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Primary SLASH Attack Button (Large Thumb Anchor — Tap or Hold for 3-Hit Combo) */}
        <button
          type="button"
          data-testid="touch-attack-btn"
          aria-label="Slash Attack"
          onPointerDown={handleAttackDown}
          onPointerUp={releaseAttack}
          onPointerCancel={releaseAttack}
          className="pointer-events-auto absolute bottom-2 right-2 w-[78px] h-[78px] rounded-full flex flex-col items-center justify-center border-2 transition-transform touch-none"
          style={{
            transform: attackPressed ? 'scale(0.91)' : 'scale(1)',
            backgroundColor: attackPressed
              ? 'rgba(201, 155, 82, 0.92)'
              : 'rgba(28, 22, 40, 0.94)',
            borderColor: attackPressed ? '#fef3c7' : '#f5c469',
            boxShadow: attackPressed
              ? '0 0 28px rgba(245, 196, 105, 0.72), inset 0 0 12px rgba(255, 251, 235, 0.45)'
              : '0 8px 24px rgba(4, 3, 10, 0.78), inset 0 1px 0 rgba(253, 230, 138, 0.25)',
          }}
        >
          <SlashIcon className="w-8 h-8" />
          <span
            className="font-display text-[10px] font-bold tracking-wider uppercase leading-none mt-0.5"
            style={{ color: attackPressed ? '#110e18' : '#fde68a' }}
          >
            Slash
          </span>
        </button>
      </div>
    </div>
  );
}
