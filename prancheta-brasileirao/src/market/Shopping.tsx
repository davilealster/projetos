// Etapa 2 do Mercado ("ir às compras"), com o olheiro dentro: Procurar (filtros + atalhos do olheiro, nota e etiquetas
// nas fichas) e Minha lista (prateleiras + Planos A/B/C numa lista só). Carregado só quando a etapa 2 abre:
// as estatísticas e as contas do olheiro não entram no chunk principal.
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { trackEvent } from "../lib/analytics";
import "../scout/scout.css";
import "./shopping.css";
import { POSITIONS, type Pos } from "../types";
import { Foreign, Ico, ICON, Photo, Price, Sheet, Stamp, SIGN_STAMP } from "./bits";
import { MARKET_INDEX, loadCoaches, loadLeague } from "./data";
import { COACH_STATUS, coachMonth, filterCoaches, sortCoaches, type CoachStatus } from "./coaches";
import { fmtDate, fmtEur, fmtRef, isFreeAgent, posRank, type DepthRow, type MarketState, type SigningType } from "./logic";
import type { MarketCoach, MarketLeague, MarketPlayer, SquadPlayer } from "./types";
import { FREE_CUTOFF, SCOUT_GROUPS, groupOf, hasScoutLeague, loadGroup } from "../scout/data";
import type { ScoutPlayer } from "../scout/metrics";
import ScoutPeek from "../scout/ScoutPeek";
import { SEARCHES, needsText, runSearch, type SearchId } from "../scout/searches";
import {
  LIST_PRIORITIES, PLAN_LETTERS, isSaved, maxPriority, listOrder, loadScoutState, mergeWatch, planOf, saveScoutState, savedKeys, scoutReducer, splitKey,
  type ScoutAction, type ScoutState,
} from "../scout/state";
import { Face, ScoreStamp, Tags } from "../scout/ui";

type SetSt = React.Dispatch<React.SetStateAction<MarketState>>;
const CUTOFF = MARKET_INDEX.nextSeasonStart;
/** liga dos clubes da Série A (o elenco do usuário) */
const CLUB_LEAGUE = "BRA1";

const POS_NAME: Record<Pos, string> = {
  GOL: "Goleiros", ZAG: "Zagueiros", LD: "Laterais direitos", LE: "Laterais esquerdos", VOL: "Volantes", MEI: "Meias", PON: "Pontas", ATA: "Atacantes",
};

const LIST_ICON = "M6 3h12v18l-6-4.5L6 21z";
const UP = "M6 15l6-6 6 6";
const DOWN = "M6 9l6 6 6-6";

type Props = {
  slug: string;
  st: MarketState;
  setSt: SetSt;
  balance: number;
  squad: SquadPlayer[];
  depth: DepthRow[];
  isMobile: boolean;
  onLeague: (l: MarketLeague) => void;
  onToast: (t: string) => void;
  /** técnico atual do clube (fica fora da lista de TEC) */
  coach: MarketCoach | null;
  /** abre Procurar já em TEC (vindo do "Demite" da etapa 1) */
  startTec?: boolean;
};

type Sub = "search" | "list";
type Peek = { league: string; player: MarketPlayer; club: string };

/** Contratar: comprar pelo valor, emprestar (sem custo) ou trazer livre. */
function useSignings(setSt: SetSt) {
  const sign = useCallback(
    (p: Pick<MarketPlayer, "id" | "value">, league: string, type: SigningType) => {
      trackEvent("contratar", { tipo: type, liga: league });
      setSt((s) => ({ ...s, signings: [...s.signings.filter((x) => x.id !== p.id), { id: p.id, league, type, price: type === "buy" ? p.value ?? 0 : 0 }] }));
    },
    [setSt],
  );
  const unsign = useCallback((id: string) => setSt((s) => ({ ...s, signings: s.signings.filter((x) => x.id !== id) })), [setSt]);
  const setPrice = useCallback((id: string, v: number) => setSt((x) => ({ ...x, signings: x.signings.map((y) => (y.id === id ? { ...y, price: v } : y)) })), [setSt]);
  return { sign, unsign, setPrice };
}

export default function Shopping({ slug, st, setSt, balance, squad, depth, isMobile, onLeague, onToast, coach, startTec }: Props) {
  // Minha lista = estado do olheiro (`olheiro:{slug}:v1`); o ★ antigo do Mercado (`watch`) entra nela uma vez
  const [sc, dispatch] = useReducer(scoutReducer, null, () => mergeWatch(loadScoutState(slug), st.watch));
  useEffect(() => saveScoutState(slug, sc), [slug, sc]);
  useEffect(() => {
    if (st.watch.length) setSt((s) => ({ ...s, watch: [] }));
  }, [st.watch.length, setSt]);

  const [sub, setSub] = useState<Sub>("search");
  const [peek, setPeek] = useState<Peek | null>(null);

  // ---- relatórios do olheiro por grupo de ligas (preguiçoso, compartilhado pelas duas abas) ----
  const [groups, setGroups] = useState<Record<string, ScoutPlayer[]>>({});
  const ensure = useCallback((g: string | null) => {
    if (!g || !SCOUT_GROUPS.some((x) => x.group === g)) return;
    loadGroup(g).then((list) => setGroups((x) => (x[g] ? x : { ...x, [g]: list })));
  }, []);
  const byKey = useMemo(() => new Map(Object.values(groups).flat().map((x) => [x.key, x])), [groups]);

  const saved = useMemo(() => savedKeys(sc), [sc]);
  useEffect(() => {
    for (const g of new Set(saved.map((k) => groupOf(splitKey(k).league)))) ensure(g);
  }, [saved, ensure]);

  const ownIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);
  const signed = useMemo(() => new Map(st.signings.map((s) => [s.id, s])), [st.signings]);
  const deals = useSignings(setSt);
  const toggleSave = (key: string, name: string) => {
    const on = isSaved(sc, key);
    dispatch(on ? { type: "list/remove", key } : { type: "list/save", key });
    onToast(on ? `${name} saiu da lista` : `${name} na Minha lista`);
  };

  return (
    <section className="ms">
      <div className="ms-sub" role="tablist" aria-label="Mercado">
        <button role="tab" aria-selected={sub === "search"} className={sub === "search" ? "is-on" : ""} onClick={() => setSub("search")}>
          Procurar
        </button>
        <button role="tab" aria-selected={sub === "list"} className={sub === "list" ? "is-on" : ""} onClick={() => (setSub("list"), isMobile && window.scrollTo({ top: 0 }))}>
          Minha lista {saved.length > 0 && <i className="ms-sub__n">{saved.length}</i>}
        </button>
      </div>

      {/* Procurar fica montado (escondido) para não perder filtros ao trocar de aba */}
      <div hidden={sub !== "search"}>
        <Search
          sc={sc} balance={balance} ownIds={ownIds} squad={squad} depth={depth} isMobile={isMobile} onLeague={onLeague}
          byKey={byKey} groups={groups} ensure={ensure} signed={signed} deals={deals} onScout={setPeek} onSave={toggleSave}
          coach={coach} st={st} setSt={setSt} onToast={onToast} startTec={!!startTec}
        />
      </div>
      {sub === "list" && (
        <MyList
          sc={sc} dispatch={dispatch} saved={saved} byKey={byKey} groups={groups} balance={balance} depth={depth} signed={signed} deals={deals}
          ownIds={ownIds} onScout={setPeek} onSearch={() => setSub("search")} onToast={onToast}
        />
      )}

      {peek && (
        <ScoutPeek
          slug={slug} league={peek.league} player={peek.player} club={peek.club} st={sc} dispatch={dispatch}
          own={ownIds.has(peek.player.id)} onClose={() => setPeek(null)}
        />
      )}
    </section>
  );
}

// ============ ações de contratação (iguais em Procurar e na Minha lista) ============

function Deal({ id, value, contract, league, signed, balance, deals }: {
  id: string; value: number | null; contract: string | null; league: string;
  signed: MarketState["signings"][number] | undefined; balance: number; deals: ReturnType<typeof useSignings>;
}) {
  const free = isFreeAgent({ contract } as MarketPlayer, CUTOFF);
  const over = !free && (value ?? 0) > balance;
  if (signed)
    return (
      <>
        {signed.type === "buy" && <Price label="Por" value={signed.price} onChange={(v) => deals.setPrice(id, v)} />}
        <button className="tm-act" onClick={() => deals.unsign(id)}>Desistir</button>
      </>
    );
  return (
    <>
      <button className="tm-act tm-act--green" onClick={() => deals.sign({ id, value }, league, "buy")} title={over ? "Estoura o saldo atual" : undefined}>Comprar{over ? " ⚠" : ""}</button>
      <button className="tm-act tm-act--blue" onClick={() => deals.sign({ id, value }, league, "loan")}>Empréstimo</button>
      {free && <button className="tm-act tm-act--green" onClick={() => deals.sign({ id, value }, league, "free")}>Trazer livre</button>}
    </>
  );
}

// ============ Procurar ============

type MarketSort = "rank" | "score" | "value" | "cheap" | "young" | "contract";
const MARKET_SORTS: [MarketSort, string][] = [
  ["score", "Melhor nota do olheiro"], ["value", "Mais valiosos"], ["cheap", "Mais baratos"], ["young", "Mais jovens"], ["contract", "Contrato acaba antes"],
];
type Row = { p: MarketPlayer; lg: MarketLeague; key: string; x: ScoutPlayer | undefined };

function Search({ sc, balance, ownIds, squad, depth, isMobile, onLeague, byKey, groups, ensure, signed, deals, onScout, onSave, coach, st, setSt, onToast, startTec }: {
  sc: ScoutState; balance: number; ownIds: Set<string>; squad: SquadPlayer[]; depth: DepthRow[]; isMobile: boolean;
  onLeague: (l: MarketLeague) => void; byKey: Map<string, ScoutPlayer>; groups: Record<string, ScoutPlayer[]>; ensure: (g: string | null) => void;
  signed: Map<string, MarketState["signings"][number]>; deals: ReturnType<typeof useSignings>; onScout: (p: Peek) => void; onSave: (key: string, name: string) => void;
  coach: MarketCoach | null; st: MarketState; setSt: SetSt; onToast: (t: string) => void; startTec: boolean;
}) {
  const [sheet, setSheet] = useState(false);
  const leagueGroups = [...new Set(MARKET_INDEX.leagues.map((l) => l.group))];
  const [leagueId, setLeagueId] = useState(MARKET_INDEX.leagues[0]?.id ?? "");
  const [loaded, setLoaded] = useState<MarketLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [clubKey, setClubKey] = useState(""); // "liga:índice"
  // "TEC" troca a lista de jogadores pela de técnicos
  const [pos, setPos] = useState<Pos | "TEC" | null>(startTec ? "TEC" : null);
  const tec = pos === "TEC";
  const [status, setStatus] = useState<CoachStatus>("free");
  const [coaches, setCoaches] = useState<MarketCoach[] | null>(null);
  useEffect(() => {
    if (tec && !coaches) void loadCoaches().then(setCoaches);
  }, [tec, coaches]);
  const [maxAge, setMaxAge] = useState(0);
  const [afford, setAfford] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);
  const [sort, setSort] = useState<MarketSort>("value");
  const [limit, setLimit] = useState(40);
  const [search, setSearch] = useState<SearchId | null>(null);
  const [refKey, setRefKey] = useState("");

  useEffect(() => {
    const ids = leagueId === "ALL" ? MARKET_INDEX.leagues.map((l) => l.id) : [leagueId];
    let alive = true;
    setLoading(true);
    Promise.all(ids.map((id) => loadLeague(id)).filter((p): p is Promise<MarketLeague> => !!p)).then((ls) => {
      if (!alive) return;
      setLoaded(ls);
      setLoading(false);
      ls.forEach(onLeague);
    });
    setLimit(40);
    setClubKey("");
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // relatórios do olheiro das ligas abertas (+ o grupo do próprio clube, para "Reposição")
  const wanted = useMemo(() => {
    const ids = leagueId === "ALL" ? MARKET_INDEX.leagues.map((l) => l.id) : [leagueId];
    const g = new Set(ids.filter(hasScoutLeague).map(groupOf));
    if (search === "replace") g.add(groupOf(CLUB_LEAGUE));
    return [...g].filter((x): x is string => !!x);
  }, [leagueId, search]);
  useEffect(() => wanted.forEach(ensure), [wanted, ensure]);
  const scoutReady = wanted.every((g) => groups[g]);

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filterRows = useCallback(
    (ignorePos: boolean) => {
      const nq = norm(q.trim());
      const out: Row[] = [];
      for (const lg of loaded) {
        if (clubKey && !clubKey.startsWith(`${lg.id}:`)) continue;
        const ci = clubKey ? Number(clubKey.split(":")[1]) : -1;
        for (const p of lg.players) {
          if (ownIds.has(p.id)) continue;
          if (ci >= 0 && p.club !== ci) continue;
          if (!ignorePos && pos && p.pos !== pos) continue;
          if (maxAge && (p.age ?? 99) > maxAge) continue;
          const free = isFreeAgent(p, CUTOFF);
          if (afford && !free && (p.value ?? 0) > Math.max(0, balance)) continue;
          if (onlyFree && !free) continue;
          if (nq && !norm(`${p.name} ${lg.clubs[p.club]?.name ?? ""}`).includes(nq)) continue;
          const key = `${lg.id}:${p.id}`;
          out.push({ p, lg, key, x: byKey.get(key) });
        }
      }
      return out;
    },
    [loaded, q, clubKey, pos, maxAge, afford, onlyFree, ownIds, balance, byKey],
  );
  const rows = useMemo(() => filterRows(false), [filterRows]);
  const rowsAnyPos = useMemo(() => (search === "replace" ? filterRows(true) : rows), [search, filterRows, rows]);

  const needs = useMemo(() => depth.filter((d) => d.short > 0).map((d) => ({ pos: d.pos, short: d.short })), [depth]);
  const ownScouted = useMemo(
    () => squad.map((p) => byKey.get(`${CLUB_LEAGUE}:${p.id}`)).filter((x): x is ScoutPlayer => x?.m.score != null).sort((a, b) => posRank(a.pos) - posRank(b.pos) || a.name.localeCompare(b.name)),
    [squad, byKey],
  );
  const ref = refKey ? byKey.get(refKey) ?? null : null;
  const ctx = useMemo(() => ({ balance, freeCutoff: FREE_CUTOFF, ownIds, ref, needs }), [balance, ownIds, ref, needs]);
  const pool = useMemo(() => rows.flatMap((r) => (r.x ? [r.x] : [])), [rows]);
  const counts = useMemo(() => {
    const out = {} as Record<SearchId, number>;
    if (!scoutReady) return out;
    for (const s of SEARCHES) out[s.id] = s.id === "replace" ? (ref ? runSearch("replace", rowsAnyPos.flatMap((r) => (r.x ? [r.x] : [])), ctx).length : 0) : runSearch(s.id, pool, ctx).length;
    return out;
  }, [pool, rowsAnyPos, ctx, ref, scoutReady]);

  const results = useMemo(() => {
    let list: Row[];
    if (search) {
      const src = search === "replace" ? rowsAnyPos : rows;
      const byK = new Map(src.map((r) => [r.key, r]));
      list = runSearch(search, src.flatMap((r) => (r.x ? [r.x] : [])), ctx).map((x) => byK.get(x.key)!).filter(Boolean);
      if (sort === "rank") return list;
    } else list = [...rows];
    const by: Record<Exclude<MarketSort, "rank">, (a: Row, b: Row) => number> = {
      score: (a, b) => (b.x?.m.score ?? -1) - (a.x?.m.score ?? -1) || (b.p.value ?? 0) - (a.p.value ?? 0),
      value: (a, b) => (b.p.value ?? 0) - (a.p.value ?? 0),
      cheap: (a, b) => (a.p.value ?? 0) - (b.p.value ?? 0),
      young: (a, b) => (a.p.age ?? 99) - (b.p.age ?? 99) || (b.p.value ?? 0) - (a.p.value ?? 0),
      contract: (a, b) => (a.p.contract ?? "9999").localeCompare(b.p.contract ?? "9999"),
    };
    return list.sort(by[sort === "rank" ? "score" : sort]);
  }, [search, rows, rowsAnyPos, ctx, sort]);

  const pick = (id: SearchId | null) => {
    setSearch(id);
    setLimit(40);
    if (id) setSort("rank");
    else if (sort === "rank") setSort("value");
  };
  const def = SEARCHES.find((s) => s.id === search);
  const short = depth.filter((d) => d.short);
  const clearFilters = () => (setClubKey(""), setPos((p) => (p === "TEC" ? p : null)), setMaxAge(0), setAfford(false), setOnlyFree(false));
  const sorts: [MarketSort, string][] = search ? [["rank", "Ordem do atalho"], ...MARKET_SORTS] : MARKET_SORTS;

  const leagueSel = (
    <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} aria-label="Liga">
      <option value="ALL">Todas as ligas</option>
      {leagueGroups.map((g) => (
        <optgroup key={g} label={g}>
          {MARKET_INDEX.leagues.filter((l) => l.group === g).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
  const clubSel = (
    <select value={clubKey} onChange={(e) => (setClubKey(e.target.value), setLimit(40))} aria-label="Clube" disabled={!loaded.length}>
      <option value="">Todos os clubes</option>
      {loaded.map((lg) => {
        const opts = lg.clubs
          .map((c, i) => ({ c, i }))
          .sort((a, b) => a.c.name.localeCompare(b.c.name, "pt-BR"))
          .map(({ c, i }) => <option key={c.id} value={`${lg.id}:${i}`}>{c.name}</option>);
        return loaded.length === 1 ? opts : <optgroup key={lg.id} label={lg.name}>{opts}</optgroup>;
      })}
    </select>
  );
  const searchInput = tec
    ? <input type="search" placeholder="Buscar técnico ou clube" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar técnico ou clube" />
    : <input type="search" placeholder="Buscar jogador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar jogador ou clube" />;
  const ageSel = (
    <select value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} aria-label="Idade máxima">
      <option value={0}>Qualquer idade</option>
      {[21, 23, 25, 28, 31].map((a) => <option key={a} value={a}>até {a} anos</option>)}
    </select>
  );
  const toggles = (
    <>
      <button className={`tm-toggle ${afford ? "is-on" : ""}`} aria-pressed={afford} onClick={() => setAfford(!afford)}>Cabe no saldo ({fmtEur(Math.max(0, balance))})</button>
      <button className={`tm-toggle ${onlyFree ? "is-on" : ""}`} aria-pressed={onlyFree} onClick={() => setOnlyFree(!onlyFree)}>Fim de contrato (chega livre)</button>
    </>
  );
  const pickPos = (p: Pos | "TEC") => (setPos(pos === p ? null : p), setLimit(40));
  // barra de posições: técnico à esquerda, separado; no celular fica na barra fixa (um toque filtra)
  const posFilter = (
    <span className="tm-posfilter ms-posbar" role="group" aria-label="Posição">
      <button className={`tm-pos ms-tec ${tec ? "is-on" : pos ? "is-dim" : ""}`} aria-pressed={tec} onClick={() => pickPos("TEC")} title="Técnicos">TEC</button>
      <i className="ms-posbar__sep" aria-hidden="true" />
      {POSITIONS.map((p) => (
        <button key={p} className={`tm-pos tm-pos--${p} ${pos === p ? "is-on" : pos ? "is-dim" : ""}`} aria-pressed={pos === p} onClick={() => pickPos(p)}>{p}</button>
      ))}
    </span>
  );
  const statusSeg = (
    <span className="ms-cstatus" role="radiogroup" aria-label="Situação do técnico">
      {COACH_STATUS.map(([k, label]) => (
        <button key={k} role="radio" aria-checked={status === k} className={`tm-toggle ${status === k ? "is-on" : ""}`} onClick={() => (setStatus(k), setLimit(40))}>{label}</button>
      ))}
    </span>
  );
  const active = [clubKey, maxAge, afford, onlyFree].filter(Boolean).length;
  const leagueLabel = leagueId === "ALL" ? "todas as ligas" : MARKET_INDEX.leagues.find((l) => l.id === leagueId)?.name ?? "";

  return (
    <>
      {/* atalhos do olheiro: buscas prontas sobre a liga escolhida (e os filtros) */}
      {!tec && <div className="ms-shortcuts" role="group" aria-label="Atalhos do olheiro">
        {SEARCHES.map((s) => (
          <button key={s.id} className={`ms-short ${search === s.id ? "is-on" : ""}`} aria-pressed={search === s.id} onClick={() => pick(search === s.id ? null : s.id)} title={s.id === "needs" ? needsText(needs) : s.rule}>
            <b>{s.title}</b>
            <em>{!scoutReady ? "…" : s.id === "replace" && !ref ? "escolha" : counts[s.id] ?? 0}</em>
          </button>
        ))}
      </div>}
      {!tec && def && (
        <div className="ms-active">
          <p>
            <b>{def.title}</b> <span>{def.id === "needs" ? needsText(needs) : def.rule}</span>
          </p>
          {def.id === "replace" && (
            <select value={refKey} onChange={(e) => setRefKey(e.target.value)} aria-label="Parecidos com qual jogador do seu elenco">
              <option value="">Parecidos com… (escolha um jogador seu)</option>
              {ownScouted.map((x) => <option key={x.key} value={x.key}>{x.pos} · {x.name} (nota {x.m.score})</option>)}
            </select>
          )}
          <button className="ms-active__x" onClick={() => pick(null)} aria-label="Limpar o atalho">Limpar ×</button>
        </div>
      )}

      {!tec && !search && short.length > 0 && (
        <div className="tm-needs">
          <span>Seu elenco precisa de</span>
          {short.map((d) => (
            <button key={d.pos} className={`tm-need ${pos === d.pos ? "is-on" : ""}`} onClick={() => setPos(pos === d.pos ? null : d.pos)}>
              <span className={`tm-pos tm-pos--${d.pos}`}>{d.pos}</span> +{d.short}
            </button>
          ))}
        </div>
      )}
      {isMobile ? (
        <>
          <div className={`tm-mfilters ${tec ? "tm-mfilters--tec" : ""}`}>
            {searchInput}
            {leagueSel}
            {!tec && (
              <button className={`tm-iconbtn ${active ? "is-on" : ""}`} onClick={() => setSheet(true)} aria-label={`Filtros${active ? `, ${active} ativos` : ""}`}>
                <Ico d={ICON.filter} size={20} />
                {active > 0 && <i>{active}</i>}
              </button>
            )}
            {posFilter}
          </div>
          {tec && <div className="tm-toggles ms-ctoggles">{statusSeg}</div>}
        </>
      ) : tec ? (
        <>
          <div className="tm-filters ms-cfilters">
            {leagueSel}
            {searchInput}
          </div>
          <div className="tm-toggles">
            {statusSeg}
            {posFilter}
          </div>
        </>
      ) : (
        <>
          <div className="tm-filters">
            {leagueSel}
            {clubSel}
            {searchInput}
            {ageSel}
            <select value={sort} onChange={(e) => setSort(e.target.value as MarketSort)} aria-label="Ordenar">
              {sorts.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="tm-toggles">
            {toggles}
            {posFilter}
          </div>
        </>
      )}
      {tec && (
        <Coaches
          list={coaches} current={coach} st={st} setSt={setSt} onToast={onToast} status={status} limit={limit} onMore={() => setLimit((l) => l + 40)}
          league={leagueId === "ALL" ? null : MARKET_INDEX.leagues.find((l) => l.id === leagueId)?.name ?? null} leagueLabel={leagueLabel} q={q}
          onClear={() => (setQ(""), setStatus("all"), setLeagueId("ALL"))}
        />
      )}
      {!tec && isMobile && sheet && (
        <Sheet
          title="Filtros"
          onClose={() => setSheet(false)}
          foot={
            <>
              <button className="tm-btn" onClick={clearFilters} disabled={!active}>Limpar</button>
              <button className="tm-btn tm-btn--brass" onClick={() => setSheet(false)}>
                {loading ? "Carregando…" : `Ver ${results.length.toLocaleString("pt-BR")} jogador${results.length === 1 ? "" : "es"}`}
              </button>
            </>
          }
        >
          <div className="tm-fsheet">
            <label>Clube{clubSel}</label>
            <label>Idade{ageSel}</label>
            <div>Mostrar só<span className="tm-fsheet__toggles">{toggles}</span></div>
            <div>
              Ordenar
              <span className="tm-radios" role="radiogroup" aria-label="Ordenar">
                {sorts.map(([k, label]) => (
                  <label key={k} className="tm-radio">
                    <input type="radio" name="market-sort" checked={sort === k} onChange={() => setSort(k)} />
                    {label}
                  </label>
                ))}
              </span>
            </div>
          </div>
        </Sheet>
      )}
      {!tec && <>
      <p className="tm-count">
        {loading ? "Carregando a liga…"
          : search && !scoutReady ? "Abrindo os relatórios do olheiro…"
          : `${results.length.toLocaleString("pt-BR")} jogadores${def ? ` em “${def.title}”` : ""} · ${leagueLabel}`}
      </p>
      <div className="tm-fichas tm-fichas--market">
        {(search && !scoutReady ? [] : results.slice(0, limit)).map(({ p, lg, key, x }) => {
          const s = signed.get(p.id);
          const free = isFreeAgent(p, CUTOFF);
          const on = isSaved(sc, key);
          const plan = planOf(sc, key);
          return (
            <article key={key} className={`tm-ficha ms-ficha ${s ? "is-signed" : ""} ${x?.stats ? "has-score" : ""}`}>
              <Photo name={p.name} photo={p.photo} />
              <div className="tm-ficha__main">
                <p className="tm-ficha__name">{p.name}<span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span><Foreign on={p.foreign} /></p>
                <p className="tm-ficha__meta">{p.age != null ? `${p.age} anos` : "Idade não informada"}{p.nat ? ` · ${p.nat}` : ""} · {lg.clubs[p.club]?.name}</p>
                <p className="tm-ficha__origin">
                  {lg.name} · <span className={free ? "is-free" : ""}>contrato até {fmtDate(p.contract)}{free ? " (chega livre)" : ""}</span>
                  {p.loanFrom ? ` · emprestado pelo ${p.loanFrom}` : ""}
                </p>
                {x?.stats && <Tags x={x} max={2} />}
              </div>
              {x?.stats && <span className="ms-ficha__score"><ScoreStamp x={x} /></span>}
              <p className="tm-ficha__value">{fmtEur(p.value)}<small>{fmtRef(p.value)}</small></p>
              <div className="tm-ficha__actions">
                <Deal id={p.id} value={p.value} contract={p.contract} league={lg.id} signed={s} balance={balance} deals={deals} />
                <i className="ms-break" aria-hidden="true" />
                <button className={`tm-act ms-save ${on ? "is-saved" : ""}`} aria-pressed={on} onClick={() => onSave(key, p.name)}>
                  <Ico d={on ? ICON_CHECK : LIST_ICON} size={15} />
                  {on ? (plan ? `Plano ${PLAN_LETTERS[plan.index]}` : "Na lista") : "Guardar na lista"}
                </button>
                <button className="tm-act tm-act--scout" onClick={() => onScout({ league: lg.id, player: p, club: lg.clubs[p.club]?.name ?? "" })} aria-label={`Ver scout de ${p.name}`}>Ver scout</button>
              </div>
              {s && <Stamp key={s.type} text={SIGN_STAMP[s.type]} ink={s.type === "loan" ? "blue" : "green"} onClick={() => deals.unsign(p.id)} title="Desistir da contratação" />}
            </article>
          );
        })}
        {!loading && scoutReady && !results.length && (
          <p className="tm-empty">
            {search === "replace" && !ref ? "Escolha acima um jogador do seu elenco para achar parecidos." : search ? "Ninguém nesse atalho com esses filtros." : "Nenhum jogador com esses filtros."}{" "}
            <button className="tm-link" onClick={() => (setQ(""), clearFilters(), search && search !== "replace" && setLeagueId("ALL"))}>
              {search && search !== "replace" && leagueId !== "ALL" ? "Procurar em todas as ligas" : "Limpar filtros"}
            </button>
          </p>
        )}
      </div>
      {results.length > limit && <button className="tm-btn tm-more" onClick={() => setLimit((l) => l + 40)}>Mostrar mais 40</button>}
      {search && <p className="ms-fine">Nota de 0 a 100 do olheiro: compara cada jogador com a mesma posição no grupo de ligas (Transfermarkt: minutos, gols, assistências, gols sofridos em campo). “Ver scout” abre o relatório.</p>}
      </>}
    </>
  );
}

// ============ técnicos (TEC) ============

function Coaches({ list, current, st, setSt, onToast, status, league, leagueLabel, q, limit, onMore, onClear }: {
  list: MarketCoach[] | null; current: MarketCoach | null; st: MarketState; setSt: SetSt; onToast: (t: string) => void;
  status: CoachStatus; league: string | null; leagueLabel: string; q: string; limit: number; onMore: () => void; onClear: () => void;
}) {
  const rows = useMemo(() => (list ? sortCoaches(filterCoaches(list, { status, league, q, exclude: current?.id })) : []), [list, status, league, q, current]);
  const hiredId = st.coach.action === "fire" ? st.coach.hire : null;
  const hire = (c: MarketCoach) => {
    trackEvent("contratar_tecnico", { livre: c.free ? "sim" : "nao" });
    const prev = hiredId ? list?.find((x) => x.id === hiredId) : null;
    setSt((s) => ({ ...s, coach: { action: "fire", hire: c.id } }));
    onToast(prev ? `${c.name} contratado no lugar de ${prev.name}` : st.coach.action === "keep" && current ? `${current.name} demitido · ${c.name} contratado` : `${c.name} contratado`);
  };
  const undo = (c: MarketCoach) => (setSt((s) => ({ ...s, coach: { action: "keep", hire: null } })), onToast(`${c.name} saiu${current ? ` · ${current.name} mantido` : ""}`));
  const what = status === "free" ? "sem clube" : status === "employed" ? "com clube" : "";
  return (
    <>
      <p className="tm-count">
        {!list ? "Carregando os técnicos…"
          : `${rows.length.toLocaleString("pt-BR")} técnico${rows.length === 1 ? "" : "s"}${what ? ` ${what}` : ""}${status !== "free" && league ? ` · ${leagueLabel}` : ""}${status === "all" ? " · sem clube primeiro" : ""}`}
        {current && <span className="ms-ccur"> · Seu técnico: <b>{current.name}</b> ({st.coach.action === "fire" ? "demitido" : "mantido"})</span>}
      </p>
      <div className="tm-fichas tm-fichas--market">
        {rows.slice(0, limit).map((c) => {
          const on = c.id === hiredId;
          const last = coachMonth(c.lastGame);
          return (
            <article key={c.id} className={`tm-ficha ms-ficha ms-coach ${on ? "is-signed" : ""}`}>
              <Photo name={c.name} photo={c.photo} />
              <div className="tm-ficha__main">
                <p className="tm-ficha__name">{c.name}<span className="tm-pos ms-tec">TEC</span></p>
                <p className="tm-ficha__meta">{c.age != null ? `${c.age} anos` : "Idade não informada"}{c.nat ? ` · ${c.nat}` : ""}</p>
                {c.free ? (
                  <p className="tm-ficha__origin"><span className="is-free">Sem clube</span>{c.lastClub ? ` · último trabalho: ${c.lastClub}${last ? ` (${last})` : ""}` : ""}</p>
                ) : (
                  <>
                    <p className="tm-ficha__origin">{c.club}{c.league ? ` · ${c.league}` : ""}</p>
                    <p className="tm-ficha__origin">
                      {c.until ? `contrato até ${coachMonth(c.until)}` : c.since ? `no cargo desde ${coachMonth(c.since)}` : "sob contrato"} · <i className="ms-coach__fee">rescisão a negociar</i>
                    </p>
                  </>
                )}
              </div>
              <p className="tm-ficha__value"><span className={`ms-cbadge ${c.free ? "is-free" : ""}`}>{c.free ? "Sem clube" : "Com clube"}</span></p>
              <div className="tm-ficha__actions">
                {on ? (
                  <button className="tm-act" onClick={() => undo(c)}>Desfazer</button>
                ) : (
                  <button className="tm-act tm-act--green" onClick={() => hire(c)}>Contratar técnico</button>
                )}
              </div>
              {on && <Stamp text="Contratado ✓" ink="green" onClick={() => undo(c)} title="Desfazer a contratação" />}
            </article>
          );
        })}
        {list && !rows.length && (
          <p className="tm-empty">
            Nenhum técnico com esses filtros. <button className="tm-link" onClick={onClear}>Ver todos</button>
          </p>
        )}
      </div>
      {rows.length > limit && <button className="tm-btn tm-more" onClick={onMore}>Mostrar mais 40</button>}
      <p className="ms-fine">Técnico não mexe no saldo: o sem clube chega livre; o com clube tem rescisão a negociar à parte. Contratar um novo demite o atual.</p>
    </>
  );
}

const ICON_CHECK = "M5 12.5 10 17 19 7";

// ============ Minha lista ============

function MyList({ sc, dispatch, saved, byKey, groups, balance, depth, signed, deals, ownIds, onScout, onSearch, onToast }: {
  sc: ScoutState; dispatch: (a: ScoutAction) => void; saved: string[]; byKey: Map<string, ScoutPlayer>; groups: Record<string, ScoutPlayer[]>;
  balance: number; depth: DepthRow[]; signed: Map<string, MarketState["signings"][number]>; deals: ReturnType<typeof useSignings>;
  ownIds: Set<string>; onScout: (p: Peek) => void; onSearch: () => void; onToast: (t: string) => void;
}) {
  const pending = saved.filter((k) => !byKey.has(k) && !groups[groupOf(splitKey(k).league) ?? ""]);
  const missing = saved.filter((k) => !byKey.has(k) && groups[groupOf(splitKey(k).league) ?? ""]);
  const players = saved.map((k) => byKey.get(k)).filter((x): x is ScoutPlayer => !!x && !ownIds.has(x.id));
  const byPos = POSITIONS.map((pos) => {
    const here = players.filter((x) => x.pos === pos);
    const order = listOrder(sc, pos, here.map((x) => x.key)).filter((k) => here.some((x) => x.key === k));
    return { pos, order, map: new Map(here.map((x) => [x.key, x])) };
  }).filter((g) => g.order.length);

  // Plano A de cada posição: quanto custa o que ainda não foi contratado
  const planA = byPos.map((g) => (sc.plans[g.pos]?.[0] === g.order[0] ? g.map.get(g.order[0])! : null)).filter((x): x is ScoutPlayer => !!x);
  const costOf = (x: ScoutPlayer) => (isFreeAgent({ contract: x.contract } as MarketPlayer, CUTOFF) ? 0 : x.value ?? 0);
  const planAOpen = planA.filter((x) => !signed.has(x.id));
  const planCost = planAOpen.reduce((t, x) => t + costOf(x), 0);
  const left = balance - planCost;
  const short = new Map(depth.filter((d) => d.short).map((d) => [d.pos, d.short]));

  if (!saved.length)
    return (
      <div className="ms-empty">
        <span className="tm-stamp tm-stamp--amber">Lista vazia</span>
        <h2>Monte a sua lista de alvos</h2>
        <p>Em <b>Procurar</b>, toque em “Guardar na lista” nos jogadores que te interessam. Os atalhos do olheiro (Joias, Fim de contrato, Custo-benefício…) ajudam a achar.</p>
        <button className="tm-btn tm-btn--brass" onClick={onSearch}>Procurar jogadores →</button>
      </div>
    );

  return (
    <>
      <div className={`ms-plan ${left < 0 ? "is-neg" : ""}`}>
        <div>
          <p className="tm-eyebrow">Plano A · {planA.length} posiç{planA.length === 1 ? "ão" : "ões"}</p>
          <p className="ms-plan__total">{fmtEur(planCost)}<small>{planAOpen.length < planA.length ? ` · ${planA.length - planAOpen.length} já contratado${planA.length - planAOpen.length > 1 ? "s" : ""}` : ""}</small></p>
        </div>
        <div className="ms-plan__vs">
          <span>Saldo {fmtEur(balance)}</span>
          <b>{!planA.length ? "Escolha um Plano A" : left >= 0 ? `Cabe · sobram ${fmtEur(left)}` : `Estoura em ${fmtEur(-left)}`}</b>
        </div>
        <p className="ms-plan__hint">Plano A é a primeira opção de cada posição; B e C são as alternativas se o A não vier. Escolher outro A faz o anterior descer para B; as setas mudam a ordem.</p>
      </div>

      {byPos.map(({ pos, order, map }) => (
        <section key={pos} className="ms-pos" aria-label={POS_NAME[pos]}>
          <h3>
            <span className={`tm-pos tm-pos--${pos}`}>{pos}</span> {POS_NAME[pos]} <small>{order.length}</small>
            {short.get(pos) ? <em className="ms-pos__need">faltam {short.get(pos)}</em> : null}
          </h3>
          <ol className="ms-rows">
            {order.map((k, i) => {
              const x = map.get(k)!;
              const plan = planOf(sc, k);
              const s = signed.get(x.id);
              const free = isFreeAgent({ contract: x.contract } as MarketPlayer, CUTOFF);
              const peek = () => onScout({ league: x.league, player: toMarket(x), club: x.club });
              return (
                <li key={k} className={`ms-row ${plan?.index === 0 ? "is-a" : ""} ${s ? "is-signed" : ""}`}>
                  <span className={`ms-row__letter ${plan ? "" : "is-watch"}`} aria-hidden="true">{plan ? PLAN_LETTERS[plan.index] : "·"}</span>
                  <button className="ms-row__who" onClick={peek} aria-label={`Ver scout de ${x.name}`}>
                    <Face name={x.name} photo={x.photo} size={42} />
                    <span>
                      <b>{x.name}</b>
                      <small>{x.age != null ? `${x.age} anos · ` : ""}{x.club} · {x.leagueName.replace(/ \(.*\)$/, "")}</small>
                      <small className="ms-row__money">{fmtEur(x.value)}{free ? <i className="is-free"> · chega livre</i> : x.contract ? ` · até ${x.contract.slice(0, 4)}` : ""}</small>
                    </span>
                  </button>
                  {x.stats ? <ScoreStamp x={x} /> : <span />}
                  <div className="ms-row__prio" role="radiogroup" aria-label={`Prioridade de ${x.name}`}>
                    {[...Array(LIST_PRIORITIES).keys(), null].map((p) => {
                      const on = p == null ? !plan : plan?.index === p;
                      const off = p != null && p > maxPriority(sc, pos, k);
                      return (
                        <button
                          key={String(p)} role="radio" aria-checked={on} className={on ? "is-on" : ""} disabled={off}
                          title={off ? `Plano ${PLAN_LETTERS[p]} é a alternativa ao Plano ${PLAN_LETTERS[p - 1]}: escolha o ${PLAN_LETTERS[p - 1]} primeiro` : undefined}
                          onClick={() => dispatch({ type: "list/priority", pos, key: k, prio: p })}
                        >
                          {p == null ? "Observando" : PLAN_LETTERS[p]}
                        </button>
                      );
                    })}
                    <span className="ms-row__move">
                      <button aria-label={`Subir ${x.name}`} disabled={i === 0} onClick={() => dispatch({ type: "list/move", pos, order, key: k, dir: -1 })}><Ico d={UP} size={18} /></button>
                      <button aria-label={`Descer ${x.name}`} disabled={i === order.length - 1} onClick={() => dispatch({ type: "list/move", pos, order, key: k, dir: 1 })}><Ico d={DOWN} size={18} /></button>
                    </span>
                  </div>
                  <div className="ms-row__acts tm-ficha__actions">
                    {s && <Stamp key={s.type} text={SIGN_STAMP[s.type]} ink={s.type === "loan" ? "blue" : "green"} />}
                    <Deal id={x.id} value={x.value} contract={x.contract} league={x.league} signed={s} balance={balance} deals={deals} />
                    <button className="tm-act ms-remove" onClick={() => (dispatch({ type: "list/remove", key: k }), onToast(`${x.name} saiu da lista`))}>Tirar da lista</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {pending.length > 0 && <p className="tm-count">Abrindo {pending.length} relatório{pending.length > 1 ? "s" : ""}…</p>}
      {missing.length > 0 && (
        <p className="ms-fine">
          {missing.length} jogador{missing.length > 1 ? "es" : ""} da lista não aparece{missing.length > 1 ? "m" : ""} mais nos dados atuais.{" "}
          <button className="tm-link" onClick={() => missing.forEach((key) => dispatch({ type: "list/remove", key }))}>Tirar da lista</button>
        </p>
      )}
    </>
  );
}

/** ScoutPlayer → o formato que o "Ver scout" usa quando a liga não tem estatística. */
const toMarket = (x: ScoutPlayer): MarketPlayer => ({
  id: x.id, name: x.name, pos: x.pos, age: x.age, value: x.value, contract: x.contract, nat: x.nat, foreign: x.foreign, photo: x.photo, club: 0, posName: null, loanFrom: x.loanFrom ?? null,
} as MarketPlayer);
