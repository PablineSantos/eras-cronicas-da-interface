/**
 * EraVisualRenderer — dono das texturas procedurais, do fundo/parallax,
 * dos efeitos de tela por era (scanlines, Matrix, bolhas, bloom) e das
 * explosões de partículas.
 *
 * Depths: fundo -100..-10, partículas 30, overlays (scanlines/flash) 50+.
 */
import Phaser from 'phaser';
import { EventBus } from '../../core/EventBus';
import { ERA_CONFIGS } from '../../core/EraManager';
import {
  type BurstKind,
  EraId,
  type EraPalette,
  type IEraVisualRenderer,
  PARTICLE_TEXTURE_KEY,
} from '../../core/types';
import {
  type Ctx,
  MONO,
  canvasTexture,
  dither,
  hexToInt,
  rgba,
  shade,
} from './canvasUtils';
import { PIXEL_PARTICLE_KEY, generateAllTextures, longShadow } from './eraTextures';

/** Camada de parallax em screen-space (TileSprite com scrollFactor 0). */
interface ParallaxLayer {
  obj: Phaser.GameObjects.TileSprite;
  fx: number;
  fy: number;
  /** Deriva automática em px/s. */
  driftX: number;
  driftY: number;
}

interface Bubble {
  img: Phaser.GameObjects.Image;
  speed: number;
  phase: number;
  baseX: number;
}

interface BurstSpec {
  count: number;
  speed: [number, number];
  life: number;
  gravity: number;
  scale: number;
  angle: [number, number];
}

const BURSTS: Record<BurstKind, BurstSpec> = {
  land: { count: 8, speed: [40, 110], life: 350, gravity: 300, scale: 0.6, angle: [200, 340] },
  dash: { count: 14, speed: [60, 180], life: 300, gravity: 0, scale: 0.8, angle: [0, 360] },
  coin: { count: 12, speed: [60, 160], life: 450, gravity: 200, scale: 0.7, angle: [0, 360] },
  artifact: { count: 32, speed: [80, 260], life: 800, gravity: 100, scale: 1, angle: [0, 360] },
  death: { count: 28, speed: [100, 300], life: 700, gravity: 400, scale: 1, angle: [0, 360] },
  eraChange: { count: 40, speed: [120, 360], life: 700, gravity: 0, scale: 1.2, angle: [0, 360] },
};

const DARK_ERAS = new Set<EraId>([EraId.VECTOR_1958, EraId.ASCII_1977, EraId.SNES_1991, EraId.Y2K_1999, EraId.NEON_2026]);
const PIXEL_ERAS = new Set<EraId>([EraId.MAC_1984, EraId.NES_1986, EraId.SNES_1991, EraId.WIN95_1995]);

const MATRIX_W = 480;
const MATRIX_H = 270;
const MATRIX_CELL = 10;
const MATRIX_KEY = 'bg-matrix-canvas';
const MATRIX_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEF<>/*=+';

const bgKey = (era: EraId, name: string): string => `bg-${era}-${name}`;

export class EraVisualRenderer implements IEraVisualRenderer {
  private readonly scene: Phaser.Scene;
  private era: EraId | null = null;
  private eraObjects: Phaser.GameObjects.GameObject[] = [];
  private layers: ParallaxLayer[] = [];
  private updaters: Array<(time: number, delta: number) => void> = [];
  private bloom: Phaser.FX.Bloom | null = null;
  private bursts = new Set<Phaser.GameObjects.GameObject>();
  private timers = new Set<Phaser.Time.TimerEvent>();
  private flash: Phaser.GameObjects.Rectangle | null = null;
  private unsubs: Array<() => void> = [];
  private destroyed = false;

  // Matrix rain
  private matrixTex: Phaser.Textures.CanvasTexture | null = null;
  private matrixDrops: number[] = [];
  private matrixAcc = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.unsubs.push(EventBus.on('SPAWN_BURST', ({ x, y, kind }) => this.spawnBurst(x, y, kind)));
  }

  // ------------------------------------------------------------------ API

  generateTextures(): void {
    generateAllTextures(this.scene);
  }

  applyEra(era: EraId): void {
    if (this.destroyed) return;
    const first = this.era === null;
    this.clearEra();
    this.era = era;
    const palette = ERA_CONFIGS[era].palette;
    const cam = this.scene.cameras.main;
    cam.setBackgroundColor(palette.background);

    switch (era) {
      case EraId.VECTOR_1958: this.build1958(palette); break;
      case EraId.ASCII_1977: this.build1977(palette); break;
      case EraId.MAC_1984: this.build1984(); break;
      case EraId.NES_1986: this.build1986(palette); break;
      case EraId.SNES_1991: this.build1991(palette); break;
      case EraId.WIN95_1995: this.build1995(); break;
      case EraId.Y2K_1999: this.build1999(palette); break;
      case EraId.FLASH_2005: this.build2005(palette); break;
      case EraId.FLAT_2013: this.build2013(palette); break;
      case EraId.NEON_2026: this.build2026(palette); break;
    }
    this.syncLayers(0);
    if (!first) this.playFlash(palette);
  }

  update(time: number, delta: number): void {
    if (this.destroyed || this.era === null) return;
    this.syncLayers(time);
    for (const u of this.updaters) u(time, delta);
  }

  spawnBurst(x: number, y: number, kind: BurstKind): void {
    if (this.destroyed) return;
    const era = this.era ?? EraId.VECTOR_1958;
    const spec = BURSTS[kind];
    const p = ERA_CONFIGS[era].palette;

    if (era === EraId.ASCII_1977) {
      this.spawnAsciiBurst(x, y, spec, p);
      return;
    }

    const tints =
      era === EraId.MAC_1984
        ? [0x000000]
        : era === EraId.VECTOR_1958
          ? [hexToInt(p.foreground), hexToInt(p.accent)]
          : [hexToInt(p.primary), hexToInt(p.secondary), hexToInt(p.accent)];
    const key = PIXEL_ERAS.has(era) ? PIXEL_PARTICLE_KEY : PARTICLE_TEXTURE_KEY;
    if (!this.scene.textures.exists(key)) return;

    const emitter = this.scene.add.particles(x, y, key, {
      speed: { min: spec.speed[0], max: spec.speed[1] },
      angle: { min: spec.angle[0], max: spec.angle[1] },
      lifespan: spec.life,
      gravityY: spec.gravity,
      scale: { start: spec.scale, end: 0 },
      alpha: { start: 1, end: era === EraId.MAC_1984 ? 1 : 0 },
      tint: tints,
      blendMode: DARK_ERAS.has(era) ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      emitting: false,
    });
    emitter.setDepth(30);
    emitter.explode(spec.count);
    this.trackBurst(emitter, spec.life + 150);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clearEra();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.timers.forEach((t) => t.remove(false));
    this.timers.clear();
    this.bursts.forEach((b) => b.destroy());
    this.bursts.clear();
    this.flash?.destroy();
    this.flash = null;
    this.matrixTex = null;
    this.destroyed = true;
  }

  // ------------------------------------------------------------ internos

  private get cam(): Phaser.Cameras.Scene2D.Camera {
    return this.scene.cameras.main;
  }

  private clearEra(): void {
    this.eraObjects.forEach((o) => o.destroy());
    this.eraObjects = [];
    this.layers = [];
    this.updaters = [];
    if (this.bloom) {
      try {
        this.cam.postFX?.remove(this.bloom);
      } catch {
        /* câmera já destruída */
      }
      this.bloom = null;
    }
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.eraObjects.push(obj);
    return obj;
  }

  private trackBurst(obj: Phaser.GameObjects.GameObject, ms: number): void {
    this.bursts.add(obj);
    const timer = this.scene.time.delayedCall(ms, () => {
      this.timers.delete(timer);
      this.bursts.delete(obj);
      obj.destroy();
    });
    this.timers.add(timer);
  }

  /** Cria uma camada TileSprite em screen-space. */
  private addLayer(
    key: string,
    opts: { fx: number; fy?: number; depth: number; y?: number; height?: number; alpha?: number; driftX?: number; driftY?: number },
  ): Phaser.GameObjects.TileSprite {
    const cam = this.cam;
    const h = opts.height ?? cam.height;
    const obj = this.scene.add
      .tileSprite(0, opts.y ?? 0, cam.width, h, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(opts.depth)
      .setAlpha(opts.alpha ?? 1);
    this.track(obj);
    this.layers.push({ obj, fx: opts.fx, fy: opts.fy ?? 0, driftX: opts.driftX ?? 0, driftY: opts.driftY ?? 0 });
    return obj;
  }

  private syncLayers(time: number): void {
    const { scrollX, scrollY } = this.cam;
    const t = time / 1000;
    for (const l of this.layers) {
      l.obj.tilePositionX = scrollX * l.fx + t * l.driftX;
      l.obj.tilePositionY = scrollY * l.fy + t * l.driftY;
    }
  }

  /** Overlay de scanlines CRT (screen-space, por cima do jogo). */
  private addScanlines(alpha: number, gap: number): Phaser.GameObjects.TileSprite {
    const key = `bg-scan-${gap}`;
    canvasTexture(this.scene, key, 4, gap, (c, w) => {
      c.fillStyle = '#000000';
      c.fillRect(0, 0, w, 1);
    });
    const obj = this.scene.add
      .tileSprite(0, 0, this.cam.width, this.cam.height, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(50)
      .setAlpha(alpha);
    return this.track(obj);
  }

  private playFlash(p: EraPalette): void {
    this.flash?.destroy();
    const cam = this.cam;
    const rect = this.scene.add
      .rectangle(0, 0, cam.width, cam.height, hexToInt(p.primary), 0.7)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(55);
    this.flash = rect;
    this.scene.tweens.add({
      targets: rect,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => {
        rect.destroy();
        if (this.flash === rect) this.flash = null;
      },
    });
  }

  private spawnAsciiBurst(x: number, y: number, spec: BurstSpec, p: EraPalette): void {
    const n = Math.min(14, spec.count);
    const chars = '*+#$%@.:';
    for (let i = 0; i < n; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      const txt = this.scene.add
        .text(x, y, ch, { fontFamily: MONO, fontSize: '16px', color: i % 3 === 0 ? p.accent : p.foreground })
        .setOrigin(0.5)
        .setDepth(30);
      const a = Phaser.Math.DegToRad(Phaser.Math.Between(spec.angle[0], spec.angle[1]));
      const dist = (Phaser.Math.Between(spec.speed[0], spec.speed[1]) * spec.life) / 1000;
      this.scene.tweens.add({
        targets: txt,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist + (spec.gravity * spec.life) / 4000,
        alpha: 0,
        duration: spec.life,
        ease: 'Quad.easeOut',
      });
      this.trackBurst(txt, spec.life + 50);
    }
  }

  // --------------------------------------------------------- fundos por era

  /** 1958: graticule de osciloscópio + linha de onda com fósforo + scanline leve. */
  private build1958(p: EraPalette): void {
    canvasTexture(this.scene, bgKey(1, 'grid'), 64, 64, (c, w, h) => {
      c.strokeStyle = rgba(p.foreground, 0.08);
      c.lineWidth = 1;
      c.strokeRect(0.5, 0.5, w, h);
      c.fillStyle = rgba(p.foreground, 0.18);
      for (let i = 8; i < w; i += 8) {
        c.fillRect(i, h / 2, 1, 1);
        c.fillRect(w / 2, i, 1, 1);
      }
    });
    this.addLayer(bgKey(1, 'grid'), { fx: 0.2, fy: 0.2, depth: -100 });

    const color = hexToInt(p.foreground);
    const g = this.track(this.scene.add.graphics().setScrollFactor(0).setDepth(-20));
    let acc = 1000;
    this.updaters.push((time, delta) => {
      acc += delta;
      if (acc < 33) return;
      acc = 0;
      const { width, height } = this.cam;
      const base = height * 0.28;
      const t = time / 1000;
      g.clear();
      const pass = (lw: number, alpha: number): void => {
        g.lineStyle(lw, color, alpha);
        g.beginPath();
        for (let x = 0; x <= width; x += 8) {
          const y = base + Math.sin(x * 0.02 + t * 3) * 22 * Math.sin(t * 0.7) + Math.sin(x * 0.05 - t * 5) * 6;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokePath();
      };
      pass(6, 0.08);
      pass(1.5, 0.55);
    });
    this.addScanlines(0.12, 3);
  }

  /** 1977: texto de terminal ao fundo + scanlines CRT com flicker. */
  private build1977(p: EraPalette): void {
    canvasTexture(this.scene, bgKey(2, 'chars'), 256, 256, (c, w, h) => {
      c.font = `12px ${MONO}`;
      c.fillStyle = rgba(p.foreground, 0.07);
      const lines = ['C:\\> DIR /W', '10 PRINT "ERAS"', '20 GOTO 10', 'READY.', '// TODO', 'RUN', '>_', 'LOAD "*",8,1'];
      for (let y = 12; y < h; y += 16) {
        c.fillText(lines[(y / 16) % lines.length | 0], ((y * 37) % 60) + 4, y);
      }
      void w;
    });
    this.addLayer(bgKey(2, 'chars'), { fx: 0.15, fy: 0.15, depth: -100 });
    const scan = this.addScanlines(0.35, 3);
    this.updaters.push(() => {
      scan.setAlpha(0.32 + Math.random() * 0.06);
    });
  }

  /** 1984: padrão de desktop pontilhado 1-bit. */
  private build1984(): void {
    canvasTexture(this.scene, bgKey(3, 'dots'), 8, 8, (c) => {
      c.fillStyle = '#000000';
      c.fillRect(0, 0, 1, 1);
      c.fillRect(4, 4, 1, 1);
    });
    this.addLayer(bgKey(3, 'dots'), { fx: 0.25, fy: 0.25, depth: -100 });
    canvasTexture(this.scene, bgKey(3, 'band'), 8, 8, (c) => dither(c, 0, 0, 8, 8, '#000000'));
    // Faixa dither inferior (horizonte).
    this.addLayer(bgKey(3, 'band'), { fx: 0.4, depth: -90, y: this.cam.height - 24, height: 24, alpha: 0.5 });
  }

  /** 1986: céu azul, nuvens e morros pixelados. */
  private build1986(p: EraPalette): void {
    canvasTexture(this.scene, bgKey(4, 'clouds'), 256, 96, (c) => {
      const cloud = (x: number, y: number): void => {
        const blocks: Array<[number, number, number, number]> = [
          [8, 8, 32, 16], [0, 16, 48, 16], [16, 0, 16, 8], [40, 12, 16, 20],
        ];
        c.fillStyle = '#000000';
        blocks.forEach(([bx, by, bw, bh]) => c.fillRect(x + bx - 2, y + by - 2, bw + 4, bh + 4));
        c.fillStyle = '#FCFCFC';
        blocks.forEach(([bx, by, bw, bh]) => c.fillRect(x + bx, y + by, bw, bh));
        c.fillStyle = '#A4E4FC';
        c.fillRect(x + 4, y + 26, 44, 4);
      };
      cloud(20, 20);
      cloud(150, 50);
    });
    canvasTexture(this.scene, bgKey(4, 'hills'), 256, 160, (c, w, h) => {
      const hill = (cx: number, r: number, color: string): void => {
        c.fillStyle = '#000000';
        for (let y = 0; y <= r; y += 4) {
          const half = Math.round(Math.sqrt(r * r - y * y) / 4) * 4;
          c.fillRect(cx - half - 2, h - y - 2, half * 2 + 4, 6);
        }
        c.fillStyle = color;
        for (let y = 0; y <= r; y += 4) {
          const half = Math.round(Math.sqrt(r * r - y * y) / 4) * 4;
          c.fillRect(cx - half, h - y, half * 2, 4);
        }
        c.fillStyle = '#000000';
        c.fillRect(cx - 12, h - r + 24, 4, 8);
        c.fillRect(cx + 8, h - r + 24, 4, 8);
      };
      hill(64, 120, '#00A800');
      hill(200, 72, '#80D010');
      void w;
    });
    this.addLayer(bgKey(4, 'clouds'), { fx: 0.15, depth: -90, y: 30, height: 96, driftX: 6 });
    this.addLayer(bgKey(4, 'hills'), { fx: 0.4, depth: -80, y: this.cam.height - 160, height: 160 });
    void p;
  }

  /** 1991: EXATAMENTE 3 camadas de parallax (0.1, 0.3, 0.6). */
  private build1991(p: EraPalette): void {
    const h = this.cam.height;
    canvasTexture(this.scene, bgKey(5, 'sky'), 128, h, (c, w, hh) => {
      const bands = 8;
      for (let i = 0; i < bands; i++) {
        c.fillStyle = shade(p.background, (i / bands) * 0.35);
        c.fillRect(0, Math.floor((i * hh) / bands), w, Math.ceil(hh / bands));
      }
      c.fillStyle = '#F8F8F8';
      [[10, 20], [50, 60], [90, 30], [30, 110], [110, 90], [70, 150], [15, 190]].forEach(([x, y]) => c.fillRect(x, y, 2, 2));
      c.fillStyle = p.accent;
      c.fillRect(100, 140, 1, 1);
      c.fillRect(40, 40, 1, 1);
    });
    canvasTexture(this.scene, bgKey(5, 'mountains'), 320, 220, (c, w, hh) => {
      const peaks = [0, 60, 140, 200, 260, 320];
      const heights = [80, 190, 120, 170, 100, 80];
      const draw = (color: string, dy: number): void => {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, hh);
        peaks.forEach((x, i) => c.lineTo(x, hh - heights[i] + dy));
        c.lineTo(w, hh);
        c.closePath();
        c.fill();
      };
      draw(shade(p.platform, -0.35), 0);
      draw(shade(p.platform, -0.15), 30);
      draw(p.platform, 70);
      c.fillStyle = '#F8F8F8';
      c.fillRect(56, hh - 190, 8, 4);
      c.fillRect(196, hh - 170, 8, 4);
    });
    canvasTexture(this.scene, bgKey(5, 'hills'), 256, 150, (c, w, hh) => {
      const tones = [shade(p.secondary, 0.25), p.secondary, shade(p.secondary, -0.25), shade(p.secondary, -0.45)];
      for (let x = 0; x < w; x += 2) {
        const top = hh - 70 - Math.round((Math.sin((x / w) * Math.PI * 4) * 22 + Math.sin((x / w) * Math.PI * 2) * 12) / 2) * 2;
        tones.forEach((t, i) => {
          c.fillStyle = t;
          c.fillRect(x, top + i * 14, 2, i === tones.length - 1 ? hh : 14);
        });
      }
      c.fillStyle = shade(p.secondary, -0.6);
      c.fillRect(0, hh - 8, w, 8);
    });
    this.addLayer(bgKey(5, 'sky'), { fx: 0.1, depth: -100 });
    this.addLayer(bgKey(5, 'mountains'), { fx: 0.3, depth: -80, y: h - 260, height: 220 });
    this.addLayer(bgKey(5, 'hills'), { fx: 0.6, depth: -60, y: h - 150, height: 150 });
  }

  /** 1995: papel de parede teal com nuvens suaves estilo Win95. */
  private build1995(): void {
    canvasTexture(this.scene, bgKey(6, 'clouds'), 512, 270, (c) => {
      const puff = (x: number, y: number, r: number): void => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      };
      [[80, 70, 50], [130, 60, 60], [180, 80, 45], [360, 170, 55], [410, 160, 40], [300, 190, 35]].forEach(([x, y, r]) =>
        puff(x, y, r),
      );
    });
    this.addLayer(bgKey(6, 'clouds'), { fx: 0.1, fy: 0.05, depth: -100, driftX: 4 });
  }

  /** 1999: chuva de código Matrix (screen-space) + grade cyber em perspectiva. */
  private build1999(p: EraPalette): void {
    if (!this.matrixTex) {
      this.matrixTex = this.scene.textures.exists(MATRIX_KEY)
        ? (this.scene.textures.get(MATRIX_KEY) as Phaser.Textures.CanvasTexture)
        : this.scene.textures.createCanvas(MATRIX_KEY, MATRIX_W, MATRIX_H);
    }
    const tex = this.matrixTex;
    if (tex) {
      const c = tex.context;
      c.fillStyle = p.background;
      c.fillRect(0, 0, MATRIX_W, MATRIX_H);
      tex.refresh();
      const cols = Math.ceil(MATRIX_W / MATRIX_CELL);
      this.matrixDrops = Array.from({ length: cols }, () => Math.floor(Math.random() * -30));
      this.matrixAcc = 0;
      const img = this.scene.add
        .image(0, 0, MATRIX_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-100)
        .setDisplaySize(this.cam.width, this.cam.height);
      this.track(img);
      this.updaters.push((_t, delta) => this.stepMatrix(tex, p, delta));
    }

    // Grade em perspectiva (metade inferior).
    const grid = this.track(this.scene.add.graphics().setScrollFactor(0).setDepth(-40));
    const color = hexToInt(p.primary);
    this.updaters.push((time) => {
      const { width, height, scrollX } = this.cam;
      const horizon = height * 0.62;
      const vx = width / 2;
      grid.clear();
      grid.fillStyle(0x000a00, 0.75);
      grid.fillRect(0, horizon, width, height - horizon);
      grid.lineStyle(1, color, 0.6);
      grid.lineBetween(0, horizon, width, horizon);
      grid.lineStyle(1, color, 0.28);
      const spacing = 80;
      const off = -((scrollX * 0.5) % spacing);
      for (let x = -width; x <= width * 2; x += spacing) {
        const bx = x + off;
        grid.lineBetween(vx + (bx - vx) * 0.08, horizon, bx, height);
      }
      const phase = (time / 1600) % 1;
      for (let i = 0; i < 10; i++) {
        const k = (i + phase) / 10;
        const y = horizon + (height - horizon) * k * k;
        grid.lineStyle(1, color, 0.12 + k * 0.3);
        grid.lineBetween(0, y, width, y);
      }
    });
  }

  private stepMatrix(tex: Phaser.Textures.CanvasTexture, p: EraPalette, delta: number): void {
    this.matrixAcc += delta;
    if (this.matrixAcc < 55) return;
    this.matrixAcc = 0;
    const c: Ctx = tex.context;
    c.fillStyle = rgba(p.background, 0.16);
    c.fillRect(0, 0, MATRIX_W, MATRIX_H);
    c.font = `${MATRIX_CELL}px ${MONO}`;
    c.textBaseline = 'top';
    for (let i = 0; i < this.matrixDrops.length; i++) {
      const row = this.matrixDrops[i];
      if (row >= 0) {
        const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        c.fillStyle = Math.random() > 0.1 ? p.secondary : '#CCFFCC';
        c.fillText(ch, i * MATRIX_CELL, row * MATRIX_CELL);
      }
      this.matrixDrops[i] = row * MATRIX_CELL > MATRIX_H && Math.random() > 0.95 ? Math.floor(Math.random() * -10) : row + 1;
    }
    tex.refresh();
  }

  /** 2005: céu Aero em gradiente, colina "Bliss" e bolhas translúcidas subindo. */
  private build2005(p: EraPalette): void {
    const { width, height } = this.cam;
    canvasTexture(this.scene, bgKey(8, 'sky'), 8, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1E7FD8');
      g.addColorStop(0.55, '#7CC8F4');
      g.addColorStop(1, p.background);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    canvasTexture(this.scene, bgKey(8, 'hill'), 512, 200, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9BE15D');
      g.addColorStop(0.5, '#4CB648');
      g.addColorStop(1, '#2E8B3A');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, h);
      c.lineTo(0, 120);
      c.bezierCurveTo(120, 30, 260, 40, 340, 100);
      c.bezierCurveTo(400, 140, 460, 110, w, 120);
      c.lineTo(w, h);
      c.closePath();
      c.fill();
      // Brilho glossy no topo da colina.
      c.save();
      c.clip();
      const gl = c.createLinearGradient(0, 30, 0, 140);
      gl.addColorStop(0, 'rgba(255,255,255,0.45)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gl;
      c.fillRect(0, 0, w, 140);
      c.restore();
    });
    canvasTexture(this.scene, bgKey(8, 'bubble'), 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 4, 16, 16, 15);
      g.addColorStop(0, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.8, 'rgba(180,230,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0.7)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(16, 16, 15, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath();
      c.ellipse(11, 10, 5, 3, -0.6, 0, Math.PI * 2);
      c.fill();
    });
    const sky = this.scene.add
      .image(0, 0, bgKey(8, 'sky'))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100)
      .setDisplaySize(width, height);
    this.track(sky);
    this.addLayer(bgKey(8, 'hill'), { fx: 0.25, depth: -80, y: height - 200, height: 200 });

    const bubbles: Bubble[] = [];
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * width;
      const img = this.scene.add
        .image(x, Math.random() * height, bgKey(8, 'bubble'))
        .setScrollFactor(0)
        .setDepth(-30)
        .setScale(0.5 + Math.random() * 1.3)
        .setAlpha(0.8);
      this.track(img);
      bubbles.push({ img, speed: 15 + Math.random() * 35, phase: Math.random() * Math.PI * 2, baseX: x });
    }
    this.updaters.push((time, delta) => {
      const dt = delta / 1000;
      for (const b of bubbles) {
        b.img.y -= b.speed * dt;
        b.img.x = b.baseX + Math.sin(time / 900 + b.phase) * 12;
        if (b.img.y < -40) {
          b.img.y = height + 40;
          b.baseX = Math.random() * width;
        }
      }
    });
  }

  /** 2013: fundo flat claro com formas geométricas e sombras longas a 45°. */
  private build2013(p: EraPalette): void {
    canvasTexture(this.scene, bgKey(9, 'shapes'), 640, this.cam.height, (c) => {
      const shapes: Array<{ path: (q: Ctx) => void; color: string }> = [
        { path: (q) => q.arc(120, 140, 70, 0, Math.PI * 2), color: '#D5ECE6' },
        { path: (q) => q.rect(330, 250, 110, 110), color: '#D6E6F2' },
        { path: (q) => { q.moveTo(520, 120); q.lineTo(600, 260); q.lineTo(440, 260); q.closePath(); }, color: '#F5D9D5' },
        { path: (q) => q.arc(250, 400, 45, 0, Math.PI * 2), color: '#FBEBC6' },
        { path: (q) => q.rect(40, 330, 60, 60), color: '#E3DBEA' },
      ];
      for (const s of shapes) {
        longShadow(c, s.path, 90, 0.05);
        c.fillStyle = s.color;
        c.beginPath();
        s.path(c);
        c.fill();
      }
      void p;
    });
    this.addLayer(bgKey(9, 'shapes'), { fx: 0.15, depth: -100 });
  }

  /** 2026: dark mode, grid neon sutil, partículas flutuantes e bloom (WebGL). */
  private build2026(p: EraPalette): void {
    canvasTexture(this.scene, bgKey(10, 'grid'), 64, 64, (c, w, h) => {
      c.strokeStyle = rgba(p.primary, 0.07);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0.5, 0); c.lineTo(0.5, h);
      c.moveTo(0, 0.5); c.lineTo(w, 0.5);
      c.stroke();
      c.fillStyle = rgba(p.secondary, 0.5);
      c.fillRect(0, 0, 2, 2);
    });
    canvasTexture(this.scene, bgKey(10, 'glow'), 8, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(p.secondary, 0.18));
      g.addColorStop(0.5, rgba(p.background, 0));
      g.addColorStop(1, rgba(p.primary, 0.14));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    const { width, height } = this.cam;
    const glow = this.scene.add
      .image(0, 0, bgKey(10, 'glow'))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100)
      .setDisplaySize(width, height);
    this.track(glow);
    this.addLayer(bgKey(10, 'grid'), { fx: 0.5, fy: 0.5, depth: -90 });

    if (this.scene.textures.exists(PARTICLE_TEXTURE_KEY)) {
      const emitter = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
        x: { min: 0, max: width },
        y: { min: 0, max: height },
        lifespan: { min: 4000, max: 8000 },
        speedX: { min: -8, max: 8 },
        speedY: { min: -26, max: -6 },
        gravityY: -4,
        scale: { start: 0.55, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        tint: [hexToInt(p.primary), hexToInt(p.secondary), hexToInt(p.accent)],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 140,
        quantity: 1,
      });
      emitter.setScrollFactor(0).setDepth(-20);
      emitter.fastForward(5000, 50);
      this.track(emitter);
    }

    const cam = this.cam;
    if (this.scene.game.renderer.type === Phaser.WEBGL && cam.postFX) {
      this.bloom = cam.postFX.addBloom(0xffffff, 1, 1, 1, 1.15, 4);
    }
  }
}
