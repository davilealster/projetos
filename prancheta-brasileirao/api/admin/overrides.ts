// GET  /api/admin/overrides — documento completo (com "reviewed").
// PUT  /api/admin/overrides { players?: {id: ajuste|null}, teams?: {slug: ajuste|null} }
import { currentUser, json, unauthorized } from "../_lib/auth.js";
import { loadOverrides, patchOverrides } from "../_lib/overrides.js";

export async function GET(req: Request): Promise<Response> {
  if (!(await currentUser(req))) return unauthorized();
  return json(await loadOverrides(), 200, { "cache-control": "no-store" });
}

export async function PUT(req: Request): Promise<Response> {
  if (!(await currentUser(req))) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "requisição inválida" }, 400);
  try {
    return json(await patchOverrides(body), 200, { "cache-control": "no-store" });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
}
