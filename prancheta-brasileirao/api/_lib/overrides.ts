// Documento de ajustes feitos no painel admin. Vale por cima dos dados do repositório,
// indexado pelo id do jogador na API-Football (acompanha o jogador entre temporadas e clubes).
import { readDoc, writeDoc } from "./store.js";

export const POSITIONS = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PON", "ATA"] as const;
type Pos = (typeof POSITIONS)[number];

export interface PlayerOverride {
  pos?: Pos;
  alt?: Pos[];
  displayName?: string;
  number?: number | null;
  hide?: boolean;
  reviewed?: boolean;
}
export interface TeamOverride {
  name?: string;
  shortName?: string;
  colors?: { primary: string; secondary: string; accent: string };
}
export interface OverridesDoc {
  version: 1;
  updatedAt: string | null;
  players: Record<string, PlayerOverride>;
  teams: Record<string, TeamOverride>;
}

const DOC = "admin/overrides.json";
export const emptyDoc = (): OverridesDoc => ({ version: 1, updatedAt: null, players: {}, teams: {} });
export const loadOverrides = async () => (await readDoc<OverridesDoc>(DOC)) ?? emptyDoc();

const isPos = (x: unknown): x is Pos => typeof x === "string" && (POSITIONS as readonly string[]).includes(x);
const isHex = (x: unknown) => typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x);
const text = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : undefined);

/** Valida e limpa um ajuste de jogador. Lança erro com mensagem em português se inválido. */
export function cleanPlayer(input: unknown): PlayerOverride {
  if (!input || typeof input !== "object") throw new Error("ajuste de jogador inválido");
  const o = input as Record<string, unknown>;
  const out: PlayerOverride = {};
  if (o.pos !== undefined) {
    if (!isPos(o.pos)) throw new Error(`posição inválida: ${String(o.pos)}`);
    out.pos = o.pos;
  }
  if (o.alt !== undefined) {
    if (!Array.isArray(o.alt) || !o.alt.every(isPos)) throw new Error("alternativas inválidas");
    out.alt = [...new Set(o.alt as Pos[])].filter((a) => a !== out.pos).slice(0, 2);
  }
  if (o.displayName !== undefined) {
    const n = text(o.displayName, 40);
    if (n) out.displayName = n;
  }
  if (o.number !== undefined) {
    if (o.number !== null && !(Number.isInteger(o.number) && (o.number as number) >= 0 && (o.number as number) <= 99))
      throw new Error("número de camisa deve ser de 0 a 99");
    out.number = o.number as number | null;
  }
  if (o.hide !== undefined) out.hide = !!o.hide;
  if (o.reviewed !== undefined) out.reviewed = !!o.reviewed;
  return out;
}

export function cleanTeam(input: unknown): TeamOverride {
  if (!input || typeof input !== "object") throw new Error("ajuste de time inválido");
  const o = input as Record<string, unknown>;
  const out: TeamOverride = {};
  const name = text(o.name, 60);
  const shortName = text(o.shortName, 30);
  if (name) out.name = name;
  if (shortName) out.shortName = shortName;
  if (o.colors !== undefined) {
    const c = o.colors as Record<string, unknown>;
    if (!c || !isHex(c.primary) || !isHex(c.secondary) || !isHex(c.accent)) throw new Error("cores devem ser #RRGGBB");
    out.colors = { primary: c.primary as string, secondary: c.secondary as string, accent: c.accent as string };
  }
  return out;
}

/** Aplica um patch: valor = substitui o ajuste inteiro; null = remove o ajuste (volta ao dado original). */
export async function patchOverrides(patch: {
  players?: Record<string, unknown>;
  teams?: Record<string, unknown>;
}): Promise<OverridesDoc> {
  const doc = await loadOverrides();
  for (const [id, v] of Object.entries(patch.players ?? {})) {
    if (!/^\d+$/.test(id)) throw new Error(`id de jogador inválido: ${id}`);
    if (v === null) delete doc.players[id];
    else doc.players[id] = cleanPlayer(v);
  }
  for (const [slug, v] of Object.entries(patch.teams ?? {})) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug inválido: ${slug}`);
    if (v === null) delete doc.teams[slug];
    else doc.teams[slug] = cleanTeam(v);
  }
  doc.updatedAt = new Date().toISOString();
  await writeDoc(DOC, doc);
  return doc;
}
