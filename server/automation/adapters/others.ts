/**
 * Rapha Guru — Superbet, KTO, EstrelaBet Adapters v3.0
 * Seletores com múltiplos fallbacks — estrutura idêntica ao Betano
 */

import type { Page } from 'playwright';
import type { BookmakerAdapter } from '../engine.js';
import type { BetOrder, BetResult } from '../types.js';
import { trySelectors, fillStakeInput, waitForSelector, hasCaptcha, DELAYS, humanDelay, humanClick } from '../human.js';

// ── Base adapter com lógica compartilhada ─────────────────────
abstract class BaseAdapter implements BookmakerAdapter {
  abstract BASE: string;
  abstract SPORTS_PATH: string;
  abstract NAME: string;

  abstract SEL: {
    balance: string[];
    loginBtn: string[];
    username: string[];
    password: string[];
    submit: string[];
    stake: string[];
    confirm: string[];
    success: string[];
    error: string[];
    betslip: string[];
  };

  constructor(protected page: Page) {}

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      for (const sel of this.SEL.balance) {
        if (await this.page.$(sel)) return true;
      }
      return false;
    } catch { return false; }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      if (await hasCaptcha(this.page)) return false;

      await trySelectors(this.page, this.SEL.loginBtn, 'click', undefined, 5000);
      await DELAYS.afterPageLoad();

      const userOk = await trySelectors(this.page, this.SEL.username, 'fill', username, 5000);
      if (!userOk) throw new Error('Campo usuário não encontrado');
      await humanDelay(500, 150);

      const passOk = await trySelectors(this.page, this.SEL.password, 'fill', password, 5000);
      if (!passOk) throw new Error('Campo senha não encontrado');
      await DELAYS.beforeClick();

      await trySelectors(this.page, this.SEL.submit, 'click', undefined, 5000);
      await DELAYS.afterLogin();
      return await this.isLoggedIn();
    } catch { return false; }
  }

  async getBalance(): Promise<number | null> {
    try {
      for (const sel of this.SEL.balance) {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent() ?? '';
          const m = text.match(/[\d.,]+/);
          if (m) return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
        }
      }
      return null;
    } catch { return null; }
  }

  async searchMatch(homeTeam: string, awayTeam: string): Promise<string | null> {
    try {
      await this.page.goto(`${this.BASE}${this.SPORTS_PATH}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      const links = await this.page.$$('a[href*="futebol"], a[href*="soccer"], a[href*="football"]');
      for (const link of links) {
        const txt = (await link.textContent() ?? '').toLowerCase();
        if (txt.includes(homeTeam.toLowerCase()) || txt.includes(awayTeam.toLowerCase())) {
          return await link.getAttribute('href');
        }
      }
      return null;
    } catch { return null; }
  }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    try {
      await this.page.goto(`${this.BASE}${this.SPORTS_PATH}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      const matchUrl = await this.searchMatch(order.homeTeam, order.awayTeam);
      if (matchUrl) {
        const full = matchUrl.startsWith('http') ? matchUrl : `${this.BASE}${matchUrl}`;
        await this.page.goto(full, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await DELAYS.afterPageLoad();
      }

      // Find market — try multiple texts
      const marketTexts = this.getMarketTexts(order);
      let clicked = false;
      for (const text of marketTexts) {
        try {
          const el = await this.page.locator(`text="${text}"`).first().elementHandle({ timeout: 2000 });
          if (el) { await humanClick(this.page, `text="${text}"`); clicked = true; break; }
        } catch { continue; }
      }

      if (!clicked) {
        // Fallback: any odds button matching the label
        const btns = await this.page.$$('button[class*="odd" i], button[class*="bet" i], [data-testid*="odd"]');
        for (const btn of btns) {
          const txt = (await btn.textContent() ?? '').toLowerCase();
          if (marketTexts.some(t => txt.includes(t.toLowerCase()))) {
            await btn.click(); clicked = true; break;
          }
        }
      }

      if (!clicked) {
        return { success: false, bookmaker: this.NAME, order, error: `Mercado não encontrado: ${order.marketLabel}`, errorCode: 'MARKET_CLOSED', timestamp: ts };
      }

      const betslipOk = await waitForSelector(this.page, this.SEL.betslip.join(', '), 10000);
      if (!betslipOk) {
        return { success: false, bookmaker: this.NAME, order, error: 'Betslip não apareceu', errorCode: 'CONFIRM_FAILED', timestamp: ts };
      }
      await humanDelay(800, 200);

      const stakeOk = await trySelectors(this.page, this.SEL.stake, 'fill', order.stake.toFixed(2).replace('.', ','), 5000);
      if (!stakeOk) {
        return { success: false, bookmaker: this.NAME, order, error: 'Campo de valor não encontrado', errorCode: 'CONFIRM_FAILED', timestamp: ts };
      }

      await DELAYS.beforeBetConfirm();

      const confirmOk = await trySelectors(this.page, this.SEL.confirm, 'click', undefined, 6000);
      if (!confirmOk) {
        return { success: false, bookmaker: this.NAME, order, error: 'Botão confirmar não encontrado', errorCode: 'CONFIRM_FAILED', timestamp: ts };
      }
      await DELAYS.afterBetConfirm();

      // Check success
      for (const sel of this.SEL.success) {
        const el = await this.page.$(sel);
        if (el) {
          return { success: true, bookmaker: this.NAME, order, betId: `${this.NAME.toUpperCase()}_${Date.now()}`, confirmedOdds: order.odds, confirmedStake: order.stake, timestamp: ts };
        }
      }

      // Check error
      for (const sel of this.SEL.error) {
        const el = await this.page.$(sel);
        if (el) {
          const msg = await el.textContent();
          return { success: false, bookmaker: this.NAME, order, error: msg?.trim() ?? 'Erro desconhecido', errorCode: 'CONFIRM_FAILED', timestamp: ts };
        }
      }

      return { success: false, bookmaker: this.NAME, order, error: 'Confirmação não detectada', errorCode: 'CONFIRM_FAILED', timestamp: ts };

    } catch (err) {
      return { success: false, bookmaker: this.NAME, order, error: err instanceof Error ? err.message : String(err), errorCode: 'NETWORK_ERROR', timestamp: ts };
    }
  }

  protected getMarketTexts(order: BetOrder): string[] {
    const lineMatch = order.marketLabel.match(/(\d+\.?\d*)/);
    const line = lineMatch ? lineMatch[1] : '2.5';
    const map: Record<string, string[]> = {
      result:     order.selection === 'home' ? [order.homeTeam, '1'] : order.selection === 'away' ? [order.awayTeam, '2'] : ['Empate', 'X'],
      over_goals: [`Mais de ${line}`, `Over ${line}`, `+${line} gols`],
      btts:       ['Ambos marcam - Sim', 'Ambas marcam - Sim', 'Sim'],
      corners:    [`Mais de ${line}`, `Over ${line} escanteios`],
      cards:      [`Mais de ${line}`, 'Cartões'],
    };
    return map[order.marketType] ?? [order.marketLabel, order.selection];
  }
}

// ── SUPERBET ─────────────────────────────────────────────────
export class SuperbetAdapter extends BaseAdapter {
  BASE = 'https://superbet.bet.br';
  SPORTS_PATH = '/pt-br/esportes/futebol';
  NAME = 'superbet';
  SEL = {
    balance:  ['[class*="balance" i]', '[class*="Balance"]', '[data-testid*="balance"]', '[class*="saldo"]'],
    loginBtn: ['button:has-text("Entrar")', '[class*="loginBtn"]', '[data-testid="login"]', '[class*="Login"]'],
    username: ['input[type="email"]', 'input[name="username"]', 'input[name="login"]', 'input[placeholder*="email" i]'],
    password: ['input[type="password"]', 'input[name="password"]'],
    submit:   ['button[type="submit"]', 'button:has-text("Entrar")', 'button:has-text("Login")'],
    stake:    ['input[class*="stake" i]', 'input[placeholder*="Valor" i]', 'input[class*="amount" i]', '[class*="betslip" i] input[type="number"]'],
    confirm:  ['button:has-text("Confirmar aposta")', 'button:has-text("Fazer aposta")', 'button:has-text("Apostar")', 'button:has-text("Confirmar")', '[class*="confirmBet"]', '[class*="ConfirmBet"]'],
    success:  ['[class*="success" i]', 'text="Aposta realizada"', 'text="Apostado"', '[class*="confirmation" i]'],
    error:    ['[class*="error" i]', '[role="alert"]', '[class*="Alert"]'],
    betslip:  ['[class*="betslip" i]', '[class*="Betslip"]', '[class*="BetSlip"]', '[data-testid*="betslip"]'],
  };
}

// ── KTO ───────────────────────────────────────────────────────
export class KTO_Adapter extends BaseAdapter {
  BASE = 'https://www.kto.bet.br';
  SPORTS_PATH = '/sports/futebol';
  NAME = 'kto';
  SEL = {
    balance:  ['[class*="balance" i]', '[class*="Balance"]', '[data-qa*="balance"]', '.header-balance'],
    loginBtn: ['button:has-text("Entrar")', '[class*="loginButton"]', '.login-button', 'a[href*="login"]'],
    username: ['input[name="username"]', 'input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'],
    password: ['input[type="password"]', 'input[name="password"]'],
    submit:   ['button[type="submit"]', 'button:has-text("Entrar")', 'button:has-text("Confirmar")'],
    stake:    ['input[class*="stake" i]', 'input[placeholder*="Valor" i]', 'input[data-qa*="stake"]', '[class*="betslip" i] input'],
    confirm:  ['button:has-text("Confirmar")', 'button:has-text("Fazer aposta")', 'button:has-text("Apostar")', '[data-qa*="place-bet"]', '[class*="placeBet"]'],
    success:  ['[class*="success" i]', 'text="Aposta confirmada"', 'text="Aposta realizada"', '[class*="receipt"]'],
    error:    ['[class*="error" i]', '[role="alert"]'],
    betslip:  ['[class*="betslip" i]', '[class*="BetSlip"]', '.bet-slip'],
  };
}

// ── ESTRELABET ────────────────────────────────────────────────
export class EstrelaBetAdapter extends BaseAdapter {
  BASE = 'https://www.estrelabet.bet.br';
  SPORTS_PATH = '/sports/football';
  NAME = 'estrelabet';
  SEL = {
    balance:  ['[class*="balance" i]', '[class*="Balance"]', '[class*="saldo"]'],
    loginBtn: ['button:has-text("Entrar")', '[class*="login"]', 'a[href*="login"]'],
    username: ['input[name="username"]', 'input[type="email"]', 'input[placeholder*="email" i]'],
    password: ['input[type="password"]', 'input[name="password"]'],
    submit:   ['button[type="submit"]', 'button:has-text("Entrar")', 'button:has-text("Login")'],
    stake:    ['input[class*="stake" i]', 'input[placeholder*="Valor" i]', '[class*="betslip" i] input[type="number"]'],
    confirm:  ['button:has-text("Confirmar")', 'button:has-text("Apostar")', 'button:has-text("Fazer aposta")', '[class*="confirmBet"]'],
    success:  ['[class*="success" i]', 'text="Aposta realizada"', '[class*="confirmation"]'],
    error:    ['[class*="error" i]', '[role="alert"]'],
    betslip:  ['[class*="betslip" i]', '[class*="BetSlip"]'],
  };
}
