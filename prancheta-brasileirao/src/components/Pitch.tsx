import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { Drawing, Point, Token } from "../types";
import { PitchMarkings } from "./PitchMarkings";
import { Telestrator, type TeleTool } from "./Telestrator";
import { LinkLayer } from "./LinkLayer";
import type { LinkShape } from "../lib/links";

export interface PitchHandle {
  /** Converte posição na tela para coordenada canônica; null se fora do campo (com folga). */
  toCanon(x: number, y: number, slack?: number): Point | null;
}

export interface TokenRender {
  key: string;
  token: Token;
  node: React.ReactNode;
  label: string;
}

interface Props {
  vertical: boolean;
  tokens: TokenRender[];
  tokenScale: number;
  drawings: Drawing[];
  drawTool: TeleTool;
  selectedDrawing?: string | null;
  onSelectDrawing?: (id: string | null) => void;
  onMoveDrawing?: (id: string, du: number, dv: number) => void;
  onRemoveDrawing?: (id: string) => void;
  drawColor: string;
  onAddDrawing: (d: Drawing) => void;
  onMoveToken: (index: number, p: Point, commit: boolean) => void;
  onRemoveToken: (index: number) => void;
  onDropToken: (index: number, p: Point) => void;
  /** toque/clique simples numa peça (sem arrastar) */
  onTapToken?: (index: number) => void;
  /** ligações entre jogadores já calculadas, e a que está sendo montada */
  links?: LinkShape[];
  linkDraft?: LinkShape | null;
  selectedLink?: string | null;
  onSelectLink?: (id: string | null) => void;
  onRemoveLink?: (id: string) => void;
  /** modo "Ligar": toque numa peça adiciona à ligação */
  onLinkTap?: (index: number) => void;
  stripes?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Campo + peças + camada de desenho. Posições em % do campo, a partir de (u, v). */
export const Pitch = forwardRef<PitchHandle, Props>(function Pitch(props, ref) {
  const { vertical } = props;
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldW, setFieldW] = useState(800);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFieldW(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toCanon = (x: number, y: number, slack = 0.03): Point | null => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r) return null;
    const fx = (x - r.left) / r.width;
    const fy = (y - r.top) / r.height;
    if (fx < -slack || fx > 1 + slack || fy < -slack || fy > 1 + slack) return null;
    const cx = Math.min(1, Math.max(0, fx));
    const cy = Math.min(1, Math.max(0, fy));
    return vertical ? { u: 1 - cy, v: cx } : { u: cx, v: cy };
  };
  useImperativeHandle(ref, () => ({ toCanon }));

  // tamanho de referência das peças: largura do lado curto do campo
  const shortSide = vertical ? fieldW : (fieldW * 68) / 105;
  // em campo pequeno (painel aberto no celular, celular deitado) as peças encolhem junto
  const tok = Math.max(16, shortSide * 0.085 * props.tokenScale);
  const tiny = tok < 26;

  return (
    <div
      className={`pitch ${vertical ? "pitch--vertical" : ""} ${props.drawTool && props.drawTool !== "link" ? "pitch--tool" : ""} ${props.drawTool === "link" ? "pitch--linking" : ""} ${tiny ? "pitch--tiny" : ""} ${props.className ?? ""}`}
      style={{ "--tok": `${tok}px` } as React.CSSProperties}
    >
      <PitchMarkings vertical={vertical} stripes={props.stripes} />
      <div className="pitch__field" ref={fieldRef}>
        <LinkLayer
          shapes={props.links ?? []}
          draft={props.linkDraft}
          vertical={vertical}
          tool={props.drawTool}
          selectedId={props.selectedLink}
          onSelect={props.onSelectLink}
          onRemove={props.onRemoveLink}
        />
        <Telestrator
          vertical={vertical}
          drawings={props.drawings}
          tool={props.drawTool}
          color={props.drawColor}
          onAdd={props.onAddDrawing}
          selectedId={props.selectedDrawing}
          onSelect={props.onSelectDrawing}
          onMove={props.onMoveDrawing}
          onRemove={props.onRemoveDrawing}
          toCanon={(x, y) => toCanon(x, y, 0)}
        />
        {props.tokens.map((t, i) => (
          <TokenView
            key={t.key}
            index={i}
            item={t}
            vertical={vertical}
            disabled={!!props.drawTool && props.drawTool !== "link"}
            onLinkTap={props.drawTool === "link" ? props.onLinkTap : undefined}
            toCanon={toCanon}
            onMove={props.onMoveToken}
            onRemove={props.onRemoveToken}
            onDrop={props.onDropToken}
            onTap={props.onTapToken}
          />
        ))}
        {props.children}
      </div>
    </div>
  );
});

function TokenView({
  index, item, vertical, disabled, toCanon, onMove, onRemove, onDrop, onTap, onLinkTap,
}: {
  onLinkTap?: (index: number) => void;
  onTap?: (index: number) => void;
  index: number;
  item: TokenRender;
  vertical: boolean;
  disabled: boolean;
  toCanon: PitchHandle["toCanon"];
  onMove: Props["onMoveToken"];
  onRemove: Props["onRemoveToken"];
  onDrop: Props["onDropToken"];
}) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ moved: boolean; timer: number; sx: number; sy: number } | null>(null);
  const tapTimer = useRef<number | null>(null);
  // um toque = onTap (com atraso para não confundir com o duplo); dois toques = remover
  const tap = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onRemove(index);
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      onTap?.(index);
    }, 260);
  };
  const { token } = item;
  const left = vertical ? token.v : token.u;
  const top = vertical ? 1 - token.u : token.v;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    if (onLinkTap) {
      e.stopPropagation();
      onLinkTap(index);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const timer = window.setTimeout(() => {
      // toque longo sem mover = remover
      if (drag.current && !drag.current.moved) {
        drag.current = null;
        setDragging(false);
        onRemove(index);
      }
    }, 650);
    drag.current = { moved: false, timer, sx: e.clientX, sy: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      clearTimeout(d.timer);
      setDragging(true);
    }
    const p = toCanon(e.clientX, e.clientY, 0.2);
    if (p) onMove(index, p, false);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    clearTimeout(d.timer);
    if (!d.moved) return tap();
    const p = toCanon(e.clientX, e.clientY, 0.02);
    if (!p) onRemove(index); // soltou fora do campo: volta ao painel
    else onDrop(index, p);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const dir: Record<string, [number, number]> = vertical
      ? { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] }
      : { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (dir[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      const [du, dv] = dir[e.key];
      const clamp = (n: number) => Math.min(1, Math.max(0, n));
      onMove(index, { u: clamp(token.u + du), v: clamp(token.v + dv) }, true);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove(index);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap?.(index);
    }
  };

  return (
    <div
      className={`token token--${token.kind} ${dragging ? "is-dragging" : ""}`}
      style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (drag.current) clearTimeout(drag.current.timer);
        drag.current = null;
        setDragging(false);
      }}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={item.label}
      data-token={item.key}
    >
      {item.node}
    </div>
  );
}
