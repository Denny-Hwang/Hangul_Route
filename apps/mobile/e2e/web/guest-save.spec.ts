import { getMessages } from '@hangul-route/i18n';
import type { Browser, BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { acceptConfirmSheets, answerForkNew, headerBack, headerClose, onboardChild, openLettersEpisode, passDiscover, playCheckByIds, readStored, typeDigits, WHO_CHILD, WHO_SELF } from './helpers';
import { shot } from './shots';
import { heritageCardsAll } from '../../src/content/heritage-cards';
import { questsAll } from '../../src/content/quests';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON row GU-4 (sections 8.1 to 8.6, 10, 19): the save after the first quest, on the
 * learner export. The switch is off until row GU-7, so this runs on a bundle built with it on, and with a mocked sync
 * API (the save registers the new learner once the network is back, F-SYNC-002):
 *
 *   EXPO_PUBLIC_GUEST_LESSON=1 EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid pnpm --filter @hangul-route/mobile build:web
 *   E2E_GUEST=1 pnpm --filter @hangul-route/mobile exec playwright test guest-save
 *
 * Covered: an empty device saves with "Me" and the agreement, and Home shows Hoya's bubble, the card in the Library
 * and quest 1 done (G2); "Someone I look after" makes the device's first PIN on the empty device (the `open` case);
 * a device with a PIN asks it (`SaveGuest`, verify only), also once a learner profile appeared (CS-G9), opens no
 * grown-up session (CS-G2), draws no PIN row and leaves the PIN hash as it was (CS-G10); a device with one profile and
 * no PIN shows only the ask-the-owner line, never a PIN pad, and its PIN stays unset (CS-G10); Not now, then Add my
 * name; Back on Results opens the Not now card, whose back lands where Close does; Try this one again at 1 star
 * replays quest 1 inside the stack; Me with the optional PIN stores it on the empty device; Home's level-check card
 * and quest 1 on the Journey after the save; Let's start with a live guest promotes it (GU-D11); an offline save registers when
 * the network returns.
 */
test.skip(process.env.E2E_GUEST !== '1', 'needs a learner build with EXPO_PUBLIC_GUEST_LESSON=1 (E2E_GUEST=1); the switch is off until GU-7');
test.use({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });

const en = getMessages('en');
const g = en.learner.guest;
const c = en.learner.createProfile;
const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };

/** Section 7.1: every route a guest run can reach, and the stack itself. */
const GUEST_ROUTES = ['Guest', 'QuestPlayer', 'Minigame', 'Results', 'CardDetail', 'GuestLater', 'CreateProfile', 'PinEntry'];

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

/** The sync API, mocked: a learner registers (201), its snapshot is taken, the inbox is empty. */
async function mockApi(context: BrowserContext): Promise<Call[]> {
  const calls: Call[] = [];
  const json = (route: Route, status: number, body: unknown): Promise<void> => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = decodeURIComponent(new URL(req.url()).pathname);
    const body = req.postData() ? (JSON.parse(req.postData() ?? '{}') as Record<string, unknown>) : null;
    calls.push({ method: req.method(), path, body });
    if (req.method() === 'POST' && path === '/api/sync/learners') {
      const learner = (body?.learner ?? {}) as { id?: string };
      return json(route, 201, { data: { learner: { id: learner.id }, device: { secret: 'secret-e2e' } } });
    }
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    if (path.endsWith('/inbox')) return json(route, 200, { data: { rev: 1, plans: [], memberships: [], tier: 'free', serverTime: new Date().toISOString(), deviceScope: 'full' } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
  return calls;
}

/** Records every route name the app shows (React Navigation writes the focused route's name to `document.title`). */
async function watchRoutes(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as Window & { __routes?: string[] }).__routes = seen;
    const note = (): void => {
      if (seen[seen.length - 1] !== document.title) seen.push(document.title);
    };
    new MutationObserver(note).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return () => page.evaluate(() => (window as Window & { __routes?: string[] }).__routes ?? []);
}

/** The routes from the run's start up to `end` that are not routes of section 7.1 (CS-G1 at run time). */
function forbiddenDuringRun(routes: readonly string[], end: number = routes.length): string[] {
  const start = routes.findIndex((r) => r === 'Guest' || r === 'QuestPlayer' || r === 'GuestLater');
  if (start === -1) return ['(the run never started)'];
  return routes.slice(start, end).filter((r) => r !== '' && !GUEST_ROUTES.includes(r));
}

/** A quest's card, and a card's English title. */
const questCardId = (questId: string): string | undefined => questsAll.find((q) => q.id === questId)?.rewardCardId;
const titleOf = (cardId: string): string => heritageCardsAll.find((card) => card.id === cardId)!.titleEn;

const keep = (page: Page) => page.getByRole('button', { name: g.results.keep, exact: true });
const notNow = (page: Page) => page.getByRole('button', { name: g.results.notNow, exact: true });
const cont = (page: Page) => page.getByRole('button', { name: c.cta, exact: true });
const digit = (page: Page) => page.getByRole('button', { name: 'Digit 1', exact: true });

/** `/?try=1`, then quest 1 to the guest's Results: every check round right (3 stars), or round 1 missed first. */
async function playToResults(page: Page, missFirst = false): Promise<void> {
  await page.goto('/?try=1');
  await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await playCheckByIds(page, [{ answer: 'jamo:eo', ...(missFirst ? { missWith: 'jamo:a' } : {}) }, { answer: '너' }]);
  await page.getByRole('button', { name: en.learner.quest.seeResults.cta, exact: true }).click();
  await expect(page.getByTestId('guest-save-card')).toBeVisible();
}

/** Step 1 of 2: the name, then Continue onto Privacy. */
async function nameStep(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name: c.guest.title })).toBeVisible();
  await page.getByPlaceholder(c.namePlaceholder).fill(name);
  await cont(page).click();
  await expect(page.getByRole('heading', { name: c.privacy.title })).toBeVisible();
}

/** A learner profile appears on this device while the guest's Results is open (another tab added it). */
async function addProfileElsewhere(page: Page, name: string): Promise<void> {
  await page.evaluate(
    (displayName) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          const profile = { id: 'profile:other001', displayName, ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
          tx.objectStore('keyval').put(JSON.stringify([profile]), 'hr:profiles');
          tx.oncomplete = () => {
            db.close();
            new BroadcastChannel('hr-profiles').postMessage({ v: 1, kind: 'changed' });
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    name,
  );
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

/** Writes the device's PIN hash before the app loads (a device that already holds a PIN and no learner profile). */
async function seedPinHash(page: Page, hash: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(JSON.stringify(value), 'hr:account:parentPinHash');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    hash,
  );
}

const grownUpSession = (page: Page): Promise<(string | null)[]> => page.evaluate(() => [sessionStorage.getItem('hr:grownup:unlock'), sessionStorage.getItem('hr:console:session')]);

test.describe('the save after the first quest (GU-4)', () => {
  test('G2: an empty device saves with Me and the agreement; Home greets with the bubble, the card is in the Library, quest 1 is done', async ({ page, context }) => {
    const calls = await mockApi(context);
    const routes = await watchRoutes(page);
    await playToResults(page);
    const guest = await readStored<{ id: string }>(page, 'guest');
    // The save card: Hoya's line as its heading (the card is kept), Keep my progress, the quiet Not now.
    await expect(page.getByTestId('guest-save-heading')).toHaveText(g.results.line);
    await expect(page.getByRole('heading', { name: g.results.line })).toBeVisible();
    await expect(notNow(page)).toBeVisible();
    await expect(page.getByTestId('guest-save-caption')).toHaveCount(0);
    await expect(page.getByRole('button', { name: en.caregiver.backup.save.cta })).toHaveCount(0);
    await shot(page, 'guest-save-results-open-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-save-results-open-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-save-results-open-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    await keep(page).click();
    // Step 1 of 2.
    await expect(page.getByText(c.step(1, 2), { exact: true })).toBeVisible();
    await expect(page.getByText(c.guest.later, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-save-step1-320');
    await page.setViewportSize({ width: 360, height: 740 });
    await nameStep(page, 'Sam');
    // Step 2 of 2: who is learning, nothing chosen, lessons.plain.
    await expect(page.getByText(c.step(2, 2), { exact: true })).toBeVisible();
    await expect(page.getByText(c.lessons.plain, { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await page.getByRole('radio', { name: WHO_SELF }).click();
    // The email is folded: a disclosure, closed.
    const row = page.getByTestId('create-profile-email-row');
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('textbox', { name: c.email.label })).toHaveCount(0);
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('textbox', { name: c.email.label })).toBeFocused();
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-save-step2-email-open-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-save-step2-email-open-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // Closing it clears what was typed.
    await page.getByRole('textbox', { name: c.email.label }).fill('sam@example.com');
    await row.click();
    await row.click();
    await expect(page.getByRole('textbox', { name: c.email.label })).toHaveValue('');
    await row.click();
    await page.getByRole('checkbox').click();
    const end = (await routes()).length;
    await cont(page).click();
    // Home of the new profile, no level-check fork, Hoya's one bubble.
    await expect(page.getByTestId('home-guest-saved')).toContainText(g.saved('Sam'));
    await expect(page.getByTestId('placement-invite')).toHaveCount(0);
    // No fork was recorded, so Home's level-check card shows as for any new learner (8.4).
    await expect(page.getByTestId('home-level-check')).toBeVisible();
    await shot(page, 'guest-save-home-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-save-home-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-save-home-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // The profile keeps the guest's id; hr:guest is gone (G2 by construction).
    const profiles = await readStored<Array<{ id: string; displayName: string; learnerType: string }>>(page, 'profiles');
    expect(profiles).toEqual([expect.objectContaining({ id: guest!.id, displayName: 'Sam', learnerType: 'self' })]);
    expect(await readStored(page, 'guest')).toBeNull();
    const progress = await readStored<{ quests: Array<{ questId: string }>; cards: Array<{ cardId: string }> }>(page, `progress:${guest!.id}`);
    expect(progress?.quests.length).toBeGreaterThan(0);
    expect(progress?.cards.length).toBeGreaterThan(0);
    // CS-G1 at run time up to the save.
    expect(forbiddenDuringRun(await routes(), end)).toEqual([]);
    // The card is in the Library.
    const questCard = progress!.cards.find((card) => card.cardId === questCardId(progress!.quests[0]!.questId))!;
    expect(questCard).toBeDefined();
    await page.getByRole('tablist').getByRole('link', { name: 'Library', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    const cardsTab = page.getByRole('tab', { name: 'Cards', exact: true });
    if ((await cardsTab.count()) > 0) await cardsTab.click();
    await expect(page.getByRole('button', { name: new RegExp(`^${titleOf(questCard.cardId)}`) }).first()).toBeVisible();
    // Quest 1 is done on the Journey: its row on the episode page shows the stars the guest earned (G2).
    await openLettersEpisode(page);
    await expect(page.getByTestId(`episode-quest-${progress!.quests[0]!.questId}`).locator(`[aria-label="${en.a11y.stars(3)}"]`).first()).toBeVisible();
    // The bubble is shown once.
    await page.reload();
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await expect(page.getByTestId('home-guest-saved')).toHaveCount(0);
    // From the next sync pass (the app start) the new learner registers like any other (5.4 step 5): the server learns
    // it only now, after the agreement, with the guest's id.
    await expect.poll(() => calls.filter((call) => call.method === 'POST' && call.path === '/api/sync/learners').length, { timeout: 20_000 }).toBe(1);
    expect((calls.find((call) => call.path === '/api/sync/learners')!.body!.learner as { id: string }).id).toBe(guest!.id);
  });

  test('Someone I look after with the PIN: the empty device\'s first PIN is set in the form (the open case)', async ({ page, context }) => {
    await mockApi(context);
    await playToResults(page);
    await keep(page).click();
    await nameStep(page, 'Mina');
    await page.getByRole('radio', { name: WHO_CHILD }).click();
    await expect(page.getByText(c.guardian.pinHeading)).toBeVisible();
    await typeDigits(page, '1234');
    await typeDigits(page, '1234');
    await expect(page.getByText('PIN set')).toBeVisible();
    await page.getByRole('checkbox').click();
    await cont(page).click();
    await expect(page.getByTestId('home-guest-saved')).toBeVisible();
    expect(await readStored(page, 'account:parentPinHash')).not.toBeNull();
    expect(await readStored(page, 'account:guardianConsentAcceptedAt')).not.toBeNull();
  });

  test('Me with the optional PIN on the empty device: the PIN is stored (the open case of CS-G10)', async ({ page, context }) => {
    await mockApi(context);
    await playToResults(page);
    await keep(page).click();
    await nameStep(page, 'Sam');
    await page.getByRole('radio', { name: WHO_SELF }).click();
    const row = page.getByRole('button', { name: c.self.pinRow });
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect(page.getByText('Create a PIN', { exact: true })).toBeVisible();
    await typeDigits(page, '1234');
    await expect(page.getByText('Type it again')).toBeVisible();
    await typeDigits(page, '1234');
    await expect(page.getByText('PIN set')).toBeVisible();
    await page.getByRole('checkbox').click();
    await cont(page).click();
    await expect(page.getByTestId('home-guest-saved')).toBeVisible();
    expect(await readStored(page, 'account:parentPinHash')).toEqual(expect.any(String));
    expect(await readStored(page, 'account:selfConsentAcceptedAt')).not.toBeNull();
  });

  test('a device with a PIN: Keep my progress asks it (SaveGuest), also once a profile appeared (CS-G9); no grown-up session, no PIN row, the PIN unchanged (CS-G2, CS-G10)', async ({ page, context, browser }) => {
    await mockApi(context);
    const hash = await pinHashOf1234(browser);
    await seedPinHash(page, hash);
    await playToResults(page);
    // The family device: a learner profile appears in another tab while Results is open.
    await addProfileElsewhere(page, 'Jun');
    await expect(page.getByTestId('guest-save-caption')).toHaveText(g.results.askGrownUp);
    await shot(page, 'guest-save-results-verify-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-save-results-verify-320');
    await page.setViewportSize({ width: 360, height: 740 });
    await keep(page).click();
    // Verify only: the pad, no Forgot PIN?, no setup.
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await expect(page.getByRole('button', { name: en.caregiver.pin.entry.forgot.cta })).toHaveCount(0);
    await shot(page, 'guest-save-pin-320');
    // Cancel returns to the save card.
    await page.getByRole('button', { name: en.common.buttons.cancel, exact: true }).click();
    await expect(page.getByTestId('guest-save-card')).toBeVisible();
    await keep(page).click();
    await typeDigits(page, '1234');
    await page.getByRole('button', { name: 'Unlock' }).click();
    // The form, and no grown-up session in this tab (CS-G2).
    await nameStep(page, 'Sam');
    expect(await grownUpSession(page)).toEqual([null, null]);
    await page.getByRole('radio', { name: WHO_SELF }).click();
    // No PIN part at all after a verify (CS-G10).
    await expect(page.getByText(c.self.pinRow)).toHaveCount(0);
    await page.getByRole('checkbox').click();
    await cont(page).click();
    await expect(page.getByTestId('home-guest-saved')).toBeVisible();
    expect(await readStored(page, 'account:parentPinHash')).toBe(hash);
    expect(await grownUpSession(page)).toEqual([null, null]);
    const ids = (await readStored<Array<{ id: string }>>(page, 'profiles'))!.map((p) => p.id);
    expect(ids).toHaveLength(2);
  });

  test('one profile and no PIN: only the ask-the-owner line and Not now, never a PIN pad; the PIN stays unset (CS-G10)', async ({ page, context }) => {
    await mockApi(context);
    await playToResults(page);
    await addProfileElsewhere(page, 'Jun');
    await expect(page.getByTestId('guest-save-heading')).toHaveText(g.results.askOwner);
    await expect(keep(page)).toHaveCount(0);
    await expect(digit(page)).toHaveCount(0);
    await shot(page, 'guest-save-results-owner-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-save-results-owner-320');
    await page.setViewportSize({ width: 360, height: 740 });
    await notNow(page).click();
    // The Not now card on a device with profiles: 7 days, the ask-the-owner line, Close only.
    await expect(page.getByTestId('guest-later-heading')).toHaveText(g.later.title(7));
    await expect(page.getByTestId('guest-later-line')).toHaveText(g.results.askOwner);
    await expect(page.getByRole('button', { name: g.later.save, exact: true })).toHaveCount(0);
    await expect(digit(page)).toHaveCount(0);
    await shot(page, 'guest-later-owner-320');
    expect(await readStored(page, 'account:parentPinHash')).toBeNull();
  });

  test('Not now, then Add my name; Back (the header\'s or the browser\'s) on step 1 returns to the card, never Results; Close leads to Welcome', async ({ page, context }) => {
    await mockApi(context);
    const routes = await watchRoutes(page);
    await playToResults(page);
    await notNow(page).click();
    const heading = page.getByTestId('guest-later-heading');
    await expect(heading).toHaveText(g.later.title(30));
    await expect(heading).toBeFocused();
    await expect(page.getByTestId('guest-later-line')).toHaveText(g.later.line);
    await shot(page, 'guest-later-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'guest-later-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'guest-later-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByRole('button', { name: g.later.save, exact: true }).click();
    await expect(page.getByRole('heading', { name: c.guest.title })).toBeVisible();
    await page.getByPlaceholder(c.namePlaceholder).fill('Sam');
    await cont(page).click();
    // Back on step 2 keeps the name; Back on step 1 returns to the Not now card.
    await headerBack(page).click();
    await expect(page.getByPlaceholder(c.namePlaceholder)).toHaveValue('Sam');
    await headerBack(page).click();
    await expect(heading).toBeVisible();
    // The browser's back on step 1 also returns to the card (never Results: the card replaced it in history).
    await page.getByRole('button', { name: g.later.save, exact: true }).click();
    await expect(page.getByRole('heading', { name: c.guest.title })).toBeVisible();
    await page.goBack();
    await expect(heading).toBeVisible();
    await expect(page.getByTestId('guest-save-card')).toHaveCount(0);
    // Close: Welcome asks for a name. (The Not now card replaced Results and is the app's first history entry here,
    // so the browser's own back from it leaves the page, as from any root screen; the stack's back acting as Close is
    // pinned by the render test of GuestLater.)
    const end = (await routes()).length;
    await page.getByTestId('guest-later-close').click();
    await expect(page.getByTestId('welcome-guest')).toContainText(g.welcome.saveTitle);
    await expect(page.getByTestId('guest-save-card')).toHaveCount(0);
    expect(forbiddenDuringRun(await routes(), end)).toEqual([]);
    // Welcome's Add my name opens the save, with the Not now card under it.
    await page.getByTestId('welcome-guest-save').click();
    await expect(page.getByRole('heading', { name: c.guest.title })).toBeVisible();
    await headerBack(page).click();
    await expect(heading).toBeVisible();
  });

  test('Back on Results opens the Not now card; Try this one again at 1 star replays quest 1 inside the stack', async ({ page, context }) => {
    await mockApi(context);
    const routes = await watchRoutes(page);
    await playToResults(page, true);
    // One of the two Check rounds right first time: 50 %, 1 star, so no card yet (the first-quest line).
    await expect(page.getByTestId('guest-save-heading')).toHaveText(g.results.lineNoCard);
    const again = page.getByRole('button', { name: en.learner.results.nextUp.again.cta, exact: true });
    await expect(again).toBeVisible();
    await again.click();
    await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
    // Back to Results by playing again, then its Back opens the Not now card.
    await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
    await playCheckByIds(page, [{ answer: 'jamo:eo' }, { answer: '너' }]);
    await page.getByRole('button', { name: en.learner.quest.seeResults.cta, exact: true }).click();
    await expect(page.getByTestId('guest-save-card')).toBeVisible();
    await headerBack(page).click();
    await expect(page.getByTestId('guest-later')).toBeVisible();
    expect(forbiddenDuringRun(await routes())).toEqual([]);
  });

  test('GU-D11: Let\'s start with a live guest keeps the three steps and the fork, and promotes the guest', async ({ page, context }) => {
    await mockApi(context);
    await acceptConfirmSheets(page);
    await page.goto('/?try=1');
    await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
    const guest = await readStored<{ id: string }>(page, 'guest');
    await headerClose(page).click();
    await expect(page.getByTestId('welcome-guest')).toBeVisible();
    await page.getByRole('button', { name: en.learner.welcome.cta }).click();
    await expect(page.getByText(c.step(1, 3), { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: WHO_SELF }).click();
    await cont(page).click();
    await page.getByPlaceholder(c.namePlaceholder).fill('Sam');
    await cont(page).click();
    await page.getByRole('checkbox').click();
    await cont(page).click();
    await answerForkNew(page);
    const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
    expect(profiles?.map((p) => p.id)).toEqual([guest!.id]);
    expect(await readStored(page, 'guest')).toBeNull();
  });

  test('offline: the save works on the device and the learner registers when the network returns (F-SYNC-002)', async ({ page, context }) => {
    const calls = await mockApi(context);
    await playToResults(page);
    const guest = await readStored<{ id: string }>(page, 'guest');
    await context.setOffline(true);
    await keep(page).click();
    await nameStep(page, 'Sam');
    await page.getByRole('radio', { name: WHO_SELF }).click();
    await page.getByRole('checkbox').click();
    await cont(page).click();
    await expect(page.getByTestId('home-guest-saved')).toBeVisible();
    expect(calls.filter((call) => call.path === '/api/sync/learners')).toEqual([]);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => calls.filter((call) => call.method === 'POST' && call.path === '/api/sync/learners').length, { timeout: 20_000 }).toBe(1);
    expect((calls.find((call) => call.path === '/api/sync/learners')!.body!.learner as { id: string }).id).toBe(guest!.id);
  });
});
