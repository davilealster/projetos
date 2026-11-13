import { describe, expect, it } from "vitest";
import { hash, planSync } from "../src/lib/account";
import { mergeJourney } from "../api/_lib/user";

const base = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hash(v)]));

describe("sincronização da jornada (três vias)", () => {
  it("primeiro login: só na conta baixa, só no navegador sobe, diferentes viram conflito", () => {
    const p = planSync({ "mercado:vasco:v1": "L", "mando:clube": "vasco" }, { "mercado:flamengo:v1": "S", "mando:clube": "palmeiras" }, {});
    expect(p.toLocal).toEqual({ "mercado:flamengo:v1": "S" });
    expect(p.toServer).toEqual({ "mercado:vasco:v1": "L" });
    expect(p.conflicts).toEqual(["mando:clube"]);
  });
  it("com base: vence quem mudou", () => {
    const b = base({ "mercado:vasco:v1": "A", "olheiro:vasco:v1": "X" });
    const p = planSync({ "mercado:vasco:v1": "A", "olheiro:vasco:v1": "Y" }, { "mercado:vasco:v1": "B", "olheiro:vasco:v1": "X" }, b);
    expect(p.toLocal).toEqual({ "mercado:vasco:v1": "B" });
    expect(p.toServer).toEqual({ "olheiro:vasco:v1": "Y" });
    expect(p.conflicts).toEqual([]);
  });
  it("mudou dos dois lados desde a base: conflito", () => {
    const p = planSync({ k: "L" }, { k: "S" }, base({ k: "A" }));
    expect(p.conflicts).toEqual(["k"]);
  });
  it("apagado de um lado depois de sincronizado: apaga do outro", () => {
    const b = base({ a: "1", c: "3" });
    const p = planSync({ c: "3" }, { a: "1" }, b);
    expect(p.toServer).toEqual({ a: null });
    expect(p.toLocal).toEqual({ c: "" });
  });
});

describe("jornada no servidor", () => {
  it("aceita só chaves da jornada, null apaga e recusa tamanho absurdo", () => {
    const d = mergeJourney({ entries: { "mercado:vasco:v1": "x", "olheiro:vasco:v1": "y" }, updatedAt: "" }, { "mercado:vasco:v1": "z", "olheiro:vasco:v1": null, "admin:token": "hack", "mando:clube": "vasco" }, "t");
    expect(d.entries).toEqual({ "mercado:vasco:v1": "z", "mando:clube": "vasco" });
    expect(() => mergeJourney({ entries: {}, updatedAt: "" }, Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`mercado:c${i}:v1`, "x".repeat(199_000)])))).toThrow();
  });
});
