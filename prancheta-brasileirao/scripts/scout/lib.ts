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
 * Temporada da liga = maior season_id entre as linhas da própria liga (competitionId === liga) de todos os
 * jogadores. Os ids do Transfermarkt não seguem um padrão único (Brasil "2025" = 2025; ligas europeias e
 * árabes usam o ano de início ou de fim), então comparamos todo mundo na mais recente com dados.
 */
export function pickSeason(leagueId: string, players: Pick<RawScoutPlayer, "stats">[]): string | null {
  let best: string | null = null;
  for (const p of players)
    for (const s of p.stats)
      if (s.competitionId === leagueId && s.seasonId && (best === null || cmpSeason(s.seasonId, best) > 0)) best = s.seasonId;
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

/**
 * Estatísticas do jogador na liga e temporada dadas (soma as linhas quando ele trocou de clube dentro da
 * mesma competição). null quando não entrou em campo na liga nessa temporada.
 */
export function aggregate(p: RawScoutPlayer, leagueId: string, season: string, collectedAt: string): ScoutStats | null {
  const rows = p.stats.filter((s) => s.competitionId === leagueId && s.seasonId === season);
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
 * Minutos possíveis até a coleta ≈ jogos de quem mais jogou na liga × 90. Recebe linhas por clube (não a soma
 * do jogador), para que quem trocou de clube dentro da liga não infle o total.
 */
export function maxMinutes(players: Pick<ScoutStats, "apps">[]): number {
  return players.reduce((m, p) => Math.max(m, p.apps), 0) * 90;
}

/** Arquivo da liga (null se nenhum jogador tem dados da liga). */
export function buildLeague(raw: RawScoutLeague): ScoutLeagueFile | null {
  const season = pickSeason(raw.id, raw.players);
  if (!season) return null;
  const seen = new Set<string>();
  const players: ScoutStats[] = [];
  for (const p of raw.players) {
    if (seen.has(String(p.id))) continue;
    seen.add(String(p.id));
    const s = aggregate(p, raw.id, season, raw.collectedAt);
    if (s) players.push(s);
  }
  if (!players.length) return null;
  const rows = raw.players.flatMap((p) => p.stats.filter((s) => s.competitionId === raw.id && s.seasonId === season));
  const maxMin = maxMinutes(rows.map((r) => ({ apps: n(r.appearances) })));
  return { id: raw.id, season, maxMin, collectedAt: raw.collectedAt, players };
}
