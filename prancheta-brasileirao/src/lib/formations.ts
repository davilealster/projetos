import type { Player, Pos, Token } from "../types";

export interface Slot {
  role: Pos;
  u: number;
  v: number;
}

const back4: Slot[] = [
  { role: "GOL", u: 0.045, v: 0.5 },
  { role: "LD", u: 0.2, v: 0.86 },
  { role: "ZAG", u: 0.155, v: 0.62 },
  { role: "ZAG", u: 0.155, v: 0.38 },
  { role: "LE", u: 0.2, v: 0.14 },
];
const back3: Slot[] = [
  { role: "GOL", u: 0.045, v: 0.5 },
  { role: "ZAG", u: 0.16, v: 0.72 },
  { role: "ZAG", u: 0.145, v: 0.5 },
  { role: "ZAG", u: 0.16, v: 0.28 },
];

/** Formações do time da casa (atacando para a direita). A ordem define os atalhos 1-6. */
export const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [
    ...back4,
    { role: "VOL", u: 0.29, v: 0.5 },
    { role: "MEI", u: 0.35, v: 0.7 },
    { role: "MEI", u: 0.35, v: 0.3 },
    { role: "PON", u: 0.44, v: 0.85 },
    { role: "ATA", u: 0.43, v: 0.5 },
    { role: "PON", u: 0.44, v: 0.15 },
  ],
  "4-4-2": [
    ...back4,
    { role: "PON", u: 0.34, v: 0.86 },
    { role: "VOL", u: 0.31, v: 0.6 },
    { role: "MEI", u: 0.31, v: 0.4 },
    { role: "PON", u: 0.34, v: 0.14 },
    { role: "ATA", u: 0.44, v: 0.64 },
    { role: "ATA", u: 0.44, v: 0.36 },
  ],
  "4-2-3-1": [
    ...back4,
    { role: "VOL", u: 0.29, v: 0.62 },
    { role: "VOL", u: 0.29, v: 0.38 },
    { role: "PON", u: 0.39, v: 0.85 },
    { role: "MEI", u: 0.39, v: 0.5 },
    { role: "PON", u: 0.39, v: 0.15 },
    { role: "ATA", u: 0.43, v: 0.5 },
  ],
  "3-5-2": [
    ...back3,
    { role: "LD", u: 0.31, v: 0.9 },
    { role: "VOL", u: 0.28, v: 0.5 },
    { role: "MEI", u: 0.35, v: 0.67 },
    { role: "MEI", u: 0.35, v: 0.33 },
    { role: "LE", u: 0.31, v: 0.1 },
    { role: "ATA", u: 0.44, v: 0.64 },
    { role: "ATA", u: 0.44, v: 0.36 },
  ],
  "3-4-3": [
    ...back3,
    { role: "LD", u: 0.3, v: 0.88 },
    { role: "VOL", u: 0.29, v: 0.6 },
    { role: "VOL", u: 0.29, v: 0.4 },
    { role: "LE", u: 0.3, v: 0.12 },
    { role: "PON", u: 0.43, v: 0.84 },
    { role: "ATA", u: 0.43, v: 0.5 },
    { role: "PON", u: 0.43, v: 0.16 },
  ],
  "5-3-2": [
    { role: "GOL", u: 0.045, v: 0.5 },
    { role: "LD", u: 0.24, v: 0.9 },
    { role: "ZAG", u: 0.155, v: 0.7 },
    { role: "ZAG", u: 0.14, v: 0.5 },
    { role: "ZAG", u: 0.155, v: 0.3 },
    { role: "LE", u: 0.24, v: 0.1 },
    { role: "VOL", u: 0.3, v: 0.5 },
    { role: "MEI", u: 0.36, v: 0.7 },
    { role: "MEI", u: 0.36, v: 0.3 },
    { role: "ATA", u: 0.44, v: 0.64 },
    { role: "ATA", u: 0.44, v: 0.36 },
  ],
};
// As posições acima foram pensadas no próprio campo; esticamos para o time ocupar o campo todo
// (atacantes perto da área adversária), como numa prancheta de verdade.
// Com adversário em campo, cada time fica na sua metade (posições originais).
const stretch = (u: number) => (u < 0.1 ? u : Math.min(0.8, 0.045 + (u - 0.045) * 1.6));
export function slotsFor(formation: string, fullPitch: boolean): Slot[] {
  const base = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  return fullPitch ? base.map((s) => ({ ...s, u: stretch(s.u) })) : base;
}

export const FORMATION_NAMES = Object.keys(FORMATIONS);

/** Quem pode ocupar cada função, em ordem de preferência (a API só detalha parte das posições). */
const FALLBACK: Record<Pos, Pos[]> = {
  GOL: ["GOL"],
  ZAG: ["ZAG", "VOL"],
  LD: ["LD", "LE", "ZAG"],
  LE: ["LE", "LD", "ZAG"],
  VOL: ["VOL", "MEI", "ZAG"],
  MEI: ["MEI", "VOL", "PON"],
  PON: ["PON", "ATA", "MEI"],
  ATA: ["ATA", "PON"],
};
// Funções específicas são preenchidas antes das genéricas para não "roubar" um lateral para a zaga.
const FILL_ORDER: Pos[] = ["GOL", "LD", "LE", "VOL", "PON", "ATA", "ZAG", "MEI"];

/** Espelha um ponto para o lado adversário. */
export const mirror = (s: { u: number; v: number }) => ({ u: 1 - s.u, v: 1 - s.v });

/**
 * Posiciona um time numa formação. Mantém quem já está no campo (realocando pelas funções)
 * e completa com o elenco até 11. Retorna os tokens daquele kind já posicionados.
 */
export function applyFormation(opts: {
  formation: string;
  kind: "player" | "oppPlayer";
  squad: Player[];
  current: Token[];
  mirrored?: boolean;
  /** true = time sozinho ocupa o campo todo; false = só a própria metade */
  fullPitch?: boolean;
}): Token[] {
  const slots = slotsFor(opts.formation, opts.fullPitch ?? false);
  const byId = new Map(opts.squad.map((p) => [p.id, p]));
  const onField = opts.current.filter((t) => t.kind === opts.kind && byId.has(t.ref)).map((t) => t.ref);
  const bench = opts.squad.filter((p) => !onField.includes(p.id)).map((p) => p.id);

  const assigned = new Map<number, number>(); // slot index -> player id
  const used = new Set<number>();
  // nota de encaixe: posição principal > alternativas > parentes da função (FALLBACK)
  const fit = (p: Player, role: Pos): number => {
    if (p.pos === role) return 0;
    const a = p.alt?.indexOf(role) ?? -1;
    if (a >= 0) return 1 + a;
    const f = FALLBACK[role].indexOf(p.pos);
    return f >= 0 ? 3 + f : Infinity;
  };
  const pick = (pool: number[], role: Pos): number | undefined => {
    let best: number | undefined;
    let bestScore = Infinity;
    for (const id of pool) {
      if (used.has(id)) continue;
      const sc = fit(byId.get(id)!, role);
      if (sc < bestScore) [best, bestScore] = [id, sc];
    }
    return best;
  };
  const order = slots.map((s, i) => [s, i] as const).sort(
    (a, b) => FILL_ORDER.indexOf(a[0].role) - FILL_ORDER.indexOf(b[0].role),
  );

  // 1) quem já está em campo, pela função
  for (const [s, i] of order) {
    const id = pick(onField, s.role);
    if (id !== undefined) (assigned.set(i, id), used.add(id));
  }
  // 2) quem sobrou em campo vai para as vagas livres (exceto gol)
  for (const [s, i] of order) {
    if (assigned.has(i) || s.role === "GOL") continue;
    const id = onField.find((x) => !used.has(x) && byId.get(x)!.pos !== "GOL");
    if (id !== undefined) (assigned.set(i, id), used.add(id));
  }
  // 3) completa com o banco
  for (const [s, i] of order) {
    if (assigned.has(i)) continue;
    const id = pick(bench, s.role) ?? (s.role === "GOL" ? undefined : bench.find((x) => !used.has(x) && byId.get(x)!.pos !== "GOL"));
    if (id !== undefined) (assigned.set(i, id), used.add(id));
  }

  const out: Token[] = [];
  for (const [i, id] of assigned) {
    const { role, ...pt } = opts.mirrored ? { ...slots[i], ...mirror(slots[i]) } : slots[i];
    // marca a função só quando o jogador está fora da posição principal
    const as = byId.get(id)!.pos !== role ? role : undefined;
    out.push({ kind: opts.kind, ref: id, ...pt, ...(as ? { as } : {}) });
  }
  // extras além de 11 continuam onde estavam
  for (const t of opts.current) if (t.kind === opts.kind && !used.has(t.ref) && byId.has(t.ref)) out.push(t);
  return out;
}

/** Fichas numeradas 1..11 do adversário na formação espelhada. */
export function applyOppNumbers(formation: string): Token[] {
  const slots = slotsFor(formation, false);
  return slots.map((s, i) => ({ kind: "opp" as const, ref: i + 1, ...mirror(s) }));
}
