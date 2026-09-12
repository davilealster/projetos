import { sessaoAtual } from "@/lib/auth";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ usuario: await sessaoAtual() });
}
