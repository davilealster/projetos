import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, lerCorpo, selecionar, texto } from "@/lib/api";
import { deleteRow, findById, registrarLog, TABS, updateRow } from "@/lib/sheets";
import type { StatusVip, Vip } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const STATUS: StatusVip[] = ["PENDENTE", "CHECKIN", "CANCELADO"];

const CAMPOS_EDITAVEIS = [
  "nome",
  "documento",
  "telefone",
  "instagram",
  "acompanhantes",
  "tipo",
  "promoter",
  "observacoes",
];

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const corpo = await lerCorpo(request);
    const chaves = Object.keys(corpo);
    const somenteStatus = chaves.length > 0 && chaves.every((c) => c === "status");
    const user = await exigirSessao(
      somenteStatus ? ["ADMIN", "VENDAS", "PORTARIA"] : ["ADMIN", "VENDAS"],
    );

    const vip = await findById<Vip>(TABS.vip, params.id);
    if (!vip) throw new HttpError(404, "Nome nao encontrado na lista.");

    const patch = selecionar(corpo, CAMPOS_EDITAVEIS);
    if (patch.instagram) patch.instagram = patch.instagram.replace(/^@/, "");

    if (corpo.status !== undefined) {
      const status = texto(corpo.status).toUpperCase() as StatusVip;
      if (!STATUS.includes(status)) throw new HttpError(400, "Status invalido.");
      patch.status = status;
      patch.checkin_em = status === "CHECKIN" ? new Date().toISOString() : "";
    }

    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nada para atualizar.");

    const atualizado = await updateRow(TABS.vip, params.id, patch);
    await registrarLog({
      usuario: user.usuario,
      acao: patch.status ? `STATUS ${patch.status}` : "EDITAR",
      entidade: "Lista VIP",
      entidade_id: params.id,
      detalhes: vip.nome,
    });

    return json({ vip: atualizado });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(["ADMIN", "VENDAS"]);
    const apagado = await deleteRow(TABS.vip, params.id);
    if (!apagado) throw new HttpError(404, "Nome nao encontrado na lista.");
    await registrarLog({
      usuario: user.usuario,
      acao: "APAGAR",
      entidade: "Lista VIP",
      entidade_id: params.id,
    });
    return json({ ok: true });
  } catch (error) {
    return erroResposta(error);
  }
}
