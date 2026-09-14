import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, lerCorpo, selecionar } from "@/lib/api";
import {
  atualizarCampoEmLote,
  deleteRow,
  findById,
  readTab,
  registrarLog,
  TABS,
  updateRow,
} from "@/lib/sheets";
import { reservaAtiva } from "@/lib/regras";
import { tabelaDoTipo, TIPOS_UNIDADE, valorPadraoDoEvento } from "@/lib/unidades";
import { normalizarValor } from "@/lib/valores";
import { montarMapa, statusPrioridadeLounge } from "@/lib/regras";
import type { Evento, Reserva, Unidade, Vip } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const CAMPOS_EDITAVEIS = [
  "nome",
  "data",
  "hora_inicio",
  "local",
  "status",
  "lounges_liberados",
  "prioridade_aniversariante_dias",
  "capacidade_lista_vip",
  "observacoes",
  "valor_lounge",
  "valor_bistro",
  "valor_mesa",
];

export async function GET(_request: Request, { params }: Ctx) {
  try {
    await exigirSessao();
    const evento = await findById<Evento>(TABS.eventos, params.id);
    if (!evento) throw new HttpError(404, "Evento nao encontrado.");

    const [lounges, bistros, mesas, reservas, vips] = await Promise.all([
      readTab<Unidade>(TABS.lounges),
      readTab<Unidade>(TABS.bistros),
      readTab<Unidade>(TABS.mesas),
      readTab<Reserva>(TABS.reservas),
      readTab<Vip>(TABS.vip),
    ]);

    const doEvento = <T extends { evento_id: string }>(itens: T[]) =>
      itens.filter((i) => i.evento_id === evento.id);

    return json({
      evento,
      prioridadeLounge: statusPrioridadeLounge(evento),
      lounges: montarMapa(doEvento(lounges), doEvento(reservas)),
      bistros: montarMapa(doEvento(bistros), doEvento(reservas)),
      mesas: montarMapa(doEvento(mesas), doEvento(reservas)),
      vips: doEvento(vips),
    });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const corpo = await lerCorpo(request);
    const patch = selecionar(corpo, CAMPOS_EDITAVEIS);
    if (patch.lounges_liberados) {
      patch.lounges_liberados = patch.lounges_liberados.toUpperCase() === "SIM" ? "SIM" : "NAO";
    }
    for (const campo of ["valor_lounge", "valor_bistro", "valor_mesa"] as const) {
      if (patch[campo] !== undefined) patch[campo] = normalizarValor(patch[campo]);
    }

    const atualizado = await updateRow(TABS.eventos, params.id, patch);
    if (!atualizado) throw new HttpError(404, "Evento nao encontrado.");
    const evento = atualizado as unknown as Evento;

    // Mudar o valor do evento so' vale a pena se as unidades acompanharem.
    // Reservas ja feitas guardam o proprio valor e nao sao tocadas.
    let unidadesAtualizadas = 0;
    if (corpo.aplicar_nas_unidades) {
      const reservas = await readTab<Reserva>(TABS.reservas, false);
      const ocupadas = new Set(
        reservas.filter((r) => r.evento_id === params.id && reservaAtiva(r)).map((r) => r.unidade_id),
      );

      for (const tipo of TIPOS_UNIDADE) {
        const campo = tipo === "LOUNGE" ? "valor_lounge" : tipo === "BISTRO" ? "valor_bistro" : "valor_mesa";
        if (patch[campo] === undefined) continue;

        const tabela = tabelaDoTipo(tipo);
        const unidades = await readTab<Unidade>(tabela, false);
        const ids = unidades
          .filter((u) => u.evento_id === params.id && !ocupadas.has(u.id))
          .map((u) => u.id);
        unidadesAtualizadas += await atualizarCampoEmLote(
          tabela,
          ids,
          "valor",
          valorPadraoDoEvento(evento, tipo),
        );
      }
    }

    await registrarLog({
      usuario: user.usuario,
      acao: "EDITAR",
      entidade: "Evento",
      entidade_id: params.id,
      detalhes: JSON.stringify(patch),
    });
    return json({ evento, unidadesAtualizadas });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await exigirSessao(["ADMIN"]);

    const [reservas, vips] = await Promise.all([
      readTab<Reserva>(TABS.reservas, false),
      readTab<Vip>(TABS.vip, false),
    ]);
    const temDados =
      reservas.some((r) => r.evento_id === params.id) || vips.some((v) => v.evento_id === params.id);
    if (temDados) {
      throw new HttpError(
        409,
        "Este evento ja tem reservas ou nomes na lista. Encerre o evento em vez de apagar.",
      );
    }

    const apagado = await deleteRow(TABS.eventos, params.id);
    if (!apagado) throw new HttpError(404, "Evento nao encontrado.");

    await registrarLog({
      usuario: user.usuario,
      acao: "APAGAR",
      entidade: "Evento",
      entidade_id: params.id,
    });
    return json({ ok: true });
  } catch (error) {
    return erroResposta(error);
  }
}
