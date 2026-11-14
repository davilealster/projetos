import { describe, expect, it } from "vitest";
import { arrivalOf, countryPt, isForeign, loanStatus, matchClubSlug, tmPhoto, tmPosition, type TmTransfer } from "../scripts/lib/market";
import { actionsFor, contractYears, depthChart, emptyMarketState, fmtEur, isEnding, isFreeAgent, moneyOf, nextSeason, shareText, summarize, waterfall } from "../src/market/logic";
import type { MarketPlayer, SquadPlayer } from "../src/market/types";

const VASCO = "978";
const t = (o: Partial<TmTransfer> & { from: string; to: string; date: string }): TmTransfer => ({
  id: Math.random().toString(),
  clubFrom: { id: o.from, name: `Clube ${o.from}` },
  clubTo: { id: o.to, name: `Clube ${o.to}` },
  date: o.date,
  upcoming: o.upcoming ?? false,
  transferType: o.transferType ?? "transfer",
  fee: o.fee ?? null,
  contractUntil: o.contractUntil ?? null,
});

describe("situação contratual (Transfermarkt)", () => {
  it("chegou emprestado: última transferência é empréstimo para o clube", () => {
    const ts = [t({ from: "199", to: VASCO, date: "2026-01-10", transferType: "loan", contractUntil: "2026-12-31" })];
    expect(loanStatus(ts, VASCO)).toEqual({ status: "loanIn", loanClub: "Clube 199", loanUntil: "2026-12-31" });
    expect(arrivalOf(ts, VASCO, "loanIn")).toMatchObject({ type: "loan", from: "Clube 199" });
  });

  it("emprestado fora: última transferência é empréstimo saindo do clube", () => {
    const ts = [
      t({ from: VASCO, to: "300", date: "2026-02-01", transferType: "loan", contractUntil: "2026-12-31" }),
      t({ from: "50", to: VASCO, date: "2024-07-01", fee: 3_000_000 }),
    ];
    expect(loanStatus(ts, VASCO).status).toBe("loanOut");
    expect(arrivalOf(ts, VASCO, "owned")).toMatchObject({ type: "transfer", from: "Clube 50", fee: 3_000_000 });
  });

  it("voltou de empréstimo: é do clube, e a chegada é a compra original", () => {
    const ts = [
      t({ from: "300", to: VASCO, date: "2026-01-01", transferType: "endOfLoan" }),
      t({ from: VASCO, to: "300", date: "2025-02-01", transferType: "loan" }),
      t({ from: "77", to: VASCO, date: "2023-01-05", transferType: "freeTransfer" }),
    ];
    expect(loanStatus(ts, VASCO).status).toBe("owned");
    expect(arrivalOf(ts, VASCO, "owned")).toMatchObject({ type: "freeTransfer", from: "Clube 77" });
  });

  it("sem transferência para o clube = formado na base; transferência futura é ignorada", () => {
    const ts = [t({ from: VASCO, to: "900", date: "2027-01-01", upcoming: true })];
    expect(loanStatus(ts, VASCO).status).toBe("owned");
    expect(arrivalOf(ts, VASCO, "owned").type).toBe("youth");
    expect(arrivalOf(undefined, VASCO, "owned").type).toBe("unknown");
  });

  it("posições do Transfermarkt", () => {
    expect(tmPosition("Goalkeeper")).toBe("GOL");
    expect(tmPosition("Left-Back")).toBe("LE");
    expect(tmPosition("Defensive Midfield")).toBe("VOL");
    expect(tmPosition("Right Winger")).toBe("PON");
    expect(tmPosition("Centre-Forward")).toBe("ATA");
    expect(tmPosition("Attack")).toBe("ATA");
    expect(tmPosition(null)).toBe("MEI");
  });

  it("estrangeiro, país em português e foto", () => {
    expect(isForeign(["Argentina", "Italy"])).toBe(true);
    expect(isForeign(["Portugal", "Brazil"])).toBe(false);
    expect(countryPt("Colombia")).toBe("Colômbia");
    expect(countryPt("Kosovo")).toBe("Kosovo");
    expect(tmPhoto("https://img.a.transfermarkt.technology/portrait/big/default.jpg")).toBeNull();
  });

  it("nome do clube no Transfermarkt → slug", () => {
    const aliases = { vasco: ["Vasco da Gama"], flamengo: ["Flamengo"], "atletico-mg": ["Atletico Mineiro"], "athletico-pr": ["Athletico Paranaense"] };
    expect(matchClubSlug("CR Vasco da Gama", aliases)).toBe("vasco");
    expect(matchClubSlug("Clube de Regatas do Flamengo", aliases)).toBe("flamengo");
    expect(matchClubSlug("Clube Atlético Mineiro", aliases)).toBe("atletico-mg");
    expect(matchClubSlug("Club Athletico Paranaense", aliases)).toBe("athletico-pr");
    expect(matchClubSlug("Real Madrid", aliases)).toBeNull();
  });
});

const CUT = "2027-01-01";
const sp = (o: Partial<SquadPlayer> & { id: string }): SquadPlayer => ({
  name: o.id, pos: "MEI", posName: null, age: 25, value: 5_000_000, contract: "2029-12-31", nat: null, foreign: false, num: null, photo: null,
  status: "owned", arrival: { type: "unknown", from: null, fee: null, date: null }, joined: null, ...o,
});

describe("regras do mercado", () => {
  it("ações e padrão por situação", () => {
    expect(actionsFor(sp({ id: "a" }), CUT).def).toBe("keep");
    expect(actionsFor(sp({ id: "b", contract: "2026-12-31" }), CUT)).toEqual({ options: ["renew", "letGo", "sell"], def: "renew" });
    expect(actionsFor(sp({ id: "c", status: "loanIn", loanUntil: "2026-12-31" }), CUT).def).toBe("returnLoan");
    expect(actionsFor(sp({ id: "d", status: "loanIn", loanUntil: "2027-12-31" }), CUT).def).toBe("extendLoan");
    expect(actionsFor(sp({ id: "e", status: "loanOut", loanUntil: "2026-06-30" }), CUT).def).toBe("recall");
  });

  it("contrato terminando e jogador livre no mercado", () => {
    expect(isEnding(sp({ id: "x", contract: "2026-12-31" }), CUT)).toBe(true);
    const m = { contract: "2026-06-30" } as MarketPlayer;
    expect(isFreeAgent(m, CUT)).toBe(true);
    expect(isFreeAgent({ ...m, contract: "2028-06-30" }, CUT)).toBe(false);
  });

  it("dinheiro: venda entra, compra em definitivo sai, empréstimo sem taxa é zero", () => {
    const p = sp({ id: "p", value: 8_000_000 });
    expect(moneyOf(p, { action: "sell" })).toBe(8_000_000);
    expect(moneyOf(p, { action: "sell", price: 10_000_000 })).toBe(10_000_000);
    expect(moneyOf(p, { action: "buyOut" })).toBe(-8_000_000);
    expect(moneyOf(p, { action: "loanOut" })).toBe(0);
  });

  it("resumo: saldo, quem fica, quem sai e pendências", () => {
    const squad = [
      sp({ id: "fica" }),
      sp({ id: "vende", value: 10_000_000 }),
      sp({ id: "termina", contract: "2026-12-31" }),
      sp({ id: "emprestadoFora", status: "loanOut", loanUntil: "2028-01-01" }),
    ];
    const st = {
      ...emptyMarketState(),
      budget: 5_000_000,
      decisions: { vende: { action: "sell" as const } },
      signings: [{ id: "n1", league: "GB1", type: "buy" as const, price: 12_000_000 }, { id: "n2", league: "AR1N", type: "free" as const, price: 0 }],
    };
    const s = summarize(squad, st, CUT, [{ value: 12_000_000, age: 22 }, { value: 1_000_000, age: 30 }]);
    expect(s.income).toBe(10_000_000);
    expect(s.spend).toBe(12_000_000);
    expect(s.balance).toBe(3_000_000); // 5 + 10 – 12
    expect(s.stays.map((p) => p.id)).toEqual(["fica", "termina"]);
    expect(s.leaves.map((l) => l.p.id)).toEqual(["vende"]); // emprestado fora não "sai" do elenco atual
    expect(s.pending.map((p) => p.id)).toEqual(["termina"]);
    expect(s.squadSize).toBe(4);
    expect(summarize(squad, { ...st, useSales: false }, CUT, []).balance).toBe(-7_000_000);
  });

  it("formatação em euros", () => {
    expect(fmtEur(12_500_000)).toBe("€ 12,5 mi");
    expect(fmtEur(800_000)).toBe("€ 800 mil");
    expect(fmtEur(null)).toBe("—");
  });
});

describe("gráficos e resumo da janela", () => {
  const squad = [
    sp({ id: "g1", pos: "GOL" }),
    sp({ id: "z1", pos: "ZAG", contract: "2027-12-31" }),
    sp({ id: "z2", pos: "ZAG", contract: "2026-12-31" }),
    sp({ id: "a1", pos: "ATA", value: 9_000_000 }),
    sp({ id: "fora", pos: "MEI", status: "loanOut", loanUntil: "2028-01-01" }),
  ];
  const st = { ...emptyMarketState(), budget: 10_000_000, decisions: { a1: { action: "sell" as const }, z2: { action: "renew" as const } } };
  const novo = { id: "n", name: "Novo", club: 0, pos: "ATA", posName: null, age: 21, value: 4_000_000, contract: "2029-06-30", nat: null, foreign: true, photo: null } as MarketPlayer;
  const list = nextSeason(squad, st, CUT, [novo]);

  it("elenco da próxima temporada: fica, sai, chega; emprestado fora que segue fora não entra", () => {
    expect(list.map((x) => `${x.id}:${x.kind}`)).toEqual(["g1:stay", "z1:stay", "z2:stay", "a1:leave", "n:new"]);
    expect(list.find((x) => x.id === "z2")!.contract).toBe("renew");
  });
  it("estrangeiros contam quem fica e quem chega", () => {
    expect(list.filter((x) => x.kind !== "leave" && x.foreign).map((x) => x.id)).toEqual(["n"]);
  });
  it("profundidade por posição aponta carências", () => {
    const d = depthChart(list);
    const ata = d.find((r) => r.pos === "ATA")!;
    expect([ata.stay.length, ata.fresh.length, ata.leave.length, ata.short]).toEqual([0, 1, 1, 2]);
    expect(d.find((r) => r.pos === "GOL")!.short).toBe(2);
  });
  it("contratos por ano, com renovados separados e sem contar quem sai", () => {
    expect(contractYears(list).map((y) => [y.label, y.count])).toEqual([["2027", 1], ["2029", 2], ["Renovados", 1]]);
  });
  it("cascata fecha no saldo", () => {
    const w = waterfall(st, { income: 9_000_000, spend: 4_000_000, balance: 15_000_000 });
    expect(w.map((s) => [s.label, s.from, s.to])).toEqual([["Orçamento", 0, 10e6], ["Vendas", 10e6, 19e6], ["Gastos", 15e6, 19e6], ["Saldo", 0, 15e6]]);
    expect(waterfall({ ...st, useSales: false }, { income: 9e6, spend: 12e6, balance: -2e6 }).at(-1)).toMatchObject({ from: -2e6, to: 0 });
  });
  it("texto para compartilhar", () => {
    const txt = shareText({ club: "Vasco", season: "2027", arrivals: [{ name: "Novo", from: "Clube X", type: "buy", price: 4e6 }], leaves: [{ name: "a1", action: "sell", money: 9e6 }], balance: 15e6, url: "https://x/mercado/vasco" });
    expect(txt).toContain("🟢 *CHEGAM (1)*");
    expect(txt).toContain("• Novo · Clube X · € 4 mi");
    expect(txt).toContain("• a1 · vendido por € 9 mi");
    expect(txt).toContain("Saldo: € 15 mi");
  });
});

describe("escalação ideal", async () => {
  const { autoLineup, placeInLineup, lineupStats, cleanLineup, FOREIGN_LIMIT } = await import("../src/market/logic");
  const mk = (id: string, pos: Pos, value = 1) => ({ id, pos, value });
  type Pos = import("../src/types").Pos;
  const squad = [
    mk("g1", "GOL", 5), mk("g2", "GOL", 1), mk("g3", "GOL", 0.5),
    mk("ld", "LD"), mk("le", "LE"), mk("z1", "ZAG", 3), mk("z2", "ZAG", 2), mk("z3", "ZAG", 1),
    mk("v1", "VOL"), mk("m1", "MEI", 4), mk("m2", "MEI", 3), mk("m3", "MEI", 1),
    mk("p1", "PON"), mk("p2", "PON"), mk("a1", "ATA", 9), mk("a2", "ATA", 2),
  ];
  const l = autoLineup("4-3-3", squad);

  it("11 titulares na posição certa, o goleiro mais valioso no gol", () => {
    expect(l.starters.filter(Boolean)).toHaveLength(11);
    expect(l.starters[0]).toBe("g1");
    expect(new Set(l.starters).size).toBe(11);
  });
  it("reservas até 2 por vaga, goleiros reservas no gol", () => {
    expect(l.subs.every((s) => s.length <= 2)).toBe(true);
    expect(l.subs[0]).toEqual(["g2", "g3"]);
    const all = [...l.starters, ...l.subs.flat()];
    expect(new Set(all).size).toBe(all.length); // ninguém repetido
  });
  it("trocar titular: o antigo vai para a reserva da vaga", () => {
    const base = { ...l, subs: l.subs.map((s, i) => (i === 0 ? [] : s)) };
    const n = placeInLineup(base, "g3", 0, "starter");
    expect(n.starters[0]).toBe("g3");
    expect(n.subs[0]).toEqual(["g1"]);
  });
  it("limpa quem saiu e conta estrangeiros relacionados", () => {
    const c = cleanLineup(l, new Set(squad.filter((p) => p.id !== "a1").map((p) => p.id)));
    expect(c.starters.includes("a1")).toBe(false);
    const byId = new Map(squad.map((p) => [p.id, { foreign: p.pos === "ZAG", value: p.value }]));
    const st = lineupStats(l, byId);
    expect(st.foreign).toBe(3);
    expect(FOREIGN_LIMIT).toBe(8);
  });
});
