import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { papeisCom } from "@/lib/permissoes";
import { json, lerCorpo, obrigatorio } from "@/lib/api";
import { atualizarLinhasEmLote, findById, readTab, registrarLog, TABS } from "@/lib/sheets";
import { reservaAtiva, validarTroca, type LadoDaTroca } from "@/lib/regras";
import { rotuloDoTipo, tabelaDoTipo } from "@/lib/unidades";
import type { Evento, Reserva, Unidade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Troca duas reservas de lugar. As duas linhas vao para a planilha na mesma
 * requisicao: gravar uma de cada vez deixaria as duas no mesmo numero no
 * meio do caminho, e quem estivesse com a tela aberta veria conflito.
 */
export async function POST(request: Request) {
  try {
    const user = await exigirSessao(papeisCom("reservas"));
    const corpo = await lerCorpo(request);

    const idA = obrigatorio(corpo.reserva_a, "reserva_a");
    const idB = obrigatorio(corpo.reserva_b, "reserva_b");
    if (idA === idB) throw new HttpError(400, "Escolha duas reservas diferentes.");

    const reservas = await readTab<Reserva>(TABS.reservas, false);
    const a = reservas.find((r) => r.id === idA);
    const b = reservas.find((r) => r.id === idB);
    if (!a || !b) throw new HttpError(404, "Reserva não encontrada.");
    if (!reservaAtiva(a) || !reservaAtiva(b)) {
      throw new HttpError(409, "Só dá para trocar reservas ativas.");
    }
    if (a.evento_id !== b.evento_id) {
      throw new HttpError(400, "As duas reservas precisam ser do mesmo evento.");
    }

    const evento = await findById<Evento>(TABS.eventos, a.evento_id);
    if (!evento) throw new HttpError(404, "Evento não encontrado.");
    if (evento.status === "ENCERRADO") throw new HttpError(409, "Este evento está encerrado.");

    // Cada um vai para o lugar do outro.
    const unidadeDe = async (reserva: Reserva) => {
      const unidades = await readTab<Unidade>(tabelaDoTipo(reserva.tipo), false);
      const unidade = unidades.find((u) => u.id === reserva.unidade_id);
      if (!unidade) {
        throw new HttpError(404, `${rotuloDoTipo(reserva.tipo)} de ${reserva.nome_cliente} não existe mais.`);
      }
      return unidade;
    };

    const unidadeA = await unidadeDe(a);
    const unidadeB = await unidadeDe(b);

    const ladoA: LadoDaTroca = {
      reserva: a,
      destino: { ...unidadeB, tipo: b.tipo },
    };
    const ladoB: LadoDaTroca = {
      reserva: b,
      destino: { ...unidadeA, tipo: a.tipo },
    };

    const regra = validarTroca(evento, ladoA, ladoB);
    if (!regra.ok) throw new HttpError(409, regra.motivo);

    const agora = new Date().toISOString();
    await atualizarLinhasEmLote(TABS.reservas, [
      {
        id: a.id,
        patch: { tipo: b.tipo, unidade_id: unidadeB.id, numero: unidadeB.numero, atualizado_em: agora },
      },
      {
        id: b.id,
        patch: { tipo: a.tipo, unidade_id: unidadeA.id, numero: unidadeA.numero, atualizado_em: agora },
      },
    ]);

    await registrarLog({
      usuario: user.usuario,
      acao: "TROCAR",
      entidade: "Reserva",
      entidade_id: `${a.id},${b.id}`,
      detalhes: `${a.nome_cliente} (${rotuloDoTipo(a.tipo)} ${unidadeA.numero}) <-> ${b.nome_cliente} (${rotuloDoTipo(b.tipo)} ${unidadeB.numero})`,
    });

    return json({
      ok: true,
      troca: {
        a: { id: a.id, nome: a.nome_cliente, tipo: b.tipo, numero: unidadeB.numero },
        b: { id: b.id, nome: b.nome_cliente, tipo: a.tipo, numero: unidadeA.numero },
      },
    });
  } catch (error) {
    return erroResposta(error);
  }
}
