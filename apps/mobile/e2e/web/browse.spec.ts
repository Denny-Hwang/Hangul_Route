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
const CONSOLE_KEY = 'hr:console:session';
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

/* ---------------------------------------------------------------------------------------------
 * BR-7 (sections 4.2 to 4.6, 4.9, 7; mocks design/screens/browse/home.md, episode.md, item.md,
 * lesson-display.md): home, the episode outline, the item page, the card, Lesson display and the
 * keep switch. The learner Route tab is off in this build (`flags.myRouteEnabled`), so the section
 * control has two segments and the Journey starts with the stage line.
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
  await expect(page.getByRole('button', { name: 'Lesson display' })).toBeVisible();
  const group = page.getByRole('radiogroup', { name: 'Show lessons by' });
  await expect(group.getByRole('radio')).toHaveCount(2);
  await expect(group.getByRole('radio', { name: 'Journey' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: '7 stages, from letters to your own words' })).toBeVisible();
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

  // The stage line opens the stage one-liners.
  await page.getByRole('button', { name: '7 stages, from letters to your own words' }).click();
  await expect(page.getByText('Stage 1 · Hangul')).toBeVisible();

  // Library: Cards (theme chips) and Words; arrow keys move the section control.
  await group.getByRole('radio', { name: 'Journey' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'Library' })).toHaveAttribute('aria-checked', 'true');
  await expect(group.getByRole('radio', { name: 'Library' })).toBeFocused();
  await expect(page.getByRole('group', { name: 'Themes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Food, \d+ words\. Opens the topic\.$/ })).toBeVisible();
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
  for (const section of ['Journey', 'Library'] as const) {
    await page.getByRole('radio', { name: section }).click();
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

test('Journey cell, episode outline, item page with Where it sits, See on the Journey and the card', async ({ page }) => {
  await openBrowse(page, 'account');
  await page.getByTestId('journey-stage-stage1').getByRole('button').first().click();
  await expect(page.getByTestId('browse-episode-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to all lessons' })).toBeVisible();
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
  await page.getByTestId('browse-card-back').click();
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
  await openBrowse(page, 'account', '#t=quest:stage2-life-q1&s=plan');
  await expect(page.getByRole('heading', { name: 'Lunch Box Words' })).toBeVisible();
  for (const word of ['산, san', '달, dal', '곰, gom']) await expect(page.getByTestId('browse-facts-words').getByLabel(word)).toBeVisible();
  await expect(page.getByTestId('browse-facts-syllables')).toHaveCount(0);
  await expect(page.getByTestId('browse-facts-letters')).toHaveCount(0);
  // Stage 2 games count for no skill (F-ROUTE-001 OD-5): the Skills row is hidden, never drawn empty.
  await expect(page.getByTestId('browse-facts-skills')).toHaveCount(0);

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

test('Lesson display: romanization choices apply at once, Done and Escape close, focus returns to the opener', async ({ page }) => {
  await openBrowse(page, 'account');
  const opener = page.getByRole('button', { name: 'Lesson display' });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Lesson display' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Always shown' })).toHaveAttribute('aria-checked', 'true');
  // Only English ships: no Language row.
  await expect(sheet.getByText('Language')).toHaveCount(0);
  await expect(sheet.getByText("These choices change only this preview. No learner's settings change.")).toBeVisible();
  await sheet.getByRole('radio', { name: 'Hidden until tap' }).click();
  await expect(sheet.getByRole('radio', { name: 'Hidden until tap' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'br7-browse-lesson-display-pixel5');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);

  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Lesson display' }).getByRole('radio', { name: 'Hidden until tap' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Lesson display' })).toHaveCount(0);
  await expect(opener).toBeFocused();
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
  await page.getByTestId('browse-card-back').click();
  await page.getByRole('button', { name: 'Lesson display' }).click();
  await page.getByRole('radio', { name: 'Hidden until tap' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const deviceAfter = await snapshotDevice(page);
  expect(changedOutsideBrowse(deviceBefore, deviceAfter).filter((k) => !k.startsWith('session:hr:grownup') && !k.startsWith('session:hr:console'))).toEqual([]);
  expect((await readAllStored(page))[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
});
