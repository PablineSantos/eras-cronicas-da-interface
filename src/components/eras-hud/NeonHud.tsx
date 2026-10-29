/** 2026 — High-Contrast Dark Mode com Glassmorphism. */
import { motion } from 'framer-motion';
import { Coins, Skull, Zap } from 'lucide-react';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact } from './shared';
import type { HudProps } from './shared';

const glassCard = 'backdrop-blur-md bg-slate-900/60 border border-emerald-500/30 rounded-2xl';

export default function NeonHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  return (
    <div className="absolute inset-0 font-poppins text-slate-100">
      <div className={`absolute left-4 top-4 px-4 py-2.5 ${glassCard}`} style={{ boxShadow: '0 0 24px rgba(16,185,129,.15)' }}>
        <div className="bg-gradient-to-r from-[#10B981] to-[#6366F1] bg-clip-text text-[26px] font-bold leading-none text-transparent">
          {config.year}
        </div>
        <div className="mt-1 text-[12px] font-medium text-slate-200">{config.name}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{stats.sectorName}</div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className={`flex items-center gap-4 px-4 py-2 text-[14px] font-semibold ${glassCard}`}>
          <span className="flex items-center gap-1.5">
            <Coins size={15} className="text-[#10B981]" /> {stats.coins}
          </span>
          <span className="flex items-center gap-1.5">
            <Skull size={15} className="text-[#6366F1]" /> {stats.deaths}
          </span>
          {config.allowDash && (
            <span className="flex items-center gap-1.5">
              <Zap size={15} className={stats.dashReady ? 'text-[#10B981]' : 'text-slate-600'} />
              <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-slate-700">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#10B981] to-[#6366F1]"
                  animate={{ width: stats.dashReady ? '100%' : '15%' }}
                  transition={{ duration: stats.dashReady ? 0.3 : 0.05 }}
                  style={{ boxShadow: stats.dashReady ? '0 0 10px #10B981' : 'none' }}
                />
              </span>
            </span>
          )}
        </div>
        <div className={`flex gap-1.5 px-2 py-1.5 ${glassCard}`}>
          {ARTIFACT_ORDER.map((id) => {
            const on = hasArtifact(stats, id);
            return (
              <div
                key={id}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border ${on ? 'border-emerald-400/60 bg-emerald-500/20' : 'border-slate-700 bg-slate-800/40'}`}
                style={on ? { boxShadow: '0 0 10px rgba(16,185,129,.5)' } : undefined}
              >
                <ArtifactIcon id={id} size={14} className={on ? 'text-emerald-300' : 'text-slate-600'} />
              </div>
            );
          })}
        </div>
      </div>

      <div className={`absolute bottom-4 left-1/2 flex max-w-[94%] -translate-x-1/2 flex-wrap justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-[11px] text-slate-300 ${glassCard}`}>
        {hints.map((h) => (
          <span key={h.keys} className="flex items-center gap-1">
            <kbd className="rounded-md border border-indigo-400/40 bg-indigo-500/15 px-1.5 py-[1px] font-poppins text-[10px] text-indigo-200">{h.keys}</kbd>
            {h.action}
          </span>
        ))}
      </div>
    </div>
  );
}
