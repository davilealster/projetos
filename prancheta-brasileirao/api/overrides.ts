// GET /api/overrides — público: ajustes do admin que o site aplica por cima dos dados do repositório.
import { loadOverrides } from "./_lib/overrides.js";
import { json } from "./_lib/auth.js";

export async function GET(): Promise<Response> {
  try {
    const doc = await loadOverrides();
    // tirar "reviewed" (só interessa ao admin)
    const players = Object.fromEntries(
      Object.entries(doc.players).map(([id, { reviewed: _r, ...rest }]) => [id, rest]),
    );
    return json({ ...doc, players }, 200, { "cache-control": "public, max-age=0, s-maxage=15, stale-while-revalidate=120" });
  } catch (err) {
    console.error(err);
    return json({ version: 1, updatedAt: null, players: {}, teams: {} }, 200, { "cache-control": "no-store" });
  }
}
