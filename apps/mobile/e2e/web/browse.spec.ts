import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { answerCheckRounds, onboardChild, openGrownUpZone, passDiscover, unlockWithPin, headerBack, headerClose } from './helpers';
import { shot } from './shots';
import { nextPage, position } from './story-reader-helpers';

/**
 * F-BROWSE-001 BR-6 (sections 4.1, 4.3, 4.4, 4.10): the All lessons root at
 * `/browse`, its first cases. The gate pass is written by a test helper, as the
 * learner app's [ Open all lessons ] will write it (BR-12a). The root reads the
 * link's fragment and takes it out of the address, keeps `document.title` fixed,
 * resolves its pass per tab, shows the Access screen without one, and writes
 * nothing of a learner's: the device's stored key/value set is unchanged apart
 * from `browse:*`, and the learner telemetry queue is byte-identical. BR-7 adds
 * the catalogue, BR-8 the preview and the strip measurements.
 */
const PASS_KEY = 'hr:browse:pass';
const UNLOCK_KEY = 'hr:grownup:unlock';
const CONSOLE_KEY = 'hr:console:session';
const LEARNER_QUEUE = 'hr:telemetry:queue';
const BROWSE_QUEUE = 'hr:browse:telemetry-queue';
const SEEDED_QUEUE = JSON.stringify([{ id: 'e2e-learner-1', name: 'quest.completed', profileId: 'e2e-profile', at: '2026-10-12T08:00:00.000Z' }]);

/**
 * The release build has the content switch off (production until the owner's switch-on step), and every case
 * of this file but the closed-item ones checks that build. The switch-on lane (F-ENT-003 E3-13,
 * `switch-on-e2e.yml`) builds dist with the switch on and runs this file with E2E_CONTENT_GATING=1: there only
 * the closed-item describe at the end runs, and on the release build only it is skipped.
 */
const GATED = process.env.E2E_CONTENT_GATING === '1';
const SWITCH_ON_SUITE = 'switch on: a sampler pass sees closed items (F-ENT-003 keys)';

test.beforeEach(async ({}, testInfo) => {
  test.skip(GATED && !testInfo.titlePath.includes(SWITCH_ON_SUITE), 'a release-build case (switch off); the switch-on lane runs only the closed-item cases');
});

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

/**
 * Everything the device keeps for this origin that a reused screen could write through another API than
 * `platform/storage`: every entry of the `keyval-store` and `hr-shell` IndexedDB databases (a database that
 * does not exist is not opened, so the check never creates one), every `localStorage` key and every
 * `sessionStorage` key except the tab's pass. Keys are prefixed by where they live.
 */
function snapshotDevice(page: Page): Promise<Stored> {
  return page.evaluate(async (passKey) => {
    const out: Record<string, string> = {};
    const text = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));
    const names = new Set((await indexedDB.databases()).map((d) => d.name));
    for (const name of ['keyval-store', 'hr-shell']) {
      if (!names.has(name)) continue;
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const stores = [...db.objectStoreNames];
          if (stores.length === 0) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(stores);
          for (const store of stores) {
            const cursor = tx.objectStore(store).openCursor();
            cursor.onsuccess = () => {
              const at = cursor.result;
              if (!at) return;
              out[`idb:${name}/${store}:${String(at.key)}`] = text(at.value);
              at.continue();
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null) out[`local:${key}`] = localStorage.getItem(key) ?? '';
    }
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key !== null && key !== passKey) out[`session:${key}`] = sessionStorage.getItem(key) ?? '';
    }
    return out;
  }, PASS_KEY);
}

/** The keys whose value differs between two snapshots, the browse root's own `browse:*` IndexedDB keys aside. */
function changedOutsideBrowse(before: Stored, after: Stored): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => before[k] !== after[k])
    .filter((k) => !k.startsWith('idb:keyval-store/keyval:hr:browse:'));
}

/** The root marks the page once its first boot finished its reads, removals, `browse.opened` and flush. */
async function bootSettled(page: Page): Promise<void> {
  await expect(page.locator('html[data-hr-boot="settled"]')).toHaveCount(1);
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

/** The tab is shown again, as a browser fires it: `visibilitychange` at the document, visible, not bubbling. */
function showTabAgain(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
}

const home = (page: Page) => page.getByRole('heading', { name: 'All lessons' });
const accessTitle = (page: Page) => page.getByRole('heading', { name: 'This page is for parents and teachers.' });

test('a gate pass opens All lessons: the fragment leaves the address, the title is fixed, and nothing of a learner changes', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  await page.evaluate(
    ([u, c]) => {
      sessionStorage.setItem(u, '{"v":1,"at":1,"seen":1,"src":"pin"}');
      sessionStorage.setItem(c, '{"token":"t"}');
    },
    [UNLOCK_KEY, CONSOLE_KEY] as const,
  );
  const before = await readAllStored(page);
  expect(before[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
  expect(Object.keys(before).some((k) => k.startsWith('hr:profiles'))).toBe(true);
  const deviceBefore = await snapshotDevice(page);

  await writeGatePass(page);
  // The learner app opens All lessons in this tab (BR-12a), so the tab can go back: its unlock stays (BD1).
  await page.evaluate(() => window.location.assign('/browse#t=quest:stage1-letters-q1&s=gate'));
  // The link's lesson page opens over home (BR-7 registers the pages).
  await expect(page.getByRole('heading', { name: 'Meet a, eo, g, n' })).toBeVisible();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page).toHaveTitle('Hangul Route lessons');
  await shot(page, 'br6-browse-home-pixel5');

  // Compare only once the boot says it finished its reads (each gives up after BOOT_READ_TIMEOUT_MS, 2.5 s),
  // its removals, its event and its flush: a positive signal, never a timer.
  await bootSettled(page);
  const after = await readAllStored(page);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
  expect(changed.filter((k) => !k.startsWith('hr:browse:')), changed.join(', ')).toEqual([]);
  expect(after[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
  // This build has no API address, so `track` neither posts nor queues `browse.opened`: its payload (no
  // profileId), its queue and the flush are pinned by platform/__tests__/browse-opened.test.ts, and the boot
  // order (fences and the browse queue before anything) by platform/__tests__/browse-start.test.ts. What this
  // case proves end to end: the learner queue is byte-identical and no other telemetry key appears.
  expect(Object.keys(after).filter((k) => k.includes('telemetry') && k !== LEARNER_QUEUE && k !== BROWSE_QUEUE)).toEqual([]);
  // Nothing else of the device changed either: the hr-shell database, localStorage and this tab's sessionStorage.
  // In a tab that can go back (a same-origin referrer and an earlier history entry), All lessons keeps the
  // grown-up unlock and the console session (BD1); a tab with nothing to go back to clears both at boot
  // (platform/browse-start.ts, the typed-address and new-tab cases below).
  const deviceAfter = await snapshotDevice(page);
  expect(changedOutsideBrowse(deviceBefore, deviceAfter)).toEqual([]);
  expect(deviceAfter[`session:${UNLOCK_KEY}`]).toBeDefined();
  expect(deviceAfter[`session:${CONSOLE_KEY}`]).toBe('{"token":"t"}');

  // The pass lives in the tab: a reload keeps it.
  await page.reload();
  await expect(home(page)).toBeVisible();
  await expect(page).toHaveTitle('Hangul Route lessons');

  // A later link in the same tab is read the same way and leaves the address too.
  await page.evaluate(() => {
    window.location.hash = '#t=jamo:nieun&s=report';
  });
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page.getByTestId('browse-focus-chip')).toHaveAttribute('aria-label', 'ㄴ, n, taught here');
});

test('BR-12a: the dashboard Open all lessons writes the gate pass before it leaves and opens All lessons in the same tab', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  await unlockWithPin(page);
  await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
  const open = page.getByRole('button', { name: 'Open all lessons' });
  await open.scrollIntoViewIfNeeded();
  const box = await open.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  await shot(page, 'br-12a-dashboard-open-all-lessons');

  const addresses: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) addresses.push(frame.url());
  });
  await open.click();
  await expect(home(page)).toBeVisible();
  await bootSettled(page);
  // Same tab, the gate fragment only (no learner, scope or locale in the address), then the root strips it.
  expect(addresses.some((url) => url.endsWith('/browse#s=gate'))).toBe(true);
  expect(page.url()).toMatch(/\/browse$/);
  const pass = JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)) ?? 'null') as Record<string, unknown> | null;
  expect(pass).toMatchObject({ v: 1, scope: 'sampler', source: 'gate', uiLocale: 'en' });
  expect(Object.keys(pass ?? {}).sort()).toEqual(['issuedAt', 'scope', 'seen', 'source', 'uiLocale', 'v']);
  // A gate pass: no pointer line and no keep switch (section 4.5).
  await expect(page.getByTestId('browse-keep')).toHaveCount(0);
  await shot(page, 'br-12a-browse-home-from-gate');
});

test('BR-12a: a dashboard left open past the 15-minute session asks for the PIN before Open all lessons writes a pass', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T09:00:00.000Z') });
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  await unlockWithPin(page);
  await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
  await page.clock.fastForward('16:00');

  await page.getByRole('button', { name: 'Open all lessons' }).click();
  // The PIN screen, still in the app, and no pass written.
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  expect(page.url()).not.toContain('/browse');
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)).toBeNull();

  // A correct PIN writes a fresh pass and opens All lessons in the same tab.
  await unlockWithPin(page);
  await expect(home(page)).toBeVisible();
  await bootSettled(page);
  expect(page.url()).toMatch(/\/browse$/);
  const pass = JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)) ?? 'null') as Record<string, unknown> | null;
  expect(pass).toMatchObject({ v: 1, scope: 'sampler', source: 'gate' });
});

test('BR-12b: /?gate=browse opens the PIN for All lessons; a correct PIN opens it with a fresh gate pass, Close on the PIN writes nothing', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/?gate=browse&lang=en');
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  // The intent leaves the address at once; other keys stay for the locale hand-off.
  expect(new URL(page.url()).searchParams.get('gate')).toBeNull();
  await shot(page, 'br-12b-gate-browse-pin');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)).toBeNull();

  await page.goto('/?gate=browse');
  await unlockWithPin(page);
  await expect(home(page)).toBeVisible();
  await expect(page).toHaveURL(/\/browse$/);
  const pass = JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)) ?? 'null') as Record<string, unknown> | null;
  expect(pass).toMatchObject({ v: 1, scope: 'sampler', source: 'gate' });
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
  // BR-12b: the way back is the grown-up area (/?gate=browse, PIN, then a fresh gate pass); Sign in stays.
  await expect(other.getByRole('button', { name: 'Back to the grown-up area' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Back to the app' })).toHaveCount(0);
  await expect(home(other)).toHaveCount(0);
  await expect(other.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await shot(other, 'br6-browse-access-unknown-pixel5');

  // Back to the grown-up area is the learner app's gate=browse intent: the PIN screen over the start screen (a
  // device with no PIN yet makes one first, as the dashboard asks), the intent gone from the address, no pass yet.
  await other.getByRole('button', { name: 'Back to the grown-up area' }).click();
  await expect(other.getByRole('heading', { name: 'Create a grown-up PIN' })).toBeVisible();
  expect(new URL(other.url()).search).toBe('');
  expect(await other.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)).toBeNull();
});

test('after 15 idle minutes the gate pass is over: Access says so and leads back to the grown-up area or the app', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T09:00:00.000Z') });
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();

  await page.clock.fastForward('15:00');
  await page.reload();
  await expect(accessTitle(page)).toBeVisible();
  await expect(page.getByText('Your time in the grown-up area ended.', { exact: true })).toBeVisible();
  await expect(page.getByText('Go back to the app, then open the grown-up area again.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to the grown-up area' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();

  // Back in the learner app, the pass is gone (F-APP-001 section 3.9 clearing): a device handed back cannot
  // reopen All lessons from this tab by typing /browse (section 4.3, BR-6 review).
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PASS_KEY)).toBeNull();
  await page.goto('/browse');
  await expect(accessTitle(page)).toBeVisible();

  // Typed into the address bar: no referrer, so a gate pass leaves for the learner app, and the tab keeps no unlock.
  await writeGatePass(page);
  await page.evaluate((k) => sessionStorage.setItem(k, '{"v":1,"at":1,"seen":1,"src":"pin"}'), UNLOCK_KEY);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_KEY)).toBeNull();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Close after a later link skips its history entry and goes back to the page the tab came from', async ({ page }) => {
  await page.goto('/?from=e2e');
  await writeGatePass(page);
  await page.evaluate(() => window.location.assign('/browse#s=gate'));
  await expect(home(page)).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#t=stage:stage1&s=route';
  });
  await expect(page).toHaveURL(/\/browse$/);
  await expect(home(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/\?from=e2e$/);
});

test('Close in a new tab opened from an app page (a referrer, nothing to go back to) leaves by address', async ({ page, context }) => {
  await page.goto('/?from=e2e');
  await writeGatePass(page);
  await page.evaluate((k) => sessionStorage.setItem(k, '{"v":1,"at":1,"seen":1,"src":"pin"}'), UNLOCK_KEY);
  // `window.open` copies the tab's sessionStorage (the pass) and sets a same-origin referrer; the new tab's history has one entry.
  const [tab] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => void window.open('/browse', '_blank'))]);
  await expect(home(tab)).toBeVisible();
  expect(await tab.evaluate(() => [document.referrer !== '', history.length])).toEqual([true, 1]);
  // The copied unlock is gone: this tab cannot go back to a console page, so it keeps nothing (BR-6 review).
  expect(await tab.evaluate((k) => sessionStorage.getItem(k), UNLOCK_KEY)).toBeNull();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_KEY)).not.toBeNull();
  await tab.getByRole('button', { name: 'Close' }).click();
  await expect(tab).toHaveURL(/\/$/);
});

test('Close shows the border.focus ring on keyboard focus', async ({ page }) => {
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();
  const close = headerClose(page);
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
  await page.evaluate(showTabAgain);
  await expect(home(page)).toBeVisible();

  await page.clock.fastForward('01:00');
  await page.evaluate(showTabAgain);
  await expect(accessTitle(page)).toBeVisible();
  await expect(home(page)).toHaveCount(0);
});

test('a reload is not activity: 14 idle minutes, a reload, then 2 more, and the gate pass is over', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T09:00:00.000Z') });
  await page.goto('/');
  await writeGatePass(page);
  await page.goto('/browse');
  await expect(home(page)).toBeVisible();

  await page.clock.fastForward('14:00');
  await page.reload();
  await expect(home(page)).toBeVisible();
  await page.clock.fastForward('02:00');
  await page.reload();
  await expect(accessTitle(page)).toBeVisible();
});

test('at 320 wide the Access screen keeps 64 targets and nothing runs off the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/browse');
  await expect(accessTitle(page)).toBeVisible();
  for (const name of ['Back to the grown-up area', 'Sign in']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(64);
    expect((box?.x ?? 0) + (box?.width ?? 0), name).toBeLessThanOrEqual(320);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await shot(page, 'br6-browse-access-320');
});

/* ---------------------------------------------------------------------------------------------
 * BR-7 (sections 4.2 to 4.6, 4.9, 7; mocks design/screens/browse/home.md, episode.md, item.md,
 * lesson-display.md): home, the episode outline, the item page, the card, Lesson display and the
 * keep switch. The learner Route tab is on in this build (`flags.myRouteEnabled`, F-ROUTE-001 R-10b), so the
 * section control has three segments, home opens on Route, and the Journey has no stage line (section 4.2).
 * ------------------------------------------------------------------------------------------- */

/** The account pass the console's `openBrowse` writes (BR-10). */
function writeAccountPass(page: Page, over: { scope?: 'full' | 'sampler'; fallback?: boolean } = {}): Promise<void> {
  return page.evaluate(
    ([key, scope, fallback]) => {
      const at = Date.now();
      sessionStorage.setItem(key, JSON.stringify({ v: 1, scope, source: 'account', issuedAt: at, seen: at, ...(fallback ? { fallback: true } : {}) }));
    },
    [PASS_KEY, over.scope ?? 'full', over.fallback === true] as const,
  );
}

async function openBrowse(page: Page, pass: 'gate' | 'account', fragment = ''): Promise<void> {
  await page.goto('/');
  if (pass === 'gate') await writeGatePass(page);
  else await writeAccountPass(page);
  await page.goto(`/browse${fragment}`);
  await expect(home(page).or(page.getByTestId('browse-item')).or(page.getByTestId('browse-episode-screen')).first()).toBeVisible();
}

/** Every visible target a grown-up can press on the page, with its box and its row (for the Journey-cell exception). */
function pressableBoxes(page: Page): Promise<{ name: string; width: number; height: number; journeyStage: string | null }[]> {
  return page.evaluate(() => {
    const out: { name: string; width: number; height: number; journeyStage: string | null }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[role="button"],[role="radio"],[role="switch"],[role="link"],button,a'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const row = el.closest('[data-testid^="journey-stage-"]');
      out.push({ name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '', width: r.width, height: r.height, journeyStage: row?.getAttribute('data-testid') ?? null });
    }
    return out;
  });
}

test('home: the layers in order for an account pass, one-row section control, no closed mark with the switch off', async ({ page }) => {
  await openBrowse(page, 'account');
  const pointer = page.getByRole('link', { name: 'To see how your learner is doing, open your home page.' });
  await expect(pointer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Romanization', exact: true })).toBeVisible();
  const group = page.getByRole('radiogroup', { name: 'Show lessons by' });
  await expect(group.getByRole('radio')).toHaveCount(3);
  expect(await group.getByRole('radio').allInnerTexts()).toEqual(['Route', 'Journey', 'Library']);
  // Route is the first section and home opens on it (section 4.2, the learner's order).
  await expect(group.getByRole('radio', { name: 'Route' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('browse-route')).toBeVisible();
  await group.getByRole('radio', { name: 'Journey' }).click();
  await expect(group.getByRole('radio', { name: 'Journey' })).toHaveAttribute('aria-checked', 'true');
  // With the Route section present the Journey has no stage line: Route already lists the stages. The kill-switch
  // build (EXPO_PUBLIC_MY_ROUTE_ENABLED=false) brings the line back; `journeyStageLine` (home-view.test.ts) pins it.
  await expect(page.getByRole('button', { name: '7 stages, from letters to your own words' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Keep lessons on this device for 7 days, also offline' })).toHaveAttribute('aria-checked', 'false');
  // Reading order: title, how-to, pointer, sections, keep switch.
  const tops = await Promise.all(
    [home(page), page.getByText('Tap a lesson to see what it teaches, then play it. Nothing is saved.'), pointer, group, page.getByTestId('journey-stage-stage1'), page.getByTestId('browse-keep')].map(async (l) => (await l.boundingBox())?.y ?? -1),
  );
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  // The switch is off in production: no scope line, no dotted ring, no billing, nowhere.
  await expect(page.getByTestId('browse-scope-line')).toHaveCount(0);
  await expect(page.locator('[data-testid^="journey-ring-notOpen"]')).toHaveCount(0);
  await expect(page.getByTestId('journey-legend')).toHaveCount(0);
  await shot(page, 'br7-browse-home-journey-pixel5');

  // Library: Cards (theme chips) and Words; arrow keys move the section control.
  await group.getByRole('radio', { name: 'Journey' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'Library' })).toHaveAttribute('aria-checked', 'true');
  await expect(group.getByRole('radio', { name: 'Library' })).toBeFocused();
  await expect(page.getByRole('group', { name: 'Themes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Food, \d+ words\. Opens the topic\.$/ })).toBeVisible();
  // Story Time tiles carry no learner state (section 4.5, BD2): no New, Keep reading or Finished word.
  const stories = page.locator('[data-testid^="browse-story-"]');
  await expect(stories.first()).toBeVisible();
  for (const tile of await stories.all()) {
    await expect(tile).toHaveAttribute('aria-label', /^.+\. About \d+ minutes?\.$/);
    // The state line sat between the romanization and the minutes; a title may still hold such a word.
    await expect(tile).not.toContainText(/(New|Keep reading|Finished)about \d+ min$/);
  }
  await shot(page, 'br7-browse-home-library-pixel5');
});

test('home for a gate pass: no pointer line and no keep switch', async ({ page }) => {
  await openBrowse(page, 'gate');
  await expect(page.getByRole('link', { name: 'To see how your learner is doing, open your home page.' })).toHaveCount(0);
  await expect(page.getByTestId('browse-keep')).toHaveCount(0);
});

test('offline: the Offline chip, and no pointer line', async ({ page, context }) => {
  await openBrowse(page, 'account');
  await context.setOffline(true);
  await expect(page.getByTestId('browse-offline')).toBeVisible();
  await expect(page.getByTestId('browse-pointer')).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.getByTestId('browse-pointer')).toBeVisible();
});

test('at 320 wide the section control stays on one row and every target is at least 64, Journey cells aside', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openBrowse(page, 'account');
  const radios = page.getByRole('radiogroup', { name: 'Show lessons by' }).getByRole('radio');
  const ys = await radios.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1);
  // Route first: it is the section home opens on (F-ROUTE-001 R-10b), measured before any tap moves away.
  await expect(page.getByRole('radio', { name: 'Route' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('browse-route')).toBeVisible();
  for (const section of ['Route', 'Journey', 'Library'] as const) {
    if (section !== 'Route') await page.getByRole('radio', { name: section }).click();
    for (const box of await pressableBoxes(page)) {
      // F-BROWSE-001 section 7 and section 15: the learner JourneyGrid is reused unchanged and its cells are 54 to 56
      // at 320 wide (they share the row's width), a recorded exception named by its journey-stage-<stage> row.
      if (box.journeyStage !== null) continue;
      expect(box.height, `${section}: ${box.name}`).toBeGreaterThanOrEqual(64);
      expect(box.width, `${section}: ${box.name}`).toBeGreaterThanOrEqual(64);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await shot(page, 'br7-browse-home-320');
});

test('a Route stage row shows that stage on the Journey: the Journey section is selected and the stage row is on screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openBrowse(page, 'account');
  const route = page.getByTestId('browse-route');
  await expect(route).toBeVisible();
  // The Route trail's stage rows are the learner trail's own (StageRowItem, my-route-stage-<order>); the last one's
  // stage sits below the fold of the Journey grid, so revealing it proves the jump, not the first screen.
  const rows = route.locator('[data-testid^="my-route-stage-"]');
  expect(await rows.count()).toBeGreaterThan(1);
  const last = rows.last();
  const order = (await last.getAttribute('data-testid'))?.replace('my-route-stage-', '');
  await last.getByRole('button').first().click();
  await expect(page.getByRole('radio', { name: 'Journey' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('browse-route')).toHaveCount(0);
  await expect(page.getByTestId(`journey-stage-stage${order}`)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test('Journey cell, episode outline, item page with Where it sits, See on the Journey and the card', async ({ page }) => {
  await openBrowse(page, 'account');
  await page.getByRole('radio', { name: 'Journey' }).click();
  await page.getByTestId('journey-stage-stage1').getByRole('button').first().click();
  await expect(page.getByTestId('browse-episode-screen')).toBeVisible();
  // Back is the route's ScreenHeader (AMENDMENTS-DISPLAY-NAV section 7.1): the arrow and the word, top left.
  await expect(headerBack(page)).toHaveAccessibleName('Back');
  await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
  await expect(page.getByText(/^About \d+ minutes$/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cards in this episode' })).toBeVisible();
  await shot(page, 'br7-browse-episode-pixel5');

  await page.getByRole('button', { name: 'Open Meet a, eo, g, n' }).click();
  await expect(page.getByTestId('browse-item')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meet a, eo, g, n' })).toBeVisible();
  await expect(page.getByTestId('browse-facts-letters')).toBeVisible();
  await expect(page.getByTestId('browse-facts-syllables').getByLabel('거, geo')).toBeVisible();
  await expect(page.getByTestId('browse-facts-steps')).toContainText(/^Steps\s*Hello · .* · Finish$/);
  await expect(page.getByTestId('browse-where')).toHaveText('Stage 1 · Letters · lesson 1 of 3');
  // The switch is off: no closed line and no billing anywhere.
  await expect(page.getByTestId('browse-item-closed')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open billing' })).toHaveCount(0);
  await shot(page, 'br7-browse-item-pixel5');

  await page.getByTestId('browse-item-card').click();
  await expect(page.getByTestId('browse-card-screen')).toBeVisible();
  await shot(page, 'br7-browse-card-pixel5');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('browse-card-screen')).toHaveCount(0);
  await page.getByTestId('browse-item-card').click();
  // Escape that closes the Display (Aa) sheet over the card closes only the sheet: the card page stays.
  await page.getByTestId('screen-header-display').filter({ visible: true }).click();
  await expect(page.getByTestId('display-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('display-sheet')).toHaveCount(0);
  await expect(page.getByTestId('browse-card-screen')).toBeVisible();
  await headerClose(page).click();
  await expect(page.getByTestId('browse-card-screen')).toHaveCount(0);
  await expect(page.getByTestId('browse-item')).toBeVisible();

  await page.getByRole('button', { name: 'See on the Journey' }).click();
  await expect(home(page)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Journey' })).toHaveAttribute('aria-checked', 'true');
});

test('a report letter link opens the lesson that teaches it with the focus line and the marked chip', async ({ page }) => {
  await openBrowse(page, 'account', '#t=char:%E3%84%B4&s=report');
  await expect(page.getByTestId('browse-item')).toBeVisible();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page.getByTestId('browse-focus-line')).toContainText('Taught here:');
  await expect(page.getByTestId('browse-focus-chip')).toHaveAttribute('aria-label', 'ㄴ, n, taught here');
});

test('a lesson whose built syllables are words lists them under Words; a lesson with no letter has no Letters row', async ({ page }) => {
  // Rivers and Seas (F-CURR-001 T-1) builds 호수, 섬 and 강: gang is a word the lesson shows, the blocks of hosu are syllables.
  await openBrowse(page, 'account', '#t=quest:stage2-nature-q3&s=plan');
  await expect(page.getByRole('heading', { name: 'Rivers and Seas' })).toBeVisible();
  await expect(page.getByTestId('browse-facts-words').getByLabel('강, gang')).toBeVisible();
  await expect(page.getByTestId('browse-facts-syllables').getByLabel('강, gang')).toHaveCount(0);
  await expect(page.getByTestId('browse-facts-syllables').getByLabel('호, ho')).toBeVisible();
  await expect(page.getByTestId('browse-facts-letters')).toHaveCount(0);

  // Outdoor Words builds 나무: na is a word of another topic, but here only a block, so it stays a syllable.
  await page.evaluate(() => {
    window.location.hash = '#t=quest:stage2-nature-q1&s=plan';
  });
  await expect(page.getByRole('heading', { name: 'Outdoor Words' })).toBeVisible();
  await expect(page.getByTestId('browse-facts-syllables').getByLabel('나, na')).toBeVisible();
  await expect(page.getByTestId('browse-facts-words').getByLabel('나, na')).toHaveCount(0);

  await page.evaluate(() => {
    window.location.hash = '#t=quest:stage1-nature-q2&s=plan';
  });
  await expect(page.getByRole('heading', { name: 'Mountain, River, Sea' })).toBeVisible();
  await expect(page.getByTestId('browse-facts-letters')).toHaveCount(0);
});

test('an unknown lesson link opens home with the not-in-this-version line, which can be dismissed', async ({ page }) => {
  await openBrowse(page, 'account', '#t=quest:not-shipped&s=report');
  await expect(page.getByText('This lesson is not in this version of the app yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('This lesson is not in this version of the app yet.')).toHaveCount(0);
});

test('Romanization (formerly Lesson display): the choices apply at once, Done and Escape close, focus returns to the opener', async ({ page }) => {
  await openBrowse(page, 'account');
  const opener = page.getByRole('button', { name: 'Romanization', exact: true });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Romanization', exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Always shown' })).toHaveAttribute('aria-checked', 'true');
  // Romanization only (AMENDMENTS-DISPLAY-NAV section 6): the language and text size are the device's, on the Aa sheet.
  await expect(sheet.getByRole('radiogroup')).toHaveCount(1);
  await expect(sheet.getByText("These choices change only this preview. No learner's settings change.")).toBeVisible();
  await sheet.getByRole('radio', { name: 'Hidden until tap' }).click();
  await expect(sheet.getByRole('radio', { name: 'Hidden until tap' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'br7-browse-lesson-display-pixel5');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);

  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Romanization', exact: true }).getByRole('radio', { name: 'Hidden until tap' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Romanization', exact: true })).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('the Aa button beside Romanization opens the device Display sheet: the language reaches the whole device', async ({ page }) => {
  await openBrowse(page, 'account');
  const aa = page.getByTestId('screen-header-display').filter({ visible: true }).first();
  await expect(aa).toHaveAccessibleName('Aa, Display: language and text size');
  await aa.click();
  const sheet = page.getByTestId('display-sheet').filter({ visible: true });
  await expect(sheet.getByRole('radiogroup', { name: 'Language' }).getByRole('radio')).toHaveText(['English', 'Español', '한국어']);
  await expect(sheet.getByRole('radiogroup', { name: 'Text size' }).getByRole('radio')).toHaveCount(4);
  await sheet.getByRole('radio', { name: 'Español' }).click();
  await sheet.getByRole('button', { name: 'Usar Español' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  // The device record, which the write fence admits (it holds no learner data).
  await expect.poll(async () => JSON.parse((await readAllStored(page))['hr:device:settings'] ?? '{}').uiLocale).toBe('es');
});

test('keep switch: on keeps the pass for a new tab, also offline; off removes it, and this tab keeps working', async ({ page, context }) => {
  await openBrowse(page, 'account');
  const keep = page.getByRole('switch', { name: 'Keep lessons on this device for 7 days, also offline' });
  await keep.click();
  await expect(keep).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => Object.keys(await readAllStored(page)).filter((k) => k.startsWith('hr:browse:') && k !== BROWSE_QUEUE).sort()).toEqual(['hr:browse:pass', 'hr:browse:prefs']);
  const stored = await readAllStored(page);
  expect(Object.keys(JSON.parse(stored['hr:browse:pass'] ?? '{}')).sort()).toEqual(['keptAt', 'scope', 'v']);

  // A new tab has no session pass: the kept pass opens home (no pointer line, the switch shows on).
  const other = await context.newPage();
  await other.goto('/browse');
  await expect(home(other)).toBeVisible();
  await expect(other.getByTestId('browse-pointer')).toHaveCount(0);
  await expect(other.getByRole('switch', { name: 'Keep lessons on this device for 7 days, also offline' })).toHaveAttribute('aria-checked', 'true');
  // Offline, a reload still opens (the service worker serves the app; the kept pass lets it in).
  await context.setOffline(true);
  await other.reload();
  await expect(home(other)).toBeVisible();
  await context.setOffline(false);

  // Off removes both keys; this tab keeps the pass it resolved until it reloads, then Access.
  await other.getByRole('switch', { name: 'Keep lessons on this device for 7 days, also offline' }).click();
  await expect.poll(async () => Object.keys(await readAllStored(other)).filter((k) => k === 'hr:browse:pass' || k === 'hr:browse:prefs')).toEqual([]);
  await expect(home(other)).toBeVisible();
  await other.reload();
  await expect(accessTitle(other)).toBeVisible();
});

test('the catalogue writes nothing of a learner: home, an outline, an item page and a card', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  const deviceBefore = await snapshotDevice(page);
  await writeGatePass(page);
  await page.evaluate(() => window.location.assign('/browse#t=episode:stage1-letters&s=gate'));
  await expect(page.getByTestId('browse-episode-screen')).toBeVisible();
  await bootSettled(page);
  await page.getByRole('button', { name: 'Open Meet a, eo, g, n' }).click();
  await page.getByTestId('browse-item-card').click();
  await headerClose(page).click();
  await page.getByRole('button', { name: 'Romanization', exact: true }).click();
  await page.getByRole('radio', { name: 'Hidden until tap' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const deviceAfter = await snapshotDevice(page);
  expect(changedOutsideBrowse(deviceBefore, deviceAfter).filter((k) => !k.startsWith('session:hr:grownup') && !k.startsWith('session:hr:console'))).toEqual([]);
  expect((await readAllStored(page))[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
});

/* ---------------------------------------------------------------------------------------------
 * BR-8: the preview (sections 4.7, 4.8, 4.10; mocks design/screens/browse/preview-player.md,
 * preview-end.md, preview-frame.md). A full Stage 1 lesson plays as the learner sees it under the
 * preview strip and ends on the preview end screen; nothing of a learner changes on the device.
 * The strip's first mount (BR-6 built it) is measured here.
 * ------------------------------------------------------------------------------------------- */


const strip = (page: Page) => page.getByTestId('preview-strip');
/** The visually hidden status regions that hold the strip's text: one per focused lesson screen. */
const announced = (page: Page) => page.getByTestId('preview-strip-status');

async function openLessonPage(page: Page, questId: string): Promise<void> {
  await page.goto('/');
  await writeGatePass(page);
  await page.goto(`/browse#t=${questId}&s=report`);
  await expect(page.getByTestId('browse-item')).toBeVisible();
}

test('a full Stage 1 lesson, its end screen and its card write nothing of a learner', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  const storedBefore = await readAllStored(page);
  const deviceBefore = await snapshotDevice(page);
  await writeGatePass(page);
  await page.evaluate(() => window.location.assign('/browse#t=quest:stage1-letters-q1&s=gate'));
  await expect(page.getByRole('heading', { name: 'Meet a, eo, g, n' })).toBeVisible();
  await bootSettled(page);

  // No strip on the catalogue pages.
  await expect(strip(page)).toHaveCount(0);
  await page.getByTestId('browse-preview').click();

  // The learner player, unchanged, under the strip: Hello, Look and learn, the games, the Check, Finish.
  await expect(strip(page)).toBeVisible();
  await expect(page.getByTestId('preview-strip-text')).toHaveText('Preview. Nothing is saved.');
  await expect(announced(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  // A game step is a lesson screen too: the strip sits above the learner game, announced once for this screen.
  await expect(page.locator('[data-testid^="listen-pick-option-"]').first()).toBeVisible();
  await expect(page.getByTestId('preview-leave').last()).toBeVisible();
  await expect(announced(page)).toHaveCount(1);
  await answerCheckRounds(page);
  await page.getByRole('button', { name: 'See results' }).click();

  // The preview end screen replaces Results: no stars, no score, a still card.
  await expect(page.getByRole('heading', { name: 'That is the whole lesson.' })).toBeVisible();
  await expect(page.getByText('At this point a learner sees 1 to 3 stars and collects:')).toBeVisible();
  await expect(page.getByText('Wonderful!')).toHaveCount(0);
  await expect(page.getByTestId('preview-leave')).toHaveCount(0);
  // The end screen's strip has no button and is announced once too.
  await expect(announced(page)).toHaveCount(1);
  await expect(page.getByTestId('browse-end-next')).toHaveText('Next lesson');
  await shot(page, 'br8-browse-preview-end-pixel5');
  await page.getByTestId('browse-end-card').click();
  await expect(headerClose(page)).toBeVisible();
  await headerClose(page).click();
  await page.getByTestId('browse-end-back').click();
  await expect(page.getByRole('heading', { name: 'Meet a, eo, g, n' })).toBeVisible();

  const deviceAfter = await snapshotDevice(page);
  expect(changedOutsideBrowse(deviceBefore, deviceAfter).filter((k) => !k.startsWith('session:hr:grownup') && !k.startsWith('session:hr:console'))).toEqual([]);
  // Every stored key and value is what it was (the learner's progress, profiles and account keys included), the
  // learner telemetry queue byte for byte; only `browse:*` may differ.
  const stored = await readAllStored(page);
  const changed = [...new Set([...Object.keys(storedBefore), ...Object.keys(stored)])].filter((k) => storedBefore[k] !== stored[k]);
  expect(changed.filter((k) => !k.startsWith('hr:browse:'))).toEqual([]);
  expect(stored[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
});

test('Leave preview asks once (the strip, the header Close and the browser back alike): Keep going stays, Leave goes back to the lesson page with no end screen', async ({ page }) => {
  await openLessonPage(page, 'quest:stage1-letters-q1');
  await page.getByTestId('browse-preview').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('preview-leave').click();
  await expect(page.getByRole('alertdialog', { name: 'Leave this preview?' })).toBeVisible();
  await shot(page, 'br8-browse-leave-confirm-pixel5');
  await page.getByTestId('browse-leave-keep').click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(strip(page)).toBeVisible();
  // The header's Close and the browser back ask the same question as Leave preview (one leave, F-BROWSE-001 §4.8),
  // never the learner's quest sheet; the browser back while it is open answers Keep going.
  await headerClose(page).click();
  await expect(page.getByRole('alertdialog', { name: 'Leave this preview?' })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(strip(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('alertdialog', { name: 'Leave this preview?' })).toBeVisible();
  await page.getByTestId('browse-leave-keep').click();
  await page.getByTestId('preview-leave').click();
  await page.getByTestId('browse-leave-confirm').click();
  await expect(page.getByRole('heading', { name: 'Meet a, eo, g, n' })).toBeVisible();
  await expect(page.getByTestId('browse-preview-end')).toHaveCount(0);
  await expect(strip(page)).toHaveCount(0);
  // A new preview starts at the beginning: the run was discarded.
  await page.getByTestId('browse-preview').click();
  await expect(page.getByText('Hi from Hoya')).toBeVisible();
});

test('the preview strip at 320 wide: at most PREVIEW_STRIP_MAX_HEIGHT, text and Leave preview apart, nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openLessonPage(page, 'quest:stage1-letters-q1');
  await page.getByTestId('browse-preview').click();
  await expect(strip(page)).toBeVisible();
  const box = await strip(page).boundingBox();
  // PREVIEW_STRIP_MAX_HEIGHT (logic/browse/layout.ts), measured on the mock at 320 with 200 % text. React Native Web
  // draws in px, so the browser's text size does not reach it (BR-6 note): this is the default size at 320.
  expect(box?.height ?? Infinity).toBeLessThanOrEqual(135);
  const text = await page.getByTestId('preview-strip-text').boundingBox();
  const leave = await page.getByTestId('preview-leave').boundingBox();
  if (!text || !leave) throw new Error('the strip draws its text and Leave preview');
  const apart = text.x + text.width <= leave.x || leave.x + leave.width <= text.x || text.y + text.height <= leave.y || leave.y + leave.height <= text.y;
  expect(apart).toBe(true);
  expect(leave.height).toBeGreaterThanOrEqual(64);
  for (const id of ['preview-strip-text', 'preview-leave']) {
    expect(await page.getByTestId(id).evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  }
  // The learner close control starts below the strip: the strip pushes the lesson down, never covers it.
  const close = await headerClose(page).boundingBox();
  expect((close?.y ?? 0) + 0.5).toBeGreaterThanOrEqual((box?.y ?? 0) + (box?.height ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await shot(page, 'br8-browse-preview-320');
});

test('Leave preview shows the border.focus ring on keyboard focus, and the strip is announced once per screen', async ({ page }) => {
  await openLessonPage(page, 'quest:stage1-letters-q1');
  await page.getByTestId('browse-preview').click();
  const leave = page.getByTestId('preview-leave');
  const ring = () => leave.evaluate((el) => getComputedStyle(el).borderTopColor);
  const atRest = await ring();
  await leave.focus();
  await expect.poll(ring).not.toBe(atRest);
  // One announcement for the screen that has focus, with the strip's own words.
  await expect(announced(page)).toHaveCount(1);
  await expect(announced(page)).toHaveText('Preview. Nothing is saved.');
  // Back on the item page there is no strip, so nothing is announced.
  await page.getByTestId('preview-leave').click();
  await page.getByTestId('browse-leave-confirm').click();
  await expect(announced(page)).toHaveCount(0);
});

/** A reviewed Story Time tale of the release build (content anchor: changes with the shelf). */
const STORY_ID = 'story:chuseok-ganggangsullae';

test('a story plays as the learner replay reader under the strip, ends on the story end screen and writes nothing', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  const before = await readAllStored(page);
  await writeGatePass(page);
  await page.evaluate((id) => window.location.assign(`/browse#t=${id}&s=gate`), STORY_ID);
  await expect(page.getByTestId('browse-item')).toBeVisible();
  await bootSettled(page);

  // The sources page from the item page: Copy link only, no Open, and no strip (it is not a lesson screen).
  await page.getByTestId('browse-see-sources').click();
  await expect(page.getByTestId('story-sources-title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open link' })).toHaveCount(0);
  await expect(page.getByTestId('preview-strip')).toHaveCount(0);
  await headerBack(page).click();
  await expect(page.getByTestId('browse-preview')).toHaveText('Preview this story');
  await expect(page.getByTestId('browse-preview-questions')).toBeVisible();

  // The replay reader at scene 1 of the lowest level, under the strip.
  await page.getByTestId('browse-preview').click();
  await expect(page.getByTestId('preview-strip')).toBeVisible();
  await expect(position(page)).toHaveText(/^1 \/ \d+$/);
  await shot(page, 'br8-browse-story-reader-pixel5');
  const total = Number(/\/ (\d+)$/.exec(await position(page).innerText())?.[1] ?? '0');
  for (let i = 1; i <= total; i += 1) await nextPage(page);
  await page.getByTestId('story-reader-end-primary').click();

  // The story form of the end screen: no stars, no card.
  await expect(page.getByRole('heading', { name: 'That is the whole story.' })).toBeVisible();
  await expect(page.getByText('A learner can read it again any time.')).toBeVisible();
  await expect(page.getByTestId('browse-end-card')).toHaveCount(0);
  await expect(page.getByTestId('browse-end-again')).toHaveText('Read again');
  await shot(page, 'br8-browse-story-end-pixel5');
  await page.getByTestId('browse-end-back').click();
  await expect(page.getByTestId('browse-item')).toBeVisible();

  // Preview the questions plays the story's quest, and Leave returns to the story page, not the quest's page.
  await page.getByTestId('browse-preview-questions').click();
  await expect(page.getByTestId('preview-strip')).toBeVisible();
  await page.getByTestId('preview-leave').click();
  await page.getByTestId('browse-leave-confirm').click();
  await expect(page.getByTestId('browse-preview')).toHaveText('Preview this story');
  await expect(page.getByTestId('browse-preview-questions')).toBeVisible();

  const after = await readAllStored(page);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
  expect(changed.filter((k) => !k.startsWith('hr:browse:'))).toEqual([]);
  expect(after[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
});

/* ---------------------------------------------------------------------------------------------
 * BR-9: the word topic page (section 4.6 topic, section 4.7 vocabulary topic; mock
 * design/screens/browse/topic.md). Every word with its picture, romanization, gloss and a Hear
 * button; the flashcards (BR-9b, below) are its preview.
 * ------------------------------------------------------------------------------------------- */

test('a word topic lists every word with its Hear button, keeps 64 targets at 320 and writes nothing when heard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  const deviceBefore = await snapshotDevice(page);
  await writeAccountPass(page);
  await page.evaluate(() => window.location.assign('/browse#t=vocab-topic:food&s=report'));
  await expect(page.getByRole('heading', { name: 'Food' })).toBeVisible();
  await bootSettled(page);

  const rows = page.locator('[data-testid^="browse-topic-word-"]');
  await expect(rows).toHaveCount(12);
  await expect(page.getByRole('button', { name: /^Hear / })).toHaveCount(12);
  const sagwa = page.getByRole('button', { name: 'Hear sagwa' });
  await expect(sagwa).toBeVisible();
  // The flashcards are the topic's preview (BR-9b): one primary, pinned like the item page's.
  await expect(page.getByTestId('browse-preview')).toHaveText('Preview the flashcards');

  for (const box of await pressableBoxes(page)) {
    expect(box.height, box.name).toBeGreaterThanOrEqual(64);
    expect(box.width, box.name).toBeGreaterThanOrEqual(64);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await shot(page, 'br9-browse-topic-320');

  // Hearing a word plays it through the learner audio and saves nothing of a learner's.
  await sagwa.click();
  await page.getByRole('button', { name: 'Hear uyu' }).click();
  // Playback writes asynchronously: compare only once nothing more changes for 500 ms.
  let previous = '';
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await snapshotDevice(page));
        const settled = now === previous;
        previous = now;
        return settled;
      },
      { intervals: [500], timeout: 10_000 },
    )
    .toBe(true);
  const deviceAfter = await snapshotDevice(page);
  expect(changedOutsideBrowse(deviceBefore, deviceAfter).filter((k) => !k.startsWith('session:hr:grownup') && !k.startsWith('session:hr:console'))).toEqual([]);
  expect((await readAllStored(page))[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
});

/* ---------------------------------------------------------------------------------------------
 * BR-9b: [[ Preview the flashcards ]] on the word topic page (section 4.7, vocabulary topic; mock
 * design/screens/browse/topic-states.html). The learner F-VOC-003 flashcards run under the strip
 * in host mode 'preview': no reading practice switch, no vocabulary progress, no learner event.
 * Leave (the strip's, after its confirm, or the cards' own back and Stop) returns to the topic.
 * The whole chunk, its quick check and its summary run as the learner's, with no Speed round;
 * Next words plays the next run in place and Back to topic returns.
 * ------------------------------------------------------------------------------------------- */

/** Food's words by romanization (this file holds no Hangul): the quick check is answered by the word it shows. */
const FOOD_ROMANIZED: Record<string, string> = {
  'vocab:sagwa-apple': 'sagwa',
  'vocab:banana': 'banana',
  'vocab:uyu': 'uyu',
  'vocab:ppang': 'ppang',
  'vocab:bap': 'bap',
  'vocab:gimchi': 'gimchi',
  'vocab:gimbap': 'gimbap',
  'vocab:ramyeon': 'ramyeon',
  'vocab:mul': 'mul',
  'vocab:dalgyal': 'dalgyal',
  'vocab:ttalgi': 'ttalgi',
  'vocab:tteok': 'tteok',
};

/** Got it on every card of the run on screen, then the quick check answered right, to the chunk summary. */
async function finishFlashcardChunk(page: Page): Promise<void> {
  const cards = page.getByTestId('vocab-cards');
  const check = page.getByTestId('vocab-cards-check');
  await expect(cards).toBeVisible();
  for (let turned = 0; await cards.isVisible(); turned += 1) {
    expect(turned, 'a chunk is at most a handful of cards').toBeLessThan(8);
    await page.getByTestId('vocab-card-flip').click();
    await page.getByTestId('vocab-card-got-it').click();
    await expect(cards.or(check)).toBeVisible();
  }
  await expect(check).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick check' })).toBeVisible();
  const summary = page.getByTestId('vocab-cards-summary');
  const question = page.getByTestId('vocab-question-word');
  // At most two questions, each answered right.
  for (let i = 0; i < 2 && !(await summary.isVisible()); i += 1) {
    await expect(question).toBeVisible();
    const asked = await question.innerText();
    const id = Object.keys(FOOD_ROMANIZED).find((key) => asked.split(/\s+/).includes(FOOD_ROMANIZED[key]!));
    if (!id) throw new Error(`no Food word in "${asked}"`);
    // The answered word stays on screen with its gloss for a moment; the next question names another word.
    const stillAsking = async (): Promise<boolean> =>
      !(await summary.isVisible()) && (await question.innerText({ timeout: 500 }).catch(() => '')).split(/\s+/).includes(FOOD_ROMANIZED[id]!);
    await page.getByTestId(`vocab-question-option-${id}`).click();
    await expect(async () => {
      expect(await stillAsking(), `the check moved on from "${asked}"`).toBe(false);
    }).toPass({ intervals: [300], timeout: 5000 });
  }
  await expect(summary).toBeVisible({ timeout: 3000 });
}

/** The device and the stored keys, once playback has stopped writing (no change for 500 ms). */
async function expectNothingWritten(page: Page, deviceBefore: Stored, storedBefore: Stored): Promise<void> {
  let previous = '';
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await snapshotDevice(page));
        const settled = now === previous;
        previous = now;
        return settled;
      },
      { intervals: [500], timeout: 10_000 },
    )
    .toBe(true);
  const deviceAfter = await snapshotDevice(page);
  expect(changedOutsideBrowse(deviceBefore, deviceAfter).filter((k) => !k.startsWith('session:hr:grownup') && !k.startsWith('session:hr:console'))).toEqual([]);
  // No vocabulary progress, profile or setting of the learner's changed; only `browse:*` may differ.
  const stored = await readAllStored(page);
  const changed = [...new Set([...Object.keys(storedBefore), ...Object.keys(stored)])].filter((k) => storedBefore[k] !== stored[k]);
  expect(changed.filter((k) => !k.startsWith('hr:browse:'))).toEqual([]);
  expect(stored[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
}

/** A learner on the device, the snapshots taken, then the Food topic page in All lessons with a pass. */
async function openFoodTopic(page: Page): Promise<{ storedBefore: Stored; deviceBefore: Stored }> {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
  const storedBefore = await readAllStored(page);
  const deviceBefore = await snapshotDevice(page);
  await writeAccountPass(page);
  await page.evaluate(() => window.location.assign('/browse#t=vocab-topic:food&s=report'));
  await expect(page.getByRole('heading', { name: 'Food' })).toBeVisible();
  await bootSettled(page);
  return { storedBefore, deviceBefore };
}

test('BR-9b: Preview the flashcards plays the learner cards under the strip, leaves both ways to the topic page, and writes nothing', async ({ page }) => {
  const { storedBefore, deviceBefore } = await openFoodTopic(page);
  const topicTitle = page.getByRole('heading', { name: 'Food' });

  // The primary sits in the pinned footer, after the word list in reading order.
  const preview = page.getByTestId('browse-preview');
  await expect(preview).toHaveText('Preview the flashcards');
  await expect(strip(page)).toHaveCount(0);
  await shot(page, 'br9b-browse-topic-flashcards-pixel5');
  await preview.click();

  // The learner cards under the strip; a preview is nobody's, so there is no reading practice switch.
  await expect(strip(page)).toBeVisible();
  await expect(page.getByTestId('preview-strip-text')).toHaveText('Preview. Nothing is saved.');
  await expect(page.getByTestId('vocab-cards')).toBeVisible();
  await expect(page.getByTestId('vocab-cards-reading-practice')).toHaveCount(0);
  await expect(announced(page)).toHaveCount(1);
  await page.getByTestId('vocab-card-flip').click();
  await expect(page.getByTestId('vocab-card-got-it')).toBeVisible();
  await shot(page, 'br9b-browse-flashcards-back-pixel5');
  await page.getByTestId('vocab-card-got-it').click();

  // The strip's Leave asks once, then returns to the topic page with no end screen.
  await page.getByTestId('preview-leave').click();
  await expect(page.getByRole('alertdialog', { name: 'Leave this preview?' })).toBeVisible();
  await page.getByTestId('browse-leave-confirm').click();
  await expect(topicTitle).toBeVisible();
  await expect(strip(page)).toHaveCount(0);
  await expect(page.getByTestId('vocab-cards-leave')).toHaveCount(0);

  // Started again, the cards' own back keeps the learner question; Stop returns to the topic page too.
  await page.getByTestId('browse-preview').click();
  await expect(page.getByTestId('vocab-cards')).toBeVisible();
  await headerClose(page).click();
  await expect(page.getByRole('heading', { name: 'Keep going or stop for now?' })).toBeVisible();
  await page.getByTestId('vocab-cards-stop').click();
  await expect(topicTitle).toBeVisible();
  await expect(strip(page)).toHaveCount(0);

  await expectNothingWritten(page, deviceBefore, storedBefore);
});

test('BR-9b: a whole flashcard chunk, its quick check and its summary run under the strip with no Speed round; Next words plays on and Back to topic returns', async ({ page }) => {
  const { storedBefore, deviceBefore } = await openFoodTopic(page);
  const topicTitle = page.getByRole('heading', { name: 'Food' });
  await page.getByTestId('browse-preview').click();

  // The first chunk to its summary, the check in host mode preview; the strip stays over all of it.
  await finishFlashcardChunk(page);
  await expect(strip(page)).toBeVisible();
  await expect(page.getByTestId('vocab-cards-summary-line')).toBeVisible();
  await expect(page.getByTestId('vocab-cards-speed')).toHaveCount(0);
  await expect(page.getByTestId('vocab-cards-topic')).toBeVisible();
  await shot(page, 'br9b-browse-flashcards-summary-pixel5');

  // Next words plays the next run here, under the strip, from its first card.
  await page.getByTestId('vocab-cards-next').click();
  await expect(page.getByTestId('vocab-cards')).toBeVisible();
  await expect(page.getByTestId('vocab-card-front')).toBeVisible();
  await expect(strip(page)).toBeVisible();
  await expect(topicTitle).toHaveCount(0);

  // That run to its summary too, then Back to topic.
  await finishFlashcardChunk(page);
  await expect(page.getByTestId('vocab-cards-speed')).toHaveCount(0);
  await page.getByTestId('vocab-cards-topic').click();
  await expect(topicTitle).toBeVisible();
  await expect(strip(page)).toHaveCount(0);
  await expect(page.getByTestId('browse-preview')).toHaveText('Preview the flashcards');

  await expectNothingWritten(page, deviceBefore, storedBefore);
});

/*
 * The preview events are sent only by a build with an API address (EXPO_PUBLIC_API_BASE_URL, E2E_TELEMETRY=1); without
 * one the client sends nothing, so this case is reported as skipped, not passed:
 *   E2E_TELEMETRY=1 pnpm --filter @hangul-route/mobile exec playwright test browse -g "BR-9b: the preview events"
 */
test('BR-9b: the preview events: started with kind vocab-topic per run, ended once with reachedEnd after a summary', async ({ page }) => {
  test.skip(process.env.E2E_TELEMETRY !== '1', 'needs a web build with an API address (E2E_TELEMETRY=1)');
  const sent: Array<{ name: string; payload: Record<string, unknown> }> = [];
  await page.route('**/api/telemetry', async (route) => {
    const body = route.request().postDataJSON() as { name?: string; payload?: Record<string, unknown> } | null;
    if (body?.name?.startsWith('browse.preview_') && body.payload) sent.push({ name: body.name, payload: body.payload });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await openFoodTopic(page);
  const topicTitle = page.getByRole('heading', { name: 'Food' });

  // Left early by the strip: one started, one ended without reaching the end.
  await page.getByTestId('browse-preview').click();
  await expect(page.getByTestId('vocab-cards')).toBeVisible();
  await page.getByTestId('preview-leave').click();
  await page.getByTestId('browse-leave-confirm').click();
  await expect(topicTitle).toBeVisible();
  await expect.poll(() => sent.map((e) => [e.name, e.payload.kind, e.payload.itemId, e.payload.reachedEnd])).toEqual([
    ['browse.preview_started', 'vocab-topic', 'vocab-topic:food', undefined],
    ['browse.preview_ended', 'vocab-topic', 'vocab-topic:food', false],
  ]);
  sent.length = 0;

  // A whole chunk: the summary ends it (reachedEnd); Next words starts another run, Back to topic sends nothing more.
  await page.getByTestId('browse-preview').click();
  await finishFlashcardChunk(page);
  await page.getByTestId('vocab-cards-next').click();
  await expect(page.getByTestId('vocab-cards')).toBeVisible();
  await finishFlashcardChunk(page);
  await page.getByTestId('vocab-cards-topic').click();
  await expect(topicTitle).toBeVisible();
  await expect.poll(() => sent.map((e) => [e.name, e.payload.kind, e.payload.itemId, e.payload.reachedEnd])).toEqual([
    ['browse.preview_started', 'vocab-topic', 'vocab-topic:food', undefined],
    ['browse.preview_ended', 'vocab-topic', 'vocab-topic:food', true],
    ['browse.preview_started', 'vocab-topic', 'vocab-topic:food', undefined],
    ['browse.preview_ended', 'vocab-topic', 'vocab-topic:food', true],
  ]);
});

/* -------------------------------------------------------------------------------------------
 * BR-13: [ Present this ] on the item page (section 4.6 secondary action, OD-9; design
 * design/screens/presenter/present-this.md). A full pass, the presenter root (index.ts mounts
 * PresenterApp for /present since #591), and a block the presenter can draw: a lesson, a listed
 * story (F-TCH-004 PR 11) or a ready word topic (F-TCH-004 PR 12).
 * ------------------------------------------------------------------------------------------- */

/** Records every `window.open` address before it opens, so the deck can be read before the presenter strips it. */
function recordOpens(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as unknown as { __opened: string[]; open: typeof window.open };
    w.__opened = [];
    const original = window.open.bind(window);
    w.open = (url?: string | URL, target?: string, features?: string) => {
      w.__opened.push(String(url));
      return original(url, target, features);
    };
  });
}

function openedHrefs(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
}

function decodeHref(page: Page, href: string): Promise<Record<string, unknown>> {
  return page.evaluate((value) => {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Record<string, unknown>;
  }, href.slice('/present#d=1.'.length));
}

/** The learner's stored values, the presenter's own Recent lessons and the browse root's keys aside. */
function learnerStored(all: Stored): Stored {
  return Object.fromEntries(Object.entries(all).filter(([k]) => !k.includes('lecture:') && !k.startsWith('hr:browse:')));
}

test('BR-13: a lesson with a full pass shows Present this under the preview and opens a one-block deck in the presenter, in a new tab that opens no learner', async ({ page, context }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);

  await openLessonPage(page, 'quest:stage1-letters-q1');
  await bootSettled(page);
  // Taken after openLessonPage: its own visit to '/' boots the learner App once (the install-guide
  // visit count), which is this test's setup, not the presenter.
  const learnerBefore = learnerStored(await readAllStored(page));
  const present = page.getByTestId('browse-present');
  await expect(present).toHaveAccessibleName('Present this');
  await expect(present).toHaveAccessibleDescription("Opens this as slides for a classroom screen or a TV. No one's progress changes.");
  // Under Preview this lesson, in the same action bar.
  const previewBox = await page.getByTestId('browse-preview').boundingBox();
  const presentBox = await present.boundingBox();
  expect(previewBox && presentBox && presentBox.y > previewBox.y).toBe(true);
  expect(presentBox?.height ?? 0).toBeGreaterThanOrEqual(64);
  await shot(page, 'br13-present-this-393');

  await recordOpens(page);
  const [tab] = await Promise.all([context.waitForEvent('page'), present.click()]);
  const opened = await openedHrefs(page);
  expect(opened).toHaveLength(1);
  const href = opened[0] ?? '';
  expect(href.startsWith('/present#d=1.')).toBe(true);
  expect(await decodeHref(page, href)).toMatchObject({
    v: 1,
    title: 'Meet a, eo, g, n',
    blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
    picker: null,
    source: 'catalogue',
    options: { uiLocale: 'en' },
  });

  // The tab is the presenter, not the learner app: its start screen, the deck taken out of the
  // address, no learner greeting, no browse pass, no handle back to All lessons.
  await expect(tab.getByTestId('presenter-start')).toBeVisible();
  expect(new URL(tab.url()).pathname).toBe('/present');
  await expect.poll(() => tab.evaluate(() => window.location.hash)).toBe('');
  await expect(tab.getByText('Hi, Mina!')).toHaveCount(0);
  expect(await tab.evaluate((key) => sessionStorage.getItem(key), PASS_KEY)).toBeNull();
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  // No learner value changed on the device: the presenter keeps only its own Recent lessons.
  expect(learnerStored(await readAllStored(tab))).toEqual(learnerBefore);
  expect((await readAllStored(tab))[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
  await tab.close();

  // The item page stays where it was, and a second press is a fresh deck.
  await expect(page.getByTestId('browse-item')).toBeVisible();
  const [second] = await Promise.all([context.waitForEvent('page'), present.click()]);
  const both = await openedHrefs(page);
  expect(both).toHaveLength(2);
  const firstDeck = await decodeHref(page, both[0] ?? '');
  const secondDeck = await decodeHref(page, both[1] ?? '');
  expect(secondDeck.id).not.toBe(firstDeck.id);
  await second.close();
});

test('BR-13: Present this is not shown with a sampler pass; a story page shows it now the story slides have landed', async ({ page }) => {
  await page.goto('/');
  await writeAccountPass(page, { scope: 'sampler' });
  await page.goto('/browse#t=quest:stage1-letters-q1&s=report');
  await expect(page.getByTestId('browse-preview')).toBeVisible();
  await expect(page.getByTestId('browse-present')).toHaveCount(0);

  // F-TCH-004 PR 11 gave the lecture bundle its story adapter, so a listed story's one-block deck
  // has slides and the button shows on its page.
  await openLessonPage(page, STORY_ID);
  await expect(page.getByTestId('browse-preview')).toHaveText('Preview this story');
  await expect(page.getByTestId('browse-present')).toBeVisible();
});

test('BR-13: when the browser gives no new tab, one line under Present this says to allow pop-ups, and the page stays', async ({ page }) => {
  await openLessonPage(page, 'quest:stage1-letters-q1');
  await bootSettled(page);
  await page.evaluate(() => {
    (window as unknown as { open: () => null }).open = () => null;
  });
  await expect(page.getByTestId('browse-present-blocked')).toHaveCount(0);
  await page.getByTestId('browse-present').click();
  await expect(page.getByTestId('browse-present-blocked')).toHaveText('The new tab did not open. Allow pop-ups for this site, then try again.');
  await expect(page.getByTestId('browse-item')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/browse');
});

test('BR-13: at 1280 wide Present this sits under the preview inside the action width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openLessonPage(page, 'quest:stage1-letters-q1');
  const previewBox = await page.getByTestId('browse-preview').boundingBox();
  const presentBox = await page.getByTestId('browse-present').boundingBox();
  expect(presentBox?.width).toBe(previewBox?.width);
  expect(presentBox && previewBox && presentBox.y > previewBox.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await shot(page, 'br13-present-this-1280');
});

test('BR-13: at 320 x 568 both buttons stay pinned, under half the screen, and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openLessonPage(page, 'quest:stage1-letters-q1');
  const present = page.getByTestId('browse-present');
  await expect(present).toBeVisible();
  const previewBox = await page.getByTestId('browse-preview').boundingBox();
  const presentBox = await present.boundingBox();
  const footerBottom = (presentBox?.y ?? 0) + (presentBox?.height ?? 0);
  expect(presentBox && previewBox && presentBox.y > previewBox.y).toBe(true);
  expect(footerBottom).toBeLessThanOrEqual(568);
  expect(footerBottom - (previewBox?.y ?? 0)).toBeLessThan(568 / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test('BR-13: on a phone in landscape (568 x 320) only the preview stays pinned and Present this ends the page', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await openLessonPage(page, 'quest:stage1-letters-q1');
  const previewBox = await page.getByTestId('browse-preview').boundingBox();
  // The pinned bar is one button tall, so the facts keep most of the screen.
  expect((previewBox?.y ?? 0) + (previewBox?.height ?? 0)).toBeLessThanOrEqual(320);
  expect(previewBox?.height ?? 0).toBeLessThan(320 / 3);
  const present = page.getByTestId('browse-present');
  // Not pinned: at the top of the page it is below the facts, out of view, while the preview is pinned in view.
  await expect(page.getByTestId('browse-preview')).toBeInViewport();
  await expect(present).not.toBeInViewport();
  await present.scrollIntoViewIfNeeded();
  await expect(present).toBeInViewport();
  await expect(page.getByTestId('browse-preview')).toBeInViewport();
  await expect(present).toHaveAccessibleName('Present this');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

/* ---------------------------------------------------------------------------------------------
 * Switch on (F-BROWSE-001 sections 4.2, 4.5, 4.7 and 9; F-ENT-003 section 3.11; mocks browse/home.md
 * "sampler, switch on", browse/item.md, browse/topic.md): a sampler account pass sees the free-plan state
 * of a learner. Only on a dist built with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true (E2E_CONTENT_GATING=1,
 * the E3-13 switch-on lane). Closed items keep their pages: the grown-up caption "Opens with the Family
 * Plan or a Group License" in place of the preview, [ Open billing ] under it (`browse.plans_tapped`),
 * a closed topic without its Hear buttons, and the learner's "Not open yet" mark on closed Words rows.
 * ------------------------------------------------------------------------------------------- */
test.describe(SWITCH_ON_SUITE, () => {
  test.skip(!GATED, 'needs a web build with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true (E2E_CONTENT_GATING=1)');
  // The billing page is on the app host; a service worker would answer its navigation before the test route.
  test.use({ serviceWorkers: 'block' });

  const browse = getMessages('en').caregiver.browse;
  const notOpen = getMessages('en').learner.access.notOpen;
  /** A word topic a free learner has (FREE_VOCAB_TOPIC_IDS) and one it does not. */
  const OPEN_TOPIC = { id: 'vocab-topic:food', key: 'food' };
  const CLOSED_TOPIC = { id: 'vocab-topic:family', key: 'family' };
  /** A Stage 2 taste lesson: past the free Stage 1, so closed for a sampler. */
  const CLOSED_QUEST = 'quest:stage2-life-q1';

  async function openSampler(page: Page, fragment = ''): Promise<void> {
    await page.goto('/');
    await writeAccountPass(page, { scope: 'sampler' });
    await page.goto(`/browse${fragment}`);
    await expect(home(page).or(page.getByTestId('browse-item')).or(page.getByTestId('browse-episode-screen')).first()).toBeVisible();
  }

  test('home: the sampler line, the dotted ring on closed Journey cells, and Not open yet on closed Words rows only', async ({ page }) => {
    await openSampler(page);
    await expect(page.getByTestId('browse-scope-line')).toHaveText(browse.home.scope.sampler);
    const group = page.getByRole('radiogroup', { name: browse.home.section.label });
    await group.getByRole('radio', { name: browse.home.section.journey }).click();
    // A closed cell is the learner's: the dotted ring and its legend word, never a lock glyph.
    await expect(page.locator('[data-testid^="journey-ring-notOpen"]').first()).toBeVisible();
    await expect(page.getByTestId('journey-legend')).toContainText(notOpen);
    await shot(page, 'switch-on-browse-home-journey-pixel5');

    await group.getByRole('radio', { name: browse.home.section.library }).click();
    const closedRow = page.getByTestId(`browse-words-${CLOSED_TOPIC.key}`);
    const openRow = page.getByTestId(`browse-words-${OPEN_TOPIC.key}`);
    await closedRow.scrollIntoViewIfNeeded();
    await expect(page.getByTestId(`browse-words-${CLOSED_TOPIC.key}-not-open`)).toHaveText(notOpen);
    await expect(closedRow).toHaveAccessibleName(/^Family, \d+ words\. Not open yet\. Opens the topic\.$/);
    await expect(page.getByTestId(`browse-words-${OPEN_TOPIC.key}-not-open`)).toHaveCount(0);
    await expect(openRow).toHaveAccessibleName(/^Food, \d+ words\. Opens the topic\.$/);
    // Never a price, a product word or "route" as an access word (F-ENT-003 section 3.11).
    expect(await page.locator('body').innerText()).not.toMatch(/\$|Premium|upgrade|full route/i);
    await shot(page, 'switch-on-browse-home-words-pixel5');
  });

  test('a closed lesson page: the grown-up caption in place of the preview, and Open billing goes to billing', async ({ page }) => {
    await page.route('**/account/billing', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>billing</title>' }));

    await openSampler(page, `#t=${CLOSED_QUEST}&s=plan`);
    await expect(page.getByTestId('browse-item')).toBeVisible();
    const closed = page.getByTestId('browse-item-closed');
    await expect(closed).toContainText(browse.item.closed);
    await expect(page.getByTestId('browse-preview')).toHaveCount(0);
    await expect(page.getByTestId('browse-present')).toHaveCount(0);
    // The facts stay: what it teaches and where it sits.
    await expect(page.getByTestId('browse-where')).toHaveText(/^Stage 2 · /);
    await shot(page, 'switch-on-browse-item-closed-pixel5');

    await page.getByRole('button', { name: browse.item.openBilling.cta }).click();
    await expect(page).toHaveURL(/\/account\/billing$/);
  });

  /*
   * The event is sent only by a build with an API address (EXPO_PUBLIC_API_BASE_URL, E2E_TELEMETRY=1); without one
   * the client sends nothing, so this case is reported as skipped, not passed (the my-route.spec.ts R-10 pattern):
   *   E2E_CONTENT_GATING=1 E2E_TELEMETRY=1 pnpm --filter @hangul-route/mobile exec playwright test browse -g "plans_tapped"
   */
  test('a closed lesson page: Open billing sends browse.plans_tapped with its kind only', async ({ page }) => {
    test.skip(process.env.E2E_TELEMETRY !== '1', 'needs a web build with an API address (E2E_TELEMETRY=1)');
    const tapped: Array<Record<string, unknown>> = [];
    await page.route('**/api/telemetry', async (route) => {
      const body = route.request().postDataJSON() as { name?: string; payload?: Record<string, unknown> } | null;
      if (body?.name === 'browse.plans_tapped' && body.payload) tapped.push(body.payload);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/account/billing', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>billing</title>' }));

    await openSampler(page, `#t=${CLOSED_QUEST}&s=plan`);
    await page.getByRole('button', { name: browse.item.openBilling.cta }).click();
    await expect(page).toHaveURL(/\/account\/billing$/);
    await expect.poll(() => tapped).toEqual([{ kind: 'quest' }]);
  });

  test("a closed lesson's Journey cell and outline row carry the learner's mark and the caption, and Open still opens its page", async ({ page }) => {
    await openSampler(page);
    await page.getByRole('radio', { name: browse.home.section.journey }).click();
    // The closed cell's label is the learner Journey's (a11y.access.notOpen), read by reference.
    await page.getByRole('button', { name: getMessages('en').a11y.access.notOpen('Lunch Box Words') }).click();
    await expect(page.getByTestId('browse-episode-screen')).toBeVisible();
    const row = page.getByTestId(`browse-outline-${CLOSED_QUEST}`);
    await expect(row).toContainText(browse.item.closed);
    await shot(page, 'switch-on-browse-episode-closed-pixel5');
    await page.getByTestId(`browse-outline-open-${CLOSED_QUEST}`).click();
    await expect(page.getByTestId('browse-item-closed')).toBeVisible();
  });

  test('a closed topic keeps every word, picture, romanization and gloss and drops only the Hear buttons; an open one keeps them', async ({ page }) => {
    await openSampler(page, `#t=${CLOSED_TOPIC.id}&s=plan`);
    await expect(page.getByTestId('browse-item-closed')).toContainText(browse.item.closed);
    const words = page.locator('[data-testid^="browse-topic-word-"]');
    await expect(words.first()).toBeVisible();
    expect(await words.count()).toBeGreaterThan(0);
    await expect(page.locator('[data-testid^="browse-topic-hear-"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: browse.item.openBilling.cta })).toBeVisible();
    await shot(page, 'switch-on-browse-topic-closed-pixel5');

    await page.goto('/');
    await writeAccountPass(page, { scope: 'sampler' });
    await page.goto(`/browse#t=${OPEN_TOPIC.id}&s=plan`);
    await expect(page.getByTestId('browse-item')).toBeVisible();
    await expect(page.getByTestId('browse-item-closed')).toHaveCount(0);
    await expect(page.locator('[data-testid^="browse-topic-hear-"]').first()).toBeVisible();
  });

  test('a fallback pass sees the closed caption with no Open billing', async ({ page }) => {
    await page.goto('/');
    await writeAccountPass(page, { scope: 'sampler', fallback: true });
    await page.goto(`/browse#t=${CLOSED_QUEST}&s=plan`);
    await expect(page.getByTestId('browse-item-closed')).toContainText(browse.item.closed);
    await expect(page.getByRole('button', { name: browse.item.openBilling.cta })).toHaveCount(0);
  });
});
