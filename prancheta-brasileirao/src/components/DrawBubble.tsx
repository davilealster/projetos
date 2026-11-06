import { useEffect, useState } from "react";
import type { DrawTool } from "../types";
import { DRAW_COLORS } from "./Controls";
import type { TeleTool } from "./Telestrator";

const vibrate = () => navigator.vibrate?.(8);

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS: Record<DrawTool | "eraser" | "hand" | "trash" | "undo", string> = {
  pen: "M4 20l4-1 10-10-3-3L5 16l-1 4ZM14 7l3 3",
  arrow: "M5 19 19 5M10 5h9v9",
  pass: "M4 12h2m3 0h2m3 0h2m2 0h2M16 8l4 4-4 4",
  circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  zone: "M4 6h16v12H4zM4 10h16M4 14h16",
  eraser: "M7 21h10M5.5 14.5 14 6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 19.5H8.4l-2.9-2.9a1.5 1.5 0 0 1 0-2.1ZM9.5 10.5l5 5",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V13m0-4.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.3 15a1.6 1.6 0 0 1 2.4-2.1L8 14",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
};

const TOOLS: { id: TeleTool; key: keyof typeof ICONS; label: string }[] = [
  { id: null, key: "hand", label: "Mover peças" },
  { id: "pen", key: "pen", label: "Caneta" },
  { id: "arrow", key: "arrow", label: "Seta" },
  { id: "pass", key: "pass", label: "Passe" },
  { id: "circle", key: "circle", label: "Círculo" },
  { id: "zone", key: "zone", label: "Zona" },
  { id: "eraser", key: "eraser", label: "Borracha" },
];

/**
 * Botão flutuante (FAB) no canto do campo que abre as ferramentas de desenho em bolhas.
 * Escolher uma ferramenta fecha as bolhas para desenhar; o FAB mostra a ferramenta e a cor ativas.
 */
export function DrawBubble({
  tool, color, onTool, onColor, onEraseAll, onUndo,
}: {
  tool: TeleTool;
  color: string;
  onTool: (t: TeleTool) => void;
  onColor: (c: string) => void;
  onEraseAll: () => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(".bubble")) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0];
  const pick = (t: TeleTool) => {
    vibrate();
    onTool(t);
    setOpen(false);
  };

  return (
    <div className={`bubble ${open ? "is-open" : ""}`}>
      {open && (
        <div className="bubble__stack" role="menu" aria-label="Ferramentas de desenho">
          <div className="bubble__colors" role="group" aria-label="Cor do desenho">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                className={`bubble__dot ${color === c ? "is-on" : ""}`}
                style={{ background: c }}
                onClick={() => (vibrate(), onColor(c))}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <div className="bubble__row">
            <button className="bubble__btn bubble__btn--mini" onClick={() => (vibrate(), onUndo())} aria-label="Desfazer">
              <Icon d={ICONS.undo} size={18} />
            </button>
            <button className="bubble__btn bubble__btn--mini bubble__btn--danger" onClick={() => (vibrate(), onEraseAll(), setOpen(false))} aria-label="Apagar todos os desenhos">
              <Icon d={ICONS.trash} size={18} />
            </button>
          </div>
          {TOOLS.map((t, i) => (
            <button
              key={t.key}
              role="menuitemradio"
              aria-checked={tool === t.id}
              className={`bubble__btn ${tool === t.id ? "is-on" : ""}`}
              style={{ animationDelay: `${(TOOLS.length - i) * 18}ms` }}
              onClick={() => pick(t.id)}
            >
              <span className="bubble__label">{t.label}</span>
              <Icon d={ICONS[t.key]} />
            </button>
          ))}
        </div>
      )}
      <button
        className={`bubble__fab ${tool ? "is-active" : ""}`}
        onClick={() => (vibrate(), setOpen((o) => !o))}
        aria-expanded={open}
        aria-label={open ? "Fechar ferramentas" : `Desenho: ${active.label}`}
        style={{ "--ink": color } as React.CSSProperties}
      >
        {open ? <Icon d="M6 6l12 12M18 6 6 18" size={22} /> : <Icon d={ICONS[active.key]} size={22} />}
      </button>
    </div>
  );
}
