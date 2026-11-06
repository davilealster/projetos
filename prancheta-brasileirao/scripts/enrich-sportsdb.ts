// Etapa 2b (opcional): busca posições específicas e nomes completos no TheSportsDB
// e grava sugestões em data/sportsdb/{slug}.json, indexadas pelo id da API-Football.
// Uso: npm run fetch:sportsdb [-- --team=vasco] [-- --force]
import { existsSync } from "node:fs";
import { mapSportsDbPosition, matchPlayerName, normalize, type RawPlayer, type Suggestion } from "./lib/core";
import {
  PATHS, env, loadEnv, loadTeamMap, parseArgs, readJson, runIfMain, saveTeamMap, selectSlugs, sleep, writeJson,
} from "./lib/io";

interface SdbTeam { idTeam: string; strTeam: string; strCountry?: string; strSport?: string }
interface SdbPlayer { idPlayer: string; strPlayer: string; strPosition?: string; strNumber?: string }

async function sdb<T>(path: string): Promise<T> {
  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${env.sportsDbKey()}/${path}`);
  if (!res.ok) throw new Error(`TheSportsDB ${res.status} em ${path}`);
  return (await res.json()) as T;
}

export async function enrichSportsDb({ teams = null as string[] | null, force = false } = {}) {
  loadEnv();
  const map = loadTeamMap();

  for (const slug of selectSlugs(map, teams)) {
    const out = PATHS.sportsdb(slug);
    if (!force && existsSync(out)) {
      console.log(`${slug}: sugestões já existem (use --force para refazer)`);
      continue;
    }
    const entry = map[slug];
    try {
      if (!entry.sportsDbId) {
        for (const alias of entry.aliases) {
          const r = await sdb<{ teams: SdbTeam[] | null }>(`searchteams.php?t=${encodeURIComponent(alias)}`);
          const hit = (r.teams ?? []).find((t) => t.strSport === "Soccer" && t.strCountry === "Brazil");
          await sleep(1200);
          if (hit) {
            entry.sportsDbId = hit.idTeam;
            saveTeamMap(map);
            break;
          }
        }
      }
      if (!entry.sportsDbId) {
        console.warn(`⚠ ${slug}: time não encontrado no TheSportsDB`);
        continue;
      }

      const r = await sdb<{ player: SdbPlayer[] | null }>(`lookup_all_players.php?id=${entry.sportsDbId}`);
      await sleep(1200);
      const sdbPlayers = r.player ?? [];
      const raw = readJson<{ players: RawPlayer[] }>(PATHS.raw(slug), { players: [] });
      const names = sdbPlayers.map((x) => x.strPlayer);

      const suggestions: Record<string, Suggestion> = {};
      let matched = 0;
      for (const pl of raw.players) {
        const i = matchPlayerName(pl.name, names);
        if (i < 0) continue;
        matched++;
        const sp = sdbPlayers[i];
        const s: Suggestion = { strPosition: sp.strPosition, fullName: sp.strPlayer };
        const pos = mapSportsDbPosition(sp.strPosition);
        if (pos) s.pos = pos;
        if (normalize(sp.strPlayer) === normalize(pl.name)) delete s.fullName;
        suggestions[String(pl.id)] = s;
      }
      writeJson(out, suggestions);
      console.log(`${slug}: ${sdbPlayers.length} no TheSportsDB, ${matched}/${raw.players.length} casados`);
    } catch (err) {
      console.warn(`⚠ ${slug}: ${(err as Error).message}`);
    }
  }
}

runIfMain(import.meta.url, () => enrichSportsDb(parseArgs()));
