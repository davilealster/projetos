import { TEAMS } from "../data";
import { textOn } from "../lib/color";
import { startPanelDrag, type DragPayload } from "../lib/drag";
import type { Team } from "../types";
import { SquadPanel } from "./SquadPanel";

const PALETTE = ["#E8E8E8", "#111111", "#D7263D", "#1B6FD8", "#F4C430", "#1E9E50", "#7A0A2E", "#FF7A00"];

interface Props {
  homeSlug: string;
  oppTeam: Team | null;
  oppSlug: string | null;
  color: string;
  onField: Set<number>;
  onFieldPlayers: Set<number>;
  onColor: (c: string) => void;
  onOppSlug: (s: string | null) => void;
  onDrop: (p: DragPayload, x: number, y: number) => void;
  onActivate: (p: DragPayload) => void;
  onLineUp: () => void;
  safe?: boolean;
}

export function OpponentPanel(props: Props) {
  const select = (
    <select
      className="opp-select"
      value={props.oppSlug ?? ""}
      onChange={(e) => props.onOppSlug(e.target.value || null)}
      aria-label="Adversário"
    >
      <option value="">Fichas numeradas</option>
      {TEAMS.filter((t) => t.slug !== props.homeSlug).map((t) => (
        <option key={t.slug} value={t.slug}>
          {t.shortName}
        </option>
      ))}
    </select>
  );
  const lineUp = (
    <button className="btn btn--ghost btn--sm" onClick={props.onLineUp} title="Posiciona 11 do adversário na formação atual, espelhada">
      Escalar
    </button>
  );

  if (props.oppSlug && props.oppTeam) {
    return (
      <SquadPanel
        title="Adversário"
        players={props.oppTeam.players}
        colors={props.oppTeam.colors}
        kind="oppPlayer"
        onField={props.onFieldPlayers}
        onDrop={props.onDrop}
        onActivate={props.onActivate}
        safe={props.safe}
        headerExtra={<div className="panel__tools">{select}{lineUp}</div>}
      />
    );
  }

  return (
    <section className="panel panel--opp">
      <header className="panel__head">
        <h2>Adversário</h2>
        <div className="panel__tools">
          {select}
          {lineUp}
        </div>
      </header>
      <div className="swatches" role="group" aria-label="Cor das fichas">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`swatch ${props.color.toLowerCase() === c.toLowerCase() ? "is-on" : ""}`}
            style={{ background: c }}
            onClick={() => props.onColor(c)}
            aria-label={`Cor ${c}`}
          />
        ))}
        <label className="swatch swatch--custom" title="Outra cor">
          <input type="color" value={props.color} onChange={(e) => props.onColor(e.target.value)} />
        </label>
      </div>
      <ul className="chips-grid">
        {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => {
          const payload = { kind: "opp" as const, ref: n };
          return (
            <li key={n}>
              <button
                className={`opp-chip ${props.onField.has(n) ? "is-used" : ""}`}
                style={{ background: props.color, color: textOn(props.color), touchAction: "none" }}
                onPointerDown={(e) => startPanelDrag(e, payload, props.onDrop)}
                onDoubleClick={() => props.onActivate(payload)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onActivate(payload);
                  }
                }}
                aria-label={`Ficha ${n}`}
                data-drag-visual
              >
                {n}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
