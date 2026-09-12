import { HttpError } from "./auth";
import { TABS, type TabName } from "./sheets";
import type { TipoUnidade } from "./types";

export function normalizarTipo(valor: unknown): TipoUnidade {
  const v = String(valor ?? "").trim().toUpperCase();
  if (v === "LOUNGE" || v === "BISTRO") return v;
  throw new HttpError(400, 'Tipo invalido. Use "LOUNGE" ou "BISTRO".');
}

export function tabelaDoTipo(tipo: TipoUnidade): TabName {
  return tipo === "LOUNGE" ? TABS.lounges : TABS.bistros;
}

export function prefixoDoTipo(tipo: TipoUnidade): string {
  return tipo === "LOUNGE" ? "lng" : "bis";
}

export function rotuloDoTipo(tipo: TipoUnidade): string {
  return tipo === "LOUNGE" ? "Lounge" : "Bistro";
}
