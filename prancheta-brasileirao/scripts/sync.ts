// npm run sync [-- --team=vasco] [-- --force]
// Roda o pipeline completo: times → elencos → TheSportsDB → fotos → build, e imprime o relatório de lacunas.
import { buildData, printReport } from "./build-data";
import { downloadPhotos } from "./download-photos";
import { enrichSportsDb } from "./enrich-sportsdb";
import { fetchSquads } from "./fetch-squads";
import { fetchTeams } from "./fetch-teams";
import { parseArgs, runIfMain } from "./lib/io";

runIfMain(import.meta.url, async () => {
  const args = parseArgs();
  console.log("\n▶ 1/5 times");
  await fetchTeams({ force: args.force });
  console.log("\n▶ 2/5 elencos");
  await fetchSquads(args);
  console.log("\n▶ 3/5 TheSportsDB (sugestões de posição)");
  if (process.argv.includes("--no-sportsdb")) console.log("pulado");
  else await enrichSportsDb(args);
  console.log("\n▶ 4/5 fotos");
  await downloadPhotos(args);
  console.log("\n▶ 5/5 build");
  printReport(buildData(args));
});
