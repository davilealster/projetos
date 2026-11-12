// Tipos do módulo de mercado de transferências (gerados por scripts/build-market.ts a partir do Transfermarkt).
import type { Pos } from "../types";

/** Como o jogador chegou ao clube atual. */
export interface Arrival {
  type: "transfer" | "freeTransfer" | "loan" | "youth" | "unknown";
  from: string | null;
  /** valor pago, em euros (null = sem valor informado) */
  fee: number | null;
  date: string | null;
}

/** "owned" = do clube; "loanIn" = chegou emprestado; "loanOut" = do clube, emprestado a outro. */
export type SquadStatus = "owned" | "loanIn" | "loanOut";

/** Jogador do elenco de um clube da Série A, com situação contratual. */
export interface SquadPlayer {
  id: string;
  name: string;
  pos: Pos;
  posName: string | null;
  age: number | null;
  /** valor de mercado em euros */
  value: number | null;
  /** fim do contrato (ou do empréstimo, para quem chegou emprestado), AAAA-MM-DD */
  contract: string | null;
  nat: string | null;
  /** sem nacionalidade brasileira (conta no limite de estrangeiros) */
  foreign: boolean;
  num: number | null;
  photo: string | null;
  status: SquadStatus;
  /** clube de origem do empréstimo (loanIn) ou clube onde está emprestado (loanOut) */
  loanClub?: string | null;
  loanUntil?: string | null;
  arrival: Arrival;
  joined: string | null;
}

export interface ClubMarket {
  slug: string;
  tmId: string;
  name: string;
  collectedAt: string;
  squad: SquadPlayer[];
}

/** Jogador disponível no mercado (arquivo por liga). `club` é o índice em `clubs`. */
export interface MarketPlayer {
  id: string;
  name: string;
  club: number;
  pos: Pos;
  posName: string | null;
  age: number | null;
  value: number | null;
  contract: string | null;
  nat: string | null;
  foreign: boolean;
  photo: string | null;
  /** se chegou emprestado ao clube atual: clube dono */
  loanFrom?: string | null;
}

export interface MarketLeague {
  id: string;
  name: string;
  group: string;
  clubs: { id: string; name: string }[];
  players: MarketPlayer[];
}

export interface MarketIndex {
  collectedAt: string | null;
  /** início da próxima temporada: contratos que acabam antes disso estão "terminando" */
  nextSeasonStart: string;
  leagues: { id: string; name: string; group: string; clubs: number; players: number }[];
  /** slug do clube da Série A → id no Transfermarkt */
  clubs: Record<string, string>;
}
