// Peças visuais do Olheiro (fichas, carimbos, barras de percentil, folhas). Classes sc-*.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { initials } from "../lib/color";
import { fmtEur } from "../market/logic";
import { INDICATORS, scoreTier, type IndicatorRead, type ScoutPlayer } from "./metrics";

const MOBILE_MQ = "(max-width: 640px)";
const isMobileNow = () => typeof matchMedia !== "undefined" && matchMedia(MOBILE_MQ).matches;

/** Mesmo corte do Mercado (640px): no celular a tela vira app. */
export function useIsMobile() {
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

export const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const ICON = {
  radar: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l7-7M12 12h.01",
  shelves: "M4 4h4.5v16H4zM10 4h4.5v11H10zM16 4h4v13.5h-4z",
  plans: "M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1",
  compare: "M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8",
  filter: "M4 6h16M7 12h10M10 18h4",
  close: "M6 6l12 12M18 6 6 18",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17 19 7",
  cart: "M3 4h2.2l2.3 11h10.8L21 7H6.4M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01",
};

/** Rosto do jogador (no sandbox, as fotos do Transfermarkt caem nas iniciais). */
export function Face({ name, photo, size = 48, className = "" }: { name: string; photo: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (photo && !broken)
    return <img className={`sc-face ${className}`} style={style} src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className={`sc-face sc-face--ini ${className}`} style={{ ...style, fontSize: Math.round(size * 0.4) }}>
      {initials(name)}
    </span>
  );
}

/** Carimbo da nota da posição (0–100). */
export function ScoreStamp({ x, big = false }: { x: ScoutPlayer; big?: boolean }) {
  const s = x.m.score;
  const tier = scoreTier(s);
  return (
    <span className={`sc-score sc-score--${tier} ${big ? "sc-score--big" : ""}`} title={s == null ? "Amostra pequena: sem nota" : `Nota ${s} de 100 entre os ${x.pos} do grupo ${x.group}`}>
      <b>{s ?? "—"}</b>
      <small>{s == null ? "amostra" : "nota"}</small>
    </span>
  );
}

/** Barra de percentil 0–100 (sobre papel). */
export function PctBar({ r, compact = false }: { r: IndicatorRead; compact?: boolean }) {
  const def = INDICATORS[r.id];
  const p = r.pct;
  const tier = p == null ? "none" : p >= 80 ? "top" : p >= 60 ? "good" : p >= 40 ? "mid" : "low";
  if (compact)
    return (
      <span className="sc-mini" title={`${def.label}: ${def.fmt(r.value)}${p != null ? ` · percentil ${p}` : ""}`}>
        <span className="sc-mini__label">{def.short}</span>
        <span className="sc-mini__track"><i className={`is-${tier}`} style={{ width: `${p ?? 0}%` }} /></span>
        <span className="sc-mini__n">{p ?? "–"}</span>
      </span>
    );
  return (
    <div className="sc-bar">
      <p className="sc-bar__head">
        <span>{def.label}</span>
        <b>{def.fmt(r.value)}</b>
      </p>
      <div className="sc-bar__track" role="img" aria-label={p == null ? `${def.label}: sem percentil` : `${def.label}: percentil ${p}`}>
        <i className={`is-${tier}`} style={{ width: `${p ?? 0}%` }} />
        <span className="sc-bar__mid" />
        <em style={{ left: `${Math.min(95, Math.max(5, p ?? 0))}%` }}>{p ?? "–"}</em>
      </div>
      <p className="sc-bar__foot">peso {r.weight} na nota{def.inverse ? " · menor é melhor" : ""}</p>
    </div>
  );
}

export const trendText = (t: number | null) => (t == null ? "" : `${t > 0 ? "+" : t < 0 ? "–" : ""}${Math.abs(t)}% em 12 meses`);

export function Trend({ t }: { t: number | null }) {
  if (t == null) return null;
  const cls = t >= 10 ? "is-up" : t <= -10 ? "is-down" : "is-flat";
  return (
    <span className={`sc-trend ${cls}`} title="Variação do valor de mercado em 12 meses (Transfermarkt)">
      {t > 0 ? "▲" : t < 0 ? "▼" : "■"} {Math.abs(t)}%
    </span>
  );
}

/** Etiquetas dos índices compostos (só as que valem). */
export function Tags({ x, max = 3 }: { x: ScoutPlayer; max?: number }) {
  const tags: [string, string, string][] = [];
  if (x.m.gem) tags.push(["gem", "Joia", "Sub-21 com nota 70+ ou sub-23 com 80+"]);
  if (x.m.contractChance) tags.push(["contract", "Fim de contrato", "Contrato acaba até 30/06 e nota 60+"]);
  if (x.m.undervalued) tags.push(["under", "Subvalorizado", "Nota 75+ e valor abaixo da mediana da posição na liga"]);
  if (x.m.exportLeague) tags.push(["export", "Liga de exportação", `Nota 70+ numa liga de coeficiente ${x.m.coef.toFixed(2).replace(".", ",")}`]);
  for (const r of x.m.risks) if (r.id !== "sample") tags.push(["risk", r.label, "Risco"]);
  if (!tags.length) return null;
  return (
    <span className="sc-tags">
      {tags.slice(0, max).map(([k, label, tip]) => (
        <span key={k + label} className={`sc-tag sc-tag--${k}`} title={tip}>{label}</span>
      ))}
    </span>
  );
}

export const valueText = (v: number | null) => (v == null ? "sem valor" : fmtEur(v));

/** Folha: no celular sobe de baixo; no desktop é uma gaveta à direita. */
export function Drawer({ label, onClose, children, foot, wide = false }: { label: string; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.documentElement.classList.add("sc-locked");
    return () => {
      window.removeEventListener("keydown", k);
      document.documentElement.classList.remove("sc-locked");
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="sc-drawer" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className={`sc-drawer__body ${wide ? "is-wide" : ""}`} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="sc-drawer__close" onClick={onClose} aria-label="Fechar"><Ico d={ICON.close} size={18} /></button>
        <div className="sc-drawer__scroll">{children}</div>
        {foot && <div className="sc-drawer__foot">{foot}</div>}
      </div>
    </div>
  );
}
