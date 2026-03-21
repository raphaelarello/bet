/**
 * Rapha Guru — bet365 Adapter v3.0
 */
import type { Page } from 'playwright';
import type { BookmakerAdapter } from '../engine.js';
import type { BetOrder, BetResult } from '../types.js';
import { humanType, humanClick, fillStakeInput, waitForSelector, hasCaptcha, trySelectors, DELAYS, humanDelay } from '../human.js';

const BASE = 'https://www.bet365.bet.br';

export class Bet365Adapter implements BookmakerAdapter {
  constructor(private page: Page) {}

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${BASE}/#/HO/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      return !!(await this.page.$('.hm-BalanceWithBetslip_Balance, .hm-LoggedInHeader, [class*="BalanceWithBetslip"], [class*="LoggedIn"]'));
    } catch { return false; }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      await this.page.goto(`${BASE}/#/HO/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      if (await hasCaptcha(this.page)) return false;

      await trySelectors(this.page, [
        '.hm-LoginButton, [class*="LoginButton"]',
        'button:has-text("Entrar")',
        '[aria-label*="Login" i]',
      ], 'click', undefined, 8000);
      await DELAYS.afterPageLoad();

      await trySelectors(this.page, ['input[name="username"]', 'input[id*="username"]', 'input[placeholder*="Usuário" i]'], 'fill', username, 5000);
      await humanDelay(600, 150);
      await trySelectors(this.page, ['input[name="password"]', 'input[type="password"]'], 'fill', password, 5000);
      await DELAYS.beforeClick();
      await trySelectors(this.page, ['button[type="submit"]', '.lpb-LoginButtonV2', 'button:has-text("Entrar")'], 'click', undefined, 5000);
      await DELAYS.afterLogin();
      return await this.isLoggedIn();
    } catch { return false; }
  }

  async getBalance(): Promise<number | null> {
    try {
      const el = await this.page.$('.hm-BalanceWithBetslip_Balance, [class*="BalanceWithBetslip"]');
      if (!el) return null;
      const text = await el.textContent() ?? '';
      const m = text.match(/[\d.,]+/);
      return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
    } catch { return null; }
  }

  async searchMatch(homeTeam: string, awayTeam: string): Promise<string | null> {
    try {
      await this.page.goto(`${BASE}/#/SO/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      // bet365 search
      const searchOk = await trySelectors(this.page, [
        '.sm-Search, [class*="SearchBox"]',
        'button[aria-label*="Pesquisar" i]',
        '[class*="SearchIcon"]',
      ], 'click', undefined, 5000);

      if (searchOk) {
        await trySelectors(this.page, ['input[type="search"]', '.sm-SearchInput'], 'fill', homeTeam, 3000);
        await DELAYS.afterSearch();

        const links = await this.page.$$('a[href*="futebol"], a[href*="soccer"]');
        for (const link of links) {
          const txt = (await link.textContent() ?? '').toLowerCase();
          if (txt.includes(homeTeam.toLowerCase()) && txt.includes(awayTeam.toLowerCase())) {
            return await link.getAttribute('href');
          }
        }
      }
      return null;
    } catch { return null; }
  }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    try {
      await this.page.goto(`${BASE}/#/SO/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      const matchUrl = await this.searchMatch(order.homeTeam, order.awayTeam);
      if (matchUrl) {
        await this.page.goto(matchUrl.startsWith('http') ? matchUrl : `${BASE}${matchUrl}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await DELAYS.afterPageLoad();
      }

      const marketTexts = this.getMarketTexts(order);
      let clicked = false;
      for (const text of marketTexts) {
        try {
          const el = await this.page.locator(`text="${text}"`).first().elementHandle({ timeout: 2000 });
          if (el) { await humanClick(this.page, `text="${text}"`); clicked = true; break; }
        } catch { continue; }
      }
      if (!clicked) return { success: false, bookmaker: 'bet365', order, error: 'Mercado não encontrado', errorCode: 'MARKET_CLOSED', timestamp: ts };

      const betslipOk = await waitForSelector(this.page, '.bs-BetslipBox, [class*="BetslipBox"], .bss-StandardSinglesBet', 10000);
      if (!betslipOk) return { success: false, bookmaker: 'bet365', order, error: 'Betslip não apareceu', errorCode: 'CONFIRM_FAILED', timestamp: ts };

      await humanDelay(800, 200);

      const stakeOk = await trySelectors(this.page,
        ['input.bss-BetStakeInput, [class*="BetStakeInput"]', 'input[class*="stake" i]', '.bs-BetslipBox input[type="text"]'],
        'fill', order.stake.toFixed(2).replace('.', ','), 5000
      );
      if (!stakeOk) return { success: false, bookmaker: 'bet365', order, error: 'Campo stake não encontrado', errorCode: 'CONFIRM_FAILED', timestamp: ts };

      await DELAYS.beforeBetConfirm();

      const confirmOk = await trySelectors(this.page,
        ['.bs-PlaceBets, [class*="PlaceBets"]', 'button:has-text("Fazer aposta")', 'button:has-text("Confirmar")'],
        'click', undefined, 6000
      );
      if (!confirmOk) return { success: false, bookmaker: 'bet365', order, error: 'Confirmar não encontrado', errorCode: 'CONFIRM_FAILED', timestamp: ts };

      await DELAYS.afterBetConfirm();

      // Success check
      const successEl = await this.page.$('.bs-ReceiptSingle, [class*="Receipt"], [class*="BetSuccess"]');
      if (successEl) {
        return { success: true, bookmaker: 'bet365', order, betId: `B365_${Date.now()}`, confirmedOdds: order.odds, confirmedStake: order.stake, timestamp: ts };
      }

      const errEl = await this.page.$('[class*="Error"], [class*="Alert"], [role="alert"]');
      const errMsg = errEl ? await errEl.textContent() : null;
      return { success: false, bookmaker: 'bet365', order, error: errMsg ?? 'Confirmação não detectada', errorCode: 'CONFIRM_FAILED', timestamp: ts };

    } catch (err) {
      return { success: false, bookmaker: 'bet365', order, error: err instanceof Error ? err.message : String(err), errorCode: 'NETWORK_ERROR', timestamp: ts };
    }
  }

  private getMarketTexts(order: BetOrder): string[] {
    const lineMatch = order.marketLabel.match(/(\d+\.?\d*)/);
    const line = lineMatch ? lineMatch[1] : '2.5';
    const map: Record<string, string[]> = {
      result:     order.selection === 'home' ? ['1', order.homeTeam] : order.selection === 'away' ? ['2', order.awayTeam] : ['X', 'Empate'],
      over_goals: [`Mais de ${line}`, `Over ${line}`, `Acima de ${line}`],
      btts:       ['Ambas marcam - Sim', 'Sim'],
      corners:    [`Mais de ${line}`, `Escanteios Over ${line}`],
      cards:      [`Mais de ${line}`, 'Cartões'],
      halftime:   ['Intervalo/Final', '1º Tempo'],
    };
    return map[order.marketType] ?? [order.marketLabel];
  }
}
