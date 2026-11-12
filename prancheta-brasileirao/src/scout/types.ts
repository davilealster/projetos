// Contrato de dados do Olheiro (scout). Gerado por scripts/scout/* a partir do Transfermarkt.
// Junta-se a MarketPlayer (src/market/types.ts) pelo mesmo id do Transfermarkt.

/** Estatísticas de um jogador na liga, na temporada vigente da liga (a mais recente com dados). */
export interface ScoutStats {
  /** id do jogador no Transfermarkt (= MarketPlayer.id) */
  id: string;
  /** jogos na liga */
  apps: number;
  /** minutos na liga */
  min: number;
  goals: number;
  assists: number;
  /** amarelos (o segundo amarelo conta como vermelho) */
  yc: number;
  rc: number;
  /** gols sofridos pelo time com o jogador em campo (todas as posições) */
  conceded: number;
  /** jogos sem sofrer gol com o jogador em campo */
  cleanSheets: number;
  /** minutos em todas as competições da temporada (inclui copas e continentais) */
  minAll: number;
  /** valor de mercado ~12 meses atrás (null se não houver) */
  value12m: number | null;
  /** maior valor já registrado */
  valuePeak: number | null;
}

export interface ScoutLeagueFile {
  /** id da liga no Transfermarkt (= MarketLeague.id, ex. "BRA1") */
  id: string;
  /** temporada usada (season_id do Transfermarkt) */
  season: string;
  /** minutos possíveis na temporada até a coleta ≈ jogos do clube que mais jogou × 90 (para % de minutos) */
  maxMin: number;
  collectedAt: string;
  players: ScoutStats[];
}

export interface ScoutIndex {
  collectedAt: string | null;
  leagues: { id: string; season: string; players: number }[];
}
