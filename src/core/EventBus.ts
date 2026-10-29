import type {
  ArtifactId,
  BurstKind,
  EraConfig,
  EraId,
  GameState,
  InteractiveWindowRect,
  PlayerStats,
  SoundEffect,
} from './types';

/**
 * Mapa de eventos React <-> Phaser.
 * Quem emite / quem escuta está documentado em cada evento.
 */
export interface EventMap {
  /** EraManager → todos. */
  ERA_CHANGED: { era: EraId; previous: EraId | null; config: EraConfig };
  /** React (DraggableOSWindow/HUD) → Phaser. Lista COMPLETA de janelas, em coordenadas de mundo. */
  WINDOWS_UPDATED: { windows: InteractiveWindowRect[] };
  /** React → Phaser/Som: usuário clicou [X] num pop-up. */
  POPUP_CLOSED: { id: string };
  /** Phaser (cena) → React HUD. */
  PLAYER_STATS_UPDATED: PlayerStats;
  /** Qualquer → Phaser (cena aplica camera.shake). intensity ~0.002..0.02, duration ms. */
  TRIGGER_SCREEN_SHAKE: { intensity: number; duration: number };

  /** Phaser (cena) → React: scroll da câmera em px de mundo, emitido quando muda. */
  CAMERA_UPDATED: { scrollX: number; scrollY: number; zoom: number };
  /** Qualquer → SoundSynthesizer. */
  PLAY_SFX: { sound: SoundEffect };
  /** Player → cena: bullet time ligado/desligado. */
  BULLET_TIME_CHANGED: { active: boolean };
  /** Cena → React/EraManager: artefato coletado. */
  ARTIFACT_COLLECTED: { artifact: ArtifactId; unlocks: EraId[] };
  /** EraManager → React: tentou viajar para uma era ainda bloqueada. */
  ERA_LOCKED: { era: EraId; artifact: ArtifactId | null };
  /** EraManager → React: conjunto de eras desbloqueadas mudou. */
  ERAS_UNLOCKED: { unlocked: EraId[] };
  /** React (título/pausa) → Phaser ('playing' | 'paused'); cena → React ('victory'). */
  GAME_STATE_CHANGED: { state: GameState };
  /** React → cena: reiniciar a fase no próximo GAME_STATE_CHANGED 'playing'. */
  GAME_RESTART: Record<string, never>;
  /** Qualquer → cena/renderer: partículas. */
  SPAWN_BURST: { x: number; y: number; kind: BurstKind };
}

export type EventName = keyof EventMap;
export type EventHandler<K extends EventName> = (payload: EventMap[K]) => void;

class TypedEventBus {
  private handlers: { [K in EventName]?: Set<EventHandler<K>> } = {};
  private last: { [K in EventName]?: EventMap[K] } = {};

  /** Inscreve um handler. Retorna função de cancelamento (ideal para useEffect). */
  on<K extends EventName>(event: K, handler: EventHandler<K>): () => void {
    let set = this.handlers[event] as Set<EventHandler<K>> | undefined;
    if (!set) {
      set = new Set();
      (this.handlers as Record<string, Set<unknown>>)[event] = set;
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  once<K extends EventName>(event: K, handler: EventHandler<K>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends EventName>(event: K, handler: EventHandler<K>): void {
    (this.handlers[event] as Set<EventHandler<K>> | undefined)?.delete(handler);
  }

  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    (this.last as Record<string, unknown>)[event] = payload;
    const set = this.handlers[event] as Set<EventHandler<K>> | undefined;
    if (!set) return;
    // Cópia para permitir unsubscribe durante o dispatch.
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] erro no handler de ${event}:`, err);
      }
    }
  }

  /** Último payload emitido (útil para quem se inscreve tarde, ex.: cena criada após o React). */
  getLast<K extends EventName>(event: K): EventMap[K] | undefined {
    return this.last[event] as EventMap[K] | undefined;
  }

  clear(): void {
    this.handlers = {};
    this.last = {};
  }
}

export const EventBus = new TypedEventBus();
export type { TypedEventBus };
