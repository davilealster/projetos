// Abas Prateleiras, Planos e Comparar + a mesa lateral do olheiro.
import { useState } from "react";
import { spaLink } from "../brand/BrandMark";
import { fmtEur, fmtRef, posRank } from "../market/logic";
import { POSITIONS, type Pos } from "../types";
import { useScout } from "./context";
import { FREE_CUTOFF } from "./data";
import { INDICATORS, type IndicatorId, type ScoutPlayer } from "./metrics";
import { isFree } from "./searches";
import { PLAN_LETTERS, PLAN_MAX, SHELVES, shelfCounts, type ShelfId } from "./state";
import { Face, Ico, ICON, ScoreStamp, Trend } from "./ui";

const POS_LONG: Record<Pos, string> = {
  GOL: "Goleiro", ZAG: "Zagueiro", LD: "Lateral direito", LE: "Lateral esquerdo", VOL: "Volante", MEI: "Meia", PON: "Ponta", ATA: "Atacante",
};

const costOf = (x: ScoutPlayer | undefined) => (!x ? 0 : isFree(x, FREE_CUTOFF) ? 0 : x.value ?? 0);

/** Linha de jogador (papel) usada em prateleiras e planos. */
function Row({ x, k, children, sub }: { x: ScoutPlayer | undefined; k: string; children?: React.ReactNode; sub?: React.ReactNode }) {
  const { open } = useScout();
  if (!x)
    return (
      <div className="sc-row is-loading">
        <span className="sc-face sc-face--ini" style={{ width: 40, height: 40 }}>…</span>
        <div className="sc-row__main"><p className="sc-row__name">Carregando {k.split(":")[0]}…</p></div>
        {children && <div className="sc-row__acts">{children}</div>}
      </div>
    );
  return (
    <div className="sc-row">
      <button className="sc-row__hit" onClick={() => open(x.key)} aria-label={`Abrir o perfil de ${x.name}`} />
      <Face name={x.name} photo={x.photo} size={40} />
      <div className="sc-row__main">
        <p className="sc-row__name"><span>{x.name}</span><span className={`tm-pos tm-pos--${x.pos}`}>{x.pos}</span></p>
        <p className="sc-row__meta">{x.age ?? "?"} anos · {x.club} · {isFree(x, FREE_CUTOFF) ? <b className="sc-free">livre</b> : fmtEur(x.value)}</p>
        {sub}
      </div>
      <ScoreStamp x={x} />
      {children && <div className="sc-row__acts">{children}</div>}
    </div>
  );
}

// ---------- prateleiras ----------

export function ShelvesTab({ onRadar }: { onRadar: () => void }) {
  const { st, dispatch, byKey, isMobile } = useScout();
  const [mob, setMob] = useState<ShelfId>("priority");
  const counts = shelfCounts(st);
  const entries = Object.entries(st.shelves).sort((a, b) => b[1].at - a[1].at);
  const total = entries.length;
  const move = (k: string, from: ShelfId, dir: -1 | 1) => {
    const i = SHELVES.findIndex((s) => s.id === from) + dir;
    if (i >= 0 && i < SHELVES.length) dispatch({ type: "shelf", key: k, shelf: SHELVES[i].id });
  };
  if (!total)
    return (
      <div className="sc-emptybox">
        <h2>Nenhum nome nas prateleiras</h2>
        <p>No Radar, use “Prateleira” numa ficha: <b>Monitorar</b> → <b>Observar de perto</b> → <b>Prioridade</b>. Quem não serve vai para <b>Descartado</b>, com o motivo.</p>
        <button className="tm-btn tm-btn--brass" onClick={onRadar}>Ir ao Radar</button>
      </div>
    );
  const col = (id: ShelfId) => (
    <div className={`sc-col sc-col--${id}`} key={id}>
      {!isMobile && (
        <h3 className="sc-col__head">
          {SHELVES.find((s) => s.id === id)!.label} <b>{counts[id]}</b>
        </h3>
      )}
      {entries.filter(([, e]) => e.shelf === id).map(([k, e]) => {
        const x = byKey.get(k);
        const i = SHELVES.findIndex((s) => s.id === id);
        return (
          <Row
            key={k}
            k={k}
            x={x}
            sub={id === "discard" && (
              <input className="sc-reason" value={e.reason ?? ""} maxLength={80} placeholder="motivo (opcional)" aria-label="Motivo do descarte" onChange={(ev) => dispatch({ type: "reason", key: k, reason: ev.target.value })} />
            )}
          >
            <button className="sc-ibtn" disabled={i === 0} onClick={() => move(k, id, -1)} aria-label="Prateleira anterior"><Ico d={ICON.left} size={16} /></button>
            <button className="sc-ibtn" disabled={i === SHELVES.length - 1} onClick={() => move(k, id, 1)} aria-label="Próxima prateleira"><Ico d={ICON.right} size={16} /></button>
          </Row>
        );
      })}
      {!counts[id] && <p className="sc-col__empty">Vazia</p>}
    </div>
  );
  return (
    <section className="sc-shelves">
      {isMobile ? (
        <>
          <div className="sc-segtabs" role="tablist" aria-label="Prateleiras">
            {SHELVES.map((s) => (
              <button key={s.id} role="tab" aria-selected={mob === s.id} className={`sc-segtab--${s.id} ${mob === s.id ? "is-on" : ""}`} onClick={() => setMob(s.id)}>
                {s.short}<i>{counts[s.id]}</i>
              </button>
            ))}
          </div>
          {col(mob)}
        </>
      ) : (
        <div className="sc-kanban">{SHELVES.map((s) => col(s.id))}</div>
      )}
    </section>
  );
}

// ---------- planos ----------

export function PlansTab({ onRadar }: { onRadar: (pos: Pos) => void }) {
  const { st, dispatch, byKey, depth, balance, addToMarket, signedIds } = useScout();
  const [extra, setExtra] = useState<Pos[]>([]);
  const short = new Map(depth.filter((d) => d.short > 0).map((d) => [d.pos, d.short]));
  const shown = POSITIONS.filter((p) => short.has(p) || (st.plans[p]?.length ?? 0) > 0 || extra.includes(p)).sort((a, b) => posRank(a) - posRank(b));
  const rest = POSITIONS.filter((p) => !shown.includes(p));
  const planA = shown.map((p) => st.plans[p]?.[0]).filter((k): k is string => !!k);
  const pendingA = planA.filter((k) => !signedIds.has(byKey.get(k)?.id ?? ""));
  const totalA = pendingA.reduce((t, k) => t + costOf(byKey.get(k)), 0);

  return (
    <section className="sc-plans">
      <div className="sc-planhead">
        <div>
          <p className="tm-eyebrow">Planos A · custo total</p>
          <p className={`sc-planhead__total ${totalA > balance ? "is-neg" : ""}`}>{fmtEur(totalA)} <small>de {fmtEur(balance)} de saldo</small></p>
          {fmtRef(totalA) && <p className="sc-dim sc-small">{fmtRef(totalA)}</p>}
        </div>
        <button className="tm-btn tm-btn--brass" disabled={!pendingA.length} onClick={() => addToMarket(pendingA)}>
          <Ico d={ICON.cart} size={18} /> Levar {pendingA.length > 1 ? `os ${pendingA.length} Planos A` : "o Plano A"} ao mercado
        </button>
      </div>
      {!shown.length && (
        <div className="sc-emptybox">
          <h2>Sem carências e sem planos</h2>
          <p>Escolha uma posição para montar a fila de alvos: Plano A, B, C (até {PLAN_MAX}).</p>
        </div>
      )}
      <div className="sc-planlist">
        {shown.map((pos) => {
          const list = st.plans[pos] ?? [];
          const a = byKey.get(list[0] ?? "");
          const need = short.get(pos);
          return (
            <article key={pos} className="sc-plan">
              <header className="sc-plan__head">
                <span className={`tm-pos tm-pos--${pos}`}>{pos}</span>
                <h3>{POS_LONG[pos]}</h3>
                {need ? <span className="sc-need">faltam {need}</span> : null}
                <span className="sc-plan__cost">{list.length ? <>Plano A: <b>{a && isFree(a, FREE_CUTOFF) ? "livre" : fmtEur(costOf(a))}</b></> : "sem alvos"}</span>
              </header>
              <ol className="sc-plan__list">
                {list.map((k, i) => {
                  const x = byKey.get(k);
                  return (
                    <li key={k} className={i === 0 ? "is-a" : ""}>
                      <span className="sc-plan__letter">{PLAN_LETTERS[i]}</span>
                      <Row x={x} k={k} sub={x && signedIds.has(x.id) ? <span className="sc-signed">no seu mercado</span> : null}>
                        <button className="sc-ibtn" disabled={i === 0} onClick={() => dispatch({ type: "plan/move", pos, key: k, dir: -1 })} aria-label="Subir"><Ico d={ICON.up} size={16} /></button>
                        <button className="sc-ibtn" disabled={i === list.length - 1} onClick={() => dispatch({ type: "plan/move", pos, key: k, dir: 1 })} aria-label="Descer"><Ico d={ICON.down} size={16} /></button>
                        <button className="sc-ibtn" onClick={() => dispatch({ type: "plan/remove", pos, key: k })} aria-label="Tirar do plano"><Ico d={ICON.close} size={14} /></button>
                      </Row>
                    </li>
                  );
                })}
                {list.length < PLAN_MAX && (
                  <li className="sc-plan__add">
                    <span className="sc-plan__letter">{PLAN_LETTERS[list.length]}</span>
                    <button className="sc-addslot" onClick={() => onRadar(pos)}>+ Procurar {POS_LONG[pos].toLowerCase()} no Radar</button>
                  </li>
                )}
              </ol>
              {a && !signedIds.has(a.id) && (
                <button className="tm-btn sc-plan__go" onClick={() => addToMarket([a.key])}>Levar o Plano A ao mercado →</button>
              )}
            </article>
          );
        })}
      </div>
      {rest.length > 0 && (
        <label className="sc-addpos">
          Montar plano para outra posição
          <select value="" onChange={(e) => e.target.value && setExtra((x) => [...x, e.target.value as Pos])}>
            <option value="">escolha…</option>
            {rest.map((p) => <option key={p} value={p}>{p} · {POS_LONG[p]}</option>)}
          </select>
        </label>
      )}
    </section>
  );
}

// ---------- comparar ----------

export function CompareTab({ onRadar }: { onRadar: () => void }) {
  const { st, dispatch, byKey, open } = useScout();
  const list = st.compare.map((k) => byKey.get(k)).filter((x): x is ScoutPlayer => !!x);
  if (!st.compare.length)
    return (
      <div className="sc-emptybox">
        <h2>Comparador vazio</h2>
        <p>Toque em “Comparar” em até 3 fichas do Radar para ver os jogadores lado a lado.</p>
        <button className="tm-btn tm-btn--brass" onClick={onRadar}>Ir ao Radar</button>
      </div>
    );
  const ids = [...new Set(list.flatMap((x) => x.m.indicators.map((r) => r.id)))] as IndicatorId[];
  const best = (vals: (number | null)[], higher = true) => {
    const v = vals.filter((x): x is number => x != null);
    if (v.length < 2) return null;
    return higher ? Math.max(...v) : Math.min(...v);
  };
  // higher: true = maior é melhor, false = menor é melhor, null = sem destaque
  const line = (label: string, vals: (number | null)[], fmt: (v: number | null, i: number) => React.ReactNode, higher: boolean | null = true) => {
    const b = higher == null ? null : best(vals, higher);
    return (
      <div className="sc-cmp__row" key={label}>
        <p className="sc-cmp__label">{label}</p>
        <div className="sc-cmp__vals" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
          {vals.map((v, i) => <span key={i} className={b != null && v === b ? "is-best" : ""}>{fmt(v, i)}</span>)}
        </div>
      </div>
    );
  };
  const pctCell = (v: number | null) => (v == null ? <span className="sc-dim">—</span> : (
    <span className="sc-cmp__pct"><i style={{ width: `${v}%` }} /><b>{v}</b></span>
  ));
  return (
    <section className="sc-cmp">
      <div className="sc-cmp__heads" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
        {list.map((x) => (
          <div key={x.key} className="sc-cmp__head">
            <button className="sc-cmp__x" onClick={() => dispatch({ type: "compare", key: x.key })} aria-label={`Tirar ${x.name} do comparador`}><Ico d={ICON.close} size={14} /></button>
            <button className="sc-cmp__who" onClick={() => open(x.key)}>
              <Face name={x.name} photo={x.photo} size={56} />
              <b>{x.name}</b>
              <small><span className={`tm-pos tm-pos--${x.pos}`}>{x.pos}</span> {x.club}</small>
            </button>
            <ScoreStamp x={x} />
          </div>
        ))}
      </div>
      {st.compare.length > list.length && <p className="sc-dim sc-small">Carregando {st.compare.length - list.length} jogador(es)…</p>}
      {new Set(list.map((x) => x.pos)).size > 1 && <p className="sc-fine">Posições diferentes: cada um é medido nos indicadores da própria posição (— quando não se aplica).</p>}
      <div className="sc-cmp__table">
        {line("Nota da posição", list.map((x) => x.m.score), (v) => <b className="sc-cmp__big">{v ?? "—"}</b>)}
        {ids.map((id) => line(`${INDICATORS[id].short} (percentil)`, list.map((x) => x.m.indicators.find((r) => r.id === id)?.pct ?? null), pctCell))}
        {line("Valor", list.map((x) => x.value), (v) => fmtEur(v), false)}
        {line("Valorização 12 meses", list.map((x) => x.m.trend), (v) => (v == null ? "—" : <Trend t={v} />))}
        {line("Idade", list.map((x) => x.age), (v) => (v == null ? "—" : `${v} anos`), false)}
        {line("Contrato até", list.map((x) => (x.contract ? Number(x.contract.slice(0, 7).replace("-", "")) : null)), (_, i) => list[i].contract?.split("-").slice(0, 2).reverse().join("/") ?? "—", null)}
        {line("Minutos na liga", list.map((x) => x.m.min), (v, i) => `${(v ?? 0).toLocaleString("pt-BR")} (${Math.round(list[i].m.minPct * 100)}%)`)}
        {line("Custo-benefício", list.map((x) => x.m.value4money), pctCell)}
        {line("Potencial", list.map((x) => x.m.potential), (v) => v ?? "—")}
      </div>
      {list.length < 3 && <button className="tm-btn sc-cmp__more" onClick={onRadar}>+ Adicionar do Radar ({list.length}/3)</button>}
    </section>
  );
}

// ---------- mesa lateral ----------

export function Desk({ onTab }: { onTab: (t: "shelves" | "plans" | "compare") => void }) {
  const { st, balance, depth, slug, clubName } = useScout();
  const counts = shelfCounts(st);
  const needs = depth.filter((d) => d.short > 0);
  const plans = Object.values(st.plans).reduce((t, l) => t + (l?.length ?? 0), 0);
  return (
    <div className="sc-desk-rail">
      <p className="tm-eyebrow">Saldo no Mercado</p>
      <p className={`sc-rail__bal ${balance < 0 ? "is-neg" : ""}`}>{fmtEur(balance)}{fmtRef(balance) && <small>{fmtRef(balance)}</small>}</p>
      <a className="tm-link sc-rail__link" href={`/mercado/${slug}`} onClick={spaLink(`/mercado/${slug}`)}>Abrir o mercado do {clubName} →</a>
      <div className="sc-rail__sep" />
      <p className="tm-eyebrow">Carências do elenco</p>
      {needs.length ? (
        <p className="sc-rail__needs">{needs.map((d) => <span key={d.pos} className="sc-need"><span className={`tm-pos tm-pos--${d.pos}`}>{d.pos}</span> +{d.short}</span>)}</p>
      ) : (
        <p className="sc-dim sc-small">Mínimo atingido em todas as posições.</p>
      )}
      <div className="sc-rail__sep" />
      <button className="sc-rail__btn" onClick={() => onTab("shelves")}>
        <span>Prateleiras</span>
        <span className="sc-rail__shelves">{SHELVES.map((s) => <i key={s.id} className={`sc-dotn sc-dotn--${s.id}`} title={s.label}>{counts[s.id]}</i>)}</span>
      </button>
      <button className="sc-rail__btn" onClick={() => onTab("plans")}><span>Planos</span><b>{plans}</b></button>
      <button className="sc-rail__btn" onClick={() => onTab("compare")}><span>Comparador</span><b>{st.compare.length}/3</b></button>
      <p className="sc-fine">Saldo e carências vêm do seu Mercado. Valores em {fmtRef(1) ? "euro" : "real"}, como lá.</p>
    </div>
  );
}
