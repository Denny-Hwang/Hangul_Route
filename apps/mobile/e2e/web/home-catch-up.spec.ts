import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 §3.5, PR 6.5c: the Home catch-up card. A learner who earned cards before the award
 * model existed is told once per app session, under the greeting, that Hoya found the cards; one
 * button opens the Library and marks those cards seen. No timer, no counter of what is left, and
 * a new learner (the welcome card alone) never sees it.
 */

const T = '2026-10-01T09:05:00.000Z';
const STAGE1_QUESTS: readonly (readonly [string, string])[] = [
  ['quest:stage1-letters-q1', 'episode:stage1-letters'],
  ['quest:stage1-letters-q2', 'episode:stage1-letters'],
  ['quest:stage1-letters-q3', 'episode:stage1-letters'],
  ['quest:stage1-life-q1', 'episode:stage1-life'],
  ['quest:stage1-life-q2', 'episode:stage1-life'],
  ['quest:stage1-life-q3', 'episode:stage1-life'],
  ['quest:stage1-rites-q1', 'episode:stage1-rites'],
  ['quest:stage1-nature-q1', 'episode:stage1-nature'],
  ['quest:stage1-crafts-q1', 'episode:stage1-crafts'],
];
const STAGE1_QUEST_CARDS = ['card:book', 'card:hanji', 'card:brush', 'card:kimchi', 'card:family-table', 'card:kimbap', 'card:seollal', 'card:magpie', 'card:yutnori'];
/** The line; the number is whatever the shipped Stage 1 content owes (21 with the nine quests below; 22 when §3.11 row 1 was written). */
const LINE = /Hoya found (\d+) cards you already earned!/;

/**
 * All nine shipped Stage 1 quests at two stars with their quest cards: the reconcile owes the other
 * cards (§3.11 row 1). F-QUEST-002 Q-6b added life q3 (quest card kimbap); the number is read off the
 * screen, so later content changes move it without breaking this spec.
 */
const stage1Done = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: T,
  episodes: [],
  quests: STAGE1_QUESTS.map(([questId, episodeId]) => ({ questId, episodeId, startedAt: T, completedAt: T, stars: 2, attempts: 1, accuracy: 1 })),
  cards: STAGE1_QUEST_CARDS.map((cardId) => ({ cardId, unlockedAt: T, newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

const tab = (page: Page, name: string) => page.getByRole('tablist').getByRole('link', { name, exact: true });
const catchUp = (page: Page) => page.getByTestId('home-catch-up');

/** The install guide shows from the third cached open and covers Home. */
async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/** A learner Dani, then the Stage 1 record saved under their id and the app opened again (a new session). */
async function seedStage1Learner(page: Page): Promise<string> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  expect(profileId).toBeTruthy();
  await seedStored(page, `progress:${profileId}`, stage1Done(profileId));
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  return profileId;
}

/** The number the visible line says, after checking it says one. */
async function foundOn(page: Page): Promise<number> {
  const line = catchUp(page).getByText(LINE);
  await expect(line).toBeVisible();
  const found = Number((await line.innerText()).match(LINE)?.[1] ?? 0);
  expect(found).toBeGreaterThan(1);
  return found;
}

const newCards = async (page: Page, profileId: string): Promise<string[]> =>
  ((await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.cards ?? []).filter((c) => c.newSinceLastView).map((c) => c.cardId);

test('a learner who earned cards before sees one catch-up card under the greeting, once', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const profileId = await seedStage1Learner(page);
  await closeInstallGuide(page);

  const card = catchUp(page);
  await expect(card).toBeVisible();
  const found = await foundOn(page);
  // The card's cheering Hoya stands in for the greeting's (wide layouts: see the wide test).
  await expect(card.getByLabel('Hoya the tiger, cheering', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Hoya the tiger, waving', { exact: true })).toHaveCount(0);
  // Under the greeting, above the mission cards, never between them.
  const cardBox = await card.boundingBox();
  const greetingBox = await page.getByText('Hi, Dani!').boundingBox();
  const missionsBox = await page.getByTestId('home-missions').boundingBox();
  expect(cardBox && greetingBox && missionsBox).toBeTruthy();
  if (cardBox && greetingBox && missionsBox) {
    expect(cardBox.y).toBeGreaterThan(greetingBox.y);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(missionsBox.y);
  }
  // Web reads the line from a polite live region when a sync adds the card later (native announces it, §3.10).
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: LINE })).toHaveCount(1);
  const button = card.getByRole('button', { name: 'See my cards' });
  const buttonBox = await button.boundingBox();
  expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(64);
  // A count of cards found, never a fraction or what is left (D3).
  const text = await card.innerText();
  expect(text).not.toMatch(/\d+\s*(\/|of)\s*\d+/);
  expect(text.toLowerCase()).not.toMatch(/\b(left|remaining|missing|missed)\b/);
  expect((await newCards(page, profileId)).length).toBe(found);
  await shot(page, 'home-catch-up');

  // See my cards: the Library, the caught-up cards marked seen, and the card goes for good.
  await button.click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  await expect.poll(() => newCards(page, profileId)).toEqual([]);
  await tab(page, 'Today').click();
  await expect(page.getByText('Today with Hoya')).toBeVisible();
  await expect(catchUp(page)).toHaveCount(0);
  await expect(page.getByLabel('Hoya the tiger, waving', { exact: true }).first()).toBeVisible();

  // The next session: nothing added, no card, no duplicates.
  await page.goto('/');
  await expect(page.getByText('Today with Hoya')).toBeVisible();
  await expect(catchUp(page)).toHaveCount(0);
  const cards = (await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.cards ?? [];
  expect(cards).toHaveLength(STAGE1_QUEST_CARDS.length + found);
  expect(new Set(cards.map((c) => c.cardId)).size).toBe(STAGE1_QUEST_CARDS.length + found);
  expect(errors).toEqual([]);
});

test('closing the app before See my cards: the card does not come back and the cards stay new', async ({ page }) => {
  const profileId = await seedStage1Learner(page);
  await closeInstallGuide(page);
  const found = await foundOn(page);

  await page.goto('/');
  await expect(page.getByText('Today with Hoya')).toBeVisible();
  await expect(catchUp(page)).toHaveCount(0);
  expect((await newCards(page, profileId)).length).toBe(found);
});

test('a new learner (the welcome card alone) sees no catch-up card', async ({ page }) => {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Today with Hoya')).toBeVisible();
  await expect(catchUp(page)).toHaveCount(0);
  await expect(page.getByLabel('Hoya the tiger, waving', { exact: true }).first()).toBeVisible();
});

/** The labels of every Hoya drawn inside the viewport, leaving out the learner's own cub on the Profile entry. */
const hoyasOnScreen = (page: Page): Promise<string[]> =>
  page.locator('[aria-label^="Hoya the tiger"]').evaluateAll((els) =>
    els
      .filter((el) => {
        if (el.closest('[aria-label="Profile and settings"]')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      })
      .map((el) => el.getAttribute('aria-label') ?? ''),
  );

/** True when the element's text is cut off (clipped or overflowing its box). */
const clipped = (page: Page): Promise<boolean> =>
  catchUp(page).getByText(LINE).evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);

test.describe('at 320 wide', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the catch-up card fits with no sideways scroll', async ({ page }) => {
    await seedStage1Learner(page);
    await closeInstallGuide(page);
    const card = catchUp(page);
    await foundOn(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await card.boundingBox();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= 320).toBe(true);
    expect(await clipped(page)).toBe(false);
    await shot(page, 'home-catch-up-320');
  });
});

test.describe('200 % zoom proxy of 1180x820 (590x410), reduced motion', () => {
  test.use({ viewport: { width: 590, height: 410 }, reducedMotion: 'reduce' });

  test('the whole line shows beside the static cheering Hoya, with no sideways scroll', async ({ page }) => {
    await seedStage1Learner(page);
    await closeInstallGuide(page);
    const card = catchUp(page);
    await foundOn(page);
    // The pose is fixed while the card shows: nothing for reduced motion to stop.
    await expect(card.getByLabel('Hoya the tiger, cheering', { exact: true })).toBeVisible();
    expect(await clipped(page)).toBe(false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await card.boundingBox();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= 590).toBe(true);
    const button = card.getByRole('button', { name: 'See my cards' });
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
  });
});

test.describe('on a wide window (1180x820)', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('the catch-up card spans the mission column, above the mission cards', async ({ page }) => {
    await seedStage1Learner(page);
    await closeInstallGuide(page);
    const column = page.getByTestId('home-missions-column');
    await expect(page.getByTestId('home-side-column')).toBeVisible();
    const card = column.getByTestId('home-catch-up');
    await foundOn(page);
    const cardBox = await card.boundingBox();
    const columnBox = await column.boundingBox();
    const missionsBox = await page.getByTestId('home-missions').boundingBox();
    expect(cardBox && columnBox && missionsBox).toBeTruthy();
    if (cardBox && columnBox && missionsBox) {
      expect(Math.round(cardBox.width)).toBe(Math.round(columnBox.width));
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(missionsBox.y);
    }
    // The card's cheering Hoya replaces the greeting's; it adds none. Besides it, only the side
    // column's tip bubble keeps its own Hoya, as Home always has (wireframe home/cards-catch-up.md).
    const onScreen = await hoyasOnScreen(page);
    expect(onScreen.filter((label) => label === 'Hoya the tiger, cheering')).toHaveLength(1);
    expect(onScreen).not.toContain('Hoya the tiger, waving');
    const tipHoyas = await page.getByTestId('home-side-column').locator('[aria-label^="Hoya the tiger"]').count();
    expect(onScreen).toHaveLength(1 + tipHoyas);
    await shot(page, 'home-catch-up-wide');
  });
});
