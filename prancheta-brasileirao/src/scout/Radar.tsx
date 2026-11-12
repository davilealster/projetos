// Aba Radar: buscas do olheiro (atalhos) + filtros manuais + fichas de resultado.
import { useMemo, useState } from "react";
import { fmtEur, curUnit, toUnit } from "../market/logic";
import { POSITIONS, type Pos } from "../types";
import { useScout } from "./context";
import { FREE_CUTOFF, SCOUT_GROUPS } from "./data";
import { keyIndicators, type ScoutPlayer } from "./metrics";
import { SEARCHES, applyFilters, emptyFilters, isFree, needsText, runSearch, type ScoutFilters, type SearchId } from "./searches";
import { PLAN_LETTERS, PLAN_MAX, SHELVES, planOf, type ShelfId } from "./state";
import { Drawer, Face, Ico, ICON, PctBar, ScoreStamp, Tags, Trend } from "./ui";

export interface RadarState {
  scope: string; // grupo ou "ALL"
  filters: ScoutFilters;
  search: SearchId | null;
  refKey: string;
  limit: number;
}
export const initialRadar = (group: string): RadarState => ({ scope: group, filters: emptyFilters(), search: "obvious", refKey: "", limit: 30 });

const SEARCH_NUM: Record<SearchId, string> = { obvious: "01", hidden: "02", gems: "03", contract: "04", value: "05", replace: "06", needs: "07" };

// ---------- ficha compacta ----------

export function ScoutCard({ x, rank }: { x: ScoutPlayer; rank?: number }) {
  const { st, dispatch, open, ownIds, signedIds } = useScout();
  const shelf = st.shelves[x.key];
  const plan = planOf(st, x.key);
  const planLen = st.plans[x.pos]?.length ?? 0;
  const free = isFree(x, FREE_CUTOFF);
  const inCompare = st.compare.includes(x.key);
  const setShelf = (v: string) => dispatch({ type: "shelf", key: x.key, shelf: v ? (v as ShelfId) : null });
  return (
    <article className={`sc-card ${shelf ? `is-shelf-${shelf.shelf}` : ""} ${signedIds.has(x.id) ? "is-signed" : ""}`}>
      <button className="sc-card__hit" onClick={() => open(x.key)} aria-label={`Abrir o perfil de ${x.name}`} />
      {rank != null && <span className="sc-card__rank">{rank}</span>}
      <Face name={x.name} photo={x.photo} size={48} className="sc-card__face" />
      <div className="sc-card__main">
        <p className="sc-card__name">
          <span>{x.name}</span>
          <span className={`tm-pos tm-pos--${x.pos}`}>{x.pos}</span>
          {x.foreign && <span className="tm-foreign">EST</span>}
        </p>
        <p className="sc-card__meta">{x.age != null ? `${x.age} anos` : "idade ?"} · {x.club} · <i>{x.leagueName.replace(/ \(.*\)$/, "")}</i></p>
        <p className="sc-card__money">
          <b>{fmtEur(x.value)}</b>
          <Trend t={x.m.trend} />
          {free ? <span className="sc-free">chega livre</span> : x.contract ? <span className="sc-dim">até {x.contract.slice(0, 4)}</span> : null}
        </p>
      </div>
      <ScoreStamp x={x} />
      <div className="sc-card__bars">
        {x.m.sample ? keyIndicators(x).map((r) => <PctBar key={r.id} r={r} compact />) : <span className="sc-dim sc-card__small">{x.stats ? `Amostra pequena: ${x.m.min} min` : "Sem estatísticas na temporada"}</span>}
      </div>
      <div className="sc-card__foot">
        <Tags x={x} max={2} />
        <span className="sc-card__acts">
          <label className={`sc-selbtn ${shelf ? `is-on sc-selbtn--${shelf.shelf}` : ""}`}>
            <span>{shelf ? SHELVES.find((s) => s.id === shelf.shelf)!.short : "Prateleira"}</span>
            <select value={shelf?.shelf ?? ""} onChange={(e) => setShelf(e.target.value)} aria-label={`Prateleira de ${x.name}`}>
              <option value="">{shelf ? "Tirar da prateleira" : "Prateleira…"}</option>
              {SHELVES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          {!ownIds.has(x.id) && (plan ? (
            <button className="sc-chipbtn is-on" onClick={() => dispatch({ type: "plan/remove", pos: plan.pos, key: x.key })} aria-label={`Tirar ${x.name} do plano`}>Plano {PLAN_LETTERS[plan.index]} ×</button>
          ) : (
            <button className="sc-chipbtn" disabled={planLen >= PLAN_MAX} onClick={() => dispatch({ type: "plan/add", pos: x.pos, key: x.key })}>+ Plano {planLen < PLAN_MAX ? PLAN_LETTERS[planLen] : ""}</button>
          ))}
          <button className={`sc-chipbtn sc-chipbtn--cmp ${inCompare ? "is-on" : ""}`} aria-pressed={inCompare} onClick={() => dispatch({ type: "compare", key: x.key })} title="Comparar (até 3)">
            {inCompare ? "✓ Comparar" : "Comparar"}
          </button>
        </span>
      </div>
    </article>
  );
}

// ---------- filtros ----------

const AGE_OPTS = [0, 19, 21, 23, 25, 28, 31];
const VALUE_OPTS = [0, 0.5, 1, 2, 5, 10, 20, 40].map((v) => v * 1e6);
const MIN_OPTS = [0, 450, 900, 1350, 1800];
const SCORE_OPTS = [0, 50, 60, 70, 80];

function Filters({ f, set, scope, balance }: { f: ScoutFilters; set: (p: Partial<ScoutFilters>) => void; scope: string; balance: number }) {
  const leagues = scope === "ALL" ? SCOUT_GROUPS.flatMap((g) => g.leagues) : SCOUT_GROUPS.find((g) => g.group === scope)?.leagues ?? [];
  const year = Number(FREE_CUTOFF.slice(0, 4));
  const unitMi = (v: number) => `${curUnit()} ${(Math.round((toUnit(v) / 1e6) * 10) / 10).toLocaleString("pt-BR")} mi`;
  return (
    <>
      <label className="sc-f">
        Liga
        <select value={f.league} onChange={(e) => set({ league: e.target.value })}>
          <option value="">Todas do grupo</option>
          {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="sc-f">
        Idade máx.
        <select value={f.maxAge} onChange={(e) => set({ maxAge: Number(e.target.value) })}>
          {AGE_OPTS.map((a) => <option key={a} value={a}>{a ? `até ${a}` : "qualquer"}</option>)}
        </select>
      </label>
      <label className="sc-f">
        Valor máx.
        <select value={f.maxValue} onChange={(e) => set({ maxValue: Number(e.target.value) })}>
          {VALUE_OPTS.map((v) => <option key={v} value={v}>{v ? `até ${unitMi(v)}` : "qualquer"}</option>)}
        </select>
      </label>
      <label className="sc-f">
        Contrato até
        <select value={f.contractYear} onChange={(e) => set({ contractYear: Number(e.target.value) })}>
          <option value={0}>qualquer</option>
          {[year - 1, year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="sc-f">
        Minutos mín.
        <select value={f.minMinutes} onChange={(e) => set({ minMinutes: Number(e.target.value) })}>
          {MIN_OPTS.map((m) => <option key={m} value={m}>{m ? `${m} min` : "qualquer"}</option>)}
        </select>
      </label>
      <label className="sc-f">
        Nota mín.
        <select value={f.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })}>
          {SCORE_OPTS.map((m) => <option key={m} value={m}>{m || "qualquer"}</option>)}
        </select>
      </label>
      <label className="sc-f">
        Estrangeiro
        <select value={f.foreign} onChange={(e) => set({ foreign: e.target.value as ScoutFilters["foreign"] })}>
          <option value="any">tanto faz</option>
          <option value="no">só brasileiros</option>
          <option value="yes">só estrangeiros</option>
        </select>
      </label>
      <button className={`tm-toggle sc-f--toggle ${f.afford ? "is-on" : ""}`} aria-pressed={f.afford} onClick={() => set({ afford: !f.afford })}>
        Cabe no saldo ({fmtEur(Math.max(0, balance))})
      </button>
      {f.foreign === "yes" && <p className="sc-f__warn">Lembrete: só 8 estrangeiros podem ser relacionados por jogo.</p>}
    </>
  );
}

const activeCount = (f: ScoutFilters) => [f.league, f.maxAge, f.maxValue, f.contractYear, f.minMinutes, f.minScore, f.foreign !== "any", f.afford].filter(Boolean).length;

// ---------- aba ----------

export function Radar({ pool, loading, radar, setRadar, setScope }: {
  pool: ScoutPlayer[]; loading: boolean; radar: RadarState; setRadar: React.Dispatch<React.SetStateAction<RadarState>>; setScope: (s: string) => void;
}) {
  const { balance, depth, ownIds, isMobile, byKey } = useScout();
  const [sheet, setSheet] = useState(false);
  const f = radar.filters;
  const setF = (p: Partial<ScoutFilters>) => setRadar((r) => ({ ...r, filters: { ...r.filters, ...p }, limit: 30 }));
  const togglePos = (p: Pos) => setF({ pos: f.pos.includes(p) ? f.pos.filter((x) => x !== p) : [...f.pos, p] });
  const needs = depth.filter((d) => d.short > 0).map((d) => ({ pos: d.pos, short: d.short }));
  const ownInPool = useMemo(() => pool.filter((x) => ownIds.has(x.id) && x.m.score != null).sort((a, b) => a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name)), [pool, ownIds]);
  const ref = radar.refKey ? byKey.get(radar.refKey) ?? null : null;

  const ctx = useMemo(() => ({ balance, freeCutoff: FREE_CUTOFF, ownIds, ref, needs }), [balance, ownIds, ref, needs.map((n) => n.pos + n.short).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  // reposição usa a posição da referência; os demais filtros continuam valendo
  const filtered = useMemo(() => applyFilters(pool, f, ctx), [pool, f, ctx]);
  const counts = useMemo(() => {
    const out = {} as Record<SearchId, number>;
    for (const s of SEARCHES) out[s.id] = runSearch(s.id, s.id === "replace" ? applyFilters(pool, { ...f, pos: [] }, ctx) : filtered, ctx).length;
    return out;
  }, [pool, filtered, ctx, f]);
  const results = useMemo(() => {
    if (!radar.search) return [...filtered].sort((a, b) => (b.m.score ?? -1) - (a.m.score ?? -1) || (b.value ?? 0) - (a.value ?? 0));
    return runSearch(radar.search, radar.search === "replace" ? applyFilters(pool, { ...f, pos: [] }, ctx) : filtered, ctx);
  }, [radar.search, filtered, pool, f, ctx]);

  const scopes = [...SCOUT_GROUPS.map((g) => [g.group, g.group] as const), ["ALL", "Todas"] as const];
  const def = SEARCHES.find((s) => s.id === radar.search);
  const active = activeCount(f);

  return (
    <section className="sc-radar">
      <div className="sc-scope" role="group" aria-label="Ligas do radar">
        {scopes.map(([id, label]) => (
          <button key={id} className={radar.scope === id ? "is-on" : ""} aria-pressed={radar.scope === id} onClick={() => setScope(id)}>{label}</button>
        ))}
      </div>

      <div className="sc-searches" role="list" aria-label="Buscas do olheiro">
        {SEARCHES.map((s) => (
          <button
            key={s.id}
            role="listitem"
            className={`sc-search ${radar.search === s.id ? "is-on" : ""}`}
            aria-pressed={radar.search === s.id}
            onClick={() => setRadar((r) => ({ ...r, search: r.search === s.id ? null : s.id, limit: 30 }))}
          >
            <span className="sc-search__n">{SEARCH_NUM[s.id]}</span>
            <b>{s.title}</b>
            <small>{s.id === "needs" ? needsText(needs) : s.rule}</small>
            <em>{loading ? "…" : s.id === "replace" && !ref ? "escolha" : counts[s.id]}</em>
          </button>
        ))}
      </div>

      {radar.search === "replace" && (
        <div className="sc-callout">
          <span>Parecidos com</span>
          <select value={radar.refKey} onChange={(e) => setRadar((r) => ({ ...r, refKey: e.target.value }))} aria-label="Jogador de referência">
            <option value="">escolha um jogador do seu elenco</option>
            {ownInPool.map((x) => <option key={x.key} value={x.key}>{x.pos} · {x.name} (nota {x.m.score})</option>)}
          </select>
          {!ownInPool.length && <small>Seu elenco ainda não tem estatísticas carregadas neste grupo.</small>}
        </div>
      )}
      {radar.search === "needs" && (
        <div className="sc-callout">
          {needs.length ? (
            <>
              <span>Pelo balancete do Mercado, faltam:</span>
              {needs.map((n) => <span key={n.pos} className="sc-need"><span className={`tm-pos tm-pos--${n.pos}`}>{n.pos}</span> +{n.short}</span>)}
            </>
          ) : (
            <span>O elenco do Mercado já tem o mínimo em todas as posições. Use os filtros de posição para reforçar mesmo assim.</span>
          )}
        </div>
      )}

      {isMobile ? (
        <div className="sc-mfilters">
          <input type="search" placeholder="Buscar jogador ou clube" value={f.q} onChange={(e) => setF({ q: e.target.value })} aria-label="Buscar jogador ou clube" />
          <button className={`tm-iconbtn ${active ? "is-on" : ""}`} onClick={() => setSheet(true)} aria-label={`Filtros${active ? `, ${active} ativos` : ""}`}>
            <Ico d={ICON.filter} size={20} />
            {active > 0 && <i>{active}</i>}
          </button>
        </div>
      ) : (
        <div className="sc-filters">
          <label className="sc-f sc-f--q">
            Buscar
            <input type="search" placeholder="Jogador ou clube" value={f.q} onChange={(e) => setF({ q: e.target.value })} />
          </label>
          <Filters f={f} set={setF} scope={radar.scope} balance={balance} />
        </div>
      )}
      <div className="sc-posbar" role="group" aria-label="Posição">
        {POSITIONS.map((p) => (
          <button key={p} className={`tm-pos tm-pos--${p} ${f.pos.includes(p) ? "is-on" : f.pos.length ? "is-dim" : ""}`} aria-pressed={f.pos.includes(p)} onClick={() => togglePos(p)}>{p}</button>
        ))}
        {f.pos.length > 0 && <button className="tm-link sc-posbar__all" onClick={() => setF({ pos: [] })}>todas</button>}
      </div>

      {isMobile && sheet && (
        <Drawer
          label="Filtros"
          onClose={() => setSheet(false)}
          foot={
            <div className="sc-foot2">
              <button className="tm-btn" disabled={!active} onClick={() => setF({ ...emptyFilters(), q: f.q, pos: f.pos })}>Limpar</button>
              <button className="tm-btn tm-btn--brass" onClick={() => setSheet(false)}>Ver {results.length.toLocaleString("pt-BR")} jogadores</button>
            </div>
          }
        >
          <h2 className="sc-drawer__title">Filtros</h2>
          <div className="sc-fsheet"><Filters f={f} set={setF} scope={radar.scope} balance={balance} /></div>
        </Drawer>
      )}

      <p className="sc-count">
        {loading ? "Abrindo os relatórios…" : (
          <>
            <b>{results.length.toLocaleString("pt-BR")}</b> {def ? `em “${def.title}”` : "jogadores"} · {f.pos.length ? f.pos.join(", ") : "todas as posições"}
            {def && <span className="sc-count__rule"> · {def.id === "needs" ? needsText(needs) : def.rule}</span>}
          </>
        )}
      </p>

      <div className="sc-cards">
        {results.slice(0, radar.limit).map((x, i) => <ScoutCard key={x.key} x={x} rank={radar.search === "obvious" ? i + 1 : undefined} />)}
        {!loading && !results.length && (
          <p className="tm-empty">
            {radar.search === "replace" && !ref ? "Escolha acima um jogador do seu elenco para achar parecidos." : "Ninguém passou nesse filtro."}{" "}
            {active > 0 && <button className="tm-link" onClick={() => setF({ ...emptyFilters(), q: "", pos: f.pos })}>Limpar filtros</button>}
          </p>
        )}
      </div>
      {results.length > radar.limit && (
        <button className="tm-btn tm-more sc-more" onClick={() => setRadar((r) => ({ ...r, limit: r.limit + 30 }))}>Mostrar mais 30</button>
      )}
      {radar.filters.afford && <p className="sc-fine">“Cabe no saldo” usa o saldo do Mercado; quem chega livre sempre cabe.</p>}
    </section>
  );
}

