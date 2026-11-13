// Conta opcional (Google) e sincronização da jornada entre navegadores.
// Sem login, nada muda: tudo continua só no localStorage. Com login, as chaves da jornada
// (mando:, mercado:, olheiro:, prancheta:) são espelhadas na conta, com resolução de conflito
// em três vias (local × conta × última versão sincronizada neste navegador).
import { useSyncExternalStore } from "react";

export const SYNC_KEY = /^(mando|mercado|olheiro|prancheta):[\w:-]{1,60}$/;
const BASE_KEY = "mef:base"; // { [chave]: hash da última versão sincronizada } + dono
const DEBOUNCE = 3000;

export interface AccountUser {
  sub: string;
  name: string;
  picture: string | null;
}
export interface Conflict {
  keys: string[];
  server: Record<string, string>;
  local: Record<string, string | null>;
}
interface AccountState {
  ready: boolean;
  enabled: boolean;
  clientId: string | null;
  user: AccountUser | null;
  syncing: boolean;
  conflict: Conflict | null;
  /** pedido para abrir o convite de login (botão "Entrar", menu ⋯) */
  askOpen: boolean;
}

let state: AccountState = { ready: false, enabled: false, clientId: null, user: null, syncing: false, conflict: null, askOpen: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<AccountState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useAccount = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
export const openLogin = () => set({ askOpen: true });
export const closeLogin = () => set({ askOpen: false });

// ---------- três vias (puro, testado) ----------

export function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

export interface Plan {
  /** escrever no navegador (vem da conta); null = apagar daqui */
  toLocal: Record<string, string | null>;
  /** mandar para a conta */
  toServer: Record<string, string | null>;
  conflicts: string[];
}

/**
 * Decide o que vai para onde. base = hash da última versão que os dois lados tinham em comum
 * (neste navegador); sem base (primeiro login aqui), diferenças viram conflito.
 */
export function planSync(local: Record<string, string>, server: Record<string, string>, base: Record<string, string>): Plan {
  const plan: Plan = { toLocal: {}, toServer: {}, conflicts: [] };
  for (const k of new Set([...Object.keys(local), ...Object.keys(server)])) {
    const l = local[k];
    const s = server[k];
    if (l === s) continue;
    const b = base[k];
    if (l === undefined) {
      // só na conta: se este navegador já tinha sincronizado e apagou, apaga na conta; senão baixa
      if (b && b === hash(s!)) plan.toServer[k] = null;
      else plan.toLocal[k] = s!;
    } else if (s === undefined) {
      if (b && b === hash(l)) plan.toLocal[k] = null; // apagado em outro aparelho
      else plan.toServer[k] = l;
    } else if (b === hash(l)) plan.toLocal[k] = s; // só a conta mudou
    else if (b === hash(s)) plan.toServer[k] = l; // só o navegador mudou
    else plan.conflicts.push(k);
  }
  return plan;
}

// ---------- armazenamento ----------

const store = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const hasStorage = typeof Storage !== "undefined";
const rawSet: Storage["setItem"] = hasStorage ? Storage.prototype.setItem : () => {};
const rawRemove: Storage["removeItem"] = hasStorage ? Storage.prototype.removeItem : () => {};

function localJourney(): Record<string, string> {
  const ls = store();
  const out: Record<string, string> = {};
  if (!ls) return out;
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i)!;
    if (SYNC_KEY.test(k)) out[k] = ls.getItem(k) ?? "";
  }
  return out;
}
function readBase(sub: string): Record<string, string> {
  try {
    const b = JSON.parse(store()?.getItem(BASE_KEY) ?? "null") as { sub: string; h: Record<string, string> } | null;
    return b && b.sub === sub ? b.h : {};
  } catch {
    return {};
  }
}
function writeBase(sub: string, entries: Record<string, string>) {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) h[k] = hash(v);
  try {
    rawSet.call(store()!, BASE_KEY, JSON.stringify({ sub, h }));
  } catch {
    /* sem storage */
  }
}
/** Escreve no navegador e diz se algo realmente mudou (valor vazio "" é um valor, não apagar). */
function writeLocal(entries: Record<string, string | null>): boolean {
  const ls = store();
  if (!ls) return false;
  let changed = false;
  for (const [k, v] of Object.entries(entries)) {
    if (ls.getItem(k) === v) continue;
    changed = true;
    if (v === null) rawRemove.call(ls, k);
    else rawSet.call(ls, k, v);
  }
  return changed;
}

/** Recarrega para as telas lerem o que veio da conta — no máximo uma vez a cada 30 s (trava contra laço). */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem("mef:reload") ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem("mef:reload", String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}

// ---------- envio com espera ----------

let pending: Record<string, string | null> = {};
let timer: number | undefined;

async function flush(keepalive = false) {
  window.clearTimeout(timer);
  const user = state.user;
  if (!user || !Object.keys(pending).length) return;
  const entries = pending;
  pending = {};
  try {
    const r = await fetch("/api/journey", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
      keepalive,
    });
    if (!r.ok) throw new Error(String(r.status));
    writeBase(user.sub, localJourney());
  } catch {
    pending = { ...entries, ...pending }; // tenta de novo na próxima mudança
  }
}
function queue(k: string, v: string | null) {
  if (!state.user) return;
  pending[k] = v;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), DEBOUNCE);
}

let hooked = false;
function hookStorage() {
  if (hooked || !hasStorage) return;
  hooked = true;
  Storage.prototype.setItem = function (k: string, v: string) {
    rawSet.call(this, k, v);
    if (this === store() && SYNC_KEY.test(k)) queue(k, v);
  };
  Storage.prototype.removeItem = function (k: string) {
    rawRemove.call(this, k);
    if (this === store() && SYNC_KEY.test(k)) queue(k, null);
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flush(true));
  window.addEventListener("pagehide", () => void flush(true));
}

// ---------- fluxo ----------

/** Busca a jornada na conta e aplica. Recarrega a página se algo mudou neste navegador. */
async function pull(user: AccountUser) {
  set({ syncing: true });
  try {
    const r = await fetch("/api/journey", { cache: "no-store" });
    if (!r.ok) return;
    const server = ((await r.json()) as { entries: Record<string, string> }).entries ?? {};
    const local = localJourney();
    const plan = planSync(local, server, readBase(user.sub));
    if (plan.conflicts.length) {
      set({ conflict: { keys: plan.conflicts, server, local: Object.fromEntries(plan.conflicts.map((k) => [k, local[k] ?? null])) } });
    }
    await applyPlan(user, plan, server);
  } finally {
    set({ syncing: false });
  }
}

async function applyPlan(user: AccountUser, plan: Plan, server: Record<string, string>) {
  const changed = writeLocal(plan.toLocal);
  if (Object.keys(plan.toServer).length) {
    pending = { ...pending, ...plan.toServer };
    await flush();
  }
  // base = o que os dois lados têm em comum agora (conflitos ficam de fora até a escolha)
  const now = localJourney();
  const common: Record<string, string> = {};
  for (const [k, v] of Object.entries(now)) if (!plan.conflicts.includes(k) && (server[k] === v || k in plan.toServer)) common[k] = v;
  writeBase(user.sub, common);
  if (changed) reloadOnce();
}

/** Escolha do usuário num conflito: manter o da conta ou o deste navegador. */
export async function resolveConflict(keep: "server" | "local") {
  const c = state.conflict;
  const user = state.user;
  if (!c || !user) return;
  set({ conflict: null });
  const plan: Plan = { toLocal: {}, toServer: {}, conflicts: [] };
  for (const k of c.keys) {
    if (keep === "server") plan.toLocal[k] = k in c.server ? c.server[k] : null;
    else plan.toServer[k] = c.local[k];
  }
  await applyPlan(user, plan, keep === "server" ? c.server : { ...c.server, ...plan.toServer } as Record<string, string>);
}

export async function initAccount() {
  if (state.ready) return;
  try {
    const r = await fetch("/api/session", { cache: "no-store" });
    const s = (await r.json()) as { enabled: boolean; clientId: string | null; user: AccountUser | null };
    set({ ready: true, enabled: s.enabled, clientId: s.clientId, user: s.user });
    if (s.enabled) hookStorage();
    if (s.user) await pull(s.user);
  } catch {
    set({ ready: true });
  }
}

export async function loginWithGoogle(credential: string): Promise<boolean> {
  const r = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }) });
  if (!r.ok) return false;
  const { user } = (await r.json()) as { user: AccountUser };
  set({ user, askOpen: false });
  await pull(user);
  return true;
}

/** Sai da conta. A jornada fica na conta; neste navegador é apagada (computador compartilhado). */
export async function logout() {
  await flush();
  await fetch("/api/session", { method: "DELETE" }).catch(() => null);
  const ls = store();
  if (ls) {
    for (const k of Object.keys(localJourney())) rawRemove.call(ls, k);
    rawRemove.call(ls, BASE_KEY);
  }
  set({ user: null });
  location.reload();
}

/** Há progresso que vale salvar? (decisões, contratações, escalação, olheiro…) */
export function hasProgress(): boolean {
  const j = localJourney();
  return Object.entries(j).some(([k, v]) => {
    try {
      if (/^mercado:[\w-]+:v1$/.test(k)) {
        const o = JSON.parse(v) as { decisions?: object; signings?: unknown[]; lineup?: unknown };
        return Object.keys(o.decisions ?? {}).length > 0 || (o.signings?.length ?? 0) > 0 || !!o.lineup;
      }
      if (/^olheiro:[\w-]+:v1$/.test(k)) return /"\d{3,}"/.test(v); // algum jogador marcado
      return /^prancheta:[\w-]+:v1$/.test(k);
    } catch {
      return false;
    }
  });
}
