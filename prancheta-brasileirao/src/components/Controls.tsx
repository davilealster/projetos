import { FORMATION_NAMES } from "../lib/formations";
import type { DrawTool, ShowOptions } from "../types";
import type { TeleTool } from "./Telestrator";

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

const EraserIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M7 21h10" />
    <path d="M5.5 14.5 14 6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 19.5H8.4L5.5 16.6a1.5 1.5 0 0 1 0-2.1Z" />
    <path d="m9.5 10.5 5 5" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);

export function DrawControls({
  tool, color, onTool, onColor, onErase,
}: {
  tool: TeleTool;
  color: string;
  onTool: (t: TeleTool) => void;
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
      <button
        className={`icon-btn ${tool === "eraser" ? "is-on" : ""}`}
        onClick={() => onTool(tool === "eraser" ? null : "eraser")}
        title="Borracha: clique num desenho para apagar (B)"
        aria-label="Borracha"
        aria-pressed={tool === "eraser"}
      >
        <EraserIcon />
      </button>
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
      <button className="icon-btn" onClick={onErase} title="Apagar todos os desenhos (E)" aria-label="Apagar todos os desenhos">
        <TrashIcon />
      </button>
    </div>
  );
}

const SHOW_LABELS: [keyof ShowOptions, string, string][] = [
  ["pos", "Posição", "Mostrar a posição na peça"],
  ["name", "Nome", "Mostrar o nome abaixo da peça"],
  ["num", "Nº", "Mostrar o número da camisa"],
  ["photo", "Foto", "Mostrar a foto (desligado = só o círculo nas cores do clube)"],
];

/** Liga/desliga o que aparece nas peças dos jogadores. */
export function ShowControls({ value, onChange }: { value: ShowOptions; onChange: (v: ShowOptions) => void }) {
  return (
    <div className="seg show-ctl" role="group" aria-label="Exibir nas peças">
      {SHOW_LABELS.map(([k, label, title]) => (
        <button
          key={k}
          className={`seg__btn ${value[k] ? "is-on" : ""}`}
          onClick={() => onChange({ ...value, [k]: !value[k] })}
          aria-pressed={value[k]}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
