import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BrandMark, spaLink } from "./BrandMark";
import { ClubSheet } from "./ClubSheet";
import { MODULES, moduleHref, type ModuleId } from "./nav";
import "./brand.css";
import "./module-header.css";
import { initials } from "../lib/color";
import { navigate } from "../router";

const GO_LABEL: Record<ModuleId, string> = { prancheta: "Ir para a Prancheta", mercado: "Ir para o Mercado", olheiro: "Ir para o Olheiro" };

export type ModuleMenuItem = { label: string; onSelect(): void };

type Props = {
  module: ModuleId;
  slug: string;
  clubName: string;
  crest: string | null;
  variant: "bar" | "app";
  actions?: ReactNode;
  menuItems?: ModuleMenuItem[];
};

/**
 * Cabeçalho comum dos módulos: marca (→ Home), crachá do clube (troca de clube, fica no módulo),
 * chave Prancheta | Mercado | Olheiro (mantém o clube), ações do módulo e menu "⋯".
 * "bar" = desktop; "app" = celular (52px; a chave de módulo vai para o menu).
 */
export function ModuleHeader({ module, slug, clubName, crest, variant, actions, menuItems }: Props) {
  const [sheet, setSheet] = useState(false);
  const app = variant === "app";

  const items: ModuleMenuItem[] = [...(menuItems ?? [])];
  if (app) {
    items.push(
      ...MODULES.filter((m) => m.id !== module).map((m) => ({ label: GO_LABEL[m.id], onSelect: () => navigate(moduleHref(m.id, slug)) })),
      { label: "Trocar de clube", onSelect: () => setSheet(true) },
      { label: "Início", onSelect: () => navigate("/") },
    );
  }

  const pick = (next: string) => {
    setSheet(false);
    if (next !== slug) navigate(moduleHref(module, next));
  };

  return (
    <header className={`brand mhd mhd--${variant}`}>
      <div className="mhd-in">
        <BrandMark size="sm" />
        <button
          type="button"
          className="mhd-club"
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
          aria-label={`Clube: ${clubName}. Trocar de clube`}
          title="Trocar de clube"
        >
          <span className="mhd-club__crest" aria-hidden="true">
            {crest ? <img src={crest} alt="" width={22} height={22} decoding="async" /> : <span>{initials(clubName)}</span>}
          </span>
          <span className="mhd-club__name">{clubName}</span>
          <svg className="mhd-club__caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {!app && (
          <nav className="mhd-seg" aria-label="Módulo">
            {MODULES.map((m) => {
              const href = moduleHref(m.id, slug);
              const on = m.id === module;
              return (
                <a
                  key={m.id}
                  className={`mhd-seg__item${on ? " is-on" : ""}`}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  onClick={on ? (e) => e.preventDefault() : spaLink(href)}
                >
                  {m.label}
                </a>
              );
            })}
          </nav>
        )}

        <span className="mhd-spacer" />
        {actions && <div className="mhd-actions">{actions}</div>}
        {items.length > 0 && <MoreMenu items={items} divideAt={app ? (menuItems?.length ?? 0) : 0} />}
      </div>
      <ClubSheet open={sheet} current={slug} title="Trocar de clube" onPick={pick} onClose={() => setSheet(false)} />
    </header>
  );
}

function MoreMenu({ items, divideAt }: { items: ModuleMenuItem[]; divideAt: number }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = els.length;
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      els[e.key === "Home" ? 0 : els.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="mhd-more" ref={root} onKeyDown={open ? onKey : undefined}>
      <button
        ref={btn}
        type="button"
        className={`mhd-more__btn${open ? " is-open" : ""}`}
        aria-label="Mais opções"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="3.5" cy="9" r="1.6" fill="currentColor" />
          <circle cx="9" cy="9" r="1.6" fill="currentColor" />
          <circle cx="14.5" cy="9" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="mhd-menu" role="menu" id={menuId} aria-label="Mais opções">
          {items.map((it, i) => [
            i > 0 && i === divideAt && <span key={`sep-${i}`} className="mhd-menu__sep" role="separator" />,
            <button
              key={`${i}-${it.label}`}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="mhd-menu__item"
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.label}
            </button>,
          ])}
        </div>
      )}
    </div>
  );
}
