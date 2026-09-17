import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { inteiro, json, lerCorpo, selecionar, texto } from "@/lib/api";
import { deleteRow, readTab, registrarLog, TABS, updateRow } from "@/lib/sheets";
import { gerarToken } from "@/lib/identificadores";
import type { StatusLista, Vip } from "@/lib/types";
import { papeisCom } from "@/lib/permissoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const STATUS: StatusLista[] = ["ATIVA", "PAUSADA", "ENCERRADA"];

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(papeisCom("linksLista"));
    const corpo = await lerCorpo(request);
    const patch = selecionar(corpo, ["nome", "responsavel", "instrucoes"]);

    if (corpo.limite_nomes !== undefined) {
      patch.limite_nomes = String(Math.max(inteiro(corpo.limite_nomes, 0), 0));
    }
    if (corpo.status !== undefined) {
      const status = texto(corpo.status).toUpperCase() as StatusLista;
      if (!STATUS.includes(status)) throw new HttpError(400, "Status inválido.");
      patch.status = status;
    }
    // Gerar outro token invalida o link antigo na hora.
    if (corpo.novo_token) patch.token = gerarToken();

    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nada para atualizar.");

    const lista = await updateRow(TABS.listas, params.id, patch);
    if (!lista) throw new HttpError(404, "Lista não encontrada.");

    await registrarLog({
      usuario: user.usuario,
      acao: corpo.novo_token ? "NOVO TOKEN" : "EDITAR",
      entidade: "Lista publica",
      entidade_id: params.id,
      detalhes: Object.keys(patch).join(","),
    });
    return json({ lista });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(papeisCom("linksLista"));

    // Os nomes já recebidos continuam valendo, então apagar a lista
    // deixaria o rastro de quem indicou cada um pendurado no vazio.
    const vips = await readTab<Vip>(TABS.vip, false);
    const recebidos = vips.filter((v) => v.lista_id === params.id && v.status !== "CANCELADO");
    if (recebidos.length) {
      throw new HttpError(
        409,
        `Esta lista já recebeu ${recebidos.length} nome(s). Encerre a lista em vez de apagar — assim o link para de aceitar envios e o histórico fica.`,
      );
    }

    const apagada = await deleteRow(TABS.listas, params.id);
    if (!apagada) throw new HttpError(404, "Lista não encontrada.");

    await registrarLog({
      usuario: user.usuario,
      acao: "APAGAR",
      entidade: "Lista publica",
      entidade_id: params.id,
    });
    return json({ ok: true });
  } catch (error) {
    return erroResposta(error);
  }
}
