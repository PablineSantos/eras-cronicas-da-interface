/**
 * Skins visuais das janelas do SO. Desenhadas no tamanho de MUNDO (px)
 * e escaladas pelo DraggableOSWindow via transform.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Hand } from 'lucide-react';

export interface TitleBarHandlers {
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

interface SkinProps {
  title: string;
  width: number;
  height: number;
  draggable: boolean;
  dragging: boolean;
  handlers: TitleBarHandlers;
  onClose?: () => void;
}

/** Impede que o clique em botões inicie arrasto ou roube o foco do jogo. */
const stopPointer = (e: ReactPointerEvent) => {
  e.stopPropagation();
  e.preventDefault();
};

// ---------------------------------------------------------------------------
// Mac OS System 1 (1984) — 1-bit
// ---------------------------------------------------------------------------

export function MacWindowSkin({ title, width, height, draggable, dragging, handlers }: SkinProps) {
  const stripes: CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(to bottom, #000 0px, #000 1px, #fff 1px, #fff 3px)',
    backgroundClip: 'content-box',
    padding: '4px 3px',
  };
  // Arrasta por qualquer parte: a barra de título pode ficar escondida sob o HUD.
  return (
    <div
      {...handlers}
      className="font-terminal flex flex-col bg-white text-black"
      style={{
        width,
        height,
        border: '2px solid #000',
        boxShadow: '5px 5px 0 #000',
        imageRendering: 'pixelated',
        cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default',
        touchAction: 'none',
      }}
    >
      <div
        className="relative flex h-[24px] shrink-0 items-center border-b-2 border-black"
        style={stripes}
      >
        {/* Caixa de fechar quadrada à esquerda */}
        <div className="absolute left-[8px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 border-2 border-black bg-white" style={{ boxShadow: '0 0 0 2px #fff' }} />
        <div className="ml-[30px] mr-[6px] flex min-w-0 flex-1 justify-center">
          <span className="truncate bg-white px-1.5 text-[16px] leading-none">{title}</span>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-3 px-4 text-[18px] leading-[1.05]">
        <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center border-2 border-black" style={{ boxShadow: '3px 3px 0 #000' }}>
          <Hand size={26} strokeWidth={2.5} />
        </div>
        <div>
          <p>Arraste-me com o mouse.</p>
          <p className="mt-1">Solte sobre o abismo e pule em cima: eu sou uma plataforma sólida.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-3 pb-2 text-[15px]">
        <span className="border-2 border-black px-3" style={{ borderRadius: 8, boxShadow: '0 0 0 1px #fff, 0 0 0 3px #000' }}>
          OK
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Windows 95
// ---------------------------------------------------------------------------

/** Chanfro 3D elevado clássico. */
export const win95Raised: CSSProperties = {
  background: '#C0C0C0',
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: '#FFFFFF #000000 #000000 #FFFFFF',
  boxShadow: 'inset -1px -1px #808080, inset 1px 1px #DFDFDF',
};

/** Chanfro 3D afundado (campos, bandeja). */
export const win95Sunken: CSSProperties = {
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: '#808080 #FFFFFF #FFFFFF #808080',
  boxShadow: 'inset 1px 1px #000000, inset -1px -1px #DFDFDF',
};

const WIN95_FONT = '"MS Sans Serif", Tahoma, "Segoe UI", sans-serif';

function Win95Button({ children, onClick, style }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={stopPointer}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="pointer-events-auto flex items-center justify-center active:translate-x-[1px] active:translate-y-[1px]"
      style={{ ...win95Raised, ...style }}
    >
      {children}
    </button>
  );
}

function Win95TitleBar({ title, draggable, dragging, handlers, onClose, showMinMax = true }: Omit<SkinProps, 'width' | 'height'> & { showMinMax?: boolean }) {
  return (
    <div
      {...handlers}
      className="flex h-[20px] shrink-0 items-center gap-1 px-[3px]"
      style={{
        background: 'linear-gradient(90deg, #000080 0%, #1084D0 100%)',
        cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default',
        touchAction: 'none',
      }}
    >
      <div className="h-[14px] w-[14px] shrink-0" style={{ background: 'linear-gradient(135deg,#FFD84A,#E08A00)', border: '1px solid #000' }} />
      <span className="flex-1 truncate text-[12px] font-bold text-white" style={{ fontFamily: WIN95_FONT }}>
        {title}
      </span>
      {showMinMax && (
        <>
          <Win95Button style={{ width: 16, height: 14 }}>
            <span className="mt-[5px] block h-[2px] w-[6px] bg-black" />
          </Win95Button>
          <Win95Button style={{ width: 16, height: 14 }}>
            <span className="block h-[8px] w-[9px] border border-black border-t-2" />
          </Win95Button>
        </>
      )}
      <Win95Button onClick={onClose} style={{ width: 16, height: 14, marginLeft: 2 }}>
        <span className="text-[11px] font-bold leading-none text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
          ✕
        </span>
      </Win95Button>
    </div>
  );
}

export function Win95WindowSkin(props: SkinProps) {
  const { width, height, draggable, dragging, handlers } = props;
  // Arrasta por qualquer parte: a barra de título pode ficar escondida sob o HUD.
  return (
    <div
      {...handlers}
      className="flex flex-col p-[2px]"
      style={{
        ...win95Raised,
        width,
        height,
        fontFamily: WIN95_FONT,
        cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default',
        touchAction: 'none',
      }}
    >
      <Win95TitleBar {...props} handlers={{}} />
      <div className="flex flex-1 items-center gap-3 px-3 text-[12px] text-black">
        <div className="relative h-[40px] w-[40px] shrink-0">
          {/* Ícone de "informação" */}
          <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #fff, #2a6cff 45%, #00227a)', border: '1px solid #000' }} />
          <span className="absolute inset-0 flex items-center justify-center font-serif text-[22px] font-bold italic text-white">i</span>
        </div>
        <div className="leading-snug">
          <p className="font-bold">Esta janela é sólida.</p>
          <p>Arraste-a com o mouse até o abismo e use-a como ponte.</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="h-[16px] flex-1 mr-3" style={{ ...win95Sunken, background: 'repeating-linear-gradient(90deg,#000080 0 8px,transparent 8px 10px)', backgroundClip: 'content-box', padding: 2 }} />
        <Win95Button style={{ width: 64, height: 22 }}>
          <span className="text-[12px] text-black">OK</span>
        </Win95Button>
      </div>
    </div>
  );
}

export function Win95ErrorPopupSkin(props: SkinProps) {
  const { width, height, onClose } = props;
  return (
    <div className="flex flex-col p-[2px]" style={{ ...win95Raised, width, height, fontFamily: WIN95_FONT }}>
      <Win95TitleBar {...props} showMinMax={false} />
      <div className="flex flex-1 flex-col px-3 pt-4 text-[12px] text-black">
        <div className="flex items-start gap-3">
          {/* Ícone de erro: círculo vermelho com X */}
          <div
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full"
            style={{ background: 'radial-gradient(circle at 35% 30%, #ff7a7a, #e00000 55%, #8a0000)', border: '1px solid #400' }}
          >
            <span className="text-[20px] font-bold leading-none text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
              ✕
            </span>
          </div>
          <div className="leading-snug">
            <p className="font-bold">Erro Fatal 404</p>
            <p className="mt-1">A passagem não foi encontrada.</p>
          </div>
        </div>
        <div className="mt-3 px-2 py-1 font-mono text-[11px]" style={{ ...win95Sunken, background: '#fff' }}>
          C:\ERAS\SETOR2.DLL
        </div>
        <p className="mt-3 leading-snug">
          Este programa executou uma operação ilegal e está bloqueando o corredor.
        </p>
        <p className="mt-2 leading-snug text-[#404040]">Clique em OK para fechá-lo.</p>
      </div>
      <div className="flex justify-center pb-3">
        <Win95Button onClick={onClose} style={{ width: 76, height: 24, outline: '1px dotted #000', outlineOffset: -5 }}>
          <span className="text-[12px] text-black">OK</span>
        </Win95Button>
      </div>
    </div>
  );
}
