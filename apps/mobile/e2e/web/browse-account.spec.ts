import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * F-BROWSE-001 BR-10 (sections 4.1, 4.3, 4.11; wireframe browse/entry-points.md): the account hand-off from the
 * adult frame on the merged build (F-APP-001 A-3). **Lessons** opens All lessons in the same tab with the pass the
 * console wrote; [ Close ] comes back; a failed plan check shows Try again and Open free lessons; a modifier click
 * opens a tab with no pass, which shows only the Access screen and drops the unlock and the console session at
 * boot (`canGoBack()` false, BR-6); no URL or title holds anything but content ids.
 *
 * The console needs a signed-in account (the Lessons switch is on by default since BR-14), so this runs on a test build: the dev sign-in
 * bridge (never on the release merge, merge-console.mjs) and route mocks for the API. Recipe, from the repo root:
 *
 *   SKIP_CONSOLE=1 pnpm --filter @hangul-route/mobile build:web
 *   NEXT_PUBLIC_CONSOLE_DEV_AUTH=true NEXT_PUBLIC_APP_URL=http://localhost:4173 \
 *     NEXT_PUBLIC_API_BASE_URL=https://api.e2e.invalid pnpm --filter @hangul-route/web build:console
 *   cp -R apps/web/out-console/. apps/mobile/dist/
 *   E2E_BROWSE_ACCOUNT=1 pnpm --filter @hangul-route/mobile exec playwright test browse-account
 *
 * (`NEXT_PUBLIC_APP_URL` is the origin the test serves; the Lessons item renders only there.) The item page case
 * opens the BR-7 item page (#495) of the learner build.
 */
test.use({ serviceWorkers: 'block' });

const ON = process.env.E2E_BROWSE_ACCOUNT === '1';
const API = 'https://api.e2e.invalid';
const PASS_KEY = 'hr:browse:pass';
const UNLOCK_KEY = 'hr:grownup:unlock';
const CONSOLE_KEY = 'hr:console:session';
/** Person data the mocks hand the console: none of it may reach a URL or a title. */
const ACCOUNT_ID = 'acc_e2eparent';
const DISPLAY_NAME = 'Parent Kim';
const SPACE_ID = 'sp_e2efamily';
const LEARNER_ID = 'lrn_e2emina';
const LEARNER_NAME = 'Mina';
const PERSON_DATA = [ACCOUNT_ID, DISPLAY_NAME, SPACE_ID, LEARNER_ID, LEARNER_NAME, encodeURIComponent(DISPLAY_NAME)];

const SPACE = { id: SPACE_ID, kind: 'family', name: 'Kim family', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00.000Z' };

type ScopeAnswer = 'full' | 'sampler' | 'fail';

interface Mocks {
  scope: ScopeAnswer;
  scopeReads: number;
  /** The URLs of the hand-off: the plan check, the navigation to `/browse` and every request All lessons makes. */
  urls: string[];
}

/** A request of the hand-off (the console's own space reads are the console's business, not a link's). */
function partOfHandOff(url: string, frameUrl: string): boolean {
  const path = (value: string): string => {
    try {
      return new URL(value).pathname;
    } catch {
      return '';
    }
  };
  return path(url) === '/api/entitlements/browse' || path(url).startsWith('/browse') || path(frameUrl).startsWith('/browse');
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
}

/** Answers the console's API calls and records the hand-off's request URLs. */
async function mockApi(context: BrowserContext, scope: ScopeAnswer): Promise<Mocks> {
  const mocks: Mocks = { scope, scopeReads: 0, urls: [] };
  context.on('request', (request) => {
    let frameUrl = '';
    try {
      frameUrl = request.frame().url();
    } catch {
      // A service-worker request has no frame; this suite blocks service workers.
    }
    if (partOfHandOff(request.url(), frameUrl)) mocks.urls.push(request.url());
  });
  await context.route(`${API}/**`, (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(request.url()).pathname;
    if (path === '/api/entitlements/browse') {
      mocks.scopeReads += 1;
      return mocks.scope === 'fail' ? json(route, 503, { error: { code: 'unavailable' } }) : json(route, 200, { data: { scope: mocks.scope } });
    }
    if (path === '/api/spaces') {
      return json(route, 200, { data: { spaces: [{ space: SPACE, role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: null, joinCodeExpiresAt: null }] } });
    }
    if (path === `/api/spaces/${SPACE_ID}/roster`) {
      return json(route, 200, { data: { space: SPACE, learners: [{ id: LEARNER_ID, displayName: LEARNER_NAME, summary: null }], joinCode: null, joinCodeExpiresAt: null } });
    }
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return mocks;
}

/** Signs the tab in through the dev bridge (the session the dev sign-in form writes), then opens the family home. */
async function signedInFamilyHome(page: Page): Promise<void> {
  await page.goto('/signin');
  await page.evaluate(
    ([key, session]) => {
      sessionStorage.setItem(key, session);
    },
    [CONSOLE_KEY, JSON.stringify({ token: ACCOUNT_ID, accountId: ACCOUNT_ID, displayName: DISPLAY_NAME })] as const,
  );
  await page.goto('/parent');
  await expect(page.getByTestId('adult-frame')).toBeVisible();
  await expect(page.getByTestId('nav-lessons')).toBeVisible();
}

const allLessons = (page: Page) => page.getByRole('heading', { name: 'All lessons' });
const accessTitle = (page: Page) => page.getByRole('heading', { name: 'This page is for parents and teachers.' });

function storedPass(page: Page): Promise<unknown> {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? 'null'), PASS_KEY);
}

function expectContentIdsOnly(values: readonly string[]): void {
  for (const value of values) {
    for (const person of PERSON_DATA) expect(value, `${value} holds ${person}`).not.toContain(person);
  }
}

test.describe('the account hand-off (BR-10)', () => {
  test.skip(!ON, 'needs the dev sign-in test build (see the recipe above) and E2E_BROWSE_ACCOUNT=1');

  test('Lessons opens All lessons in the same tab with a full pass, and Close comes back to the console page', async ({ page, context }) => {
    const mocks = await mockApi(context, 'full');
    await signedInFamilyHome(page);
    await shot(page, 'br10-frame-lessons-pixel5');

    await page.getByTestId('nav-lessons').click();
    await expect(allLessons(page)).toBeVisible();
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page).toHaveTitle('Hangul Route lessons');
    expect(context.pages()).toHaveLength(1);
    const pass = (await storedPass(page)) as Record<string, unknown>;
    expect(pass).toMatchObject({ v: 1, scope: 'full', source: 'account', uiLocale: 'en' });
    expect(Object.keys(pass).sort()).toEqual(['issuedAt', 'scope', 'seen', 'source', 'uiLocale', 'v']);
    expect(mocks.scopeReads).toBe(1);
    // A tab that can go back keeps its console session and unlock (BD1).
    expect(await page.evaluate((key) => sessionStorage.getItem(key), CONSOLE_KEY)).not.toBeNull();
    await shot(page, 'br10-browse-home-from-lessons-pixel5');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByTestId('nav-lessons')).toBeVisible();

    expect(mocks.urls.some((url) => url.endsWith('/api/entitlements/browse'))).toBe(true);
    expect(mocks.urls.some((url) => new URL(url).pathname === '/browse')).toBe(true);
    expectContentIdsOnly([...mocks.urls, page.url(), await page.title()]);
  });

  test('a report-style link opens the item page of its lesson', async ({ page, context }) => {
    const mocks = await mockApi(context, 'full');
    await signedInFamilyHome(page);
    await page.getByTestId('nav-lessons').click();
    await expect(allLessons(page)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/parent$/);

    // The report's action slot links the same way (BR-11): a content id and a source code only.
    await page.evaluate(() => window.location.assign('/browse#t=quest:stage1-letters-q2&s=report'));
    await expect(page.getByTestId('browse-item')).toBeVisible();
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page).toHaveTitle('Hangul Route lessons');
    await shot(page, 'br10-browse-item-from-report-pixel5');
    expectContentIdsOnly([...mocks.urls, page.url(), await page.title()]);
  });

  test('a failed plan check: Try again and Open free lessons, no navigation; Open free lessons opens with a fallback pass', async ({ page, context }) => {
    const mocks = await mockApi(context, 'fail');
    await signedInFamilyHome(page);

    await page.getByTestId('nav-lessons').click();
    await expect(page.getByText('Could not check your plan.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open free lessons' })).toBeVisible();
    await expect(page).toHaveURL(/\/parent$/);
    expect(await storedPass(page)).toBeNull();
    await shot(page, 'br10-frame-check-failed-pixel5');

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => mocks.scopeReads).toBe(2);
    await expect(page).toHaveURL(/\/parent$/);

    await page.getByRole('button', { name: 'Open free lessons' }).click();
    await expect(allLessons(page)).toBeVisible();
    expect(await storedPass(page)).toMatchObject({ scope: 'sampler', source: 'account', fallback: true });
    expectContentIdsOnly([...mocks.urls, page.url(), await page.title()]);
  });

  test('a modifier click opens a tab without a pass: only the Access screen, and the unlock and console session are gone there', async ({ page, context }) => {
    const mocks = await mockApi(context, 'full');
    await signedInFamilyHome(page);
    await page.evaluate((key) => sessionStorage.setItem(key, JSON.stringify({ v: 1, at: Date.now(), seen: Date.now(), src: 'signin' })), UNLOCK_KEY);

    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByTestId('nav-lessons').click({ modifiers: ['ControlOrMeta'] })]);
    await expect(accessTitle(tab)).toBeVisible();
    await expect(allLessons(tab)).toHaveCount(0);
    await expect(tab).toHaveURL(/\/browse$/);
    await expect(tab).toHaveTitle('Hangul Route lessons');
    expect(await tab.evaluate(() => history.length)).toBe(1);
    expect(await storedPass(tab)).toBeNull();
    expect(await tab.evaluate(([u, c]) => [sessionStorage.getItem(u), sessionStorage.getItem(c)], [UNLOCK_KEY, CONSOLE_KEY] as const)).toEqual([null, null]);
    await shot(tab, 'br10-new-tab-access-pixel5');

    // The console tab did not move, read no scope and keeps its own session.
    await expect(page).toHaveURL(/\/parent$/);
    expect(mocks.scopeReads).toBe(0);
    expect(await storedPass(page)).toBeNull();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), CONSOLE_KEY)).not.toBeNull();
    expectContentIdsOnly([...mocks.urls, page.url(), tab.url(), await tab.title()]);
  });
});
