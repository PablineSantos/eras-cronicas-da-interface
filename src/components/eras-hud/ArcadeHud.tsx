/** 1986 (arcade8) e 1991 (arcade16) — HUD de fliperama com 1UP / HIGH SCORE. */
import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact, pad } from './shared';
import type { HudProps } from './shared';

const HS_KEY = 'eras-high-score';

/** Recorde da sessão + localStorage (tolerante a falhas). */
function useHighScore(score: number): number {
  const best = useRef<number>(-1);
  if (best.current < 0) {
    let stored = 0;
    try {
      stored = Number(localStorage.getItem(HS_KEY)) || 0;
    } catch {
      /* armazenamento indisponível */
    }
    best.current = Math.max(stored, 20000);
  }
  if (score > best.current) {
    best.current = score;
    try {
      localStorage.setItem(HS_KEY, String(score));
    } catch {
      /* ignora */
    }
  }
  return best.current;
}

const pixelShadow: CSSProperties = { textShadow: '2px 2px 0 #000' };

/** Caixa azul 16-bits (gradiente + borda branca arredondada). */
function BlueBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[10px] border-[3px] border-white px-3 py-2 ${className}`}
      style={{ background: 'linear-gradient(180deg, #4060E8 0%, #2034A8 55%, #101C70 100%)', boxShadow: '0 0 0 2px #10104a, 0 4px 0 rgba(0,0,0,.35)' }}
    >
      {children}
    </div>
  );
}

export default function ArcadeHud({ config, stats }: HudProps) {
  const is16 = config.hudTheme === 'arcade16';
  const score = stats.coins * 100 + stats.artifacts.length * 5000;
  const hi = useHighScore(score);
  const hints = controlHints(config);

  const slots = (
    <div className="flex gap-1.5">
      {ARTIFACT_ORDER.map((id) => {
        const on = hasArtifact(stats, id);
        return (
          <div
            key={id}
            className="flex h-6 w-6 items-center justify-center"
            style={
              is16
                ? { borderRadius: 5, border: '2px solid #fff', background: on ? '#F8D030' : 'rgba(0,0,0,.35)' }
                : { border: '2px solid #fff', background: on ? '#E45C10' : '#000', boxShadow: '2px 2px 0 #000' }
            }
          >
            {on && <ArtifactIcon id={id} size={13} strokeWidth={2.5} style={{ color: is16 ? '#101C70' : '#FCBC3C' }} />}
          </div>
        );
      })}
    </div>
  );

  if (!is16) {
    // 8-bits: texto branco direto sobre o jogo
    return (
      <div className="absolute inset-0 font-pixel text-[11px] uppercase leading-none text-white" style={pixelShadow}>
        <div className="absolute left-0 right-0 top-4 grid grid-cols-4 gap-2 px-6">
          <div>
            <motion.div className="text-[#D82800]" animate={{ opacity: [1, 1, 0.2, 0.2] }} transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}>
              1UP
            </motion.div>
            <div className="mt-2">{pad(score, 6)}</div>
          </div>
          <div>
            <div className="text-[#FCBC3C]">HIGH SCORE</div>
            <div className="mt-2">{pad(hi, 6)}</div>
          </div>
          <div>
            <div>MOEDAS</div>
            <div className="mt-2 flex items-center gap-1">
              <span className="inline-block h-3 w-2 bg-[#FCBC3C]" style={{ boxShadow: '1px 1px 0 #000' }} />×{pad(stats.coins, 2)}
            </div>
          </div>
          <div className="text-right">
            <div>WORLD</div>
            <div className="mt-2">
              {config.year}-{stats.sector}
            </div>
          </div>
        </div>
        <div className="absolute left-6 top-[62px] flex items-center gap-3">
          {slots}
          <span className="text-[9px]">♥×{pad(stats.deaths, 2)} QUEDAS</span>
        </div>
        <div className="absolute bottom-4 left-6 right-6 text-center text-[8px] leading-relaxed">
          {hints.map((h) => `${h.keys} ${h.action}`).join('   ')}
        </div>
      </div>
    );
  }

  // 16-bits: caixas azuis
  return (
    <div className="absolute inset-0 font-pixel text-[10px] uppercase leading-none text-white" style={{ textShadow: '1px 1px 0 #000' }}>
      <div className="absolute left-4 right-4 top-4 flex flex-wrap items-start justify-between gap-3">
        <BlueBox>
          <div className="text-[#F8D030]">1UP</div>
          <div className="mt-2 text-[12px]">{pad(score, 7)}</div>
        </BlueBox>
        <BlueBox className="text-center">
          <div className="text-[#F8D030]">HIGH SCORE</div>
          <div className="mt-2 text-[12px]">{pad(hi, 7)}</div>
        </BlueBox>
        <BlueBox>
          <div className="flex items-center gap-4">
            <span>MOEDAS {pad(stats.coins, 3)}</span>
            <span>MORTES {pad(stats.deaths, 3)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {slots}
          </div>
        </BlueBox>
      </div>
      <div className="absolute left-4 top-[92px]">
        <BlueBox>
          <div className="text-[#58B858]">{config.year} · {config.name}</div>
          <div className="mt-1.5 text-[8px] normal-case">{stats.sectorName}</div>
        </BlueBox>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex justify-center">
        <BlueBox className="text-[8px] leading-relaxed">
          {hints.map((h) => `${h.keys} ${h.action}`).join('   ')}
        </BlueBox>
      </div>
    </div>
  );
}
