import type { Papel } from "./types";

/**
 * Quem pode o quê, num lugar só. Espalhar listas de papel pelas rotas faz
 * a regra divergir entre a tela e o servidor — e é a tela que some, não a
 * rota, então o buraco fica aberto.
 */
export type Capacidade =
  /** Criar, editar, mover, trocar e cancelar reserva de lounge, bistrô e mesa. */
  | "reservas"
  /** Marcar presença de quem tem mesa reservada. */
  | "checkinReserva"
  /** Abrir a lista da portaria e ver os nomes. */
  | "verVip"
  /** Incluir nome na lista e marcar presença. */
  | "incluirVip"
  /** Editar os dados de um nome ou tirá-lo da lista. */
  | "editarVip"
  /** Criar e administrar os links públicos de lista. */
  | "linksLista"
  /** Eventos, unidades, croqui e usuários. */
  | "administrar";

const MATRIZ: Record<Capacidade, readonly Papel[]> = {
  reservas: ["ADMIN", "VENDAS"],
  checkinReserva: ["ADMIN", "VENDAS", "PORTARIA"],
  verVip: ["ADMIN", "PORTARIA"],
  incluirVip: ["ADMIN", "PORTARIA"],
  editarVip: ["ADMIN"],
  linksLista: ["ADMIN"],
  administrar: ["ADMIN"],
};

export function pode(papel: Papel | undefined | null, capacidade: Capacidade): boolean {
  return papel ? MATRIZ[capacidade].includes(papel) : false;
}

/** Para passar direto ao `exigirSessao`. */
export function papeisCom(capacidade: Capacidade): Papel[] {
  return [...MATRIZ[capacidade]];
}

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  ADMIN: "Tudo: reservas, lista VIP, eventos e usuários",
  VENDAS: "Somente reservas de lounge, bistrô e mesa",
  PORTARIA: "Somente lista VIP e check-in",
};
