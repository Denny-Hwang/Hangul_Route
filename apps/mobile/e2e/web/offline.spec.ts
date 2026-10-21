import type { Page } from '@playwright/test';
import { GROWN_UP_PREFIXES, isGrownUpPath } from '@hangul-route/content-schema';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked } from './helpers';
import { nameIn } from './locale-matrix';

/**
 * Resolves once the worker is active (precache complete) and controls the page. Polled through
 * `page.evaluate`, which awaits the async check; `page.waitForFunction` would take the returned
 * Promise itself as truthy and resolve at once (F-APP-001 A-2 found this).
 */
async function controlledBySw(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return !!reg?.active && !!navigator.serviceWorker.controller;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * PWA acceptance (roadmap web-pwa-offline P2): after one online visit the
 * whole Stage 1 shell must load and play with the network gone.
 */
test('onboards, enters the first quest, and keeps working offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await expect(page.getByText("Hi! I'm Hoya.")).toBeVisible();

  // Onboarding: who, name, PIN + consent → first-quest preview → quest player.
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Suni' });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  // Wait until the service worker has finished precaching AND controls this
  // page (clientsClaim); `reg.active` alone can be true a tick before the
  // claim lands, and a reload in that gap goes to the (dead) network.
  await controlledBySw(page);
  // One online reload so the navigation itself is proven to be served by
  // the worker (the page loads already controlled), then cut the network.
  await page.reload();
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  // Profile persisted (IndexedDB) → app reopens on the learner surface, offline.
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByText(/collected/)).toBeVisible();

  expect(errors).toEqual([]);
});

/**
 * F-APP-001 A-2 (sections 3.4 and 3.12): app.hangulroute.com also serves grown-up pages under
 * /signin, /start, /teach, /parent and /account (console, from A-3). The learner worker sends a
 * grown-up navigation to the network only, never caches it, and without a network answers with the
 * precached offline page; the learner app keeps playing offline, and the learner roots and near
 * misses (/present, /browse, /teacher) keep the learner shell.
 */
const GROWN_UP_URLS = ['/parent', '/teach/home', '/teach', '/signin?persona=teacher', '/start', '/account/billing', '/teach.html'];

/** A path the learner worker must never keep: a grown-up path (R-1, the one implementation) or a console chunk. */
const isConsolePath = (p: string): boolean => isGrownUpPath(p) || p.startsWith('/_next/');

/** Every URL the worker keeps (precache and runtime caches), as paths. */
async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
    }
    return out;
  });
}

test('grown-up pages are never cached, show the offline page without a network, and learning still plays', async ({ page, context }) => {
  // The probe list keeps up with the prefix list it tests: every URL is grown-up, every prefix is probed.
  const probed = GROWN_UP_URLS.map((url) => new URL(url, 'http://x').pathname);
  for (const path of probed) expect(isGrownUpPath(path), path).toBe(true);
  for (const prefix of GROWN_UP_PREFIXES) {
    expect(probed.some((path) => isGrownUpPath(path) && path.startsWith(prefix)), prefix).toBe(true);
  }

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Suni' });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await controlledBySw(page);

  // The worker's script carries the denylist and the network-only rule.
  const sw = await (await page.request.get('/sw.js')).text();
  expect(sw).toContain('denylist');
  expect(sw).toContain('/grown-ups-offline.html');

  // Online, every grown-up URL goes to the network (the console page merged in by A-3, or the host's
  // single-page fallback for a page that does not exist yet), and nothing of it is kept by any cache.
  for (const url of GROWN_UP_URLS) {
    const res = await page.goto(url);
    expect(res?.ok(), url).toBe(true);
  }
  await page.goto('/');
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await cachedPaths(page);
  expect(cached).toContain('/grown-ups-offline.html');
  expect(cached).toContain('/index.html');
  expect(cached.filter(isConsolePath)).toEqual([]);

  // Offline, a grown-up navigation gets the offline page, never the learner shell and never what
  // the same URL showed online.
  await context.setOffline(true);
  for (const url of GROWN_UP_URLS) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: "You're offline" }), url).toBeVisible();
    await expect(page.getByText('Grown-up pages need the internet. Learning still works offline.')).toBeVisible();
    await expect(page.getByText('Hi, Suni!')).toHaveCount(0);
    expect(new URL(page.url()).pathname, url).toBe(new URL(url, 'http://x').pathname);
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle("You're offline");

  // Try again while still offline: the same offline page.
  await page.getByRole('link', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();

  // No sideways scroll at the phone and tablet widths of section 3.16.
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 667 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 393, height: 851 });

  // The learner roots and a near miss are never denied: offline they get the learner shell (the
  // index.html pwa-postbuild wrote), whichever root then mounts there (F-TCH-004, F-BROWSE-001).
  for (const url of ['/present', '/browse', '/teacher']) {
    await page.goto(url);
    await expect(page.locator('#root'), url).toBeAttached();
    await expect(page.locator('link[rel="manifest"]'), url).toBeAttached();
    expect(await page.evaluate(() => typeof (window as Window & { __hrApplyUpdate?: unknown }).__hrApplyUpdate), url).toBe('function');
    await expect(page.getByRole('heading', { name: "You're offline" }), url).toHaveCount(0);
  }
  // /teacher is a plain learner path: the learner home itself.
  await expect(page.getByText('Hi, Suni!')).toBeVisible();

  // Back to learning: the learner app opens and plays offline.
  await page.goto('/parent');
  await page.getByRole('link', { name: 'Back to learning' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByText(/collected/)).toBeVisible();

  // Still nothing grown-up in any cache after the offline visits.
  expect((await cachedPaths(page)).filter(isConsolePath)).toEqual([]);
  expect(errors).toEqual([]);
});

/** The lesson chunk bundles this page has loaded (F-CURR-002 §10): resource entries of the current document only. */
async function loadedLessonChunks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => /\/_expo\/static\/js\/web\/lessons-/.test(p)),
  );
}

const CELL_BUNDLE = /^\/_expo\/static\/js\/web\/lessons-cell-stage\d-[a-z]+-[0-9a-f]{32}\.js$/;
const TITLE_BUNDLE = /^\/_expo\/static\/js\/web\/lessons-titles-(es|ko)-[0-9a-f]{32}\.js$/;
const LETTERS_BUNDLE = /\/_expo\/static\/js\/web\/lessons-cell-stage2-letters-[0-9a-f]{32}\.js$/;

/** Journey > Stage 2 Letters & Books > Start, up to the first quest's Discover step (ㅐ and its example 개, from the chunk). */
async function playStage2LettersDiscover(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(2, 'Letters & Books'), exact: true }).click();
  await expect(page.getByText('Word Builder').first()).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
  await expect(page.getByText('ㅐ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('개', { exact: true }).first()).toBeVisible();
}

/**
 * F-CURR-002 §10 (row CM-5): the lesson bodies left the start bundle. Every cell's chunk and both title chunks
 * are precached after one online visit. Offline, once the first screen is up, every cell's chunk loads in the
 * background from the precache (so a session keeps every lesson whatever happens to the worker), the English
 * learner loads no title chunk, and an upper-stage lesson plays from its own chunk.
 */
test('lesson chunks are precached, load from the precache offline, and an upper-stage lesson plays offline (F-CURR-002 CM-5)', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Suni' });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await controlledBySw(page);

  const cached = await cachedPaths(page);
  expect(cached.filter((p) => CELL_BUNDLE.test(p))).toHaveLength(LESSON_EPISODES.length);
  expect(cached.filter((p) => TITLE_BUNDLE.test(p))).toHaveLength(2);

  // The worker serves the shell; with the network gone, the learner home opens, then every cell's chunk loads from the precache.
  await page.reload();
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await expect.poll(async () => (await loadedLessonChunks(page)).filter((p) => CELL_BUNDLE.test(p)).length, { timeout: 15_000 }).toBe(LESSON_EPISODES.length);
  expect((await loadedLessonChunks(page)).filter((p) => TITLE_BUNDLE.test(p))).toEqual([]);

  // Journey > Stage 2 Letters & Books: the cell page reads the manifest, and its first quest plays offline from its chunk.
  await playStage2LettersDiscover(page);
  expect((await loadedLessonChunks(page)).filter((p) => LETTERS_BUNDLE.test(p))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test.describe('in Spanish (F-CURR-002 CM-5: the title chunk of the active locale only)', () => {
  test.use({ locale: 'es-ES' });

  test('the Spanish lesson titles load from their own chunk and show offline, and the Korean ones never load', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    await controlledBySw(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect.poll(async () => (await loadedLessonChunks(page)).filter((p) => TITLE_BUNDLE.test(p))).toEqual([expect.stringMatching(/\/lessons-titles-es-[0-9a-f]{32}\.js$/)]);
    expect(errors).toEqual([]);
  });

  test('offline, Journey shows the Spanish title of a lesson cell and its quests, never the English one', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // Onboarding in Spanish, through the form's own words, is the locale suite's job; here the learner starts
    // in English and picks Español on Profile (one language per device), as a learner does.
    await page.goto('/?lang=en');
    await keepSidewaysIfAsked(page);
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Suni' });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await controlledBySw(page);
    await page.goto('/');
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.getByTestId('profile-display-row').click();
    const sheet = page.getByTestId('display-sheet');
    await sheet.getByRole('radio', { name: 'Español' }).click();
    await sheet.getByRole('button', { name: nameIn('es', (m) => m.common.display.confirm.use('Español')) }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await sheet.getByRole('button', { name: nameIn('es', (m) => m.common.buttons.done) }).click();

    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.getByText(nameIn('es', (m) => m.a11y.tabs.journey)).last().click();
    // The Stage 2 Letters & Books cell: its Spanish title (content/i18n/es/lessons-stage2-letters.json) from the es title chunk.
    await page.getByRole('button', { name: /^Etapa 2 [^,]+, Letters & Books/ }).click();
    await expect(page.getByText('Constructor de palabras').first()).toBeVisible();
    await expect(page.getByText('Pares de vocales ae y e').first()).toBeVisible();
    await expect(page.getByText('Word Builder')).toHaveCount(0);
    await expect(page.getByText('Vowel Pairs ae and e')).toHaveCount(0);
    expect((await loadedLessonChunks(page)).filter((p) => TITLE_BUNDLE.test(p))).toEqual([expect.stringMatching(/\/lessons-titles-es-[0-9a-f]{32}\.js$/)]);
    expect(errors).toEqual([]);
  });
});

/**
 * F-CURR-002 §10: a page with no worker in control (the iOS 14 home-screen app, a first visit) loads each chunk
 * from the network. A chunk URL that answers with the app's HTML page (a deploy landed: the host's single-page
 * fallback) reloads the page once, onto the new build, and the lesson then plays; a chunk that cannot load at all
 * shows the crash screen's Try again, never a reload loop, and Try again loads it once it can.
 */
test.describe('lesson chunks without a service worker (F-CURR-002 CM-5 recovery)', () => {
  test.use({ serviceWorkers: 'block' });

  test('a chunk of a newer build reloads once and the lesson then plays', async ({ page }) => {
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Suni' });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    // From the next page on, the first request of the chunk gets what the host answers for a chunk of an older
    // build (a deploy landed): the app page itself, which the browser runs as a script and finds no module in.
    let served = 0;
    await page.route(LETTERS_BUNDLE, async (route) => {
      served += 1;
      if (served === 1) await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' });
      else await route.continue();
    });
    await page.goto('/');
    await expect(page.getByText('Hi, Suni!')).toBeVisible();
    // The background load meets the HTML first and leaves it for the lesson; opening the lesson reloads the page once.
    await expect.poll(() => served, { timeout: 15_000 }).toBe(1);
    await page.evaluate(() => {
      (window as Window & { __beforeReload?: boolean }).__beforeReload = true;
    });
    const reloaded = page.waitForEvent('load');
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: journeyCellName(2, 'Letters & Books'), exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await reloaded;
    expect(await page.evaluate(() => (window as Window & { __beforeReload?: boolean }).__beforeReload ?? false)).toBe(false);
    await expect(page.getByText('Hi, Suni!')).toBeVisible();
    await playStage2LettersDiscover(page);
    expect(served).toBe(2);
  });

  test('a chunk that cannot load shows Try again, never a reload loop, and Try again loads it once it can', async ({ page }) => {
    let blocked = true;
    await page.route(LETTERS_BUNDLE, async (route) => (blocked ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Suni' });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('Hi, Suni!')).toBeVisible();
    await page.evaluate(() => {
      (window as Window & { __noReload?: boolean }).__noReload = true;
    });
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: journeyCellName(2, 'Letters & Books'), exact: true }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    const tryAgain = page.getByRole('button', { name: 'Try again' });
    await expect(tryAgain).toBeVisible();
    expect(await page.evaluate(() => (window as Window & { __noReload?: boolean }).__noReload ?? false)).toBe(true);

    blocked = false;
    await tryAgain.click();
    await expect(page.getByText('Hi, Suni!')).toBeVisible();
    await playStage2LettersDiscover(page);
    expect(await page.evaluate(() => (window as Window & { __noReload?: boolean }).__noReload ?? false)).toBe(true);
  });
});
