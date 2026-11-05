import type { Locator, Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, passDiscover, playCheckByIds, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectTextFits, closeInstallGuide } from './text-fit';

/**
 * Owner request OW-3 (2026-11-04): after the first Holidays quest (Bow & Eat Tteokguk) at one star the reward step said
 * "A Lunar New Year card joins your library!", but the Library did not hold it. The model (F-STORY-006 §3.1,
 * F-MOTION-003 §3.5): a quest's own card is earned at 2 stars, and the episode brings it too once every quest is
 * finished. The reward step, Results, Home's card count and the Library now agree:
 *
 * - one star (one of the Check's two rounds missed): the reward step and Results say the card is waiting and how to
 *   get it, the learner still holds three cards (the report: Hanji, Book, Tiger), Home counts 3, the Library lists the
 *   card under Cards to find with its hint;
 * - a replay with both rounds right (3 stars): the card is celebrated, held, Home counts 4 and the Library lists it.
 *
 * Release bundle only: the Library of the fixture bundle differs. Run at 320 px, at the Largest text size and wide.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1' || process.env.STORY_FIXTURES_GATED === '1';
const T = '2026-10-01T09:05:00.000Z';
const QUEST = 'quest:stage1-rites-q1';
const WAITING = 'The Lunar New Year card is waiting';
const HINT = 'Get 2 stars in this quest to earn the Lunar New Year card.';
const EPISODE_LINE = 'You also get it when you finish every quest in New Year & Festivals.';

/** The book and the hanji (Meet the Letters quests 1 and 2) at 2 stars, with their cards and the welcome tiger. */
const reported = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: T,
  episodes: [],
  quests: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2'].map((questId) => ({
    questId,
    episodeId: 'episode:stage1-letters',
    startedAt: T,
    completedAt: T,
    stars: 2 as const,
    attempts: 1,
    accuracy: 0.8,
  })),
  cards: ['card:tiger', 'card:book', 'card:hanji'].map((cardId) => ({ cardId, unlockedAt: T, newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

const shown = (page: Page, testId: string): Locator => page.getByTestId(testId).filter({ visible: true });

async function storedCardIds(page: Page, profileId: string): Promise<string[]> {
  return ((await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.cards ?? []).map((c) => c.cardId).sort();
}

/** The learner of the report on Home: the book and the hanji held, 3 cards with the tiger. */
async function reportedLearner(page: Page, settings?: { uiLocale: 'en'; textSize: 'largest' }): Promise<string> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, `progress:${profileId}`, reported(profileId));
  if (settings) await seedStored(page, 'device:settings', { ...settings, uiLocaleAt: '2026-10-16T09:00:00.000Z' });
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await closeInstallGuide(page);
  return profileId;
}

/** Bow & Eat Tteokguk from the Journey to its reward step; `miss` takes a wrong answer first in round 1 (a 1-star run). */
async function playToRewardStep(page: Page, first: boolean, miss: boolean): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays') }).click();
  const row = shown(page, `episode-quest-${QUEST}`);
  await row.getByRole('button', { name: first ? 'Start' : 'Play again', exact: true }).click();
  // Bow & Eat Tteokguk builds on Picnic Snacks, which the learner of the report had not played: the soft prerequisite
  // sheet offers Start there or Play anyway (F-QUEST-002 §3.5), and the report's learner played on.
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  const next = page.getByRole('button', { name: 'Continue' });
  await anyway.or(next).first().waitFor();
  if (await anyway.isVisible()) await anyway.click();
  await next.click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [miss ? { answer: '달', missWith: '다' } : { answer: '달' }, { answer: '설날' }]);
}

async function openLibraryCards(page: Page): Promise<void> {
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  const cards = page.getByRole('tab', { name: 'Cards', exact: true });
  if ((await cards.count()) > 0) await cards.click();
}

async function goHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Today with Hoya')).toBeVisible();
  await closeInstallGuide(page);
}

async function journey(page: Page, where: string): Promise<void> {
  const profileId = await reportedLearner(page);
  await expect(page.getByText('3 cards', { exact: true }).first()).toBeVisible();

  // The first run: one wrong answer in round 1 of the Check, so one star.
  await playToRewardStep(page, true, true);
  await expect(page.getByRole('heading', { name: WAITING })).toBeVisible();
  await expect(page.getByText(`${HINT} ${EPISODE_LINE}`)).toBeVisible();
  await expect(page.getByText('joins your library')).toHaveCount(0);
  await expectTextFits(page, `${where}: the reward step at one star`);
  await shot(page, `card-award-quest-reward-one-star-${where}`);

  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('You tried!')).toBeVisible();
  await expect(page.getByText('New card for your library!')).toHaveCount(0);
  const note = shown(page, 'results-hoya');
  await expect(note).toContainText(HINT);
  await expect(note).toContainText(EPISODE_LINE);
  await expect(note).not.toContainText(/fail|wrong|lost/i);
  await note.scrollIntoViewIfNeeded();
  await expectTextFits(page, `${where}: Results at one star`);
  await shot(page, `card-award-quest-results-one-star-${where}`);
  await expect.poll(() => storedCardIds(page, profileId)).toEqual(['card:book', 'card:hanji', 'card:tiger']);

  // Home and the Library agree: three cards, and the Lunar New Year card is still to find, with how to get it.
  await goHome(page);
  await expect(page.getByText('3 cards', { exact: true }).first()).toBeVisible();
  await openLibraryCards(page);
  await expect(page.getByText('3 cards collected')).toBeVisible();
  // The Lunar New Year card is still to find, under its episode, with how the episode brings it; the explainer says
  // the quest path (2 stars).
  const row = page.getByRole('button', { name: 'New Year & Festivals: cards to find' });
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Locked card. Finish the episode: New Year & Festivals' }).first()).toBeVisible();
  await expect(page.getByText('Get 2 stars in a quest to earn its card.', { exact: true })).toBeVisible();
  await expectTextFits(page, `${where}: the Library at 3 cards`);
  await shot(page, `card-award-quest-library-3-${where}`);

  // The replay with both rounds right: three stars, the card is celebrated, saved once, counted and listed.
  await playToRewardStep(page, false, false);
  await expect(page.getByText('A Lunar New Year card joins your library!')).toBeVisible();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('New card for your library!')).toBeVisible();
  await expect(shown(page, 'results-hoya')).not.toContainText(HINT);
  await shot(page, `card-award-quest-results-three-stars-${where}`);
  await expect.poll(() => storedCardIds(page, profileId)).toEqual(['card:book', 'card:hanji', 'card:seollal', 'card:tiger']);

  await goHome(page);
  await expect(page.getByText('4 cards', { exact: true }).first()).toBeVisible();
  await openLibraryCards(page);
  await expect(page.getByText('4 cards collected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lunar New Year. New', exact: true })).toBeVisible();
  await expectTextFits(page, `${where}: the Library at 4 cards`);
  await shot(page, `card-award-quest-library-4-${where}`);

  // A later replay at one star takes nothing away, and nothing is waiting any more.
  await playToRewardStep(page, false, true);
  await expect(page.getByRole('heading', { name: WAITING })).toHaveCount(0);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(shown(page, 'results-hoya')).not.toContainText(HINT);
  await expect.poll(() => storedCardIds(page, profileId)).toEqual(['card:book', 'card:hanji', 'card:seollal', 'card:tiger']);
}

test.describe('the quest card is earned at 2 stars and every surface says so (OW-3, release bundle)', () => {
  test.skip(FIXTURE_BUILD, 'the release content: run on the release build');
  test.use({ timezoneId: 'UTC' });

  test('320 px: one star keeps three cards and says how to get the fourth; a three-star replay brings it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 568 });
    await journey(page, '320');
    expect(errors).toEqual([]);
  });

  test('wide window: the same sequence', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 1280, height: 800 });
    await journey(page, 'wide');
    expect(errors).toEqual([]);
  });

  test('320 px at the Largest text size: the reward step and Results notes wrap and fit', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await reportedLearner(page, { uiLocale: 'en', textSize: 'largest' });
    await playToRewardStep(page, true, true);
    await expect(page.getByRole('heading', { name: WAITING })).toBeVisible();
    await expectTextFits(page, 'the reward step at Largest');
    await shot(page, 'card-award-quest-reward-one-star-largest-320');
    await page.getByRole('button', { name: 'See results' }).click();
    const note = shown(page, 'results-hoya');
    await note.scrollIntoViewIfNeeded();
    await expect(note).toContainText(HINT);
    await expectTextFits(page, 'Results at Largest');
    await shot(page, 'card-award-quest-results-one-star-largest-320');
  });
});
