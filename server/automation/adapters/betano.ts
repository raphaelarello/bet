/**
 * Rapha Guru — Adapter Betano
 * Automatiza login, verificação de sessão e colocação de apostas
 */

import type { Page } from 'playwright';
import type { BookmakerAdapter } from '../engine.js';
import type { BetOrder, BetResult } from '../types.js';
import {
  humanDelay, humanType, humanClick, humanScroll,
  fillStakeInput, waitForElementHuman, hasCaptcha, DELAYS,
} from '../human.js';

const BASE_URL = 'https://www.betano.bet.br';

export class BetanoAdapter implements BookmakerAdapter {
  constructor(private page: Page) {}

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${BASE_URL}/pt-br/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      // Betano mostra saldo ou avatar quando logado
      const loggedInSelectors = [
        '[data-testid="header-balance"]',
        '.user-balance',
        '[class*="balance"]',
        '[class*="userBalance"]',
        'button[data-testid="deposit-button"]',
      ];
      for (const sel of loggedInSelectors) {
        const el = await this.page.$(sel);
        if (el) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      await this.page.goto(`${BASE_URL}/pt-br/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      if (await hasCaptcha(this.page)) {
        console.warn('[Betano] CAPTCHA detectado no login');
        return false;
      }

      // Clica no botão de login
      const loginBtnSelectors = [
        'button[data-testid="login-button"]',
        'button[class*="login"]',
        '[class*="LoginButton"]',
        'a[href*="login"]',
        'button:has-text("Entrar")',
        'button:has-text("Login")',
      ];

      let loginClicked = false;
      for (const sel of loginBtnSelectors) {
        try {
          await humanClick(this.page, sel, { timeout: 3000 });
          loginClicked = true;
          break;
        } catch { continue; }
      }

      if (!loginClicked) {
        // Tenta navegar diretamente para a página de login
        await this.page.goto(`${BASE_URL}/pt-br/login/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }

      await DELAYS.afterPageLoad();

      // Preenche e-mail/usuário
      const usernameSelectors = [
        'input[name="username"]',
        'input[name="email"]',
        'input[type="email"]',
        'input[data-testid="username"]',
        'input[placeholder*="e-mail"]',
        'input[placeholder*="Email"]',
        'input[autocomplete="username"]',
      ];

      let userFilled = false;
      for (const sel of usernameSelectors) {
        try {
          await humanType(this.page, sel, username);
          userFilled = true;
          break;
        } catch { continue; }
      }
      if (!userFilled) throw new Error('Campo usuário não encontrado');

      await humanDelay(500, 150);

      // Preenche senha
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[data-testid="password"]',
        'input[autocomplete="current-password"]',
      ];

      let passFilled = false;
      for (const sel of passwordSelectors) {
        try {
          await humanType(this.page, sel, password);
          passFilled = true;
          break;
        } catch { continue; }
      }
      if (!passFilled) throw new Error('Campo senha não encontrado');

      await DELAYS.beforeClick();

      // Clica em entrar
      const submitSelectors = [
        'button[type="submit"]',
        'button[data-testid="login-submit"]',
        'button:has-text("Entrar")',
        'button:has-text("Fazer login")',
        '[class*="SubmitButton"]',
      ];

      for (const sel of submitSelectors) {
        try {
          await humanClick(this.page, sel, { timeout: 3000 });
          break;
        } catch { continue; }
      }

      await DELAYS.afterLogin();

      // Verifica se login funcionou
      return await this.isLoggedIn();
    } catch (err) {
      console.error('[Betano] Erro no login:', err);
      return false;
    }
  }

  async getBalance(): Promise<number | null> {
    try {
      await this.page.goto(`${BASE_URL}/pt-br/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();

      const balanceSelectors = [
        '[data-testid="header-balance"]',
        '.user-balance',
        '[class*="balance"]',
        '[class*="Balance"]',
      ];

      for (const sel of balanceSelectors) {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent();
          if (text) {
            const match = text.match(/[\d.,]+/);
            if (match) {
              return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
            }
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async searchMatch(homeTeam: string, awayTeam: string): Promise<string | null> {
    try {
      // Navega para futebol
      await this.page.goto(`${BASE_URL}/pt-br/sports/futebol/`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await DELAYS.afterPageLoad();

      // Busca pelo time da casa
      const searchSelectors = [
        '[data-testid="search-input"]',
        'input[placeholder*="Pesquisar"]',
        'input[placeholder*="Buscar"]',
        'input[type="search"]',
      ];

      for (const sel of searchSelectors) {
        try {
          await humanType(this.page, sel, homeTeam);
          await DELAYS.afterSearch();

          // Procura o jogo nos resultados
          const matchText = `${homeTeam}`;
          const result = await this.page.$(`text="${matchText}"`);
          if (result) {
            const href = await result.getAttribute('href');
            return href;
          }
          break;
        } catch { continue; }
      }

      return null;
    } catch {
      return null;
    }
  }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const timestamp = new Date().toISOString();

    try {
      // Navega para a partida
      await this.page.goto(`${BASE_URL}/pt-br/sports/futebol/`, {
        waitUntil: 'domcontentloaded', timeout: 20000
      });
      await DELAYS.afterPageLoad();

      // Busca a partida
      const matchUrl = await this.searchMatch(order.homeTeam, order.awayTeam);

      if (matchUrl) {
        await this.page.goto(`${BASE_URL}${matchUrl}`, {
          waitUntil: 'domcontentloaded', timeout: 15000
        });
        await DELAYS.afterPageLoad();
      } else {
        // Tenta busca direta
        await humanScroll(this.page, 300);
      }

      // Encontra e clica no mercado correto
      const marketClicked = await this.findAndClickMarket(order);
      if (!marketClicked) {
        return {
          success: false, bookmaker: 'betano', order,
          error: `Mercado não encontrado: ${order.marketLabel}`,
          timestamp,
        };
      }

      await DELAYS.beforeClick();

      // Aguarda betslip aparecer
      const betslipVisible = await waitForElementHuman(this.page, '[class*="betslip"], [class*="Betslip"], [data-testid*="betslip"]');
      if (!betslipVisible) {
        return {
          success: false, bookmaker: 'betano', order,
          error: 'Betslip não apareceu após clicar no mercado',
          timestamp,
        };
      }

      await humanDelay(800, 200);

      // Preenche o valor da aposta
      const stakeSelectors = [
        'input[data-testid="stake-input"]',
        'input[class*="stakeInput"]',
        'input[class*="StakeInput"]',
        'input[placeholder*="Valor"]',
        'input[placeholder*="valor"]',
        '[class*="betslip"] input[type="number"]',
        '[class*="betslip"] input[type="text"]',
      ];

      let stakeFilled = false;
      for (const sel of stakeSelectors) {
        try {
          await fillStakeInput(this.page, sel, order.stake);
          stakeFilled = true;
          break;
        } catch { continue; }
      }

      if (!stakeFilled) {
        return {
          success: false, bookmaker: 'betano', order,
          error: 'Campo de valor não encontrado no betslip',
          timestamp,
        };
      }

      await DELAYS.beforeBetConfirm();

      // Verifica odd atual (pode ter mudado)
      const currentOdds = await this.getCurrentOdds();
      if (currentOdds && Math.abs(currentOdds - order.odds) > order.odds * 0.05) {
        // Odd mudou mais de 5% — cancela
        return {
          success: false, bookmaker: 'betano', order,
          error: `Odd mudou: esperada ${order.odds.toFixed(2)}, atual ${currentOdds.toFixed(2)}`,
          timestamp,
        };
      }

      // Confirma a aposta
      const confirmSelectors = [
        'button[data-testid="place-bet"]',
        'button[data-testid="confirm-bet"]',
        'button:has-text("Fazer aposta")',
        'button:has-text("Confirmar")',
        'button:has-text("Apostar")',
        '[class*="PlaceBet"]',
        '[class*="ConfirmBet"]',
      ];

      let confirmed = false;
      for (const sel of confirmSelectors) {
        try {
          await humanClick(this.page, sel, { timeout: 5000 });
          confirmed = true;
          break;
        } catch { continue; }
      }

      if (!confirmed) {
        return {
          success: false, bookmaker: 'betano', order,
          error: 'Botão de confirmação não encontrado',
          timestamp,
        };
      }

      await DELAYS.afterBetConfirm();

      // Verifica sucesso
      const betId = await this.extractBetId();
      if (betId) {
        return {
          success: true, bookmaker: 'betano', order,
          betId, confirmedOdds: currentOdds ?? order.odds,
          confirmedStake: order.stake, timestamp,
        };
      }

      // Verifica se houve erro
      const errorMsg = await this.extractErrorMessage();
      return {
        success: false, bookmaker: 'betano', order,
        error: errorMsg ?? 'Confirmação não detectada',
        timestamp,
      };

    } catch (err) {
      return {
        success: false, bookmaker: 'betano', order,
        error: err instanceof Error ? err.message : String(err),
        timestamp,
      };
    }
  }

  // ── Helpers internos ─────────────────────────────────────────

  private async findAndClickMarket(order: BetOrder): Promise<boolean> {
    // Mapa de mercados para seletores / textos da Betano
    const marketTextMap: Record<string, string[]> = {
      over_goals:    ['Mais de 2.5', 'Over 2.5', '+2.5', 'Acima de 2.5'],
      result:        [order.selection === 'home' ? order.homeTeam : order.selection === 'away' ? order.awayTeam : 'Empate'],
      btts:          ['Ambos marcam - Sim', 'Ambas as equipes marcam', 'Sim'],
      corners:       ['Escanteios', 'Cantos'],
      cards:         ['Cartões'],
      halftime:      ['1º Tempo', 'Intervalo'],
    };

    const textsToTry = marketTextMap[order.marketType] ?? [order.marketLabel];

    for (const text of textsToTry) {
      try {
        // Tenta encontrar botão/elemento com o texto do mercado
        const el = await this.page.$(`text="${text}"`);
        if (el) {
          await humanClick(this.page, `text="${text}"`, { timeout: 3000 });
          return true;
        }
      } catch { continue; }
    }

    return false;
  }

  private async getCurrentOdds(): Promise<number | null> {
    try {
      const oddsSelectors = [
        '[data-testid="betslip-odds"]',
        '[class*="betslip"] [class*="odds"]',
        '[class*="BetslipOdds"]',
      ];
      for (const sel of oddsSelectors) {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent();
          if (text) {
            const match = text.match(/[\d.]+/);
            if (match) return parseFloat(match[0]);
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async extractBetId(): Promise<string | null> {
    try {
      const successSelectors = [
        '[data-testid="bet-confirmation"]',
        '[class*="BetConfirmation"]',
        '[class*="successMessage"]',
        'text="Aposta realizada"',
        'text="Aposta colocada"',
      ];
      for (const sel of successSelectors) {
        const el = await this.page.$(sel);
        if (el) {
          const text = await el.textContent() ?? '';
          const idMatch = text.match(/[A-Z0-9]{6,}/);
          return idMatch ? idMatch[0] : `BETANO_${Date.now()}`;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async extractErrorMessage(): Promise<string | null> {
    try {
      const errSelectors = [
        '[data-testid="error-message"]',
        '[class*="error"]',
        '[class*="Error"]',
        '[role="alert"]',
      ];
      for (const sel of errSelectors) {
        const el = await this.page.$(sel);
        if (el) return await el.textContent();
      }
      return null;
    } catch {
      return null;
    }
  }
}
