/**
 * SoundSynthesizer — síntese 100% Web Audio API (sem arquivos de áudio).
 *
 * Grafo: [vozes] → busFilter (lowpass global, usado no Bullet Time)
 *                → master (volume/mute) → compressor → destination.
 * O timbre de cada efeito depende do grupo da era atual.
 */
import { EventBus } from './EventBus';
import { EraManager } from './EraManager';
import { EraId, type SoundEffect } from './types';

type Group = 'retro' | 'chip' | 'os' | 'synth';

function groupOf(era: EraId): Group {
  if (era <= EraId.MAC_1984) return 'retro';
  if (era <= EraId.SNES_1991) return 'chip';
  if (era <= EraId.FLASH_2005) return 'os';
  return 'synth';
}

/** MIDI → Hz. */
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

interface FilterOpts {
  type: BiquadFilterType;
  freq: number;
  /** Cutoff final (rampa exponencial ao longo da duração). */
  freqEnd?: number;
  /** Pico intermediário do cutoff (envelope ataque/decay). */
  freqPeak?: number;
  q?: number;
}

interface ToneOpts {
  type?: OscillatorType;
  wave?: PeriodicWave;
  freq: number;
  freqEnd?: number;
  /** 'exp' (padrão) ou 'lin' para o glide. */
  glide?: 'exp' | 'lin';
  start: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** Envelope seco (liga/desliga), estilo PC Speaker. */
  hard?: boolean;
  detune?: number;
  vibrato?: { rate: number; depth: number };
  filter?: FilterOpts;
}

interface NoiseOpts {
  start: number;
  dur: number;
  gain?: number;
  filter: FilterOpts;
}

class SoundSynthesizerImpl {
  private ctx: AudioContext | null = null;
  private busFilter: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pulseWaves = new Map<number, PeriodicWave>();
  private muted = false;
  private volume = 0.6;
  private unsubs: Array<() => void> = [];
  private initialized = false;
  private ambientTimer: ReturnType<typeof setInterval> | null = null;
  private ambientStep = 0;

  // ------------------------------------------------------------------ API

  /** Inscreve no EventBus (idempotente). */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubs.push(
      EventBus.on('PLAY_SFX', ({ sound }) => this.play(sound)),
      EventBus.on('ERA_CHANGED', ({ previous }) => {
        if (previous !== null) this.play('eraChange');
      }),
      EventBus.on('BULLET_TIME_CHANGED', ({ active }) => {
        this.setBusCutoff(active ? 1600 : 20000, active ? 0.25 : 0.12);
        this.play(active ? 'bulletTimeOn' : 'bulletTimeOff');
      }),
      EventBus.on('POPUP_CLOSED', () => this.play('click')),
    );
  }

  /** Cancela inscrições e para a música ambiente (não fecha o AudioContext). */
  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.initialized = false;
    this.stopAmbient();
  }

  /** Cria/retoma o AudioContext. Chamar no primeiro gesto do usuário. */
  async resume(): Promise<void> {
    try {
      if (!this.ctx) {
        const Ctor =
          typeof window !== 'undefined'
            ? window.AudioContext ??
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            : undefined;
        if (!Ctor) return;
        const ctx = new Ctor();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : this.volume;
        const bus = ctx.createBiquadFilter();
        bus.type = 'lowpass';
        bus.frequency.value = 20000;
        bus.Q.value = 0.7;
        bus.connect(master);
        master.connect(comp);
        comp.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.busFilter = bus;
        this.noiseBuffer = this.makeNoise(ctx);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      /* áudio indisponível: segue silencioso */
    }
  }

  play(sound: SoundEffect): void {
    const ctx = this.ready();
    if (!ctx) return;
    try {
      const era = EraManager.getCurrentEra();
      const t = ctx.currentTime + 0.005;
      switch (groupOf(era)) {
        case 'retro':
          this.playRetro(sound, t, era === EraId.VECTOR_1958 ? 'sine' : 'square');
          break;
        case 'chip':
          this.playChip(sound, t);
          break;
        case 'os':
          this.playOS(sound, t);
          break;
        case 'synth':
          this.playSynth(sound, t);
          break;
      }
    } catch {
      /* nunca propaga erros de áudio */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMaster();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
    this.applyMaster();
  }

  getVolume(): number {
    return this.volume;
  }

  /** Música ambiente curta em loop, por era (desligada por padrão). */
  startAmbient(): void {
    if (this.ambientTimer !== null) return;
    this.ambientStep = 0;
    this.ambientTimer = setInterval(() => this.ambientTick(), 180);
  }

  stopAmbient(): void {
    if (this.ambientTimer !== null) clearInterval(this.ambientTimer);
    this.ambientTimer = null;
  }

  isAmbientPlaying(): boolean {
    return this.ambientTimer !== null;
  }

  // ------------------------------------------------------------ internos

  /** Contexto pronto para tocar, ou null (no-op silencioso). */
  private ready(): AudioContext | null {
    const ctx = this.ctx;
    if (!ctx || !this.busFilter || ctx.state !== 'running' || this.muted) return null;
    return ctx;
  }

  private applyMaster(): void {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  private setBusCutoff(freq: number, tc: number): void {
    if (!this.ctx || !this.busFilter) return;
    try {
      const f = this.busFilter.frequency;
      f.cancelScheduledValues(this.ctx.currentTime);
      f.setTargetAtTime(freq, this.ctx.currentTime, tc);
    } catch {
      /* ignore */
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 1);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Onda de pulso com duty cycle (12.5%, 25%, 50%) — timbre NES. */
  private pulse(duty: number): PeriodicWave | undefined {
    const ctx = this.ctx;
    if (!ctx) return undefined;
    const cached = this.pulseWaves.get(duty);
    if (cached) return cached;
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    }
    const wave = ctx.createPeriodicWave(real, imag);
    this.pulseWaves.set(duty, wave);
    return wave;
  }

  private makeFilter(ctx: AudioContext, f: FilterOpts, start: number, dur: number): BiquadFilterNode {
    const filter = ctx.createBiquadFilter();
    filter.type = f.type;
    filter.Q.value = f.q ?? 1;
    const p = filter.frequency;
    p.setValueAtTime(f.freq, start);
    if (f.freqPeak !== undefined) {
      p.exponentialRampToValueAtTime(Math.max(20, f.freqPeak), start + Math.min(0.03, dur * 0.2));
    }
    if (f.freqEnd !== undefined) {
      p.exponentialRampToValueAtTime(Math.max(20, f.freqEnd), start + dur);
    }
    return filter;
  }

  /** Oscilador com envelope; sempre agendado para parar. */
  private tone(o: ToneOpts): void {
    const ctx = this.ctx;
    const out = this.busFilter;
    if (!ctx || !out) return;
    const { start, dur } = o;
    const peak = o.gain ?? 0.2;
    const osc = ctx.createOscillator();
    if (o.wave) osc.setPeriodicWave(o.wave);
    else osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, start);
    if (o.freqEnd !== undefined) {
      if (o.glide === 'lin') osc.frequency.linearRampToValueAtTime(o.freqEnd, start + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), start + dur);
    }
    if (o.detune) osc.detune.value = o.detune;

    const nodes: AudioNode[] = [osc];
    let lfo: OscillatorNode | null = null;
    if (o.vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = o.vibrato.rate;
      const depth = ctx.createGain();
      depth.gain.value = o.vibrato.depth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      nodes.push(lfo, depth);
    }

    const g = ctx.createGain();
    if (o.hard) {
      g.gain.setValueAtTime(peak, start);
      g.gain.setValueAtTime(0, start + dur);
    } else {
      const atk = o.attack ?? 0.005;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(peak, start + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(atk + 0.01, dur));
    }

    let head: AudioNode = osc;
    if (o.filter) {
      const filter = this.makeFilter(ctx, o.filter, start, dur);
      head.connect(filter);
      head = filter;
      nodes.push(filter);
    }
    head.connect(g);
    g.connect(out);
    nodes.push(g);

    const stopAt = start + dur + 0.05;
    osc.start(start);
    osc.stop(stopAt);
    if (lfo) {
      lfo.start(start);
      lfo.stop(stopAt);
    }
    osc.onended = () => nodes.forEach((n) => n.disconnect());
  }

  private noise(o: NoiseOpts): void {
    const ctx = this.ctx;
    const out = this.busFilter;
    if (!ctx || !out || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.makeFilter(ctx, o.filter, o.start, o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.start);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.2, o.start + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(o.start, Math.random() * 0.5);
    src.stop(o.start + o.dur + 0.05);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  /** Sequência de notas (arpejo). */
  private arp(
    notes: number[],
    start: number,
    step: number,
    base: Omit<ToneOpts, 'freq' | 'start' | 'dur'> & { dur?: number },
  ): void {
    notes.forEach((m, i) => {
      this.tone({ ...base, freq: mtof(m), start: start + i * step, dur: base.dur ?? step * 0.95 });
    });
  }

  /** Voz synthwave: 3 sawtooth detunadas + lowpass com envelope de cutoff. */
  private saw(
    freq: number,
    start: number,
    dur: number,
    gain: number,
    filter: FilterOpts,
    freqEnd?: number,
  ): void {
    for (const det of [-12, 0, 12]) {
      this.tone({ type: 'sawtooth', freq, freqEnd, start, dur, gain: gain / 3, detune: det, attack: 0.008, filter });
    }
  }

  // ----------------------------------------------- Eras 1-3: bipes / PC Speaker

  private playRetro(s: SoundEffect, t: number, w: OscillatorType): void {
    const beep = (f: number, at: number, d: number, g = 0.12): void =>
      this.tone({ type: w, freq: f, start: at, dur: d, gain: g, hard: true });
    switch (s) {
      case 'jump':
        beep(520, t, 0.05);
        beep(780, t + 0.05, 0.05);
        break;
      case 'doubleJump':
        beep(780, t, 0.04);
        beep(1040, t + 0.04, 0.06);
        break;
      case 'wallJump':
        beep(600, t, 0.035);
        beep(900, t + 0.035, 0.05);
        break;
      case 'land':
        beep(140, t, 0.035, 0.08);
        break;
      case 'coin':
        beep(988, t, 0.05);
        beep(1319, t + 0.05, 0.12);
        break;
      case 'artifact':
        [72, 76, 79, 84, 88].forEach((m, i) => beep(mtof(m), t + i * 0.07, 0.065));
        break;
      case 'dash':
        this.tone({ type: w, freq: 1200, freqEnd: 200, glide: 'lin', start: t, dur: 0.12, gain: 0.1, hard: true });
        break;
      case 'impact':
        beep(90, t, 0.08, 0.16);
        beep(60, t + 0.08, 0.1, 0.16);
        break;
      case 'eraChange':
        this.tone({ type: w, freq: 200, freqEnd: 1600, glide: 'lin', start: t, dur: 0.22, gain: 0.1, hard: true });
        beep(1600, t + 0.24, 0.06);
        break;
      case 'error':
        beep(220, t, 0.18, 0.14);
        beep(220, t + 0.24, 0.18, 0.14);
        break;
      case 'click':
        beep(2000, t, 0.012, 0.08);
        break;
      case 'bulletTimeOn':
        this.tone({ type: w, freq: 800, freqEnd: 200, glide: 'lin', start: t, dur: 0.3, gain: 0.1, hard: true });
        break;
      case 'bulletTimeOff':
        this.tone({ type: w, freq: 200, freqEnd: 800, glide: 'lin', start: t, dur: 0.2, gain: 0.1, hard: true });
        break;
      case 'death':
        [440, 330, 220, 110].forEach((f, i) => beep(f, t + i * 0.1, 0.09, 0.13));
        break;
      case 'bounce':
        this.tone({ type: w, freq: 300, freqEnd: 900, glide: 'lin', start: t, dur: 0.1, gain: 0.1, hard: true });
        break;
      case 'victory':
        [60, 64, 67, 72, 67, 72, 76, 84].forEach((m, i) => beep(mtof(m), t + i * 0.11, 0.1));
        break;
    }
  }

  // ----------------------------------------------- Eras 4-5: chiptune 8/16-bit

  private playChip(s: SoundEffect, t: number): void {
    const p25 = this.pulse(0.25);
    const p12 = this.pulse(0.125);
    const p50 = this.pulse(0.5);
    const lead = { wave: p25, type: 'square' as OscillatorType, gain: 0.1, attack: 0.002 };
    const bass = (m: number, at: number, d: number, g = 0.16): void =>
      this.tone({ type: 'triangle', freq: mtof(m), start: at, dur: d, gain: g, attack: 0.002 });
    switch (s) {
      case 'jump':
        this.arp([67, 71, 74, 79], t, 0.028, lead);
        this.tone({ ...lead, freq: 300, freqEnd: 700, start: t, dur: 0.12, gain: 0.05 });
        break;
      case 'doubleJump':
        this.arp([74, 79, 83, 86], t, 0.025, { ...lead, wave: p12 });
        break;
      case 'wallJump':
        this.arp([62, 69, 74], t, 0.03, lead);
        bass(50, t, 0.06);
        break;
      case 'land':
        this.tone({ type: 'triangle', freq: 110, freqEnd: 60, start: t, dur: 0.06, gain: 0.16 });
        this.noise({ start: t, dur: 0.04, gain: 0.06, filter: { type: 'lowpass', freq: 1500 } });
        break;
      case 'coin':
        this.tone({ ...lead, wave: p50, freq: mtof(83), start: t, dur: 0.06 });
        this.tone({ ...lead, wave: p50, freq: mtof(88), start: t + 0.06, dur: 0.28 });
        break;
      case 'artifact':
        this.arp([60, 64, 67, 72, 76, 79, 84, 88], t, 0.05, lead);
        bass(48, t, 0.4);
        bass(60, t + 0.4, 0.3);
        break;
      case 'dash':
        this.noise({ start: t, dur: 0.15, gain: 0.12, filter: { type: 'highpass', freq: 2500, freqEnd: 600 } });
        this.tone({ ...lead, freq: 900, freqEnd: 150, start: t, dur: 0.12, gain: 0.06 });
        break;
      case 'impact':
        this.noise({ start: t, dur: 0.2, gain: 0.18, filter: { type: 'lowpass', freq: 1800, freqEnd: 200 } });
        this.tone({ type: 'triangle', freq: 80, freqEnd: 40, start: t, dur: 0.2, gain: 0.2 });
        break;
      case 'eraChange':
        this.arp([60, 67, 72, 76, 79, 84, 88, 91], t, 0.035, { ...lead, wave: p12 });
        bass(36, t, 0.3);
        break;
      case 'error':
        this.tone({ ...lead, freq: mtof(58), start: t, dur: 0.12, gain: 0.12 });
        this.tone({ ...lead, freq: mtof(52), start: t + 0.13, dur: 0.2, gain: 0.12 });
        break;
      case 'click':
        this.tone({ ...lead, wave: p12, freq: 1500, start: t, dur: 0.02, gain: 0.07 });
        break;
      case 'bulletTimeOn':
        this.arp([84, 79, 76, 72, 67, 64, 60, 55], t, 0.05, lead);
        break;
      case 'bulletTimeOff':
        this.arp([55, 60, 64, 67, 72, 76, 79, 84], t, 0.03, lead);
        break;
      case 'death':
        this.arp([76, 75, 74, 73, 72, 71, 70, 69, 64, 57], t, 0.07, { ...lead, wave: p50 });
        bass(40, t + 0.5, 0.3);
        break;
      case 'bounce':
        this.tone({ ...lead, freq: 200, freqEnd: 800, start: t, dur: 0.15 });
        break;
      case 'victory': {
        const melody = [72, 72, 72, 72, 68, 70, 72, 70, 72];
        const durs = [0.1, 0.1, 0.1, 0.3, 0.3, 0.3, 0.15, 0.1, 0.6];
        let at = t;
        melody.forEach((m, i) => {
          this.tone({ ...lead, freq: mtof(m), start: at, dur: durs[i] * 0.95 });
          bass(m - 24, at, durs[i] * 0.9, 0.12);
          at += durs[i];
        });
        break;
      }
    }
  }

  // ----------------------------------------------- Eras 6-8: SO / Bullet Time / boing

  private playOS(s: SoundEffect, t: number): void {
    const boing = (f0: number, f1: number, d: number, g = 0.18): void =>
      this.tone({ type: 'triangle', freq: f0, freqEnd: f1, start: t, dur: d, gain: g, vibrato: { rate: 18, depth: f1 * 0.06 } });
    const ding = (freqs: number[], at: number, d: number, g: number): void =>
      freqs.forEach((f) => this.tone({ type: 'sine', freq: f, start: at, dur: d, gain: g, attack: 0.003 }));
    switch (s) {
      case 'jump':
        boing(160, 640, 0.2);
        break;
      case 'doubleJump':
        boing(260, 980, 0.18, 0.15);
        break;
      case 'wallJump':
        this.tone({ type: 'triangle', freq: 300, freqEnd: 700, start: t, dur: 0.12, gain: 0.16 });
        break;
      case 'land':
        this.tone({ type: 'sine', freq: 120, freqEnd: 60, start: t, dur: 0.1, gain: 0.25 });
        this.noise({ start: t, dur: 0.06, gain: 0.05, filter: { type: 'lowpass', freq: 900 } });
        break;
      case 'coin':
        ding([1318.5, 1975.5], t, 0.45, 0.09);
        break;
      case 'artifact':
        [64, 71, 76, 80, 83].forEach((m, i) =>
          this.tone({ type: 'triangle', freq: mtof(m), start: t + i * 0.11, dur: 0.9, gain: 0.08, attack: 0.02 }),
        );
        break;
      case 'dash':
        this.noise({ start: t, dur: 0.22, gain: 0.16, filter: { type: 'bandpass', freq: 3000, freqEnd: 500, q: 2 } });
        this.tone({ type: 'triangle', freq: 400, freqEnd: 120, start: t, dur: 0.18, gain: 0.08 });
        break;
      case 'impact':
        this.tone({ type: 'sine', freq: 90, freqEnd: 40, start: t, dur: 0.25, gain: 0.35 });
        this.noise({ start: t, dur: 0.15, gain: 0.12, filter: { type: 'lowpass', freq: 1200 } });
        break;
      case 'eraChange':
        // "Tada!" — acorde maior brilhante.
        [60, 64, 67, 72].forEach((m) => {
          this.tone({ type: 'triangle', freq: mtof(m), start: t, dur: 0.7, gain: 0.07, attack: 0.01 });
          this.tone({ type: 'sine', freq: mtof(m + 12), start: t + 0.04, dur: 0.6, gain: 0.04 });
        });
        break;
      case 'error':
        // "Ding" clássico de erro de SO: acorde dissonante (2ª menor + trítono).
        ding([880, 932.3, 1244.5], t, 0.6, 0.08);
        this.tone({ type: 'triangle', freq: 440, start: t, dur: 0.5, gain: 0.08 });
        break;
      case 'click':
        this.noise({ start: t, dur: 0.012, gain: 0.12, filter: { type: 'highpass', freq: 3000 } });
        this.tone({ type: 'sine', freq: 1800, start: t, dur: 0.02, gain: 0.05 });
        break;
      case 'bulletTimeOn':
        // Desaceleração: pitch descendo + lowpass fechando.
        this.tone({
          type: 'sawtooth', freq: 600, freqEnd: 70, start: t, dur: 1.0, gain: 0.14,
          filter: { type: 'lowpass', freq: 5000, freqEnd: 250, q: 4 },
        });
        this.noise({ start: t, dur: 0.9, gain: 0.08, filter: { type: 'lowpass', freq: 4000, freqEnd: 200 } });
        break;
      case 'bulletTimeOff':
        this.tone({
          type: 'sawtooth', freq: 80, freqEnd: 600, start: t, dur: 0.6, gain: 0.12,
          filter: { type: 'lowpass', freq: 250, freqEnd: 6000, q: 4 },
        });
        this.noise({ start: t, dur: 0.5, gain: 0.06, filter: { type: 'lowpass', freq: 200, freqEnd: 5000 } });
        break;
      case 'death':
        this.tone({ type: 'sine', freq: 600, freqEnd: 80, start: t, dur: 0.8, gain: 0.2 });
        ding([622.3, 659.3], t + 0.1, 0.5, 0.06);
        break;
      case 'bounce':
        boing(120, 720, 0.32, 0.22);
        break;
      case 'victory':
        [72, 76, 79, 84].forEach((m, i) =>
          this.tone({ type: 'triangle', freq: mtof(m), start: t + i * 0.12, dur: 0.3, gain: 0.1 }),
        );
        [60, 64, 67, 72, 76].forEach((m) =>
          this.tone({ type: 'sine', freq: mtof(m), start: t + 0.5, dur: 1.2, gain: 0.06, attack: 0.02 }),
        );
        break;
    }
  }

  // ----------------------------------------------- Eras 9-10: synthwave / neon

  private playSynth(s: SoundEffect, t: number): void {
    const sub = (f0: number, f1: number, at: number, d: number, g: number): void =>
      this.tone({ type: 'sine', freq: f0, freqEnd: f1, start: at, dur: d, gain: g });
    switch (s) {
      case 'jump':
        this.saw(330, t, 0.15, 0.18, { type: 'lowpass', freq: 600, freqPeak: 5000, freqEnd: 800, q: 6 }, 660);
        break;
      case 'doubleJump':
        this.saw(440, t, 0.15, 0.16, { type: 'lowpass', freq: 800, freqPeak: 7000, freqEnd: 1200, q: 6 }, 990);
        break;
      case 'wallJump':
        this.saw(392, t, 0.12, 0.16, { type: 'lowpass', freq: 700, freqPeak: 5000, freqEnd: 900, q: 5 }, 784);
        break;
      case 'land':
        sub(80, 45, t, 0.12, 0.3);
        this.noise({ start: t, dur: 0.06, gain: 0.05, filter: { type: 'lowpass', freq: 700 } });
        break;
      case 'coin':
        [84, 91].forEach((m, i) =>
          this.saw(mtof(m), t + i * 0.06, 0.12 + i * 0.12, 0.12, { type: 'lowpass', freq: 1500, freqPeak: 9000, freqEnd: 2000, q: 3 }),
        );
        break;
      case 'artifact':
        [60, 67, 72, 76].forEach((m) =>
          this.saw(mtof(m), t, 1.1, 0.1, { type: 'lowpass', freq: 300, freqEnd: 6000, q: 4 }),
        );
        sub(65.4, 65.4, t, 1.0, 0.2);
        break;
      case 'dash':
        // Dash encorpado: ruído filtrado + sub + saw.
        this.noise({ start: t, dur: 0.25, gain: 0.25, filter: { type: 'bandpass', freq: 3000, freqEnd: 600, q: 1.5 } });
        sub(70, 40, t, 0.25, 0.35);
        this.saw(220, t, 0.2, 0.1, { type: 'lowpass', freq: 2000, freqEnd: 300, q: 3 }, 110);
        break;
      case 'impact':
        // Grave: sine 55Hz com queda de pitch + ruído.
        sub(58, 28, t, 0.45, 0.6);
        this.noise({ start: t, dur: 0.2, gain: 0.18, filter: { type: 'lowpass', freq: 1200, freqEnd: 150 } });
        break;
      case 'eraChange':
        this.saw(110, t, 0.4, 0.12, { type: 'lowpass', freq: 200, freqEnd: 8000, q: 8 }, 880);
        [57, 64, 69, 72, 76, 81].forEach((m, i) =>
          this.saw(mtof(m), t + 0.1 + i * 0.05, 0.18, 0.08, { type: 'lowpass', freq: 800, freqPeak: 6000, freqEnd: 1000, q: 4 }),
        );
        break;
      case 'error':
        [70, 71].forEach((m) => this.saw(mtof(m), t, 0.3, 0.12, { type: 'lowpass', freq: 1200, freqEnd: 400, q: 3 }));
        break;
      case 'click':
        this.tone({ type: 'sine', freq: 2400, start: t, dur: 0.015, gain: 0.06 });
        this.noise({ start: t, dur: 0.01, gain: 0.08, filter: { type: 'highpass', freq: 5000 } });
        break;
      case 'bulletTimeOn':
        this.saw(400, t, 0.8, 0.16, { type: 'lowpass', freq: 3000, freqEnd: 200, q: 6 }, 60);
        sub(80, 40, t, 0.8, 0.2);
        break;
      case 'bulletTimeOff':
        this.saw(60, t, 0.5, 0.14, { type: 'lowpass', freq: 200, freqEnd: 4000, q: 6 }, 400);
        break;
      case 'death':
        [69, 72, 76].forEach((m) =>
          this.saw(mtof(m), t, 1.0, 0.08, { type: 'lowpass', freq: 4000, freqEnd: 150, q: 5 }, mtof(m - 36)),
        );
        sub(60, 30, t, 0.5, 0.4);
        break;
      case 'bounce':
        this.saw(150, t, 0.22, 0.16, { type: 'lowpass', freq: 400, freqEnd: 6000, q: 8 }, 900);
        break;
      case 'victory':
        [60, 64, 67, 71, 72, 76, 79, 83, 84].forEach((m, i) =>
          this.saw(mtof(m), t + i * 0.09, 0.16, 0.1, { type: 'lowpass', freq: 900, freqPeak: 7000, freqEnd: 1200, q: 4 }),
        );
        [48, 55, 60, 64].forEach((m) =>
          this.saw(mtof(m), t + 0.8, 1.4, 0.07, { type: 'lowpass', freq: 400, freqEnd: 5000, q: 2 }),
        );
        break;
    }
  }

  // ----------------------------------------------- Música ambiente

  private ambientTick(): void {
    const ctx = this.ready();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + 0.01;
      const step = this.ambientStep++;
      const group = groupOf(EraManager.getCurrentEra());
      const progression = [45, 41, 36, 43]; // Lá m — Fá — Dó — Sol
      const root = progression[Math.floor(step / 16) % progression.length];
      const arpNotes = [0, 7, 12, 15, 12, 7, 3, 7];
      const n = root + 24 + arpNotes[step % arpNotes.length];
      switch (group) {
        case 'retro':
          if (step % 4 === 0) this.tone({ type: 'sine', freq: mtof(root + 24), start: t, dur: 0.05, gain: 0.025, hard: true });
          break;
        case 'chip':
          this.tone({ wave: this.pulse(0.125), freq: mtof(n), start: t, dur: 0.08, gain: 0.025 });
          if (step % 4 === 0) this.tone({ type: 'triangle', freq: mtof(root), start: t, dur: 0.3, gain: 0.05 });
          break;
        case 'os':
          if (step % 2 === 0) this.tone({ type: 'triangle', freq: mtof(n), start: t, dur: 0.4, gain: 0.02, attack: 0.03 });
          break;
        case 'synth':
          if (step % 2 === 0) {
            this.saw(mtof(n), t, 0.3, 0.03, { type: 'lowpass', freq: 400, freqPeak: 2500, freqEnd: 500, q: 4 });
          }
          if (step % 8 === 0) this.tone({ type: 'sine', freq: mtof(root - 12), start: t, dur: 1.2, gain: 0.08, attack: 0.05 });
          break;
      }
    } catch {
      /* ignore */
    }
  }
}

export type { SoundSynthesizerImpl };
export const SoundSynthesizer = new SoundSynthesizerImpl();
