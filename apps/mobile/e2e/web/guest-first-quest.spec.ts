import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { acceptConfirmSheets, headerBack, headerClose, passDiscover, playCheckByIds, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON row GU-3 (section 19): the guest's first quest on an empty device, on the learner
 * export. The switch `EXPO_PUBLIC_GUEST_LESSON` is off until row GU-7, so this runs only on a bundle built with it on,
 * with `E2E_GUEST=1`:
 *
 *   EXPO_PUBLIC_GUEST_LESSON=1 pnpm --filter @hangul-route/mobile build:web
 *   E2E_GUEST=1 pnpm --filter @hangul-route/mobile exec playwright test guest-first-quest
 *
 * Covered: `/?try=1` reaches ㅏ in 2 taps (G1: the site's Start learning, then Continue on Hoya's hello), in Korean
 * with `lang=ko`; `try` leaves the address and `lang` stays; a reload within 30 minutes reopens quest 1; 31 minutes
 * later (a fake clock) Welcome shows the waiting card; Close shows it too; storage blocked shows the line under
 * Hoya's hello; no `/api/sync` or `/api/spaces` request (CS-G7); every route a guest run reaches is a route of
 * section 7.1 and no console or sign-in page opens (CS-G1 at run time, read from the route name React Navigation
 * writes to the document title on the web); a run started from `/?try=1` or from Welcome's Back to my quest closes
 * the grown-up session of the tab (CS-G3).
 */
test.skip(process.env.E2E_GUEST !== '1', 'needs a learner build with EXPO_PUBLIC_GUEST_LESSON=1 (E2E_GUEST=1); the switch is off until GU-7');
test.use({ viewport: { width: 360, height: 740 } });

const en = getMessages('en');
const ko = getMessages('ko');
const g = en.learner.guest.welcome;

/** Section 7.1: every route a guest run can reach, and the stack itself (focused while its chunk loads). */
const GUEST_ROUTES = ['Guest', 'QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater', 'CreateProfile', 'PinEntry'];
const MIN = 60 * 1000;

const hello = (page: Page) => page.getByText('Hi from Hoya', { exact: true });
const letterA = (page: Page) => page.getByTestId('discover-item-jamo:a').getByText('ㅏ', { exact: true }).first();
const continueButton = (page: Page, label: string = en.learner.quest.continue.cta) => page.getByRole('button', { name: label, exact: true });

/**
 * Records, from the first script on, every route name the app shows (React Navigation writes the focused route's
 * name to `document.title` on the web) and every request the page makes.
 */
async function watch(page: Page): Promise<{ requests: string[] }> {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as Window & { __routes?: string[] }).__routes = seen;
    const note = (): void => {
      if (seen[seen.length - 1] !== document.title) seen.push(document.title);
    };
    new MutationObserver(note).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return { requests };
}

const routesSeen = (page: Page): Promise<string[]> => page.evaluate(() => (window as Window & { __routes?: string[] }).__routes ?? []);

/** The routes seen since the run began (the Guest stack) and up to its end (Welcome or another root). */
function duringRun(routes: string[]): string[] {
  const start = routes.findIndex((r) => r === 'Guest' || r === 'QuestPlayer' || r === 'GuestLater');
  if (start === -1) return [];
  const end = routes.findIndex((r, i) => i > start && !GUEST_ROUTES.includes(r) && r !== '');
  return routes.slice(start, end === -1 ? undefined : end);
}

function expectNoServerCalls(requests: string[]): void {
  expect(requests.filter((url) => /\/api\/(sync|spaces)(\/|\?|$)/.test(url))).toEqual([]);
}

/** Starts the guest run as the site's Start learning does (tap 1) and waits for Hoya's hello. */
async function startFromSite(page: Page, search: string = '?try=1'): Promise<void> {
  await page.goto(`/${search}`);
  await expect(hello(page)).toBeVisible();
}

test.describe('the guest first quest (GU-3)', () => {
  test('G1: /?try=1 reaches ㅏ in 2 taps on an empty device; try leaves the address; only the 7.1 routes (CS-G1, CS-G7)', async ({ page, context }) => {
    const { requests } = await watch(page);
    await startFromSite(page);
    // Tap 1 was the site's Start learning; Welcome never showed, and try left the address.
    expect(new URL(page.url()).search).toBe('');
    await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toHaveCount(0);
    await expect(headerClose(page)).toBeVisible();
    await shot(page, 'guest-hello-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-hello-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-hello-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // Tap 2: Continue on Hoya's hello. Discover page 1 shows ㅏ.
    await continueButton(page).click();
    await expect(letterA(page)).toBeVisible();
    await shot(page, 'guest-discover-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-discover-320');
    await page.setViewportSize({ width: 360, height: 740 });
    // The record is the guest's: an ordinary profile id, not on the profile list (GU-D1, GU-D2).
    const guest = await readStored<{ id: string; via: string; questDone: boolean }>(page, 'guest');
    expect(guest).toMatchObject({ via: 'site', questDone: false });
    expect(guest!.id).toMatch(/^profile:[a-z0-9]+$/);
    expect(await readStored(page, 'profiles')).toBeNull();
    // CS-G1 at run time: only the routes of 7.1, no other page or tab (no console, no sign-in).
    expect(duringRun(await routesSeen(page)).filter((r) => !GUEST_ROUTES.includes(r))).toEqual([]);
    expect(duringRun(await routesSeen(page))).toContain('QuestPlayer');
    expect(new URL(page.url()).pathname).toBe('/');
    expect(context.pages()).toHaveLength(1);
    expectNoServerCalls(requests);
  });

  test('quest 1 to the guest\'s Results: the card and See my card, every back opens the Not now card, Close leads to Welcome (CS-G1)', async ({ page, context }) => {
    const { requests } = await watch(page);
    await startFromSite(page);
    await continueButton(page).click();
    await passDiscover(page);
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
    await playCheckByIds(page, [{ answer: 'jamo:eo' }, { answer: '너' }]);
    await page.getByRole('button', { name: en.learner.quest.seeResults.cta, exact: true }).click();
    // The guest's Results: stars, Hoya's line and the card; no teaser, Back to Journey, Episode page or name row.
    await expect(page.getByRole('heading', { name: en.learner.results.headline.wonderful })).toBeVisible();
    await expect(page.getByText(en.learner.results.newCard.title)).toBeVisible();
    await expect(page.getByTestId('next-up-card')).toHaveCount(0);
    for (const label of [en.learner.results.backHome.cta, en.learner.results.episodePage.cta]) await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    await expect.poll(() => readStored<{ questDone: boolean }>(page, 'guest')).toMatchObject({ questDone: true });
    await shot(page, 'guest-results-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-results-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-results-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // See my card, then its Close returns to Results.
    await page.getByRole('button', { name: /^See / }).click();
    await headerClose(page).click();
    await expect(page.getByText(en.learner.results.newCard.title)).toBeVisible();
    // Results' Back opens the Not now card (GU-4 fills it), whose Close ends the run: Welcome asks for a name.
    await headerBack(page).click();
    await expect(page.getByTestId('guest-later')).toBeVisible();
    await page.getByTestId('guest-later-close').click();
    await expect(page.getByTestId('welcome-guest')).toContainText(g.saveTitle);
    // CS-G1 at run time, over the whole run: the 7.1 routes only, one tab, the learner app's own address.
    const run = duringRun(await routesSeen(page));
    expect(run.filter((r) => !GUEST_ROUTES.includes(r))).toEqual([]);
    expect(run).toEqual(expect.arrayContaining(['QuestPlayer', 'Results', 'CardDetail', 'GuestLater']));
    expect(new URL(page.url()).pathname).toBe('/');
    expect(context.pages()).toHaveLength(1);
    expectNoServerCalls(requests);
    expect(await readStored(page, 'profiles')).toBeNull();
  });

  test('/?lang=ko&try=1 opens the quest in Korean (lang is kept for the locale hand-off, which takes it)', async ({ page }) => {
    await page.goto('/?lang=ko&try=1');
    const continueKo = continueButton(page, ko.learner.quest.continue.cta);
    await expect(continueKo).toBeVisible();
    expect(new URL(page.url()).searchParams.has('try')).toBe(false);
    await shot(page, 'guest-hello-ko-360');
    await continueKo.click();
    await expect(letterA(page)).toBeVisible();
  });

  test('a reload within 30 minutes reopens quest 1 from step 1; 31 minutes later Welcome shows the waiting card', async ({ page }) => {
    await page.clock.install({ time: Date.parse('2026-10-22T10:00:00Z') });
    const { requests } = await watch(page);
    await startFromSite(page);
    await continueButton(page).click();
    await expect(letterA(page)).toBeVisible();
    // The address has no try any more: the boot finds the live record and reopens it (a quest in progress is memory only).
    await page.clock.fastForward(10 * MIN);
    await page.reload();
    await expect(hello(page)).toBeVisible();
    await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toHaveCount(0);
    // 31 minutes after the last play: Welcome, with the card above Let's start and the keeps line under it.
    await page.clock.fastForward(31 * MIN);
    await page.reload();
    await expect(page.getByTestId('welcome-guest')).toBeVisible();
    await expect(page.getByTestId('welcome-guest')).toContainText(g.waiting);
    await expect(page.getByTestId('welcome-guest-keeps')).toHaveText(g.keeps);
    await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
    await shot(page, 'guest-welcome-waiting-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-welcome-waiting-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-welcome-waiting-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // Back to my quest goes back into the run.
    await page.getByTestId('welcome-guest-resume').click();
    await expect(hello(page)).toBeVisible();
    expectNoServerCalls(requests);
  });

  test('Close, then Leave: Welcome with the waiting card; the record stays', async ({ page }) => {
    await acceptConfirmSheets(page);
    await startFromSite(page);
    await continueButton(page).click();
    await expect(letterA(page)).toBeVisible();
    await headerClose(page).click();
    await expect(page.getByTestId('welcome-guest')).toContainText(g.waiting);
    await expect(page.getByTestId('welcome-guest-resume')).toHaveText(g.resume);
    expect(await readStored(page, 'guest')).toMatchObject({ questDone: false });
  });

  test('quest 1 done: Welcome shows Add your name to keep your first quest', async ({ page }) => {
    await startFromSite(page);
    const guest = await readStored<Record<string, unknown>>(page, 'guest');
    await page.clock.install({ time: Date.now() + 2 * 60 * MIN });
    await seedStored(page, 'guest', { ...guest, questDone: true });
    await expect(page.getByTestId('welcome-guest')).toContainText(g.saveTitle);
    await expect(page.getByTestId('welcome-guest-save')).toHaveText(g.save);
    await shot(page, 'guest-welcome-save-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-welcome-save-320');
  });

  test('storage blocked: the run goes on in memory with the line under Hoya\'s hello', async ({ page }) => {
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function blocked(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (key === 'hr:guest') throw new DOMException('blocked', 'QuotaExceededError');
        return put.call(this, value, key);
      };
    });
    await startFromSite(page);
    const line = page.getByText(en.learner.guest.memoryOnly, { exact: true });
    await expect(line).toBeVisible();
    // Plain text in reading order, not a live region.
    expect(await line.evaluate((el) => el.closest('[aria-live]') === null && el.closest('[role="alert"]') === null)).toBe(true);
    await shot(page, 'guest-hello-memory-only-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-hello-memory-only-320');
    await page.setViewportSize({ width: 360, height: 740 });
    await continueButton(page).click();
    await expect(letterA(page)).toBeVisible();
    await expect(line).toHaveCount(0);
  });

  test('CS-G3: /?try=1 and Back to my quest each close the grown-up session of the tab and tell the other tabs', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
    const other = await context.newPage();
    await other.goto('/');
    await other.evaluate(() => {
      const heard: unknown[] = [];
      (window as Window & { __heard?: unknown[] }).__heard = heard;
      new BroadcastChannel('hr-grownup').onmessage = (event) => heard.push(event.data);
    });
    const heard = (): Promise<unknown[]> => other.evaluate(() => (window as Window & { __heard?: unknown[] }).__heard ?? []);
    const openSession = (): Promise<void> =>
      page.evaluate(() => {
        sessionStorage.setItem('hr:grownup:unlock', '{"v":1}');
        sessionStorage.setItem('hr:console:session', '{"v":1}');
      });
    const sessionLeft = (): Promise<(string | null)[]> => page.evaluate(() => [sessionStorage.getItem('hr:grownup:unlock'), sessionStorage.getItem('hr:console:session')]);

    await openSession();
    await page.goto('/?try=1');
    await expect(hello(page)).toBeVisible();
    expect(await sessionLeft()).toEqual([null, null]);
    await expect.poll(heard).toContainEqual({ v: 1, kind: 'lock' });

    // Leave, then a grown-up session opens again in this tab while Welcome waits; Back to my quest closes it.
    await acceptConfirmSheets(page);
    await headerClose(page).click();
    await expect(page.getByTestId('welcome-guest')).toBeVisible();
    await other.evaluate(() => void ((window as Window & { __heard?: unknown[] }).__heard!.length = 0));
    await openSession();
    await page.getByTestId('welcome-guest-resume').click();
    await expect(hello(page)).toBeVisible();
    expect(await sessionLeft()).toEqual([null, null]);
    await expect.poll(heard).toContainEqual({ v: 1, kind: 'lock' });
  });
});
