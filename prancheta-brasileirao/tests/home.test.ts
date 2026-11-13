import { describe, expect, it } from "vitest";
import { budgetLabel, progressLabel, readWindowProgress } from "../src/home/progress";

const store = (v: string | null) => ({ getItem: () => v });

describe("progresso da janela na Home", () => {
  it("lê decisões, contratações e orçamento", () => {
    const p = readWindowProgress("vasco", store(JSON.stringify({ budget: 35_000_000, decisions: { a: "sell", b: "keep" }, signings: [{}] })));
    expect(p).toEqual({ decisions: 2, signings: 1, budget: 35_000_000 });
    expect(progressLabel(p)).toBe("2 decisões · 1 contratação");
  });

  it("tolera ausência, JSON inválido e formatos estranhos", () => {
    expect(readWindowProgress("vasco", store(null))).toBeNull();
    expect(readWindowProgress("vasco", store("{oops"))).toBeNull();
    expect(readWindowProgress("vasco", store("42"))).toBeNull();
    expect(readWindowProgress("vasco", store('{"decisions":[1],"signings":"x","budget":"1"}'))).toEqual({ decisions: 0, signings: 0, budget: null });
    expect(readWindowProgress("vasco", { getItem: () => { throw new Error("bloqueado"); } })).toBeNull();
    expect(readWindowProgress("vasco", null)).toBeNull();
    expect(progressLabel({ decisions: 0, signings: 0, budget: 1 })).toBeNull();
  });

  it("formata o orçamento curto", () => {
    expect(budgetLabel(20_000_000)).toBe("€ 20 mi");
    expect(budgetLabel(1_500_000_000)).toBe("€ 1,5 bi");
    expect(budgetLabel(800_000)).toBe("€ 800 mil");
    expect(budgetLabel(null)).toBeNull();
  });
});
