// POST /api/admin/password { current, user?, password } — troca usuário e/ou senha.
import { currentUser, json, sessionCookie, setCredentials, unauthorized, verifyLogin } from "../_lib/auth.js";

export async function POST(req: Request): Promise<Response> {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { current?: string; user?: string; password?: string };
  if (!(await verifyLogin(me, String(body.current ?? "")))) return json({ error: "senha atual incorreta" }, 403);
  const user = String(body.user ?? me).trim() || me;
  const password = String(body.password ?? "");
  if (!/^[\w.@-]{3,40}$/.test(user)) return json({ error: "usuário: 3 a 40 letras, números, ponto, @ ou hífen" }, 400);
  if (password.length < 8) return json({ error: "a nova senha precisa de pelo menos 8 caracteres" }, 400);
  await setCredentials(user, password);
  return json({ user }, 200, { "set-cookie": await sessionCookie(user) });
}
