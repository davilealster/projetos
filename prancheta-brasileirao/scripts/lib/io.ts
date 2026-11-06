// I/O compartilhado dos scripts: caminhos, JSON, argumentos, .env e cliente da API-Football.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const p = (...parts: string[]) => join(ROOT, ...parts);

export const PATHS = {
  teamMap: p("data/team-map.json"),
  teamColors: p("data/team-colors.json"),
  apiTeams: p("data/raw/_teams.json"),
  raw: (slug: string) => p("data/raw", `${slug}.json`),
  overrides: (slug: string) => p("data/overrides", `${slug}.json`),
  sportsdb: (slug: string) => p("data/sportsdb", `${slug}.json`),
  squadCache: (slug: string) => p(".cache/squads", `${slug}.json`),
  photoCache: (id: number) => p(".cache/photos", `${id}.img`),
  crest: (slug: string) => p("public/teams", slug, "crest.webp"),
  photo: (slug: string, id: number) => p("public/players", slug, `${id}.webp`),
  teamOut: (slug: string) => p("src/data/teams", `${slug}.json`),
  indexOut: p("src/data/teams/index.json"),
};

export function readJson<T>(file: string, fallback?: T): T {
  if (!existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Arquivo não encontrado: ${file}`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function ensureDir(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
}

/** true quando o arquivo foi chamado direto (tsx scripts/x.ts), false quando importado por sync.ts. */
export function isMain(metaUrl: string): boolean {
  return !!process.argv[1] && fileURLToPath(metaUrl) === resolve(process.argv[1]);
}

/** Executa main() quando chamado direto, com saída de erro amigável. */
export function runIfMain(metaUrl: string, main: () => Promise<unknown>): void {
  if (!isMain(metaUrl)) return;
  main().catch((e: Error) => {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  });
}

export const sleep =(ms: number) => new Promise((r) => setTimeout(r, ms));

/** --team=vasco,flamengo  --force */
export function parseArgs(argv = process.argv.slice(2)) {
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const teams = get("team")?.split(",").filter(Boolean) ?? null;
  return { teams, force: argv.includes("--force") };
}

export interface TeamMapEntry {
  name: string;
  shortName: string;
  apiId: number | null;
  sportsDbId: string | null;
  aliases: string[];
}
export type TeamMap = Record<string, TeamMapEntry>;

export function loadTeamMap(): TeamMap {
  const raw = readJson<Record<string, unknown>>(PATHS.teamMap);
  const out: TeamMap = {};
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith("_")) out[k] = v as TeamMapEntry;
  return out;
}

export function saveTeamMap(map: TeamMap): void {
  const raw = readJson<Record<string, unknown>>(PATHS.teamMap);
  writeJson(PATHS.teamMap, { _doc: raw._doc, ...map });
}

/** Slugs a processar: todos, ou só os de --team. */
export function selectSlugs(map: TeamMap, teams: string[] | null): string[] {
  const all = Object.keys(map);
  if (!teams) return all;
  const bad = teams.filter((t) => !all.includes(t));
  if (bad.length) throw new Error(`Slug(s) desconhecido(s): ${bad.join(", ")}`);
  return teams;
}

export function loadEnv(): void {
  if (existsSync(p(".env"))) process.loadEnvFile(p(".env"));
}

export const env = {
  get apiKey() {
    const k = process.env.API_FOOTBALL_KEY;
    if (!k) throw new Error("API_FOOTBALL_KEY ausente. Copie .env.example para .env e preencha.");
    return k;
  },
  league: () => Number(process.env.API_FOOTBALL_LEAGUE ?? 71),
  season: () => Number(process.env.API_FOOTBALL_SEASON ?? 2026),
  sportsDbKey: () => process.env.THESPORTSDB_KEY ?? "123",
};

interface ApiEnvelope<T> {
  errors: unknown;
  results: number;
  response: T;
}

/** GET na API-Football v3. Lança erro se a API responder com `errors` preenchido. */
export async function apiFootball<T>(path: string): Promise<T> {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { "x-apisports-key": env.apiKey },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status} em ${path}`);
  const body = (await res.json()) as ApiEnvelope<T>;
  const errs = body.errors;
  const hasErr = Array.isArray(errs) ? errs.length > 0 : errs && Object.keys(errs).length > 0;
  if (hasErr) throw new Error(`API-Football recusou ${path}: ${JSON.stringify(errs)}`);
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining) console.log(`  (cota diária restante: ${remaining})`);
  return body.response;
}

export async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
