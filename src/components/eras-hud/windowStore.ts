/**
 * Estado central das janelas interativas (posição de mundo + fechado).
 * Fora do React para que o arrasto não re-renderize a árvore a 60fps.
 */
import { EventBus } from '../../core/EventBus';
import { EraManager } from '../../core/EraManager';
import { EraId, InteractiveWindowRect, WINDOW_DEFS } from '../../core/types';

export interface WindowState {
  x: number;
  y: number;
  closed: boolean;
}

export type WindowStoreReason = 'move' | 'close' | 'reset';

const initial = (): Record<string, WindowState> =>
  Object.fromEntries(WINDOW_DEFS.map((d) => [d.id, { x: d.x, y: d.y, closed: false }]));

let states: Record<string, WindowState> = initial();
const listeners = new Set<(reason: WindowStoreReason, id: string | null) => void>();

function notify(reason: WindowStoreReason, id: string | null): void {
  for (const l of [...listeners]) l(reason, id);
}

export function getWindowState(id: string): WindowState {
  return states[id];
}

export function subscribeWindowStore(fn: (reason: WindowStoreReason, id: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function moveWindow(id: string, x: number, y: number): void {
  const s = states[id];
  if (!s || (s.x === x && s.y === y)) return;
  states = { ...states, [id]: { ...s, x, y } };
  notify('move', id);
}

export function closeWindow(id: string): void {
  const s = states[id];
  if (!s || s.closed) return;
  states = { ...states, [id]: { ...s, closed: true } };
  EventBus.emit('POPUP_CLOSED', { id });
  notify('close', id);
}

/** Ponte volta à posição inicial e pop-up reabre. */
export function resetWindows(): void {
  states = initial();
  notify('reset', null);
}

/** Lista COMPLETA de retângulos em coordenadas de mundo, com regras de active. */
export function buildWindowRects(era: EraId): InteractiveWindowRect[] {
  return WINDOW_DEFS.map((d) => {
    const s = states[d.id];
    return {
      id: d.id,
      kind: d.kind,
      x: s.x,
      y: s.y,
      width: d.width,
      height: d.height,
      active: d.kind === 'popup' ? !s.closed : d.eras.includes(era),
    };
  });
}

export function emitWindows(era: EraId = EraManager.getCurrentEra()): void {
  EventBus.emit('WINDOWS_UPDATED', { windows: buildWindowRects(era) });
}
