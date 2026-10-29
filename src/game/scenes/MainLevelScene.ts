import Phaser from 'phaser';
import { EventBus, type EventMap, type EventName } from '../../core/EventBus';
import { ARTIFACTS, ERA_CONFIGS, EraManager } from '../../core/EraManager';
import {
  ArtifactId,
  artifactTextureKey,
  BULLET_TIME_SCALE,
  EraConfig,
  EraId,
  ERA_HOTKEYS,
  GameState,
  InteractiveWindowRect,
  MAIN_SCENE_KEY,
  PlayerStats,
  textureKey,
  WINDOW_DEFS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../../core/types';
import { EraVisualRenderer } from '../pipelines/EraVisualRenderer';
import { Player } from '../entities/Player';
import { CommentWall } from '../entities/CommentWall';
import {
  ARTIFACT_PLACEMENTS,
  BOUNCY,
  CHECKPOINTS,
  COINS,
  CORE_POS,
  FIREWALL,
  HAZARDS,
  LASERS,
  LaserDef,
  PLATFORMS,
  PointDef,
  Rect,
  sectorAt,
  SIGNS,
  SPAWN,
} from '../level/LevelLayout';

// Convenção de depth
const DEPTH_LEVEL = 0;
const DEPTH_ENTITY = 10;
const DEPTH_PLAYER = 20;
const DEPTH_OVERLAY = 50;

const STATS_INTERVAL_MS = 100;
const DEATH_COOLDOWN_MS = 600;
const BOUNCE_VELOCITY = -900;

interface Pickup {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  taken: boolean;
}
interface ArtifactPickup extends Pickup {
  id: ArtifactId;
}
interface CheckpointObj {
  sprite: Phaser.GameObjects.Image;
  point: PointDef;
  active: boolean;
}
interface LaserObj {
  def: LaserDef;
  beam: Phaser.GameObjects.TileSprite;
  on: boolean;
}
interface HazardObj {
  sprite: Phaser.GameObjects.TileSprite;
  hit: Rect;
}
interface WindowCollider {
  zone: Phaser.GameObjects.Zone;
  rect: InteractiveWindowRect;
}

/** Ano + tecla de uma era, ex.: "1977 [2]". */
function eraLabel(era: EraId): string {
  const key = Object.keys(ERA_HOTKEYS).find((k) => ERA_HOTKEYS[k] === era) ?? '?';
  return `${ERA_CONFIGS[era].year} [${key}]`;
}

function hexToNumber(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class MainLevelScene extends Phaser.Scene {
  // Obs.: `renderer` é propriedade reservada de Phaser.Scene → usamos `eraRenderer`.
  private eraRenderer!: EraVisualRenderer;
  private player!: Player;
  private firewall!: CommentWall;

  private era: EraId = EraId.VECTOR_1958;
  private state: GameState = 'title';
  private needsRestart = false;
  private cleanedUp = false;
  private unsubs: Array<() => void> = [];

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private platformSprites: Phaser.GameObjects.TileSprite[] = [];
  private bouncyGroup!: Phaser.Physics.Arcade.StaticGroup;
  private bouncySprites: Phaser.GameObjects.TileSprite[] = [];
  private hazards: HazardObj[] = [];
  private lasers: LaserObj[] = [];
  private laserNodes: Phaser.GameObjects.Image[] = [];
  private coins: Pickup[] = [];
  private artifacts: ArtifactPickup[] = [];
  private checkpoints: CheckpointObj[] = [];
  private core!: Phaser.GameObjects.Image;
  private signs: Phaser.GameObjects.Text[] = [];

  private windows = new Map<string, WindowCollider>();
  private closedPopups = new Set<string>();
  private popupBlock!: Phaser.GameObjects.Container;
  private popupBlockBg!: Phaser.GameObjects.Rectangle;
  private popupBlockText!: Phaser.GameObjects.Text;

  private bulletTimeOverlay!: Phaser.GameObjects.Rectangle;
  private bulletTime = false;
  private obstacleClock = 0;

  private respawnPoint: PointDef = { x: SPAWN.x, y: SPAWN.y };
  private coinCount = 0;
  private deaths = 0;
  private lastDeathAt = -Infinity;
  private lastBounceAt = -Infinity;
  private statsTimer = 0;
  private lastCam = { scrollX: NaN, scrollY: NaN, zoom: NaN };

  constructor() {
    super({ key: MAIN_SCENE_KEY });
  }

  /** Reinicia o estado (o construtor não roda de novo em scene.restart()). */
  init(): void {
    this.era = EraManager.getCurrentEra();
    this.state = 'title';
    this.needsRestart = false;
    this.cleanedUp = false;
    this.unsubs = [];
    this.platformSprites = [];
    this.bouncySprites = [];
    this.hazards = [];
    this.lasers = [];
    this.laserNodes = [];
    this.coins = [];
    this.artifacts = [];
    this.checkpoints = [];
    this.signs = [];
    this.windows = new Map();
    this.closedPopups = new Set();
    this.bulletTime = false;
    this.obstacleClock = 0;
    this.respawnPoint = { x: SPAWN.x, y: SPAWN.y };
    this.coinCount = 0;
    this.deaths = 0;
    this.lastDeathAt = -Infinity;
    this.lastBounceAt = -Infinity;
    this.statsTimer = 0;
    this.lastCam = { scrollX: NaN, scrollY: NaN, zoom: NaN };
  }

  create(): void {
    // Visual primeiro: texturas de todas as eras precisam existir antes dos sprites.
    this.eraRenderer = new EraVisualRenderer(this);
    this.eraRenderer.generateTextures();
    this.eraRenderer.applyEra(this.era);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    // Mundo: fundo aberto (cair = morte).
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.gravity.y = ERA_CONFIGS[this.era].gravity;

    this.buildLevel();

    // Jogador
    this.player = new Player(this, SPAWN.x, SPAWN.y);
    if (!this.player.displayList) this.add.existing(this.player);
    if (!this.player.body) this.physics.add.existing(this.player);
    this.player.setDepth(DEPTH_PLAYER);
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.firewall.getCollider());
    this.physics.add.collider(this.player, this.bouncyGroup, this.onBouncyCollide, undefined, this);

    this.buildWindows();
    this.buildOverlays();

    // Câmera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(120, 80);
    cam.centerOn(SPAWN.x, SPAWN.y);
    // Emite após o preRender da câmera (scroll já atualizado/clampado).
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.emitCameraIfChanged, this);
    this.emitCamera();

    this.subscribe();
    this.applyEraToLevel(this.era);

    // Estado inicial: 'title' (física pausada), a menos que o React já esteja em 'playing'.
    const lastState = EventBus.getLast('GAME_STATE_CHANGED')?.state;
    if (lastState === 'playing') this.startPlaying();
    else this.physics.pause();

    this.emitStats();
  }

  // -------------------------------------------------------------------------
  // Construção do nível
  // -------------------------------------------------------------------------

  private buildLevel(): void {
    this.platforms = this.physics.add.staticGroup();
    for (const r of PLATFORMS) {
      const ts = this.add.tileSprite(r.x, r.y, r.w, r.h, textureKey('platform', this.era));
      ts.setOrigin(0, 0).setDepth(DEPTH_LEVEL);
      this.platforms.add(ts);
      (ts.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      this.platformSprites.push(ts);
    }

    this.bouncyGroup = this.physics.add.staticGroup();
    for (const r of BOUNCY) {
      const ts = this.add.tileSprite(r.x, r.y, r.w, r.h, textureKey('bouncy', this.era));
      ts.setOrigin(0, 0).setDepth(DEPTH_ENTITY);
      this.bouncyGroup.add(ts);
      (ts.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      this.bouncySprites.push(ts);
    }

    // Firewall (CommentWall cuida da própria colisão por era)
    this.firewall = new CommentWall(this, FIREWALL.x, FIREWALL.y, FIREWALL.w, FIREWALL.h, '// FIREWALL_COMMENT');

    // Espinhos: visual TileSprite (rotacionado para paredes) + hitbox manual levemente reduzida.
    for (const h of HAZARDS) {
      const key = textureKey('hazard', this.era);
      let sprite: Phaser.GameObjects.TileSprite;
      if (h.dir === 'up') {
        sprite = this.add.tileSprite(h.x, h.y, h.w, h.h, key).setOrigin(0, 0);
      } else {
        // Comprimento vertical vira largura do tile; rotaciona ±90°.
        sprite = this.add.tileSprite(h.x + h.w / 2, h.y + h.h / 2, h.h, h.w, key).setOrigin(0.5, 0.5);
        sprite.setAngle(h.dir === 'right' ? 90 : -90);
      }
      sprite.setDepth(DEPTH_ENTITY);
      const inset = 4;
      this.hazards.push({
        sprite,
        hit: { x: h.x + inset, y: h.y + inset, w: Math.max(1, h.w - inset * 2), h: Math.max(1, h.h - inset) },
      });
    }

    // Lasers verticais: TileSprite horizontal rotacionado 90° + emissores no teto/chão.
    for (const def of LASERS) {
      const len = def.y2 - def.y1;
      const beam = this.add
        .tileSprite(def.x, def.y1 + len / 2, len, 10, textureKey('laser', this.era))
        .setOrigin(0.5, 0.5)
        .setAngle(90)
        .setDepth(DEPTH_ENTITY);
      this.lasers.push({ def, beam, on: true });
      for (const ny of [def.y1 + 4, def.y2 - 4]) {
        const node = this.add.image(def.x, ny, textureKey('hazard', this.era)).setDisplaySize(20, 8).setDepth(DEPTH_ENTITY + 1);
        this.laserNodes.push(node);
      }
    }

    // Moedas
    for (const p of COINS) {
      const sprite = this.add.image(p.x, p.y, textureKey('coin', this.era)).setDepth(DEPTH_ENTITY);
      this.tweens.add({ targets: sprite, y: p.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (p.x % 7) * 90 });
      this.coins.push({ sprite, x: p.x, y: p.y, taken: false });
    }

    // Artefatos (visual único, flutuando)
    for (const a of ARTIFACT_PLACEMENTS) {
      const sprite = this.add.image(a.x, a.y, artifactTextureKey(a.id)).setDepth(DEPTH_ENTITY + 1);
      this.tweens.add({ targets: sprite, y: a.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: sprite, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.artifacts.push({ sprite, x: a.x, y: a.y, taken: false, id: a.id });
    }

    // Checkpoints (de pé sobre a superfície)
    for (const c of CHECKPOINTS) {
      const sprite = this.add.image(c.x, c.y, textureKey('checkpoint', this.era)).setOrigin(0.5, 1).setDepth(DEPTH_ENTITY);
      sprite.setAlpha(0.45);
      this.checkpoints.push({ sprite, point: c, active: false });
    }

    // Núcleo 2026 (pulsando)
    this.core = this.add.image(CORE_POS.x, CORE_POS.y, textureKey('core', this.era)).setDepth(DEPTH_ENTITY);
    this.tweens.add({ targets: this.core, scale: 1.1, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.core, angle: 360, duration: 12000, repeat: -1 });

    // Placas
    for (const s of SIGNS) {
      const t = this.add.text(s.x, s.y, s.text, { fontSize: '16px', align: 'center', lineSpacing: 2 });
      t.setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY);
      this.signs.push(t);
    }
  }

  /** Colisores das janelas do SO (DOM). Inicializa por WINDOW_DEFS até chegar WINDOWS_UPDATED. */
  private buildWindows(): void {
    // Bloco desenhado no canvas para o pop-up 404 fora de 1995.
    const popupDef = WINDOW_DEFS.find((d) => d.kind === 'popup');
    this.popupBlockBg = this.add.rectangle(0, 0, 10, 10, 0xff0000).setOrigin(0, 0);
    this.popupBlockText = this.add
      .text(0, 0, 'ERRO 404\n— visite 1995 [6]', { fontSize: '20px', align: 'center', wordWrap: { width: 220 } })
      .setOrigin(0.5, 0.5);
    this.popupBlock = this.add.container(0, 0, [this.popupBlockBg, this.popupBlockText]).setDepth(DEPTH_ENTITY + 2);
    this.popupBlock.setVisible(false);
    if (popupDef) this.layoutPopupBlock(popupDef);

    this.applyWindows(EventBus.getLast('WINDOWS_UPDATED')?.windows ?? this.defaultWindows());
  }

  /** Estado das janelas antes do React reportar: bridge ativa só nas suas eras; popup ativo. */
  private defaultWindows(): InteractiveWindowRect[] {
    return WINDOW_DEFS.map((d) => ({
      id: d.id,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      kind: d.kind,
      active: d.kind === 'bridge' ? d.eras.includes(this.era) : true,
    }));
  }

  private buildOverlays(): void {
    this.bulletTimeOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x00ff66, 0.08)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_OVERLAY)
      .setVisible(false);
  }

  // -------------------------------------------------------------------------
  // EventBus
  // -------------------------------------------------------------------------

  private listen<K extends EventName>(event: K, handler: (p: EventMap[K]) => void): void {
    this.unsubs.push(EventBus.on(event, handler));
  }

  private subscribe(): void {
    this.listen('ERA_CHANGED', ({ era }) => {
      this.era = era;
      this.eraRenderer.applyEra(era);
      this.applyEraToLevel(era);
      if (!EventBus.getLast('WINDOWS_UPDATED')) this.applyWindows(this.defaultWindows());
    });
    this.listen('WINDOWS_UPDATED', ({ windows }) => this.applyWindows(windows));
    this.listen('POPUP_CLOSED', ({ id }) => this.closePopup(id));
    this.listen('TRIGGER_SCREEN_SHAKE', ({ intensity, duration }) => this.cameras.main.shake(duration, intensity));
    this.listen('BULLET_TIME_CHANGED', ({ active }) => {
      this.bulletTime = active;
      this.bulletTimeOverlay.setVisible(active);
    });
    this.listen('GAME_RESTART', () => {
      this.needsRestart = true;
    });
    this.listen('GAME_STATE_CHANGED', ({ state }) => {
      if (state === 'playing') {
        if (this.needsRestart) this.scene.restart();
        else if (this.state === 'title' || this.state === 'paused') this.startPlaying();
      } else if (state === 'paused' && this.state === 'playing') {
        this.state = 'paused';
        this.physics.pause();
        this.tweens.pauseAll();
      } else if (state === 'title' && this.state === 'playing') {
        this.state = 'title';
        this.physics.pause();
      }
    });
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.emitCameraIfChanged, this);
    this.firewall?.destroy();
    this.eraRenderer?.destroy();
  }

  // -------------------------------------------------------------------------
  // Era
  // -------------------------------------------------------------------------

  private applyEraToLevel(era: EraId): void {
    const config: EraConfig = ERA_CONFIGS[era];
    this.physics.world.gravity.y = config.gravity;
    this.cameras.main.setBackgroundColor(config.palette.background);

    const plat = textureKey('platform', era);
    for (const s of this.platformSprites) s.setTexture(plat);
    const bouncy = textureKey('bouncy', era);
    for (const s of this.bouncySprites) s.setTexture(bouncy);
    const hazard = textureKey('hazard', era);
    for (const h of this.hazards) h.sprite.setTexture(hazard);
    for (const n of this.laserNodes) n.setTexture(hazard).setDisplaySize(20, 8);
    const laser = textureKey('laser', era);
    for (const l of this.lasers) l.beam.setTexture(laser);
    const coin = textureKey('coin', era);
    for (const c of this.coins) if (!c.taken) c.sprite.setTexture(coin);
    const cp = textureKey('checkpoint', era);
    for (const c of this.checkpoints) c.sprite.setTexture(cp);
    this.core.setTexture(textureKey('core', era));

    const pal = config.palette;
    for (const t of this.signs) {
      t.setFontFamily(config.fontFamily);
      t.setColor(pal.text);
      t.setStroke(pal.background, 4);
    }

    // Bloco 404 estilizado na paleta da era
    this.popupBlockBg.setFillStyle(hexToNumber(pal.hazard), 0.92);
    this.popupBlockBg.setStrokeStyle(4, hexToNumber(pal.foreground), 1);
    // Texto branco com contorno escuro: legível sobre qualquer cor de perigo.
    this.popupBlockText.setFontFamily(config.fontFamily).setColor('#FFFFFF').setStroke('#000000', 4);
    this.refreshPopupBlock();
  }

  // -------------------------------------------------------------------------
  // Janelas (React → colisores)
  // -------------------------------------------------------------------------

  private applyWindows(rects: InteractiveWindowRect[]): void {
    for (const rect of rects) {
      let wc = this.windows.get(rect.id);
      if (!wc) {
        const zone = this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
        this.physics.add.existing(zone, true);
        if (this.player) this.physics.add.collider(this.player, zone);
        wc = { zone, rect };
        this.windows.set(rect.id, wc);
      }
      wc.rect = rect;
      const body = wc.zone.body as Phaser.Physics.Arcade.StaticBody;
      wc.zone.setSize(rect.width, rect.height);
      wc.zone.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
      body.setSize(rect.width, rect.height);
      body.updateFromGameObject();
      body.enable = rect.active && !this.closedPopups.has(rect.id);
      if (rect.kind === 'popup') this.layoutPopupBlock(rect);
    }
    this.refreshPopupBlock();
  }

  private layoutPopupBlock(rect: Pick<InteractiveWindowRect, 'x' | 'y' | 'width' | 'height'>): void {
    this.popupBlock.setPosition(rect.x, rect.y);
    this.popupBlockBg.setSize(rect.width, rect.height);
    this.popupBlockBg.setDisplaySize(rect.width, rect.height);
    this.popupBlockText.setPosition(rect.width / 2, rect.height / 2);
    this.popupBlockText.setWordWrapWidth(rect.width - 16);
  }

  private refreshPopupBlock(): void {
    if (!this.popupBlock) return;
    const popup = [...this.windows.values()].find((w) => w.rect.kind === 'popup');
    const visible =
      !!popup && popup.rect.active && !this.closedPopups.has(popup.rect.id) && this.era !== EraId.WIN95_1995;
    this.popupBlock.setVisible(visible);
  }

  private closePopup(id: string): void {
    if (this.closedPopups.has(id)) return;
    this.closedPopups.add(id);
    const wc = this.windows.get(id);
    if (wc) {
      (wc.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      EventBus.emit('SPAWN_BURST', {
        x: wc.rect.x + wc.rect.width / 2,
        y: wc.rect.y + wc.rect.height / 2,
        kind: 'eraChange',
      });
    }
    this.refreshPopupBlock();
  }

  // -------------------------------------------------------------------------
  // Estados
  // -------------------------------------------------------------------------

  private startPlaying(): void {
    this.state = 'playing';
    this.physics.resume();
    this.tweens.resumeAll();
  }

  private triggerVictory(): void {
    if (this.state !== 'playing') return;
    this.state = 'victory';
    this.needsRestart = true;
    this.player.setVelocity(0, 0);
    this.physics.pause();
    EventBus.emit('SPAWN_BURST', { x: CORE_POS.x, y: CORE_POS.y, kind: 'artifact' });
    EventBus.emit('PLAY_SFX', { sound: 'victory' });
    EventBus.emit('GAME_STATE_CHANGED', { state: 'victory' });
    this.emitStats();
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  update(time: number, delta: number): void {
    // Pausado: congela tudo (fundo, lasers, jogador).
    if (this.state === 'paused') return;
    this.eraRenderer.update(time, delta);

    // Relógio dos obstáculos (desacelera no Bullet Time; o jogador não).
    this.obstacleClock += delta * (this.bulletTime ? BULLET_TIME_SCALE : 1);
    this.updateLasers();

    if (this.state !== 'playing') return;

    this.player.update(time, delta);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const pRect: Rect = { x: body.x, y: body.y, w: body.width, h: body.height };
    const cx = body.center.x;
    const cy = body.center.y;

    this.checkDeath(pRect, time);
    if (this.state !== 'playing') return;
    this.checkPickups(cx, cy);
    this.checkCheckpoints(cx, cy);
    if (Phaser.Math.Distance.Between(cx, cy, CORE_POS.x, CORE_POS.y) < 64) this.triggerVictory();

    this.statsTimer += delta;
    if (this.statsTimer >= STATS_INTERVAL_MS) {
      this.statsTimer = 0;
      this.emitStats();
    }
  }

  private updateLasers(): void {
    const t = this.obstacleClock / 1000;
    for (const l of this.lasers) {
      const { period, offTime, phase } = l.def;
      const local = (((t + phase) % period) + period) % period;
      const on = local >= offTime;
      if (on !== l.on) {
        l.on = on;
        l.beam.setAlpha(on ? 1 : 0.12);
      }
    }
  }

  private checkDeath(p: Rect, time: number): void {
    if (time - this.lastDeathAt < DEATH_COOLDOWN_MS) return;
    let dead = p.y > WORLD_HEIGHT + 40;
    if (!dead) dead = this.hazards.some((h) => rectsOverlap(p, h.hit));
    if (!dead) {
      dead = this.lasers.some(
        (l) => l.on && rectsOverlap(p, { x: l.def.x - 5, y: l.def.y1, w: 10, h: l.def.y2 - l.def.y1 }),
      );
    }
    if (dead) this.killPlayer(time);
  }

  private killPlayer(time: number): void {
    this.lastDeathAt = time;
    this.deaths++;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    EventBus.emit('PLAY_SFX', { sound: 'death' });
    EventBus.emit('SPAWN_BURST', { x: body.center.x, y: Math.min(body.center.y, WORLD_HEIGHT - 10), kind: 'death' });
    this.player.respawn(this.respawnPoint.x, this.respawnPoint.y);
    this.emitStats();
  }

  private checkPickups(cx: number, cy: number): void {
    for (const c of this.coins) {
      if (c.taken || Math.abs(cx - c.x) > 22 || Math.abs(cy - c.sprite.y) > 28) continue;
      c.taken = true;
      this.coinCount++;
      EventBus.emit('PLAY_SFX', { sound: 'coin' });
      EventBus.emit('SPAWN_BURST', { x: c.x, y: c.sprite.y, kind: 'coin' });
      c.sprite.destroy();
    }
    for (const a of this.artifacts) {
      if (a.taken || Math.abs(cx - a.x) > 26 || Math.abs(cy - a.sprite.y) > 32) continue;
      a.taken = true;
      EraManager.collectArtifact(a.id);
      EventBus.emit('PLAY_SFX', { sound: 'artifact' });
      EventBus.emit('SPAWN_BURST', { x: a.x, y: a.sprite.y, kind: 'artifact' });
      const unlocks = ARTIFACTS[a.id].unlocks.map(eraLabel).join(' • ');
      this.floatText(a.x, a.sprite.y - 24, `${ARTIFACTS[a.id].name}\nDesbloqueado: ${unlocks}`);
      a.sprite.destroy();
      this.emitStats();
    }
  }

  private checkCheckpoints(cx: number, cy: number): void {
    for (const c of this.checkpoints) {
      if (c.active || Math.abs(cx - c.point.x) > 24 || cy < c.point.y - 80 || cy > c.point.y + 4) continue;
      for (const o of this.checkpoints) {
        if (o.active) {
          o.active = false;
          o.sprite.setAlpha(0.45);
        }
      }
      c.active = true;
      c.sprite.setAlpha(1);
      this.tweens.add({ targets: c.sprite, scaleY: 1.25, scaleX: 0.85, duration: 120, yoyo: true, ease: 'Quad.out' });
      this.respawnPoint = { x: c.point.x, y: c.point.y - 30 };
      EventBus.emit('SPAWN_BURST', { x: c.point.x, y: c.point.y - 24, kind: 'land' });
      EventBus.emit('PLAY_SFX', { sound: 'click' });
      this.floatText(c.point.x, c.point.y - 70, 'CHECKPOINT');
    }
  }

  private onBouncyCollide(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (!body.touching.down && !body.blocked.down) return;
    const now = this.time.now;
    if (now - this.lastBounceAt < 150) return;
    this.lastBounceAt = now;
    this.player.bounce(BOUNCE_VELOCITY);
  }

  private floatText(x: number, y: number, msg: string): void {
    const config = ERA_CONFIGS[this.era];
    const t = this.add
      .text(x, y, msg, {
        fontFamily: config.fontFamily,
        fontSize: '18px',
        color: config.palette.text,
        align: 'center',
        stroke: config.palette.background,
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 2200, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  // -------------------------------------------------------------------------
  // React
  // -------------------------------------------------------------------------

  private emitCamera(): void {
    const cam = this.cameras.main;
    this.lastCam = { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom };
    EventBus.emit('CAMERA_UPDATED', { ...this.lastCam });
  }

  private emitCameraIfChanged(): void {
    if (this.cleanedUp) return;
    const cam = this.cameras.main;
    if (cam.scrollX !== this.lastCam.scrollX || cam.scrollY !== this.lastCam.scrollY || cam.zoom !== this.lastCam.zoom) {
      this.emitCamera();
    }
  }

  private emitStats(): void {
    if (!this.player?.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const sector = sectorAt(body.center.x);
    const stats: PlayerStats = {
      x: Math.round(body.center.x),
      y: Math.round(body.center.y),
      sector: sector.id,
      sectorName: sector.name,
      coins: this.coinCount,
      deaths: this.deaths,
      artifacts: EraManager.getCollectedArtifacts(),
      dashReady: this.player.canDash(),
      bulletTimeActive: this.player.isBulletTimeActive(),
      grounded: body.blocked.down || body.touching.down,
    };
    EventBus.emit('PLAYER_STATS_UPDATED', stats);
  }
}
