// Indicadores do Olheiro (puros; testados em tests/scout.test.ts).
// Fonte única: Transfermarkt (jogos, minutos, gols, assistências, cartões, gols sofridos e jogos sem sofrer
// gol com o jogador em campo, valor atual, há 12 meses e pico). Nada de xG, desarmes ou passes: os rótulos
// dizem exatamente o que é medido.
import type { MarketPlayer } from "../market/types";
import type { Pos } from "../types";
import type { ScoutStats } from "./types";

/** Jogador do mercado com o contexto da liga e as estatísticas da temporada (null = sem estatística). */
export interface Prospect {
  /** "liga:id", mesmo formato do `watch` do Mercado */
  key: string;
  id: string;
  name: string;
  pos: Pos;
  age: number | null;
  value: number | null;
  contract: string | null;
  nat: string | null;
  foreign: boolean;
  photo: string | null;
  loanFrom?: string | null;
  club: string;
  league: string;
  leagueName: string;
  group: string;
  stats: ScoutStats | null;
  /** minutos possíveis na liga (para % de minutos) */
  maxMin: number;
  season: string | null;
}

export function toProspect(
  p: MarketPlayer,
  lg: { id: string; name: string; group: string; clubs: { name: string }[] },
  stats: ScoutStats | null,
  file: { maxMin: number; season: string } | null,
): Prospect {
  return {
    key: `${lg.id}:${p.id}`,
    id: p.id,
    name: p.name,
    pos: p.pos,
    age: p.age,
    value: p.value,
    contract: p.contract,
    nat: p.nat,
    foreign: p.foreign,
    photo: p.photo,
    loanFrom: p.loanFrom,
    club: lg.clubs[p.club]?.name ?? "",
    league: lg.id,
    leagueName: lg.name,
    group: lg.group,
    stats,
    maxMin: file?.maxMin ?? 0,
    season: file?.season ?? null,
  };
}

// ---------- regras gerais ----------

/** Amostra mínima padrão para entrar nos rankings (5 jogos completos). */
export const MIN_SAMPLE = 450;

/** stat por 90 minutos (0 sem minutos). */
export const per90 = (stat: number, min: number) => (min > 0 ? (stat / min) * 90 : 0);

/** Fração dos minutos possíveis da liga (0–1, limitada a 1). */
export const minutesShare = (min: number, maxMin: number) => (maxMin > 0 ? Math.min(1, min / maxMin) : 0);

/** Cartões ponderados: amarelo = 1, vermelho = 2. */
export const cardPoints = (s: Pick<ScoutStats, "yc" | "rc">) => s.yc + 2 * s.rc;

export const hasSample = (s: ScoutStats | null, minSample = MIN_SAMPLE) => !!s && s.min >= minSample;

// ---------- indicadores ----------

export type IndicatorId = "conc90" | "clean" | "minPct" | "goals90" | "assists90" | "ga90" | "disc";

export interface IndicatorDef {
  id: IndicatorId;
  label: string;
  short: string;
  /** menor é melhor (o percentil é invertido) */
  inverse?: boolean;
  fmt: (v: number) => string;
}

const dec = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const INDICATORS: Record<IndicatorId, IndicatorDef> = {
  conc90: { id: "conc90", label: "Gols sofridos com ele em campo, por 90 min", short: "Sofridos/90", inverse: true, fmt: (v) => dec(v) },
  clean: { id: "clean", label: "Jogos sem sofrer gol (com ele em campo)", short: "Sem sofrer gol", fmt: pct },
  minPct: { id: "minPct", label: "Minutos jogados (do total possível na liga)", short: "% minutos", fmt: pct },
  goals90: { id: "goals90", label: "Gols por 90 min", short: "Gols/90", fmt: (v) => dec(v) },
  assists90: { id: "assists90", label: "Assistências por 90 min", short: "Assist./90", fmt: (v) => dec(v) },
  ga90: { id: "ga90", label: "Gols + assistências por 90 min", short: "G+A/90", fmt: (v) => dec(v) },
  disc: { id: "disc", label: "Disciplina: cartões por 90 min (vermelho vale 2)", short: "Cartões/90", inverse: true, fmt: (v) => dec(v) },
};

/**
 * Indicadores e pesos da nota de cada posição (seção 10 do plano). Pesos somam 100 e seguem o papel:
 * goleiro e zagueiro pesam os gols sofridos; laterais a criação; volante a presença (minutos) e a defesa;
 * meia e ponta a participação em gols; atacante os gols. "% minutos" entra em todas: quem joga é quem o
 * técnico confia.
 */
export const POS_WEIGHTS: Record<Pos, [IndicatorId, number][]> = {
  GOL: [["conc90", 40], ["clean", 40], ["minPct", 20]],
  ZAG: [["conc90", 30], ["clean", 25], ["minPct", 25], ["goals90", 10], ["disc", 10]],
  LD: [["assists90", 30], ["ga90", 25], ["conc90", 25], ["minPct", 20]],
  LE: [["assists90", 30], ["ga90", 25], ["conc90", 25], ["minPct", 20]],
  VOL: [["minPct", 35], ["conc90", 30], ["ga90", 20], ["disc", 15]],
  MEI: [["assists90", 35], ["ga90", 40], ["minPct", 25]],
  PON: [["ga90", 35], ["goals90", 25], ["assists90", 20], ["minPct", 20]],
  ATA: [["goals90", 50], ["ga90", 30], ["minPct", 20]],
};

export function indicatorValue(id: IndicatorId, s: ScoutStats, maxMin: number): number {
  switch (id) {
    case "conc90": return per90(s.conceded, s.min);
    case "clean": return s.apps > 0 ? Math.min(1, s.cleanSheets / s.apps) : 0;
    case "minPct": return minutesShare(s.min, maxMin);
    case "goals90": return per90(s.goals, s.min);
    case "assists90": return per90(s.assists, s.min);
    case "ga90": return per90(s.goals + s.assists, s.min);
    case "disc": return per90(cardPoints(s), s.min);
  }
}

/**
 * Percentil (0–100) de `x` numa lista: posição média entre os empatados, 0 = pior, 100 = melhor.
 * Com `inverse`, valores menores ficam em cima.
 */
export function percentile(x: number, values: number[], inverse = false): number {
  const n = values.length;
  if (n <= 1) return 50;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v === x) equal++;
    else if (inverse ? v > x : v < x) below++;
  }
  const rank = below + Math.max(0, equal - 1) / 2;
  return Math.round((100 * rank) / (n - 1));
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------- coeficientes das ligas ----------

/**
 * Força relativa das ligas (opinião explícita e editável; Premier = 1). Só entra nos índices compostos
 * ("liga de exportação"), nunca na nota da posição, que compara cada um com a própria liga-grupo.
 */
export const LEAGUE_COEF: Record<string, number> = {
  GB1: 1.0, ES1: 0.97, IT1: 0.95, L1: 0.94, FR1: 0.92,
  PO1: 0.85, NL1: 0.85, BE1: 0.8, TR1: 0.8, RU1: 0.76,
  BRA1: 0.82, AR1N: 0.76, BRA2: 0.66, COLP: 0.68, URU1: 0.66, EC1N: 0.66, CLPD: 0.65, PR1A: 0.64,
  MLS1: 0.74, MEX1: 0.74, SA1: 0.72, QSL: 0.62, UAE1: 0.62,
};
export const leagueCoef = (id: string) => LEAGUE_COEF[id] ?? 0.7;
/** Liga de exportação: coeficiente até aqui (fora do radar de quem só olha a Europa). */
export const EXPORT_COEF_MAX = 0.78;

// ---------- avaliação do grupo ----------

export interface IndicatorRead {
  id: IndicatorId;
  value: number;
  /** percentil na posição e liga-grupo (null = amostra pequena) */
  pct: number | null;
  weight: number;
}

export interface RiskFlag {
  id: "sample" | "cards" | "veteran" | "falling";
  label: string;
}

export interface Metrics {
  sample: boolean;
  min: number;
  minPct: number;
  /** titular pelo menos de metade dos minutos possíveis */
  regular: boolean;
  indicators: IndicatorRead[];
  /** nota da posição 0–100 (null sem amostra) */
  score: number | null;
  /** variação do valor em 12 meses, em % (null sem histórico) */
  trend: number | null;
  /** abaixo do pico em % (0 = no pico) */
  fromPeak: number | null;
  /** custo-benefício: percentil (0–100) de nota ÷ log10(valor) na posição/grupo */
  value4money: number | null;
  /** potencial (0–100+) e se é joia (critério do plano) */
  potential: number | null;
  gem: boolean;
  /** fim de contrato até o corte e nota ≥ 60 */
  contractChance: boolean;
  /** nota ≥ 75 e valor abaixo da mediana da posição na liga */
  undervalued: boolean;
  /** bom (≥ 70) em liga de coeficiente baixo */
  exportLeague: boolean;
  coef: number;
  /** mediana do valor da posição na liga do jogador */
  posMedianValue: number | null;
  risks: RiskFlag[];
}

export interface ScoutPlayer extends Prospect {
  m: Metrics;
}

export interface EvalOptions {
  minSample?: number;
  /** contratos que acabam até esta data (AAAA-MM-DD) são "oportunidade de contrato" */
  contractCut: string;
}

/** 30/06 do ano seguinte ao início da próxima temporada do Mercado (ex.: "2027-01-01" → "2027-06-30"). */
export const contractCutFrom = (nextSeasonStart: string) => `${nextSeasonStart.slice(0, 4)}-06-30`;

const cohortKey = (p: Prospect) => `${p.group}|${p.pos}`;
function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

/** Custo-benefício bruto: nota ÷ log10(valor), com piso de € 100 mil para não explodir. */
export const valueForMoneyRaw = (score: number, value: number | null) => score / Math.log10(Math.max(100_000, value ?? 0));

export function potentialOf(age: number | null, score: number | null, minPct: number): { value: number | null; gem: boolean } {
  if (score == null || age == null) return { value: null, gem: false };
  const gem = (age <= 21 && score >= 70) || (age <= 23 && score >= 80);
  // bônus de juventude (até +18 aos 17) e de titular jovem (≥ 50% dos minutos, sub-23)
  const youth = Math.max(0, 23 - age) * 3;
  const regular = age <= 23 && minPct >= 0.5 ? 6 : 0;
  return { value: Math.round(score + youth + regular), gem };
}

export function risksOf(p: Prospect, sample: boolean, contractCut: string, trend: number | null): RiskFlag[] {
  const out: RiskFlag[] = [];
  const s = p.stats;
  if (!sample) out.push({ id: "sample", label: s ? `Amostra pequena (${s.min} min)` : "Sem estatísticas na temporada" });
  if (s && sample && per90(cardPoints(s), s.min) >= 0.4) out.push({ id: "cards", label: "Muitos cartões" });
  const longDeal = !!p.contract && p.contract.slice(0, 4) >= String(Number(contractCut.slice(0, 4)) + 2);
  if ((p.age ?? 0) >= 32 && (longDeal || (p.value ?? 0) >= 5_000_000)) out.push({ id: "veteran", label: "32+ com contrato longo ou caro" });
  if (trend != null && trend <= -30) out.push({ id: "falling", label: "Valor em queda forte" });
  return out;
}

/**
 * Avalia um conjunto de jogadores: percentis por posição dentro de cada liga-grupo (só quem tem amostra),
 * nota da posição e índices. Quem não tem amostra recebe os valores brutos, sem percentil nem nota.
 */
export function evaluate(pool: Prospect[], opts: EvalOptions): ScoutPlayer[] {
  const minSample = opts.minSample ?? MIN_SAMPLE;
  // valores por coorte (grupo + posição), só de quem tem amostra
  const cohorts = new Map<string, Prospect[]>();
  for (const p of pool) {
    if (!hasSample(p.stats, minSample)) continue;
    push(cohorts, cohortKey(p), p);
  }
  const values = new Map<string, Record<IndicatorId, number[]>>();
  for (const [k, ps] of cohorts) {
    const pos = ps[0].pos;
    const rec = {} as Record<IndicatorId, number[]>;
    for (const [id] of POS_WEIGHTS[pos]) rec[id] = ps.map((p) => indicatorValue(id, p.stats!, p.maxMin));
    values.set(k, rec);
  }
  // mediana de valor por liga + posição (todos os jogadores com valor)
  const valByLeaguePos = new Map<string, number[]>();
  for (const p of pool) {
    if (p.value == null) continue;
    push(valByLeaguePos, `${p.league}|${p.pos}`, p.value);
  }
  const medians = new Map([...valByLeaguePos].map(([k, v]) => [k, median(v)]));

  const out: ScoutPlayer[] = pool.map((p) => {
    const s = p.stats;
    const sample = hasSample(s, minSample);
    const rec = values.get(cohortKey(p));
    const indicators: IndicatorRead[] = POS_WEIGHTS[p.pos].map(([id, weight]) => {
      const value = s ? indicatorValue(id, s, p.maxMin) : 0;
      const pctv = sample && rec ? percentile(value, rec[id], INDICATORS[id].inverse) : null;
      return { id, value, pct: pctv, weight };
    });
    const score = sample ? Math.round(indicators.reduce((a, r) => a + (r.pct ?? 0) * r.weight, 0) / indicators.reduce((a, r) => a + r.weight, 0)) : null;
    const v12 = s?.value12m ?? null;
    const trend = p.value != null && v12 ? Math.round(((p.value - v12) / v12) * 100) : null;
    const peak = s?.valuePeak ?? null;
    const fromPeak = p.value != null && peak ? Math.max(0, Math.round(((peak - p.value) / peak) * 100)) : null;
    const minPct = s ? minutesShare(s.min, p.maxMin) : 0;
    const pot = potentialOf(p.age, score, minPct);
    const posMedianValue = medians.get(`${p.league}|${p.pos}`) ?? null;
    const coef = leagueCoef(p.league);
    return {
      ...p,
      m: {
        sample,
        min: s?.min ?? 0,
        minPct,
        regular: minPct >= 0.5,
        indicators,
        score,
        trend,
        fromPeak,
        value4money: null,
        potential: pot.value,
        gem: pot.gem,
        contractChance: score != null && score >= 60 && !!p.contract && p.contract <= opts.contractCut,
        undervalued: score != null && score >= 75 && p.value != null && posMedianValue != null && p.value < posMedianValue,
        exportLeague: score != null && score >= 70 && coef <= EXPORT_COEF_MAX,
        coef,
        posMedianValue,
        risks: risksOf(p, sample, opts.contractCut, trend),
      },
    };
  });

  // custo-benefício: percentil do bruto dentro da coorte
  const v4m = new Map<string, number[]>();
  for (const x of out) {
    if (x.m.score == null) continue;
    push(v4m, cohortKey(x), valueForMoneyRaw(x.m.score, x.value));
  }
  for (const x of out) {
    if (x.m.score == null) continue;
    x.m.value4money = percentile(valueForMoneyRaw(x.m.score, x.value), v4m.get(cohortKey(x))!);
  }
  return out;
}

/** Perfil de percentis (na ordem dos indicadores da posição) para comparar parecidos. */
export const profileVector = (x: ScoutPlayer) => x.m.indicators.map((r) => r.pct ?? 0);

/** Distância euclidiana entre perfis de mesma posição (0 = idênticos). */
export function profileDistance(a: ScoutPlayer, b: ScoutPlayer): number {
  const va = profileVector(a);
  const vb = profileVector(b);
  return Math.sqrt(va.reduce((t, v, i) => t + (v - (vb[i] ?? 0)) ** 2, 0));
}

/** Três indicadores de maior peso da posição (mini-barras da ficha). */
export const keyIndicators = (x: ScoutPlayer) => [...x.m.indicators].sort((a, b) => b.weight - a.weight).slice(0, 3);

/** Faixa da nota, para a cor do carimbo. */
export const scoreTier = (s: number | null): "top" | "good" | "mid" | "low" | "none" =>
  s == null ? "none" : s >= 80 ? "top" : s >= 65 ? "good" : s >= 45 ? "mid" : "low";
