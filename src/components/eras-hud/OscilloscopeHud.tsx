/** 1958 — moldura de osciloscópio de laboratório. */
import { motion } from 'framer-motion';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact, pad } from './shared';
import type { HudProps } from './shared';

const G = '#00FF66';
const glow = { color: G, textShadow: `0 0 6px ${G}, 0 0 14px rgba(0,255,102,.45)` };

/** Onda senoidal em loop (período de 40px, deslocada continuamente). */
function SineWave({ width = 160, height = 44 }: { width?: number; height?: number }) {
  const period = 40;
  let d = '';
  for (let x = 0; x <= width + period; x += 2) {
    const y = height / 2 + Math.sin((x / period) * Math.PI * 2) * (height * 0.35);
    d += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)} `;
  }
  return (
    <svg width={width} height={height} className="overflow-hidden" style={{ filter: `drop-shadow(0 0 3px ${G})` }}>
      {/* Graticule */}
      {Array.from({ length: Math.floor(width / 20) + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={height} stroke={G} strokeOpacity={0.15} />
      ))}
      {Array.from({ length: Math.floor(height / 11) + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 11} x2={width} y2={i * 11} stroke={G} strokeOpacity={0.15} />
      ))}
      <motion.path
        d={d}
        fill="none"
        stroke={G}
        strokeWidth={1.6}
        animate={{ x: [0, -period] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  );
}

function Knob({ label, speed }: { label: string; speed: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className="relative h-9 w-9 rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 30%, #6b6f66, #2a2c27 60%, #121310)', boxShadow: '0 2px 4px rgba(0,0,0,.8), inset 0 1px 1px rgba(255,255,255,.25)' }}
        animate={{ rotate: [-40, 40, -40] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="absolute left-1/2 top-[3px] h-3 w-[2px] -translate-x-1/2 rounded bg-[#d8d8c8]" />
      </motion.div>
      <span className="font-terminal text-[11px] uppercase tracking-widest text-[#9a9d8f]">{label}</span>
    </div>
  );
}

export default function OscilloscopeHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  return (
    <div className="absolute inset-0 font-terminal">
      {/* Bezel arredondado */}
      <div
        className="absolute inset-0 rounded-[34px]"
        style={{ border: '12px solid #2b2d28', boxShadow: 'inset 0 0 0 2px #0b0c0a, inset 0 0 40px rgba(0,255,102,.18), 0 0 0 2px #45483f' }}
      />
      {/* Graticule leve sobre a tela */}
      <div
        className="absolute inset-[12px] rounded-[24px] opacity-[0.07]"
        style={{ backgroundImage: `linear-gradient(${G} 1px, transparent 1px), linear-gradient(90deg, ${G} 1px, transparent 1px)`, backgroundSize: '48px 48px' }}
      />

      {/* Painel superior esquerdo */}
      <div className="absolute left-6 top-6 rounded-md border border-[#00FF66]/40 bg-[#021008]/85 px-3 py-2" style={{ boxShadow: 'inset 0 0 18px rgba(0,255,102,.15)' }}>
        <div className="flex items-baseline gap-2 text-[26px] leading-none" style={glow}>
          <span>{config.year}</span>
          <span className="text-[18px] opacity-80">{config.name.toUpperCase()}</span>
        </div>
        <div className="mt-1 text-[15px] leading-none" style={{ color: '#7dffb0' }}>
          {config.subtitle} · {stats.sectorName}
        </div>
        <div className="mt-2">
          <SineWave />
        </div>
      </div>

      {/* Leituras de canal */}
      <div className="absolute right-6 top-6 rounded-md border border-[#00FF66]/40 bg-[#021008]/85 px-3 py-2 text-[18px] leading-tight" style={glow}>
        <div>CH1 MOEDAS ▸ {pad(stats.coins, 3)}</div>
        <div>CH2 MORTES ▸ {pad(stats.deaths, 3)}</div>
        <div className="mt-1 flex gap-1.5">
          {ARTIFACT_ORDER.map((id) => {
            const on = hasArtifact(stats, id);
            return (
              <div
                key={id}
                className="flex h-6 w-6 items-center justify-center rounded-full border"
                style={{ borderColor: on ? G : 'rgba(0,255,102,.3)', boxShadow: on ? `0 0 8px ${G}` : 'none' }}
              >
                {on && <ArtifactIcon id={id} size={13} style={{ color: G }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Knobs e dica de controles */}
      <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
        <div className="max-w-[70%] rounded-md bg-[#021008]/80 px-3 py-1 text-[15px] leading-snug" style={{ color: '#7dffb0' }}>
          {hints.map((h) => `${h.keys} ${h.action}`).join('   ·   ')}
        </div>
        <div className="hidden gap-3 rounded-xl bg-[#1d1f1b]/90 px-3 py-2 sm:flex">
          <Knob label="Volts" speed={5} />
          <Knob label="Time" speed={7} />
          <Knob label="Focus" speed={9} />
        </div>
      </div>
    </div>
  );
}
