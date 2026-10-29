/**
 * Layout declarativo da fase (coordenadas de mundo, px, canto superior esquerdo).
 *
 * Física de referência (ERA_CONFIGS):
 *  - retro (1958–1984): v=560, g=1100 → altura ≈142px, alcance ≈183px
 *  - moderno (1991+):   v=600, g=1150 → altura ≈156px, alcance ≈250px
 *  - 2005 pulo duplo: ≈316px de altura total
 *  - mola: bounce(-900) → ≈352px de altura
 *  - dash: 720px/s × 160ms ≈ 115px
 */
import { ArtifactId, CHASM_LEFT_X, CHASM_RIGHT_X, GROUND_Y, WORLD_WIDTH } from '../../core/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Direção para onde apontam as pontas dos espinhos. */
export type SpikeDir = 'up' | 'left' | 'right';
export interface HazardDef extends Rect {
  dir: SpikeDir;
}

export interface PointDef {
  x: number;
  y: number;
}

export interface ArtifactPlacement extends PointDef {
  id: ArtifactId;
}

export interface LaserDef {
  /** Centro X do feixe vertical. */
  x: number;
  y1: number;
  y2: number;
  /** Período total do ciclo (s) e tempo desligado (s). */
  period: number;
  offTime: number;
  /** Defasagem (s). */
  phase: number;
}

export interface SignDef extends PointDef {
  text: string;
}

export interface SectorDef {
  id: number;
  name: string;
  /** Limite X (exclusivo) do setor. */
  maxX: number;
}

// ---------------------------------------------------------------------------
// Setores
// ---------------------------------------------------------------------------

export const SECTORS: readonly SectorDef[] = [
  { id: 1, name: 'Início 1958 → 1977', maxX: 1700 },
  { id: 2, name: 'Abismo 1984 / 1995', maxX: 3400 },
  { id: 3, name: 'Chaminé 1991 + Lasers 1999', maxX: 4900 },
  { id: 4, name: 'Torre 2005 → 2026', maxX: 6040 },
  { id: 5, name: 'Núcleo 2026', maxX: Number.POSITIVE_INFINITY },
];

export function sectorAt(x: number): SectorDef {
  return SECTORS.find((s) => x < s.maxX) ?? SECTORS[SECTORS.length - 1];
}

export const SPAWN: PointDef = { x: 120, y: GROUND_Y - 60 };

// ---------------------------------------------------------------------------
// Geometria-chave
// ---------------------------------------------------------------------------

/** Setor 3: chaminé (vão interno 3524..3624 = 100px) e corredor dos lasers (y 800..1000). */
export const CHIMNEY = { innerLeft: 3524, innerRight: 3624, top: 1000 } as const;
export const LASER_CORRIDOR = { x1: 3624, x2: 4900, ceilingY: 800, floorY: 1000 } as const;
/** Setor 4: torre. */
export const TOWER = { x1: 4900, x2: 6040, floorY: 1000 } as const;
/** Setor 5: câmara do núcleo (chão em y=430). */
export const CORE_POS: PointDef = { x: 6230, y: 430 - 58 };

/** Firewall: parede de comentário do chão ao teto (atravessável só em 1977). */
export const FIREWALL: Rect = { x: 1400, y: 0, w: 64, h: GROUND_Y };

// ---------------------------------------------------------------------------
// Plataformas sólidas
// ---------------------------------------------------------------------------

export const PLATFORMS: readonly Rect[] = [
  // --- Chão principal (abismo entre CHASM_LEFT_X e CHASM_RIGHT_X) ---
  { x: 0, y: GROUND_Y, w: CHASM_LEFT_X, h: 200 },
  { x: CHASM_RIGHT_X, y: GROUND_Y, w: WORLD_WIDTH - CHASM_RIGHT_X, h: 200 },

  // --- Setor 1: saltos básicos (todos ≤ 120px de subida, ≤ 80px de vão) ---
  { x: 320, y: 2100, w: 128, h: 32 },
  { x: 560, y: 2080, w: 64, h: 120 }, // bloco de 120px: exige pular
  { x: 940, y: 2090, w: 160, h: 32 }, // 110px acima do chão; decolagem segura logo após os espinhos
  { x: 1120, y: 1990, w: 128, h: 32 }, // Válvula em cima (100px acima da anterior)

  // --- Setor 2: teto do corredor do pop-up (base em GROUND_Y-260 = 1940) ---
  // Vai até o topo do mundo: impossível passar por cima do pop-up.
  { x: 2950, y: 0, w: 450, h: GROUND_Y - 260 },

  // --- Setor 3: chaminé + corredor ---
  { x: 3400, y: 800, w: 124, h: 1340 }, // parede esquerda da chaminé (vão de 60px embaixo p/ entrar sem escapar no wall-jump)
  { x: 3400, y: 0, w: 1500, h: 800 }, // massa superior = teto do corredor dos lasers
  { x: 3624, y: 1000, w: TOWER.x2 - 3624, h: GROUND_Y - 1000 }, // massa inferior = parede dir. da chaminé + chão do corredor/torre

  // --- Setor 4: torre ---
  { x: 5040, y: 976, w: 96, h: 24 }, // pedestal da mola
  { x: 5180, y: 660, w: 160, h: 32 }, // P1: só alcançável pela mola (pulo duplo do chão chega a ~684)
  { x: 5420, y: 430, w: 200, h: 32 }, // P2: +230px acima de P1 → exige Pulo Duplo
  { x: 5560, y: 0, w: 480, h: 358 }, // teto do túnel do dash (72px de vão sobre y=430)
  { x: 5780, y: 430, w: 100, h: 32 }, // T2 entre os dois poços de 160px

  // --- Setor 5: câmara do núcleo ---
  { x: TOWER.x2, y: 430, w: WORLD_WIDTH - TOWER.x2, h: GROUND_Y - 430 },
];

/** Plataformas elásticas (topo é onde o jogador quica). */
export const BOUNCY: readonly Rect[] = [{ x: 5040, y: 960, w: 96, h: 16 }];

// ---------------------------------------------------------------------------
// Perigos
// ---------------------------------------------------------------------------

export const HAZARDS: readonly HazardDef[] = [
  { x: 720, y: GROUND_Y - 16, w: 96, h: 16, dir: 'up' },
  { x: 1776, y: GROUND_Y - 16, w: 64, h: 16, dir: 'up' },
  // Torre: espinhos no chão sob P1/P2 (punem quedas)
  { x: 5360, y: TOWER.floorY - 16, w: 160, h: 16, dir: 'up' },
  // Faces verticais da torre: impedem escalar com wall-jump em parede única
  { x: 4900, y: 100, w: 16, h: 680, dir: 'right' },
  { x: TOWER.x2 - 16, y: 480, w: 16, h: TOWER.floorY - 480, dir: 'left' },
];

/** Lasers verticais (piso→teto do corredor). Desligado 0.14s: passar exige ≥0.15s a 240px/s. Com Bullet Time (0.4x) → 0.35s. */
export const LASERS: readonly LaserDef[] = [3880, 4060, 4240, 4420, 4600, 4780].map((x, i) => ({
  x,
  y1: LASER_CORRIDOR.ceilingY,
  y2: LASER_CORRIDOR.floorY,
  period: i % 2 === 0 ? 0.64 : 0.7,
  offTime: 0.14,
  phase: i * 0.21,
}));

// ---------------------------------------------------------------------------
// Coletáveis / pontos
// ---------------------------------------------------------------------------

/** y = superfície do chão onde o checkpoint fica de pé. */
export const CHECKPOINTS: readonly PointDef[] = [
  { x: 1530, y: GROUND_Y }, // após o firewall
  { x: 2150, y: GROUND_Y }, // antes do abismo
  { x: 2880, y: GROUND_Y }, // após o abismo
  { x: 3574, y: GROUND_Y }, // base da chaminé
  { x: 3680, y: LASER_CORRIDOR.floorY }, // início dos lasers
  { x: 4850, y: LASER_CORRIDOR.floorY }, // fim dos lasers / base da torre
  { x: 5470, y: 430 }, // P2 (antes do túnel do dash)
];

/** Ordem: Válvula, Disquete, Mouse, Cartucho, CD-ROM, GPU — cada um antes do obstáculo da era que libera. */
export const ARTIFACT_PLACEMENTS: readonly ArtifactPlacement[] = [
  { id: ArtifactId.VALVE, x: 1184, y: 1955 }, // → 1977 (firewall)
  { id: ArtifactId.FLOPPY, x: 1610, y: GROUND_Y - 34 }, // → 1984/1986 (janela-ponte)
  { id: ArtifactId.BALL_MOUSE, x: 2040, y: GROUND_Y - 34 }, // → 1991/1995 (pop-up, chaminé)
  { id: ArtifactId.CARTRIDGE, x: 3574, y: 880 }, // → 1999 (lasers)
  { id: ArtifactId.CD_ROM, x: 4990, y: TOWER.floorY - 40 }, // → 2005 (pulo duplo)
  { id: ArtifactId.GPU_NEON, x: 5540, y: 395 }, // → 2013/2026 (dash)
];

export const COINS: readonly PointDef[] = [
  // Setor 1
  { x: 250, y: 2160 }, { x: 384, y: 2060 }, { x: 592, y: 2040 }, { x: 768, y: 2110 },
  { x: 1020, y: 2050 }, { x: 1300, y: 2160 }, { x: 1560, y: 2160 },
  // Setor 2
  { x: 1700, y: 2160 }, { x: 1900, y: 2160 }, { x: 2400, y: 2110 }, { x: 2520, y: 2090 },
  { x: 2640, y: 2110 }, { x: 2930, y: 2160 }, { x: 3320, y: 2160 },
  // Setor 3: chaminé e corredor
  { x: 3574, y: 2000 }, { x: 3574, y: 1800 }, { x: 3574, y: 1600 }, { x: 3574, y: 1400 },
  { x: 3574, y: 1200 }, { x: 3970, y: 960 }, { x: 4150, y: 960 }, { x: 4330, y: 960 },
  { x: 4510, y: 960 }, { x: 4690, y: 960 },
  // Setor 4: torre
  { x: 5088, y: 820 }, { x: 5260, y: 620 }, { x: 5380, y: 520 }, { x: 5700, y: 400 },
  { x: 5830, y: 395 }, { x: 5960, y: 400 },
  // Setor 5
  { x: 6110, y: 400 }, { x: 6350, y: 400 },
];

/** Placas de dica (origem embaixo/centro). */
export const SIGNS: readonly SignDef[] = [
  { x: 200, y: 1990, text: '// SETOR 1 — INÍCIO 1958\n// Pegue a Válvula para liberar 1977' },
  { x: 1240, y: 2140, text: '// FIREWALL_COMMENT\n// Aperte [2] (1977) para atravessar comentários' },
  { x: 2080, y: 2140, text: '// ABISMO À FRENTE\n// [3] 1984 ou [6] 1995: arraste a janela\n// para o meio do vão e use-a de ponte' },
  { x: 2875, y: 2080, text: '// POPUP_404 bloqueia o corredor\n// [6] 1995: clique no [X]' },
  { x: 3290, y: 2150, text: '// WALL-JUMP ↑ (1991+)\n// segure → contra a parede\n// e aperte Espaço' },
  { x: 3760, y: 900, text: '// LASERS 1999\n// Aperte [7], depois toque SHIFT\n// para ligar/desligar o Bullet Time' },
  { x: 5010, y: 900, text: '// TORRE 2005 → 2026\n// Pule na mola elástica' },
  { x: 5260, y: 600, text: '// [8] 2005: Pulo Duplo' },
  { x: 5480, y: 360, text: '// [9]/[0]: DASH no túnel' },
  { x: CORE_POS.x, y: 250, text: '// NÚCLEO 2026' },
];
