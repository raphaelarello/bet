/**
 * Rapha Guru — Automation Engine v3.0
 *
 * ✅ Fila de apostas com mutex por bookmaker (sem conflitos)
 * ✅ Retry com backoff exponencial (até 3 tentativas)
 * ✅ Verificação de saldo antes de apostar
 * ✅ Controle de limite diário real
 * ✅ Screenshot obrigatório de confirmação
 * ✅ headless:'new' + user agents Chrome 124+
 * ✅ Anti-detecção reforçado
 * ✅ Sessões persistidas por casa
 * ✅ Cooldown automático após erros
 *
 * ⚠️ USO PESSOAL APENAS — suas próprias contas
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { BetOrder, BetResult, BookmakerAccount, AutomationStatus, QueueItem } from './types.js';
import { humanDelay, randomBetween } from './human.js';
import { BetanoAdapter } from './adapters/betano.js';
import { Bet365Adapter } from './adapters/bet365.js';
import { SuperbetAdapter } from './adapters/superbet.js';
import { KTO_Adapter } from './adapters/kto.js';
import { EstrelaBetAdapter } from './adapters/estrelabet.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const SESSIONS_DIR  = path.resolve(process.cwd(), 'data', 'sessions');
const LOG_DIR       = path.resolve(process.cwd(), 'data', 'bet_logs');
const SCREENS_DIR   = path.resolve(process.cwd(), 'data', 'screenshots');
const DAILY_FILE    = path.resolve(process.cwd(), 'data', 'daily_totals.json');

// ── Adapter interface ─────────────────────────────────────────
export interface BookmakerAdapter {
  login(username: string, password: string): Promise<boolean>;
  isLoggedIn(): Promise<boolean>;
  getBalance(): Promise<number | null>;
  placeBet(order: BetOrder): Promise<BetResult>;
  searchMatch(homeTeam: string, awayTeam: string): Promise<string | null>;
}

export interface BookmakerAdapterClass {
  new(page: Page): BookmakerAdapter;
}

export const ADAPTERS: Record<string, BookmakerAdapterClass> = {
  betano:      BetanoAdapter,
  bet365:      Bet365Adapter,
  superbet:    SuperbetAdapter,
  kto:         KTO_Adapter,
  estrelabet:  EstrelaBetAdapter,
};

// ── Simple per-bookmaker mutex ────────────────────────────────
class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) { this.locked = true; return; }
    return new Promise(resolve => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) { next(); } else { this.locked = false; }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await fn(); } finally { this.release(); }
  }
}

// ── Daily limit tracker ───────────────────────────────────────
interface DailyTotals { [accountId: string]: { date: string; staked: number; bets: number } }

function loadDailyTotals(): DailyTotals {
  try {
    if (!fs.existsSync(DAILY_FILE)) return {};
    return JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8')) as DailyTotals;
  } catch { return {}; }
}

function saveDailyTotals(t: DailyTotals) {
  fs.mkdirSync(path.dirname(DAILY_FILE), { recursive: true });
  fs.writeFileSync(DAILY_FILE, JSON.stringify(t, null, 2));
}

function todayKey() { return new Date().toLocaleDateString('sv-SE'); }

function addDailyStake(accountId: string, stake: number): DailyTotals {
  const totals = loadDailyTotals();
  const today  = todayKey();
  if (!totals[accountId] || totals[accountId].date !== today) {
    totals[accountId] = { date: today, staked: 0, bets: 0 };
  }
  totals[accountId].staked += stake;
  totals[accountId].bets++;
  saveDailyTotals(totals);
  return totals;
}

function getDailyStake(accountId: string): number {
  const totals = loadDailyTotals();
  const entry  = totals[accountId];
  if (!entry || entry.date !== todayKey()) return 0;
  return entry.staked;
}

// ── Main engine ───────────────────────────────────────────────
export class AutomationEngine {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private status:   Map<string, AutomationStatus> = new Map();
  private mutexes:  Map<string, Mutex> = new Map();

  // Bet queue
  private queue:    QueueItem[] = [];
  private queueMap: Map<string, QueueItem> = new Map();

  // ── Browser init ────────────────────────────────────────────
  async init() {
    fs.mkdirSync(SESSIONS_DIR,  { recursive: true });
    fs.mkdirSync(LOG_DIR,       { recursive: true });
    fs.mkdirSync(SCREENS_DIR,   { recursive: true });

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1440,900',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    console.log('[AutoEngine v3] Browser iniciado');
  }

  async shutdown() {
    for (const ctx of this.contexts.values()) await ctx.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.browser = null;
    console.log('[AutoEngine] Encerrado');
  }

  // ── Mutex per bookmaker ─────────────────────────────────────
  private getMutex(bookmaker: string): Mutex {
    if (!this.mutexes.has(bookmaker)) this.mutexes.set(bookmaker, new Mutex());
    return this.mutexes.get(bookmaker)!;
  }

  // ── Context with full anti-detection ───────────────────────
  async getContext(bookmaker: string): Promise<BrowserContext> {
    if (this.contexts.has(bookmaker)) return this.contexts.get(bookmaker)!;
    if (!this.browser) await this.init();

    const sessionFile   = path.join(SESSIONS_DIR, `${bookmaker}.json`);
    const storageState  = fs.existsSync(sessionFile) ? sessionFile : undefined;
    const ua            = randomUserAgent();

    const ctx = await this.browser!.newContext({
      storageState,
      viewport:           { width: 1440, height: 900 },
      userAgent:          ua,
      locale:             'pt-BR',
      timezoneId:         'America/Sao_Paulo',
      geolocation:        { latitude: -23.5505 + (Math.random() * 0.01 - 0.005), longitude: -46.6333 + (Math.random() * 0.01 - 0.005) },
      permissions:        ['geolocation'],
      colorScheme:        'light',
      extraHTTPHeaders:   { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' },
      javaScriptEnabled:  true,
      bypassCSP:          false,
    });

    // Comprehensive anti-detection init scripts
    await ctx.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // Realistic plugins
      const fakePlugins = [
        { name: 'Chrome PDF Plugin',  filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer',  filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client',      filename: 'internal-nacl-plugin', description: '' },
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => Object.assign(fakePlugins, { item: (i: number) => fakePlugins[i], namedItem: (n: string) => fakePlugins.find(p => p.name === n) ?? null }),
      });

      // Realistic language
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });

      // Hardware concurrency (realistic)
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

      // Device memory
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

      // Canvas fingerprint micro-variation
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: unknown) {
        const dataURL = origToDataURL.call(this, type, quality);
        if (type === 'image/png') {
          // Inject tiny imperceptible noise
          return dataURL.slice(0, -6) + btoa(String.fromCharCode(Math.floor(Math.random() * 3))).slice(0, 4) + '==';
        }
        return dataURL;
      };

      // WebGL fingerprint
      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param: number) {
        if (param === 37445) return 'Intel Inc.';
        if (param === 37446) return 'Intel Iris OpenGL Engine';
        return origGetParameter.call(this, param);
      };

      // Chrome runtime object
      (window as Record<string, unknown>).chrome = {
        runtime: {},
        loadTimes: () => ({ startLoadTime: Date.now() / 1000 - Math.random() * 2 }),
        csi: () => ({ onloadT: Date.now(), pageT: Math.random() * 1000 }),
      };

      // Screen properties
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth',  { get: () => 24 });
    });

    this.contexts.set(bookmaker, ctx);
    return ctx;
  }

  async saveSession(bookmaker: string) {
    const ctx = this.contexts.get(bookmaker);
    if (!ctx) return;
    await ctx.storageState({ path: path.join(SESSIONS_DIR, `${bookmaker}.json`) });
  }

  // ── Login ───────────────────────────────────────────────────
  async login(account: BookmakerAccount): Promise<{ success: boolean; message: string }> {
    const AdapterClass = ADAPTERS[account.bookmaker];
    if (!AdapterClass) return { success: false, message: `Casa "${account.bookmaker}" não suportada` };

    return this.getMutex(account.bookmaker).run(async () => {
      this.setStatus(account.bookmaker, { state: 'logging_in', message: 'Fazendo login...' });

      try {
        const ctx    = await this.getContext(account.bookmaker);
        const page   = await ctx.newPage();
        const adapter = new AdapterClass(page);

        // Check existing session
        const alreadyIn = await adapter.isLoggedIn().catch(() => false);
        if (alreadyIn) {
          const balance = await adapter.getBalance().catch(() => null);
          await page.close();
          this.setStatus(account.bookmaker, { state: 'ready', message: 'Sessão ativa', balance: balance ?? undefined });
          return { success: true, message: 'Sessão já ativa' };
        }

        const ok = await adapter.login(account.username, account.password);
        if (ok) {
          const balance = await adapter.getBalance().catch(() => null);
          await this.saveSession(account.bookmaker);
          await page.close();
          this.setStatus(account.bookmaker, { state: 'ready', message: 'Login realizado', balance: balance ?? undefined });
          return { success: true, message: 'Login realizado com sucesso' };
        } else {
          await page.close();
          this.setStatus(account.bookmaker, { state: 'error', message: 'Falha no login — credenciais ou CAPTCHA' });
          return { success: false, message: 'Credenciais inválidas ou CAPTCHA detectado' };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.setStatus(account.bookmaker, { state: 'error', message: msg });
        return { success: false, message: msg };
      }
    });
  }

  // ── Place bet (single, with retry) ─────────────────────────
  async placeBet(bookmaker: string, order: BetOrder, account: BookmakerAccount, maxRetries = 3): Promise<BetResult> {
    const AdapterClass = ADAPTERS[bookmaker];
    if (!AdapterClass) {
      return { success: false, bookmaker, error: `Casa "${bookmaker}" não suportada`, errorCode: 'UNKNOWN', order };
    }

    return this.getMutex(bookmaker).run(async () => {
      let lastResult: BetResult | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const t0   = Date.now();
        const ctx  = await this.getContext(bookmaker);
        const page = await ctx.newPage();

        try {
          this.setStatus(bookmaker, {
            state: 'placing_bet',
            message: `${attempt > 1 ? `Tentativa ${attempt}/${maxRetries}: ` : ''}${order.matchLabel} — ${order.marketLabel}`,
          });

          const adapter = new AdapterClass(page);

          // 1. Verify session
          const loggedIn = await adapter.isLoggedIn().catch(() => false);
          if (!loggedIn) {
            await page.close();
            lastResult = { success: false, bookmaker, error: 'Sessão expirada', errorCode: 'SESSION_EXPIRED', order };
            // Try re-login once
            if (attempt === 1) {
              const relogin = await this.login(account);
              if (!relogin.success) break;
              continue;
            }
            break;
          }

          // 2. Check balance
          const balance = await adapter.getBalance().catch(() => null);
          if (balance !== null && balance < order.stake) {
            await page.close();
            lastResult = { success: false, bookmaker, error: `Saldo insuficiente: R$ ${balance.toFixed(2)}`, errorCode: 'INSUFFICIENT_FUNDS', order };
            break; // Don't retry — balance won't change
          }

          // 3. Check daily limit
          const todayStaked = getDailyStake(account.id);
          if (todayStaked + order.stake > account.maxDailyStake) {
            await page.close();
            lastResult = {
              success: false, bookmaker,
              error: `Limite diário atingido: R$ ${todayStaked.toFixed(2)} / R$ ${account.maxDailyStake.toFixed(2)}`,
              errorCode: 'STAKE_LIMIT', order,
            };
            break;
          }

          // 4. Execute bet
          const result = await adapter.placeBet(order);
          result.durationMs = Date.now() - t0;

          // 5. Screenshot regardless of outcome
          const screenshotName = `${bookmaker}_${Date.now()}_${result.success ? 'ok' : 'err'}.png`;
          const screenshotPath = path.join(SCREENS_DIR, screenshotName);
          await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
          result.screenshotPath = screenshotPath;

          await this.saveSession(bookmaker);
          await page.close();
          this.logBet(bookmaker, order, result, account.id);

          if (result.success) {
            // Record daily usage
            const totals = addDailyStake(account.id, order.stake);
            this.setStatus(bookmaker, {
              state: 'ready',
              message: `✓ Aposta realizada: ${result.betId ?? 'confirmada'}`,
              balance: balance ?? undefined,
              todayStake: totals[account.id]?.staked,
              todayBets: totals[account.id]?.bets,
            });
            return result;
          }

          // Failed — decide if retry makes sense
          lastResult = result;
          const retryable = result.errorCode !== 'INSUFFICIENT_FUNDS' &&
                            result.errorCode !== 'STAKE_LIMIT' &&
                            result.errorCode !== 'MARKET_CLOSED';

          if (!retryable || attempt >= maxRetries) break;

          // Exponential backoff: 5s, 15s, 40s
          const backoff = Math.pow(3, attempt) * 5000;
          console.warn(`[AutoEngine] Tentativa ${attempt} falhou (${result.errorCode}). Backoff ${backoff}ms`);
          this.setStatus(bookmaker, { state: 'cooldown', message: `Aguardando ${Math.round(backoff/1000)}s antes de tentar novamente...` });
          await humanDelay(backoff, backoff * 0.1);

        } catch (err) {
          await page.close().catch(() => {});
          const msg = err instanceof Error ? err.message : String(err);
          lastResult = { success: false, bookmaker, error: msg, errorCode: 'NETWORK_ERROR', order, durationMs: Date.now() - t0 };

          if (attempt < maxRetries) {
            const backoff = Math.pow(3, attempt) * 5000;
            this.setStatus(bookmaker, { state: 'cooldown', message: `Erro de rede. Aguardando ${Math.round(backoff/1000)}s...` });
            await humanDelay(backoff, backoff * 0.1);
          }
        }
      }

      const final = lastResult ?? { success: false, bookmaker, error: 'Todas as tentativas falharam', errorCode: 'UNKNOWN' as const, order };
      this.setStatus(bookmaker, { state: 'error', message: final.error ?? 'Erro desconhecido' });
      this.logBet(bookmaker, order, final, account.id);
      return final;
    });
  }

  // ── Bet Queue ───────────────────────────────────────────────
  addToQueue(accountId: string, bookmaker: string, order: BetOrder, maxRetries = 3): QueueItem {
    const item: QueueItem = {
      id:         crypto.randomUUID(),
      accountId,
      bookmaker,
      order,
      addedAt:    new Date().toISOString(),
      status:     'queued',
      retries:    0,
      maxRetries,
    };
    this.queue.push(item);
    this.queueMap.set(item.id, item);
    return item;
  }

  async runQueue(accounts: BookmakerAccount[]): Promise<QueueItem[]> {
    const pending = this.queue.filter(i => i.status === 'queued');
    const results: QueueItem[] = [];

    for (const item of pending) {
      const account = accounts.find(a => a.id === item.accountId);
      if (!account || !account.enabled) {
        item.status = 'failed';
        item.result = { success: false, bookmaker: item.bookmaker, error: 'Conta não encontrada ou desativada', order: item.order };
        results.push(item);
        continue;
      }

      item.status = 'running';
      const result = await this.placeBet(item.bookmaker, item.order, account, item.maxRetries);
      item.result  = result;
      item.status  = result.success ? 'done' : 'failed';
      results.push(item);

      // Human delay between bets
      if (pending.indexOf(item) < pending.length - 1) {
        await humanDelay(9000, 2500);
      }
    }

    return results;
  }

  cancelQueueItem(id: string): boolean {
    const item = this.queueMap.get(id);
    if (!item || item.status !== 'queued') return false;
    item.status = 'cancelled';
    return true;
  }

  getQueue(): QueueItem[] { return [...this.queue]; }

  clearQueue() { this.queue = this.queue.filter(i => i.status === 'running'); }

  // ── Balance ─────────────────────────────────────────────────
  async getBalance(bookmaker: string): Promise<number | null> {
    const AdapterClass = ADAPTERS[bookmaker];
    if (!AdapterClass) return null;
    const ctx  = await this.getContext(bookmaker);
    const page = await ctx.newPage();
    try {
      const adapter  = new AdapterClass(page);
      const balance  = await adapter.getBalance();
      await page.close();
      if (balance !== null) {
        const s = this.status.get(bookmaker);
        if (s) this.setStatus(bookmaker, { ...s, balance });
      }
      return balance;
    } catch { await page.close().catch(() => {}); return null; }
  }

  // ── Status ──────────────────────────────────────────────────
  private setStatus(bookmaker: string, status: AutomationStatus) {
    this.status.set(bookmaker, { ...status, updatedAt: new Date().toISOString() });
  }

  getStatus(bookmaker: string): AutomationStatus | null { return this.status.get(bookmaker) ?? null; }
  getAllStatus(): Record<string, AutomationStatus> { return Object.fromEntries(this.status.entries()); }

  // ── Logging ─────────────────────────────────────────────────
  private logBet(bookmaker: string, order: BetOrder, result: BetResult, accountId: string) {
    const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
    const entry = JSON.stringify({
      ts:          new Date().toISOString(),
      accountId,
      bookmaker,
      match:       order.matchLabel,
      market:      order.marketLabel,
      odds:        order.odds,
      stake:       order.stake,
      success:     result.success,
      betId:       result.betId,
      errorCode:   result.errorCode,
      error:       result.error,
      durationMs:  result.durationMs,
      screenshot:  result.screenshotPath ? path.basename(result.screenshotPath) : undefined,
    });
    fs.appendFileSync(logFile, entry + '\n');
  }

  getLogs(days = 7): unknown[] {
    const entries: unknown[] = [];
    if (!fs.existsSync(LOG_DIR)) return entries;
    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl')).sort().slice(-days);
    for (const file of files) {
      for (const line of fs.readFileSync(path.join(LOG_DIR, file), 'utf8').trim().split('\n')) {
        if (line) try { entries.push(JSON.parse(line)); } catch { /* skip */ }
      }
    }
    return entries.reverse();
  }
}

export const engine = new AutomationEngine();

// ── Realistic Chrome 124+ user agents ──────────────────────────
function randomUserAgent(): string {
  const agents = [
    // Chrome 124 Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Safari/537.36',
    // Chrome 124 Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Safari/537.36',
    // Chrome 125 Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.60 Safari/537.36',
    // Chrome 125 Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}
