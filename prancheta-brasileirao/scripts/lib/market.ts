// Interpretação dos dados brutos do Transfermarkt (lógica pura, testada em tests/market.test.ts).
import { normalize, parsePtPositions, type Pos } from "./core";
import type { Arrival, SquadStatus } from "../../src/market/types";

/** Jogador como sai de `club_players` (transfermarkt-api, JSON camelCase). */
export interface TmPlayer {
  id: string;
  name: string | null;
  position: string | null;
  shirtNumber: number | null;
  dateOfBirth?: string | null;
  age: number | null;
  nationality: string[];
  joinedOn: string | null;
  signedFrom: string | null;
  contract: string | null;
  marketValue: number | null;
  imageUrl?: string | null;
}

export interface TmTransfer {
  id: string;
  clubFrom: { id: string; name: string | null };
  clubTo: { id: string; name: string | null };
  date: string | null;
  upcoming: boolean;
  transferType: "transfer" | "freeTransfer" | "internal" | "loan" | "endOfLoan" | null;
  fee: number | null;
  contractUntil: string | null;
}

export interface TmCompetitionFile {
  competition: { id: string; name: string; group: string };
  collectedAt: string;
  seasonId: string | null;
  clubs: { id: string; name: string | null; players: TmPlayer[] }[];
  transfers: Record<string, TmTransfer[]>;
}

/** Transferências concluídas, da mais recente para a mais antiga. */
export function completed(ts: TmTransfer[]): TmTransfer[] {
  return ts.filter((t) => !t.upcoming && t.date).sort((a, b) => (b.date! < a.date! ? -1 : b.date! > a.date! ? 1 : 0));
}

/**
 * Situação do jogador em relação a um clube, pela última transferência concluída:
 * empréstimo para o clube = loanIn; empréstimo saindo do clube = loanOut; o resto = owned.
 */
export function loanStatus(
  ts: TmTransfer[],
  clubId: string,
): { status: SquadStatus; loanClub: string | null; loanUntil: string | null } {
  const last = completed(ts)[0];
  if (last?.transferType === "loan" && last.clubTo.id === clubId)
    return { status: "loanIn", loanClub: last.clubFrom.name, loanUntil: last.contractUntil };
  if (last?.transferType === "loan" && last.clubFrom.id === clubId)
    return { status: "loanOut", loanClub: last.clubTo.name, loanUntil: last.contractUntil };
  return { status: "owned", loanClub: null, loanUntil: null };
}

/** Como chegou: compra, livre, empréstimo, base (sem transferência para o clube) ou desconhecido. */
export function arrivalOf(ts: TmTransfer[] | undefined, clubId: string, status: SquadStatus): Arrival {
  if (!ts) return { type: "unknown", from: null, fee: null, date: null };
  const into = completed(ts).filter((t) => t.clubTo.id === clubId && t.transferType !== "endOfLoan");
  const pick = status === "loanIn" ? into.find((t) => t.transferType === "loan") : into.find((t) => t.transferType !== "loan");
  if (!pick) {
    // sem nenhuma entrada no clube no histórico: formado na base
    return into.length === 0 ? { type: "youth", from: null, fee: null, date: null } : { type: "unknown", from: null, fee: null, date: null };
  }
  const type: Arrival["type"] =
    pick.transferType === "internal" ? "youth" : pick.transferType === "freeTransfer" ? "freeTransfer" : pick.transferType === "loan" ? "loan" : "transfer";
  return { type, from: pick.clubFrom.name, fee: pick.fee, date: pick.date };
}

/** Posição do Transfermarkt ("Left-Back", "Defensive Midfield"…) → nossa sigla. */
export function tmPosition(position: string | null): Pos {
  if (position && /goalkeeper/i.test(position)) return "GOL";
  return parsePtPositions(position)?.pos ?? "MEI";
}

/** Casa o nome do clube no Transfermarkt com um slug da Série A pelos aliases (o alias mais longo vence). */
export function matchClubSlug(tmName: string, aliasesBySlug: Record<string, string[]>): string | null {
  const name = normalize(tmName);
  const tokens = new Set(name.split(" "));
  let best: { slug: string; len: number } | null = null;
  for (const [slug, aliases] of Object.entries(aliasesBySlug)) {
    for (const a of aliases) {
      const n = normalize(a);
      const ok = n === name || n.split(" ").every((t) => tokens.has(t));
      if (ok && (!best || n.length > best.len)) best = { slug, len: n.length };
    }
  }
  return best?.slug ?? null;
}

const COUNTRY_PT: Record<string, string> = {
  Brazil: "Brasil", Argentina: "Argentina", Colombia: "Colômbia", Uruguay: "Uruguai", Spain: "Espanha", France: "França",
  Ecuador: "Equador", "United States": "Estados Unidos", Paraguay: "Paraguai", Chile: "Chile", Netherlands: "Holanda",
  Germany: "Alemanha", Mexico: "México", "Saudi Arabia": "Arábia Saudita", Belgium: "Bélgica", "Türkiye": "Turquia",
  Russia: "Rússia", Portugal: "Portugal", England: "Inglaterra", Italy: "Itália", "United Arab Emirates": "Emirados Árabes",
  Qatar: "Catar", Morocco: "Marrocos", Senegal: "Senegal", "Cote d'Ivoire": "Costa do Marfim", Denmark: "Dinamarca",
  Nigeria: "Nigéria", Serbia: "Sérvia", Canada: "Canadá", Japan: "Japão", Croatia: "Croácia", Sweden: "Suécia", Ghana: "Gana",
  Mali: "Mali", Algeria: "Argélia", Switzerland: "Suíça", Austria: "Áustria", Norway: "Noruega", Poland: "Polônia",
  Cameroon: "Camarões", Venezuela: "Venezuela", "Bosnia-Herzegovina": "Bósnia", "DR Congo": "RD Congo", Greece: "Grécia",
  Guinea: "Guiné", Peru: "Peru", Bolivia: "Bolívia", Scotland: "Escócia", Wales: "País de Gales", Ireland: "Irlanda",
  "Korea, South": "Coreia do Sul", Ukraine: "Ucrânia", "Czech Republic": "Tchéquia", Hungary: "Hungria", Egypt: "Egito",
  Tunisia: "Tunísia", Angola: "Angola", "Cape Verde": "Cabo Verde", Mozambique: "Moçambique", Australia: "Austrália",
  "Costa Rica": "Costa Rica", Honduras: "Honduras", Panama: "Panamá", Jamaica: "Jamaica", Haiti: "Haiti", Slovakia: "Eslováquia",
  Slovenia: "Eslovênia", Romania: "Romênia", Georgia: "Geórgia", Iceland: "Islândia", Finland: "Finlândia",
};
export const countryPt = (c: string | null | undefined) => (c ? COUNTRY_PT[c] ?? c : null);
/** Estrangeiro = nenhuma das nacionalidades é brasileira. */
export const isForeign = (nats: string[] | null | undefined) => !(nats ?? []).includes("Brazil");
/** Foto do Transfermarkt, sem a silhueta padrão. */
export const tmPhoto = (url: string | null | undefined) => (url && !/default/i.test(url) ? url : null);
