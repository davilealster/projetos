import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import "./BrandMark"; // fontes da marca
import "./brand.css";
import "./club-sheet.css";
import { TEAMS } from "../data";
import { initials } from "../lib/color";

type Props = {
  open: boolean;
  current?: string | null;
  title?: string;
  onPick(slug: string): void;
  onClose(): void;
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Trava o scroll do body enquanto houver ao menos uma folha aberta. */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;
function lockBody() {
  if (locks++ > 0) return;
  const b = document.body;
  const gap = window.innerWidth - document.documentElement.clientWidth;
  saved = { overflow: b.style.overflow, paddingRight: b.style.paddingRight };
  b.style.overflow = "hidden";
  if (gap > 0) b.style.paddingRight = `${gap}px`;
}
function unlockBody() {
  if (--locks > 0 || !saved) return;
  document.body.style.overflow = saved.overflow;
  document.body.style.paddingRight = saved.paddingRight;
  saved = null;
}

/**
 * Folha de papel com os escudos dos 20 clubes. Não navega nem grava nada: quem chama decide.
 * Celular: folha que sobe do rodapé (4 colunas). Desktop: diálogo central (5 colunas).
 */
export function ClubSheet({ open, current = null, title = "Escolha o clube", onPick, onClose }: Props) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<SheetBody current={current} title={title} onPick={onPick} onClose={onClose} />, document.body);
}

function SheetBody({ current, title, onPick, onClose }: Omit<Props, "open">) {
  const [q, setQ] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const list = useMemo(() => {
    const f = fold(q);
    if (!f) return TEAMS;
    return TEAMS.filter((t) => fold(t.name).includes(f) || fold(t.shortName).includes(f) || t.slug.includes(f));
  }, [q]);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    lockBody();
    // Toque: não abre o teclado de cara; foca o clube atual (ou a folha). Mouse/teclado: foca a busca.
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const cur = panel.current?.querySelector<HTMLElement>(".mcs-club.is-current");
    if (coarse) (cur ?? panel.current)?.focus({ preventScroll: true });
    else search.current?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBody();
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, []);

  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="brand mcs" onKeyDown={trap}>
      <div className="mcs-scrim" onClick={onClose} aria-hidden="true" />
      <div className="mcs-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <span className="mcs-grip" aria-hidden="true" />
        <header className="mcs-head">
          <div>
            <p className="mcs-eyebrow">Série A 2026 · 20 clubes</p>
            <h2 className="mcs-title" id={titleId}>{title}</h2>
          </div>
          <button type="button" className="mcs-close" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <label className="mcs-search">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={search}
            type="search"
            placeholder="Buscar clube"
            aria-label="Buscar clube"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && list.length > 0) {
                e.preventDefault();
                onPick(list[0].slug);
              }
            }}
          />
        </label>
        <div className="mcs-body">
          {list.length === 0 ? (
            <p className="mcs-empty" role="status">Nenhum clube encontrado para “{q.trim()}”.</p>
          ) : (
            <ul className="mcs-grid" aria-label="Clubes">
              {list.map((t) => {
                const on = t.slug === current;
                return (
                  <li key={t.slug}>
                    <button
                      type="button"
                      className={`mcs-club${on ? " is-current" : ""}`}
                      aria-current={on ? "true" : undefined}
                      aria-label={on ? `${t.name} (clube atual)` : t.name}
                      title={t.name}
                      onClick={() => onPick(t.slug)}
                    >
                      <span className="mcs-club__crest">
                        {t.crest ? (
                          <img src={t.crest} alt="" width={40} height={40} loading="lazy" decoding="async" />
                        ) : (
                          <span className="mcs-club__initials">{initials(t.name)}</span>
                        )}
                      </span>
                      <span className="mcs-club__name">{t.shortName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
