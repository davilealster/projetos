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

/* --------------------------- Anel de bistros ---------------------------- */

const CENTRO = { x: 51, y: 39 };
const RAIO = { x: 28.5, y: 25 };

/**
 * Os 15 bistros cercam o palco num anel aberto embaixo (onde ficam as mesas
 * unicas e o DJ). A numeracao sobe pela direita, cruza o topo e desce pela
 * esquerda, igual a planta da casa.
 */
function anelDeBistros(): PosicaoCroqui[] {
  const inicio = -50; // graus, canto inferior direito
  const passo = 20;
  return Array.from({ length: 15 }, (_, i) => {
    const angulo = ((inicio + passo * i) * Math.PI) / 180;
    return {
      tipo: "BISTRO" as const,
      numero: String(i + 1).padStart(2, "0"),
      x: Number((CENTRO.x + RAIO.x * Math.cos(angulo)).toFixed(1)),
      y: Number((CENTRO.y - RAIO.y * Math.sin(angulo)).toFixed(1)),
    };
  });
}

/* ---------------------------- Colunas de lounge -------------------------- */

/** Lounges 06→00 descem pela direita; 13→07 descem pela esquerda. */
function colunaDeLounges(x: number, numeros: number[]): PosicaoCroqui[] {
  const topo = 14;
  const base = 70;
  const passo = (base - topo) / (numeros.length - 1);
  return numeros.map((numero, i) => ({
    tipo: "LOUNGE" as const,
    numero: String(numero).padStart(2, "0"),
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
    { rotulo: "PALCO", x: 40, y: 28, largura: 22, altura: 22, tom: "palco" },
    { rotulo: "SOM / DJ", x: 41, y: 66, largura: 20, altura: 7, tom: "dj" },
    { rotulo: "PRAÇA DE ALIMENTAÇÃO", x: 6, y: 88, largura: 38, altura: 18, tom: "servico" },
    { rotulo: "RAMPA", x: 46, y: 88, largura: 18, altura: 24, tom: "servico" },
    { rotulo: "BAR DRINK", x: 66, y: 88, largura: 28, altura: 14, tom: "servico" },
    { rotulo: "ÁREA KIDS", x: 6, y: 108, largura: 26, altura: 9, tom: "kids" },
  ],
  posicoes: [
    ...anelDeBistros(),
    ...colunaDeLounges(89, [6, 5, 4, 3, 2, 1, 0]),
    ...colunaDeLounges(11, [13, 12, 11, 10, 9, 8, 7]),
    { tipo: "LOUNGE", numero: "14", x: 51, y: 78 },
    { tipo: "MESA", numero: "03", x: 42, y: 60 },
    { tipo: "MESA", numero: "02", x: 51, y: 60 },
    { tipo: "MESA", numero: "01", x: 60, y: 60 },
  ],
};

export const CROQUIS: Croqui[] = [CROQUI_SOULBRADO];

/** Chave estavel para casar croqui com planilha ("00" e "0" sao o mesmo lounge). */
export function chaveUnidade(tipo: TipoUnidade, numero: string | number): string {
  const n = Number(numero);
  return `${tipo}:${Number.isFinite(n) ? n : String(numero).trim().toUpperCase()}`;
}

/** Valores usados ao criar as unidades de um evento a partir do croqui. */
export const PADRAO_POR_TIPO: Record<TipoUnidade, { capacidade: string; valor: string }> = {
  LOUNGE: { capacidade: "8", valor: "600" },
  BISTRO: { capacidade: "4", valor: "200" },
  MESA: { capacidade: "4", valor: "250" },
};

export function croquiPorId(id: string): Croqui | null {
  return CROQUIS.find((c) => c.id === id.trim().toUpperCase()) ?? null;
}
