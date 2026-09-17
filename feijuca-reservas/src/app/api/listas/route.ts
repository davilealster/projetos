import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { inteiro, json, lerCorpo, obrigatorio, texto } from "@/lib/api";
import { appendRow, findById, readTab, registrarLog, TABS } from "@/lib/sheets";
import { gerarToken, idAleatorio } from "@/lib/identificadores";
import type { Evento, ListaPublica, Vip } from "@/lib/types";
import { papeisCom } from "@/lib/permissoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista + quantos nomes já chegaram por ela. */
function comContagem(lista: ListaPublica, vips: Vip[]) {
  const meus = vips.filter((v) => v.lista_id === lista.id && v.status !== "CANCELADO");
  return {
    ...lista,
    nomes: meus.length,
    pessoas: meus.reduce((t, v) => t + 1 + (Number(v.acompanhantes) || 0), 0),
  };
}

export async function GET(request: Request) {
  try {
    await exigirSessao(papeisCom("linksLista"));
    const eventoId = obrigatorio(
      new URL(request.url).searchParams.get("evento_id"),
      "evento_id",
    );

    const [listas, vips] = await Promise.all([
      readTab<ListaPublica>(TABS.listas),
      readTab<Vip>(TABS.vip),
    ]);

    return json({
      listas: listas
        .filter((l) => l.evento_id === eventoId)
        .map((l) => comContagem(l, vips))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await exigirSessao(papeisCom("linksLista"));
    const corpo = await lerCorpo(request);

    const eventoId = obrigatorio(corpo.evento_id, "evento_id");
    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento não encontrado.");

    const nome = obrigatorio(corpo.nome, "nome");
    const listas = await readTab<ListaPublica>(TABS.listas, false);
    if (
      listas.some(
        (l) => l.evento_id === eventoId && l.nome.trim().toLowerCase() === nome.toLowerCase(),
      )
    ) {
      throw new HttpError(409, `Já existe uma lista chamada "${nome}" neste evento.`);
    }

    const lista: ListaPublica = {
      id: idAleatorio("lst"),
      evento_id: eventoId,
      nome,
      token: gerarToken(),
      responsavel: texto(corpo.responsavel) || nome,
      limite_nomes: String(Math.max(inteiro(corpo.limite_nomes, 0), 0)),
      status: "ATIVA",
      instrucoes: texto(corpo.instrucoes),
      criado_por: user.usuario,
      criado_em: new Date().toISOString(),
    };

    await appendRow(TABS.listas, lista as unknown as Record<string, string>);
    await registrarLog({
      usuario: user.usuario,
      acao: "CRIAR",
      entidade: "Lista publica",
      entidade_id: lista.id,
      detalhes: nome,
    });

    return json({ lista: { ...lista, nomes: 0, pessoas: 0 } }, 201);
  } catch (error) {
    return erroResposta(error);
  }
}
