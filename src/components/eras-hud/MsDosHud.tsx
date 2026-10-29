/** 1977 — terminal MS-DOS. */
import { motion } from 'framer-motion';
import { ARTIFACT_ORDER, controlHints, hasArtifact, pad } from './shared';
import type { HudProps } from './shared';

const GREEN = '#33FF00';
const GRAY = '#AAAAAA';

function Cursor() {
  return (
    <motion.span
      className="inline-block h-[0.9em] w-[0.55em] translate-y-[2px] align-baseline"
      style={{ background: GREEN }}
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
    />
  );
}

export default function MsDosHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  const slots = ARTIFACT_ORDER.map((id) => (hasArtifact(stats, id) ? '■' : '·')).join('');
  return (
    <div className="absolute inset-0 font-terminal text-[20px] leading-none" style={{ color: GREEN, textShadow: '0 0 4px rgba(51,255,0,.6)' }}>
      {/* Bloco superior */}
      <div className="absolute left-3 right-3 top-3 border-[3px] border-double bg-black/85 px-3 py-2" style={{ borderColor: GRAY }}>
        <div>
          <span style={{ color: GRAY }}>C:\ERAS&gt;</span> CHRONO.EXE /ERA:{config.year} <Cursor />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1" style={{ color: GRAY }}>
          <span>
            ERA=<span style={{ color: GREEN }}>{config.year} {config.name.toUpperCase()}</span>
          </span>
          <span>
            SETOR=<span style={{ color: GREEN }}>{stats.sectorName.toUpperCase()}</span>
          </span>
          <span>
            MOEDAS=<span style={{ color: GREEN }}>{pad(stats.coins, 4)}</span>
          </span>
          <span>
            MORTES=<span style={{ color: GREEN }}>{pad(stats.deaths, 4)}</span>
          </span>
          <span>
            HARDWARE=[<span style={{ color: GREEN }}>{slots}</span>] {stats.artifacts.length}/6
          </span>
        </div>
      </div>

      {/* Linha de ajuda */}
      <div className="absolute bottom-3 left-3 right-3 bg-black/85 px-3 py-1 text-[18px]" style={{ color: GRAY }}>
        <span style={{ color: GREEN }}>HELP&gt;</span>{' '}
        {hints.map((h) => `${h.keys.toUpperCase()}=${h.action.toUpperCase()}`).join('  ')}
      </div>
    </div>
  );
}
