/** Toasts de "Artefato coletado" (ARTIFACT_COLLECTED) e "Era bloqueada" (ERA_LOCKED). */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Unlock } from 'lucide-react';
import { EventBus } from '../../core/EventBus';
import { ARTIFACTS, ERA_CONFIGS } from '../../core/EraManager';
import type { ArtifactId, EraId } from '../../core/types';
import { ArtifactIcon } from './shared';

type Toast =
  | { key: number; kind: 'artifact'; artifact: ArtifactId; unlocks: EraId[] }
  | { key: number; kind: 'locked'; era: EraId; artifact: ArtifactId | null };

const TOAST_MS = 3600;

export function ArtifactToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const timers = new Set<number>();
    const push = (toast: Toast, ms: number) => {
      // Um aviso de bloqueio por vez (evita empilhar ao apertar a tecla repetidamente).
      setToasts((t) => [...t.filter((x) => x.kind !== 'locked' || toast.kind !== 'locked').slice(-2), toast]);
      const id = window.setTimeout(() => {
        timers.delete(id);
        setToasts((t) => t.filter((x) => x.key !== toast.key));
      }, ms);
      timers.add(id);
    };
    const offArtifact = EventBus.on('ARTIFACT_COLLECTED', ({ artifact, unlocks }) =>
      push({ key: ++seq.current, kind: 'artifact', artifact, unlocks }, TOAST_MS),
    );
    const offLocked = EventBus.on('ERA_LOCKED', ({ era, artifact }) =>
      push({ key: ++seq.current, kind: 'locked', era, artifact }, 2400),
    );
    return () => {
      offArtifact();
      offLocked();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <div className="pointer-events-none absolute left-1/2 top-[18%] z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          if (t.kind === 'locked') {
            return (
              <motion.div
                key={t.key}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.22 }}
                className="flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-slate-900/80 px-4 py-2.5 font-poppins text-slate-100 backdrop-blur-md"
                style={{ boxShadow: '0 0 30px rgba(244,63,94,.2), 0 10px 30px rgba(0,0,0,.4)' }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
                  <Lock size={20} />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">
                    {ERA_CONFIGS[t.era].year} ainda está bloqueada
                  </div>
                  {t.artifact && (
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Encontre o artefato <span className="text-rose-200">{ARTIFACTS[t.artifact].name}</span> para liberar
                    </div>
                  )}
                </div>
              </motion.div>
            );
          }
          const years = t.unlocks.map((e) => ERA_CONFIGS[e].year).join(', ');
          return (
            <motion.div
              key={t.key}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.22 }}
              className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-slate-900/75 px-4 py-2.5 font-poppins text-slate-100 backdrop-blur-md"
              style={{ boxShadow: '0 0 30px rgba(16,185,129,.25), 0 10px 30px rgba(0,0,0,.4)' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#6366F1]">
                <ArtifactIcon id={t.artifact} size={20} className="text-white" />
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold">
                  Artefato coletado: <span className="text-emerald-300">{ARTIFACTS[t.artifact].name}</span>
                </div>
                {years && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                    <Unlock size={11} className="text-indigo-300" /> desbloqueia {years}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ArtifactToasts;
