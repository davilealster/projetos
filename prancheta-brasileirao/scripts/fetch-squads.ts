// Etapa 2: baixa o elenco de cada time (/players/squads), com cache em disco e 1,5 s entre chamadas.
// Uso: npm run fetch:squads [-- --team=vasco] [-- --force]
import { existsSync } from "node:fs";
import type { RawPlayer } from "./lib/core";
import {
  PATHS, apiFootball, loadEnv, loadTeamMap, parseArgs, readJson, runIfMain, selectSlugs, sleep, writeJson,
} from "./lib/io";

interface SquadResponse {
  team: { id: number; name: string };
  players: RawPlayer[];
}

export async function fetchSquads({ teams = null as string[] | null, force = false } = {}) {
  loadEnv();
  const map = loadTeamMap();
  let calls = 0;

  for (const slug of selectSlugs(map, teams)) {
    const apiId = map[slug].apiId;
    if (!apiId) {
      console.warn(`⚠ ${slug} sem apiId. Rode fetch:teams antes.`);
      continue;
    }
    const cache = PATHS.squadCache(slug);
    let players: RawPlayer[];
    if (!force && existsSync(cache)) {
      players = readJson<RawPlayer[]>(cache);
      console.log(`${slug}: ${players.length} jogadores (cache)`);
    } else {
      if (calls > 0) await sleep(1500);
      calls++;
      const res = await apiFootball<SquadResponse[]>(`/players/squads?team=${apiId}`);
      players = res[0]?.players ?? [];
      writeJson(cache, players);
      console.log(`${slug}: ${players.length} jogadores (API)`);
    }
    writeJson(PATHS.raw(slug), { slug, apiId, fetchedAt: new Date().toISOString().slice(0, 10), players });
  }
  console.log(`Requisições gastas: ${calls}`);
}

runIfMain(import.meta.url, () => fetchSquads(parseArgs()));
