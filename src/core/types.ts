/**
 * CONTRATO ÚNICO — "Eras: Crônicas da Interface"
 *
 * Todos os módulos (áudio, render, entidades, cena, HUD) dependem apenas
 * deste arquivo, de EventBus.ts e de EraManager.ts. Não altere assinaturas
 * sem atualizar todos os consumidores.
 */

import type Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Eras
// ---------------------------------------------------------------------------

export enum EraId {
  VECTOR_1958 = 1,
  ASCII_1977 = 2,
  MAC_1984 = 3,
  NES_1986 = 4,
  SNES_1991 = 5,
  WIN95_1995 = 6,
  Y2K_1999 = 7,
  FLASH_2005 = 8,
  FLAT_2013 = 9,
  NEON_2026 = 10,
}

export const ALL_ERAS: readonly EraId[] = [
  EraId.VECTOR_1958,
  EraId.ASCII_1977,
  EraId.MAC_1984,
  EraId.NES_1986,
  EraId.SNES_1991,
  EraId.WIN95_1995,
  EraId.Y2K_1999,
  EraId.FLASH_2005,
  EraId.FLAT_2013,
  EraId.NEON_2026,
];

/** Tecla do teclado → era. '0' é a Era 10. */
export const ERA_HOTKEYS: Record<string, EraId> = {
  '1': EraId.VECTOR_1958,
  '2': EraId.ASCII_1977,
  '3': EraId.MAC_1984,
  '4': EraId.NES_1986,
  '5': EraId.SNES_1991,
  '6': EraId.WIN95_1995,
  '7': EraId.Y2K_1999,
  '8': EraId.FLASH_2005,
  '9': EraId.FLAT_2013,
  '0': EraId.NEON_2026,
};

export interface EraPalette {
  /** Cor de fundo da cena. */
  background: string;
  /** Cor principal de desenho (contornos, vetores, texto principal). */
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  /** Cor de plataformas sólidas. */
  platform: string;
  /** Lasers, espinhos, perigos. */
  hazard: string;
  /** Texto de HUD. */
  text: string;
}

export type HudTheme =
  | 'oscilloscope'
  | 'msdos'
  | 'macintosh'
  | 'arcade8'
  | 'arcade16'
  | 'win95'
  | 'winamp'
  | 'aero'
  | 'flat'
  | 'neon';

export interface EraConfig {
  id: EraId;
  year: number;
  name: string;
  subtitle: string;
  /** Rótulo curto da mecânica destaque da era (para Timeline/HUD). */
  mechanicLabel: string;
  /** Família CSS para HUD/Textos Phaser. */
  fontFamily: string;
  hudTheme: HudTheme;

  // --- Física (px, px/s, px/s²) ---
  gravity: number;
  moveSpeed: number;
  jumpVelocity: number;
  /** Aceleração horizontal quando allowInertia (px/s²). */
  acceleration: number;
  /** Desaceleração horizontal quando allowInertia (px/s²). */
  drag: number;

  // --- Permissões de mecânica ---
  allowAirControl: boolean;
  allowVariableJump: boolean;
  allowInertia: boolean;
  allowWallJump: boolean;
  allowBulletTime: boolean;
  allowDoubleJump: boolean;
  allowCoyoteTime: boolean;
  allowJumpBuffer: boolean;
  allowDash: boolean;
  allowSquashStretch: boolean;
  allowWindowDrag: boolean;
  passThroughCodeComments: boolean;

  palette: EraPalette;
}

// ---------------------------------------------------------------------------
// Constantes de jogo / física
// ---------------------------------------------------------------------------

/** Resolução interna do canvas Phaser (Scale.FIT). */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Tamanho total do mundo da fase. */
export const WORLD_WIDTH = 6400;
export const WORLD_HEIGHT = 2400;
/** Y da superfície do chão principal (Setores 1 e 2). */
export const GROUND_Y = 2200;

/** id do <div> que contém o canvas Phaser (usado pelo React para medir o canvas). */
export const GAME_CONTAINER_ID = 'eras-game-container';
/** Chave da cena principal. */
export const MAIN_SCENE_KEY = 'MainLevelScene';

export const COYOTE_TIME_MS = 120;
export const JUMP_BUFFER_MS = 120;
export const DASH_SPEED = 720;
export const DASH_DURATION_MS = 160;
export const DASH_COOLDOWN_MS = 350;
/** Bullet Time: obstáculos rodam a 40% (redução de 60%). */
export const BULLET_TIME_SCALE = 0.4;
export const WALL_SLIDE_MAX_FALL = 120;

// ---------------------------------------------------------------------------
// Janelas interativas (DOM React → colisores Phaser)
// ---------------------------------------------------------------------------

/**
 * Retângulo de janela do SO em COORDENADAS DE MUNDO Phaser (px, origem
 * no canto superior esquerdo). O React converte tela↔mundo usando
 * CAMERA_UPDATED + o boundingClientRect do canvas.
 */
export interface InteractiveWindowRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Se true, o Phaser cria/mantém um corpo estático sólido para ela. */
  active: boolean;
  kind: InteractiveWindowKind;
}

export type InteractiveWindowKind = 'bridge' | 'popup';

export interface InteractiveWindowDef {
  id: string;
  kind: InteractiveWindowKind;
  title: string;
  /** Eras em que a janela é renderizada no DOM. */
  eras: EraId[];
  /** Posição inicial em coordenadas de mundo. */
  x: number;
  y: number;
  width: number;
  height: number;
  draggable: boolean;
}

/**
 * Layout do Setor 2 (fixo no contrato para React e Phaser concordarem):
 *  - Abismo entre CHASM_LEFT_X e CHASM_RIGHT_X no chão GROUND_Y (560px — largo
 *    demais para pular). A janela-ponte (320px) arrastada para o meio cobre o vão.
 *  - Pop-up 404 fica de pé sobre o chão em x 3000..3240 e bloqueia um corredor
 *    de 260px de altura (há teto logo acima). Sólido em TODAS as eras até ser
 *    fechado; só é desenhado no DOM em 1995 (nas demais eras o Phaser desenha
 *    um bloco "ERRO 404 — visite 1995").
 *  - Regras de active: bridge.active = era atual ∈ def.eras; popup.active = !fechado.
 */
export const CHASM_LEFT_X = 2240;
export const CHASM_RIGHT_X = 2800;

export const WINDOW_DEFS: readonly InteractiveWindowDef[] = [
  {
    id: 'bridge-window',
    kind: 'bridge',
    title: 'System Alert: Drag me as a platform!',
    eras: [EraId.MAC_1984, EraId.WIN95_1995],
    x: 1880,
    y: 1880,
    width: 320,
    height: 160,
    draggable: true,
  },
  {
    id: 'popup-404',
    kind: 'popup',
    title: 'Erro Fatal 404',
    eras: [EraId.WIN95_1995],
    x: 3000,
    y: GROUND_Y - 260,
    width: 240,
    height: 260,
    draggable: false,
  },
];

// ---------------------------------------------------------------------------
// Artefatos de Hardware
// ---------------------------------------------------------------------------

export enum ArtifactId {
  VALVE = 'valve',
  FLOPPY = 'floppy',
  BALL_MOUSE = 'ballMouse',
  CARTRIDGE = 'cartridge',
  CD_ROM = 'cdRom',
  GPU_NEON = 'gpuNeon',
}

export interface ArtifactDef {
  id: ArtifactId;
  name: string;
  unlocks: EraId[];
}

// ---------------------------------------------------------------------------
// Estado do jogador / jogo
// ---------------------------------------------------------------------------

export type GameState = 'title' | 'playing' | 'paused' | 'victory';

export interface PlayerStats {
  x: number;
  y: number;
  /** 1..5 */
  sector: number;
  sectorName: string;
  coins: number;
  deaths: number;
  artifacts: ArtifactId[];
  dashReady: boolean;
  bulletTimeActive: boolean;
  grounded: boolean;
}

export type SoundEffect =
  | 'jump'
  | 'doubleJump'
  | 'wallJump'
  | 'land'
  | 'coin'
  | 'artifact'
  | 'dash'
  | 'impact'
  | 'eraChange'
  | 'error'
  | 'click'
  | 'bulletTimeOn'
  | 'bulletTimeOff'
  | 'death'
  | 'bounce'
  | 'victory';

// ---------------------------------------------------------------------------
// Texturas procedurais (geradas por EraVisualRenderer, usadas por todos)
// ---------------------------------------------------------------------------

/** Tipos de textura geradas para CADA era. */
export type EraTextureKind =
  | 'player'
  | 'platform'
  | 'commentWall'
  | 'coin'
  | 'portal'
  | 'laser'
  | 'bouncy'
  | 'hazard'
  | 'checkpoint'
  | 'core';

/** Dimensões (px) de cada textura. Plataformas/paredes/lasers são usadas como TileSprite. */
export const TEXTURE_SIZES: Record<EraTextureKind, { width: number; height: number }> = {
  player: { width: 28, height: 40 },
  platform: { width: 32, height: 32 },
  commentWall: { width: 32, height: 32 },
  coin: { width: 16, height: 16 },
  portal: { width: 48, height: 64 },
  laser: { width: 32, height: 8 },
  bouncy: { width: 32, height: 16 },
  hazard: { width: 32, height: 16 },
  checkpoint: { width: 24, height: 48 },
  core: { width: 96, height: 96 },
};

/** ex.: textureKey('player', EraId.NEON_2026) === 'player-10' */
export function textureKey(kind: EraTextureKind, era: EraId): string {
  return `${kind}-${era}`;
}

/** Artefatos têm visual único independente da era (24x24). ex.: 'artifact-valve' */
export function artifactTextureKey(id: ArtifactId): string {
  return `artifact-${id}`;
}
export const ARTIFACT_TEXTURE_SIZE = 24;

/** Partícula branca 8x8 (círculo), para tingir livremente. */
export const PARTICLE_TEXTURE_KEY = 'particle';

export type BurstKind = 'land' | 'dash' | 'coin' | 'artifact' | 'death' | 'eraChange';

// ---------------------------------------------------------------------------
// Interfaces dos módulos (implementadas na Fase 2)
// ---------------------------------------------------------------------------

/** src/game/pipelines/EraVisualRenderer.ts → `export class EraVisualRenderer implements IEraVisualRenderer` (constructor(scene: Phaser.Scene)) */
export interface IEraVisualRenderer {
  /** Gera TODAS as texturas (todas as eras, artefatos, partícula). Idempotente. */
  generateTextures(): void;
  /** Troca o fundo/parallax/efeitos (matrix rain, bloom, scanlines…) para a era. */
  applyEra(era: EraId): void;
  /** Chamado a cada frame pela cena (parallax, chuva de código, etc.). */
  update(time: number, delta: number): void;
  /** Explosão de partículas no estilo da era atual. */
  spawnBurst(x: number, y: number, kind: BurstKind): void;
  destroy(): void;
}

/** src/game/entities/Player.ts → `export class Player extends Phaser.Physics.Arcade.Sprite implements IPlayerController` (constructor(scene, x, y)) */
export interface IPlayerController {
  update(time: number, delta: number): void;
  applyEra(config: EraConfig): void;
  respawn(x: number, y: number): void;
  isDashing(): boolean;
  isBulletTimeActive(): boolean;
  canDash(): boolean;
  /** Chamado pela cena ao colidir com plataforma elástica. */
  bounce(velocityY: number): void;
}

/** src/game/entities/CommentWall.ts → `export class CommentWall implements ICommentWall` (constructor(scene, x, y, width, height, label?)) */
export interface ICommentWall {
  /** Objeto com corpo físico estático para `physics.add.collider(player, wall.getCollider())`. */
  getCollider(): Phaser.GameObjects.GameObject;
  isPassable(): boolean;
  applyEra(config: EraConfig): void;
  destroy(): void;
}
