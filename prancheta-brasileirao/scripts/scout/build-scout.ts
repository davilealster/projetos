// Gera os dados do Olheiro (src/data/scout) a partir de data/scout/tm/*.json (saída de collect_stats.py).
// Uso: npm run build:scout
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { p, readJson, runIfMain } from "../lib/io";
import type { ScoutIndex } from "../../src/scout/types";
import { buildLeague, type RawScoutLeague } from "./lib";

const IN = process.env.SCOUT_IN ?? p("data/scout/tm");
const OUT = p("src/data/scout");

const writeCompact = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data) + "\n");

export function buildScout(): ScoutIndex {
  const files = existsSync(IN) ? readdirSync(IN).filter((f) => f.endsWith(".json")) : [];
  // mesma ordem das ligas do mercado
  const order = readJson<{ leagues: { id: string; players: number }[] }>(p("src/data/market/index.json")).leagues;
  const rank = (id: string) => {
    const i = order.findIndex((l) => l.id === id);
    return i < 0 ? 999 : i;
  };
  const raws = files.map((f) => readJson<RawScoutLeague>(`${IN}/${f}`)).sort((a, b) => rank(a.id) - rank(b.id));

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/leagues`, { recursive: true });
  const index: ScoutIndex = { collectedAt: null, leagues: [] };
  for (const raw of raws) {
    const league = buildLeague(raw);
    if (!league) {
      console.log(`  ${raw.id}: sem dados da liga, pulando`);
      continue;
    }
    writeCompact(`${OUT}/leagues/${league.id}.json`, league);
    index.leagues.push({ id: league.id, season: league.season, players: league.players.length });
    if (!index.collectedAt || league.collectedAt > index.collectedAt) index.collectedAt = league.collectedAt;
    const market = order.find((l) => l.id === league.id)?.players ?? 0;
    const pct = market ? Math.round((100 * league.players.length) / market) : 0;
    console.log(
      `  ${league.id}: temporada ${league.season}, ${league.players.length} jogadores (${pct}% dos ${market} do mercado), maxMin ${league.maxMin}`,
    );
  }
  writeCompact(`${OUT}/index.json`, index);
  return index;
}

runIfMain(import.meta.url, async () => {
  const idx = buildScout();
  const total = idx.leagues.reduce((t, l) => t + l.players, 0);
  console.log(`✓ ${idx.leagues.length} ligas, ${total} jogadores → src/data/scout`);
});
