// Rapha Guru — Automation Types v3.0

export interface BookmakerAccount {
  id: string;
  bookmaker: string;
  name: string;
  username: string;
  password: string;
  maxDailyStake: number;
  maxSingleStake: number;
  maxOddsAccepted: number;   // rejeita se odd cair abaixo disso
  minOddsAccepted: number;   // rejeita se odd subir acima disso (suspeito)
  enabled: boolean;
  createdAt: string;
}

export interface BetOrder {
  matchId: string;
  matchLabel: string;
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
  marketType: string;
  selection: string;
  odds: number;
  stake: number;
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  requireConfirmation: boolean;
  maxOddsSlippage?: number;  // % máx de variação aceita (default 3%)
}

export interface BetResult {
  success: boolean;
  bookmaker: string;
  order: BetOrder;
  betId?: string;
  confirmedOdds?: number;
  confirmedStake?: number;
  error?: string;
  errorCode?: 'SESSION_EXPIRED' | 'CAPTCHA' | 'ODDS_CHANGED' | 'MARKET_CLOSED' |
              'INSUFFICIENT_FUNDS' | 'STAKE_LIMIT' | 'MATCH_NOT_FOUND' |
              'CONFIRM_FAILED' | 'NETWORK_ERROR' | 'UNKNOWN';
  timestamp?: string;
  screenshotPath?: string;
  durationMs?: number;
}

export interface AutomationStatus {
  state: 'idle' | 'logging_in' | 'ready' | 'placing_bet' | 'error' | 'banned' | 'cooldown';
  message: string;
  updatedAt?: string;
  balance?: number;
  todayStake?: number;
  todayBets?: number;
}

export interface BookmakerDef {
  id: string;
  name: string;
  url: string;
  logoUrl: string;
  color: string;
  supportedMarkets: string[];
}

export const BOOKMAKER_DEFS: Record<string, BookmakerDef> = {
  betano: {
    id: 'betano', name: 'Betano', url: 'https://www.betano.bet.br',
    logoUrl: 'https://www.betano.bet.br/favicon.ico', color: '#e4002b',
    supportedMarkets: ['result', 'over_goals', 'btts', 'handicap', 'corners', 'cards'],
  },
  bet365: {
    id: 'bet365', name: 'bet365', url: 'https://www.bet365.bet.br',
    logoUrl: 'https://www.bet365.bet.br/favicon.ico', color: '#1d7a00',
    supportedMarkets: ['result', 'over_goals', 'btts', 'handicap', 'corners', 'cards', 'halftime'],
  },
  superbet: {
    id: 'superbet', name: 'Superbet', url: 'https://superbet.bet.br',
    logoUrl: 'https://superbet.bet.br/favicon.ico', color: '#ff6600',
    supportedMarkets: ['result', 'over_goals', 'btts', 'corners'],
  },
  kto: {
    id: 'kto', name: 'KTO', url: 'https://www.kto.bet.br',
    logoUrl: 'https://www.kto.bet.br/favicon.ico', color: '#00a8e0',
    supportedMarkets: ['result', 'over_goals', 'btts'],
  },
  estrelabet: {
    id: 'estrelabet', name: 'EstrelaBet', url: 'https://www.estrelabet.bet.br',
    logoUrl: 'https://www.estrelabet.bet.br/favicon.ico', color: '#ffd700',
    supportedMarkets: ['result', 'over_goals', 'btts', 'corners'],
  },
};

export interface BetHistoryEntry {
  id: string;
  ts: string;
  bookmaker: string;
  match: string;
  market: string;
  odds: number;
  stake: number;
  success: boolean;
  betId?: string;
  errorCode?: string;
  error?: string;
  result?: 'won' | 'lost' | 'void' | 'pending';
  profit?: number;
  durationMs?: number;
}

// Resultado da fila
export interface QueueItem {
  id: string;
  accountId: string;
  bookmaker: string;
  order: BetOrder;
  addedAt: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  result?: BetResult;
  retries: number;
  maxRetries: number;
}
