import type { MouseEvent } from "react";
import "@fontsource/big-shoulders-display/latin-700";
import "@fontsource/big-shoulders-display/latin-900";
import "@fontsource/big-shoulders-stencil-display/latin-800";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/dm-mono/latin-400";
import "@fontsource/dm-mono/latin-500";
import "./brand.css";
import { navigate } from "../router";

/** Clique "normal" vira navegação SPA; ctrl/cmd/shift/alt ou botão do meio seguem o navegador. */
export function spaLink(href: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
}

/** Chave de latão: o anel é o círculo central do campo, cortado pela linha do meio. */
function KeyGlyph({ size }: { size: number }) {
  return (
    <svg className="mando-mark__glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="12" r="5.25" />
        <path d="M7.5 6.75v10.5" />
        <path d="M12.75 12H22" />
        <path d="M18.5 12v3.5M21.5 12v2.5" />
      </g>
    </svg>
  );
}

export function BrandMark({ size = "sm", href = "/" }: { size?: "sm" | "lg"; href?: string }) {
  return (
    <a className={`mando-mark mando-mark--${size}`} href={href} onClick={spaLink(href)} aria-label="Mando — início">
      <KeyGlyph size={size === "lg" ? 30 : 22} />
      <span className="mando-mark__word" aria-hidden="true">Mando</span>
    </a>
  );
}
