import { describe, expect, it } from "vitest";
import { arrivalOf, loanStatus, matchClubSlug, tmPosition, type TmTransfer } from "../scripts/lib/market";
import { actionsFor, emptyMarketState, fmtEur, isEnding, isFreeAgent, moneyOf, summarize } from "../src/market/logic";
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
  name: o.id, pos: "MEI", posName: null, age: 25, value: 5_000_000, contract: "2029-12-31", nat: null, num: null, photo: null,
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
