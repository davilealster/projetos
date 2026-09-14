import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { inteiro, json, lerCorpo, obrigatorio, texto } from "@/lib/api";
import { appendRow, findById, readTab, registrarLog, TABS } from "@/lib/sheets";
import { idAleatorio } from "@/lib/identificadores";
import type { Evento, TipoVip, Vip } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS: TipoVip[] = ["VIP", "CORTESIA", "DESCONTO", "ANIVERSARIANTE"];

export async function GET(request: Request) {
  try {
    await exigirSessao();
    const url = new URL(request.url);
    const eventoId = url.searchParams.get("evento_id");
    const busca = (url.searchParams.get("busca") ?? "").trim().toLowerCase();

    let vips = await readTab<Vip>(TABS.vip);
    if (eventoId) vips = vips.filter((v) => v.evento_id === eventoId);
    if (busca) {
      vips = vips.filter(
        (v) =>
          v.nome.toLowerCase().includes(busca) ||
          v.documento.toLowerCase().includes(busca) ||
          v.instagram.toLowerCase().includes(busca),
      );
    }

    vips.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return json({ vips });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await exigirSessao(["ADMIN", "VENDAS", "PORTARIA"]);
    const corpo = await lerCorpo(request);

    const eventoId = obrigatorio(corpo.evento_id, "evento_id");
    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento não encontrado.");
    if (evento.status === "ENCERRADO") {
      throw new HttpError(409, "Este evento está encerrado.");
    }

    const nome = obrigatorio(corpo.nome, "nome");
    const tipoBruto = texto(corpo.tipo).toUpperCase() as TipoVip;
    const tipo: TipoVip = TIPOS.includes(tipoBruto) ? tipoBruto : "VIP";

    const vips = await readTab<Vip>(TABS.vip, false);
    const doEvento = vips.filter((v) => v.evento_id === eventoId);

    const duplicado = doEvento.find(
      (v) => v.nome.trim().toLowerCase() === nome.toLowerCase() && v.status !== "CANCELADO",
    );
    if (duplicado) throw new HttpError(409, `"${nome}" já está na lista deste evento.`);

    const limite = Number(evento.capacidade_lista_vip) || 0;
    if (limite > 0) {
      const usados = doEvento
        .filter((v) => v.status !== "CANCELADO")
        .reduce((t, v) => t + 1 + (Number(v.acompanhantes) || 0), 0);
      const novos = 1 + inteiro(corpo.acompanhantes, 0);
      if (usados + novos > limite) {
        throw new HttpError(
          409,
          `Lista cheia: limite de ${limite} nomes e já há ${usados} confirmados.`,
        );
      }
    }

    const vip: Vip = {
      id: idAleatorio("vip"),
      evento_id: eventoId,
      nome,
      documento: texto(corpo.documento),
      telefone: texto(corpo.telefone),
      instagram: texto(corpo.instagram).replace(/^@/, ""),
      acompanhantes: String(inteiro(corpo.acompanhantes, 0)),
      tipo,
      status: "PENDENTE",
      promoter: texto(corpo.promoter) || user.nome,
      observacoes: texto(corpo.observacoes),
      criado_por: user.usuario,
      criado_em: new Date().toISOString(),
      checkin_em: "",
      lista_id: "",
    };

    await appendRow(TABS.vip, vip as unknown as Record<string, string>);
    await registrarLog({
      usuario: user.usuario,
      acao: "CRIAR",
      entidade: "Lista VIP",
      entidade_id: vip.id,
      detalhes: nome,
    });

    return json({ vip }, 201);
  } catch (error) {
    return erroResposta(error);
  }
}
