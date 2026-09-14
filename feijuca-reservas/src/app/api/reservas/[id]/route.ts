import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, lerCorpo, selecionar, simNao, texto } from "@/lib/api";
import { deleteRow, findById, readTab, registrarLog, TABS, updateRow } from "@/lib/sheets";
import { ehAniversariante, reservaAtiva, validarReservaLounge } from "@/lib/regras";
import { rotuloDoTipo, tabelaDoTipo } from "@/lib/unidades";
import { normalizarValor } from "@/lib/valores";
import type { Evento, Reserva, Unidade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const STATUS_VALIDOS: Reserva["status"][] = ["PENDENTE", "CONFIRMADA", "CHECKIN", "CANCELADA"];

const CAMPOS_EDITAVEIS = [
  "nome_cliente",
  "telefone",
  "instagram",
  "qtd_pessoas",
  "data_aniversario",
  "valor",
  "sinal_pago",
  "observacoes",
];

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const corpo = await lerCorpo(request);
    const chaves = Object.keys(corpo);
    // Portaria so' faz check-in; qualquer outra edicao exige vendas/admin.
    const somenteCheckin =
      chaves.length > 0 && chaves.every((c) => c === "status") && corpo.status === "CHECKIN";
    const user = await exigirSessao(
      somenteCheckin ? ["ADMIN", "VENDAS", "PORTARIA"] : ["ADMIN", "VENDAS"],
    );

    const reserva = await findById<Reserva>(TABS.reservas, params.id);
    if (!reserva) throw new HttpError(404, "Reserva nao encontrada.");

    const patch = selecionar(corpo, CAMPOS_EDITAVEIS);
    for (const campo of ["valor", "sinal_pago"] as const) {
      if (patch[campo] !== undefined) patch[campo] = normalizarValor(patch[campo]);
    }

    if (corpo.aniversariante !== undefined) {
      const novo = simNao(corpo.aniversariante);
      if (reserva.tipo === "LOUNGE" && novo === "NAO") {
        const evento = await findById<Evento>(TABS.eventos, reserva.evento_id);
        if (evento) {
          const regra = validarReservaLounge(evento, false);
          if (!regra.ok) throw new HttpError(409, regra.motivo);
        }
      }
      patch.aniversariante = novo;
    }

    if (corpo.status !== undefined) {
      const status = texto(corpo.status).toUpperCase() as Reserva["status"];
      if (!STATUS_VALIDOS.includes(status)) throw new HttpError(400, "Status invalido.");
      patch.status = status;
      if (status === "CHECKIN") patch.checkin_em = new Date().toISOString();
      if (status === "CANCELADA") patch.checkin_em = "";
    }

    // Troca de lounge/bistro: a unidade destino precisa estar livre.
    if (corpo.unidade_id !== undefined && texto(corpo.unidade_id) !== reserva.unidade_id) {
      const destinoId = texto(corpo.unidade_id);
      const unidades = await readTab<Unidade>(tabelaDoTipo(reserva.tipo), false);
      const destino = unidades.find((u) => u.id === destinoId);
      if (!destino) throw new HttpError(404, `${rotuloDoTipo(reserva.tipo)} destino nao existe.`);
      if (destino.evento_id !== reserva.evento_id) {
        throw new HttpError(400, "A unidade destino e' de outro evento.");
      }
      const reservas = await readTab<Reserva>(TABS.reservas, false);
      if (reservas.some((r) => r.unidade_id === destinoId && r.id !== reserva.id && reservaAtiva(r))) {
        throw new HttpError(409, `${rotuloDoTipo(reserva.tipo)} ${destino.numero} ja esta ocupado.`);
      }
      patch.unidade_id = destinoId;
      patch.numero = destino.numero;
    }

    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nada para atualizar.");
    patch.atualizado_em = new Date().toISOString();

    const atualizada = await updateRow(TABS.reservas, params.id, patch);
    await registrarLog({
      usuario: user.usuario,
      acao: patch.status ? `STATUS ${patch.status}` : "EDITAR",
      entidade: `Reserva ${rotuloDoTipo(reserva.tipo)}`,
      entidade_id: params.id,
      detalhes: reserva.nome_cliente,
    });

    return json({ reserva: atualizada });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const apagada = await deleteRow(TABS.reservas, params.id);
    if (!apagada) throw new HttpError(404, "Reserva nao encontrada.");
    await registrarLog({
      usuario: user.usuario,
      acao: "APAGAR",
      entidade: "Reserva",
      entidade_id: params.id,
    });
    return json({ ok: true });
  } catch (error) {
    return erroResposta(error);
  }
}
