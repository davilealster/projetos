"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "./contexto";
import { useDados } from "./usar-dados";
import { SemEvento } from "./aviso-sem-evento";
import { Esqueleto, Vazio, classes } from "./ui";
import { IconeCadeado, IconeCadeadoAberto, IconeCheck, IconeLista, IconeMapa } from "./icones";
import { PainelUnidade, ROTULO } from "./painel-unidade";
import { ListaPosicoes } from "./lista-posicoes";
import { statusPrioridadeLounge, validarReservaLounge } from "@/lib/regras";
import type { GruposDeUnidades } from "@/lib/lista-whatsapp";
import type { TipoUnidade, UnidadeComReserva } from "@/lib/types";

type Filtro = "TODOS" | "LIVRES" | "OCUPADOS" | "ANIVERSARIO";
type Visao = "LISTA" | "GRADE";

const CHAVE_VISAO = "pds:visao-unidades";

interface Detalhe {
  lounges: UnidadeComReserva[];
  bistros: UnidadeComReserva[];
  mesas: UnidadeComReserva[];
}

export function MapaUnidades({ tipo }: { tipo: TipoUnidade }) {
  const { evento, carregando: carregandoApp, podeVender, usuario, atualizar } = useApp();
  const { dados, carregando, erro } = useDados<Detalhe>(
    evento ? `/api/eventos/${evento.id}` : null,
  );
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [selecionada, setSelecionada] = useState<UnidadeComReserva | null>(null);

  // A lista e' o padrao: e' assim que a equipe le' a escala hoje.
  const [visao, setVisao] = useState<Visao>("LISTA");
  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_VISAO);
      if (salva === "GRADE" || salva === "LISTA") setVisao(salva);
    } catch {
      // modo privado: fica no padrao
    }
  }, []);

  function trocarVisao(nova: Visao) {
    setVisao(nova);
    try {
      localStorage.setItem(CHAVE_VISAO, nova);
    } catch {
      // sem persistencia, mas a tela funciona
    }
  }

  const grupos: GruposDeUnidades = useMemo(
    () => ({
      LOUNGE: dados?.lounges ?? [],
      BISTRO: dados?.bistros ?? [],
      MESA: dados?.mesas ?? [],
    }),
    [dados],
  );

  const prioridade = evento ? statusPrioridadeLounge(evento) : null;
  const unidades = grupos[tipo];

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
        <div className="flex items-center gap-1 rounded-xl border border-pds-line bg-pds-card p-1">
          {(
            [
              { chave: "LISTA" as Visao, rotulo: "Lista", Icone: IconeLista },
              { chave: "GRADE" as Visao, rotulo: "Grade", Icone: IconeMapa },
            ]
          ).map(({ chave, rotulo, Icone }) => (
            <button
              key={chave}
              onClick={() => trocarVisao(chave)}
              aria-label={rotulo}
              aria-pressed={visao === chave}
              className={classes(
                "rounded-lg p-2 transition",
                visao === chave ? "bg-pds-orange text-black" : "text-pds-muted hover:text-white",
              )}
            >
              <Icone width={18} height={18} />
            </button>
          ))}
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

      {visao === "GRADE" ? (
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
      ) : null}

      {erro ? (
        <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>
      ) : carregando ? (
        <Esqueleto linhas={3} />
      ) : unidades.length === 0 ? (
        <Vazio
          titulo={`Nenhum ${ROTULO[tipo].singular.toLowerCase()} cadastrado`}
          descricao={`Cadastre os ${ROTULO[tipo].plural.toLowerCase()} deste evento na tela de eventos para começar a reservar.`}
        />
      ) : visao === "LISTA" ? (
        <ListaPosicoes
          evento={evento}
          grupos={grupos}
          tipos={[tipo]}
          podeVender={podeVender}
          aoAbrir={(_, unidade) => setSelecionada(unidade)}
          aoAtualizar={atualizar}
        />
      ) : visiveis.length === 0 ? (
        <Vazio titulo="Nada por aqui" descricao="Nenhuma unidade neste filtro." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {visiveis.map((unidade) => (
              <Bloco key={unidade.id} unidade={unidade} aoAbrir={() => setSelecionada(unidade)} />
            ))}
          </div>
          <Legenda />
        </>
      )}

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
        <span role="img" aria-label="Aniversariante" className="absolute right-1 top-1 text-[11px]">
          🎂
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
        <span role="img" aria-label="Aniversariante">
          🎂
        </span>
        Aniversariante
      </span>
    </div>
  );
}
