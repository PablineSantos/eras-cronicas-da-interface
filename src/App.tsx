import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { EraManager } from './core/EraManager';
import { SoundSynthesizer } from './core/SoundSynthesizer';
import { GAME_CONTAINER_ID } from './core/types';
import { createPhaserGame, destroyPhaserGame } from './game/PhaserGame';
import HUDContainer from './components/HUDContainer';
import TimelineSelector from './components/TimelineSelector';

/** Monta o canvas Phaser uma única vez (seguro sob StrictMode). */
function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    // Texturas ASCII/pixel dependem de VT323 e Press Start 2P já carregadas.
    void document.fonts.ready.then(() => {
      if (cancelled || !containerRef.current) return;
      game = createPhaserGame(containerRef.current);
      // Gancho de depuração/testes E2E (apenas em dev).
      if (import.meta.env.DEV) (window as unknown as { __ERAS_GAME__?: Phaser.Game }).__ERAS_GAME__ = game;
    });
    return () => {
      cancelled = true;
      if (game) destroyPhaserGame(game);
    };
  }, []);

  return <div id={GAME_CONTAINER_ID} ref={containerRef} className="absolute inset-0" />;
}

export default function App() {
  useEffect(() => {
    SoundSynthesizer.init();
    const unbindKeys = EraManager.bindKeyboard();
    EraManager.broadcastInitial();

    // AudioContext só pode iniciar após um gesto do usuário.
    const unlockAudio = () => void SoundSynthesizer.resume();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      unbindKeys();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-black overflow-hidden">
      <div className="relative flex-1 min-h-0">
        <PhaserGame />
        <HUDContainer />
      </div>
      <TimelineSelector />
    </div>
  );
}
