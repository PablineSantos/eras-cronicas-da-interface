import Phaser from 'phaser';
import { EventBus } from '../../core/EventBus';
import { EraManager } from '../../core/EraManager';
import {
  COYOTE_TIME_MS,
  DASH_COOLDOWN_MS,
  DASH_DURATION_MS,
  DASH_SPEED,
  EraConfig,
  IPlayerController,
  JUMP_BUFFER_MS,
  PARTICLE_TEXTURE_KEY,
  SoundEffect,
  textureKey,
  WALL_SLIDE_MAX_FALL,
} from '../../core/types';

/** Corpo físico constante (px), alinhado aos pés do sprite. */
const BODY_W = 22;
const BODY_H = 38;

const DEPTH_PLAYER = 20;
const DEPTH_GHOST = 19;
const DEPTH_PARTICLES = 30;

const MAX_FALL_SPEED = 1100;
const VARIABLE_JUMP_CUT = 0.45;
const WALL_JUMP_LOCK_MS = 150;
const WALL_CONTACT_GRACE_MS = 90;
const LAND_MIN_FALL_SPEED = 220;
const IMPACT_WINDOW_MS = 120;
const RESPAWN_BLINK_MS = 1000;
const GHOST_INTERVAL_MS = 45;
const GHOST_LIFE_MS = 320;
const GHOST_TINT = 0x00ff41;
const NEON_TINTS = [0x10b981, 0x6366f1];

interface Ghost {
  img: Phaser.GameObjects.Image;
  life: number;
}

interface KeySet {
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  jump: Phaser.Input.Keyboard.Key[];
  dash: Phaser.Input.Keyboard.Key[];
  shift: Phaser.Input.Keyboard.Key[];
}

const anyDown = (keys: Phaser.Input.Keyboard.Key[]): boolean => keys.some((k) => k.isDown);

/**
 * Jogador com mecânicas progressivas por era (EraConfig atual).
 * Inscreve-se sozinho em ERA_CHANGED; a cena só chama update/respawn/bounce.
 */
export class Player extends Phaser.Physics.Arcade.Sprite implements IPlayerController {
  private config: EraConfig;
  private keys: KeySet | null = null;
  private unsubscribeEra: (() => void) | null = null;

  // --- Estado de input (detecção de borda própria) ---
  private prevJumpDown = false;
  private prevDashDown = false;
  private prevShiftDown = false;

  // --- Estado de movimento ---
  private facing: 1 | -1 = 1;
  private grounded = false;
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;
  /** Pulou desde que saiu do chão (bloqueia coyote). */
  private jumpedSinceGround = false;
  /** Pulo "segurado" (pulo variável pode cortar). */
  private jumpCutAvailable = false;
  private airJumpsLeft = 0;
  /** vx travado no momento da decolagem (eras sem controle aéreo). */
  private lockedAirVx = 0;
  private inputLockUntil = 0;
  private wallDir: -1 | 0 | 1 = 0;
  private lastWallAt = -Infinity;
  private wallSliding = false;
  private prevVy = 0;
  private now = 0;

  // --- Dash ---
  private dashing = false;
  private dashEndAt = 0;
  private dashCooldownUntil = 0;
  private dashAvailable = true;
  private dashDir = new Phaser.Math.Vector2(1, 0);
  private dashStartedGrounded = false;
  private impactDone = true;

  // --- Bullet Time ---
  private bulletTime = false;
  private ghosts: Ghost[] = [];
  private ghostPool: Phaser.GameObjects.Image[] = [];
  private ghostTimer = 0;

  // --- Squash & Stretch / partículas ---
  private sx = 1;
  private sy = 1;
  private runParticleTimer = 0;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // --- Respawn ---
  private blinkUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const cfg = EraManager.getCurrentConfig();
    const key = textureKey('player', cfg.id);
    super(scene, x, y, scene.textures.exists(key) ? key : '__MISSING');
    this.config = cfg;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH_PLAYER);
    this.setCollideWorldBounds(true);

    const body = this.arcadeBody;
    body.setMaxVelocity(DASH_SPEED + 200, MAX_FALL_SPEED);
    body.setDrag(0, 0);
    body.setAcceleration(0, 0);
    this.applyBodyScale();

    this.setupKeys();
    this.applyEra(cfg);
    this.unsubscribeEra = EventBus.on('ERA_CHANGED', ({ config }) => this.applyEra(config));
  }

  // ---------------------------------------------------------------------------
  // API pública (IPlayerController)
  // ---------------------------------------------------------------------------

  update(time: number, delta: number): void {
    if (!this.active || !this.body || !this.keys) return;
    this.now = time;
    const dt = Math.min(delta, 50);
    const body = this.arcadeBody;
    const cfg = this.config;
    const k = this.keys;

    // --- Leitura de input ---
    const left = anyDown(k.left);
    const right = anyDown(k.right);
    const up = anyDown(k.up);
    const down = anyDown(k.down);
    const inputX = (right ? 1 : 0) - (left ? 1 : 0);
    const inputY = (down ? 1 : 0) - (up ? 1 : 0);
    const jumpDown = anyDown(k.jump);
    const jumpPressed = jumpDown && !this.prevJumpDown;
    const jumpReleased = !jumpDown && this.prevJumpDown;
    this.prevJumpDown = jumpDown;
    const shiftDown = anyDown(k.shift);
    const dashKeyDown = anyDown(k.dash) || (cfg.allowDash && shiftDown);
    const dashPressed = dashKeyDown && !this.prevDashDown;
    this.prevDashDown = dashKeyDown;

    if (jumpPressed) this.jumpPressedAt = time;

    // --- Chão / paredes ---
    const wasGrounded = this.grounded;
    this.grounded = body.blocked.down || body.touching.down;
    const blockedLeft = body.blocked.left || body.touching.left;
    const blockedRight = body.blocked.right || body.touching.right;

    if (this.grounded) {
      this.lastGroundedAt = time;
      this.jumpedSinceGround = false;
      this.airJumpsLeft = cfg.allowDoubleJump ? 1 : 0;
      if (!this.dashing) this.dashAvailable = true;
      this.wallSliding = false;
    }

    // Aterrissagem (ar → chão)
    if (this.grounded && !wasGrounded) this.onLand(this.prevVy);
    // Saiu do chão sem pular: trava vx atual (eras sem controle aéreo)
    if (!this.grounded && wasGrounded && !this.jumpedSinceGround) this.lockedAirVx = body.velocity.x;

    // --- Bullet Time (toque no Shift liga/desliga, só em eras com allowBulletTime) ---
    // Toggle em vez de segurar: segurar Shift + setas + Espaço era desconfortável.
    const shiftPressed = shiftDown && !this.prevShiftDown;
    this.prevShiftDown = shiftDown;
    if (!cfg.allowBulletTime) this.setBulletTime(false);
    else if (shiftPressed) this.setBulletTime(!this.bulletTime);

    // --- Dash ---
    if (this.dashing) {
      this.checkDashImpact(blockedLeft, blockedRight);
      if (time >= this.dashEndAt) this.endDash();
    } else if (dashPressed && this.canDash()) {
      this.startDash(inputX, inputY);
    }
    if (!this.dashing && !this.impactDone && time <= this.dashEndAt + IMPACT_WINDOW_MS) {
      this.checkDashImpact(blockedLeft, blockedRight);
    }

    if (!this.dashing) {
      // --- Horizontal ---
      const locked = time < this.inputLockUntil;
      if (locked) {
        // mantém vx do wall jump
      } else if (this.grounded || cfg.allowAirControl) {
        this.applyHorizontal(inputX, dt);
      } else {
        body.setVelocityX(this.lockedAirVx);
      }
      if (inputX !== 0 && !locked && (this.grounded || cfg.allowAirControl)) this.facing = inputX > 0 ? 1 : -1;

      // --- Parede (wall slide) ---
      this.wallSliding = false;
      if (cfg.allowWallJump && !this.grounded) {
        const pushingLeft = blockedLeft && inputX < 0;
        const pushingRight = blockedRight && inputX > 0;
        if (pushingLeft || pushingRight) {
          this.wallDir = pushingLeft ? -1 : 1;
          this.lastWallAt = time;
          if (body.velocity.y > 0) {
            this.wallSliding = true;
            if (body.velocity.y > WALL_SLIDE_MAX_FALL) body.setVelocityY(WALL_SLIDE_MAX_FALL);
          }
        }
      }

      // --- Pulo ---
      this.handleJump(time, jumpPressed);

      // Pulo variável: soltar corta a subida
      if (jumpReleased && cfg.allowVariableJump && this.jumpCutAvailable && body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y * VARIABLE_JUMP_CUT);
        this.jumpCutAvailable = false;
      }
      if (body.velocity.y >= 0) this.jumpCutAvailable = false;
    }

    this.setFlipX(this.facing < 0);

    // --- Efeitos ---
    this.updateGhosts(dt);
    this.updateSquash(dt);
    this.updateRunParticles(dt);
    this.updateBlink(time);

    this.prevVy = body.velocity.y;
  }

  applyEra(config: EraConfig): void {
    const changed = config.id !== this.config.id;
    this.config = config;
    const key = textureKey('player', config.id);
    if (this.scene && this.scene.textures.exists(key) && this.texture.key !== key) this.setTexture(key);

    // Reseta estados incompatíveis
    this.setBulletTime(false);
    if (this.dashing) this.endDash();
    this.impactDone = true;
    if (!config.allowDoubleJump) this.airJumpsLeft = 0;
    else if (changed && this.grounded) this.airJumpsLeft = 1;
    this.wallSliding = false;
    this.inputLockUntil = 0;
    this.sx = 1;
    this.sy = 1;
    if (this.body) {
      const body = this.arcadeBody;
      body.setAllowGravity(true);
      body.setDrag(0, 0);
      body.setAcceleration(0, 0);
      this.lockedAirVx = body.velocity.x;
      this.applyBodyScale();
    }
    if (!config.allowSquashStretch) this.emitter?.stop();
  }

  respawn(x: number, y: number): void {
    if (!this.body) return;
    // Mantém o Bullet Time ligado ao morrer nos lasers (é um toggle da era).
    if (!this.config.allowBulletTime) this.setBulletTime(false);
    this.dashing = false;
    this.dashAvailable = true;
    this.dashCooldownUntil = 0;
    this.impactDone = true;
    this.arcadeBody.setAllowGravity(true);
    this.arcadeBody.reset(x, y);
    this.arcadeBody.setVelocity(0, 0);
    this.grounded = false;
    this.jumpedSinceGround = false;
    this.jumpCutAvailable = false;
    this.airJumpsLeft = 0;
    this.lockedAirVx = 0;
    this.inputLockUntil = 0;
    this.wallSliding = false;
    this.lastGroundedAt = -Infinity;
    this.jumpPressedAt = -Infinity;
    this.prevVy = 0;
    this.facing = 1;
    this.setFlipX(false);
    this.sx = 1;
    this.sy = 1;
    this.applyBodyScale();
    this.clearGhosts();
    this.blinkUntil = this.scene.game.loop.time + RESPAWN_BLINK_MS;
    this.setAlpha(1);
  }

  isDashing(): boolean {
    return this.dashing;
  }

  isBulletTimeActive(): boolean {
    return this.bulletTime;
  }

  canDash(): boolean {
    return this.config.allowDash && !this.dashing && this.dashAvailable && this.now >= this.dashCooldownUntil;
  }

  bounce(velocityY: number): void {
    if (!this.body) return;
    if (this.dashing) this.endDash();
    this.arcadeBody.setVelocityY(velocityY);
    this.airJumpsLeft = this.config.allowDoubleJump ? 1 : 0;
    this.dashAvailable = true;
    this.jumpedSinceGround = true;
    this.jumpCutAvailable = false;
    this.lockedAirVx = this.arcadeBody.velocity.x;
    this.grounded = false;
    this.sfx('bounce');
    if (this.config.allowSquashStretch) {
      this.setSquash(0.75, 1.3);
      this.burst(10);
    }
  }

  // --- Extras úteis para a cena (HUD) ---

  isGrounded(): boolean {
    return this.grounded;
  }

  getFacing(): 1 | -1 {
    return this.facing;
  }

  destroy(fromScene?: boolean): void {
    this.unsubscribeEra?.();
    this.unsubscribeEra = null;
    if (this.bulletTime) {
      this.bulletTime = false;
      EventBus.emit('BULLET_TIME_CHANGED', { active: false });
    }
    // No shutdown da cena o DisplayList destrói tudo iterando de trás para frente;
    // destruir aqui os fantasmas (depth menor = índice anterior) encolheria a lista
    // no meio da iteração e quebraria o restart. Só destrói quando é remoção avulsa.
    if (!fromScene) {
      for (const g of this.ghosts) g.img.destroy();
      for (const img of this.ghostPool) img.destroy();
      this.emitter?.destroy();
    }
    this.ghosts = [];
    this.ghostPool = [];
    this.emitter?.stop();
    this.emitter = null;
    this.removeKeys();
    super.destroy(fromScene);
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  private setupKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    // Setas/Espaço capturados (evita rolagem da página); letras não, para não atrapalhar inputs do DOM.
    const add = (code: number, capture: boolean) => kb.addKey(code, capture);
    this.keys = {
      left: [add(K.LEFT, true), add(K.A, false)],
      right: [add(K.RIGHT, true), add(K.D, false)],
      up: [add(K.UP, true), add(K.W, false)],
      down: [add(K.DOWN, true), add(K.S, false)],
      jump: [add(K.SPACE, true), add(K.UP, true), add(K.W, false), add(K.Z, false)],
      dash: [add(K.X, false), add(K.K, false)],
      shift: [add(K.SHIFT, false)],
    };
  }

  private removeKeys(): void {
    const kb = this.scene?.input?.keyboard;
    if (!kb || !this.keys) return;
    const all = new Set(Object.values(this.keys).flat());
    // Não remove (destrói) teclas compartilhadas com outros sistemas — apenas reseta.
    for (const key of all) key.reset();
    this.keys = null;
  }

  private sfx(sound: SoundEffect): void {
    EventBus.emit('PLAY_SFX', { sound });
  }

  private applyHorizontal(inputX: number, dt: number): void {
    const body = this.arcadeBody;
    const cfg = this.config;
    const target = inputX * cfg.moveSpeed;
    if (!cfg.allowInertia) {
      body.setVelocityX(target);
      return;
    }
    // Integração manual de aceleração/desaceleração
    const s = dt / 1000;
    const vx = body.velocity.x;
    const airFactor = this.grounded ? 1 : 0.8;
    let next: number;
    if (inputX !== 0) {
      if (Math.abs(vx) > cfg.moveSpeed && Math.sign(vx) === inputX) {
        // Acima da velocidade máxima (pós-dash/wall jump): desacelera com drag
        next = approach(vx, target, cfg.drag * airFactor * s);
      } else {
        const turning = vx !== 0 && Math.sign(vx) !== inputX;
        const rate = (turning ? cfg.acceleration + cfg.drag : cfg.acceleration) * airFactor;
        next = approach(vx, target, rate * s);
      }
    } else {
      next = approach(vx, 0, cfg.drag * airFactor * s);
    }
    body.setVelocityX(next);
  }

  private handleJump(time: number, jumpPressed: boolean): void {
    const cfg = this.config;
    const body = this.arcadeBody;
    const buffered = cfg.allowJumpBuffer && time - this.jumpPressedAt <= JUMP_BUFFER_MS;
    const wantsJump = jumpPressed || buffered;
    if (!wantsJump) return;

    const coyote =
      cfg.allowCoyoteTime && !this.jumpedSinceGround && time - this.lastGroundedAt <= COYOTE_TIME_MS;

    if (this.grounded || coyote) {
      this.doJump(cfg.jumpVelocity, 'jump');
      return;
    }
    // Pulos aéreos só com pressão nova (buffer é só para aterrissagem)
    if (!jumpPressed) return;

    if (cfg.allowWallJump && this.wallDir !== 0 && time - this.lastWallAt <= WALL_CONTACT_GRACE_MS) {
      const away = -this.wallDir;
      body.setVelocityX(away * cfg.moveSpeed * 1.1);
      this.facing = away as 1 | -1;
      this.inputLockUntil = time + WALL_JUMP_LOCK_MS;
      this.wallDir = 0;
      this.lastWallAt = -Infinity;
      this.airJumpsLeft = cfg.allowDoubleJump ? 1 : 0;
      this.doJump(cfg.jumpVelocity * 0.95, 'wallJump');
      // Wall-jump sempre com altura cheia: com toques rápidos o corte do pulo
      // variável fazia cada salto perder altura e a chaminé ficava impossível.
      this.jumpCutAvailable = false;
      return;
    }
    if (cfg.allowDoubleJump && this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.doJump(cfg.jumpVelocity * 0.92, 'doubleJump');
    }
  }

  private doJump(velocity: number, sound: SoundEffect): void {
    const body = this.arcadeBody;
    body.setVelocityY(-velocity);
    this.jumpedSinceGround = true;
    this.jumpCutAvailable = true;
    this.jumpPressedAt = -Infinity; // consome o buffer
    this.lastGroundedAt = -Infinity; // consome o coyote
    this.grounded = false;
    this.lockedAirVx = body.velocity.x;
    this.wallSliding = false;
    this.sfx(sound);
    if (this.config.allowSquashStretch) {
      this.setSquash(0.8, 1.25);
      this.burst(sound === 'jump' ? 8 : 12);
    }
  }

  private onLand(fallSpeed: number): void {
    if (fallSpeed < LAND_MIN_FALL_SPEED) return;
    this.sfx('land');
    if (this.config.allowSquashStretch) {
      const t = Phaser.Math.Clamp((fallSpeed - LAND_MIN_FALL_SPEED) / 700, 0, 1);
      this.setSquash(1 + 0.3 * (0.5 + 0.5 * t), 1 - 0.3 * (0.5 + 0.5 * t));
      this.burst(10 + Math.round(8 * t));
    }
  }

  // --- Dash ---

  private startDash(inputX: number, inputY: number): void {
    const body = this.arcadeBody;
    let dx = inputX;
    let dy = inputY;
    // No chão, dash para baixo vira horizontal
    if (this.grounded && dy > 0) dy = 0;
    if (dx === 0 && dy === 0) dx = this.facing;
    this.dashDir.set(dx, dy).normalize();
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;

    this.dashing = true;
    this.dashAvailable = false;
    this.dashStartedGrounded = this.grounded;
    this.impactDone = false;
    this.dashEndAt = this.now + DASH_DURATION_MS;
    this.dashCooldownUntil = this.dashEndAt + DASH_COOLDOWN_MS;
    this.jumpCutAvailable = false;
    this.inputLockUntil = 0;
    body.setAllowGravity(false);
    body.setVelocity(this.dashDir.x * DASH_SPEED, this.dashDir.y * DASH_SPEED);
    this.sfx('dash');
    if (this.config.allowSquashStretch) {
      if (Math.abs(this.dashDir.x) >= Math.abs(this.dashDir.y)) this.setSquash(1.25, 0.8);
      else this.setSquash(0.8, 1.25);
      this.burst(14);
    }
  }

  private endDash(): void {
    if (!this.dashing) return;
    this.dashing = false;
    if (!this.body) return;
    const body = this.arcadeBody;
    body.setAllowGravity(true);
    // Preserva parte do momento sem ultrapassar muito a velocidade normal
    const vx = Phaser.Math.Clamp(body.velocity.x, -this.config.moveSpeed * 1.2, this.config.moveSpeed * 1.2);
    const vy = body.velocity.y < 0 ? body.velocity.y * 0.4 : body.velocity.y * 0.6;
    body.setVelocity(vx, vy);
    this.lockedAirVx = vx;
    if (this.grounded) this.dashAvailable = true;
  }

  /** Screen shake + 'impact' ao bater em parede/chão durante ou logo após o dash (2026). */
  private checkDashImpact(blockedLeft: boolean, blockedRight: boolean): void {
    if (this.impactDone || !this.config.allowSquashStretch) return;
    const body = this.arcadeBody;
    const d = this.dashDir;
    const hit =
      (d.x < -0.1 && blockedLeft) ||
      (d.x > 0.1 && blockedRight) ||
      (d.y < -0.1 && (body.blocked.up || body.touching.up)) ||
      (d.y > 0.1 && !this.dashStartedGrounded && this.grounded);
    if (!hit) return;
    this.impactDone = true;
    EventBus.emit('TRIGGER_SCREEN_SHAKE', { intensity: 0.008, duration: 120 });
    this.sfx('impact');
    this.burst(12);
    if (Math.abs(d.x) >= Math.abs(d.y)) this.setSquash(0.75, 1.2);
    else this.setSquash(1.3, 0.7);
  }

  // --- Bullet Time ---

  private setBulletTime(active: boolean): void {
    if (active === this.bulletTime) return;
    this.bulletTime = active;
    this.ghostTimer = 0;
    EventBus.emit('BULLET_TIME_CHANGED', { active });
  }

  private updateGhosts(dt: number): void {
    if (this.bulletTime) {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostTimer = GHOST_INTERVAL_MS;
        this.spawnGhost();
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      if (g.life <= 0) {
        g.img.setVisible(false).setActive(false);
        this.ghostPool.push(g.img);
        this.ghosts.splice(i, 1);
      } else {
        g.img.setAlpha(0.55 * (g.life / GHOST_LIFE_MS));
      }
    }
  }

  private spawnGhost(): void {
    let img = this.ghostPool.pop();
    if (!img) {
      img = this.scene.add.image(this.x, this.y, this.texture.key, this.frame.name);
      img.setDepth(DEPTH_GHOST).setBlendMode(Phaser.BlendModes.ADD);
    }
    img
      .setTexture(this.texture.key, this.frame.name)
      .setPosition(this.x, this.y)
      .setOrigin(this.originX, this.originY)
      .setScale(this.scaleX, this.scaleY)
      .setFlipX(this.flipX)
      .setTintFill(GHOST_TINT)
      .setAlpha(0.55)
      .setVisible(true)
      .setActive(true);
    this.ghosts.push({ img, life: GHOST_LIFE_MS });
  }

  private clearGhosts(): void {
    for (const g of this.ghosts) {
      g.img.setVisible(false).setActive(false);
      this.ghostPool.push(g.img);
    }
    this.ghosts = [];
  }

  // --- Squash & Stretch ---

  private setSquash(sx: number, sy: number): void {
    if (!this.config.allowSquashStretch) return;
    this.sx = sx;
    this.sy = sy;
    this.applyBodyScale();
  }

  private updateSquash(dt: number): void {
    if (this.sx === 1 && this.sy === 1) return;
    const f = 1 - Math.exp(-dt / 70);
    this.sx += (1 - this.sx) * f;
    this.sy += (1 - this.sy) * f;
    if (Math.abs(this.sx - 1) < 0.01 && Math.abs(this.sy - 1) < 0.01) {
      this.sx = 1;
      this.sy = 1;
    }
    this.applyBodyScale();
  }

  /**
   * Aplica a escala visual mantendo o corpo físico CONSTANTE (BODY_W x BODY_H)
   * e os pés visuais no mesmo lugar. No Arcade:
   *   body.width = sourceWidth * scale;  body.x = x + scaleX * (offset.x - displayOriginX)
   * Então: sourceWidth = W/sx, offset.x = dOX - W/(2sx), offset.y = dOY + (H/2 - BH)/sy,
   * e originY = 1 - 1/(2sy) para o rodapé visual ficar em y + H/2.
   */
  private applyBodyScale(): void {
    const sx = this.sx;
    const sy = this.sy;
    const fh = this.frame ? this.frame.realHeight : 40;
    this.setScale(sx, sy);
    this.setOrigin(0.5, 1 - 1 / (2 * sy));
    if (!this.body) return;
    const body = this.arcadeBody;
    body.setSize(BODY_W / sx, BODY_H / sy, false);
    body.setOffset(this.displayOriginX - BODY_W / (2 * sx), this.displayOriginY + (fh / 2 - BODY_H) / sy);
    // Se a escala mudou, o Arcade recalcula width = sourceWidth * escala no próximo passo (= BODY_W/BODY_H).
  }

  // --- Partículas (2026) ---

  private getEmitter(): Phaser.GameObjects.Particles.ParticleEmitter | null {
    if (this.emitter) return this.emitter;
    if (!this.scene || !this.scene.textures.exists(PARTICLE_TEXTURE_KEY)) return null;
    this.emitter = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 30, max: 120 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 250, max: 450 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.95, end: 0 },
      gravityY: 300,
      tint: NEON_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.emitter.setDepth(DEPTH_PARTICLES);
    return this.emitter;
  }

  private burst(count: number): void {
    if (!this.config.allowSquashStretch) return;
    const e = this.getEmitter();
    if (!e || !this.body) return;
    const b = this.arcadeBody;
    e.explode(count, b.center.x, b.bottom);
  }

  private updateRunParticles(dt: number): void {
    if (!this.config.allowSquashStretch || !this.grounded || this.dashing || !this.body) return;
    if (Math.abs(this.arcadeBody.velocity.x) < 60) return;
    this.runParticleTimer -= dt;
    if (this.runParticleTimer > 0) return;
    this.runParticleTimer = 70;
    this.burst(2);
  }

  // --- Piscar pós-respawn ---

  private updateBlink(time: number): void {
    if (this.blinkUntil <= 0) return;
    if (time >= this.blinkUntil) {
      this.blinkUntil = 0;
      this.setAlpha(1);
      return;
    }
    this.setAlpha(Math.floor(time / 80) % 2 === 0 ? 0.25 : 1);
  }
}

/** Move `value` em direção a `target` em no máximo `step`. */
function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(value + step, target);
  if (value > target) return Math.max(value - step, target);
  return target;
}
