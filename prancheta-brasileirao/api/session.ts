// GET    /api/session → { enabled, clientId, user }   (login opcional com Google)
// POST   /api/session { credential } → entra (cookie de sessão)
// DELETE /api/session → sai
import { accountEnabled, clearUserCookie, currentAccount, googleClientId, json, userCookie, verifyGoogleCredential } from "./_lib/user.js";

export async function GET(req: Request): Promise<Response> {
  if (!accountEnabled()) return json({ enabled: false, clientId: null, user: null });
  return json({ enabled: true, clientId: googleClientId(), user: await currentAccount(req) });
}

export async function POST(req: Request): Promise<Response> {
  if (!accountEnabled()) return json({ error: "login desativado" }, 404);
  let credential = "";
  try {
    credential = String(((await req.json()) as { credential?: unknown }).credential ?? "");
  } catch {
    /* corpo inválido */
  }
  if (!credential) return json({ error: "credencial ausente" }, 400);
  try {
    const user = await verifyGoogleCredential(credential);
    return json({ user }, 200, { "set-cookie": await userCookie(user) });
  } catch {
    return json({ error: "não foi possível confirmar o login com o Google" }, 401);
  }
}

export async function DELETE(): Promise<Response> {
  return json({ ok: true }, 200, { "set-cookie": clearUserCookie() });
}
