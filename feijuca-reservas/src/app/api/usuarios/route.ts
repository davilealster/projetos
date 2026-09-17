import { erroResposta, exigirSessao, hashSenha, HttpError } from "@/lib/auth";
import { json, lerCorpo, obrigatorio, texto } from "@/lib/api";
import { appendRow, nextId, readTab, registrarLog, TABS } from "@/lib/sheets";
import type { Papel, Usuario } from "@/lib/types";
import { papeisCom } from "@/lib/permissoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS: Papel[] = ["ADMIN", "PORTARIA", "VENDAS"];

export async function GET() {
  try {
    await exigirSessao(papeisCom("administrar"));
    const usuarios = await readTab<Usuario>(TABS.usuarios, false);
    return json({
      usuarios: usuarios.map(({ senha_hash, ...resto }) => resto),
    });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await exigirSessao(papeisCom("administrar"));
    const corpo = await lerCorpo(request);

    const login = obrigatorio(corpo.usuario, "usuario").toLowerCase().replace(/\s+/g, "");
    const senha = obrigatorio(corpo.senha, "senha");
    if (senha.length < 6) throw new HttpError(400, "A senha precisa ter ao menos 6 caracteres.");

    const usuarios = await readTab<Usuario>(TABS.usuarios, false);
    if (usuarios.some((u) => u.usuario.toLowerCase() === login)) {
      throw new HttpError(409, `O login "${login}" ja existe.`);
    }

    const papelBruto = texto(corpo.papel).toUpperCase() as Papel;
    const novo: Usuario = {
      id: nextId("usr", usuarios),
      nome: obrigatorio(corpo.nome, "nome"),
      usuario: login,
      senha_hash: hashSenha(senha),
      papel: PAPEIS.includes(papelBruto) ? papelBruto : "VENDAS",
      ativo: "SIM",
      criado_em: new Date().toISOString(),
    };

    await appendRow(TABS.usuarios, novo as unknown as Record<string, string>);
    await registrarLog({
      usuario: admin.usuario,
      acao: "CRIAR",
      entidade: "Usuario",
      entidade_id: novo.id,
      detalhes: login,
    });

    const { senha_hash, ...semSenha } = novo;
    return json({ usuario: semSenha }, 201);
  } catch (error) {
    return erroResposta(error);
  }
}
