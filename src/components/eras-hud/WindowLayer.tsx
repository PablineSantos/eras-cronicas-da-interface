/**
 * Gerenciador central das janelas interativas:
 *  - emite WINDOWS_UPDATED (lista completa, coordenadas de mundo) no mount,
 *    em cada ERA_CHANGED, em cada movimento de arrasto, ao fechar e no reset;
 *  - renderiza as janelas da era atual numa camada recortada ao canvas.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { EventBus } from '../../core/EventBus';
import { EraManager } from '../../core/EraManager';
import { EraId, WINDOW_DEFS } from '../../core/types';
import type { GameState } from '../../core/types';
import { DraggableOSWindow } from '../DraggableOSWindow';
import { getViewport, subscribeViewport } from './viewport';
import { closeWindow, emitWindows, getWindowState, subscribeWindowStore } from './windowStore';
import { useEraConfig } from './hooks';

const POPUP_IDS = WINDOW_DEFS.filter((d) => d.kind === 'popup').map((d) => d.id);

const readClosed = (): Record<string, boolean> =>
  Object.fromEntries(WINDOW_DEFS.map((d) => [d.id, getWindowState(d.id).closed]));

export function WindowLayer({ gameState }: { gameState: GameState }) {
  const era = useEraConfig().id;
  const [closed, setClosed] = useState<Record<string, boolean>>(readClosed);
  const layerRef = useRef<HTMLDivElement>(null);

  // Emissão para o Phaser: store (move/close/reset) + mudanças de era.
  useEffect(() => {
    emitWindows();
    const offStore = subscribeWindowStore((reason) => {
      emitWindows();
      if (reason !== 'move') setClosed(readClosed());
    });
    const offEra = EventBus.on('ERA_CHANGED', (p) => {
      emitWindows(p.era);
      // Entrou em 1995 com o pop-up aberto: som de erro (uma vez por entrada).
      if (p.era === EraId.WIN95_1995 && p.previous !== EraId.WIN95_1995 && POPUP_IDS.some((id) => !getWindowState(id).closed)) {
        EventBus.emit('PLAY_SFX', { sound: 'error' });
      }
    });
    // Cena (re)iniciada: reenvia o estado atual.
    const offState = EventBus.on('GAME_STATE_CHANGED', () => emitWindows(EraManager.getCurrentEra()));
    return () => {
      offStore();
      offEra();
      offState();
    };
  }, []);

  // Camada posicionada exatamente sobre o canvas (recorta janelas fora da câmera).
  useEffect(() => {
    const apply = () => {
      const el = layerRef.current;
      if (!el) return;
      const c = getViewport().canvas;
      if (!c) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.left = `${c.left}px`;
      el.style.top = `${c.top}px`;
      el.style.width = `${c.width}px`;
      el.style.height = `${c.height}px`;
    };
    apply();
    return subscribeViewport(apply);
  }, []);

  const visible = gameState === 'playing' || gameState === 'paused'
    ? WINDOW_DEFS.filter((d) => d.eras.includes(era) && !(d.kind === 'popup' && closed[d.id]))
    : [];

  return (
    <div ref={layerRef} className="pointer-events-none absolute overflow-hidden" style={{ display: 'none' }}>
      <AnimatePresence>
        {visible.map((def) => (
          <DraggableOSWindow
            key={`${def.id}-${era}`}
            def={def}
            era={era}
            onClose={def.kind === 'popup' ? () => {
              EventBus.emit('PLAY_SFX', { sound: 'click' });
              closeWindow(def.id);
            } : undefined}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default WindowLayer;
