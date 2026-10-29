/** 1999 — painel cromado estilo Winamp com LCD e equalizador animado. */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { ARTIFACT_ORDER, ArtifactIcon, controlHints, hasArtifact, pad } from './shared';
import type { HudProps } from './shared';

const LIME = '#A6FF00';
const chrome = 'linear-gradient(180deg, #F4F6F8 0%, #B9C0C8 22%, #8A939D 50%, #C9CFD6 78%, #6E7680 100%)';
const lcdGlow = { color: LIME, textShadow: `0 0 4px ${LIME}` };

/** Barras do equalizador (mais lentas em bullet time). */
function Equalizer({ slow }: { slow: boolean }) {
  const bars = 14;
  return (
    <div className="flex h-[34px] items-end gap-[2px]">
      {Array.from({ length: bars }, (_, i) => {
        const base = 0.35 + ((i * 37) % 10) / 20;
        return (
          <motion.div
            key={i}
            className="w-[5px] origin-bottom"
            style={{ height: '100%', background: `linear-gradient(0deg, ${LIME} 0%, ${LIME} 60%, #FFE600 85%, #FF3B00 100%)`, boxShadow: `0 0 4px ${LIME}88` }}
            animate={{ scaleY: [0.15, base + 0.4, 0.3, base, 0.15] }}
            transition={{ duration: (0.6 + (i % 5) * 0.13) * (slow ? 2.8 : 1), repeat: Infinity, ease: 'easeInOut', delay: i * 0.04 }}
          />
        );
      })}
    </div>
  );
}

function ChromeButton({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[16px] w-[22px] items-center justify-center rounded-[2px] text-[#1b1f24]" style={{ background: chrome, border: '1px solid #3d434a', boxShadow: 'inset 0 1px #fff' }}>
      {children}
    </div>
  );
}

export default function WinampHud({ config, stats }: HudProps) {
  const hints = controlHints(config);
  const marquee = `*** ${config.year} ${config.name.toUpperCase()} — ${config.subtitle.toUpperCase()} — ${stats.sectorName.toUpperCase()} — ${hints
    .map((h) => `${h.keys} ${h.action}`)
    .join(' • ')
    .toUpperCase()} ***   `;
  const bt = stats.bulletTimeActive;

  return (
    <div className="absolute inset-0 font-terminal">
      <div className="absolute left-4 top-4 w-[300px] rounded-[4px] p-[3px]" style={{ background: chrome, border: '1px solid #2a2f35', boxShadow: '0 6px 18px rgba(0,0,0,.6)' }}>
        {/* Barra de título */}
        <div className="flex h-[14px] items-center gap-2 px-1">
          <div className="h-[6px] flex-1" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#5b636c 0 1px,transparent 1px 2px)' }} />
          <span className="text-[13px] font-bold leading-none tracking-[0.25em] text-[#20262c]">CHRONAMP</span>
          <div className="h-[6px] flex-1" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#5b636c 0 1px,transparent 1px 2px)' }} />
        </div>

        {/* Display LCD */}
        <div className="mt-[3px] flex gap-2 rounded-[2px] bg-black p-2" style={{ border: '1px solid #000', boxShadow: 'inset 0 0 8px rgba(166,255,0,.15)' }}>
          <div className="flex w-[92px] flex-col justify-between">
            <div className="flex items-center gap-1 text-[30px] leading-none" style={lcdGlow}>
              {bt ? <Pause size={12} fill={LIME} stroke={LIME} /> : <Play size={12} fill={LIME} stroke={LIME} />}
              <span className="tabular-nums">{pad(stats.coins, 2)}:{pad(stats.deaths, 2)}</span>
            </div>
            <div className="text-[12px] leading-none" style={{ color: '#5f8f00' }}>
              MOEDAS:MORTES
            </div>
            <Equalizer slow={bt} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden whitespace-nowrap text-[17px] leading-none" style={lcdGlow}>
              <motion.div className="inline-block" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}>
                {marquee}
                {marquee}
              </motion.div>
            </div>
            <div className="mt-2 flex gap-3 text-[13px] leading-none" style={{ color: '#5f8f00' }}>
              <span>
                <span style={lcdGlow}>{config.year}</span> kbps
              </span>
              <span>
                <span style={lcdGlow}>44</span> kHz
              </span>
              <span style={bt ? lcdGlow : undefined}>STEREO</span>
            </div>
            <motion.div
              className="mt-2 rounded-[2px] px-1 text-center text-[16px] leading-[18px]"
              style={bt ? { color: '#000', background: LIME, boxShadow: `0 0 12px ${LIME}` } : { color: '#3d5c00', border: '1px solid #3d5c00' }}
              animate={bt ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
              transition={{ duration: 0.8, repeat: bt ? Infinity : 0 }}
            >
              BULLET TIME {bt ? '▶ ATIVO' : '· SHIFT'}
            </motion.div>
          </div>
        </div>

        {/* Playlist de hardware + transporte */}
        <div className="mt-[3px] flex items-center gap-1 px-1 py-[3px]">
          <ChromeButton>
            <SkipBack size={10} fill="currentColor" />
          </ChromeButton>
          <ChromeButton>
            <Play size={10} fill="currentColor" />
          </ChromeButton>
          <ChromeButton>
            <Pause size={10} fill="currentColor" />
          </ChromeButton>
          <ChromeButton>
            <Square size={9} fill="currentColor" />
          </ChromeButton>
          <ChromeButton>
            <SkipForward size={10} fill="currentColor" />
          </ChromeButton>
          <div className="ml-auto flex gap-[3px] rounded-[2px] bg-black px-1 py-[2px]">
            {ARTIFACT_ORDER.map((id) => {
              const on = hasArtifact(stats, id);
              return (
                <span key={id} className="flex h-[16px] w-[16px] items-center justify-center" style={{ opacity: on ? 1 : 0.25 }}>
                  <ArtifactIcon id={id} size={12} style={{ color: LIME, filter: on ? `drop-shadow(0 0 3px ${LIME})` : undefined }} />
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
