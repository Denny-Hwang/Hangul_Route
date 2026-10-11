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
  occurrenceKeys,
  offenderKey,
  ratchet,
  settleSignature,
  TARGET_MIN,
  viewportKey,
  type AuditScreen,
  type MeasuredTarget,
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

interface ScreenOffenders {
  /** One key per small control (repeats get `#2`, `#3`), in document order. */
  keys: string[];
  /** Key -> measured size, for the failure message. */
  sizes: Map<string, string>;
}

/**
 * Measures until two reads 300 ms apart agree on every control's role, name and
 * rounded size (not only the offenders), so entrance animations, late layout
 * and controls still growing do not decide the result. At least two reads are
 * always taken, even when the first finds nothing small.
 */
async function settledOffenders(page: Page, screen: AuditScreen): Promise<ScreenOffenders> {
  let last: string | null = null;
  for (let i = 0; i < 10; i += 1) {
    const measured: MeasuredTarget[] = await page.evaluate(measureTargets, null);
    const now = settleSignature(measured);
    if (last !== null && now === last) {
      const small = measured.filter((t) => isOffender(t));
      const keys = occurrenceKeys(small.map((t) => offenderKey({ screen, ...t })));
      const sizes = new Map<string, string>();
      small.forEach((t, n) => sizes.set(keys[n] ?? '', `${Math.round(t.width)}x${Math.round(t.height)}`));
      return { keys, sizes };
    }
    last = now;
    await page.waitForTimeout(300);
  }
  throw new Error(`${screen}: the controls never settled`);
}

const tabLink = (page: Page, name: string) => page.getByRole('tablist').getByRole('link', { name, exact: true });

/** Opens each audited screen of a fresh learner in turn and hands back its offenders. */
async function walk(page: Page): Promise<ScreenOffenders> {
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
  const sizes = new Map<string, string>();
  for (const screen of AUDIT_SCREENS) {
    await open[screen]();
    const found = await settledOffenders(page, screen);
    keys.push(...found.keys);
    for (const [k, size] of found.sizes) sizes.set(k, size);
  }
  return { keys, sizes };
}

for (const vp of AUDIT_VIEWPORTS) {
  const key = viewportKey(vp);
  test.describe(`touch targets at ${key}`, () => {
    // Entrance animations off, so a control is measured at its resting size.
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });

    test(`no new control under ${TARGET_MIN} on Home, Journey, Library or Profile, and the allowlist only shrinks`, async ({ page }) => {
      const { keys, sizes } = await walk(page);
      const { added, gone } = ratchet(keys, allowlist.offenders[key] ?? []);
      expect(
        added,
        `New controls under ${TARGET_MIN} at ${key}; make them at least ${TARGET_MIN} x ${TARGET_MIN}:\n${added
          .map((a) => `${a} (${sizes.get(a) ?? '?'})`)
          .join('\n')}`,
      ).toEqual([]);
      expect(
        gone,
        `These listed controls are no longer under ${TARGET_MIN} (or no longer on the screen) at ${key}; remove their lines from fixtures/touch-target-allowlist.json`,
      ).toEqual([]);
    });
  });
}

// The PWA overlays appear on their own schedule, so the walk above leaves them
// out; here each one is opened on purpose and every control in it must already
// meet the floor (they have no allowlist).
async function smallIn(page: Page, testId: string): Promise<string[]> {
  const all = await page.evaluate(measureTargets, testId);
  expect(all.length, `${testId} has controls to measure`).toBeGreaterThan(0);
  return all.filter((t) => isOffender(t)).map((t) => `${t.role} | ${t.name} (${Math.round(t.width)}x${Math.round(t.height)})`);
}

test.describe('touch targets in the PWA overlays', () => {
  test.use({ reducedMotion: 'reduce' });

  test(`install guide and update bar controls are at least ${TARGET_MIN} at 1180x820`, async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await onboardChild(page, { name: 'Mina' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.goto('/');
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await page.reload(); // third cached open: the install guide shows
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('button').first()).toBeVisible();
    expect(await smallIn(page, 'install-guide'), 'install guide').toEqual([]);

    // The update bar is the only banner with a control (the toasts only inform).
    await page.evaluate(() => window.dispatchEvent(new Event('hr:update-ready')));
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    expect(await smallIn(page, 'pwa-banners'), 'banners').toEqual([]);
  });

  test(`portrait guard controls are at least ${TARGET_MIN} on a phone held sideways 844x390`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Keep sideways' })).toBeVisible();
    expect(await smallIn(page, 'portrait-guard'), 'portrait guard').toEqual([]);
  });
});

// measureTargets itself, on a page whose layout is known exactly: which elements
// count, which are skipped, how each is named and that sizes are the laid-out box.
test('measureTargets: roles, names, skipped subtrees and boxes on a fixture page', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.setContent(`
    <style>* { margin: 0; padding: 0; border: 0; } .b { display: block; width: 100px; height: 40px; }</style>
    <button class="b">  Native
      button </button>
    <div role="button" aria-label="Labelled div" class="b" style="width: 70px; height: 70px">ignored text</div>
    <span id="lbl">From labelledby</span>
    <a href="#x" aria-labelledby="lbl" class="b" style="width: 64px; height: 64px"></a>
    <a class="b">No href, not a link</a>
    <div role="switch" aria-label="Sound" class="b" style="width: 120px; height: 30px"></div>
    <div role="radio" aria-label="Spanish" class="b"></div>
    <input type="checkbox" aria-label="Agree" style="display: block; width: 20px; height: 20px" />
    <div role="presentation"><button class="b" role="none">Role none</button></div>
    <div aria-hidden="true"><button class="b">Hidden from AT</button></div>
    <div style="display: none"><button class="b">Inactive screen</button></div>
    <div data-testid="pwa-banners"><button class="b">Refresh</button></div>
    <button class="b" style="width: 0; height: 0; overflow: hidden"></button>
    <button class="b"></button>
  `);
  const all = await page.evaluate(measureTargets, null);
  expect(all.map((t) => [t.role, t.name, Math.round(t.width), Math.round(t.height)])).toEqual([
    ['button', 'Native button', 100, 40],
    ['button', 'Labelled div', 70, 70],
    ['link', 'From labelledby', 64, 64],
    ['switch', 'Sound', 120, 30],
    ['radio', 'Spanish', 100, 40],
    ['checkbox', 'Agree', 20, 20],
    ['button', '(no name)', 100, 40],
  ]);
  expect((await page.evaluate(measureTargets, 'pwa-banners')).map((t) => t.name)).toEqual(['Refresh']);
  expect(await page.evaluate(measureTargets, 'no-such-id')).toEqual([]);
});
