import { useEffect, useMemo, useState } from "react";
import { TEAMS, teamSummary } from "../data";
import { navigate } from "../router";
import { clubVars, initials } from "../lib/color";
import { applyTeamSummary, useOverrides } from "../lib/overrides";
import { POSITIONS, type Pos } from "../types";
import { Footer } from "../components/Footer";
import { MARKET_INDEX, hasMarketData, loadClubMarket, loadLeague, loadMarketState, saveMarketState } from "./data";
import {
  ACTION_LABEL, PRICED, SIGNING_LABEL, actionsFor, decisionOf, fmtBrl, fmtDate, fmtEur, isEnding, isFreeAgent, moneyOf,
  staysWith, summarize, type Decision, type MarketState, type SigningType, type SquadAction,
} from "./logic";
import type { ClubMarket, MarketLeague, MarketPlayer, SquadPlayer } from "./types";

const CUTOFF = MARKET_INDEX.nextSeasonStart;
const SEASON = CUTOFF.slice(0, 4);
const BUDGETS = [5, 10, 20, 40, 80, 150]; // € mi

// ============ rota ============

export default function MarketApp({ slug }: { slug: string | null }) {
  useEffect(() => {
    document.title = "Mercado da bola · Prancheta Brasileirão";
  }, []);
  if (!slug) return <MarketHome />;
  if (!teamSummary(slug)) {
    return (
      <div className="notfound">
        <p>Clube não encontrado.</p>
        <a href="/mercado" onClick={(e) => (e.preventDefault(), navigate("/mercado"))}>Ver os clubes</a>
      </div>
    );
  }
  return <MarketClub key={slug} slug={slug} />;
}

function NoData() {
  return (
    <div className="mk-empty">
      <h2>Dados do mercado ainda não coletados</h2>
      <p>
        Valores de mercado, contratos e empréstimos vêm do Transfermarkt, por um coletor que roda fora do site. Enquanto
        a primeira coleta não for feita, o mercado fica vazio.
      </p>
      <ol>
        <li>Instale o Python 3.12+ e rode <code>pip install "transfermarkt-api==5.*"</code></li>
        <li>Na pasta do projeto: <code>python scripts/market/collect_transfermarkt.py</code></li>
        <li>Depois: <code>npm run build:market</code> e publique</li>
      </ol>
      <p>Ou ligue a coleta semanal automática (GitHub Action "Mercado"). Detalhes no README.</p>
    </div>
  );
}

function MarketHome() {
  const doc = useOverrides();
  return (
    <div className="home mk-home">
      <a className="back" href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>← Prancheta</a>
      <header className="home__hero">
        <p className="home__kicker">Janela de transferências · temporada {SEASON}</p>
        <h1 className="home__title">Mercado <span>da bola</span></h1>
        <p className="home__lead">
          Escolha o clube, defina o orçamento, decida quem fica e quem sai e vá às compras nos principais mercados do mundo.
        </p>
      </header>
      {!hasMarketData && <NoData />}
      <ul className="crest-grid">
        {TEAMS.map((t0) => {
          const t = applyTeamSummary(t0, doc);
          return (
            <li key={t.slug}>
              <a
                href={`/mercado/${t.slug}`}
                className="crest-card"
                style={clubVars(t.colors) as React.CSSProperties}
                onClick={(e) => (e.preventDefault(), navigate(`/mercado/${t.slug}`))}
              >
                {t.crest && <img src={t.crest} alt="" width={96} height={96} />}
                <span className="crest-card__name">{t.shortName}</span>
              </a>
            </li>
          );
        })}
      </ul>
      {MARKET_INDEX.collectedAt && <p className="hint">Dados do Transfermarkt coletados em {new Date(`${MARKET_INDEX.collectedAt}T12:00:00`).toLocaleDateString("pt-BR")}.</p>}
      <Footer />
    </div>
  );
}

// ============ clube ============

type Tab = "squad" | "market" | "summary";

function MarketClub({ slug }: { slug: string }) {
  const doc = useOverrides();
  const team = applyTeamSummary(teamSummary(slug)!, doc);
  const [club, setClub] = useState<ClubMarket | null | undefined>(undefined);
  const [st, setSt] = useState<MarketState>(() => loadMarketState(slug));
  const [tab, setTab] = useState<Tab>("squad");
  const [leagues, setLeagues] = useState<Record<string, MarketLeague>>({});

  useEffect(() => void loadClubMarket(slug).then(setClub), [slug]);
  useEffect(() => saveMarketState(slug, st), [slug, st]);
  // ligas das contratações já feitas (para o resumo)
  useEffect(() => {
    for (const id of new Set(st.signings.map((s) => s.league))) {
      if (!leagues[id]) loadLeague(id)?.then((l) => setLeagues((x) => ({ ...x, [id]: l })));
    }
  }, [st.signings, leagues]);

  const squad = club?.squad ?? [];
  const arrivals = st.signings
    .map((s) => {
      const lg = leagues[s.league];
      const p = lg?.players.find((x) => x.id === s.id);
      return p && lg ? { s, p, club: lg.clubs[p.club]?.name ?? "", league: lg.name } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const sum = summarize(squad, st, CUTOFF, arrivals.map((a) => ({ value: a.p.value, age: a.p.age })));

  const setDecision = (id: string, d: Decision | null) =>
    setSt((s) => {
      const decisions = { ...s.decisions };
      if (d) decisions[id] = d;
      else delete decisions[id];
      return { ...s, decisions };
    });

  return (
    <div className="mk" style={clubVars(team.colors) as React.CSSProperties}>
      <header className="mk__head">
        <a className="back" href="/mercado" onClick={(e) => (e.preventDefault(), navigate("/mercado"))}>← Clubes</a>
        <div className="board__club">
          {team.crest && <img src={team.crest} alt="" width={40} height={40} />}
          <h1>{team.shortName} <span className="mk__season">· janela {SEASON}</span></h1>
        </div>
        <a className="btn btn--sm" href={`/${slug}`} onClick={(e) => (e.preventDefault(), navigate(`/${slug}`))}>Prancheta</a>
      </header>

      <BudgetBar st={st} setSt={setSt} income={sum.income} spend={sum.spend} balance={sum.balance} />

      <nav className="mk-tabs" role="tablist">
        {([
          ["squad", `Elenco atual${squad.length ? ` (${squad.length})` : ""}`],
          ["market", "Mercado"],
          ["summary", "Resumo"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`mk-tab ${tab === t ? "is-on" : ""}`} onClick={() => setTab(t)}>
            {label}
            {t === "summary" && sum.pending.length > 0 && <em className="mk-tab__badge" title="Decisões pendentes">{sum.pending.length}</em>}
          </button>
        ))}
      </nav>

      {club === undefined ? (
        <p className="loading">Carregando…</p>
      ) : !hasMarketData || !club ? (
        <NoData />
      ) : tab === "squad" ? (
        <SquadTab squad={squad} st={st} setDecision={setDecision} colors={team.colors} />
      ) : tab === "market" ? (
        <MarketTab st={st} setSt={setSt} ownIds={new Set(squad.map((p) => p.id))} onLeague={(l) => setLeagues((x) => ({ ...x, [l.id]: l }))} />
      ) : (
        <SummaryTab sum={sum} st={st} setSt={setSt} arrivals={arrivals} />
      )}
      <Footer />
      {/* celular: saldo sempre visível embaixo */}
      <div className={`mk-mini ${sum.balance < 0 ? "is-neg" : ""}`} aria-hidden="true">
        <span>Receitas <b className="pos">{fmtEur(sum.income)}</b></span>
        <span>Gastos <b className="neg">{fmtEur(sum.spend)}</b></span>
        <span className="mk-mini__bal">Saldo <b>{fmtEur(sum.balance)}</b></span>
      </div>
    </div>
  );
}

// ============ orçamento ============

function BudgetBar({ st, setSt, income, spend, balance }: {
  st: MarketState;
  setSt: React.Dispatch<React.SetStateAction<MarketState>>;
  income: number;
  spend: number;
  balance: number;
}) {
  return (
    <section className="mk-budget">
      <div className="mk-budget__set">
        <label className="field">
          Orçamento
          <input
            type="number"
            min={0}
            step={1}
            value={st.budget / 1e6}
            onChange={(e) => setSt((s) => ({ ...s, budget: Math.max(0, Number(e.target.value) || 0) * 1e6 }))}
            aria-label="Orçamento em milhões de euros"
          />
          <span>€ mi</span>
        </label>
        <div className="mk-presets">
          {BUDGETS.map((b) => (
            <button key={b} className={`chip-btn ${st.budget === b * 1e6 ? "is-on" : ""}`} onClick={() => setSt((s) => ({ ...s, budget: b * 1e6 }))}>
              {b}
            </button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={st.useSales} onChange={(e) => setSt((s) => ({ ...s, useSales: e.target.checked }))} />
          Vendas reforçam o orçamento
        </label>
        <label className="field mk-rate" title="Cotação usada para mostrar os valores em reais">
          € 1 = R$
          <input type="number" step={0.05} min={1} value={st.rate} onChange={(e) => setSt((s) => ({ ...s, rate: Number(e.target.value) || s.rate }))} />
        </label>
      </div>
      <div className="mk-budget__nums">
        <div><span>Receitas</span><b className="pos">{fmtEur(income)}</b></div>
        <div><span>Gastos</span><b className="neg">{fmtEur(spend)}</b></div>
        <div className={`mk-balance ${balance < 0 ? "is-neg" : ""}`}>
          <span>Saldo</span>
          <b>{fmtEur(balance)}</b>
          <small>{fmtBrl(balance, st.rate)}</small>
        </div>
      </div>
    </section>
  );
}

// ============ elenco atual ============

const POS_GROUPS: [string, Pos[]][] = [
  ["Goleiros", ["GOL"]],
  ["Defensores", ["ZAG", "LD", "LE"]],
  ["Meio-campistas", ["VOL", "MEI"]],
  ["Atacantes", ["PON", "ATA"]],
];

function Avatar({ name, photo, colors }: { name: string; photo: string | null; colors?: { primary: string; secondary: string } }) {
  return photo ? (
    <img className="mk-avatar" src={photo} alt="" width={44} height={44} loading="lazy" />
  ) : (
    <span className="mk-avatar mk-avatar--ini" style={colors ? { background: colors.primary, color: colors.secondary } : undefined}>
      {initials(name)}
    </span>
  );
}

function arrivalText(p: SquadPlayer): string {
  const a = p.arrival;
  const year = a.date ? ` (${a.date.slice(0, 4)})` : "";
  if (a.type === "youth") return "Cria da base";
  if (a.type === "freeTransfer") return `Chegou livre${a.from ? ` do ${a.from}` : ""}${year}`;
  if (a.type === "loan") return `Emprestado pelo ${a.from ?? "?"}${year}`;
  if (a.type === "transfer") return `Comprado do ${a.from ?? "?"}${a.fee ? ` por ${fmtEur(a.fee)}` : ""}${year}`;
  return "";
}

function StatusBadges({ p }: { p: SquadPlayer }) {
  const ending = isEnding(p, CUTOFF);
  return (
    <div className="mk-badges">
      {p.status === "loanIn" && <span className="mk-badge mk-badge--loan">Emprestado pelo {p.loanClub ?? "?"} até {fmtDate(p.loanUntil)}</span>}
      {p.status === "loanOut" && <span className="mk-badge mk-badge--out">Emprestado ao {p.loanClub ?? "?"} até {fmtDate(p.loanUntil)}</span>}
      {p.status === "owned" && <span className={`mk-badge ${ending ? "mk-badge--warn" : ""}`}>Contrato até {fmtDate(p.contract)}{ending ? " · termina" : ""}</span>}
      {arrivalText(p) && <span className="mk-badge mk-badge--muted">{arrivalText(p)}</span>}
    </div>
  );
}

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="mk-price">
      €
      <input type="number" min={0} step={0.1} value={Math.round((value / 1e6) * 10) / 10} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 1e6)} />
      mi
    </label>
  );
}

function SquadTab({ squad, st, setDecision, colors }: {
  squad: SquadPlayer[];
  st: MarketState;
  setDecision: (id: string, d: Decision | null) => void;
  colors: { primary: string; secondary: string };
}) {
  const [filter, setFilter] = useState<"all" | "decide" | "loans">("all");
  const shown = squad.filter((p) =>
    filter === "decide" ? isEnding(p, CUTOFF) : filter === "loans" ? p.status !== "owned" : true,
  );
  return (
    <section className="mk-squad">
      <div className="seg mk-filter">
        <button className={`seg__btn ${filter === "all" ? "is-on" : ""}`} onClick={() => setFilter("all")}>Todos</button>
        <button className={`seg__btn ${filter === "decide" ? "is-on" : ""}`} onClick={() => setFilter("decide")}>Terminando</button>
        <button className={`seg__btn ${filter === "loans" ? "is-on" : ""}`} onClick={() => setFilter("loans")}>Empréstimos</button>
      </div>
      {POS_GROUPS.map(([label, roles]) => {
        const list = shown.filter((p) => roles.includes(p.pos)).sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) || (b.value ?? 0) - (a.value ?? 0));
        if (!list.length) return null;
        return (
          <div key={label} className="mk-group">
            <h3>{label} <span>{list.length}</span></h3>
            {list.map((p) => {
              const { options } = actionsFor(p, CUTOFF);
              const d = decisionOf(p, st, CUTOFF);
              const explicit = !!st.decisions[p.id];
              const leaving = !staysWith(d.action);
              const money = moneyOf(p, d);
              return (
                <article key={p.id} className={`mk-row ${leaving ? "is-leaving" : ""} ${isEnding(p, CUTOFF) && !explicit ? "is-pending" : ""}`}>
                  <Avatar name={p.name} photo={p.photo} colors={colors} />
                  <div className="mk-row__info">
                    <p className="mk-row__name">
                      {p.num != null && <b className="mk-num">{p.num}</b>}
                      {p.name}
                      <span className={`pos-badge pos-badge--${p.pos} mk-pos`}>{p.pos}</span>
                    </p>
                    <p className="mk-row__meta">
                      {p.age ?? "?"} anos{p.nat ? ` · ${p.nat}` : ""} · <b>{fmtEur(p.value)}</b>
                    </p>
                    <StatusBadges p={p} />
                  </div>
                  <div className="mk-row__act">
                    <div className="mk-actions" role="group" aria-label={`Decisão sobre ${p.name}`}>
                      {options.map((a) => (
                        <button
                          key={a}
                          className={`mk-act mk-act--${a} ${d.action === a ? "is-on" : ""}`}
                          onClick={() => setDecision(p.id, { action: a })}
                          aria-pressed={d.action === a}
                        >
                          {ACTION_LABEL[a]}
                        </button>
                      ))}
                    </div>
                    {PRICED.includes(d.action) && (
                      <div className="mk-row__price">
                        {d.action === "loanOut" ? "Taxa" : d.action === "sell" ? "Por" : "Custo"}
                        <PriceInput value={d.price ?? (d.action === "loanOut" ? 0 : p.value ?? 0)} onChange={(v) => setDecision(p.id, { ...d, price: v })} />
                        <span className={money >= 0 ? "pos" : "neg"}>{money >= 0 ? "+" : ""}{fmtEur(money)}</span>
                      </div>
                    )}
                    {isEnding(p, CUTOFF) && !explicit && <p className="mk-row__pending">Decisão pendente</p>}
                  </div>
                </article>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

// ============ mercado ============

function MarketTab({ st, setSt, ownIds, onLeague }: {
  st: MarketState;
  setSt: React.Dispatch<React.SetStateAction<MarketState>>;
  ownIds: Set<string>;
  onLeague: (l: MarketLeague) => void;
}) {
  const groups = [...new Set(MARKET_INDEX.leagues.map((l) => l.group))];
  const [leagueId, setLeagueId] = useState(MARKET_INDEX.leagues.find((l) => l.id !== "BRA1")?.id ?? MARKET_INDEX.leagues[0]?.id ?? "");
  const [loaded, setLoaded] = useState<MarketLeague[]>([]);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [maxAge, setMaxAge] = useState(0);
  const [maxValue, setMaxValue] = useState(0);
  const [onlyFree, setOnlyFree] = useState(false);
  const [limit, setLimit] = useState(60);

  useEffect(() => {
    const ids = leagueId === "ALL" ? MARKET_INDEX.leagues.map((l) => l.id) : [leagueId];
    let alive = true;
    Promise.all(ids.map((id) => loadLeague(id)).filter((p): p is Promise<MarketLeague> => !!p)).then((ls) => {
      if (!alive) return;
      setLoaded(ls);
      ls.forEach(onLeague);
    });
    setLimit(60);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = useMemo(() => {
    const nq = norm(q.trim());
    const out: { p: MarketPlayer; lg: MarketLeague }[] = [];
    for (const lg of loaded) {
      for (const p of lg.players) {
        if (ownIds.has(p.id)) continue;
        if (pos && p.pos !== pos) continue;
        if (maxAge && (p.age ?? 99) > maxAge) continue;
        if (maxValue && (p.value ?? 0) > maxValue * 1e6) continue;
        if (onlyFree && !isFreeAgent(p, CUTOFF)) continue;
        if (nq && !norm(`${p.name} ${lg.clubs[p.club]?.name ?? ""}`).includes(nq)) continue;
        out.push({ p, lg });
      }
    }
    return out.sort((a, b) => (b.p.value ?? 0) - (a.p.value ?? 0));
  }, [loaded, q, pos, maxAge, maxValue, onlyFree, ownIds]);

  const signed = new Map(st.signings.map((s) => [s.id, s]));
  const sign = (p: MarketPlayer, league: string, type: SigningType) =>
    setSt((s) => ({
      ...s,
      signings: [...s.signings.filter((x) => x.id !== p.id), { id: p.id, league, type, price: type === "buy" ? p.value ?? 0 : 0 }],
    }));
  const unsign = (id: string) => setSt((s) => ({ ...s, signings: s.signings.filter((x) => x.id !== id) }));

  return (
    <section className="mk-market">
      <div className="mk-filters">
        <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} aria-label="Liga">
          <option value="ALL">Todas as ligas</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {MARKET_INDEX.leagues.filter((l) => l.group === g).map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.players})</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input className="admin-search" type="search" placeholder="Buscar jogador ou clube…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} aria-label="Idade máxima">
          <option value={0}>Qualquer idade</option>
          {[21, 23, 25, 28, 31].map((a) => <option key={a} value={a}>até {a} anos</option>)}
        </select>
        <select value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))} aria-label="Valor máximo">
          <option value={0}>Qualquer valor</option>
          {[1, 3, 5, 10, 20, 40].map((v) => <option key={v} value={v}>até € {v} mi</option>)}
        </select>
        <label className="switch"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Só contrato terminando (livres)</label>
      </div>
      <div className="chips">
        <button className={`chip ${!pos ? "is-on" : ""}`} onClick={() => setPos(null)}>Todas</button>
        {POSITIONS.map((p) => (
          <button key={p} className={`chip chip--${p} ${pos === p ? "is-on" : ""}`} onClick={() => setPos(pos === p ? null : p)}>{p}</button>
        ))}
      </div>
      <p className="mk-count">{results.length.toLocaleString("pt-BR")} jogadores</p>
      <div className="mk-list">
        {results.slice(0, limit).map(({ p, lg }) => {
          const s = signed.get(p.id);
          const free = isFreeAgent(p, CUTOFF);
          return (
            <article key={p.id} className={`mk-row ${s ? "is-signed" : ""}`}>
              <Avatar name={p.name} photo={null} />
              <div className="mk-row__info">
                <p className="mk-row__name">{p.name}<span className={`pos-badge pos-badge--${p.pos} mk-pos`}>{p.pos}</span></p>
                <p className="mk-row__meta">
                  {p.age ?? "?"} anos{p.nat ? ` · ${p.nat}` : ""} · {lg.clubs[p.club]?.name} <span className="mk-league">({lg.name})</span>
                </p>
                <div className="mk-badges">
                  <span className="mk-badge"><b>{fmtEur(p.value)}</b></span>
                  <span className={`mk-badge ${free ? "mk-badge--free" : ""}`}>Contrato até {fmtDate(p.contract)}{free ? " · livre" : ""}</span>
                  {p.loanFrom && <span className="mk-badge mk-badge--loan">Emprestado pelo {p.loanFrom}</span>}
                </div>
              </div>
              <div className="mk-row__act">
                {s ? (
                  <div className="mk-signed">
                    <span>✓ {SIGNING_LABEL[s.type]}</span>
                    {s.type !== "free" && (
                      <PriceInput value={s.price} onChange={(v) => setSt((x) => ({ ...x, signings: x.signings.map((y) => (y.id === p.id ? { ...y, price: v } : y)) }))} />
                    )}
                    <button className="btn btn--sm btn--ghost" onClick={() => unsign(p.id)}>Remover</button>
                  </div>
                ) : (
                  <div className="mk-actions">
                    <button className="mk-act" onClick={() => sign(p, lg.id, "buy")}>Comprar</button>
                    <button className="mk-act" onClick={() => sign(p, lg.id, "loan")}>Empréstimo</button>
                    {free && <button className="mk-act mk-act--free" onClick={() => sign(p, lg.id, "free")}>Livre</button>}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {results.length > limit && (
        <button className="btn mk-more" onClick={() => setLimit((l) => l + 60)}>Mostrar mais</button>
      )}
    </section>
  );
}

// ============ resumo ============

function SummaryTab({ sum, st, setSt, arrivals }: {
  sum: ReturnType<typeof summarize>;
  st: MarketState;
  setSt: React.Dispatch<React.SetStateAction<MarketState>>;
  arrivals: { s: MarketState["signings"][number]; p: MarketPlayer; club: string; league: string }[];
}) {
  const next: { name: string; pos: Pos; age: number | null; value: number | null; tag: string }[] = [
    ...sum.stays.map((p) => {
      const a = decisionOf(p, st, CUTOFF).action;
      const tag = a === "buyOut" ? "comprado" : a === "extendLoan" ? "emprestado" : a === "recall" ? "volta" : a === "renew" ? "renovado" : "";
      return { name: p.name, pos: p.pos, age: p.age, value: p.value, tag };
    }),
    ...arrivals.map((a) => ({ name: a.p.name, pos: a.p.pos, age: a.p.age, value: a.p.value, tag: "novo" })),
  ];
  const count = (roles: Pos[]) => next.filter((x) => roles.includes(x.pos)).length;
  const warns: string[] = [];
  if (count(["GOL"]) < 2) warns.push("Menos de 2 goleiros");
  if (count(["ZAG"]) < 3) warns.push("Menos de 3 zagueiros");
  if (count(["LD"]) < 1 || count(["LE"]) < 1) warns.push("Falta lateral (direito ou esquerdo)");
  if (count(["VOL", "MEI"]) < 5) warns.push("Menos de 5 meio-campistas");
  if (count(["PON", "ATA"]) < 4) warns.push("Menos de 4 atacantes");
  if (sum.balance < 0) warns.push("Orçamento estourado");

  return (
    <section className="mk-summary">
      <div className="mk-cards">
        <div className="mk-card"><span>Elenco {SEASON}</span><b>{sum.squadSize}</b><small>jogadores</small></div>
        <div className="mk-card"><span>Valor do elenco</span><b>{fmtEur(sum.squadValue)}</b><small>{fmtBrl(sum.squadValue, st.rate)}</small></div>
        <div className="mk-card"><span>Idade média</span><b>{sum.avgAge ? sum.avgAge.toFixed(1) : "—"}</b><small>anos</small></div>
        <div className={`mk-card ${sum.balance < 0 ? "is-neg" : ""}`}><span>Saldo</span><b>{fmtEur(sum.balance)}</b><small>{fmtBrl(sum.balance, st.rate)}</small></div>
      </div>
      {warns.length > 0 && <ul className="mk-warns">{warns.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
      {sum.pending.length > 0 && (
        <div className="mk-box mk-box--warn">
          <h3>Decisões pendentes ({sum.pending.length})</h3>
          <p>Contratos ou empréstimos que terminam antes de {SEASON}. Sem decisão, vale o padrão (renovar, devolver ou trazer de volta).</p>
          <p className="mk-names">{sum.pending.map((p) => p.name).join(" · ")}</p>
        </div>
      )}
      <div className="mk-cols">
        <div className="mk-box">
          <h3>Chegadas ({arrivals.length})</h3>
          {!arrivals.length && <p className="mk-muted">Nenhuma contratação ainda. Vá à aba Mercado.</p>}
          {arrivals.map((a) => (
            <p key={a.s.id} className="mk-line">
              <span className={`pos-badge pos-badge--${a.p.pos} mk-pos`}>{a.p.pos}</span>
              <b>{a.p.name}</b> <span className="mk-muted">{a.club}</span>
              <span className="mk-line__end">{SIGNING_LABEL[a.s.type]} · <span className="neg">{a.s.type === "free" ? "€ 0" : fmtEur(-a.s.price)}</span>
                <button className="icon-btn" aria-label="Remover" onClick={() => setSt((x) => ({ ...x, signings: x.signings.filter((y) => y.id !== a.s.id) }))}>×</button>
              </span>
            </p>
          ))}
        </div>
        <div className="mk-box">
          <h3>Saídas ({sum.leaves.length})</h3>
          {!sum.leaves.length && <p className="mk-muted">Ninguém saindo.</p>}
          {sum.leaves.map(({ p, d }) => {
            const m = moneyOf(p, d);
            return (
              <p key={p.id} className="mk-line">
                <span className={`pos-badge pos-badge--${p.pos} mk-pos`}>{p.pos}</span>
                <b>{p.name}</b>
                <span className="mk-line__end">{ACTION_LABEL[d.action as SquadAction]}{m ? <> · <span className="pos">+{fmtEur(m)}</span></> : null}</span>
              </p>
            );
          })}
        </div>
      </div>
      <div className="mk-box">
        <h3>Elenco {SEASON} por posição</h3>
        {POS_GROUPS.map(([label, roles]) => {
          const list = next.filter((x) => roles.includes(x.pos)).sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos));
          return (
            <p key={label} className="mk-line mk-line--wrap">
              <b className="mk-line__label">{label} ({list.length})</b>
              {list.map((x, i) => (
                <span key={i} className="mk-chip">{x.name}{x.tag && <em> {x.tag}</em>}</span>
              ))}
            </p>
          );
        })}
      </div>
    </section>
  );
}
