// Funções puras do build do Olheiro (testadas em tests/scout-data.test.ts).
import type { ScoutLeagueFile, ScoutStats } from "../../src/scout/types";

/** Linha de `player_stats` do Transfermarkt (uma competição × temporada × clube). */
export interface TmStat {
  competitionId: string;
  competitionName?: string | null;
  seasonId: string;
  clubId?: string | null;
  appearances?: number | null;
  goals?: number | null;
  assists?: number | null;
  yellowCards?: number | null;
  secondYellowCards?: number | null;
  redCards?: number | null;
  minutesPlayed?: number | null;
  goalsConceded?: number | null;
  cleanSheets?: number | null;
}

export interface TmValuePoint {
  date: string;
  value: number;
}

/** Jogador no arquivo bruto data/scout/tm/{liga}.json (saída de scripts/scout/collect_stats.py). */
export interface RawScoutPlayer {
  id: string;
  stats: TmStat[];
  marketValue?: number | null;
  history: TmValuePoint[];
}

export interface RawScoutLeague {
  id: string;
  collectedAt: string;
  players: RawScoutPlayer[];
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Compara season_id numericamente quando possível ("2025" < "2026"). */
const cmpSeason = (a: string, b: string) => {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
};

/**
 * Competições que formam a liga no Transfermarkt. Ligas com torneios divididos (Apertura/Clausura) têm um id
 * por torneio, e o id do mercado é só o do primeiro: ver scripts/scout/league-comps.json.
 */
export function leagueComps(leagueId: string, map: Record<string, string[]> = {}): string[] {
  return [...new Set([leagueId, ...(map[leagueId] ?? [])])];
}

/**
 * Temporada da liga = maior season_id entre as linhas das competições da liga de todos os jogadores. Os ids
 * do Transfermarkt não seguem um padrão único (Brasil "2025" = 2025; ligas europeias e árabes usam o ano de
 * início ou de fim), então comparamos todo mundo na mais recente com dados.
 */
export function pickSeason(comps: string[], players: Pick<RawScoutPlayer, "stats">[]): string | null {
  let best: string | null = null;
  for (const p of players)
    for (const s of p.stats)
      if (comps.includes(s.competitionId) && s.seasonId && (best === null || cmpSeason(s.seasonId, best) > 0)) best = s.seasonId;
  return best;
}

/** Último valor registrado até `collectedAt` − 365 dias (null se o histórico começa depois). */
export function value12m(history: TmValuePoint[], collectedAt: string): number | null {
  const limit = new Date(collectedAt);
  limit.setUTCDate(limit.getUTCDate() - 365);
  const cut = limit.toISOString().slice(0, 10);
  let best: TmValuePoint | null = null;
  for (const h of history) if (h.date <= cut && (!best || h.date >= best.date)) best = h;
  return best ? best.value : null;
}

export function valuePeak(history: TmValuePoint[]): number | null {
  return history.length ? Math.max(...history.map((h) => h.value)) : null;
}

const leagueRows = (p: Pick<RawScoutPlayer, "stats">, comps: string[], season: string) =>
  p.stats.filter((s) => comps.includes(s.competitionId) && s.seasonId === season);

/**
 * Estatísticas do jogador na liga e temporada dadas (soma as linhas das competições da liga e de cada clube,
 * quando ele trocou de clube no meio da temporada). null quando não entrou em campo na liga nessa temporada.
 */
export function aggregate(p: RawScoutPlayer, comps: string[], season: string, collectedAt: string): ScoutStats | null {
  const rows = leagueRows(p, comps, season);
  const apps = rows.reduce((t, s) => t + n(s.appearances), 0);
  if (!rows.length || apps === 0) return null;
  const sum = (k: keyof TmStat) => rows.reduce((t, s) => t + n(s[k] as number | null | undefined), 0);
  return {
    id: String(p.id),
    apps,
    min: sum("minutesPlayed"),
    goals: sum("goals"),
    assists: sum("assists"),
    yc: sum("yellowCards"),
    rc: sum("redCards") + sum("secondYellowCards"),
    conceded: sum("goalsConceded"),
    cleanSheets: sum("cleanSheets"),
    minAll: p.stats.filter((s) => s.seasonId === season).reduce((t, s) => t + n(s.minutesPlayed), 0),
    value12m: value12m(p.history, collectedAt),
    valuePeak: valuePeak(p.history),
  };
}

/**
 * Minutos possíveis até a coleta ≈ jogos de quem mais jogou na liga × 90. Conta os jogos por jogador e clube
 * (não a soma do jogador), para que quem trocou de clube dentro da liga não infle o total.
 */
export function maxMinutes(players: Pick<RawScoutPlayer, "stats">[], comps: string[], season: string): number {
  let max = 0;
  for (const p of players) {
    const byClub = new Map<string, number>();
    for (const s of leagueRows(p, comps, season)) byClub.set(s.clubId ?? "", (byClub.get(s.clubId ?? "") ?? 0) + n(s.appearances));
    for (const v of byClub.values()) max = Math.max(max, v);
  }
  return max * 90;
}

/** Arquivo da liga (null se nenhum jogador tem dados da liga). */
export function buildLeague(raw: RawScoutLeague, comps: string[] = [raw.id]): ScoutLeagueFile | null {
  const season = pickSeason(comps, raw.players);
  if (!season) return null;
  const seen = new Set<string>();
  const unique = raw.players.filter((p) => !seen.has(String(p.id)) && !!seen.add(String(p.id)));
  const players = unique.map((p) => aggregate(p, comps, season, raw.collectedAt)).filter((s): s is ScoutStats => !!s);
  if (!players.length) return null;
  return { id: raw.id, season, maxMin: maxMinutes(unique, comps, season), collectedAt: raw.collectedAt, players };
}
