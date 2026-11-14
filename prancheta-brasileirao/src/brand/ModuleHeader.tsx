import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BrandMark, spaLink } from "./BrandMark";
import { ClubSheet } from "./ClubSheet";
import { moduleHref, type ModuleId, SHOW_BOARD } from "./nav";
import "./brand.css";
import { AccountButton } from "./Account";
import { openLogin, useAccount } from "../lib/account";
import "./module-header.css";
import { initials } from "../lib/color";
import { navigate } from "../router";

export type ModuleMenuItem = { label: string; onSelect(): void };

type Props = {
  module: ModuleId;
  slug: string;
  clubName: string;
  crest: string | null;
  variant: "bar" | "app";
  actions?: ReactNode;
  /** conteúdo ao lado do clube (ex.: as etapas do Mercado quando a página rola, no computador) */
  center?: ReactNode;
  menuItems?: ModuleMenuItem[];
};

/**
 * Cabeçalho comum: marca (→ Home), clube (troca de clube, fica na tela atual), ações, conta e menu "⋯".
 * O produto é o Mercado (a janela do diretor; o olheiro mora na etapa 2). A Prancheta (ferramenta extra) fica
 * no menu "⋯" do Mercado e mostra um link claro de volta à janela.
 * "bar" = desktop; "app" = celular (52px).
 */
export function ModuleHeader({ module, slug, clubName, crest, variant, actions, center, menuItems }: Props) {
  const [sheet, setSheet] = useState(false);
  const app = variant === "app";
  const acc = useAccount();
  const market = module === "mercado";
  const back = market ? null : moduleHref("mercado", slug);
  const backLabel = `Janela do ${clubName}`;

  const items: ModuleMenuItem[] = [];
  if (back && app) items.push({ label: `← ${backLabel}`, onSelect: () => navigate(back) });
  items.push(...(menuItems ?? []));
  const divideAt = items.length;
  if (market && SHOW_BOARD) {
    items.push({ label: "Prancheta tática (extra)", onSelect: () => navigate(moduleHref("prancheta", slug)) });
  }
  items.push({ label: "Trocar de clube", onSelect: () => setSheet(true) }, { label: "Início", onSelect: () => navigate("/") });
  if (acc.enabled && !acc.user) items.push({ label: "Entrar e salvar a jornada", onSelect: openLogin });

  const pick = (next: string) => {
    setSheet(false);
    if (next !== slug) navigate(moduleHref(module, next));
  };

  return (
    <header className={`brand mhd mhd--${variant}`}>
      <div className="mhd-in">
        {back && app ? (
          <a className="mhd-back mhd-back--icon" href={back} onClick={spaLink(back)} aria-label={`Voltar à ${backLabel}`} title={`Voltar à ${backLabel}`}>
            <BackArrow />
          </a>
        ) : (
          <BrandMark size="sm" />
        )}
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

        {module === "prancheta" && !app && <span className="mhd-tag">Ferramenta extra</span>}
        {back && !app && (
          <a className="mhd-back" href={back} onClick={spaLink(back)}>
            <BackArrow />
            <span>{backLabel}</span>
          </a>
        )}

        {center}
        <span className="mhd-spacer" />
        {actions && <div className="mhd-actions">{actions}</div>}
        {(!app || acc.user) && <AccountButton compact={app} />}
        {items.length > 0 && <MoreMenu items={items} divideAt={divideAt} />}
      </div>
      <ClubSheet open={sheet} current={slug} title="Trocar de clube" onPick={pick} onClose={() => setSheet(false)} />
    </header>
  );
}

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
