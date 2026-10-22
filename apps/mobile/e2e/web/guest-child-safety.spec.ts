import { getMessages } from '@hangul-route/i18n';
import type { Browser, BrowserContext, Page, Request } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, openForGrownUps, passDiscover, playCheckByIds, readStored, seedStored, typeDigits, WHO_CHILD, WHO_SELF } from './helpers';
import { shot } from './shots';

/**
 * [GU] The guest child-safety suite and G1 on the release build with the production flag values
 * (AMENDMENTS-GUEST-FIRST-LESSON sections 1, 10 and 19, row GU-7): `EXPO_PUBLIC_WHO_CHOOSER` on (OA-10), the guest
 * switch `EXPO_PUBLIC_GUEST_LESSON` on in the web build and the site's `guestLesson` claim on (both since GU-7). It runs
 * on the release build (`build:web`) in every pull request's shards, at 320 px and on a wide window; a bundle built
 * with the guest kill switch off skips it with `E2E_GUEST=0`. The checks that need a sync API (telemetry bodies, the
 * registration after the save) run on a build with a mocked one, with `E2E_GUEST_API=1`:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid pnpm --filter @hangul-route/mobile build:web
 *   E2E_GUEST_API=1 pnpm --filter @hangul-route/mobile exec playwright test guest-child-safety guest-save
 *
 * Each test is named by the invariant it checks. Where the invariants are checked:
 *
 * | Invariant | Here (320 px and wide) | Also |
 * |---|---|---|
 * | G1 | 2 taps on an empty device; 3 taps on a device with profiles and the chooser (the site's tap, then every click the page itself received, counted in the page) | `guest-first-quest.spec.ts`, `who-guest.spec.ts` |
 * | CS-G1 | a whole run to Results, Not now and Close: only the 7.1 routes, no grown-up control, one tab on `/` | `guest-first-quest.spec.ts` (the route self-check), `guest-stack.test.ts` (the static walk), `guest-nav-guard.test.ts` |
 * | CS-G2 | the `SaveGuest` PIN opens the form only: no grown-up session marks, and in the same document (the fresh-PIN credit lives in memory only, so no reload) Account pages still asks the PIN after the save | `guest-save.spec.ts`, `guest-save-screens.test.tsx`, `pin-flow.test.ts` |
 * | CS-G3 | the tab's grown-up session marks are closed, and the other tabs told (`hr-grownup` lock), by the site start and by the chooser's tile; a plain boot (which also drops the marks) tells nobody, the control. The in-memory credit's close is unit-checked | `guest-first-quest.spec.ts` (Back to my quest), `guest-run-grownup.web.test.ts` |
 * | CS-G4 | the try intent selects and creates nobody, keeps the chooser, and loses to `gate=grown-up` and to a join link | `who-guest.spec.ts`, `boot-intent.test.ts`, `guest-launch.test.ts` |
 * | CS-G5 | the guest's tile carries its label only | `who-guest.spec.ts`, `WhoGuestTiles.test.tsx` |
 * | CS-G6 | a live guest on an empty device writes the gate marker `nopin`, never `none` | `device-gate.test.ts`, `guest-gates.test.ts` |
 * | CS-G7 | no request to `/api/sync` or `/api/spaces`, no backup of the guest; on the API build, guest events are sent and none names a profile | `guest-first-quest.spec.ts`, `telemetry-guest.test.ts`, `guest-sync.test.ts` |
 *
 * In CI the PWA shards run the release build, which has no API base: there a guest run sends nothing at all, so the
 * telemetry half of CS-G7 (and `guest-save.spec.ts`'s registration checks) is checked by `telemetry-guest.test.ts` and
 * by a local run of the API build above, not by a CI e2e job (adding one is a workflow change, the owner's).
 * | CS-G8 | the save's who question starts unanswered, the agreement unticked, the under-13 latch, the PIN for someone looked after, the email folded and cleared | `guest-save-form.test.ts`, `guest-save-screens.test.tsx` |
 * | CS-G9 | `verify`: Cancel on the PIN saves nothing; `owner`: no save from the guest path | `guest-save.spec.ts`, `guest-model.test.ts` |
 * | CS-G10 | `owner`: no PIN pad and the PIN stays unset; `verify`: no PIN row and the hash unchanged | `guest-save.spec.ts`, `who-guest.spec.ts`, `PinEntryGuestOnly.test.tsx` |
 */
test.skip(process.env.E2E_GUEST === '0', 'a build with the kill switch EXPO_PUBLIC_GUEST_LESSON=false (E2E_GUEST=0)');

const WITH_API = process.env.E2E_GUEST_API === '1';
const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };

const en = getMessages('en');
const w = en.learner.who;
const g = en.learner.guest;
const c = en.learner.createProfile;
const PIN_LINE = 'Enter your 4-digit PIN to continue.';
/** Section 7.1: every route a guest run can reach, and the stack itself. */
const GUEST_ROUTES = ['Guest', 'QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater', 'CreateProfile', 'PinEntry'];

const hello = (page: Page) => page.getByText('Hi from Hoya', { exact: true });
const letterA = (page: Page) => page.getByTestId('discover-item-jamo:a').getByText('ㅏ', { exact: true }).first();
const continueButton = (page: Page) => page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true });
const whoTitle = (page: Page) => page.getByRole('heading', { name: w.title, exact: true });
const tryTile = (page: Page) => page.getByRole('button', { name: en.a11y.who.try, exact: true });
const guestTile = (page: Page) => page.getByRole('button', { name: en.a11y.who.guest, exact: true });
const keep = (page: Page) => page.getByRole('button', { name: g.results.keep, exact: true });
const notNow = (page: Page) => page.getByRole('button', { name: g.results.notNow, exact: true });
const cont = (page: Page) => page.getByRole('button', { name: c.cta, exact: true });

/**
 * The taps of G1 (section 1: a tap is a press on a control), counted in the page from its first script: every trusted
 * click the document receives. The site's Start learning is the one tap before the learner app's document exists.
 */
async function countTaps(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const box = window as Window & { __taps?: number };
    box.__taps = 0;
    window.addEventListener('click', (event) => {
      if (event.isTrusted) box.__taps = (box.__taps ?? 0) + 1;
    }, true);
  });
  return () => page.evaluate(() => (window as Window & { __taps?: number }).__taps ?? 0);
}
const SITE_TAP = 1;

/** Every request the page makes, and every route name the app shows (React Navigation writes it to the title). */
async function watch(page: Page): Promise<{ requests: Request[]; routes: () => Promise<string[]> }> {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as Window & { __routes?: string[] }).__routes = seen;
    const note = (): void => {
      if (seen[seen.length - 1] !== document.title) seen.push(document.title);
    };
    new MutationObserver(note).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return { requests, routes: () => page.evaluate(() => (window as Window & { __routes?: string[] }).__routes ?? []) };
}

/** The routes from the run's start up to `end` that are not routes of section 7.1. */
function forbiddenDuringRun(routes: readonly string[], end: number = routes.length): string[] {
  const start = routes.findIndex((r) => r === 'Guest' || r === 'QuestPlayer' || r === 'GuestLater');
  if (start === -1) return ['(the run never started)'];
  return routes.slice(start, end).filter((r) => r !== '' && !GUEST_ROUTES.includes(r));
}

/** The mocked sync API of the API build (`E2E_GUEST_API=1`); on the release build nothing is sent to it. */
async function mockApi(context: BrowserContext): Promise<void> {
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    if (path === '/api/telemetry') return reply(202, { data: { ok: true } });
    if (req.method() === 'POST' && path === '/api/sync/learners') {
      const learner = ((JSON.parse(req.postData() ?? '{}') as { learner?: { id?: string } }).learner ?? {}) as { id?: string };
      return reply(201, { data: { learner: { id: learner.id }, device: { secret: 'secret-e2e' } } });
    }
    if (path.endsWith('/snapshot')) return reply(200, { data: { rev: 1 } });
    if (path.endsWith('/inbox')) return reply(200, { data: { rev: 1, plans: [], memberships: [], tier: 'free', serverTime: new Date().toISOString(), deviceScope: 'full' } });
    return reply(404, { error: { code: 'not_found' } });
  });
}

/** CS-G7 over the requests of a guest run: no sync or spaces call, and no telemetry event names a profile. */
function expectAnonymousRun(requests: readonly Request[]): void {
  const api = requests.filter((r) => /\/api\//.test(new URL(r.url()).pathname));
  expect(api.filter((r) => /\/api\/(sync|spaces)(\/|\?|$)/.test(new URL(r.url()).pathname)).map((r) => r.url())).toEqual([]);
  if (!WITH_API) {
    // The release build has no API base: a guest run sends nothing at all.
    expect(api.map((r) => r.url())).toEqual([]);
    return;
  }
  const events = api.filter((r) => new URL(r.url()).pathname === '/api/telemetry' && r.method() === 'POST');
  // The run's own events were sent, so the check below reads real bodies (zero events would pass it vacuously).
  const names = events.map((request) => String((JSON.parse(request.postData() ?? '{}') as { name?: unknown }).name));
  expect(names.filter((name) => name.startsWith('guest.')), names.join(', ')).not.toEqual([]);
  for (const request of events) {
    const body = JSON.parse(request.postData() ?? '{}') as { name?: string; profileId?: unknown };
    expect(body.profileId ?? null, String(body.name)).toBeNull();
  }
}

/**
 * A second tab of the same browser, listening on `hr-grownup` for the lock message a closed grown-up session posts
 * (OA-D5). Returns what it heard so far.
 */
async function lockListener(context: BrowserContext): Promise<() => Promise<unknown[]>> {
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => {
    const heard: unknown[] = [];
    (window as Window & { __heard?: unknown[] }).__heard = heard;
    new BroadcastChannel('hr-grownup').onmessage = (event) => heard.push(event.data);
  });
  return () => other.evaluate(() => (window as Window & { __heard?: unknown[] }).__heard ?? []);
}

/** The grown-up session of this tab (the unlock and the console session marks). */
const grownUpSession = (page: Page): Promise<(string | null)[]> => page.evaluate(() => [sessionStorage.getItem('hr:grownup:unlock'), sessionStorage.getItem('hr:console:session')]);
const openSession = (page: Page): Promise<void> =>
  page.evaluate(() => {
    sessionStorage.setItem('hr:grownup:unlock', '{"v":1}');
    sessionStorage.setItem('hr:console:session', '{"v":1}');
  });

const child = (id: string, displayName: string, avatar = 'hoya-orange') => ({ id, displayName, ageGroup: '8-9', avatar, role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' });

/** A family device with two learners (Mina and Jun) and no PIN, stored before the app reads them: the chooser. */
async function twoProfiles(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
  await seedStored(page, 'profiles', [child('profile:mina0001', 'Mina'), child('profile:jun00001', 'Jun', 'hoya-blue')]);
  await seedStored(page, 'profiles:active', 'profile:mina0001');
  await expect(whoTitle(page)).toBeVisible();
}

/** Mina through onboarding (the PIN 1234 set), then Joon in the stored list: a shared family device with a PIN. */
async function sharedDeviceWithPin(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  await seedStored(page, 'profiles', [...profiles, { ...profiles[0]!, id: 'profile:joon0001', displayName: 'Joon', createdAt: new Date().toISOString() }]);
  await expect(whoTitle(page)).toBeVisible();
}

/** A real hash of the e2e PIN, made by the app's own first run on a browser of its own. */
async function pinHashOf1234(browser: Browser): Promise<string> {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await onboardChild(page, { name: 'Tmp' });
  const hash = await readStored<string>(page, 'account:parentPinHash');
  await context.close();
  if (typeof hash !== 'string') throw new Error('no PIN hash');
  return hash;
}

/** A device that holds a PIN and no learner profile (the PIN hash written before the app reads it). */
async function deviceWithPinOnly(page: Page, hash: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
  await seedStored(page, 'account:parentPinHash', hash);
}

/** From Hoya's hello, quest 1 to the guest's Results with every round right (3 stars, the card). */
async function playQuestOne(page: Page): Promise<void> {
  await continueButton(page).click();
  await passDiscover(page);
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await playCheckByIds(page, [{ answer: 'jamo:eo' }, { answer: '너' }]);
  await page.getByRole('button', { name: en.learner.quest.seeResults.cta, exact: true }).click();
  await expect(page.getByTestId('guest-save-card')).toBeVisible();
}

/** Nothing on the page scrolls sideways. */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

for (const size of [
  { name: '320 px', width: 320, height: 640 },
  { name: 'wide', width: 1280, height: 800 },
]) {
  test.describe(`guest child safety on the release build, production flag values (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, serviceWorkers: 'block' });
    const tag = size.width;

    test('G1: the first letter in 2 taps on an empty device (Start learning, Continue)', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      const taps = await countTaps(page);
      // Tap 1: the site's Start learning, whose href is the learner app with try=1 (apps/web landing-layout e2e).
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      await expectNoSidewaysScroll(page);
      await shot(page, `guest-cs-g1-hello-${tag}`);
      // Tap 2: Continue on Hoya's hello. Discover page 1 shows ㅏ.
      await continueButton(page).click();
      await expect(letterA(page)).toBeVisible();
      await shot(page, `guest-cs-g1-discover-${tag}`);
      expect(SITE_TAP + (await taps())).toBe(2);
    });

    test('G1: the first letter in 3 taps on a device with learner profiles and the chooser (Start learning, Try the first quest, Continue)', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      await twoProfiles(page);
      // The counter starts with the learner app's document that the site's tap opens.
      const taps = await countTaps(page);
      await page.goto('/?try=1');
      await expect(whoTitle(page)).toBeVisible();
      await expect(tryTile(page)).toBeVisible();
      await expectNoSidewaysScroll(page);
      await shot(page, `guest-cs-g1-chooser-${tag}`);
      await tryTile(page).click();
      await expect(hello(page)).toBeVisible();
      await continueButton(page).click();
      await expect(letterA(page)).toBeVisible();
      expect(SITE_TAP + (await taps())).toBe(3);
    });

    test('CS-G1, CS-G7: a whole run reaches only the 7.1 routes, draws no grown-up control, stays on / in one tab and sends nothing that names the guest', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      const { requests, routes } = await watch(page);
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      await playQuestOne(page);
      // The guest's Results: no Paywall, Join, Profile, Journey, notes, level check or grown-up hand-off.
      for (const label of [en.learner.results.backHome.cta, en.learner.results.episodePage.cta]) await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
      await expect(page.getByTestId('next-up-card')).toHaveCount(0);
      await expect(page.getByText(PIN_LINE)).toHaveCount(0);
      await shot(page, `guest-cs-g1-results-${tag}`);
      await notNow(page).click();
      await expect(page.getByTestId('guest-later')).toBeVisible();
      const end = (await routes()).length;
      await page.getByTestId('guest-later-close').click();
      await expect(page.getByTestId('welcome-guest')).toBeVisible();
      expect(forbiddenDuringRun(await routes(), end)).toEqual([]);
      expect(new URL(page.url()).pathname).toBe('/');
      expect(context.pages()).toHaveLength(1);
      // No page navigation off the learner root, no console page and no sign-in host.
      const navigations = requests.filter((r) => r.isNavigationRequest() && r.frame() === page.mainFrame()).map((r) => new URL(r.url()).pathname);
      expect(navigations.filter((path) => path !== '/')).toEqual([]);
      expect(requests.filter((r) => /^\/(signin|start|parent|teach|account)(\/|\?|$)/.test(new URL(r.url()).pathname) || /(^|\.)clerk\./.test(new URL(r.url()).hostname))).toEqual([]);
      expectAnonymousRun(requests);
      // No profile, so no backup can hold the guest: the profile list is still empty.
      expect(await readStored(page, 'profiles')).toBeNull();
    });

    test('CS-G2: the SaveGuest PIN opens the save form only: no grown-up session, and the grown-up gate still asks the PIN after the save', async ({ page, context, browser }) => {
      if (WITH_API) await mockApi(context);
      const hash = await pinHashOf1234(browser);
      await deviceWithPinOnly(page, hash);
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      await playQuestOne(page);
      await keep(page).click();
      await expect(page.getByText(PIN_LINE)).toBeVisible();
      await typeDigits(page, '1234');
      await page.getByRole('button', { name: 'Unlock' }).click();
      await expect(page.getByRole('heading', { name: c.guest.title })).toBeVisible();
      expect(await grownUpSession(page)).toEqual([null, null]);
      await page.getByPlaceholder(c.namePlaceholder).fill('Sam');
      await cont(page).click();
      await page.getByRole('radio', { name: WHO_SELF }).click();
      await page.getByRole('checkbox').click();
      await cont(page).click();
      await expect(page.getByTestId('home-guest-saved')).toBeVisible();
      expect(await grownUpSession(page)).toEqual([null, null]);
      // No fresh-PIN credit and no open gate, in this same document: both live in memory only (ui-store), so a reload
      // would wipe a wrong credit before the check. Account pages hands off at once after a fresh PIN
      // (`decideHandoff`) and asks the PIN otherwise.
      const documents: string[] = [];
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) documents.push(frame.url());
      });
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await openForGrownUps(page);
      await page.getByTestId('profile-grown-up-home').click();
      await expect(page.getByText(PIN_LINE)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/');
      expect(documents.filter((url) => new URL(url).pathname !== '/')).toEqual([]);
      expect(await grownUpSession(page)).toEqual([null, null]);
      await shot(page, `guest-cs-g2-gate-after-save-${tag}`);
    });

    test('CS-G3: a grown-up session open in the tab is closed by the site start and by the chooser\'s Try the first quest', async ({ page, context, browser }) => {
      if (WITH_API) await mockApi(context);
      const heard = await lockListener(context);
      await page.goto('/');
      await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
      // The control: every boot of a learner root drops the tab's marks too (F-APP-001 3.9), but a plain boot tells
      // no other tab. Only a guest start closes the session (and posts the lock).
      await openSession(page);
      await page.reload();
      await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
      expect(await heard()).toEqual([]);
      await openSession(page);
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      expect(await grownUpSession(page)).toEqual([null, null]);
      await expect.poll(heard).toContainEqual({ v: 1, kind: 'lock' });

      // A device of its own (its own storage): two learners and the chooser.
      const sharedContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, serviceWorkers: 'block' });
      if (WITH_API) await mockApi(sharedContext);
      const shared = await sharedContext.newPage();
      await twoProfiles(shared);
      const sharedHeard = await lockListener(sharedContext);
      await shared.goto('/?try=1');
      await expect(tryTile(shared)).toBeVisible();
      // Opened in this document after the chooser drew, so only the tile can close it.
      await openSession(shared);
      expect(await grownUpSession(shared)).toEqual(['{"v":1}', '{"v":1}']);
      const heardBefore = (await sharedHeard()).length;
      await tryTile(shared).click();
      await expect(hello(shared)).toBeVisible();
      expect(await grownUpSession(shared)).toEqual([null, null]);
      await expect.poll(async () => (await sharedHeard()).slice(heardBefore)).toContainEqual({ v: 1, kind: 'lock' });
      await sharedContext.close();
    });

    test('CS-G4: try selects and creates nobody and keeps the chooser; gate=grown-up and a join link each win over it', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      await sharedDeviceWithPin(page);
      const profilesBefore = await readStored<Array<{ id: string }>>(page, 'profiles');
      const activeBefore = await readStored(page, 'profiles:active');
      await page.goto('/?try=1');
      await expect(whoTitle(page)).toBeVisible();
      await expect(tryTile(page)).toBeVisible();
      expect(await readStored(page, 'guest')).toBeNull();
      expect(await readStored(page, 'profiles')).toEqual(profilesBefore);
      expect(await readStored(page, 'profiles:active')).toEqual(activeBefore);
      // The grown-up gate wins and try is dropped: the PIN screen, and no guest run.
      await page.goto('/?gate=grown-up&next=%2Fparent&try=1');
      await expect(page.getByText(PIN_LINE)).toBeVisible();
      await expect(hello(page)).toHaveCount(0);
      expect(await readStored(page, 'guest')).toBeNull();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(whoTitle(page)).toBeVisible();
      // A join link wins: the chooser asks who joins, with no try tile.
      await page.goto('/join?try=1#c=abc234');
      await expect(whoTitle(page)).toBeVisible();
      await expect(page.getByText(w.joinCaption, { exact: true })).toBeVisible();
      await expect(tryTile(page)).toHaveCount(0);
      expect(await readStored(page, 'guest')).toBeNull();
      expect(await readStored(page, 'profiles')).toEqual(profilesBefore);
    });

    test('CS-G5: the guest\'s own tile carries its label only: no stars, cards, level, streak or time', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      await twoProfiles(page);
      await page.goto('/?try=1');
      await tryTile(page).click();
      await playQuestOne(page);
      await notNow(page).click();
      await page.getByTestId('guest-later-close').click();
      await expect(whoTitle(page)).toBeVisible();
      await expect(guestTile(page)).toBeVisible();
      const text = await guestTile(page).innerText();
      expect(text.split('\n').map((line) => line.trim()).filter(Boolean).sort()).toEqual([w.guest, w.guestCaption].sort());
      expect(text).not.toMatch(/\d|star|card|level|streak|day|minute/i);
      await shot(page, `guest-cs-g5-tile-${tag}`);
    });

    test('CS-G6: while a live guest exists on an empty device, the gate marker is nopin, never none', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      expect(await readStored(page, 'guest')).not.toBeNull();
      await expect.poll(() => readStored<{ gate: string }>(page, 'device:gate')).toMatchObject({ v: 1, gate: 'nopin' });
      await page.reload();
      await expect(hello(page)).toBeVisible();
      expect((await readStored<{ gate: string }>(page, 'device:gate'))?.gate).not.toBe('none');
    });

    test('CS-G8: the save keeps the consent rules: no who answer chosen, the agreement unticked, the under-13 latch, the PIN for someone looked after, the email folded and cleared', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      await playQuestOne(page);
      await keep(page).click();
      await page.getByPlaceholder(c.namePlaceholder).fill('Sam');
      await cont(page).click();
      await expect(page.getByRole('heading', { name: c.privacy.title })).toBeVisible();
      // Nothing is chosen for the learner: no who answer, no agreement, and the calm line says what is missing.
      for (const who of [WHO_SELF, WHO_CHILD]) await expect(page.getByRole('radio', { name: who })).not.toBeChecked();
      await expect(page.getByText(c.missing.who, { exact: true })).toBeVisible();
      // The email is folded: no field until Add an email.
      await expect(page.getByPlaceholder(c.email.placeholder)).toHaveCount(0);
      await page.getByRole('radio', { name: WHO_SELF }).click();
      await expect(page.getByRole('checkbox')).not.toBeChecked();
      await page.getByRole('button', { name: c.email.add }).click();
      await page.getByPlaceholder(c.email.placeholder).fill('sam@example.com');
      await shot(page, `guest-cs-g8-privacy-${tag}`);
      // The under-13 latch hands the step to a grown-up: the answer moves to someone looked after, the email is not
      // carried from the "Me" card, the agreement is not ticked for them, and the PIN is required.
      await page.getByRole('button', { name: c.privacy.under13 }).click();
      await expect(page.getByTestId('create-profile-switched-note')).toBeVisible();
      await expect(page.getByRole('radio', { name: WHO_CHILD })).toBeChecked();
      await expect(page.getByPlaceholder(c.email.placeholder)).toHaveCount(0);
      await expect(page.getByRole('checkbox')).not.toBeChecked();
      await page.getByRole('checkbox').click();
      await expect(page.getByText(c.missing.pin, { exact: true })).toBeVisible();
      expect(await readStored(page, 'profiles')).toBeNull();
      expect(await readStored(page, 'account:parentEmail')).toBeNull();
    });

    test('CS-G9, CS-G10 (verify): Cancel on the SaveGuest PIN saves nothing; after the PIN the form has no PIN row and the hash is unchanged', async ({ page, context, browser }) => {
      if (WITH_API) await mockApi(context);
      const hash = await pinHashOf1234(browser);
      await deviceWithPinOnly(page, hash);
      await page.goto('/?try=1');
      await expect(hello(page)).toBeVisible();
      await playQuestOne(page);
      await keep(page).click();
      await expect(page.getByText(PIN_LINE)).toBeVisible();
      await expect(page.getByRole('button', { name: en.caregiver.pin.entry.forgot.cta })).toHaveCount(0);
      await page.getByRole('button', { name: en.common.buttons.cancel, exact: true }).click();
      await expect(page.getByTestId('guest-save-card')).toBeVisible();
      expect(await readStored(page, 'profiles')).toBeNull();
      await keep(page).click();
      await typeDigits(page, '1234');
      await page.getByRole('button', { name: 'Unlock' }).click();
      await page.getByPlaceholder(c.namePlaceholder).fill('Sam');
      await cont(page).click();
      for (const who of [WHO_SELF, WHO_CHILD]) {
        await page.getByRole('radio', { name: who }).click();
        await expect(page.getByText(c.self.pinRow)).toHaveCount(0);
        await expect(page.getByText(c.guardian.pinHeading)).toHaveCount(0);
      }
      expect(await readStored(page, 'account:parentPinHash')).toBe(hash);
    });

    test('CS-G9, CS-G10 (owner): on a device with a learner and no PIN, no save from the guest path and no PIN pad; the PIN stays unset', async ({ page, context }) => {
      if (WITH_API) await mockApi(context);
      await page.goto('/');
      await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
      await seedStored(page, 'profiles', [child('profile:mina0001', 'Mina')]);
      await seedStored(page, 'profiles:active', 'profile:mina0001');
      await page.goto('/?try=1');
      await expect(whoTitle(page)).toBeVisible();
      await tryTile(page).click();
      await playQuestOne(page);
      // The owner case: the ask-the-owner line as the card's heading, no Keep my progress, no PIN pad.
      await expect(page.getByTestId('guest-save-heading')).toHaveText(g.results.askOwner);
      await expect(keep(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toHaveCount(0);
      await expect(page.getByText(PIN_LINE)).toHaveCount(0);
      await expect(page.getByText('Create a PIN', { exact: true })).toHaveCount(0);
      await expect(notNow(page)).toBeVisible();
      await shot(page, `guest-cs-g9-owner-${tag}`);
      expect(await readStored(page, 'account:parentPinHash')).toBeNull();
      expect((await readStored<Array<{ id: string }>>(page, 'profiles'))!.map((p) => p.id)).toEqual(['profile:mina0001']);
    });
  });
}
