/**
 * Rapha Guru — Motor de Automação de Apostas
 * Usa Playwright com comportamento humano realista
 * 
 * ⚠️  USO PESSOAL APENAS — suas próprias contas
 * 
 * Padrões anti-detecção implementados:
 * - Delays humanizados (distribuição normal, não uniforme)
 * - Mouse path simulado antes de cliques
 * - Scroll orgânico
 * - User-agent rotativo
 * - Fingerprint realista (viewport, locale, timezone)
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { BetOrder, BetResult, BookmakerAccount, AutomationStatus } from './types.js';
import { humanDelay, humanType, humanClick, randomBetween } from './human.js';
import { BetanoAdapter } from './adapters/betano.js';
import { Bet365Adapter } from './adapters/bet365.js';
import { SuperbetAdapter } from './adapters/superbet.js';
import { KTO_Adapter } from './adapters/kto.js';
import { EstrelaBetAdapter } from './adapters/estrelabet.js';
import { BrasileiraoAdapter } from './adapters/brasileirao.js';
import * as fs from 'fs';
import * as path from 'path';

const SESSIONS_DIR = path.resolve(process.cwd(), 'data', 'sessions');
const LOG_DIR      = path.resolve(process.cwd(), 'data', 'bet_logs');

export const ADAPTERS: Record<string, BookmakerAdapterClass> = {
  betano:       BetanoAdapter,
  bet365:       Bet365Adapter,
  superbet:     SuperbetAdapter,
  kto:          KTO_Adapter,
  estrelabet:   EstrelaBetAdapter,
  brasileirao:  BrasileiraoAdapter,
};

export interface BookmakerAdapterClass {
  new (page: Page): BookmakerAdapter;
}

export interface BookmakerAdapter {
  login(username: string, password: string): Promise<boolean>;
  isLoggedIn(): Promise<boolean>;
  getBalance(): Promise<number | null>;
  placeBet(order: BetOrder): Promise<BetResult>;
  searchMatch(homeTeam: string, awayTeam: string): Promise<string | null>;
}

// ── Gerenciador de sessões ────────────────────────────────────

export class AutomationEngine {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private status: Map<string, AutomationStatus> = new Map();

  async init() {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    fs.mkdirSync(LOG_DIR,      { recursive: true });

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1366,768',
      ],
    });

    console.log('[AutoEngine] Browser iniciado');
  }

  async shutdown() {
    for (const ctx of this.contexts.values()) {
      await ctx.close().catch(() => {});
    }
    await this.browser?.close().catch(() => {});
    this.browser = null;
    console.log('[AutoEngine] Encerrado');
  }

  // ── Cria ou recupera contexto para uma casa ──────────────────

  async getContext(bookmaker: string): Promise<BrowserContext> {
    if (this.contexts.has(bookmaker)) {
      return this.contexts.get(bookmaker)!;
    }

    if (!this.browser) await this.init();

    const sessionFile = path.join(SESSIONS_DIR, `${bookmaker}.json`);
    const storageState = fs.existsSync(sessionFile) ? sessionFile : undefined;

    const ctx = await this.browser!.newContext({
      storageState,
      viewport: { width: 1366, height: 768 },
      userAgent: randomUserAgent(),
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      geolocation: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    // Injeta scripts anti-detecção em toda nova página
    await ctx.addInitScript(() => {
      // Remove o navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Simula plugins reais
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin' },
          { name: 'Chrome PDF Viewer' },
          { name: 'Native Client' },
        ],
      });
      // Canvas fingerprint sutil (pequena variação)
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
        const ctx = origGetContext.call(this, type, ...args) as CanvasRenderingContext2D | null;
        if (type === '2d' && ctx) {
          const origFillText = ctx.fillText.bind(ctx);
          ctx.fillText = function(...a: Parameters<typeof origFillText>) {
            ctx.shadowColor = `rgba(0,0,0,${Math.random() * 0.001})`;
            return origFillText(...a);
          };
        }
        return ctx;
      };
    });

    this.contexts.set(bookmaker, ctx);
    return ctx;
  }

  // ── Salva sessão (cookies + localStorage) ────────────────────

  async saveSession(bookmaker: string) {
    const ctx = this.contexts.get(bookmaker);
    if (!ctx) return;
    const sessionFile = path.join(SESSIONS_DIR, `${bookmaker}.json`);
    await ctx.storageState({ path: sessionFile });
    console.log(`[AutoEngine] Sessão salva: ${bookmaker}`);
  }

  // ── Login em uma casa ────────────────────────────────────────

  async login(account: BookmakerAccount): Promise<{ success: boolean; message: string }> {
    const AdapterClass = ADAPTERS[account.bookmaker];
    if (!AdapterClass) {
      return { success: false, message: `Casa "${account.bookmaker}" não suportada` };
    }

    this.setStatus(account.bookmaker, { state: 'logging_in', message: 'Fazendo login...' });

    try {
      const ctx  = await this.getContext(account.bookmaker);
      const page = await ctx.newPage();

      const adapter = new AdapterClass(page);

      // Verifica se já está logado (sessão salva)
      const alreadyLoggedIn = await adapter.isLoggedIn().catch(() => false);
      if (alreadyLoggedIn) {
        await page.close();
        this.setStatus(account.bookmaker, { state: 'ready', message: 'Sessão ativa' });
        return { success: true, message: 'Sessão já ativa' };
      }

      const ok = await adapter.login(account.username, account.password);
      if (ok) {
        await this.saveSession(account.bookmaker);
        await page.close();
        this.setStatus(account.bookmaker, { state: 'ready', message: 'Login realizado' });
        return { success: true, message: 'Login realizado com sucesso' };
      } else {
        await page.close();
        this.setStatus(account.bookmaker, { state: 'error', message: 'Falha no login' });
        return { success: false, message: 'Credenciais inválidas ou CAPTCHA detectado' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus(account.bookmaker, { state: 'error', message: msg });
      return { success: false, message: msg };
    }
  }

  // ── Executar aposta ──────────────────────────────────────────

  async placeBet(
    bookmaker: string,
    order: BetOrder,
  ): Promise<BetResult> {
    const AdapterClass = ADAPTERS[bookmaker];
    if (!AdapterClass) {
      return { success: false, bookmaker, error: `Casa "${bookmaker}" não suportada`, order };
    }

    this.setStatus(bookmaker, { state: 'placing_bet', message: `Apostando: ${order.matchLabel}` });

    const ctx  = await this.getContext(bookmaker);
    const page = await ctx.newPage();

    try {
      const adapter = new AdapterClass(page);

      // Verifica login antes de apostar
      const loggedIn = await adapter.isLoggedIn().catch(() => false);
      if (!loggedIn) {
        await page.close();
        return { success: false, bookmaker, error: 'Sessão expirada — faça login novamente', order };
      }

      const result = await adapter.placeBet(order);

      // Salva sessão atualizada após aposta
      await this.saveSession(bookmaker);
      await page.close();

      // Log da aposta
      this.logBet(bookmaker, order, result);

      this.setStatus(bookmaker, {
        state: 'ready',
        message: result.success ? `Aposta realizada: ${result.betId}` : `Falha: ${result.error}`,
      });

      return result;
    } catch (err) {
      await page.close().catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus(bookmaker, { state: 'error', message: msg });
      return { success: false, bookmaker, error: msg, order };
    }
  }

  // ── Consultar saldo ──────────────────────────────────────────

  async getBalance(bookmaker: string): Promise<number | null> {
    const AdapterClass = ADAPTERS[bookmaker];
    if (!AdapterClass) return null;

    const ctx  = await this.getContext(bookmaker);
    const page = await ctx.newPage();

    try {
      const adapter = new AdapterClass(page);
      const balance = await adapter.getBalance();
      await page.close();
      return balance;
    } catch {
      await page.close().catch(() => {});
      return null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private setStatus(bookmaker: string, status: AutomationStatus) {
    this.status.set(bookmaker, { ...status, updatedAt: new Date().toISOString() });
  }

  getStatus(bookmaker: string): AutomationStatus | null {
    return this.status.get(bookmaker) ?? null;
  }

  getAllStatus(): Record<string, AutomationStatus> {
    return Object.fromEntries(this.status.entries());
  }

  private logBet(bookmaker: string, order: BetOrder, result: BetResult) {
    const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0,10)}.jsonl`);
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      bookmaker,
      match: order.matchLabel,
      market: order.marketLabel,
      odds: order.odds,
      stake: order.stake,
      success: result.success,
      betId: result.betId,
      error: result.error,
    });
    fs.appendFileSync(logFile, entry + '\n');
  }
}

// ── Singleton ─────────────────────────────────────────────────
export const engine = new AutomationEngine();

// ── User agents realistas ─────────────────────────────────────
function randomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}
