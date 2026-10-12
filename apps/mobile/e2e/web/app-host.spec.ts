import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Page } from '@playwright/test';
import { isGrownUpPath } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm } from './helpers';

/**
 * F-APP-001 A-3 (sections 3.1, 3.3 and 3.17): one host, two bundles, one Worker. `build:web` merges the
 * console role of apps/web into dist under the grown-up prefixes and `_next/`
 * (scripts/app-host/merge-console.mjs), and scripts/serve-dist.mjs answers like the Worker
 * (auto-trailing-slash, single-page fallback, dist/_headers). The first cases of section 5; A-6 adds the
 * bounce of an unknown grown-up path (`/teach/zzz` to `/teach`).
 */
const dist = join(__dirname, '..', '..', 'dist');

/**
 * Console pages every merged build has today. TODO(F-APP-001 A-4b): add '/signin' and '/start'.
 * TODO(F-APP-001 A-5c): add '/account/billing'. Section 5 requires them; the walk below would also pick
 * them up, but only a name here fails the build when a page never reaches dist.
 */
const REQUIRED_PAGES = ['/teach', '/teach/home', '/parent'];

/** Section 3.17, as the Worker sends it for every grown-up path. */
const GROWN_UP_HEADERS: Record<string, string> = {
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-robots-tag': 'noindex, nofollow',
};

/** pwa-postbuild.mjs writes this into the learner shell (index.html) only. */
const LEARNER_SHELL_MARK = '__hrApplyUpdate';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [relative(dist, full).split('\\').join('/')];
  });
}

/** Every console page in dist, at the URL the Worker serves it (`teach/home.html` is `/teach/home`). */
function consolePages(): string[] {
  return walk(dist)
    .filter((rel) => rel.endsWith('.html') && isGrownUpPath(`/${rel}`))
    .map((rel) => `/${rel.slice(0, -'.html'.length)}`)
    .sort();
}

/** The learner worker is active and controls the page (a device that has opened the learner app once). */
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

/** Every URL the learner worker keeps (precache and runtime caches), as paths. */
async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
    }
    return out;
  });
}

/** A console file the learner worker must never keep: a grown-up page or payload (R-1), or a Next chunk. */
const isConsoleFile = (path: string): boolean => isGrownUpPath(path) || path.startsWith('/_next/');

type SavedData = { idb: Record<string, unknown>; local: Record<string, string | null> };

/** Everything the learner app keeps in this origin: the IndexedDB key-value store (platform/storage) and localStorage. */
function readSaved(page: Page): Promise<SavedData> {
  return page.evaluate(
    () =>
      new Promise<SavedData>((resolve, reject) => {
        const local: Record<string, string | null> = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key !== null) local[key] = localStorage.getItem(key);
        }
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve({ idb: {}, local });
            return;
          }
          const idb: Record<string, unknown> = {};
          const cursor = db.transaction('keyval').objectStore('keyval').openCursor();
          cursor.onerror = () => reject(cursor.error);
          cursor.onsuccess = () => {
            const at = cursor.result;
            if (at) {
              idb[String(at.key)] = at.value;
              at.continue();
              return;
            }
            db.close();
            resolve({ idb, local });
          };
        };
      }),
  );
}

/** Reads until two reads a moment apart agree, so a write the previous page started has landed. */
async function settledSaved(page: Page): Promise<SavedData> {
  let last = await readSaved(page);
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(250);
    const next = await readSaved(page);
    if (JSON.stringify(next) === JSON.stringify(last)) return next;
    last = next;
  }
  return last;
}

test.describe('app host: the learner app and the grown-up console (F-APP-001 A-3)', () => {
  test.skip(process.env.STORY_FIXTURES === '1', 'the story fixture build (dist-e2e) is learner-only');

  test('dist holds the merged console', () => {
    expect(existsSync(join(dist, '_next', 'static')), 'no _next/ in dist: was build:web run with SKIP_CONSOLE=1?').toBe(true);
    const pages = consolePages();
    for (const path of REQUIRED_PAGES) expect(pages, path).toContain(path);
  });

  test('/ is the learner app; every console page is the console with the grown-up headers', async ({ request }) => {
    const learner = await request.get('/');
    expect(learner.status()).toBe(200);
    expect(learner.headers()['content-type']).toContain('text/html');
    expect(await learner.text()).toContain(LEARNER_SHELL_MARK);
    expect(learner.headers()['x-frame-options']).toBeUndefined();
    expect(learner.headers()['cache-control']).not.toBe('no-store');

    const pages = consolePages();
    expect(pages.length).toBeGreaterThanOrEqual(REQUIRED_PAGES.length);
    for (const path of pages) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toContain('text/html');
      const html = await res.text();
      expect(html, path).toContain('/_next/static/');
      expect(html, path).not.toContain(LEARNER_SHELL_MARK);
      for (const [name, value] of Object.entries(GROWN_UP_HEADERS)) expect(res.headers()[name], `${path} ${name}`).toBe(value);

      // The page's React Server Component payload, which client navigation between console pages reads.
      const payload = await request.get(`${path}.txt`);
      expect(payload.status(), `${path}.txt`).toBe(200);
      expect(payload.headers()['content-type'], `${path}.txt`).toContain('text/plain');
      for (const [name, value] of Object.entries(GROWN_UP_HEADERS)) expect(payload.headers()[name], `${path}.txt ${name}`).toBe(value);
    }
  });

  test('the learner precache holds no console file', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text();
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
    expect(urls).toContain('index.html');
    expect(urls).toContain('grown-ups-offline.html');
    expect(urls.filter((url) => isGrownUpPath(`/${url}`) || url.startsWith('_next/'))).toEqual([]);
  });

  test('a missing console chunk is never kept as a year-long HTML answer', async ({ request }) => {
    const chunk = walk(join(dist, '_next', 'static', 'chunks')).find((rel) => /\/main-app-[^/]+\.js$/.test(rel));
    expect(chunk, 'a Next chunk in dist').toBeDefined();
    const real = await request.get(`/${chunk}`);
    expect(real.status()).toBe(200);
    expect(real.headers()['content-type']).toContain('javascript');

    for (const url of ['/_next/static/chunks/hr-e2e-missing-0000.js', '/_next/static/css/hr-e2e-missing.css', '/_next/hr-e2e-missing']) {
      const miss = await request.get(url);
      const type = miss.headers()['content-type'] ?? '';
      const cache = miss.headers()['cache-control'] ?? '';
      expect(type.startsWith('text/html') && /\bimmutable\b|max-age=31536000/.test(cache), `${url}: ${type} / ${cache}`).toBe(false);
    }
  });

  test("visiting the grown-up pages leaves the learner's saved data as it was", async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Suni' });
    // The console pages below are visited the way a learner device meets them: under the learner worker.
    await controlledBySw(page);

    // Read on a page with no app code (the precached offline page), before and after the console visits.
    await page.goto('/grown-ups-offline.html');
    const before = await settledSaved(page);
    expect(Object.keys(before.idb)).toEqual(expect.arrayContaining(['hr:profiles', 'hr:account:parentPinHash']));

    const pages = consolePages();
    for (const path of REQUIRED_PAGES) expect(pages, path).toContain(path);
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // The console booted from its own chunks, not the learner shell.
      await expect(page.locator('script[src^="/_next/static/"]').first(), path).toBeAttached();
      expect(await page.evaluate((mark) => mark in window, LEARNER_SHELL_MARK), path).toBe(false);
    }

    await page.goto('/grown-ups-offline.html');
    expect(await readSaved(page)).toEqual(before);

    await page.goto('/');
    await expect(page.getByText('Hi, Suni!')).toBeVisible();
    // The worker went to the network for every console file and kept none of them.
    const cached = await cachedPaths(page);
    expect(cached).toContain('/index.html');
    expect(cached.filter(isConsoleFile)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a console page moves to another over its RSC payload, and Back returns (same document)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const payloads: Array<{ path: string; status: number; type: string }> = [];
    page.on('response', (r) => {
      const path = new URL(r.url()).pathname;
      if (path.endsWith('.txt')) payloads.push({ path, status: r.status(), type: r.headers()['content-type'] ?? '' });
    });

    // Under the learner worker, as on a device that has opened the learner app once.
    await page.goto('/');
    await controlledBySw(page);

    // The family page links to each learner's page (the demo until A-5b, whose real home links to a space).
    await page.goto('/parent');
    const link = page.locator('main a[href^="/parent/"]').first();
    await expect(link).toBeVisible();
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/parent\/[a-z0-9-]+$/);
    await page.evaluate(() => {
      (window as Window & { __hrSameDocument?: boolean }).__hrSameDocument = true;
    });
    const sameDocument = (): Promise<boolean> => page.evaluate(() => (window as Window & { __hrSameDocument?: boolean }).__hrSameDocument === true);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => payloads.some((p) => p.path === `${href}.txt` && p.status === 200 && p.type.startsWith('text/plain'))).toBe(true);
    expect(await sameDocument(), 'the move was a client navigation').toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(link).toBeVisible();
    expect(await sameDocument(), 'Back stayed in the same document').toBe(true);
    // The payloads and chunks went to the network: the learner worker keeps no console file.
    expect((await cachedPaths(page)).filter((path) => isConsoleFile(path) || path.endsWith('.txt'))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
