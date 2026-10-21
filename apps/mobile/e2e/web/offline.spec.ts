import type { Page } from '@playwright/test';
import { GROWN_UP_PREFIXES, isGrownUpPath } from '@hangul-route/content-schema';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { STORY_SHELF } from '../../src/content/__generated__/stories-index';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, seedStored } from './helpers';
import { position } from './story-reader-helpers';

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

/**
 * F-CURR-002 §10 (row CM-5): the lesson bodies left the start bundle. Every cell's chunk and both title chunks
 * are precached after one online visit; none loads at start; offline, an upper-stage lesson opens and its
 * Discover step plays from its own chunk, loaded on demand from the precache.
 */
test('lesson chunks are precached, load on demand, and an upper-stage lesson plays offline (F-CURR-002 CM-5)', async ({ page, context }) => {
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

  // The worker serves the shell; with the network gone, the learner home opens and no lesson chunk has loaded.
  await page.reload();
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Hi, Suni!')).toBeVisible();
  expect(await loadedLessonChunks(page)).toEqual([]);

  // Journey > Stage 2 Letters & Books: the cell page reads the manifest; Start loads that cell's chunk only.
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(2, 'Letters & Books'), exact: true }).click();
  await expect(page.getByText('Word Builder').first()).toBeVisible();
  expect(await loadedLessonChunks(page)).toEqual([]);
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Discover of the first Word Builder quest: the vowel ㅐ and its example 개, from the chunk.
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
  await expect(page.getByText('ㅐ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('개', { exact: true }).first()).toBeVisible();
  const loaded = await loadedLessonChunks(page);
  expect(loaded).toHaveLength(1);
  expect(loaded[0]).toMatch(/^\/_expo\/static\/js\/web\/lessons-cell-stage2-letters-[0-9a-f]{32}\.js$/);
  expect(errors).toEqual([]);
});

test.describe('in Spanish (F-CURR-002 CM-5: the title chunk of the active locale only)', () => {
  test.use({ locale: 'es-ES' });

  test('the Spanish lesson titles load from their own chunk, offline too, and the Korean ones never load', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    await controlledBySw(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect.poll(() => loadedLessonChunks(page)).toEqual([expect.stringMatching(/^\/_expo\/static\/js\/web\/lessons-titles-es-[0-9a-f]{32}\.js$/)]);
    expect(errors).toEqual([]);
  });
});

/** The story chunk bundles this page has loaded (F-CURR-002 §10, row CM-8): resource entries of the current document only. */
async function loadedStoryChunks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => /\/_expo\/static\/js\/web\/story-/.test(p)),
  );
}

const STORY_BUNDLE = /^\/_expo\/static\/js\/web\/story-[a-z0-9-]+-[0-9a-f]{32}\.js$/;
const TALE = 'story:sun-and-moon';
const TALE_BUNDLE = /^\/_expo\/static\/js\/web\/story-sun-and-moon-[0-9a-f]{32}\.js$/;
/** The shelf (start bundle) knows the tale's levels and scene counts before its chunk loads. */
const TALE_SCENES = STORY_SHELF.find((e) => e.id === TALE)?.levels.find((t) => t.level === 'listen')?.scenes ?? 0;
/** A shelf story's tiles cover the stories on the screen: Home's story cards load their chunks, never all of them. */
const HOME_STORY_CARDS_MAX = 2;

/** One online visit, then the network goes: the learner home opens from the precache. */
async function onboardThenOffline(page: Page, context: import('@playwright/test').BrowserContext, name: string): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await controlledBySw(page);
  const cached = await cachedPaths(page);
  expect(cached.filter((p) => STORY_BUNDLE.test(p))).toHaveLength(STORY_SHELF.length);
  await page.reload();
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
}

async function closeInstallGuide(page: Page, notNow: string): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: notNow }).click();
}

/**
 * F-CURR-002 §10 (row CM-8): the story bodies left the start bundle. Every story's chunk is precached after
 * one online visit; at start only the stories Home shows load (their covers); offline, a story opens from
 * the Library shelf and its reader plays from its own chunk, loaded on demand from the precache.
 */
test('story chunks are precached, load on demand, and a story opens and reads offline (F-CURR-002 CM-8)', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  expect(TALE_SCENES).toBeGreaterThan(0);

  await onboardThenOffline(page, context, 'Suni');
  const atStart = await loadedStoryChunks(page);
  expect(atStart.length).toBeLessThanOrEqual(HOME_STORY_CARDS_MAX);
  for (const url of atStart) expect(url).toMatch(STORY_BUNDLE);

  // Library > Story Time: the tiles come from the shelf; the tale's page and its quest load its chunk only.
  await closeInstallGuide(page, 'Not now');
  await page.getByText('Library', { exact: true }).last().click();
  await page.getByRole('tab', { name: 'Story Time', exact: true }).click();
  await page.getByTestId(`story-tile-${TALE}`).filter({ visible: true }).click();
  await page.getByTestId(`story-episode-start-${TALE}`).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Read the story' })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  // The reader's first scene, from the chunk: its narration and the scene count the shelf named.
  await expect(position(page)).toHaveText(`1 / ${TALE_SCENES}`);
  await expect(page.getByText(/Story time with Hoya!/).first()).toBeVisible();
  const loaded = await loadedStoryChunks(page);
  expect(loaded.filter((p) => TALE_BUNDLE.test(p))).toHaveLength(1);
  expect(loaded.length).toBeLessThan(STORY_SHELF.length);
  expect(errors).toEqual([]);
});

test('in Spanish, offline: the story overlays apply to a story read from its chunk (F-CURR-002 CM-8)', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // English onboarding online, then the device language set to Spanish (as the Display sheet stores it) before the network goes.
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Suni' });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await controlledBySw(page);
  await seedStored(page, 'device:settings', { uiLocale: 'es', uiLocaleAt: new Date().toISOString() });
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByText('¡Hola, Suni!')).toBeVisible();
  await closeInstallGuide(page, 'Ahora no');
  await page.getByText('Colección', { exact: true }).last().click();
  await page.getByRole('tab', { name: 'Cuentos', exact: true }).click();
  const tile = page.getByTestId(`story-tile-${TALE}`).filter({ visible: true });
  // The title overlay is in the start bundle; the shelf draws it before any chunk.
  await expect(tile).toContainText('El sol y la luna (cuento tradicional)');
  await tile.click();
  await page.getByTestId(`story-episode-start-${TALE}`).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Jugar minijuego' }).click();
  // The narration overlay applies to the scenes of the chunk.
  await expect(position(page)).toHaveText(`1 / ${TALE_SCENES}`);
  await expect(page.getByText(/¡Hora del cuento con Hoya!/).first()).toBeVisible();
  expect((await loadedStoryChunks(page)).filter((p) => TALE_BUNDLE.test(p))).toHaveLength(1);
  expect(errors).toEqual([]);
});
