import { useEffect, useRef, useState } from 'react';
import { EventBus } from '../../core/EventBus';
import { EraManager } from '../../core/EraManager';
import type { ArtifactId, EraConfig, EraId, GameState, PlayerStats } from '../../core/types';

/** Config da era atual (reage a ERA_CHANGED). */
export function useEraConfig(): EraConfig {
  const [config, setConfig] = useState<EraConfig>(() => EraManager.getCurrentConfig());
  useEffect(() => {
    setConfig(EraManager.getCurrentConfig());
    return EventBus.on('ERA_CHANGED', (p) => setConfig(p.config));
  }, []);
  return config;
}

/** Eras desbloqueadas (reage a ERAS_UNLOCKED). */
export function useUnlockedEras(): EraId[] {
  const [unlocked, setUnlocked] = useState<EraId[]>(() => EraManager.getUnlocked());
  useEffect(() => {
    setUnlocked(EraManager.getUnlocked());
    return EventBus.on('ERAS_UNLOCKED', (p) => setUnlocked(p.unlocked));
  }, []);
  return unlocked;
}

/** Estado do jogo; 'title' até o primeiro GAME_STATE_CHANGED. */
export function useGameState(): GameState {
  const [state, setState] = useState<GameState>(
    () => EventBus.getLast('GAME_STATE_CHANGED')?.state ?? 'title',
  );
  useEffect(() => {
    const last = EventBus.getLast('GAME_STATE_CHANGED');
    if (last) setState(last.state);
    return EventBus.on('GAME_STATE_CHANGED', (p) => setState(p.state));
  }, []);
  return state;
}

/** Artefatos coletados (EraManager é a fonte da verdade; reset dispara ERAS_UNLOCKED). */
export function useCollectedArtifacts(): ArtifactId[] {
  const [list, setList] = useState<ArtifactId[]>(() => EraManager.getCollectedArtifacts());
  useEffect(() => {
    const refresh = () => setList(EraManager.getCollectedArtifacts());
    refresh();
    const a = EventBus.on('ARTIFACT_COLLECTED', refresh);
    const b = EventBus.on('ERAS_UNLOCKED', refresh);
    return () => {
      a();
      b();
    };
  }, []);
  return list;
}

const DEFAULT_STATS: PlayerStats = {
  x: 0,
  y: 0,
  sector: 1,
  sectorName: 'Setor 1',
  coins: 0,
  deaths: 0,
  artifacts: [],
  dashReady: true,
  bulletTimeActive: false,
  grounded: true,
};

/** Só os campos relevantes para o HUD (x/y/grounded mudam todo frame e são ignorados). */
function sameHudStats(a: PlayerStats, b: PlayerStats): boolean {
  return (
    a.sector === b.sector &&
    a.sectorName === b.sectorName &&
    a.coins === b.coins &&
    a.deaths === b.deaths &&
    a.dashReady === b.dashReady &&
    a.bulletTimeActive === b.bulletTimeActive &&
    a.artifacts.length === b.artifacts.length
  );
}

/** Stats do jogador, mesclados com artefatos do EraManager e BULLET_TIME_CHANGED. */
export function usePlayerStats(): PlayerStats {
  const [stats, setStats] = useState<PlayerStats>(
    () => EventBus.getLast('PLAYER_STATS_UPDATED') ?? DEFAULT_STATS,
  );
  const current = useRef(stats);
  const collected = useCollectedArtifacts();

  useEffect(() => {
    const apply = (next: PlayerStats) => {
      if (sameHudStats(current.current, next)) return;
      current.current = next;
      setStats(next);
    };
    const offStats = EventBus.on('PLAYER_STATS_UPDATED', apply);
    const offBt = EventBus.on('BULLET_TIME_CHANGED', (p) =>
      apply({ ...current.current, bulletTimeActive: p.active }),
    );
    return () => {
      offStats();
      offBt();
    };
  }, []);

  const artifacts = Array.from(new Set<ArtifactId>([...collected, ...stats.artifacts]));
  return { ...stats, artifacts };
}

/** Relógio real HH:MM (atualiza a cada 10 s). */
export function useClock(): string {
  const fmt = () =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const id = window.setInterval(() => setTime(fmt()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}
