/** 2005 — botões Frutiger Aero com reflexo de vidro molhado. */
import type { CSSProperties, ReactNode } from 'react';
import { Coins, MapPin, Skull } from 'lucide-react';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact } from './shared';
import type { HudProps } from './shared';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

const GLOSS: Record<'cyan' | 'green' | 'orange' | 'glass', string> = {
  cyan: 'linear-gradient(180deg, #8FE6FF 0%, #2FB4EE 48%, #0A86CC 52%, #3CC4F2 100%)',
  green: 'linear-gradient(180deg, #C8FF8A 0%, #7ED321 48%, #4E9E0A 52%, #8EE03A 100%)',
  orange: 'linear-gradient(180deg, #FFD08A 0%, #FF9A1F 48%, #E06D00 52%, #FFB040 100%)',
  glass: 'linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(190,235,255,.35) 48%, rgba(120,200,240,.25) 52%, rgba(200,240,255,.4) 100%)',
};

/** Pílula glossy com highlight branco na metade superior. */
function Glossy({ tone, children, className = '', style }: { tone: keyof typeof GLOSS; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`relative overflow-hidden rounded-full border border-white/80 ${className}`}
      style={{ background: GLOSS[tone], boxShadow: '0 3px 8px rgba(0,60,120,.35), inset 0 -2px 4px rgba(0,0,0,.15)', ...style }}
    >
      <div className="pointer-events-none absolute inset-x-[6%] top-[2px] h-[46%] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.15))' }} />
      <div className="relative">{children}</div>
    </div>
  );
}

export default function AeroHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  const pill = 'flex items-center gap-1.5 px-4 py-1.5 text-[14px] font-bold text-white';
  const txt: CSSProperties = { textShadow: '0 1px 2px rgba(0,40,80,.6)' };
  return (
    <div className="absolute inset-0" style={{ fontFamily: FONT }}>
      <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-2">
        <Glossy tone="cyan" className="px-5 py-1.5 text-white">
          <div className="flex items-baseline gap-2" style={txt}>
            <span className="text-[20px] font-bold">{config.year}</span>
            <span className="text-[14px]">{config.name}</span>
          </div>
        </Glossy>
        <Glossy tone="glass" className={`${pill} !text-[#06345C]`}>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} /> {stats.sectorName}
          </span>
        </Glossy>
        <div className="ml-auto flex gap-2">
          <Glossy tone="green" className={pill}>
            <span className="flex items-center gap-1.5" style={txt}>
              <Coins size={15} /> {stats.coins}
            </span>
          </Glossy>
          <Glossy tone="orange" className={pill}>
            <span className="flex items-center gap-1.5" style={txt}>
              <Skull size={15} /> {stats.deaths}
            </span>
          </Glossy>
        </div>
      </div>

      {/* Artefatos em bolhas de vidro */}
      <div className="absolute right-4 top-[62px] flex gap-1.5">
        {ARTIFACT_ORDER.map((id) => {
          const on = hasArtifact(stats, id);
          return (
            <Glossy key={id} tone={on ? 'cyan' : 'glass'} className="flex h-8 w-8 items-center justify-center" style={{ opacity: on ? 1 : 0.7 }}>
              <div className="flex h-8 w-8 items-center justify-center">
                <ArtifactIcon id={id} size={15} style={{ color: on ? '#fff' : 'rgba(6,52,92,.35)' }} />
              </div>
            </Glossy>
          );
        })}
      </div>

      {/* Barra de dicas de vidro */}
      <div className="absolute bottom-4 left-1/2 flex max-w-[92%] -translate-x-1/2 flex-wrap justify-center gap-x-3 gap-y-1 rounded-2xl border border-white/70 px-4 py-1.5 text-[12px] text-[#06345C]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.7), rgba(200,240,255,.45))', boxShadow: '0 4px 14px rgba(0,80,140,.25)' }}>
        {hints.map((h) => (
          <span key={h.keys}>
            <b className="text-[#0A86CC]">{h.keys}</b> {h.action}
          </span>
        ))}
      </div>
    </div>
  );
}
