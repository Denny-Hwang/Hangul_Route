import type { Page } from '@playwright/test';
import { GROWN_UP_PREFIXES, isGrownUpPath } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';

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
