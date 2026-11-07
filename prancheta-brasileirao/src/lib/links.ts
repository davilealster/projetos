// Ligações entre jogadores: linhas (contínuas ou pontilhadas) e áreas que acompanham as peças.
// Guardamos QUEM está ligado (não coordenadas); os pontos são recalculados a cada render.
import { slotsFor } from "./formations";
import type { Player, Pos, Token, TokenKind } from "../types";

export interface TokenRef {
  kind: TokenKind;
  ref: number;
}

export type LinkTeam = "home" | "opp";
/** hull = bloco do time (contorno/área); def/mid/att = linha de cada setor */
export type LinkGroup = "hull" | "def" | "mid" | "att";

export type LinkSource =
  | { type: "manual"; members: TokenRef[] }
  | { type: "auto"; team: LinkTeam; group: LinkGroup };

export interface Link {
  id: string;
  source: LinkSource;
  closed: boolean;
  fill: boolean;
  dashed: boolean;
  color: string;
}

/** Forma pronta para desenhar: pontos em (u, v) na ordem de ligação. */
export interface LinkShape {
  id: string;
  pts: [number, number][];
  closed: boolean;
  fill: boolean;
  dashed: boolean;
  color: string;
}

export const GROUP_ROLES: Record<Exclude<LinkGroup, "hull">, Pos[]> = {
  def: ["ZAG", "LD", "LE"],
  mid: ["VOL", "MEI"],
  att: ["PON", "ATA"],
};

export const GROUP_LABEL: Record<LinkGroup, string> = {
  hull: "Bloco (área)",
  def: "Linha de defesa",
  mid: "Linha do meio",
  att: "Linha de ataque",
};

const sameRef = (a: TokenRef, b: TokenRef) => a.kind === b.kind && a.ref === b.ref;

/** Função em campo: a escolhida na escalação, a posição do jogador, ou a vaga da ficha numerada. */
export function roleOf(
  t: Token,
  ctx: { players: Map<number, Player>; opp: Map<number, Player>; formation: string },
): Pos | null {
  if (t.as) return t.as;
  if (t.kind === "player") return ctx.players.get(t.ref)?.pos ?? null;
  if (t.kind === "oppPlayer") return ctx.opp.get(t.ref)?.pos ?? null;
  if (t.kind === "opp") return slotsFor(ctx.formation, false)[t.ref - 1]?.role ?? null;
  return null;
}

const teamOf = (t: Token): LinkTeam | null =>
  t.kind === "player" ? "home" : t.kind === "opp" || t.kind === "oppPlayer" ? "opp" : null;

/** Envoltória convexa (monotone chain) em metros, para o "bloco" do time. Retorna índices. */
export function convexHull(pts: [number, number][]): number[] {
  const idx = pts.map((_, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
  if (idx.length < 3) return idx;
  const cross = (o: number, a: number, b: number) =>
    (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
  const lower: number[] = [];
  for (const i of idx) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
    lower.push(i);
  }
  const upper: number[] = [];
  for (const i of [...idx].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
    upper.push(i);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Converte cada ligação em pontos a partir das peças atuais. Ligações sem peças suficientes somem (até voltarem). */
export function computeLinkShapes(
  links: Link[],
  tokens: Token[],
  ctx: { players: Map<number, Player>; opp: Map<number, Player>; formation: string },
): LinkShape[] {
  const out: LinkShape[] = [];
  for (const l of links) {
    let pts: [number, number][] = [];
    if (l.source.type === "manual") {
      for (const m of l.source.members) {
        const t = tokens.find((x) => sameRef(x, m));
        if (t) pts.push([t.u, t.v]);
      }
    } else {
      const { team, group } = l.source;
      const mine = tokens.filter((t) => teamOf(t) === team && roleOf(t, ctx) !== "GOL");
      if (group === "hull") {
        const raw = mine.map((t) => [t.u, t.v] as [number, number]);
        const meters = raw.map(([u, v]) => [u * 105, v * 68] as [number, number]);
        pts = convexHull(meters).map((i) => raw[i]);
      } else {
        const roles = GROUP_ROLES[group];
        // linha de setor: atravessa o campo pela largura (v)
        pts = mine
          .filter((t) => roles.includes(roleOf(t, ctx) as Pos))
          .sort((a, b) => a.v - b.v)
          .map((t) => [t.u, t.v]);
      }
    }
    const closed = l.closed && pts.length >= 3;
    if (pts.length < 2) continue;
    out.push({ id: l.id, pts, closed, fill: closed && l.fill, dashed: l.dashed, color: l.color });
  }
  return out;
}

export const newLinkId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 12);

/** Liga/desliga uma linha automática (o mesmo botão cria e remove). */
export function toggleAutoLink(links: Link[], team: LinkTeam, group: LinkGroup, color: string): Link[] {
  const i = links.findIndex((l) => l.source.type === "auto" && l.source.team === team && l.source.group === group);
  if (i >= 0) return links.filter((_, j) => j !== i);
  const hull = group === "hull";
  return [
    ...links,
    { id: newLinkId(), source: { type: "auto", team, group }, closed: hull, fill: hull, dashed: !hull, color },
  ];
}

export const hasAutoLink = (links: Link[], team: LinkTeam, group: LinkGroup) =>
  links.some((l) => l.source.type === "auto" && l.source.team === team && l.source.group === group);
