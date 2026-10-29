/** Tela de vitória (estilo 2026) com resumo e "Jogar novamente". */
import { motion } from 'framer-motion';
import { Coins, RotateCcw, Skull, Trophy } from 'lucide-react';
import { EventBus } from '../../core/EventBus';
import { ARTIFACTS, EraManager } from '../../core/EraManager';
import type { PlayerStats } from '../../core/types';
import { ARTIFACT_ORDER, ArtifactIcon, hasArtifact } from './shared';
import { emitWindows, resetWindows } from './windowStore';

export function restartGame(): void {
  EventBus.emit('PLAY_SFX', { sound: 'click' });
  resetWindows();
  EraManager.reset();
  emitWindows();
  EventBus.emit('GAME_RESTART', {});
  EventBus.emit('GAME_STATE_CHANGED', { state: 'playing' });
}

export default function VictoryScreen({ stats }: { stats: PlayerStats }) {
  const got = ARTIFACT_ORDER.filter((id) => hasArtifact(stats, id)).length;
  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#090A0F]/90 p-4 font-poppins text-slate-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#10B981]/20 blur-3xl" />
      <motion.div
        className="relative w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-slate-900/60 p-6 text-center backdrop-blur-md sm:p-8"
        initial={{ y: 24, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981] to-[#6366F1]" style={{ boxShadow: '0 0 40px rgba(99,102,241,.45)' }}>
          <Trophy size={28} className="text-white" />
        </div>
        <h2 className="mt-4 bg-gradient-to-r from-[#10B981] to-[#6366F1] bg-clip-text text-3xl font-bold text-transparent">Linha do tempo restaurada!</h2>
        <p className="mt-1 text-sm text-slate-400">Você atravessou todas as interfaces da história.</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
            <Coins size={18} className="mx-auto text-emerald-400" />
            <div className="mt-1 text-2xl font-semibold">{stats.coins}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Moedas</div>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
            <Skull size={18} className="mx-auto text-indigo-400" />
            <div className="mt-1 text-2xl font-semibold">{stats.deaths}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Mortes</div>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
            <Trophy size={18} className="mx-auto text-cyan-300" />
            <div className="mt-1 text-2xl font-semibold">{got}/6</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Artefatos</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {ARTIFACT_ORDER.map((id) => {
            const on = hasArtifact(stats, id);
            return (
              <div
                key={id}
                title={ARTIFACTS[id].name}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-500'}`}
              >
                <ArtifactIcon id={id} size={12} /> {ARTIFACTS[id].name}
              </div>
            );
          })}
        </div>

        <motion.button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={restartGame}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#10B981] to-[#6366F1] px-7 py-3 text-sm font-semibold text-white"
          style={{ boxShadow: '0 0 30px rgba(16,185,129,.35)' }}
        >
          <RotateCcw size={16} /> Jogar novamente
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
