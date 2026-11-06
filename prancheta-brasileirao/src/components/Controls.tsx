import { FORMATION_NAMES } from "../lib/formations";
import type { DrawTool } from "../types";

export const DRAW_COLORS = ["#FFD400", "#FFFFFF", "#FF3B30", "#00D1FF", "#111111"];

const TOOLS: { id: DrawTool; label: string; icon: string }[] = [
  { id: "pen", label: "Caneta livre", icon: "✎" },
  { id: "arrow", label: "Seta", icon: "➚" },
  { id: "pass", label: "Linha de passe", icon: "⇢" },
  { id: "circle", label: "Círculo", icon: "◯" },
  { id: "zone", label: "Zona", icon: "▭" },
];

export function FormationButtons({ value, onPick }: { value: string; onPick: (f: string) => void }) {
  return (
    <div className="seg" role="group" aria-label="Formações">
      {FORMATION_NAMES.map((f, i) => (
        <button key={f} className={`seg__btn ${value === f ? "is-on" : ""}`} onClick={() => onPick(f)} title={`${f} (tecla ${i + 1})`}>
          {f}
        </button>
      ))}
    </div>
  );
}

export function DrawControls({
  tool, color, onTool, onColor, onErase,
}: {
  tool: DrawTool | null;
  color: string;
  onTool: (t: DrawTool | null) => void;
  onColor: (c: string) => void;
  onErase: () => void;
}) {
  return (
    <div className="draw" role="group" aria-label="Desenho">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`icon-btn ${tool === t.id ? "is-on" : ""}`}
          onClick={() => onTool(tool === t.id ? null : t.id)}
          title={`${t.label} (D)`}
          aria-label={t.label}
          aria-pressed={tool === t.id}
        >
          {t.icon}
        </button>
      ))}
      <span className="draw__sep" />
      {DRAW_COLORS.map((c) => (
        <button
          key={c}
          className={`dot ${color === c ? "is-on" : ""}`}
          style={{ background: c }}
          onClick={() => onColor(c)}
          aria-label={`Cor ${c}`}
        />
      ))}
      <button className="icon-btn" onClick={onErase} title="Apagar desenhos (E)" aria-label="Apagar desenhos">
        ⌫
      </button>
    </div>
  );
}
