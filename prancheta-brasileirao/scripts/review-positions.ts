// Lista, por time, os jogadores ainda sem posição detalhada (ZAG/MEI/ATA genéricos da API)
// e os nomes abreviados, para preencher data/overrides/{slug}.json.
// Uso: npm run review [-- --team=vasco] [-- --all]  (--all mostra também os já resolvidos pelo TheSportsDB)
import { type Override, type RawPlayer, type Suggestion, isAbbreviated, mergePlayers, needsPositionReview } from "./lib/core";
import { PATHS, loadTeamMap, parseArgs, readJson, runIfMain, selectSlugs } from "./lib/io";

export async function reviewPositions({ teams = null as string[] | null } = {}) {
  const showAll = process.argv.includes("--all");
  for (const slug of selectSlugs(loadTeamMap(), teams)) {
    const raw = readJson<{ players: RawPlayer[] } | null>(PATHS.raw(slug), null);
    if (!raw) continue;
    const overrides = readJson<Record<string, Override>>(PATHS.overrides(slug), {});
    const suggestions = readJson<Record<string, Suggestion>>(PATHS.sportsdb(slug), {});
    const players = mergePlayers({ slug, raw: raw.players, overrides, suggestions, hasPhoto: () => true });
    const rawById = new Map(raw.players.map((x) => [x.id, x]));

    const rows = players
      .filter((x) => needsPositionReview(x) || (showAll && x.posSource === "sportsdb") || isAbbreviated(x.name))
      .map((x) => ({
        id: x.id,
        nome: x.name,
        "nº": x.number ?? "",
        "API": rawById.get(x.id)?.position ?? "",
        atual: x.pos,
        fonte: x.posSource,
        "TheSportsDB": suggestions[String(x.id)]?.strPosition ?? "",
      }));
    if (!rows.length) continue;
    console.log(`\n=== ${slug} (${rows.length} para revisar) → data/overrides/${slug}.json`);
    console.table(rows);
  }
  console.log('\nFormato do override: { "<id>": { "pos": "LD", "displayName": "PH", "number": 20 }, "<id>": { "hide": true } }');
}

runIfMain(import.meta.url, () => reviewPositions(parseArgs()));
