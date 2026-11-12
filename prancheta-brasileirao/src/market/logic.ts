// Regras do mercado de transferências (puras; testadas em tests/market.test.ts).
import type { MarketPlayer, SquadPlayer } from "./types";

/** Decisões possíveis para quem já está no clube. */
export type SquadAction =
  | "keep" // mantém (contrato vigente)
  | "renew" // renova (contrato terminando)
  | "sell" // vende (+ valor)
  | "loanOut" // empresta a outro clube (+ taxa, opcional)
  | "release" // rescinde / dispensa
  | "letGo" // deixa o contrato acabar (sai livre)
  | "extendLoan" // emprestado ao clube: segue/renova o empréstimo
  | "returnLoan" // emprestado ao clube: devolve ao dono
  | "buyOut" // emprestado ao clube: compra em definitivo (– valor)
  | "recall" // emprestado fora: volta ao clube
  | "keepLoan"; // emprestado fora: continua emprestado

export const ACTION_LABEL: Record<SquadAction, string> = {
  keep: "Mantém",
  renew: "Renova",
  sell: "Vende",
  loanOut: "Empresta",
  release: "Dispensa",
  letGo: "Deixa sair (livre)",
  extendLoan: "Mantém o empréstimo",
  returnLoan: "Devolve",
  buyOut: "Compra em definitivo",
  recall: "Traz de volta",
  keepLoan: "Segue emprestado",
};

/** Ações que mexem com dinheiro e aceitam valor (em euros). */
export const PRICED: SquadAction[] = ["sell", "loanOut", "buyOut"];

export interface Decision {
  action: SquadAction;
  /** valor da venda/compra/taxa em euros; ausente = valor de mercado (ou 0 na taxa de empréstimo) */
  price?: number;
}

export type SigningType = "buy" | "loan" | "free";
export const SIGNING_LABEL: Record<SigningType, string> = { buy: "Compra", loan: "Empréstimo", free: "Livre" };

export interface Signing {
  id: string;
  league: string;
  type: SigningType;
  price: number;
}

export interface MarketState {
  /** orçamento para a janela, em euros */
  budget: number;
  /** vendas reforçam o orçamento */
  useSales: boolean;
  /** cotação do euro em reais, para mostrar valores em R$ */
  rate: number;
  decisions: Record<string, Decision>;
  signings: Signing[];
  /** já passou pelo passo a passo inicial */
  onboarded: boolean;
  /** jogadores observados no mercado ("liga:id") */
  watch: string[];
}

export const emptyMarketState = (): MarketState => ({ budget: 20_000_000, useSales: true, rate: 6.2, decisions: {}, signings: [], onboarded: false, watch: [] });

const ends = (date: string | null | undefined, cutoff: string) => !!date && date < cutoff;

/** Contrato (ou empréstimo) acaba antes da próxima temporada. */
export function isEnding(p: SquadPlayer, cutoff: string): boolean {
  if (p.status === "owned") return ends(p.contract, cutoff);
  return ends(p.loanUntil, cutoff);
}

/** Ações permitidas e a padrão (o que acontece se o usuário não decidir). */
export function actionsFor(p: SquadPlayer, cutoff: string): { options: SquadAction[]; def: SquadAction } {
  const ending = isEnding(p, cutoff);
  if (p.status === "loanIn")
    return { options: ["extendLoan", "returnLoan", "buyOut"], def: ending ? "returnLoan" : "extendLoan" };
  if (p.status === "loanOut")
    return { options: ["recall", "keepLoan", "sell"], def: ending ? "recall" : "keepLoan" };
  if (ending) return { options: ["renew", "letGo", "sell"], def: "renew" };
  return { options: ["keep", "sell", "loanOut", "release"], def: "keep" };
}

export const decisionOf = (p: SquadPlayer, st: MarketState, cutoff: string): Decision =>
  st.decisions[p.id] ?? { action: actionsFor(p, cutoff).def };

/** Fica no elenco da próxima temporada? */
export const staysWith = (a: SquadAction) => ["keep", "renew", "extendLoan", "buyOut", "recall"].includes(a);

/** Dinheiro da decisão: + entra, – sai. */
export function moneyOf(p: SquadPlayer, d: Decision): number {
  const v = d.price ?? (d.action === "loanOut" ? 0 : p.value ?? 0);
  if (d.action === "sell" || d.action === "loanOut") return v;
  if (d.action === "buyOut") return -v;
  return 0;
}

export const signingCost = (s: Signing) => (s.type === "free" ? 0 : s.price);

/** Pode chegar sem custo: contrato acaba antes da próxima temporada. */
export const isFreeAgent = (m: MarketPlayer, cutoff: string) => ends(m.contract, cutoff);

export interface Summary {
  income: number;
  spend: number;
  balance: number;
  stays: SquadPlayer[];
  leaves: { p: SquadPlayer; d: Decision }[];
  /** contratos/empréstimos terminando sem decisão explícita */
  pending: SquadPlayer[];
  squadValue: number;
  squadSize: number;
  avgAge: number | null;
}

export function summarize(
  squad: SquadPlayer[],
  st: MarketState,
  cutoff: string,
  arrivals: { value: number | null; age: number | null }[],
): Summary {
  let income = 0;
  let spend = 0;
  const stays: SquadPlayer[] = [];
  const leaves: Summary["leaves"] = [];
  const pending: SquadPlayer[] = [];
  for (const p of squad) {
    const d = decisionOf(p, st, cutoff);
    const m = moneyOf(p, d);
    if (m > 0) income += m;
    else spend += -m;
    if (staysWith(d.action)) stays.push(p);
    else if (p.status !== "loanOut" || d.action === "sell") leaves.push({ p, d });
    if (isEnding(p, cutoff) && !st.decisions[p.id]) pending.push(p);
  }
  for (const s of st.signings) spend += signingCost(s);
  const balance = st.budget + (st.useSales ? income : 0) - spend;
  const all = [...stays.map((p) => ({ value: p.value, age: p.age })), ...arrivals];
  const ages = all.map((x) => x.age).filter((a): a is number => a != null);
  return {
    income,
    spend,
    balance,
    stays,
    leaves,
    pending,
    squadValue: all.reduce((a, x) => a + (x.value ?? 0), 0),
    squadSize: all.length,
    avgAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
  };
}

// ---------- formatação ----------

/** 12500000 → "€ 12,5 mi"; 800000 → "€ 800 mil". */
export function fmtEur(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "– " : "";
  if (abs >= 1e6) return `${sign}€ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: abs >= 1e8 ? 0 : 1 })} mi`;
  if (abs >= 1e3) return `${sign}€ ${Math.round(abs / 1e3)} mil`;
  return `${sign}€ ${abs}`;
}

export function fmtBrl(v: number | null | undefined, rate: number): string {
  if (v == null) return "";
  const r = v * rate;
  const abs = Math.abs(r);
  const sign = r < 0 ? "– " : "";
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `${sign}R$ ${Math.round(abs / 1e3)} mil`;
}

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m] = d.split("-");
  return `${m}/${y}`;
};

// ---------- elenco da próxima temporada e gráficos ----------

import type { Pos } from "../types";

export type NextKind = "stay" | "new" | "leave";
export interface NextPlayer {
  id: string;
  name: string;
  pos: Pos;
  age: number | null;
  value: number | null;
  /** fim do vínculo que vale na próxima temporada; "renew" = renovado (data nova a definir) */
  contract: string | null | "renew";
  kind: NextKind;
  pending: boolean;
  foreign: boolean;
}

/** Limite de estrangeiros relacionados por jogo no Brasileirão (CBF). */
export const FOREIGN_LIMIT = 9;

/** Ordem de exibição: goleiro, zagueiro, laterais, volante, meia, ponta, atacante. */
export const posRank = (p: Pos) => POS_ORDER.indexOf(p);

/** Todos os envolvidos na janela: quem fica, quem chega e quem sai. */
export function nextSeason(squad: SquadPlayer[], st: MarketState, cutoff: string, arrivals: MarketPlayer[]): NextPlayer[] {
  const out: NextPlayer[] = [];
  for (const p of squad) {
    const d = decisionOf(p, st, cutoff);
    const stays = staysWith(d.action);
    if (!stays && p.status === "loanOut" && d.action !== "sell") continue; // já está fora e segue fora
    const contract = d.action === "renew" ? "renew" : d.action === "extendLoan" ? p.loanUntil ?? null : p.contract;
    out.push({ id: p.id, name: p.name, pos: p.pos, age: p.age, value: p.value, contract, kind: stays ? "stay" : "leave", pending: isEnding(p, cutoff) && !st.decisions[p.id], foreign: p.foreign });
  }
  for (const a of arrivals) out.push({ id: a.id, name: a.name, pos: a.pos, age: a.age, value: a.value, contract: a.contract, kind: "new", pending: false, foreign: a.foreign });
  return out;
}

/** Mínimo recomendado por posição para uma temporada (dois por posição, mais nos setores com mais vagas). */
export const DEPTH_MIN: Record<Pos, number> = { GOL: 3, ZAG: 4, LD: 2, LE: 2, VOL: 3, MEI: 4, PON: 4, ATA: 3 };
const POS_ORDER: Pos[] = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PON", "ATA"];

export interface DepthRow {
  pos: Pos;
  stay: NextPlayer[];
  fresh: NextPlayer[];
  leave: NextPlayer[];
  min: number;
  short: number;
}

export function depthChart(list: NextPlayer[]): DepthRow[] {
  return POS_ORDER.map((pos) => {
    const of = (k: NextKind) => list.filter((x) => x.pos === pos && x.kind === k);
    const stay = of("stay");
    const fresh = of("new");
    return { pos, stay, fresh, leave: of("leave"), min: DEPTH_MIN[pos], short: Math.max(0, DEPTH_MIN[pos] - stay.length - fresh.length) };
  });
}

/** Quantos vínculos do elenco da próxima temporada acabam em cada ano. */
export function contractYears(list: NextPlayer[]): { label: string; count: number; names: string[] }[] {
  const next = list.filter((x) => x.kind !== "leave");
  const map = new Map<string, string[]>();
  for (const x of next) {
    const key = x.contract === "renew" ? "Renovados" : x.contract ? x.contract.slice(0, 4) : "Sem data";
    map.set(key, [...(map.get(key) ?? []), x.name]);
  }
  const rank = (k: string) => (k === "Renovados" ? 9998 : k === "Sem data" ? 9999 : Number(k));
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([label, names]) => ({ label, count: names.length, names }));
}

export interface WaterfallStep {
  label: string;
  /** início e fim da barra na escala (euros) */
  from: number;
  to: number;
  value: number;
  kind: "base" | "in" | "out" | "total";
}

/** Orçamento + vendas − gastos = saldo, como barras encadeadas. */
export function waterfall(st: MarketState, sum: Pick<Summary, "income" | "spend" | "balance">): WaterfallStep[] {
  const steps: WaterfallStep[] = [{ label: "Orçamento", from: 0, to: st.budget, value: st.budget, kind: "base" }];
  let top = st.budget;
  if (st.useSales) {
    steps.push({ label: "Vendas", from: top, to: top + sum.income, value: sum.income, kind: "in" });
    top += sum.income;
  }
  steps.push({ label: "Gastos", from: top - sum.spend, to: top, value: -sum.spend, kind: "out" });
  steps.push({ label: "Saldo", from: Math.min(0, sum.balance), to: Math.max(0, sum.balance), value: sum.balance, kind: "total" });
  return steps;
}

/** Resumo em texto para colar no WhatsApp / X. */
export function shareText(opts: {
  club: string;
  season: string;
  arrivals: { name: string; from: string; type: SigningType; price: number }[];
  leaves: { name: string; action: SquadAction; money: number }[];
  balance: number;
  url: string;
}): string {
  const lines = [`Minha janela do ${opts.club} para ${opts.season}`, ""];
  if (opts.arrivals.length) {
    lines.push("CHEGAM");
    for (const a of opts.arrivals) lines.push(`+ ${a.name} (${a.from}) · ${a.type === "buy" ? fmtEur(a.price) : SIGNING_LABEL[a.type].toLowerCase()}`);
    lines.push("");
  }
  if (opts.leaves.length) {
    lines.push("SAEM");
    for (const l of opts.leaves) lines.push(`- ${l.name} · ${ACTION_LABEL[l.action].toLowerCase()}${l.money ? ` por ${fmtEur(l.money)}` : ""}`);
    lines.push("");
  }
  lines.push(`Saldo: ${fmtEur(opts.balance)}`, `Monte a sua: ${opts.url}`);
  return lines.join("\n");
}
