// Etapa 4 do Mercado: técnico, escalação ideal em campo projetado e imagens para o story.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { initials, isLight } from "../lib/color";
import { FORMATION_NAMES, fitScore, slotsFor } from "../lib/formations";
import type { Pos } from "../types";
import {
  FOREIGN_LIMIT, MAX_BENCH, MAX_SUBS, benchSize, autoLineup, cleanLineup, fmtEur, fmtRef, lineupStats, placeInLineup, posRank, removeFromLineup,
  type Lineup, type MarketState, type NextPlayer,
} from "./logic";
import { spaLink } from "../brand/BrandMark";
import { loadCoaches } from "./data";
import type { MarketCoach } from "./types";

type SetSt = React.Dispatch<React.SetStateAction<MarketState>>;
interface Team { shortName: string; crest: string | null; colors: { primary: string; secondary: string; accent: string } }

/** "Facundo Colidio" → "F. Colidio"; nomes de uma palavra ficam inteiros. */
export function shortName(name: string): string {
  const parts = name.replace(/\s+/g, " ").trim().split(" ");
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  return last.length <= 2 ? name : `${parts[0][0]}. ${last}`;
}

/** Foto do Transfermarkt passa pelo /api/img para poder entrar na imagem gerada. */
const proxied = (url: string | null) => (url && /^https:\/\//.test(url) ? `/api/img?u=${encodeURIComponent(url)}` : url);

function Face({ name, photo, size, story = false }: { name: string; photo: string | null; size?: number; story?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = story ? proxied(photo) : photo;
  if (src && !broken) {
    return <img className="lu-face" src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="lu-face lu-face--ini">{initials(name)}</span>;
}

// ============ técnico ============

export function CoachCard({ coach, st, setSt }: { coach: MarketCoach | null; st: MarketState; setSt: SetSt }) {
  const [list, setList] = useState<MarketCoach[] | null>(null);
  const [q, setQ] = useState("");
  const fired = st.coach.action === "fire";
  useEffect(() => {
    if (fired && !list) void loadCoaches().then(setList);
  }, [fired, list]);
  const hired = list?.find((c) => c.id === st.coach.hire) ?? null;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matches = q.trim().length >= 2 && list ? list.filter((c) => c.id !== coach?.id && norm(`${c.name} ${c.club}`).includes(norm(q.trim()))).slice(0, 8) : [];
  const since = coach?.since ? new Date(`${coach.since}T12:00:00`).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }) : null;
  return (
    <article className={`tm-ficha lu-coach ${fired ? "is-out" : ""}`}>
      <span className="tm-ficha__photo lu-coach__photo"><Face name={coach?.name ?? "?"} photo={coach?.photo ?? null} /></span>
      <div className="tm-ficha__main">
        <p className="tm-ficha__name">{coach?.name ?? "Técnico não informado"} <span className="lu-tag">TÉCNICO</span></p>
        <p className="tm-ficha__meta">{coach?.age ? `${coach.age} anos` : ""}{coach?.nat ? ` · ${coach.nat}` : ""}{since ? ` · no cargo desde ${since}` : ""}</p>
        {fired && (
          <div className="lu-hire">
            {hired ? (
              <p className="lu-hire__chosen">
                Contratado: <b>{hired.name}</b> <span>({hired.club})</span>
                <button className="tm-link" onClick={() => setSt((s) => ({ ...s, coach: { ...s.coach, hire: null } }))}>trocar</button>
              </p>
            ) : (
              <>
                <input type="search" placeholder="Buscar técnico para contratar (nome ou clube)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar técnico" />
                {!list && <p className="tm-ficha__origin">Carregando técnicos…</p>}
                {matches.length > 0 && (
                  <ul className="lu-hire__list">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => (setSt((s) => ({ ...s, coach: { action: "fire", hire: c.id } })), setQ(""))}>
                          <b>{c.name}</b> <span>{c.club} · {c.league}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {list && q.trim().length >= 2 && !matches.length && <p className="tm-ficha__origin">Nenhum técnico com “{q}”.</p>}
              </>
            )}
          </div>
        )}
      </div>
      <div className="tm-ficha__actions">
        <button className={`tm-act tm-act--green ${!fired ? "is-on" : ""}`} aria-pressed={!fired} onClick={() => setSt((s) => ({ ...s, coach: { action: "keep", hire: null } }))}>Mantém</button>
        <button className={`tm-act tm-act--red ${fired ? "is-on" : ""}`} aria-pressed={fired} onClick={() => setSt((s) => ({ ...s, coach: { action: "fire", hire: s.coach.hire } }))}>Demite</button>
      </div>
      <span key={st.coach.action} className={`tm-stamp tm-stamp--${fired ? "red" : "green"}`}>{fired ? "Demitido" : "Mantido"}</span>
    </article>
  );
}

/** Técnico da próxima temporada (mantido, contratado ou a definir). */
export function useNextCoach(current: MarketCoach | null, st: MarketState): MarketCoach | null {
  const [list, setList] = useState<MarketCoach[] | null>(null);
  useEffect(() => {
    if (st.coach.action === "fire" && st.coach.hire && !list) void loadCoaches().then(setList);
  }, [st.coach, list]);
  if (st.coach.action === "keep") return current;
  return list?.find((c) => c.id === st.coach.hire) ?? null;
}

// ============ campo projetado ============

/**
 * Posição na tela (0..1) de cada vaga: as linhas da formação ficam igualmente espaçadas
 * (goleiro embaixo), e o campo afina no fundo como numa foto em perspectiva.
 * Linhas próximas sem jogadores lado a lado (ex.: zagueiros e laterais) viram uma só.
 */
export function projectSlots(slots: { u: number; v: number }[]): { x: number; y: number }[] {
  const order = slots.map((_, i) => i).sort((a, b) => slots[a].u - slots[b].u);
  const rows: number[][] = [];
  for (const i of order) {
    const row = rows[rows.length - 1];
    const prev = row ? slots[row[row.length - 1]] : null;
    const close = prev && slots[i].u - prev.u < 0.03;
    const mergeable = prev && slots[i].u - prev.u < 0.05 && row!.every((j) => Math.abs(slots[j].v - slots[i].v) >= 0.2);
    if (row && (close || mergeable)) row.push(i);
    else rows.push([i]);
  }
  const out: { x: number; y: number }[] = [];
  rows.forEach((row, r) => {
    const base = 0.89 - (r / Math.max(1, rows.length - 1)) * 0.77;
    const mean = row.reduce((a, j) => a + slots[j].u, 0) / row.length;
    for (const j of row) {
      const y = base - (slots[j].u - mean) * 0.8;
      const scale = 0.68 + 0.32 * y;
      out[j] = { x: 0.5 + (slots[j].v - 0.5) * 0.9 * scale, y };
    }
  });
  return out;
}

function FieldLines() {
  return (
    <svg className="lu-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="17,2 83,2 99,98 1,98" />
      <line x1="10.6" y1="50" x2="89.4" y2="50" />
      <ellipse cx="50" cy="50" rx="11" ry="4.5" />
      <polygon points="29,77 71,77 75,98 25,98" />
      <polygon points="40,90 60,90 61,98 39,98" />
      <polygon points="36,2 64,2 63.2,11 36.8,11" />
    </svg>
  );
}

interface FieldProps {
  lineup: Lineup;
  byId: Map<string, NextPlayer>;
  story?: boolean;
  /** imagem do post: o banco aparece fora do campo */
  hideSubs?: boolean;
  onSlot?: (i: number) => void;
  selected?: number | null;
}

export function Field({ lineup, byId, story = false, hideSubs = false, onSlot, selected = null }: FieldProps) {
  const slots = slotsFor(lineup.formation, false);
  const pos = projectSlots(slots);
  return (
    <div className={`lu-field ${story ? "lu-field--story" : ""}`}>
      <FieldLines />
      {slots.map((s, i) => {
        const { x, y } = pos[i];
        const p = lineup.starters[i] ? byId.get(lineup.starters[i]!) : undefined;
        const subs = lineup.subs[i].map((id) => byId.get(id)).filter((x): x is NextPlayer => !!x);
        const Tag = onSlot ? "button" : "div";
        return (
          <Tag
            key={i}
            className={`lu-slot ${selected === i ? "is-on" : ""} ${p ? "" : "is-empty"}`}
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            {...(onSlot ? { onClick: () => onSlot(i), "aria-label": `${s.role}: ${p?.name ?? "vaga vazia"}` } : {})}
          >
            <span className="lu-slot__photo">
              {p ? <Face name={p.name} photo={p.photo} story={story} /> : <span className="lu-face lu-face--empty">{s.role}</span>}
            </span>
            <span className="lu-slot__name">{p ? shortName(p.name) : "Escolher"}</span>
            {!hideSubs && subs.map((sp) => (
              <span key={sp.id} className="lu-slot__sub">{shortName(sp.name)}</span>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}

// ============ etapa: escalação ============

/** Assinatura opcional dos posts ("Criado por …"), uma para todos os clubes. */
const AUTHOR_KEY = "mando:assinatura";
export function getAuthor(): string {
  try {
    return (localStorage.getItem(AUTHOR_KEY) ?? "").trim().slice(0, 28);
  } catch {
    return "";
  }
}
function useAuthor(): [string, (v: string) => void] {
  const [v, setV] = useState(getAuthor);
  return [
    v,
    (x: string) => {
      const t = x.slice(0, 28);
      setV(t);
      try {
        if (t.trim()) localStorage.setItem(AUTHOR_KEY, t.trim());
        else localStorage.removeItem(AUTHOR_KEY);
      } catch {
        /* sem storage */
      }
    },
  ];
}

/** Ícone de compartilhar: três nós ligados. */
function ShareIcon() {
  return (
    <span className="lu-share-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
      </svg>
    </span>
  );
}

/** Botão de compartilhar. "bar" = ao lado das abas (computador); o outro, só ícone, ao lado da assinatura (celular). */
function ShareButton({ bar = false, empty, onClick }: { bar?: boolean; empty: number; onClick: () => void }) {
  const title = empty ? `Faltam ${empty} titular${empty > 1 ? "es" : ""} no elenco ideal` : "Compartilhar as 2 imagens com legenda";
  return (
    <button type="button" className={`lu-share ${bar ? "lu-share--bar" : "lu-share--icon"}`} disabled={empty > 0} onClick={onClick} title={title} aria-label={title}>
      <ShareIcon />
      {bar && (
        <span className="lu-share__txt">
          <b>{empty ? `Faltam ${empty} titular${empty > 1 ? "es" : ""}` : "Compartilhar"}</b>
        </span>
      )}
    </button>
  );
}

export function LineupTab({ slug, next, st, setSt, team, coach, balance, income, spend, onGenerate }: {
  slug: string;
  next: NextPlayer[];
  st: MarketState;
  setSt: SetSt;
  team: Team;
  coach: MarketCoach | null;
  balance: number;
  income: number;
  spend: number;
  onGenerate: (lineup: Lineup) => void;
}) {
  const [author, setAuthor] = useAuthor();
  const [view, setView] = useState<"summary" | "field">("summary");
  const players = useMemo(() => next.filter((p) => p.kind !== "leave"), [next]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const lineup = useMemo(() => {
    const ids = new Set(players.map((p) => p.id));
    return st.lineup && st.lineup.formation === st.formation ? cleanLineup(st.lineup, ids) : autoLineup(st.formation, players);
  }, [st.lineup, st.formation, players]);
  const [slot, setSlot] = useState<number | null>(null);
  const stats = lineupStats(lineup, byId);
  const placed = new Set([...lineup.starters.filter(Boolean), ...lineup.subs.flat()] as string[]);
  const outside = players.filter((p) => !placed.has(p.id)).sort((a, b) => posRank(a.pos) - posRank(b.pos));
  const save = (l: Lineup) => setSt((s) => ({ ...s, lineup: l }));
  const empty = lineup.starters.filter((x) => !x).length;

  return (
    <section className="lu">
      <div className="lu-bar">
        <div className="lu-views" role="tablist" aria-label="O que compartilhar">
          <button role="tab" aria-selected={view === "summary"} className={view === "summary" ? "is-on" : ""} onClick={() => setView("summary")}>Resumo da janela</button>
          <button role="tab" aria-selected={view === "field"} className={view === "field" ? "is-on" : ""} onClick={() => setView("field")}>Meu elenco ideal</button>
        </div>
        <ShareButton bar empty={empty} onClick={() => onGenerate(lineup)} />
      </div>
      <label className="lu-sign">
        <span className="lu-sign__head">
          <span>Assinar os posts</span>
          {!empty && (
            <em className="lu-sign__hint" aria-hidden="true">
              Compartilhe com seus amigos
              <svg viewBox="0 0 28 22"><path d="M2 4c9 0 17 3 21 13" /><path d="M18 14l5 4 2-6" /></svg>
            </em>
          )}
        </span>
        <span className="lu-sign__row">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Seu nome (opcional)" maxLength={28} />
          <ShareButton empty={empty} onClick={() => onGenerate(lineup)} />
        </span>
        <small>{author.trim() ? `Aparece “Criado por ${author.trim()}”` : "Sem nome, não aparece nada"}</small>
      </label>
      {view === "summary" && (
        <SummaryPreview
          props={{ team, lineup, byId: new Map(next.map((p) => [p.id, p])), coach, budget: st.budget, balance, income, spend, host: location.host, author: author.trim() }}
          summary={{ arrivals: next.filter((p) => p.kind === "new"), leaves: next.filter((p) => p.kind === "leave"), stays: next.filter((p) => p.kind === "stay") }}
        />
      )}
      {view === "field" && <>
      <div className="lu-formations" role="group" aria-label="Formação">
        {FORMATION_NAMES.map((f) => (
          <button key={f} className={st.formation === f ? "is-on" : ""} aria-pressed={st.formation === f} onClick={() => setSt((s) => ({ ...s, formation: f, lineup: null }))}>{f}</button>
        ))}
      </div>
      <p className="lu-help">
        <span>Toque numa posição para trocar o titular ou os reservas (até {MAX_SUBS} por posição, {MAX_BENCH} no banco).</span>
        {st.lineup && <button className="tm-link" onClick={() => setSt((s) => ({ ...s, lineup: null }))}>Remontar automático</button>}
      </p>
      {stats.foreign > FOREIGN_LIMIT && (
        <p className="lu-warn">⚠ {stats.foreign} estrangeiros entre os {stats.listed} relacionados: em {"2027"} o limite é {FOREIGN_LIMIT} por jogo.</p>
      )}
      <div className="lu-board" style={{ "--lu-bg": storyBg(team.colors) } as React.CSSProperties}>
        {team.crest && <img className="lu-board__mark" src={team.crest} alt="" aria-hidden="true" />}
        <p className="lu-board__title">Meu elenco ideal <em>2027</em></p>
        <Field lineup={lineup} byId={byId} onSlot={setSlot} selected={slot} />
        <div className="lu-board__coach">
          <small>Técnico</small>
          <b>{coach?.name ?? "A definir"}</b>
        </div>
      </div>
      <div className="lu-foot">
        <div><span>Valor do XI</span><b>{fmtEur(stats.xiValue)}</b>{fmtRef(stats.xiValue) && <small className="tm-ref">{fmtRef(stats.xiValue)}</small>}</div>
        <div><span>Relacionados</span><b>{stats.listed}/{11 + MAX_BENCH}</b></div>
        <div className={stats.foreign > FOREIGN_LIMIT ? "is-over" : ""}><span>Estrangeiros</span><b>{stats.foreign}/{FOREIGN_LIMIT}</b></div>
      </div>
      {outside.length > 0 && (
        <p className="lu-outside"><b>Fora da lista ({outside.length}):</b> {outside.map((p) => shortName(p.name)).join(", ")}</p>
      )}
      </>}

      <a className="lu-board-link" href={`/${slug}`} onClick={spaLink(`/${slug}`)}>Desenhar a tática deste time na prancheta →</a>

      {slot !== null && (
        <SlotPicker
          slotIndex={slot}
          role={slotsFor(lineup.formation, true)[slot].role}
          lineup={lineup}
          players={players}
          onClose={() => setSlot(null)}
          onPlace={(id, as) => save(placeInLineup(lineup, id, slot, as))}
          onRemove={(id) => save(removeFromLineup(lineup, id))}
        />
      )}
    </section>
  );
}

function SlotPicker({ slotIndex, role, lineup, players, onClose, onPlace, onRemove }: {
  slotIndex: number; role: Pos; lineup: Lineup; players: NextPlayer[]; onClose: () => void;
  onPlace: (id: string, as: "starter" | "sub") => void; onRemove: (id: string) => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const where = (id: string) => {
    const s = lineup.starters.indexOf(id);
    if (s >= 0) return s === slotIndex ? "titular aqui" : "titular em outra posição";
    const r = lineup.subs.findIndex((x) => x.includes(id));
    if (r >= 0) return r === slotIndex ? "reserva aqui" : "reserva em outra posição";
    return "fora da lista";
  };
  const sorted = [...players].sort((a, b) => fitScore({ pos: a.pos }, role) - fitScore({ pos: b.pos }, role) || (b.value ?? 0) - (a.value ?? 0));
  const subsFull = lineup.subs[slotIndex].length >= MAX_SUBS || benchSize(lineup.subs) >= MAX_BENCH;
  return (
    <div className="lu-sheet" role="dialog" aria-label={`Escolher ${role}`} onClick={onClose}>
      <div className="lu-sheet__body" onClick={(e) => e.stopPropagation()}>
        <div className="tm-ledger lu-picker">
          <button className="tm-sheet__close" onClick={onClose} aria-label="Fechar">×</button>
          <p className="tm-eyebrow">Posição</p>
          <h3><span className={`tm-pos tm-pos--${role}`}>{role}</span> Quem joga aqui?</h3>
          <ul>
            {sorted.map((p) => {
              const w = where(p.id);
              const here = w.endsWith("aqui");
              return (
                <li key={p.id} className={here ? "is-here" : ""}>
                  <span className="lu-picker__face"><Face name={p.name} photo={p.photo} /></span>
                  <span className="lu-picker__who">
                    <b>{p.name}</b>
                    <small><span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span> {w}{p.foreign ? " · estrangeiro" : ""}</small>
                  </span>
                  <span className="lu-picker__acts">
                    {w !== "titular aqui" && <button className="tm-btn tm-btn--brass" onClick={() => (onPlace(p.id, "starter"), onClose())}>Titular</button>}
                    {w !== "reserva aqui" && w !== "titular aqui" && <button className="tm-btn" disabled={subsFull} onClick={() => onPlace(p.id, "sub")}>Reserva</button>}
                    {here && <button className="tm-btn tm-btn--ghost" onClick={() => onRemove(p.id)}>Tirar</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============ imagens para o story (540×960, exportadas em 1080×1920) ============

/** Fundo da imagem: cor principal; clubes de camisa clara usam a secundária. */
export function storyBg(c: Team["colors"]): string {
  if (!isLight(c.primary)) return c.primary;
  if (!isLight(c.secondary)) return c.secondary;
  return "#1b1b1b";
}

/** Endereço divulgado nas imagens e na legenda. */
export const SITE_HOST = "meuelencofc.com.br";

/** Selo do rodapé das imagens: limpo e contrastante, chama quem vê para montar o seu. */
function StorySeal() {
  return (
    <div className="sty-seal">
      <img src="/brand/escudo@2x.png" alt="" />
      <div>
        <small>Modo Diretor de Futebol</small>
        <b>Monte o seu em <u>{SITE_HOST}</u></b>
      </div>
    </div>
  );
}

const money = (v: number) => fmtEur(v).replace(" mi", "M").replace("€ ", "€").replace("R$ ", "R$");

interface StoryProps {
  team: Team;
  lineup: Lineup;
  byId: Map<string, NextPlayer>;
  coach: MarketCoach | null;
  budget: number;
  balance: number;
  /** entradas (vendas e taxas de empréstimo) e gastos da janela */
  income: number;
  spend: number;
  host: string;
  /** "Criado por …" (opcional, digitado pelo usuário) */
  author?: string;
}

const sortPos = (g: NextPlayer[]) => [...g].sort((a, b) => posRank(a.pos) - posRank(b.pos) || (b.value ?? 0) - (a.value ?? 0));

/** Ficha da imagem: foto, posição no canto e nome embaixo. */
function StoryCard({ p, grey = false }: { p: NextPlayer; grey?: boolean }) {
  return (
    <div className={`sx-card ${grey ? "is-grey" : ""}`}>
      <span className="sx-card__photo"><Face name={p.name} photo={p.photo} story /><i className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</i></span>
      <span className="sx-card__name">{shortName(p.name)}</span>
    </div>
  );
}

/**
 * Ajusta o tamanho das fichas (--w) até o conteúdo terminar antes do selo do rodapé.
 * Começa grande e diminui; recomeça quando a lista muda.
 */
function useFit(sig: string, max: number, min: number, lastSel: string) {
  // k = quantos passos foram necessários: primeiro diminui as fichas, depois (quem quiser) o resto
  const [k, setK] = useState(0);
  const w = Math.max(min, max - 3 * k);
  const extra = Math.max(0, k - Math.ceil((max - min) / 3));
  const root = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => setK(0), [sig, max]);
  useLayoutEffect(() => {
    const el = root.current;
    const last = el?.querySelector<HTMLElement>(lastSel);
    const seal = el?.querySelector<HTMLElement>(".sty-seal");
    if (!el || !last || !seal) return;
    const bottom = last.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
    const top = seal.getBoundingClientRect().top - el.getBoundingClientRect().top;
    if (bottom > top - 8 && k < 30) setK(k + 1); // até 30 passos (o React limita atualizações em cadeia)
  });
  return { w, extra, root };
}
const mergeRef = <T,>(a: React.MutableRefObject<T | null>, b: React.ForwardedRef<T>) => (el: T | null) => {
  a.current = el;
  if (typeof b === "function") b(el);
  else if (b) b.current = el;
};

export const StoryField = forwardRef<HTMLDivElement, StoryProps>(function StoryField({ team, lineup, byId, coach, author }, ref) {
  const listedIds = [...lineup.starters.filter((x): x is string => !!x), ...lineup.subs.flat()];
  const listedValue = listedIds.reduce((t, id) => t + (byId.get(id)?.value ?? 0), 0);
  const xiValue = lineup.starters.reduce((t, id) => t + ((id && byId.get(id)?.value) || 0), 0);
  const inList = new Set(listedIds);
  const bench = sortPos(lineup.subs.flat().map((id) => byId.get(id)).filter((x): x is NextPlayer => !!x));
  const outside = sortPos([...byId.values()].filter((p) => p.kind !== "leave" && !inList.has(p.id)));
  // fichas do banco de 44 até 34 px; se ainda não couber, o campo encolhe
  const { w, extra, root } = useFit(`${bench.length}/${outside.length}/${author ?? ""}`, 44, 34, ".sx-vals");
  return (
    <div ref={mergeRef(root, ref)} className="sty sty--field sx" style={{ "--sty-bg": storyBg(team.colors), "--w": `${w}px`, "--pitch": `${Math.max(300, 392 - extra * 12)}px` } as React.CSSProperties}>
      {team.crest && <img className="sty__mark" src={team.crest} alt="" />}
      {team.crest && <img className="sty__crest" src={team.crest} alt="" />}
      <header className="sty__head">
        <p className="sty__chip">MEU ELENCO IDEAL <em>2027</em></p>
        <h2 className="sty__team">{team.shortName}</h2>
        <p className="sty__formation">{lineup.formation.split("").join(" ")}{author && <span className="sx-author"> · Criado por <b>{author}</b></span>}</p>
      </header>
      <p className="sx-coach"><small>TÉCNICO</small><b>{coach?.name ?? "A definir"}</b></p>
      <div className="sx-pitch"><Field lineup={lineup} byId={byId} story hideSubs /></div>
      <section className="sx-box sx-box--bench">
        <h3>Banco de reservas <em>{bench.length}</em><span>Relacionados para o jogo</span></h3>
        <div className="sx-grid">{bench.map((p) => <StoryCard key={p.id} p={p} />)}</div>
      </section>
      {outside.length > 0 && (
        <section className="sx-box sx-box--out">
          <h3>Fora da lista <em>{outside.length}</em><span>Não relacionados</span></h3>
          <div className="sx-grid">{outside.map((p) => <StoryCard key={p.id} p={p} grey />)}</div>
        </section>
      )}
      <div className="sx-vals">
        <div><small>Valor dos {listedIds.length} relacionados</small><b>{money(listedValue)}</b></div>
        <div><small>Valor do XI titular</small><b>{money(xiValue)}</b></div>
      </div>
      <StorySeal />
    </div>
  );
});

type Group = [key: string, label: string, color: string];
const OUT_GROUPS: Group[] = [["sell", "Vendidos", "#d0321e"], ["loanOut", "Emprestados", "#2860c4"], ["release", "Dispensados", "#8e2a5a"], ["letGo", "Fim de contrato", "#6b6458"], ["returnLoan", "Devolvidos", "#6b6458"]];
const IN_GROUPS: Group[] = [["buy", "Compras", "#1f8a4c"], ["loan", "Empréstimos", "#2860c4"], ["free", "Livres", "#b07612"]];

export const StorySummary = forwardRef<HTMLDivElement, StoryProps & { arrivals: NextPlayer[]; leaves: NextPlayer[]; stays: NextPlayer[] }>(
  function StorySummary({ team, coach, budget, balance, income, spend, author, arrivals, leaves, stays }, ref) {
    const { w, root } = useFit(`${leaves.length}/${arrivals.length}/${stays.length}`, 40, 22, ".sx-lane:last-of-type");
    const sum = (l: NextPlayer[]) => l.reduce((t, p) => t + (p.money ?? 0), 0);
    const lane = (title: string, kind: string, list: NextPlayer[], groups: Group[] | null, cash: string | null) =>
      list.length > 0 && (
        <section className={`sx-lane sx-lane--${kind}`}>
          <h3>{title} <em>{list.length}</em>{cash && <span>{cash}</span>}</h3>
          {groups ? (
            groups.map(([key, label, color]) => {
              const g = sortPos(list.filter((p) => p.how === key));
              if (!g.length) return null;
              const m = sum(g);
              return (
                <div key={key} className="sx-row">
                  <p className="sx-row__lab"><b style={{ background: color }}>{label}</b><span>{g.length}{m ? <> · <em className={kind === "in" ? "is-cost" : "is-gain"}>{kind === "in" ? "−" : "+"}{money(m)}</em></> : kind === "in" && key === "free" ? " · €0" : ""}</span></p>
                  <div className="sx-faces">{g.map((p) => <StoryCard key={p.id} p={p} grey={kind === "out"} />)}</div>
                </div>
              );
            })
          ) : (
            (() => {
              const bought = sortPos(list.filter((p) => p.how === "buyOut"));
              const rest = sortPos(list.filter((p) => p.how !== "buyOut"));
              if (!bought.length) return <div className="sx-faces sx-faces--stay">{rest.map((p) => <StoryCard key={p.id} p={p} />)}</div>;
              return (
                <>
                  <div className="sx-row">
                    <p className="sx-row__lab"><b style={{ background: "#1f8a4c" }}>Compra definitiva</b><span>{bought.length} · <em className="is-cost">−{money(sum(bought))}</em></span></p>
                    <div className="sx-faces">{bought.map((p) => <StoryCard key={p.id} p={p} />)}</div>
                  </div>
                  <div className="sx-row">
                    <p className="sx-row__lab"><b style={{ background: "#6b6458" }}>Permanecem</b><span>{rest.length}</span></p>
                    <div className="sx-faces">{rest.map((p) => <StoryCard key={p.id} p={p} />)}</div>
                  </div>
                </>
              );
            })()
          )}
        </section>
      );
    return (
      <div ref={mergeRef(root, ref)} className="sty sty--summary sx" style={{ "--sty-bg": storyBg(team.colors), "--w": `${w}px` } as React.CSSProperties}>
        {team.crest && <img className="sty__mark sty__mark--bokeh" src={team.crest} alt="" />}
        {team.crest && <img className="sty__crest" src={team.crest} alt="" />}
        <header className="sty__head sty__head--left">
          <p className="sty__chip">MINHA JANELA DE TRANSFERÊNCIAS <em>2027</em></p>
          <h2 className="sty__team">{team.shortName}</h2>
          <p className="sty__formation sty__formation--coach">Técnico: <b>{coach?.name ?? "a definir"}</b>{author && <> · Criado por <b>{author}</b></>}</p>
        </header>
        <div className="sx-money">
          <div className="is-in"><small>Entrou (vendas)</small><b>+{money(income)}</b></div>
          <div className="is-out"><small>Investido</small><b>−{money(spend)}</b></div>
          <div className="is-bal"><small>Saldo em caixa</small><b>{money(balance)}</b></div>
        </div>
        <p className="sx-ctx">Orçamento {money(budget)} · {leaves.length} saídas · {arrivals.length} chegadas · {stays.length} ficam</p>
        {lane("Saem", "out", leaves, OUT_GROUPS, income ? `+${money(sum(leaves))}` : null)}
        {lane("Chegam", "in", arrivals, IN_GROUPS, `−${money(sum(arrivals))}`)}
        {lane("Ficam", "stay", stays, null, stays.some((p) => p.how === "buyOut") ? `−${money(sum(stays.filter((p) => p.how === "buyOut")))}` : null)}
        <StorySeal />
      </div>
    );
  },
);

/** Espera as imagens do elemento carregarem (ou falharem, caindo nas iniciais). */
async function settle(el: HTMLElement) {
  for (let i = 0; i < 3; i++) {
    const imgs = [...el.querySelectorAll("img")];
    await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => ((im.onload = r), (im.onerror = r))))));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  await document.fonts?.ready;
}

export async function renderStory(el: HTMLElement): Promise<Blob> {
  await settle(el);
  // includeQueryParams: sem isso o html-to-image usa a mesma foto para todo /api/img?u=…
  const blob = await toBlob(el, { pixelRatio: 2, cacheBust: false, includeQueryParams: true, width: 540, height: 960 });
  if (!blob) throw new Error("falha ao gerar a imagem");
  return blob;
}

/** A arte do resumo da janela, na tela, do jeito que vai sair na imagem (escala para caber). */
function SummaryPreview({ props, summary }: { props: StoryProps; summary: { arrivals: NextPlayer[]; leaves: NextPlayer[]; stays: NextPlayer[] } }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / 540));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="lu-preview" ref={box} style={{ height: 960 * scale }}>
      <div className="lu-preview__art" style={{ transform: `scale(${scale})` }}>
        <StorySummary {...props} {...summary} />
      </div>
    </div>
  );
}

/** Monta as duas imagens fora da tela e mostra a prévia com salvar/compartilhar. */
export function StoryStudio({ props, summary, onClose }: {
  props: StoryProps;
  summary: { arrivals: NextPlayer[]; leaves: NextPlayer[]; stays: NextPlayer[] };
  onClose: () => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const sumRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<{ name: string; url: string; blob: Blob }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // a legenda vai junto ao compartilhar (sem campo na tela)
  const caption = (
    `Assumi a diretoria de futebol do ${props.team.shortName} e montei a minha janela de transferências ideal pra 2027: quem sai, quem fica, quem chega e o time titular. ⚽📋\n\nE você, faria diferente? Monte o seu também 👉 https://${SITE_HOST}`
  );
  /** Alguns apps (ex.: Instagram) ignoram o texto do compartilhamento: a legenda também fica copiada, em silêncio. */
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      /* sem permissão */
    }
  };
  const slug = props.team.shortName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await renderStory(sumRef.current!);
        const a = await renderStory(fieldRef.current!);
        if (!alive) return;
        setFiles([
          { name: `janela-2027-${slug}.png`, url: URL.createObjectURL(b), blob: b },
          { name: `elenco-ideal-2027-${slug}.png`, url: URL.createObjectURL(a), blob: a },
        ]);
      } catch (e) {
        console.error(e);
        if (alive) setError("Não foi possível gerar as imagens. Tente de novo.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);
  useEffect(() => () => files?.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const download = () => (void copyCaption(), files?.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.url;
        a.download = f.name;
        a.click();
      }, i * 400),
    ));
  const share = async () => {
    if (!files) return;
    const list = files.map((f) => new File([f.blob], f.name, { type: "image/png" }));
    // alguns apps (ex.: Instagram) ignoram o texto: a legenda também vai para a área de transferência
    await copyCaption();
    try {
      if (navigator.canShare?.({ files: list })) await navigator.share({ files: list, text: caption, title: `Meu ${props.team.shortName} 2027` });
      else download();
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="tm-modal lu-studio" role="dialog" aria-label="Imagens para o story">
      <div className="lu-studio__box">
        <button className="tm-sheet__close" onClick={onClose} aria-label="Fechar">×</button>
        <p className="tm-eyebrow">Para o story · 2 imagens · 1080 × 1920</p>
        {error && <p className="lu-warn">{error}</p>}
        {!files && !error && <p className="lu-studio__wait">Montando as imagens…</p>}
        {files && (
          <>
            <div className="lu-studio__previews">
              {files.map((f) => <img key={f.name} src={f.url} alt={f.name} />)}
            </div>
            <div className="lu-studio__acts">
              <button className="tm-btn tm-btn--brass" onClick={share}>
                <ShareIcon />
                Compartilhar
              </button>
              <button className="tm-btn" onClick={download}>Salvar imagens</button>
            </div>
          </>
        )}
      </div>
      {/* fora da tela: as peças que viram imagem */}
      <div className="lu-offscreen" aria-hidden="true">
        <StoryField ref={fieldRef} {...props} />
        <StorySummary ref={sumRef} {...props} {...summary} />
      </div>
    </div>
  );
}
