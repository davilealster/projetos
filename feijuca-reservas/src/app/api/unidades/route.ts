import { erroResposta, exigirSessao, HttpError } from "@/lib/auth";
import { inteiro, json, lerCorpo, obrigatorio, texto } from "@/lib/api";
import { appendRows, findById, readTab, registrarLog, TABS } from "@/lib/sheets";
import { montarMapa } from "@/lib/regras";
import {
  normalizarTipo,
  prefixoDoTipo,
  rotuloDoTipo,
  tabelaDoTipo,
  valorPadraoDoEvento,
} from "@/lib/unidades";
import { normalizarValor } from "@/lib/valores";
import type { Evento, Reserva, Unidade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await exigirSessao();
    const url = new URL(request.url);
    const eventoId = obrigatorio(url.searchParams.get("evento_id"), "evento_id");
    const tipo = normalizarTipo(url.searchParams.get("tipo"));

    const [unidades, reservas] = await Promise.all([
      readTab<Unidade>(tabelaDoTipo(tipo)),
      readTab<Reserva>(TABS.reservas),
    ]);

    return json({
      unidades: montarMapa(
        unidades.filter((u) => u.evento_id === eventoId),
        reservas.filter((r) => r.evento_id === eventoId && r.tipo === tipo),
      ),
    });
  } catch (error) {
    return erroResposta(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await exigirSessao(["ADMIN"]);
    const corpo = await lerCorpo(request);

    const tipo = normalizarTipo(corpo.tipo);
    const eventoId = obrigatorio(corpo.evento_id, "evento_id");
    const evento = await findById<Evento>(TABS.eventos, eventoId);
    if (!evento) throw new HttpError(404, "Evento não encontrado.");

    const tabela = tabelaDoTipo(tipo);
    const existentes = await readTab<Unidade>(tabela, false);
    const doEvento = existentes.filter((u) => u.evento_id === eventoId);

    const capacidade = String(inteiro(corpo.capacidade, tipo === "LOUNGE" ? 8 : 4));
    // Sem valor informado, vale o padrao do evento (cortesia, por padrao).
    const valor = corpo.valor !== undefined && texto(corpo.valor) !== ""
      ? normalizarValor(corpo.valor)
      : valorPadraoDoEvento(evento, tipo);
    const quantidade = Math.min(Math.max(inteiro(corpo.quantidade, 1), 1), 60);

    // Numero explicito cria uma unidade; senao continua a numeracao do evento.
    const numeroInformado = corpo.numero !== undefined ? inteiro(corpo.numero) : null;
    const maiorNumero = doEvento.reduce((max, u) => Math.max(max, Number(u.numero) || 0), 0);

    let contadorId = existentes.reduce((max, u) => {
      const m = /_(\d+)$/.exec(u.id ?? "");
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);

    const novas: Unidade[] = [];
    const total = numeroInformado !== null ? 1 : quantidade;
    for (let i = 0; i < total; i++) {
      const numero = numeroInformado !== null ? numeroInformado : maiorNumero + i + 1;
      if (doEvento.some((u) => Number(u.numero) === numero)) {
        throw new HttpError(409, `${rotuloDoTipo(tipo)} numero ${numero} já existe neste evento.`);
      }
      contadorId += 1;
      novas.push({
        id: `${prefixoDoTipo(tipo)}_${String(contadorId).padStart(3, "0")}`,
        evento_id: eventoId,
        numero: String(numero),
        nome: texto(corpo.nome) || `${rotuloDoTipo(tipo)} ${numero}`,
        capacidade,
        valor,
        status: "DISPONIVEL",
        observacoes: texto(corpo.observacoes),
      });
    }

    await appendRows(tabela, novas as unknown as Record<string, string>[]);
    await registrarLog({
      usuario: user.usuario,
      acao: "CRIAR",
      entidade: rotuloDoTipo(tipo),
      entidade_id: novas.map((u) => u.id).join(","),
      detalhes: `${novas.length} unidade(s) no evento ${eventoId}`,
    });

    return json({ unidades: novas }, 201);
  } catch (error) {
    return erroResposta(error);
  }
}
