import { teamSummary } from "../data";

// Modelo de navegação compartilhado: uma Home (/), módulos sempre com clube na URL.
export type ModuleId = "prancheta" | "mercado";

export const MODULES: { id: ModuleId; label: string; role: string }[] = [
  { id: "prancheta", label: "Prancheta", role: "Técnico" },
  { id: "mercado", label: "Mercado", role: "Diretor" },
];

export function moduleHref(module: ModuleId, slug: string): string {
  return module === "mercado" ? `/mercado/${slug}` : `/${slug}`;
}

/** Destino de /prancheta e /mercado: o clube salvo (se válido) ou a Home com a folha de clubes aberta. */
export function redirectTarget(module: ModuleId, saved: string | null): string {
  return saved && teamSummary(saved) ? moduleHref(module, saved) : `/?modulo=${module}&trocar=1`;
}
