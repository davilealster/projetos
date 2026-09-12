import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "./session";
import { readTab, TABS } from "./sheets";
import { conferirSenha } from "./senha";
import type { Papel, SessionUser, Usuario } from "./types";

export { conferirSenha, hashSenha } from "./senha";

export async function autenticar(usuario: string, senha: string): Promise<SessionUser | null> {
  const usuarios = await readTab<Usuario>(TABS.usuarios, false);
  const encontrado = usuarios.find(
    (u) => u.usuario.trim().toLowerCase() === usuario.trim().toLowerCase(),
  );
  if (!encontrado) return null;
  if ((encontrado.ativo ?? "").toUpperCase() !== "SIM") return null;
  if (!conferirSenha(senha, encontrado.senha_hash)) return null;
  return {
    id: encontrado.id,
    nome: encontrado.nome,
    usuario: encontrado.usuario,
    papel: (encontrado.papel as Papel) ?? "VENDAS",
  };
}

/** Sessao atual em Server Components e Route Handlers. */
export async function sessaoAtual(): Promise<SessionUser | null> {
  return verifySession(cookies().get(COOKIE_NAME)?.value);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Exige sessao valida; opcionalmente restringe por papel. */
export async function exigirSessao(papeis?: Papel[]): Promise<SessionUser> {
  const user = await sessaoAtual();
  if (!user) throw new HttpError(401, "Sessao expirada. Entre novamente.");
  if (papeis && !papeis.includes(user.papel)) {
    throw new HttpError(403, "Seu perfil nao tem permissao para esta acao.");
  }
  return user;
}

/** Traduz erros tecnicos do Google em instrucoes acionaveis. */
export function mensagemAmigavel(bruta: string): string {
  if (/DECODER routines|PEM|asn1|Invalid keyData/i.test(bruta)) {
    return "A chave GOOGLE_PRIVATE_KEY esta invalida. Cole o valor do campo private_key do JSON inteiro, com aspas e os \\n.";
  }
  if (/invalid_grant|Invalid JWT|unauthorized_client/i.test(bruta)) {
    return "O Google recusou as credenciais. Confira GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.";
  }
  if (/permission|PERMISSION_DENIED|caller does not have/i.test(bruta)) {
    return "Sem permissao na planilha. Compartilhe a planilha com o e-mail da conta de servico como Editor.";
  }
  if (/Requested entity was not found|notFound/i.test(bruta)) {
    return "Planilha nao encontrada. Confira o GOOGLE_SHEET_ID.";
  }
  if (/Unable to parse range/i.test(bruta)) {
    return "Uma aba da planilha nao foi encontrada. As abas precisam se chamar Eventos, Lounges, Bistros, Reservas, ListaVip, Usuarios, Config e Log.";
  }
  if (/Sheets API has not been used|accessNotConfigured/i.test(bruta)) {
    return "A Google Sheets API nao esta habilitada no projeto do Google Cloud.";
  }
  return bruta;
}

export function erroResposta(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ erro: error.message }, { status: error.status });
  }
  const bruta = error instanceof Error ? error.message : "Erro inesperado.";
  console.error("[api]", error);
  return NextResponse.json({ erro: mensagemAmigavel(bruta) }, { status: 500 });
}
