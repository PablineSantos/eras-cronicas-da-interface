/**
 * Overlay React sobre o canvas Phaser: HUD temático da era, janelas
 * interativas, toasts e telas de título/vitória. Raiz pointer-events-none.
 */
import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HudTheme } from '../core/types';
import { useEraConfig, useGameState, usePlayerStats, useUnlockedEras } from './eras-hud/hooks';
import type { HudProps } from './eras-hud/shared';
import OscilloscopeHud from './eras-hud/OscilloscopeHud';
import MsDosHud from './eras-hud/MsDosHud';
import MacintoshHud from './eras-hud/MacintoshHud';
import ArcadeHud from './eras-hud/ArcadeHud';
import Win95Hud from './eras-hud/Win95Hud';
import WinampHud from './eras-hud/WinampHud';
import AeroHud from './eras-hud/AeroHud';
import FlatHud from './eras-hud/FlatHud';
import NeonHud from './eras-hud/NeonHud';
import { WindowLayer } from './eras-hud/WindowLayer';
import { ArtifactToasts } from './eras-hud/ArtifactToasts';
import TitleScreen from './eras-hud/TitleScreen';
import VictoryScreen from './eras-hud/VictoryScreen';
import PauseScreen, { togglePause } from './eras-hud/PauseScreen';

const HUDS: Record<HudTheme, ComponentType<HudProps>> = {
  oscilloscope: OscilloscopeHud,
  msdos: MsDosHud,
  macintosh: MacintoshHud,
  arcade8: ArcadeHud,
  arcade16: ArcadeHud,
  win95: Win95Hud,
  winamp: WinampHud,
  aero: AeroHud,
  flat: FlatHud,
  neon: NeonHud,
};

export function HUDContainer() {
  const config = useEraConfig();
  const stats = usePlayerStats();
  const unlocked = useUnlockedEras();
  const gameState = useGameState();
  const Hud = HUDS[config.hudTheme];

  // Esc / P pausam; na pausa, Esc é tratado pela própria PauseScreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'Escape' && gameState === 'playing') || e.code === 'KeyP') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]);

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* Janelas (camada recortada ao canvas, abaixo da moldura) */}
      <div className="absolute inset-0 z-10">
        <WindowLayer gameState={gameState} />
      </div>

      {/* HUD temático — só opacidade (sem transform) na transição */}
      <div className="absolute inset-0 z-20">
        <AnimatePresence>
          {(gameState === 'playing' || gameState === 'paused') && (
            <motion.div
              key={config.hudTheme}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Hud config={config} stats={stats} unlocked={unlocked} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 z-30">
        <ArtifactToasts />
      </div>

      <AnimatePresence>
        {gameState === 'title' && <TitleScreen key="title" />}
        {gameState === 'paused' && <PauseScreen key="paused" config={config} />}
        {gameState === 'victory' && <VictoryScreen key="victory" stats={stats} />}
      </AnimatePresence>
    </div>
  );
}

export default HUDContainer;
