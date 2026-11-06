import { useEffect, useRef, useState } from "react";
import type { Drawing, DrawTool, Point } from "../types";

const W = 105;
const H = 68;

/** Ferramenta ativa: desenhar (DrawTool), apagar com clique ("eraser") ou nenhuma (selecionar e arrastar). */
export type TeleTool = DrawTool | "eraser" | null;

interface Props {
  vertical: boolean;
  drawings: Drawing[];
  tool: TeleTool;
  color: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onAdd: (d: Drawing) => void;
  /** desloca o desenho (em coordenadas canônicas) ao soltar */
  onMove?: (id: string, du: number, dv: number) => void;
  onRemove?: (id: string) => void;
  toCanon: (x: number, y: number) => Point | null;
}

/**
 * Camada SVG dos desenhos, ABAIXO das peças. Coordenadas guardadas em (u, v).
 * Sem ferramenta: clique seleciona, arrastar move, Delete apaga. Borracha: clique apaga.
 */
export function Telestrator({ vertical, drawings, tool, color, selectedId, onSelect, onAdd, onMove, onRemove, toCanon }: Props) {
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [drag, setDrag] = useState<{ id: string; su: number; sv: number; du: number; dv: number } | null>(null);
  const drawing = useRef(false);
  const drawMode = !!tool && tool !== "eraser";

  // (u, v) -> unidades do SVG (metros)
  const xy = ([u, v]: [number, number]): [number, number] => (vertical ? [v * H, (1 - u) * W] : [u * W, v * H]);
  const vb = vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;

  // ---- desenhar ----
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawMode) return;
    const p = toCanon(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    onSelect?.(null);
    setDraft({ id: crypto.randomUUID?.() ?? String(Date.now()), tool: tool as DrawTool, color, pts: [[p.u, p.v], [p.u, p.v]] });
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current || !draft) return;
    const p = toCanon(e.clientX, e.clientY);
    if (!p) return;
    const pt: [number, number] = [p.u, p.v];
    setDraft((d) => (d ? { ...d, pts: d.tool === "pen" ? [...d.pts, pt] : [d.pts[0], pt] } : d));
  };
  const up = () => {
    if (!drawing.current || !draft) return;
    drawing.current = false;
    const [a, b] = [xy(draft.pts[0]), xy(draft.pts[draft.pts.length - 1])];
    const long = draft.tool === "pen" ? draft.pts.length > 2 : Math.hypot(a[0] - b[0], a[1] - b[1]) > 1;
    if (long) onAdd(draft);
    setDraft(null);
  };

  // ---- selecionar / arrastar / apagar um desenho ----
  const hitDown = (d: Drawing) => (e: React.PointerEvent<SVGGElement>) => {
    if (drawMode || e.button !== 0) return;
    e.stopPropagation();
    if (tool === "eraser") {
      onRemove?.(d.id);
      return;
    }
    const p = toCanon(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect?.(d.id);
    setDrag({ id: d.id, su: p.u, sv: p.v, du: 0, dv: 0 });
  };
  const hitMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!drag) return;
    const p = toCanon(e.clientX, e.clientY);
    if (p) setDrag({ ...drag, du: p.u - drag.su, dv: p.v - drag.sv });
  };
  const hitUp = () => {
    if (!drag) return;
    if (Math.abs(drag.du) > 0.002 || Math.abs(drag.dv) > 0.002) onMove?.(drag.id, drag.du, drag.dv);
    setDrag(null);
  };

  // clicar fora desmarca; Delete/Backspace apaga o selecionado
  useEffect(() => {
    if (!selectedId) return;
    const off = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(".telestrator__hit")) onSelect?.(null);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, select, textarea")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onRemove?.(selectedId);
      } else if (e.key === "Escape") onSelect?.(null);
    };
    window.addEventListener("pointerdown", off);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", off);
      window.removeEventListener("keydown", key);
    };
  }, [selectedId, onSelect, onRemove]);

  const shape = (d: Drawing, opts: { hit?: boolean; halo?: boolean } = {}) => {
    const off = drag && drag.id === d.id ? drag : null;
    const pts = d.pts.map(([u, v]) => xy(off ? [u + off.du, v + off.dv] : [u, v]));
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const stroke = opts.hit ? "transparent" : opts.halo ? "#ffffff" : d.color;
    const sw = opts.hit ? 2.6 : opts.halo ? 1.5 : 0.55;
    const common = {
      stroke,
      strokeWidth: sw,
      fill: "none",
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      ...(opts.halo ? { strokeOpacity: 0.55 } : {}),
    };
    const marker = opts.hit || opts.halo ? undefined : `url(#arrow-${d.color.replace("#", "")})`;
    switch (d.tool) {
      case "pen":
        return <polyline points={pts.map((p) => p.join(",")).join(" ")} {...common} />;
      case "arrow":
        return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} markerEnd={marker} />;
      case "pass":
        return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} strokeDasharray={opts.hit ? undefined : "1.4 1.2"} markerEnd={marker} />;
      case "circle": {
        const r = Math.hypot(a[0] - b[0], a[1] - b[1]);
        return <circle cx={a[0]} cy={a[1]} r={r} {...common} fill={opts.hit ? "transparent" : opts.halo ? "none" : d.color} fillOpacity={opts.hit || opts.halo ? undefined : 0.12} />;
      }
      case "zone":
        return (
          <rect x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])}
            {...common} fill={opts.hit ? "transparent" : opts.halo ? "none" : d.color} fillOpacity={opts.hit || opts.halo ? undefined : 0.22}
            strokeDasharray={opts.hit || opts.halo ? undefined : "0.8 0.6"} rx={0.6} />
        );
    }
  };

  const colors = [...new Set([...drawings, ...(draft ? [draft] : [])].map((d) => d.color))];
  return (
    <svg
      className={`telestrator ${drawMode ? "is-drawing" : ""} ${tool === "eraser" ? "is-erasing" : ""}`}
      viewBox={vb}
      preserveAspectRatio="none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <defs>
        {colors.map((c) => (
          <marker key={c} id={`arrow-${c.replace("#", "")}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {drawings.map((d) => (
        <g key={d.id} className={`telestrator__item ${selectedId === d.id ? "is-selected" : ""}`}>
          {selectedId === d.id && shape(d, { halo: true })}
          {shape(d)}
          <g
            className={`telestrator__hit telestrator__hit--${d.tool === "circle" || d.tool === "zone" ? "area" : "line"}`}
            onPointerDown={hitDown(d)}
            onPointerMove={hitMove}
            onPointerUp={hitUp}
            onPointerCancel={hitUp}
          >
            {shape(d, { hit: true })}
          </g>
        </g>
      ))}
      {draft && <g>{shape(draft)}</g>}
    </svg>
  );
}
