"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/components/contexto";
import { useDados } from "@/components/usar-dados";
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Interruptor,
  Selecao,
  classes,
  useToast,
} from "@/components/ui";
import { IconeBistro, IconeLounge, IconeMais, IconeMapa, IconeMesa } from "@/components/icones";
import { api } from "@/lib/cliente";
import { formatarData, formatarValorReserva } from "@/lib/formato";
import { PADRAO_POR_TIPO } from "@/lib/croqui";
import { valorPadraoDoEvento } from "@/lib/valores";
import type { StatusPrioridade } from "@/lib/regras";
import type { Evento, TipoUnidade, UnidadeComReserva, Vip } from "@/lib/types";

interface Detalhe {
  evento: Evento;
  prioridadeLounge: StatusPrioridade;
  lounges: UnidadeComReserva[];
  bistros: UnidadeComReserva[];
  mesas: UnidadeComReserva[];
  vips: Vip[];
}

export default function PaginaEvento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ehAdmin, atualizar, recarregarEventos } = useApp();
  const avisar = useToast();
  const { dados, carregando, erro } = useDados<Detalhe>(`/api/eventos/${id}`);

  const [editarAberto, setEditarAberto] = useState(false);
  const [novasUnidades, setNovasUnidades] = useState<TipoUnidade | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (carregando) return <Esqueleto linhas={5} />;
  if (erro || !dados) return <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>;

  const { evento, prioridadeLounge, lounges, bistros, mesas, vips } = dados;
  const loungesLivres = lounges.filter((u) => !u.ocupado).length;

  async function alternarLiberacao(valor: boolean) {
    setSalvando(true);
    try {
      await api.patch(`/api/eventos/${id}`, { lounges_liberados: valor ? "SIM" : "NAO" });
      avisar(
        valor
          ? "Lounges liberados para não aniversariantes."
          : "Prioridade de aniversariante reativada.",
      );
      atualizar();
      await recarregarEventos();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao salvar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function aplicarCroqui() {
    setSalvando(true);
    try {
      const { total } = await api.post<{ total: number }>("/api/croqui", {
        evento_id: id,
        croqui_id: "SOULBRADO",
      });
      avisar(
        total
          ? `${total} posição(ões) criada(s) a partir do croqui do Soulbrado.`
          : "O croqui do Soulbrado já está todo cadastrado neste evento.",
      );
      atualizar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao aplicar o croqui.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function apagarEvento() {
    if (!confirm(`Apagar o evento "${evento.nome}"? Só funciona se não houver reservas.`)) return;
    try {
      await api.delete(`/api/eventos/${id}`);
      avisar("Evento apagado.");
      await recarregarEventos();
      router.replace("/eventos");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao apagar.", "erro");
    }
  }

  return (
    <div className="space-y-4">
      <header className="card px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{evento.nome}</h1>
            <p className="mt-0.5 text-sm text-pds-muted">
              {formatarData(evento.data)}
              {evento.hora_inicio ? ` · ${evento.hora_inicio}` : ""}
              {evento.local ? ` · ${evento.local}` : ""}
            </p>
          </div>
          <Etiqueta cor={evento.status === "ATIVO" ? "verde" : "cinza"}>{evento.status}</Etiqueta>
        </div>
        {ehAdmin ? (
          <button onClick={() => setEditarAberto(true)} className="btn-secundario mt-4 w-full">
            Editar evento
          </button>
        ) : null}
      </header>

      {/* Regra do lounge */}
      <section className="card space-y-3 px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-pds-orange">
            Prioridade de aniversariante
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-pds-muted">
            {prioridadeLounge.mensagem} Restam {loungesLivres} lounge
            {loungesLivres === 1 ? "" : "s"} livre{loungesLivres === 1 ? "" : "s"}.
          </p>
        </div>
        {ehAdmin ? (
          <Interruptor
            destaque
            rotulo="Liberar lounges para qualquer pessoa"
            descricao="Use quando faltarem lounges para vender e o prazo ainda não chegou."
            ativo={evento.lounges_liberados === "SIM"}
            aoMudar={(v) => !salvando && alternarLiberacao(v)}
          />
        ) : null}
      </section>

      {ehAdmin ? (
        <SecaoValores
          evento={evento}
          aoSalvar={async () => {
            atualizar();
            await recarregarEventos();
          }}
        />
      ) : (
        <section className="card px-5 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-pds-orange">
            Valores da reserva
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {(["LOUNGE", "BISTRO", "MESA"] as TipoUnidade[]).map((tipo) => (
              <Resumo
                key={tipo}
                titulo={tipo === "LOUNGE" ? "Lounge" : tipo === "BISTRO" ? "Bistrô" : "Mesa"}
                valor={formatarValorReserva(valorPadraoDoEvento(evento, tipo))}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-4 gap-2.5">
        <Resumo titulo="Lounges" valor={`${lounges.filter((u) => u.ocupado).length}/${lounges.length}`} />
        <Resumo titulo="Bistrôs" valor={`${bistros.filter((u) => u.ocupado).length}/${bistros.length}`} />
        <Resumo titulo="Mesas" valor={`${mesas.filter((u) => u.ocupado).length}/${mesas.length}`} />
        <Resumo titulo="Lista VIP" valor={String(vips.filter((v) => v.status !== "CANCELADO").length)} />
      </div>

      {ehAdmin ? (
        <button onClick={aplicarCroqui} disabled={salvando} className="btn-secundario w-full">
          <IconeMapa width={18} height={18} />
          Aplicar croqui do Soulbrado
        </button>
      ) : null}

      <Secao
        titulo="Lounges"
        Icone={IconeLounge}
        unidades={lounges}
        tipo="LOUNGE"
        ehAdmin={ehAdmin}
        aoAdicionar={() => setNovasUnidades("LOUNGE")}
        aoAtualizar={atualizar}
      />

      <Secao
        titulo="Bistrôs"
        Icone={IconeBistro}
        unidades={bistros}
        tipo="BISTRO"
        ehAdmin={ehAdmin}
        aoAdicionar={() => setNovasUnidades("BISTRO")}
        aoAtualizar={atualizar}
      />

      <Secao
        titulo="Mesas únicas"
        Icone={IconeMesa}
        unidades={mesas}
        tipo="MESA"
        ehAdmin={ehAdmin}
        aoAdicionar={() => setNovasUnidades("MESA")}
        aoAtualizar={atualizar}
      />

      {ehAdmin ? (
        <button onClick={apagarEvento} className="btn-perigo w-full">
          Apagar evento
        </button>
      ) : null}

      <Folha
        aberta={editarAberto}
        aoFechar={() => setEditarAberto(false)}
        titulo="Editar evento"
        subtitulo={evento.nome}
      >
        <FormularioEdicao
          evento={evento}
          aoSalvar={async () => {
            setEditarAberto(false);
            atualizar();
            await recarregarEventos();
          }}
        />
      </Folha>

      <Folha
        aberta={novasUnidades !== null}
        aoFechar={() => setNovasUnidades(null)}
        titulo={
          novasUnidades === "LOUNGE"
            ? "Adicionar lounges"
            : novasUnidades === "BISTRO"
              ? "Adicionar bistrôs"
              : "Adicionar mesas únicas"
        }
        subtitulo="A numeração continua a partir da última unidade."
      >
        {novasUnidades ? (
          <FormularioUnidades
            tipo={novasUnidades}
            eventoId={evento.id}
            valorPadrao={valorPadraoDoEvento(evento, novasUnidades)}
            aoSalvar={() => {
              setNovasUnidades(null);
              atualizar();
            }}
          />
        ) : null}
      </Folha>
    </div>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="card px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-pds-muted">{titulo}</p>
      <p className="mt-1 text-lg font-extrabold">{valor}</p>
    </div>
  );
}

function Secao({
  titulo,
  Icone,
  unidades,
  tipo,
  ehAdmin,
  aoAdicionar,
  aoAtualizar,
}: {
  titulo: string;
  Icone: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  unidades: UnidadeComReserva[];
  tipo: TipoUnidade;
  ehAdmin: boolean;
  aoAdicionar: () => void;
  aoAtualizar: () => void;
}) {
  const avisar = useToast();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function alternarBloqueio(unidade: UnidadeComReserva) {
    const bloqueado = (unidade.status ?? "").toUpperCase() === "BLOQUEADO";
    setOcupado(unidade.id);
    try {
      await api.patch(`/api/unidades/${unidade.id}?tipo=${tipo}`, {
        status: bloqueado ? "DISPONIVEL" : "BLOQUEADO",
      });
      avisar(bloqueado ? "Unidade liberada." : "Unidade bloqueada.");
      aoAtualizar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao atualizar.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function apagar(unidade: UnidadeComReserva) {
    if (!confirm(`Apagar ${titulo.slice(0, -1)} ${unidade.numero}?`)) return;
    setOcupado(unidade.id);
    try {
      await api.delete(`/api/unidades/${unidade.id}?tipo=${tipo}`);
      avisar("Unidade apagada.");
      aoAtualizar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Falha ao apagar.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-pds-line px-5 py-3.5">
        <Icone className="text-pds-orange" width={18} height={18} />
        <h2 className="flex-1 text-sm font-extrabold uppercase tracking-wider">{titulo}</h2>
        <span className="text-xs text-pds-muted">{unidades.length}</span>
        {ehAdmin ? (
          <button
            onClick={aoAdicionar}
            aria-label={`Adicionar ${titulo}`}
            className="rounded-lg bg-pds-orange/15 p-1.5 text-pds-orange transition hover:bg-pds-orange/25"
          >
            <IconeMais width={18} height={18} />
          </button>
        ) : null}
      </div>

      {unidades.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-pds-muted">
          Nenhuma unidade cadastrada neste evento.
        </p>
      ) : (
        <ul className="divide-y divide-pds-line">
          {unidades.map((u) => {
            const bloqueado = (u.status ?? "").toUpperCase() === "BLOQUEADO";
            return (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={classes(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold",
                    bloqueado
                      ? "border-white/10 bg-white/5 text-pds-muted"
                      : u.ocupado
                        ? "border-pds-orange bg-pds-orange/20"
                        : "border-pds-line bg-black/40",
                  )}
                >
                  {u.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {u.reserva ? u.reserva.nome_cliente : bloqueado ? "Bloqueado" : "Livre"}
                  </p>
                  <p className="truncate text-xs text-pds-muted">
                    até {u.capacidade || "?"} pessoas · {formatarValorReserva(u.valor)}
                  </p>
                </div>
                {ehAdmin ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      disabled={ocupado === u.id || u.ocupado}
                      onClick={() => alternarBloqueio(u)}
                      className="rounded-lg border border-pds-line px-2.5 py-1.5 text-[11px] font-bold text-pds-muted transition hover:text-white disabled:opacity-40"
                    >
                      {bloqueado ? "Liberar" : "Bloquear"}
                    </button>
                    <button
                      disabled={ocupado === u.id || u.ocupado}
                      onClick={() => apagar(u)}
                      className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Apagar
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Valor cobrado por tipo, definido no evento. Cortesia e' o padrao: o
 * interruptor desligado zera os tres de uma vez.
 */
function SecaoValores({ evento, aoSalvar }: { evento: Evento; aoSalvar: () => void | Promise<void> }) {
  const avisar = useToast();
  const inicial = {
    LOUNGE: valorPadraoDoEvento(evento, "LOUNGE"),
    BISTRO: valorPadraoDoEvento(evento, "BISTRO"),
    MESA: valorPadraoDoEvento(evento, "MESA"),
  };
  const jaCobra = Object.values(inicial).some((v) => Number(v) > 0);

  const [cobrando, setCobrando] = useState(jaCobra);
  const [valores, setValores] = useState<Record<TipoUnidade, string>>({
    LOUNGE: inicial.LOUNGE === "0" ? "" : inicial.LOUNGE,
    BISTRO: inicial.BISTRO === "0" ? "" : inicial.BISTRO,
    MESA: inicial.MESA === "0" ? "" : inicial.MESA,
  });
  const [aplicar, setAplicar] = useState(true);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const { unidadesAtualizadas } = await api.patch<{ unidadesAtualizadas: number }>(
        `/api/eventos/${evento.id}`,
        {
          valor_lounge: cobrando ? valores.LOUNGE || "0" : "0",
          valor_bistro: cobrando ? valores.BISTRO || "0" : "0",
          valor_mesa: cobrando ? valores.MESA || "0" : "0",
          aplicar_nas_unidades: aplicar,
        },
      );
      avisar(
        unidadesAtualizadas
          ? `Valores salvos e aplicados em ${unidadesAtualizadas} unidade(s).`
          : "Valores salvos.",
      );
      await aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao salvar os valores.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  const campos: { tipo: TipoUnidade; rotulo: string }[] = [
    { tipo: "LOUNGE", rotulo: "Lounge (R$)" },
    { tipo: "BISTRO", rotulo: "Bistrô (R$)" },
    { tipo: "MESA", rotulo: "Mesa única (R$)" },
  ];

  return (
    <form onSubmit={salvar} className="card space-y-3 px-5 py-4">
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-pds-orange">
          Valores da reserva
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-pds-muted">
          Define quanto cada tipo custa neste evento. Deixado como cortesia, o app mostra
          &quot;Gratuito&quot; em vez de preço.
        </p>
      </div>

      <Interruptor
        destaque
        rotulo="Cobrar por reserva"
        descricao={
          cobrando
            ? "Cada tipo abaixo tem o seu valor."
            : "Desligado: lounges, bistrôs e mesas saem como cortesia."
        }
        ativo={cobrando}
        aoMudar={setCobrando}
      />

      {cobrando ? (
        <div className="grid grid-cols-3 gap-2.5">
          {campos.map(({ tipo, rotulo }) => (
            <Campo
              key={tipo}
              rotulo={rotulo}
              value={valores[tipo]}
              onChange={(e) => setValores((v) => ({ ...v, [tipo]: e.target.value }))}
              inputMode="decimal"
              placeholder="0"
            />
          ))}
        </div>
      ) : null}

      <Interruptor
        rotulo="Aplicar nas unidades já cadastradas"
        descricao="Unidades com reserva ativa mantêm o valor combinado com o cliente."
        ativo={aplicar}
        aoMudar={setAplicar}
      />

      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Salvando..." : "Salvar valores"}
      </button>
    </form>
  );
}

function FormularioEdicao({ evento, aoSalvar }: { evento: Evento; aoSalvar: () => void }) {
  const avisar = useToast();
  const [form, setForm] = useState({
    nome: evento.nome,
    data: evento.data,
    hora_inicio: evento.hora_inicio,
    local: evento.local,
    status: evento.status,
    capacidade_lista_vip: evento.capacidade_lista_vip,
    prioridade_aniversariante_dias: evento.prioridade_aniversariante_dias,
    observacoes: evento.observacoes,
  });
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.patch(`/api/eventos/${evento.id}`, form);
      avisar("Evento atualizado.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao salvar.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo rotulo="Nome" value={form.nome} onChange={mudar("nome")} required />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data" type="date" value={form.data} onChange={mudar("data")} required />
        <Campo rotulo="Hora" type="time" value={form.hora_inicio} onChange={mudar("hora_inicio")} />
      </div>
      <Campo rotulo="Local" value={form.local} onChange={mudar("local")} />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Limite lista VIP"
          value={form.capacidade_lista_vip}
          onChange={mudar("capacidade_lista_vip")}
          inputMode="numeric"
        />
        <Campo
          rotulo="Prioridade (dias)"
          value={form.prioridade_aniversariante_dias}
          onChange={mudar("prioridade_aniversariante_dias")}
          inputMode="numeric"
        />
      </div>
      <Selecao rotulo="Status" value={form.status} onChange={mudar("status")}>
        <option value="ATIVO">Ativo</option>
        <option value="RASCUNHO">Rascunho</option>
        <option value="ENCERRADO">Encerrado</option>
      </Selecao>
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}

function FormularioUnidades({
  tipo,
  eventoId,
  valorPadrao,
  aoSalvar,
}: {
  tipo: TipoUnidade;
  eventoId: string;
  valorPadrao: string;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const [quantidade, setQuantidade] = useState("1");
  const [capacidade, setCapacidade] = useState(PADRAO_POR_TIPO[tipo].capacidade);
  const [valor, setValor] = useState(valorPadrao);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/api/unidades", {
        evento_id: eventoId,
        tipo,
        quantidade,
        capacidade,
        valor,
      });
      avisar(`${quantidade} unidade(s) criada(s).`);
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao criar.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo
        rotulo="Quantas unidades"
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        inputMode="numeric"
        dica="Máximo de 60 por vez."
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Capacidade"
          value={capacidade}
          onChange={(e) => setCapacidade(e.target.value)}
          inputMode="numeric"
        />
        <Campo
          rotulo="Valor (R$)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          dica="0 = cortesia"
        />
      </div>
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Criando..." : "Criar unidades"}
      </button>
    </form>
  );
}
