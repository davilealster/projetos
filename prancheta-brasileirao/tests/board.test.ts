import { describe, expect, it } from "vitest";
import { FORMATION_NAMES, applyFormation, applyOppNumbers, slotsFor } from "../src/lib/formations";
import { decodeState, emptyState, encodeState } from "../src/lib/state";
import type { Player, Pos } from "../src/types";

let nextId = 1;
const pl = (pos: Pos, number: number | null = null): Player => ({ id: nextId++, name: `J${nextId}`, number, pos, photo: null });
const squad: Player[] = [
  pl("GOL", 1), pl("GOL", 12),
  pl("ZAG", 3), pl("ZAG", 4), pl("ZAG", 2), pl("ZAG", 6), pl("ZAG", 13),
  pl("MEI", 5), pl("MEI", 8), pl("MEI", 10), pl("MEI", 15),
  pl("ATA", 7), pl("ATA", 9), pl("ATA", 11),
];

describe("formações", () => {
  it.each(FORMATION_NAMES)("%s tem 11 vagas e um goleiro", (f) => {
    const slots = slotsFor(f, true);
    expect(slots).toHaveLength(11);
    expect(slots.filter((s) => s.role === "GOL")).toHaveLength(1);
  });

  it("escala 11 distintos com exatamente um goleiro", () => {
    const tokens = applyFormation({ formation: "4-3-3", kind: "player", squad, current: [] });
    expect(tokens).toHaveLength(11);
    expect(new Set(tokens.map((t) => t.ref)).size).toBe(11);
    const gks = tokens.filter((t) => squad.find((p) => p.id === t.ref)!.pos === "GOL");
    expect(gks).toHaveLength(1);
  });

  it("mantém quem já está em campo ao trocar de formação", () => {
    const first = applyFormation({ formation: "4-3-3", kind: "player", squad, current: [] });
    const second = applyFormation({ formation: "3-5-2", kind: "player", squad, current: first });
    expect(new Set(second.map((t) => t.ref))).toEqual(new Set(first.map((t) => t.ref)));
  });

  it("sozinho ocupa o campo todo; com adversário fica na própria metade", () => {
    const full = applyFormation({ formation: "4-3-3", kind: "player", squad, current: [], fullPitch: true });
    const half = applyFormation({ formation: "4-3-3", kind: "player", squad, current: [] });
    expect(Math.max(...full.map((t) => t.u))).toBeGreaterThan(0.6);
    expect(Math.max(...half.map((t) => t.u))).toBeLessThan(0.5);
  });

  it("adversário numerado fica espelhado no outro campo", () => {
    const opp = applyOppNumbers("4-4-2");
    expect(opp.map((t) => t.ref)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(opp.every((t) => t.u > 0.5)).toBe(true);
  });
});

describe("link compartilhável", () => {
  it("ida e volta preserva peças, desenhos, cor e adversário", () => {
    const s = {
      ...emptyState(),
      tokens: [
        { kind: "ball" as const, ref: 0, u: 0.5, v: 0.5 },
        { kind: "player" as const, ref: 41169, u: 0.045, v: 0.5 },
        { kind: "oppPlayer" as const, ref: 99, u: 0.9, v: 0.25 },
        { kind: "opp" as const, ref: 7, u: 0.7, v: 0.123 },
      ],
      drawings: [{ id: "x", tool: "arrow" as const, color: "#FFD400", pts: [[0.1, 0.2], [0.5, 0.6]] as [number, number][] }],
      oppColor: "#1B6FD8",
      oppSlug: "flamengo",
      formation: "3-5-2",
    };
    const code = encodeState(s);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeState(code)!;
    expect(back.tokens).toEqual(s.tokens);
    expect(back.drawings[0].pts).toEqual(s.drawings[0].pts);
    expect(back.drawings[0].tool).toBe("arrow");
    expect(back).toMatchObject({ oppColor: "#1B6FD8", oppSlug: "flamengo", formation: "3-5-2" });
  });

  it("código inválido retorna null em vez de quebrar", () => {
    expect(decodeState("!!!")).toBeNull();
    expect(decodeState("e30")).toBeNull(); // "{}"
  });
});

describe("pickSlot (clique para escalar)", async () => {
  const { pickSlot, slotsFor } = await import("../src/lib/formations");
  const slots = slotsFor("4-3-3", true);
  it("zagueiro vai para vaga de zagueiro, não de lateral", () => {
    expect(pickSlot(slots, [], { pos: "ZAG" })?.role).toBe("ZAG");
  });
  it("com as vagas de zagueiro ocupadas, usa a alternativa", () => {
    const zags = slots.filter((s) => s.role === "ZAG");
    expect(pickSlot(slots, zags, { pos: "ZAG", alt: ["VOL"] })?.role).toBe("VOL");
  });
  it("lateral esquerdo vai para LE; goleiro para o gol", () => {
    expect(pickSlot(slots, [], { pos: "LE" })?.role).toBe("LE");
    expect(pickSlot(slots, [], { pos: "GOL" })?.role).toBe("GOL");
  });
  it("quem não é goleiro nunca cai no gol", () => {
    const allButGk = slots.filter((s) => s.role !== "GOL");
    expect(pickSlot(slots, allButGk, { pos: "ATA" })).toBeNull();
  });
  it("ficha numerada usa a vaga do número", () => {
    expect(pickSlot(slots, [], null, 6)).toBe(slots[6]);
  });
});
