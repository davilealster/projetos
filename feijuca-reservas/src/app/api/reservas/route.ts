import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { inteiro, json, lerCorpo, obrigatorio, simNao, texto } from "@/lib/api";
import { appendRow, findById, nextId, readTab, registrarLog, TABS } from "@/lib/sheets";
import { ehAniversariante, reservaAtiva, validarReservaLounge } from "@/lib/regras";
import { normalizarTipo, rotuloDoTipo, tabelaDoTipo } from "@/lib/unidades";
import { normalizarValor } from "@/lib/valores";
import type { Evento, Reserva, Unidade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await exigirSessao();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("evento_id");
    const tipo = url.searchParams.get("tipo");

    let reservas = await readTab<Reserva>(TABS.reservas);
    if (eventoId) reservas = reservas.filter((r) => r.evento_id === eventoId);
    if (tipo) reservas = reservas.filter((r) => r.tipo === normalizarTipo(tipo));

    reservas.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
    return json({ reservas });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await exigirSessao(["ADMIN", "VENDAS"]);
    const corpo = await lerCorpo(request);

    const tipo = normalizarTipo(corpo.tipo);
    const eventoId = obrigatorio(corpo.evento_id, "evento_id");
    const unidadeId = obrigatorio(corpo.unidade_id, "unidade_id");
    const nome = obrigatorio(corpo.nome_cliente, "nome_cliente");
    const aniversariante = simNao(corpo.aniversariante);

    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento nao encontrado.");
    if (evento.status === "ENCERRADO") {
      throw new HttpError(409, "Este evento esta encerrado e nao aceita novas reservas.");
    }

    const unidades = await readTab<Unidade>(tabelaDoTipo(tipo), false);
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!unidade) throw new HttpError(404, `${rotuloDoTipo(tipo)} nao encontrado.`);
    if (unidade.evento_id !== eventoId) {
      throw new HttpError(400, `Este ${rotuloDoTipo(tipo).toLowerCase()} e' de outro evento.`);
    }
    if ((unidade.status ?? "").toUpperCase() === "BLOQUEADO") {
      throw new HttpError(409, `${rotuloDoTipo(tipo)} ${unidade.numero} esta bloqueado.`);
    }

    const reservas = await readTab<Reserva>(TABS.reservas, false);
    if (reservas.some((r) => r.unidade_id === unidadeId && reservaAtiva(r))) {
      throw new HttpError(
        409,
        `${rotuloDoTipo(tipo)} ${unidade.numero} ja esta reservado. Atualize a tela.`,
      );
    }

    if (tipo === "LOUNGE") {
      const regra = validarReservaLounge(evento, ehAniversariante(aniversariante));
      if (!regra.ok) throw new HttpError(409, regra.motivo);
    }

    const pessoas = inteiro(corpo.qtd_pessoas, 0);
    const capacidade = Number(unidade.capacidade) || 0;
    if (capacidade > 0 && pessoas > capacidade) {
      throw new HttpError(
        400,
        `${rotuloDoTipo(tipo)} ${unidade.numero} comporta ate ${capacidade} pessoas.`,
      );
    }

    const agora = new Date().toISOString();
    const reserva: Reserva = {
      id: nextId("res", reservas),
      evento_id: eventoId,
      tipo,
      unidade_id: unidadeId,
      numero: unidade.numero,
      nome_cliente: nome,
      telefone: texto(corpo.telefone),
      instagram: texto(corpo.instagram).replace(/^@/, ""),
      qtd_pessoas: String(pessoas),
      aniversariante,
      data_aniversario: texto(corpo.data_aniversario),
      status: "PENDENTE",
      valor: texto(corpo.valor) ? normalizarValor(corpo.valor) : normalizarValor(unidade.valor),
      sinal_pago: texto(corpo.sinal_pago),
      observacoes: texto(corpo.observacoes),
      criado_por: user.usuario,
      criado_em: agora,
      atualizado_em: agora,
      checkin_em: "",
    };

    await appendRow(TABS.reservas, reserva as unknown as Record<string, string>);
    await registrarLog({
      usuario: user.usuario,
      acao: "CRIAR",
      entidade: `Reserva ${rotuloDoTipo(tipo)}`,
      entidade_id: reserva.id,
      detalhes: `${rotuloDoTipo(tipo)} ${unidade.numero} - ${nome}`,
    });

    return json({ reserva }, 201);
  } catch (error) {
    return erroResposta(error);
  }
}
