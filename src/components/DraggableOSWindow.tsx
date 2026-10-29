/**
 * Janela de SO posicionada em coordenadas de MUNDO sobre o canvas Phaser.
 * Posição/escala aplicadas via ref (sem re-render a 60fps); arrasto por
 * pointer events na barra de título, atualizando o windowStore (que emite
 * WINDOWS_UPDATED pelo WindowLayer).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { EventBus } from '../core/EventBus';
import { EraId, WORLD_HEIGHT, WORLD_WIDTH } from '../core/types';
import type { InteractiveWindowDef } from '../core/types';
import {
  clientToWorld,
  getViewport,
  subscribeViewport,
  visibleWorldRect,
  worldToCanvas,
  worldToScreenScale,
} from './eras-hud/viewport';
import { getWindowState, moveWindow, subscribeWindowStore } from './eras-hud/windowStore';
import { MacWindowSkin, Win95ErrorPopupSkin, Win95WindowSkin } from './eras-hud/windowSkins';
import type { TitleBarHandlers } from './eras-hud/windowSkins';

export interface DraggableOSWindowProps {
  /** Definição do contrato (WINDOW_DEFS). */
  def: InteractiveWindowDef;
  /** Era atual — escolhe a skin (1984 Mac / 1995 Win95). */
  era: EraId;
  /** Chamado ao clicar [X]/OK (pop-ups). */
  onClose?: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export function DraggableOSWindow({ def, era, onClose }: DraggableOSWindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; offX: number; offY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Aplica translate/scale a partir da câmera + posição de mundo. */
  const applyTransform = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const s = getWindowState(def.id);
    const v = getViewport();
    const p = worldToCanvas(s.x, s.y, v);
    if (!p) {
      el.style.visibility = 'hidden';
      return;
    }
    const k = worldToScreenScale(v);
    el.style.visibility = 'visible';
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${k})`;
  }, [def.id]);

  useEffect(() => {
    applyTransform();
    const offV = subscribeViewport(applyTransform);
    const offS = subscribeWindowStore((_reason, id) => {
      if (id === null || id === def.id) applyTransform();
    });
    return () => {
      offV();
      offS();
    };
  }, [applyTransform, def.id]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Nunca deixa o clique chegar ao jogo.
    e.stopPropagation();
    if (!def.draggable || e.button !== 0) return;
    e.preventDefault();
    const w = clientToWorld(e.clientX, e.clientY);
    if (!w) return;
    const s = getWindowState(def.id);
    drag.current = { pointerId: e.pointerId, offX: w.x - s.x, offY: w.y - s.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    EventBus.emit('PLAY_SFX', { sound: 'click' });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    const w = clientToWorld(e.clientX, e.clientY);
    if (!w) return;
    // Limita à área visível da câmera (e ao mundo).
    const view = visibleWorldRect();
    const x = clamp(w.x - d.offX, Math.max(0, view.x), Math.min(WORLD_WIDTH, view.x + view.width) - def.width);
    const y = clamp(w.y - d.offY, Math.max(0, view.y), Math.min(WORLD_HEIGHT, view.y + view.height) - def.height);
    moveWindow(def.id, Math.round(x), Math.round(y));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const handlers: TitleBarHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  const skinProps = {
    title: def.title,
    width: def.width,
    height: def.height,
    draggable: def.draggable,
    dragging,
    handlers,
    onClose,
  };

  const skin =
    era === EraId.MAC_1984 ? (
      <MacWindowSkin {...skinProps} />
    ) : def.kind === 'popup' ? (
      <Win95ErrorPopupSkin {...skinProps} />
    ) : (
      <Win95WindowSkin {...skinProps} />
    );

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute left-0 top-0 select-none"
      style={{ width: def.width, height: def.height, transformOrigin: '0 0', visibility: 'hidden', willChange: 'transform' }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: dragging ? 1.02 : 1 }}
        exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18 } }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={{ width: def.width, height: def.height }}
      >
        {skin}
      </motion.div>
    </div>
  );
}

export default DraggableOSWindow;
