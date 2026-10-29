/** 1995 — barra de tarefas inferior do Windows 95. */
import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Monitor, Skull } from 'lucide-react';
import { EventBus } from '../../core/EventBus';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact } from './shared';
import type { HudProps } from './shared';
import { useClock } from './hooks';
import { win95Raised, win95Sunken } from './windowSkins';

const FONT = '"MS Sans Serif", Tahoma, "Segoe UI", sans-serif';

/** Logo de 4 quadrados coloridos. */
function WinLogo({ size = 14 }: { size?: number }) {
  const q = size / 2 - 1;
  return (
    <span className="grid shrink-0 gap-[2px]" style={{ gridTemplateColumns: `${q}px ${q}px`, transform: 'skewY(-6deg)' }}>
      <span style={{ width: q, height: q, background: '#FF2A00' }} />
      <span style={{ width: q, height: q, background: '#00B400' }} />
      <span style={{ width: q, height: q, background: '#0050FF' }} />
      <span style={{ width: q, height: q, background: '#FFD800' }} />
    </span>
  );
}

const noFocus = (e: ReactPointerEvent) => e.preventDefault();

export default function Win95Hud({ config, stats }: HudProps) {
  const clock = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const hints = controlHints(config);

  // Fecha o menu ao clicar fora / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const taskBtn = 'flex h-[22px] min-w-0 items-center gap-1.5 px-2 text-[11px] text-black';

  return (
    <div className="absolute inset-0" style={{ fontFamily: FONT }}>
      {/* Tooltip amarelo com controles */}
      <div className="absolute bottom-[40px] right-2 max-w-[60%] border border-black bg-[#FFFFE1] px-2 py-1 text-[11px] leading-snug text-black" style={{ boxShadow: '2px 2px 0 rgba(0,0,0,.4)' }}>
        <b>Dica:</b> {hints.map((h) => `${h.keys} = ${h.action}`).join(' · ')}
      </div>

      {/* Menu Iniciar */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="pointer-events-auto absolute bottom-[30px] left-[2px] flex w-[230px] p-[2px]"
            style={win95Raised}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.12 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex w-[24px] items-end justify-center pb-2" style={{ background: 'linear-gradient(0deg,#000080,#1084D0)' }}>
              <span className="whitespace-nowrap text-[15px] font-bold text-white" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                Eras<span className="font-normal">95</span>
              </span>
            </div>
            <ul className="flex-1 py-1 text-[11px] text-black">
              {hints.map((h) => (
                <li key={h.keys} className="flex justify-between gap-2 px-2 py-[3px] hover:bg-[#000080] hover:text-white">
                  <span>{h.action}</span>
                  <span className="opacity-70">{h.keys}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de tarefas */}
      <div className="absolute bottom-0 left-0 right-0 flex h-[30px] items-center gap-1 px-[2px]" style={{ background: '#C0C0C0', borderTop: '1px solid #DFDFDF', boxShadow: 'inset 0 1px #FFFFFF' }}>
        <button
          type="button"
          tabIndex={-1}
          onPointerDown={(e) => {
            noFocus(e);
            e.stopPropagation();
          }}
          onClick={() => {
            EventBus.emit('PLAY_SFX', { sound: 'click' });
            setMenuOpen((o) => !o);
          }}
          className="pointer-events-auto flex h-[22px] shrink-0 items-center gap-1 px-1.5 text-[11px] font-bold text-black"
          style={menuOpen ? { ...win95Sunken, background: '#C0C0C0' } : win95Raised}
        >
          <WinLogo />
          Iniciar
        </button>
        <div className="mx-0.5 h-[22px] w-[2px] border-l border-[#808080] border-r-white" style={{ borderRightWidth: 1 }} />

        <div className={`${taskBtn} max-w-[220px] font-bold`} style={{ ...win95Sunken, background: 'repeating-conic-gradient(#C0C0C0 0 25%, #fff 0 50%) 0 0/2px 2px' }}>
          <Monitor size={13} className="shrink-0" />
          <span className="truncate">
            Eras {config.year} - {stats.sectorName}
          </span>
        </div>
        <div className={taskBtn} style={win95Raised}>
          <Coins size={13} className="shrink-0 text-[#B08000]" />
          <span>Moedas: {stats.coins}</span>
        </div>
        <div className={`${taskBtn} hidden sm:flex`} style={win95Raised}>
          <Skull size={13} className="shrink-0" />
          <span>Mortes: {stats.deaths}</span>
        </div>

        {/* Bandeja */}
        <div className="ml-auto flex h-[22px] items-center gap-1 px-2 text-[11px] text-black" style={win95Sunken}>
          {ARTIFACT_ORDER.map((id) => (
            <span key={id} title={id} style={{ opacity: hasArtifact(stats, id) ? 1 : 0.25 }}>
              <ArtifactIcon id={id} size={12} />
            </span>
          ))}
          <span className="ml-2 tabular-nums">{clock}</span>
        </div>
      </div>
    </div>
  );
}
