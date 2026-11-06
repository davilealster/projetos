// Etapa 1: lista os times da liga, trava apiId no data/team-map.json e baixa os escudos.
// Uso: npm run fetch:teams [-- --force] [-- --check-league]
import { existsSync } from "node:fs";
import sharp from "sharp";
import { matchTeamSlug } from "./lib/core";
import {
  PATHS, apiFootball, download, ensureDir, env, loadEnv, loadTeamMap, parseArgs,
  readJson, runIfMain, saveTeamMap, writeJson,
} from "./lib/io";

interface ApiTeam {
  team: { id: number; name: string; code: string | null; founded: number | null; logo: string };
}

export async function fetchTeams({ force = false } = {}) {
  loadEnv();
  const map = loadTeamMap();

  if (process.argv.includes("--check-league")) {
    type L = { league: { id: number; name: string; type: string }; seasons: { year: number }[] };
    const leagues = await apiFootball<L[]>("/leagues?country=Brazil");
    for (const l of leagues) {
      const has = l.seasons.some((s) => s.year === env.season());
      console.log(`${l.league.id}\t${l.league.name}\t${l.league.type}\t${has ? `tem ${env.season()}` : ""}`);
    }
  }

  let teams: ApiTeam[];
  if (!force && existsSync(PATHS.apiTeams)) {
    teams = readJson<ApiTeam[]>(PATHS.apiTeams);
    console.log(`Times lidos do cache (${PATHS.apiTeams}). Use --force para chamar a API.`);
  } else {
    console.log(`Buscando /teams?league=${env.league()}&season=${env.season()}`);
    try {
      teams = await apiFootball<ApiTeam[]>(`/teams?league=${env.league()}&season=${env.season()}`);
      if (teams.length !== 20) {
        console.warn(`⚠ Esperava 20 times, vieram ${teams.length}. Confira a liga/temporada (--check-league).`);
      }
    } catch (err) {
      // O plano gratuito não libera a temporada corrente em /teams, mas /players/squads funciona.
      // Alternativa: todos os times do Brasil (1 requisição), casados pelos aliases exatos.
      if (!/plan/i.test((err as Error).message)) throw err;
      console.warn(`⚠ ${(err as Error).message}\n  Usando /teams?country=Brazil como alternativa.`);
      const all = await apiFootball<ApiTeam[]>("/teams?country=Brazil");
      // Fora femininos/base e cadastros órfãos (sem código nem ano de fundação, ex.: 117 "Atletico Mineiro").
      teams = all.filter(
        (t) => !/\b(W|U\d{2})$/.test(t.team.name.trim()) && (t.team.code || t.team.founded),
      );
    }
    writeJson(PATHS.apiTeams, teams);
  }

  const aliases = Object.fromEntries(Object.entries(map).map(([s, t]) => [s, t.aliases]));
  const byId = new Map(teams.map((t) => [t.team.id, t]));
  const unmatchedApi: string[] = [];

  const fromLeague = teams.length <= 30; // na alternativa por país vêm centenas de times
  for (const t of teams) {
    const already = Object.entries(map).find(([, e]) => e.apiId === t.team.id);
    if (already) continue;
    const slug = matchTeamSlug(t.team.name, aliases);
    if (!slug) {
      if (fromLeague) unmatchedApi.push(`${t.team.id} "${t.team.name}"`);
      continue;
    }
    if (map[slug].apiId && map[slug].apiId !== t.team.id) {
      console.warn(`⚠ ${slug} já tem apiId ${map[slug].apiId}, mas "${t.team.name}" (${t.team.id}) também casou. Mantido o existente.`);
      continue;
    }
    map[slug].apiId = t.team.id;
    console.log(`  travado ${slug} → ${t.team.id} (${t.team.name})`);
  }
  saveTeamMap(map);

  const missing = Object.entries(map).filter(([, e]) => !e.apiId || !byId.has(e.apiId)).map(([s]) => s);
  if (unmatchedApi.length) console.warn(`⚠ Times da API sem slug (adicione um alias): ${unmatchedApi.join(", ")}`);
  if (missing.length) console.warn(`⚠ Slugs sem time na API: ${missing.join(", ")}`);

  for (const [slug, e] of Object.entries(map)) {
    const t = e.apiId ? byId.get(e.apiId) : undefined;
    if (!t) continue;
    const out = PATHS.crest(slug);
    if (!force && existsSync(out)) continue;
    try {
      const img = await download(t.team.logo);
      ensureDir(out);
      await sharp(img)
        .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toFile(out);
    } catch (err) {
      console.warn(`⚠ Escudo de ${slug} falhou: ${(err as Error).message}`);
    }
  }
  console.log(`Times: ${teams.length} na API, ${20 - missing.length}/20 slugs casados.`);
}

runIfMain(import.meta.url, () => fetchTeams({ force: parseArgs().force }));
