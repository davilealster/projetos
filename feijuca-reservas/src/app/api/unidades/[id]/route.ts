import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, lerCorpo, selecionar } from "@/lib/api";
import { deleteRow, readTab, registrarLog, TABS, updateRow } from "@/lib/sheets";
import { reservaAtiva } from "@/lib/regras";
import { normalizarTipo, rotuloDoTipo, tabelaDoTipo } from "@/lib/unidades";
import { normalizarValor } from "@/lib/valores";
import type { Reserva } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function tipoDaQuery(request: Request) {
  return normalizarTipo(new URL(request.url).searchParams.get("tipo"));
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const tipo = tipoDaQuery(request);
    const corpo = await lerCorpo(request);
    const patch = selecionar(corpo, ["numero", "nome", "capacidade", "valor", "status", "observacoes"]);
    if (patch.valor !== undefined) patch.valor = normalizarValor(patch.valor);

    const unidade = await updateRow(tabelaDoTipo(tipo), params.id, patch);
    if (!unidade) throw new HttpError(404, `${rotuloDoTipo(tipo)} nao encontrado.`);

    await registrarLog({
      usuario: user.usuario,
      acao: "EDITAR",
      entidade: rotuloDoTipo(tipo),
      entidade_id: params.id,
      detalhes: JSON.stringify(patch),
    });
    return json({ unidade });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const tipo = tipoDaQuery(request);

    const reservas = await readTab<Reserva>(TABS.reservas, false);
    if (reservas.some((r) => r.unidade_id === params.id && reservaAtiva(r))) {
      throw new HttpError(409, "Existe reserva ativa nesta unidade. Cancele a reserva antes.");
    }

    const apagado = await deleteRow(tabelaDoTipo(tipo), params.id);
    if (!apagado) throw new HttpError(404, `${rotuloDoTipo(tipo)} nao encontrado.`);

    await registrarLog({
      usuario: user.usuario,
      acao: "APAGAR",
      entidade: rotuloDoTipo(tipo),
      entidade_id: params.id,
    });
    return json({ ok: true });
  } catch (error) {
    return erroResposta(error);
  }
}
