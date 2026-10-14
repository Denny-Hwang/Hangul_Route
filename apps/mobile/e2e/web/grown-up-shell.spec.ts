import type { BrowserContext, Page, Route } from '@playwright/test';
import { CONSOLE_SESSION_KEY, GROWN_UP_IDLE_MS, SHELL_DB, SHELL_KEYS, SHELL_STORE, UNLOCK_SESSION_KEY } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { forgetPin, onboardChild, readStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-APP-001 A-10 (section 5, `grown-up-shell.spec.ts`; section 3.20): the grown-up shell end to end on the merged
 * app-host build, with the grown-up home flag on (the default since A-10) and no stand-in pages: the learner entries,
 * the real `/signin`, the real lock and the real family home. The grown-up is signed in through the console session
 * of the dev auth bridge (the merged build has no Clerk key in e2e, so the console reads `hr:console:session`; the
 * sign-in form stays off). Every learner boot clears that session from its tab (section 3.9), so an init script puts
 * it back on grown-up pages only, the way a Clerk session outlives a visit to the learner app.
 *
 * - Always (the release build, `build:web` with no API address): behaviours 1 and 2 (Welcome row, Teacher to the real
 *   `/signin` with the teacher intro and no sign-up), 6 and 7 (the lock on a family device, the PIN path back to the
 *   page), 8 (15 idle minutes lock again), 9 (Back to learning, then the browser's Back shows the lock and no page
 *   content), 15 (an unknown grown-up path bounces to the real console page), 19 (no PIN: Sign in again and Back to learning
 *   only), 20 (the PIN changed since the last sign-in), 22 (a PIN older than 2 minutes is asked again) and 23 (the
 *   Profile row opens the family home after the PIN). Behaviour 10 is plan-status.spec.ts and
 *   plan-screen-same-tab.spec.ts, 11 is offline.spec.ts and grown-up-entries.spec.ts, 18 is
 *   `scripts/__tests__/merge-console.test.mjs` ("a console-only change leaves sw.js byte-identical").
 *   The `shell.*` events of behaviours 2, 7 and 15 are checked where they are built and sent, in the unit tests of
 *   `logic/shell/entry-points.ts`, `logic/shell/bounce.ts` and `platform/grown-up-handoff.web.ts`.
 * - With an API address (`GROWN_UP_SHELL_E2E=1`, the API mocked by `page.route`): behaviour 23 to the end (the
 *   Profile row, the PIN, then the family home), behaviours 24 to 26 on `/parent`,
 *   the family home's first-screen budget at 375 x 667, and home, then a space, then Back in the same document (the
 *   RSC payload case moved here from app-host.spec.ts). No CI lane builds such a bundle yet (adding this file to the
 *   billing and grown-up home lane is a workflow change), so the PR that touches the family home runs it locally:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.shell-e2e.test pnpm --filter @hangul-route/mobile build:web
 *   GROWN_UP_SHELL_E2E=1 pnpm --filter @hangul-route/mobile exec playwright test grown-up-shell
 */
const WITH_API = process.env.GROWN_UP_SHELL_E2E === '1';

const en = getMessages('en');
const lock = en.console.lock;
const parentHome = en.console.parentHome;

/** The console session of the dev auth bridge, as billing.spec.ts and plan-status.spec.ts seed it. */
const SESSION = { token: 'acct-a10', accountId: 'acct-a10', displayName: 'Ms Kim' };

/**
 * Puts the console session in `sessionStorage` before any script of a grown-up page runs (`/signin`, `/parent`,
 * `/teach`, `/account`, `/start`), never on a learner page, whose boot would remove it anyway.
 */
async function signedInOnGrownUpPages(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ([key, value]) => {
      if (/^\/(signin|parent|teach|account|start)(\/|$)/.test(window.location.pathname)) window.sessionStorage.setItem(key, value);
    },
    [CONSOLE_SESSION_KEY, JSON.stringify(SESSION)] as const,
  );
}

/** The console's shell store (`hr-shell` / `kv`): what a secret-proving sign-in and a grown-up home leave behind. */
async function seedShell(page: Page, values: Partial<Record<keyof typeof SHELL_KEYS, unknown>>): Promise<void> {
  const entries = Object.entries(values).map(([k, v]) => [SHELL_KEYS[k as keyof typeof SHELL_KEYS], v] as const);
  await page.evaluate(
    ([db, store, pairs]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store);
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(store, 'readwrite');
          for (const [key, value] of pairs) tx.objectStore(store).put(value, key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [SHELL_DB, SHELL_STORE, entries] as const,
  );
}

/** A family device (a child profile behind PIN `1234`) whose last grown-up sign-in trusted this PIN's epoch. */
async function familyDevice(page: Page, opts: { trusted: 'current' | 'older' } = { trusted: 'current' }): Promise<number> {
  await onboardChild(page, { name: 'Mina' });
  const pinSetAt = await readStored<number>(page, 'account:pinSetAt');
  if (typeof pinSetAt !== 'number') throw new Error('no PIN epoch stored');
  await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'pin', pinEpoch: pinSetAt });
  await seedShell(page, { pinEpoch: opts.trusted === 'current' ? pinSetAt : pinSetAt - 60_000 });
  return pinSetAt;
}

/** Every request a page makes to an API (any host, the learner's or the console's), counted. */
function countApiCalls(page: Page): { readonly count: number } {
  const seen = { count: 0 };
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) seen.count += 1;
  });
  return seen;
}

const lockTitle = (page: Page) => page.getByRole('heading', { name: lock.title });
/** The frame's way back: Back to learning, or Open the learner app on a browser with no learner profile. */
const WAY_BACK = new RegExp(`^(${en.console.shell.backToLearning}|${en.console.shell.openLearnerApp})$`);
const backToLearning = (page: Page) => page.getByRole('link', { name: WAY_BACK }).or(page.getByRole('button', { name: WAY_BACK }));

/** The page behind the lock rendered: the frame's way back is on screen and no lock is. */
async function expectOpen(page: Page): Promise<void> {
  await expect(backToLearning(page).first()).toBeVisible();
  await expect(lockTitle(page)).toHaveCount(0);
}

function noSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

async function openProfile(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('button', { name: /^Grown-up zone/ })).toBeVisible();
}

test.describe('the grown-up shell on the release build (flag on by default, A-10)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ context }) => {
    // The learner app's own API (backup, telemetry) is never reached: telemetry stays queued, where the test reads it.
    await context.route((url) => url.hostname !== 'localhost', (route: Route) => route.abort());
  });

  test('1, 2: Welcome shows the grown-ups row under Let\'s start; Teacher opens the real sign-in with the teacher intro', async ({ page }) => {
    await page.goto('/');
    const start = page.getByRole('button', { name: "Let's start" });
    await expect(start).toBeVisible();
    await expect(page.getByText(en.learner.welcome.grownUps.lead)).toBeVisible();
    const teacher = page.getByRole('button', { name: en.learner.welcome.grownUps.teacher, exact: true });
    await expect(page.getByRole('button', { name: en.learner.welcome.grownUps.parent })).toBeVisible();
    // "Let's start" stays the largest action.
    const [startBox, teacherBox] = await Promise.all([start.boundingBox(), teacher.boundingBox()]);
    expect((startBox?.width ?? 0) * (startBox?.height ?? 0)).toBeGreaterThan((teacherBox?.width ?? 0) * (teacherBox?.height ?? 0));
    await shot(page, 'a10-welcome-375');

    await teacher.click();
    await expect(page).toHaveURL(/\/signin\?persona=teacher$/);
    await expect(page.getByRole('heading', { level: 1, name: en.console.signIn.title })).toBeVisible();
    await expect(page.getByText(en.console.signIn.persona.teacher.intro)).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up|create an account/i })).toHaveCount(0);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'a10-signin-teacher-375');
  });

  test('6, 7: a family device locks the family home with no API call; the PIN brings the page back', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    const pinSetAt = await familyDevice(page);
    const api = countApiCalls(page);

    await page.goto('/parent');
    await expect(lockTitle(page)).toBeVisible();
    await expect(page.getByText(lock.line)).toBeVisible();
    await expect(page.getByText(en.console.shell.noApi)).toHaveCount(0);
    expect(api.count).toBe(0);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'a10-lock-375');

    await page.getByRole('button', { name: lock.usePin.cta }).or(page.getByRole('link', { name: lock.usePin.cta })).click();
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/parent$/);
    await expectOpen(page);
    const unlock = JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_SESSION_KEY)) ?? 'null') as Record<string, unknown> | null;
    expect(unlock).toMatchObject({ v: 1, src: 'pin', pinEpoch: pinSetAt });
  });

  test('8: after 15 idle minutes a tap locks the page again', async ({ page, context }) => {
    await page.clock.install();
    await signedInOnGrownUpPages(context);
    await familyDevice(page);
    await page.goto('/?gate=grown-up&next=%2Fparent');
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/parent$/);
    await expectOpen(page);

    await page.clock.fastForward(GROWN_UP_IDLE_MS + 30_000);
    await page.mouse.click(5, 300);
    await expect(lockTitle(page)).toBeVisible();
    await expect(page.getByRole('button', { name: lock.usePin.cta }).or(page.getByRole('link', { name: lock.usePin.cta }))).toBeVisible();
  });

  test('9: Back to learning, then the browser Back shows the lock and none of the page', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    await familyDevice(page);
    await page.goto('/?gate=grown-up&next=%2Fparent');
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/parent$/);
    await expectOpen(page);

    await backToLearning(page).first().click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    expect(await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_SESSION_KEY)).toBeNull();

    await page.goBack();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(lockTitle(page)).toBeVisible();
    await expect(page.getByText(en.console.shell.noApi)).toHaveCount(0);
    await expect(page.getByText(parentHome.title)).toHaveCount(0);
  });

  test('15: an unknown grown-up path bounces to its persona entry, the real console page', async ({ page }) => {
    await page.goto('/teach/does-not-exist?id=sp_1');
    // The bounce lands on /teach, whose router sends a signed-out visitor on to /signin.
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole('heading', { level: 1, name: en.console.signIn.title })).toBeVisible();
    await expect(page.getByRole('button', { name: "Let's start" })).toHaveCount(0);
  });

  test('19: a family device with no PIN offers only Sign in again and Back to learning', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    await onboardChild(page, { name: 'Mina' });
    await forgetPin(page);
    await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'nopin' });

    await page.goto('/parent');
    await expect(lockTitle(page)).toBeVisible();
    await expect(page.getByText(lock.noPin)).toBeVisible();
    await expect(page.getByRole('button', { name: lock.usePin.cta })).toHaveCount(0);
    await expect(page.getByRole('link', { name: lock.usePin.cta })).toHaveCount(0);
    await expect(page.getByRole('button', { name: lock.signInAgain.cta }).or(page.getByRole('link', { name: lock.signInAgain.cta }))).toBeVisible();
    await expect(page.getByRole('button', { name: lock.backToLearning.cta }).or(page.getByRole('link', { name: lock.backToLearning.cta }))).toBeVisible();
  });

  test('20: after a PIN change on the device the lock offers only Sign in again and says the PIN changed', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    // The trusted epoch is the old PIN's, as after Forgot PIN set a new one.
    await familyDevice(page, { trusted: 'older' });
    await page.goto('/parent');
    await expect(lockTitle(page)).toBeVisible();
    await expect(page.getByText(lock.pinChanged)).toBeVisible();
    await expect(page.getByRole('button', { name: lock.usePin.cta })).toHaveCount(0);
    await expect(page.getByRole('link', { name: lock.usePin.cta })).toHaveCount(0);
  });

  test('22: a PIN entered 10 minutes ago is asked again before the dashboard card opens the grown-up area', async ({ page }) => {
    await page.clock.install();
    await familyDevice(page);
    await openProfile(page);
    await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();
    await unlockWithPin(page);
    const card = page.getByTestId('dashboard-grown-up-home');
    await expect(card).toBeVisible();

    await page.clock.fastForward(10 * 60_000);
    await card.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toHaveCount(0);
  });

  test('23: on a family device the Profile row is first in the zone and, after the PIN, leaves for the grown-up area unlocked', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    const pinSetAt = await familyDevice(page);
    await openProfile(page);
    const row = page.getByRole('button', { name: /^Grown-up home, / });
    const zone = page.getByRole('button', { name: 'Grown-up zone (PIN required)' });
    expect((await row.boundingBox())?.y ?? Infinity).toBeLessThan((await zone.boundingBox())?.y ?? 0);

    await row.click();
    await unlockWithPin(page);
    // The /signin router; with an API address it goes on to the family home (the API group below).
    await expect(page).toHaveURL(/\/signin$/);
    const unlock = JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_SESSION_KEY)) ?? 'null') as Record<string, unknown> | null;
    expect(unlock).toMatchObject({ v: 1, src: 'pin', pinEpoch: pinSetAt });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// With an API address: the family home with data (behaviours 24 to 26, the first-screen budget, Back in one document).

type Space = { id: string; kind: 'family' | 'class'; name: string; role: 'owner' | 'teacher' };

function spaceItem(s: Space, createdAt = '2026-10-01T00:00:00Z') {
  return {
    space: { id: s.id, kind: s.kind, name: s.name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt },
    role: s.role,
    counts: { learners: 2, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

function rosterLearner(id: string, name: string, joinedAt: string, minutes: number, lastActiveAt: string) {
  return { id, displayName: name, ageGroup: '5-7', avatar: 'cub', joinedAt, lastActiveAt, lastSyncedAt: lastActiveAt, summary: { minutesLast7d: minutes } };
}

interface ApiMock {
  spaces: Space[];
  learners: ReturnType<typeof rosterLearner>[];
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** Answers the console's API calls on any host but this one; anything not listed is a 404, which every page survives. */
async function mockApi(page: Page, mock: ApiMock): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.hostname !== 'localhost',
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      }
      const path = new URL(request.url()).pathname;
      if (path === '/api/spaces') return json(route, 200, { data: { spaces: mock.spaces.map((s) => spaceItem(s)) } });
      const roster = path.match(/^\/api\/spaces\/([^/]+)\/roster$/);
      if (roster) {
        const s = mock.spaces.find((x) => x.id === decodeURIComponent(roster[1] ?? ''));
        if (!s) return json(route, 404, { error: { code: 'not_found', message: 'mocked' } });
        const learners = s.kind === 'family' ? mock.learners : [];
        return json(route, 200, { data: { space: spaceItem(s).space, learners, joinCode: 'K7MPQ4', joinCodeExpiresAt: '2026-11-01T00:00:00Z' } });
      }
      if (/^\/api\/spaces\/[^/]+\/plans$/.test(path)) return json(route, 200, { data: { plans: [] } });
      return json(route, 404, { error: { code: 'not_found', message: 'mocked' } });
    },
  );
}

const FAMILY: Space = { id: 'sp_f', kind: 'family', name: 'Kim family', role: 'owner' };
const CLASS: Space = { id: 'sp_c', kind: 'class', name: 'Room 3', role: 'teacher' };
const SAM = (minutes: number, lastActiveAt: string) => rosterLearner('profile:sam', 'Sam', '2026-09-01T00:00:00Z', minutes, lastActiveAt);
const MINA = (minutes: number, lastActiveAt: string) => rosterLearner('profile:mina', 'Mina', '2026-09-05T00:00:00Z', minutes, lastActiveAt);

const cardNames = (page: Page): Promise<string[]> =>
  page.getByTestId('learner-card').evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label') ?? ''));

test.describe('the family home with data (an API address, GROWN_UP_SHELL_E2E=1)', () => {
  test.skip(!WITH_API, 'needs a build with EXPO_PUBLIC_API_BASE_URL set, run with GROWN_UP_SHELL_E2E=1');
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ context }) => {
    // A browser with no learner profile unless a case adds one: the lock stays open (section 3.9), as on a grown-up's own phone.
    await signedInOnGrownUpPages(context);
  });

  test('24: a teacher-only account on /parent sees the no-family state with Set up my family and Go to Classes', async ({ page }) => {
    await mockApi(page, { spaces: [CLASS], learners: [] });
    await page.goto('/parent');
    await expect(page.getByText(parentHome.noFamily.title)).toBeVisible();
    await expect(page.getByRole('link', { name: parentHome.noFamily.setUp }).or(page.getByRole('button', { name: parentHome.noFamily.setUp }))).toBeVisible();
    await expect(page.getByRole('link', { name: parentHome.noFamily.goTeacher }).or(page.getByRole('button', { name: parentHome.noFamily.goTeacher }))).toBeVisible();
  });

  test('25: the cards keep join order when activity changes, and the number reads "last 7 days"', async ({ page }) => {
    const mock: ApiMock = { spaces: [FAMILY], learners: [MINA(15, '2026-10-06T08:00:00Z'), SAM(42, '2026-10-12T08:00:00Z')] };
    await mockApi(page, mock);
    await page.goto('/parent');
    await expect(page.getByTestId('learner-card')).toHaveCount(2);
    expect(await cardNames(page)).toEqual(['Sam', 'Mina']);
    await expect(page.getByText(parentHome.minutes7d(42))).toBeVisible();

    mock.learners = [MINA(300, '2026-10-14T08:00:00Z'), SAM(0, '2026-09-01T00:00:00Z')];
    await page.reload();
    await expect(page.getByText(parentHome.minutes7d(300))).toBeVisible();
    expect(await cardNames(page)).toEqual(['Sam', 'Mina']);
  });

  test('26 and the first-screen budget: each card offers See report and Send a note, the nav Reports and Notes', async ({ page }) => {
    await mockApi(page, { spaces: [FAMILY], learners: [SAM(42, '2026-10-12T08:00:00Z'), MINA(15, '2026-10-06T08:00:00Z')] });
    await page.goto('/parent');
    const cards = page.getByTestId('learner-card');
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all()) {
      await expect(card.getByRole('link', { name: new RegExp(`^${parentHome.child.seeReport}`) }).or(card.getByRole('button', { name: new RegExp(`^${parentHome.child.seeReport}`) }))).toBeVisible();
      await expect(card.getByRole('link', { name: new RegExp(`^${parentHome.child.sendNote}`) }).or(card.getByRole('button', { name: new RegExp(`^${parentHome.child.sendNote}`) }))).toBeVisible();
    }
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: en.console.shell.nav.reports })).toBeVisible();
    await expect(nav.getByRole('link', { name: en.console.shell.nav.notes })).toBeVisible();
    // Section 3.8: at 375 x 667 the frame and the whole first learner card are visible without scrolling.
    await expect(backToLearning(page).first()).toBeInViewport();
    await expect(cards.first()).toBeInViewport({ ratio: 1 });
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'a10-parent-home-375');
  });

  test('23: after the PIN, the Profile row opens the family home of a family device, with no lock', async ({ page }) => {
    await mockApi(page, { spaces: [FAMILY], learners: [SAM(42, '2026-10-12T08:00:00Z')] });
    await familyDevice(page);
    await seedShell(page, { lastPersona: { v: 1, persona: 'parent' } });
    await openProfile(page);
    await page.getByRole('button', { name: /^Grown-up home, / }).click();
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/parent$/);
    await expectOpen(page);
    await expect(page.getByTestId('learner-card')).toHaveCount(1);
  });

  test('home, then a space, then Back returns in the same document (RSC payloads)', async ({ page }) => {
    await mockApi(page, { spaces: [FAMILY], learners: [SAM(42, '2026-10-12T08:00:00Z')] });
    await page.goto('/parent');
    await expect(page.getByTestId('learner-card')).toHaveCount(1);
    await page.evaluate(() => {
      (window as Window & { __a10?: boolean }).__a10 = true;
    });
    await page.getByRole('link', { name: parentHome.actions.settings }).click();
    await expect(page).toHaveURL(/\/parent\/space\/settings/);
    await page.goBack();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByTestId('learner-card')).toHaveCount(1);
    expect(await page.evaluate(() => (window as Window & { __a10?: boolean }).__a10 === true)).toBe(true);
  });
});
