// Arraste do painel para o campo com Pointer Events: um "fantasma" segue o ponteiro
// e, ao soltar, chama onDrop com a posição na tela.
import type { TokenKind } from "../types";

export interface DragPayload {
  kind: TokenKind;
  ref: number;
}

export function startPanelDrag(
  e: React.PointerEvent<HTMLElement>,
  payload: DragPayload,
  onDrop: (p: DragPayload, x: number, y: number) => void,
): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const src = e.currentTarget;
  const startX = e.clientX;
  const startY = e.clientY;
  let ghost: HTMLElement | null = null;

  const makeGhost = () => {
    const visual = (src.querySelector("[data-drag-visual]") as HTMLElement | null) ?? src;
    const r = visual.getBoundingClientRect();
    ghost = visual.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: `${r.width}px`,
      height: `${r.height}px`,
      pointerEvents: "none",
      zIndex: "9999",
      opacity: "0.92",
      transform: `translate(${startX - r.width / 2}px, ${startY - r.height / 2}px) scale(1.1)`,
      filter: "drop-shadow(0 6px 12px rgba(0,0,0,.5))",
    });
    document.body.appendChild(ghost);
  };

  const move = (ev: PointerEvent) => {
    if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) makeGhost();
    if (ghost) {
      const w = ghost.offsetWidth;
      const h = ghost.offsetHeight;
      ghost.style.transform = `translate(${ev.clientX - w / 2}px, ${ev.clientY - h / 2}px) scale(1.1)`;
    }
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    const wasDrag = !!ghost;
    ghost?.remove();
    if (wasDrag) onDrop(payload, ev.clientX, ev.clientY);
  };
  const cancel = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    ghost?.remove();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}
