/**
 * Store leve (fora do React) com a câmera Phaser + retângulo do canvas.
 * Atualizado a ~60fps por CAMERA_UPDATED; consumidores aplicam transform via refs.
 */
import { EventBus } from '../../core/EventBus';
import { GAME_CONTAINER_ID, GAME_HEIGHT, GAME_WIDTH } from '../../core/types';

export interface CanvasBox {
  /** Posição relativa ao container do jogo (px CSS). */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Posição em coordenadas de cliente (para eventos de ponteiro). */
  clientLeft: number;
  clientTop: number;
}

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  canvas: CanvasBox | null;
}

const state: ViewportState = { scrollX: 0, scrollY: 0, zoom: 1, canvas: null };
const listeners = new Set<() => void>();
let refCount = 0;
let teardown: (() => void) | null = null;

export function getViewport(): ViewportState {
  return state;
}

function notify(): void {
  for (const l of [...listeners]) l();
}

/** Inscreve um listener (inicia observadores no primeiro inscrito). */
export function subscribeViewport(fn: () => void): () => void {
  listeners.add(fn);
  if (refCount++ === 0) teardown = start();
  return () => {
    listeners.delete(fn);
    if (--refCount === 0) {
      teardown?.();
      teardown = null;
    }
  };
}

function sameBox(a: CanvasBox | null, b: CanvasBox | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height &&
    a.clientLeft === b.clientLeft &&
    a.clientTop === b.clientTop
  );
}

function start(): () => void {
  const cam = EventBus.getLast('CAMERA_UPDATED');
  if (cam) Object.assign(state, { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom || 1 });

  const offCam = EventBus.on('CAMERA_UPDATED', (c) => {
    state.scrollX = c.scrollX;
    state.scrollY = c.scrollY;
    state.zoom = c.zoom || 1;
    notify();
  });

  let observedCanvas: HTMLCanvasElement | null = null;
  let observedContainer: HTMLElement | null = null;
  let raf = 0;
  let retry = 0;

  const ro = new ResizeObserver(() => schedule());
  const mo = new MutationObserver(() => schedule());

  const measure = () => {
    raf = 0;
    const container = document.getElementById(GAME_CONTAINER_ID);
    const canvas = container?.querySelector('canvas') ?? null;

    if (container && container !== observedContainer) {
      if (observedContainer) ro.unobserve(observedContainer);
      ro.observe(container);
      mo.disconnect();
      mo.observe(container, { childList: true, subtree: true });
      observedContainer = container;
    }
    if (canvas !== observedCanvas) {
      if (observedCanvas) ro.unobserve(observedCanvas);
      if (canvas) ro.observe(canvas);
      observedCanvas = canvas;
    }

    let next: CanvasBox | null = null;
    if (container && canvas) {
      const r = canvas.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        next = {
          left: r.left - c.left,
          top: r.top - c.top,
          width: r.width,
          height: r.height,
          clientLeft: r.left,
          clientTop: r.top,
        };
      }
    }
    // Canvas ainda não existe: tenta de novo em breve.
    if (!next) {
      window.clearTimeout(retry);
      retry = window.setTimeout(schedule, 150);
    }
    if (!sameBox(state.canvas, next)) {
      state.canvas = next;
      notify();
    }
  };

  function schedule() {
    if (!raf) raf = requestAnimationFrame(measure);
  }

  window.addEventListener('resize', schedule);
  // Rede de segurança (Scale.FIT pode ajustar margens após o resize).
  const interval = window.setInterval(schedule, 500);
  measure();

  return () => {
    offCam();
    ro.disconnect();
    mo.disconnect();
    window.removeEventListener('resize', schedule);
    window.clearInterval(interval);
    window.clearTimeout(retry);
    if (raf) cancelAnimationFrame(raf);
  };
}

/** px CSS por px de mundo (zoom da câmera × escala do canvas). */
export function worldToScreenScale(v: ViewportState = state): number {
  return v.canvas ? (v.zoom * v.canvas.width) / GAME_WIDTH : 0;
}

/**
 * Mundo → px relativos ao canto do canvas.
 * A câmera Phaser aplica zoom em torno do centro (origin 0.5), então
 * x = ((worldX - scrollX - W/2) * zoom + W/2) * scale. Com zoom = 1 vira
 * (worldX - scrollX) * scale.
 */
export function worldToCanvas(x: number, y: number, v: ViewportState = state): { x: number; y: number } | null {
  if (!v.canvas) return null;
  const s = v.canvas.width / GAME_WIDTH;
  const hw = GAME_WIDTH / 2;
  const hh = GAME_HEIGHT / 2;
  return {
    x: ((x - v.scrollX - hw) * v.zoom + hw) * s,
    y: ((y - v.scrollY - hh) * v.zoom + hh) * s,
  };
}

/** Coordenadas de cliente (evento de ponteiro) → mundo. */
export function clientToWorld(clientX: number, clientY: number, v: ViewportState = state): { x: number; y: number } | null {
  if (!v.canvas) return null;
  const s = v.canvas.width / GAME_WIDTH;
  const gx = (clientX - v.canvas.clientLeft) / s;
  const gy = (clientY - v.canvas.clientTop) / s;
  const hw = GAME_WIDTH / 2;
  const hh = GAME_HEIGHT / 2;
  return {
    x: (gx - hw) / v.zoom + hw + v.scrollX,
    y: (gy - hh) / v.zoom + hh + v.scrollY,
  };
}

/** Região do mundo visível na câmera. */
export function visibleWorldRect(v: ViewportState = state): { x: number; y: number; width: number; height: number } {
  const w = GAME_WIDTH / v.zoom;
  const h = GAME_HEIGHT / v.zoom;
  return {
    x: v.scrollX + GAME_WIDTH / 2 - w / 2,
    y: v.scrollY + GAME_HEIGHT / 2 - h / 2,
    width: w,
    height: h,
  };
}
