import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, obrigatorio } from "@/lib/api";
import { findById, readTab, TABS } from "@/lib/sheets";
import { montarMapa } from "@/lib/regras";
import { pode } from "@/lib/permissoes";
import type { Evento, Reserva, Unidade, Vip } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await exigirSessao();
    const eventoId = obrigatorio(new URL(request.url).searchParams.get("evento_id"), "evento_id");

    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento não encontrado.");

    const [lounges, bistros, mesas, reservas, vips] = await Promise.all([
      readTab<Unidade>(TABS.lounges),
      readTab<Unidade>(TABS.bistros),
      readTab<Unidade>(TABS.mesas),
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
    const mapaMesa = montarMapa(
      mesas.filter((u) => u.evento_id === eventoId),
      reservasEvento.filter((r) => r.tipo === "MESA"),
    );

    const ocupadosLounge = mapaLounge.filter((u) => u.ocupado);
    const ocupadosBistro = mapaBistro.filter((u) => u.ocupado);
    const ocupadosMesa = mapaMesa.filter((u) => u.ocupado);

    return json({
      evento,
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
      mesa: {
        total: mapaMesa.length,
        ocupados: ocupadosMesa.length,
        livres: mapaMesa.length - ocupadosMesa.length,
        checkins: ocupadosMesa.filter((u) => u.reserva?.status === "CHECKIN").length,
      },
      // Vendas nao enxerga a lista da portaria, entao nem os numeros dela.
      vip: pode(user.papel, "verVip")
        ? {
            nomes: vipsEvento.length,
            pessoas: vipsEvento.reduce((t, v) => t + 1 + (Number(v.acompanhantes) || 0), 0),
            checkins: vipsEvento.filter((v) => v.status === "CHECKIN").length,
            limite: Number(evento.capacidade_lista_vip) || 0,
          }
        : null,
    });
  } catch (error) {
    return erroResposta(error);
  }
}
