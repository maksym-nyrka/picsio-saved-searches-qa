import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Captures a logged-in browser state once, out-of-band.
 * Tests never touch the login form; they reuse .auth/state.json.
 *
 *   npm run auth
 */
const BASE_URL = process.env.BASE_URL ?? 'https://pics.io';
const STATE_PATH = path.resolve('.auth/state.json');

setup('authenticate', async ({ page }) => {
  setup.setTimeout(120_000);

  const email = process.env.PICS_EMAIL;
  const password = process.env.PICS_PASSWORD;
  expect(email, 'PICS_EMAIL is required (see .env.example)').toBeTruthy();
  expect(password, 'PICS_PASSWORD is required (see .env.example)').toBeTruthy();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await page.locator('#login-email3').fill(email!);
  await page.locator('#login-password3').fill(password!);
  await page.locator('#btnSubmit').click();

  await page.waitForURL(/\/search/, { timeout: 60_000 });
  // The app shell needs a moment before the session is fully established.
  await page.waitForFunction(() => document.querySelectorAll('button').length > 20, null, {
    timeout: 60_000,
  });

  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STATE_PATH });
});

/** The consent dialog is injected by a third-party script and can arrive after `load`. */
async function dismissCookieBanner(page: import('@playwright/test').Page) {
  const reject = page.getByRole('button', { name: 'Reject All' });
  await reject.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if (await reject.isVisible().catch(() => false)) {
    await reject.click().catch(() => undefined);
    await reject.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  }
}
