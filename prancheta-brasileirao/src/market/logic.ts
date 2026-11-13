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
  /** moeda de exibição; em euros, sempre com a referência em reais */
  currency: Currency;
  decisions: Record<string, Decision>;
  signings: Signing[];
  /** já passou pelo passo a passo inicial */
  onboarded: boolean;
  /** jogadores observados no mercado ("liga:id") */
  watch: string[];
  /** técnico: mantém ou demite (e quem contrata) */
  coach: { action: "keep" | "fire"; hire: string | null };
  /** escalação ideal; null = montada automaticamente */
  lineup: Lineup | null;
  /** formação escolhida (vale também para a montagem automática) */
  formation: string;
}

export interface Lineup {
  formation: string;
  /** id do titular de cada vaga da formação */
  starters: (string | null)[];
  /** reservas de cada vaga (até 2) */
  subs: string[][];
}

export const emptyMarketState = (): MarketState => ({ budget: 20_000_000, useSales: true, rate: 6.2, currency: "EUR", decisions: {}, signings: [], onboarded: false, watch: [],
  coach: { action: "keep", hire: null }, lineup: null, formation: "4-3-3" });

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
// ---------- moeda ----------
// Os valores ficam sempre em euros (como no Transfermarkt); só a exibição muda.
// O clube aberto define o modo ao renderizar (setMoneyMode), antes dos filhos.
export type Currency = "EUR" | "BRL";
const MONEY = { cur: "EUR" as Currency, rate: 6.2 };
export function setMoneyMode(cur: Currency, rate: number): void {
  MONEY.cur = cur;
  MONEY.rate = rate;
}
export const moneyMode = () => MONEY.cur;
/** símbolo da moeda de exibição */
export const curUnit = () => (MONEY.cur === "BRL" ? "R$" : "€");
/** euros → moeda de exibição (para campos de entrada) */
export const toUnit = (eur: number) => (MONEY.cur === "BRL" ? eur * MONEY.rate : eur);
/** moeda de exibição → euros */
export const fromUnit = (v: number) => (MONEY.cur === "BRL" ? v / MONEY.rate : v);
/** referência em reais quando a exibição é em euros ("" em reais) */
export const fmtRef = (v: number | null | undefined) => (MONEY.cur === "EUR" && v != null ? fmtBrl(v, MONEY.rate) : "");
/** valor na moeda escolhida, com "(R$ …)" quando em euros */
export const fmtMoney = (v: number | null | undefined) => (fmtRef(v) ? `${fmtEur(v)} (${fmtRef(v)})` : fmtEur(v));

/** Valor na moeda de exibição (o nome ficou de quando só havia euro). */
export function fmtEur(v: number | null | undefined): string {
  if (v == null) return "—";
  if (MONEY.cur === "BRL") return fmtBrl(v, MONEY.rate);
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
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: abs >= 1e8 ? 0 : 1 })} mi`;
  if (abs >= 1e3) return `${sign}R$ ${Math.round(abs / 1e3)} mil`;
  return `${sign}R$ ${Math.round(abs)}`;
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
  photo: string | null;
  pos: Pos;
  age: number | null;
  value: number | null;
  /** fim do vínculo que vale na próxima temporada; "renew" = renovado (data nova a definir) */
  contract: string | null | "renew";
  kind: NextKind;
  pending: boolean;
  foreign: boolean;
  /** como sai (ação) ou como chega (tipo de contratação) */
  how?: SquadAction | SigningType;
  /** dinheiro da negociação: entrada (+) numa saída, custo (+) numa chegada */
  money?: number;
}

/** Etiqueta curta para a imagem do story: como o jogador sai ou chega. */
export const HOW_TAG: Partial<Record<SquadAction | SigningType, string>> = {
  sell: "Vendido", loanOut: "Emprestado", release: "Dispensado", letGo: "Fim contrato", returnLoan: "Devolvido",
  buy: "Compra", loan: "Empréstimo", free: "Livre",
};

/** Limite de estrangeiros relacionados por jogo no Brasileirão em 2027 (CBF). */
export const FOREIGN_LIMIT = 8;

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
    out.push({ id: p.id, name: p.name, photo: p.photo, pos: p.pos, age: p.age, value: p.value, contract, kind: stays ? "stay" : "leave", pending: isEnding(p, cutoff) && !st.decisions[p.id], foreign: p.foreign, how: stays ? undefined : d.action, money: stays ? undefined : Math.max(0, moneyOf(p, d)) });
  }
  for (const a of arrivals) {
    const sg = st.signings.find((x) => x.id === a.id);
    out.push({ id: a.id, name: a.name, photo: a.photo, pos: a.pos, age: a.age, value: a.value, contract: a.contract, kind: "new", pending: false, foreign: a.foreign, how: sg?.type, money: sg ? signingCost(sg) : 0 });
  }
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

// ---------- escalação ideal ----------

import { fitScore, slotsFor } from "../lib/formations";

export const MAX_SUBS = 2;
/** Banco do Brasileirão: até 12 reservas (23 relacionados). */
export const MAX_BENCH = 12;
export const benchSize = (subs: string[][]) => subs.reduce((a, s) => a + s.length, 0);

/**
 * Escalação automática: titular de cada vaga pela posição (principal > parentes da função),
 * depois reservas, cada um na vaga em que melhor encaixa, até 2 por vaga.
 * Vagas específicas (GOL, laterais, volante, pontas) são preenchidas antes das genéricas.
 */
export function autoLineup(formation: string, players: { id: string; pos: Pos; value: number | null }[]): Lineup {
  const slots = slotsFor(formation, true);
  const order: Pos[] = ["GOL", "LD", "LE", "VOL", "PON", "ATA", "ZAG", "MEI"];
  const byValue = [...players].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const used = new Set<string>();
  const starters: (string | null)[] = slots.map(() => null);
  const idx = slots.map((s, i) => [s, i] as const).sort((a, b) => order.indexOf(a[0].role) - order.indexOf(b[0].role));
  for (const [s, i] of idx) {
    let best: string | null = null;
    let score = Infinity;
    for (const p of byValue) {
      if (used.has(p.id)) continue;
      const f = fitScore({ pos: p.pos }, s.role);
      if (f < score) [best, score] = [p.id, f];
    }
    if (best && score < Infinity) {
      starters[i] = best;
      used.add(best);
    }
  }
  // reservas: primeiro um por vaga, depois o segundo, até completar o banco (12)
  const subs: string[][] = slots.map(() => []);
  for (const cap of [1, MAX_SUBS]) {
    for (const p of byValue) {
      if (used.has(p.id) || benchSize(subs) >= MAX_BENCH) continue;
      let bi = -1;
      let bs = Infinity;
      slots.forEach((s, i) => {
        if (subs[i].length >= cap) return;
        const f = fitScore({ pos: p.pos }, s.role) * 10 + subs[i].length;
        if (f < bs) [bi, bs] = [i, f];
      });
      if (bi >= 0 && bs < (cap === 1 ? 30 : Infinity)) {
        subs[bi].push(p.id);
        used.add(p.id);
      }
    }
  }
  return { formation, starters, subs };
}

/** Remove da escalação quem não está mais no elenco (vendido, devolvido…). */
export function cleanLineup(l: Lineup, ids: Set<string>): Lineup {
  return {
    ...l,
    starters: l.starters.map((id) => (id && ids.has(id) ? id : null)),
    subs: l.subs.map((s) => s.filter((id) => ids.has(id))),
  };
}

/** Coloca um jogador numa vaga (titular ou reserva), tirando-o de onde estava. */
export function placeInLineup(l: Lineup, id: string, slot: number, as: "starter" | "sub"): Lineup {
  const starters = l.starters.map((x) => (x === id ? null : x));
  const subs = l.subs.map((s) => s.filter((x) => x !== id));
  if (as === "starter") {
    const prev = starters[slot];
    starters[slot] = id;
    // o antigo titular vira reserva da mesma vaga, se couber
    if (prev && subs[slot].length < MAX_SUBS && benchSize(subs) < MAX_BENCH) subs[slot] = [prev, ...subs[slot]];
  } else if (subs[slot].length < MAX_SUBS && benchSize(subs) < MAX_BENCH) subs[slot] = [...subs[slot], id];
  return { ...l, starters, subs };
}

export function removeFromLineup(l: Lineup, id: string): Lineup {
  return { ...l, starters: l.starters.map((x) => (x === id ? null : x)), subs: l.subs.map((s) => s.filter((x) => x !== id)) };
}

/** Relacionados (titulares + reservas) e quantos são estrangeiros. */
export function lineupStats(l: Lineup, byId: Map<string, { foreign: boolean; value: number | null }>) {
  const starters = l.starters.filter((x): x is string => !!x);
  const listed = [...starters, ...l.subs.flat()];
  return {
    listed: listed.length,
    foreign: listed.filter((id) => byId.get(id)?.foreign).length,
    xiValue: starters.reduce((a, id) => a + (byId.get(id)?.value ?? 0), 0),
  };
}
