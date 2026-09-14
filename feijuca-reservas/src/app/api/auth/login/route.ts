import { cookies } from "next/headers";
import { autenticar, erroResposta, HttpError } from "@/lib/auth";
import { cookieOptions, signSession } from "@/lib/session";
import { json, lerCorpo, obrigatorio } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const corpo = await lerCorpo(request);
    const usuario = obrigatorio(corpo.usuario, "usuario");
    const senha = obrigatorio(corpo.senha, "senha");

    const sessao = await autenticar(usuario, senha);
    if (!sessao) throw new HttpError(401, "Usuário ou senha inválidos.");

    cookies().set({ ...cookieOptions, value: await signSession(sessao) });
    return json({ usuario: sessao });
  } catch (error) {
    return erroResposta(error);
  }
}
