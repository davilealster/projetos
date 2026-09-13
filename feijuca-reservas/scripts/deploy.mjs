#!/usr/bin/env node
/**
 * Cria o projeto na Vercel, cadastra as variaveis de ambiente e publica.
 *
 *   npm run deploy -- ~/Downloads/feijuca-pds-xxxx.json
 *   npm run deploy                  (se o .env.local ja existir)
 *
 * Roda a partir de feijuca-reservas/, entao a Vercel ja trata esta pasta como
 * raiz do projeto: nao e' preciso configurar "Root Directory" no painel.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const cor = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  erro: (t) => `\x1b[31m${t}\x1b[0m`,
  aviso: (t) => `\x1b[33m${t}\x1b[0m`,
  forte: (t) => `\x1b[1m${t}\x1b[0m`,
  fraco: (t) => `\x1b[2m${t}\x1b[0m`,
};

const VARIAVEIS = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "AUTH_SECRET",
];
const AMBIENTES = ["production", "preview", "development"];

function abortar(titulo, ...linhas) {
  console.error(`\n${cor.erro("x")} ${cor.forte(titulo)}\n`);
  for (const l of linhas) console.error(`  ${l}`);
  console.error("");
  process.exit(1);
}

/** Roda um comando mostrando a saida. */
function rodar(cmd, args, opcoes = {}) {
  return spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opcoes });
}

/** Roda capturando a saida (para comandos silenciosos). */
function capturar(cmd, args, entrada) {
  return spawnSync(cmd, args, { encoding: "utf8", input: entrada, shell: false });
}

const vercel = ["--yes", "vercel@59"];

/* ------------------- 1. Garantir credenciais validadas ------------------ */

const jsonCredencial = process.argv[2];
const envLocal = resolve(process.cwd(), ".env.local");

if (jsonCredencial) {
  console.log(cor.forte("\n[1/5] Validando a conta de servico e testando a planilha\n"));
  const r = rodar("node", ["--no-deprecation", "scripts/configurar.mjs", jsonCredencial]);
  if (r.status !== 0) {
    abortar("A validacao falhou. Resolva o item acima antes de publicar.");
  }
} else if (!existsSync(envLocal)) {
  abortar(
    "Nao encontrei o .env.local.",
    "Rode primeiro apontando para o JSON da conta de servico:",
    "",
    "  npm run deploy -- ~/Downloads/feijuca-pds-xxxx.json",
  );
} else {
  console.log(`${cor.ok("ok")} Usando o .env.local existente.`);
}

/* --------------------------- 2. Ler o .env.local ------------------------ */

const bruto = readFileSync(envLocal, "utf8");
const valores = {};
for (const linha of bruto.split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(linha.trim());
  if (!m) continue;
  let valor = m[2];
  if (valor.startsWith('"') && valor.endsWith('"')) {
    valor = valor.slice(1, -1).replace(/\\n/g, "\n");
  }
  valores[m[1]] = valor;
}

const faltando = VARIAVEIS.filter((v) => !valores[v]);
if (faltando.length) abortar(`Faltam variaveis no .env.local: ${faltando.join(", ")}`);

/* --------------------------- 3. Conferir login -------------------------- */

console.log(cor.forte("\n[2/5] Conferindo o login na Vercel\n"));

let quem = capturar("npx", [...vercel, "whoami"]);
if (quem.status !== 0) {
  console.log(`${cor.aviso("!")} Voce ainda nao esta logado. Abrindo o login...\n`);
  const login = rodar("npx", [...vercel, "login"]);
  if (login.status !== 0) abortar("Login na Vercel nao concluido.");
  quem = capturar("npx", [...vercel, "whoami"]);
  if (quem.status !== 0) abortar("Login na Vercel nao concluido.");
}
console.log(`${cor.ok("ok")} Logado como ${cor.forte((quem.stdout ?? "").trim())}`);

/* ------------------------- 4. Vincular o projeto ------------------------ */

console.log(cor.forte("\n[3/5] Vinculando o projeto\n"));

if (existsSync(resolve(process.cwd(), ".vercel/project.json"))) {
  console.log(`${cor.ok("ok")} Projeto ja vinculado.`);
} else {
  const link = rodar("npx", [...vercel, "link", "--yes", "--project", "feijuca-pds"]);
  if (link.status !== 0) abortar("Nao consegui vincular o projeto na Vercel.");
  console.log(`${cor.ok("ok")} Projeto vinculado.`);
}

/* ------------------------ 5. Cadastrar as variaveis --------------------- */

console.log(cor.forte("\n[4/5] Cadastrando as variaveis de ambiente\n"));

for (const nome of VARIAVEIS) {
  for (const ambiente of AMBIENTES) {
    // Remove antes de adicionar: "env add" falha se a variavel ja existir.
    capturar("npx", [...vercel, "env", "rm", nome, ambiente, "--yes"]);
    const add = capturar("npx", [...vercel, "env", "add", nome, ambiente], valores[nome]);
    if (add.status !== 0) {
      abortar(
        `Falha ao cadastrar ${nome} (${ambiente}).`,
        (add.stderr ?? "").trim() || "Sem detalhes da Vercel.",
      );
    }
  }
  console.log(`${cor.ok("ok")} ${nome} ${cor.fraco("(production, preview, development)")}`);
}

/* ------------------------------ 6. Publicar ----------------------------- */

console.log(cor.forte("\n[5/5] Publicando em producao\n"));

const deploy = rodar("npx", [...vercel, "deploy", "--prod", "--yes"]);
if (deploy.status !== 0) abortar("O deploy falhou. A saida acima traz o motivo.");

console.log(`\n${cor.ok(cor.forte("Publicado."))}`);
console.log(
  `\n  Abra ${cor.forte("/configuracao")} na URL acima para o diagnostico,\n` +
    `  depois entre com ${cor.forte("admin / pds2026")} e troque as senhas.\n`,
);
