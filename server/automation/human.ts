/**
 * Rapha Guru — Human Behavior Simulation v2.0
 * Gaussian delays, realistic mouse paths, anti-detection hardened
 */

import type { Page } from 'playwright';

// Box-Muller gaussian
function gaussian(mean: number, std: number): number {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.max(50, Math.round(mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function humanDelay(meanMs: number, stdDevMs?: number): Promise<void> {
  return new Promise(r => setTimeout(r, gaussian(meanMs, stdDevMs ?? meanMs * 0.25)));
}

export const DELAYS = {
  afterPageLoad:    () => humanDelay(1800, 400),
  beforeClick:      () => humanDelay(380, 130),
  betweenKeypress:  () => humanDelay(85, 32),
  afterLogin:       () => humanDelay(2400, 550),
  afterSearch:      () => humanDelay(1400, 320),
  beforeBetConfirm: () => humanDelay(2800, 650),
  afterBetConfirm:  () => humanDelay(3200, 900),
  scrollPause:      () => humanDelay(420, 110),
  betweenBets:      () => humanDelay(9000, 2500),
  afterError:       () => humanDelay(3000, 800),
};

// Realistic bezier mouse path
async function moveMouse(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  const steps = randomBetween(10, 18);
  // Control points for natural curve
  const cp1x = fromX + (toX - fromX) * 0.3 + randomBetween(-30, 30);
  const cp1y = fromY + (toY - fromY) * 0.3 + randomBetween(-30, 30);
  const cp2x = fromX + (toX - fromX) * 0.7 + randomBetween(-20, 20);
  const cp2y = fromY + (toY - fromY) * 0.7 + randomBetween(-20, 20);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(
      (1-t)**3 * fromX + 3*(1-t)**2*t * cp1x + 3*(1-t)*t**2 * cp2x + t**3 * toX
    );
    const y = Math.round(
      (1-t)**3 * fromY + 3*(1-t)**2*t * cp1y + 3*(1-t)*t**2 * cp2y + t**3 * toY
    );
    await page.mouse.move(x, y);
    await new Promise(r => setTimeout(r, randomBetween(8, 20)));
  }
}

export async function humanType(page: Page, selector: string, text: string, opts?: { timeout?: number }) {
  const el = await page.waitForSelector(selector, { timeout: opts?.timeout ?? 10000 });
  if (!el) throw new Error(`humanType: selector not found: ${selector}`);

  const box = await el.boundingBox();
  if (box) {
    const x = box.x + box.width * 0.5;
    const y = box.y + box.height * 0.5;
    const from = { x: x + randomBetween(-100, 100), y: y + randomBetween(-80, 80) };
    await page.mouse.move(from.x, from.y);
    await moveMouse(page, from.x, from.y, x, y);
  }

  await page.focus(selector);
  await humanDelay(180, 60);
  await page.keyboard.press('Control+a');
  await humanDelay(80, 25);
  await page.keyboard.press('Backspace');
  await humanDelay(120, 40);

  for (let i = 0; i < text.length; i++) {
    await page.keyboard.type(text[i]);
    // Occasional typo simulation (only on non-critical inputs)
    const baseDelay = gaussian(88, 32);
    if (Math.random() < 0.04 && i < text.length - 1) {
      await new Promise(r => setTimeout(r, baseDelay));
      // Typo then correct
      await page.keyboard.type(String.fromCharCode(text.charCodeAt(i) + randomBetween(-3, 3)));
      await humanDelay(250, 80);
      await page.keyboard.press('Backspace');
    }
    await new Promise(r => setTimeout(r, baseDelay));
    // Thinking pause
    if (Math.random() < 0.04) await humanDelay(500, 150);
  }
}

export async function humanClick(page: Page, selector: string, opts?: { timeout?: number; force?: boolean }) {
  const el = await page.waitForSelector(selector, { timeout: opts?.timeout ?? 10000 });
  if (!el) throw new Error(`humanClick: not found: ${selector}`);

  const box = await el.boundingBox();
  if (!box) throw new Error(`humanClick: no bounding box: ${selector}`);

  const targetX = box.x + box.width  * (0.25 + Math.random() * 0.5);
  const targetY = box.y + box.height * (0.25 + Math.random() * 0.5);
  const startX  = targetX + randomBetween(-120, 120);
  const startY  = targetY + randomBetween(-80, 80);

  await page.mouse.move(startX, startY);
  await humanDelay(100, 35);
  await moveMouse(page, startX, startY, targetX, targetY);
  await humanDelay(60, 20);
  await page.mouse.click(targetX, targetY);
}

export async function humanScroll(page: Page, deltaY: number) {
  const steps = randomBetween(4, 8);
  const step = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(randomBetween(-3, 3), step + randomBetween(-8, 8));
    await humanDelay(110, 35);
  }
}

export async function fillStakeInput(page: Page, selector: string, value: number) {
  const str = value.toFixed(2).replace('.', ',');
  await page.focus(selector);
  await humanDelay(280, 90);
  await page.click(selector, { clickCount: 3 });
  await humanDelay(120, 40);
  await humanType(page, selector, str);
  await humanDelay(320, 100);
  await page.keyboard.press('Tab');
  await humanDelay(180, 60);
}

export async function waitForSelector(page: Page, selector: string, maxMs = 15000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      return true;
    } catch {
      await humanDelay(700, 180);
    }
  }
  return false;
}

export async function hasCaptcha(page: Page): Promise<boolean> {
  const sels = [
    'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]',
    '.g-recaptcha', '#captcha', '[data-sitekey]',
    'iframe[title*="captcha" i]', '[class*="captcha" i]',
    '[class*="turnstile"]', 'iframe[src*="challenges.cloudflare"]',
  ];
  for (const s of sels) {
    if (await page.$(s)) return true;
  }
  return false;
}

// Tries each selector in order, returns first match
export async function trySelectors(
  page: Page,
  selectors: string[],
  action: 'click' | 'fill',
  value?: string,
  timeout = 3000,
): Promise<boolean> {
  for (const sel of selectors) {
    try {
      if (action === 'click') {
        await humanClick(page, sel, { timeout });
      } else if (action === 'fill' && value !== undefined) {
        await humanType(page, sel, value, { timeout });
      }
      return true;
    } catch { continue; }
  }
  return false;
}
