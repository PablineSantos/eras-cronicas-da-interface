import Phaser from 'phaser';
import { ERA_CONFIGS, EraManager } from '../core/EraManager';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/types';
import { MainLevelScene } from './scenes/MainLevelScene';

/**
 * Cria a instância Phaser dentro de `parent`.
 * A cena cancela todas as suas inscrições do EventBus em SHUTDOWN/DESTROY,
 * então `destroyPhaserGame` é seguro sob StrictMode (monta/desmonta/monta).
 */
export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    transparent: false,
    backgroundColor: ERA_CONFIGS[EraManager.getCurrentEra()].palette.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: ERA_CONFIGS[EraManager.getCurrentEra()].gravity },
        debug: false,
      },
    },
    render: { antialias: true, roundPixels: true },
    fps: { target: 60 },
    scene: [MainLevelScene],
  };
  return new Phaser.Game(config);
}

/** Destrói o jogo e remove o canvas (a cena limpa o EventBus no DESTROY). */
export function destroyPhaserGame(game: Phaser.Game): void {
  game.destroy(true);
}
