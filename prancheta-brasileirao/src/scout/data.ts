// Carregamento dos dados do Olheiro: estatísticas (src/data/scout) juntas com o Mercado (src/data/market).
// Por liga-grupo: os percentis comparam cada jogador com a posição dentro do grupo inteiro.
import { MARKET_INDEX, loadLeague } from "../market/data";
import type { MarketLeague } from "../market/types";
import { contractCutFrom, evaluate, toProspect, type ScoutPlayer } from "./metrics";
import type { ScoutIndex, ScoutLeagueFile } from "./types";

// glob (e não import direto): o build funciona mesmo antes da primeira coleta
const indexFiles = import.meta.glob<{ default: ScoutIndex }>("../data/scout/index.json", { eager: true });
const leagueLoaders = import.meta.glob<{ default: ScoutLeagueFile }>("../data/scout/leagues/*.json");

export const SCOUT_INDEX: ScoutIndex = Object.values(indexFiles)[0]?.default ?? { collectedAt: null, leagues: [] };
const scoutIds = new Set(SCOUT_INDEX.leagues.map((l) => l.id).filter((id) => leagueLoaders[`../data/scout/leagues/${id}.json`]));
export const hasScoutData = scoutIds.size > 0;
export const hasScoutLeague = (id: string) => scoutIds.has(id);

export const FREE_CUTOFF = MARKET_INDEX.nextSeasonStart;
export const CONTRACT_CUT = contractCutFrom(MARKET_INDEX.nextSeasonStart);

/** Grupos na ordem do Mercado, só com ligas que têm estatística. */
export const SCOUT_GROUPS: { group: string; leagues: { id: string; name: string }[] }[] = (() => {
  const out: { group: string; leagues: { id: string; name: string }[] }[] = [];
  for (const l of MARKET_INDEX.leagues) {
    if (!scoutIds.has(l.id)) continue;
    let g = out.find((x) => x.group === l.group);
    if (!g) out.push((g = { group: l.group, leagues: [] }));
    g.leagues.push({ id: l.id, name: l.name });
  }
  return out;
})();

export const groupOf = (leagueId: string) => MARKET_INDEX.leagues.find((l) => l.id === leagueId)?.group ?? null;
export const leagueName = (id: string) => MARKET_INDEX.leagues.find((l) => l.id === id)?.name ?? id;

const fileCache = new Map<string, Promise<ScoutLeagueFile | null>>();
export function loadScoutLeague(id: string): Promise<ScoutLeagueFile | null> {
  const load = leagueLoaders[`../data/scout/leagues/${id}.json`];
  if (!load) return Promise.resolve(null);
  if (!fileCache.has(id)) fileCache.set(id, load().then((m) => m.default).catch(() => null));
  return fileCache.get(id)!;
}

const groupCache = new Map<string, Promise<ScoutPlayer[]>>();

/**
 * Jogadores avaliados de um grupo (todas as ligas do grupo com estatística).
 * Jogadores do Mercado sem estatística entram com `stats: null` (sem nota).
 */
export function loadGroup(group: string): Promise<ScoutPlayer[]> {
  if (!groupCache.has(group)) {
    const ids = MARKET_INDEX.leagues.filter((l) => l.group === group && scoutIds.has(l.id)).map((l) => l.id);
    groupCache.set(
      group,
      Promise.all(
        ids.map(async (id) => {
          const [lg, file] = await Promise.all([loadLeague(id) ?? Promise.resolve(null), loadScoutLeague(id)]);
          return { lg, file };
        }),
      ).then((parts) => {
        const pool = parts.flatMap(({ lg, file }) => {
          if (!lg) return [];
          const byId = new Map((file?.players ?? []).map((s) => [s.id, s]));
          return (lg as MarketLeague).players.map((p) => toProspect(p, lg, byId.get(p.id) ?? null, file));
        });
        return evaluate(pool, { contractCut: CONTRACT_CUT });
      }),
    );
  }
  return groupCache.get(group)!;
}

/** Um jogador avaliado (carrega o grupo da liga dele). */
export async function loadScoutPlayer(leagueId: string, id: string): Promise<ScoutPlayer | null> {
  const g = groupOf(leagueId);
  if (!g || !scoutIds.has(leagueId)) return null;
  const list = await loadGroup(g);
  return list.find((x) => x.league === leagueId && x.id === id) ?? null;
}
