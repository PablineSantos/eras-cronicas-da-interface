/** 1984 — barra de menu do Macintosh, 1-bit. */
import { Apple } from 'lucide-react';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact } from './shared';
import type { HudProps } from './shared';

/** Cantos arredondados pretos do monitor original. */
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const map = {
    tl: 'left-0 top-0',
    tr: 'right-0 top-0 rotate-90',
    bl: 'left-0 bottom-0 -rotate-90',
    br: 'right-0 bottom-0 rotate-180',
  } as const;
  return (
    <div className={`absolute h-3 w-3 ${map[pos]}`} style={{ background: 'radial-gradient(circle at 100% 100%, transparent 11px, #000 12px)' }} />
  );
}

export default function MacintoshHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  return (
    <div className="absolute inset-0 font-terminal text-black">
      {/* Barra de menu */}
      <div className="absolute left-0 right-0 top-0 flex h-[26px] items-center gap-5 border-b-2 border-black bg-white px-4 text-[20px] leading-none">
        <Apple size={16} strokeWidth={2.5} fill="#000" />
        {['File', 'Edit', 'View', 'Special'].map((m) => (
          <span key={m} className="font-bold">
            {m}
          </span>
        ))}
        <span className="ml-auto truncate">
          {config.year} · {config.name}
        </span>
      </div>
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {/* Janela de status */}
      <div className="absolute right-4 top-[38px] w-[220px] border-2 border-black bg-white" style={{ boxShadow: '4px 4px 0 #000' }}>
        <div className="relative flex h-[18px] items-center border-b-2 border-black" style={{ backgroundImage: 'repeating-linear-gradient(#000 0 1px, #fff 1px 3px)', backgroundClip: 'content-box', padding: '3px 2px' }}>
          <span className="mx-auto bg-white px-2 text-[16px] leading-none">Status</span>
        </div>
        <div className="space-y-0.5 px-2 py-1 text-[18px] leading-tight">
          <div className="flex justify-between">
            <span>Setor</span>
            <span className="truncate pl-2">{stats.sectorName}</span>
          </div>
          <div className="flex justify-between">
            <span>Moedas</span>
            <span>{stats.coins}</span>
          </div>
          <div className="flex justify-between">
            <span>Mortes</span>
            <span>{stats.deaths}</span>
          </div>
          <div className="flex gap-1 pt-1">
            {ARTIFACT_ORDER.map((id) => {
              const on = hasArtifact(stats, id);
              return (
                <div key={id} className={`flex h-[26px] w-[26px] items-center justify-center border-2 border-black ${on ? 'bg-black text-white' : 'bg-white'}`} style={on ? undefined : { backgroundImage: 'radial-gradient(#000 0.6px, transparent 0.7px)', backgroundSize: '3px 3px' }}>
                  {on && <ArtifactIcon id={id} size={15} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dica de controles */}
      <div className="absolute bottom-4 left-4 max-w-[75%] border-2 border-black bg-white px-2 py-1 text-[17px] leading-tight" style={{ boxShadow: '3px 3px 0 #000' }}>
        {hints.map((h) => `${h.keys}: ${h.action}`).join('  •  ')}
      </div>
    </div>
  );
}
