// Etapa 2b (opcional): busca posições específicas e nomes completos no TheSportsDB
// e grava sugestões em data/sportsdb/{slug}.json, indexadas pelo id da API-Football.
// Uso: npm run fetch:sportsdb [-- --team=vasco] [-- --force]
import { existsSync } from "node:fs";
import { mapSportsDbPosition, matchPlayerName, normalize, type RawPlayer, type Suggestion } from "./lib/core";
import {
  PATHS, env, loadEnv, loadTeamMap, parseArgs, readJson, runIfMain, saveTeamMap, selectSlugs, sleep, writeJson,
} from "./lib/io";

interface SdbTeam { idTeam: string; strTeam: string; strCountry?: string; strSport?: string; strGender?: string }
interface SdbPlayer { idPlayer: string; strPlayer: string; strPosition?: string; strNumber?: string }

async function sdb<T>(path: string, attempt = 1): Promise<T> {
  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${env.sportsDbKey()}/${path}`);
  if (res.status === 429 && attempt <= 3) {
    console.log(`  TheSportsDB limitou a taxa, aguardando 61 s (tentativa ${attempt}/3)`);
    await sleep(61_000);
    return sdb<T>(path, attempt + 1);
  }
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
          const hit = (r.teams ?? []).find((t) => t.strSport === "Soccer" && t.strCountry === "Brazil" && t.strGender !== "Female");
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

      // Casamento um para um: se dois jogadores da API caem no mesmo nome, nenhum dos dois leva sugestão.
      const hits = raw.players.map((pl) => matchPlayerName(pl.name, names));
      const uses = new Map<number, number>();
      for (const i of hits) if (i >= 0) uses.set(i, (uses.get(i) ?? 0) + 1);

      const suggestions: Record<string, Suggestion> = {};
      let matched = 0;
      for (const [k, pl] of raw.players.entries()) {
        const i = hits[k];
        if (i < 0 || uses.get(i)! > 1) continue;
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
