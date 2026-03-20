import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampPercent(value: number) {
  return clampNumber(value, 0, 100);
}

export function roundNumber(value: number, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

interface FormatPercentOptions {
  digits?: number;
  signed?: boolean;
  clamp?: boolean;
  fallback?: string;
}

export function formatPercent(value: number | null | undefined, options: FormatPercentOptions = {}) {
  const { digits = 0, signed = false, clamp = false, fallback = '—' } = options;
  if (value == null || !Number.isFinite(value)) return fallback;

  const normalized = clamp ? clampPercent(value) : value;
  const formatted = normalized.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  if (signed && normalized > 0) return `+${formatted}%`;
  return `${formatted}%`;
}

export function formatSignedPercentDelta(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = roundNumber(value, digits);
  const formatted = Math.abs(rounded).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  if (rounded > 0) return `+${formatted}%`;
  if (rounded < 0) return `-${formatted}%`;
  return `0${digits > 0 ? ',' + '0'.repeat(digits) : ''}%`;
}

export function formatDecimal(value: number | null | undefined, digits = 2, fallback = '—') {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}


export function formatLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addLocalDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalISODate(date);
}

export function getLocalTodayISO() {
  return formatLocalISODate(new Date());
}

export function getLocalTomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalISODate(date);
}

export function getLocalYesterdayISO() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatLocalISODate(date);
}




export function traduzirTextoMercado(texto: string | null | undefined) {
  if (!texto) return '—';
  return texto
    .replace(/DraftKings/gi, 'Mercado monitorado')
    .replace(/\bStrong\s+Value\b/gi, 'Valor forte')
    .replace(/\bValue\s+Bet(s)?\b/gi, (_m, plural) => plural ? 'oportunidades de valor' : 'oportunidade de valor')
    .replace(/Odds?/gi, (m) => m.toLowerCase() === 'odd' ? 'cotação' : 'cotações')
    .replace(/\bFair\s+Odds\b/gi, 'Cotação justa')
    .replace(/\bBTTS Sim\b/gi, 'Ambas marcam — Sim')
    .replace(/\bBTTS N[aã]o\b/gi, 'Ambas marcam — Não')
    .replace(/\bBTTS\b/gi, 'Ambas marcam')
    .replace(/\bOver\b/gi, 'Mais de')
    .replace(/\bUnder\b/gi, 'Menos de')
    .replace(/\bTotals\b/gi, 'Totais')
    .replace(/\bCorners\b/gi, 'Escanteios')
    .replace(/\bcorners\b/gi, 'escanteios')
    .replace(/\bCards\b/gi, 'Cartões')
    .replace(/\bcards\b/gi, 'cartões')
    .replace(/\bGoals\b/gi, 'Gols')
    .replace(/\bgoals\b/gi, 'gols')
    .replace(/\bHome\b/gi, 'Casa')
    .replace(/\bAway\b/gi, 'Visitante')
    .replace(/\bFirst\s+Half\b/gi, '1º tempo')
    .replace(/\bSecond\s+Half\b/gi, '2º tempo')
    .replace(/\b1st\s*Half\b/gi, '1º tempo')
    .replace(/\b2nd\s*Half\b/gi, '2º tempo')
    .replace(/\bPróximo\s+Goal\b/gi, 'Próximo gol')
    .replace(/\bLive\b/gi, 'Ao vivo')
    .replace(/\bHeat\b/gi, 'Pressão')
    .replace(/\bRanking(s)?\b/gi, (_m, plural) => plural ? 'Classificações' : 'Classificação')
    .replace(/\bscore\s+médio\b/gi, 'índice médio')
    .replace(/\bscore\s+da\s+rodada\b/gi, 'índice da rodada')
    .replace(/\bscore\s+do\s+confronto\b/gi, 'índice do confronto')
    .replace(/\bScore\b/gi, 'Índice')
    .replace(/\bHandicap\b/gi, 'Handicap Asiático')
    .replace(/\bTop\b/gi, 'Destaque')
    .replace(/\bedge\b/gi, 'vantagem')
    .replace(/\bvalue\b/gi, 'valor')
    .replace(/\bfair\b/gi, 'justo')
    .replace(/\boverpriced\b/gi, 'caro')
    .replace(/\bWebhook\b/gi, 'Integração');
}

export function traduzirFonteMercado(fonte: string | null | undefined) {
  if (!fonte) return 'Modelo interno';
  const normalizada = fonte.trim().toLowerCase();
  if (normalizada === 'draftkings') return 'Mercado monitorado';
  if (normalizada === 'webhook') return 'Integração';
  return traduzirTextoMercado(fonte);
}
