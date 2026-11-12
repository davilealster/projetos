import { describe, expect, it } from "vitest";
import { aggregate, buildLeague, leagueComps, maxMinutes, pickSeason, value12m, valuePeak, type RawScoutPlayer, type TmStat } from "../scripts/scout/lib";

const row = (o: Partial<TmStat> & { competitionId: string; seasonId: string }): TmStat => ({
  clubId: "1",
  appearances: 1,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  secondYellowCards: 0,
  redCards: 0,
  minutesPlayed: 90,
  goalsConceded: 0,
  cleanSheets: 0,
  ...o,
});
const player = (id: string, stats: TmStat[], history: RawScoutPlayer["history"] = []): RawScoutPlayer => ({ id, stats, history });

describe("temporada da liga", () => {
  it("usa o maior season_id da própria liga, ignorando outras competições", () => {
    const ps = [
      player("1", [row({ competitionId: "BRA1", seasonId: "2024" }), row({ competitionId: "CLI", seasonId: "2026" })]),
      player("2", [row({ competitionId: "BRA1", seasonId: "2025" })]),
    ];
    expect(pickSeason(["BRA1"], ps)).toBe("2025");
    expect(pickSeason(["GB1"], ps)).toBeNull();
  });
  it("compara numericamente", () => {
    expect(pickSeason(["X"], [player("1", [row({ competitionId: "X", seasonId: "999" }), row({ competitionId: "X", seasonId: "1000" })])])).toBe("1000");
  });
});

describe("agregação", () => {
  const p = player(
    "7",
    [
      // trocou de clube no meio da temporada, dentro da mesma liga
      row({ competitionId: "BRA1", seasonId: "2025", clubId: "1", appearances: 10, minutesPlayed: 800, goals: 3, assists: 1, yellowCards: 2, goalsConceded: 9, cleanSheets: 3 }),
      row({ competitionId: "BRA1", seasonId: "2025", clubId: "2", appearances: 5, minutesPlayed: 400, goals: 1, secondYellowCards: 1, redCards: 1, goalsConceded: 4, cleanSheets: 2 }),
      row({ competitionId: "CLI", seasonId: "2025", minutesPlayed: 300 }),
      row({ competitionId: "BRA1", seasonId: "2024", appearances: 30, minutesPlayed: 2500 }),
      row({ competitionId: "CLI", seasonId: "2024", minutesPlayed: 999 }),
    ],
    [
      { date: "2024-06-01", value: 5_000_000 },
      { date: "2025-10-01", value: 8_000_000 },
      { date: "2026-03-01", value: 6_000_000 },
    ],
  );

  it("soma só a liga na temporada; minAll soma todas as competições da temporada", () => {
    expect(aggregate(p, ["BRA1"], "2025", "2026-11-12")).toEqual({
      id: "7",
      apps: 15,
      min: 1200,
      goals: 4,
      assists: 1,
      yc: 2,
      rc: 2,
      conceded: 13,
      cleanSheets: 5,
      minAll: 1500,
      value12m: 8_000_000,
      valuePeak: 8_000_000,
    });
  });

  it("omite quem não jogou a liga na temporada", () => {
    expect(aggregate(p, ["BRA1"], "2026", "2026-11-12")).toBeNull();
    expect(aggregate(player("8", [row({ competitionId: "BRA1", seasonId: "2025", appearances: 0, minutesPlayed: 0 })]), ["BRA1"], "2025", "2026-11-12")).toBeNull();
  });
});

describe("valores", () => {
  const h = [
    { date: "2025-01-10", value: 1 },
    { date: "2025-11-12", value: 2 },
    { date: "2025-11-13", value: 3 },
  ];
  it("value12m = último ponto até a data da coleta − 365 dias", () => {
    expect(value12m(h, "2026-11-12")).toBe(2);
    expect(value12m(h, "2025-06-01")).toBeNull();
    expect(value12m([], "2026-11-12")).toBeNull();
  });
  it("valuePeak = maior valor", () => {
    expect(valuePeak(h)).toBe(3);
    expect(valuePeak([])).toBeNull();
  });
});

describe("arquivo da liga", () => {
  it("maxMin = jogos de quem mais jogou × 90", () => {
    const ps = [12, 30, 7].map((a, i) => player(String(i), [row({ competitionId: "BRA1", seasonId: "2025", appearances: a })]));
    expect(maxMinutes(ps, ["BRA1"], "2025")).toBe(2700);
    expect(maxMinutes([], ["BRA1"], "2025")).toBe(0);
  });
  it("monta o arquivo, sem duplicatas e sem quem não tem dados", () => {
    const a = player("1", [row({ competitionId: "AR1N", seasonId: "2026", appearances: 20 })]);
    const raw = {
      id: "AR1N",
      collectedAt: "2026-11-12",
      players: [a, a, player("2", [row({ competitionId: "AR1N", seasonId: "2025" })]), player("3", [])],
    };
    const f = buildLeague(raw)!;
    expect(f.season).toBe("2026");
    expect(f.maxMin).toBe(1800);
    expect(f.players.map((x) => x.id)).toEqual(["1"]);
    // quem trocou de clube na liga (12 + 15 jogos) não infla os jogos possíveis
    const moved = player("4", [row({ competitionId: "AR1N", seasonId: "2026", appearances: 12 }), row({ competitionId: "AR1N", seasonId: "2026", clubId: "2", appearances: 15 })]);
    expect(buildLeague({ ...raw, players: [a, moved] })!.maxMin).toBe(1800);
    expect(buildLeague({ id: "X", collectedAt: "2026-11-12", players: [] })).toBeNull();
  });
});

describe("ligas com Apertura e Clausura", () => {
  it("junta os torneios da liga (ids diferentes no Transfermarkt)", () => {
    const comps = leagueComps("AR1N", { AR1N: ["ARG1", "ARGC"] });
    expect(comps).toEqual(["AR1N", "ARG1", "ARGC"]);
    expect(leagueComps("GB1", { AR1N: ["ARG1"] })).toEqual(["GB1"]);
    const raw = {
      id: "AR1N",
      collectedAt: "2026-11-12",
      players: [
        player("1", [
          row({ competitionId: "AR1N", seasonId: "2023", appearances: 27 }),
          row({ competitionId: "ARG1", seasonId: "2025", appearances: 16, goals: 4, minutesPlayed: 1400 }),
          row({ competitionId: "ARGC", seasonId: "2025", appearances: 15, goals: 3, minutesPlayed: 1300 }),
          row({ competitionId: "A1P1", seasonId: "2025", appearances: 3, minutesPlayed: 270 }),
        ]),
        // trocou de clube entre Apertura e Clausura
        player("2", [
          row({ competitionId: "ARG1", seasonId: "2025", clubId: "1", appearances: 16 }),
          row({ competitionId: "ARGC", seasonId: "2025", clubId: "2", appearances: 16 }),
        ]),
      ],
    };
    const f = buildLeague(raw, comps)!;
    expect(f.season).toBe("2025");
    expect(f.players[0]).toMatchObject({ apps: 31, goals: 7, min: 2700, minAll: 2970 });
    expect(f.maxMin).toBe(31 * 90);
  });
});
