import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadTeam, teamSummary } from "../data";
import { navigate, params } from "../router";
import { clubVars, labelName, textOn } from "../lib/color";
import type { DragPayload } from "../lib/drag";
import { FORMATION_NAMES, applyFormation, applyOppNumbers, mirror, slotsFor } from "../lib/formations";
import { emptyState, encodeState, getPref, loadSaved, readHashState, save, setPref } from "../lib/state";
import { exportImage } from "../lib/exportImage";
import { cleanHandle, referral, trackEvent } from "../lib/analytics";
import { applyTeam, loadOverrides } from "../lib/overrides";
import type { BoardState, Drawing, DrawTool, Player, Point, Pos, Team, Token } from "../types";
import { Avatar } from "./Avatar";
import { DrawControls, FormationButtons } from "./Controls";
import { ExportCard, type ExportFormat } from "./ExportCard";
import { Footer } from "./Footer";
import { RolePicker } from "./RolePicker";
import { OpponentPanel } from "./OpponentPanel";
import { Pitch, type PitchHandle, type TokenRender } from "./Pitch";
import { Scoreboard } from "./Scoreboard";
import { SquadPanel } from "./SquadPanel";

type Snap = Pick<BoardState, "tokens" | "drawings" | "subs">;
type Bg = "grass" | "solid" | "chroma" | "transparent";
type Ratio = "16x9" | "9x16";
type Size = "P" | "M" | "G";
const SIZE_SCALE: Record<Size, number> = { P: 0.85, M: 1.1, G: 1.4 };

/** distância em metros entre dois pontos canônicos */
const meters = (a: Point, b: Point) => Math.hypot((a.u - b.u) * 105, (a.v - b.v) * 68);
const sameToken = (a: Token, b: { kind: string; ref: number }) => a.kind === b.kind && a.ref === b.ref;
const hasOpp = (tokens: Token[]) => tokens.some((t) => t.kind === "opp" || t.kind === "oppPlayer");

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export function Board({ slug, live }: { slug: string; live: boolean }) {
  const summary = teamSummary(slug);
  const [team, setTeam] = useState<Team | null>(null);
  const [opp, setOpp] = useState<Team | null>(null);
  const [state, setState] = useState<BoardState | null>(null);
  const [shared, setShared] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool | null>(null);
  const [lastTool, setLastTool] = useState<DrawTool>("arrow");
  const [drawColor, setDrawColor] = useState("#FFD400");
  const [tab, setTab] = useState<"squad" | "opp">("squad");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const tokenCount = state?.tokens.length;
  useEffect(() => setPicker(null), [tokenCount]);
  const undoStack = useRef<Snap[]>([]);
  const dragSnap = useRef<Snap | null>(null);
  const pitchRef = useRef<PitchHandle>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exportFmt, setExportFmt] = useState<ExportFormat | null>(null);
  const narrow = useMedia("(max-width: 760px)");

  // ---- parâmetros do Modo Live ----
  const qp = params();
  const [bg, setBg] = useState<Bg>((qp.get("bg") as Bg) || "grass");
  const [ratio, setRatio] = useState<Ratio>(qp.get("ratio") === "9x16" ? "9x16" : "16x9");
  const [size, setSize] = useState<Size>((qp.get("size") as Size) || "M");
  const [safe, setSafe] = useState(qp.get("safe") === "1");
  const [uiHidden, setUiHidden] = useState(qp.get("ui") === "0");
  const [showScore, setShowScore] = useState(qp.get("score") === "1");
  const [showSubs, setShowSubs] = useState(false);
  const [drawer, setDrawer] = useState<"squad" | "opp" | null>(null);
  // Seu @ (de quem está usando). No Modo Live, ?creator= define o @; fora dele, ?creator= é só a origem da visita.
  const [creator, setCreator] = useState(() => cleanHandle((live && qp.get("creator")) || getPref("creator")));
  const [solid, setSolid] = useState(qp.get("color") ? `#${qp.get("color")}` : "#0E1A13");

  useEffect(() => setPref("creator", cleanHandle(creator)), [creator]);
  useEffect(() => {
    document.documentElement.classList.toggle("bg-transparent", live && bg === "transparent");
    return () => document.documentElement.classList.remove("bg-transparent");
  }, [live, bg]);

  // ---- carregar time + estado ----
  useEffect(() => {
    let alive = true;
    setTeam(null);
    setState(null);
    undoStack.current = [];
    const loading = loadTeam(slug);
    if (!loading) return;
    const p = Promise.all([loading, loadOverrides()]).then(([t, doc]) => applyTeam(t, doc));
    p.then((t) => {
      if (!alive) return;
      const ids = new Set(t.players.map((x) => x.id));
      const fromHash = readHashState();
      let s = fromHash ?? loadSaved(slug);
      if (s) {
        s = { ...s, tokens: s.tokens.filter((x) => x.kind !== "player" || ids.has(x.ref)) };
      } else {
        const base = emptyState();
        s = { ...base, tokens: [...base.tokens, ...applyFormation({ formation: "4-3-3", kind: "player", squad: t.players, current: [], fullPitch: true })] };
      }
      setShared(!!fromHash);
      setTeam(t);
      setState(s);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    const p = state?.oppSlug ? loadTeam(state.oppSlug) : null;
    if (!p) return setOpp(null);
    let alive = true;
    Promise.all([p, loadOverrides()]).then(([t, doc]) => alive && setOpp(applyTeam(t, doc)));
    return () => {
      alive = false;
    };
  }, [state?.oppSlug]);

  useEffect(() => {
    if (state && !shared) save(slug, state);
  }, [slug, state, shared]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // ---- mutações com histórico ----
  const snap = (s: BoardState): Snap => ({ tokens: s.tokens, drawings: s.drawings, subs: s.subs });
  const commit = useCallback((fn: (s: BoardState) => BoardState) => {
    setState((s) => {
      if (!s) return s;
      undoStack.current = [...undoStack.current.slice(-49), snap(s)];
      return fn(s);
    });
  }, []);
  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev) setState((s) => (s ? { ...s, ...prev } : s));
  }, []);

  const playersById = useMemo(() => new Map(team?.players.map((p) => [p.id, p]) ?? []), [team]);
  const oppById = useMemo(() => new Map(opp?.players.map((p) => [p.id, p]) ?? []), [opp]);

  const setFormation = useCallback(
    (f: string) => {
      if (!team) return;
      commit((s) => ({
        ...s,
        formation: f,
        tokens: [
          ...s.tokens.filter((t) => t.kind !== "player"),
          ...applyFormation({ formation: f, kind: "player", squad: team.players, current: s.tokens, fullPitch: !hasOpp(s.tokens) }),
        ],
      }));
    },
    [team, commit],
  );

  /** Escala o adversário na formação atual (espelhada) e recua o time da casa para a própria metade. */
  const lineUpOpp = () =>
    commit((s) => {
      if (!team) return s;
      const oppTokens =
        s.oppSlug && opp
          ? applyFormation({ formation: s.formation, kind: "oppPlayer", squad: opp.players, current: s.tokens, mirrored: true })
          : applyOppNumbers(s.formation);
      const home = applyFormation({ formation: s.formation, kind: "player", squad: team.players, current: s.tokens });
      const ball = s.tokens.filter((t) => t.kind === "ball");
      return { ...s, tokens: [...ball, ...home, ...oppTokens] };
    });

  const clearField = useCallback(
    () => commit((s) => ({ ...s, tokens: [{ kind: "ball", ref: 0, u: 0.5, v: 0.5 }], subs: [] })),
    [commit],
  );
  const eraseDrawings = useCallback(() => commit((s) => ({ ...s, drawings: [] })), [commit]);

  // ---- soltar do painel no campo (com substituição) ----
  const onPanelDrop = (payload: DragPayload, x: number, y: number) => {
    const p = pitchRef.current?.toCanon(x, y);
    if (!p) return;
    commit((s) => {
      const tokens = [...s.tokens];
      const existing = tokens.findIndex((t) => sameToken(t, payload));
      if (existing >= 0) {
        tokens[existing] = { ...tokens[existing], ...p };
        return { ...s, tokens };
      }
      if (payload.kind === "player" || payload.kind === "oppPlayer") {
        const target = tokens
          .map((t, i) => [t, i] as const)
          .filter(([t]) => t.kind === payload.kind && meters(t, p) < 4.5)
          .sort((a, b) => meters(a[0], p) - meters(b[0], p))[0];
        if (target) {
          const [t, i] = target;
          tokens[i] = { ...t, ref: payload.ref };
          setToast("Substituição feita");
          return { ...s, tokens, subs: [...s.subs, { out: t.ref, in: payload.ref }] };
        }
      }
      return { ...s, tokens: [...tokens, { ...payload, ...p }] };
    });
  };

  /** Duplo clique / Enter no painel: entra numa vaga livre da formação, ou sai se já estiver em campo. */
  const onPanelActivate = (payload: DragPayload) =>
    commit((s) => {
      const existing = s.tokens.findIndex((t) => sameToken(t, payload));
      if (existing >= 0) return { ...s, tokens: s.tokens.filter((_, i) => i !== existing) };
      const isOpp = payload.kind !== "player";
      const slots = slotsFor(s.formation, !isOpp && !hasOpp(s.tokens)).map((x) => (isOpp ? mirror(x) : x));
      const mates = s.tokens.filter((t) => (isOpp ? t.kind === "opp" || t.kind === "oppPlayer" : t.kind === "player"));
      const free = slots.find((sl) => mates.every((m) => meters(m, sl) > 3));
      const spot = free ?? { u: isOpp ? 0.75 : 0.25, v: 0.15 + Math.random() * 0.7 };
      return { ...s, tokens: [...s.tokens, { ...payload, u: spot.u, v: spot.v }] };
    });

  // ---- peças no campo ----
  const onMoveToken = (i: number, p: Point, isCommit: boolean) => {
    if (isCommit) return commit((s) => ({ ...s, tokens: s.tokens.map((t, j) => (j === i ? { ...t, ...p } : t)) }));
    setState((s) => {
      if (!s) return s;
      if (!dragSnap.current) dragSnap.current = snap(s);
      return { ...s, tokens: s.tokens.map((t, j) => (j === i ? { ...t, ...p } : t)) };
    });
  };
  const endDrag = () => {
    if (dragSnap.current) undoStack.current = [...undoStack.current.slice(-49), dragSnap.current];
    dragSnap.current = null;
  };
  const onDropToken = (i: number, p: Point) => {
    endDrag();
    setState((s) => (s ? { ...s, tokens: s.tokens.map((t, j) => (j === i ? { ...t, ...p } : t)) } : s));
  };
  const onRemoveToken = (i: number) => {
    if (dragSnap.current) {
      endDrag();
      setState((s) => (s ? { ...s, tokens: s.tokens.filter((_, j) => j !== i) } : s));
    } else commit((s) => ({ ...s, tokens: s.tokens.filter((_, j) => j !== i) }));
  };
  const onAddDrawing = (d: Drawing) => commit((s) => ({ ...s, drawings: [...s.drawings, d] }));

  // ---- atalhos de teclado ----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return undo();
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const n = Number(e.key);
      if (n >= 1 && n <= FORMATION_NAMES.length) setFormation(FORMATION_NAMES[n - 1]);
      else if (k === "d") setDrawTool((t) => (t ? null : lastTool));
      else if (k === "e") eraseDrawings();
      else if (k === "c") clearField();
      else if (k === "h") setUiHidden((h) => !h);
      else if (k === "s") setShowSubs((v) => !v);
      else if (k === "escape") setDrawTool(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [undo, setFormation, eraseDrawings, clearField, lastTool]);

  const pickTool = (t: DrawTool | null) => {
    setDrawTool(t);
    if (t) setLastTool(t);
  };

  // ---- compartilhar / exportar ----
  const shareUrl = () => {
    if (!state) return "";
    const by = cleanHandle(creator) || referral();
    return `${location.origin}/${slug}${by ? `?creator=@${by}` : ""}#s=${encodeState(state)}`;
  };
  const copyLink = async () => {
    const url = shareUrl();
    trackEvent("share_link", { team: slug });
    try {
      if (narrow && navigator.share) await navigator.share({ title: `Minha escalação do ${summary?.shortName}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("Link copiado");
      }
    } catch {
      prompt("Copie o link:", url);
    }
  };
  /** "pitch" = campo como está na tela; feed/story = cartão vertical 1080x1350 / 1080x1920. */
  const downloadImage = async (fmt: "pitch" | ExportFormat) => {
    if (busy) return;
    setBusy(true);
    try {
      let el: HTMLElement | null = captureRef.current;
      if (fmt !== "pitch") {
        setExportFmt(fmt);
        // espera o cartão montar e as imagens carregarem
        for (let i = 0; i < 50 && !cardRef.current; i++) await new Promise((r) => setTimeout(r, 30));
        el = cardRef.current;
        const imgs = [...(el?.querySelectorAll("img") ?? [])];
        await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => ((im.onload = r), (im.onerror = r))))));
      }
      trackEvent("export_image", { team: slug, format: fmt });
      if (el) await exportImage(el, `escalacao-${slug}${fmt === "pitch" ? "" : `-${fmt}`}.png`, narrow);
    } catch (err) {
      setToast("Não foi possível gerar a imagem");
      console.error(err);
    } finally {
      setExportFmt(null);
      setBusy(false);
    }
  };

  if (!summary) {
    return (
      <div className="notfound">
        <p>Clube não encontrado.</p>
        <a href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>Ver os 20 clubes</a>
      </div>
    );
  }

  const vars = clubVars((team ?? summary).colors) as React.CSSProperties;
  if (!team || !state) {
    return <div className={live ? `live live--bg-${bg}` : "board"} style={vars}><p className="loading">Carregando elenco…</p></div>;
  }

  // ---- render das peças ----
  const onFieldPlayers = new Set(state.tokens.filter((t) => t.kind === "player").map((t) => t.ref));
  const onFieldOppPlayers = new Set(state.tokens.filter((t) => t.kind === "oppPlayer").map((t) => t.ref));
  const onFieldOpp = new Set(state.tokens.filter((t) => t.kind === "opp").map((t) => t.ref));

  const playerNode = (p: Player, colors: Team["colors"], as?: Pos) => (
    <>
      <span className="token__avatar">
        <span className={`token__pos pos-badge--${as ?? p.pos} ${as ? "is-alt" : ""}`}>{as ?? p.pos}</span>
        <Avatar player={p} colors={colors} size={64} safe={safe} />
        {p.number != null && (
          <span className="token__num" style={{ background: colors.primary, color: textOn(colors.primary), borderColor: colors.secondary }}>
            {p.number}
          </span>
        )}
      </span>
      {!state.compact || live ? <span className="token__name">{labelName(p.name)}</span> : null}
    </>
  );

  const renders: TokenRender[] = state.tokens.flatMap((t): TokenRender[] => {
    const key = `${t.kind}-${t.ref}`;
    if (t.kind === "ball") {
      return [{ key, token: t, label: "Bola", node: <span className="ball" /> }];
    }
    if (t.kind === "opp") {
      return [{
        key, token: t, label: `Adversário ${t.ref}`,
        node: <span className="disc" style={{ background: state.oppColor, color: textOn(state.oppColor) }}>{t.ref}</span>,
      }];
    }
    const src = t.kind === "player" ? playersById : oppById;
    const colors = t.kind === "player" ? team.colors : opp?.colors;
    const p = src.get(t.ref);
    if (!p || !colors) return [];
    return [{ key, token: t, label: `${p.name}, ${t.as ?? p.pos}${p.number != null ? `, ${p.number}` : ""}`, node: playerNode(p, colors, t.as) }];
  });

  const tokenScale = live ? SIZE_SCALE[size] : state.compact ? 0.72 : 1;
  const vertical = live ? ratio === "9x16" : narrow;
  const oppSummary = teamSummary(state.oppSlug);
  const host = location.host.replace(/^www\./, "");

  const pickTok = picker !== null ? state.tokens[picker] : undefined;
  const pickPlayer = pickTok ? (pickTok.kind === "player" ? playersById : oppById).get(pickTok.ref) : undefined;
  const pickerNode = pickTok && pickPlayer && (
    <RolePicker
      key={`${pickTok.kind}-${pickTok.ref}`}
      player={pickPlayer}
      token={pickTok}
      vertical={vertical}
      onClose={() => setPicker(null)}
      onRemove={() => {
        const i = picker!;
        setPicker(null);
        onRemoveToken(i);
      }}
      onPick={(pos) => {
        const i = picker!;
        setPicker(null);
        commit((s) => ({
          ...s,
          tokens: s.tokens.map((t, j) => {
            if (j !== i) return t;
            const { as: _old, ...rest } = t;
            return pos === pickPlayer.pos ? rest : { ...rest, as: pos };
          }),
        }));
      }}
    />
  );

  const pitch = (
    <Pitch
      ref={pitchRef}
      vertical={vertical}
      tokens={renders}
      tokenScale={tokenScale}
      drawings={state.drawings}
      drawTool={drawTool}
      drawColor={drawColor}
      onAddDrawing={onAddDrawing}
      onMoveToken={onMoveToken}
      onRemoveToken={onRemoveToken}
      onDropToken={onDropToken}
      onTapToken={(i) => {
        const t = state.tokens[i];
        if (t && (t.kind === "player" || t.kind === "oppPlayer")) setPicker(i);
      }}
    >
      {pickerNode}
    </Pitch>
  );

  const subsList = showSubs && state.subs.length > 0 && (
    <ol className="subs">
      {state.subs.slice(-5).map((s, i) => {
        const pool = playersById.has(s.out) ? playersById : oppById;
        return (
          <li key={i}>
            <span className="subs__out">▼ {pool.get(s.out)?.name ?? "?"}</span>
            <span className="subs__in">▲ {pool.get(s.in)?.name ?? "?"}</span>
          </li>
        );
      })}
    </ol>
  );

  const squadPanel = (
    <SquadPanel
      title={`Elenco · ${team.shortName}`}
      players={team.players}
      colors={team.colors}
      kind="player"
      onField={onFieldPlayers}
      onDrop={onPanelDrop}
      onActivate={onPanelActivate}
      safe={safe}
    />
  );
  const oppPanel = (
    <OpponentPanel
      homeSlug={slug}
      oppTeam={opp}
      oppSlug={state.oppSlug}
      color={state.oppColor}
      onField={onFieldOpp}
      onFieldPlayers={onFieldOppPlayers}
      onColor={(c) => setState((s) => (s ? { ...s, oppColor: c } : s))}
      onOppSlug={(o) => commit((s) => ({ ...s, oppSlug: o, tokens: s.tokens.filter((t) => t.kind !== "oppPlayer") }))}
      onDrop={onPanelDrop}
      onActivate={onPanelActivate}
      onLineUp={lineUpOpp}
      safe={safe}
    />
  );

  // =================== MODO LIVE ===================
  if (live) {
    const liveUrl = `${location.origin}/${slug}/live?bg=transparent&ratio=${ratio}&size=${size}${creator ? `&creator=@${creator}` : ""}${safe ? "&safe=1" : ""}&ui=0`;
    return (
      <div className={`live live--bg-${bg} live--${ratio} ${uiHidden ? "" : "has-ui"}`} style={{ ...vars, ...(bg === "solid" ? { background: solid } : {}) }}>
        <div className={`stage stage--${ratio}`}>
          {showScore && <Scoreboard home={summary} away={oppSummary} />}
          <div className="stage__pitch">{pitch}</div>
          {subsList}
          <div className="brand-mark">
            {creator && <strong>@{creator}</strong>}
            <span>{host}</span>
          </div>
        </div>

        {drawer && !uiHidden && (
          <aside className="drawer">
            <button className="drawer__close" onClick={() => setDrawer(null)} aria-label="Fechar">×</button>
            {drawer === "squad" ? squadPanel : oppPanel}
          </aside>
        )}

        {uiHidden ? (
          <button className="live-reveal" onClick={() => setUiHidden(false)} title="Mostrar controles (H)">⋯</button>
        ) : (
          <div className="livebar" role="toolbar" aria-label="Controles do Modo Live">
            <a className="icon-btn" href={`/${slug}`} onClick={(e) => (e.preventDefault(), navigate(`/${slug}`))} title="Sair do Modo Live">←</a>
            <button className={`btn btn--sm ${drawer === "squad" ? "is-on" : ""}`} onClick={() => setDrawer(drawer === "squad" ? null : "squad")}>Elenco</button>
            <button className={`btn btn--sm ${drawer === "opp" ? "is-on" : ""}`} onClick={() => setDrawer(drawer === "opp" ? null : "opp")}>Adversário</button>
            <FormationButtons value={state.formation} onPick={setFormation} />
            <DrawControls tool={drawTool} color={drawColor} onTool={pickTool} onColor={setDrawColor} onErase={eraseDrawings} />
            <button className="icon-btn" onClick={undo} title="Desfazer (Ctrl+Z)">↶</button>
            <button className="icon-btn" onClick={clearField} title="Limpar campo (C)">⟲</button>
            <label className="field">
              Fundo
              <select value={bg} onChange={(e) => setBg(e.target.value as Bg)}>
                <option value="grass">Gramado</option>
                <option value="solid">Cor sólida</option>
                <option value="chroma">Chroma key</option>
                <option value="transparent">Transparente</option>
              </select>
            </label>
            {bg === "solid" && <input type="color" value={solid} onChange={(e) => setSolid(e.target.value)} aria-label="Cor do fundo" />}
            <div className="seg">
              {(["16x9", "9x16"] as Ratio[]).map((r) => (
                <button key={r} className={`seg__btn ${ratio === r ? "is-on" : ""}`} onClick={() => setRatio(r)}>{r.replace("x", ":")}</button>
              ))}
            </div>
            <div className="seg" aria-label="Tamanho das peças">
              {(["P", "M", "G"] as Size[]).map((x) => (
                <button key={x} className={`seg__btn ${size === x ? "is-on" : ""}`} onClick={() => setSize(x)}>{x}</button>
              ))}
            </div>
            <button className={`btn btn--sm ${showScore ? "is-on" : ""}`} onClick={() => setShowScore((v) => !v)}>Placar</button>
            <button className={`btn btn--sm ${showSubs ? "is-on" : ""}`} onClick={() => setShowSubs((v) => !v)} title="Lista de substituições (S)">Subs</button>
            <button className={`btn btn--sm ${safe ? "is-on" : ""}`} onClick={() => setSafe((v) => !v)} title="Avatares sem foto">Sem fotos</button>
            <label className="field">
              Seu @
              <input value={creator} onChange={(e) => setCreator(cleanHandle(e.target.value))} placeholder="seucanal" size={10} />
            </label>
            <button
              className="btn btn--sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(liveUrl);
                  setToast("URL do Browser Source copiada");
                } catch {
                  prompt("URL para o OBS:", liveUrl);
                }
              }}
              title="URL para colar no OBS como Browser Source"
            >
              URL p/ OBS
            </button>
            <button
              className="btn btn--sm"
              onClick={async () => {
                const url = `${location.origin}/${slug}${creator ? `?creator=@${cleanHandle(creator)}` : ""}`;
                try {
                  await navigator.clipboard.writeText(url);
                  setToast("Link da audiência copiado");
                } catch {
                  prompt("Link para a audiência:", url);
                }
              }}
              title="Link para colar no chat: quem abrir monta a própria escalação"
            >
              Link p/ chat
            </button>
            <button className="icon-btn" onClick={() => setUiHidden(true)} title="Esconder controles (H)">✕</button>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // =================== PRANCHETA NORMAL ===================
  return (
    <div className="board" style={vars}>
      <header className="board__head">
        <a className="back" href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>← Clubes</a>
        <div className="board__club">
          {team.crest && <img src={team.crest} alt="" width={40} height={40} />}
          <h1>{team.name}</h1>
        </div>
        <div className="board__actions">
          <a className="btn" href={`/${slug}/live`} onClick={(e) => (e.preventDefault(), navigate(`/${slug}/live`))}>● Modo Live</a>
        </div>
      </header>

      {shared && (
        <div className="banner">
          Você está vendo uma escalação compartilhada.
          <button
            className="btn btn--primary btn--sm"
            onClick={() => {
              history.replaceState(null, "", `/${slug}`);
              const base = emptyState();
              setShared(false);
              setState(loadSaved(slug) ?? { ...base, tokens: [...base.tokens, ...applyFormation({ formation: "4-3-3", kind: "player", squad: team.players, current: [], fullPitch: true })] });
            }}
          >
            Monte a sua
          </button>
        </div>
      )}

      {!uiHidden && (
        narrow ? (
          <div className="tabs">
            <div className="tabs__bar" role="tablist">
              <button role="tab" aria-selected={tab === "squad"} className={tab === "squad" ? "is-on" : ""} onClick={() => setTab("squad")}>Elenco</button>
              <button role="tab" aria-selected={tab === "opp"} className={tab === "opp" ? "is-on" : ""} onClick={() => setTab("opp")}>Adversário</button>
            </div>
            {tab === "squad" ? squadPanel : oppPanel}
          </div>
        ) : (
          <div className="board__panels">
            {squadPanel}
            {oppPanel}
          </div>
        )
      )}

      <div className="toolbar">
        <FormationButtons value={state.formation} onPick={setFormation} />
        <DrawControls tool={drawTool} color={drawColor} onTool={pickTool} onColor={setDrawColor} onErase={eraseDrawings} />
        <div className="toolbar__end">
          <label className="switch">
            <input type="checkbox" checked={state.compact} onChange={(e) => setState((s) => (s ? { ...s, compact: e.target.checked } : s))} />
            Compacto
          </label>
          <button className="icon-btn" onClick={undo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button>
          <button className="btn btn--ghost btn--sm" onClick={clearField} title="Limpar campo (C)">Limpar</button>
        </div>
      </div>

      <div className="capture" ref={captureRef}>
        {pitch}
        {subsList}
        <div className="capture__foot">
          {team.crest && <img src={team.crest} alt="" width={28} height={28} />}
          <span className="capture__title">{team.shortName} · {state.formation}</span>
          <span className="capture__brand">{creator && <strong>@{creator} · </strong>}{host}</span>
        </div>
      </div>

      <div className="cta">
        <button className="btn btn--primary btn--lg" onClick={copyLink}>Compartilhar minha escalação</button>
        <div className="cta__group" role="group" aria-label="Baixar imagem">
          <span className="cta__label">{busy ? "Gerando…" : "Baixar imagem"}</span>
          <button className="btn btn--sm" onClick={() => downloadImage("feed")} disabled={busy} title="1080x1350">Feed 4:5</button>
          <button className="btn btn--sm" onClick={() => downloadImage("story")} disabled={busy} title="1080x1920">Story 9:16</button>
          <button className="btn btn--sm" onClick={() => downloadImage("pitch")} disabled={busy} title="O campo como está na tela">Campo</button>
        </div>
      </div>
      {exportFmt && (
        <ExportCard
          ref={cardRef}
          format={exportFmt}
          team={team}
          opp={opp && state.tokens.some((t) => t.kind === "oppPlayer") ? opp : null}
          formation={state.formation}
          tokens={renders}
          drawings={state.drawings}
          creator={creator}
          host={host}
        />
      )}
      <p className="hint">
        O campo é seu. Arraste do elenco para o campo; solte um reserva em cima de um titular para substituir. Duplo clique
        (ou toque longo) remove. Atalhos: 1–6 formações · D desenhar · E apagar · C limpar · H esconder painéis · Ctrl+Z desfazer.
      </p>
      <Footer updatedAt={team.updatedAt} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
