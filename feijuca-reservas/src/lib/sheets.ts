import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";

export const TABS = {
  eventos: "Eventos",
  lounges: "Lounges",
  bistros: "Bistros",
  mesas: "Mesas",
  reservas: "Reservas",
  vip: "ListaVip",
  listas: "Listas",
  usuarios: "Usuarios",
  config: "Config",
  log: "Log",
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

export type Row = Record<string, string>;

let cachedClient: sheets_v4.Sheets | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Confira o README (seção "Configuração").`,
    );
  }
  return value;
}

export function spreadsheetId(): string {
  return requiredEnv("GOOGLE_SHEET_ID");
}

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const auth = new JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    // A private key vem do painel da Vercel com \n escapados.
    key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/* ------------------------------------------------------------------ *
 * Cache curto em memoria: reduz chamadas na Sheets API (limite de 60
 * leituras/minuto por usuario). Cada instancia serverless tem a sua.
 * ------------------------------------------------------------------ */

const CACHE_TTL_MS = 8_000;
const cache = new Map<string, { at: number; rows: Row[] }>();

export function invalidate(tab?: TabName) {
  if (tab) cache.delete(tab);
  else cache.clear();
}

function toObjects(values: string[][]): { header: string[]; rows: Row[] } {
  if (!values.length) return { header: [], rows: [] };
  const header = values[0].map((h) => String(h ?? "").trim());
  const rows = values.slice(1).map((raw) => {
    const row: Row = {};
    header.forEach((key, i) => {
      if (key) row[key] = String(raw[i] ?? "");
    });
    return row;
  });
  return { header, rows };
}

async function readValues(tab: TabName): Promise<string[][]> {
  const res = await getClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:Z`,
  });
  return (res.data.values ?? []) as string[][];
}

export async function getHeader(tab: TabName): Promise<string[]> {
  const res = await getClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:Z1`,
  });
  return ((res.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? "").trim());
}

/** Le uma aba inteira como lista de objetos (linhas totalmente vazias sao ignoradas). */
export async function readTab<T = Row>(tab: TabName, useCache = true): Promise<T[]> {
  const hit = cache.get(tab);
  if (useCache && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.rows as T[];
  }
  const { rows } = toObjects(await readValues(tab));
  const clean = rows.filter((row) => Object.values(row).some((v) => v !== ""));
  cache.set(tab, { at: Date.now(), rows: clean });
  return clean as T[];
}

export async function findById<T = Row>(tab: TabName, id: string): Promise<T | null> {
  const rows = await readTab<Row>(tab, false);
  const found = rows.find((r) => r.id === id);
  return (found as T) ?? null;
}

function rowToValues(header: string[], row: Row): string[] {
  return header.map((key) => row[key] ?? "");
}

export async function appendRow(tab: TabName, row: Row): Promise<Row> {
  const header = await getHeader(tab);
  await getClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [rowToValues(header, row)] },
  });
  invalidate(tab);
  return row;
}

export async function appendRows(tab: TabName, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const header = await getHeader(tab);
  await getClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows.map((r) => rowToValues(header, r)) },
  });
  invalidate(tab);
}

/** Atualiza a linha cujo `id` bate, mesclando apenas os campos enviados. */
export async function updateRow(tab: TabName, id: string, patch: Row): Promise<Row | null> {
  const values = await readValues(tab);
  const { header, rows } = toObjects(values);
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const merged: Row = { ...rows[index], ...patch, id };
  const rowNumber = index + 2; // +1 cabecalho, +1 base 1

  await getClient().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [rowToValues(header, merged)] },
  });
  invalidate(tab);
  return merged;
}

function letraDaColuna(indice: number): string {
  let letra = "";
  let n = indice;
  while (n >= 0) {
    letra = String.fromCharCode((n % 26) + 65) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}

/**
 * Grava o mesmo valor num campo de varias linhas com UMA chamada a API.
 * Atualizar 33 unidades uma a uma estouraria o limite de 60 escritas/minuto.
 */
export async function atualizarCampoEmLote(
  tab: TabName,
  ids: string[],
  campo: string,
  valor: string,
): Promise<number> {
  if (!ids.length) return 0;

  const values = await readValues(tab);
  const { header, rows } = toObjects(values);
  const coluna = header.indexOf(campo);
  if (coluna === -1) throw new Error(`A aba "${tab}" não tem a coluna "${campo}".`);

  const alvo = new Set(ids);
  const letra = letraDaColuna(coluna);
  const data = rows
    .map((linha, i) => ({ linha, numero: i + 2 }))
    .filter(({ linha }) => alvo.has(linha.id))
    .map(({ numero }) => ({ range: `${tab}!${letra}${numero}`, values: [[valor]] }));

  if (!data.length) return 0;

  await getClient().spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  invalidate(tab);
  return data.length;
}

/**
 * Atualiza varias linhas inteiras numa unica chamada. Numa troca de lugar,
 * gravar as duas reservas em requisicoes separadas deixaria, entre uma e
 * outra, as duas ocupando o mesmo numero.
 */
export async function atualizarLinhasEmLote(
  tab: TabName,
  atualizacoes: { id: string; patch: Row }[],
): Promise<number> {
  if (!atualizacoes.length) return 0;

  const { header, rows } = toObjects(await readValues(tab));
  const porId = new Map(rows.map((linha, i) => [linha.id, { linha, numero: i + 2 }]));

  const data = atualizacoes.map(({ id, patch }) => {
    const atual = porId.get(id);
    if (!atual) throw new Error(`Linha "${id}" nao encontrada na aba "${tab}".`);
    const merged: Row = { ...atual.linha, ...patch, id };
    return { range: `${tab}!A${atual.numero}`, values: [rowToValues(header, merged)] };
  });

  await getClient().spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  invalidate(tab);
  return data.length;
}

let sheetIdCache: Record<string, number> | null = null;

async function sheetIdOf(tab: TabName): Promise<number> {
  if (!sheetIdCache) {
    const meta = await getClient().spreadsheets.get({
      spreadsheetId: spreadsheetId(),
      fields: "sheets.properties(sheetId,title)",
    });
    sheetIdCache = {};
    for (const s of meta.data.sheets ?? []) {
      const props = s.properties;
      if (props?.title && typeof props.sheetId === "number") {
        sheetIdCache[props.title] = props.sheetId;
      }
    }
  }
  const id = sheetIdCache[tab];
  if (id === undefined) throw new Error(`Aba "${tab}" não encontrada na planilha.`);
  return id;
}

export async function deleteRow(tab: TabName, id: string): Promise<boolean> {
  const rows = await readTab<Row>(tab, false);
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return false;

  await getClient().spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await sheetIdOf(tab),
              dimension: "ROWS",
              startIndex: index + 1,
              endIndex: index + 2,
            },
          },
        },
      ],
    },
  });
  invalidate(tab);
  return true;
}

/** Gera ids sequenciais legiveis, ex.: "res_007". */
export function nextId(prefix: string, existing: { id?: string }[]): string {
  let max = 0;
  for (const row of existing) {
    const match = /_(\d+)$/.exec(row.id ?? "");
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}_${String(max + 1).padStart(3, "0")}`;
}

export async function registrarLog(entry: {
  usuario: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes?: string;
}) {
  try {
    const rows = await readTab<Row>(TABS.log, false);
    await appendRow(TABS.log, {
      id: nextId("log", rows),
      data_hora: new Date().toISOString(),
      usuario: entry.usuario,
      acao: entry.acao,
      entidade: entry.entidade,
      entidade_id: entry.entidade_id,
      detalhes: entry.detalhes ?? "",
    });
  } catch {
    // O log e' auxiliar: nunca deve derrubar a operacao principal.
  }
}
