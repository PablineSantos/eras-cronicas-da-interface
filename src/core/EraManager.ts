import { EventBus } from './EventBus';
import {
  ALL_ERAS,
  ArtifactDef,
  ArtifactId,
  EraConfig,
  EraId,
  ERA_HOTKEYS,
} from './types';

const BASE_FLAGS = {
  allowAirControl: false,
  allowVariableJump: false,
  allowInertia: false,
  allowWallJump: false,
  allowBulletTime: false,
  allowDoubleJump: false,
  allowCoyoteTime: false,
  allowJumpBuffer: false,
  allowDash: false,
  allowSquashStretch: false,
  allowWindowDrag: false,
  passThroughCodeComments: false,
} as const;

/** Física "dura" das eras primitivas. */
const RETRO_PHYSICS = { gravity: 1100, moveSpeed: 180, jumpVelocity: 560, acceleration: 0, drag: 0 };
/** Física com inércia (16-bits em diante). */
const MODERN_PHYSICS = { gravity: 1150, moveSpeed: 240, jumpVelocity: 600, acceleration: 1600, drag: 2000 };

/** Mecânicas cumulativas a partir de 1991 (Bullet Time e Window Drag são exclusivos da sua era). */
const FROM_1991 = { ...BASE_FLAGS, allowAirControl: true, allowVariableJump: true, allowInertia: true, allowWallJump: true };

export const ERA_CONFIGS: Record<EraId, EraConfig> = {
  [EraId.VECTOR_1958]: {
    id: EraId.VECTOR_1958,
    year: 1958,
    name: 'Tennis for Two',
    subtitle: 'Osciloscópio vetorial',
    mechanicLabel: 'Pulo linear',
    fontFamily: '"VT323", monospace',
    hudTheme: 'oscilloscope',
    ...RETRO_PHYSICS,
    ...BASE_FLAGS,
    palette: {
      background: '#021008',
      foreground: '#00FF66',
      primary: '#00FF66',
      secondary: '#00A844',
      accent: '#B4FFD2',
      platform: '#00FF66',
      hazard: '#66FFAA',
      text: '#00FF66',
    },
  },
  [EraId.ASCII_1977]: {
    id: EraId.ASCII_1977,
    year: 1977,
    name: 'Terminal ASCII',
    subtitle: 'C:\\ERAS\\CHRONO.EXE',
    mechanicLabel: 'Atravessa // comentários',
    fontFamily: '"VT323", monospace',
    hudTheme: 'msdos',
    ...RETRO_PHYSICS,
    ...BASE_FLAGS,
    passThroughCodeComments: true,
    palette: {
      background: '#000000',
      foreground: '#33FF00',
      primary: '#33FF00',
      secondary: '#1A8000',
      accent: '#CCFF99',
      platform: '#33FF00',
      hazard: '#FFFF33',
      text: '#33FF00',
    },
  },
  [EraId.MAC_1984]: {
    id: EraId.MAC_1984,
    year: 1984,
    name: 'Macintosh 1-bit',
    subtitle: 'System 1 • 512×342',
    mechanicLabel: 'Arraste janelas',
    fontFamily: '"VT323", monospace',
    hudTheme: 'macintosh',
    ...RETRO_PHYSICS,
    ...BASE_FLAGS,
    allowWindowDrag: true,
    palette: {
      background: '#FFFFFF',
      foreground: '#000000',
      primary: '#000000',
      secondary: '#555555',
      accent: '#000000',
      platform: '#000000',
      hazard: '#000000',
      text: '#000000',
    },
  },
  [EraId.NES_1986]: {
    id: EraId.NES_1986,
    year: 1986,
    name: '8-Bit Arcade',
    subtitle: 'Paleta de 54 cores',
    mechanicLabel: 'Controle aéreo + pulo variável',
    fontFamily: '"Press Start 2P", monospace',
    hudTheme: 'arcade8',
    gravity: 1100,
    moveSpeed: 200,
    jumpVelocity: 580,
    acceleration: 0,
    drag: 0,
    ...BASE_FLAGS,
    allowAirControl: true,
    allowVariableJump: true,
    palette: {
      background: '#5C94FC',
      foreground: '#000000',
      primary: '#E45C10',
      secondary: '#00A800',
      accent: '#FCBC3C',
      platform: '#C84C0C',
      hazard: '#D82800',
      text: '#FFFFFF',
    },
  },
  [EraId.SNES_1991]: {
    id: EraId.SNES_1991,
    year: 1991,
    name: '16-Bit Parallax',
    subtitle: 'Modo 7 • 3 camadas',
    mechanicLabel: 'Inércia + Wall-Jump',
    fontFamily: '"Press Start 2P", monospace',
    hudTheme: 'arcade16',
    ...MODERN_PHYSICS,
    ...FROM_1991,
    palette: {
      background: '#1A1A5E',
      foreground: '#F8F8F8',
      primary: '#3050C8',
      secondary: '#58B858',
      accent: '#F8D030',
      platform: '#8058A0',
      hazard: '#F03030',
      text: '#F8F8F8',
    },
  },
  [EraId.WIN95_1995]: {
    id: EraId.WIN95_1995,
    year: 1995,
    name: 'Windows 95',
    subtitle: 'Iniciar • 640×480',
    mechanicLabel: 'Arraste janelas • feche pop-ups',
    fontFamily: '"MS Sans Serif", Tahoma, "Segoe UI", sans-serif',
    hudTheme: 'win95',
    ...MODERN_PHYSICS,
    ...FROM_1991,
    allowWindowDrag: true,
    palette: {
      background: '#008080',
      foreground: '#000000',
      primary: '#C0C0C0',
      secondary: '#808080',
      accent: '#000080',
      platform: '#C0C0C0',
      hazard: '#FF0000',
      text: '#000000',
    },
  },
  [EraId.Y2K_1999]: {
    id: EraId.Y2K_1999,
    year: 1999,
    name: 'Cyber Y2K',
    subtitle: 'Bug do Milênio',
    mechanicLabel: 'Bullet Time (Shift)',
    fontFamily: '"VT323", monospace',
    hudTheme: 'winamp',
    ...MODERN_PHYSICS,
    ...FROM_1991,
    allowBulletTime: true,
    palette: {
      background: '#000A00',
      foreground: '#A6FF00',
      primary: '#A6FF00',
      secondary: '#00FF41',
      accent: '#C0C0C0',
      platform: '#2E3B2E',
      hazard: '#FF2A2A',
      text: '#A6FF00',
    },
  },
  [EraId.FLASH_2005]: {
    id: EraId.FLASH_2005,
    year: 2005,
    name: 'Flash & Aero',
    subtitle: 'Web 2.0 • Glossy',
    mechanicLabel: 'Pulo Duplo',
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
    hudTheme: 'aero',
    ...MODERN_PHYSICS,
    gravity: 1100,
    jumpVelocity: 590,
    ...FROM_1991,
    allowDoubleJump: true,
    palette: {
      background: '#BDE8FF',
      foreground: '#000000',
      primary: '#2FA8E8',
      secondary: '#7ED321',
      accent: '#FF8A00',
      platform: '#5CC85C',
      hazard: '#E8202A',
      text: '#06345C',
    },
  },
  [EraId.FLAT_2013]: {
    id: EraId.FLAT_2013,
    year: 2013,
    name: 'Flat Design',
    subtitle: 'Menos é mais',
    mechanicLabel: 'Dash + Coyote Time',
    fontFamily: '"Poppins", sans-serif',
    hudTheme: 'flat',
    ...MODERN_PHYSICS,
    ...FROM_1991,
    allowDoubleJump: true,
    allowCoyoteTime: true,
    allowJumpBuffer: true,
    allowDash: true,
    palette: {
      background: '#ECF0F1',
      foreground: '#2C3E50',
      primary: '#1ABC9C',
      secondary: '#3498DB',
      accent: '#E74C3C',
      platform: '#34495E',
      hazard: '#E74C3C',
      text: '#2C3E50',
    },
  },
  [EraId.NEON_2026]: {
    id: EraId.NEON_2026,
    year: 2026,
    name: 'Neon Glass',
    subtitle: 'Crônicas da Interface',
    mechanicLabel: 'Dash Neon + Squash & Stretch',
    fontFamily: '"Poppins", sans-serif',
    hudTheme: 'neon',
    ...MODERN_PHYSICS,
    moveSpeed: 260,
    ...FROM_1991,
    allowDoubleJump: true,
    allowCoyoteTime: true,
    allowJumpBuffer: true,
    allowDash: true,
    allowSquashStretch: true,
    palette: {
      background: '#090A0F',
      foreground: '#E2E8F0',
      primary: '#10B981',
      secondary: '#6366F1',
      accent: '#22D3EE',
      platform: '#1E293B',
      hazard: '#F43F5E',
      text: '#E2E8F0',
    },
  },
};

export const ARTIFACTS: Record<ArtifactId, ArtifactDef> = {
  [ArtifactId.VALVE]: { id: ArtifactId.VALVE, name: 'Válvula Termiônica', unlocks: [EraId.ASCII_1977] },
  [ArtifactId.FLOPPY]: { id: ArtifactId.FLOPPY, name: 'Disquete 5¼"', unlocks: [EraId.MAC_1984, EraId.NES_1986] },
  [ArtifactId.BALL_MOUSE]: { id: ArtifactId.BALL_MOUSE, name: 'Mouse de Bola', unlocks: [EraId.SNES_1991, EraId.WIN95_1995] },
  [ArtifactId.CARTRIDGE]: { id: ArtifactId.CARTRIDGE, name: 'Cartucho 8-Bit', unlocks: [EraId.Y2K_1999] },
  [ArtifactId.CD_ROM]: { id: ArtifactId.CD_ROM, name: 'CD-ROM', unlocks: [EraId.FLASH_2005] },
  [ArtifactId.GPU_NEON]: { id: ArtifactId.GPU_NEON, name: 'GPU Neon', unlocks: [EraId.FLAT_2013, EraId.NEON_2026] },
};

export type EraChangeSource = 'keyboard' | 'timeline' | 'game' | 'init';

/**
 * Singleton com o estado global de era.
 * As teclas 1..0 / timeline só levam a eras desbloqueadas (artefatos); bloqueadas emitem ERA_LOCKED.
 * Apenas o EraManager escuta as teclas 1..0 — Player/Cena/HUD NÃO devem duplicar isso.
 */
class EraManagerImpl {
  private current: EraId = EraId.VECTOR_1958;
  private previous: EraId | null = null;
  private unlocked = new Set<EraId>([EraId.VECTOR_1958]);
  private collected = new Set<ArtifactId>();
  private keyboardBound = false;

  getCurrentEra(): EraId {
    return this.current;
  }

  getCurrentConfig(): EraConfig {
    return ERA_CONFIGS[this.current];
  }

  getConfig(id: EraId): EraConfig {
    return ERA_CONFIGS[id];
  }

  getAllConfigs(): EraConfig[] {
    return ALL_ERAS.map((id) => ERA_CONFIGS[id]);
  }

  setEra(id: EraId, source: EraChangeSource = 'game'): void {
    if (!ERA_CONFIGS[id] || id === this.current) return;
    // Progressão linear: o jogador só viaja para eras já desbloqueadas por artefatos.
    if ((source === 'keyboard' || source === 'timeline') && !this.unlocked.has(id)) {
      const artifact = Object.values(ARTIFACTS).find((a) => a.unlocks.includes(id));
      EventBus.emit('PLAY_SFX', { sound: 'error' });
      EventBus.emit('ERA_LOCKED', { era: id, artifact: artifact?.id ?? null });
      return;
    }
    this.previous = this.current;
    this.current = id;
    EventBus.emit('ERA_CHANGED', { era: id, previous: this.previous, config: ERA_CONFIGS[id] });
  }

  nextEra(): void {
    const i = ALL_ERAS.indexOf(this.current);
    this.setEra(ALL_ERAS[(i + 1) % ALL_ERAS.length], 'game');
  }

  prevEra(): void {
    const i = ALL_ERAS.indexOf(this.current);
    this.setEra(ALL_ERAS[(i - 1 + ALL_ERAS.length) % ALL_ERAS.length], 'game');
  }

  isUnlocked(id: EraId): boolean {
    return this.unlocked.has(id);
  }

  getUnlocked(): EraId[] {
    return ALL_ERAS.filter((id) => this.unlocked.has(id));
  }

  unlock(ids: EraId[]): void {
    let changed = false;
    for (const id of ids) {
      if (!this.unlocked.has(id)) {
        this.unlocked.add(id);
        changed = true;
      }
    }
    if (changed) EventBus.emit('ERAS_UNLOCKED', { unlocked: this.getUnlocked() });
  }

  /** Chamado pela cena ao coletar um artefato. Emite ARTIFACT_COLLECTED e ERAS_UNLOCKED. */
  collectArtifact(id: ArtifactId): void {
    if (this.collected.has(id)) return;
    this.collected.add(id);
    const def = ARTIFACTS[id];
    EventBus.emit('ARTIFACT_COLLECTED', { artifact: id, unlocks: def.unlocks });
    this.unlock(def.unlocks);
  }

  getCollectedArtifacts(): ArtifactId[] {
    return [...this.collected];
  }

  /** Liga as teclas 1..0 (idempotente). Chamado uma vez pelo App. Retorna função de cleanup. */
  bindKeyboard(target: Window = window): () => void {
    if (this.keyboardBound) return () => {};
    this.keyboardBound = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Usa a tecla física: com Shift segurado e.key vira '&', '*'... (Shift+7 = '&').
      const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1] ?? e.key;
      const era = ERA_HOTKEYS[digit];
      if (era !== undefined) this.setEra(era, 'keyboard');
    };
    target.addEventListener('keydown', onKey);
    return () => {
      target.removeEventListener('keydown', onKey);
      this.keyboardBound = false;
    };
  }

  /** Emite o estado inicial (ERA_CHANGED com previous=null) para quem já está inscrito. */
  broadcastInitial(): void {
    EventBus.emit('ERA_CHANGED', { era: this.current, previous: null, config: ERA_CONFIGS[this.current] });
    EventBus.emit('ERAS_UNLOCKED', { unlocked: this.getUnlocked() });
  }

  reset(): void {
    this.current = EraId.VECTOR_1958;
    this.previous = null;
    this.unlocked = new Set([EraId.VECTOR_1958]);
    this.collected.clear();
    this.broadcastInitial();
  }
}

export const EraManager = new EraManagerImpl();
export type { EraManagerImpl };
