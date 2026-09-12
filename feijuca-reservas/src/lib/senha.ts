import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Formato armazenado na planilha: scrypt$<salt>$<hash> */
export function hashSenha(senha: string): string {
  const salt = randomBytes(12).toString("hex");
  const hash = scryptSync(senha, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function conferirSenha(senha: string, armazenado: string): boolean {
  const [algoritmo, salt, hash] = (armazenado ?? "").split("$");
  if (algoritmo !== "scrypt" || !salt || !hash) return false;
  const candidato = scryptSync(senha, salt, 32);
  const esperado = Buffer.from(hash, "hex");
  if (candidato.length !== esperado.length) return false;
  return timingSafeEqual(candidato, esperado);
}
