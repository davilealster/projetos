import type { Colors } from "../types";

function lum(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const isLight = (hex: string) => lum(hex) > 0.45;
export const textOn = (hex: string) => (isLight(hex) ? "#0b0f0c" : "#ffffff");

/** Cor de destaque legível sobre fundo escuro: evita preto puro (Vasco, Botafogo, Corinthians). */
export function uiAccent(c: Colors): string {
  for (const x of [c.primary, c.accent, c.secondary]) {
    const l = lum(x);
    if (l > 0.06 && l < 0.85) return x;
  }
  return "#e6e6e6";
}

/** Variáveis CSS do tema do clube. */
export function clubVars(c: Colors): Record<string, string> {
  return {
    "--club-primary": c.primary,
    "--club-secondary": c.secondary,
    "--club-accent": c.accent,
    "--club-ui": uiAccent(c),
    "--club-on-primary": textOn(c.primary),
  };
}

export function initials(name: string): string {
  const parts = name.replace(/\./g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Nome curto para o rótulo da peça. */
export function labelName(name: string): string {
  if (name.length <= 13) return name;
  const parts = name.split(/\s+/);
  return parts[parts.length - 1].length >= 3 ? parts[parts.length - 1] : parts[0];
}

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
/** Distância simples entre duas cores (0 a ~441). */
export const colorDistance = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Primeira cor das candidatas que contrasta com `base` e aparece sobre o gramado; senão `fallback`. */
export function distinctColor(base: string, candidates: string[], fallback = "#00D1FF"): string {
  for (const c of candidates) {
    const l = lum(c);
    if (colorDistance(c, base) > 150 && l > 0.06 && l < 0.9) return c;
  }
  return fallback;
}
