import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { json, lerCorpo, obrigatorio, texto } from "@/lib/api";
import { appendRows, findById, readTab, registrarLog, TABS } from "@/lib/sheets";
import { chaveUnidade, croquiPorId, PADRAO_POR_TIPO } from "@/lib/croqui";
import { prefixoDoTipo, rotuloDoTipo, tabelaDoTipo, TIPOS_UNIDADE } from "@/lib/unidades";
import type { Evento, TipoUnidade, Unidade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria de uma vez as unidades que o croqui da casa preve e que ainda nao
 * existem no evento. E' idempotente: rodar de novo nao duplica nada.
 */
export async function POST(request: Request) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const corpo = await lerCorpo(request);

    const eventoId = obrigatorio(corpo.evento_id, "evento_id");
    const croqui = croquiPorId(texto(corpo.croqui_id) || "SOULBRADO");
    if (!croqui) throw new HttpError(404, "Croqui nao encontrado.");

    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento nao encontrado.");

    const criadas: Record<string, number> = {};

    for (const tipo of TIPOS_UNIDADE) {
      const previstas = croqui.posicoes.filter((p) => p.tipo === tipo);
      if (!previstas.length) continue;

      const tabela = tabelaDoTipo(tipo);
      const existentes = await readTab<Unidade>(tabela, false);
      const jaTem = new Set(
        existentes
          .filter((u) => u.evento_id === eventoId)
          .map((u) => chaveUnidade(tipo, u.numero)),
      );

      let contador = existentes.reduce((max, u) => {
        const m = /_(\d+)$/.exec(u.id ?? "");
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0);

      const padrao = PADRAO_POR_TIPO[tipo];
      const novas: Unidade[] = [];
      for (const posicao of previstas) {
        if (jaTem.has(chaveUnidade(tipo, posicao.numero))) continue;
        contador += 1;
        novas.push({
          id: `${prefixoDoTipo(tipo)}_${String(contador).padStart(3, "0")}`,
          evento_id: eventoId,
          numero: posicao.numero,
          nome: `${rotuloDoTipo(tipo)} ${posicao.numero}`,
          capacidade: padrao.capacidade,
          valor: padrao.valor,
          status: "DISPONIVEL",
          observacoes: "",
        });
      }

      if (novas.length) {
        await appendRows(tabela, novas as unknown as Record<string, string>[]);
        criadas[tipo] = novas.length;
      }
    }

    const total = Object.values(criadas).reduce((a, b) => a + b, 0);
    if (total) {
      await registrarLog({
        usuario: user.usuario,
        acao: "APLICAR CROQUI",
        entidade: croqui.nome,
        entidade_id: eventoId,
        detalhes: TIPOS_UNIDADE.map((t) => `${t}: ${criadas[t] ?? 0}`).join(", "),
      });
    }

    return json({ criadas, total });
  } catch (error) {
    return erroResposta(error);
  }
}
