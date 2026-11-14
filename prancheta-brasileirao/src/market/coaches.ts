// Técnicos no Mercado (TEC): filtro e ordem puros, usados pela lista de Procurar e testados à parte.
import type { MarketCoach } from "./types";

/** Sem clube (disponível) · Com clube (sob contrato) · Todos */
export type CoachStatus = "free" | "employed" | "all";

export const COACH_STATUS: [CoachStatus, string][] = [["free", "Sem clube"], ["employed", "Com clube"], ["all", "Todos"]];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "2026-11-12" → "11/2026" */
export const coachMonth = (d: string | null | undefined) => (d && /^\d{4}-\d{2}/.test(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : null);

/** Data que conta para "mais recente": último jogo (sem clube) ou início no cargo (com clube). */
const recency = (c: MarketCoach) => (c.free ? c.lastGame : c.since) ?? "";

export function filterCoaches(
  list: MarketCoach[],
  { status, league, q, exclude }: { status: CoachStatus; league?: string | null; q?: string; exclude?: string | null },
): MarketCoach[] {
  const nq = norm((q ?? "").trim());
  return list.filter((c) => {
    if (exclude && c.id === exclude) return false;
    if (status === "free" && !c.free) return false;
    if (status === "employed" && c.free) return false;
    // a liga só filtra quem tem clube: o técnico livre não tem liga
    if (league && !c.free && c.league !== league) return false;
    if (nq && !norm(`${c.name} ${c.club ?? ""} ${c.lastClub ?? ""}`).includes(nq)) return false;
    return true;
  });
}

/** Sem clube primeiro; dentro de cada grupo, o trabalho mais recente primeiro. */
export const sortCoaches = (list: MarketCoach[]) =>
  [...list].sort((a, b) => Number(!!b.free) - Number(!!a.free) || recency(b).localeCompare(recency(a)) || a.name.localeCompare(b.name, "pt-BR"));
