// Progresso da janela salvo pelo Mercado (`mercado:{slug}:v1`), lido sem carregar o módulo.
export type WindowProgress = { decisions: number; signings: number; budget: number | null };

type Store = Pick<Storage, "getItem">;

export function readWindowProgress(slug: string, store: Store | null = safeStorage()): WindowProgress | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(`mercado:${slug}:v1`);
  } catch {
    return null;
  }
  if (!raw) return null;
  let st: unknown;
  try {
    st = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!st || typeof st !== "object") return null;
  const o = st as Record<string, unknown>;
  const decisions = o.decisions && typeof o.decisions === "object" && !Array.isArray(o.decisions) ? Object.keys(o.decisions).length : 0;
  const signings = Array.isArray(o.signings) ? o.signings.length : 0;
  const budget = typeof o.budget === "number" && Number.isFinite(o.budget) && o.budget > 0 ? o.budget : null;
  return { decisions, signings, budget };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 decisões · 3 contratações" ou null quando ainda não há nada feito. */
export function progressLabel(p: WindowProgress | null): string | null {
  if (!p || (p.decisions === 0 && p.signings === 0)) return null;
  return `${plural(p.decisions, "decisão", "decisões")} · ${plural(p.signings, "contratação", "contratações")}`;
}

/** Orçamento em euros, curto: "€ 20 mi", "€ 1,5 bi", "€ 800 mil". */
export function budgetLabel(eur: number | null): string | null {
  if (eur == null || eur <= 0) return null;
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString("pt-BR");
  if (eur >= 1e9) return `€ ${fmt(eur / 1e9)} bi`;
  if (eur >= 1e6) return `€ ${fmt(eur / 1e6)} mi`;
  return `€ ${fmt(eur / 1e3)} mil`;
}

function safeStorage(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
