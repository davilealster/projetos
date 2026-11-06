import { clearCookie, json } from "../_lib/auth.js";

export async function POST(): Promise<Response> {
  return json({ ok: true }, 200, { "set-cookie": clearCookie() });
}
