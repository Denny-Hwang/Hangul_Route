import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { withoutWebAddresses, type ProgressSnapshot, type Story } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { awardWorld } from '../../src/content/award-world';
import { episodesAll } from '../../src/content/episodes';
import { heritageCardsAll } from '../../src/content/heritage-cards';
import { questsAll } from '../../src/content/quests';
import { missingAwards } from '../../src/logic/awards/derive';
import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, passDiscover, playCheckByIds, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-STORY-006 PR 6.9: the card award model end to end, on the release bundle (§5 test table, the
 * `card-awards.spec.ts` line). Three journeys:
 *
 * 1. Catch-up (§3.5, §3.11 rows 1-2): a learner whose saved record has every shipped Stage 1 grid
 *    quest at two stars, with each quest card, opens the app. The reconcile adds the cards the rules
 *    owe (episode, stage and welcome cards); Home shows one catch-up card whose number is exactly that
 *    batch; the Library lists every caught-up card with "New"; a second launch adds nothing, shows no
 *    catch-up and holds one entry per card.
 * 2. The last quest of an episode (§3.3, §3.11 row 3): finishing Hanbok and the Bow at one star, after
 *    the episode's first two quests at two stars, brings the episode's three remaining cards, the
 *    quest's own card included, as extras (no quest-card banner at one star); a replay brings nothing.
 * 3. A story's listen card (§3.8): finishing the listen quest of a reviewed shelf story earns
 *    `card:story-<slug>`, which opens on its card page with the verbatim fact and its source.
 *
 * The expected cards come from the shipped content and the award engine, so content PRs that add
 * quests or cards move the numbers without editing this file. The fixture bundle strips the content
 * stories' cards (`build-stories.mjs` offShelfStory), so this suite runs on the release build only.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1' || process.env.STORY_FIXTURES_GATED === '1';
const T = '2026-10-01T09:05:00.000Z';
const LINE = /Hoya found (\d+) cards you already earned!/;
const EMOJI = /\p{Extended_Pictographic}/u;
const FRACTION = /\d+\s*(\/|of)\s*\d+|%/;

const titleOf = (cardId: string): string => {
  const card = heritageCardsAll.find((c) => c.id === cardId);
  if (!card) throw new Error(`${cardId} is not in the catalogue`);
  return card.titleEn;
};

/** Every shipped Stage 1 grid quest with its episode and quest card (F-STORY-006 §3.11 row 1). */
const STAGE1 = episodesAll
  .filter((e) => e.stage === 'stage1' && e.status === 'shipped' && (e.placement ?? 'grid') === 'grid')
  .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id })))
  .map(({ questId, episodeId }) => {
    const rewardCardId = questsAll.find((q) => q.id === questId)?.rewardCardId;
    if (!rewardCardId) throw new Error(`${questId} has no quest card`);
    return { questId, episodeId, rewardCardId };
  });

/** A saved record: the given quests complete at `stars`, holding `cards` already seen. */
const record = (
  profileId: string,
  quests: readonly { questId: string; episodeId: string }[],
  stars: ProgressSnapshot['quests'][number]['stars'],
  cards: readonly string[],
): ProgressSnapshot => ({
  profileId,
  updatedAt: T,
  episodes: [],
  quests: quests.map(({ questId, episodeId }) => ({ questId, episodeId, startedAt: T, completedAt: T, stars, attempts: 1, accuracy: 1 })),
  cards: cards.map((cardId) => ({ cardId, unlockedAt: T, newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

const tab = (page: Page, name: string): Locator => page.getByRole('tablist').getByRole('link', { name, exact: true });
const catchUp = (page: Page): Locator => page.getByTestId('home-catch-up');
const shown = (page: Page, testId: string): Locator => page.getByTestId(testId).filter({ visible: true });

async function storedCards(page: Page, profileId: string): Promise<ProgressSnapshot['cards']> {
  return (await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.cards ?? [];
}

/** The install guide shows from the third cached open and covers Home. */
async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/** A learner Dani on Home; with `snapshot`, that record is saved under their id and the app opened again. */
async function learnerAtHome(page: Page, snapshot?: (profileId: string) => ProgressSnapshot): Promise<string> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  expect(profileId).toBeTruthy();
  if (snapshot) {
    await seedStored(page, `progress:${profileId}`, snapshot(profileId));
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
  }
  await closeInstallGuide(page);
  return profileId;
}

async function openLibraryCards(page: Page): Promise<void> {
  await tab(page, 'Library').click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  const cards = page.getByRole('tab', { name: 'Cards', exact: true });
  if ((await cards.count()) > 0) await cards.click();
}

/** A Library tile by its card title; "New" is in the accessible name while the card is unseen. */
const libraryTile = (page: Page, cardId: string, isNew: boolean): Locator =>
  page.getByRole('button', { name: isNew ? `${titleOf(cardId)}. New` : titleOf(cardId), exact: true });

test.describe('card awards (F-STORY-006 6.9, release bundle)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture bundle strips the content stories’ cards: run on the release build');

  test('catch-up: the first launch adds the owed cards once, the Library marks them New, a second launch adds nothing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    expect(STAGE1.length).toBeGreaterThan(0);
    const questCards = STAGE1.map((q) => q.rewardCardId);
    const seed = (profileId: string): ProgressSnapshot => record(profileId, STAGE1, 2, questCards);

    const profileId = await learnerAtHome(page, seed);
    // What the rules owe this record: every other card of the Stage 1 grid episodes, the legendary
    // stage cards and the welcome tiger (§3.11 row 1), worked out by the engine from the shipped content.
    const owed = missingAwards(awardWorld, seed(profileId), { createdAt: T }).map((a) => a.cardId);
    expect(owed.length).toBeGreaterThan(1);
    expect(owed.some((id) => questCards.includes(id))).toBe(false);

    // Home: one catch-up card, its number is the whole batch, and nothing counts what is left (D3).
    const card = catchUp(page);
    await expect(card).toBeVisible();
    const line = card.getByText(LINE);
    await expect(line).toBeVisible();
    expect(Number((await line.innerText()).match(LINE)?.[1])).toBe(owed.length);
    expect(await card.innerText()).not.toMatch(FRACTION);
    await expect(card.getByRole('button', { name: 'See my cards' })).toBeVisible();

    // Saved once: the quest cards as they were, and every owed card new.
    await expect.poll(async () => (await storedCards(page, profileId)).length).toBe(questCards.length + owed.length);
    const saved = await storedCards(page, profileId);
    expect(saved.filter((c) => c.newSinceLastView).map((c) => c.cardId).sort()).toEqual([...owed].sort());

    // The Library (through its tab, so nothing is marked seen): every caught-up card wears "New",
    // the quest cards held before do not.
    await openLibraryCards(page);
    for (const id of owed) await expect(libraryTile(page, id, true), id).toHaveCount(1);
    for (const id of questCards) {
      await expect(libraryTile(page, id, false), id).toHaveCount(1);
      await expect(libraryTile(page, id, true), id).toHaveCount(0);
    }
    const firstNew = libraryTile(page, owed[0] as string, true);
    await firstNew.scrollIntoViewIfNeeded();
    await expect(firstNew.getByText('New', { exact: true })).toBeVisible();
    await shot(page, 'card-awards-library-new');

    // A second launch: no catch-up card, nothing added, one entry per card, still New (never opened).
    await page.goto('/');
    await expect(page.getByText('Today with Hoya')).toBeVisible();
    await closeInstallGuide(page);
    await expect(catchUp(page)).toHaveCount(0);
    const again = await storedCards(page, profileId);
    expect(again).toHaveLength(questCards.length + owed.length);
    expect(new Set(again.map((c) => c.cardId)).size).toBe(again.length);
    expect(again.filter((c) => c.newSinceLastView).map((c) => c.cardId).sort()).toEqual([...owed].sort());
    await openLibraryCards(page);
    for (const id of owed) await expect(libraryTile(page, id, true), id).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('the last quest of an episode at one star brings every remaining episode card, its own included; a replay brings none', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const rites = episodesAll.find((e) => e.id === 'episode:stage1-rites');
    if (!rites) throw new Error('episode:stage1-rites is not shipped');
    const [q1, q2, q3] = rites.questIds;
    expect(q3).toBe('quest:stage1-rites-q3');
    const before = [q1, q2].map((questId) => ({ questId: questId as string, episodeId: rites.id }));
    const held = before.map(({ questId }) => questsAll.find((q) => q.id === questId)?.rewardCardId as string);
    const ownCard = questsAll.find((q) => q.id === q3)?.rewardCardId as string;
    // The episode's cards not yet held: the last quest's own card and the episode-only cards.
    const extras = rites.rewardCardIds.filter((id) => !held.includes(id));
    expect(extras).toContain(ownCard);

    const profileId = await learnerAtHome(page, (id) => record(id, before, 2, held));
    await expect(catchUp(page)).toHaveCount(0);

    // Hanbok and the Bow, with a first-try miss in round 2: one of two counts, a 1-star run.
    await playRitesLastQuest(page, q3 as string, true);
    await expect(page.getByText('New card for your library!')).toHaveCount(0);
    const banner = page.getByTestId('extra-cards-banner');
    const joined = extras.length === 1 ? '1 more card joined your Library!' : `${extras.length} more cards joined your Library!`;
    await expect(banner.getByText(joined, { exact: true })).toBeVisible();
    await expect(banner.getByText('You finished New Year & Festivals!', { exact: true })).toBeVisible();
    for (const id of extras) await expect(banner.getByRole('button', { name: `Open card: ${titleOf(id)}` }), id).toBeVisible();
    for (const id of held) await expect(banner.getByRole('button', { name: `Open card: ${titleOf(id)}` }), id).toHaveCount(0);
    await expect(banner).not.toContainText(FRACTION);
    await banner.scrollIntoViewIfNeeded();
    await shot(page, 'card-awards-episode-extras');

    // Saved: the extras once each, new; the two cards held before untouched.
    await expect.poll(async () => (await storedCards(page, profileId)).map((c) => c.cardId).sort()).toEqual(
      expect.arrayContaining([...held, ...extras]),
    );
    const saved = await storedCards(page, profileId);
    for (const id of extras) expect(saved.find((c) => c.cardId === id)?.newSinceLastView, id).toBe(true);
    for (const id of held) expect(saved.find((c) => c.cardId === id)?.newSinceLastView, id).toBe(false);
    expect(new Set(saved.map((c) => c.cardId)).size).toBe(saved.length);

    // A live award is announced on Results, never again as a catch-up on Home.
    await page.goto('/');
    await expect(page.getByText('Today with Hoya')).toBeVisible();
    await closeInstallGuide(page);
    await expect(catchUp(page)).toHaveCount(0);

    // A replay brings nothing new and takes nothing away.
    await playRitesLastQuest(page, q3 as string, false);
    await expect(page.getByText('Wonderful!').or(page.getByText('Great!')).or(page.getByText('You tried!'))).toBeVisible();
    await expect(page.getByTestId('extra-cards-banner')).toHaveCount(0);
    await expect(page.getByText('New card for your library!')).toHaveCount(0);
    // Read the record after leaving Results and opening Home again, so a late write from the replay
    // (a card removed, duplicated or marked seen) has landed before the check.
    await page.goto('/');
    await expect(page.getByText('Today with Hoya')).toBeVisible();
    await closeInstallGuide(page);
    await expect(catchUp(page)).toHaveCount(0);
    const savedIds = saved.map((c) => c.cardId).sort();
    await expect.poll(async () => (await storedCards(page, profileId)).map((c) => c.cardId).sort()).toEqual(savedIds);
    const after = await storedCards(page, profileId);
    expect(new Set(after.map((c) => c.cardId)).size).toBe(after.length);
    for (const id of extras) expect(after.find((c) => c.cardId === id)?.newSinceLastView, id).toBe(true);
    for (const id of held) expect(after.find((c) => c.cardId === id)?.newSinceLastView, id).toBe(false);
    expect(errors).toEqual([]);
  });

  test("finishing a reviewed story's listen quest earns its story card, with the verbatim fact and its source", async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const story = readStory('seollal-new-year');
    const cardId = story.rewardCardIds?.listen;
    expect(cardId).toBe('card:story-seollal-new-year');
    const fact = story.facts.find((f) => f.id === story.card?.factId);
    if (!fact || !story.card) throw new Error(`${story.id} has no card fact`);
    const listen = story.tiers.find((t) => t.level === 'listen');
    if (!listen) throw new Error(`${story.id} has no listen tier`);

    const profileId = await learnerAtHome(page);
    expect((await storedCards(page, profileId)).map((c) => c.cardId)).not.toContain(cardId);

    // Library, Story Time, the story's episode page: its card waits there as a silhouette.
    await tab(page, 'Library').click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    await page.getByRole('tab', { name: 'Story Time', exact: true }).click();
    await shown(page, `story-tile-${story.id}`).click();
    await expect(shown(page, `story-episode-card-${cardId}`)).toHaveCount(1);
    await shown(page, `story-episode-start-${story.id}`).click();

    // The listen quest: intro, read (skipped), every check right, the word recap, the story in order.
    await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Read the story' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('heading', { name: 'A few questions' })).toBeVisible();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const check of listen.checks) {
      const right = check.options.find((o) => o.isCorrect);
      if (!right) throw new Error(`${check.id} has no right option`);
      await page.getByTestId(`story-check-option-${right.id}`).click();
      await page.getByTestId('story-check-next').click();
    }
    const sequence = page.getByRole('heading', { name: 'Put the story in order' });
    const recapDone = page.getByTestId('story-recap-done');
    await expect(sequence.or(recapDone)).toBeVisible();
    if (await recapDone.isVisible()) await recapDone.click();
    await expect(sequence).toBeVisible();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const sceneId of listen.sequenceSceneIds) await page.getByTestId(`story-sequence-card-${sceneId}`).click();
    await page.getByRole('button', { name: 'Skip replay' }).click();
    await page.getByRole('button', { name: 'See results' }).click();
    await expect(page.getByTestId('story-results-extras')).toBeVisible();

    // Results: three stars, the story card announced, saved once and new.
    await expect(page.getByText('Wonderful!')).toBeVisible();
    await expect(page.getByText('New card for your library!')).toBeVisible();
    await expect.poll(async () => (await storedCards(page, profileId)).filter((c) => c.cardId === cardId)).toEqual([
      expect.objectContaining({ cardId, newSinceLastView: true }),
    ]);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);
    await shot(page, 'card-awards-story-results');

    // Its card page: the card title and Korean word, the fact verbatim, the source line, no link.
    await page.getByRole('button', { name: /^See my card/ }).click();
    await expect(page.getByRole('button', { name: 'Tap to flip card to back' })).toBeVisible();
    await expect(page.getByText(story.card.titleEn, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(fact.claimEn, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    // The whole line, built from the fact's first source in CardDetail's format (web addresses dropped),
    // so a placeholder or another source after "Source: " fails.
    const [first] = fact.sources;
    if (!first) throw new Error(`${fact.id} has no source`);
    const citationLine = getMessages('en').learner.cardDetail.citation.source(withoutWebAddresses(first.publisher), withoutWebAddresses(first.title));
    expect(citationLine).not.toBe('Source: , ');
    await expect(shown(page, 'card-detail-citation')).toHaveText(citationLine, { useInnerText: true });
    const more = fact.sources.length - 1;
    if (more > 0) await expect(shown(page, 'card-detail-citation-more')).toHaveText(more === 1 ? 'and 1 more source' : `and ${more} more sources`);
    await expect(shown(page, 'card-detail-citation').getByRole('link')).toHaveCount(0);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/https?:\/\/|www\./i);
    expect(body).not.toMatch(EMOJI);
    await shot(page, 'card-awards-story-card');
    expect(errors).toEqual([]);
  });
});

/** A story file as shipped (the release bundle is generated from it). */
function readStory(slug: string): Story {
  return JSON.parse(readFileSync(join(__dirname, '../../../../content/stories', `${slug}.json`), 'utf8')) as Story;
}

/**
 * The last quest of New Year & Festivals (Hanbok and the Bow) from the Journey: Discover read, the
 * practice and the story order skipped, the Check played (the vowel yo, then the word hanbok).
 * The quest is found by its row on the episode page (`episode-quest-<id>`), not by position, so
 * adding or reordering quests in the episode does not send the spec into another quest.
 * `firstTime` starts it, otherwise it is played again; the first run takes a wrong card first in
 * round 2, so one of two counts.
 */
async function playRitesLastQuest(page: Page, questId: string, firstTime: boolean): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays') }).click();
  const row = shown(page, `episode-quest-${questId}`);
  await row.getByRole('button', { name: firstTime ? 'Start' : 'Play again', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: 'jamo:yo' }, firstTime ? { answer: '\uD55C\uBCF5', missWith: '\uD55C\uAD6D' } : { answer: '\uD55C\uBCF5' }]);
  await page.getByRole('button', { name: 'See results' }).click();
}
