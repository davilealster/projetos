import type { LinkShape } from "../lib/links";
import type { TeleTool } from "./Telestrator";

const W = 105;
const H = 68;

/**
 * Ligações entre jogadores (linhas e áreas), na camada mais baixa: abaixo dos desenhos e das peças.
 * Sem ferramenta, clicar seleciona; com a borracha, clicar apaga.
 */
export function LinkLayer({
  shapes, draft, vertical, tool, selectedId, onSelect, onRemove,
}: {
  shapes: LinkShape[];
  draft?: LinkShape | null;
  vertical: boolean;
  tool: TeleTool;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onRemove?: (id: string) => void;
}) {
  const xy = ([u, v]: [number, number]) => (vertical ? [v * H, (1 - u) * W] : [u * W, v * H]);
  const vb = vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;
  const interactive = tool === null || tool === "eraser";

  const geom = (s: LinkShape) => s.pts.map((p) => xy(p).join(",")).join(" ");
  const draw = (s: LinkShape, extra: Record<string, unknown> = {}) => {
    const common = {
      points: geom(s),
      stroke: s.color,
      strokeWidth: 0.5,
      strokeLinejoin: "round" as const,
      strokeLinecap: "round" as const,
      strokeDasharray: s.dashed ? "1.3 1" : undefined,
      ...extra,
    };
    return s.closed ? (
      <polygon {...common} fill={s.fill ? s.color : "none"} fillOpacity={s.fill ? 0.2 : undefined} />
    ) : (
      <polyline {...common} fill="none" />
    );
  };

  return (
    <svg className={`links ${tool === "eraser" ? "is-erasing" : ""}`} viewBox={vb} preserveAspectRatio="none" aria-hidden="true">
      {shapes.map((s) => (
        <g key={s.id} className={`links__item ${selectedId === s.id ? "is-selected" : ""}`}>
          {selectedId === s.id && draw(s, { stroke: "#fff", strokeWidth: 1.4, strokeOpacity: 0.5, fill: "none", strokeDasharray: undefined })}
          {draw(s)}
          {/* nós: anel discreto em cada jogador ligado */}
          {s.pts.map((p, i) => {
            const [x, y] = xy(p);
            return <circle key={i} cx={x} cy={y} r={0.9} fill={s.color} />;
          })}
          {interactive &&
            (s.closed ? (
              <polygon
                className="links__hit"
                points={geom(s)}
                fill="none"
                stroke="transparent"
                strokeWidth={2.6}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (tool === "eraser") onRemove?.(s.id);
                  else onSelect?.(s.id);
                }}
              />
            ) : (
              <polyline
                className="links__hit"
                points={geom(s)}
                fill="none"
                stroke="transparent"
                strokeWidth={2.6}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (tool === "eraser") onRemove?.(s.id);
                  else onSelect?.(s.id);
                }}
              />
            ))}
        </g>
      ))}
      {draft && draft.pts.length > 0 && (
        <g className="links__draft">
          {draft.pts.length > 1 && draw({ ...draft, closed: false, dashed: true })}
          {draft.pts.map((p, i) => {
            const [x, y] = xy(p);
            return <circle key={i} cx={x} cy={y} r={i === 0 ? 2.4 : 1.6} fill="none" stroke={draft.color} strokeWidth={0.45} />;
          })}
        </g>
      )}
    </svg>
  );
}
