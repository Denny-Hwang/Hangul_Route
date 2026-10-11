import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Screenshots for a UI pull request (F-LAYOUT-001 §5, CLAUDE.md §9). Not a
 * test gate: `shot(page, name)` writes `e2e/web/__shots__/<name>.png`
 * (git-ignored) only when the run sets `HR_SHOTS=1`, and does nothing
 * otherwise, so CI never pays for it.
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web tablet-layout
 */
export const SHOTS_DIR = join(__dirname, '__shots__');

/** True only for `HR_SHOTS=1`. */
export function shotsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.HR_SHOTS === '1';
}

/** The PNG path of a shot; the name is one plain file name (letters, digits, `.`, `_`, `-`). */
export function shotFile(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..')) {
    throw new Error(`shot name must be a plain file name, got "${name}"`);
  }
  return join(SHOTS_DIR, `${name}.png`);
}

/** Saves a full-page PNG of the current screen when `HR_SHOTS=1`; a no-op otherwise. */
export async function shot(page: Page, name: string): Promise<void> {
  if (!shotsEnabled()) return;
  const file = shotFile(name);
  mkdirSync(SHOTS_DIR, { recursive: true });
  // Let entrance animations (Hoya, the progress meter) come to rest before the capture.
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
}
