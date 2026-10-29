/** 2013 — Flat Design ultra-minimalista (Poppins, cores sólidas). */
import type { ReactNode } from 'react';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact } from './shared';
import type { HudProps } from './shared';

/** Long-shadow opcional (diagonal, sutil). */
const longShadow = (c: string) =>
  Array.from({ length: 8 }, (_, i) => `${i + 1}px ${i + 1}px 0 ${c}`).join(', ');

function Tile({ color, label, children }: { color: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[72px] flex-col px-3 py-2 text-white" style={{ background: color }}>
      <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-80">{label}</span>
      <span className="text-[20px] font-semibold leading-tight" style={{ textShadow: longShadow('rgba(0,0,0,.12)') }}>
        {children}
      </span>
    </div>
  );
}

export default function FlatHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  return (
    <div className="absolute inset-0 font-poppins">
      <div className="absolute left-4 top-4 flex flex-wrap gap-0">
        <div className="flex flex-col bg-[#1ABC9C] px-4 py-2 text-white">
          <span className="text-[26px] font-semibold leading-none" style={{ textShadow: longShadow('rgba(0,0,0,.12)') }}>
            {config.year}
          </span>
          <span className="text-[11px] font-light uppercase tracking-[0.25em]">{config.name}</span>
        </div>
        <Tile color="#34495E" label="Setor">
          <span className="text-[14px]">{stats.sectorName}</span>
        </Tile>
      </div>

      <div className="absolute right-4 top-4 flex">
        <Tile color="#3498DB" label="Moedas">{stats.coins}</Tile>
        <Tile color="#E74C3C" label="Mortes">{stats.deaths}</Tile>
        <Tile color={stats.dashReady ? '#F1C40F' : '#95A5A6'} label="Dash">
          <span className="text-[14px]">{stats.dashReady ? 'PRONTO' : '···'}</span>
        </Tile>
      </div>

      <div className="absolute right-4 top-[76px] flex gap-1.5">
        {ARTIFACT_ORDER.map((id) => {
          const on = hasArtifact(stats, id);
          return (
            <div key={id} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: on ? '#9B59B6' : '#BDC3C7' }}>
              <ArtifactIcon id={id} size={14} style={{ color: '#fff', opacity: on ? 1 : 0.6 }} />
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.15em] text-[#2C3E50]">
        {hints.map((h) => (
          <span key={h.keys}>
            <span className="font-semibold text-[#1ABC9C]">{h.keys}</span> <span className="font-light">{h.action}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
