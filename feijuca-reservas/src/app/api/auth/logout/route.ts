import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  cookies().delete(COOKIE_NAME);
  return json({ ok: true });
}
