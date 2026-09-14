import { erroResposta, exigirSessao, hashSenha, HttpError } from "@/lib/auth";
import { json, lerCorpo, selecionar, texto } from "@/lib/api";
import { deleteRow, readTab, registrarLog, TABS, updateRow } from "@/lib/sheets";
import type { Papel, Usuario } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const PAPEIS: Papel[] = ["ADMIN", "PORTARIA", "VENDAS"];

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const admin = await exigirSessao(["ADMIN"]);
    const corpo = await lerCorpo(request);
    const patch = selecionar(corpo, ["nome"]);

    if (corpo.papel !== undefined) {
      const papel = texto(corpo.papel).toUpperCase() as Papel;
      if (!PAPEIS.includes(papel)) throw new HttpError(400, "Perfil inválido.");
      patch.papel = papel;
    }
    if (corpo.ativo !== undefined) {
      patch.ativo = texto(corpo.ativo).toUpperCase() === "SIM" ? "SIM" : "NAO";
    }
    if (corpo.senha !== undefined) {
      const senha = texto(corpo.senha);
      if (senha.length < 6) throw new HttpError(400, "A senha precisa ter ao menos 6 caracteres.");
      patch.senha_hash = hashSenha(senha);
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nada para atualizar.");

    if (params.id === admin.id && patch.ativo === "NAO") {
      throw new HttpError(409, "Você não pode desativar o próprio usuário.");
    }

    const atualizado = await updateRow(TABS.usuarios, params.id, patch);
    if (!atualizado) throw new HttpError(404, "Usuário não encontrado.");

    await registrarLog({
      usuario: admin.usuario,
      acao: "EDITAR",
      entidade: "Usuario",
      entidade_id: params.id,
      detalhes: Object.keys(patch).join(","),
    });

    const { senha_hash, ...semSenha } = atualizado as unknown as Usuario;
    return json({ usuario: semSenha });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const admin = await exigirSessao(["ADMIN"]);
    if (params.id === admin.id) throw new HttpError(409, "Você não pode apagar o próprio usuário.");

    const usuarios = await readTab<Usuario>(TABS.usuarios, false);
    const admins = usuarios.filter((u) => u.papel === "ADMIN" && u.ativo === "SIM");
    if (admins.length <= 1 && admins[0]?.id === params.id) {
      throw new HttpError(409, "É preciso manter pelo menos um administrador ativo.");
    }

    const apagado = await deleteRow(TABS.usuarios, params.id);
    if (!apagado) throw new HttpError(404, "Usuário não encontrado.");

    await registrarLog({
      usuario: admin.usuario,
      acao: "APAGAR",
      entidade: "Usuario",
      entidade_id: params.id,
    });
    return json({ ok: true });
  } catch (error) {
    return erroResposta(error);
  }
}
