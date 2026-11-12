// Olheiro (scout): radar de mercado do clube, com prateleiras, planos A/B/C e comparador.
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import "../brand/brand.css";
import "../market/market.css";
import "./scout.css";
import { ModuleHeader } from "../brand/ModuleHeader";
import { teamSummary } from "../data";
import { clubVars } from "../lib/color";
import { applyTeamSummary, useOverrides } from "../lib/overrides";
import { hasMarketData, loadClubMarket, loadLeague, loadMarketState, saveMarketState } from "../market/data";
import { depthChart, fmtEur, fmtRef, nextSeason, setMoneyMode, summarize } from "../market/logic";
import type { ClubMarket, MarketLeague } from "../market/types";
import { navigate } from "../router";
import type { Pos } from "../types";
import { Desk, CompareTab, PlansTab, ShelvesTab } from "./Boards";
import { ScoutContext, type ScoutCtx } from "./context";
import { CONTRACT_CUT, FREE_CUTOFF, SCOUT_GROUPS, SCOUT_INDEX, groupOf, hasScoutData, loadGroup } from "./data";
import type { ScoutPlayer } from "./metrics";
import { PlayerSheet } from "./PlayerSheet";
import { Radar, initialRadar, type RadarState } from "./Radar";
import { isFree } from "./searches";
import { loadScoutState, saveScoutState, scoutReducer, shelfCounts, signingFor, splitKey, withSignings } from "./state";
import { Drawer, Ico, ICON, useIsMobile } from "./ui";

type Tab = "radar" | "shelves" | "plans" | "compare";
const CLUB_LEAGUE = "BRA1";

export default function ScoutApp({ slug }: { slug: string }) {
  useEffect(() => {
    document.title = "Olheiro · Meu Elenco FC";
    document.documentElement.classList.add("is-market");
    return () => document.documentElement.classList.remove("is-market");
  }, []);
  if (!teamSummary(slug)) {
    return (
      <div className="tm tm-center">
        <p>Esse clube não está na Série A.</p>
        <a className="tm-btn" href="/?modulo=olheiro&trocar=1" onClick={(e) => (e.preventDefault(), navigate("/?modulo=olheiro&trocar=1"))}>Escolher um clube</a>
      </div>
    );
  }
  return <ScoutClub key={slug} slug={slug} />;
}

function NoData() {
  return (
    <div className="tm-note sc-nodata">
      <span className="tm-stamp tm-stamp--amber">Em observação</span>
      <h2>O radar ainda está desligado</h2>
      <p>As estatísticas da temporada (minutos, gols, assistências, gols sofridos em campo) entram depois da primeira coleta do Transfermarkt:</p>
      <ol>
        <li><code>npm run collect:scout</code></li>
        <li><code>npm run build:scout</code> e publique</li>
      </ol>
    </div>
  );
}

function ScoutClub({ slug }: { slug: string }) {
  const doc = useOverrides();
  const team = applyTeamSummary(teamSummary(slug)!, doc);
  const isMobile = useIsMobile();
  const [st, dispatch] = useReducer(scoutReducer, slug, loadScoutState);
  useEffect(() => saveScoutState(slug, st), [slug, st]);

  // ---- Mercado: saldo, elenco e carências ----
  const [market] = useState(() => loadMarketState(slug));
  setMoneyMode(market.currency, market.rate);
  const [club, setClub] = useState<ClubMarket | null | undefined>(undefined);
  const [mLeagues, setMLeagues] = useState<Record<string, MarketLeague>>({});
  useEffect(() => void loadClubMarket(slug).then(setClub), [slug]);
  useEffect(() => {
    for (const id of new Set(market.signings.map((s) => s.league))) loadLeague(id)?.then((l) => setMLeagues((x) => ({ ...x, [id]: l })));
  }, [market.signings]);
  const squad = useMemo(() => club?.squad ?? [], [club]);
  const arrivals = market.signings.map((s) => mLeagues[s.league]?.players.find((p) => p.id === s.id)).filter((p): p is NonNullable<typeof p> => !!p);
  const sum = summarize(squad, market, FREE_CUTOFF, arrivals.map((a) => ({ value: a.value, age: a.age })));
  const depth = useMemo(() => (club ? depthChart(nextSeason(squad, market, FREE_CUTOFF, arrivals)) : []), [club, squad, market, arrivals.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ownIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);
  const signedIds = useMemo(() => new Set(market.signings.map((s) => s.id)), [market.signings]);

  // ---- dados por grupo (carregamento preguiçoso) ----
  const homeGroup = groupOf(CLUB_LEAGUE);
  const firstGroup = SCOUT_GROUPS.find((g) => g.group === homeGroup)?.group ?? SCOUT_GROUPS[0]?.group ?? "";
  const [groups, setGroups] = useState<Record<string, ScoutPlayer[]>>({});
  const [radar, setRadar] = useState<RadarState>(() => initialRadar(firstGroup));
  const ensure = useCallback((g: string | null) => {
    if (!g || !SCOUT_GROUPS.some((x) => x.group === g)) return;
    loadGroup(g).then((list) => setGroups((x) => (x[g] ? x : { ...x, [g]: list })));
  }, []);
  const wanted = radar.scope === "ALL" ? SCOUT_GROUPS.map((g) => g.group) : [radar.scope];
  useEffect(() => {
    wanted.forEach(ensure);
  }, [wanted.join("|"), ensure]); // eslint-disable-line react-hooks/exhaustive-deps
  // quem está nas prateleiras, planos e comparador também precisa do grupo dele
  const savedKeys = useMemo(() => [...Object.keys(st.shelves), ...Object.values(st.plans).flat(), ...st.compare].filter((k): k is string => !!k), [st]);
  useEffect(() => {
    for (const g of new Set(savedKeys.map((k) => groupOf(splitKey(k).league)))) ensure(g);
  }, [savedKeys, ensure]);

  const byKey = useMemo(() => new Map(Object.values(groups).flat().map((x) => [x.key, x])), [groups]);
  const pool = useMemo(() => wanted.flatMap((g) => groups[g] ?? []), [groups, wanted.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = wanted.some((g) => !groups[g]);

  // ---- abas e perfil ----
  const [tab, setTab] = useState<Tab>("radar");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rail, setRail] = useState(false);
  const go = (t: Tab) => {
    setTab(t);
    setRail(false);
    window.scrollTo({ top: 0 });
  };

  const addToMarket = useCallback(
    (keys: string[]) => {
      const add = keys.map((k) => byKey.get(k)).filter((x): x is ScoutPlayer => !!x && !ownIds.has(x.id)).map((x) => signingFor(x, x.league, FREE_CUTOFF));
      const { state } = withSignings(loadMarketState(slug), add);
      saveMarketState(slug, state);
      navigate(`/mercado/${slug}?aba=mercado`);
    },
    [byKey, ownIds, slug],
  );

  const ctx: ScoutCtx = {
    slug, clubName: team.shortName, st, dispatch, byKey, balance: sum.balance, depth, squad, ownIds, signedIds, isMobile,
    open: setOpenKey, addToMarket,
  };
  const opened = openKey ? byKey.get(openKey) ?? null : null;
  const counts = shelfCounts(st);
  const shelved = counts.monitor + counts.close + counts.priority;
  const planned = Object.values(st.plans).reduce((t, l) => t + (l?.length ?? 0), 0);
  const ready = hasScoutData && hasMarketData;

  const tabs: [Tab, string, string][] = [
    ["radar", "Radar", loading ? "abrindo…" : `${pool.filter((x) => x.m.score != null).length.toLocaleString("pt-BR")} avaliados`],
    ["shelves", "Prateleiras", shelved ? `${counts.priority} prioridade · ${shelved} no total` : "vazias"],
    ["plans", "Planos", planned ? `${planned} alvo${planned > 1 ? "s" : ""}` : depth.some((d) => d.short) ? "carências à espera" : "A · B · C"],
    ["compare", "Comparar", `${st.compare.length} de 3`],
  ];
  const badge: Record<Tab, number> = { radar: 0, shelves: counts.priority, plans: planned, compare: st.compare.length };

  const seasonNote = SCOUT_INDEX.collectedAt ? `Transfermarkt · coleta de ${SCOUT_INDEX.collectedAt.split("-").reverse().join("/")}` : "";

  return (
    <ScoutContext.Provider value={ctx}>
      <div className={`tm tm-club sc ${isMobile ? "is-app" : ""}`} style={clubVars(team.colors) as React.CSSProperties}>
        <ModuleHeader
          module="olheiro"
          slug={slug}
          clubName={team.shortName}
          crest={team.crest}
          variant={isMobile ? "app" : "bar"}
          actions={
            isMobile && club ? (
              <button className={`tm-chip ${sum.balance < 0 ? "is-neg" : ""}`} onClick={() => setRail(true)} aria-label={`Saldo do mercado ${fmtEur(sum.balance)}. Abrir a mesa do olheiro`}>
                {fmtEur(sum.balance)}
                {fmtRef(sum.balance) && <small className="tm-chip__ref">{fmtRef(sum.balance)}</small>}
              </button>
            ) : undefined
          }
          menuItems={[{ label: "Abrir o mercado do clube", onSelect: () => navigate(`/mercado/${slug}`) }]}
        />

        {isMobile ? (
          <nav className="tm-tabbar" role="tablist" aria-label="Olheiro">
            {tabs.map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => go(t)}>
                <span className="tm-tabbar__ico">
                  <Ico d={ICON[t === "radar" ? "radar" : t]} />
                  {badge[t] > 0 && <i className={t === "shelves" ? "is-warn" : ""}>{badge[t]}</i>}
                </span>
                {label}
              </button>
            ))}
          </nav>
        ) : (
          <nav className="tm-steps sc-steps" role="tablist" aria-label="Olheiro">
            {tabs.map(([t, label, note]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`tm-step ${tab === t ? "is-on" : ""}`} onClick={() => setTab(t)}>
                <b className="sc-steps__ico"><Ico d={ICON[t]} size={26} /></b>
                <span>
                  {label}
                  <small>{note}</small>
                </span>
              </button>
            ))}
          </nav>
        )}

        {!ready ? (
          <NoData />
        ) : (
          <div className="tm-layout">
            <main className="tm-main">
              {tab === "radar" && (
                <>
                  <header className="sc-intro">
                    <p className="tm-eyebrow">Departamento de análise · {team.shortName}</p>
                    <h1>Radar do olheiro</h1>
                    <p>Nota de 0 a 100 por posição, comparando cada um com a mesma posição no grupo de ligas. {seasonNote}</p>
                  </header>
                  <Radar pool={pool} loading={loading} radar={radar} setRadar={setRadar} setScope={(s) => setRadar((r) => ({ ...r, scope: s, filters: { ...r.filters, league: "" }, limit: 30 }))} />
                </>
              )}
              {tab === "shelves" && <ShelvesTab onRadar={() => go("radar")} />}
              {tab === "plans" && <PlansTab onRadar={(pos: Pos) => (setRadar((r) => ({ ...r, filters: { ...r.filters, pos: [pos] }, search: "obvious" })), go("radar"))} />}
              {tab === "compare" && <CompareTab onRadar={() => go("radar")} />}
            </main>
            {!isMobile && <aside className="tm-rail sc-rail"><Desk onTab={go} /></aside>}
          </div>
        )}

        {rail && isMobile && (
          <Drawer label="Mesa do olheiro" onClose={() => setRail(false)}>
            <Desk onTab={go} />
          </Drawer>
        )}
        {opened && (
          <PlayerSheet
            x={opened}
            st={st}
            dispatch={dispatch}
            onClose={() => setOpenKey(null)}
            free={isFree(opened, FREE_CUTOFF)}
            contractCut={CONTRACT_CUT}
            signed={signedIds.has(opened.id)}
            own={ownIds.has(opened.id)}
            onAddToMarket={() => addToMarket([opened.key])}
          />
        )}
      </div>
    </ScoutContext.Provider>
  );
}
