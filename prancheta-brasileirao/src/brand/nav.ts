import { teamSummary } from "../data";

// Modelo de navegação compartilhado: uma Home (/), módulos sempre com clube na URL.
export type ModuleId = "prancheta" | "mercado" | "olheiro";

export function moduleHref(module: ModuleId, slug: string): string {
  if (module === "mercado") return `/mercado/${slug}`;
  if (module === "olheiro") return `/olheiro/${slug}`;
  return `/${slug}`;
}

/** Destino de /prancheta, /mercado e /olheiro: o clube salvo (se válido) ou a Home com a folha de clubes aberta. */
export function redirectTarget(module: ModuleId, saved: string | null): string {
  return saved && teamSummary(saved) ? moduleHref(module, saved) : `/?modulo=${module}&trocar=1`;
}
