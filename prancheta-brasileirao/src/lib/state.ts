import { POSITIONS, type BoardState, type Drawing, type DrawTool, type Token, type TokenKind } from "../types";

export const DEFAULT_OPP_COLOR = "#E8E8E8";

export const emptyState = (): BoardState => ({
  tokens: [{ kind: "ball", ref: 0, u: 0.5, v: 0.5 }],
  drawings: [],
  oppColor: DEFAULT_OPP_COLOR,
  oppSlug: null,
  compact: false,
  formation: "4-3-3",
  subs: [],
  show: { ...SHOW_ALL },
});

export const SHOW_ALL = { pos: true, name: true, num: true, photo: true } as const;
const SHOW_KEYS = ["pos", "name", "num", "photo"] as const;

const key = (slug: string) => `prancheta:${slug}:v1`;

export function loadSaved(slug: string): BoardState | null {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<BoardState>;
    return { ...emptyState(), ...saved, show: { ...SHOW_ALL, ...(saved.show ?? {}) } };
  } catch {
    return null;
  }
}

export function save(slug: string, s: BoardState): void {
  try {
    localStorage.setItem(key(slug), JSON.stringify(s));
  } catch {
    /* modo privado ou armazenamento cheio: segue sem salvar */
  }
}

export function getPref(name: string): string | null {
  try {
    return localStorage.getItem(`prancheta:${name}`);
  } catch {
    return null;
  }
}
export function setPref(name: string, value: string): void {
  try {
    localStorage.setItem(`prancheta:${name}`, value);
  } catch {
    /* ignore */
  }
}

// ---- link compartilhável: estado compacto em base64url no hash (#s=...) ----

const KINDS: TokenKind[] = ["player", "opp", "oppPlayer", "ball"];
const TOOLS: DrawTool[] = ["pen", "arrow", "pass", "circle", "zone"];
const q = (n: number) => Math.round(n * 1000);

interface Packed {
  t: ([number, number, number, number] | [number, number, number, number, number])[];
  d?: [number, string, number[]][];
  c?: string;
  o?: string;
  f?: string;
  /** opções de exibição como bits (pos, name, num, photo); ausente = tudo ligado */
  h?: number;
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeState(s: BoardState): string {
  const p: Packed = {
    t: s.tokens.map((t) =>
      t.as ? [KINDS.indexOf(t.kind), t.ref, q(t.u), q(t.v), POSITIONS.indexOf(t.as)] : [KINDS.indexOf(t.kind), t.ref, q(t.u), q(t.v)],
    ),
  };
  if (s.drawings.length)
    p.d = s.drawings.map((d) => [TOOLS.indexOf(d.tool), d.color, d.pts.flatMap(([u, v]) => [q(u), q(v)])]);
  if (s.oppColor !== DEFAULT_OPP_COLOR) p.c = s.oppColor;
  if (s.oppSlug) p.o = s.oppSlug;
  p.f = s.formation;
  const bits = SHOW_KEYS.reduce((n, k, i) => n | (s.show[k] ? 1 << i : 0), 0);
  if (bits !== 15) p.h = bits;
  return b64urlEncode(JSON.stringify(p));
}

export function decodeState(code: string): BoardState | null {
  try {
    const p = JSON.parse(b64urlDecode(code)) as Packed;
    if (!Array.isArray(p.t)) return null;
    const tokens: Token[] = p.t
      .filter(([k]) => KINDS[k])
      .map(([k, ref, u, v, as]) => ({
        kind: KINDS[k],
        ref,
        u: u / 1000,
        v: v / 1000,
        ...(as !== undefined && POSITIONS[as] ? { as: POSITIONS[as] } : {}),
      }));
    const drawings: Drawing[] = (p.d ?? [])
      .filter(([tool]) => TOOLS[tool])
      .map(([tool, color, flat], i) => {
        const pts: [number, number][] = [];
        for (let j = 0; j + 1 < flat.length; j += 2) pts.push([flat[j] / 1000, flat[j + 1] / 1000]);
        return { id: `s${i}`, tool: TOOLS[tool], color, pts };
      });
    return {
      ...emptyState(),
      tokens,
      drawings,
      oppColor: p.c ?? DEFAULT_OPP_COLOR,
      oppSlug: p.o ?? null,
      formation: p.f ?? "4-3-3",
      show:
        p.h === undefined
          ? { ...SHOW_ALL }
          : { pos: !!(p.h & 1), name: !!(p.h & 2), num: !!(p.h & 4), photo: !!(p.h & 8) },
    };
  } catch {
    return null;
  }
}

export const readHashState = (): BoardState | null => {
  const m = location.hash.match(/[#&]s=([A-Za-z0-9_-]+)/);
  return m ? decodeState(m[1]) : null;
};
