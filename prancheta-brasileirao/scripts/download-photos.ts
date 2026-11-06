// Etapa 3: baixa as fotos e converte para .webp 192x192 (qualidade 80).
// O placeholder genérico da API é detectado por hash: uma imagem idêntica repetida em
// 3+ jogadores é tratada como silhueta e descartada (o front mostra iniciais + cor do clube).
// Uso: npm run fetch:photos [-- --team=vasco] [-- --force]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { RawPlayer } from "./lib/core";
import {
  PATHS, download, ensureDir, loadTeamMap, p, parseArgs, readJson, runIfMain, selectSlugs, sleep,
} from "./lib/io";

const PLACEHOLDER_MIN_REPEATS = 3;
const KNOWN_PLACEHOLDERS_FILE = p(".cache/photos/_placeholders.json");

const sha = (b: Buffer) => createHash("sha1").update(b).digest("hex");

export async function downloadPhotos({ teams = null as string[] | null, force = false } = {}) {
  const map = loadTeamMap();
  const slugs = selectSlugs(map, teams);

  // 1) baixar para o cache bruto
  const entries: { slug: string; id: number; hash: string }[] = [];
  let failed = 0;
  for (const slug of slugs) {
    const raw = readJson<{ players: RawPlayer[] }>(PATHS.raw(slug), { players: [] });
    for (const pl of raw.players) {
      if (!pl.photo) continue;
      const cache = PATHS.photoCache(pl.id);
      try {
        if (force || !existsSync(cache)) {
          const buf = await download(pl.photo);
          ensureDir(cache);
          writeFileSync(cache, buf);
          await sleep(50);
        }
        entries.push({ slug, id: pl.id, hash: sha(readFileSync(cache)) });
      } catch (err) {
        failed++;
        console.warn(`⚠ ${slug}/${pl.id} (${pl.name}): ${(err as Error).message}`);
      }
    }
  }

  // 2) detectar placeholder (hash repetido). Guarda os hashes vistos para rodadas com um time só.
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.hash, (counts.get(e.hash) ?? 0) + 1);
  const known = new Set(readJson<string[]>(KNOWN_PLACEHOLDERS_FILE, []));
  for (const [h, n] of counts) if (n >= PLACEHOLDER_MIN_REPEATS) known.add(h);
  ensureDir(KNOWN_PLACEHOLDERS_FILE);
  writeFileSync(KNOWN_PLACEHOLDERS_FILE, JSON.stringify([...known]));

  // 3) converter
  let ok = 0;
  let placeholders = 0;
  for (const e of entries) {
    const out = PATHS.photo(e.slug, e.id);
    if (known.has(e.hash)) {
      placeholders++;
      rmSync(out, { force: true });
      continue;
    }
    if (!force && existsSync(out)) {
      ok++;
      continue;
    }
    try {
      ensureDir(out);
      await sharp(readFileSync(PATHS.photoCache(e.id)))
        .resize(192, 192, { fit: "cover", position: "top" })
        .webp({ quality: 80 })
        .toFile(out);
      ok++;
    } catch (err) {
      failed++;
      console.warn(`⚠ conversão ${e.slug}/${e.id}: ${(err as Error).message}`);
    }
  }
  console.log(`Fotos: ${ok} ok, ${placeholders} placeholder, ${failed} falharam.`);
}

runIfMain(import.meta.url, () => downloadPhotos(parseArgs()));
