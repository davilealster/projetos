import type { Team, TeamSummary } from "./types";
import index from "./data/teams/index.json";

export const TEAMS = index as TeamSummary[];

// Um chunk por clube: só o JSON do time aberto é baixado.
const loaders = import.meta.glob<{ default: Team }>([
  "./data/teams/*.json",
  "!./data/teams/index.json",
]);

const cache = new Map<string, Promise<Team>>();

export function loadTeam(slug: string): Promise<Team> | null {
  const key = `./data/teams/${slug}.json`;
  const load = loaders[key];
  if (!load) return null;
  if (!cache.has(slug)) cache.set(slug, load().then((m) => m.default));
  return cache.get(slug)!;
}

export const teamSummary = (slug: string | null) => TEAMS.find((t) => t.slug === slug) ?? null;
