"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/cliente";
import { useApp } from "./contexto";

/** Busca dados da API e refaz o fetch quando a versao global muda. */
export function useDados<T>(url: string | null) {
  const { versao } = useApp();
  const router = useRouter();
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(Boolean(url));
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!url) {
      setDados(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setDados(await api.get<T>(url));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setCarregando(false);
    }
  }, [url, router]);

  useEffect(() => {
    void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, versao]);

  return { dados, carregando, erro, recarregar: buscar };
}
