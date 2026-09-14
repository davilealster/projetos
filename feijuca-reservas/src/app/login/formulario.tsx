"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/lib/cliente";
import { IconeAlerta } from "@/components/icones";

export function FormularioLogin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/api/auth/login", { usuario, senha });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo.jpg"
            alt="Família Papo de Samba"
            width={132}
            height={132}
            priority
            className="h-32 w-32 rounded-full ring-2 ring-pds-orange/60 shadow-glow"
          />
          <h1 className="mt-6 text-2xl font-extrabold leading-tight">
            Feijuca do <span className="text-pds-orange">Papo de Samba</span>
          </h1>
          <p className="mt-1.5 text-sm text-pds-muted">
            Lista VIP, bistrôs e lounges em um lugar só.
          </p>
        </div>

        <form onSubmit={enviar} className="card space-y-4 p-5">
          <label className="block">
            <span className="rotulo">Usuário</span>
            <input
              className="campo"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="seu login"
              required
            />
          </label>

          <label className="block">
            <span className="rotulo">Senha</span>
            <input
              className="campo"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          {erro ? (
            <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-200">
              <IconeAlerta className="mt-0.5 shrink-0" width={16} height={16} />
              {erro}
            </p>
          ) : null}

          <button type="submit" disabled={enviando} className="btn-primario w-full">
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-pds-muted">
          Problemas para entrar? Fale com o administrador da Família PDS ou abra o{" "}
          <a href="/configuracao" className="font-bold text-pds-orange underline">
            diagnóstico
          </a>
          .
        </p>
      </div>
    </main>
  );
}
