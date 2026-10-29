import Phaser from 'phaser';
import { EventBus } from '../../core/EventBus';
import { EraManager } from '../../core/EraManager';
import { EraConfig, ICommentWall, textureKey } from '../../core/types';

const DEPTH_ENTITY = 10;
const PASSABLE_ALPHA = 0.3;

/**
 * Parede de "comentário de código". Sólida em todas as eras, exceto quando
 * config.passThroughCodeComments (1977 — Terminal ASCII): fica fantasma e atravessável.
 * x,y = canto superior esquerdo.
 */
export class CommentWall implements ICommentWall {
  private readonly scene: Phaser.Scene;
  private readonly tile: Phaser.GameObjects.TileSprite;
  private readonly text: Phaser.GameObjects.Text;
  private readonly label: string;
  private readonly width: number;
  private readonly height: number;
  private passable = false;
  private flicker: Phaser.Tweens.Tween | null = null;
  private unsubscribeEra: (() => void) | null = null;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    label = '// PAREDE DE CÓDIGO',
  ) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.label = label;

    const cfg = EraManager.getCurrentConfig();
    const key = textureKey('commentWall', cfg.id);
    this.tile = scene.add.tileSprite(x, y, width, height, scene.textures.exists(key) ? key : '__MISSING');
    this.tile.setOrigin(0, 0).setDepth(DEPTH_ENTITY);
    // Corpo estático cobrindo exatamente o retângulo
    scene.physics.add.existing(this.tile, true);

    // Texto: vertical se a parede for alta e estreita
    const vertical = height > width * 1.5;
    const span = vertical ? height : width;
    const fontSize = Math.max(8, Math.min(16, Math.floor((span - 12) / (label.length * 0.62))));
    this.text = scene.add.text(x + width / 2, y + height / 2, label, {
      fontFamily: cfg.fontFamily,
      fontSize: `${fontSize}px`,
      color: cfg.palette.foreground,
    });
    this.text.setOrigin(0.5, 0.5).setDepth(DEPTH_ENTITY + 0.1);
    if (vertical) this.text.setAngle(90);

    this.applyEra(cfg);
    this.unsubscribeEra = EventBus.on('ERA_CHANGED', ({ config }) => this.applyEra(config));
    // Limpeza automática se a cena for encerrada sem destroy() explícito
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  getCollider(): Phaser.GameObjects.GameObject {
    return this.tile;
  }

  isPassable(): boolean {
    return this.passable;
  }

  applyEra(config: EraConfig): void {
    if (this.destroyed) return;
    const key = textureKey('commentWall', config.id);
    if (this.scene.textures.exists(key) && this.tile.texture.key !== key) this.tile.setTexture(key);

    this.text.setFontFamily(config.fontFamily);
    this.text.setColor(config.palette.foreground);
    this.text.setStroke(config.palette.background, 3);
    this.text.setText(this.label);

    const passable = config.passThroughCodeComments;
    this.passable = passable;
    const body = this.tile.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = !passable;

    this.stopFlicker();
    if (passable) {
      this.tile.setAlpha(PASSABLE_ALPHA);
      this.text.setAlpha(PASSABLE_ALPHA + 0.2);
      // Tremeluzir sutil (terminal com sinal fraco)
      this.flicker = this.scene.tweens.add({
        targets: [this.tile, this.text],
        alpha: { from: PASSABLE_ALPHA, to: PASSABLE_ALPHA * 0.55 },
        duration: 90,
        yoyo: true,
        repeat: -1,
        repeatDelay: 420,
        ease: 'Stepped',
      });
    } else {
      this.tile.setAlpha(1);
      this.text.setAlpha(0.9);
    }
  }

  /** Dimensões do retângulo (útil para a cena). */
  getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.tile.x, this.tile.y, this.width, this.height);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.unsubscribeEra?.();
    this.unsubscribeEra = null;
    this.stopFlicker();
    this.text.destroy();
    this.tile.destroy();
  }

  private stopFlicker(): void {
    if (this.flicker) {
      try {
        this.flicker.stop();
        this.flicker.remove();
      } catch {
        // gerenciador de tweens já encerrado
      }
      this.flicker = null;
    }
  }
}
