import { teamSummary } from "../data";

// Modelo de navegação compartilhado: uma Home (/), módulos sempre com clube na URL.
// "olheiro" ficou só por compatibilidade: o scout vive na etapa 2 do Mercado (`?aba=mercado`).
/** Prancheta tática oculta do site (o módulo continua no projeto; rotas antigas seguem funcionando). */
export const SHOW_BOARD = false;

export type ModuleId = "prancheta" | "mercado" | "olheiro";

export function moduleHref(module: ModuleId, slug: string): string {
  if (module === "mercado") return `/mercado/${slug}`;
  if (module === "olheiro") return `/mercado/${slug}?aba=mercado`;
  return `/${slug}`;
}

/** Destino de /prancheta, /mercado e /olheiro(/clube): o clube (se válido) ou a Home com a folha de clubes aberta. */
export function redirectTarget(module: ModuleId, saved: string | null): string {
  if (module === "prancheta" && !SHOW_BOARD) module = "mercado"; // prancheta oculta: /prancheta leva ao mercado
  return saved && teamSummary(saved) ? moduleHref(module, saved) : `/?modulo=${module}&trocar=1`;
}
