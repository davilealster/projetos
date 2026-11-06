// Ajustes feitos no painel admin (servidos por /api/overrides), aplicados por cima dos dados do build.
import { useEffect, useState } from "react";
import { POSITIONS, type Colors, type Player, type Pos, type Team, type TeamSummary } from "../types";

export interface PlayerOverride {
  pos?: Pos;
  alt?: Pos[];
  displayName?: string;
  number?: number | null;
  hide?: boolean;
  reviewed?: boolean;
}
export interface TeamOverride {
  name?: string;
  shortName?: string;
  colors?: Colors;
}
export interface OverridesDoc {
  version: 1;
  updatedAt: string | null;
  players: Record<string, PlayerOverride>;
  teams: Record<string, TeamOverride>;
}

let pending: Promise<OverridesDoc | null> | null = null;

/** Busca uma vez por visita. Se a API falhar ou demorar, o site segue com os dados do build. */
export function loadOverrides(): Promise<OverridesDoc | null> {
  if (!pending) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    pending = fetch("/api/overrides", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<OverridesDoc>) : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }
  return pending;
}

export function useOverrides(): OverridesDoc | null {
  const [doc, setDoc] = useState<OverridesDoc | null>(null);
  useEffect(() => {
    let alive = true;
    loadOverrides().then((d) => alive && setDoc(d));
    return () => {
      alive = false;
    };
  }, []);
  return doc;
}

export function applyTeamSummary<T extends TeamSummary>(t: T, doc: OverridesDoc | null): T {
  const o = doc?.teams[t.slug];
  if (!o) return t;
  return { ...t, ...(o.name ? { name: o.name } : {}), ...(o.shortName ? { shortName: o.shortName } : {}), ...(o.colors ? { colors: o.colors } : {}) };
}

export function applyPlayer(p: Player, o: PlayerOverride | undefined): Player {
  if (!o) return p;
  const pos = o.pos ?? p.pos;
  const alt = (o.alt ?? p.alt ?? []).filter((a) => a !== pos).slice(0, 2);
  return {
    ...p,
    pos,
    alt,
    name: o.displayName || p.name,
    number: o.number !== undefined ? o.number : p.number,
  };
}

export function sortSquad(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const d = POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos);
    if (d) return d;
    return (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "pt-BR");
  });
}

export function applyTeam(team: Team, doc: OverridesDoc | null): Team {
  if (!doc) return team;
  const players = team.players
    .filter((p) => !doc.players[String(p.id)]?.hide)
    .map((p) => applyPlayer(p, doc.players[String(p.id)]));
  return { ...applyTeamSummary(team, doc), players: sortSquad(players) };
}
