import type { DungeonThemeId } from './types';

const STORAGE_MASTER_VOL = 'shadow_rift_vol_master';
const STORAGE_SFX_VOL = 'shadow_rift_vol_sfx';
const STORAGE_MUSIC_VOL = 'shadow_rift_vol_music';

export class ShadowRiftAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private muted = false;
  private masterVolume = 1.0;
  private sfxVolume = 0.85;
  private musicVolume = 0.45;

  // Procedural ambient music state
  private currentTheme: DungeonThemeId | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private ambientGain: GainNode | null = null;
  private pulseTimer: number | null = null;
  private ambientPaused = false;

  constructor() {
    this.loadPersistedVolumes();
  }

  private loadPersistedVolumes(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const mv = localStorage.getItem(STORAGE_MASTER_VOL);
      if (mv !== null) this.masterVolume = Math.max(0, Math.min(1, parseFloat(mv) || 1.0));
      const sv = localStorage.getItem(STORAGE_SFX_VOL);
      if (sv !== null) this.sfxVolume = Math.max(0, Math.min(1, parseFloat(sv) || 0.85));
      const bgm = localStorage.getItem(STORAGE_MUSIC_VOL);
      if (bgm !== null) this.musicVolume = Math.max(0, Math.min(1, parseFloat(bgm) || 0.45));
    } catch {
      // Ignore storage access errors
    }
  }

  private savePersistedVolumes(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_MASTER_VOL, this.masterVolume.toString());
      localStorage.setItem(STORAGE_SFX_VOL, this.sfxVolume.toString());
      localStorage.setItem(STORAGE_MUSIC_VOL, this.musicVolume.toString());
    } catch {
      // Ignore storage quota errors
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    this.updateGains();
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.updateGains();
    return this.muted;
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.savePersistedVolumes();
    this.updateGains();
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.savePersistedVolumes();
    this.updateGains();
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    this.savePersistedVolumes();
    this.updateGains();
  }

  private updateGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const effectiveMaster = this.muted ? 0 : this.masterVolume;
    this.masterGain.gain.setValueAtTime(effectiveMaster, now);
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, now);
    this.musicGain.gain.setValueAtTime(this.musicVolume, now);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this.updateGains();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getSfxDestination(): AudioNode | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return null;
    return this.sfxGain;
  }

  private randPitch(base: number, variance = 0.08): number {
    return base * (1 + (Math.random() * 2 - 1) * variance);
  }

  // --- Procedural Dark-Ambient Music ---
  public setAmbientTheme(themeId: DungeonThemeId): void {
    if (this.currentTheme === themeId && this.ambientOscillators.length > 0) return;
    this.currentTheme = themeId;
    this.startAmbientTheme(themeId);
  }

  public pauseAmbient(): void {
    this.ambientPaused = true;
    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.linearRampToValueAtTime(0.001, now + 0.4);
    }
  }

  public resumeAmbient(): void {
    this.ambientPaused = false;
    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.linearRampToValueAtTime(1.0, now + 0.8);
    } else if (this.currentTheme) {
      this.startAmbientTheme(this.currentTheme);
    }
  }

  public stopAmbient(): void {
    if (this.pulseTimer !== null) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.ambientGain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      } catch {
        // Safe fallback
      }
    }
    setTimeout(() => {
      this.ambientOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Already stopped
        }
      });
      this.ambientOscillators = [];
      this.ambientGain = null;
    }, 600);
  }

  private startAmbientTheme(themeId: DungeonThemeId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;

    this.stopAmbient();

    const now = ctx.currentTime;
    const themeGain = ctx.createGain();
    themeGain.gain.setValueAtTime(0.001, now);
    themeGain.gain.linearRampToValueAtTime(this.ambientPaused ? 0.001 : 1.0, now + 1.2);
    themeGain.connect(this.musicGain);
    this.ambientGain = themeGain;

    // Theme frequency palettes (sub-bass drone + ethereal overtone chords)
    const palettes: Record<DungeonThemeId, { freqs: number[]; filterFreq: number; type: OscillatorType }> = {
      obsidian_catacombs: { freqs: [36.7, 73.4, 110.0, 164.8], filterFreq: 320, type: 'sawtooth' }, // D minor dark rumble
      ember_forge: { freqs: [41.2, 82.4, 123.5, 196.0], filterFreq: 450, type: 'triangle' }, // E minor warm metallic heat
      astral_sanctum: { freqs: [48.9, 97.9, 146.8, 220.0, 329.6], filterFreq: 680, type: 'sine' }, // G minor ethereal shimmer
      blighted_crypt: { freqs: [34.6, 69.3, 98.0, 138.6], filterFreq: 280, type: 'sawtooth' }, // C# diminished tritone dissonance
    };

    const palette = palettes[themeId] || palettes.obsidian_catacombs;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(palette.filterFreq, now);
    filter.connect(themeGain);

    // LFO for slow ambient breathing filter sweep
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, now); // ~12 second cycle
    lfoGain.gain.setValueAtTime(palette.filterFreq * 0.45, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);
    this.ambientOscillators.push(lfo);

    // Spawn harmonic drone oscillators
    palette.freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = palette.type;
      osc.frequency.setValueAtTime(freq * (1 + (idx % 2 === 0 ? 0.003 : -0.003)), now);
      
      const vol = 0.07 / (idx + 1);
      oscGain.gain.setValueAtTime(vol, now);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
      this.ambientOscillators.push(osc);
    });

    // Ambient procedural resonant chimes every 5-8 seconds
    const chimePitches = palette.freqs.slice(1).map((f) => f * 2);
    this.pulseTimer = window.setInterval(() => {
      if (this.ambientPaused || this.muted || !this.ctx || !this.musicGain) return;
      try {
        const t = this.ctx.currentTime;
        const chimeOsc = this.ctx.createOscillator();
        const chimeGain = this.ctx.createGain();
        const pickPitch = chimePitches[Math.floor(Math.random() * chimePitches.length)];

        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(pickPitch, t);
        chimeGain.gain.setValueAtTime(0.045, t);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);

        chimeOsc.connect(chimeGain);
        chimeGain.connect(this.musicGain);
        chimeOsc.start(t);
        chimeOsc.stop(t + 2.9);
      } catch {
        // Audio context may be closed/suspended
      }
    }, 6200);
  }

  // --- Sound Effects ---

  public playSlash(comboStep: 1 | 2 | 3): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const dur = comboStep === 3 ? 0.19 : 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = comboStep === 3 ? 'sawtooth' : 'triangle';
    const startFreq = comboStep === 3 ? 280 : comboStep === 2 ? 360 : 410;
    osc.frequency.setValueAtTime(this.randPitch(startFreq), now);
    osc.frequency.exponentialRampToValueAtTime(
      comboStep === 3 ? 72 : 110,
      now + dur
    );

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(comboStep === 3 ? 0.14 : 0.09, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(comboStep === 3 ? 1600 : 1200, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  public playHit(heavy: boolean, blocked = false): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = blocked ? 'square' : heavy ? 'sawtooth' : 'triangle';
    const f0 = blocked ? 520 : heavy ? 165 : 240;
    const f1 = blocked ? 290 : heavy ? 42 : 75;
    const dur = heavy ? 0.16 : 0.09;

    osc.frequency.setValueAtTime(this.randPitch(f0), now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + dur);

    gain.gain.setValueAtTime(heavy ? 0.17 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  public playDash(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.randPitch(320), now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playNova(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(48, now + 0.42);
    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.exponentialRampToValueAtTime(110, now + 0.35);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  }

  public playLance(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.24);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playPickup(isMaterial = false): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = isMaterial ? 620 : 520;
    osc.frequency.setValueAtTime(this.randPitch(base, 0.06), now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.11);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playHurt(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.22);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playTelegraph(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(510, now + 0.14);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playForgeCraft(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [440, 660, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.03);
      gain.gain.setValueAtTime(0.11 / (i + 1), now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + i * 0.03);
      osc.stop(now + 0.46);
    });
  }

  public playSkillUnlock(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const notes = [392, 493.88, 587.33, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playHeal(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [330, 440, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playRoomClear(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [293.66, 369.99, 440, 587.33].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playVictory(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [261.63, 329.63, 392, 523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.56);
    });
  }

  public playDefeat(): void {
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [220, 196, 164.81, 130.81].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.14;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  public destroy(): void {
    this.stopAmbient();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Safe fallback
      }
      this.ctx = null;
    }
  }
}
