"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/contexto";
import { Campo, Esqueleto, Etiqueta, Folha, Selecao, Vazio, classes, useToast } from "@/components/ui";
import { IconeMais, IconeSeta } from "@/components/icones";
import { api } from "@/lib/cliente";
import { formatarData } from "@/lib/formato";
import { diasParaEvento } from "@/lib/regras";
import type { Evento } from "@/lib/types";

export default function PaginaEventos() {
  const { eventos, evento, carregando, ehAdmin, trocarEvento, recarregarEventos } = useApp();
  const [novoAberto, setNovoAberto] = useState(false);

  if (carregando) return <Esqueleto linhas={4} />;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold">Eventos</h1>
        <p className="text-sm text-pds-muted">
          Cada Feijuca tem lista, bistrôs e lounges independentes.
        </p>
      </header>

      {eventos.length === 0 ? (
        <Vazio
          titulo="Nenhum evento ainda"
          descricao={
            ehAdmin
              ? "Crie o primeiro evento para liberar as listas e o mapa de mesas."
              : "Peça a um administrador para cadastrar o próximo evento."
          }
        />
      ) : (
        <ul className="space-y-2">
          {eventos.map((e) => (
            <li key={e.id}>
              <Link
                href={`/eventos/${e.id}`}
                onClick={() => trocarEvento(e.id)}
                className={classes(
                  "card flex items-center gap-3 px-4 py-4 transition active:scale-[.99]",
                  e.id === evento?.id && "border-pds-orange/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{e.nome}</p>
                  <p className="mt-0.5 text-xs text-pds-muted">
                    {formatarData(e.data)}
                    {e.hora_inicio ? ` · ${e.hora_inicio}` : ""}
                    {e.local ? ` · ${e.local}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Etiqueta
                      cor={
                        e.status === "ATIVO" ? "verde" : e.status === "ENCERRADO" ? "cinza" : "azul"
                      }
                    >
                      {e.status}
                    </Etiqueta>
                    {e.status !== "ENCERRADO" ? (
                      <Etiqueta cor="laranja">{rotuloContagem(e)}</Etiqueta>
                    ) : null}
                    {e.id === evento?.id ? <Etiqueta cor="laranja">Selecionado</Etiqueta> : null}
                  </div>
                </div>
                <IconeSeta className="shrink-0 text-pds-muted" width={18} height={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {ehAdmin ? (
        <>
          <button
            onClick={() => setNovoAberto(true)}
            className="fixed bottom-[calc(5.5rem+var(--safe-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-pds-orange text-black shadow-glow transition active:scale-95"
            aria-label="Novo evento"
          >
            <IconeMais width={26} height={26} />
          </button>

          <Folha
            aberta={novoAberto}
            aoFechar={() => setNovoAberto(false)}
            titulo="Novo evento"
            subtitulo="Depois você cadastra os lounges e bistrôs."
          >
            <FormularioEvento
              aoSalvar={async (id) => {
                setNovoAberto(false);
                await recarregarEventos();
                trocarEvento(id);
              }}
            />
          </Folha>
        </>
      ) : null}
    </div>
  );
}

function rotuloContagem(evento: Evento) {
  const dias = diasParaEvento(evento);
  if (dias < 0) return "Já passou";
  if (dias === 0) return "É hoje";
  if (dias === 1) return "É amanhã";
  return `Faltam ${dias} dias`;
}

function FormularioEvento({ aoSalvar }: { aoSalvar: (id: string) => void | Promise<void> }) {
  const avisar = useToast();
  const [form, setForm] = useState({
    nome: "",
    data: "",
    hora_inicio: "14:00",
    local: "",
    capacidade_lista_vip: "",
    prioridade_aniversariante_dias: "1",
    status: "ATIVO",
  });
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const { evento } = await api.post<{ evento: Evento }>("/api/eventos", form);
      avisar("Evento criado.");
      await aoSalvar(evento.id);
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao criar evento.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo
        rotulo="Nome do evento *"
        value={form.nome}
        onChange={mudar("nome")}
        placeholder="Feijuca do Papo de Samba - Novembro"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data *" type="date" value={form.data} onChange={mudar("data")} required />
        <Campo rotulo="Hora" type="time" value={form.hora_inicio} onChange={mudar("hora_inicio")} />
      </div>
      <Campo rotulo="Local" value={form.local} onChange={mudar("local")} placeholder="Quadra / casa de shows" />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Limite da lista VIP"
          value={form.capacidade_lista_vip}
          onChange={mudar("capacidade_lista_vip")}
          inputMode="numeric"
          placeholder="sem limite"
        />
        <Campo
          rotulo="Prioridade (dias)"
          value={form.prioridade_aniversariante_dias}
          onChange={mudar("prioridade_aniversariante_dias")}
          inputMode="numeric"
          dica="Dias antes do evento em que o lounge libera geral."
        />
      </div>
      <Selecao rotulo="Status" value={form.status} onChange={mudar("status")}>
        <option value="ATIVO">Ativo</option>
        <option value="RASCUNHO">Rascunho</option>
        <option value="ENCERRADO">Encerrado</option>
      </Selecao>
      <p className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-3 text-xs leading-relaxed text-pds-muted">
        O evento nasce com lounges, bistrôs e mesas como <strong className="text-white">cortesia</strong>.
        Para cobrar, defina os valores depois em <strong className="text-white">Valores da reserva</strong>,
        na tela do evento.
      </p>
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Criando..." : "Criar evento"}
      </button>
    </form>
  );
}
