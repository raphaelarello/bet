/**
 * Rapha Guru — Simulação de Comportamento Humano
 * Todos os parâmetros são calibrados para parecer humano real
 */

import type { Page } from 'playwright';

// ── Distribuição normal (Box-Muller) ──────────────────────────
function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Delay humanizado ─────────────────────────────────────────
// Não usa setTimeout uniforme — usa distribuição gaussiana
export function humanDelay(meanMs: number, stdDevMs?: number): Promise<void> {
  const std = stdDevMs ?? meanMs * 0.25;
  const delay = Math.max(50, Math.round(gaussianRandom(meanMs, std)));
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Delays por contexto
export const DELAYS = {
  afterPageLoad:    () => humanDelay(1800, 400),
  beforeClick:      () => humanDelay(350, 120),
  betweenKeypress:  () => humanDelay(80, 30),
  afterLogin:       () => humanDelay(2200, 500),
  afterSearch:      () => humanDelay(1200, 300),
  beforeBetConfirm: () => humanDelay(2500, 600),  // pausa mais longa antes de confirmar
  afterBetConfirm:  () => humanDelay(3000, 800),
  scrollPause:      () => humanDelay(400, 100),
  betweenBets:      () => humanDelay(8000, 2000), // espera entre apostas
};

// ── Digitação humanizada ──────────────────────────────────────
export async function humanType(page: Page, selector: string, text: string) {
  await page.focus(selector);
  await humanDelay(200, 80);

  // Limpa campo primeiro (Ctrl+A + Delete)
  await page.keyboard.press('Control+a');
  await humanDelay(100, 30);
  await page.keyboard.press('Backspace');
  await humanDelay(150, 50);

  // Digita caractere por caractere com variação de velocidade
  for (const char of text) {
    await page.keyboard.type(char);
    // Varia o delay entre teclas — mais lento no início, mais rápido no meio
    await humanDelay(85, 35);

    // Ocasionalmente para um pouco mais (como humano pensando)
    if (Math.random() < 0.05) {
      await humanDelay(400, 100);
    }
  }
}

// ── Clique humanizado (move mouse antes) ─────────────────────
export async function humanClick(page: Page, selector: string, options?: { timeout?: number }) {
  const el = await page.waitForSelector(selector, { timeout: options?.timeout ?? 10000 });
  if (!el) throw new Error(`Elemento não encontrado: ${selector}`);

  const box = await el.boundingBox();
  if (!box) throw new Error(`Elemento sem bounding box: ${selector}`);

  // Posição com pequena variação dentro do elemento
  const targetX = box.x + box.width  * (0.3 + Math.random() * 0.4);
  const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

  // Move para próximo do elemento primeiro, depois para o alvo
  const startX = targetX + randomBetween(-80, 80);
  const startY = targetY + randomBetween(-60, 60);

  await page.mouse.move(startX, startY);
  await humanDelay(120, 40);
  await page.mouse.move(targetX, targetY, { steps: randomBetween(6, 12) });
  await humanDelay(80, 30);
  await page.mouse.click(targetX, targetY);
}

// ── Scroll humanizado ─────────────────────────────────────────
export async function humanScroll(page: Page, deltaY: number) {
  const steps = randomBetween(3, 6);
  const stepSize = deltaY / steps;

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize + randomBetween(-10, 10));
    await humanDelay(120, 40);
  }
}

// ── Preencher input de valor monetário ───────────────────────
export async function fillStakeInput(page: Page, selector: string, value: number) {
  const formattedValue = value.toFixed(2).replace('.', ',');

  await page.focus(selector);
  await humanDelay(300, 100);

  // Triplo clique para selecionar tudo
  await page.click(selector, { clickCount: 3 });
  await humanDelay(150, 50);

  await humanType(page, selector, formattedValue);
  await humanDelay(300, 100);

  // Tab para confirmar
  await page.keyboard.press('Tab');
  await humanDelay(200, 80);
}

// ── Aguarda elemento com retry humano ────────────────────────
export async function waitForElementHuman(
  page: Page,
  selector: string,
  maxWait = 15000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      return true;
    } catch {
      await humanDelay(800, 200);
    }
  }
  return false;
}

// ── Verifica se página tem CAPTCHA ────────────────────────────
export async function hasCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    '#captcha',
    '[data-sitekey]',
    'iframe[title*="captcha"]',
    'iframe[title*="CAPTCHA"]',
  ];

  for (const sel of captchaSelectors) {
    const el = await page.$(sel);
    if (el) return true;
  }
  return false;
}
