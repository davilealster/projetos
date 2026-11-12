// Etapa 4 do Mercado: técnico, escalação ideal em campo projetado e imagens para o story.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { initials, isLight } from "../lib/color";
import { FORMATION_NAMES, fitScore, slotsFor } from "../lib/formations";
import type { Pos } from "../types";
import {
  FOREIGN_LIMIT, HOW_TAG, MAX_BENCH, MAX_SUBS, benchSize, autoLineup, cleanLineup, fmtEur, fmtRef, lineupStats, placeInLineup, posRank, removeFromLineup,
  type Lineup, type MarketState, type NextPlayer,
} from "./logic";
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
  onSlot?: (i: number) => void;
  selected?: number | null;
}

export function Field({ lineup, byId, story = false, onSlot, selected = null }: FieldProps) {
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
            {subs.map((sp) => (
              <span key={sp.id} className="lu-slot__sub">{shortName(sp.name)}</span>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}

// ============ etapa: escalação ============

export function LineupTab({ next, st, setSt, team, coach, onGenerate }: {
  next: NextPlayer[];
  st: MarketState;
  setSt: SetSt;
  team: Team;
  coach: MarketCoach | null;
  onGenerate: (lineup: Lineup) => void;
}) {
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
        <button
          className="lu-share"
          disabled={empty > 0}
          onClick={() => onGenerate(lineup)}
          title={empty ? `Faltam ${empty} titular${empty > 1 ? "es" : ""} para compartilhar` : "Compartilhar a escalação e a janela"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
          <span>{empty ? `Faltam ${empty}` : "Compartilhar"}</span>
        </button>
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
  host: string;
}

export const StoryField = forwardRef<HTMLDivElement, StoryProps>(function StoryField({ team, lineup, byId, coach }, ref) {
  const listedIds = [...lineup.starters.filter((x): x is string => !!x), ...lineup.subs.flat()];
  const listedValue = listedIds.reduce((t, id) => t + (byId.get(id)?.value ?? 0), 0);
  const xiValue = lineup.starters.reduce((t, id) => t + ((id && byId.get(id)?.value) || 0), 0);
  const inList = new Set(listedIds);
  const outside = [...byId.values()]
    .filter((p) => p.kind !== "leave" && !inList.has(p.id))
    .sort((x, y) => posRank(x.pos) - posRank(y.pos));
  return (
    <div ref={ref} className="sty sty--field" style={{ "--sty-bg": storyBg(team.colors) } as React.CSSProperties}>
      {team.crest && <img className="sty__mark" src={team.crest} alt="" />}
      {team.crest && <img className="sty__crest" src={team.crest} alt="" />}
      <header className="sty__head">
        <p className="sty__chip">MEU ELENCO IDEAL <em>2027</em></p>
        <h2 className="sty__team">{team.shortName}</h2>
        <p className="sty__formation">{lineup.formation}</p>
      </header>
      <div className="sty__pitch"><Field lineup={lineup} byId={byId} story /></div>
      <div className="sty__coach">
        <small>TÉCNICO</small>
        <span className="sty__coach-photo"><Face name={coach?.name ?? "?"} photo={coach?.photo ?? null} story /></span>
        <b>{coach ? shortName(coach.name) : "A definir"}</b>
      </div>
      <footer className="sty__foot">
        <div className="sty-info">
          <p><span>{listedIds.length} relacionados</span><b>{money(listedValue)}</b><span>XI titular</span><b>{money(xiValue)}</b></p>
          {outside.length > 0 && (
            <p className="sty-info__out"><span>Fora da lista ({outside.length})</span> {outside.map((p) => shortName(p.name)).join(" · ")}</p>
          )}
        </div>
        <StorySeal />
      </footer>
    </div>
  );
});

export const StorySummary = forwardRef<HTMLDivElement, StoryProps & { arrivals: NextPlayer[]; leaves: NextPlayer[]; stays: NextPlayer[] }>(
  function StorySummary({ team, coach, budget, balance, arrivals, leaves, stays }, ref) {
    // ordem do quadro: quem sai, quem fica, quem chega
    const groups = [leaves, stays, arrivals].filter((g) => g.length);
    // maior foto que cabe: começa com poucas colunas e aumenta até o quadro não invadir o rodapé
    const [cols, setCols] = useState(4);
    const pw = Math.floor((540 - 48 - (cols - 1) * 8) / cols);
    const ph = Math.round(pw * 1.15);
    const root = useRef<HTMLDivElement | null>(null);
    const setRoot = (el: HTMLDivElement | null) => {
      root.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    };
    const sig = groups.map((g) => g.length).join(",");
    useLayoutEffect(() => setCols(4), [sig]);
    useLayoutEffect(() => {
      const el = root.current;
      const secs = el?.querySelectorAll<HTMLElement>(".sty-sec");
      const foot = el?.querySelector<HTMLElement>(".sty__foot");
      if (!secs?.length || !foot) return;
      const last = secs[secs.length - 1];
      if (last.offsetTop + last.offsetHeight > foot.offsetTop - 10 && cols < 12) setCols(cols + 1);
    });
    // "6 vendidos · 4 emprestados · 8 dispensados"
    const breakdown = (list: NextPlayer[]) => {
      const n = new Map<string, number>();
      for (const p of list) if (p.how && HOW_TAG[p.how]) n.set(HOW_TAG[p.how]!, (n.get(HOW_TAG[p.how]!) ?? 0) + 1);
      return n.size ? [...n].map(([k, v]) => `${v} ${(v > 1 && !k.includes(" ") ? `${k}s` : k).toLowerCase()}`).join(" · ") : null;
    };
    const sorted = (g: NextPlayer[]) => [...g].sort((a, b) => posRank(a.pos) - posRank(b.pos) || (b.value ?? 0) - (a.value ?? 0));
    const section = (title: string, list: NextPlayer[], kind: string) =>
      list.length > 0 && (
        <section className={`sty-sec sty-sec--${kind}`}>
          <h3>{title} <span>{list.length}</span>{breakdown(list) && <small>{breakdown(list)}</small>}</h3>
          <div className="sty-grid" style={{ gridTemplateColumns: `repeat(${cols}, ${pw}px)`, "--ph": `${ph}px`, "--pw": `${pw}px` } as React.CSSProperties}>
            {sorted(list).map((p) => (
              <div key={p.id} className="sty-card">
                <span className="sty-card__photo"><Face name={p.name} photo={p.photo} story /></span>
                <span className={`tm-pos tm-pos--${p.pos}`}>{p.pos}</span>
                <span className="sty-card__name">{shortName(p.name)}</span>
                {p.how && HOW_TAG[p.how] && <span className={`sty-card__how sty-how--${p.how}`}>{HOW_TAG[p.how]}</span>}
              </div>
            ))}
          </div>
        </section>
      );
    return (
      <div ref={setRoot} className="sty sty--summary" style={{ "--sty-bg": storyBg(team.colors) } as React.CSSProperties}>
        {team.crest && <img className="sty__mark sty__mark--bokeh" src={team.crest} alt="" />}
        {team.crest && <img className="sty__crest" src={team.crest} alt="" />}
        <header className="sty__head sty__head--left">
          <p className="sty__chip">JANELA DE TRANSFERÊNCIAS <em>2027</em></p>
          <h2 className="sty__team">{team.shortName}</h2>
          <p className="sty__formation sty__formation--coach">Técnico: <b>{coach?.name ?? "a definir"}</b></p>
        </header>
        {section("Saem", leaves, "out")}
        {section("Ficam", stays, "stay")}
        {section("Chegam", arrivals, "in")}
        <footer className="sty__foot">
          <p className="sty-info__money">Orçamento <b>{money(budget)}</b> · Caixa final <b>{money(balance)}</b></p>
          <StorySeal />
        </footer>
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
  const [caption, setCaption] = useState(
    `Assumi a diretoria de futebol do ${props.team.shortName} e montei a minha janela de transferências ideal pra 2027: quem sai, quem fica, quem chega e o time titular. ⚽📋\n\nE você, faria diferente? Monte o seu também 👉 https://${SITE_HOST}`,
  );
  const [copied, setCopied] = useState(false);
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão */
    }
  };
  const slug = props.team.shortName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await renderStory(fieldRef.current!);
        const b = await renderStory(sumRef.current!);
        if (!alive) return;
        setFiles([
          { name: `elenco-ideal-2027-${slug}.png`, url: URL.createObjectURL(a), blob: a },
          { name: `janela-2027-${slug}.png`, url: URL.createObjectURL(b), blob: b },
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

  const download = () =>
    files?.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.url;
        a.download = f.name;
        a.click();
      }, i * 400),
    );
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
            <label className="lu-caption">
              <span>Legenda <button type="button" className="tm-link" onClick={copyCaption}>{copied ? "copiada ✓" : "copiar"}</button></span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
            </label>
            <div className="lu-studio__acts">
              <button className="tm-btn tm-btn--brass" onClick={share}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
                Compartilhar
              </button>
              <button className="tm-btn" onClick={download}>Salvar imagens</button>
            </div>
            <p className="lu-studio__hint">A legenda é copiada ao compartilhar: é só colar no post ou no story.</p>
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
