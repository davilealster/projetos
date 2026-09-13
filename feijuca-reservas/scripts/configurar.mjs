#!/usr/bin/env node
/**
 * Configura o app a partir do JSON da conta de servico do Google.
 *
 *   npm run configurar -- ~/Downloads/feijuca-pds-xxxx.json
 *
 * O script valida o arquivo, escreve o .env.local, testa a conexao com a
 * planilha e imprime as variaveis prontas para colar na Vercel.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

const SHEET_ID_PADRAO = "1hn1MswrZH6yq0BXsUU7rPBGdRf9u6DIZxtrfPLohk6k";
const ABAS = ["Eventos", "Lounges", "Bistros", "Reservas", "ListaVip", "Usuarios", "Config", "Log"];

const cor = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  erro: (t) => `\x1b[31m${t}\x1b[0m`,
  aviso: (t) => `\x1b[33m${t}\x1b[0m`,
  forte: (t) => `\x1b[1m${t}\x1b[0m`,
  fraco: (t) => `\x1b[2m${t}\x1b[0m`,
};

function abortar(titulo, ...linhas) {
  console.error(`\n${cor.erro("x")} ${cor.forte(titulo)}\n`);
  for (const linha of linhas) console.error(`  ${linha}`);
  console.error("");
  process.exit(1);
}

/* ----------------------------- 1. Ler o JSON ---------------------------- */

const caminho = process.argv[2];
if (!caminho) {
  abortar(
    "Informe o caminho do JSON da conta de servico.",
    "Exemplo: npm run configurar -- ~/Downloads/feijuca-pds-a1b2c3.json",
  );
}

const arquivo = resolve(caminho);
if (!existsSync(arquivo)) abortar(`Arquivo nao encontrado: ${arquivo}`);

let credencial;
try {
  credencial = JSON.parse(readFileSync(arquivo, "utf8"));
} catch {
  abortar("O arquivo nao e' um JSON valido.", `Caminho: ${arquivo}`);
}

/* --------------------------- 2. Validar o tipo -------------------------- */

if (credencial.web || credencial.installed) {
  const bloco = credencial.web ?? credencial.installed;
  abortar(
    "Este e' um JSON de Cliente OAuth, nao de conta de servico.",
    `Projeto detectado: ${cor.forte(bloco.project_id ?? "?")}`,
    "",
    "O app precisa de uma CONTA DE SERVICO (funciona sozinho, sem ninguem logar).",
    "No mesmo projeto do Google Cloud:",
    "",
    "  1. Credenciais -> Criar credenciais -> Conta de servico",
    "  2. Abra a conta criada -> aba Chaves -> Adicionar chave -> Criar nova chave -> JSON",
    "  3. Rode este comando de novo apontando para o arquivo baixado",
    "",
    cor.aviso("Depois pode apagar este cliente OAuth: o app nao usa ele."),
  );
}

if (credencial.type !== "service_account") {
  abortar(
    "O JSON nao parece ser de uma conta de servico.",
    'Esperava um arquivo com "type": "service_account".',
  );
}

for (const campo of ["client_email", "private_key"]) {
  if (!credencial[campo]) abortar(`O JSON nao tem o campo "${campo}".`);
}

if (!credencial.private_key.includes("BEGIN PRIVATE KEY")) {
  abortar("O campo private_key do JSON esta truncado ou corrompido.");
}

console.log(`\n${cor.ok("ok")} Conta de servico: ${cor.forte(credencial.client_email)}`);
console.log(`   Projeto: ${credencial.project_id ?? "?"}`);

/* ------------------------ 3. Montar as variaveis ------------------------ */

const sheetId = process.env.GOOGLE_SHEET_ID || SHEET_ID_PADRAO;

// Reaproveita o AUTH_SECRET que ja existir, para nao deslogar todo mundo.
let authSecret = randomBytes(32).toString("base64");
const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  const atual = readFileSync(envLocal, "utf8");
  const achado = /^AUTH_SECRET=(.*)$/m.exec(atual);
  if (achado?.[1]) {
    authSecret = achado[1].replace(/^["']|["']$/g, "");
    console.log(`${cor.ok("ok")} AUTH_SECRET existente reaproveitado.`);
  }
  copyFileSync(envLocal, `${envLocal}.bak`);
  console.log(`${cor.fraco("   .env.local anterior salvo em .env.local.bak")}`);
}

const chaveEscapada = credencial.private_key.replace(/\n/g, "\\n");
const variaveis = {
  GOOGLE_SHEET_ID: sheetId,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: credencial.client_email,
  GOOGLE_PRIVATE_KEY: chaveEscapada,
  AUTH_SECRET: authSecret,
};

writeFileSync(
  envLocal,
  `# Gerado por "npm run configurar" em ${new Date().toISOString()}\n` +
    `GOOGLE_SHEET_ID=${variaveis.GOOGLE_SHEET_ID}\n` +
    `GOOGLE_SERVICE_ACCOUNT_EMAIL=${variaveis.GOOGLE_SERVICE_ACCOUNT_EMAIL}\n` +
    `GOOGLE_PRIVATE_KEY="${variaveis.GOOGLE_PRIVATE_KEY}"\n` +
    `AUTH_SECRET=${variaveis.AUTH_SECRET}\n`,
  { mode: 0o600 },
);
console.log(`${cor.ok("ok")} .env.local escrito.`);

/* -------------------------- 4. Testar a planilha ------------------------ */

console.log("\nTestando a conexao com a planilha...");

const sheets = google.sheets({
  version: "v4",
  auth: new JWT({
    email: credencial.client_email,
    key: credencial.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }),
});

let leituraOk = false;
try {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "properties.title,sheets.properties.title",
  });
  const titulo = meta.data.properties?.title ?? "?";
  const abas = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);

  console.log(`${cor.ok("ok")} Planilha lida: ${cor.forte(titulo)}`);

  const faltando = ABAS.filter((a) => !abas.includes(a));
  if (faltando.length) {
    console.log(`${cor.erro("x")}  Abas faltando: ${faltando.join(", ")}`);
  } else {
    console.log(`${cor.ok("ok")} Todas as 8 abas encontradas.`);
  }

  const usuarios = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Usuarios!A2:C",
  });
  const logins = (usuarios.data.values ?? []).map((l) => l[2]).filter(Boolean);
  console.log(`${cor.ok("ok")} ${logins.length} usuario(s) cadastrado(s): ${logins.join(", ")}`);
  leituraOk = true;
} catch (erro) {
  const bruta = erro?.message ?? String(erro);
  console.log(`${cor.erro("x")}  Falha ao ler a planilha.`);
  if (/permission|PERMISSION_DENIED|caller does not have/i.test(bruta)) {
    console.log(
      `\n   ${cor.aviso("Compartilhe a planilha com este e-mail como Editor:")}\n` +
        `   ${cor.forte(credencial.client_email)}\n` +
        `   https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    );
  } else if (/has not been used|accessNotConfigured|disabled/i.test(bruta)) {
    console.log(
      `\n   ${cor.aviso("Ative a Google Sheets API no projeto:")}\n` +
        `   https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=${credencial.project_id ?? ""}`,
    );
  } else if (/invalid_grant|account not found|unauthorized_client/i.test(bruta)) {
    console.log(
      `\n   ${cor.aviso("O Google nao reconheceu esta conta de servico.")}\n` +
        "   A chave pode ter sido apagada no console, ou o JSON e' de outro projeto.\n" +
        "   Gere uma chave nova em: Credenciais -> a conta de servico -> Chaves -> Adicionar chave.",
    );
  } else if (/Requested entity was not found|notFound/i.test(bruta)) {
    console.log(`\n   ${cor.aviso("GOOGLE_SHEET_ID incorreto:")} ${sheetId}`);
  } else {
    console.log(`\n   ${bruta}`);
  }
}

/* ---------------------- 5. Escrita de teste (opcional) ------------------ */

if (leituraOk) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Log!A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            "log_setup",
            new Date().toISOString(),
            "setup",
            "TESTE",
            "Configuracao",
            "-",
            "Escrita de teste do npm run configurar",
          ],
        ],
      },
    });
    console.log(`${cor.ok("ok")} Escrita testada (uma linha de teste foi para a aba Log).`);
  } catch (erro) {
    console.log(
      `${cor.erro("x")}  Leitura funciona, mas a escrita nao: ` +
        `${cor.aviso("compartilhe a planilha como Editor")}, nao como Leitor.`,
    );
    console.log(`   ${erro?.message ?? erro}`);
    leituraOk = false;
  }
}

/* --------------------------- 6. Saida final ----------------------------- */

console.log(`\n${cor.forte("Variaveis para a Vercel")} ${cor.fraco("(Settings -> Environment Variables)")}\n`);
for (const [chave, valor] of Object.entries(variaveis)) {
  const mostrado =
    chave === "GOOGLE_PRIVATE_KEY" ? `${valor.slice(0, 42)}...${valor.slice(-28)}` : valor;
  console.log(`  ${cor.forte(chave)}`);
  console.log(`  ${mostrado}\n`);
}
console.log(
  cor.fraco(
    "  A GOOGLE_PRIVATE_KEY completa esta no .env.local deste diretorio.\n" +
      "  Na Vercel, cole o valor SEM as aspas externas.\n" +
      "  Lembre de marcar Root Directory = feijuca-reservas ao importar o projeto.",
  ),
);

if (leituraOk) {
  console.log(`\n${cor.ok("Tudo certo.")} Rode ${cor.forte("npm run dev")} e entre com admin / pds2026.\n`);
  process.exit(0);
}
console.log(`\n${cor.aviso("Resolva o item marcado com x acima e rode o comando de novo.")}\n`);
process.exit(1);
