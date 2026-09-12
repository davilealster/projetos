import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, obrigatorio } from "@/lib/api";
import { findById, readTab, TABS } from "@/lib/sheets";
import { montarMapa, statusPrioridadeLounge } from "@/lib/regras";
import type { Evento, Reserva, Unidade, Vip } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await exigirSessao();
    const eventoId = obrigatorio(new URL(request.url).searchParams.get("evento_id"), "evento_id");

    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento nao encontrado.");

    const [lounges, bistros, reservas, vips] = await Promise.all([
      readTab<Unidade>(TABS.lounges),
      readTab<Unidade>(TABS.bistros),
      readTab<Reserva>(TABS.reservas),
      readTab<Vip>(TABS.vip),
    ]);

    const reservasEvento = reservas.filter((r) => r.evento_id === eventoId);
    const vipsEvento = vips.filter((v) => v.evento_id === eventoId && v.status !== "CANCELADO");

    const mapaLounge = montarMapa(
      lounges.filter((u) => u.evento_id === eventoId),
      reservasEvento.filter((r) => r.tipo === "LOUNGE"),
    );
    const mapaBistro = montarMapa(
      bistros.filter((u) => u.evento_id === eventoId),
      reservasEvento.filter((r) => r.tipo === "BISTRO"),
    );

    const ocupadosLounge = mapaLounge.filter((u) => u.ocupado);
    const ocupadosBistro = mapaBistro.filter((u) => u.ocupado);

    const receita = [...ocupadosLounge, ...ocupadosBistro].reduce(
      (total, u) => total + (Number(u.reserva?.valor) || 0),
      0,
    );

    return json({
      evento,
      prioridadeLounge: statusPrioridadeLounge(evento),
      lounge: {
        total: mapaLounge.length,
        ocupados: ocupadosLounge.length,
        livres: mapaLounge.length - ocupadosLounge.length,
        aniversariantes: ocupadosLounge.filter((u) => u.reserva?.aniversariante === "SIM").length,
        checkins: ocupadosLounge.filter((u) => u.reserva?.status === "CHECKIN").length,
      },
      bistro: {
        total: mapaBistro.length,
        ocupados: ocupadosBistro.length,
        livres: mapaBistro.length - ocupadosBistro.length,
        checkins: ocupadosBistro.filter((u) => u.reserva?.status === "CHECKIN").length,
      },
      vip: {
        nomes: vipsEvento.length,
        pessoas: vipsEvento.reduce((t, v) => t + 1 + (Number(v.acompanhantes) || 0), 0),
        checkins: vipsEvento.filter((v) => v.status === "CHECKIN").length,
        limite: Number(evento.capacidade_lista_vip) || 0,
      },
      pessoasReservadas: [...ocupadosLounge, ...ocupadosBistro].reduce(
        (t, u) => t + (Number(u.reserva?.qtd_pessoas) || 0),
        0,
      ),
      receitaPrevista: receita,
    });
  } catch (error) {
    return erroResposta(error);
  }
}
