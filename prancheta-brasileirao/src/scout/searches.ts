// Buscas prontas e filtros manuais do Olheiro (puros; testados em tests/scout.test.ts).
import type { Pos } from "../types";
import { median, profileDistance, type ScoutPlayer } from "./metrics";

export const TOP5_GROUP = "Top 5 da Europa";

export interface ScoutFilters {
  /** posições aceitas (vazio = todas) */
  pos: Pos[];
  /** liga-grupo ("" = todos) */
  group: string;
  /** liga ("" = todas do grupo) */
  league: string;
  minAge: number;
  /** 0 = sem limite */
  maxAge: number;
  /** em euros; 0 = sem limite */
  maxValue: number;
  /** só quem cabe no saldo (livres sempre cabem) */
  afford: boolean;
  /** contrato termina até este ano (0 = qualquer) */
  contractYear: number;
  /** minutos mínimos na liga */
  minMinutes: number;
  foreign: "any" | "yes" | "no";
  /** nota da posição mínima (0 = qualquer; >0 exige amostra) */
  minScore: number;
  q: string;
}

export const emptyFilters = (): ScoutFilters => ({
  pos: [], group: "", league: "", minAge: 0, maxAge: 0, maxValue: 0, afford: false, contractYear: 0, minMinutes: 0, foreign: "any", minScore: 0, q: "",
});

export interface SearchCtx {
  /** saldo atual do Mercado, em euros */
  balance: number;
  /** contratos que acabam antes disso chegam livres (MarketIndex.nextSeasonStart) */
  freeCutoff: string;
  /** ids do elenco do clube (ficam fora das buscas, exceto como referência) */
  ownIds: Set<string>;
  /** referência para "Reposição" */
  ref?: ScoutPlayer | null;
  /** carências do elenco (do depthChart do Mercado) */
  needs?: { pos: Pos; short: number }[];
}

export const isFree = (x: { contract: string | null }, freeCutoff: string) => !!x.contract && x.contract < freeCutoff;
/** Cabe no saldo: chega livre ou custa até o saldo. */
export const fits = (x: ScoutPlayer, ctx: Pick<SearchCtx, "balance" | "freeCutoff">) => isFree(x, ctx.freeCutoff) || (x.value ?? 0) <= Math.max(0, ctx.balance);

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function applyFilters(list: ScoutPlayer[], f: ScoutFilters, ctx: Pick<SearchCtx, "balance" | "freeCutoff">): ScoutPlayer[] {
  const q = fold(f.q.trim());
  return list.filter((x) => {
    if (f.pos.length && !f.pos.includes(x.pos)) return false;
    if (f.group && x.group !== f.group) return false;
    if (f.league && x.league !== f.league) return false;
    if (f.minAge && (x.age ?? 0) < f.minAge) return false;
    if (f.maxAge && (x.age ?? 99) > f.maxAge) return false;
    if (f.maxValue && (x.value ?? 0) > f.maxValue) return false;
    if (f.afford && !fits(x, ctx)) return false;
    if (f.contractYear && (!x.contract || Number(x.contract.slice(0, 4)) > f.contractYear)) return false;
    if (f.minMinutes && x.m.min < f.minMinutes) return false;
    if (f.foreign === "yes" && !x.foreign) return false;
    if (f.foreign === "no" && x.foreign) return false;
    if (f.minScore && (x.m.score ?? -1) < f.minScore) return false;
    if (q && !fold(`${x.name} ${x.club}`).includes(q)) return false;
    return true;
  });
}

export type SearchId = "obvious" | "hidden" | "gems" | "contract" | "value" | "replace" | "needs";

export interface SearchDef {
  id: SearchId;
  title: string;
  /** frase curta do critério (honesta) */
  rule: string;
  /** quantos mostrar no máximo (0 = todos) */
  limit: number;
}

export const SEARCHES: SearchDef[] = [
  { id: "obvious", title: "Os óbvios", rule: "Top 10 pela nota da posição", limit: 10 },
  { id: "hidden", title: "Não óbvios", rule: "Nota 75+ fora do top 5 europeu, valor até a mediana da posição", limit: 0 },
  { id: "gems", title: "Joias", rule: "Sub-21 com nota 70+ ou sub-23 com 80+", limit: 0 },
  { id: "contract", title: "Fim de contrato", rule: "Contrato acaba até 30/06 e nota 60+", limit: 0 },
  { id: "value", title: "Custo-benefício", rule: "Mais nota por euro, só quem cabe no saldo", limit: 0 },
  { id: "replace", title: "Reposição", rule: "Perfil parecido com um jogador seu, mais barato ou mais jovem", limit: 20 },
  { id: "needs", title: "Cobrir a carência", rule: "Melhores que cabem no saldo nas posições que faltam", limit: 0 },
];

const byScore = (a: ScoutPlayer, b: ScoutPlayer) => (b.m.score ?? -1) - (a.m.score ?? -1) || (a.value ?? 0) - (b.value ?? 0);

/**
 * Roda uma busca pronta sobre a lista já filtrada (posição, grupo… vêm dos filtros manuais).
 * Exclui sempre o próprio elenco e quem não tem amostra (a nota é o critério de todas).
 */
export function runSearch(id: SearchId, list: ScoutPlayer[], ctx: SearchCtx): ScoutPlayer[] {
  const pool = list.filter((x) => !ctx.ownIds.has(x.id) && x.m.score != null);
  const def = SEARCHES.find((s) => s.id === id)!;
  const cap = (xs: ScoutPlayer[]) => (def.limit ? xs.slice(0, def.limit) : xs);
  switch (id) {
    case "obvious":
      return cap([...pool].sort(byScore));
    case "hidden": {
      // mediana de valor por posição dentro da própria lista (o grupo escolhido)
      const med = new Map<Pos, number | null>();
      const of = (pos: Pos) => {
        if (!med.has(pos)) med.set(pos, median(pool.filter((x) => x.pos === pos && x.value != null).map((x) => x.value!)));
        return med.get(pos) ?? null;
      };
      return cap(pool.filter((x) => x.group !== TOP5_GROUP && x.m.score! >= 75 && x.value != null && x.value <= (of(x.pos) ?? Infinity)).sort(byScore));
    }
    case "gems":
      return cap(pool.filter((x) => x.m.gem).sort((a, b) => (b.m.potential ?? 0) - (a.m.potential ?? 0) || byScore(a, b)));
    case "contract":
      return cap(pool.filter((x) => x.m.contractChance).sort(byScore));
    case "value":
      return cap(pool.filter((x) => fits(x, ctx)).sort((a, b) => (b.m.value4money ?? 0) - (a.m.value4money ?? 0) || byScore(a, b)));
    case "replace":
      return cap(similarTo(ctx.ref ?? null, pool));
    case "needs": {
      const short = new Map((ctx.needs ?? []).filter((n) => n.short > 0).map((n) => [n.pos, n.short]));
      return cap(pool.filter((x) => short.has(x.pos) && fits(x, ctx)).sort(byScore));
    }
  }
}

/** "Parecidos com": mesma posição, perfil de percentis próximo, mais barato ou mais jovem. */
export function similarTo(ref: ScoutPlayer | null, pool: ScoutPlayer[]): ScoutPlayer[] {
  if (!ref || ref.m.score == null) return [];
  return pool
    .filter((x) => x.id !== ref.id && x.pos === ref.pos && x.m.score != null)
    .filter((x) => (x.value ?? 0) <= (ref.value ?? 0) || (x.age ?? 99) < (ref.age ?? 0))
    .map((x) => ({ x, d: profileDistance(ref, x) }))
    .sort((a, b) => a.d - b.d || byScore(a.x, b.x))
    .map((r) => r.x);
}

/** Texto curto das carências ("Faltam 2 LE, 1 ZAG"). */
export const needsText = (needs: { pos: Pos; short: number }[]) => {
  const n = needs.filter((x) => x.short > 0);
  return n.length ? `Faltam ${n.map((x) => `${x.short} ${x.pos}`).join(", ")}` : "Elenco completo em todas as posições";
};
