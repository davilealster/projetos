// Conta do torcedor (login opcional com Google) e a jornada salva na conta.
// Login: o navegador recebe um "ID token" do Google (Google Identity Services); aqui ele é validado
// com as chaves públicas do Google e trocado por um cookie de sessão nosso (JWT assinado).
// Jornada: um documento por usuário no armazenamento privado (o mesmo Blob do admin).
import { createHash } from "node:crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { readDoc, writeDoc } from "./store.js";

const COOKIE = "mef_user";
const isProd = () => process.env.VERCEL === "1";
const MAX_AGE = 365 * 86400;

export const googleClientId = () => (process.env.GOOGLE_CLIENT_ID ?? "").trim();
/** Login ligado só quando o Client ID do Google está configurado (e há onde guardar em produção). */
export const accountEnabled = () => !!googleClientId() && (!isProd() || !!process.env.BLOB_READ_WRITE_TOKEN);

function secret(): Uint8Array {
  const s = process.env.USER_SESSION_SECRET ?? (isProd() ? "" : "dev-user-secret-nao-usar-em-producao");
  if (s.length < 16) throw new Error("USER_SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

export interface AccountUser {
  sub: string;
  name: string;
  picture: string | null;
}

const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Valida o ID token do Google (assinatura, emissor, público e validade). */
export async function verifyGoogleCredential(credential: string): Promise<AccountUser> {
  const { payload } = await jwtVerify(credential, GOOGLE_KEYS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: googleClientId(),
  });
  if (typeof payload.sub !== "string") throw new Error("token sem sub");
  const name = typeof payload.given_name === "string" ? payload.given_name : typeof payload.name === "string" ? payload.name : "Torcedor";
  return { sub: payload.sub, name, picture: typeof payload.picture === "string" ? payload.picture : null };
}

export async function userCookie(u: AccountUser): Promise<string> {
  const token = await new SignJWT({ name: u.name, picture: u.picture })
    .setSubject(u.sub)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  return `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isProd() ? "; Secure" : ""}`;
}

export const clearUserCookie = () => `${COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${isProd() ? "; Secure" : ""}`;

export async function currentAccount(req: Request): Promise<AccountUser | null> {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], secret());
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, name: String(payload.name ?? "Torcedor"), picture: typeof payload.picture === "string" ? payload.picture : null };
  } catch {
    return null;
  }
}

// ---------- jornada ----------

/** Só estas chaves do navegador vão para a conta. */
export const JOURNEY_KEY = /^(mando|mercado|olheiro|prancheta):[\w:-]{1,60}$/;
const MAX_VALUE = 200_000;
const MAX_TOTAL = 2_000_000;

export interface JourneyDoc {
  entries: Record<string, string>;
  updatedAt: string;
}

const docName = (sub: string) => `users/${createHash("sha256").update(sub).digest("hex").slice(0, 32)}.json`;

export async function readJourney(sub: string): Promise<JourneyDoc> {
  return (await readDoc<JourneyDoc>(docName(sub))) ?? { entries: {}, updatedAt: "" };
}

/** Aplica mudanças (null apaga a chave). Ignora chaves fora da lista; recusa tamanhos absurdos. */
export function mergeJourney(doc: JourneyDoc, changes: Record<string, unknown>, now = new Date().toISOString()): JourneyDoc {
  const entries = { ...doc.entries };
  for (const [k, v] of Object.entries(changes)) {
    if (!JOURNEY_KEY.test(k)) continue;
    if (v === null) delete entries[k];
    else if (typeof v === "string" && v.length <= MAX_VALUE) entries[k] = v;
  }
  const total = Object.values(entries).reduce((a, v) => a + v.length, 0);
  if (total > MAX_TOTAL) throw new Error("jornada grande demais");
  return { entries, updatedAt: now };
}

export async function writeJourney(sub: string, doc: JourneyDoc): Promise<void> {
  await writeDoc(docName(sub), doc);
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
