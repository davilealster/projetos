import { describe, expect, it } from "vitest";
import {
  isAbbreviated, mapApiPosition, mapSportsDbPosition, matchPlayerName, matchTeamSlug,
  mergePlayers, needsPositionReview, sortPlayers, stripMeta, type Pos, type RawPlayer,
} from "../scripts/lib/core";

const raw = (o: Partial<RawPlayer> & { id: number }): RawPlayer => ({
  name: `Jogador ${o.id}`, number: null, position: "Midfielder", photo: null, ...o,
});

describe("mapApiPosition", () => {
  it("mapeia as 4 posições da API", () => {
    expect(mapApiPosition("Goalkeeper")).toBe("GOL");
    expect(mapApiPosition("Defender")).toBe("ZAG");
    expect(mapApiPosition("Midfielder")).toBe("MEI");
    expect(mapApiPosition("Attacker")).toBe("ATA");
    expect(mapApiPosition(null)).toBe("MEI");
  });
});

describe("mapSportsDbPosition", () => {
  it.each([
    ["Right-Back", "LD"], ["Left-Back", "LE"], ["Centre-Back", "ZAG"],
    ["Defensive Midfield", "VOL"], ["Central Midfield", "MEI"], ["Attacking Midfield", "MEI"],
    ["Right Winger", "PON"], ["Left Winger", "PON"], ["Centre-Forward", "ATA"], ["Striker", "ATA"],
    ["Goalkeeper", "GOL"], ["Right Wing-Back", "LD"],
  ])("%s → %s", (input, out) => expect(mapSportsDbPosition(input)).toBe(out));

  it("retorna null para vazio ou desconhecido", () => {
    expect(mapSportsDbPosition("")).toBeNull();
    expect(mapSportsDbPosition("Manager")).toBeNull();
  });
});

describe("matchTeamSlug", () => {
  const aliases = { vasco: ["Vasco DA Gama"], "sao-paulo": ["Sao Paulo"] };
  it("ignora acento e caixa", () => {
    expect(matchTeamSlug("Vasco da Gama", aliases)).toBe("vasco");
    expect(matchTeamSlug("São Paulo", aliases)).toBe("sao-paulo");
    expect(matchTeamSlug("Flamengo", aliases)).toBeNull();
  });
});

describe("matchPlayerName", () => {
  const cands = ["Léo Jardim", "Philippe Coutinho", "Paulo Henrique", "Lucas Freitas", "Luiz Freitas"];
  it("casa nome abreviado por inicial + sobrenome", () => {
    expect(isAbbreviated("L. Jardim")).toBe(true);
    expect(matchPlayerName("L. Jardim", cands)).toBe(0);
    expect(matchPlayerName("P. Coutinho", cands)).toBe(1);
  });
  it("prefere o casamento exato", () => {
    expect(matchPlayerName("Paulo Henrique", cands)).toBe(2);
  });
  it("devolve -1 quando ambíguo", () => {
    expect(matchPlayerName("L. Freitas", cands)).toBe(-1);
  });
});

describe("sortPlayers", () => {
  it("ordena por posição, depois número, sem número por último", () => {
    const list: { name: string; pos: Pos; number: number | null }[] = [
      { name: "c", pos: "ATA", number: 9 },
      { name: "a", pos: "GOL", number: null },
      { name: "b", pos: "GOL", number: 1 },
      { name: "d", pos: "LD", number: 2 },
      { name: "e", pos: "ZAG", number: 3 },
    ];
    expect(sortPlayers(list).map((x) => x.name)).toEqual(["b", "a", "e", "d", "c"]);
  });
});

describe("mergePlayers", () => {
  const base = {
    slug: "vasco",
    raw: [
      raw({ id: 1, name: "L. Jardim", number: 1, position: "Goalkeeper" }),
      raw({ id: 2, name: "P. Henrique", number: 96, position: "Defender" }),
      raw({ id: 3, name: "Fulano", number: 30, position: "Attacker" }),
      raw({ id: 4, name: "Sicrano", number: 8, position: "Midfielder" }),
      raw({ id: 4, name: "Sicrano", number: 8, position: "Midfielder" }),
    ],
    overrides: {
      "2": { pos: "LD" as const, displayName: "PH", number: 20 },
      "3": { hide: true },
    },
    suggestions: {
      "1": { fullName: "Léo Jardim", pos: "GOL" as const },
      "4": { pos: "VOL" as const, strPosition: "Defensive Midfield" },
    },
    hasPhoto: (id: number) => id === 1,
  };
  const out = mergePlayers(base);

  it("esconde jogadores com hide e remove duplicados", () => {
    expect(out.map((x) => x.id)).toEqual([1, 2, 4]);
  });
  it("override vence sugestão, sugestão vence API", () => {
    const ph = out.find((x) => x.id === 2)!;
    expect(ph).toMatchObject({ name: "PH", pos: "LD", number: 20, posSource: "override" });
    expect(out.find((x) => x.id === 4)).toMatchObject({ pos: "VOL", posSource: "sportsdb" });
  });
  it("expande nome abreviado pelo TheSportsDB", () => {
    expect(out[0].name).toBe("Léo Jardim");
  });
  it("só aponta foto quando existe", () => {
    expect(out[0].photo).toBe("/players/vasco/1.webp");
    expect(out[1].photo).toBeNull();
  });
  it("marca para revisão só posição genérica vinda da API", () => {
    const generic = mergePlayers({ ...base, overrides: {}, suggestions: {} });
    expect(generic.filter(needsPositionReview).map((x) => x.id)).toEqual([2, 4, 3]);
  });
  it("stripMeta tira os campos internos", () => {
    expect(Object.keys(stripMeta(out[0])).sort()).toEqual(["id", "name", "number", "photo", "pos"]);
  });
});
