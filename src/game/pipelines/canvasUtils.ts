/**
 * Utilitários de canvas/cor compartilhados pelo gerador de texturas e pelos fundos.
 */
import type Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;
export type PathFn = (c: Ctx) => void;

/** Fonte monoespaçada de terminal (VT323 com fallbacks). */
export const MONO = 'VT323, "Courier New", monospace';
export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToInt(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mistura com branco (amt>0) ou preto (amt<0). amt em -1..1. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.min(1, Math.abs(amt));
  const mix = (v: number) => Math.round(v + (t - v) * k);
  const to2 = (v: number) => mix(v).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Luminância relativa aproximada 0..1. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Cria uma CanvasTexture (idempotente) e desenha nela. */
export function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (c: Ctx, w: number, h: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const c = tex.context;
  c.clearRect(0, 0, w, h);
  c.save();
  draw(c, w, h);
  c.restore();
  tex.refresh();
}

/** Canvas temporário fora da árvore DOM. */
export function tempCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** Alfa binário (bordas duras). */
export function hardAlpha(c: Ctx, w: number, h: number, threshold = 110): void {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= threshold ? 255 : 0;
  c.putImageData(img, 0, 0);
}

/** Converte para 1-bit puro: preto/branco/transparente. */
export function oneBit(c: Ctx, w: number, h: number): void {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) {
      d[i + 3] = 0;
      continue;
    }
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = l > 127 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}

/** Reduz a resolução (fator `scale`) e amplia sem suavização → pixel art. */
export function pixelate(c: Ctx, w: number, h: number, scale = 2): void {
  const sw = Math.max(1, Math.round(w / scale));
  const sh = Math.max(1, Math.round(h / scale));
  const tmp = tempCanvas(sw, sh);
  if (!tmp) return;
  tmp.ctx.imageSmoothingEnabled = true;
  tmp.ctx.drawImage(c.canvas, 0, 0, w, h, 0, 0, sw, sh);
  hardAlpha(tmp.ctx, sw, sh, 100);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  c.imageSmoothingEnabled = false;
  c.drawImage(tmp.canvas, 0, 0, sw, sh, 0, 0, w, h);
  c.restore();
}

/** Xadrez 1px (dithering 50%). */
export function dither(c: Ctx, x: number, y: number, w: number, h: number, color: string, phase = 0): void {
  c.fillStyle = color;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = (yy + phase) % 2; xx < w; xx += 2) c.fillRect(x + xx, y + yy, 1, 1);
  }
}

/** Bisel 3D estilo Windows 95. */
export function bevel(c: Ctx, x: number, y: number, w: number, h: number, face = '#C0C0C0', inset = false): void {
  const light = inset ? '#000000' : '#FFFFFF';
  const lightIn = inset ? '#808080' : '#DFDFDF';
  const dark = inset ? '#FFFFFF' : '#000000';
  const darkIn = inset ? '#DFDFDF' : '#808080';
  c.fillStyle = face;
  c.fillRect(x, y, w, h);
  c.fillStyle = dark;
  c.fillRect(x, y + h - 1, w, 1);
  c.fillRect(x + w - 1, y, 1, h);
  c.fillStyle = light;
  c.fillRect(x, y, w - 1, 1);
  c.fillRect(x, y, 1, h - 1);
  c.fillStyle = darkIn;
  c.fillRect(x + 1, y + h - 2, w - 2, 1);
  c.fillRect(x + w - 2, y + 1, 1, h - 2);
  c.fillStyle = lightIn;
  c.fillRect(x + 1, y + 1, w - 3, 1);
  c.fillRect(x + 1, y + 1, 1, h - 3);
}

export function roundRectPath(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.arcTo(x + w, y, x + w, y + rr, rr);
  c.lineTo(x + w, y + h - rr);
  c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  c.lineTo(x + rr, y + h);
  c.arcTo(x, y + h, x, y + h - rr, rr);
  c.lineTo(x, y + rr);
  c.arcTo(x, y, x + rr, y, rr);
  c.closePath();
}

export function circlePath(c: Ctx, x: number, y: number, r: number): void {
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, Math.PI * 2);
  c.closePath();
}

/** Texto centrado em (x, y). */
export function glyph(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { font?: string; glow?: number; stroke?: boolean; lineWidth?: number; weight?: string } = {},
): void {
  c.save();
  c.font = `${opts.weight ?? ''} ${size}px ${opts.font ?? MONO}`.trim();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (opts.glow) {
    c.shadowColor = color;
    c.shadowBlur = opts.glow;
  }
  if (opts.stroke) {
    c.strokeStyle = color;
    c.lineWidth = opts.lineWidth ?? 1;
    c.strokeText(text, x, y);
  } else {
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  c.restore();
}

/** Várias linhas de texto ASCII centradas no canvas. */
export function asciiBlock(c: Ctx, lines: string[], w: number, h: number, size: number, color: string, glow = 3): void {
  const lh = size * 0.9;
  const top = h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => glyph(c, line, w / 2, top + i * lh, size, color, { glow }));
}
