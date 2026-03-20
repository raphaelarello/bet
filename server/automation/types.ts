// Rapha Guru — Tipos do módulo de automação

export interface BookmakerAccount {
  id: string;
  bookmaker: string;          // 'betano' | 'bet365' | 'superbet' | ...
  name: string;               // apelido da conta
  username: string;           // e-mail ou CPF
  password: string;           // senha (criptografada no armazenamento)
  maxDailyStake: number;      // limite diário em R$
  maxSingleStake: number;     // limite por aposta em R$
  enabled: boolean;
  createdAt: string;
}

export interface BetOrder {
  matchId: string;
  matchLabel: string;         // "Arsenal vs Chelsea"
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;        // "Over 2.5 Gols"
  marketType: string;         // 'over_goals' | 'result' | 'btts' | ...
  selection: string;          // 'over' | 'home' | 'yes' | ...
  odds: number;               // odd decimal
  stake: number;              // valor em R$
  probability: number;        // 0-100, nossa estimativa
  confidence: 'high' | 'medium' | 'low';
  requireConfirmation: boolean; // exige confirmação manual antes de executar
}

export interface BetResult {
  success: boolean;
  bookmaker: string;
  order: BetOrder;
  betId?: string;             // ID da aposta na casa
  confirmedOdds?: number;     // odd que foi efetivamente aceita
  confirmedStake?: number;    // stake que foi efetivamente aceita
  error?: string;
  timestamp?: string;
  screenshotPath?: string;    // screenshot de confirmação
}

export interface AutomationStatus {
  state: 'idle' | 'logging_in' | 'ready' | 'placing_bet' | 'error' | 'banned';
  message: string;
  updatedAt?: string;
  balance?: number;
}

export interface BookmakerDef {
  id: string;
  name: string;
  url: string;
  logoUrl: string;
  color: string;              // cor hex para UI
  supportedMarkets: string[];
}

export const BOOKMAKER_DEFS: Record<string, BookmakerDef> = {
  betano: {
    id: 'betano',
    name: 'Betano',
    url: 'https://www.betano.bet.br',
    logoUrl: 'https://www.betano.bet.br/favicon.ico',
    color: '#e4002b',
    supportedMarkets: ['result', 'over_goals', 'btts', 'handicap', 'corners', 'cards'],
  },
  bet365: {
    id: 'bet365',
    name: 'bet365',
    url: 'https://www.bet365.bet.br',
    logoUrl: 'https://www.bet365.bet.br/favicon.ico',
    color: '#1d7a00',
    supportedMarkets: ['result', 'over_goals', 'btts', 'handicap', 'corners', 'cards', 'halftime'],
  },
  superbet: {
    id: 'superbet',
    name: 'Superbet',
    url: 'https://superbet.bet.br',
    logoUrl: 'https://superbet.bet.br/favicon.ico',
    color: '#ff6600',
    supportedMarkets: ['result', 'over_goals', 'btts', 'corners'],
  },
  kto: {
    id: 'kto',
    name: 'KTO',
    url: 'https://www.kto.bet.br',
    logoUrl: 'https://www.kto.bet.br/favicon.ico',
    color: '#00a8e0',
    supportedMarkets: ['result', 'over_goals', 'btts'],
  },
  estrelabet: {
    id: 'estrelabet',
    name: 'EstrelaBet',
    url: 'https://www.estrelabet.bet.br',
    logoUrl: 'https://www.estrelabet.bet.br/favicon.ico',
    color: '#ffd700',
    supportedMarkets: ['result', 'over_goals', 'btts', 'corners'],
  },
  brasileirao: {
    id: 'brasileirao',
    name: 'Brasileirão Bet',
    url: 'https://www.brasileiraoapostasesportivas.bet.br',
    logoUrl: 'https://www.brasileiraoapostasesportivas.bet.br/favicon.ico',
    color: '#009c3b',
    supportedMarkets: ['result', 'over_goals', 'btts'],
  },
};

// Histórico de apostas
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
  error?: string;
  result?: 'won' | 'lost' | 'void' | 'pending';
  profit?: number;
}
