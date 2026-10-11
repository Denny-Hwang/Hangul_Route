import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild } from './helpers';
import {
  AUDIT_SCREENS,
  AUDIT_VIEWPORTS,
  isOffender,
  measureTargets,
  offenderKey,
  ratchet,
  TARGET_MIN,
  viewportKey,
  type AuditScreen,
  type TouchTargetAllowlist,
} from './target-audit';

/**
 * Touch-target ratchet audit (F-LAYOUT-001 §3.8, PR 7). At 768x1024, 1180x820
 * and 375x667 a fresh learner's Home, Journey, Library and Profile are walked
 * and every visible button, link and checkbox is measured. Controls under
 * `touchTarget.min` (64) in either dimension are compared with
 * `fixtures/touch-target-allowlist.json`:
 *
 * - a control that is not on the list fails (make it at least 64 x 64);
 * - a listed control that is no longer small fails too: remove its line, so the
 *   list only ever shrinks.
 *
 * The list is the audit's starting point (today's offenders, e.g. the Library
 * filter chips, audit UX-25), not a licence to add new ones.
 */
const allowlist = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'touch-target-allowlist.json'), 'utf8')) as TouchTargetAllowlist;

/** Measures until two reads 300 ms apart agree, so entrance animations and late layout do not decide the result. */
async function settledOffenders(page: Page, screen: AuditScreen): Promise<{ keys: string[]; detail: string[] }> {
  let last = '';
  for (let i = 0; i < 10; i += 1) {
    const measured = (await page.evaluate(measureTargets)).filter((t) => isOffender(t));
    const keys = [...new Set(measured.map((t) => offenderKey({ screen, ...t })))].sort();
    const now = keys.join('\n');
    if (now === last) {
      return {
        keys,
        detail: measured.map((t) => `${offenderKey({ screen, ...t })} (${Math.round(t.width)}x${Math.round(t.height)})`),
      };
    }
    last = now;
    await page.waitForTimeout(300);
  }
  throw new Error(`${screen}: the controls never settled`);
}

const tabLink = (page: Page, name: string) => page.getByRole('tablist').getByRole('link', { name, exact: true });

/** Opens each audited screen of a fresh learner in turn and hands back its offenders. */
async function walk(page: Page): Promise<{ keys: string[]; detail: string[] }> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();

  const open: Record<AuditScreen, () => Promise<void>> = {
    Home: async () => {
      await expect(page.getByText('Today with Hoya')).toBeVisible();
    },
    Journey: async () => {
      await tabLink(page, 'Journey').click();
      await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
    },
    Library: async () => {
      await tabLink(page, 'Library').click();
      await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    },
    Profile: async () => {
      await tabLink(page, 'Today').click();
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    },
  };

  const keys: string[] = [];
  const detail: string[] = [];
  for (const screen of AUDIT_SCREENS) {
    await open[screen]();
    const found = await settledOffenders(page, screen);
    keys.push(...found.keys);
    detail.push(...found.detail);
  }
  return { keys: [...new Set(keys)].sort(), detail };
}

for (const vp of AUDIT_VIEWPORTS) {
  const key = viewportKey(vp);
  test.describe(`touch targets at ${key}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`no new control under ${TARGET_MIN} on Home, Journey, Library or Profile, and the allowlist only shrinks`, async ({ page }) => {
      const { keys, detail } = await walk(page);
      const { added, gone } = ratchet(keys, allowlist.offenders[key] ?? []);
      expect(
        added,
        `New controls under ${TARGET_MIN} at ${key}; make them at least ${TARGET_MIN} x ${TARGET_MIN}:\n${detail
          .filter((d) => added.some((a) => d.startsWith(a)))
          .join('\n')}`,
      ).toEqual([]);
      expect(
        gone,
        `These listed controls are no longer under ${TARGET_MIN} (or no longer on the screen) at ${key}; remove their lines from fixtures/touch-target-allowlist.json`,
      ).toEqual([]);
    });
  });
}
