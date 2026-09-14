import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./types";

export const COOKIE_NAME = "pds_sessao";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('Variável de ambiente AUTH_SECRET não configurada.');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    // secretKey() lanca quando o app ainda nao foi configurado: tratamos como
    // "sem sessao" para a tela de login/diagnóstico conseguir renderizar.
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.id || !payload.usuario) return null;
    return {
      id: String(payload.id),
      nome: String(payload.nome ?? ""),
      usuario: String(payload.usuario),
      papel: payload.papel as SessionUser["papel"],
    };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  name: COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
