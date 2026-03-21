// Rapha Guru — Type Definitions (v2.0 — Ultra Detailed)
// Design: "Estádio Noturno" — Premium Sports Dark

export interface League {
  idLeague: string;
  strLeague: string;
  strCountry: string;
  strBadge?: string;
  strLogo?: string;
  strSport: string;
}

export interface Team {
  idTeam: string;
  strTeam: string;
  strBadge?: string;
  strLogo?: string;
  strCountry?: string;
  strLeague?: string;
  strDescriptionEN?: string;
  intFormedYear?: string;
  strStadium?: string;
  intStadiumCapacity?: string;
}

export interface Match {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  idLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  dateEvent: string;
  strTime: string;
  strStatus?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strVenue?: string;
  strCountry?: string;
  strSeason?: string;
  strRound?: string;
  intRound?: string;
  strTimestamp?: string;
  strLeagueId?: string;
  // Campos extras ESPN
  espnHomeTeamId?: string;
  espnAwayTeamId?: string;
  espnLeagueId?: string;
  espnHomeOdds?: number;
  espnDrawOdds?: number;
  espnAwayOdds?: number;
  // Campos ao vivo
  liveDisplayClock?: string;
  livePeriod?: number;
  liveStatusLabel?: string;
}

export interface RecentMatch {
  idEvent: string;
  strEvent: string;
  dateEvent: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isHome: boolean;
  result: 'W' | 'D' | 'L';
  totalGoals: number;
  corners?: number;
  yellowCards?: number;
  redCards?: number;
  league?: string;
}

export interface TeamStats {
  idTeam: string;
  strTeam: string;
  recentMatches: RecentMatch[];
  
  // Gols
  avgGoalsScored: number;
  avgGoalsConceded: number;
  avgGoalsScoredHome: number;
  avgGoalsScoredAway: number;
  avgGoalsConcededHome: number;
  avgGoalsConcededAway: number;
  
  // Escanteios
  avgCornersFor: number;
  avgCornersAgainst: number;
  avgCornersForHome?: number;   // média real de escanteios em casa (quando disponível)
  avgCornersForAway?: number;   // média real de escanteios fora (quando disponível)
  cornersDataQuality?: number;  // 0–1: proporção de jogos com dados reais de escanteios
  
  // Cartões
  avgYellowCards: number;
  avgRedCards: number;
  avgYellowCardsHome: number;
  avgYellowCardsAway: number;
  avgTotalCardsPerGame: number;
  
  // Resultados
  winRate: number;
  drawRate: number;
  lossRate: number;
  homeWinRate: number;
  awayWinRate: number;
  homeDrawRate: number;
  awayDrawRate: number;
  
  // Gols especiais
  bttsRate: number;
  over05Rate: number;
  over15Rate: number;
  over25Rate: number;
  over35Rate: number;
  over45Rate: number;
  cleanSheetRate: number;
  failedToScoreRate: number;
  
  // Forma e momentum
  form: string[];
  formPoints: number; // Pontos nos últimos 5 jogos (0-15)
  formMomentum: number; // -1 a +1 (tendência de melhora/piora)
  
  // Gols por período (estimado)
  goalsFirstHalfRate: number;  // % de jogos com gol no 1º tempo
  goalsSecondHalfRate: number; // % de jogos com gol no 2º tempo
  
  // Sequências
  scoringStreak: number;     // Jogos consecutivos marcando
  concedingStreak: number;   // Jogos consecutivos sofrendo
  winStreak: number;         // Vitórias consecutivas
  unbeatenStreak: number;    // Jogos sem perder
  
  // Índices calculados
  attackStrength: number;    // Força de ataque (1.0 = média)
  defenseStrength: number;   // Força de defesa (1.0 = média)
  aggressionIndex: number;   // Índice de agressividade (0-1)
  dataQuality: number;       // 0-10: qualidade dos dados disponíveis
}

export interface AnalysisMarketOdds {
  provider: string;
  homeWinOdds: number | null;
  drawOdds: number | null;
  awayWinOdds: number | null;
  totalLine: number | null;
  overOdds: number | null;
  underOdds: number | null;
}

export interface AnalysisSummary {
  decisionScore: number;      // 0-100
  dataQualityScore: number;   // 0-100
  marketAlignmentScore: number; // 0-100
  stabilityScore: number;     // 0-100
  bestAngle: string;
  strengths: string[];
  warnings: string[];
}

export interface MatchAnalysis {
  match: Match;
  homeTeamStats: TeamStats;
  awayTeamStats: TeamStats;
  predictions: Predictions;
  tips: Tip[];
  headToHead: HeadToHead;
  confidence: 'high' | 'medium' | 'low';
  valueBets: ValueBet[];
  scorePredictions: ScorePrediction[];
  matchProfile: MatchProfile;
  marketOdds: AnalysisMarketOdds | null;
  summary: AnalysisSummary;
}

export interface Predictions {
  // ===== RESULTADO =====
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  
  // Handicap Asiático
  handicapHome05: number;   // Casa -0.5
  handicapAway05: number;   // Visitante -0.5
  handicapHome1: number;    // Casa -1
  handicapAway1: number;    // Visitante -1
  handicapHome15: number;   // Casa -1.5
  handicapAway15: number;   // Visitante -1.5
  
  // Dupla chance
  homeOrDraw: number;       // 1X
  awayOrDraw: number;       // X2
  homeOrAway: number;       // 12
  
  // ===== GOLS =====
  over05Prob: number;
  over15Prob: number;
  over25Prob: number;
  over35Prob: number;
  over45Prob: number;
  under15Prob: number;
  under25Prob: number;
  under35Prob: number;
  
  bttsYesProb: number;
  bttsNoProb: number;
  
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  expectedTotalGoals: number;
  
  // Gols por time
  homeToScoreProb: number;
  awayToScoreProb: number;
  cleanSheetHomeProb: number;
  cleanSheetAwayProb: number;
  home2PlusGoalsProb: number;
  away2PlusGoalsProb: number;
  
  // Gols por período
  expectedFirstHalfGoals: number;
  firstHalfGoalProb: number;       // Prob de gol no 1º tempo
  secondHalfGoalProb: number;      // Prob de gol no 2º tempo
  firstHalfOver05Prob: number;     // Over 0.5 HT
  firstHalfOver15Prob: number;     // Over 1.5 HT
  firstHalfBttsProb: number;       // BTTS no 1º tempo
  
  // ===== ESCANTEIOS =====
  expectedCorners: number;
  expectedFirstHalfCorners: number;
  expectedCornersHome: number;
  expectedCornersAway: number;
  over55CornersProb: number;
  over65CornersProb: number;
  over75CornersProb: number;
  over85CornersProb: number;
  over95CornersProb: number;
  over105CornersProb: number;
  over115CornersProb: number;
  over125CornersProb: number;
  under85CornersProb: number;
  under105CornersProb: number;
  firstHalfOver35CornersProb: number;
  firstHalfOver45CornersProb: number;
  firstHalfOver55CornersProb: number;
  
  // ===== CARTÕES =====
  expectedCards: number;
  expectedCardsHome: number;
  expectedCardsAway: number;
  expectedYellowCards: number;
  expectedRedCards: number;
  
  over05CardsProb: number;
  over15CardsProb: number;
  over25CardsProb: number;
  over35CardsProb: number;
  over45CardsProb: number;
  over55CardsProb: number;
  
  // Cartões por time
  homeCardProb: number;      // Prob de casa levar cartão
  awayCardProb: number;      // Prob de visitante levar cartão
  homeRedCardProb: number;   // Prob de cartão vermelho casa
  awayRedCardProb: number;   // Prob de cartão vermelho visitante
  bothTeamsCardProb: number; // Ambos levam cartão
  
  // Cartões por período
  firstHalfCardProb: number;
  secondHalfCardProb: number;
}

export interface Tip {
  id: string;
  category: 'result' | 'goals' | 'corners' | 'cards' | 'btts' | 'handicap' | 'halftime' | 'special';
  label: string;
  description: string;
  probability: number;
  odds: number;
  confidence: 'high' | 'medium' | 'low';
  isRecommended: boolean;
  isValueBet?: boolean;
  valueEdge?: number; // % de vantagem sobre a odd de mercado
}

export interface ValueBet {
  market: string;
  ourProb: number;
  impliedProb: number;
  marketOdds: number;
  ourOdds: number;
  edge: number;       // EV % / vantagem estimada
  kellyPct?: number;  // Half-Kelly stake % recomendado da banca
  confidence: 'high' | 'medium' | 'low';
  sourceLabel: string;
}

export interface ScorePrediction {
  homeGoals: number;
  awayGoals: number;
  probability: number;
  label: string;
}

export interface MatchProfile {
  type: 'high-scoring' | 'low-scoring' | 'balanced' | 'defensive' | 'aggressive';
  label: string;
  description: string;
  icon: string;
  dominantTeam: 'home' | 'away' | 'balanced';
  expectedIntensity: 'low' | 'medium' | 'high';
  keyFactors: string[];
}

export interface HeadToHead {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  avgTotalGoals: number;
  bttsRate: number;
  over25Rate: number;
  avgCards: number;
  recentMatches: RecentMatch[];
}

export interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface FeaturedLeague {
  id: string;
  name: string;
  country: string;
  flag: string;
  badge?: string;
}
