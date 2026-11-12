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

export function BrandMark({ size = "sm", href = "/" }: { size?: "sm" | "lg"; href?: string }) {
  return (
    <a className={`mando-mark mando-mark--${size}`} href={href} onClick={spaLink(href)} aria-label="Meu Elenco FC — início">
      <img className="mando-mark__glyph" src="/brand/escudo.png" srcSet="/brand/escudo.png 1x, /brand/escudo@2x.png 2x" alt="" height={size === "lg" ? 44 : 32} />
      <span className="mando-mark__word" aria-hidden="true"><em>Meu</em> Elenco <em>FC</em></span>
    </a>
  );
}
