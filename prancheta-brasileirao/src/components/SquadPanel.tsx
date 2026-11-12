import { useState } from "react";
import { POSITIONS, type Colors, type Player, type Pos, type TokenKind } from "../types";
import { startPanelDrag, type DragPayload } from "../lib/drag";
import { Avatar } from "./Avatar";

interface Props {
  title: string;
  players: Player[];
  colors: Colors;
  kind: Extract<TokenKind, "player" | "oppPlayer">;
  onField: Set<number>;
  onDrop: (p: DragPayload, x: number, y: number) => void;
  onActivate: (p: DragPayload) => void;
  safe?: boolean;
  headerExtra?: React.ReactNode;
  /** selo ao lado do título (ex.: "Elenco atual 2026") */
  badge?: string;
}

export function SquadPanel({ title, players, colors, kind, onField, onDrop, onActivate, safe, headerExtra, badge }: Props) {
  const [filter, setFilter] = useState<Pos | null>(null);
  const present = POSITIONS.filter((p) => players.some((x) => x.pos === p));
  const shown = filter ? players.filter((p) => p.pos === filter) : players;

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>{title}</h2>
        {badge && <span className="panel__badge">{badge}</span>}
        <span className="panel__count">
          {onField.size}/{players.length} em campo
        </span>
        {headerExtra}
      </header>
      <div className="chips" role="toolbar" aria-label="Filtrar por posição">
        <button className={`chip ${!filter ? "is-on" : ""}`} onClick={() => setFilter(null)}>
          Todos
        </button>
        {present.map((p) => (
          <button key={p} className={`chip chip--${p} ${filter === p ? "is-on" : ""}`} onClick={() => setFilter(filter === p ? null : p)}>
            {p}
          </button>
        ))}
      </div>
      <ul className="squad">
        {shown.map((p) => {
          const used = onField.has(p.id);
          const payload = { kind, ref: p.id };
          return (
            <li key={p.id}>
              <button
                className={`squad__item ${used ? "is-used" : ""}`}
                onPointerDown={(e) => startPanelDrag(e, payload, onDrop, onActivate)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onActivate(payload);
                  }
                }}
                aria-label={`${p.name}, ${p.pos}${p.number != null ? `, número ${p.number}` : ""}${used ? ", em campo" : ""}`}
                style={{ touchAction: "none" }}
              >
                <span className="squad__visual" data-drag-visual>
                  <Avatar player={p} colors={colors} size={52} safe={safe} />
                  {p.number != null && <span className="squad__num">{p.number}</span>}
                </span>
                <span className={`pos-badge pos-badge--${p.pos}`}>{p.pos}</span>
                <span className="squad__name">{p.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
