"use client";

import { useState } from "react";
import { useApp } from "@/components/contexto";
import { useDados } from "@/components/usar-dados";
import { SemEvento } from "@/components/aviso-sem-evento";
import {
  AreaTexto,
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Vazio,
  classes,
  useConfirmacao,
  useToast,
} from "@/components/ui";
import {
  IconeCheck,
  IconeCopiar,
  IconeLista,
  IconeMais,
  IconeWhatsapp,
} from "@/components/icones";
import { api } from "@/lib/cliente";
import { copiarTexto } from "@/lib/copiar";
import type { ListaPublica, StatusLista } from "@/lib/types";

type ListaComContagem = ListaPublica & { nomes: number; pessoas: number };

export default function PaginaListas() {
  const { evento, carregando: carregandoApp, ehAdmin, podeVender, atualizar } = useApp();
  const { dados, carregando, erro } = useDados<{ listas: ListaComContagem[] }>(
    evento && podeVender ? `/api/listas?evento_id=${evento.id}` : null,
  );
  const [novaAberta, setNovaAberta] = useState(false);
  const [aberta, setAberta] = useState<ListaComContagem | null>(null);

  if (!podeVender) {
    return (
      <Vazio
        titulo="Área restrita"
        descricao="Os links de lista ficam com o administrador e a equipe de vendas."
      />
    );
  }

  if (carregandoApp) return <Esqueleto linhas={4} />;
  if (!evento) return <SemEvento />;

  const listas = dados?.listas ?? [];
  const totalNomes = listas.reduce((t, l) => t + l.nomes, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold">Links de lista</h1>
        <p className="text-sm leading-relaxed text-pds-muted">
          Cada link é um formulário para alguém de fora mandar nomes. Quem abre o link não
          entra no app — só envia nomes para esta lista.
        </p>
      </header>

      {listas.length ? (
        <div className="card grid grid-cols-3 divide-x divide-pds-line">
          <Numero titulo="Listas" valor={String(listas.length)} />
          <Numero titulo="Nomes" valor={String(totalNomes)} />
          <Numero
            titulo="Pessoas"
            valor={String(listas.reduce((t, l) => t + l.pessoas, 0))}
          />
        </div>
      ) : null}

      {erro ? (
        <p className="card px-4 py-3 text-sm text-red-300">{erro}</p>
      ) : carregando ? (
        <Esqueleto linhas={3} />
      ) : listas.length === 0 ? (
        <Vazio
          titulo="Nenhum link ainda"
          descricao={
            ehAdmin
              ? "Crie um link por pessoa do grupo. Cada uma manda os nomes dela e tudo cai na mesma lista da portaria."
              : "Peça a um administrador para criar os links deste evento."
          }
        />
      ) : (
        <ul className="space-y-2">
          {listas.map((lista) => (
            <li key={lista.id}>
              <button
                onClick={() => setAberta(lista)}
                className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[.99]"
              >
                <span className="rounded-xl bg-pds-orange/15 p-2 text-pds-orange">
                  <IconeLista width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{lista.nome}</p>
                  <p className="truncate text-xs text-pds-muted">
                    {lista.nomes} nome{lista.nomes === 1 ? "" : "s"}
                    {lista.responsavel ? ` · ${lista.responsavel}` : ""}
                  </p>
                </div>
                <Etiqueta
                  cor={
                    lista.status === "ATIVA"
                      ? "verde"
                      : lista.status === "PAUSADA"
                        ? "laranja"
                        : "cinza"
                  }
                >
                  {lista.status}
                </Etiqueta>
              </button>
            </li>
          ))}
        </ul>
      )}

      {ehAdmin ? (
        <button
          onClick={() => setNovaAberta(true)}
          aria-label="Novo link de lista"
          className="fixed bottom-[calc(5.5rem+var(--safe-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-pds-orange text-black shadow-glow transition active:scale-95"
        >
          <IconeMais width={26} height={26} />
        </button>
      ) : null}

      <Folha
        aberta={novaAberta}
        aoFechar={() => setNovaAberta(false)}
        titulo="Novo link de lista"
        subtitulo={evento.nome}
      >
        <FormularioLista
          eventoId={evento.id}
          aoSalvar={() => {
            setNovaAberta(false);
            atualizar();
          }}
        />
      </Folha>

      {aberta ? (
        <Folha
          aberta
          aoFechar={() => setAberta(null)}
          titulo={aberta.nome}
          subtitulo={`${aberta.nomes} nome(s) recebido(s)`}
        >
          <DetalheLista
            lista={aberta}
            ehAdmin={ehAdmin}
            aoSalvar={() => {
              setAberta(null);
              atualizar();
            }}
          />
        </Folha>
      ) : null}
    </div>
  );
}

function Numero({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-pds-muted">{titulo}</p>
      <p className="mt-1 text-lg font-extrabold">{valor}</p>
    </div>
  );
}

function enderecoDoLink(token: string): string {
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/lista/${token}`;
}

function FormularioLista({
  eventoId,
  aoSalvar,
}: {
  eventoId: string;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const [form, setForm] = useState({
    nome: "",
    responsavel: "",
    limite_nomes: "",
    instrucoes: "",
  });
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/api/listas", { ...form, evento_id: eventoId });
      avisar("Link criado. Agora é só compartilhar.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao criar o link.", "erro");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo
        rotulo="Nome da lista *"
        value={form.nome}
        onChange={mudar("nome")}
        placeholder="Lista do Davi"
        dica="É como a equipe vai reconhecer os nomes na portaria."
        required
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Responsável"
          value={form.responsavel}
          onChange={mudar("responsavel")}
          placeholder="Davi"
        />
        <Campo
          rotulo="Limite de nomes"
          value={form.limite_nomes}
          onChange={mudar("limite_nomes")}
          inputMode="numeric"
          placeholder="sem limite"
        />
      </div>
      <AreaTexto
        rotulo="Recado para quem abrir o link"
        value={form.instrucoes}
        onChange={mudar("instrucoes")}
        placeholder="Nome completo, por favor. A lista fecha às 22h do dia do evento."
      />
      <button type="submit" disabled={enviando} className="btn-primario w-full">
        {enviando ? "Criando..." : "Criar link"}
      </button>
    </form>
  );
}

function DetalheLista({
  lista,
  ehAdmin,
  aoSalvar,
}: {
  lista: ListaComContagem;
  ehAdmin: boolean;
  aoSalvar: () => void;
}) {
  const avisar = useToast();
  const confirmar = useConfirmacao();
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const endereco = enderecoDoLink(lista.token);
  const convite =
    `Bora colocar nome na lista da ${lista.nome}? ` +
    `É só abrir e escrever os nomes:\n${endereco}`;

  async function copiar() {
    if (await copiarTexto(endereco)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } else {
      avisar("Seu navegador bloqueou a cópia. Segure no link para copiar.", "erro");
    }
  }

  async function mudarStatus(status: StatusLista, mensagem: string) {
    setOcupado(true);
    try {
      await api.patch(`/api/listas/${lista.id}`, { status });
      avisar(mensagem);
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao atualizar.", "erro");
      setOcupado(false);
    }
  }

  async function novoToken() {
    const certeza = await confirmar({
      titulo: "Gerar um link novo?",
      descricao:
        "O endereço atual para de funcionar na hora. Quem já tiver o link antigo precisa receber o novo. Os nomes já enviados continuam na lista.",
      confirmar: "Gerar novo link",
      perigo: true,
    });
    if (!certeza) return;
    setOcupado(true);
    try {
      await api.patch(`/api/listas/${lista.id}`, { novo_token: true });
      avisar("Link novo gerado. Compartilhe de novo com a pessoa.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao gerar.", "erro");
      setOcupado(false);
    }
  }

  async function apagar() {
    const certeza = await confirmar({
      titulo: `Apagar o link "${lista.nome}"?`,
      descricao: "Só funciona se ainda não tiver recebido nenhum nome.",
      confirmar: "Apagar",
      perigo: true,
    });
    if (!certeza) return;
    setOcupado(true);
    try {
      await api.delete(`/api/listas/${lista.id}`);
      avisar("Link apagado.");
      aoSalvar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao apagar.", "erro");
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta
          cor={lista.status === "ATIVA" ? "verde" : lista.status === "PAUSADA" ? "laranja" : "cinza"}
        >
          {lista.status}
        </Etiqueta>
        {lista.limite_nomes && Number(lista.limite_nomes) > 0 ? (
          <Etiqueta cor="cinza">limite {lista.limite_nomes}</Etiqueta>
        ) : null}
      </div>

      <div className="rounded-xl border border-pds-line bg-black/40 px-3.5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-pds-muted">
          Link para compartilhar
        </p>
        <p className="mt-1 break-all font-mono text-xs text-white/85">{endereco}</p>
      </div>

      <div className="grid gap-2">
        <button
          onClick={copiar}
          className={classes("btn w-full", copiado ? "bg-emerald-500 text-black" : "btn-secundario")}
        >
          {copiado ? (
            <>
              <IconeCheck width={18} height={18} /> Link copiado
            </>
          ) : (
            <>
              <IconeCopiar width={18} height={18} /> Copiar link
            </>
          )}
        </button>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(convite)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-secundario w-full"
        >
          <IconeWhatsapp width={18} height={18} /> Enviar pelo WhatsApp
        </a>

        {ehAdmin ? (
          <>
            {lista.status === "ATIVA" ? (
              <button
                disabled={ocupado}
                onClick={() => mudarStatus("PAUSADA", "Lista pausada. O link para de aceitar nomes.")}
                className="btn-secundario w-full"
              >
                Pausar envios
              </button>
            ) : lista.status === "PAUSADA" ? (
              <button
                disabled={ocupado}
                onClick={() => mudarStatus("ATIVA", "Lista reaberta.")}
                className="btn-secundario w-full"
              >
                Reabrir envios
              </button>
            ) : null}

            {lista.status !== "ENCERRADA" ? (
              <button
                disabled={ocupado}
                onClick={() => mudarStatus("ENCERRADA", "Lista encerrada.")}
                className="btn-secundario w-full"
              >
                Encerrar lista
              </button>
            ) : (
              <button
                disabled={ocupado}
                onClick={() => mudarStatus("ATIVA", "Lista reaberta.")}
                className="btn-secundario w-full"
              >
                Reabrir lista
              </button>
            )}

            <button disabled={ocupado} onClick={novoToken} className="btn-secundario w-full">
              Gerar link novo
            </button>
            <button disabled={ocupado} onClick={apagar} className="btn-perigo w-full">
              Apagar link
            </button>
          </>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-pds-muted">
        Os nomes recebidos aparecem na Lista VIP com o promoter{" "}
        <span className="font-bold text-white">{lista.responsavel || lista.nome}</span>.
      </p>
    </div>
  );
}
