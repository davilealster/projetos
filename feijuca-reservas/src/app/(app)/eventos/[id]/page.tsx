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
import { IconeBistro, IconeLounge, IconeMais } from "@/components/icones";
import { api } from "@/lib/cliente";
import { formatarData, formatarMoeda } from "@/lib/formato";
import type { StatusPrioridade } from "@/lib/regras";
import type { Evento, TipoUnidade, UnidadeComReserva, Vip } from "@/lib/types";

interface Detalhe {
  evento: Evento;
  prioridadeLounge: StatusPrioridade;
  lounges: UnidadeComReserva[];
  bistros: UnidadeComReserva[];
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

  const { evento, prioridadeLounge, lounges, bistros, vips } = dados;
  const loungesLivres = lounges.filter((u) => !u.ocupado).length;

  async function alternarLiberacao(valor: boolean) {
    setSalvando(true);
    try {
      await api.patch(`/api/eventos/${id}`, { lounges_liberados: valor ? "SIM" : "NAO" });
      avisar(
        valor
          ? "Lounges liberados para nao aniversariantes."
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

  async function apagarEvento() {
    if (!confirm(`Apagar o evento "${evento.nome}"? So' funciona se nao houver reservas.`)) return;
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
            descricao="Use quando faltarem lounges para vender e o prazo ainda nao chegou."
            ativo={evento.lounges_liberados === "SIM"}
            aoMudar={(v) => !salvando && alternarLiberacao(v)}
          />
        ) : null}
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Resumo titulo="Lounges" valor={`${lounges.filter((u) => u.ocupado).length}/${lounges.length}`} />
        <Resumo titulo="Bistros" valor={`${bistros.filter((u) => u.ocupado).length}/${bistros.length}`} />
        <Resumo titulo="Lista VIP" valor={String(vips.filter((v) => v.status !== "CANCELADO").length)} />
      </div>

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
        titulo="Bistros"
        Icone={IconeBistro}
        unidades={bistros}
        tipo="BISTRO"
        ehAdmin={ehAdmin}
        aoAdicionar={() => setNovasUnidades("BISTRO")}
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
        titulo={novasUnidades === "LOUNGE" ? "Adicionar lounges" : "Adicionar bistros"}
        subtitulo="A numeracao continua a partir da ultima unidade."
      >
        {novasUnidades ? (
          <FormularioUnidades
            tipo={novasUnidades}
            eventoId={evento.id}
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
                    ate {u.capacidade || "?"} pessoas · {formatarMoeda(u.valor)}
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
        {enviando ? "Salvando..." : "Salvar alteracoes"}
      </button>
    </form>
  );
}

function FormularioUnidades({
  tipo,
  eventoId,
  aoSalvar,
}: {
  tipo: TipoUnidade;
  eventoId: string;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const [quantidade, setQuantidade] = useState("1");
  const [capacidade, setCapacidade] = useState(tipo === "LOUNGE" ? "8" : "4");
  const [valor, setValor] = useState("");
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
        dica="Maximo de 60 por vez."
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
        />
      </div>
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Criando..." : "Criar unidades"}
      </button>
    </form>
  );
}
