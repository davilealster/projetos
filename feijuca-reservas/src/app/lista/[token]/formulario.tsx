"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/cliente";
import { IconeAlerta, IconeCheck, IconeLista } from "@/components/icones";

interface Dados {
  evento: { nome: string; data: string; hora_inicio: string; local: string };
  lista: {
    nome: string;
    responsavel: string;
    instrucoes: string;
    limite: number;
    restam: number | null;
  };
  nomes: string[];
  fechada: string | null;
  limitePorEnvio: number;
}

interface Resultado {
  adicionados: string[];
  repetidos: string[];
  total: number;
}

export function FormularioLista({ token }: { token: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviadoPor, setEnviadoPor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await api.get<Dados>(`/api/publico/lista/${encodeURIComponent(token)}`));
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : "Não foi possível abrir esta lista.");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await api.post<Resultado>(
        `/api/publico/lista/${encodeURIComponent(token)}`,
        { texto, enviado_por: enviadoPor },
      );
      setResultado(resposta);
      setTexto("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  if (erroCarga) {
    return (
      <Moldura>
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <IconeAlerta className="text-pds-orange" width={28} height={28} />
          <p className="text-base font-bold">{erroCarga}</p>
          <p className="text-sm text-pds-muted">
            Confira o link com quem te enviou. Cada lista tem um endereço próprio.
          </p>
        </div>
      </Moldura>
    );
  }

  if (!dados) {
    return (
      <Moldura>
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </Moldura>
    );
  }

  const contagem = dados.nomes.length;

  return (
    <Moldura>
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-pds-orange/25 via-pds-orange/5 to-transparent px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pds-orange">
            Lista da portaria
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight">{dados.evento.nome}</h1>
          <p className="mt-1 text-sm text-pds-muted">
            {dados.evento.data}
            {dados.evento.hora_inicio ? ` · ${dados.evento.hora_inicio}` : ""}
          </p>
          {dados.evento.local ? (
            <p className="text-sm text-pds-muted">{dados.evento.local}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5 border-t border-pds-line px-5 py-3.5">
          <IconeLista className="shrink-0 text-pds-orange" width={18} height={18} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{dados.lista.nome}</p>
            {dados.lista.responsavel ? (
              <p className="truncate text-xs text-pds-muted">
                Responsável: {dados.lista.responsavel}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs font-bold text-pds-muted">
            {contagem}
            {dados.lista.limite > 0 ? `/${dados.lista.limite}` : ""}
          </span>
        </div>
      </section>

      {dados.lista.instrucoes ? (
        <p className="card px-4 py-3 text-sm leading-relaxed text-white/85">
          {dados.lista.instrucoes}
        </p>
      ) : null}

      {resultado ? (
        <section className="card border-emerald-500/40 bg-emerald-500/5 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-300">
            <IconeCheck width={18} height={18} />
            {resultado.adicionados.length === 0
              ? "Nada novo para incluir"
              : `${resultado.adicionados.length} nome${
                  resultado.adicionados.length === 1 ? "" : "s"
                } na lista!`}
          </p>
          {resultado.adicionados.length ? (
            <p className="mt-1.5 text-sm leading-relaxed text-white/85">
              {resultado.adicionados.join(", ")}
            </p>
          ) : null}
          {resultado.repetidos.length ? (
            <p className="mt-2 text-xs leading-relaxed text-pds-muted">
              Já estavam na lista: {resultado.repetidos.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {dados.fechada ? (
        <section className="card flex items-start gap-3 border-pds-orange/40 bg-pds-orange/5 px-4 py-4">
          <IconeAlerta className="mt-0.5 shrink-0 text-pds-orange" width={20} height={20} />
          <div>
            <p className="text-sm font-bold">{dados.fechada}</p>
            <p className="mt-0.5 text-xs text-pds-muted">
              Os nomes já enviados continuam valendo. Fale com {dados.lista.responsavel || "a organização"} se precisar incluir mais alguém.
            </p>
          </div>
        </section>
      ) : (
        <form onSubmit={enviar} className="card space-y-4 p-5">
          <label className="block">
            <span className="rotulo">Nomes — um por linha</span>
            <textarea
              className="campo min-h-[180px] resize-y"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={"Ana Silva\nBruno Costa\nCarla Dias"}
              required
            />
            <span className="mt-1 block text-xs text-pds-muted">
              Pode colar a lista do WhatsApp direto: numeração e travessão são removidos.
              Até {dados.limitePorEnvio} nomes por envio.
              {dados.lista.restam !== null ? ` Ainda cabem ${dados.lista.restam} nesta lista.` : ""}
            </span>
          </label>

          <label className="block">
            <span className="rotulo">Seu nome (opcional)</span>
            <input
              className="campo"
              value={enviadoPor}
              onChange={(e) => setEnviadoPor(e.target.value)}
              placeholder="para a portaria saber quem indicou"
            />
          </label>

          {erro ? (
            <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-200">
              <IconeAlerta className="mt-0.5 shrink-0" width={16} height={16} />
              {erro}
            </p>
          ) : null}

          <button type="submit" disabled={enviando} className="btn-primario w-full">
            {enviando ? "Enviando..." : "Enviar nomes"}
          </button>
        </form>
      )}

      {contagem > 0 ? (
        <section className="card overflow-hidden">
          <header className="border-b border-pds-line px-4 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              Nomes desta lista ({contagem})
            </h2>
          </header>
          <ol className="divide-y divide-pds-line">
            {dados.nomes.map((nome, i) => (
              <li key={`${nome}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-pds-muted">
                  {i + 1}
                </span>
                <span className="truncate text-sm">{nome}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-pds-muted">
        Esta página serve apenas para enviar nomes para a lista da portaria.
        Para tirar um nome, fale com {dados.lista.responsavel || "a organização"}.
      </p>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center">
        <Image
          src="/logo.jpg"
          alt="Família Papo de Samba"
          width={72}
          height={72}
          priority
          className="h-18 w-18 rounded-full ring-1 ring-pds-orange/50"
          style={{ height: "4.5rem", width: "4.5rem" }}
        />
      </div>
      {children}
    </main>
  );
}
