"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/cliente";
import { pode, type Capacidade } from "@/lib/permissoes";
import type { Evento, SessionUser } from "@/lib/types";

const CHAVE_EVENTO = "pds:evento";

interface AppCtx {
  usuario: SessionUser | null;
  eventos: Evento[];
  evento: Evento | null;
  carregando: boolean;
  erro: string | null;
  trocarEvento: (id: string) => void;
  recarregarEventos: () => Promise<void>;
  /** Muda quando algo e' criado/editado; telas usam para refazer o fetch. */
  versao: number;
  atualizar: () => void;
  ehAdmin: boolean;
  /** Capacidade do papel logado; mesma matriz que as rotas usam. */
  pode: (capacidade: Capacidade) => boolean;
  podeReservar: boolean;
  podeVerVip: boolean;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp precisa estar dentro de <AppProvider>.");
  return ctx;
}

export function AppProvider({
  usuario,
  children,
}: {
  usuario: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const recarregarEventos = useCallback(async () => {
    try {
      setErro(null);
      const { eventos: lista } = await api.get<{ eventos: Evento[] }>("/api/eventos");
      setEventos(lista);

      const salvo = typeof window !== "undefined" ? localStorage.getItem(CHAVE_EVENTO) : null;
      const valido = lista.find((e) => e.id === salvo);
      const preferido =
        valido ?? lista.find((e) => e.status === "ATIVO") ?? lista[0] ?? null;
      setEventoId(preferido?.id ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      setErro(e instanceof Error ? e.message : "Falha ao carregar eventos.");
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    void recarregarEventos();
  }, [recarregarEventos]);

  const trocarEvento = useCallback((id: string) => {
    setEventoId(id);
    try {
      localStorage.setItem(CHAVE_EVENTO, id);
    } catch {
      // modo privado do navegador: seguimos so' com o estado em memoria
    }
    setVersao((v) => v + 1);
  }, []);

  const valor = useMemo<AppCtx>(
    () => ({
      usuario,
      eventos,
      evento: eventos.find((e) => e.id === eventoId) ?? null,
      carregando,
      erro,
      trocarEvento,
      recarregarEventos,
      versao,
      atualizar: () => setVersao((v) => v + 1),
      ehAdmin: usuario.papel === "ADMIN",
      pode: (capacidade: Capacidade) => pode(usuario.papel, capacidade),
      podeReservar: pode(usuario.papel, "reservas"),
      podeVerVip: pode(usuario.papel, "verVip"),
    }),
    [usuario, eventos, eventoId, carregando, erro, trocarEvento, recarregarEventos, versao],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
