import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/analytics";
import "../brand/brand.css";
import "./market.css";
import { teamSummary } from "../data";
import { navigate, params, replace } from "../router";
import { ModuleHeader } from "../brand/ModuleHeader";
import { clubVars, initials } from "../lib/color";
import { applyTeamSummary, useOverrides } from "../lib/overrides";
import { AgeValue, ContractYears, Depth, Legend, TapTips, Waterfall } from "./Charts";
import { PitchView } from "./PitchView";
import { MARKET_INDEX, hasMarketData, loadClubMarket, loadLeague, loadMarketState, saveMarketState } from "./data";
import {
  ACTION_LABEL, PRICED, SIGNING_LABEL, actionsFor, contractYears, decisionOf, depthChart, emptyMarketState, fmtDate, curUnit, fmtMoney, fmtRef, fromUnit, setMoneyMode, toUnit,
  FOREIGN_LIMIT, HOW_TAG, fmtEur, isEnding, moneyOf, nextSeason, posRank, shareText, staysWith, summarize, waterfall,
  type Currency, type Decision, type Lineup, type MarketState, type SquadAction,
} from "./logic";
import type { ClubMarket, MarketCoach, MarketLeague, MarketPlayer, SquadPlayer } from "./types";
import { Foreign, Ico, ICON, Photo, Price, Sheet, Stamp } from "./bits";
import { CoachCard, LineupTab, StoryStudio, getAuthor, shortName, useNextCoach } from "./Lineup";
import { Tour, tourSeen, type TourStep } from "./Tour";

// perfil do olheiro ("Ver scout") e a etapa 2 (atalhos do olheiro + Minha lista): carregados só quando abertos
const ScoutPeek = lazy(() => import("../scout/ScoutPeek"));
const Shopping = lazy(() => import("./Shopping"));
type Peek = { league: string; player: MarketPlayer | SquadPlayer; club: string };

const TOUR: TourStep[] = [
  { target: [".tm-steps", ".tm-tabbar"], title: "As quatro etapas da janela", text: "Elenco → Mercado → Fechamento → Escalação. No Mercado, os atalhos do olheiro (Joias, Fim de contrato…) acham reforços e a Minha lista guarda os seus Planos A, B e C." },
  { target: [".tm-view"], title: "Lista ou Campo", text: "Na Lista, o elenco inteiro com filtros. No Campo, setor por setor, com o rosto grande e um toque por decisão." },
  { target: [".tm-callout"], title: "Comece por aqui", text: "Esses contratos acabam antes da próxima temporada: decida o destino de cada um. Toque no × para fechar o aviso." },
  { target: [".tm-rail .tm-ledger", ".tm-chip"], title: "Balancete", text: "Saldo, vendas, gastos e o elenco por posição, sempre à vista. No celular, toque no saldo para abrir." },
  { target: [".mhd-club"], title: "Outro clube", text: "Toque no escudo para trocar de clube: a janela de cada time fica salva. No menu ⋯ ficam o guia e este tour." },
];

const CUTOFF = MARKET_INDEX.nextSeasonStart;
/** liga dos clubes da Série A (o elenco do usuário) */
const CLUB_LEAGUE = "BRA1";
const SEASON = CUTOFF.slice(0, 4);
type SetSt = React.Dispatch<React.SetStateAction<MarketState>>;

/** Texto e tinta do carimbo de cada decisão. */
const STAMP: Record<SquadAction, [string, "green" | "red" | "blue"]> = {
  keep: ["Fica", "green"],
  renew: ["Renovado", "green"],
  sell: ["Vendido", "red"],
  loanOut: ["Emprestado", "blue"],
  release: ["Dispensado", "red"],
  letGo: ["Sai livre", "red"],
  extendLoan: ["Segue", "green"],
  returnLoan: ["Devolvido", "red"],
  buyOut: ["Comprado", "green"],
  recall: ["Volta", "green"],
  keepLoan: ["Segue fora", "blue"],
};

const go = (to: string) => (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  navigate(to);
};

// ============ celular ============

const MOBILE_MQ = "(max-width: 640px)";
const isMobileNow = () => typeof matchMedia !== "undefined" && matchMedia(MOBILE_MQ).matches;

/** Mesmo corte do CSS (640px): no celular a tela vira app (cabeçalho fixo, abas embaixo, folhas). */
function useIsMobile() {
  const [m, setM] = useState(isMobileNow);
  useEffect(() => {
    const q = matchMedia(MOBILE_MQ);
    const f = () => setM(q.matches);
    f();
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return m;
}

/** Folha que sobe de baixo (só no celular). A rolagem da página trava via CSS enquanto ela existe. */


// ============ rota ============

export default function MarketApp({ slug }: { slug: string | null }) {
  useEffect(() => {
    document.title = "Mercado da bola · Meu Elenco FC";
    document.documentElement.classList.add("is-market");
    return () => document.documentElement.classList.remove("is-market");
  }, []);
  if (!slug) return null; // o App redireciona /mercado
  if (!teamSummary(slug)) {
    return (
      <div className="tm tm-center">
        <p>Esse clube não está na Série A {Number(SEASON) - 1}.</p>
        <a className="tm-btn" href="/?trocar=1" onClick={go("/?trocar=1")}>Escolher um clube</a>
      </div>
    );
  }
  return <MarketClub key={slug} slug={slug} />;
}

function NoData() {
  return (
    <div className="tm-note">
      <h2>O mercado ainda está fechado</h2>
      <p>Valores, contratos e empréstimos entram depois da primeira coleta de dados. Como rodar:</p>
      <ol>
        <li><code>pip install "transfermarkt-api==5.*"</code></li>
        <li><code>python scripts/market/collect_transfermarkt.py</code></li>
        <li><code>npm run build:market</code> e publique</li>
      </ol>
    </div>
  );
}


// ============ clube ============

type Tab = "squad" | "market" | "close" | "lineup";
type SquadView = "list" | "pitch";
const VIEW_KEY = "mercado:view";

function MarketClub({ slug }: { slug: string }) {
  const doc = useOverrides();
  const team = applyTeamSummary(teamSummary(slug)!, doc);
  const [club, setClub] = useState<ClubMarket | null | undefined>(undefined);
  const [st, setSt] = useState<MarketState>(() => loadMarketState(slug));
  setMoneyMode(st.currency, st.rate); // antes de renderizar os filhos: todos os valores saem na moeda escolhida
  // ?aba=mercado: abre direto nas compras (links antigos do Olheiro caem aqui)
  const [tab, setTab] = useState<Tab>(() => (params().get("aba") === "mercado" ? "market" : "squad"));
  // Procurar já em TEC: "Procurar técnico no mercado" (etapa 1) ou ?aba=mercado&pos=TEC; vale só nessa abertura
  const [startTec, setStartTec] = useState(() => params().get("aba") === "mercado" && params().get("pos") === "TEC");
  useEffect(() => {
    if (tab !== "market") setStartTec(false);
  }, [tab]);
  const coachMarket = () => (setStartTec(true), setTab("market"), window.scrollTo({ top: 0 }));
  const [peek, setPeek] = useState<Peek | null>(null);
  useEffect(() => {
    if (location.search) replace(`/mercado/${slug}`);
  }, [slug]);
  const [leagues, setLeagues] = useState<Record<string, MarketLeague>>({});
  const [guide, setGuide] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [studio, setStudio] = useState<Lineup | null>(null);
  const [tour, setTour] = useState(false);
  const isMobile = useIsMobile();
  const [view, setViewState] = useState<SquadView>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "list" || v === "pitch") return v;
    } catch {
      /* sem storage */
    }
    return isMobileNow() ? "pitch" : "list";
  });
  const setView = (v: SquadView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* sem storage */
    }
  };
  const openTab = (t: Tab) => {
    setTab(t);
    if (isMobile) window.scrollTo({ top: 0 });
  };

  // computador: quando a faixa das etapas sai da tela, as etapas "sobem" para o cabeçalho
  const stepsRef = useRef<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    const el = stepsRef.current;
    if (!el || isMobile) {
      setDocked(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setDocked(!e.isIntersecting && e.boundingClientRect.top < 80), { rootMargin: "-62px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile, club]);
  const dockTab = (t: Tab) => {
    setTab(t);
    const top = stepsRef.current ? stepsRef.current.getBoundingClientRect().top + window.scrollY - 70 : 0;
    window.scrollTo({ top: Math.max(0, top), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  useEffect(() => void loadClubMarket(slug).then(setClub), [slug]);
  useEffect(() => saveMarketState(slug, st), [slug, st]);
  useEffect(() => {
    for (const id of new Set(st.signings.map((s) => s.league))) {
      if (!leagues[id]) loadLeague(id)?.then((l) => setLeagues((x) => ({ ...x, [id]: l })));
    }
  }, [st.signings, leagues]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const squad = useMemo(() => club?.squad ?? [], [club]);
  const arrivals = st.signings
    .map((s) => {
      const lg = leagues[s.league];
      const p = lg?.players.find((x) => x.id === s.id);
      return p && lg ? { s, p, club: lg.clubs[p.club]?.name ?? "", clubId: lg.clubs[p.club]?.id ?? null, league: lg.name } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const sum = summarize(squad, st, CUTOFF, arrivals.map((a) => ({ value: a.p.value, age: a.p.age })));
  const next = nextSeason(squad, st, CUTOFF, arrivals.map((a) => a.p));
  const depth = depthChart(next);
  const foreigners = next.filter((x) => x.kind !== "leave" && x.foreign).length;
  const steps = waterfall(st, sum);
  const nextCoach = useNextCoach(club?.coach ?? null, st);

  const setDecision = (id: string, d: Decision | null) =>
    setSt((s) => {
      const decisions = { ...s.decisions };
      if (d) decisions[id] = d;
      else delete decisions[id];
      return { ...s, decisions };
    });

  const ready = club !== undefined && hasMarketData && !!club;
  const showGuide = ready && (guide || !st.onboarded);
  const tabs: [Tab, string, string | null][] = [
    ["squad", "Elenco", sum.pending.length ? `${sum.pending.length} a decidir` : "resolvido"],
    ["market", "Mercado", arrivals.length ? `${arrivals.length} chegada${arrivals.length > 1 ? "s" : ""}` : "nenhuma chegada"],
    ["close", "Fechamento", sum.balance < 0 ? "saldo negativo" : null],
    ["lineup", "Escalação", "escale e poste"],
  ];
  const NEXT: Record<Tab, [Tab, string] | null> = { squad: ["market", "Ir às compras"], market: ["close", "Fechar a janela"], close: ["lineup", "Compartilhar a janela"], lineup: null };

  const rail = (
    <Ledger st={st} setSt={setSt} sum={sum} steps={steps} depth={depth} foreigners={foreigners} next={next} onNext={NEXT[tab] ? () => (setTab(NEXT[tab]![0]), setSheet(false), window.scrollTo({ top: 0 })) : null} nextLabel={NEXT[tab]?.[1] ?? ""} />
  );

  return (
    <div className={`tm tm-club ${isMobile ? "is-app" : ""}`} style={clubVars(team.colors) as React.CSSProperties}>
      {/* cabeçalho comum dos módulos; no celular o saldo vira um chip que abre o balancete */}
      <ModuleHeader
        module="mercado"
        slug={slug}
        clubName={team.shortName}
        crest={team.crest}
        variant={isMobile ? "app" : "bar"}
        actions={
          isMobile && ready ? (
            <button className={`tm-chip ${sum.balance < 0 ? "is-neg" : ""}`} onClick={() => setSheet(true)} aria-label={`Saldo ${fmtEur(sum.balance)}. Abrir o balancete`}>
              {fmtEur(sum.balance)}
              {fmtRef(sum.balance) && <small className="tm-chip__ref">{fmtRef(sum.balance)}</small>}
            </button>
          ) : undefined
        }
        center={
          !isMobile && ready ? (
            <nav className={`tm-dock-steps ${docked ? "is-on" : ""}`} aria-label="Etapas da janela" aria-hidden={!docked}>
              {tabs.map(([t, label], i) => {
                const badge = t === "squad" ? sum.pending.length : t === "market" ? arrivals.length : 0;
                return (
                  <button key={t} tabIndex={docked ? 0 : -1} className={tab === t ? "is-on" : ""} aria-current={tab === t ? "step" : undefined} style={{ transitionDelay: docked ? `${i * 45}ms` : "0ms" }} onClick={() => dockTab(t)}>
                    <b>{i + 1}</b>
                    <span>{label}</span>
                    {badge > 0 && <i className={t === "squad" ? "is-warn" : ""}>{badge}</i>}
                  </button>
                );
              })}
            </nav>
          ) : undefined
        }
        menuItems={[
          { label: "Como funciona", onSelect: () => setGuide(true) },
          { label: "Tour pela tela", onSelect: () => (setTab("squad"), setSheet(false), setTour(true)) },
        ]}
      />

      {/* as quatro etapas são uma sequência real: decidir o elenco, comprar, fechar, escalar */}
      {isMobile ? (
        <nav className="tm-tabbar" role="tablist" aria-label="Etapas da janela">
          {tabs.map(([t, label], i) => {
            const badge = t === "squad" ? sum.pending.length : t === "market" ? arrivals.length : 0;
            return (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => openTab(t)}>
                <span className="tm-tabbar__ico">
                  <Ico d={ICON[t]} />
                  {badge > 0 && <i className={t === "squad" ? "is-warn" : ""}>{badge}</i>}
                  {t === "close" && sum.balance < 0 && <i className="is-neg" aria-label="saldo negativo">!</i>}
                </span>
                <span className="tm-tabbar__lbl"><b>{i + 1}.</b> {label}</span>
              </button>
            );
          })}
        </nav>
      ) : (
        <nav ref={stepsRef} className={`tm-steps ${docked ? "is-docked" : ""}`} role="tablist" aria-label="Etapas da janela">
          {tabs.map(([t, label, note], i) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`tm-step ${tab === t ? "is-on" : ""}`} onClick={() => setTab(t)}>
              <b>{i + 1}</b>
              <span>
                {label}
                {note && <small className={(t === "squad" && sum.pending.length) || (t === "close" && sum.balance < 0) ? "is-warn" : ""}>{note}</small>}
              </span>
            </button>
          ))}
        </nav>
      )}

      {club === undefined ? (
        <p className="tm-center">Abrindo a pasta do clube…</p>
      ) : !ready ? (
        <NoData />
      ) : (
        <div className="tm-layout">
          <main className="tm-main">
            {tab === "squad" && (
              <>
                <div className="tm-view" role="group" aria-label="Ver o elenco como">
                  {([["list", "Lista"], ["pitch", "Campo"]] as const).map(([v, label]) => (
                    <button key={v} className={view === v ? "is-on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{label}</button>
                  ))}
                </div>
                {view === "pitch" ? (
                  <>
                    <PendingCallout squad={squad} st={st} slug={slug} />
                    <PitchView squad={squad} coach={club!.coach ?? null} st={st} setSt={setSt} setDecision={setDecision} cutoff={CUTOFF} colors={team.colors} onMarket={() => (setTab("market"), window.scrollTo({ top: 0 }))} onCoachMarket={coachMarket} />
                  </>
                ) : (
                  <>
                    <CoachCard coach={club!.coach ?? null} st={st} setSt={setSt} onMarket={coachMarket} />
                    <SquadTab slug={slug} squad={squad} st={st} setDecision={setDecision} colors={team.colors} isMobile={isMobile} onScout={(p) => setPeek({ ...p, club: team.name })} />
                  </>
                )}
              </>
            )}
            {tab === "lineup" && <LineupTab slug={slug} next={next} st={st} setSt={setSt} team={team} coach={nextCoach} balance={sum.balance} income={sum.income} spend={sum.spend} onGenerate={setStudio} />}
            {tab === "market" && (
              <Suspense fallback={<p className="tm-center">Abrindo o mercado…</p>}>
                <Shopping
                  slug={slug} st={st} setSt={setSt} balance={sum.balance} squad={squad} depth={depth} isMobile={isMobile}
                  onLeague={(l: MarketLeague) => setLeagues((x) => (x[l.id] ? x : { ...x, [l.id]: l }))}
                  onToast={setToast} coach={club!.coach ?? null} startTec={startTec}
                  arrivals={arrivals} hiredCoach={st.coach.action === "fire" && st.coach.hire ? nextCoach : null}
                />
              </Suspense>
            )}
            {tab === "close" && (
              <CloseTab
                sum={sum} st={st} setSt={setSt} arrivals={arrivals} next={next} steps={steps} squad={squad}
                team={team} oldCoach={club!.coach ?? null} newCoach={st.coach.action === "fire" ? nextCoach : null}
                onShare={async () => {
                  const text = shareText({
                    club: team.shortName,
                    season: SEASON,
                    arrivals: arrivals.map((a) => ({ name: a.p.name, pos: a.p.pos, from: a.club, type: a.s.type, price: a.s.price })),
                    leaves: sum.leaves.map(({ p, d }) => ({ name: p.name, pos: p.pos, action: d.action, money: moneyOf(p, d) })),
                    balance: sum.balance,
                    income: st.useSales ? sum.income : 0,
                    spend: sum.spend,
                    squadSize: sum.squadSize,
                    squadValue: sum.squadValue,
                    coachIn: st.coach.action === "fire" && nextCoach ? { name: nextCoach.name, from: nextCoach.free ? null : nextCoach.club ?? null } : null,
                    coachOut: st.coach.action === "fire" ? club!.coach?.name ?? null : null,
                    url: `${location.origin}/mercado/${slug}`,
                  });
                  try {
                    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
                    else {
                      await navigator.clipboard.writeText(text);
                      setToast("Resumo copiado");
                    }
                  } catch {
                    /* cancelado */
                  }
                }}
                onReset={() => {
                  setSt({ ...emptyMarketState(), onboarded: true, rate: st.rate, currency: st.currency });
                  setTab("squad");
                }}
              />
            )}
          </main>
          <aside className="tm-rail">{rail}</aside>
        </div>
      )}

      {/* tablet: saldo fixo embaixo; toque abre o balancete (no celular o chip do cabeçalho faz isso) */}
      {ready && !isMobile && (
        <button className={`tm-dock ${sum.balance < 0 ? "is-neg" : ""}`} onClick={() => setSheet(true)}>
          <span>Saldo <b>{fmtEur(sum.balance)}</b></span>
          <span className="tm-dock__more">{sum.pending.length ? `${sum.pending.length} a decidir · ` : ""}Balancete ↑</span>
        </button>
      )}
      {sheet && (
        <div className="tm-sheet" role="dialog" aria-label="Balancete" onClick={() => setSheet(false)}>
          <div className="tm-sheet__body" onClick={(e) => e.stopPropagation()}>
            <button className="tm-sheet__close" onClick={() => setSheet(false)} aria-label="Fechar">×</button>
            {rail}
          </div>
        </div>
      )}
      {showGuide && (
        <Guide
          team={team.shortName}
          crest={team.crest}
          squadSize={squad.filter((p) => p.status !== "loanOut").length}
          st={st}
          setSt={setSt}
          pending={sum.pending.length}
          loans={squad.filter((p) => p.status !== "owned").length}
          onDone={() => {
            // primeira vez: depois do guia, o tour mostra onde fica cada coisa
            if (!st.onboarded && !tourSeen()) (setTab("squad"), setTour(true));
            if (!st.onboarded) trackEvent("concluir_guia", { clube: slug });
            setSt((s) => ({ ...s, onboarded: true }));
            setGuide(false);
          }}
        />
      )}
      {studio && (
        <StoryStudio
          props={{ team, lineup: studio, byId: new Map(next.map((p) => [p.id, p])), coach: nextCoach, budget: st.budget, balance: sum.balance, income: sum.income, spend: sum.spend, host: location.host, author: getAuthor() }}
          summary={{ arrivals: next.filter((p) => p.kind === "new"), leaves: next.filter((p) => p.kind === "leave"), stays: next.filter((p) => p.kind === "stay") }}
          onClose={() => setStudio(null)}
        />
      )}
      {tour && !showGuide && <Tour steps={TOUR} onClose={() => setTour(false)} />}
      {peek && (
        <Suspense fallback={null}>
          <ScoutPeek slug={slug} league={peek.league} player={peek.player} club={peek.club} own onClose={() => setPeek(null)} />
        </Suspense>
      )}
      {toast && <div className="tm-toast">{toast}</div>}
      <TapTips />
    </div>
  );
}

// ============ passo a passo ============

const BUDGET_OPTIONS: [number, string, string][] = [
  [5, "Cinto apertado", "Vender antes de comprar"],
  [20, "Janela realista", "Dois ou três reforços"],
  [80, "Cofre aberto", "Dá para sonhar alto"],
];

function Guide({ team, crest, squadSize, st, setSt, pending, loans, onDone }: {
  team: string; crest: string | null; squadSize: number; st: MarketState; setSt: SetSt; pending: number; loans: number; onDone: () => void;
}) {
  // primeira visita começa pela missão; "Como funciona" abre direto no orçamento
  const [i, setI] = useState(st.onboarded ? 1 : 0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onDone]);
  return (
    <div className="tm-modal" role="dialog" aria-modal="true" aria-label="Como funciona a janela">
      <div className="tm-guide">
        <div className="tm-guide__dots" aria-hidden="true">{[0, 1, 2, 3].map((n) => <i key={n} className={n === i ? "is-on" : ""} />)}</div>
        {i === 0 && (
          <div className="tm-mission">
            {crest && <img className="tm-mission__crest" src={crest} alt="" width={84} height={84} />}
            <p className="tm-eyebrow">Janela de transferências {SEASON}</p>
            <h2>Você é o novo diretor de futebol do {team}.</h2>
            <p>
              A diretoria te entregou as chaves do elenco. Sua missão: decidir quem fica, quem sai e quem chega
              para a temporada {SEASON}, sem estourar o orçamento.
            </p>
            <ol className="tm-mission__steps">
              <li><b>1</b> Defina o orçamento</li>
              <li><b>2</b> Carimbe o destino dos {squadSize} jogadores</li>
              <li><b>3</b> Vá às compras e monte o time ideal</li>
            </ol>
            <span className="tm-stamp tm-stamp--green tm-mission__stamp">Contratado</span>
          </div>
        )}
        {i === 1 && (
          <>
            <p className="tm-eyebrow">Passo 1 de 3</p>
            <h2>Quanto a diretoria do {team} liberou?</h2>
            <div className="tm-guide__cur"><span>Ver valores em</span><CurrencySwitch st={st} setSt={setSt} /></div>
            <div className="tm-guide__opts">
              {BUDGET_OPTIONS.map(([v, title, sub]) => (
                <button key={v} className={`tm-opt ${st.budget === v * 1e6 ? "is-on" : ""}`} onClick={() => setSt((s) => ({ ...s, budget: v * 1e6 }))}>
                  <b>{fmtEur(v * 1e6)}</b>
                  {fmtRef(v * 1e6) && <em className="tm-ref">{fmtRef(v * 1e6)}</em>}
                  <span>{title}</span>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
            <label className="tm-field">
              Outro valor
              <BudgetInput st={st} setSt={setSt} />
              <span>{curUnit()} mi{fmtRef(st.budget) ? ` (${fmtRef(st.budget)})` : ""}</span>
            </label>
            <label className="tm-check">
              <input type="checkbox" checked={st.useSales} onChange={(e) => setSt((s) => ({ ...s, useSales: e.target.checked }))} />
              O dinheiro das vendas volta para o orçamento
            </label>
          </>
        )}
        {i === 2 && (
          <>
            <p className="tm-eyebrow">Passo 2 de 3</p>
            <h2>Carimbe o destino de cada jogador</h2>
            <p>
              Cada jogador é uma ficha com valor de mercado, contrato e origem. Escolha se ele fica, renova, é vendido,
              emprestado ou dispensado. Clicar no carimbo desfaz.
            </p>
            <ul className="tm-guide__list">
              <li><Stamp text="A decidir" ink="amber" /> <span>{pending ? <><b>{pending}</b> contratos ou empréstimos do {team} acabam antes de {SEASON}. Comece por eles.</> : <>Nenhum contrato do {team} acaba antes de {SEASON}.</>}</span></li>
              {loans > 0 && <li><Stamp text="Emprestado" ink="blue" /> <span><b>{loans}</b> jogadores estão emprestados (chegando ou fora). Dá para devolver, comprar ou trazer de volta.</span></li>}
              <li><Stamp text="Vendido" ink="red" /> <span>Vendas entram no balancete na hora, pelo valor de mercado ou pelo preço que você digitar.</span></li>
            </ul>
          </>
        )}
        {i === 3 && (
          <>
            <p className="tm-eyebrow">Passo 3 de 3</p>
            <h2>Vá às compras e feche a janela</h2>
            <p>
              No <b>Mercado</b>, os atalhos do olheiro (Os óbvios, Joias, Fim de contrato…) e os filtros acham reforços em
              23 ligas; “Guardar na lista” monta a sua <b>Minha lista</b>, com Planos A, B e C por posição.
            </p>
            <p>
              O <b>balancete</b> acompanha tudo: saldo, e quantos jogadores você tem em cada posição. No
              <b> Fechamento</b>, veja os gráficos do elenco {SEASON}. Por fim, na <b>Escalação</b>, monte o time ideal e
              gere as imagens para o story.
            </p>
          </>
        )}
        <div className="tm-guide__nav">
          {i > 0 ? <button className="tm-btn tm-btn--ghost" onClick={() => setI(i - 1)}>Voltar</button> : <button className="tm-btn tm-btn--ghost" onClick={onDone}>Pular</button>}
          {i === 0 ? <button className="tm-btn tm-btn--brass" onClick={() => setI(1)}>Vamos pro desafio →</button>
            : i < 3 ? <button className="tm-btn tm-btn--brass" onClick={() => setI(i + 1)}>Continuar</button>
            : <button className="tm-btn tm-btn--brass" onClick={onDone}>Abrir a janela</button>}
        </div>
      </div>
    </div>
  );
}

// ============ balancete (lateral / folha no celular) ============

/** Estrangeiros no elenco da próxima temporada, contra o limite por jogo da CBF. */
function ForeignMeter({ count }: { count: number }) {
  const over = count > FOREIGN_LIMIT;
  return (
    <div className={`tm-foreignmeter ${over ? "is-over" : ""}`}>
      <p>
        <b>{count}</b> estrangeiro{count === 1 ? "" : "s"}
        <span>{over ? ` · só ${FOREIGN_LIMIT} podem ser relacionados por jogo` : ` · até ${FOREIGN_LIMIT} podem ser relacionados por jogo`}</span>
      </p>
      <div className="tm-foreignmeter__bar" role="img" aria-label={`${count} estrangeiros; até ${FOREIGN_LIMIT} podem ser relacionados por jogo`}>
        {Array.from({ length: Math.max(FOREIGN_LIMIT, count) }, (_, i) => (
          <i key={i} className={i < count ? (i < FOREIGN_LIMIT ? "is-on" : "is-over") : ""} />
        ))}
      </div>
    </div>
  );
}

function Ledger({ st, setSt, sum, steps, depth, foreigners, next, onNext, nextLabel }: {
  st: MarketState; setSt: SetSt; sum: ReturnType<typeof summarize>; steps: ReturnType<typeof waterfall>; depth: ReturnType<typeof depthChart>; foreigners: number;
  next: ReturnType<typeof nextSeason>;
  onNext: (() => void) | null; nextLabel: string;
}) {
  const short = depth.filter((d) => d.short);
  return (
    <div className="tm-ledger">
      <div className="tm-ledger__head">
        <p className="tm-eyebrow">Balancete</p>
        <CurrencySwitch st={st} setSt={setSt} />
      </div>
      <p className={`tm-ledger__bal ${sum.balance < 0 ? "is-neg" : ""}`}>
        {fmtEur(sum.balance)}
        <small>{fmtRef(sum.balance) ? `${fmtRef(sum.balance)} de saldo` : "de saldo"}</small>
      </p>
      <Waterfall steps={steps} compact />
      <div className="tm-ledger__budget">
        <label className="tm-field">
          Orçamento
          <BudgetInput st={st} setSt={setSt} />
          <span>{curUnit()} mi</span>
        </label>
        <label className="tm-field" title="Cotação usada para mostrar valores em reais">
          € 1 = R$
          <input type="number" step={0.05} min={1} value={st.rate} onChange={(e) => setSt((s) => ({ ...s, rate: Number(e.target.value) || s.rate }))} />
        </label>
      </div>
      <label className="tm-check">
        <input type="checkbox" checked={st.useSales} onChange={(e) => setSt((s) => ({ ...s, useSales: e.target.checked }))} />
        Vendas voltam para o orçamento
      </label>
      <Roster next={next} />

      <p className="tm-eyebrow tm-ledger__sep">Elenco {SEASON} · {sum.squadSize} jogadores</p>
      <ForeignMeter count={foreigners} />
      <Depth rows={depth} compact />
      <Legend items={["stay", "new", "leave", "min"]} />
      {short.length > 0 && <p className="tm-ledger__warn">Faltam: {short.map((d) => `${d.short} ${d.pos}`).join(", ")}</p>}
      {onNext && <button className="tm-btn tm-btn--brass tm-ledger__next" onClick={onNext}>{nextLabel} →</button>}
    </div>
  );
}

// ============ quem sai, fica e chega (no balancete) ============

function RosterFace({ p }: { p: ReturnType<typeof nextSeason>[number] }) {
  const [broken, setBroken] = useState(false);
  return p.photo && !broken ? (
    <img src={p.photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  ) : (
    <span className="tm-roster__ini">{initials(p.name)}</span>
  );
}

/** Progresso da janela, sempre à vista: quem já saiu, quem fica e quem chega. */
function Roster({ next, big = false }: { next: ReturnType<typeof nextSeason>; big?: boolean }) {
  const [allStay, setAllStay] = useState(big);
  const order = (l: typeof next) => [...l].sort((a, b) => posRank(a.pos) - posRank(b.pos) || (b.value ?? 0) - (a.value ?? 0));
  const leave = order(next.filter((p) => p.kind === "leave"));
  const stay = order(next.filter((p) => p.kind === "stay"));
  const arrive = order(next.filter((p) => p.kind === "new"));
  const tile = (p: (typeof next)[number]) => {
    const how = p.how ? HOW_TAG[p.how] : undefined;
    return (
      <li key={p.id} className="tm-roster__tile" title={`${p.name} · ${p.pos}${how ? ` · ${how}` : ""}`}>
        <span className="tm-roster__face"><RosterFace p={p} /><i className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</i></span>
        <span className="tm-roster__name">{shortName(p.name)}</span>
        {how && <span className={`tm-roster__how sty-how--${p.how}`}>{how}</span>}
      </li>
    );
  };
  return (
    <section className={`tm-roster ${big ? "tm-roster--big" : ""}`} aria-label="Quem sai, fica e chega">
      <div className="tm-roster__grp tm-roster__grp--out">
        <h4>Saem <b>{leave.length}</b></h4>
        {leave.length ? <ul>{leave.map(tile)}</ul> : <p className="tm-roster__empty">Ninguém saindo ainda.</p>}
      </div>
      <div className="tm-roster__grp tm-roster__grp--stay">
        <h4>
          Ficam <b>{stay.length}</b>
          {stay.length > 0 && !big && <button className="tm-link" onClick={() => setAllStay(!allStay)}>{allStay ? "recolher" : "ver todos"}</button>}
        </h4>
        {allStay ? (
          <ul>{stay.map(tile)}</ul>
        ) : (
          <button className="tm-roster__stack" onClick={() => setAllStay(true)} aria-label={`Ver os ${stay.length} que ficam`}>
            {stay.slice(0, 9).map((p) => <span key={p.id} className="tm-roster__face"><RosterFace p={p} /></span>)}
            {stay.length > 9 && <em>+{stay.length - 9}</em>}
          </button>
        )}
      </div>
      <div className="tm-roster__grp tm-roster__grp--in">
        <h4>Chegam <b>{arrive.length}</b></h4>
        {arrive.length ? <ul>{arrive.map(tile)}</ul> : <p className="tm-roster__empty">Nenhuma chegada. Contrate na etapa 2.</p>}
      </div>
    </section>
  );
}

// ============ moeda ============

/** € | R$ — em euros, os valores vêm sempre com a referência em reais. */
function CurrencySwitch({ st, setSt }: { st: MarketState; setSt: SetSt }) {
  const opts: [Currency, string, string][] = [["EUR", "€", "Euro"], ["BRL", "R$", "Real"]];
  return (
    <div className="tm-cur" role="radiogroup" aria-label="Moeda">
      {opts.map(([c, sym, name]) => (
        <button key={c} role="radio" aria-checked={st.currency === c} className={st.currency === c ? "is-on" : ""} title={name} onClick={() => setSt((s) => ({ ...s, currency: c }))}>{sym}</button>
      ))}
    </div>
  );
}

/** Orçamento digitado na moeda escolhida (guardado em euros). */
function BudgetInput({ st, setSt }: { st: MarketState; setSt: SetSt }) {
  return (
    <input
      type="number"
      min={0}
      value={Math.round((toUnit(st.budget) / 1e6) * 10) / 10}
      onChange={(e) => setSt((s) => ({ ...s, budget: Math.round(fromUnit(Math.max(0, Number(e.target.value) || 0) * 1e6)) }))}
    />
  );
}

// ============ fichas ============



function arrivalText(p: SquadPlayer): string {
  const a = p.arrival;
  const year = a.date ? ` em ${a.date.slice(0, 4)}` : "";
  if (a.type === "youth") return "Cria da base";
  if (a.type === "freeTransfer") return `Chegou livre${a.from ? ` do ${a.from}` : ""}${year}`;
  if (a.type === "loan") return `Empréstimo do ${a.from ?? "?"}${a.fee ? `, taxa de ${fmtMoney(a.fee)}` : ""}`;
  if (a.type === "transfer") return `Comprado do ${a.from ?? "?"}${a.fee ? ` por ${fmtMoney(a.fee)}` : ""}${year}`;
  return "";
}

function contractText(p: SquadPlayer): string {
  if (p.status === "loanIn") return `Emprestado pelo ${p.loanClub ?? "?"} até ${fmtDate(p.loanUntil)}`;
  if (p.status === "loanOut") return `Emprestado ao ${p.loanClub ?? "?"} até ${fmtDate(p.loanUntil)}`;
  return p.contract ? `Contrato até ${fmtDate(p.contract)}` : "Contrato sem data informada";
}


type SquadFilter = "all" | "pending" | "loans" | "leaving" | "foreign";
type SquadSort = "pos" | "value" | "contract" | "age";

/** Vínculos que acabam e ainda não têm decisão; vale na lista e no campo. */
/** Aviso dos vínculos que acabam antes da próxima temporada. Fecha no X (fica fechado para este clube). */
function PendingCallout({ squad, st, slug }: { squad: SquadPlayer[]; st: MarketState; slug: string }) {
  const key = `mercado:aviso:${slug}`;
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const pending = squad.filter((p) => isEnding(p, CUTOFF) && !st.decisions[p.id]);
  if (!pending.length || closed) return null;
  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* sem storage */
    }
  };
  return (
    <div className="tm-callout" role="note">
      <p><b>{pending.length} {pending.length > 1 ? "vínculos acabam" : "vínculo acaba"} antes de {SEASON}</b> e ainda não {pending.length > 1 ? "têm" : "tem"} decisão.</p>
      <button className="tm-callout__x" onClick={close} aria-label="Fechar aviso">×</button>
    </div>
  );
}

const SQUAD_SORTS: [SquadSort, string][] = [["pos", "por posição"], ["value", "por valor"], ["contract", "por fim de contrato"], ["age", "por idade"]];

function SquadTab({ slug, squad, st, setDecision, colors, isMobile, onScout }: {
  slug: string; squad: SquadPlayer[]; st: MarketState; setDecision: (id: string, d: Decision | null) => void;
  colors: { primary: string; secondary: string }; isMobile: boolean; onScout: (p: Omit<Peek, "club">) => void;
}) {
  const [filter, setFilter] = useState<SquadFilter>("all");
  const [sort, setSort] = useState<SquadSort>("pos");
  const [sortSheet, setSortSheet] = useState(false);
  const act = (p: SquadPlayer) => decisionOf(p, st, CUTOFF).action;
  const shown = squad
    .filter((p) =>
      filter === "pending" ? isEnding(p, CUTOFF) : filter === "loans" ? p.status !== "owned" : filter === "leaving" ? !staysWith(act(p)) && p.status !== "loanOut" : filter === "foreign" ? p.foreign : true,
    )
    .sort((a, b) =>
      sort === "value" ? (b.value ?? 0) - (a.value ?? 0)
      : sort === "age" ? (b.age ?? 0) - (a.age ?? 0)
      : sort === "contract" ? (a.loanUntil ?? a.contract ?? "9999").localeCompare(b.loanUntil ?? b.contract ?? "9999")
      : posRank(a.pos) - posRank(b.pos) || (b.value ?? 0) - (a.value ?? 0),
    );
  const filters: [SquadFilter, string, number | null][] = [
    ["all", "Todos", squad.length],
    ["pending", "Terminando", squad.filter((p) => isEnding(p, CUTOFF)).length],
    ["loans", "Empréstimos", squad.filter((p) => p.status !== "owned").length],
    ["leaving", "Saindo", null],
    ["foreign", "Estrangeiros", squad.filter((p) => p.foreign && p.status !== "loanOut").length],
  ];
  return (
    <section>
      <div className="tm-bar">
        <div className="tm-seg" role="group" aria-label="Filtrar elenco">
          {filters.map(([f, label, n]) => (
            <button key={f} className={filter === f ? "is-on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}{n != null && <> <i className="tm-seg__n">{n}</i></>}
            </button>
          ))}
        </div>
        {isMobile ? (
          <button className="tm-iconbtn" onClick={() => setSortSheet(true)} aria-label={`Ordenar (${SQUAD_SORTS.find(([k]) => k === sort)?.[1]})`}>
            <Ico d={ICON.sort} size={20} />
          </button>
        ) : (
          <label className="tm-select">
            Ordenar
            <select value={sort} onChange={(e) => setSort(e.target.value as SquadSort)}>
              {SQUAD_SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
      {sortSheet && (
        <Sheet title="Ordenar elenco" onClose={() => setSortSheet(false)}>
          <div className="tm-radios" role="radiogroup" aria-label="Ordenar elenco">
            {SQUAD_SORTS.map(([k, label]) => (
              <label key={k} className="tm-radio">
                <input type="radio" name="squad-sort" checked={sort === k} onChange={() => (setSort(k), setSortSheet(false))} />
                {label}
              </label>
            ))}
          </div>
        </Sheet>
      )}
      <PendingCallout squad={squad} st={st} slug={slug} />
      <div className="tm-fichas">
        {shown.map((p) => {
          const { options } = actionsFor(p, CUTOFF);
          const d = decisionOf(p, st, CUTOFF);
          const explicit = !!st.decisions[p.id];
          const ending = isEnding(p, CUTOFF);
          const money = moneyOf(p, d);
          const [stamp, ink] = STAMP[d.action];
          return (
            <article key={p.id} className={`tm-ficha ${explicit && !staysWith(d.action) ? "is-out" : ""} ${ending && !explicit ? "is-pending" : ""}`}>
              <Photo name={p.name} photo={p.photo} colors={colors} />
              <div className="tm-ficha__main">
                <p className="tm-ficha__name">
                  {p.num != null && <i className="tm-ficha__num">{p.num}</i>}
                  {p.name}
                  <span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span>
                  <Foreign on={p.foreign} />
                </p>
                <p className="tm-ficha__meta">
                  {p.age != null ? `${p.age} anos` : "Idade não informada"}{p.nat ? ` · ${p.nat}` : ""} · <span className={ending ? "is-ending" : ""}>{contractText(p)}</span>
                </p>
                {arrivalText(p) && <p className="tm-ficha__origin">{arrivalText(p)}</p>}
              </div>
              <p className="tm-ficha__value">{fmtEur(p.value)}<small>{fmtRef(p.value)}</small></p>
              <div className="tm-ficha__actions" role="group" aria-label={`Destino de ${p.name}`}>
                {options.map((a) => (
                  <button key={a} className={`tm-act tm-act--${STAMP[a][1]} ${explicit && d.action === a ? "is-on" : ""}`} aria-pressed={explicit && d.action === a} onClick={() => setDecision(p.id, { action: a })}>
                    {ACTION_LABEL[a]}
                  </button>
                ))}
                {explicit && PRICED.includes(d.action) && (
                  <span className="tm-ficha__price">
                    <Price label={d.action === "loanOut" ? "Taxa" : d.action === "sell" ? "Por" : "Custo"} value={d.price ?? (d.action === "loanOut" ? 0 : p.value ?? 0)} onChange={(v) => setDecision(p.id, { ...d, price: v })} />
                    <b className={money >= 0 ? "is-in" : "is-out"}>{money > 0 ? "+" : ""}{fmtEur(money)}{fmtRef(money) && <small className="tm-ref"> {fmtRef(money)}</small>}</b>
                  </span>
                )}
                <button className="tm-act tm-act--scout" onClick={() => onScout({ league: CLUB_LEAGUE, player: p })} aria-label={`Ver scout de ${p.name}`}>Ver scout</button>
              </div>
              {explicit ? (
                <Stamp key={d.action} text={stamp} ink={ink} onClick={() => setDecision(p.id, null)} title="Desfazer a decisão" />
              ) : ending ? (
                <Stamp text="A decidir" ink="amber" />
              ) : null}
            </article>
          );
        })}
        {!shown.length && <p className="tm-empty">Ninguém neste filtro. <button className="tm-link" onClick={() => setFilter("all")}>Ver todos</button></p>}
      </div>
    </section>
  );
}

// ============ fechamento ============

type CloseView = "in" | "out" | "contracts" | "age";
const CLOSE_VIEWS: [CloseView, string, string][] = [["in", "Quem chega", "Chegam"], ["out", "Quem sai", "Saem"], ["contracts", "Contratos", "Contratos"], ["age", "Idade × valor", "Idade × valor"]];

/** Escudo de um clube do Transfermarkt (pela id). */
const tmCrest = (id: string | null) => (id ? `https://img.a.transfermarkt.technology/wappen/big/${id}.png` : null);

function Crest({ src, name }: { src: string | null; name: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img className="mv-crest" src={src} alt="" title={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <span className="mv-crest mv-crest--ini" title={name}>{initials(name)}</span>;
}

const HOW_INK: Record<string, string> = { sell: "#d0321e", loanOut: "#2860c4", release: "#8e2a5a", letGo: "#6b6458", returnLoan: "#6b6458", buy: "#1f8a4c", loan: "#2860c4", free: "#b07612" };

function CloseTab({ sum, st, setSt, arrivals, next, squad, team, oldCoach, newCoach, onShare, onReset }: {
  sum: ReturnType<typeof summarize>; st: MarketState; setSt: SetSt;
  arrivals: { s: MarketState["signings"][number]; p: MarketPlayer; club: string; clubId: string | null; league: string }[];
  team: { shortName: string; crest: string | null }; oldCoach: MarketCoach | null; newCoach: MarketCoach | null;
  next: ReturnType<typeof nextSeason>; steps: ReturnType<typeof waterfall>; squad: SquadPlayer[];
  onShare: () => void; onReset: () => void;
}) {
  const [view, setView] = useState<CloseView>("in");
  const before = squad.filter((p) => p.status !== "loanOut");
  const foreigners = next.filter((x) => x.kind !== "leave" && x.foreign).length;
  const arrivalsByPos = [...arrivals].sort((a, b) => posRank(a.p.pos) - posRank(b.p.pos) || (b.p.value ?? 0) - (a.p.value ?? 0));
  const leavesByPos = [...sum.leaves].sort((a, b) => posRank(a.p.pos) - posRank(b.p.pos) || (b.p.value ?? 0) - (a.p.value ?? 0));
  const valueBefore = before.reduce((a, p) => a + (p.value ?? 0), 0);
  const delta = sum.squadValue - valueBefore;
  const [askReset, setAskReset] = useState(false);
  // aviso só para o que trava a janela (saldo negativo ou contratos sem decisão)
  const verdict =
    sum.balance < 0 ? `O saldo fechou negativo em ${fmtMoney(-sum.balance)}. Venda alguém ou desista de uma contratação.`
    : sum.pending.length ? `Faltam ${sum.pending.length} decisões de contrato para a janela ficar redonda.`
    : null;
  return (
    <section className="tm-close">
      <div className="tm-close__bar">
        <p className="tm-eyebrow">Resumo da janela</p>
        <button className="tm-roundbtn" onClick={onShare} aria-label="Copiar resumo da janela" title="Copiar resumo da janela">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
        </button>
        <button className="tm-roundbtn" onClick={() => setAskReset(true)} aria-label="Recomeçar a janela" title="Recomeçar a janela">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v4.5h4.5" /></svg>
        </button>
      </div>
      {verdict && <div className={`tm-verdict ${sum.balance < 0 ? "is-bad" : "is-warn"}`}><p>{verdict}</p></div>}
      {askReset && (
        <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="tm-reset-t" onClick={() => setAskReset(false)}>
          <div className="tm-confirm" onClick={(e) => e.stopPropagation()}>
            <h2 id="tm-reset-t">Recomeçar a janela?</h2>
            <p>Você vai perder toda a jornada do {team.shortName}: decisões de contrato, vendas, contratações, técnico e escalação. Não dá para desfazer.</p>
            <div>
              <button className="tm-btn tm-btn--ghost" onClick={() => setAskReset(false)}>Cancelar</button>
              <button className="tm-btn tm-btn--danger" onClick={() => { setAskReset(false); onReset(); }}>Apagar e recomeçar</button>
            </div>
          </div>
        </div>
      )}

      <div className="tm-kpis">
        <div><span>Elenco {SEASON}</span><b>{sum.squadSize}</b><small>{sum.squadSize === before.length ? "mesmo tamanho de hoje" : `${sum.squadSize > before.length ? "+" : "–"}${Math.abs(sum.squadSize - before.length)} em relação a hoje`}</small></div>
        <div><span>Valor do elenco</span><b>{fmtEur(sum.squadValue)}</b><small>{delta >= 0 ? "+" : "– "}{fmtEur(Math.abs(delta))} na janela{fmtRef(sum.squadValue) ? ` · ${fmtRef(sum.squadValue)}` : ""}</small></div>
        <div><span>Idade média</span><b>{sum.avgAge ? sum.avgAge.toFixed(1).replace(".", ",") : "—"}</b><small>anos</small></div>
        <div className={foreigners > FOREIGN_LIMIT ? "is-over" : ""}>
          <span>Estrangeiros</span><b>{foreigners}</b>
          <small>{foreigners > FOREIGN_LIMIT ? `${foreigners - FOREIGN_LIMIT} a mais que os ${FOREIGN_LIMIT} relacionáveis por jogo` : `até ${FOREIGN_LIMIT} relacionados por jogo`}</small>
        </div>
      </div>

      <div className="tm-ctabs" role="tablist" aria-label="Visões do fechamento">
        {CLOSE_VIEWS.map(([v, label, short]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? "is-on" : ""} onClick={() => setView(v)}>
            <span className="tm-ctabs__long">{label}</span><span className="tm-ctabs__short">{short}</span>
          </button>
        ))}
      </div>

      {view === "in" && (
        <div className="mv tm-ctab-body">
          <div className="mv-head"><h3>Quem chega</h3><span>{arrivals.length + (newCoach ? 1 : 0)}</span></div>
          {newCoach && (
            <div className="mv-row mv-row--coach">
              <span className="mv-photo"><Photo name={newCoach.name} photo={newCoach.photo} /></span>
              <span className="mv-who">
                <b><span>{newCoach.name}</span> <i className="tm-pos ms-tec">TEC</i></b>
                <small>{[newCoach.age != null ? `${newCoach.age} anos` : "", newCoach.nat ?? ""].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="mv-from">{newCoach.free ? <span className="mv-from__txt">Sem clube{newCoach.lastClub ? <small>último: {newCoach.lastClub}</small> : null}</span> : <span className="mv-from__txt">{newCoach.club}<small>{newCoach.league}</small></span>}</span>
              <span className="mv-deal"><em className="mv-pill" style={{ background: "#1f8a4c" }}>Técnico</em><small>{newCoach.free ? "sem custo" : "rescisão a negociar"}</small></span>
              <button className="mv-x" aria-label={`Desfazer contratação de ${newCoach.name}`} onClick={() => setSt((x) => ({ ...x, coach: { action: "keep", hire: null } }))}>×</button>
            </div>
          )}
          {!arrivals.length && !newCoach && <p className="tm-muted">Nenhuma contratação. O mercado está na etapa 2.</p>}
          {arrivalsByPos.map((a) => (
            <div key={a.s.id} className="mv-row">
              <span className="mv-photo"><Photo name={a.p.name} photo={a.p.photo} /></span>
              <span className="mv-who">
                <b><span>{a.p.name}</span> <i className={`tm-pos tm-pos--${a.p.pos}`}>{a.p.pos}</i></b>
                <small>{[a.p.age != null ? `${a.p.age} anos` : "", a.p.nat ?? ""].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="mv-from"><Crest src={tmCrest(a.clubId)} name={a.club} /><span className="mv-from__txt">{a.club}<small>{a.league}</small></span></span>
              <span className="mv-deal">
                <em className="mv-pill" style={{ background: HOW_INK[a.s.type] }}>{SIGNING_LABEL[a.s.type]}</em>
                <small className={a.s.type === "buy" ? "is-cost" : ""}>{a.s.type === "buy" ? `−${fmtMoney(a.s.price)}` : "sem custo"}</small>
              </span>
              <button className="mv-x" aria-label={`Desistir de ${a.p.name}`} onClick={() => setSt((x) => ({ ...x, signings: x.signings.filter((y) => y.id !== a.s.id) }))}>×</button>
            </div>
          ))}
        </div>
      )}
      {view === "out" && (
        <div className="mv tm-ctab-body">
          <div className="mv-head"><h3>Quem sai</h3><span>{sum.leaves.length + (newCoach && oldCoach ? 1 : 0)}</span></div>
          {st.coach.action === "fire" && oldCoach && (
            <div className="mv-row mv-row--coach">
              <span className="mv-photo is-out"><Photo name={oldCoach.name} photo={oldCoach.photo} /></span>
              <span className="mv-who">
                <b><span>{oldCoach.name}</span> <i className="tm-pos ms-tec">TEC</i></b>
                <small>{[oldCoach.age != null ? `${oldCoach.age} anos` : "", oldCoach.nat ?? ""].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="mv-from"><Crest src={team.crest} name={team.shortName} /><span className="mv-from__txt">{team.shortName}<small>técnico atual</small></span></span>
              <span className="mv-deal"><em className="mv-pill" style={{ background: "#d0321e" }}>Demitido</em><small>multa a negociar</small></span>
            </div>
          )}
          {!sum.leaves.length && !(st.coach.action === "fire" && oldCoach) && <p className="tm-muted">Ninguém saindo. As decisões ficam na etapa 1.</p>}
          {leavesByPos.map(({ p, d }) => {
            const m = moneyOf(p, d);
            const tag = HOW_TAG[d.action] ?? ACTION_LABEL[d.action];
            return (
              <div key={p.id} className="mv-row">
                <span className="mv-photo is-out"><Photo name={p.name} photo={p.photo} /></span>
                <span className="mv-who">
                  <b><span>{p.name}</span> <i className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</i></b>
                  <small>{[p.age != null ? `${p.age} anos` : "", p.nat ?? ""].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="mv-from"><span className="mv-from__txt">{p.status === "loanIn" ? `volta ao ${p.loanClub ?? "clube de origem"}` : p.status === "loanOut" ? `estava no ${p.loanClub ?? "empréstimo"}` : `valor: ${fmtEur(p.value)}`}<small>{p.contract ? `contrato até ${fmtDate(p.contract)}` : ""}</small></span></span>
                <span className="mv-deal">
                  <em className="mv-pill" style={{ background: HOW_INK[d.action] ?? "#6b6458" }}>{tag}</em>
                  <small className={m > 0 ? "is-gain" : ""}>{m > 0 ? `+${fmtMoney(m)}` : "sem receita"}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {view === "contracts" && (
        <figure className="tm-chart tm-ctab-body">
          <figcaption><b>Quando acabam os contratos</b><span>Elenco {SEASON}, por ano de fim do vínculo</span></figcaption>
          <ContractYears data={contractYears(next)} />
        </figure>
      )}
      {view === "age" && (
        <figure className="tm-chart tm-ctab-body">
          <figcaption><b>Idade e valor de mercado</b><span>À direita e no alto: veteranos caros, bons de vender</span></figcaption>
          <AgeValue list={next} />
          <Legend items={["stay", "new", "leave"]} />
        </figure>
      )}
    </section>
  );
}
