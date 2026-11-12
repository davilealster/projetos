import { useEffect, useMemo, useState } from "react";
import "@fontsource/big-shoulders-display/latin-700";
import "@fontsource/big-shoulders-display/latin-900";
import "@fontsource/big-shoulders-stencil-display/latin-800";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/dm-mono/latin-400";
import "@fontsource/dm-mono/latin-500";
import "./market.css";
import { TEAMS, teamSummary } from "../data";
import { navigate } from "../router";
import { clubVars, initials } from "../lib/color";
import { applyTeamSummary, useOverrides } from "../lib/overrides";
import { POSITIONS, type Pos } from "../types";
import { AgeValue, ContractYears, Depth, Legend, Waterfall } from "./Charts";
import { MARKET_INDEX, hasMarketData, loadClubMarket, loadLeague, loadMarketState, saveMarketState } from "./data";
import {
  ACTION_LABEL, PRICED, SIGNING_LABEL, actionsFor, contractYears, decisionOf, depthChart, emptyMarketState, fmtBrl, fmtDate,
  FOREIGN_LIMIT, fmtEur, isEnding, isFreeAgent, moneyOf, nextSeason, posRank, shareText, staysWith, summarize, waterfall,
  type Decision, type MarketState, type SigningType, type SquadAction,
} from "./logic";
import type { ClubMarket, MarketLeague, MarketPlayer, SquadPlayer } from "./types";

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

// ============ rota ============

export default function MarketApp({ slug }: { slug: string | null }) {
  useEffect(() => {
    document.title = "Mercado da bola · Prancheta Brasileirão";
    document.documentElement.classList.add("is-market");
    return () => document.documentElement.classList.remove("is-market");
  }, []);
  if (!slug) return <MarketHome />;
  if (!teamSummary(slug)) {
    return (
      <div className="tm tm-center">
        <p>Esse clube não está na Série A {Number(SEASON) - 1}.</p>
        <a className="tm-btn" href="/mercado" onClick={go("/mercado")}>Escolher outro clube</a>
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

// ============ home ============

function Stamp({ text, ink, onClick, title }: { text: string; ink: "green" | "red" | "blue" | "amber"; onClick?: () => void; title?: string }) {
  const cls = `tm-stamp tm-stamp--${ink}`;
  return onClick ? (
    <button className={cls} onClick={onClick} title={title}>{text}</button>
  ) : (
    <span className={cls}>{text}</span>
  );
}

function MarketHome() {
  const doc = useOverrides();
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const teams = TEAMS.map((t) => applyTeamSummary(t, doc)).filter((t) => norm(t.name + t.shortName).includes(norm(q.trim())));
  const total = MARKET_INDEX.leagues.reduce((a, l) => a + l.players, 0);
  return (
    <div className="tm tm-home">
      <nav className="tm-nav">
        <a href="/" onClick={go("/")}>← Prancheta tática</a>
        {MARKET_INDEX.collectedAt && <span>Dados de {new Date(`${MARKET_INDEX.collectedAt}T12:00:00`).toLocaleDateString("pt-BR")}</span>}
      </nav>
      <header className="tm-hero">
        <div className="tm-hero__text">
          <p className="tm-eyebrow">Janela de transferências {SEASON}</p>
          <h1>Quem fica.<br />Quem sai.<br /><em>Quem chega.</em></h1>
          <p className="tm-hero__lead">
            Sente na cadeira do dirigente: defina o orçamento, carimbe o destino de cada jogador do seu elenco e vá às compras
            em {MARKET_INDEX.leagues.length || 23} ligas{total ? `, com ${total.toLocaleString("pt-BR")} jogadores` : ""}.
          </p>
          <a className="tm-btn tm-btn--brass" href="#clubes">Escolher meu clube</a>
        </div>
        {/* a ficha sendo carimbada: o gesto central do módulo */}
        <div className="tm-hero__demo" aria-hidden="true">
          <div className="tm-ficha tm-ficha--demo">
            <span className="tm-ficha__photo tm-ficha__photo--ini">10</span>
            <div className="tm-ficha__main">
              <p className="tm-ficha__name">Seu camisa 10 <span className="tm-pos tm-pos--MEI">MEI</span></p>
              <p className="tm-ficha__meta">27 anos · contrato até 12/{Number(SEASON) - 1}</p>
              <p className="tm-ficha__value">€ 8,5 mi</p>
            </div>
            <span className="tm-stamp tm-stamp--green tm-demo-stamp tm-demo-stamp--1">Renovado</span>
            <span className="tm-stamp tm-stamp--red tm-demo-stamp tm-demo-stamp--2">Vendido</span>
            <span className="tm-stamp tm-stamp--blue tm-demo-stamp tm-demo-stamp--3">Emprestado</span>
          </div>
        </div>
      </header>

      {!hasMarketData && <NoData />}

      <section id="clubes" className="tm-pick">
        <div className="tm-pick__head">
          <h2>De qual clube você é o dirigente?</h2>
          <input type="search" placeholder="Buscar clube" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clube" />
        </div>
        <ul className="tm-clubs">
          {teams.map((t) => (
            <li key={t.slug}>
              <a href={`/mercado/${t.slug}`} onClick={go(`/mercado/${t.slug}`)} style={clubVars(t.colors) as React.CSSProperties}>
                {t.crest && <img src={t.crest} alt="" width={56} height={56} loading="lazy" />}
                <span>{t.shortName}</span>
              </a>
            </li>
          ))}
          {!teams.length && <li className="tm-muted">Nenhum clube com “{q}”.</li>}
        </ul>
      </section>
      <footer className="tm-foot">
        Projeto independente, sem vínculo com CBF ou clubes. Valores de mercado e contratos: Transfermarkt. Imagens pertencem aos respectivos detentores.
      </footer>
    </div>
  );
}

// ============ clube ============

type Tab = "squad" | "market" | "close";

function MarketClub({ slug }: { slug: string }) {
  const doc = useOverrides();
  const team = applyTeamSummary(teamSummary(slug)!, doc);
  const [club, setClub] = useState<ClubMarket | null | undefined>(undefined);
  const [st, setSt] = useState<MarketState>(() => loadMarketState(slug));
  const [tab, setTab] = useState<Tab>("squad");
  const [leagues, setLeagues] = useState<Record<string, MarketLeague>>({});
  const [guide, setGuide] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
  ];

  const rail = (
    <Ledger st={st} setSt={setSt} sum={sum} steps={steps} depth={depth} foreigners={foreigners} onNext={tab === "close" ? null : () => (setTab(tab === "squad" ? "market" : "close"), setSheet(false), window.scrollTo({ top: 0 }))} nextLabel={tab === "squad" ? "Ir às compras" : "Fechar a janela"} />
  );

  return (
    <div className="tm tm-club" style={clubVars(team.colors) as React.CSSProperties}>
      <header className="tm-top">
        <a className="tm-top__back" href="/mercado" onClick={go("/mercado")} aria-label="Trocar de clube">←</a>
        {team.crest && <img src={team.crest} alt="" width={44} height={44} />}
        <div className="tm-top__title">
          <h1>{team.shortName}</h1>
          <p>Janela {SEASON}</p>
        </div>
        <button className="tm-btn tm-btn--ghost" onClick={() => setGuide(true)}>Como funciona</button>
        <a className="tm-btn tm-btn--ghost tm-hide-s" href={`/${slug}`} onClick={go(`/${slug}`)}>Prancheta</a>
      </header>

      {/* as três etapas são uma sequência real: decidir o elenco, comprar, fechar */}
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

      {club === undefined ? (
        <p className="tm-center">Abrindo a pasta do clube…</p>
      ) : !ready ? (
        <NoData />
      ) : (
        <div className="tm-layout">
          <main className="tm-main">
            {tab === "squad" && <SquadTab squad={squad} st={st} setSt={setSt} setDecision={setDecision} colors={team.colors} />}
            {tab === "market" && (
              <MarketTab st={st} setSt={setSt} balance={sum.balance} ownIds={new Set(squad.map((p) => p.id))} depth={depth} onLeague={(l) => setLeagues((x) => ({ ...x, [l.id]: l }))} />
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
                    setSt({ ...emptyMarketState(), onboarded: true, rate: st.rate });
                    setTab("squad");
                  }
                }}
              />
            )}
          </main>
          <aside className="tm-rail">{rail}</aside>
        </div>
      )}

      {/* celular: saldo fixo embaixo; toque abre o balancete */}
      {ready && (
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
          st={st}
          setSt={setSt}
          pending={sum.pending.length}
          loans={squad.filter((p) => p.status !== "owned").length}
          onDone={() => (setSt((s) => ({ ...s, onboarded: true })), setGuide(false))}
        />
      )}
      {toast && <div className="tm-toast">{toast}</div>}
    </div>
  );
}

// ============ passo a passo ============

const BUDGET_OPTIONS: [number, string, string][] = [
  [5, "Cinto apertado", "Vender antes de comprar"],
  [20, "Janela realista", "Dois ou três reforços"],
  [80, "Cofre aberto", "Dá para sonhar alto"],
];

function Guide({ team, st, setSt, pending, loans, onDone }: {
  team: string; st: MarketState; setSt: SetSt; pending: number; loans: number; onDone: () => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onDone]);
  return (
    <div className="tm-modal" role="dialog" aria-modal="true" aria-label="Como funciona a janela">
      <div className="tm-guide">
        <div className="tm-guide__dots" aria-hidden="true">{[0, 1, 2].map((n) => <i key={n} className={n === i ? "is-on" : ""} />)}</div>
        {i === 0 && (
          <>
            <p className="tm-eyebrow">Passo 1 de 3</p>
            <h2>Quanto a diretoria do {team} liberou?</h2>
            <div className="tm-guide__opts">
              {BUDGET_OPTIONS.map(([v, title, sub]) => (
                <button key={v} className={`tm-opt ${st.budget === v * 1e6 ? "is-on" : ""}`} onClick={() => setSt((s) => ({ ...s, budget: v * 1e6 }))}>
                  <b>€ {v} mi</b>
                  <span>{title}</span>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
            <label className="tm-field">
              Outro valor
              <input type="number" min={0} value={st.budget / 1e6} onChange={(e) => setSt((s) => ({ ...s, budget: Math.max(0, Number(e.target.value) || 0) * 1e6 }))} />
              <span>€ mi ({fmtBrl(st.budget, st.rate)})</span>
            </label>
            <label className="tm-check">
              <input type="checkbox" checked={st.useSales} onChange={(e) => setSt((s) => ({ ...s, useSales: e.target.checked }))} />
              O dinheiro das vendas volta para o orçamento
            </label>
          </>
        )}
        {i === 1 && (
          <>
            <p className="tm-eyebrow">Passo 2 de 3</p>
            <h2>Carimbe o destino de cada jogador</h2>
            <p>
              Cada jogador é uma ficha com valor de mercado, contrato e origem. Escolha se ele fica, renova, é vendido,
              emprestado ou dispensado. Clicar no carimbo desfaz.
            </p>
            <ul className="tm-guide__list">
              <li><Stamp text="A decidir" ink="amber" /> {pending ? <><b>{pending}</b> contratos ou empréstimos do {team} acabam antes de {SEASON}. Comece por eles.</> : <>Nenhum contrato do {team} acaba antes de {SEASON}.</>}</li>
              {loans > 0 && <li><Stamp text="Emprestado" ink="blue" /> <b>{loans}</b> jogadores estão emprestados (chegando ou fora). Dá para devolver, comprar ou trazer de volta.</li>}
              <li><Stamp text="Vendido" ink="red" /> Vendas entram no balancete na hora, pelo valor de mercado ou pelo preço que você digitar.</li>
            </ul>
          </>
        )}
        {i === 2 && (
          <>
            <p className="tm-eyebrow">Passo 3 de 3</p>
            <h2>Vá às compras e feche a janela</h2>
            <p>
              No <b>Mercado</b>, filtre por liga, posição, idade e preço. “Cabe no saldo” mostra só quem você pode pagar, e
              a estrela guarda um jogador para decidir depois. Quem está em fim de contrato pode chegar de graça.
            </p>
            <p>
              O <b>balancete</b> acompanha tudo: saldo, e quantos jogadores você tem em cada posição. No
              <b> Fechamento</b>, veja os gráficos do elenco {SEASON} e copie o resumo para mandar no grupo.
            </p>
          </>
        )}
        <div className="tm-guide__nav">
          {i > 0 ? <button className="tm-btn tm-btn--ghost" onClick={() => setI(i - 1)}>Voltar</button> : <button className="tm-btn tm-btn--ghost" onClick={onDone}>Pular</button>}
          {i < 2 ? <button className="tm-btn tm-btn--brass" onClick={() => setI(i + 1)}>Continuar</button> : <button className="tm-btn tm-btn--brass" onClick={onDone}>Abrir a janela</button>}
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

function Ledger({ st, setSt, sum, steps, depth, foreigners, onNext, nextLabel }: {
  st: MarketState; setSt: SetSt; sum: ReturnType<typeof summarize>; steps: ReturnType<typeof waterfall>; depth: ReturnType<typeof depthChart>; foreigners: number;
  onNext: (() => void) | null; nextLabel: string;
}) {
  const short = depth.filter((d) => d.short);
  return (
    <div className="tm-ledger">
      <p className="tm-eyebrow">Balancete</p>
      <p className={`tm-ledger__bal ${sum.balance < 0 ? "is-neg" : ""}`}>
        {fmtEur(sum.balance)}
        <small>{fmtBrl(sum.balance, st.rate)} de saldo</small>
      </p>
      <Waterfall steps={steps} compact />
      <div className="tm-ledger__budget">
        <label className="tm-field">
          Orçamento
          <input type="number" min={0} value={st.budget / 1e6} onChange={(e) => setSt((s) => ({ ...s, budget: Math.max(0, Number(e.target.value) || 0) * 1e6 }))} />
          <span>€ mi</span>
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
  if (a.type === "loan") return `Empréstimo do ${a.from ?? "?"}${a.fee ? `, taxa de ${fmtEur(a.fee)}` : ""}`;
  if (a.type === "transfer") return `Comprado do ${a.from ?? "?"}${a.fee ? ` por ${fmtEur(a.fee)}` : ""}${year}`;
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
      {label} €
      <input type="number" min={0} step={0.1} value={Math.round((value / 1e6) * 10) / 10} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 1e6)} />
      mi
    </label>
  );
}

type SquadFilter = "all" | "pending" | "loans" | "leaving" | "foreign";
type SquadSort = "pos" | "value" | "contract" | "age";

function SquadTab({ squad, st, setSt, setDecision, colors }: {
  squad: SquadPlayer[]; st: MarketState; setSt: SetSt; setDecision: (id: string, d: Decision | null) => void;
  colors: { primary: string; secondary: string };
}) {
  const [filter, setFilter] = useState<SquadFilter>("all");
  const [sort, setSort] = useState<SquadSort>("pos");
  const pending = squad.filter((p) => isEnding(p, CUTOFF) && !st.decisions[p.id]);
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
  const filters: [SquadFilter, string][] = [
    ["all", `Todos ${squad.length}`],
    ["pending", `Terminando ${squad.filter((p) => isEnding(p, CUTOFF)).length}`],
    ["loans", `Empréstimos ${squad.filter((p) => p.status !== "owned").length}`],
    ["leaving", "Saindo"],
    ["foreign", `Estrangeiros ${squad.filter((p) => p.foreign && p.status !== "loanOut").length}`],
  ];
  return (
    <section>
      <div className="tm-bar">
        <div className="tm-seg" role="group" aria-label="Filtrar elenco">
          {filters.map(([f, label]) => (
            <button key={f} className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        <label className="tm-select">
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as SquadSort)}>
            <option value="pos">por posição</option>
            <option value="value">por valor</option>
            <option value="contract">por fim de contrato</option>
            <option value="age">por idade</option>
          </select>
        </label>
      </div>
      {pending.length > 0 && (
        <div className="tm-callout">
          <p><b>{pending.length} {pending.length > 1 ? "vínculos acabam" : "vínculo acaba"} antes de {SEASON}</b> e ainda não têm decisão.</p>
          <button className="tm-btn tm-btn--ghost" onClick={() => setFilter("pending")}>Ver só esses</button>
          <button
            className="tm-btn"
            title="Renova quem é do clube, devolve quem chegou emprestado e traz de volta quem está fora"
            onClick={() => setSt((s) => ({ ...s, decisions: { ...s.decisions, ...Object.fromEntries(pending.map((p) => [p.id, { action: actionsFor(p, CUTOFF).def }])) } }))}
          >
            Aplicar o padrão a todos
          </button>
        </div>
      )}
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
              <p className="tm-ficha__value">{fmtEur(p.value)}<small>{fmtBrl(p.value, st.rate)}</small></p>
              <div className="tm-ficha__actions" role="group" aria-label={`Destino de ${p.name}`}>
                {options.map((a) => (
                  <button key={a} className={`tm-act tm-act--${STAMP[a][1]} ${explicit && d.action === a ? "is-on" : ""}`} aria-pressed={explicit && d.action === a} onClick={() => setDecision(p.id, { action: a })}>
                    {ACTION_LABEL[a]}
                  </button>
                ))}
                {explicit && PRICED.includes(d.action) && (
                  <span className="tm-ficha__price">
                    <Price label={d.action === "loanOut" ? "Taxa" : d.action === "sell" ? "Por" : "Custo"} value={d.price ?? (d.action === "loanOut" ? 0 : p.value ?? 0)} onChange={(v) => setDecision(p.id, { ...d, price: v })} />
                    <b className={money >= 0 ? "is-in" : "is-out"}>{money > 0 ? "+" : ""}{fmtEur(money)}</b>
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

function MarketTab({ st, setSt, balance, ownIds, depth, onLeague }: {
  st: MarketState; setSt: SetSt; balance: number; ownIds: Set<string>; depth: ReturnType<typeof depthChart>; onLeague: (l: MarketLeague) => void;
}) {
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
      <div className="tm-filters">
        <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} aria-label="Liga">
          <option value="ALL">Todas as ligas</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {MARKET_INDEX.leagues.filter((l) => l.group === g).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </optgroup>
          ))}
        </select>
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
        <input type="search" placeholder="Buscar jogador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar jogador ou clube" />
        <select value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} aria-label="Idade máxima">
          <option value={0}>Qualquer idade</option>
          {[21, 23, 25, 28, 31].map((a) => <option key={a} value={a}>até {a} anos</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as MarketSort)} aria-label="Ordenar">
          <option value="value">Mais valiosos</option>
          <option value="cheap">Mais baratos</option>
          <option value="young">Mais jovens</option>
          <option value="contract">Contrato acaba antes</option>
        </select>
      </div>
      <div className="tm-toggles">
        <button className={`tm-toggle ${afford ? "is-on" : ""}`} aria-pressed={afford} onClick={() => setAfford(!afford)}>Cabe no saldo ({fmtEur(Math.max(0, balance))})</button>
        <button className={`tm-toggle ${onlyFree ? "is-on" : ""}`} aria-pressed={onlyFree} onClick={() => setOnlyFree(!onlyFree)}>Fim de contrato (chega livre)</button>
        <button className={`tm-toggle ${onlyWatch ? "is-on" : ""}`} aria-pressed={onlyWatch} onClick={() => setOnlyWatch(!onlyWatch)}>★ Observados ({st.watch.length})</button>
        <span className="tm-posfilter" role="group" aria-label="Posição">
          {POSITIONS.map((p) => (
            <button key={p} className={`tm-pos tm-pos--${p} ${pos === p ? "is-on" : pos ? "is-dim" : ""}`} aria-pressed={pos === p} onClick={() => setPos(pos === p ? null : p)}>{p}</button>
          ))}
        </span>
      </div>
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
              <p className="tm-ficha__value">{fmtEur(p.value)}<small>{fmtBrl(p.value, st.rate)}</small></p>
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
            <button className="tm-link" onClick={() => (setQ(""), setClubKey(""), setPos(null), setMaxAge(0), setAfford(false), setOnlyFree(false), setOnlyWatch(false))}>Limpar filtros</button>
          </p>
        )}
      </div>
      {results.length > limit && <button className="tm-btn tm-more" onClick={() => setLimit((l) => l + 40)}>Mostrar mais 40</button>}
    </section>
  );
}

// ============ fechamento ============

function CloseTab({ sum, st, setSt, arrivals, next, depth, steps, squad, onShare, onReset }: {
  sum: ReturnType<typeof summarize>; st: MarketState; setSt: SetSt;
  arrivals: { s: MarketState["signings"][number]; p: MarketPlayer; club: string; league: string }[];
  next: ReturnType<typeof nextSeason>; depth: ReturnType<typeof depthChart>; steps: ReturnType<typeof waterfall>; squad: SquadPlayer[];
  onShare: () => void; onReset: () => void;
}) {
  const before = squad.filter((p) => p.status !== "loanOut");
  const foreigners = next.filter((x) => x.kind !== "leave" && x.foreign).length;
  const arrivalsByPos = [...arrivals].sort((a, b) => posRank(a.p.pos) - posRank(b.p.pos) || (b.p.value ?? 0) - (a.p.value ?? 0));
  const leavesByPos = [...sum.leaves].sort((a, b) => posRank(a.p.pos) - posRank(b.p.pos) || (b.p.value ?? 0) - (a.p.value ?? 0));
  const valueBefore = before.reduce((a, p) => a + (p.value ?? 0), 0);
  const delta = sum.squadValue - valueBefore;
  const short = depth.filter((d) => d.short);
  const verdict =
    sum.balance < 0 ? `O saldo fechou negativo em ${fmtEur(-sum.balance)}. Venda alguém ou desista de uma contratação.`
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
        <div><span>Valor do elenco</span><b>{fmtEur(sum.squadValue)}</b><small>{delta >= 0 ? "+" : "– "}{fmtEur(Math.abs(delta))} na janela · {fmtBrl(sum.squadValue, st.rate)}</small></div>
        <div><span>Idade média</span><b>{sum.avgAge ? sum.avgAge.toFixed(1).replace(".", ",") : "—"}</b><small>anos</small></div>
        <div className={foreigners > FOREIGN_LIMIT ? "is-over" : ""}>
          <span>Estrangeiros</span><b>{foreigners}</b>
          <small>{foreigners > FOREIGN_LIMIT ? `${foreigners - FOREIGN_LIMIT} a mais que os ${FOREIGN_LIMIT} relacionáveis por jogo` : `até ${FOREIGN_LIMIT} relacionados por jogo`}</small>
        </div>
      </div>

      <div className="tm-grid">
        <figure className="tm-chart">
          <figcaption><b>Para onde foi o dinheiro</b><span>Orçamento, vendas e gastos até o saldo</span></figcaption>
          <Waterfall steps={steps} />
        </figure>
        <figure className="tm-chart">
          <figcaption><b>Profundidade por posição</b><span>Um ponto por jogador; o traço marca o mínimo recomendado</span></figcaption>
          <Depth rows={depth} />
          <Legend items={["stay", "new", "leave", "min"]} />
        </figure>
        <figure className="tm-chart">
          <figcaption><b>Quando acabam os contratos</b><span>Elenco {SEASON}, por ano de fim do vínculo</span></figcaption>
          <ContractYears data={contractYears(next)} />
        </figure>
        <figure className="tm-chart">
          <figcaption><b>Idade e valor de mercado</b><span>À direita e no alto: veteranos caros, bons de vender</span></figcaption>
          <AgeValue list={next} />
          <Legend items={["stay", "new", "leave"]} />
        </figure>
      </div>

      <div className="tm-grid">
        <div className="tm-list">
          <h3>Chegam <span>{arrivals.length}</span></h3>
          {!arrivals.length && <p className="tm-muted">Nenhuma contratação. O mercado está na etapa 2.</p>}
          {arrivalsByPos.map((a) => (
            <p key={a.s.id}>
              <span className={`tm-pos tm-pos--${a.p.pos}`}>{a.p.pos}</span>
              <b>{a.p.name}</b><i>{a.club}</i>
              <span className="tm-list__end">{a.s.type === "buy" ? fmtEur(a.s.price) : SIGNING_LABEL[a.s.type]}
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
                <span className="tm-list__end">{m ? `+${fmtEur(m)}` : "sem custo"}</span>
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
