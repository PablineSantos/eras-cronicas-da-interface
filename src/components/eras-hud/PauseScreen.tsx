/** Tela de pausa (estilo 2026): continuar ou reiniciar a fase (com confirmação). */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { EventBus } from '../../core/EventBus';
import type { EraConfig } from '../../core/types';
import { controlHints } from './shared';
import { restartGame } from './VictoryScreen';

/** Modo inicial da próxima abertura (o botão ↻ da timeline abre já pedindo confirmação). */
let openWithConfirm = false;
/** Tela já aberta: o botão ↻ só troca para a confirmação. */
const confirmListeners = new Set<() => void>();

export function pauseGame(confirmRestart = false): void {
  const state = EventBus.getLast('GAME_STATE_CHANGED')?.state;
  if (state === 'paused' && confirmRestart) confirmListeners.forEach((fn) => fn());
  if (state !== 'playing') return;
  openWithConfirm = confirmRestart;
  EventBus.emit('PLAY_SFX', { sound: 'click' });
  EventBus.emit('GAME_STATE_CHANGED', { state: 'paused' });
}

export function resumeGame(): void {
  if (EventBus.getLast('GAME_STATE_CHANGED')?.state !== 'paused') return;
  EventBus.emit('PLAY_SFX', { sound: 'click' });
  EventBus.emit('GAME_STATE_CHANGED', { state: 'playing' });
}

export function togglePause(): void {
  const state = EventBus.getLast('GAME_STATE_CHANGED')?.state;
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
}

const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold';

export default function PauseScreen({ config }: { config: EraConfig }) {
  const [confirm, setConfirm] = useState(openWithConfirm);

  useEffect(() => {
    const show = () => setConfirm(true);
    confirmListeners.add(show);
    return () => {
      confirmListeners.delete(show);
    };
  }, []);

  useEffect(() => {
    openWithConfirm = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirm) setConfirm(false);
        else resumeGame();
      } else if (e.key === 'Enter' && confirm) {
        e.preventDefault();
        restartGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-[#090A0F]/80 p-4 font-poppins text-slate-100 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="relative w-full max-w-sm rounded-3xl border border-indigo-400/30 bg-slate-900/70 p-6 text-center"
        style={{ boxShadow: '0 0 60px rgba(99,102,241,.15)' }}
        initial={{ y: 12, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {confirm ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
              <RotateCcw size={22} />
            </div>
            <h2 className="mt-3 text-xl font-bold">Reiniciar a jornada?</h2>
            <p className="mt-1 text-sm text-slate-400">Você volta para 1958 e perde moedas, artefatos e checkpoints.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={restartGame}
                className={`${btn} bg-rose-500 text-white hover:bg-rose-400`}
              >
                <RotateCcw size={16} /> Reiniciar
              </button>
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setConfirm(false)}
                className={`${btn} border border-slate-600 text-slate-200 hover:bg-white/5`}
              >
                Cancelar
              </button>
            </div>
            <div className="mt-3 text-[11px] text-slate-500">Enter confirma · Esc cancela</div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981] to-[#6366F1]">
              <Pause size={22} className="text-white" fill="currentColor" />
            </div>
            <h2 className="mt-3 text-2xl font-bold">Pausado</h2>
            <p className="mt-1 text-sm text-slate-400">
              {config.year} · {config.name}
            </p>
            <ul className="mx-auto mt-4 grid max-w-xs gap-1.5 text-left text-[12px]">
              {controlHints(config).map((h) => (
                <li key={h.keys} className="flex items-center gap-2 text-slate-300">
                  <kbd className="whitespace-nowrap rounded-md border border-indigo-400/40 bg-indigo-500/15 px-1.5 py-[1px] text-[11px] text-indigo-200">{h.keys}</kbd>
                  {h.action}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={resumeGame}
                className={`${btn} bg-gradient-to-r from-[#10B981] to-[#6366F1] text-white`}
              >
                <Play size={16} fill="currentColor" /> Continuar
              </button>
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setConfirm(true)}
                className={`${btn} border border-slate-600 text-slate-200 hover:bg-white/5`}
              >
                <RotateCcw size={16} /> Reiniciar
              </button>
            </div>
            <div className="mt-3 text-[11px] text-slate-500">Esc ou P para continuar</div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
