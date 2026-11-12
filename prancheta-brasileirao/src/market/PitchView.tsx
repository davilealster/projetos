// Visão "Campo" do elenco: setores do campo (técnico, goleiros, zagueiros…) com carrossel de jogadores.
import "./pitch.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initials } from "../lib/color";
import type { Pos } from "../types";
import {
  ACTION_LABEL, FOREIGN_LIMIT, PRICED, actionsFor, decisionOf, fmtDate, fmtEur, fmtRef, curUnit, toUnit, fromUnit, isEnding, moneyOf, staysWith,
  type Decision, type MarketState, type SquadAction,
} from "./logic";
import { loadCoaches } from "./data";
import type { MarketCoach, SquadPlayer } from "./types";

export interface PitchViewProps {
  squad: SquadPlayer[];
  coach: MarketCoach | null;
  st: MarketState;
  setSt: React.Dispatch<React.SetStateAction<MarketState>>;
  /** null desfaz a decisão (volta ao padrão) */
  setDecision: (id: string, d: Decision | null) => void;
  /** data de corte da próxima temporada (para isEnding/actionsFor/decisionOf) */
  cutoff: string;
  colors: { primary: string; secondary: string; accent: string };
  /** próximo passo: ir ao mercado (etapa 2) */
  onMarket?: () => void;
}

/** Texto e tinta do carimbo de cada decisão (igual à lista). */
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

// ---------- setores e câmera ----------

type SectorId = "TEC" | "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "PON" | "ATA" | "FIM";
interface SectorDef { id: SectorId; name: string; pos: Pos[]; /** foco da câmera (y em metros, 0 = linha de fundo adversária) e zoom */ y: number; s: number }

const SECTORS: SectorDef[] = [
  { id: "TEC", name: "Técnico", pos: [], y: 116, s: 3.1 },
  { id: "GOL", name: "Goleiros", pos: ["GOL"], y: 101, s: 4.2 },
  { id: "ZAG", name: "Zagueiros", pos: ["ZAG"], y: 89, s: 2.6 },
  { id: "LAT", name: "Laterais", pos: ["LD", "LE"], y: 80, s: 1.75 },
  { id: "VOL", name: "Volantes", pos: ["VOL"], y: 70, s: 2.4 },
  { id: "MEI", name: "Meias", pos: ["MEI"], y: 52.5, s: 2.8 },
  { id: "PON", name: "Pontas", pos: ["PON"], y: 26, s: 1.75 },
  { id: "ATA", name: "Atacantes", pos: ["ATA"], y: 11, s: 2.6 },
];
const END: SectorDef = { id: "FIM", name: "Resumo", pos: [], y: 57, s: 1.05 };

// viewBox do campo (metros): campo 68×105 com área de escape e banco abaixo da linha de fundo
const VB = { x: -30, y: -40, w: 128, h: 210 };

function Pitch({ tint }: { tint: string }) {
  const stripes = Array.from({ length: 14 }, (_, i) => i);
  const L = { stroke: "rgba(255,255,255,0.82)", strokeWidth: 0.32, fill: "none" } as const;
  return (
    <svg className="pv-pitch" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* área de escape (passa do viewBox: o svg tem overflow visível para a câmera afastada não mostrar bordas) */}
      <rect x={-1000} y={-1000} width={2068} height={2105} fill="#123b2d" />
      {/* faixas de corte da grama */}
      {stripes.map((i) => (
        <rect key={i} x={-4} y={i * 7.5} width={76} height={7.5} fill={i % 2 ? "#1d5a41" : "#22684b"} />
      ))}
      <rect x={-4} y={-6} width={76} height={6} fill="#1a523c" />
      <rect x={-4} y={105} width={76} height={4} fill="#1a523c" />
      {/* faixa fora do campo (área técnica) */}
      <rect x={-12} y={109} width={92} height={18} fill="#163f31" />
      <rect x={-1000} y={-1000} width={2068} height={2105} fill={tint} opacity={0.09} />
      {/* linhas */}
      <g {...L}>
        <rect x={0} y={0} width={68} height={105} />
        <line x1={0} y1={52.5} x2={68} y2={52.5} />
        <circle cx={34} cy={52.5} r={9.15} />
        <rect x={13.84} y={0} width={40.32} height={16.5} />
        <rect x={24.84} y={0} width={18.32} height={5.5} />
        <path d="M 26.7 16.5 A 9.15 9.15 0 0 0 41.3 16.5" />
        <rect x={13.84} y={88.5} width={40.32} height={16.5} />
        <rect x={24.84} y={99.5} width={18.32} height={5.5} />
        <path d="M 26.7 88.5 A 9.15 9.15 0 0 1 41.3 88.5" />
        <rect x={30.34} y={-2.2} width={7.32} height={2.2} strokeWidth={0.45} />
        <rect x={30.34} y={105} width={7.32} height={2.2} strokeWidth={0.45} />
        <path d="M 0 1 A 1 1 0 0 0 1 0 M 67 0 A 1 1 0 0 0 68 1 M 0 104 A 1 1 0 0 1 1 105 M 67 105 A 1 1 0 0 1 68 104" />
        {/* área técnica */}
        <rect x={20} y={110.5} width={28} height={7} strokeDasharray="1 0.8" strokeWidth={0.28} />
      </g>
      <g fill="rgba(255,255,255,0.85)">
        <circle cx={34} cy={52.5} r={0.35} />
        <circle cx={34} cy={11} r={0.3} />
        <circle cx={34} cy={94} r={0.3} />
      </g>
      {/* bancos de reservas */}
      <g>
        <rect x={9} y={119} width={20} height={4.2} rx={0.8} fill="#0b1c16" stroke="rgba(239,230,210,0.35)" strokeWidth={0.25} />
        <rect x={39} y={119} width={20} height={4.2} rx={0.8} fill="#0b1c16" stroke="rgba(239,230,210,0.35)" strokeWidth={0.25} />
        <rect x={9.6} y={119.5} width={18.8} height={1.4} rx={0.4} fill={tint} opacity={0.75} />
        <rect x={39.6} y={119.5} width={18.8} height={1.4} rx={0.4} fill="rgba(239,230,210,0.25)" />
      </g>
    </svg>
  );
}

// ---------- peças ----------

function Face({ name, photo }: { name: string; photo: string | null }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return <img className="pv-face" src={photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="pv-face pv-face--ini" aria-hidden="true">{initials(name)}</span>;
}

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [txt, setTxt] = useState(() => String(+(toUnit(value) / 1e6).toFixed(2)).replace(".", ","));
  return (
    <label className="pv-price">
      <span>{label}</span>
      <b>{curUnit()}</b>
      <input
        inputMode="decimal"
        value={txt}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = Number(e.target.value.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(n) && n >= 0) onChange(Math.round(fromUnit(n * 1e6)));
        }}
        aria-label={`${label} em milhões de ${curUnit() === "R$" ? "reais" : "euros"}`}
      />
      <em>mi</em>
    </label>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface CarouselProps {
  count: number;
  label: string;
  children: React.ReactNode;
  onIndex: (i: number) => void;
  trackRef: React.RefObject<HTMLDivElement>;
}

/**
 * Roda do mouse sobre os cartões: rolar para baixo passa para o próximo cartão; no último,
 * vai para o setor de baixo. Rolar para cima volta; no primeiro, a página rola normalmente.
 */
function useWheelCarousel(trackRef: React.RefObject<HTMLDivElement>, count: number, indexRef: React.MutableRefObject<number>, onEnd: () => void) {
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let lock = 0;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // gesto horizontal: deixa o navegador rolar
      const down = e.deltaY > 0;
      const i = indexRef.current;
      if (!down && i <= 0) return; // no primeiro cartão, rolar para cima sobe a página
      e.preventDefault();
      const now = Date.now();
      if (now < lock) return;
      acc += e.deltaY;
      if (Math.abs(acc) < 30) return; // ignora toques mínimos do trackpad
      acc = 0;
      lock = now + 420;
      if (down && i >= count - 1) {
        lock = now + 900;
        endRef.current();
      } else scrollToCard(el, i + (down ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [trackRef, count, indexRef]);
}

function Track({ count, label, children, onIndex, trackRef }: CarouselProps) {
  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current;
      const first = el?.children[0] as HTMLElement | undefined;
      if (!el || !first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
      onIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step))));
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <div ref={trackRef} className="pv-track" tabIndex={0} role="region" aria-roledescription="carrossel" aria-label={label} onScroll={onScroll}>
      {children}
    </div>
  );
}

function scrollToCard(track: HTMLDivElement | null, i: number) {
  const card = track?.children[i] as HTMLElement | undefined;
  if (!track || !card) return;
  const left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
  track.scrollTo({ left, behavior: reduced() ? "auto" : "smooth" });
}

/** Setas laterais (computador): anterior/próximo; no último cartão, a seta aponta para baixo (próximo setor). */
function Arrows({ index, count, onGo, onNext, nextName }: { index: number; count: number; onGo: (i: number) => void; onNext: (() => void) | null; nextName: string | null }) {
  const last = index >= count - 1;
  return (
    <>
      {index > 0 && (
        <button className="pv-arrow pv-arrow--prev" onClick={() => onGo(index - 1)} aria-label="Cartão anterior">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}
      {!last ? (
        <button className="pv-arrow pv-arrow--next" onClick={() => onGo(index + 1)} aria-label="Próximo cartão">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      ) : onNext ? (
        <button className="pv-arrow pv-arrow--next pv-arrow--down" onClick={onNext} aria-label={nextName ? `Ir para ${nextName}` : "Próximo setor"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
          {nextName && <span>{nextName}</span>}
        </button>
      ) : null}
    </>
  );
}

function Dots({ count, index, done, onPick }: { count: number; index: number; done: boolean[]; onPick: (i: number) => void }) {
  if (count < 2) return null;
  return (
    <div className="pv-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} tabIndex={-1} className={`${i === index ? "is-on" : ""} ${done[i] ? "is-done" : ""}`} onClick={() => onPick(i)} />
      ))}
    </div>
  );
}

function SectorHead({ n, name, index, count, decided }: { n: number; name: string; index: number; count: number; decided: number }) {
  return (
    <header className="pv-head">
      <span className="pv-head__n">{String(n).padStart(2, "0")}</span>
      <h2 className="pv-head__name">{name}</h2>
      <span className="pv-head__meta">
        <b>{index + 1} de {count}</b>
        <i className={decided === count ? "is-all" : ""}>{decided === count ? "✓ " : ""}{decided} decidido{decided === 1 ? "" : "s"}</i>
      </span>
    </header>
  );
}

// ---------- cartão do jogador ----------

function PlayerCard({ p, st, cutoff, setDecision, onChose, active }: {
  p: SquadPlayer; st: MarketState; cutoff: string; setDecision: PitchViewProps["setDecision"]; onChose: (a: SquadAction) => void; active: boolean;
}) {
  const { options } = actionsFor(p, cutoff);
  const d = decisionOf(p, st, cutoff);
  const explicit = !!st.decisions[p.id];
  const ending = isEnding(p, cutoff);
  const leaves = !staysWith(d.action);
  const [stamp, ink] = STAMP[d.action];
  const priced = explicit && PRICED.includes(d.action);
  const money = moneyOf(p, d);
  return (
    <article className={`pv-card ${active ? "is-active" : ""} ${leaves ? "is-out" : ""} ${ending && !explicit ? "is-pending" : ""}`} aria-label={p.name}>
      <div className="pv-photo">
        <Face name={p.name} photo={p.photo} />
        {p.num != null && <span className="pv-num">{p.num}</span>}
        {p.status === "loanOut" && <span className="pv-flag">emprestado ao {p.loanClub ?? "outro clube"}</span>}
        {p.status === "loanIn" && <span className="pv-flag pv-flag--in">emprestado pelo {p.loanClub ?? "outro clube"}</span>}
        {explicit ? (
          <button key={d.action} className={`tm-stamp tm-stamp--${ink} pv-stamp`} onClick={() => setDecision(p.id, null)} title="Desfazer a decisão" aria-label={`${stamp}. Toque para desfazer`}>
            {stamp}
          </button>
        ) : ending ? (
          <span className="tm-stamp tm-stamp--amber pv-stamp pv-stamp--idle">A decidir</span>
        ) : null}
      </div>
      <div className="pv-info">
        <p className="pv-name">{p.name}</p>
        <p className="pv-tags">
          <span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span>
          {p.foreign && <span className="pv-est" title={`Estrangeiro (limite de ${FOREIGN_LIMIT} por jogo)`}>EST</span>}
          {p.age != null && <span>{p.age} anos</span>}
          <span className="pv-value">{fmtEur(p.value)}{fmtRef(p.value) && <small className="pv-ref">{fmtRef(p.value)}</small>}</span>
        </p>
        <p className={`pv-contract ${ending ? "is-ending" : ""}`}>
          {p.status === "owned" ? "Contrato até" : "Empréstimo até"} <b>{fmtDate(p.loanUntil ?? p.contract)}</b>
          {ending && <em>termina antes de {cutoff.slice(0, 4)}</em>}
        </p>
      </div>
      <div className={`pv-acts pv-acts--${options.length}`} role="group" aria-label={`Destino de ${p.name}`}>
        {options.map((a) => {
          const on = explicit && d.action === a;
          return (
            <button key={a} className={`pv-act pv-act--${STAMP[a][1]} ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => (on ? setDecision(p.id, null) : onChose(a))}>
              {ACTION_LABEL[a]}
            </button>
          );
        })}
      </div>
      {priced && (
        <div className="pv-pricerow">
          <PriceField
            key={`${p.id}:${d.action}`}
            label={d.action === "loanOut" ? "Taxa" : d.action === "sell" ? "Por" : "Custo"}
            value={d.price ?? (d.action === "loanOut" ? 0 : p.value ?? 0)}
            onChange={(v) => setDecision(p.id, { ...d, price: v })}
          />
          <b className={money >= 0 ? "is-in" : "is-out"}>{money > 0 ? "+" : ""}{fmtEur(money)}{fmtRef(money) && <small className="pv-ref"> {fmtRef(money)}</small>}</b>
        </div>
      )}
    </article>
  );
}

// ---------- técnico ----------

function CoachSector({ coach, st, setSt }: Pick<PitchViewProps, "coach" | "st" | "setSt">) {
  const [list, setList] = useState<MarketCoach[] | null>(null);
  const [q, setQ] = useState("");
  const fired = st.coach.action === "fire";
  useEffect(() => {
    if (fired && !list) void loadCoaches().then(setList);
  }, [fired, list]);
  const hired = list?.find((c) => c.id === st.coach.hire) ?? null;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matches = q.trim().length >= 2 && list ? list.filter((c) => c.id !== coach?.id && norm(`${c.name} ${c.club}`).includes(norm(q.trim()))).slice(0, 5) : [];
  const since = coach?.since ? fmtDate(coach.since) : null;
  const name = coach?.name ?? "Técnico não informado";
  return (
    <div className="pv-track pv-track--one">
      <article className={`pv-card is-active ${fired ? "is-out" : ""}`} aria-label={name}>
        <div className="pv-photo">
          <Face name={name} photo={coach?.photo ?? null} />
          <span className="pv-flag pv-flag--in">técnico</span>
          <span key={st.coach.action} className={`tm-stamp tm-stamp--${fired ? "red" : "green"} pv-stamp`}>{fired ? "Demitido" : "Mantido"}</span>
        </div>
        <div className="pv-info">
          <p className="pv-name">{name}</p>
          <p className="pv-tags">
            {coach?.age != null && <span>{coach.age} anos</span>}
            {coach?.nat && <span>{coach.nat}</span>}
          </p>
          {since && <p className="pv-contract">No cargo desde <b>{since}</b></p>}
        </div>
        <div className="pv-acts pv-acts--2" role="group" aria-label="Destino do técnico">
          <button className={`pv-act pv-act--green ${!fired ? "is-on" : ""}`} aria-pressed={!fired} onClick={() => setSt((s) => ({ ...s, coach: { action: "keep", hire: null } }))}>Mantém</button>
          <button className={`pv-act pv-act--red ${fired ? "is-on" : ""}`} aria-pressed={fired} onClick={() => setSt((s) => ({ ...s, coach: { action: "fire", hire: s.coach.hire } }))}>Demite</button>
        </div>
        {fired && (
          <div className="pv-hire">
            {hired ? (
              <p className="pv-hire__chosen">
                Novo técnico: <b>{hired.name}</b> <span>{hired.club}</span>
                <button className="tm-link" onClick={() => setSt((s) => ({ ...s, coach: { ...s.coach, hire: null } }))}>trocar</button>
              </p>
            ) : (
              <>
                <input type="search" placeholder="Contratar: nome ou clube" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar técnico para contratar" />
                {!list && <p className="pv-hire__note">Carregando técnicos…</p>}
                {matches.length > 0 && (
                  <ul className="pv-hire__list">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => (setSt((s) => ({ ...s, coach: { action: "fire", hire: c.id } })), setQ(""))}>
                          <b>{c.name}</b> <span>{c.club}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {list && q.trim().length >= 2 && !matches.length && <p className="pv-hire__note">Nenhum técnico com “{q}”.</p>}
              </>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

// ---------- setor de jogadores ----------

function Sector({ def, n, players, st, cutoff, setDecision, onSectorDone, onNext, nextName }: {
  def: SectorDef; n: number; players: SquadPlayer[]; st: MarketState; cutoff: string; setDecision: PitchViewProps["setDecision"]; onSectorDone: () => void;
  onNext: () => void; nextName: string | null;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  useWheelCarousel(trackRef, players.length, indexRef, onNext);
  const stRef = useRef(st);
  stRef.current = st;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const done = players.map((p) => !!st.decisions[p.id]);
  const choose = (i: number, p: SquadPlayer, a: SquadAction) => {
    setDecision(p.id, { action: a });
    window.clearTimeout(timer.current);
    if (PRICED.includes(a)) return;
    timer.current = window.setTimeout(() => {
      const dec = stRef.current.decisions;
      const rest = [...players.slice(i + 1), ...players.slice(0, i)];
      const nextP = rest.find((x) => !dec[x.id]);
      if (nextP) scrollToCard(trackRef.current, players.indexOf(nextP));
      else onSectorDone();
    }, 450);
  };
  return (
    <>
      <SectorHead n={n} name={def.name} index={index} count={players.length} decided={done.filter(Boolean).length} />
      <div className="pv-stage">
        <Track count={players.length} label={`${def.name}: jogadores`} onIndex={setIndex} trackRef={trackRef}>
          {players.map((p, i) => (
            <PlayerCard key={p.id} p={p} st={st} cutoff={cutoff} setDecision={setDecision} active={i === index} onChose={(a) => choose(i, p, a)} />
          ))}
        </Track>
        <Arrows index={index} count={players.length} onGo={(i) => scrollToCard(trackRef.current, i)} onNext={onNext} nextName={nextName} />
        <Dots count={players.length} index={index} done={done} onPick={(i) => scrollToCard(trackRef.current, i)} />
      </div>
    </>
  );
}

// ---------- visão ----------

export function PitchView({ squad, coach, st, setSt, setDecision, cutoff, colors, onMarket }: PitchViewProps) {
  const groups = useMemo(() => {
    const out: { def: SectorDef; players: SquadPlayer[] }[] = [{ def: SECTORS[0], players: [] }];
    for (const def of SECTORS.slice(1)) {
      const players = squad.filter((p) => def.pos.includes(p.pos)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      if (players.length) out.push({ def, players });
    }
    return out;
  }, [squad]);
  const [active, setActive] = useState<SectorId>("TEC");
  const secRefs = useRef(new Map<SectorId, HTMLElement>());
  const setSecRef = (id: SectorId) => (el: HTMLElement | null) => {
    if (el) secRefs.current.set(id, el);
    else secRefs.current.delete(id);
  };

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.sector as SectorId);
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    secRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups]);

  const jump = useCallback((id: SectorId) => {
    secRefs.current.get(id)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  }, []);

  const order: SectorId[] = [...groups.map((g) => g.def.id), "FIM"];
  const next = (id: SectorId) => order[order.indexOf(id) + 1] ?? "FIM";
  const nameOf = (id: SectorId) => (id === "FIM" ? "Resumo" : SECTORS.find((x) => x.id === id)?.name ?? null);

  const sectorOk = (players: SquadPlayer[]) => players.every((p) => !!st.decisions[p.id] || !isEnding(p, cutoff));
  const cam = active === "FIM" ? END : SECTORS.find((s) => s.id === active) ?? SECTORS[0];
  const fy = (cam.y - VB.y) / VB.h;

  // resumo
  let stay = 0, leave = 0, pending = 0, foreign = 0;
  for (const p of squad) {
    const d = decisionOf(p, st, cutoff);
    if (staysWith(d.action)) {
      stay++;
      if (p.foreign) foreign++;
    } else if (p.status !== "loanOut" || d.action === "sell") leave++;
    if (isEnding(p, cutoff) && !st.decisions[p.id]) pending++;
  }

  return (
    <div className="pv" style={{ "--pv-club": colors.primary } as React.CSSProperties}>
      <div className={`pv-bg ${active === "FIM" ? "is-end" : ""}`} aria-hidden="true">
        <div className="pv-cam" style={{ "--fy": fy, "--s": cam.s } as React.CSSProperties}>
          <Pitch tint={colors.primary} />
        </div>
        <div className="pv-scrim" />
      </div>

      <div className="pv-railwrap">
        <nav className={`pv-rail ${active === "FIM" ? "is-end" : ""}`} aria-label="Setores do campo">
          {groups.map((g) => {
            const ok = g.def.id === "TEC" ? true : sectorOk(g.players);
            return (
              <button key={g.def.id} className={`${active === g.def.id ? "is-on" : ""} ${ok ? "is-ok" : ""}`} aria-current={active === g.def.id ? "true" : undefined} onClick={() => jump(g.def.id)} title={g.def.name}>
                <span>{g.def.id}</span>
                {ok && <i aria-hidden="true">✓</i>}
              </button>
            );
          })}
        </nav>
      </div>

      {groups.map((g, i) => (
        <section key={g.def.id} ref={setSecRef(g.def.id)} data-sector={g.def.id} className={`pv-sec pv-sec--${g.def.id}`} aria-label={g.def.name}>
          {g.def.id === "TEC" ? (
            <>
              <SectorHead n={1} name="Técnico" index={0} count={1} decided={1} />
              <div className="pv-stage">
                <CoachSector coach={coach} st={st} setSt={setSt} />
                <Arrows index={0} count={1} onGo={() => {}} onNext={() => jump(next("TEC"))} nextName={nameOf(next("TEC"))} />
              </div>
            </>
          ) : (
            <Sector def={g.def} n={i + 1} players={g.players} st={st} cutoff={cutoff} setDecision={setDecision} onSectorDone={() => window.setTimeout(() => jump(next(g.def.id)), 250)} onNext={() => jump(next(g.def.id))} nextName={nameOf(next(g.def.id))} />
          )}
        </section>
      ))}

      <section ref={setSecRef("FIM")} data-sector="FIM" className="pv-sec pv-sec--FIM" aria-label="Resumo do elenco">
        <div className="pv-end">
          <p className="tm-eyebrow">Fim de campo</p>
          <h2>{pending ? "Quase lá" : "Elenco resolvido"}</h2>
          <div className="pv-end__nums">
            <p><b>{stay}</b><span>ficam</span></p>
            <p className="is-out"><b>{leave}</b><span>saem</span></p>
            <p className={pending ? "is-pending" : ""}><b>{pending}</b><span>a decidir</span></p>
          </div>
          <p className="pv-end__note">
            {foreign} estrangeiro{foreign === 1 ? "" : "s"} no elenco · até {FOREIGN_LIMIT} por jogo
            {st.coach.action === "fire" ? " · técnico demitido" : ""}
          </p>
          <div className="pv-end__acts">
            {onMarket && (
              <button className="tm-btn tm-btn--brass pv-end__go" onClick={onMarket}>
                Ir ao mercado →<small>contratar por compra, empréstimo ou de graça</small>
              </button>
            )}
            <button className="tm-btn tm-btn--ghost" onClick={() => jump("TEC")}>Voltar ao início do campo</button>
          </div>
        </div>
      </section>
    </div>
  );
}
