import { describe, expect, it } from "vitest";
import { coachMonth, filterCoaches, sortCoaches } from "../src/market/coaches";
import type { MarketCoach } from "../src/market/types";

const c = (o: Partial<MarketCoach> & { id: string }): MarketCoach => ({ name: `T ${o.id}`, since: null, photo: null, age: null, nat: null, ...o });
const LIST = [
  c({ id: "1", name: "Abel", club: "Palmeiras", league: "Brasileirão Série A", since: "2020-11-04" }),
  c({ id: "2", name: "Autuori", free: true, lastClub: "Fortaleza", lastGame: "2026-11-07" }),
  c({ id: "3", name: "Jardim", club: "Flamengo", league: "Brasileirão Série A", since: "2026-03-04" }),
  c({ id: "4", name: "Nenê", free: true, lastClub: "Ponte Preta", lastGame: "2026-11-12" }),
  c({ id: "5", name: "Gallardo", club: "River", league: "Liga Profesional (Argentina)", since: "2025-08-01" }),
];

describe("técnicos no mercado", () => {
  it("filtra por situação, liga (só quem tem clube), busca e exclui o atual", () => {
    expect(filterCoaches(LIST, { status: "free" }).map((x) => x.id)).toEqual(["2", "4"]);
    expect(filterCoaches(LIST, { status: "employed", league: "Brasileirão Série A" }).map((x) => x.id)).toEqual(["1", "3"]);
    expect(filterCoaches(LIST, { status: "all", league: "Brasileirão Série A" }).map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    expect(filterCoaches(LIST, { status: "all", q: "ponte" }).map((x) => x.id)).toEqual(["4"]);
    expect(filterCoaches(LIST, { status: "all", q: "flamengo", exclude: "3" })).toEqual([]);
  });
  it("ordena sem clube primeiro e depois o trabalho mais recente", () => {
    expect(sortCoaches(LIST).map((x) => x.id)).toEqual(["4", "2", "3", "5", "1"]);
  });
  it("formata mês/ano", () => {
    expect(coachMonth("2026-11-12")).toBe("11/2026");
    expect(coachMonth(null)).toBeNull();
  });
});
