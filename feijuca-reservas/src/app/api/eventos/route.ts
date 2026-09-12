import { erroResposta, exigirSessao } from "@/lib/auth";
import { json, lerCorpo, obrigatorio, texto } from "@/lib/api";
import { appendRow, nextId, readTab, registrarLog, TABS } from "@/lib/sheets";
import type { Evento } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await exigirSessao();
    const eventos = await readTab<Evento>(TABS.eventos);
    eventos.sort((a, b) => (a.data < b.data ? 1 : -1));
    return json({ eventos });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const corpo = await lerCorpo(request);

    const eventos = await readTab<Evento>(TABS.eventos, false);
    const evento: Evento = {
      id: nextId("evt", eventos),
      nome: obrigatorio(corpo.nome, "nome"),
      data: obrigatorio(corpo.data, "data"),
      hora_inicio: texto(corpo.hora_inicio) || "14:00",
      local: texto(corpo.local),
      status: (texto(corpo.status).toUpperCase() as Evento["status"]) || "ATIVO",
      lounges_liberados: "NAO",
      prioridade_aniversariante_dias: texto(corpo.prioridade_aniversariante_dias) || "1",
      capacidade_lista_vip: texto(corpo.capacidade_lista_vip),
      observacoes: texto(corpo.observacoes),
      criado_em: new Date().toISOString(),
    };

    await appendRow(TABS.eventos, evento as unknown as Record<string, string>);
    await registrarLog({
      usuario: user.usuario,
      acao: "CRIAR",
      entidade: "Evento",
      entidade_id: evento.id,
      detalhes: evento.nome,
    });

    return json({ evento }, 201);
  } catch (error) {
    return erroResposta(error);
  }
}
