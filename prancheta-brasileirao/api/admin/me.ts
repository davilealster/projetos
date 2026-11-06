import { currentUser, json, unauthorized } from "../_lib/auth.js";

export async function GET(req: Request): Promise<Response> {
  const user = await currentUser(req);
  return user ? json({ user }, 200, { "cache-control": "no-store" }) : unauthorized();
}
