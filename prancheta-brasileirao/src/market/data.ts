import { emptyMarketState, type MarketState } from "./logic";
import type { ClubMarket, MarketCoach, MarketIndex, MarketLeague } from "./types";
import indexJson from "../data/market/index.json";

export const MARKET_INDEX = indexJson as MarketIndex;
export const hasMarketData = MARKET_INDEX.leagues.length > 0;

// um arquivo por liga e por clube: só baixa o que for usado
const leagueLoaders = import.meta.glob<{ default: MarketLeague }>("../data/market/leagues/*.json");
const clubLoaders = import.meta.glob<{ default: ClubMarket }>("../data/market/clubs/*.json");
const coachLoaders = import.meta.glob<{ default: MarketCoach[] }>("../data/market/coaches.json");
let coachCache: Promise<MarketCoach[]> | null = null;

/** Técnicos de todos os clubes coletados (para contratar). */
export function loadCoaches(): Promise<MarketCoach[]> {
  const load = Object.values(coachLoaders)[0];
  if (!load) return Promise.resolve([]);
  return (coachCache ??= load().then((m) => m.default));
}
const leagueCache = new Map<string, Promise<MarketLeague>>();

export function loadLeague(id: string): Promise<MarketLeague> | null {
  const load = leagueLoaders[`../data/market/leagues/${id}.json`];
  if (!load) return null;
  if (!leagueCache.has(id)) leagueCache.set(id, load().then((m) => m.default));
  return leagueCache.get(id)!;
}

export async function loadClubMarket(slug: string): Promise<ClubMarket | null> {
  const load = clubLoaders[`../data/market/clubs/${slug}.json`];
  return load ? (await load()).default : null;
}

const key = (slug: string) => `mercado:${slug}:v1`;

export function loadMarketState(slug: string): MarketState {
  try {
    const raw = localStorage.getItem(key(slug));
    if (raw) return { ...emptyMarketState(), ...(JSON.parse(raw) as Partial<MarketState>) };
  } catch {
    /* modo privado: segue sem salvar */
  }
  return emptyMarketState();
}

export function saveMarketState(slug: string, st: MarketState): void {
  try {
    localStorage.setItem(key(slug), JSON.stringify(st));
  } catch {
    /* ignore */
  }
}
