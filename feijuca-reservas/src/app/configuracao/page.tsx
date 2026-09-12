"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Saude {
  ok: boolean;
  env: Record<string, boolean>;
  faltando: string[];
  planilha: { usuarios: number } | null;
  erro?: string;
}

const EXPLICACAO: Record<string, string> = {
  GOOGLE_SHEET_ID: "ID da planilha no Google Drive (esta na URL da planilha).",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "E-mail da conta de servico do Google Cloud.",
  GOOGLE_PRIVATE_KEY: "Chave privada da conta de servico (arquivo JSON).",
  AUTH_SECRET: "Segredo para assinar o login. Gere um valor aleatorio longo.",
};

export default function PaginaConfiguracao() {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/api/saude", { cache: "no-store" })
      .then((r) => r.json())
      .then(setSaude)
      .catch(() => setSaude(null))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10">
      <h1 className="text-2xl font-extrabold">Diagnostico do app</h1>
      <p className="mt-1.5 text-sm text-pds-muted">
        Confere se as variaveis de ambiente estao no ar e se a planilha responde.
      </p>

      {carregando ? (
        <p className="mt-8 text-sm text-pds-muted">Verificando...</p>
      ) : !saude ? (
        <p className="mt-8 text-sm text-red-300">Nao foi possivel consultar o diagnostico.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {Object.entries(saude.env).map(([nome, ok]) => (
            <div key={nome} className="card px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className={ok ? "text-emerald-400" : "text-red-400"}>{ok ? "OK" : "X"}</span>
                <code className="text-sm font-bold">{nome}</code>
              </div>
              <p className="mt-1 text-xs text-pds-muted">{EXPLICACAO[nome]}</p>
            </div>
          ))}

          <div
            className={`card px-4 py-3.5 ${
              saude.planilha ? "border-emerald-500/35" : "border-red-500/35"
            }`}
          >
            <p className="text-sm font-bold">
              {saude.planilha
                ? `Planilha conectada (${saude.planilha.usuarios} usuarios cadastrados).`
                : "Planilha nao respondeu."}
            </p>
            {saude.erro ? (
              <p className="mt-1 break-words text-xs text-red-300">{saude.erro}</p>
            ) : null}
            {!saude.planilha && !saude.erro && saude.faltando.length ? (
              <p className="mt-1 text-xs text-pds-muted">
                Configure as variaveis acima na Vercel e faca um novo deploy.
              </p>
            ) : null}
          </div>
        </div>
      )}

      <Link href="/login" className="btn-secundario mt-8 w-full">
        Voltar para o login
      </Link>
    </main>
  );
}
