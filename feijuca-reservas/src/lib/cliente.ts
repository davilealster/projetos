"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function requisicao<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  let corpo: unknown = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }

  if (!resposta.ok) {
    const mensagem =
      (corpo as { erro?: string } | null)?.erro ??
      (resposta.status === 401
        ? "Sessao expirada. Entre novamente."
        : "Nao foi possivel completar a acao.");
    throw new ApiError(resposta.status, mensagem);
  }

  return corpo as T;
}

export const api = {
  get: <T>(url: string) => requisicao<T>(url),
  post: <T>(url: string, dados?: unknown) =>
    requisicao<T>(url, { method: "POST", body: JSON.stringify(dados ?? {}) }),
  patch: <T>(url: string, dados: unknown) =>
    requisicao<T>(url, { method: "PATCH", body: JSON.stringify(dados) }),
  delete: <T>(url: string) => requisicao<T>(url, { method: "DELETE" }),
};
