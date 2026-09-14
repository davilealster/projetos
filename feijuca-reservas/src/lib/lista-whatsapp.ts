import type { TipoUnidade, UnidadeComReserva } from "./types";

/**
 * Monta a lista de reservas no formato que a equipe ja usa no grupo do
 * WhatsApp. O texto e' colado direto na conversa, entao o formato importa:
 * uma linha por posicao, vazias inclusive, e bolo no aniversariante.
 */

export const CABECALHO = "FEIJUCA PDS";

const SECOES: { tipo: TipoUnidade; emoji: string; rotulo: string }[] = [
  { tipo: "LOUNGE", emoji: "🟠", rotulo: "LOUNGE" },
  { tipo: "MESA", emoji: "⚪️", rotulo: "MESA" },
  { tipo: "BISTRO", emoji: "🟢", rotulo: "BISTRÔ" },
];

export interface GruposDeUnidades {
  LOUNGE: UnidadeComReserva[];
  MESA: UnidadeComReserva[];
  BISTRO: UnidadeComReserva[];
}

function dataBrasileira(iso: string): string {
  const [ano, mes, dia] = (iso ?? "").split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
}

function nomeNaLinha(unidade: UnidadeComReserva): string {
  const reserva = unidade.reserva;
  if (!reserva) return "";
  const nome = reserva.nome_cliente.trim();
  return reserva.aniversariante === "SIM" ? `${nome}🎂` : nome;
}

function linha(unidade: UnidadeComReserva): string {
  const numero = String(unidade.numero).padStart(2, "0");
  const nome = nomeNaLinha(unidade);
  if (nome) return `${numero} - ${nome}`;
  // Sem essa marca, uma mesa fora de uso parece vaga para quem le' no grupo.
  if ((unidade.status ?? "").toUpperCase() === "BLOQUEADO") return `${numero} - indisponível`;
  return `${numero} -`;
}

function porNumero(a: UnidadeComReserva, b: UnidadeComReserva): number {
  return (Number(a.numero) || 0) - (Number(b.numero) || 0);
}

export function montarTextoWhatsapp(
  evento: { data: string },
  grupos: GruposDeUnidades,
): string {
  const partes: string[] = [CABECALHO, `RESERVAS - ${dataBrasileira(evento.data)}`];

  for (const { tipo, emoji, rotulo } of SECOES) {
    const unidades = [...(grupos[tipo] ?? [])].sort(porNumero);
    if (!unidades.length) continue;
    partes.push("", `${emoji} ${rotulo}`, ...unidades.map(linha));
  }

  return partes.join("\n");
}

/** Quantas posicoes estao ocupadas, para o rotulo do botao. */
export function contarOcupadas(grupos: GruposDeUnidades): number {
  return SECOES.reduce(
    (total, { tipo }) => total + (grupos[tipo] ?? []).filter((u) => u.ocupado).length,
    0,
  );
}

export { SECOES };
