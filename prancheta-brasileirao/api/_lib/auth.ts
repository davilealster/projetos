// Login do admin: usuário + senha (hash scrypt no armazenamento privado) e sessão em cookie JWT.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { readDoc, writeDoc } from "./store.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "pb_admin";
const AUTH_DOC = "admin/auth.json";
const isProd = () => process.env.VERCEL === "1";

interface AuthDoc {
  user: string;
  hash: string; // "salt:hash" em hex
  updatedAt: string;
}

function secret(): Uint8Array {
  const s = process.env.ADMIN_SECRET ?? (isProd() ? "" : "dev-secret-nao-usar-em-producao");
  if (s.length < 16) throw new Error("ADMIN_SECRET ausente");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32);
  return `${salt.toString("hex")}:${h.toString("hex")}`;
}

async function checkHash(pw: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const h = await scrypt(pw, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === h.length && timingSafeEqual(h, expected);
}

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Senha trocada pelo painel (armazenada) vale; senão vale a senha padrão das variáveis de ambiente. */
export async function verifyLogin(user: string, pw: string): Promise<boolean> {
  const doc = await readDoc<AuthDoc>(AUTH_DOC);
  if (doc) return sameText(user, doc.user) && (await checkHash(pw, doc.hash));
  const defUser = process.env.ADMIN_USER ?? "admin";
  const defPw = process.env.ADMIN_PASSWORD ?? (isProd() ? "" : "prancheta-dev");
  if (!defPw) return false;
  return sameText(user, defUser) && sameText(pw, defPw);
}

export async function setCredentials(user: string, pw: string): Promise<void> {
  await writeDoc(AUTH_DOC, { user, hash: await hashPassword(pw), updatedAt: new Date().toISOString() } satisfies AuthDoc);
}

export async function sessionCookie(user: string): Promise<string> {
  const token = await new SignJWT({ sub: user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  return `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}${isProd() ? "; Secure" : ""}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${isProd() ? "; Secure" : ""}`;

/** Usuário logado ou null. */
export async function currentUser(req: Request): Promise<string | null> {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

export const unauthorized = () => json({ error: "não autenticado" }, 401);
