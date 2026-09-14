import { erroRespostaPublica, HttpError } from "@/lib/auth";
import { json, lerCorpo, texto } from "@/lib/api";
import { appendRows, readTab, registrarLog, TABS } from "@/lib/sheets";
import { idAleatorio } from "@/lib/identificadores";
import { extrairNomes, LIMITE_POR_ENVIO } from "@/lib/nomes";
import { formatarData } from "@/lib/formato";
import type { Evento, ListaPublica, Vip } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { token: string } };

/** Texto colado maior que isso é engano ou abuso, não uma lista de nomes. */
const TAMANHO_MAXIMO_TEXTO = 20_000;

/**
 * Endpoint aberto: quem tem o link entra, sem login. Por isso ele devolve
 * só o necessário para a tela do formulário — nome e data do evento, e os
 * nomes que ESTE link mandou. Nada do resto do evento, nada do app.
 */
async function carregar(token: string) {
  const limpo = texto(token);
  if (!limpo || limpo.length > 64) throw new HttpError(404, "Link inválido.");

  const listas = await readTab<ListaPublica>(TABS.listas, false);
  const lista = listas.find((l) => l.token === limpo);
  if (!lista) throw new HttpError(404, "Link inválido ou já desativado.");

  const eventos = await readTab<Evento>(TABS.eventos, false);
  const evento = eventos.find((e) => e.id === lista.evento_id);
  if (!evento) throw new HttpError(404, "Este link não aponta para nenhum evento.");

  return { lista, evento };
}

function motivoFechada(lista: ListaPublica, evento: Evento): string | null {
  if (lista.status === "PAUSADA") return "Esta lista está pausada no momento.";
  if (lista.status === "ENCERRADA") return "Esta lista já foi encerrada.";
  if (evento.status === "ENCERRADO") return "Este evento já foi encerrado.";
  return null;
}

/**
 * Quem envia nomes nao fica sabendo quem ja' esta na lista nem quantos
 * sao: isso e' informacao da equipe. A resposta traz so' o que a tela do
 * formulario precisa desenhar.
 */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { lista, evento } = await carregar(params.token);

    return json({
      evento: {
        nome: evento.nome,
        data: formatarData(evento.data),
        hora_inicio: evento.hora_inicio,
        local: evento.local,
      },
      lista: {
        nome: lista.nome,
        responsavel: lista.responsavel,
        instrucoes: lista.instrucoes,
      },
      fechada: motivoFechada(lista, evento),
      limitePorEnvio: LIMITE_POR_ENVIO,
    });
  } catch (error) {
    return erroRespostaPublica(error);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { lista, evento } = await carregar(params.token);

    const fechada = motivoFechada(lista, evento);
    if (fechada) throw new HttpError(409, fechada);

    const corpo = await lerCorpo(request);
    const bruto = texto(corpo.texto);
    if (!bruto) throw new HttpError(400, "Escreva pelo menos um nome.");
    if (bruto.length > TAMANHO_MAXIMO_TEXTO) {
      throw new HttpError(413, "Texto grande demais. Envie em partes menores.");
    }

    const { nomes } = extrairNomes(bruto);
    if (!nomes.length) throw new HttpError(400, "Não encontrei nenhum nome no que você escreveu.");
    if (nomes.length > LIMITE_POR_ENVIO) {
      throw new HttpError(
        400,
        `São no máximo ${LIMITE_POR_ENVIO} nomes por envio. Você mandou ${nomes.length} — pode enviar o resto em seguida.`,
      );
    }

    const vips = await readTab<Vip>(TABS.vip, false);
    const doEvento = vips.filter((v) => v.evento_id === lista.evento_id && v.status !== "CANCELADO");

    // Reenviar a lista inteira com um nome a mais e' o fluxo normal, entao
    // quem ja' esta na lista e' apenas ignorado — sem duplicar a linha e sem
    // avisar. Dizer "fulano ja' estava" deixaria descobrir a lista da equipe
    // chutando nomes de fora.
    const jaNaLista = new Set(doEvento.map((v) => v.nome.trim().toLocaleLowerCase("pt-BR")));
    const inéditos = nomes.filter((n) => !jaNaLista.has(n.toLocaleLowerCase("pt-BR")));

    const limiteLista = Number(lista.limite_nomes) || 0;
    if (limiteLista > 0) {
      const usados = doEvento.filter((v) => v.lista_id === lista.id).length;
      if (usados + inéditos.length > limiteLista) {
        throw new HttpError(
          409,
          `Esta lista aceita ${limiteLista} nomes e já tem ${usados}. Ainda cabem ${Math.max(limiteLista - usados, 0)}.`,
        );
      }
    }

    const limiteEvento = Number(evento.capacidade_lista_vip) || 0;
    if (limiteEvento > 0) {
      const usados = doEvento.reduce((t, v) => t + 1 + (Number(v.acompanhantes) || 0), 0);
      if (usados + inéditos.length > limiteEvento) {
        throw new HttpError(409, "A lista do evento atingiu o limite. Fale com a organização.");
      }
    }

    const agora = new Date().toISOString();
    const enviadoPor = texto(corpo.enviado_por).slice(0, 60);
    const novos: Vip[] = inéditos.map((nome) => ({
      id: idAleatorio("vip"),
      evento_id: lista.evento_id,
      nome,
      documento: "",
      telefone: "",
      instagram: "",
      acompanhantes: "0",
      tipo: "VIP",
      status: "PENDENTE",
      promoter: lista.responsavel || lista.nome,
      observacoes: enviadoPor ? `Enviado por ${enviadoPor}` : "",
      criado_por: `link:${lista.nome}`,
      criado_em: agora,
      checkin_em: "",
      lista_id: lista.id,
    }));

    if (novos.length) {
      await appendRows(TABS.vip, novos as unknown as Record<string, string>[]);
      await registrarLog({
        usuario: `link:${lista.nome}`,
        acao: "CRIAR",
        entidade: "Lista VIP",
        entidade_id: lista.id,
        detalhes: `${novos.length} nome(s) pelo link${enviadoPor ? ` (${enviadoPor})` : ""}`,
      });
    }

    // Devolve o que a propria pessoa mandou, nada do que ja' havia.
    return json({ recebidos: nomes.length, nomes });
  } catch (error) {
    return erroRespostaPublica(error);
  }
}
