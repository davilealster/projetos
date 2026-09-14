export type Papel = "ADMIN" | "PORTARIA" | "VENDAS";

export type TipoUnidade = "LOUNGE" | "BISTRO" | "MESA";

export type StatusReserva = "PENDENTE" | "CONFIRMADA" | "CHECKIN" | "CANCELADA";

export type StatusVip = "PENDENTE" | "CHECKIN" | "CANCELADO";

export type TipoVip = "VIP" | "CORTESIA" | "DESCONTO" | "ANIVERSARIANTE";

export type StatusEvento = "RASCUNHO" | "ATIVO" | "ENCERRADO";

export interface Usuario {
  id: string;
  nome: string;
  usuario: string;
  senha_hash: string;
  papel: Papel;
  ativo: string;
  criado_em: string;
}

export interface SessionUser {
  id: string;
  nome: string;
  usuario: string;
  papel: Papel;
}

export interface Evento {
  id: string;
  nome: string;
  /** AAAA-MM-DD */
  data: string;
  hora_inicio: string;
  local: string;
  status: StatusEvento;
  /** "SIM" libera lounges para nao aniversariantes antes do prazo */
  lounges_liberados: string;
  prioridade_aniversariante_dias: string;
  capacidade_lista_vip: string;
  observacoes: string;
  criado_em: string;
  /** Valor padrao cobrado por reserva. "0" ou vazio = cortesia. */
  valor_lounge: string;
  valor_bistro: string;
  valor_mesa: string;
}

export interface Unidade {
  id: string;
  evento_id: string;
  numero: string;
  nome: string;
  capacidade: string;
  valor: string;
  /** DISPONIVEL | BLOQUEADO */
  status: string;
  observacoes: string;
}

export interface Reserva {
  id: string;
  evento_id: string;
  tipo: TipoUnidade;
  unidade_id: string;
  numero: string;
  nome_cliente: string;
  telefone: string;
  instagram: string;
  qtd_pessoas: string;
  /** SIM | NAO */
  aniversariante: string;
  data_aniversario: string;
  status: StatusReserva;
  valor: string;
  sinal_pago: string;
  observacoes: string;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  checkin_em: string;
}

export type StatusLista = "ATIVA" | "PAUSADA" | "ENCERRADA";

/** Link público por onde alguém de fora manda nomes para a lista VIP. */
export interface ListaPublica {
  id: string;
  evento_id: string;
  /** Como a equipe reconhece a lista: "Lista do Davi". */
  nome: string;
  /** Segredo da URL /lista/<token>. */
  token: string;
  responsavel: string;
  /** "" ou "0" = sem limite. */
  limite_nomes: string;
  status: StatusLista;
  instrucoes: string;
  criado_por: string;
  criado_em: string;
}

export interface Vip {
  id: string;
  evento_id: string;
  nome: string;
  documento: string;
  telefone: string;
  instagram: string;
  acompanhantes: string;
  tipo: TipoVip;
  status: StatusVip;
  promoter: string;
  observacoes: string;
  criado_por: string;
  criado_em: string;
  checkin_em: string;
  /** Preenchido quando o nome chegou por um link público. */
  lista_id: string;
}

/** Unidade + reserva ativa, como o app consome nas telas de mapa. */
export interface UnidadeComReserva extends Unidade {
  reserva: Reserva | null;
  ocupado: boolean;
}
