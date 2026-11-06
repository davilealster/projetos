import { useRef, useState } from "react";
import type { Drawing, DrawTool, Point } from "../types";

const W = 105;
const H = 68;

interface Props {
  vertical: boolean;
  drawings: Drawing[];
  tool: DrawTool | null;
  color: string;
  onAdd: (d: Drawing) => void;
  toCanon: (x: number, y: number) => Point | null;
}

/** Camada SVG de desenho por cima do campo. Coordenadas guardadas em (u, v). */
export function Telestrator({ vertical, drawings, tool, color, onAdd, toCanon }: Props) {
  const [draft, setDraft] = useState<Drawing | null>(null);
  const active = useRef(false);

  // (u, v) -> unidades do SVG (metros)
  const xy = ([u, v]: [number, number]): [number, number] => (vertical ? [v * H, (1 - u) * W] : [u * W, v * H]);
  const vb = vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!tool) return;
    const p = toCanon(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = true;
    setDraft({ id: crypto.randomUUID?.() ?? String(Date.now()), tool, color, pts: [[p.u, p.v], [p.u, p.v]] });
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active.current || !draft) return;
    const p = toCanon(e.clientX, e.clientY);
    if (!p) return;
    const pt: [number, number] = [p.u, p.v];
    setDraft((d) => (d ? { ...d, pts: d.tool === "pen" ? [...d.pts, pt] : [d.pts[0], pt] } : d));
  };
  const up = () => {
    if (!active.current || !draft) return;
    active.current = false;
    const [a, b] = [xy(draft.pts[0]), xy(draft.pts[draft.pts.length - 1])];
    const long = draft.tool === "pen" ? draft.pts.length > 2 : Math.hypot(a[0] - b[0], a[1] - b[1]) > 1;
    if (long) onAdd(draft);
    setDraft(null);
  };

  const render = (d: Drawing, isDraft = false) => {
    const sw = 0.55;
    const pts = d.pts.map(xy);
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const common = { stroke: d.color, strokeWidth: sw, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const marker = `url(#arrow-${d.color.replace("#", "")})`;
    const key = isDraft ? "draft" : d.id;
    switch (d.tool) {
      case "pen":
        return <polyline key={key} points={pts.map((p) => p.join(",")).join(" ")} {...common} />;
      case "arrow":
        return <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} markerEnd={marker} />;
      case "pass":
        return <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} strokeDasharray="1.4 1.2" markerEnd={marker} />;
      case "circle": {
        const r = Math.hypot(a[0] - b[0], a[1] - b[1]);
        return <circle key={key} cx={a[0]} cy={a[1]} r={r} {...common} fill={d.color} fillOpacity={0.12} />;
      }
      case "zone":
        return (
          <rect key={key} x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])}
            {...common} fill={d.color} fillOpacity={0.22} strokeDasharray="0.8 0.6" rx={0.6} />
        );
    }
  };

  const colors = [...new Set([...drawings, ...(draft ? [draft] : [])].map((d) => d.color))];
  return (
    <svg
      className={`telestrator ${tool ? "is-active" : ""}`}
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
      {drawings.map((d) => render(d))}
      {draft && render(draft, true)}
    </svg>
  );
}
