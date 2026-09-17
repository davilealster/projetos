"use client";

import { useMemo, useState } from "react";
import { useApp } from "./contexto";
import { useDados } from "./usar-dados";
import { SemEvento } from "./aviso-sem-evento";
import { Esqueleto, Folha, Vazio, classes, useToast } from "./ui";
import { PainelUnidade, ROTULO } from "./painel-unidade";
import { ListaPosicoes } from "./lista-posicoes";
import { IconeCadeado, IconeCadeadoAberto, IconeMais } from "./icones";
import { api } from "@/lib/cliente";
import { CROQUI_SOULBRADO, chaveUnidade, type PosicaoCroqui } from "@/lib/croqui";
import type { GruposDeUnidades } from "@/lib/lista-whatsapp";
import { statusPrioridadeLounge, validarReservaLounge } from "@/lib/regras";
import type { TipoUnidade, UnidadeComReserva } from "@/lib/types";

interface Detalhe {
  lounges: UnidadeComReserva[];
  bistros: UnidadeComReserva[];
  mesas: UnidadeComReserva[];
}

type Realce = "TODOS" | TipoUnidade;

const CROQUI = CROQUI_SOULBRADO;

const TONS_ZONA: Record<string, string> = {
  deck: "bg-white/[0.035] border border-white/10 rounded-2xl",
  palco: "bg-white/10 border border-white/20 rounded-xl",
  dj: "bg-white/[0.06] border border-dashed border-white/15 rounded-lg",
  servico: "bg-white/[0.05] border border-white/10 rounded-xl",
  kids: "bg-pds-orange/15 border border-pds-orange/30 rounded-xl",
  entrada: "bg-transparent",
};

export function CroquiSalao() {
  const { evento, carregando: carregandoApp, podeReservar, usuario, ehAdmin, atualizar } = useApp();
  const { dados, carregando, erro } = useDados<Detalhe>(
    evento ? `/api/eventos/${evento.id}` : null,
  );
  const avisar = useToast();

  const [realce, setRealce] = useState<Realce>("TODOS");
  const [zoom, setZoom] = useState(1);
  const [selecionada, setSelecionada] = useState<UnidadeComReserva | null>(null);
  const [vaga, setVaga] = useState<PosicaoCroqui | null>(null);
  const [criando, setCriando] = useState(false);

  const porChave = useMemo(() => {
    const mapa = new Map<string, UnidadeComReserva>();
    for (const lista of [dados?.lounges, dados?.bistros, dados?.mesas]) {
      for (const unidade of lista ?? []) {
        const tipo: TipoUnidade =
          lista === dados?.lounges ? "LOUNGE" : lista === dados?.bistros ? "BISTRO" : "MESA";
        mapa.set(chaveUnidade(tipo, unidade.numero), unidade);
      }
    }
    return mapa;
  }, [dados]);

  /** Unidades cadastradas que o croqui nao preve (outra casa, extra, etc). */
  const foraDoCroqui = useMemo(() => {
    const previstas = new Set(CROQUI.posicoes.map((p) => chaveUnidade(p.tipo, p.numero)));
    const extras: { tipo: TipoUnidade; unidade: UnidadeComReserva }[] = [];
    const listas: [TipoUnidade, UnidadeComReserva[]][] = [
      ["LOUNGE", dados?.lounges ?? []],
      ["BISTRO", dados?.bistros ?? []],
      ["MESA", dados?.mesas ?? []],
    ];
    for (const [tipo, lista] of listas) {
      for (const unidade of lista) {
        if (!previstas.has(chaveUnidade(tipo, unidade.numero))) extras.push({ tipo, unidade });
      }
    }
    return extras;
  }, [dados]);

  const faltando = useMemo(
    () => CROQUI.posicoes.filter((p) => !porChave.has(chaveUnidade(p.tipo, p.numero))),
    [porChave],
  );

  const grupos: GruposDeUnidades = useMemo(
    () => ({
      LOUNGE: dados?.lounges ?? [],
      BISTRO: dados?.bistros ?? [],
      MESA: dados?.mesas ?? [],
    }),
    [dados],
  );

  if (carregandoApp) return <Esqueleto linhas={4} />;
  if (!evento) return <SemEvento />;

  const prioridade = statusPrioridadeLounge(evento);
  const motivoLounge = (() => {
    const r = validarReservaLounge(evento, false);
    return r.ok ? null : r.motivo;
  })();

  function contar(tipo: TipoUnidade) {
    const lista =
      tipo === "LOUNGE" ? dados?.lounges : tipo === "BISTRO" ? dados?.bistros : dados?.mesas;
    const total = lista?.length ?? 0;
    return { total, ocupados: (lista ?? []).filter((u) => u.ocupado).length };
  }

  async function aplicarCroqui() {
    setCriando(true);
    try {
      const { total } = await api.post<{ total: number }>("/api/croqui", {
        evento_id: evento!.id,
        croqui_id: CROQUI.id,
      });
      avisar(`${total} posição(ões) cadastrada(s) a partir do croqui.`);
      atualizar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao aplicar o croqui.", "erro");
    } finally {
      setCriando(false);
    }
  }

  async function cadastrarUma(posicao: PosicaoCroqui) {
    setCriando(true);
    try {
      await api.post("/api/unidades", {
        evento_id: evento!.id,
        tipo: posicao.tipo,
        numero: posicao.numero,
      });
      avisar(`${ROTULO[posicao.tipo].singular} ${posicao.numero} cadastrado.`);
      setVaga(null);
      atualizar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao cadastrar.", "erro");
    } finally {
      setCriando(false);
    }
  }

  const filtros: { chave: Realce; rotulo: string }[] = [
    { chave: "TODOS", rotulo: "Tudo" },
    ...(["LOUNGE", "BISTRO", "MESA"] as TipoUnidade[]).map((tipo) => {
      const { total, ocupados } = contar(tipo);
      return { chave: tipo as Realce, rotulo: `${ROTULO[tipo].plural} ${ocupados}/${total}` };
    }),
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Mapa do salão</h1>
          <p className="text-sm text-pds-muted">{CROQUI.local}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 1.6, 2.4].map((nivel) => (
            <button
              key={nivel}
              onClick={() => setZoom(nivel)}
              className={classes(
                "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition",
                zoom === nivel
                  ? "border-pds-orange bg-pds-orange text-black"
                  : "border-pds-line bg-pds-card text-pds-muted",
              )}
            >
              {nivel}x
            </button>
          ))}
        </div>
      </header>

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

      <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filtros.map((f) => (
          <button
            key={f.chave}
            onClick={() => setRealce(f.chave)}
            className={classes(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition",
              realce === f.chave
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
        <Esqueleto linhas={5} />
      ) : (
        <>
          {ehAdmin && faltando.length > 0 ? (
            <button
              onClick={aplicarCroqui}
              disabled={criando}
              className="btn-secundario w-full border-pds-orange/50 text-pds-orangeSoft"
            >
              <IconeMais width={18} height={18} />
              Cadastrar as {faltando.length} posições que faltam
            </button>
          ) : null}

          <CroquiDesenho
            porChave={porChave}
            realce={realce}
            zoom={zoom}
            aoTocar={(posicao, unidade) =>
              unidade ? setSelecionada(unidade) : ehAdmin ? setVaga(posicao) : undefined
            }
          />

          <Legenda />

          <ListaPosicoes
            evento={evento}
            grupos={grupos}
            podeReservar={podeReservar}
            aoAbrir={(_, unidade) => setSelecionada(unidade)}
            aoAtualizar={atualizar}
          />

          {foraDoCroqui.length > 0 ? (
            <section className="card px-4 py-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-pds-muted">
                Fora do croqui do Soulbrado
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {foraDoCroqui.map(({ tipo, unidade }) => (
                  <button
                    key={unidade.id}
                    onClick={() => setSelecionada(unidade)}
                    className={classes(
                      "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                      unidade.ocupado
                        ? "border-pds-orange bg-pds-orange/20 text-white"
                        : "border-pds-line bg-black/40 text-pds-muted",
                    )}
                  >
                    {ROTULO[tipo].singular} {unidade.numero}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {porChave.size === 0 ? (
            <Vazio
              titulo="Nenhuma unidade cadastrada"
              descricao={
                ehAdmin
                  ? "Use o botão acima para cadastrar todas as posições do croqui de uma vez."
                  : "Peça a um administrador para cadastrar as posições deste evento."
              }
            />
          ) : null}
        </>
      )}

      {selecionada ? (
        <PainelUnidade
          tipo={
            (dados?.lounges ?? []).some((u) => u.id === selecionada.id)
              ? "LOUNGE"
              : (dados?.bistros ?? []).some((u) => u.id === selecionada.id)
                ? "BISTRO"
                : "MESA"
          }
          unidade={selecionada}
          eventoId={evento.id}
          eventoEncerrado={evento.status === "ENCERRADO"}
          prioridadeLiberada={prioridade.liberado}
          motivoBloqueio={motivoLounge}
          podeReservar={podeReservar}
          podeApagar={usuario?.papel === "ADMIN"}
          aoFechar={() => setSelecionada(null)}
          aoSalvar={() => {
            setSelecionada(null);
            atualizar();
          }}
        />
      ) : null}

      <Folha
        aberta={vaga !== null}
        aoFechar={() => setVaga(null)}
        titulo={vaga ? `${ROTULO[vaga.tipo].singular} ${vaga.numero}` : ""}
        subtitulo="Posição do croqui ainda não cadastrada neste evento"
      >
        {vaga ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-pds-muted">
              Esta posição existe na planta do Soulbrado, mas não está cadastrada no evento{" "}
              <span className="font-bold text-white">{evento.nome}</span>. Cadastre para poder
              receber reservas.
            </p>
            <button
              onClick={() => cadastrarUma(vaga)}
              disabled={criando}
              className="btn-primario w-full"
            >
              {criando ? "Cadastrando..." : `Cadastrar ${ROTULO[vaga.tipo].singular} ${vaga.numero}`}
            </button>
          </div>
        ) : null}
      </Folha>
    </div>
  );
}

/**
 * Desenho puro do croqui. Recebe o que ja esta reservado e nao sabe buscar
 * nada — assim a planta pode ser renderizada isolada para conferencia visual.
 */
export function CroquiDesenho({
  porChave,
  realce,
  zoom,
  aoTocar,
}: {
  porChave: Map<string, UnidadeComReserva>;
  realce: Realce;
  zoom: number;
  aoTocar: (posicao: PosicaoCroqui, unidade: UnidadeComReserva | null) => void;
}) {
  return (
    <div className="card overflow-auto p-3">
      <div style={{ width: `${zoom * 100}%` }}>
        <div className="relative w-full" style={{ aspectRatio: String(CROQUI.proporcao) }}>
          {CROQUI.zonas.map((zona, i) => (
            <div
              key={`${zona.rotulo}-${i}`}
              className={classes(
                "absolute flex items-center justify-center px-1 text-center",
                TONS_ZONA[zona.tom],
              )}
              style={{
                left: `${zona.x}%`,
                top: `${(zona.y / 118) * 100}%`,
                width: `${zona.largura}%`,
                height: `${(zona.altura / 118) * 100}%`,
              }}
            >
              {zona.rotulo ? (
                <span
                  className={classes(
                    "font-extrabold uppercase leading-tight tracking-wider",
                    zona.tom === "palco"
                      ? "text-white"
                      : zona.tom === "kids"
                        ? "text-pds-orangeSoft"
                        : zona.tom === "entrada"
                          ? "text-pds-orange"
                          : "text-white/45",
                  )}
                  style={{ fontSize: `${Math.min(zoom, 1.6) * 7}px` }}
                >
                  {zona.rotulo}
                </span>
              ) : null}
            </div>
          ))}

          {CROQUI.posicoes.map((posicao) => {
            const unidade = porChave.get(chaveUnidade(posicao.tipo, posicao.numero)) ?? null;
            return (
              <Marcador
                key={`${posicao.tipo}-${posicao.numero}`}
                posicao={posicao}
                unidade={unidade}
                apagado={realce !== "TODOS" && realce !== posicao.tipo}
                zoom={zoom}
                aoTocar={() => aoTocar(posicao, unidade)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Marcador({
  posicao,
  unidade,
  apagado,
  zoom,
  aoTocar,
}: {
  posicao: PosicaoCroqui;
  unidade: UnidadeComReserva | null;
  apagado: boolean;
  zoom: number;
  aoTocar: () => void;
}) {
  const bloqueado = (unidade?.status ?? "").toUpperCase() === "BLOQUEADO";
  const checkin = unidade?.reserva?.status === "CHECKIN";
  const aniversario = unidade?.reserva?.aniversariante === "SIM";
  const ausente = unidade === null;

  const formato =
    posicao.tipo === "LOUNGE"
      ? "[clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]"
      : posicao.tipo === "BISTRO"
        ? "rounded-full"
        : "rounded-[22%]";

  // Contorno (ring/border) nao sobrevive ao clip-path do pentagono: a forma
  // de cada marcador precisa vir do preenchimento.
  const cor = ausente
    ? "bg-white/[0.07] text-white/35"
    : bloqueado
      ? "bg-white/[0.13] text-white/45"
      : checkin
        ? "bg-emerald-500 text-black"
        : unidade?.ocupado
          ? "bg-pds-orange text-black"
          : "bg-white/25 text-white";

  const tamanho = posicao.tipo === "LOUNGE" ? 9 : 8.5;
  const corpo = Math.max(8, Math.min(zoom, 2.4) * 8);

  return (
    <button
      onClick={aoTocar}
      aria-label={`${ROTULO[posicao.tipo].singular} ${posicao.numero}${
        ausente ? " (não cadastrado)" : unidade?.ocupado ? " (reservado)" : " (livre)"
      }`}
      className={classes(
        "absolute flex items-center justify-center font-extrabold transition",
        formato,
        cor,
        apagado ? "opacity-25" : "opacity-100",
        "active:scale-90",
      )}
      style={{
        left: `${posicao.x}%`,
        top: `${(posicao.y / 118) * 100}%`,
        width: `${tamanho}%`,
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        fontSize: `${corpo}px`,
      }}
    >
      {/* O bolo fica DENTRO da forma: o clip-path do pentagono apaga
          qualquer filho posicionado para fora da caixa. */}
      <span className="flex flex-col items-center justify-center leading-none">
        <span>{posicao.numero}</span>
        {aniversario ? (
          <span
            role="img"
            aria-label="Aniversariante"
            className="mt-[0.15em]"
            style={{ fontSize: `${corpo * 0.95}px`, lineHeight: 1 }}
          >
            🎂
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Legenda() {
  return (
    <div className="card flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 text-[11px] text-pds-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 bg-white/25 [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]" />
        Lounge
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-full bg-white/25" />
        Bistrô
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-[22%] bg-white/25" />
        Mesa única
      </span>
      <span className="w-full border-t border-pds-line" />
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded bg-white/25" />
        Livre
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded bg-pds-orange" />
        Reservado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded bg-emerald-500" />
        Check-in
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded bg-white/[0.13]" />
        Bloqueado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded bg-white/[0.07]" />
        Não cadastrado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span role="img" aria-label="Aniversariante">
          🎂
        </span>
        Aniversariante
      </span>
    </div>
  );
}
