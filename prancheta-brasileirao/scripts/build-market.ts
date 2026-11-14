// Gera os dados do módulo /mercado a partir de data/market/tm/*.json (saída do coletor Python).
// Uso: npm run build:market
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import type { Pos } from "./lib/core";
import { PATHS, loadTeamMap, p, readJson, runIfMain, writeJson } from "./lib/io";
import { arrivalOf, countryPt, isForeign, loanStatus, matchClubSlug, tmPhoto, tmPosition, type TmCompetitionFile, type TmPlayer } from "./lib/market";
import { compatible } from "./import-research";
import type { ClubMarket, MarketCoach, MarketIndex, MarketLeague, MarketPlayer, SquadPlayer } from "../src/market/types";
import type { TmCoach } from "./lib/market";

const coachOf = (c: TmCoach | undefined, extra: Partial<MarketCoach> = {}): MarketCoach | null =>
  c?.name
    ? { id: c.id, name: c.name, since: c.since, photo: tmPhoto(c.imageUrl), age: c.age, nat: countryPt(c.citizenship?.[0]), ...extra }
    : null;

const IN = process.env.MARKET_IN ?? p("data/market/tm");
const OUT = p("src/data/market");
/** Brasileirão 2027 começa no início do ano: contratos que acabam antes disso estão terminando. */
const NEXT_SEASON_START = process.env.MARKET_NEXT_SEASON ?? "2027-01-01";

interface OurPlayer {
  id: number;
  name: string;
  number: number | null;
  pos: Pos;
  photo: string | null;
}

/** Acha o nosso jogador (API-Football) correspondente, para usar foto, nome e posição já revisados. */
function matchOurs(tm: TmPlayer, ours: OurPlayer[], used: Set<number>): OurPlayer | null {
  const name = tm.name ?? "";
  const free = ours.filter((o) => !used.has(o.id));
  const byNum = free.find((o) => o.number != null && o.number === tm.shirtNumber && (compatible(o.name, name) || compatible(name, o.name)));
  if (byNum) return byNum;
  const hits = free.filter((o) => compatible(o.name, name) || compatible(name, o.name));
  return hits.length === 1 ? hits[0] : null;
}

export function buildMarket(): { leagues: number; players: number; clubs: number } {
  const files = existsSync(IN) ? readdirSync(IN).filter((f) => f.endsWith(".json")) : [];
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // mesma ordem da lista de ligas (Brasil → América do Sul → Europa → resto)
  const order = readJson<{ competitions: { id: string; name: string }[] }>(p("scripts/market/competitions.json")).competitions.map((c) => c.name);
  const rank = (c: TmCompetitionFile) => {
    const i = order.indexOf(c.competition.name);
    return i < 0 ? 999 : i;
  };
  const comps = files.map((f) => readJson<TmCompetitionFile>(`${IN}/${f}`)).sort((a, b) => rank(a) - rank(b));
  const map = loadTeamMap();
  const aliases = Object.fromEntries(Object.entries(map).map(([s, t]) => [s, [t.name, t.shortName, ...t.aliases]]));

  // ---- ligas (mercado) ----
  const index: MarketIndex = { collectedAt: null, nextSeasonStart: NEXT_SEASON_START, leagues: [], clubs: {} };
  let total = 0;
  for (const c of comps) {
    const league: MarketLeague = {
      id: c.competition.id,
      name: c.competition.name,
      group: c.competition.group,
      clubs: c.clubs.map((k) => ({ id: k.id, name: k.name ?? k.id })),
      players: [],
    };
    c.clubs.forEach((club, ci) => {
      for (const pl of club.players) {
        const ts = c.transfers[pl.id];
        const st = ts ? loanStatus(ts, club.id) : null;
        const mp: MarketPlayer = {
          id: pl.id,
          name: pl.name ?? `#${pl.id}`,
          club: ci,
          pos: tmPosition(pl.position),
          posName: pl.position,
          age: pl.age,
          value: pl.marketValue,
          contract: pl.contract,
          nat: countryPt(pl.nationality?.[0]),
          foreign: isForeign(pl.nationality),
          photo: tmPhoto(pl.imageUrl),
        };
        if (st?.status === "loanIn") mp.loanFrom = st.loanClub;
        league.players.push(mp);
      }
    });
    league.players.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    total += league.players.length;
    writeJson(`${OUT}/leagues/${league.id}.json`, league);
    index.leagues.push({ id: league.id, name: league.name, group: league.group, clubs: league.clubs.length, players: league.players.length });
    if (!index.collectedAt || c.collectedAt < index.collectedAt) index.collectedAt = c.collectedAt;
  }

  // ---- clubes da Série A (elenco com situação contratual) ----
  const bra1 = comps.find((c) => c.competition.id === "BRA1");
  const clubs: Record<string, ClubMarket> = {};
  for (const club of bra1?.clubs ?? []) {
    const slug = matchClubSlug(club.name ?? "", aliases);
    if (!slug) {
      console.warn(`⚠ clube do Transfermarkt sem slug: ${club.name}`);
      continue;
    }
    index.clubs[slug] = club.id;
    const ours = existsSync(PATHS.teamOut(slug)) ? readJson<{ players: OurPlayer[] }>(PATHS.teamOut(slug)).players : [];
    const used = new Set<number>();
    const squad: SquadPlayer[] = club.players.map((pl) => {
      const ts = bra1!.transfers[pl.id] ?? [];
      const st = loanStatus(ts, club.id);
      const o = matchOurs(pl, ours, used);
      if (o) used.add(o.id);
      return {
        id: pl.id,
        name: o?.name ?? pl.name ?? `#${pl.id}`,
        pos: o?.pos ?? tmPosition(pl.position),
        posName: pl.position,
        age: pl.age,
        value: pl.marketValue,
        contract: pl.contract,
        nat: countryPt(pl.nationality?.[0]),
        foreign: isForeign(pl.nationality),
        num: pl.shirtNumber ?? o?.number ?? null,
        photo: o?.photo ?? tmPhoto(pl.imageUrl),
        status: st.status === "loanOut" ? "owned" : st.status, // está no elenco, então não está emprestado fora
        loanClub: st.status === "loanIn" ? st.loanClub : null,
        loanUntil: st.status === "loanIn" ? st.loanUntil ?? pl.contract : null,
        arrival: arrivalOf(bra1!.transfers[pl.id], club.id, st.status === "loanIn" ? "loanIn" : "owned"),
        joined: pl.joinedOn,
      };
    });
    clubs[slug] = { slug, tmId: club.id, name: club.name ?? slug, collectedAt: bra1!.collectedAt, coach: coachOf(bra1!.coaches?.[club.id]), squad };
  }

  // ---- emprestados fora: jogadores de outros clubes/ligas cuja última transferência é empréstimo de um clube da Série A ----
  const slugByTmId = Object.fromEntries(Object.entries(index.clubs).map(([s, id]) => [id, s]));
  for (const c of comps) {
    for (const club of c.clubs) {
      for (const pl of club.players) {
        const ts = c.transfers[pl.id];
        if (!ts) continue;
        const st = loanStatus(ts, club.id);
        if (st.status !== "loanIn") continue;
        const last = ts.find((t) => t.transferType === "loan" && t.clubTo.id === club.id && !t.upcoming);
        const owner = last ? slugByTmId[last.clubFrom.id] : undefined;
        if (!owner || clubs[owner].squad.some((x) => x.id === pl.id)) continue;
        clubs[owner].squad.push({
          id: pl.id,
          name: pl.name ?? `#${pl.id}`,
          pos: tmPosition(pl.position),
          posName: pl.position,
          age: pl.age,
          value: pl.marketValue,
          contract: null, // contrato com o clube dono não vem nesse dado
          nat: countryPt(pl.nationality?.[0]),
          foreign: isForeign(pl.nationality),
          num: null,
          photo: tmPhoto(pl.imageUrl),
          status: "loanOut",
          loanClub: club.name,
          loanUntil: st.loanUntil ?? pl.contract,
          arrival: arrivalOf(ts, last!.clubFrom.id, "owned"),
          joined: null,
        });
      }
    }
  }

  for (const cm of Object.values(clubs)) writeJson(`${OUT}/clubs/${cm.slug}.json`, cm);
  // no mercado, jogadores da Série A usam as mesmas fotos da prancheta
  const ourPhoto = new Map(Object.values(clubs).flatMap((cm) => cm.squad.filter((x) => x.photo?.startsWith("/")).map((x) => [x.id, x.photo!] as const)));
  if (ourPhoto.size && existsSync(`${OUT}/leagues/BRA1.json`)) {
    const lg = readJson<MarketLeague>(`${OUT}/leagues/BRA1.json`);
    for (const pl of lg.players) if (ourPhoto.has(pl.id)) pl.photo = ourPhoto.get(pl.id)!;
    writeJson(`${OUT}/leagues/BRA1.json`, lg);
  }
  // técnicos disponíveis para contratar: os de todos os clubes coletados
  const coaches: MarketCoach[] = [];
  for (const c of comps) {
    for (const club of c.clubs) {
      const co = coachOf(c.coaches?.[club.id], { club: club.name ?? "", league: c.competition.name });
      if (co) coaches.push(co);
    }
  }
  // contrato dos empregados e técnicos sem clube (scripts/market/collect_coaches.py)
  const extraPath = p("data/market/coaches-extra.json");
  if (existsSync(extraPath)) {
    const extra = readJson<{
      employed: Record<string, { since: string | null; until: string | null }>;
      free: { id: string; name: string; photo: string | null; age: number | null; nat: string | null; lastClub: string | null; lastGame: string | null }[];
    }>(extraPath);
    for (const co of coaches) co.until = extra.employed[co.id]?.until ?? null;
    const have = new Set(coaches.map((c) => c.id));
    for (const f of extra.free) {
      if (have.has(f.id)) continue;
      coaches.push({ id: f.id, name: f.name, since: null, photo: tmPhoto(f.photo), age: f.age, nat: countryPt(f.nat), free: true, lastClub: f.lastClub, lastGame: f.lastGame });
    }
  }
  writeJson(`${OUT}/coaches.json`, coaches);
  writeJson(`${OUT}/index.json`, index);
  const missing = Object.keys(map).filter((s) => !clubs[s]);
  if (bra1 && missing.length) console.warn(`⚠ clubes da Série A sem dados do Transfermarkt: ${missing.join(", ")}`);
  return { leagues: index.leagues.length, players: total, clubs: Object.keys(clubs).length };
}

runIfMain(import.meta.url, async () => {
  const r = buildMarket();
  if (!r.leagues) console.log("Nenhum dado coletado ainda (data/market/tm vazio). Gerado índice vazio: o /mercado mostra 'aguardando coleta'.");
  else console.log(`Mercado: ${r.leagues} ligas, ${r.players} jogadores, ${r.clubs} clubes da Série A.`);
});
