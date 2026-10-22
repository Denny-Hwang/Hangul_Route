import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { createGateIn, onboardSelf, passDiscover, playCheckByIds, readStored, seedStored, WHO_CHILD } from './helpers';
import { shot } from './shots';
import { heritageCardsAll } from '../../src/content/heritage-cards';
import { questsAll } from '../../src/content/quests';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON row GU-5 (sections 6.1, 9.1, 9.2, 10, 14 and 19): the chooser's guest tiles and
 * People on this device's first-quest row, on the learner export. The chooser is on by default since OA-10 and the
 * guest switch since GU-7, so this runs on the release build (`build:web`) in every pull request's shards (any sync
 * call is answered by the mock below; the release build makes none). A bundle built with the guest kill switch off
 * skips it with `E2E_GUEST=0`.
 *
 * Covered: a device with 2 profiles, `/?try=1` opens the chooser with Try the first quest, and ㅏ shows in 3 taps (G1:
 * Start learning, the tile, Continue on Hoya's hello); nobody is selected (CS-G4); the tile's start closes the grown-up
 * session of the tab and tells the other tabs (CS-G3); a held class code shows no try tile (CS-G4); leaving the run
 * returns to the chooser, where the guest's own tile shows with no progress (CS-G5); both tiles wrap untruncated at
 * 320 px in two forced columns with text at Largest, in en, es and ko (section 14); on a one-profile device without a
 * PIN the guest's save is the owner's: the chooser's Grown-up area shows the guest-only gate line on PIN setup (the
 * same access the device gave before the guest existed; CS-G10's scope is the `Guest` stack, tested on purpose), the
 * owner sets a PIN and keeps the guest from People on this device, and the quest's card is in the new learner's
 * Library (G2); and Remove the first quest on that PIN setup opens the Grown-up area directly, as before the guest.
 */
test.skip(process.env.E2E_GUEST === '0', 'a build with the kill switch EXPO_PUBLIC_GUEST_LESSON=false (E2E_GUEST=0)');
test.use({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });

const en = getMessages('en');
const w = en.learner.who;
const people = en.caregiver.people;
const API = 'https://api.e2e.invalid';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE' };

const title = (page: Page) => page.getByRole('heading', { name: w.title, exact: true });
const tryTile = (page: Page) => page.getByRole('button', { name: en.a11y.who.try, exact: true });
const guestTile = (page: Page) => page.getByRole('button', { name: en.a11y.who.guest, exact: true });
const hello = (page: Page) => page.getByText('Hi from Hoya', { exact: true });
const letterA = (page: Page) => page.getByTestId('discover-item-jamo:a').getByText('ㅏ', { exact: true }).first();

/** The sync API, answered here: a learner registers, the inbox is empty; nothing reaches a real host. */
async function mockApi(context: BrowserContext): Promise<void> {
  const json = (route: Route, status: number, body: unknown): Promise<void> => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    if (req.method() === 'POST' && path === '/api/sync/learners') {
      const learner = ((JSON.parse(req.postData() ?? '{}') as { learner?: { id?: string } }).learner ?? {}) as { id?: string };
      return json(route, 201, { data: { learner: { id: learner.id }, device: { secret: 'secret-e2e' } } });
    }
    if (path.endsWith('/snapshot')) return json(route, 200, { data: { rev: 1 } });
    if (path.endsWith('/inbox')) return json(route, 200, { data: { rev: 1, plans: [], memberships: [], tier: 'free', serverTime: new Date().toISOString(), deviceScope: 'full' } });
    return json(route, 404, { error: { code: 'not_found' } });
  });
}

const child = (id: string, displayName: string, avatar = 'hoya-orange') => ({ id, displayName, ageGroup: '8-9', avatar, role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' });

/** A family device with two learners (Mina and Jun), stored before the app reads them. */
async function twoProfiles(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: en.learner.welcome.cta })).toBeVisible();
  await seedStored(page, 'profiles', [child('profile:mina0001', 'Mina'), child('profile:jun00001', 'Jun', 'hoya-blue')]);
  await seedStored(page, 'profiles:active', 'profile:mina0001');
  await expect(title(page)).toBeVisible();
}

/** The grown-up session of this tab (the unlock and the console session marks). */
const grownUpSession = (page: Page): Promise<(string | null)[]> => page.evaluate(() => [sessionStorage.getItem('hr:grownup:unlock'), sessionStorage.getItem('hr:console:session')]);
const openSession = (page: Page): Promise<void> =>
  page.evaluate(() => {
    sessionStorage.setItem('hr:grownup:unlock', '{"v":1}');
    sessionStorage.setItem('hr:console:session', '{"v":1}');
  });

/** Quest 1 to the guest's Results with every round right (3 stars, the card), from Hoya's hello. */
async function playQuestOne(page: Page): Promise<void> {
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await playCheckByIds(page, [{ answer: 'jamo:eo' }, { answer: '너' }]);
  await page.getByRole('button', { name: en.learner.quest.seeResults.cta, exact: true }).click();
  await expect(page.getByTestId('guest-save-card')).toBeVisible();
}

const questCardId = (questId: string): string | undefined => questsAll.find((q) => q.id === questId)?.rewardCardId;
const titleOf = (cardId: string): string => heritageCardsAll.find((card) => card.id === cardId)!.titleEn;

/**
 * Section 14's stress check (GU-0b D12): the two tiles of the last grid row forced into two columns of 138 px in a
 * 320 px window: every word of every label and line stays on one line (no word broken) and inside its tile (nothing
 * cut), and the tile stays at least `touchTarget.hero` (96) both ways.
 */
async function expectTilesWrap(page: Page, ids: readonly string[], where: string): Promise<void> {
  const problems = await page.evaluate((testIds) => {
    const out: string[] = [];
    for (const id of testIds) {
      const tile = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (tile === null) {
        out.push(`${id}: missing`);
        continue;
      }
      tile.style.width = '138px';
      tile.style.minWidth = '138px';
      tile.style.maxWidth = '138px';
    }
    for (const id of testIds) {
      const tile = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      const box = tile.getBoundingClientRect();
      if (box.width < 96 || box.height < 96) out.push(`${id}: ${Math.round(box.width)}x${Math.round(box.height)}`);
      const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        let at = 0;
        for (const word of text.split(' ')) {
          if (word !== '') {
            const range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, at + word.length);
            const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5);
            if (rects.length > 1) out.push(`${id}: "${word}" broken over ${rects.length} lines`);
            for (const r of rects) if (r.left < box.left - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1) out.push(`${id}: "${word}" outside the tile`);
          }
          at += word.length + 1;
        }
      }
    }
    return out;
  }, ids);
  expect(problems, where).toEqual([]);
}

test.describe('the chooser guest tiles (GU-5)', () => {
  test('G1: a device with 2 profiles, /?try=1 opens the chooser; Try the first quest; ㅏ in 3 taps; nobody selected (CS-G4)', async ({ page, context }) => {
    await mockApi(context);
    await twoProfiles(page);
    // Tap 1: the site's Start learning.
    await page.goto('/?try=1');
    await expect(title(page)).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await expect(tryTile(page)).toBeVisible();
    await expect(tryTile(page)).toContainText(w.try);
    await expect(tryTile(page)).toContainText(w.trySub);
    await expect(page.getByRole('button', { name: en.a11y.who.tile('Mina'), exact: true })).toBeVisible();
    await shot(page, 'who-guest-try-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-guest-try-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'who-guest-try-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // Tap 2: the tile. Tap 3: Continue on Hoya's hello. Discover page 1 shows ㅏ.
    await tryTile(page).click();
    await expect(hello(page)).toBeVisible();
    await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
    await expect(letterA(page)).toBeVisible();
    const guest = await readStored<{ id: string; via: string }>(page, 'guest');
    expect(guest).toMatchObject({ via: 'chooser' });
    // Nobody was selected or created: the active learner and the list are as they were.
    expect(await readStored(page, 'profiles:active')).toBe('profile:mina0001');
    expect((await readStored<Array<{ id: string }>>(page, 'profiles'))!.map((p) => p.id)).toEqual(['profile:mina0001', 'profile:jun00001']);
  });

  test('CS-G3: the tile\'s start closes the grown-up session of the tab and tells the other tabs', async ({ page, context }) => {
    await mockApi(context);
    await twoProfiles(page);
    await page.goto('/?try=1');
    await expect(tryTile(page)).toBeVisible();
    const other = await context.newPage();
    await other.goto('/');
    await other.evaluate(() => {
      const heard: unknown[] = [];
      (window as Window & { __heard?: unknown[] }).__heard = heard;
      new BroadcastChannel('hr-grownup').onmessage = (event) => heard.push(event.data);
    });
    // A grown-up session opens in this tab while the chooser shows (arrival already closed the one before).
    await openSession(page);
    await tryTile(page).click();
    await expect(hello(page)).toBeVisible();
    expect(await grownUpSession(page)).toEqual([null, null]);
    await expect.poll(() => other.evaluate(() => (window as Window & { __heard?: unknown[] }).__heard ?? [])).toContainEqual({ v: 1, kind: 'lock' });
  });

  test('CS-G4: a held class code shows no try tile (joining needs a profile)', async ({ page, context }) => {
    await mockApi(context);
    await twoProfiles(page);
    await page.goto('/join?try=1#c=abc234');
    await expect(title(page)).toBeVisible();
    await expect(page.getByTestId('who-join-caption')).toBeVisible();
    await expect(tryTile(page)).toHaveCount(0);
    await expect(guestTile(page)).toHaveCount(0);
    await shot(page, 'who-guest-join-360');
  });

  test('leaving the run returns to the chooser, where the guest\'s own tile shows with no progress (CS-G5); a tap resumes it', async ({ page, context }) => {
    await mockApi(context);
    await twoProfiles(page);
    await page.goto('/?try=1');
    await tryTile(page).click();
    await playQuestOne(page);
    await page.getByRole('button', { name: en.learner.guest.results.notNow, exact: true }).click();
    await page.getByTestId('guest-later-close').click();
    await expect(title(page)).toBeVisible();
    await expect(guestTile(page)).toBeVisible();
    await expect(guestTile(page)).toContainText(w.guest);
    await expect(guestTile(page)).toContainText(w.guestCaption);
    await expect(tryTile(page)).toHaveCount(0);
    // No stars, cards, level, streak or time on it.
    await expect(guestTile(page)).not.toContainText(/star|card|level|streak|day|min|\d/i);
    await shot(page, 'who-guest-tile-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-guest-tile-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'who-guest-tile-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // The tile resumes the run: quest 1 is done, so the Not now card.
    await guestTile(page).click();
    await expect(page.getByTestId('guest-later')).toBeVisible();
    expect(await readStored(page, 'profiles:active')).toBe('profile:mina0001');
  });

  for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
    test(`section 14: both tiles wrap untruncated at 320 px, two columns, text at Largest (${locale})`, async ({ page, context }) => {
      await mockApi(context);
      await twoProfiles(page);
      await seedStored(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-22T09:00:00.000Z', textSize: 'largest' });
      await page.setViewportSize({ width: 320, height: 640 });
      const m = getMessages(locale);
      await page.goto('/?try=1');
      const tile = page.getByRole('button', { name: m.a11y.who.try, exact: true });
      await expect(tile).toBeVisible();
      await expect(tile).toContainText(m.learner.who.trySub);
      await expectTilesWrap(page, ['who-add', 'who-try'], `${locale} try`);
      await shot(page, `who-guest-try-largest-320-${locale}`);
      // The guest's own tile: a live record kept on this device.
      const now = new Date().toISOString();
      await seedStored(page, 'guest', { v: 1, id: 'profile:guest001', startedAt: now, lastAt: now, via: 'chooser', questDone: true });
      const own = page.getByRole('button', { name: m.a11y.who.guest, exact: true });
      await expect(own).toBeVisible();
      await expect(own).toContainText(m.learner.who.guestCaption);
      await expectTilesWrap(page, ['who-add', 'who-guest'], `${locale} guest`);
      await shot(page, `who-guest-tile-largest-320-${locale}`);
    });
  }
});

test.describe('the owner keeps or removes the first quest (GU-5)', () => {
  /** A one-profile device with no PIN ("Me"), where a visitor played quest 1 from the site and left it unsaved. */
  async function visitorPlayed(page: Page): Promise<void> {
    await onboardSelf(page, { name: 'Ana' });
    expect(await readStored(page, 'account:parentPinHash')).toBeNull();
    // One profile counts (OQ-G9): the site's Start learning opens the chooser with the try tile.
    await page.goto('/?try=1');
    await expect(tryTile(page)).toBeVisible();
    await tryTile(page).click();
    await expect(hello(page)).toBeVisible();
    await playQuestOne(page);
    // The owner case: only the ask-the-owner line and Not now; no PIN pad (CS-G10).
    await expect(page.getByTestId('guest-save-heading')).toHaveText(en.learner.guest.results.askOwner);
    await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: en.learner.guest.results.notNow, exact: true }).click();
    await page.getByTestId('guest-later-close').click();
    await expect(guestTile(page)).toBeVisible();
    expect(await readStored(page, 'account:parentPinHash')).toBeNull();
  }

  /** The chooser's Grown-up area on this device: PIN setup with the guest-only gate line (the guest is the only reason). */
  async function grownUpAreaFromChooser(page: Page): Promise<void> {
    await page.getByTestId('who-row-area').click();
    await expect(page.getByText(en.caregiver.audience.self.pinCreateSubtitle).or(page.getByText('Enter it once more')).first()).toBeVisible();
    await expect(page.getByTestId('pin-guest-only')).toContainText(people.guestOnlyGate);
  }

  test('G2: one profile, no PIN: the guest-only gate line on PIN setup; the owner sets a PIN, keeps the guest from People on this device; the card is in the new learner\'s Library', async ({ page, context }) => {
    await mockApi(context);
    await visitorPlayed(page);
    const guest = (await readStored<{ id: string }>(page, 'guest'))!;
    // A visitor who left the run taps the chooser's Grown-up area: the same access the device gave before the guest
    // existed, with the line that says why a PIN is asked now (CS-G10's scope is the Guest stack).
    await grownUpAreaFromChooser(page);
    await shot(page, 'who-guest-only-gate-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-guest-only-gate-320');
    await page.setViewportSize({ width: 360, height: 740 });
    // The owner sets a PIN, so the Grown-up area opens.
    await createGateIn(page);
    await expect(page.getByTestId('people-on-device')).toBeVisible();
    const row = page.getByTestId('people-guest');
    await expect(row).toContainText(people.guestRow);
    await shot(page, 'people-guest-row-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'people-guest-row-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'people-guest-row-1280');
    await page.setViewportSize({ width: 360, height: 740 });
    // Keep as a learner: the two save steps inside this grown-up session.
    await page.getByTestId('people-guest-keep').click();
    await expect(page.getByRole('heading', { name: en.learner.createProfile.guest.title })).toBeVisible();
    await page.getByPlaceholder(en.learner.createProfile.namePlaceholder).fill('Sam');
    await page.getByRole('button', { name: en.learner.createProfile.cta, exact: true }).click();
    await page.getByRole('radio', { name: WHO_CHILD }).click();
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: en.learner.createProfile.cta, exact: true }).click();
    // Back in the Grown-up area: Sam is a learner on this device with the guest's id; the row is gone.
    await expect(page.getByTestId(`people-row-${guest.id}`)).toBeVisible();
    await expect(page.getByTestId('people-guest')).toHaveCount(0);
    expect(await readStored(page, 'guest')).toBeNull();
    const profiles = (await readStored<Array<{ id: string; displayName: string }>>(page, 'profiles'))!;
    expect(profiles.map((p) => p.displayName)).toEqual(['Ana', 'Sam']);
    // G2: the quest's card is in Sam's Library.
    const progress = (await readStored<{ quests: Array<{ questId: string }>; cards: Array<{ cardId: string }> }>(page, `progress:${guest.id}`))!;
    const cardId = progress.cards.map((c) => c.cardId).find((id) => id === questCardId(progress.quests[0]!.questId))!;
    expect(cardId).toBeDefined();
    await page.getByTestId('dashboard-switch-user').click();
    await page.getByRole('button', { name: en.a11y.who.tile('Sam'), exact: true }).click();
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await page.getByRole('tablist').getByRole('link', { name: 'Library', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    const cardsTab = page.getByRole('tab', { name: 'Cards', exact: true });
    if ((await cardsTab.count()) > 0) await cardsTab.click();
    await expect(page.getByRole('button', { name: new RegExp(`^${titleOf(cardId)}`) }).first()).toBeVisible();
  });

  test('Remove the first quest on that PIN setup: the ConfirmSheet, the sweep, then the Grown-up area directly, as before the guest', async ({ page, context }) => {
    await mockApi(context);
    await visitorPlayed(page);
    const guest = (await readStored<{ id: string }>(page, 'guest'))!;
    await grownUpAreaFromChooser(page);
    await page.getByTestId('pin-guest-remove').click();
    await expect(page.getByText(people.guestConfirm)).toBeVisible();
    await shot(page, 'who-guest-only-remove-sheet-320');
    await page.getByTestId('pin-guest-sheet-confirm').click();
    await expect(page.getByTestId('people-on-device')).toBeVisible();
    await expect(page.getByTestId('people-guest')).toHaveCount(0);
    expect(await readStored(page, 'guest')).toBeNull();
    expect(await readStored(page, `progress:${guest.id}`)).toBeNull();
    expect(await readStored(page, 'account:parentPinHash')).toBeNull();
  });
});
