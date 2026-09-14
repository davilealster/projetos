"use client";

import { useMemo, useState } from "react";
import { Folha, classes, useConfirmacao, useToast } from "./ui";
import { ROTULO } from "./painel-unidade";
import { IconeCheck, IconeCopiar, IconeMover } from "./icones";
import { api } from "@/lib/cliente";
import { copiarTexto } from "@/lib/copiar";
import {
  contarOcupadas,
  montarTextoWhatsapp,
  SECOES,
  type GruposDeUnidades,
} from "@/lib/lista-whatsapp";
import type { Evento, TipoUnidade, UnidadeComReserva } from "@/lib/types";

interface Props {
  evento: Evento;
  grupos: GruposDeUnidades;
  /** Secoes a exibir. Por padrao as tres. */
  tipos?: TipoUnidade[];
  podeVender: boolean;
  aoAbrir: (tipo: TipoUnidade, unidade: UnidadeComReserva) => void;
  aoAtualizar: () => void;
  /** O botao copia sempre a lista inteira, mesmo numa pagina de um tipo so'. */
  mostrarCopiar?: boolean;
}

export function ListaPosicoes({
  evento,
  grupos,
  tipos,
  podeVender,
  aoAbrir,
  aoAtualizar,
  mostrarCopiar = true,
}: Props) {
  const [movendo, setMovendo] = useState<{ tipo: TipoUnidade; unidade: UnidadeComReserva } | null>(
    null,
  );

  const visiveis = SECOES.filter((s) => !tipos || tipos.includes(s.tipo));
  const temAlgo = visiveis.some((s) => (grupos[s.tipo] ?? []).length > 0);

  if (!temAlgo) return null;

  return (
    <div className="space-y-3">
      {mostrarCopiar ? <BotaoCopiar evento={evento} grupos={grupos} /> : null}

      {visiveis.map(({ tipo, emoji, rotulo }) => {
        const unidades = [...(grupos[tipo] ?? [])].sort(
          (a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0),
        );
        if (!unidades.length) return null;
        const ocupadas = unidades.filter((u) => u.ocupado).length;

        return (
          <section key={tipo} className="card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-pds-line px-4 py-3">
              <span aria-hidden="true">{emoji}</span>
              <h3 className="flex-1 text-sm font-extrabold uppercase tracking-wider">{rotulo}</h3>
              <span className="text-xs font-bold text-pds-muted">
                {ocupadas}/{unidades.length}
              </span>
            </header>

            <ul className="divide-y divide-pds-line">
              {unidades.map((unidade) => (
                <Linha
                  key={unidade.id}
                  tipo={tipo}
                  unidade={unidade}
                  podeVender={podeVender}
                  aoAbrir={() => aoAbrir(tipo, unidade)}
                  aoMover={() => setMovendo({ tipo, unidade })}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {movendo ? (
        <FolhaMover
          origem={movendo}
          grupos={grupos}
          aoFechar={() => setMovendo(null)}
          aoMover={() => {
            setMovendo(null);
            aoAtualizar();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------- Linha --------------------------------- */

function Linha({
  tipo,
  unidade,
  podeVender,
  aoAbrir,
  aoMover,
}: {
  tipo: TipoUnidade;
  unidade: UnidadeComReserva;
  podeVender: boolean;
  aoAbrir: () => void;
  aoMover: () => void;
}) {
  const reserva = unidade.reserva;
  const bloqueado = (unidade.status ?? "").toUpperCase() === "BLOQUEADO";
  const checkin = reserva?.status === "CHECKIN";
  const aniversario = reserva?.aniversariante === "SIM";

  return (
    <li className="flex items-stretch">
      <button
        onClick={aoAbrir}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition active:bg-white/5"
      >
        <span
          className={classes(
            "w-8 shrink-0 text-center text-sm font-extrabold tabular-nums",
            checkin
              ? "text-emerald-400"
              : reserva
                ? "text-pds-orange"
                : bloqueado
                  ? "text-white/25"
                  : "text-pds-muted",
          )}
        >
          {String(unidade.numero).padStart(2, "0")}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {reserva ? (
            <>
              <span className="truncate text-sm font-bold">{reserva.nome_cliente}</span>
              {aniversario ? (
                <span role="img" aria-label="Aniversariante" className="shrink-0 text-xs">
                  🎂
                </span>
              ) : null}
              {checkin ? (
                <IconeCheck className="shrink-0 text-emerald-400" width={13} height={13} />
              ) : null}
            </>
          ) : (
            <span className="text-sm text-white/30">{bloqueado ? "bloqueado" : "livre"}</span>
          )}
        </span>

        {reserva && Number(reserva.qtd_pessoas) > 0 ? (
          <span className="shrink-0 text-[11px] tabular-nums text-pds-muted">
            {reserva.qtd_pessoas}p
          </span>
        ) : null}
      </button>

      {reserva && podeVender ? (
        <button
          onClick={aoMover}
          aria-label={`Mover ${reserva.nome_cliente} de ${ROTULO[tipo].singular} ${unidade.numero}`}
          className="shrink-0 border-l border-pds-line px-3.5 text-pds-muted transition active:bg-white/5 hover:text-pds-orange"
        >
          <IconeMover width={18} height={18} />
        </button>
      ) : null}
    </li>
  );
}

/* ------------------------------ Copiar lista ----------------------------- */

function BotaoCopiar({ evento, grupos }: { evento: Evento; grupos: GruposDeUnidades }) {
  const avisar = useToast();
  const [copiado, setCopiado] = useState(false);
  const [aberto, setAberto] = useState(false);

  const texto = useMemo(() => montarTextoWhatsapp(evento, grupos), [evento, grupos]);
  const ocupadas = contarOcupadas(grupos);

  async function copiar() {
    if (await copiarTexto(texto)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      return;
    }
    // Sem permissao de area de transferencia: mostra o texto para copiar a mao.
    setAberto(true);
    avisar("Seu navegador bloqueou a copia. Selecione o texto e copie.", "erro");
  }

  return (
    <>
      <button
        onClick={copiar}
        className={classes(
          "btn w-full transition",
          copiado
            ? "bg-emerald-500 text-black"
            : "border border-pds-line bg-pds-card text-white hover:border-pds-orange/60",
        )}
      >
        {copiado ? (
          <>
            <IconeCheck width={18} height={18} />
            Lista copiada
          </>
        ) : (
          <>
            <IconeCopiar width={18} height={18} />
            Copiar lista do WhatsApp
            <span className="text-xs font-medium text-pds-muted">({ocupadas} reservas)</span>
          </>
        )}
      </button>

      <Folha
        aberta={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Lista para o WhatsApp"
        subtitulo="Segure no texto, selecione tudo e copie."
      >
        <textarea
          readOnly
          value={texto}
          onFocus={(e) => e.currentTarget.select()}
          className="campo min-h-[50dvh] font-mono text-xs leading-relaxed"
        />
      </Folha>
    </>
  );
}

/* -------------------------- Mover ou trocar pessoa ------------------------ */

function FolhaMover({
  origem,
  grupos,
  aoFechar,
  aoMover,
}: {
  origem: { tipo: TipoUnidade; unidade: UnidadeComReserva };
  grupos: GruposDeUnidades;
  aoFechar: () => void;
  aoMover: () => void;
}) {
  const avisar = useToast();
  const confirmar = useConfirmacao();
  const [enviando, setEnviando] = useState(false);
  const reserva = origem.unidade.reserva!;

  async function mover(tipoDestino: TipoUnidade, destino: UnidadeComReserva) {
    setEnviando(true);
    try {
      await api.patch(`/api/reservas/${reserva.id}`, {
        tipo: tipoDestino,
        unidade_id: destino.id,
      });
      avisar(`${reserva.nome_cliente} foi para ${ROTULO[tipoDestino].singular} ${destino.numero}.`);
      aoMover();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível mover.", "erro");
      setEnviando(false);
    }
  }

  async function trocar(alvo: { tipo: TipoUnidade; unidade: UnidadeComReserva }) {
    const outra = alvo.unidade.reserva!;
    const certeza = await confirmar({
      titulo: "Trocar de lugar?",
      confirmar: "Trocar",
      conteudo: (
        <div className="space-y-2">
          <LinhaTroca
            nome={reserva.nome_cliente}
            origemTexto={`${ROTULO[origem.tipo].singular} ${origem.unidade.numero}`}
            destinoTexto={`${ROTULO[alvo.tipo].singular} ${alvo.unidade.numero}`}
          />
          <LinhaTroca
            nome={outra.nome_cliente}
            origemTexto={`${ROTULO[alvo.tipo].singular} ${alvo.unidade.numero}`}
            destinoTexto={`${ROTULO[origem.tipo].singular} ${origem.unidade.numero}`}
          />
        </div>
      ),
    });
    if (!certeza) return;

    setEnviando(true);
    try {
      await api.post("/api/reservas/trocar", {
        reserva_a: reserva.id,
        reserva_b: outra.id,
      });
      avisar(`${reserva.nome_cliente} e ${outra.nome_cliente} trocaram de lugar.`);
      aoMover();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível trocar.", "erro");
      setEnviando(false);
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={`Mover ${reserva.nome_cliente}`}
      subtitulo={`Hoje em ${ROTULO[origem.tipo].singular} ${origem.unidade.numero} · toque num lugar livre para mover, ou num nome para trocar`}
    >
      <div className="space-y-4">
        {SECOES.map(({ tipo, emoji, rotulo }) => {
          const unidades = [...(grupos[tipo] ?? [])]
            .filter(
              (u) =>
                u.id !== origem.unidade.id && (u.status ?? "").toUpperCase() !== "BLOQUEADO",
            )
            .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

          if (!(grupos[tipo] ?? []).length) return null;
          const livres = unidades.filter((u) => !u.ocupado).length;

          return (
            <section key={tipo}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pds-muted">
                <span aria-hidden="true">{emoji}</span>
                {rotulo}
                <span className="font-medium normal-case tracking-normal">
                  · {livres} livre{livres === 1 ? "" : "s"}
                </span>
              </p>

              {unidades.length === 0 ? (
                <p className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-2.5 text-xs text-white/40">
                  Nenhum lugar disponível nesta seção.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unidades.map((destino) =>
                    destino.ocupado ? (
                      <button
                        key={destino.id}
                        disabled={enviando}
                        onClick={() => trocar({ tipo, unidade: destino })}
                        className="flex max-w-full items-center gap-2 rounded-xl border border-pds-orange/40 bg-pds-orange/10 py-2 pl-2.5 pr-3 text-left transition active:scale-95 hover:border-pds-orange disabled:opacity-40"
                      >
                        <span className="text-sm font-extrabold tabular-nums text-pds-orange">
                          {String(destino.numero).padStart(2, "0")}
                        </span>
                        <span className="truncate text-xs font-medium text-white/80">
                          {destino.reserva?.nome_cliente}
                        </span>
                      </button>
                    ) : (
                      <button
                        key={destino.id}
                        disabled={enviando}
                        onClick={() => mover(tipo, destino)}
                        className="min-w-[3.25rem] rounded-xl border border-pds-line bg-black/40 px-3 py-2.5 text-sm font-extrabold tabular-nums transition active:scale-95 hover:border-pds-orange hover:text-pds-orange disabled:opacity-40"
                      >
                        {String(destino.numero).padStart(2, "0")}
                      </button>
                    ),
                  )}
                </div>
              )}
            </section>
          );
        })}

        <p className="text-xs leading-relaxed text-pds-muted">
          Lugar vazio move a reserva. Lugar com nome troca as duas de posição.
        </p>
      </div>

    </Folha>
  );
}

function LinhaTroca({
  nome,
  origemTexto,
  destinoTexto,
}: {
  nome: string;
  origemTexto: string;
  destinoTexto: string;
}) {
  return (
    <div className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-2.5">
      <p className="truncate text-sm font-bold">{nome}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-pds-muted">
        <span className="line-through">{origemTexto}</span>
        <IconeMover width={13} height={13} className="shrink-0 text-pds-orange" />
        <span className="font-bold text-white">{destinoTexto}</span>
      </p>
    </div>
  );
}
