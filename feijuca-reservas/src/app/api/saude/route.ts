import { json } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/auth";
import { readTab, TABS } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostico de configuracao: usado pela tela de erro e no primeiro deploy. */
export async function GET() {
  const env = {
    GOOGLE_SHEET_ID: Boolean(process.env.GOOGLE_SHEET_ID),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    GOOGLE_PRIVATE_KEY: Boolean(process.env.GOOGLE_PRIVATE_KEY),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
  };

  const faltando = Object.entries(env)
    .filter(([, ok]) => !ok)
    .map(([nome]) => nome);

  if (faltando.length) {
    return json({ ok: false, env, faltando, planilha: null }, 500);
  }

  try {
    const usuarios = await readTab(TABS.usuarios, false);
    return json({ ok: true, env, faltando: [], planilha: { usuarios: usuarios.length } });
  } catch (error) {
    return json(
      {
        ok: false,
        env,
        faltando: [],
        planilha: null,
        erro: mensagemAmigavel(
          error instanceof Error ? error.message : "Falha ao ler a planilha.",
        ),
      },
      500,
    );
  }
}
