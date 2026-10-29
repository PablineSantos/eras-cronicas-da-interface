/**
 * Barra da linha do tempo (1958 → 2026). Reflete a era atual (indicador
 * deslizante com layoutId) e permite clique; teclas 1..0 ficam com o EraManager.
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Pause, Play, RotateCcw } from 'lucide-react';
import { EventBus } from '../core/EventBus';
import { EraManager } from '../core/EraManager';
import { EraId } from '../core/types';
import { useEraConfig, useGameState, useUnlockedEras } from './eras-hud/hooks';
import { pauseGame, togglePause } from './eras-hud/PauseScreen';
import { ERA_ACCENTS } from './eras-hud/shared';

const hotkey = (id: EraId) => (id === EraId.NEON_2026 ? '0' : String(id));

export function TimelineSelector() {
  const current = useEraConfig();
  const unlocked = useUnlockedEras();
  const gameState = useGameState();
  const inGame = gameState === 'playing' || gameState === 'paused';
  const configs = EraManager.getAllConfigs();
  const accent = ERA_ACCENTS[current.id];
  const itemRefs = useRef<Partial<Record<EraId, HTMLButtonElement | null>>>({});

  // Mantém a era atual visível em telas estreitas.
  useEffect(() => {
    itemRefs.current[current.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current.id]);

  const select = (id: EraId) => {
    if (id === current.id) return;
    EventBus.emit('PLAY_SFX', { sound: 'click' });
    EraManager.setEra(id, 'timeline');
  };

  return (
    <nav
      aria-label="Linha do tempo das eras"
      className="relative h-[84px] shrink-0 select-none border-t border-white/10 bg-[#090A0F] font-poppins"
      style={{ boxShadow: `0 -1px 24px ${accent}22` }}
    >
      {/* Fio de acento no topo */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex h-full items-stretch gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:thin]">
        {inGame && (
          <div className="flex shrink-0 flex-col justify-center gap-1 pr-1">
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => e.preventDefault()}
              onClick={togglePause}
              title={gameState === 'paused' ? 'Continuar (Esc / P)' : 'Pausar (Esc / P)'}
              aria-label={gameState === 'paused' ? 'Continuar' : 'Pausar'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-slate-200 outline-none transition-colors hover:bg-white/10"
            >
              {gameState === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pauseGame(true)}
              title="Reiniciar jornada"
              aria-label="Reiniciar jornada"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-slate-200 outline-none transition-colors hover:bg-white/10"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        )}
        {configs.map((cfg) => {
          const active = cfg.id === current.id;
          const isUnlocked = unlocked.includes(cfg.id);
          const a = ERA_ACCENTS[cfg.id];
          return (
            <button
              key={cfg.id}
              ref={(el) => {
                itemRefs.current[cfg.id] = el;
              }}
              type="button"
              tabIndex={-1}
              // Evita foco no botão (Espaço do jogo não deve "clicar" nele).
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => select(cfg.id)}
              title={`${cfg.year} — ${cfg.name}: ${cfg.mechanicLabel}${isUnlocked ? '' : ' (bloqueada)'}`}
              className="group relative min-w-[118px] flex-1 rounded-xl px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-white/5"
            >
              {active && (
                <motion.div
                  layoutId="timeline-indicator"
                  className="absolute inset-0 rounded-xl border backdrop-blur-md"
                  style={{ borderColor: `${a}80`, background: `${a}1A`, boxShadow: `0 0 18px ${a}33, inset 0 0 12px ${a}14` }}
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <div className="relative flex items-center gap-1.5">
                <kbd
                  className="rounded-[5px] border px-1 font-mono text-[10px] leading-[14px]"
                  style={active ? { borderColor: a, color: a } : { borderColor: 'rgba(255,255,255,.18)', color: 'rgba(226,232,240,.55)' }}
                >
                  {hotkey(cfg.id)}
                </kbd>
                <span className="text-[15px] font-semibold leading-none tabular-nums" style={{ color: active ? a : isUnlocked ? '#E2E8F0' : '#64748B' }}>
                  {cfg.year}
                </span>
                {!isUnlocked && <Lock size={11} className="ml-auto text-slate-500" aria-label="bloqueada" />}
              </div>
              <div className={`relative mt-1 truncate text-[11px] font-medium leading-tight ${active ? 'text-slate-100' : isUnlocked ? 'text-slate-300' : 'text-slate-500'}`}>
                {cfg.name}
              </div>
              <div className="relative truncate text-[10px] leading-tight" style={{ color: active ? `${a}CC` : 'rgba(148,163,184,.7)' }}>
                {cfg.mechanicLabel}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default TimelineSelector;
