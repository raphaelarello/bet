/**
 * Rapha Guru — Betano Adapter v3.0
 * Seletores com múltiplos fallbacks + verificação de odd + extração robusta de betId
 */

import type { Page } from 'playwright';
import type { BookmakerAdapter } from '../engine.js';
import type { BetOrder, BetResult } from '../types.js';
import { humanDelay, humanType, humanClick, humanScroll, fillStakeInput, waitForSelector, hasCaptcha, trySelectors, DELAYS } from '../human.js';

const BASE = 'https://www.betano.bet.br';

const SEL = {
  balance:  ['[data-testid="header-balance"]', '.user-balance', '[class*="userBalance"]', '[class*="balance__amount"]', '[class*="Balance"]'],
  loginBtn: ['button[data-testid="login-button"]', 'button[class*="login"]', '[class*="LoginButton"]', 'button:has-text("Entrar")', 'button:has-text("Login")'],
  username: ['input[name="username"]', 'input[name="email"]', 'input[type="email"]', 'input[data-testid="username"]', 'input[placeholder*="mail" i]', 'input[autocomplete="username"]'],
  password: ['input[name="password"]', 'input[type="password"]', 'input[data-testid="password"]', 'input[autocomplete="current-password"]'],
  submit:   ['button[type="submit"]', 'button[data-testid="login-submit"]', 'button:has-text("Entrar")', 'button:has-text("Fazer login")', '[class*="SubmitButton"]'],
  search:   ['[data-testid="search-input"]', 'input[placeholder*="Pesquisar" i]', 'input[placeholder*="Buscar" i]', 'input[type="search"]', '[class*="SearchInput"]'],
  stake:    ['input[data-testid="stake-input"]', 'input[class*="stakeInput"]', 'input[class*="StakeInput"]', 'input[placeholder*="Valor" i]', '[class*="betslip"] input[type="number"]', '[class*="Betslip"] input[type="text"]'],
  confirm:  ['button[data-testid="place-bet"]', 'button[data-testid="confirm-bet"]', 'button:has-text("Fazer aposta")', 'button:has-text("Confirmar aposta")', 'button:has-text("Apostar")', '[class*="PlaceBet"]'],
  betslip:  ['[class*="betslip"]', '[class*="Betslip"]', '[data-testid*="betslip"]', '[class*="BetSlip"]'],
  success:  ['[data-testid="bet-confirmation"]', '[class*="BetConfirmation"]', '[class*="successMessage"]', '[class*="success"]', 'text="Aposta realizada"', 'text="Aposta colocada"', 'text="Apostas colocadas"'],
  error:    ['[data-testid="error-message"]', '[class*="errorMessage"]', '[role="alert"]', '[class*="Error"]:not([class*="errorBoundary"])'],
  odds:     ['[data-testid="betslip-odds"]', '[class*="betslip"] [class*="odds"]', '[class*="BetslipOdds"]', '[class*="SelectionOdds"]'],
};

export class BetanoAdapter implements BookmakerAdapter {
  constructor(private page: Page) {}

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${BASE}/pt-br/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      for (const sel of SEL.balance) {
        if (await this.page.$(sel)) return true;
      }
      return false;
    } catch { return false; }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      await this.page.goto(`${BASE}/pt-br/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      if (await hasCaptcha(this.page)) { console.warn('[Betano] CAPTCHA detectado'); return false; }

      // Click login
      const loginClicked = await trySelectors(this.page, SEL.loginBtn, 'click', undefined, 4000);
      if (!loginClicked) {
        await this.page.goto(`${BASE}/pt-br/login/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }
      await DELAYS.afterPageLoad();

      // Fill credentials
      const userOk = await trySelectors(this.page, SEL.username, 'fill', username, 5000);
      if (!userOk) throw new Error('Campo usuário não encontrado');
      await humanDelay(500, 150);

      const passOk = await trySelectors(this.page, SEL.password, 'fill', password, 5000);
      if (!passOk) throw new Error('Campo senha não encontrado');
      await DELAYS.beforeClick();

      const submitOk = await trySelectors(this.page, SEL.submit, 'click', undefined, 4000);
      if (!submitOk) throw new Error('Botão submit não encontrado');
      await DELAYS.afterLogin();

      // Check for 2FA
      const has2fa = await this.page.$('input[data-testid*="otp"], input[placeholder*="código" i], input[placeholder*="OTP" i]').catch(() => null);
      if (has2fa) { console.warn('[Betano] 2FA detectado — login manual necessário'); return false; }

      return await this.isLoggedIn();
    } catch (err) {
      console.error('[Betano] Erro no login:', err);
      return false;
    }
  }

  async getBalance(): Promise<number | null> {
    try {
      await this.page.goto(`${BASE}/pt-br/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      for (const sel of SEL.balance) {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent() ?? '';
          const match = text.match(/[\d.,]+/);
          if (match) return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
        }
      }
      return null;
    } catch { return null; }
  }

  async searchMatch(homeTeam: string, awayTeam: string): Promise<string | null> {
    try {
      await this.page.goto(`${BASE}/pt-br/sports/futebol/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();

      // Try search box
      for (const sel of SEL.search) {
        try {
          await humanType(this.page, sel, homeTeam, { timeout: 3000 });
          await DELAYS.afterSearch();

          // Look for the match in results
          const terms = [homeTeam, `${homeTeam} vs`, `${homeTeam} x`, awayTeam];
          for (const term of terms) {
            try {
              const links = await this.page.$$(`a[href*="futebol"]`);
              for (const link of links) {
                const text = (await link.textContent() ?? '').toLowerCase();
                if (text.includes(homeTeam.toLowerCase()) || text.includes(awayTeam.toLowerCase())) {
                  return await link.getAttribute('href');
                }
              }
            } catch { continue; }
          }
          break;
        } catch { continue; }
      }
      return null;
    } catch { return null; }
  }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    try {
      // Navigate to football
      await this.page.goto(`${BASE}/pt-br/sports/futebol/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      // Find match
      const matchUrl = await this.searchMatch(order.homeTeam, order.awayTeam);
      if (matchUrl) {
        const fullUrl = matchUrl.startsWith('http') ? matchUrl : `${BASE}${matchUrl}`;
        await this.page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await DELAYS.afterPageLoad();
      } else {
        // Scroll to find match in list
        await humanScroll(this.page, 300);
        await humanDelay(800, 200);
      }

      // Click the market
      const marketClicked = await this.findAndClickMarket(order);
      if (!marketClicked) {
        return { success: false, bookmaker: 'betano', order, error: `Mercado não encontrado: ${order.marketLabel}`, errorCode: 'MARKET_CLOSED', timestamp: ts };
      }

      // Wait for betslip
      const betslipOk = await waitForSelector(this.page, SEL.betslip.join(', '), 10000);
      if (!betslipOk) {
        return { success: false, bookmaker: 'betano', order, error: 'Betslip não apareceu', errorCode: 'CONFIRM_FAILED', timestamp: ts };
      }
      await humanDelay(900, 250);

      // Fill stake
      const stakeOk = await this.fillStake(order.stake);
      if (!stakeOk) {
        return { success: false, bookmaker: 'betano', order, error: 'Campo de valor não encontrado', errorCode: 'CONFIRM_FAILED', timestamp: ts };
      }

      await DELAYS.beforeBetConfirm();

      // Verify current odds — cancel if slippage > threshold
      const currentOdds = await this.getCurrentOdds();
      const maxSlippage = order.maxOddsSlippage ?? 0.03;
      if (currentOdds && currentOdds < order.odds * (1 - maxSlippage)) {
        return {
          success: false, bookmaker: 'betano', order,
          error: `Odd caiu além do limite: esperada ${order.odds.toFixed(2)}, atual ${currentOdds.toFixed(2)}`,
          errorCode: 'ODDS_CHANGED', timestamp: ts,
        };
      }

      // Verify min/max odds from account config (passed via order extra fields)
      if (currentOdds && order.odds > 0) {
        const diff = Math.abs(currentOdds - order.odds) / order.odds;
        if (diff > 0.05) {
          return {
            success: false, bookmaker: 'betano', order,
            error: `Odd com variação excessiva (${(diff*100).toFixed(1)}%)`,
            errorCode: 'ODDS_CHANGED', timestamp: ts,
          };
        }
      }

      // Confirm
      const confirmOk = await trySelectors(this.page, SEL.confirm, 'click', undefined, 6000);
      if (!confirmOk) {
        return { success: false, bookmaker: 'betano', order, error: 'Botão de confirmação não encontrado', errorCode: 'CONFIRM_FAILED', timestamp: ts };
      }
      await DELAYS.afterBetConfirm();

      // Check success
      const betId = await this.extractBetId();
      if (betId) {
        return { success: true, bookmaker: 'betano', order, betId, confirmedOdds: currentOdds ?? order.odds, confirmedStake: order.stake, timestamp: ts };
      }

      // Check error
      const errMsg = await this.extractError();
      return { success: false, bookmaker: 'betano', order, error: errMsg ?? 'Confirmação não detectada', errorCode: 'CONFIRM_FAILED', timestamp: ts };

    } catch (err) {
      return { success: false, bookmaker: 'betano', order, error: err instanceof Error ? err.message : String(err), errorCode: 'NETWORK_ERROR', timestamp: ts };
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private async findAndClickMarket(order: BetOrder): Promise<boolean> {
    const marketTexts: Record<string, string[]> = {
      result:     order.selection === 'home' ? [order.homeTeam, '1'] : order.selection === 'away' ? [order.awayTeam, '2'] : ['Empate', 'X'],
      over_goals: [`Mais de ${this.lineFromLabel(order.marketLabel)}`, `Over ${this.lineFromLabel(order.marketLabel)}`, `+${this.lineFromLabel(order.marketLabel)}`],
      btts:       ['Ambas as equipes marcam - Sim', 'Ambos marcam - Sim', 'Sim'],
      corners:    [`Mais de ${this.lineFromLabel(order.marketLabel)} escanteios`, `Over ${this.lineFromLabel(order.marketLabel)} escanteios`, 'Escanteios'],
      cards:      [`Mais de ${this.lineFromLabel(order.marketLabel)} cartões`, 'Cartões'],
      handicap:   [order.marketLabel, `Handicap ${this.lineFromLabel(order.marketLabel)}`],
      halftime:   ['1º Tempo', 'Intervalo', 'Primeiro Tempo'],
    };

    const texts = marketTexts[order.marketType] ?? [order.marketLabel, order.selection];

    for (const text of texts) {
      try {
        const el = await this.page.locator(`text="${text}"`).first().elementHandle({ timeout: 2000 });
        if (el) { await humanClick(this.page, `text="${text}"`); return true; }
      } catch { continue; }
    }

    // Fallback: look for odds button with similar text
    try {
      const buttons = await this.page.$$('button[class*="odd"], button[class*="Odd"], [data-testid*="odd"]');
      for (const btn of buttons) {
        const txt = (await btn.textContent() ?? '').trim();
        if (texts.some(t => txt.toLowerCase().includes(t.toLowerCase()))) {
          await btn.click();
          return true;
        }
      }
    } catch {}

    return false;
  }

  private lineFromLabel(label: string): string {
    const match = label.match(/(\d+\.?\d*)/);
    return match ? match[1] : '2.5';
  }

  private async fillStake(stake: number): Promise<boolean> {
    for (const sel of SEL.stake) {
      try {
        await fillStakeInput(this.page, sel, stake);
        return true;
      } catch { continue; }
    }
    return false;
  }

  private async getCurrentOdds(): Promise<number | null> {
    for (const sel of SEL.odds) {
      try {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent() ?? '';
          const match = text.match(/[\d.]+/);
          if (match) return parseFloat(match[0]);
        }
      } catch { continue; }
    }
    return null;
  }

  private async extractBetId(): Promise<string | null> {
    for (const sel of SEL.success) {
      try {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent() ?? '';
          const idMatch = text.match(/[A-Z0-9]{6,20}/);
          return idMatch ? idMatch[0] : `BETANO_${Date.now()}`;
        }
      } catch { continue; }
    }
    return null;
  }

  private async extractError(): Promise<string | null> {
    for (const sel of SEL.error) {
      try {
        const el = await this.page.$(sel);
        if (el) return (await el.textContent())?.trim() ?? null;
      } catch { continue; }
    }
    return null;
  }
}
