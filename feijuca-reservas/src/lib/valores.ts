import type { Evento, TipoUnidade } from "./types";

const CAMPO_VALOR: Record<TipoUnidade, "valor_lounge" | "valor_bistro" | "valor_mesa"> = {
  LOUNGE: "valor_lounge",
  BISTRO: "valor_bistro",
  MESA: "valor_mesa",
};

export function campoValorDoTipo(tipo: TipoUnidade) {
  return CAMPO_VALOR[tipo];
}

/**
 * Valor padrao que o evento cobra por este tipo, como string normalizada.
 * Vazio, invalido ou negativo viram "0": cortesia e' o padrao da casa.
 */
export function valorPadraoDoEvento(evento: Evento, tipo: TipoUnidade): string {
  return normalizarValor(evento[CAMPO_VALOR[tipo]]);
}

/**
 * Le' o que a pessoa digitou no celular e devolve um numero em string.
 * Aceita "600", "R$ 600,00", "1.200", "1.200,50" e "250.50"; qualquer coisa
 * que nao vire um numero positivo vira "0" (cortesia).
 */
export function normalizarValor(bruto: unknown): string {
  const texto = String(bruto ?? "").trim();
  if (!texto) return "0";

  // Fora simbolo de moeda, espacos e qualquer letra.
  const limpo = texto.replace(/[^\d.,-]/g, "");
  if (!limpo) return "0";

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado: string;

  if (ultimaVirgula !== -1 && ultimoPonto !== -1) {
    // Convivem os dois: o que vier por ultimo e' o separador decimal.
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    normalizado = limpo.split(milhar).join("").replace(decimal, ".");
  } else if (ultimaVirgula !== -1) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto !== -1) {
    // Ponto sozinho com tres casas depois e' separador de milhar: "1.200".
    const casas = limpo.length - ultimoPonto - 1;
    const soUmPonto = limpo.indexOf(".") === ultimoPonto;
    normalizado = soUmPonto && casas === 3 ? limpo.replace(".", "") : limpo.replace(/\.(?=.*\.)/g, "");
  } else {
    normalizado = limpo;
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? String(numero) : "0";
}

/**
 * Valor de uma reserva na tela. Zero e vazio nao sao "nao informado":
 * a reserva e' cortesia, e a tela precisa dizer isso com todas as letras.
 */
export function formatarValorReserva(valor: string | number): string {
  const normalizado = Number(normalizarValor(valor));
  if (normalizado <= 0) return "Gratuito";
  return normalizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ehCortesia(valor: string | number): boolean {
  return Number(normalizarValor(valor)) <= 0;
}
