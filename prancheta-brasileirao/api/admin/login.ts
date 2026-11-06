import { json, sessionCookie, verifyLogin } from "../_lib/auth.js";

export async function POST(req: Request): Promise<Response> {
  let body: { user?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "requisição inválida" }, 400);
  }
  const user = String(body.user ?? "").trim();
  const ok = await verifyLogin(user, String(body.password ?? ""));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700)); // freia tentativa e erro
    return json({ error: "usuário ou senha incorretos" }, 401);
  }
  return json({ user }, 200, { "set-cookie": await sessionCookie(user) });
}
