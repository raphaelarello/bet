/**
 * Rapha Guru — Adapters: Superbet, KTO, EstrelaBet, BrasileirãoBet
 * Todos seguem o mesmo padrão do BetanoAdapter
 */

import type { Page } from 'playwright';
import type { BookmakerAdapter } from '../engine.js';
import type { BetOrder, BetResult } from '../types.js';
import { humanType, humanClick, fillStakeInput, waitForElementHuman, hasCaptcha, DELAYS, humanDelay } from '../human.js';

// ── SUPERBET ─────────────────────────────────────────────────
export class SuperbetAdapter implements BookmakerAdapter {
  constructor(private page: Page) {}
  private BASE = 'https://superbet.bet.br';

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}/pt-br/esportes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      return !!(await this.page.$('[class*="balance"], [class*="Balance"], [data-testid*="balance"]'));
    } catch { return false; }
  }

  async login(u: string, p: string): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}/pt-br/esportes`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      if (await hasCaptcha(this.page)) return false;
      await humanClick(this.page, 'button:has-text("Entrar"), [class*="loginBtn"], [data-testid="login"]', { timeout: 5000 });
      await DELAYS.afterPageLoad();
      await humanType(this.page, 'input[type="email"], input[name="username"]', u);
      await humanDelay(500, 150);
      await humanType(this.page, 'input[type="password"]', p);
      await DELAYS.beforeClick();
      await humanClick(this.page, 'button[type="submit"], button:has-text("Entrar")', { timeout: 5000 });
      await DELAYS.afterLogin();
      return await this.isLoggedIn();
    } catch { return false; }
  }

  async getBalance(): Promise<number | null> {
    try {
      const el = await this.page.$('[class*="balance"], [class*="Balance"]');
      if (!el) return null;
      const t = await el.textContent() ?? '';
      const m = t.match(/[\d.,]+/);
      return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
    } catch { return null; }
  }

  async searchMatch(h: string, a: string): Promise<string | null> { return null; }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    try {
      await this.page.goto(`${this.BASE}/pt-br/esportes/futebol`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      let clicked = false;
      for (const text of [order.marketLabel, order.selection]) {
        try { await humanClick(this.page, `text="${text}"`, { timeout: 3000 }); clicked = true; break; }
        catch { continue; }
      }
      if (!clicked) return { success: false, bookmaker: 'superbet', order, error: 'Mercado não encontrado', timestamp: ts };

      await humanDelay(800, 200);
      const stakeOk = await fillStakeInput(this.page, 'input[class*="stake"], input[placeholder*="Valor"]', order.stake).then(() => true).catch(() => false);
      if (!stakeOk) return { success: false, bookmaker: 'superbet', order, error: 'Campo stake não encontrado', timestamp: ts };

      await DELAYS.beforeBetConfirm();
      const conf = await humanClick(this.page, 'button:has-text("Confirmar"), button:has-text("Apostar")', { timeout: 5000 }).then(() => true).catch(() => false);
      if (!conf) return { success: false, bookmaker: 'superbet', order, error: 'Botão confirmar não encontrado', timestamp: ts };
      await DELAYS.afterBetConfirm();

      const ok = await waitForElementHuman(this.page, 'text="Aposta realizada", [class*="success"]', 8000);
      return { success: ok, bookmaker: 'superbet', order, betId: ok ? `SB_${Date.now()}` : undefined, error: ok ? undefined : 'Confirmação não detectada', timestamp: ts };
    } catch (err) {
      return { success: false, bookmaker: 'superbet', order, error: err instanceof Error ? err.message : String(err), timestamp: ts };
    }
  }
}

// ── KTO ───────────────────────────────────────────────────────
export class KTO_Adapter implements BookmakerAdapter {
  constructor(private page: Page) {}
  private BASE = 'https://www.kto.bet.br';

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}/pt-br/sports`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      return !!(await this.page.$('[class*="balance"], [class*="Balance"], .user-info'));
    } catch { return false; }
  }

  async login(u: string, p: string): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}/pt-br/sports`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      if (await hasCaptcha(this.page)) return false;
      await humanClick(this.page, 'button:has-text("Login"), button:has-text("Entrar"), [data-testid="login"]', { timeout: 5000 });
      await DELAYS.afterPageLoad();
      await humanType(this.page, 'input[type="email"], input[name="email"]', u);
      await humanDelay(500, 150);
      await humanType(this.page, 'input[type="password"]', p);
      await DELAYS.beforeClick();
      await humanClick(this.page, 'button[type="submit"]', { timeout: 5000 });
      await DELAYS.afterLogin();
      return await this.isLoggedIn();
    } catch { return false; }
  }

  async getBalance(): Promise<number | null> {
    try {
      const el = await this.page.$('[class*="balance"]');
      if (!el) return null;
      const t = await el.textContent() ?? '';
      const m = t.match(/[\d.,]+/);
      return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
    } catch { return null; }
  }

  async searchMatch(h: string, a: string): Promise<string | null> { return null; }

  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    try {
      await this.page.goto(`${this.BASE}/pt-br/sports/football`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();

      let clicked = false;
      for (const text of [order.marketLabel, order.selection]) {
        try { await humanClick(this.page, `text="${text}"`, { timeout: 3000 }); clicked = true; break; }
        catch { continue; }
      }
      if (!clicked) return { success: false, bookmaker: 'kto', order, error: 'Mercado não encontrado', timestamp: ts };

      await humanDelay(800, 200);
      const stakeOk = await fillStakeInput(this.page, 'input[class*="amount"], input[placeholder*="Valor"], input[type="number"]', order.stake).then(() => true).catch(() => false);
      if (!stakeOk) return { success: false, bookmaker: 'kto', order, error: 'Campo stake não encontrado', timestamp: ts };

      await DELAYS.beforeBetConfirm();
      const conf = await humanClick(this.page, 'button:has-text("Fazer Aposta"), button:has-text("Confirmar")', { timeout: 5000 }).then(() => true).catch(() => false);
      if (!conf) return { success: false, bookmaker: 'kto', order, error: 'Botão confirmar não encontrado', timestamp: ts };
      await DELAYS.afterBetConfirm();

      const ok = await waitForElementHuman(this.page, '[class*="success"], text="Aposta confirmada"', 8000);
      return { success: ok, bookmaker: 'kto', order, betId: ok ? `KTO_${Date.now()}` : undefined, error: ok ? undefined : 'Confirmação não detectada', timestamp: ts };
    } catch (err) {
      return { success: false, bookmaker: 'kto', order, error: err instanceof Error ? err.message : String(err), timestamp: ts };
    }
  }
}

// ── ESTRELABET ────────────────────────────────────────────────
export class EstrelaBetAdapter implements BookmakerAdapter {
  constructor(private page: Page) {}
  private BASE = 'https://www.estrelabet.bet.br';

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(`${this.BASE}/pt-br/sports`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      return !!(await this.page.$('[class*="balance"], [class*="Balance"]'));
    } catch { return false; }
  }
  async login(u: string, p: string): Promise<boolean> {
    try {
      await this.page.goto(this.BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      if (await hasCaptcha(this.page)) return false;
      await humanClick(this.page, 'button:has-text("Entrar"), [class*="LoginBtn"]', { timeout: 5000 });
      await DELAYS.afterPageLoad();
      await humanType(this.page, 'input[type="email"]', u);
      await humanDelay(400, 120);
      await humanType(this.page, 'input[type="password"]', p);
      await DELAYS.beforeClick();
      await humanClick(this.page, 'button[type="submit"]', { timeout: 5000 });
      await DELAYS.afterLogin();
      return await this.isLoggedIn();
    } catch { return false; }
  }
  async getBalance(): Promise<number | null> { return null; }
  async searchMatch(h: string, a: string): Promise<string | null> { return null; }
  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    try {
      await this.page.goto(`${this.BASE}/pt-br/sports/futebol`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      let clicked = false;
      for (const text of [order.marketLabel, order.selection]) {
        try { await humanClick(this.page, `text="${text}"`, { timeout: 3000 }); clicked = true; break; } catch { continue; }
      }
      if (!clicked) return { success: false, bookmaker: 'estrelabet', order, error: 'Mercado não encontrado', timestamp: ts };
      await humanDelay(800, 200);
      await fillStakeInput(this.page, 'input[class*="stake"], input[type="number"]', order.stake).catch(() => {});
      await DELAYS.beforeBetConfirm();
      await humanClick(this.page, 'button:has-text("Confirmar"), button:has-text("Apostar")', { timeout: 5000 }).catch(() => {});
      await DELAYS.afterBetConfirm();
      const ok = await waitForElementHuman(this.page, '[class*="success"], text="Aposta"', 8000);
      return { success: ok, bookmaker: 'estrelabet', order, betId: ok ? `EB_${Date.now()}` : undefined, error: ok ? undefined : 'Confirmação não detectada', timestamp: ts };
    } catch (err) {
      return { success: false, bookmaker: 'estrelabet', order, error: err instanceof Error ? err.message : String(err), timestamp: ts };
    }
  }
}

// ── BRASILEIRÃO BET ───────────────────────────────────────────
export class BrasileiraoAdapter implements BookmakerAdapter {
  constructor(private page: Page) {}
  private BASE = 'https://www.brasileiraoapostasesportivas.bet.br';
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(this.BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await DELAYS.afterPageLoad();
      return !!(await this.page.$('[class*="balance"], .logged-in'));
    } catch { return false; }
  }
  async login(u: string, p: string): Promise<boolean> {
    try {
      await this.page.goto(this.BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await DELAYS.afterPageLoad();
      if (await hasCaptcha(this.page)) return false;
      await humanClick(this.page, 'button:has-text("Entrar"), a:has-text("Login")', { timeout: 5000 });
      await DELAYS.afterPageLoad();
      await humanType(this.page, 'input[type="email"], input[name="username"]', u);
      await humanDelay(400, 120);
      await humanType(this.page, 'input[type="password"]', p);
      await DELAYS.beforeClick();
      await humanClick(this.page, 'button[type="submit"]', { timeout: 5000 });
      await DELAYS.afterLogin();
      return await this.isLoggedIn();
    } catch { return false; }
  }
  async getBalance(): Promise<number | null> { return null; }
  async searchMatch(h: string, a: string): Promise<string | null> { return null; }
  async placeBet(order: BetOrder): Promise<BetResult> {
    const ts = new Date().toISOString();
    return { success: false, bookmaker: 'brasileirao', order, error: 'Adapter em desenvolvimento — use Betano ou bet365', timestamp: ts };
  }
}
