/**
 * Gerador procedural de TODAS as texturas do jogo (10 eras × 10 tipos,
 * 6 artefatos e partículas). Desenho em CanvasTexture (canvas 2D) e
 * Graphics (partículas). Idempotente: chaves existentes são puladas.
 */
import type Phaser from 'phaser';
import { ERA_CONFIGS } from '../../core/EraManager';
import {
  ALL_ERAS,
  ARTIFACT_TEXTURE_SIZE,
  ArtifactId,
  EraId,
  type EraPalette,
  type EraTextureKind,
  PARTICLE_TEXTURE_KEY,
  TEXTURE_SIZES,
  artifactTextureKey,
  textureKey,
} from '../../core/types';
import {
  type Ctx,
  type PathFn,
  MONO,
  PIXEL_FONT,
  asciiBlock,
  bevel,
  canvasTexture,
  circlePath,
  dither,
  glyph,
  hardAlpha,
  luminance,
  oneBit,
  pixelate,
  rgba,
  roundRectPath,
  shade,
  tempCanvas,
} from './canvasUtils';

/** Partícula quadrada 4x4 (eras pixeladas). */
export const PIXEL_PARTICLE_KEY = 'particle-px';

// ---------------------------------------------------------------------------
// Cores específicas por era (complementam a paleta do contrato)
// ---------------------------------------------------------------------------

interface EraColors {
  coin: string;
  coinMark: string;
  portalOuter: string;
  portalInner: string;
  swirl: string;
  pad: string;
  spring: string;
  spike: string;
  pole: string;
  flag: string;
  coreBody: string;
  coreOrb: string;
  /** Jogador (eras vetoriais). */
  legs: string;
  torso: string;
  head: string;
  eye: string;
}

const COLORS: Record<EraId, EraColors> = {
  [EraId.VECTOR_1958]: {
    coin: '#00FF66', coinMark: '#00FF66', portalOuter: '#00FF66', portalInner: '#00FF66', swirl: '#B4FFD2',
    pad: '#00FF66', spring: '#00FF66', spike: '#66FFAA', pole: '#00FF66', flag: '#00FF66',
    coreBody: '#00FF66', coreOrb: '#B4FFD2', legs: '#00FF66', torso: '#00FF66', head: '#00FF66', eye: '#00FF66',
  },
  [EraId.ASCII_1977]: {
    coin: '#33FF00', coinMark: '#33FF00', portalOuter: '#33FF00', portalInner: '#33FF00', swirl: '#CCFF99',
    pad: '#33FF00', spring: '#33FF00', spike: '#FFFF33', pole: '#33FF00', flag: '#CCFF99',
    coreBody: '#33FF00', coreOrb: '#CCFF99', legs: '#33FF00', torso: '#33FF00', head: '#33FF00', eye: '#33FF00',
  },
  [EraId.MAC_1984]: {
    coin: '#888888', coinMark: '#000000', portalOuter: '#000000', portalInner: '#888888', swirl: '#FFFFFF',
    pad: '#FFFFFF', spring: '#000000', spike: '#000000', pole: '#000000', flag: '#888888',
    coreBody: '#888888', coreOrb: '#FFFFFF', legs: '#000000', torso: '#888888', head: '#FFFFFF', eye: '#000000',
  },
  [EraId.NES_1986]: {
    coin: '#FCBC3C', coinMark: '#C84C0C', portalOuter: '#00A800', portalInner: '#000000', swirl: '#FCBC3C',
    pad: '#D82800', spring: '#FCFCFC', spike: '#BCBCBC', pole: '#00A800', flag: '#FCFCFC',
    coreBody: '#0058F8', coreOrb: '#FCBC3C', legs: '#0058F8', torso: '#D82800', head: '#FCA044', eye: '#000000',
  },
  [EraId.SNES_1991]: {
    coin: '#F8D030', coinMark: '#B07010', portalOuter: '#8058A0', portalInner: '#3050C8', swirl: '#F8F8F8',
    pad: '#F03030', spring: '#C8C8D8', spike: '#C8C8D8', pole: '#C8C8D8', flag: '#58B858',
    coreBody: '#3050C8', coreOrb: '#F8D030', legs: '#8058A0', torso: '#58B858', head: '#F8C8A0', eye: '#101010',
  },
  [EraId.WIN95_1995]: {
    coin: '#FFFF00', coinMark: '#808000', portalOuter: '#C0C0C0', portalInner: '#000080', swirl: '#FFFFFF',
    pad: '#C0C0C0', spring: '#000000', spike: '#FF0000', pole: '#808080', flag: '#000080',
    coreBody: '#C0C0C0', coreOrb: '#000080', legs: '#808080', torso: '#000080', head: '#C0C0C0', eye: '#000000',
  },
  [EraId.Y2K_1999]: {
    coin: '#A6FF00', coinMark: '#00FF41', portalOuter: '#2E3B2E', portalInner: '#00FF41', swirl: '#A6FF00',
    pad: '#2E3B2E', spring: '#A6FF00', spike: '#FF2A2A', pole: '#C0C0C0', flag: '#A6FF00',
    coreBody: '#2E3B2E', coreOrb: '#A6FF00', legs: '#1A221A', torso: '#2E3B2E', head: '#C8D8C0', eye: '#000000',
  },
  [EraId.FLASH_2005]: {
    coin: '#FFB800', coinMark: '#FF8A00', portalOuter: '#2FA8E8', portalInner: '#7ED321', swirl: '#FFFFFF',
    pad: '#FF8A00', spring: '#2FA8E8', spike: '#E8202A', pole: '#FFFFFF', flag: '#7ED321',
    coreBody: '#2FA8E8', coreOrb: '#7ED321', legs: '#2F5DA8', torso: '#FF8A00', head: '#FFD2A6', eye: '#000000',
  },
  [EraId.FLAT_2013]: {
    coin: '#F1C40F', coinMark: '#E67E22', portalOuter: '#9B59B6', portalInner: '#3498DB', swirl: '#ECF0F1',
    pad: '#E67E22', spring: '#7F8C8D', spike: '#E74C3C', pole: '#7F8C8D', flag: '#1ABC9C',
    coreBody: '#34495E', coreOrb: '#1ABC9C', legs: '#2C3E50', torso: '#1ABC9C', head: '#F5CBA7', eye: '#2C3E50',
  },
  [EraId.NEON_2026]: {
    coin: '#10B981', coinMark: '#6EE7B7', portalOuter: '#6366F1', portalInner: '#10B981', swirl: '#22D3EE',
    pad: '#6366F1', spring: '#10B981', spike: '#F43F5E', pole: '#6366F1', flag: '#10B981',
    coreBody: '#6366F1', coreOrb: '#10B981', legs: '#6366F1', torso: '#10B981', head: '#22D3EE', eye: '#10B981',
  },
};

// ---------------------------------------------------------------------------
// Pintura genérica de formas no estilo da era
// ---------------------------------------------------------------------------

interface PaintOpts {
  lineWidth?: number;
  gloss?: boolean;
  /** Desliga a sombra longa do flat design. */
  noShadow?: boolean;
  /** Comprimento da sombra longa (flat). */
  shadowLength?: number;
}

/** Desenha um path aplicando o "material" da era. */
function paint(c: Ctx, era: EraId, p: EraPalette, path: PathFn, color: string, o: PaintOpts = {}): void {
  const trace = (): void => {
    c.beginPath();
    path(c);
  };
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  switch (era) {
    case EraId.VECTOR_1958:
    case EraId.ASCII_1977: {
      // Vetor vazado com brilho de fósforo.
      trace();
      c.strokeStyle = p.foreground;
      c.lineWidth = o.lineWidth ?? 1.5;
      c.shadowColor = p.foreground;
      c.shadowBlur = 4;
      c.stroke();
      break;
    }
    case EraId.MAC_1984: {
      const l = luminance(color);
      trace();
      if (l > 0.75) {
        c.fillStyle = '#FFFFFF';
        c.fill();
      } else if (l < 0.25) {
        c.fillStyle = '#000000';
        c.fill();
      } else {
        c.fillStyle = '#FFFFFF';
        c.fill();
        c.clip();
        dither(c, 0, 0, c.canvas.width, c.canvas.height, '#000000');
      }
      c.restore();
      c.save();
      trace();
      c.strokeStyle = '#000000';
      c.lineWidth = o.lineWidth ?? 1;
      c.stroke();
      break;
    }
    case EraId.NES_1986: {
      trace();
      c.fillStyle = color;
      c.fill();
      c.strokeStyle = '#000000';
      c.lineWidth = o.lineWidth ?? 2;
      c.stroke();
      break;
    }
    case EraId.SNES_1991: {
      // Gradiente em bandas (4 tons) + contorno escuro.
      const h = c.canvas.height;
      const g = c.createLinearGradient(0, 0, 0, h);
      const tones = [shade(color, 0.35), color, shade(color, -0.2), shade(color, -0.4)];
      tones.forEach((t, i) => {
        g.addColorStop(i / tones.length, t);
        g.addColorStop((i + 1) / tones.length - 0.001, t);
      });
      trace();
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = shade(color, -0.65);
      c.lineWidth = o.lineWidth ?? 1.5;
      c.stroke();
      break;
    }
    case EraId.WIN95_1995: {
      // Bisel aproximado: sombra preta (+1,+1), luz branca (-1,-1), face.
      c.translate(1, 1);
      trace();
      c.fillStyle = '#000000';
      c.fill();
      c.translate(-2, -2);
      trace();
      c.fillStyle = '#FFFFFF';
      c.fill();
      c.translate(1, 1);
      trace();
      c.fillStyle = color;
      c.fill();
      break;
    }
    case EraId.Y2K_1999: {
      trace();
      c.fillStyle = rgba(shade(color, -0.5), 0.92);
      c.fill();
      c.strokeStyle = p.primary;
      c.lineWidth = o.lineWidth ?? 1.2;
      c.shadowColor = p.primary;
      c.shadowBlur = 5;
      c.stroke();
      break;
    }
    case EraId.FLASH_2005: {
      trace();
      c.fillStyle = color;
      c.fill();
      if (o.gloss !== false) {
        c.save();
        trace();
        c.clip();
        const h = c.canvas.height;
        const g = c.createLinearGradient(0, 0, 0, h * 0.6);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, c.canvas.width, h * 0.5);
        c.restore();
      }
      trace();
      c.strokeStyle = '#000000';
      c.lineWidth = o.lineWidth ?? 3;
      c.stroke();
      break;
    }
    case EraId.FLAT_2013: {
      if (!o.noShadow) longShadow(c, path, o.shadowLength ?? 24);
      trace();
      c.fillStyle = color;
      c.fill();
      break;
    }
    case EraId.NEON_2026: {
      trace();
      c.fillStyle = rgba(color, 0.18);
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = o.lineWidth ?? 1.6;
      c.shadowColor = color;
      c.shadowBlur = 7;
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,255,0.65)';
      c.lineWidth = 0.6;
      c.stroke();
      break;
    }
  }
  c.restore();
}

/** Sombra longa a 45° (flat design): extrude do path com alfa uniforme. */
export function longShadow(c: Ctx, path: PathFn, len: number, alpha = 0.16): void {
  const w = c.canvas.width;
  const h = c.canvas.height;
  const tmp = tempCanvas(w, h);
  if (!tmp) return;
  const t = tmp.ctx;
  t.fillStyle = '#000000';
  for (let i = 1; i <= len; i++) {
    t.save();
    t.translate(i, i);
    t.beginPath();
    path(t);
    t.fill();
    t.restore();
  }
  c.save();
  c.globalAlpha = alpha;
  c.drawImage(tmp.canvas, 0, 0);
  c.restore();
}

/** Pós-processamento por era (1-bit, pixel art, bordas duras). */
function post(c: Ctx, era: EraId, w: number, h: number): void {
  if (era === EraId.MAC_1984) oneBit(c, w, h);
  else if (era === EraId.NES_1986) pixelate(c, w, h, 2);
  else if (era === EraId.SNES_1991) hardAlpha(c, w, h);
}

// ---------------------------------------------------------------------------
// Jogador
// ---------------------------------------------------------------------------

/** Sprite 14×20 (escala 2 → 28×40), olhando para a direita. */
const PLAYER_MAP: readonly string[] = [
  '....HHHHHH....',
  '...HHHHHHHHHH.',
  '...SSSSSSS....',
  '...SSSSSESS...',
  '...SSSSSESS...',
  '...SSSSSSSSS..',
  '....SSSSSSS...',
  '.....SSSS.....',
  '...BBBBBBBB...',
  '..BBBBBBBBBB..',
  '..BBBBBBBBBSS.',
  '..SBBBBBBBB...',
  '..SBBBBBBBB...',
  '...BBBBBBBB...',
  '...PPPPPPPP...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '..OOOO..OOOO..',
  '..OOOO..OOOOO.',
];

const DITHER = 'dither';

function drawPixelMap(
  c: Ctx,
  map: readonly string[],
  colors: Record<string, string>,
  scale: number,
  opts: { outline?: string; autoShade?: boolean } = {},
): void {
  const rows = map.length;
  const cols = map[0].length;
  const at = (x: number, y: number): string => (y >= 0 && y < rows && x >= 0 && x < cols ? map[y][x] : '.');
  const filled = (x: number, y: number): boolean => at(x, y) !== '.';
  // Contorno primeiro (células vazias vizinhas de células cheias).
  if (opts.outline) {
    c.fillStyle = opts.outline;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (filled(x, y)) continue;
        if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) {
          c.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = at(x, y);
      const col = colors[ch];
      if (!col) continue;
      const px = x * scale;
      const py = y * scale;
      if (col === DITHER) {
        c.fillStyle = '#FFFFFF';
        c.fillRect(px, py, scale, scale);
        dither(c, px, py, scale, scale, '#000000', (x + y) % 2);
        continue;
      }
      let fill = col;
      if (opts.autoShade) {
        if (at(x, y - 1) !== ch) fill = shade(col, 0.3);
        else if (at(x, y + 1) !== ch || at(x - 1, y) === '.') fill = shade(col, -0.3);
      }
      c.fillStyle = fill;
      c.fillRect(px, py, scale, scale);
    }
  }
}

function drawPlayer(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  switch (era) {
    case EraId.ASCII_1977:
      glyph(c, '@', w / 2, h / 2 + 2, 38, p.foreground, { glow: 4 });
      return;
    case EraId.MAC_1984:
      drawPixelMap(c, PLAYER_MAP, { H: '#000000', S: '#FFFFFF', E: '#000000', B: DITHER, P: '#000000', O: '#000000' }, 2, {
        outline: '#000000',
      });
      return;
    case EraId.NES_1986:
      drawPixelMap(c, PLAYER_MAP, { H: k.torso, S: k.head, E: '#000000', B: k.legs, P: '#7C3F00', O: '#000000' }, 2, {
        outline: '#000000',
      });
      return;
    case EraId.SNES_1991:
      drawPixelMap(c, PLAYER_MAP, { H: '#3050C8', S: k.head, E: k.eye, B: k.torso, P: k.legs, O: '#402040' }, 2, {
        outline: '#101028',
        autoShade: true,
      });
      return;
    default:
      break;
  }
  // Eras vetoriais: pernas, tronco, braço, cabeça, olho.
  const o: PaintOpts = { noShadow: true, lineWidth: era === EraId.FLASH_2005 ? 2.2 : undefined };
  paint(c, era, p, (q) => { q.rect(8, 30, 5, 8); q.rect(15, 30, 5, 8); }, k.legs, o);
  paint(c, era, p, (q) => roundRectPath(q, 6.5, 17.5, 15, 14, 3), k.torso, o);
  paint(c, era, p, (q) => roundRectPath(q, 17, 21, 8, 4, 2), k.torso, o);
  paint(c, era, p, (q) => circlePath(q, 14, 10, 7.5), k.head, o);
  if (era === EraId.VECTOR_1958) {
    paint(c, era, p, (q) => q.rect(16.5, 7.5, 4, 2.5), k.eye, { lineWidth: 1 });
    return;
  }
  c.save();
  c.fillStyle = k.eye;
  if (era === EraId.NEON_2026) {
    c.shadowColor = k.eye;
    c.shadowBlur = 6;
    c.fillRect(14, 7, 8, 3);
  } else if (era === EraId.Y2K_1999) {
    c.fillRect(13, 7, 9, 3); // óculos escuros
    c.fillStyle = p.primary;
    c.fillRect(19, 7, 2, 1);
  } else if (era === EraId.FLASH_2005) {
    c.beginPath();
    c.ellipse(18, 9, 2.2, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.fillRect(18, 7, 1.2, 1.2);
  } else {
    c.fillRect(17, 8, 3, 3);
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Tiles (ladrilháveis)
// ---------------------------------------------------------------------------

function drawPlatform(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  switch (era) {
    case EraId.VECTOR_1958: {
      c.strokeStyle = p.foreground;
      c.shadowColor = p.foreground;
      c.shadowBlur = 3;
      c.lineWidth = 1;
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.beginPath();
      c.moveTo(4, 4); c.lineTo(9, 4); c.moveTo(4, 4); c.lineTo(4, 9);
      c.moveTo(w - 4, h - 4); c.lineTo(w - 9, h - 4); c.moveTo(w - 4, h - 4); c.lineTo(w - 4, h - 9);
      c.stroke();
      return;
    }
    case EraId.ASCII_1977:
      c.fillStyle = '#000000';
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) glyph(c, '#', 8 + x * 16, 9 + y * 16, 18, p.foreground, { glow: 2 });
      return;
    case EraId.MAC_1984:
      c.fillStyle = '#FFFFFF';
      c.fillRect(0, 0, w, h);
      dither(c, 0, 0, w, h, '#000000');
      c.fillStyle = '#000000';
      c.fillRect(0, 0, w, 2);
      c.fillRect(0, 0, 1, h);
      return;
    case EraId.NES_1986: {
      // Tijolos com argamassa preta e luz no topo.
      c.fillStyle = p.platform;
      c.fillRect(0, 0, w, h);
      for (let row = 0; row < 4; row++) {
        const y = row * 8;
        c.fillStyle = '#000000';
        c.fillRect(0, y + 7, w, 1);
        const off = row % 2 === 0 ? 0 : 8;
        for (let x = off; x < w + 16; x += 16) {
          c.fillStyle = '#000000';
          c.fillRect((x + 15) % w, y, 1, 7);
          c.fillStyle = '#FC9838';
          c.fillRect(x % w, y, 14, 1);
          c.fillRect(x % w, y, 1, 6);
        }
      }
      return;
    }
    case EraId.SNES_1991: {
      const tones = [shade(p.platform, 0.45), shade(p.platform, 0.15), p.platform, shade(p.platform, -0.2), shade(p.platform, -0.45)];
      const band = h / tones.length;
      tones.forEach((t, i) => { c.fillStyle = t; c.fillRect(0, Math.floor(i * band), w, Math.ceil(band)); });
      c.fillStyle = shade(p.platform, 0.7);
      c.fillRect(0, 0, w, 2);
      c.fillRect(0, 0, 2, h);
      c.fillStyle = shade(p.platform, -0.7);
      c.fillRect(0, h - 2, w, 2);
      c.fillRect(w - 2, 0, 2, h);
      c.fillStyle = shade(p.platform, -0.3);
      c.fillRect(8, 8, 16, 16);
      c.fillStyle = shade(p.platform, 0.3);
      c.fillRect(9, 9, 14, 2);
      return;
    }
    case EraId.WIN95_1995:
      bevel(c, 0, 0, w, h, '#C0C0C0');
      return;
    case EraId.Y2K_1999: {
      c.fillStyle = p.platform;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = rgba(p.primary, 0.55);
      c.lineWidth = 1;
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.strokeStyle = rgba(p.secondary, 0.35);
      c.beginPath();
      c.moveTo(4, 16); c.lineTo(12, 16); c.lineTo(16, 12); c.lineTo(28, 12);
      c.moveTo(4, 24); c.lineTo(20, 24); c.lineTo(24, 28);
      c.stroke();
      c.fillStyle = p.primary;
      [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]].forEach(([x, y]) => c.fillRect(x, y, 2, 2));
      c.fillStyle = rgba(p.primary, 0.9);
      c.fillRect(0, 0, w, 1);
      return;
    }
    case EraId.FLASH_2005: {
      c.fillStyle = '#3FA63F';
      c.fillRect(0, 0, w, h);
      c.fillStyle = p.platform;
      c.fillRect(2, 2, w - 4, h - 4);
      const g = c.createLinearGradient(0, 0, 0, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0.05)');
      c.fillStyle = g;
      c.fillRect(3, 3, w - 6, h / 2 - 3);
      c.strokeStyle = '#000000';
      c.lineWidth = 2;
      c.strokeRect(1, 1, w - 2, h - 2);
      return;
    }
    case EraId.FLAT_2013:
      c.fillStyle = p.platform;
      c.fillRect(0, 0, w, h);
      c.fillStyle = shade(p.platform, 0.12);
      c.fillRect(0, 0, w, 4);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.beginPath();
      c.moveTo(w, 4); c.lineTo(w, h); c.lineTo(w - (h - 4), h);
      c.closePath();
      c.fill();
      return;
    case EraId.NEON_2026: {
      c.fillStyle = '#111827';
      c.fillRect(0, 0, w, h);
      c.fillStyle = p.platform;
      c.fillRect(1, 1, w - 2, h - 2);
      c.strokeStyle = rgba(p.secondary, 0.4);
      c.lineWidth = 1;
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.fillStyle = p.primary;
      c.shadowColor = p.primary;
      c.shadowBlur = 6;
      c.fillRect(0, 0, w, 2);
      c.shadowBlur = 0;
      c.fillStyle = rgba(p.primary, 0.12);
      c.fillRect(0, 2, w, 6);
      return;
    }
  }
}

function drawCommentWall(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  switch (era) {
    case EraId.VECTOR_1958:
      c.setLineDash([3, 3]);
      c.strokeStyle = rgba(p.foreground, 0.6);
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.setLineDash([]);
      glyph(c, '//', cx, cy, 22, p.foreground, { stroke: true, glow: 3 });
      return;
    case EraId.ASCII_1977:
      c.fillStyle = rgba(p.foreground, 0.08);
      c.fillRect(0, 0, w, h);
      glyph(c, '//', cx, cy, 24, p.foreground, { glow: 4 });
      return;
    case EraId.MAC_1984:
      c.fillStyle = '#FFFFFF';
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) { c.fillStyle = '#000'; c.fillRect(x, y, 1, 1); }
      c.fillStyle = '#000000';
      c.fillRect(0, 0, w, 1);
      c.fillRect(0, 0, 1, h);
      glyph(c, '//', cx, cy, 22, '#000000', { font: MONO, weight: 'bold' });
      oneBit(c, w, h);
      return;
    case EraId.NES_1986:
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(0, 0, w, h);
      glyph(c, '//', cx + 1, cy + 1, 12, '#000000', { font: PIXEL_FONT });
      glyph(c, '//', cx, cy, 12, p.accent, { font: PIXEL_FONT });
      hardAlpha(c, w, h, 60);
      return;
    case EraId.SNES_1991: {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(p.platform, 0.55));
      g.addColorStop(1, rgba(shade(p.platform, -0.5), 0.55));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      glyph(c, '//', cx + 1, cy + 1, 11, '#101028', { font: PIXEL_FONT });
      glyph(c, '//', cx, cy, 11, p.accent, { font: PIXEL_FONT });
      return;
    }
    case EraId.WIN95_1995:
      bevel(c, 0, 0, w, h, '#FFFFFF', true);
      glyph(c, '//', cx, cy, 16, '#008000', { font: '"Courier New", monospace', weight: 'bold' });
      return;
    case EraId.Y2K_1999:
      c.fillStyle = 'rgba(0,20,0,0.7)';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = rgba(p.primary, 0.4);
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      glyph(c, '//', cx, cy, 22, p.primary, { glow: 6 });
      return;
    case EraId.FLASH_2005: {
      c.fillStyle = rgba(p.secondary, 0.45);
      c.fillRect(0, 0, w, h);
      const g = c.createLinearGradient(0, 0, 0, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h / 2);
      c.lineWidth = 3;
      c.strokeStyle = '#000000';
      c.font = 'bold 18px "Trebuchet MS", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText('//', cx, cy);
      c.fillStyle = '#FFFFFF';
      c.fillText('//', cx, cy);
      return;
    }
    case EraId.FLAT_2013:
      c.fillStyle = rgba('#95A5A6', 0.45);
      c.fillRect(0, 0, w, h);
      glyph(c, '//', cx, cy, 18, '#FFFFFF', { font: 'Poppins, sans-serif', weight: 'bold' });
      return;
    case EraId.NEON_2026:
      c.fillStyle = rgba(p.secondary, 0.14);
      c.fillRect(0, 0, w, h);
      c.setLineDash([4, 3]);
      c.strokeStyle = rgba(p.primary, 0.7);
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.setLineDash([]);
      glyph(c, '//', cx, cy, 18, p.primary, { font: 'Poppins, sans-serif', weight: 'bold', glow: 8 });
      return;
  }
}

function drawLaser(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const col = p.hazard;
  switch (era) {
    case EraId.VECTOR_1958:
      c.strokeStyle = col;
      c.shadowColor = col;
      c.shadowBlur = 4;
      c.beginPath();
      c.moveTo(0, 2.5); c.lineTo(w, 2.5); c.moveTo(0, 5.5); c.lineTo(w, 5.5);
      c.stroke();
      return;
    case EraId.ASCII_1977:
      glyph(c, '====', w / 2, h / 2, 12, col, { glow: 3 });
      return;
    case EraId.MAC_1984:
      c.fillStyle = '#000000';
      c.fillRect(0, 2, w, 4);
      dither(c, 0, 1, w, 1, '#000000');
      dither(c, 0, 6, w, 1, '#000000', 1);
      return;
    case EraId.NES_1986:
      c.fillStyle = '#D82800'; c.fillRect(0, 1, w, 6);
      c.fillStyle = '#FCBC3C'; c.fillRect(0, 3, w, 2);
      for (let x = 0; x < w; x += 8) { c.fillStyle = '#FCFCFC'; c.fillRect(x, 3, 2, 2); }
      return;
    case EraId.SNES_1991:
      ['#801010', '#F03030', '#F8A0A0', '#F03030', '#801010'].forEach((t, i) => {
        c.fillStyle = t;
        c.fillRect(0, 1 + i * 1.2, w, 1.4);
      });
      return;
    case EraId.WIN95_1995:
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 1, w, 1);
      c.fillStyle = '#FF0000'; c.fillRect(0, 2, w, 4);
      c.fillStyle = '#800000'; c.fillRect(0, 6, w, 1);
      return;
    case EraId.FLASH_2005: {
      c.fillStyle = col; c.fillRect(0, 1, w, 6);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(0, 2, w, 2);
      c.fillStyle = '#000000'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, h - 1.5, w, 1.5);
      return;
    }
    case EraId.FLAT_2013:
      c.fillStyle = col; c.fillRect(0, 2, w, 4);
      return;
    case EraId.Y2K_1999:
    case EraId.NEON_2026:
    default: {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.5, rgba(col, 0.9));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#FFFFFF';
      c.fillRect(0, 3.5, w, 1);
      return;
    }
  }
}

function drawBouncy(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  if (era === EraId.ASCII_1977) {
    glyph(c, '~~~~', w / 2, 4, 12, p.foreground, { glow: 2 });
    glyph(c, '/\\/\\', w / 2, 12, 11, p.secondary, { glow: 2 });
    return;
  }
  // Mola em zigue-zague.
  c.save();
  c.strokeStyle = era === EraId.VECTOR_1958 ? p.foreground : k.spring;
  c.lineWidth = era === EraId.FLASH_2005 ? 2.5 : 2;
  if (era === EraId.NEON_2026 || era === EraId.VECTOR_1958 || era === EraId.Y2K_1999) {
    c.shadowColor = c.strokeStyle as string;
    c.shadowBlur = 5;
  }
  c.beginPath();
  c.moveTo(3, 8);
  for (let i = 0; i < 6; i++) c.lineTo(5 + i * 4.5, i % 2 === 0 ? 15 : 8);
  c.lineTo(w - 3, 15);
  c.stroke();
  c.restore();
  if (era === EraId.WIN95_1995) {
    bevel(c, 0, 0, w, 6, k.pad);
  } else if (era === EraId.FLAT_2013) {
    c.fillStyle = k.pad;
    c.fillRect(0, 0, w, 6);
  } else {
    paint(c, era, p, (q) => roundRectPath(q, 1, 1, w - 2, 5, 2), k.pad, { lineWidth: era === EraId.FLASH_2005 ? 2 : undefined, noShadow: true });
  }
  post(c, era, w, h);
}

function drawHazard(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  if (era === EraId.ASCII_1977) {
    glyph(c, '^^^^', w / 2, h / 2 + 2, 16, k.spike, { glow: 3 });
    return;
  }
  if (era === EraId.FLAT_2013) {
    // Sombra longa recortada no próprio tile para ladrilhar sem emendas.
    c.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 2; i++) {
      const x = i * 16;
      c.beginPath(); c.moveTo(x + 8, 1); c.lineTo(x + 16, 9); c.lineTo(x + 16, h); c.lineTo(x + 14, h); c.closePath(); c.fill();
    }
  }
  const spikes: PathFn = (q) => {
    for (let i = 0; i < 2; i++) {
      const x = i * 16;
      q.moveTo(x + 1, h - 0.5);
      q.lineTo(x + 8, 1.5);
      q.lineTo(x + 15, h - 0.5);
      q.closePath();
    }
  };
  paint(c, era, p, spikes, k.spike, { noShadow: true, lineWidth: era === EraId.FLASH_2005 ? 2 : undefined });
  post(c, era, w, h);
}

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

function drawCoin(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  if (era === EraId.ASCII_1977) {
    glyph(c, '$', w / 2, h / 2 + 1, 18, p.accent, { glow: 3 });
    return;
  }
  paint(c, era, p, (q) => circlePath(q, 8, 8, 6.3), k.coin, { lineWidth: era === EraId.FLASH_2005 ? 1.8 : undefined, shadowLength: 8 });
  if (era === EraId.VECTOR_1958 || era === EraId.NEON_2026) {
    paint(c, era, p, (q) => circlePath(q, 8, 8, 3), k.coinMark, { lineWidth: 1 });
  } else {
    c.fillStyle = era === EraId.MAC_1984 ? '#000000' : k.coinMark;
    c.fillRect(7, 4.5, 2, 7);
    if (era === EraId.FLASH_2005 || era === EraId.SNES_1991) {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillRect(5, 4, 1.5, 1.5);
    }
  }
  post(c, era, w, h);
}

function drawPortal(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  if (era === EraId.ASCII_1977) {
    asciiBlock(c, ['+----+', '|    |', '| <> |', '|    |', '+----+'], w, h, 14, p.foreground);
    return;
  }
  const arch = (inset: number): PathFn => (q) => {
    const r = (w - 8) / 2 - inset;
    q.moveTo(4 + inset, h - 2);
    q.lineTo(4 + inset, 4 + r + inset);
    q.arc(w / 2, 4 + r + inset, r, Math.PI, 0);
    q.lineTo(w - 4 - inset, h - 2);
    q.closePath();
  };
  paint(c, era, p, arch(0), k.portalOuter, { shadowLength: 14 });
  if (era === EraId.WIN95_1995) {
    // Barra de título azul dentro da moldura.
    c.fillStyle = '#000080';
    c.fillRect(9, 22, w - 18, 6);
  }
  paint(c, era, p, arch(6), k.portalInner, { noShadow: true, gloss: true });
  // Espiral/anéis do vórtice.
  c.save();
  c.strokeStyle = era === EraId.MAC_1984 ? '#FFFFFF' : k.swirl;
  c.lineWidth = era === EraId.FLASH_2005 ? 2 : 1.2;
  if (era === EraId.NEON_2026 || era === EraId.Y2K_1999 || era === EraId.VECTOR_1958) {
    c.shadowColor = k.swirl;
    c.shadowBlur = 6;
  }
  for (let i = 0; i < 3; i++) {
    c.globalAlpha = 0.9 - i * 0.25;
    c.beginPath();
    c.ellipse(w / 2, h * 0.58, 12 - i * 4, 16 - i * 5, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
  post(c, era, w, h);
}

function drawCheckpoint(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  if (era === EraId.ASCII_1977) {
    asciiBlock(c, ['|>', '|', '|', '|', '#'], w, h, 14, p.foreground);
    return;
  }
  if (era === EraId.NEON_2026) {
    // Terminal neon: poste + tela com prompt.
    paint(c, era, p, (q) => q.rect(10.5, 20, 3, h - 24), k.pole);
    paint(c, era, p, (q) => roundRectPath(q, 2, 3, w - 4, 16, 3), k.flag);
    glyph(c, '>_', w / 2, 11, 10, p.primary, { font: MONO, glow: 4 });
    paint(c, era, p, (q) => q.rect(4, h - 4, w - 8, 3), k.pole);
    return;
  }
  paint(c, era, p, (q) => q.rect(3, 3, 3, h - 6), k.pole, { noShadow: true });
  paint(c, era, p, (q) => { q.moveTo(6, 4); q.lineTo(w - 2, 10); q.lineTo(6, 17); q.closePath(); }, k.flag, { shadowLength: 6 });
  paint(c, era, p, (q) => q.rect(1, h - 4, 12, 3), k.pole, { noShadow: true });
  post(c, era, w, h);
}

function drawCore(c: Ctx, era: EraId, p: EraPalette, w: number, h: number): void {
  const k = COLORS[era];
  const cx = w / 2;
  const cy = h / 2;
  if (era === EraId.ASCII_1977) {
    asciiBlock(c, [' .------. ', '|  ****  |', '| *2026* |', '|  ****  |', " '------' "], w, h, 16, p.foreground, 5);
    return;
  }
  // Halo de brilho.
  if (era !== EraId.MAC_1984 && era !== EraId.NES_1986 && era !== EraId.WIN95_1995) {
    const g = c.createRadialGradient(cx, cy, 8, cx, cy, 48);
    g.addColorStop(0, rgba(k.coreOrb, era === EraId.FLAT_2013 ? 0.2 : 0.55));
    g.addColorStop(1, rgba(k.coreOrb, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  // Pinos do chip.
  const pins: PathFn = (q) => {
    for (let i = 0; i < 6; i++) {
      const t = 28 + i * 8;
      q.rect(t, 14, 3, 10); q.rect(t, h - 24, 3, 10);
      q.rect(14, t, 10, 3); q.rect(w - 24, t, 10, 3);
    }
  };
  paint(c, era, p, pins, era === EraId.NEON_2026 ? k.coreOrb : shade(k.coreBody, 0.3), { noShadow: true, lineWidth: 1 });
  paint(c, era, p, (q) => roundRectPath(q, 22, 22, 52, 52, 6), k.coreBody, { shadowLength: 20 });
  if (era === EraId.WIN95_1995) bevel(c, 24, 24, 48, 48, '#C0C0C0');
  paint(c, era, p, (q) => circlePath(q, cx, cy, 15), k.coreOrb, { noShadow: true, lineWidth: 2 });
  if (era !== EraId.VECTOR_1958 && era !== EraId.MAC_1984) {
    const g = c.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 14);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, rgba(k.coreOrb, 0.9));
    g.addColorStop(1, rgba(k.coreOrb, 0));
    c.fillStyle = g;
    c.beginPath();
    circlePath(c, cx, cy, 14);
    c.fill();
  } else {
    paint(c, era, p, (q) => circlePath(q, cx, cy, 7), k.coreOrb, { lineWidth: 1 });
  }
  post(c, era, w, h);
}

const PAINTERS: Record<EraTextureKind, (c: Ctx, era: EraId, p: EraPalette, w: number, h: number) => void> = {
  player: drawPlayer,
  platform: drawPlatform,
  commentWall: drawCommentWall,
  coin: drawCoin,
  portal: drawPortal,
  laser: drawLaser,
  bouncy: drawBouncy,
  hazard: drawHazard,
  checkpoint: drawCheckpoint,
  core: drawCore,
};

// ---------------------------------------------------------------------------
// Artefatos (24×24, visual único)
// ---------------------------------------------------------------------------

function drawArtifact(c: Ctx, id: ArtifactId, s: number): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const outline = (lw = 1.5): void => {
    c.strokeStyle = '#0B0B12';
    c.lineWidth = lw;
    c.stroke();
  };
  switch (id) {
    case ArtifactId.VALVE: {
      // Válvula termiônica: bulbo de vidro, filamento e base com pinos.
      c.fillStyle = '#555B66';
      c.fillRect(8, 17, 8, 4);
      c.fillStyle = '#C9CED6';
      [9, 12, 15].forEach((x) => c.fillRect(x - 0.5, 21, 1, 3));
      c.beginPath();
      c.moveTo(8, 18); c.lineTo(8, 9); c.arc(12, 9, 4, Math.PI, 0); c.lineTo(16, 18); c.closePath();
      c.fillStyle = 'rgba(180,220,255,0.35)';
      c.fill();
      outline(1.2);
      c.strokeStyle = '#FF9A2E';
      c.shadowColor = '#FF7A00';
      c.shadowBlur = 5;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(10, 16); c.lineTo(10, 10); c.lineTo(12, 12); c.lineTo(14, 10); c.lineTo(14, 16);
      c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(9, 7, 1, 4);
      return;
    }
    case ArtifactId.FLOPPY: {
      // Disquete 5¼": capa preta, furo central, janela de leitura, etiqueta.
      c.beginPath();
      roundRectPath(c, 2, 2, 20, 20, 1.5);
      c.fillStyle = '#1C1C22';
      c.fill();
      outline(1);
      c.fillStyle = '#F2EBD3';
      c.fillRect(4, 3.5, 16, 4);
      c.fillStyle = '#C0392B';
      c.fillRect(4, 5, 16, 0.8);
      c.beginPath();
      circlePath(c, 12, 13, 3.2);
      c.fillStyle = '#6E5A3A';
      c.fill();
      c.beginPath();
      circlePath(c, 12, 13, 1.4);
      c.fillStyle = '#000000';
      c.fill();
      c.beginPath();
      roundRectPath(c, 10.5, 17.5, 3, 4, 1.4);
      c.fillStyle = '#6E5A3A';
      c.fill();
      c.fillStyle = '#000000';
      c.fillRect(3, 11, 1.5, 2);
      return;
    }
    case ArtifactId.BALL_MOUSE: {
      // Mouse de bola bege com cabo.
      c.strokeStyle = '#3A3A3A';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(12, 4); c.bezierCurveTo(12, 1, 18, 2, 20, 0.5);
      c.stroke();
      c.beginPath();
      roundRectPath(c, 5, 4, 14, 19, 6);
      c.fillStyle = '#E8DFC8';
      c.fill();
      outline(1.2);
      c.beginPath();
      c.moveTo(5.5, 11); c.lineTo(18.5, 11); c.moveTo(12, 4.5); c.lineTo(12, 11);
      c.strokeStyle = '#8C8470';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(7, 6, 2, 3);
      c.beginPath();
      circlePath(c, 12, 17, 2.2);
      c.fillStyle = '#5A5A66';
      c.fill();
      return;
    }
    case ArtifactId.CARTRIDGE: {
      // Cartucho 8-bit cinza com etiqueta e ranhuras.
      c.beginPath();
      c.moveTo(3, 3); c.lineTo(21, 3); c.lineTo(21, 20); c.lineTo(19, 22); c.lineTo(5, 22); c.lineTo(3, 20); c.closePath();
      c.fillStyle = '#8E8E96';
      c.fill();
      outline(1.2);
      c.fillStyle = '#6A6A72';
      for (let x = 6; x < 19; x += 3) c.fillRect(x, 4.5, 1.5, 3);
      c.fillStyle = '#D82800';
      c.fillRect(5.5, 9, 13, 9);
      c.fillStyle = '#FCBC3C';
      c.fillRect(7, 11, 10, 2);
      c.fillStyle = '#FFFFFF';
      c.fillRect(7, 14.5, 6, 1.5);
      c.fillStyle = '#C9A227';
      c.fillRect(7, 20, 10, 1.5);
      return;
    }
    case ArtifactId.CD_ROM: {
      // CD-ROM prateado com reflexo arco-íris.
      c.beginPath();
      circlePath(c, 12, 12, 10.5);
      const g = c.createLinearGradient(2, 2, 22, 22);
      g.addColorStop(0, '#E8F0FF');
      g.addColorStop(0.3, '#FFB3E6');
      g.addColorStop(0.5, '#B3FFF0');
      g.addColorStop(0.7, '#FFF3B3');
      g.addColorStop(1, '#C8D0E0');
      c.fillStyle = g;
      c.fill();
      outline(1);
      c.beginPath();
      circlePath(c, 12, 12, 4);
      c.fillStyle = '#D0D6E0';
      c.fill();
      c.strokeStyle = '#8A93A6';
      c.lineWidth = 0.8;
      c.stroke();
      c.beginPath();
      circlePath(c, 12, 12, 1.8);
      c.fillStyle = '#0B0B12';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(12, 12, 7.5, Math.PI * 1.1, Math.PI * 1.45);
      c.stroke();
      return;
    }
    case ArtifactId.GPU_NEON: {
      // GPU com ventoinha esmeralda e bordas índigo.
      c.beginPath();
      roundRectPath(c, 1.5, 5, 21, 14, 2);
      c.fillStyle = '#0F1220';
      c.fill();
      c.strokeStyle = '#6366F1';
      c.shadowColor = '#6366F1';
      c.shadowBlur = 5;
      c.lineWidth = 1.2;
      c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = '#C9A227';
      for (let x = 4; x < 20; x += 2) c.fillRect(x, 19, 1, 3);
      c.beginPath();
      circlePath(c, 9, 12, 5);
      c.strokeStyle = '#10B981';
      c.shadowColor = '#10B981';
      c.shadowBlur = 6;
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = '#6EE7B7';
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.4;
        c.moveTo(9, 12);
        c.lineTo(9 + Math.cos(a) * 4, 12 + Math.sin(a) * 4);
      }
      c.stroke();
      c.fillStyle = '#22D3EE';
      c.fillRect(16, 9, 4, 1.5);
      c.fillStyle = '#10B981';
      c.fillRect(16, 12, 4, 1.5);
      c.fillStyle = '#6366F1';
      c.fillRect(16, 15, 4, 1.5);
      void s;
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

export function generateAllTextures(scene: Phaser.Scene): void {
  for (const era of ALL_ERAS) {
    const palette = ERA_CONFIGS[era].palette;
    (Object.keys(TEXTURE_SIZES) as EraTextureKind[]).forEach((kind) => {
      const { width, height } = TEXTURE_SIZES[kind];
      canvasTexture(scene, textureKey(kind, era), width, height, (c, w, h) => {
        PAINTERS[kind](c, era, palette, w, h);
      });
    });
  }

  for (const id of Object.values(ArtifactId)) {
    const s = ARTIFACT_TEXTURE_SIZE;
    canvasTexture(scene, artifactTextureKey(id), s, s, (c) => drawArtifact(c, id, s));
  }

  // Partículas via Graphics.
  if (!scene.textures.exists(PARTICLE_TEXTURE_KEY)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(PARTICLE_TEXTURE_KEY, 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists(PIXEL_PARTICLE_KEY)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture(PIXEL_PARTICLE_KEY, 4, 4);
    g.destroy();
  }
}
