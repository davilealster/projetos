import type { TipoUnidade } from "./types";

/**
 * Croqui do Soulbrado (Anil) — planta baixa vista de cima.
 *
 * O croqui e' um MOLDE: ele diz onde cada lounge, bistro e mesa fica no
 * salao. Quem manda no que existe de verdade e' a planilha. Assim o mesmo
 * desenho serve para qualquer evento na casa, e uma unidade que nao estiver
 * cadastrada no evento aparece apagada no mapa.
 *
 * Coordenadas em porcentagem da largura (x) e da altura (y) do desenho.
 */

export interface PosicaoCroqui {
  tipo: TipoUnidade;
  /** Numero como aparece na planta ("00", "07", "15"). */
  numero: string;
  x: number;
  y: number;
}

export interface ZonaCroqui {
  rotulo: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  tom: "palco" | "deck" | "servico" | "kids" | "entrada" | "dj";
}

export interface Croqui {
  id: string;
  nome: string;
  local: string;
  /** Largura / altura do desenho, para o CSS aspect-ratio. */
  proporcao: number;
  zonas: ZonaCroqui[];
  posicoes: PosicaoCroqui[];
}

const LARGURA = 100;
const ALTURA = 118;

/* -------------------------- Retangulo de bistros ------------------------- */

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Os bistros formam um retangulo em volta do palco, como na planta da casa:
 * 06 a 10 na fileira de cima, 01 a 05 descendo pela direita e 11 a 15
 * descendo pela esquerda. O lado de baixo fica livre para o som e as mesas.
 */
const Y_FILEIRA_SUPERIOR = 20;
const X_FILEIRA_SUPERIOR = [34, 42.5, 51, 59.5, 68];
const Y_COLUNAS = [29, 38, 47, 56, 65];

function fileiraSuperiorDeBistros(): PosicaoCroqui[] {
  // Da esquerda para a direita: 10 09 08 07 06.
  return [10, 9, 8, 7, 6].map((numero, i) => ({
    tipo: "BISTRO" as const,
    numero: doisDigitos(numero),
    x: X_FILEIRA_SUPERIOR[i],
    y: Y_FILEIRA_SUPERIOR,
  }));
}

function colunaDeBistros(x: number, numeros: number[]): PosicaoCroqui[] {
  return numeros.map((numero, i) => ({
    tipo: "BISTRO" as const,
    numero: doisDigitos(numero),
    x,
    y: Y_COLUNAS[i],
  }));
}

/* ---------------------------- Colunas de lounge -------------------------- */

/** Lounges 06→00 descem pela direita; 13→07 descem pela esquerda. */
function colunaDeLounges(x: number, numeros: number[]): PosicaoCroqui[] {
  const topo = 14;
  const base = 70;
  const passo = (base - topo) / (numeros.length - 1);
  return numeros.map((numero, i) => ({
    tipo: "LOUNGE" as const,
    numero: doisDigitos(numero),
    x,
    y: Number((topo + passo * i).toFixed(1)),
  }));
}

export const CROQUI_SOULBRADO: Croqui = {
  id: "SOULBRADO",
  nome: "Soulbrado",
  local: "Soulbrado - Anil",
  proporcao: LARGURA / ALTURA,
  zonas: [
    { rotulo: "ENTRADA", x: 58, y: 0.5, largura: 36, altura: 6, tom: "entrada" },
    { rotulo: "", x: 6, y: 8, largura: 88, altura: 76, tom: "deck" },
    { rotulo: "PALCO", x: 40, y: 29, largura: 22, altura: 22, tom: "palco" },
    { rotulo: "SOM / DJ", x: 41, y: 55, largura: 20, altura: 8, tom: "dj" },
    { rotulo: "PRAÇA DE ALIMENTAÇÃO", x: 6, y: 88, largura: 38, altura: 18, tom: "servico" },
    { rotulo: "RAMPA", x: 46, y: 88, largura: 18, altura: 24, tom: "servico" },
    { rotulo: "BAR DRINK", x: 66, y: 88, largura: 28, altura: 14, tom: "servico" },
    { rotulo: "ÁREA KIDS", x: 6, y: 108, largura: 26, altura: 9, tom: "kids" },
  ],
  posicoes: [
    ...fileiraSuperiorDeBistros(),
    ...colunaDeBistros(71, [5, 4, 3, 2, 1]),
    ...colunaDeBistros(31, [11, 12, 13, 14, 15]),
    ...colunaDeLounges(89, [6, 5, 4, 3, 2, 1, 0]),
    ...colunaDeLounges(13, [13, 12, 11, 10, 9, 8, 7]),
    { tipo: "LOUNGE", numero: "14", x: 51, y: 79.5 },
    // As mesas unicas ficam depois do som, entre ele e a rampa.
    { tipo: "MESA", numero: "03", x: 42, y: 70 },
    { tipo: "MESA", numero: "02", x: 51, y: 70 },
    { tipo: "MESA", numero: "01", x: 60, y: 70 },
  ],
};

export const CROQUIS: Croqui[] = [CROQUI_SOULBRADO];

/** Chave estavel para casar croqui com planilha ("00" e "0" sao o mesmo lounge). */
export function chaveUnidade(tipo: TipoUnidade, numero: string | number): string {
  const n = Number(numero);
  return `${tipo}:${Number.isFinite(n) ? n : String(numero).trim().toUpperCase()}`;
}

/**
 * Capacidade padrao de cada tipo. O valor cobrado nao mora aqui: ele vem do
 * evento (valor_lounge / valor_bistro / valor_mesa), e o padrao e' cortesia.
 */
export const PADRAO_POR_TIPO: Record<TipoUnidade, { capacidade: string }> = {
  LOUNGE: { capacidade: "8" },
  BISTRO: { capacidade: "4" },
  MESA: { capacidade: "4" },
};

export function croquiPorId(id: string): Croqui | null {
  return CROQUIS.find((c) => c.id === id.trim().toUpperCase()) ?? null;
}
