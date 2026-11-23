import { useEffect, useRef, useState } from 'react';

interface TitleScreenProps {
  bestScore: number;
  bestFloor: number;
  isTouchDevice?: boolean;
  onStart: () => void;
  hasMidRunSave?: boolean;
  onResume?: () => void;
  onOpenCodex?: () => void;
}

const TITLE_BG_SRC = '/src/assets/images/title_bg_1795156422135.jpg';

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  kind: 'ember' | 'rift' | 'shard';
}

interface RiftFilament {
  xRatio: number;
  yRatio: number;
  length: number;
  phase: number;
  speed: number;
  hue: 'violet' | 'gold';
}

/**
 * Lightweight 60fps atmospheric particle & dimensional rift seam overlay
 * for the Shadow Rift title page (pauses automatically under prefers-reduced-motion).
 */
function TitleRiftCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const isMobile = width < 768;
    const emberCount = isMobile ? 38 : 68;
    const particles: EmberParticle[] = [];
    for (let i = 0; i < emberCount; i++) {
      const roll = Math.random();
      const kind: EmberParticle['kind'] =
        roll < 0.56 ? 'ember' : roll < 0.88 ? 'rift' : 'shard';
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (kind === 'rift' ? -10 : 12) + (Math.random() - 0.5) * 18,
        vy: -(18 + Math.random() * (kind === 'shard' ? 42 : 30)),
        radius:
          kind === 'shard'
            ? 2.2 + Math.random() * 2.6
            : 1.2 + Math.random() * 2.4,
        alpha: 0.25 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
        speed: 1.4 + Math.random() * 2.2,
        kind,
      });
    }

    const filaments: RiftFilament[] = Array.from({ length: isMobile ? 6 : 10 }, (_, idx) => ({
      xRatio: 0.62 + (idx / 10) * 0.28 + (Math.random() - 0.5) * 0.04,
      yRatio: 0.16 + Math.random() * 0.62,
      length: 65 + Math.random() * 140,
      phase: Math.random() * Math.PI * 2,
      speed: 1.1 + Math.random() * 1.4,
      hue: idx % 3 === 0 ? 'gold' : 'violet',
    }));

    let rafId: number | null = null;
    let lastTime = performance.now();
    let elapsed = 0;

    const drawFrame = (dt: number) => {
      elapsed += dt;
      ctx.clearRect(0, 0, width, height);

      // 1. Subtle rising dimensional rift filaments on the right focal area
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of filaments) {
        const pulse = 0.22 + 0.5 * (0.5 + 0.5 * Math.sin(elapsed * f.speed + f.phase));
        const fx = width * f.xRatio + Math.sin(elapsed * 0.7 + f.phase) * 8;
        const fy = height * f.yRatio - ((elapsed * 14 + f.phase * 20) % 70);

        const grad = ctx.createLinearGradient(fx, fy - f.length * 0.5, fx, fy + f.length * 0.5);
        if (f.hue === 'violet') {
          grad.addColorStop(0, 'rgba(167, 139, 250, 0)');
          grad.addColorStop(0.5, `rgba(192, 132, 252, ${0.22 * pulse})`);
          grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
        } else {
          grad.addColorStop(0, 'rgba(245, 196, 105, 0)');
          grad.addColorStop(0.5, `rgba(253, 224, 71, ${0.18 * pulse})`);
          grad.addColorStop(1, 'rgba(245, 196, 105, 0)');
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = f.hue === 'gold' ? 1.5 : 2.1;
        ctx.beginPath();
        ctx.moveTo(fx, fy - f.length * 0.5);
        ctx.lineTo(fx, fy + f.length * 0.5);
        ctx.stroke();
      }

      // 2. Drifting molten embers, violet rift motes, and sharp diamond sparks
      for (const p of particles) {
        p.x += (p.vx + Math.sin(elapsed * p.speed + p.phase) * 14) * dt;
        p.y += p.vy * dt;

        if (p.y < -20) {
          p.y = height + 15 + Math.random() * 40;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        const twinkle = 0.45 + 0.55 * Math.sin(elapsed * p.speed * 2.1 + p.phase);
        const a = p.alpha * twinkle;

        if (p.kind === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(elapsed * 0.9 + p.phase);
          ctx.fillStyle = `rgba(254, 243, 199, ${a})`;
          ctx.beginPath();
          ctx.moveTo(0, -p.radius * 1.9);
          ctx.lineTo(p.radius * 0.8, 0);
          ctx.lineTo(0, p.radius * 1.9);
          ctx.lineTo(-p.radius * 0.8, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const glowR = p.radius * 3.4;
          const radGrad = ctx.createRadialGradient(p.x, p.y, 0.2, p.x, p.y, glowR);
          if (p.kind === 'ember') {
            radGrad.addColorStop(0, `rgba(254, 240, 180, ${a})`);
            radGrad.addColorStop(0.45, `rgba(245, 158, 11, ${a * 0.55})`);
            radGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          } else {
            radGrad.addColorStop(0, `rgba(233, 213, 255, ${a})`);
            radGrad.addColorStop(0.45, `rgba(167, 139, 250, ${a * 0.55})`);
            radGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
          }
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    if (reducedMotion) {
      drawFrame(0.016);
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    const isAutomated = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
    let timerId: number | null = null;

    const tick = (now: number) => {
      rafId = null;
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      drawFrame(dt);

      if (isAutomated) {
        timerId = window.setTimeout(() => {
          timerId = null;
          rafId = requestAnimationFrame(tick);
        }, 48);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
    />
  );
}

export function TitleScreen({
  bestScore,
  bestFloor,
  isTouchDevice = false,
  onStart,
  hasMidRunSave = false,
  onResume,
  onOpenCodex,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } catch {
      // Ignore prompt errors
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const nx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    const ny = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    setParallax({ x: -nx * 10, y: -ny * 6 });
  };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between overflow-hidden bg-[#0c0a13]"
      role="main"
      onPointerMove={handlePointerMove}
    >
      {/* Key-Art Backdrop with Slow Cinematic Breathing Zoom + Subtle Mouse Parallax */}
      <div
        className="pointer-events-none absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
        }}
      >
        {!imgFailed ? (
          <img
            src={TITLE_BG_SRC}
            alt="Hooded Riftblade warrior overlooking a glowing obsidian dimensional rift"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="sr-animate-backdrop absolute inset-0 h-full w-full object-cover object-[78%_center] sm:object-center"
          />
        ) : (
          <div
            className="sr-animate-backdrop absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 72% 44%, rgba(167, 139, 250, 0.28) 0%, rgba(245, 196, 105, 0.14) 24%, #0c0a13 68%)',
            }}
          />
        )}
      </div>

      {/* Breathing Amethyst-Gold Dimensional Rift Aura over the right-side chasm */}
      <div
        className="sr-animate-rift-aura pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse 36% 58% at 74% 48%, rgba(167, 139, 250, 0.24) 0%, rgba(245, 196, 105, 0.1) 42%, rgba(12, 10, 19, 0) 74%)',
        }}
      />

      {/* Measured left-side contrast scrim over calm negative space */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            'linear-gradient(90deg, rgba(10, 8, 16, 0.9) 0%, rgba(10, 8, 16, 0.62) 44%, rgba(10, 8, 16, 0.16) 76%, rgba(10, 8, 16, 0.44) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            'linear-gradient(180deg, rgba(10, 8, 16, 0.35) 0%, rgba(10, 8, 16, 0) 35%, rgba(10, 8, 16, 0.84) 100%)',
        }}
      />

      {/* Live 60fps Drifting Molten Embers & Rift Motes Overlay */}
      <TitleRiftCanvas />

      {/* Top Safe Spacer */}
      <div className="relative z-10 h-6 sm:h-10" />

      {/* Left-Third Negative Space Choreographed Title Lockup & Single Primary CTA */}
      <div className="relative z-10 flex w-full flex-col items-start px-6 sm:px-14 lg:px-20 max-w-2xl">
        {/* Animated Bespoke Inline SVG Title Emblem & Engraved Shimmer Lockup */}
        <svg
          viewBox="0 0 460 158"
          className="w-full max-w-[330px] sm:max-w-[445px] h-auto mb-6 sm:mb-7 drop-shadow-[0_12px_32px_rgba(4,3,10,0.95)]"
          role="img"
          aria-label="Shadow Rift"
        >
          <defs>
            {/* Animated Metallic Gold Sweep Gradient */}
            <linearGradient id="sr-gold-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d4a454" />
              <stop offset="40%" stopColor="#f5c469" />
              <stop offset="50%" stopColor="#fffbeb" />
              <stop offset="60%" stopColor="#f5c469" />
              <stop offset="100%" stopColor="#c99b52" />
              <animate
                attributeName="x1"
                values="-120%;140%;140%"
                keyTimes="0;0.45;1"
                dur="4.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="x2"
                values="-20%;240%;240%"
                keyTimes="0;0.45;1"
                dur="4.8s"
                repeatCount="indefinite"
              />
            </linearGradient>

            <linearGradient id="sr-ivory-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e8dfd0" />
              <stop offset="44%" stopColor="#f7f0e2" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="56%" stopColor="#f7f0e2" />
              <stop offset="100%" stopColor="#dfd5c3" />
              <animate
                attributeName="x1"
                values="-100%;150%;150%"
                keyTimes="0;0.4;1"
                dur="5.6s"
                begin="0.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="x2"
                values="0%;250%;250%"
                keyTimes="0;0.4;1"
                dur="5.6s"
                begin="0.8s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>

          {/* Ornamental Obsidian Blade & Rift Seam Crest */}
          <g transform="translate(0, 4)">
            <g className="sr-animate-blade">
              <path
                d="M28 8L34 26L28 48L22 26L28 8Z"
                fill="url(#sr-gold-sheen)"
                stroke="#0c0a13"
                strokeWidth="2"
              />
              <path
                d="M12 26H44"
                stroke="#c99b52"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
            <path
              className="sr-animate-rift-core"
              d="M28 0L32 12L28 19L24 12Z"
              fill="#c084fc"
            />
            <line
              className="sr-animate-crest-line"
              x1="56"
              y1="26"
              x2="220"
              y2="26"
              stroke="#c99b52"
              strokeOpacity="0.62"
              strokeWidth="1.3"
            />
            <polygon
              className="sr-animate-rise-1"
              points="228,26 222,22 222,30"
              fill="#f5c469"
              fillOpacity="0.85"
            />
          </g>

          {/* Engraved Display Typography with Traveling Metallic Sheen */}
          <g className="sr-animate-rise-1">
            <text
              x="2"
              y="102"
              fill="url(#sr-ivory-sheen)"
              stroke="#0b0912"
              strokeWidth="5"
              style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: '56px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                paintOrder: 'stroke fill',
              }}
            >
              SHADOW
            </text>
          </g>

          <g className="sr-animate-rise-2">
            <text
              x="4"
              y="145"
              fill="url(#sr-gold-sheen)"
              stroke="#0b0912"
              strokeWidth="4.5"
              style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: '39px',
                fontWeight: 700,
                letterSpacing: '0.28em',
                paintOrder: 'stroke fill',
              }}
            >
              RIFT
            </text>
            <path
              className="sr-animate-crest-line"
              d="M178 133H405"
              stroke="#a78bfa"
              strokeOpacity="0.72"
              strokeWidth="1.6"
            />
            <polygon points="414,133 405,128 405,138" fill="#c084fc" />
          </g>
        </svg>

        {/* Primary Start / Resume Actions */}
        <div className="sr-animate-rise-3 flex flex-col items-start gap-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {hasMidRunSave && onResume && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onResume();
                }}
                className="group relative overflow-hidden inline-flex items-center gap-3 min-h-[54px] px-8 py-4 bg-[#8b5cf6] hover:bg-[#a78bfa] active:scale-[0.97] text-[#f5f3ff] font-display font-bold text-base sm:text-lg tracking-wider border border-[#c4b5fd]/75 shadow-[0_12px_34px_rgba(0,0,0,0.72),0_0_24px_rgba(139,92,246,0.35)] transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd] whitespace-nowrap shrink-0"
              >
                <span
                  aria-hidden="true"
                  className="sr-animate-cta-sheen pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-[#fffbeb]/55 to-transparent"
                />
                <span className="relative z-10">Resume Run</span>
                <span className="relative z-10 text-xs px-2 py-0.5 bg-[#4c1d95] rounded text-[#ddd6fe]">
                  Floor {bestFloor || 1}
                </span>
              </button>
            )}

            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="group relative overflow-hidden inline-flex items-center gap-3 min-h-[54px] px-8 py-4 bg-[#c99b52] hover:bg-[#dfb36b] active:scale-[0.97] text-[#110e18] font-display font-bold text-base sm:text-lg tracking-wider border border-[#fde68a]/75 shadow-[0_12px_34px_rgba(0,0,0,0.72),0_0_24px_rgba(201,155,82,0.22)] transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fde68a] whitespace-nowrap shrink-0"
            >
              <span
                aria-hidden="true"
                className="sr-animate-cta-sheen pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-[#fffbeb]/55 to-transparent"
              />
              <span className="relative z-10">{hasMidRunSave ? 'New Run' : 'Enter the Rift'}</span>
              <svg
                viewBox="0 0 20 20"
                className="relative z-10 w-5 h-5 transition-transform duration-150 group-hover:translate-x-1"
                aria-hidden="true"
              >
                <path
                  d="M4 10H15M11 5L16 10L11 15"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>

            {onOpenCodex && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenCodex();
                }}
                className="min-h-[54px] px-5 py-4 bg-[#1e172e]/90 hover:bg-[#2b2142] text-[#f5c469] font-display font-semibold text-sm tracking-wider border border-[#c99b52]/40 shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-all duration-150 cursor-pointer"
              >
                📜 Codex & Bestiary
              </button>
            )}

            {installPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="min-h-[54px] px-5 py-4 bg-[#047857] hover:bg-[#059669] text-[#ecfdf5] font-display font-bold text-sm tracking-wider border border-[#34d399]/60 shadow-[0_8px_24px_rgba(4,120,87,0.4)] transition-all duration-150 cursor-pointer flex items-center gap-2"
              >
                <span>📲</span> Install App
              </button>
            )}
          </div>

          {bestScore > 0 && (
            <div className="text-xs tracking-wide text-[#d4c8b4] hud-text-shadow font-mono-num">
              Best Floor {bestFloor} · High Score {bestScore.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Control Hint Line in Bottom Safe Margin */}
      <footer
        className="sr-animate-rise-4 relative z-10 w-full px-6 sm:px-14 lg:px-20 pt-3"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <p className="text-xs sm:text-[13px] text-[#d6cbb8]/90 hud-text-shadow tracking-wide">
          {isTouchDevice
            ? 'Left Stick Move · Hold Slash Combo · Tap Dash, Nova & Flask · Forge & Skills Top-Right'
            : 'WASD Move · Click/X Slash · Space/B Dash · Q/RB Nova · E/Y Flask · C Forge · K Skills · B Codex · Gamepad Supported'}
        </p>
      </footer>
    </div>
  );
}
