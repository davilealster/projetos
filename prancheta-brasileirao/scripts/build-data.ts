// Etapa 4: junta raw + overrides + sugestões e gera src/data/teams/{slug}.json e index.json.
// Também cria data/overrides/{slug}.json vazio quando não existir.
// Uso: npm run build:data [-- --team=vasco]
import { existsSync } from "node:fs";
import {
  mergePlayers, needsPositionReview, stripMeta,
  type BuiltPlayerWithMeta, type Override, type RawPlayer, type Suggestion,
} from "./lib/core";
import { PATHS, loadTeamMap, parseArgs, readJson, runIfMain, selectSlugs, writeJson } from "./lib/io";

export interface TeamReport {
  slug: string;
  players: number;
  noPhoto: number;
  genericPos: number;
  noNumber: number;
  abbreviated: number;
}

type Colors = { primary: string; secondary: string; accent: string };

export function buildTeam(slug: string): { players: BuiltPlayerWithMeta[]; report: TeamReport } | null {
  const map = loadTeamMap();
  const colors = readJson<Record<string, Colors>>(PATHS.teamColors)[slug];
  const raw = readJson<{ fetchedAt: string; players: RawPlayer[] } | null>(PATHS.raw(slug), null);
  if (!raw) return null;

  if (!existsSync(PATHS.overrides(slug))) writeJson(PATHS.overrides(slug), {});
  const overrides = readJson<Record<string, Override>>(PATHS.overrides(slug));
  const suggestions = readJson<Record<string, Suggestion>>(PATHS.sportsdb(slug), {});

  const players = mergePlayers({
    slug,
    raw: raw.players,
    overrides,
    suggestions,
    hasPhoto: (id) => existsSync(PATHS.photo(slug, id)),
  });

  // dados do painel admin: todos os jogadores (inclusive ocultos), com a origem de cada valor
  const visible = { ...overrides };
  for (const k of Object.keys(visible)) if (visible[k].hide) visible[k] = { ...visible[k], hide: false };
  const all = mergePlayers({ slug, raw: raw.players, overrides: visible, suggestions, hasPhoto: (id) => existsSync(PATHS.photo(slug, id)) });
  const rawById = new Map(raw.players.map((x) => [x.id, x]));
  writeJson(PATHS.adminOut(slug), {
    slug,
    updatedAt: raw.fetchedAt,
    players: all.map((x) => {
      const r = rawById.get(x.id)!;
      const ov = overrides[String(x.id)] ?? {};
      return {
        id: x.id,
        apiName: r.name,
        apiPos: r.position,
        apiNumber: r.number,
        photo: x.photo,
        name: x.name,
        number: x.number,
        pos: x.pos,
        alt: x.alt ?? [],
        hidden: !!ov.hide,
        source: x.posSource,
        note: ov.source ?? suggestions[String(x.id)]?.strPosition ?? null,
      };
    }),
  });

  const t = map[slug];
  writeJson(PATHS.teamOut(slug), {
    slug,
    name: t.name,
    shortName: t.shortName,
    colors,
    crest: existsSync(PATHS.crest(slug)) ? `/teams/${slug}/crest.webp` : null,
    updatedAt: raw.fetchedAt,
    players: players.map(stripMeta),
  });

  return {
    players,
    report: {
      slug,
      players: players.length,
      noPhoto: players.filter((x) => !x.photo).length,
      genericPos: players.filter(needsPositionReview).length,
      noNumber: players.filter((x) => x.number == null).length,
      abbreviated: players.filter((x) => x.nameSource === "api" && /^\p{L}\.\s/u.test(x.name)).length,
    },
  };
}

/** index.json sempre com todos os times que já têm JSON gerado. */
export function buildIndex(): number {
  const map = loadTeamMap();
  const colors = readJson<Record<string, Colors>>(PATHS.teamColors);
  const list = Object.entries(map)
    .filter(([slug]) => existsSync(PATHS.teamOut(slug)))
    .map(([slug, t]) => ({
      slug,
      name: t.name,
      shortName: t.shortName,
      crest: existsSync(PATHS.crest(slug)) ? `/teams/${slug}/crest.webp` : null,
      colors: colors[slug],
    }));
  writeJson(PATHS.indexOut, list);
  return list.length;
}

export function printReport(rows: TeamReport[]): void {
  console.table(
    rows.map((r) => ({
      time: r.slug,
      jogadores: r.players,
      "sem foto": r.noPhoto,
      "posição genérica": r.genericPos,
      "sem número": r.noNumber,
      "nome abreviado": r.abbreviated,
    })),
  );
  const sum = (k: keyof Omit<TeamReport, "slug">) => rows.reduce((a, r) => a + r[k], 0);
  console.log(
    `Total: ${sum("players")} jogadores · ${sum("noPhoto")} sem foto · ${sum("genericPos")} com posição genérica · ` +
      `${sum("noNumber")} sem número · ${sum("abbreviated")} com nome abreviado`,
  );
}

export function buildData({ teams = null as string[] | null } = {}): TeamReport[] {
  const rows: TeamReport[] = [];
  for (const slug of selectSlugs(loadTeamMap(), teams)) {
    const r = buildTeam(slug);
    if (!r) console.warn(`⚠ ${slug}: sem data/raw/${slug}.json, pulado`);
    else rows.push(r.report);
  }
  const n = buildIndex();
  console.log(`index.json com ${n} times.`);
  return rows;
}

runIfMain(import.meta.url, async () => printReport(buildData(parseArgs())));
