/** Tela de título (estilo 2026). Botão ou Enter → GAME_STATE_CHANGED 'playing'. */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { EventBus } from '../../core/EventBus';
import { ALL_ERAS } from '../../core/types';
import { ERA_CONFIGS } from '../../core/EraManager';
import { ERA_ACCENTS } from './shared';

const CONTROLS: [string, string][] = [
  ['← →', 'mover'],
  ['Espaço', 'pular'],
  ['1 … 0', 'viajar entre eras'],
  ['X / K / Shift', 'dash (2013+)'],
  ['Shift', 'liga/desliga bullet time (1999)'],
  ['Mouse', 'arrastar janelas (1984 / 1995)'],
];

export function startGame(): void {
  EventBus.emit('PLAY_SFX', { sound: 'click' });
  EventBus.emit('GAME_STATE_CHANGED', { state: 'playing' });
}

export default function TitleScreen() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#090A0F]/95 p-4 font-poppins text-slate-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* Brilhos de fundo */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[#10B981]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-[#6366F1]/20 blur-3xl" />

      <motion.div
        className="relative w-full max-w-xl rounded-3xl border border-emerald-500/30 bg-slate-900/60 p-6 text-center backdrop-blur-md sm:p-8"
        style={{ boxShadow: '0 0 60px rgba(16,185,129,.12)' }}
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Faixa das eras */}
        <div className="mx-auto mb-5 flex max-w-sm justify-center gap-1.5">
          {ALL_ERAS.map((id, i) => (
            <motion.span
              key={id}
              title={String(ERA_CONFIGS[id].year)}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: ERA_ACCENTS[id] }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.05 * i, duration: 0.3 }}
            />
          ))}
        </div>

        <h1 className="bg-gradient-to-r from-[#10B981] to-[#6366F1] bg-clip-text text-3xl font-bold leading-tight text-transparent sm:text-4xl">
          Eras: Crônicas da Interface
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Atravesse 70 anos de interfaces, de 1958 a 2026. Cada era muda a física, os gráficos e as regras.
        </p>

        <ul className="mx-auto mt-5 grid max-w-md grid-cols-1 gap-x-6 gap-y-1.5 text-left text-[12px] sm:grid-cols-2">
          {CONTROLS.map(([k, a]) => (
            <li key={k} className="flex items-center gap-2 text-slate-300">
              <kbd className="whitespace-nowrap rounded-md border border-indigo-400/40 bg-indigo-500/15 px-1.5 py-[1px] text-[11px] text-indigo-200">{k}</kbd>
              {a}
            </li>
          ))}
        </ul>

        <motion.button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={startGame}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#10B981] to-[#6366F1] px-7 py-3 text-sm font-semibold text-white"
          style={{ boxShadow: '0 0 30px rgba(16,185,129,.35)' }}
        >
          <Play size={16} fill="currentColor" /> Iniciar Jornada
        </motion.button>
        <div className="mt-2 text-[11px] text-slate-500">ou pressione Enter</div>
      </motion.div>
    </motion.div>
  );
}
