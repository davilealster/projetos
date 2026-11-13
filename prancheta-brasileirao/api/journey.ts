// GET /api/journey → { entries, updatedAt }   (jornada salva na conta)
// PUT /api/journey { entries: { chave: valor | null } } → { updatedAt }
import { currentAccount, json, mergeJourney, readJourney, writeJourney } from "./_lib/user.js";

export async function GET(req: Request): Promise<Response> {
  const user = await currentAccount(req);
  if (!user) return json({ error: "não autenticado" }, 401);
  return json(await readJourney(user.sub));
}

export async function PUT(req: Request): Promise<Response> {
  const user = await currentAccount(req);
  if (!user) return json({ error: "não autenticado" }, 401);
  let changes: Record<string, unknown> = {};
  try {
    const body = (await req.json()) as { entries?: unknown };
    if (body.entries && typeof body.entries === "object") changes = body.entries as Record<string, unknown>;
  } catch {
    return json({ error: "corpo inválido" }, 400);
  }
  try {
    const doc = mergeJourney(await readJourney(user.sub), changes);
    await writeJourney(user.sub, doc);
    return json({ updatedAt: doc.updatedAt });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 413);
  }
}
