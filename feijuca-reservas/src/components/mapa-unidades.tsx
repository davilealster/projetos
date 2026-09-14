"use client";

import { useMemo, useState } from "react";
import { useApp } from "./contexto";
import { useDados } from "./usar-dados";
import { SemEvento } from "./aviso-sem-evento";
import { Esqueleto, Vazio, classes } from "./ui";
import { IconeBolo, IconeCadeado, IconeCadeadoAberto, IconeCheck } from "./icones";
import { PainelUnidade, ROTULO } from "./painel-unidade";
import { statusPrioridadeLounge, validarReservaLounge } from "@/lib/regras";
import type { TipoUnidade, UnidadeComReserva } from "@/lib/types";

type Filtro = "TODOS" | "LIVRES" | "OCUPADOS" | "ANIVERSARIO";

export function MapaUnidades({ tipo }: { tipo: TipoUnidade }) {
  const { evento, carregando: carregandoApp, podeVender, usuario, atualizar } = useApp();
  const { dados, carregando, erro } = useDados<{ unidades: UnidadeComReserva[] }>(
    evento ? `/api/unidades?evento_id=${evento.id}&tipo=${tipo}` : null,
  );
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [selecionada, setSelecionada] = useState<UnidadeComReserva | null>(null);

  const prioridade = evento ? statusPrioridadeLounge(evento) : null;
  const unidades = dados?.unidades ?? [];

  const visiveis = useMemo(() => {
    switch (filtro) {
      case "LIVRES":
        return unidades.filter((u) => !u.ocupado && u.status !== "BLOQUEADO");
      case "OCUPADOS":
        return unidades.filter((u) => u.ocupado);
      case "ANIVERSARIO":
        return unidades.filter((u) => u.reserva?.aniversariante === "SIM");
      default:
        return unidades;
    }
  }, [unidades, filtro]);

  if (carregandoApp) return <Esqueleto linhas={4} />;
  if (!evento) return <SemEvento />;

  const ocupados = unidades.filter((u) => u.ocupado).length;
  const filtros: { chave: Filtro; rotulo: string }[] = [
    { chave: "TODOS", rotulo: `Todos (${unidades.length})` },
    { chave: "LIVRES", rotulo: `Livres (${unidades.length - ocupados})` },
    { chave: "OCUPADOS", rotulo: `Reservados (${ocupados})` },
    ...(tipo === "LOUNGE"
      ? [{ chave: "ANIVERSARIO" as Filtro, rotulo: "Aniversariantes" }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">{ROTULO[tipo].plural}</h1>
          <p className="text-sm text-pds-muted">
            {ocupados} de {unidades.length} reservados
          </p>
        </div>
      </header>

      {tipo === "LOUNGE" && prioridade ? (
        <div
          className={classes(
            "card flex items-start gap-3 px-4 py-3",
            prioridade.liberado
              ? "border-emerald-500/35 bg-emerald-500/5"
              : "border-pds-orange/40 bg-pds-orange/5",
          )}
        >
          <span
            className={classes(
              "mt-0.5 shrink-0",
              prioridade.liberado ? "text-emerald-400" : "text-pds-orange",
            )}
          >
            {prioridade.liberado ? (
              <IconeCadeadoAberto width={20} height={20} />
            ) : (
              <IconeCadeado width={20} height={20} />
            )}
          </span>
          <p className="text-xs leading-relaxed text-white/85">{prioridade.mensagem}</p>
        </div>
      ) : null}

      <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filtros.map((f) => (
          <button
            key={f.chave}
            onClick={() => setFiltro(f.chave)}
            className={classes(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition",
              filtro === f.chave
                ? "border-pds-orange bg-pds-orange text-black"
                : "border-pds-line bg-pds-card text-pds-muted hover:text-white",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {erro ? (
        <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>
      ) : carregando ? (
        <Esqueleto linhas={3} />
      ) : unidades.length === 0 ? (
        <Vazio
          titulo={`Nenhum ${ROTULO[tipo].singular.toLowerCase()} cadastrado`}
          descricao={`Cadastre os ${ROTULO[tipo].plural.toLowerCase()} deste evento na tela de eventos para começar a reservar.`}
        />
      ) : visiveis.length === 0 ? (
        <Vazio titulo="Nada por aqui" descricao="Nenhuma unidade neste filtro." />
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {visiveis.map((unidade) => (
            <Bloco key={unidade.id} unidade={unidade} aoAbrir={() => setSelecionada(unidade)} />
          ))}
        </div>
      )}

      <Legenda />

      {selecionada ? (
        <PainelUnidade
          tipo={tipo}
          unidade={selecionada}
          eventoId={evento.id}
          eventoEncerrado={evento.status === "ENCERRADO"}
          prioridadeLiberada={prioridade?.liberado ?? true}
          motivoBloqueio={
            tipo === "LOUNGE" && evento
              ? (() => {
                  const r = validarReservaLounge(evento, false);
                  return r.ok ? null : r.motivo;
                })()
              : null
          }
          podeVender={podeVender}
          podeApagar={usuario?.papel === "ADMIN"}
          aoFechar={() => setSelecionada(null)}
          aoSalvar={() => {
            setSelecionada(null);
            atualizar();
          }}
        />
      ) : null}
    </div>
  );
}

function Bloco({ unidade, aoAbrir }: { unidade: UnidadeComReserva; aoAbrir: () => void }) {
  const bloqueado = (unidade.status ?? "").toUpperCase() === "BLOQUEADO";
  const aniversario = unidade.reserva?.aniversariante === "SIM";
  const checkin = unidade.reserva?.status === "CHECKIN";

  return (
    <button
      onClick={aoAbrir}
      className={classes(
        "relative flex aspect-square flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-[.96]",
        bloqueado
          ? "border-white/10 bg-white/5 text-pds-muted"
          : unidade.ocupado
            ? checkin
              ? "border-emerald-500/50 bg-emerald-500/15 text-white"
              : "border-pds-orange bg-pds-orange/20 text-white"
            : "border-pds-line bg-pds-card text-white hover:border-white/30",
      )}
    >
      {aniversario ? (
        <span className="absolute right-1.5 top-1.5 text-pds-orangeSoft">
          <IconeBolo width={14} height={14} />
        </span>
      ) : null}
      {checkin ? (
        <span className="absolute left-1.5 top-1.5 text-emerald-400">
          <IconeCheck width={14} height={14} />
        </span>
      ) : null}

      <span className="text-2xl font-extrabold leading-none">{unidade.numero}</span>
      <span className="mt-1 line-clamp-2 px-0.5 text-center text-[10px] font-medium leading-tight text-white/70">
        {bloqueado
          ? "bloqueado"
          : unidade.reserva
            ? unidade.reserva.nome_cliente.split(" ")[0]
            : "livre"}
      </span>
    </button>
  );
}

function Legenda() {
  const itens = [
    { cor: "bg-pds-card border-pds-line", texto: "Livre" },
    { cor: "bg-pds-orange/30 border-pds-orange", texto: "Reservado" },
    { cor: "bg-emerald-500/25 border-emerald-500/60", texto: "Check-in" },
    { cor: "bg-white/5 border-white/10", texto: "Bloqueado" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px] text-pds-muted">
      {itens.map((i) => (
        <span key={i.texto} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded border ${i.cor}`} />
          {i.texto}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <IconeBolo width={12} height={12} className="text-pds-orangeSoft" />
        Aniversariante
      </span>
    </div>
  );
}
