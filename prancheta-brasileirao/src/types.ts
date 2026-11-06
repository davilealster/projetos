export type Pos = "GOL" | "ZAG" | "LD" | "LE" | "VOL" | "MEI" | "PON" | "ATA";
export const POSITIONS: Pos[] = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PON", "ATA"];

export interface Colors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface Player {
  id: number;
  name: string;
  number: number | null;
  pos: Pos;
  photo: string | null;
}

export interface TeamSummary {
  slug: string;
  name: string;
  shortName: string;
  crest: string | null;
  colors: Colors;
}

export interface Team extends TeamSummary {
  updatedAt: string;
  players: Player[];
}

/**
 * Coordenadas canônicas do campo, independentes da orientação na tela:
 * u = comprimento (0 = gol do nosso time, 1 = gol adversário), v = largura (0 = lado esquerdo de quem ataca).
 */
export interface Point {
  u: number;
  v: number;
}

/** player = jogador do clube; opp = ficha numerada; oppPlayer = jogador do clube adversário; ball = bola. */
export type TokenKind = "player" | "opp" | "oppPlayer" | "ball";

export interface Token extends Point {
  kind: TokenKind;
  ref: number;
}

export type DrawTool = "pen" | "arrow" | "pass" | "circle" | "zone";

export interface Drawing {
  id: string;
  tool: DrawTool;
  color: string;
  pts: [number, number][]; // [u, v]
}

export interface SubEvent {
  out: number;
  in: number;
}

export interface BoardState {
  tokens: Token[];
  drawings: Drawing[];
  oppColor: string;
  oppSlug: string | null;
  compact: boolean;
  formation: string;
  subs: SubEvent[];
}
