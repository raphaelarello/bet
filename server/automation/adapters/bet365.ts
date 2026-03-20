/**
 * Rapha Guru — Adapter bet365
 */
import type { Page } from 'playwright';
import type { BookmakerAdapter } from '../engine.js';
import type { BetOrder, BetResult } from '../types.js';
import { humanType, humanClick, fillStakeInput, waitForElementHuman, hasCaptcha, DELAYS, humanDelay } from '../human.js';

const BASE_URL = 'https://www.bet365.bet.br';

export class Bet365Adapter implements BookmakerAdapter {
  constructor(private page: Page) {}

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${BASE_URL}/#/HO/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      const el = await this.page.$('.hm-BalanceWithBetslip_Balance, .hm-LoggedInHeader, [class*="Balance"]');
      return !!el;
    } catch { return false; }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      await this.page.goto(`${BASE_URL}/#/HO/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      if (await hasCaptcha(this.page)) return false;

      // bet365 usa modal de login
      await humanClick(this.page, '.hm-LoginButton, [class*="LoginButton"], button:has-text("Entrar")', { timeout: 8000 });
      await DELAYS.afterPageLoad();

      await humanType(this.page, 'input[name="username"], input[id*="username"], input[placeholder*="Usuário"]', username);
      await humanDelay(600, 150);
      await humanType(this.page, 'input[name="password"], input[type="password"]', password);
      await DELAYS.beforeClick();

      await humanClick(this.page, 'button[type="submit"], .lpb-LoginButtonV2, button:has-text("Entrar")', { timeout: 5000 });
      await DELAYS.afterLogin();

      return await this.isLoggedIn();
    } catch { return false; }
  }

  async getBalance(): Promise<number | null> {
    try {
      const el = await this.page.$('.hm-BalanceWithBetslip_Balance, [class*="Balance"]');
      if (!el) return null;
      const text = await el.textContent() ?? '';
      const match = text.match(/[\d.,]+/);
      return match ? parseFloat(match[0].replace(/\./g, '').replace(',', '.')) : null;
    } catch { return null; }
  }

  async searchMatch(homeTeam: string, awayTeam: string): Promise<string | null> {
    return null; // bet365 usa navegação interna
  }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const timestamp = new Date().toISOString();
    try {
      // Navega para futebol
      await this.page.goto(`${BASE_URL}/#/SO/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      // Busca pelo jogo
      const searchClicked = await humanClick(this.page, '.sm-Search, [class*="SearchBox"], button[aria-label*="Pesquisar"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (searchClicked) {
        await humanType(this.page, 'input[type="search"], .sm-SearchInput', order.homeTeam);
        await DELAYS.afterSearch();
      }

      // Tenta clicar no mercado
      const marketTexts = this.getMarketTexts(order);
      let clicked = false;
      for (const text of marketTexts) {
        try {
          await humanClick(this.page, `text="${text}"`, { timeout: 3000 });
          clicked = true;
          break;
        } catch { continue; }
      }
      if (!clicked) return { success: false, bookmaker: 'bet365', order, error: 'Mercado não encontrado', timestamp };

      await humanDelay(1000, 300);

      // Preenche stake
      const stakeOk = await fillStakeInput(this.page, 'input.bs3-StandardBetslip_AmountInput, [class*="stakeInput"], input[aria-label*="Aposta"]', order.stake).then(() => true).catch(() => false);
      if (!stakeOk) return { success: false, bookmaker: 'bet365', order, error: 'Campo stake não encontrado', timestamp };

      await DELAYS.beforeBetConfirm();

      // Confirma
      const confirmed = await humanClick(this.page, '.bs3-StandardBetslip_PlaceBetsBtn, button:has-text("Fazer Aposta"), button:has-text("Confirmar Aposta")', { timeout: 5000 }).then(() => true).catch(() => false);
      if (!confirmed) return { success: false, bookmaker: 'bet365', order, error: 'Botão confirmar não encontrado', timestamp };

      await DELAYS.afterBetConfirm();

      const success = await waitForElementHuman(this.page, '.bsp-BetPlaced, [class*="BetPlaced"], text="Aposta realizada"', 8000);
      return {
        success, bookmaker: 'bet365', order,
        betId: success ? `B365_${Date.now()}` : undefined,
        error: success ? undefined : 'Confirmação não detectada',
        timestamp,
      };
    } catch (err) {
      return { success: false, bookmaker: 'bet365', order, error: err instanceof Error ? err.message : String(err), timestamp };
    }
  }

  private getMarketTexts(order: BetOrder): string[] {
    const map: Record<string, string[]> = {
      over_goals: ['Mais de 2,5 Gols', 'Acima de 2,5', 'Over 2.5'],
      result: [order.selection === 'home' ? order.homeTeam : order.selection === 'away' ? order.awayTeam : 'Empate X'],
      btts: ['Ambas Marcam', 'Sim'],
    };
    return map[order.marketType] ?? [order.marketLabel];
  }
}
