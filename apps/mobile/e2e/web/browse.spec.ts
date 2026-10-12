import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild } from './helpers';
import { shot } from './shots';

/**
 * F-BROWSE-001 BR-6 (sections 4.1, 4.3, 4.4, 4.10): the All lessons root at
 * `/browse`, its first cases. The gate pass is written by a test helper, as the
 * learner app's [ Open all lessons ] will write it (BR-12a). The root reads the
 * link's fragment and takes it out of the address, keeps `document.title` fixed,
 * resolves its pass per tab, shows the Access screen without one, and writes
 * nothing of a learner's: the device's stored key/value set is unchanged apart
 * from `browse:*`, and the learner telemetry queue is byte-identical. BR-7 and
 * BR-8 add the catalogue, the preview and the strip measurements.
 */
const PASS_KEY = 'hr:browse:pass';
const UNLOCK_KEY = 'hr:grownup:unlock';
const LEARNER_QUEUE = 'hr:telemetry:queue';
const BROWSE_QUEUE = 'hr:browse:telemetry-queue';
const SEEDED_QUEUE = JSON.stringify([{ id: 'e2e-learner-1', name: 'quest.completed', profileId: 'e2e-profile', at: '2026-10-12T08:00:00.000Z' }]);

type Stored = Record<string, string>;

/** Every value the app keeps in IndexedDB (`keyval-store`), as stored. */
function readAllStored(page: Page): Promise<Stored> {
  return page.evaluate(
    () =>
      new Promise<Stored>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve({});
            return;
          }
          const out: Stored = {};
          const cursor = db.transaction('keyval').objectStore('keyval').openCursor();
          cursor.onerror = () => reject(cursor.error);
          cursor.onsuccess = () => {
            const at = cursor.result;
            if (at) {
              out[String(at.key)] = typeof at.value === 'string' ? at.value : JSON.stringify(at.value);
              at.continue();
              return;
            }
            db.close();
            resolve(out);
          };
        };
      }),
  );
}

/** Writes one stored value the way `platform/storage` does (no reload). */
function putStored(page: Page, key: string, json: string): Promise<void> {
  return page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(v, k);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, json] as const,
  );
}

/** The gate pass `openBrowseFromGate` writes after the PIN (BR-12a), `minutesAgo` old. */
function writeGatePass(page: Page, minutesAgo = 0): Promise<void> {
  return page.evaluate(
    ([key, ago]) => {
      const at = Date.now() - ago * 60_000;
      sessionStorage.setItem(key, JSON.stringify({ v: 1, scope: 'full', source: 'gate', issuedAt: at, seen: at }));
    },
    [PASS_KEY, minutesAgo] as const,
  );
}

/** The console's shell store remembers a grown-up persona (F-APP-001 section 3.5); All lessons reads it only. */
function rememberPersona(page: Page, persona: 'parent' | 'teacher'): Promise<void> {
  return page.evaluate(
    (p) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('hr-shell');
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ v: 1, persona: p }, 'lastPersona');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    persona,
  );
}

const home = (page: Page) => page.getByRole('heading', { name: 'All lessons' });
const accessTitle = (page: Page) => page.getByRole('heading', { name: 'This page is for parents and teachers.' });

test('a gate pass opens All lessons: the fragment leaves the address, the title is fixed, and nothing of a learner changes', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  await page.evaluate((k) => sessionStorage.setItem(k, '{"v":1,"at":1,"seen":1,"src":"pin"}'), UNLOCK_KEY);
  const before = await readAllStored(page);
  expect(before[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
  expect(Object.keys(before).some((k) => k.startsWith('hr:profiles'))).toBe(true);

  await writeGatePass(page);
  await page.goto('/browse#t=quest:stage1-letters-q1&s=gate');
  await expect(home(page)).toBeVisible();
  await expect(page.getByText('Tap a lesson to see what it teaches, then play it. Nothing is saved.')).toBeVisible();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page).toHaveTitle('Hangul Route lessons');
  await shot(page, 'br6-browse-home-pixel5');

  // A check that nothing was written needs a settle window: let the boot finish its reads, its event and its
  // flush, then compare the whole store.
  await page.waitForTimeout(1500);
  const after = await readAllStored(page);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
  expect(changed.filter((k) => !k.startsWith('hr:browse:')), changed.join(', ')).toEqual([]);
  expect(after[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
  // This build has no API address, so `track` neither posts nor queues: `browse.opened` itself (its payload,
  // no profileId, the flush) is pinned by platform/__tests__/browse-opened.test.ts. Here: whatever the browse
  // queue holds is a browse event that names no one, and no telemetry key other than the two queues exists.
  const browseQueue = JSON.parse(after[BROWSE_QUEUE] ?? '[]') as Array<{ name: string; profileId?: string }>;
  expect(browseQueue.filter((event) => !event.name.startsWith('browse.') || event.profileId !== undefined)).toEqual([]);
  expect(Object.keys(after).filter((k) => k.includes('telemetry') && k !== LEARNER_QUEUE && k !== BROWSE_QUEUE)).toEqual([]);
  // All lessons never clears the grown-up unlock of its tab (F-BROWSE-001 BD1).
  expect(await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_KEY)).not.toBeNull();

  // The pass lives in the tab: a reload keeps it.
  await page.reload();
  await expect(home(page)).toBeVisible();
  await expect(page).toHaveTitle('Hangul Route lessons');

  // A later link in the same tab is read the same way and leaves the address too.
  await page.evaluate(() => {
    window.location.hash = '#t=jamo:nieun&s=report';
  });
  await expect(page).toHaveURL(/\/browse$/);
  await expect(home(page)).toBeVisible();
});

test('a new tab has no pass: only the Access screen, with no lesson, title or card', async ({ page, context }) => {
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();

  const other = await context.newPage();
  await other.goto('/browse#t=quest:stage1-letters-q1&s=report');
  await expect(accessTitle(other)).toBeVisible();
  await expect(other).toHaveURL(/\/browse$/);
  await expect(other).toHaveTitle('Hangul Route lessons');
  await expect(other.getByText('On a family device, open them from the grown-up area. Parents and teachers can also open them from their account.')).toBeVisible();
  // Until BR-12b ships the gate=browse intent, the way back is the app; Sign in stays.
  await expect(other.getByRole('button', { name: 'Back to the app' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Back to the grown-up area' })).toHaveCount(0);
  await expect(home(other)).toHaveCount(0);
  await expect(other.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await shot(other, 'br6-browse-access-unknown-pixel5');

  await other.getByRole('button', { name: 'Back to the app' }).click();
  await expect(other).toHaveURL(/\/$/);
});

test('after 15 idle minutes the gate pass is over: Access says so and leads back to the app', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T09:00:00.000Z') });
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();

  await page.clock.fastForward('15:00');
  await page.reload();
  await expect(accessTitle(page)).toBeVisible();
  await expect(page.getByText('Your time in the grown-up area ended. Go back to the app, then open the grown-up area again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to the app' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  // The expired pass stays in the tab, for this screen's source.
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)).not.toBeNull();
  await shot(page, 'br6-browse-access-gate-pixel5');
});

test('a remembered persona makes the Access screen point to the account; offline it says grown-up pages need the internet', async ({ page, context }) => {
  await page.goto('/');
  await rememberPersona(page, 'teacher');
  await page.goto('/browse');
  await expect(accessTitle(page)).toBeVisible();
  await expect(page.getByText('Open lessons again from your account.')).toBeVisible();
  await expect(page.getByText('Grown-up pages need the internet.')).toHaveCount(0);

  await context.setOffline(true);
  await expect(page.getByText('Grown-up pages need the internet.')).toBeVisible();
  await shot(page, 'br6-browse-access-account-offline-pixel5');
  await context.setOffline(false);
  await expect(page.getByText('Grown-up pages need the internet.')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open lessons from my account' }).click();
  await expect(page).toHaveURL(/\/teach\/home$/);
});

test('Close goes back to the page the tab came from, else to the learner app for a gate pass', async ({ page }) => {
  await page.goto('/?from=e2e');
  await writeGatePass(page);
  // A same-origin page opened All lessons in this tab.
  await page.evaluate(() => window.location.assign('/browse#s=gate'));
  await expect(home(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/\?from=e2e$/);

  // Typed into the address bar: no referrer, so a gate pass leaves for the learner app.
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Close after a later link skips its history entry and goes back to the page the tab came from', async ({ page }) => {
  await page.goto('/?from=e2e');
  await writeGatePass(page);
  await page.evaluate(() => window.location.assign('/browse#s=gate'));
  await expect(home(page)).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#t=jamo:nieun&s=report';
  });
  await expect(page).toHaveURL(/\/browse$/);
  await expect(home(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/\?from=e2e$/);
});

test('Close in a new tab opened from an app page (a referrer, nothing to go back to) leaves by address', async ({ page, context }) => {
  await page.goto('/?from=e2e');
  await writeGatePass(page);
  // `window.open` copies the tab's sessionStorage (the pass) and sets a same-origin referrer; the new tab's history has one entry.
  const [tab] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => void window.open('/browse', '_blank'))]);
  await expect(home(tab)).toBeVisible();
  expect(await tab.evaluate(() => [document.referrer !== '', history.length])).toEqual([true, 1]);
  await tab.getByRole('button', { name: 'Close' }).click();
  await expect(tab).toHaveURL(/\/$/);
});

test('Close shows the border.focus ring on keyboard focus', async ({ page }) => {
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();
  const close = page.getByTestId('browse-close');
  const ring = () => close.evaluate((el) => getComputedStyle(el).borderTopColor);
  const atRest = await ring();
  await close.focus();
  await expect.poll(ring).not.toBe(atRest);
});

test('a tab shown again after 15 idle minutes shows the Access screen without a tap', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T09:00:00.000Z') });
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();

  await page.clock.fastForward('14:00');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
  await expect(home(page)).toBeVisible();

  await page.clock.fastForward('01:00');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
  await expect(accessTitle(page)).toBeVisible();
  await expect(home(page)).toHaveCount(0);
});

test('at 320 wide the Access screen keeps 64 targets and nothing runs off the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/browse');
  await expect(accessTitle(page)).toBeVisible();
  for (const name of ['Back to the app', 'Sign in']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(64);
    expect((box?.x ?? 0) + (box?.width ?? 0), name).toBeLessThanOrEqual(320);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await shot(page, 'br6-browse-access-320');
});
