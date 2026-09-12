"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { IconeAlerta, IconeCheck, IconeFechar } from "./icones";

/* --------------------------------- Toast -------------------------------- */

type Aviso = { id: number; texto: string; tipo: "ok" | "erro" };

const ToastCtx = createContext<(texto: string, tipo?: Aviso["tipo"]) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((atual) => [...atual, { id, texto, tipo }]);
    setTimeout(() => setAvisos((atual) => atual.filter((a) => a.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] z-[70] flex flex-col items-center gap-2 px-4">
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            role="status"
            className={`animate-fade-up flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${
              aviso.tipo === "ok"
                ? "border-pds-orange/40 bg-black/90 text-white"
                : "border-red-500/50 bg-red-950/90 text-red-100"
            }`}
          >
            {aviso.tipo === "ok" ? (
              <IconeCheck className="mt-0.5 shrink-0 text-pds-orange" width={18} height={18} />
            ) : (
              <IconeAlerta className="mt-0.5 shrink-0" width={18} height={18} />
            )}
            <span>{aviso.texto}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ Bottom sheet ----------------------------- */

export function Folha({
  aberta,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", escape);
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        aria-label="Fechar"
        onClick={aoFechar}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />
      <div className="animate-fade-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-pds-line bg-pds-ink sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-pds-line px-5 pb-4 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold">{titulo}</h2>
            {subtitulo ? <p className="mt-0.5 text-sm text-pds-muted">{subtitulo}</p> : null}
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mr-1 -mt-1 rounded-full p-2 text-pds-muted transition hover:bg-white/5 hover:text-white"
          >
            <IconeFechar width={20} height={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape ? (
          <div className="border-t border-pds-line bg-black/40 px-5 py-4 pb-[calc(1rem+var(--safe-bottom))]">
            {rodape}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------- Campos -------------------------------- */

export function Campo({
  rotulo,
  dica,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <input className="campo" {...props} />
      {dica ? <span className="mt-1 block text-xs text-pds-muted">{dica}</span> : null}
    </label>
  );
}

export function AreaTexto({
  rotulo,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string }) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <textarea className="campo min-h-[84px] resize-y" {...props} />
    </label>
  );
}

export function Selecao({
  rotulo,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <select className="campo appearance-none" {...props}>
        {children}
      </select>
    </label>
  );
}

export function Interruptor({
  rotulo,
  descricao,
  ativo,
  aoMudar,
  destaque,
}: {
  rotulo: string;
  descricao?: string;
  ativo: boolean;
  aoMudar: (valor: boolean) => void;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => aoMudar(!ativo)}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        ativo
          ? destaque
            ? "border-pds-orange bg-pds-orange/15"
            : "border-pds-orange/60 bg-pds-orange/10"
          : "border-pds-line bg-black/50"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{rotulo}</span>
        {descricao ? <span className="mt-0.5 block text-xs text-pds-muted">{descricao}</span> : null}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          ativo ? "bg-pds-orange" : "bg-pds-line"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            ativo ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

/* -------------------------------- Diversos ------------------------------- */

export function Etiqueta({
  cor = "cinza",
  children,
}: {
  cor?: "laranja" | "verde" | "cinza" | "vermelho" | "azul";
  children: React.ReactNode;
}) {
  const cores = {
    laranja: "bg-pds-orange/20 text-pds-orangeSoft ring-1 ring-inset ring-pds-orange/40",
    verde: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/35",
    cinza: "bg-white/10 text-pds-muted ring-1 ring-inset ring-white/10",
    vermelho: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/35",
    azul: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/35",
  } as const;
  return <span className={`etiqueta ${cores[cor]}`}>{children}</span>;
}

export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-base font-bold">{titulo}</p>
      <p className="max-w-xs text-sm text-pds-muted">{descricao}</p>
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  );
}

export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

export function useDebounce<T>(valor: T, atraso = 300): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), atraso);
    return () => clearTimeout(timer);
  }, [valor, atraso]);
  return debounced;
}

export function useMounted() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado;
}

export function classes(...valores: (string | false | null | undefined)[]) {
  return valores.filter(Boolean).join(" ");
}

export function useTitulo(titulo: string) {
  return useMemo(() => titulo, [titulo]);
}
