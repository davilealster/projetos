// Estado do Olheiro por clube (localStorage `olheiro:{slug}:v1`) e a ponte para o Mercado. Redutores puros.
import { isFreeAgent, type MarketState, type Signing } from "../market/logic";
import type { MarketPlayer } from "../market/types";
import type { Pos } from "../types";

export type ShelfId = "monitor" | "close" | "priority" | "discard";

export const SHELVES: { id: ShelfId; label: string; short: string; ink: "blue" | "amber" | "green" | "red" }[] = [
  { id: "monitor", label: "Monitorar", short: "Monitorar", ink: "blue" },
  { id: "close", label: "Observar de perto", short: "Observar", ink: "amber" },
  { id: "priority", label: "Prioridade", short: "Prioridade", ink: "green" },
  { id: "discard", label: "Descartado", short: "Descartado", ink: "red" },
];
export const shelfLabel = (id: ShelfId) => SHELVES.find((s) => s.id === id)!.label;

export interface ShelfEntry {
  shelf: ShelfId;
  /** motivo curto (descartado) */
  reason?: string;
  at: number;
}

/** Até 5 nomes por posição: o primeiro é o Plano A, depois B, C… */
export const PLAN_MAX = 5;
export const PLAN_LETTERS = ["A", "B", "C", "D", "E"];
export const COMPARE_MAX = 3;

export interface ScoutState {
  /** "liga:id" → prateleira */
  shelves: Record<string, ShelfEntry>;
  plans: Partial<Record<Pos, string[]>>;
  notes: Record<string, string>;
  compare: string[];
}

export const emptyScoutState = (): ScoutState => ({ shelves: {}, plans: {}, notes: {}, compare: [] });

export type ScoutAction =
  | { type: "shelf"; key: string; shelf: ShelfId | null; reason?: string; at?: number }
  | { type: "reason"; key: string; reason: string }
  | { type: "plan/add"; pos: Pos; key: string }
  | { type: "plan/remove"; pos: Pos; key: string }
  | { type: "plan/move"; pos: Pos; key: string; dir: -1 | 1 }
  | { type: "plan/set"; pos: Pos; keys: string[] }
  | { type: "note"; key: string; text: string }
  | { type: "compare"; key: string }
  | { type: "compare/clear" }
  // Minha lista (etapa 2 do Mercado): guardar, prioridade (Plano A/B/C ou só observando), reordenar, tirar
  | { type: "list/save"; key: string; at?: number }
  | { type: "list/remove"; key: string }
  | { type: "list/priority"; pos: Pos; key: string; prio: number | null }
  | { type: "list/move"; pos: Pos; order: string[]; key: string; dir: -1 | 1 };

export function scoutReducer(st: ScoutState, a: ScoutAction): ScoutState {
  switch (a.type) {
    case "shelf": {
      const shelves = { ...st.shelves };
      if (a.shelf) shelves[a.key] = { shelf: a.shelf, at: a.at ?? Date.now(), ...(a.shelf === "discard" && a.reason ? { reason: a.reason } : {}) };
      else delete shelves[a.key];
      return { ...st, shelves };
    }
    case "reason": {
      const cur = st.shelves[a.key];
      if (!cur) return st;
      return { ...st, shelves: { ...st.shelves, [a.key]: { ...cur, reason: a.reason.slice(0, 80) || undefined } } };
    }
    case "plan/add": {
      const list = st.plans[a.pos] ?? [];
      if (list.includes(a.key) || list.length >= PLAN_MAX) return st;
      return { ...st, plans: { ...st.plans, [a.pos]: [...list, a.key] } };
    }
    case "plan/remove": {
      const list = (st.plans[a.pos] ?? []).filter((k) => k !== a.key);
      const plans = { ...st.plans };
      if (list.length) plans[a.pos] = list;
      else delete plans[a.pos];
      return { ...st, plans };
    }
    case "plan/move": {
      const list = [...(st.plans[a.pos] ?? [])];
      const i = list.indexOf(a.key);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= list.length) return st;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...st, plans: { ...st.plans, [a.pos]: list } };
    }
    case "plan/set":
      return { ...st, plans: { ...st.plans, [a.pos]: [...new Set(a.keys)].slice(0, PLAN_MAX) } };
    case "note": {
      const notes = { ...st.notes };
      const t = a.text.slice(0, 500);
      if (t.trim()) notes[a.key] = t;
      else delete notes[a.key];
      return { ...st, notes };
    }
    case "compare": {
      if (st.compare.includes(a.key)) return { ...st, compare: st.compare.filter((k) => k !== a.key) };
      // cheio: sai o mais antigo
      return { ...st, compare: [...st.compare, a.key].slice(-COMPARE_MAX) };
    }
    case "compare/clear":
      return { ...st, compare: [] };
    case "list/save":
      return isSaved(st, a.key) ? st : { ...st, shelves: { ...st.shelves, [a.key]: { shelf: "monitor", at: a.at ?? Date.now() } } };
    case "list/remove": {
      const shelves = { ...st.shelves };
      delete shelves[a.key];
      const plans: ScoutState["plans"] = {};
      for (const [pos, list] of Object.entries(st.plans) as [Pos, string[]][]) {
        const rest = list.filter((k) => k !== a.key);
        if (rest.length) plans[pos] = rest;
      }
      return { ...st, shelves, plans, compare: st.compare.filter((k) => k !== a.key) };
    }
    case "list/priority":
      return setPriority(st, a.pos, a.key, a.prio);
    case "list/move":
      return moveInList(st, a.pos, a.order, a.key, a.dir);
  }
}

// ---------- Minha lista (prateleiras + planos numa lista só) ----------

/** Letras que o seletor oferece (Plano A, B, C); "só observando" = fora dos planos. */
export const LIST_PRIORITIES = 3;

/**
 * Letras possíveis para um jogador na posição: Plano B só existe se houver um A (é a alternativa ao A), e assim por diante.
 * Devolve o maior índice permitido (0 = só A).
 */
export function maxPriority(st: ScoutState, pos: Pos, key: string): number {
  const others = (st.plans[pos] ?? []).filter((k) => k !== key).length;
  return Math.min(others, LIST_PRIORITIES - 1);
}

/** Está na Minha lista: num plano ou numa prateleira (menos "descartado"). */
export const isSaved = (st: ScoutState, key: string) => !!planOf(st, key) || (!!st.shelves[key] && st.shelves[key].shelf !== "discard");

/** Todas as chaves da lista (planos primeiro, depois prateleiras), sem repetir. */
export function savedKeys(st: ScoutState): string[] {
  const out = new Set<string>(Object.values(st.plans).flat().filter((k): k is string => !!k));
  for (const [k, e] of Object.entries(st.shelves)) if (e.shelf !== "discard") out.add(k);
  return [...out];
}

/**
 * Ordem de uma posição na lista: os planos (A, B, C…) e depois os "só observando" (`observing`: chaves da posição),
 * do mais antigo para o mais novo.
 */
export function listOrder(st: ScoutState, pos: Pos, observing: string[]): string[] {
  const planned = st.plans[pos] ?? [];
  const rest = observing.filter((k) => !planned.includes(k) && !planOf(st, k));
  rest.sort((a, b) => (st.shelves[a]?.at ?? 0) - (st.shelves[b]?.at ?? 0));
  return [...planned, ...rest];
}

/** Garante a entrada na prateleira (quem está na lista sempre tem uma; "descartado" volta a observar). */
const ensureShelf = (shelves: ScoutState["shelves"], key: string, at = Date.now()) => {
  if (!shelves[key] || shelves[key].shelf === "discard") shelves[key] = { shelf: "monitor", at };
};

/** Plano A/B/C (`prio` = 0, 1, 2…) ou só observando (null). Quem já ocupava a letra desce uma. */
export function setPriority(st: ScoutState, pos: Pos, key: string, prio: number | null): ScoutState {
  const plans = { ...st.plans };
  const cur = planOf(st, key);
  if (cur && cur.pos !== pos) {
    const l = (plans[cur.pos] ?? []).filter((k) => k !== key);
    if (l.length) plans[cur.pos] = l;
    else delete plans[cur.pos];
  }
  const list = (plans[pos] ?? []).filter((k) => k !== key);
  if (prio != null) list.splice(Math.max(0, Math.min(prio, list.length)), 0, key);
  const shelves = { ...st.shelves };
  ensureShelf(shelves, key);
  // passou do limite: o último volta para "só observando"
  for (const k of list.slice(PLAN_MAX)) shelves[k] = { shelf: "monitor", at: Date.now() };
  if (list.length) plans[pos] = list.slice(0, PLAN_MAX);
  else delete plans[pos];
  return { ...st, plans, shelves };
}

/**
 * Sobe/desce um jogador na ordem da posição. O número de planos não muda: quem cruza a linha troca de lugar
 * com o vizinho (o último plano passa a "só observando" e vice-versa).
 */
export function moveInList(st: ScoutState, pos: Pos, order: string[], key: string, dir: -1 | 1): ScoutState {
  const i = order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return st;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  const n = Math.min((st.plans[pos] ?? []).length, next.length);
  const plans = { ...st.plans };
  if (n) plans[pos] = next.slice(0, n);
  const shelves = { ...st.shelves };
  const rest = next.slice(n);
  const ats = rest.map((k) => shelves[k]?.at ?? 0).sort((a, b) => a - b);
  rest.forEach((k, idx) => {
    shelves[k] = { ...(shelves[k] ?? { shelf: "monitor" as ShelfId }), at: ats[idx] || Date.now() + idx };
    if (shelves[k].shelf === "discard") shelves[k] = { shelf: "monitor", at: shelves[k].at };
  });
  for (const k of next.slice(0, n)) ensureShelf(shelves, k);
  return { ...st, plans, shelves };
}

/**
 * Migração: o ★ "observar" antigo do Mercado (`MarketState.watch`, chaves "liga:id") entra na Minha lista
 * como "só observando". Quem já está no olheiro (inclusive descartado) fica como está. Pura.
 */
export function mergeWatch(st: ScoutState, watch: readonly string[], at = Date.now()): ScoutState {
  const add = watch.filter((k) => /^[A-Za-z0-9]+:.+/.test(k) && !st.shelves[k] && !planOf(st, k));
  if (!add.length) return st;
  const shelves = { ...st.shelves };
  add.forEach((k, i) => (shelves[k] = { shelf: "monitor", at: at + i }));
  return { ...st, shelves };
}

/** Em que plano (posição e letra) o jogador está. */
export function planOf(st: ScoutState, key: string): { pos: Pos; index: number } | null {
  for (const [pos, list] of Object.entries(st.plans) as [Pos, string[]][]) {
    const index = list.indexOf(key);
    if (index >= 0) return { pos, index };
  }
  return null;
}

/** Quantos jogadores em cada prateleira. */
export const shelfCounts = (st: ScoutState) => {
  const out: Record<ShelfId, number> = { monitor: 0, close: 0, priority: 0, discard: 0 };
  for (const e of Object.values(st.shelves)) out[e.shelf]++;
  return out;
};

// ---------- ponte com o Mercado ----------

export const splitKey = (key: string) => {
  const i = key.indexOf(":");
  return { league: key.slice(0, i), id: key.slice(i + 1) };
};

/** Tipo de contratação pelo contrato: chega livre se acaba antes da próxima temporada; senão compra pelo valor. */
export function signingFor(p: Pick<MarketPlayer, "id" | "value" | "contract">, league: string, freeCutoff: string): Signing {
  const free = isFreeAgent(p as MarketPlayer, freeCutoff);
  return { id: p.id, league, type: free ? "free" : "buy", price: free ? 0 : p.value ?? 0 };
}

/** Acrescenta contratações ao estado do Mercado sem duplicar quem já foi contratado. */
export function withSignings(st: MarketState, add: Signing[]): { state: MarketState; added: Signing[] } {
  const have = new Set(st.signings.map((s) => s.id));
  const added: Signing[] = [];
  for (const s of add) {
    if (have.has(s.id)) continue;
    have.add(s.id);
    added.push(s);
  }
  return { state: added.length ? { ...st, signings: [...st.signings, ...added] } : st, added };
}

// ---------- persistência ----------

const key = (slug: string) => `olheiro:${slug}:v1`;

export function loadScoutState(slug: string): ScoutState {
  try {
    const raw = localStorage.getItem(key(slug));
    if (raw) return { ...emptyScoutState(), ...(JSON.parse(raw) as Partial<ScoutState>) };
  } catch {
    /* modo privado: segue sem salvar */
  }
  return emptyScoutState();
}

export function saveScoutState(slug: string, st: ScoutState): void {
  try {
    localStorage.setItem(key(slug), JSON.stringify(st));
  } catch {
    /* ignore */
  }
}
