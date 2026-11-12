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
  | { type: "compare/clear" };

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
  }
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
