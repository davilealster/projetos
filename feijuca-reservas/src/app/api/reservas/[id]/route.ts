import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, lerCorpo, selecionar, simNao, texto } from "@/lib/api";
import { deleteRow, findById, readTab, registrarLog, TABS, updateRow } from "@/lib/sheets";
import { ehAniversariante, reservaAtiva, validarReservaLounge } from "@/lib/regras";
import { normalizarTipo, rotuloDoTipo, tabelaDoTipo } from "@/lib/unidades";
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
    if (!reserva) throw new HttpError(404, "Reserva não encontrada.");

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
      if (!STATUS_VALIDOS.includes(status)) throw new HttpError(400, "Status inválido.");
      patch.status = status;
      if (status === "CHECKIN") patch.checkin_em = new Date().toISOString();
      if (status === "CANCELADA") patch.checkin_em = "";
    }

    // Mover a reserva de lugar. O destino pode ser de outro tipo: sair de um
    // lounge para um bistro e' parte da rotina da equipe.
    if (corpo.unidade_id !== undefined && texto(corpo.unidade_id) !== reserva.unidade_id) {
      const destinoId = texto(corpo.unidade_id);
      const tipoDestino = corpo.tipo !== undefined ? normalizarTipo(corpo.tipo) : reserva.tipo;
      const rotulo = rotuloDoTipo(tipoDestino);

      const unidades = await readTab<Unidade>(tabelaDoTipo(tipoDestino), false);
      const destino = unidades.find((u) => u.id === destinoId);
      if (!destino) throw new HttpError(404, `${rotulo} destino não existe.`);
      if (destino.evento_id !== reserva.evento_id) {
        throw new HttpError(400, "A unidade destino é de outro evento.");
      }
      if ((destino.status ?? "").toUpperCase() === "BLOQUEADO") {
        throw new HttpError(409, `${rotulo} ${destino.numero} está bloqueado.`);
      }

      const reservas = await readTab<Reserva>(TABS.reservas, false);
      const ocupante = reservas.find(
        (r) => r.unidade_id === destinoId && r.id !== reserva.id && reservaAtiva(r),
      );
      if (ocupante) {
        throw new HttpError(
          409,
          `${rotulo} ${destino.numero} já está com ${ocupante.nome_cliente}. Libere antes de mover.`,
        );
      }

      // Ir para um lounge exige a mesma regra de quem reserva do zero.
      if (tipoDestino === "LOUNGE" && tipoDestino !== reserva.tipo) {
        const evento = await findById<Evento>(TABS.eventos, reserva.evento_id);
        const querAniversariante =
          patch.aniversariante !== undefined
            ? patch.aniversariante === "SIM"
            : reserva.aniversariante === "SIM";
        if (evento) {
          const regra = validarReservaLounge(evento, querAniversariante);
          if (!regra.ok) throw new HttpError(409, regra.motivo);
        }
      }

      const pessoas = Number(patch.qtd_pessoas ?? reserva.qtd_pessoas) || 0;
      const capacidade = Number(destino.capacidade) || 0;
      if (capacidade > 0 && pessoas > capacidade) {
        throw new HttpError(
          400,
          `${rotulo} ${destino.numero} comporta até ${capacidade} pessoas, e a reserva tem ${pessoas}.`,
        );
      }

      patch.tipo = tipoDestino;
      patch.unidade_id = destinoId;
      patch.numero = destino.numero;
      // O valor acompanha o novo tipo, a menos que a reserva ja tenha um combinado.
      if (patch.valor === undefined && normalizarValor(reserva.valor) === "0") {
        patch.valor = normalizarValor(destino.valor);
      }
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
    if (!apagada) throw new HttpError(404, "Reserva não encontrada.");
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
