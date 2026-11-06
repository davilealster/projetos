// Lógica pura do pipeline (sem I/O), coberta por tests/core.test.ts.

export const POSITIONS = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PON", "ATA"] as const;
export type Pos = (typeof POSITIONS)[number];

/** Jogador como vem de /players/squads da API-Football. */
export interface RawPlayer {
  id: number;
  name: string;
  age?: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}

/** Correção manual em data/overrides/{slug}.json, indexada pelo id da API. */
export interface Override {
  pos?: Pos;
  displayName?: string;
  number?: number | null;
  hide?: boolean;
}

/** Sugestão vinda do TheSportsDB (data/sportsdb/{slug}.json). */
export interface Suggestion {
  strPosition?: string;
  pos?: Pos;
  fullName?: string;
}

export type PosSource = "override" | "sportsdb" | "api";

export interface BuiltPlayer {
  id: number;
  name: string;
  number: number | null;
  pos: Pos;
  photo: string | null;
}

export interface BuiltPlayerWithMeta extends BuiltPlayer {
  posSource: PosSource;
  nameSource: "override" | "sportsdb" | "api";
}

/** Minúsculas, sem acento, só letras/dígitos separados por espaço. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Encontra o slug cujo alias bate com o nome do time vindo da API. */
export function matchTeamSlug(
  apiName: string,
  aliasesBySlug: Record<string, string[]>,
): string | null {
  const n = normalize(apiName);
  for (const [slug, aliases] of Object.entries(aliasesBySlug)) {
    if (aliases.some((a) => normalize(a) === n)) return slug;
  }
  return null;
}

/** Mapeamento padrão das 4 posições da API-Football. */
export function mapApiPosition(position: string | null | undefined): Pos {
  switch ((position ?? "").toLowerCase()) {
    case "goalkeeper":
      return "GOL";
    case "defender":
      return "ZAG";
    case "midfielder":
      return "MEI";
    case "attacker":
      return "ATA";
    default:
      return "MEI";
  }
}

/** Posições específicas do TheSportsDB → nossa sigla. null se não reconhecer. */
export function mapSportsDbPosition(strPosition: string | null | undefined): Pos | null {
  const p = normalize(strPosition ?? "");
  if (!p) return null;
  const table: [RegExp, Pos][] = [
    [/goalkeeper|keeper/, "GOL"],
    [/right back|right wing back|right defender/, "LD"],
    [/left back|left wing back|left defender/, "LE"],
    [/centre back|center back|central defender|^defender$/, "ZAG"],
    [/defensive midfield/, "VOL"],
    [/right wing|left wing|winger/, "PON"],
    [/central midfield|attacking midfield|^midfielder$|right midfield|left midfield/, "MEI"],
    [/centre forward|center forward|striker|second striker|^forward$|attacker/, "ATA"],
  ];
  for (const [re, pos] of table) if (re.test(p)) return pos;
  return null;
}

/** "L. Jardim" → true. A API-Football costuma abreviar o primeiro nome. */
export function isAbbreviated(name: string): boolean {
  return /^\p{L}\.\s/u.test(name.trim());
}

/**
 * Casa um jogador da API (nome possivelmente abreviado) com um nome do TheSportsDB.
 * Regra: mesmo sobrenome (último token) e, se abreviado, mesma inicial.
 * Retorna o índice do candidato ou -1. Ambíguo (2+ candidatos) também retorna -1.
 */
export function matchPlayerName(apiName: string, candidates: string[]): number {
  const a = normalize(apiName);
  const exact = candidates.findIndex((c) => normalize(c) === a);
  if (exact >= 0) return exact;

  const tokens = a.split(" ");
  const last = tokens[tokens.length - 1];
  const initial = isAbbreviated(apiName) ? tokens[0][0] : null;
  const hits: number[] = [];
  candidates.forEach((c, i) => {
    const ct = normalize(c).split(" ");
    if (!ct.includes(last)) return;
    if (initial && ct[0][0] !== initial) return;
    hits.push(i);
  });
  return hits.length === 1 ? hits[0] : -1;
}

/** Ordena por posição (GOL, ZAG, LD, LE, VOL, MEI, PON, ATA), depois número, depois nome. */
export function sortPlayers<T extends { pos: Pos; number: number | null; name: string }>(
  players: T[],
): T[] {
  return [...players].sort((x, y) => {
    const d = POSITIONS.indexOf(x.pos) - POSITIONS.indexOf(y.pos);
    if (d) return d;
    const nx = x.number ?? Number.MAX_SAFE_INTEGER;
    const ny = y.number ?? Number.MAX_SAFE_INTEGER;
    if (nx !== ny) return nx - ny;
    return x.name.localeCompare(y.name, "pt-BR");
  });
}

/**
 * Junta elenco bruto + overrides + sugestões. Prioridade: override > TheSportsDB > API.
 * `hasPhoto(id)` diz se existe foto válida (não placeholder) para o jogador.
 */
export function mergePlayers(opts: {
  slug: string;
  raw: RawPlayer[];
  overrides: Record<string, Override>;
  suggestions: Record<string, Suggestion>;
  hasPhoto: (id: number) => boolean;
}): BuiltPlayerWithMeta[] {
  const { slug, raw, overrides, suggestions, hasPhoto } = opts;
  const seen = new Set<number>();
  const out: BuiltPlayerWithMeta[] = [];

  for (const p of raw) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const ov = overrides[String(p.id)] ?? {};
    if (ov.hide) continue;
    const sg = suggestions[String(p.id)] ?? {};

    let pos: Pos;
    let posSource: PosSource;
    if (ov.pos) [pos, posSource] = [ov.pos, "override"];
    else if (sg.pos) [pos, posSource] = [sg.pos, "sportsdb"];
    else [pos, posSource] = [mapApiPosition(p.position), "api"];

    let name: string;
    let nameSource: BuiltPlayerWithMeta["nameSource"];
    if (ov.displayName) [name, nameSource] = [ov.displayName, "override"];
    else if (sg.fullName && isAbbreviated(p.name)) [name, nameSource] = [sg.fullName, "sportsdb"];
    else [name, nameSource] = [p.name.trim(), "api"];

    const number = ov.number !== undefined ? ov.number : p.number ?? null;

    out.push({
      id: p.id,
      name,
      number,
      pos,
      photo: hasPhoto(p.id) ? `/players/${slug}/${p.id}.webp` : null,
      posSource,
      nameSource,
    });
  }
  return sortPlayers(out);
}

/** Posições que a API não consegue detalhar e por isso merecem revisão manual. */
export function needsPositionReview(p: BuiltPlayerWithMeta): boolean {
  return p.posSource === "api" && (p.pos === "ZAG" || p.pos === "MEI" || p.pos === "ATA");
}

/** Remove os campos de metadados antes de gravar o JSON do front. */
export function stripMeta(p: BuiltPlayerWithMeta): BuiltPlayer {
  const { posSource: _a, nameSource: _b, ...rest } = p;
  return rest;
}
