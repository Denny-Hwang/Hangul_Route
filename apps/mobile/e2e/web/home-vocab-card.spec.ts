import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, openGrownUpZone, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-VOC-005 P-3 (section 3.7, section 3.8; wireframe design/wireframes/vocab/flashcards.md G): the
 * Home "Words are ready" card in slot 3 and the parent dashboard Words row.
 *
 * Words stays behind `flags.vocabTopicsEnabled` (off until F-VOC-003 C-7). The fixture bundle offers
 * Words with the flag off (`wordsOffered`), so the card and the row run there:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test home-vocab-card
 *
 * On the release build (flag off) the same learner sees neither: Home and the dashboard are unchanged.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** A gift, not a guilt trip: no day count and no word about a delay or a miss (section 3.7). */
const GUILT = /\b(days?|overdue|missed|behind|forgot|wrong|fail\w*)\b/i;
const PAST = '2026-01-02';
const AT = '2026-01-02T10:00:00.000Z';
const DUE_FOOD = ['vocab:sagwa-apple', 'vocab:banana', 'vocab:uyu', 'vocab:ppang'] as const;

/** Four Food words, all due; two answered twice without a first-try right answer (words to look at together). */
const slice = {
  v: 1,
  items: DUE_FOOD.map((id, i) => ({
    id,
    first: '2026-01-01',
    seen: i < 2 ? 2 : 0,
    right: 0,
    bestBox: 1,
    last: PAST,
    box: 1,
    due: PAST,
    at: AT,
  })).sort((a, b) => (a.id < b.id ? -1 : 1)),
  topics: [{ topic: 'food', bestStars: 0, sessions: 1, last: PAST, bestCaught: 0 }],
};

async function learnerWithDueWords(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  const snapshot = (await readStored<Record<string, unknown>>(page, `progress:${id}`)) ?? {
    profileId: id,
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
  await seedStored(page, `progress:${id}`, { ...snapshot, vocab: slice, updatedAt: new Date().toISOString() });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  return id;
}

test.describe('Home "Words are ready" card and the dashboard Words row (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const vp of [
    { width: 375, height: 812 },
    { width: 320, height: 568 },
  ] as const) {
    test(`${vp.width}x${vp.height}: slot 3 names the due words and opens a Relaxed Speed Round of their topic`, async ({ page }) => {
      await page.setViewportSize(vp);
      await learnerWithDueWords(page);
      const missions = page.getByTestId('home-missions');
      const card = page.getByTestId('home-vocab-card');
      await expect(card).toBeVisible();
      await expect(card).toContainText('Words are ready');
      await expect(card).toContainText('4 words would like another look');
      // Slot 3: the last of the three mission cards.
      await expect(missions.locator(':scope > *')).toHaveCount(3);
      await expect(missions.locator(':scope > *').last()).toContainText('Words are ready');
      expect(await card.innerText()).not.toMatch(GUILT);
      const open = page.getByTestId('home-vocab-card-open');
      await expect(open).toHaveAccessibleName('Words are ready. 4 words would like another look. Opens a quick round.');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await card.scrollIntoViewIfNeeded();
      await shot(page, `voc5-p3-home-card-${vp.width}`);

      await open.click();
      await expect(page.getByTestId('vocab-speed-sheet')).toBeVisible();
      await expect(page.getByTestId('vocab-speed-topic')).toHaveText('Food');
    });
  }

  test('a finished Speed Round of its topic collects the card, which keeps its slot', async ({ page }) => {
    await learnerWithDueWords(page);
    await page.getByTestId('home-vocab-card-open').click();
    await expect(page.getByTestId('vocab-speed-sheet')).toBeVisible();
    await page.getByTestId('vocab-speed-start').click();
    const results = page.getByTestId('vocab-results');
    // Any answers will do: tap the options in turn until the round reaches its results.
    const options = page.locator('[data-testid^="vocab-question-option-"]');
    for (let i = 0; i < 120 && !(await results.isVisible()); i += 1) {
      const count = await options.count();
      if (count > 0) await options.nth(i % count).click({ timeout: 1000 }).catch(() => undefined);
      await page.waitForTimeout(150);
    }
    await expect(results).toBeVisible({ timeout: 5000 });
    // Back to Home inside the same app session (the day's pin and the round record live in memory):
    // Play again puts the start sheet in the results' place, right above Home, and its Go back pops it.
    await page.getByTestId('vocab-results-play-again').click();
    await expect(page.getByTestId('vocab-speed-sheet')).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).first().click();
    const card = page.getByTestId('home-vocab-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('home-missions').locator(':scope > *').last()).toContainText('Words are ready');
    await expect(page.getByTestId('home-vocab-card-open')).toHaveAccessibleName(
      'Words are ready. 4 words would like another look. Collected. Opens a quick round.',
    );
    expect(await card.innerText()).not.toMatch(GUILT);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'voc5-p3-home-card-collected');
  });

  test('the parent dashboard shows the Words row with the words to look at together', async ({ page }) => {
    const id = await learnerWithDueWords(page);
    await openGrownUpZone(page, 'Dami');
    await unlockWithPin(page);
    await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
    const row = page.getByTestId(`dashboard-words-${id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('4 collected, 0 strong');
    await expect(row).toContainText('First-try rate: 0%');
    await expect(row).toContainText('To look at together');
    await expect(row.getByTestId(`dashboard-words-${id}-word-vocab:sagwa-apple`)).toBeVisible();
    await expect(row.getByTestId(`dashboard-words-${id}-word-vocab:banana`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await row.scrollIntoViewIfNeeded();
    await shot(page, 'voc5-p3-dashboard-words');
  });
});

test.describe('Words off (release build)', () => {
  test.skip(FIXTURE_BUILD, 'the release build: Words is off');

  test('a learner with due words sees no vocabulary card, and the dashboard no Words row', async ({ page }) => {
    const id = await learnerWithDueWords(page);
    await expect(page.getByTestId('home-missions')).toBeVisible();
    // The seeded words survived the app's own hydration and write: the card is absent because Words
    // is off, not because no word was due.
    const stored = await readStored<{ vocab?: { items: Array<{ id: string; due: string }> } }>(page, `progress:${id}`);
    expect(stored?.vocab?.items.map((item) => item.id).sort()).toEqual([...DUE_FOOD].sort());
    expect(stored?.vocab?.items.every((item) => item.due <= PAST)).toBe(true);
    await expect(page.getByTestId('home-vocab-card')).toHaveCount(0);
    await expect(page.getByText('Words are ready')).toHaveCount(0);
    await openGrownUpZone(page, 'Dami');
    await unlockWithPin(page);
    await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
    await expect(page.getByTestId(`dashboard-words-${id}`)).toHaveCount(0);
  });
});
