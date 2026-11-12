import { useEffect, useMemo, useState } from "react";
import "../brand/brand.css";
import "./market.css";
import { teamSummary } from "../data";
import { navigate } from "../router";
import { ModuleHeader } from "../brand/ModuleHeader";
import { clubVars, initials } from "../lib/color";
import { applyTeamSummary, useOverrides } from "../lib/overrides";
import { POSITIONS, type Pos } from "../types";
import { AgeValue, ContractYears, Depth, Legend, TapTips, Waterfall } from "./Charts";
import { PitchView } from "./PitchView";
import { MARKET_INDEX, hasMarketData, loadClubMarket, loadLeague, loadMarketState, saveMarketState } from "./data";
import {
  ACTION_LABEL, PRICED, SIGNING_LABEL, actionsFor, contractYears, decisionOf, depthChart, emptyMarketState, fmtDate, curUnit, fmtMoney, fmtRef, fromUnit, setMoneyMode, toUnit,
  FOREIGN_LIMIT, HOW_TAG, fmtEur, isEnding, isFreeAgent, moneyOf, nextSeason, posRank, shareText, staysWith, summarize, waterfall,
  type Currency, type Decision, type Lineup, type MarketState, type SigningType, type SquadAction,
} from "./logic";
import type { ClubMarket, MarketLeague, MarketPlayer, SquadPlayer } from "./types";
import { CoachCard, LineupTab, StoryStudio, shortName, useNextCoach } from "./Lineup";
import { Tour, tourSeen, type TourStep } from "./Tour";

const TOUR: TourStep[] = [
  { target: [".tm-steps", ".tm-tabbar"], title: "As quatro etapas da janela", text: "Elenco → Mercado → Fechamento → Compartilhe. Siga na ordem; dá para voltar a qualquer uma." },
  { target: [".tm-view"], title: "Lista ou Campo", text: "Na Lista, o elenco inteiro com filtros. No Campo, setor por setor, com o rosto grande e um toque por decisão." },
  { target: [".tm-callout"], title: "Comece por aqui", text: "Esses contratos acabam antes da próxima temporada. Decida um a um ou aplique o padrão a todos." },
  { target: [".tm-rail .tm-ledger", ".tm-chip"], title: "Balancete", text: "Saldo, vendas, gastos e o elenco por posição, sempre à vista. No celular, toque no saldo para abrir." },
  { target: [".mhd-club"], title: "Outro clube ou a Prancheta", text: "Toque no escudo para trocar de clube. A Prancheta do mesmo time fica no seletor ao lado (no celular, no menu ⋯)." },
];

const CUTOFF = MARKET_INDEX.nextSeasonStart;
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
const SIGN_STAMP: Record<SigningType, string> = { buy: "Contratado", loan: "Empréstimo", free: "Chega livre" };

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
function Sheet({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="tm-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="tm-sheet__body tm-psheet" onClick={(e) => e.stopPropagation()}>
        <div className="tm-psheet__head">
          <b>{title}</b>
          <button className="tm-sheet__close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="tm-psheet__scroll">{children}</div>
        {foot && <div className="tm-psheet__foot">{foot}</div>}
      </div>
    </div>
  );
}

const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON = {
  squad: "M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3c-.6 1.6-2.2 2.6-4 2.6S8.6 4.6 8 3Z",
  market: "M3 4h2.2l2.3 11h10.8L21 7H6.4M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01",
  close: "M4 20V10m5.3 10V4m5.4 16v-7M20 20V7M3 20.5h18",
  lineup: "M4 3h16v18H4zM4 12h16M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 3v3h6V3M9 21v-3h6v3",
  sort: "M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3",
  filter: "M4 6h16M7 12h10M10 18h4",
};

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

function Stamp({ text, ink, onClick, title }: { text: string; ink: "green" | "red" | "blue" | "amber"; onClick?: () => void; title?: string }) {
  const cls = `tm-stamp tm-stamp--${ink}`;
  return onClick ? (
    <button className={cls} onClick={onClick} title={title}>{text}</button>
  ) : (
    <span className={cls}>{text}</span>
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
  const [tab, setTab] = useState<Tab>("squad");
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
      return p && lg ? { s, p, club: lg.clubs[p.club]?.name ?? "", league: lg.name } : null;
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
    ["lineup", "Compartilhe", "escale e poste"],
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
        menuItems={[
          { label: "Como funciona", onSelect: () => setGuide(true) },
          { label: "Tour pela tela", onSelect: () => (setTab("squad"), setSheet(false), setTour(true)) },
        ]}
      />

      {/* as quatro etapas são uma sequência real: decidir o elenco, comprar, fechar, escalar */}
      {isMobile ? (
        <nav className="tm-tabbar" role="tablist" aria-label="Etapas da janela">
          {tabs.map(([t, label]) => {
            const badge = t === "squad" ? sum.pending.length : t === "market" ? arrivals.length : 0;
            return (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => openTab(t)}>
                <span className="tm-tabbar__ico">
                  <Ico d={ICON[t]} />
                  {badge > 0 && <i className={t === "squad" ? "is-warn" : ""}>{badge}</i>}
                  {t === "close" && sum.balance < 0 && <i className="is-neg" aria-label="saldo negativo">!</i>}
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      ) : (
        <nav className="tm-steps" role="tablist" aria-label="Etapas da janela">
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
                    <PendingCallout squad={squad} st={st} setSt={setSt} />
                    <PitchView squad={squad} coach={club!.coach ?? null} st={st} setSt={setSt} setDecision={setDecision} cutoff={CUTOFF} colors={team.colors} onMarket={() => (setTab("market"), window.scrollTo({ top: 0 }))} />
                  </>
                ) : (
                  <>
                    <CoachCard coach={club!.coach ?? null} st={st} setSt={setSt} />
                    <SquadTab squad={squad} st={st} setSt={setSt} setDecision={setDecision} colors={team.colors} isMobile={isMobile} />
                  </>
                )}
              </>
            )}
            {tab === "lineup" && <LineupTab next={next} st={st} setSt={setSt} team={team} coach={nextCoach} balance={sum.balance} onGenerate={setStudio} />}
            {tab === "market" && (
              <MarketTab st={st} setSt={setSt} balance={sum.balance} ownIds={new Set(squad.map((p) => p.id))} depth={depth} onLeague={(l) => setLeagues((x) => ({ ...x, [l.id]: l }))} isMobile={isMobile} />
            )}
            {tab === "close" && (
              <CloseTab
                sum={sum} st={st} setSt={setSt} arrivals={arrivals} next={next} depth={depth} steps={steps} squad={squad}
                onShare={async () => {
                  const text = shareText({
                    club: team.shortName,
                    season: SEASON,
                    arrivals: arrivals.map((a) => ({ name: a.p.name, from: a.club, type: a.s.type, price: a.s.price })),
                    leaves: sum.leaves.map(({ p, d }) => ({ name: p.name, action: d.action, money: moneyOf(p, d) })),
                    balance: sum.balance,
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
                  if (confirm("Recomeçar a janela? Todas as decisões e contratações deste clube serão apagadas.")) {
                    setSt({ ...emptyMarketState(), onboarded: true, rate: st.rate, currency: st.currency });
                    setTab("squad");
                  }
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
            setSt((s) => ({ ...s, onboarded: true }));
            setGuide(false);
          }}
        />
      )}
      {studio && (
        <StoryStudio
          props={{ team, lineup: studio, byId: new Map(next.map((p) => [p.id, p])), coach: nextCoach, budget: st.budget, balance: sum.balance, host: location.host }}
          summary={{ arrivals: next.filter((p) => p.kind === "new"), leaves: next.filter((p) => p.kind === "leave"), stays: next.filter((p) => p.kind === "stay") }}
          onClose={() => setStudio(null)}
        />
      )}
      {tour && !showGuide && <Tour steps={TOUR} onClose={() => setTour(false)} />}
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
              No <b>Mercado</b>, filtre por liga, posição, idade e preço. “Cabe no saldo” mostra só quem você pode pagar, e
              a estrela guarda um jogador para decidir depois. Quem está em fim de contrato pode chegar de graça.
            </p>
            <p>
              O <b>balancete</b> acompanha tudo: saldo, e quantos jogadores você tem em cada posição. No
              <b> Fechamento</b>, veja os gráficos do elenco {SEASON}. Por fim, em <b>Compartilhe</b>, monte o time ideal e
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
      <Roster next={next} />
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

function Photo({ name, photo, colors }: { name: string; photo: string | null; colors?: { primary: string; secondary: string } }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      <img
        className="tm-ficha__photo"
        src={photo}
        alt=""
        width={52}
        height={52}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="tm-ficha__photo tm-ficha__photo--ini" style={colors ? { background: colors.primary, color: colors.secondary === colors.primary ? "#fff" : colors.secondary } : undefined}>
      {initials(name)}
    </span>
  );
}

/** Bandeira de texto para estrangeiro (conta no limite da CBF). */
const Foreign = ({ on }: { on: boolean }) => (on ? <span className="tm-foreign" title={`Estrangeiro: até ${FOREIGN_LIMIT} podem ser relacionados por jogo`}>EST</span> : null);

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

function Price({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="tm-price">
      {label} {curUnit()}
      <input type="number" min={0} step={0.1} value={Math.round((toUnit(value) / 1e6) * 10) / 10} onChange={(e) => onChange(Math.round(fromUnit(Math.max(0, Number(e.target.value) || 0) * 1e6)))} />
      mi
    </label>
  );
}

type SquadFilter = "all" | "pending" | "loans" | "leaving" | "foreign";
type SquadSort = "pos" | "value" | "contract" | "age";

/** Vínculos que acabam e ainda não têm decisão; vale na lista e no campo. */
function PendingCallout({ squad, st, setSt, onShow }: { squad: SquadPlayer[]; st: MarketState; setSt: SetSt; onShow?: () => void }) {
  const pending = squad.filter((p) => isEnding(p, CUTOFF) && !st.decisions[p.id]);
  if (!pending.length) return null;
  return (
    <div className="tm-callout">
      <p><b>{pending.length} {pending.length > 1 ? "vínculos acabam" : "vínculo acaba"} antes de {SEASON}</b> e ainda não têm decisão.</p>
      {onShow && <button className="tm-btn tm-btn--ghost" onClick={onShow}>Ver só esses</button>}
      <button
        className="tm-btn"
        title="Renova quem é do clube, devolve quem chegou emprestado e traz de volta quem está fora"
        onClick={() => setSt((s) => ({ ...s, decisions: { ...s.decisions, ...Object.fromEntries(pending.map((p) => [p.id, { action: actionsFor(p, CUTOFF).def }])) } }))}
      >
        Aplicar o padrão a todos
      </button>
    </div>
  );
}

const SQUAD_SORTS: [SquadSort, string][] = [["pos", "por posição"], ["value", "por valor"], ["contract", "por fim de contrato"], ["age", "por idade"]];

function SquadTab({ squad, st, setSt, setDecision, colors, isMobile }: {
  squad: SquadPlayer[]; st: MarketState; setSt: SetSt; setDecision: (id: string, d: Decision | null) => void;
  colors: { primary: string; secondary: string }; isMobile: boolean;
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
      <PendingCallout squad={squad} st={st} setSt={setSt} onShow={() => setFilter("pending")} />
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

// ============ mercado ============

type MarketSort = "value" | "cheap" | "young" | "contract";

const MARKET_SORTS: [MarketSort, string][] = [["value", "Mais valiosos"], ["cheap", "Mais baratos"], ["young", "Mais jovens"], ["contract", "Contrato acaba antes"]];

function MarketTab({ st, setSt, balance, ownIds, depth, onLeague, isMobile }: {
  st: MarketState; setSt: SetSt; balance: number; ownIds: Set<string>; depth: ReturnType<typeof depthChart>; onLeague: (l: MarketLeague) => void; isMobile: boolean;
}) {
  const [sheet, setSheet] = useState(false);
  const groups = [...new Set(MARKET_INDEX.leagues.map((l) => l.group))];
  const [leagueId, setLeagueId] = useState(MARKET_INDEX.leagues[0]?.id ?? "");
  const [loaded, setLoaded] = useState<MarketLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [clubKey, setClubKey] = useState(""); // "liga:índice"
  const [pos, setPos] = useState<Pos | null>(null);
  const [maxAge, setMaxAge] = useState(0);
  const [afford, setAfford] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyWatch, setOnlyWatch] = useState(false);
  const [sort, setSort] = useState<MarketSort>("value");
  const [limit, setLimit] = useState(40);

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

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const watch = useMemo(() => new Set(st.watch), [st.watch]);
  const results = useMemo(() => {
    const nq = norm(q.trim());
    const out: { p: MarketPlayer; lg: MarketLeague }[] = [];
    for (const lg of loaded) {
      if (clubKey && !clubKey.startsWith(`${lg.id}:`)) continue;
      const ci = clubKey ? Number(clubKey.split(":")[1]) : -1;
      for (const p of lg.players) {
        if (ownIds.has(p.id)) continue;
        if (ci >= 0 && p.club !== ci) continue;
        if (pos && p.pos !== pos) continue;
        if (maxAge && (p.age ?? 99) > maxAge) continue;
        const free = isFreeAgent(p, CUTOFF);
        if (afford && !free && (p.value ?? 0) > Math.max(0, balance)) continue;
        if (onlyFree && !free) continue;
        if (onlyWatch && !watch.has(`${lg.id}:${p.id}`)) continue;
        if (nq && !norm(`${p.name} ${lg.clubs[p.club]?.name ?? ""}`).includes(nq)) continue;
        out.push({ p, lg });
      }
    }
    const by: Record<MarketSort, (a: MarketPlayer, b: MarketPlayer) => number> = {
      value: (a, b) => (b.value ?? 0) - (a.value ?? 0),
      cheap: (a, b) => (a.value ?? 0) - (b.value ?? 0),
      young: (a, b) => (a.age ?? 99) - (b.age ?? 99) || (b.value ?? 0) - (a.value ?? 0),
      contract: (a, b) => (a.contract ?? "9999").localeCompare(b.contract ?? "9999"),
    };
    return out.sort((a, b) => by[sort](a.p, b.p));
  }, [loaded, q, clubKey, pos, maxAge, afford, onlyFree, onlyWatch, watch, ownIds, balance, sort]);

  const signed = new Map(st.signings.map((s) => [s.id, s]));
  const sign = (p: MarketPlayer, league: string, type: SigningType) =>
    setSt((s) => ({ ...s, signings: [...s.signings.filter((x) => x.id !== p.id), { id: p.id, league, type, price: type === "buy" ? p.value ?? 0 : 0 }] }));
  const unsign = (id: string) => setSt((s) => ({ ...s, signings: s.signings.filter((x) => x.id !== id) }));
  const toggleWatch = (k: string) => setSt((s) => ({ ...s, watch: s.watch.includes(k) ? s.watch.filter((x) => x !== k) : [...s.watch, k] }));
  const short = depth.filter((d) => d.short);
  const clearFilters = () => (setClubKey(""), setPos(null), setMaxAge(0), setAfford(false), setOnlyFree(false), setOnlyWatch(false));

  const leagueSel = (
    <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} aria-label="Liga">
      <option value="ALL">Todas as ligas</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {MARKET_INDEX.leagues.filter((l) => l.group === g).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
  const clubSel = (
    <select value={clubKey} onChange={(e) => (setClubKey(e.target.value), setLimit(40))} aria-label="Clube" disabled={!loaded.length}>
      <option value="">Todos os clubes</option>
      {loaded.length === 1
        ? loaded[0].clubs
            .map((c, i) => ({ c, i }))
            .sort((a, b) => a.c.name.localeCompare(b.c.name, "pt-BR"))
            .map(({ c, i }) => <option key={c.id} value={`${loaded[0].id}:${i}`}>{c.name}</option>)
        : loaded.map((lg) => (
            <optgroup key={lg.id} label={lg.name}>
              {lg.clubs
                .map((c, i) => ({ c, i }))
                .sort((a, b) => a.c.name.localeCompare(b.c.name, "pt-BR"))
                .map(({ c, i }) => <option key={c.id} value={`${lg.id}:${i}`}>{c.name}</option>)}
            </optgroup>
          ))}
    </select>
  );
  const searchInput = <input type="search" placeholder="Buscar jogador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar jogador ou clube" />;
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
      <button className={`tm-toggle ${onlyWatch ? "is-on" : ""}`} aria-pressed={onlyWatch} onClick={() => setOnlyWatch(!onlyWatch)}>★ Observados ({st.watch.length})</button>
    </>
  );
  const posFilter = (
    <span className="tm-posfilter" role="group" aria-label="Posição">
      {POSITIONS.map((p) => (
        <button key={p} className={`tm-pos tm-pos--${p} ${pos === p ? "is-on" : pos ? "is-dim" : ""}`} aria-pressed={pos === p} onClick={() => setPos(pos === p ? null : p)}>{p}</button>
      ))}
    </span>
  );
  const active = [clubKey, pos, maxAge, afford, onlyFree, onlyWatch].filter(Boolean).length;

  return (
    <section>
      {short.length > 0 && (
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
        <div className="tm-mfilters">
          {searchInput}
          {leagueSel}
          <button className={`tm-iconbtn ${active ? "is-on" : ""}`} onClick={() => setSheet(true)} aria-label={`Filtros${active ? `, ${active} ativos` : ""}`}>
            <Ico d={ICON.filter} size={20} />
            {active > 0 && <i>{active}</i>}
          </button>
        </div>
      ) : (
        <>
          <div className="tm-filters">
            {leagueSel}
            {clubSel}
            {searchInput}
            {ageSel}
            <select value={sort} onChange={(e) => setSort(e.target.value as MarketSort)} aria-label="Ordenar">
              {MARKET_SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="tm-toggles">
            {toggles}
            {posFilter}
          </div>
        </>
      )}
      {isMobile && sheet && (
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
            <div>Posição{posFilter}</div>
            <label>Idade{ageSel}</label>
            <div>Mostrar só<span className="tm-fsheet__toggles">{toggles}</span></div>
            <div>
              Ordenar
              <span className="tm-radios" role="radiogroup" aria-label="Ordenar">
                {MARKET_SORTS.map(([k, label]) => (
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
      <p className="tm-count">{loading ? "Carregando a liga…" : `${results.length.toLocaleString("pt-BR")} jogadores`}</p>
      <div className="tm-fichas tm-fichas--market">
        {results.slice(0, limit).map(({ p, lg }) => {
          const s = signed.get(p.id);
          const free = isFreeAgent(p, CUTOFF);
          const wk = `${lg.id}:${p.id}`;
          const over = !free && (p.value ?? 0) > balance;
          return (
            <article key={wk} className={`tm-ficha ${s ? "is-signed" : ""}`}>
              <Photo name={p.name} photo={p.photo} />
              <div className="tm-ficha__main">
                <p className="tm-ficha__name">{p.name}<span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span><Foreign on={p.foreign} /></p>
                <p className="tm-ficha__meta">{p.age != null ? `${p.age} anos` : "Idade não informada"}{p.nat ? ` · ${p.nat}` : ""} · {lg.clubs[p.club]?.name}</p>
                <p className="tm-ficha__origin">
                  {lg.name} · <span className={free ? "is-free" : ""}>contrato até {fmtDate(p.contract)}{free ? " (chega livre)" : ""}</span>
                  {p.loanFrom ? ` · emprestado pelo ${p.loanFrom}` : ""}
                </p>
              </div>
              <p className="tm-ficha__value">{fmtEur(p.value)}<small>{fmtRef(p.value)}</small></p>
              <div className="tm-ficha__actions">
                {s ? (
                  <>
                    {s.type === "buy" && <Price label="Por" value={s.price} onChange={(v) => setSt((x) => ({ ...x, signings: x.signings.map((y) => (y.id === p.id ? { ...y, price: v } : y)) }))} />}
                    <button className="tm-act" onClick={() => unsign(p.id)}>Desistir</button>
                  </>
                ) : (
                  <>
                    <button className="tm-act tm-act--green" onClick={() => sign(p, lg.id, "buy")} title={over ? "Estoura o saldo atual" : undefined}>Comprar{over ? " ⚠" : ""}</button>
                    <button className="tm-act tm-act--blue" onClick={() => sign(p, lg.id, "loan")}>Empréstimo</button>
                    {free && <button className="tm-act tm-act--green" onClick={() => sign(p, lg.id, "free")}>Trazer livre</button>}
                  </>
                )}
                <button className={`tm-star ${watch.has(wk) ? "is-on" : ""}`} aria-pressed={watch.has(wk)} aria-label={watch.has(wk) ? "Tirar dos observados" : "Observar"} onClick={() => toggleWatch(wk)}>★</button>
              </div>
              {s && <Stamp key={s.type} text={SIGN_STAMP[s.type]} ink={s.type === "loan" ? "blue" : "green"} onClick={() => unsign(p.id)} title="Desistir da contratação" />}
            </article>
          );
        })}
        {!loading && !results.length && (
          <p className="tm-empty">
            Nenhum jogador com esses filtros.{" "}
            <button className="tm-link" onClick={() => (setQ(""), clearFilters())}>Limpar filtros</button>
          </p>
        )}
      </div>
      {results.length > limit && <button className="tm-btn tm-more" onClick={() => setLimit((l) => l + 40)}>Mostrar mais 40</button>}
    </section>
  );
}

// ============ fechamento ============

type CloseView = "squad" | "market" | "contracts" | "age";
const CLOSE_VIEWS: [CloseView, string, string][] = [["squad", "Quem sai, fica e chega", "Elenco"], ["market", "Resumo do mercado", "Mercado"], ["contracts", "Contratos", "Contratos"], ["age", "Idade × valor", "Idade × valor"]];

function CloseTab({ sum, setSt, arrivals, next, depth, squad, onShare, onReset }: {
  sum: ReturnType<typeof summarize>; st: MarketState; setSt: SetSt;
  arrivals: { s: MarketState["signings"][number]; p: MarketPlayer; club: string; league: string }[];
  next: ReturnType<typeof nextSeason>; depth: ReturnType<typeof depthChart>; steps: ReturnType<typeof waterfall>; squad: SquadPlayer[];
  onShare: () => void; onReset: () => void;
}) {
  const [view, setView] = useState<CloseView>("squad");
  const before = squad.filter((p) => p.status !== "loanOut");
  const foreigners = next.filter((x) => x.kind !== "leave" && x.foreign).length;
  const arrivalsByPos = [...arrivals].sort((a, b) => posRank(a.p.pos) - posRank(b.p.pos) || (b.p.value ?? 0) - (a.p.value ?? 0));
  const leavesByPos = [...sum.leaves].sort((a, b) => posRank(a.p.pos) - posRank(b.p.pos) || (b.p.value ?? 0) - (a.p.value ?? 0));
  const valueBefore = before.reduce((a, p) => a + (p.value ?? 0), 0);
  const delta = sum.squadValue - valueBefore;
  const short = depth.filter((d) => d.short);
  const verdict =
    sum.balance < 0 ? `O saldo fechou negativo em ${fmtMoney(-sum.balance)}. Venda alguém ou desista de uma contratação.`
    : sum.pending.length ? `Faltam ${sum.pending.length} decisões de contrato para a janela ficar redonda.`
    : short.length ? `Contas em dia, mas o elenco está curto em ${short.map((d) => d.pos).join(", ")}.`
    : "Janela fechada: contas em dia e elenco completo.";
  return (
    <section className="tm-close">
      <div className={`tm-verdict ${sum.balance < 0 ? "is-bad" : sum.pending.length || short.length ? "is-warn" : "is-ok"}`}>
        <p>{verdict}</p>
        <div>
          <button className="tm-btn tm-btn--brass" onClick={onShare}>Copiar resumo da janela</button>
          <button className="tm-btn tm-btn--ghost" onClick={onReset}>Recomeçar</button>
        </div>
      </div>

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

      {view === "squad" && <div className="tm-ctab-body"><Roster next={next} big /></div>}
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
      {view === "market" && (
      <div className="tm-grid tm-ctab-body">
        <div className="tm-list">
          <h3>Chegam <span>{arrivals.length}</span></h3>
          {!arrivals.length && <p className="tm-muted">Nenhuma contratação. O mercado está na etapa 2.</p>}
          {arrivalsByPos.map((a) => (
            <p key={a.s.id}>
              <span className={`tm-pos tm-pos--${a.p.pos}`}>{a.p.pos}</span>
              <b>{a.p.name}</b><i>{a.club}</i>
              <span className="tm-list__end">{a.s.type === "buy" ? fmtMoney(a.s.price) : SIGNING_LABEL[a.s.type]}
                <button aria-label={`Desistir de ${a.p.name}`} onClick={() => setSt((x) => ({ ...x, signings: x.signings.filter((y) => y.id !== a.s.id) }))}>×</button>
              </span>
            </p>
          ))}
        </div>
        <div className="tm-list">
          <h3>Saem <span>{sum.leaves.length}</span></h3>
          {!sum.leaves.length && <p className="tm-muted">Ninguém saindo. As decisões ficam na etapa 1.</p>}
          {leavesByPos.map(({ p, d }) => {
            const m = moneyOf(p, d);
            return (
              <p key={p.id}>
                <span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span>
                <b>{p.name}</b><i>{ACTION_LABEL[d.action].toLowerCase()}</i>
                <span className="tm-list__end">{m ? `+${fmtMoney(m)}` : "sem custo"}</span>
              </p>
            );
          })}
        </div>
      </div>
      )}
    </section>
  );
}
