import { describe, expect, it } from "vitest";
import { emptyMarketState } from "../src/market/logic";
import {
  MIN_SAMPLE, contractCutFrom, evaluate, indicatorValue, minutesShare, per90, percentile, potentialOf, profileDistance, valueForMoneyRaw,
  type Prospect, type ScoutPlayer,
} from "../src/scout/metrics";
import { applyFilters, emptyFilters, needsText, runSearch, similarTo, type SearchCtx } from "../src/scout/searches";
import { emptyScoutState, planOf, scoutReducer, shelfCounts, signingFor, withSignings } from "../src/scout/state";
import type { ScoutStats } from "../src/scout/types";
import type { Pos } from "../src/types";

const CUT = "2027-06-30";
const FREE = "2027-01-01";

const stats = (o: Partial<ScoutStats> = {}): ScoutStats => ({
  id: o.id ?? "x", apps: 20, min: 1800, goals: 0, assists: 0, yc: 0, rc: 0, conceded: 20, cleanSheets: 5, minAll: 2000, value12m: null, valuePeak: null, ...o,
});

let n = 0;
const pr = (o: Partial<Prospect> & { pos: Pos }, s: Partial<ScoutStats> | null = {}): Prospect => {
  const id = o.id ?? `p${++n}`;
  return {
    key: `${o.league ?? "BRA1"}:${id}`, id, name: o.name ?? `Jogador ${id}`, age: 25, value: 2_000_000, contract: "2029-12-31", nat: "Brasil", foreign: false, photo: null,
    club: "Clube", league: "BRA1", leagueName: "Série A", group: "Brasil", maxMin: 3420, season: "2026",
    ...o,
    stats: s === null ? null : stats({ id, ...s }),
  };
};

const ctx = (o: Partial<SearchCtx> = {}): SearchCtx => ({ balance: 10_000_000, freeCutoff: FREE, ownIds: new Set(), ...o });

describe("por 90 e amostra", () => {
  it("por 90 minutos e % de minutos", () => {
    expect(per90(10, 900)).toBe(1);
    expect(per90(3, 0)).toBe(0);
    expect(minutesShare(1710, 3420)).toBe(0.5);
    expect(minutesShare(4000, 3420)).toBe(1);
  });

  it("indicadores brutos", () => {
    const s = stats({ min: 900, goals: 5, assists: 3, conceded: 10, apps: 10, cleanSheets: 4, yc: 2, rc: 1 });
    expect(indicatorValue("goals90", s, 1800)).toBeCloseTo(0.5);
    expect(indicatorValue("ga90", s, 1800)).toBeCloseTo(0.8);
    expect(indicatorValue("conc90", s, 1800)).toBeCloseTo(1);
    expect(indicatorValue("clean", s, 1800)).toBeCloseTo(0.4);
    expect(indicatorValue("minPct", s, 1800)).toBeCloseTo(0.5);
    expect(indicatorValue("disc", s, 1800)).toBeCloseTo(0.4); // 2 amarelos + vermelho (2)
  });

  it("abaixo da amostra mínima: sem percentil, sem nota, risco sinalizado", () => {
    const [small, ok] = evaluate([pr({ pos: "ATA" }, { min: MIN_SAMPLE - 1, goals: 9 }), pr({ pos: "ATA" }, { min: 900 })], { contractCut: CUT });
    expect(small.m.sample).toBe(false);
    expect(small.m.score).toBeNull();
    expect(small.m.indicators.every((r) => r.pct === null)).toBe(true);
    expect(small.m.risks.map((r) => r.id)).toContain("sample");
    expect(ok.m.score).not.toBeNull();
    // sem estatística nenhuma
    const [none] = evaluate([pr({ pos: "ZAG" }, null)], { contractCut: CUT });
    expect(none.m.score).toBeNull();
    expect(none.m.risks[0].label).toMatch(/Sem estatísticas/);
  });
});

describe("percentis por posição e grupo", () => {
  it("percentil com empates e inverso", () => {
    expect(percentile(3, [1, 2, 3])).toBe(100);
    expect(percentile(1, [1, 2, 3])).toBe(0);
    expect(percentile(2, [1, 2, 2, 3])).toBe(50);
    expect(percentile(1, [1, 2, 3], true)).toBe(100);
    expect(percentile(5, [5])).toBe(50);
  });

  it("atacante só se compara com atacante do mesmo grupo", () => {
    const pool = [
      pr({ pos: "ATA", id: "a1" }, { goals: 20 }),
      pr({ pos: "ATA", id: "a2" }, { goals: 5 }),
      // zagueiro com muitos gols não entra na conta dos atacantes
      pr({ pos: "ZAG", id: "z1" }, { goals: 30 }),
      // atacante de outro grupo também não
      pr({ pos: "ATA", id: "e1", group: "Top 5 da Europa", league: "GB1" }, { goals: 40 }),
    ];
    const out = evaluate(pool, { contractCut: CUT });
    const g = (id: string) => out.find((x) => x.id === id)!;
    const goals = (x: ScoutPlayer) => x.m.indicators.find((r) => r.id === "goals90")!.pct;
    expect(goals(g("a1"))).toBe(100);
    expect(goals(g("a2"))).toBe(0);
    expect(goals(g("e1"))).toBe(50); // sozinho no grupo
  });

  it("nota da posição pondera os percentis; goleiro que sofre menos fica acima", () => {
    const out = evaluate(
      [pr({ pos: "GOL", id: "g1" }, { conceded: 10, cleanSheets: 10, min: 1800 }), pr({ pos: "GOL", id: "g2" }, { conceded: 30, cleanSheets: 2, min: 1800 })],
      { contractCut: CUT },
    );
    const [g1, g2] = out;
    expect(g1.m.score).toBeGreaterThan(g2.m.score!);
    // minutos iguais (empate = 50 no indicador de peso 20) e o resto 100 vs 0
    expect(g1.m.score).toBe(90);
    expect(g2.m.score).toBe(10);
  });
});

describe("índices", () => {
  it("valorização em 12 meses e distância do pico", () => {
    const [x] = evaluate([pr({ pos: "MEI", value: 3_000_000 }, { value12m: 2_000_000, valuePeak: 6_000_000 })], { contractCut: CUT });
    expect(x.m.trend).toBe(50);
    expect(x.m.fromPeak).toBe(50);
  });

  it("custo-benefício: mesma nota, mais barato vale mais", () => {
    expect(valueForMoneyRaw(80, 1_000_000)).toBeGreaterThan(valueForMoneyRaw(80, 50_000_000));
    const out = evaluate(
      [pr({ pos: "ATA", id: "c", value: 500_000 }, { goals: 10 }), pr({ pos: "ATA", id: "e", value: 40_000_000 }, { goals: 10 })],
      { contractCut: CUT },
    );
    expect(out[0].m.value4money).toBeGreaterThan(out[1].m.value4money!);
  });

  it("potencial: joia sub-21 com nota 70+ ou sub-23 com 80+", () => {
    expect(potentialOf(20, 72, 0.6).gem).toBe(true);
    expect(potentialOf(22, 75, 0.6).gem).toBe(false);
    expect(potentialOf(23, 82, 0.2).gem).toBe(true);
    expect(potentialOf(19, 70, 0.6).value).toBe(70 + 12 + 6);
    expect(potentialOf(null, 70, 1).value).toBeNull();
  });

  it("fim de contrato, subvalorizado, exportação e risco do veterano", () => {
    const pool = [
      pr({ pos: "ATA", id: "top", contract: "2027-06-30", value: 1_000_000, league: "COLP", group: "Brasil" }, { goals: 25 }),
      pr({ pos: "ATA", id: "mid", value: 5_000_000 }, { goals: 10 }),
      pr({ pos: "ATA", id: "low", value: 9_000_000 }, { goals: 1 }),
      pr({ pos: "ATA", id: "old", age: 33, value: 6_000_000, contract: "2030-06-30" }, { goals: 0 }),
    ];
    const out = evaluate(pool, { contractCut: CUT });
    const g = (id: string) => out.find((x) => x.id === id)!;
    expect(g("top").m.contractChance).toBe(true);
    expect(g("mid").m.contractChance).toBe(false);
    expect(g("top").m.exportLeague).toBe(true);
    expect(g("old").m.risks.map((r) => r.id)).toContain("veteran");
    expect(contractCutFrom("2027-01-01")).toBe("2027-06-30");
  });

  it("subvalorizado: nota 75+ e valor abaixo da mediana da posição na liga", () => {
    const pool = [
      pr({ pos: "PON", id: "u", value: 1_000_000 }, { goals: 15, assists: 10 }),
      pr({ pos: "PON", value: 5_000_000 }, { goals: 2 }),
      pr({ pos: "PON", value: 8_000_000 }, { goals: 1 }),
    ];
    const u = evaluate(pool, { contractCut: CUT }).find((x) => x.id === "u")!;
    expect(u.m.posMedianValue).toBe(5_000_000);
    expect(u.m.undervalued).toBe(true);
  });
});

describe("buscas do olheiro", () => {
  const pool = evaluate(
    [
      pr({ pos: "ATA", id: "star", value: 30_000_000, group: "Top 5 da Europa", league: "GB1" }, { goals: 25 }),
      pr({ pos: "ATA", id: "hid", value: 800_000, league: "COLP", group: "América do Sul" }, { goals: 20 }),
      pr({ pos: "ATA", id: "hid2", value: 9_000_000, league: "COLP", group: "América do Sul" }, { goals: 2 }),
      pr({ pos: "ATA", id: "kid", age: 19, value: 2_000_000 }, { goals: 18 }),
      pr({ pos: "ATA", id: "end", value: 3_000_000, contract: "2026-12-31" }, { goals: 12 }),
      pr({ pos: "ATA", id: "meh", value: 4_000_000 }, { goals: 3 }),
      pr({ pos: "LE", id: "le1", value: 1_000_000 }, { assists: 8 }),
      pr({ pos: "LE", id: "le2", value: 50_000_000 }, { assists: 9 }),
      pr({ pos: "ATA", id: "tiny" }, { min: 100, goals: 5 }),
    ],
    { contractCut: CUT },
  );

  it("filtros manuais", () => {
    const f = { ...emptyFilters(), pos: ["ATA" as Pos], maxAge: 21 };
    expect(applyFilters(pool, f, ctx()).map((x) => x.id)).toEqual(["kid"]);
    expect(applyFilters(pool, { ...emptyFilters(), afford: true, pos: ["ATA" as Pos] }, ctx({ balance: 1_000_000 })).map((x) => x.id)).toEqual(["hid", "end"]);
    expect(applyFilters(pool, { ...emptyFilters(), minMinutes: 500 }, ctx()).some((x) => x.id === "tiny")).toBe(false);
    expect(applyFilters(pool, { ...emptyFilters(), contractYear: 2026 }, ctx()).map((x) => x.id)).toEqual(["end"]);
    expect(applyFilters(pool, { ...emptyFilters(), group: "América do Sul" }, ctx()).length).toBe(2);
    expect(applyFilters(pool, { ...emptyFilters(), minScore: 1 }, ctx()).some((x) => x.id === "tiny")).toBe(false);
  });

  it("os óbvios: ordem pela nota, sem amostra pequena nem o próprio elenco", () => {
    const r = runSearch("obvious", pool, ctx({ ownIds: new Set(["kid"]) }));
    expect(r.some((x) => x.id === "tiny" || x.id === "kid")).toBe(false);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].m.score!).toBeGreaterThanOrEqual(r[i].m.score!);
    expect(r.length).toBeLessThanOrEqual(10);
  });

  it("não óbvios ficam fora do top 5 e até a mediana de valor", () => {
    const r = runSearch("hidden", pool, ctx());
    expect(r.every((x) => x.group !== "Top 5 da Europa" && x.m.score! >= 75)).toBe(true);
  });

  it("joias, fim de contrato e custo-benefício que cabe no saldo", () => {
    expect(runSearch("gems", pool, ctx()).every((x) => x.m.gem)).toBe(true);
    expect(runSearch("contract", pool, ctx()).every((x) => x.m.contractChance)).toBe(true);
    const v = runSearch("value", pool, ctx({ balance: 1_000_000 }));
    expect(v.every((x) => (x.value ?? 0) <= 1_000_000 || x.contract! < FREE)).toBe(true);
  });

  it("reposição: mesma posição, mais barato ou mais jovem, mais parecido primeiro", () => {
    const ref = pool.find((x) => x.id === "le2")!;
    const r = similarTo(ref, pool);
    expect(r.map((x) => x.id)).toEqual(["le1"]);
    expect(profileDistance(ref, ref)).toBe(0);
    expect(runSearch("replace", pool, ctx({ ref })).map((x) => x.id)).toEqual(["le1"]);
    expect(runSearch("replace", pool, ctx({ ref: null }))).toEqual([]);
  });

  it("cobrir a carência usa as posições que faltam", () => {
    const r = runSearch("needs", pool, ctx({ needs: [{ pos: "LE", short: 1 }, { pos: "ATA", short: 0 }] }));
    expect(r.map((x) => x.id)).toEqual(["le1"]); // le2 não cabe no saldo
    expect(needsText([{ pos: "LE", short: 2 }])).toBe("Faltam 2 LE");
  });
});

describe("prateleiras, planos e comparador", () => {
  it("prateleira com motivo só no descarte", () => {
    let s = scoutReducer(emptyScoutState(), { type: "shelf", key: "BRA1:1", shelf: "monitor", at: 1 });
    s = scoutReducer(s, { type: "shelf", key: "BRA1:2", shelf: "discard", reason: "caro", at: 2 });
    expect(s.shelves["BRA1:2"]).toEqual({ shelf: "discard", reason: "caro", at: 2 });
    s = scoutReducer(s, { type: "shelf", key: "BRA1:1", shelf: "priority", reason: "x", at: 3 });
    expect(s.shelves["BRA1:1"]).toEqual({ shelf: "priority", at: 3 });
    expect(shelfCounts(s)).toEqual({ monitor: 0, close: 0, priority: 1, discard: 1 });
    s = scoutReducer(s, { type: "shelf", key: "BRA1:1", shelf: null });
    expect(s.shelves["BRA1:1"]).toBeUndefined();
  });

  it("planos A/B/C: sem duplicar, até 5, reordenar e remover", () => {
    let s = emptyScoutState();
    for (const k of ["a", "b", "a", "c", "d", "e", "f"]) s = scoutReducer(s, { type: "plan/add", pos: "LE", key: k });
    expect(s.plans.LE).toEqual(["a", "b", "c", "d", "e"]);
    s = scoutReducer(s, { type: "plan/move", pos: "LE", key: "b", dir: -1 });
    expect(s.plans.LE!.slice(0, 2)).toEqual(["b", "a"]);
    s = scoutReducer(s, { type: "plan/move", pos: "LE", key: "b", dir: -1 }); // já é o A
    expect(s.plans.LE![0]).toBe("b");
    expect(planOf(s, "c")).toEqual({ pos: "LE", index: 2 });
    for (const k of ["a", "b", "c", "d", "e"]) s = scoutReducer(s, { type: "plan/remove", pos: "LE", key: k });
    expect(s.plans.LE).toBeUndefined();
  });

  it("comparador guarda até 3 (sai o mais antigo) e notas vazias somem", () => {
    let s = emptyScoutState();
    for (const k of ["1", "2", "3", "4"]) s = scoutReducer(s, { type: "compare", key: k });
    expect(s.compare).toEqual(["2", "3", "4"]);
    s = scoutReducer(s, { type: "compare", key: "3" });
    expect(s.compare).toEqual(["2", "4"]);
    s = scoutReducer(s, { type: "note", key: "1", text: "bom de cabeça" });
    expect(s.notes["1"]).toBe("bom de cabeça");
    s = scoutReducer(s, { type: "note", key: "1", text: "  " });
    expect(s.notes["1"]).toBeUndefined();
  });

  it("adicionar ao mercado: livre pelo contrato, compra pelo valor, sem duplicar", () => {
    expect(signingFor({ id: "1", value: 5e6, contract: "2026-12-31" }, "BRA1", FREE)).toEqual({ id: "1", league: "BRA1", type: "free", price: 0 });
    expect(signingFor({ id: "2", value: 5e6, contract: "2028-12-31" }, "BRA1", FREE)).toEqual({ id: "2", league: "BRA1", type: "buy", price: 5e6 });
    const st = { ...emptyMarketState(), signings: [{ id: "1", league: "BRA1", type: "loan" as const, price: 0 }] };
    const r = withSignings(st, [signingFor({ id: "1", value: 1, contract: null }, "BRA1", FREE), signingFor({ id: "2", value: 5e6, contract: null }, "BRA1", FREE)]);
    expect(r.added.map((s) => s.id)).toEqual(["2"]);
    expect(r.state.signings.map((s) => [s.id, s.type])).toEqual([["1", "loan"], ["2", "buy"]]);
    expect(withSignings(r.state, [r.added[0]]).state).toBe(r.state);
  });
});
