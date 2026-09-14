import type { Evento, Reserva, Unidade, UnidadeComReserva } from "./types";

export const FUSO = "America/Sao_Paulo";

/** Data de hoje em Sao Paulo no formato AAAA-MM-DD. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function paraUTC(dataISO: string): number {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1);
}

/** Dias inteiros de hoje ate a data do evento (0 = hoje, 1 = amanha, negativo = passado). */
export function diasParaEvento(evento: Pick<Evento, "data">): number {
  if (!evento.data) return 999;
  return Math.round((paraUTC(evento.data) - paraUTC(hojeISO())) / 86_400_000);
}

export function prazoPrioridadeDias(evento: Pick<Evento, "prioridade_aniversariante_dias">): number {
  const valor = Number(evento.prioridade_aniversariante_dias);
  return Number.isFinite(valor) && valor >= 0 ? valor : 1;
}

export interface StatusPrioridade {
  /** true quando qualquer pessoa ja pode pegar lounge. */
  liberado: boolean;
  /** true quando a liberacao veio de um destravamento manual do admin. */
  liberadoManualmente: boolean;
  dias: number;
  prazo: number;
  mensagem: string;
}

/**
 * Lounge e' prioridade de aniversariante ate a vespera do evento.
 * Chegando no prazo (padrao: 1 dia antes), os lounges que sobraram
 * podem ser vendidos para qualquer pessoa. O admin tambem pode
 * destravar antes disso pela tela do evento.
 */
export function statusPrioridadeLounge(evento: Evento): StatusPrioridade {
  const dias = diasParaEvento(evento);
  const prazo = prazoPrioridadeDias(evento);
  const manual = (evento.lounges_liberados ?? "").toUpperCase() === "SIM";
  const porPrazo = dias <= prazo;
  const liberado = manual || porPrazo;

  let mensagem: string;
  if (manual && !porPrazo) {
    mensagem = "Liberado manualmente: qualquer pessoa pode reservar lounge.";
  } else if (porPrazo) {
    mensagem =
      dias < 0
        ? "Evento já aconteceu."
        : "Estamos na véspera: os lounges que sobraram valem para qualquer pessoa.";
  } else {
    const falta = dias - prazo;
    mensagem = `Prioridade de aniversariante ativa. Libera para todos em ${falta} ${
      falta === 1 ? "dia" : "dias"
    }.`;
  }

  return { liberado, liberadoManualmente: manual && !porPrazo, dias, prazo, mensagem };
}

export function ehAniversariante(valor: unknown): boolean {
  return String(valor ?? "").trim().toUpperCase() === "SIM";
}

/** Regra de negocio central da reserva de lounge. */
export function validarReservaLounge(
  evento: Evento,
  aniversariante: boolean,
): { ok: true } | { ok: false; motivo: string } {
  if (aniversariante) return { ok: true };
  const status = statusPrioridadeLounge(evento);
  if (status.liberado) return { ok: true };
  const falta = status.dias - status.prazo;
  return {
    ok: false,
    motivo: `Lounge é exclusivo de aniversariante até a véspera do evento. Faltam ${falta} ${
      falta === 1 ? "dia" : "dias"
    } para liberar geral (ou um admin pode destravar na tela do evento).`,
  };
}

export const RESERVA_ATIVA: Reserva["status"][] = ["PENDENTE", "CONFIRMADA", "CHECKIN"];

export function reservaAtiva(reserva: Pick<Reserva, "status">): boolean {
  return RESERVA_ATIVA.includes(reserva.status);
}

/** Cruza o mapa de unidades com as reservas ativas do evento. */
export function montarMapa(unidades: Unidade[], reservas: Reserva[]): UnidadeComReserva[] {
  const porUnidade = new Map<string, Reserva>();
  for (const reserva of reservas) {
    if (reservaAtiva(reserva)) porUnidade.set(reserva.unidade_id, reserva);
  }
  return unidades
    .map((unidade) => {
      const reserva = porUnidade.get(unidade.id) ?? null;
      return { ...unidade, reserva, ocupado: reserva !== null };
    })
    .sort((a, b) => Number(a.numero) - Number(b.numero));
}

export function contarPessoas(reservas: Reserva[]): number {
  return reservas
    .filter(reservaAtiva)
    .reduce((total, r) => total + (Number(r.qtd_pessoas) || 0), 0);
}
