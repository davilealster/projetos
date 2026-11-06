// Converte a pesquisa da Wikipédia (data/research/{slug}.json) em rascunho de overrides.
// Regras: casa jogador por número + sobrenome (ou só pelo nome); nunca sobrescreve um override
// feito à mão (só os marcados draft: true). Uso: npm run import:research [-- --team=vasco]
import { existsSync } from "node:fs";
import { isAbbreviated, normalize, parsePtPositions, type Override, type RawPlayer } from "./lib/core";
import { PATHS, loadTeamMap, p, parseArgs, readJson, runIfMain, selectSlugs, writeJson } from "./lib/io";

interface ResearchPlayer {
  number: number | null;
  label: string;
  title: string;
  positions_raw: string | null;
}

const researchPath = (slug: string) => p("data/research", `${slug}.json`);
const stripTitle = (t: string) => t.replace(/\s*\(.*?\)\s*$/, "").trim();

/** Nomes compatíveis: iguais, mesmo sobrenome (com inicial batendo se abreviado) ou apelido de uma palavra. */
export function compatible(apiName: string, wikiName: string): boolean {
  const a = normalize(apiName).split(" ");
  const w = normalize(wikiName).split(" ");
  if (a.join(" ") === w.join(" ")) return true;
  if (a.length === 1) return w.includes(a[0]); // "Neymar", "Danilo"
  const lastA = a[a.length - 1];
  const lastW = w[w.length - 1];
  if (lastA !== lastW && !(w.length > 2 && w.slice(1).includes(lastA))) return false;
  if (isAbbreviated(apiName)) return w[0][0] === a[0][0];
  return a[0] === w[0] || w.length === 1;
}

function findApiPlayer(r: ResearchPlayer, raw: RawPlayer[], used: Set<number>, byNumber: boolean): RawPlayer | null {
  const names = [stripTitle(r.title), r.label];
  const free = raw.filter((x) => !used.has(x.id));
  const ok = (x: RawPlayer) => names.some((n) => compatible(x.name, n) || compatible(n, x.name));
  // com o mesmo número de camisa, basta o sobrenome igual (apelidos: "J. Rodríguez" = "Puma Rodríguez")
  const last = (n: string) => normalize(n).split(" ").pop();
  const sameLast = (x: RawPlayer) => names.some((n) => last(n) === last(x.name));
  if (byNumber) return free.find((x) => r.number != null && x.number === r.number && (ok(x) || sameLast(x))) ?? null;
  const hits = free.filter(ok);
  return hits.length === 1 ? hits[0] : null;
}

export function importResearch({ teams = null as string[] | null } = {}) {
  const rows: Record<string, string | number>[] = [];
  for (const slug of selectSlugs(loadTeamMap(), teams)) {
    if (!existsSync(researchPath(slug))) continue;
    const research = readJson<{ players: ResearchPlayer[] }>(researchPath(slug));
    const raw = readJson<{ players: RawPlayer[] }>(PATHS.raw(slug)).players;
    const overrides = readJson<Record<string, Override>>(PATHS.overrides(slug), {});
    const used = new Set<number>();
    let matched = 0;
    let written = 0;
    let ambiguous = 0;
    const missing: string[] = [];

    // 1ª passada: número + nome compatível; 2ª: só nome (sem ambiguidade)
    const pairs = new Map<ResearchPlayer, RawPlayer>();
    for (const byNumber of [true, false]) {
      for (const r of research.players) {
        if (pairs.has(r)) continue;
        const pl = findApiPlayer(r, raw, used, byNumber);
        if (pl) (pairs.set(r, pl), used.add(pl.id));
      }
    }
    for (const r of research.players) {
      const pl = pairs.get(r);
      if (!pl) {
        missing.push(`${r.number ?? "?"} ${stripTitle(r.title)}`);
        continue;
      }
      matched++;
      const parsed = parsePtPositions(r.positions_raw, pl.number ?? r.number);
      if (!parsed) continue;
      if (parsed.ambiguous) ambiguous++;
      const key = String(pl.id);
      const current = overrides[key];
      if (current && !current.draft) continue; // correção manual: não mexe
      const full = stripTitle(r.title);
      const ov: Override = {
        pos: parsed.pos,
        alt: parsed.alt,
        draft: true,
        source: `wikipedia: ${r.positions_raw}${parsed.ambiguous ? " (lado não informado)" : ""}`,
      };
      if (isAbbreviated(pl.name) && full.split(/\s+/).length <= 3) ov.displayName = full;
      overrides[key] = { ...(current?.hide ? { hide: true } : {}), ...ov };
      written++;
    }
    writeJson(PATHS.overrides(slug), overrides);
    rows.push({ time: slug, wikipedia: research.players.length, casados: matched, rascunhos: written, "lateral sem lado": ambiguous, "não achados": missing.length });
    if (missing.length) console.log(`${slug}: não achados na API → ${missing.join(", ")}`);
  }
  console.table(rows);
}

runIfMain(import.meta.url, async () => importResearch(parseArgs()));
