import { HttpError } from "./auth";
import { TABS, type TabName } from "./sheets";
import type { TipoUnidade } from "./types";

export const TIPOS_UNIDADE: TipoUnidade[] = ["LOUNGE", "BISTRO", "MESA"];

export function normalizarTipo(valor: unknown): TipoUnidade {
  const v = String(valor ?? "").trim().toUpperCase() as TipoUnidade;
  if (TIPOS_UNIDADE.includes(v)) return v;
  throw new HttpError(400, 'Tipo invalido. Use "LOUNGE", "BISTRO" ou "MESA".');
}

const TABELAS: Record<TipoUnidade, TabName> = {
  LOUNGE: TABS.lounges,
  BISTRO: TABS.bistros,
  MESA: TABS.mesas,
};

const PREFIXOS: Record<TipoUnidade, string> = {
  LOUNGE: "lng",
  BISTRO: "bis",
  MESA: "mes",
};

const ROTULOS: Record<TipoUnidade, string> = {
  LOUNGE: "Lounge",
  BISTRO: "Bistro",
  MESA: "Mesa",
};

export function tabelaDoTipo(tipo: TipoUnidade): TabName {
  return TABELAS[tipo];
}

export function prefixoDoTipo(tipo: TipoUnidade): string {
  return PREFIXOS[tipo];
}

export function rotuloDoTipo(tipo: TipoUnidade): string {
  return ROTULOS[tipo];
}
