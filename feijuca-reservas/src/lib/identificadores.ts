import { randomBytes } from "node:crypto";

/**
 * Token do link público. Precisa ser impossível de adivinhar: é ele que
 * separa "quem recebeu o link" de "qualquer um na internet".
 */
export function gerarToken(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * Id sem leitura prévia da planilha. O `nextId` sequencial faz
 * ler-somar-gravar, e dois envios simultâneos pelo link público — coisa
 * comum na véspera do evento — gerariam o mesmo id.
 */
export function idAleatorio(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}
