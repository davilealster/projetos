import { NextResponse } from "next/server";
import { HttpError } from "./erros";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function lerCorpo<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Corpo da requisicao invalido.");
  }
}

export function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

export function obrigatorio(valor: unknown, campo: string): string {
  const v = texto(valor);
  if (!v) throw new HttpError(400, `Campo obrigatorio: ${campo}.`);
  return v;
}

export function simNao(valor: unknown): "SIM" | "NAO" {
  const v = texto(valor).toUpperCase();
  return v === "SIM" || v === "TRUE" || v === "1" ? "SIM" : "NAO";
}

export function inteiro(valor: unknown, padrao = 0): number {
  const n = Number(texto(valor));
  return Number.isFinite(n) ? Math.trunc(n) : padrao;
}

/** Mantem no patch somente as chaves enviadas pelo cliente. */
export function selecionar<T extends Record<string, unknown>>(
  origem: T,
  chaves: string[],
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const chave of chaves) {
    if (origem[chave] !== undefined) saida[chave] = texto(origem[chave]);
  }
  return saida;
}
