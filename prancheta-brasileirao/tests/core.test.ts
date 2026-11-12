import { describe, expect, it } from "vitest";
import {
  isAbbreviated, mapApiPosition, mapSportsDbPosition, matchPlayerName, matchTeamSlug,
  mergePlayers, needsPositionReview, parsePtPositions, sortPlayers, stripMeta, type Pos, type RawPlayer,
} from "../scripts/lib/core";
import { TEAMS } from "../src/data";
import { parseRoute } from "../src/router";

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

describe("parsePtPositions (pesquisa)", () => {
  it.each([
    ["goleiro", 1, "GOL", []],
    ["lateral-esquerdo", 6, "LE", ["ZAG", "LD"]],
    ["lateral-direito", 96, "LD", ["ZAG", "LE"]],
    ["volante e zagueiro", 5, "VOL", ["ZAG", "MEI"]],
    ["ponta e meio-campista", 28, "PON", ["MEI", "ATA"]],
    ["meio-campista", 10, "MEI", ["VOL", "PON"]],
    ["centroavante", 77, "ATA", ["PON", "MEI"]],
    ["lateral e atacante", 2, "LD", ["ATA", "ZAG"]],
    ["meia / ponta", 10, "MEI", ["PON", "VOL"]],
    ["Right-back", 2, "LD", ["ZAG", "LE"]],
    ["Centre-back, right-back", 13, "ZAG", ["LD", "VOL"]],
    ["Defensive midfielder", 5, "VOL", ["MEI", "ZAG"]],
    ["Attacking midfielder", 10, "MEI", ["VOL", "PON"]],
    ["Winger", 7, "PON", ["ATA", "MEI"]],
    ["Striker", 9, "ATA", ["PON", "MEI"]],
    ["Left back", 6, "LE", ["ZAG", "LD"]],
    ["Left winger, wing-back", 16, "PON", ["LE", "ATA"]],
  ])("%s (nº %s) → %s %j", (txt, n, pos, alt) => {
    expect(parsePtPositions(txt, n)).toMatchObject({ pos, alt });
  });
  it("lateral sem lado e sem número típico fica ambíguo (LD, alternativa LE)", () => {
    expect(parsePtPositions("lateral", 33)).toMatchObject({ pos: "LD", alt: ["LE", "ZAG"], ambiguous: true });
  });
  it("texto desconhecido retorna null", () => {
    expect(parsePtPositions("treinador")).toBeNull();
    expect(parsePtPositions(null)).toBeNull();
  });
});

describe("compatible (casamento da pesquisa)", async () => {
  const { compatible } = await import("../scripts/import-research");
  it.each([
    ["Igor Vinicius", "Igor Vinícius", true],
    ["Igor Vinicius", "Vinicius Lira", false],
    ["J. Rojas", "Johan Rojas", true],
    ["J. Rojas", "Pedro Rojas", false],
    ["Neymar", "Neymar", true],
    ["Danilo", "Danilo Luiz da Silva", true],
    ["G. de Arrascaeta", "Giorgian de Arrascaeta", true],
  ])("%s ~ %s = %s", (a, w, ok) => expect(compatible(a, w)).toBe(ok));
});

describe("cor contrastante para as linhas do adversário", async () => {
  const { distinctColor } = await import("../src/lib/color");
  it("vermelho x vermelho troca para outra cor", () => {
    expect(distinctColor("#E30613", ["#C8102E", "#000000", "#FFFFFF"])).toBe("#00D1FF");
  });
  it("vermelho x azul mantém o azul", () => {
    expect(distinctColor("#E30613", ["#0055A4"])).toBe("#0055A4");
  });
});

describe("parseRoute (Mando)", () => {
  it("separa home, seletor da prancheta, prancheta do clube e mercado", () => {
    expect(parseRoute("/")).toEqual({ page: "home" });
    expect(parseRoute("/prancheta")).toEqual({ page: "picker" });
    expect(parseRoute("/vasco")).toEqual({ page: "board", slug: "vasco", live: false });
    expect(parseRoute("/vasco/live")).toEqual({ page: "board", slug: "vasco", live: true });
    expect(parseRoute("/mercado")).toEqual({ page: "market", slug: null });
    expect(parseRoute("/mercado/vasco")).toEqual({ page: "market", slug: "vasco" });
  });

  it("nenhum slug de clube colide com rotas reservadas", () => {
    const reserved = ["prancheta", "mercado", "creator", "admin"];
    expect(TEAMS.length).toBe(20);
    expect(TEAMS.filter((t) => reserved.includes(t.slug))).toEqual([]);
  });
});
