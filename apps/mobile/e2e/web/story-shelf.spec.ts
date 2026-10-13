import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { nextPage, position } from './story-reader-helpers';

/**
 * F-STORY-004 PR 4.8: the story shelf end to end, through the learner's own
 * entry points (no `openQuest` hook): the Home story card, continue where you
 * left off, Results, the Library sections (Story Time, Culture and their
 * tiles), the story variant of the episode page and Culture notes. Needs the
 * fixture bundle, whose main reviewed shelf story is `story:hangul-day`
 * (Story Time, order 1, the sampler; one culture note). Its second one,
 * `story:cell-stories-fixture` ("The Hangul Book", Culture, home cell Stage 2
 * Letters), is there for journey-stories.spec.ts (F-STORY-005 PR 5.5b); here it
 * is only the Home plan's second story and the Culture section's one tile:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-shelf
 *
 * Its shelf quest `quest:story-hangul-day-listen` is intro, read, check,
 * sequence, reward; the listen tier has five scenes. The window's
 * `__hrStoryE2E.events()` is read only to check the `story.*` and `culture.*`
 * telemetry the surfaces send. A build with no reviewed story is
 * library-cards-only.spec.ts.
 *
 * Content gating: this suite checks the launch default (gating off: nothing is
 * locked and no "Premium" text). This bundle is built with gating off, so it
 * never draws a locked tile, not even for its non-sampler shelf story
 * (`story:cell-stories-fixture`). The gated half of the row (a locked tile sends
 * `story.locked.tapped` and lands on PIN entry or the paywall) is
 * story-shelf-gated.spec.ts (F-STORY-004 PR 4.8b), on the gating fixture
 * bundle (build:web:fixtures:gated, STORY_FIXTURES_GATED=1); the gate's rules
 * (`lockedStoryGate`, `storyTileView`) are also covered by
 * logic/story/__tests__/story-tile.test.ts.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';
const QUEST = 'quest:story-hangul-day-listen';
const NOTE = 'cn-hangul-day';
/** The listen tier's reward card (`rewardCardIds.listen` of the fixture): its own story card (F-STORY-006 6.7). */
const REWARD_CARD = 'card:story-hangul-day';
const REWARD_TITLE = 'King Sejong';
const REWARD_KO = '세종';
/** The story's Hoya line (`hoyaIntroEn`), shown on its episode page. */
const HOYA_INTRO = 'Want to hear how the Korean alphabet began?';
const EMOJI = /\p{Extended_Pictographic}/u;
/**
 * No gating copy on a story surface with the flag off (D5); "Not open yet" is F-ENT-003's closed-tile
 * line. Whole words only, so learner copy such as "unlocked" never trips it.
 */
const GATING_WORDS = /\bpremium\b|\blocked\b|not open yet/i;

/** The listen tier's checks: the correct option id (ids are stable, display order is shuffled). */
const CHECK_ANSWERS = ['a', 'a', 't'];
const ORDER = ['s1', 's2', 's4', 's5'];

type StoryEvent = { name: string; profileId?: string; payload?: Record<string, unknown> };
type E2eWindow = Window & { __hrStoryE2E?: { events(): StoryEvent[] } };
type StoredBookmarks = { v: number; byStory: Record<string, { level: string; sceneIndex: number; updatedAt: string }> };
type StoredSnapshot = { quests: Array<{ questId: string; stars: number; completedAt?: string }>; cards: Array<{ cardId: string }> };

/** A new learner on Home, with the fixture bundle's e2e hook mounted. Returns the profile id. */
async function onboard(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

/** Load the app again (the quest run is gone, device storage stays) and wait for Home. */
async function reloadHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
}

/** Screens under the top one stay in the page (hidden), so lookups take the visible one. */
const shown = (page: Page, testId: string): Locator => page.getByTestId(testId).filter({ visible: true });
const stepHeading = (page: Page, name: string): Locator => page.getByRole('heading', { name });
const missionCards = (page: Page): Locator => page.getByTestId('home-missions').getByRole('button');
const storyCard = (page: Page): Locator => page.getByTestId('home-missions').getByRole('button', { name: /^Hangul Day\./ });
const tile = (page: Page): Locator => shown(page, `story-tile-${STORY}`);
const bookmarksOf = (page: Page, id: string): Promise<StoredBookmarks | null> => readStored<StoredBookmarks>(page, `story:bookmarks:${id}`);
const snapshotOf = (page: Page, id: string): Promise<StoredSnapshot | null> => readStored<StoredSnapshot>(page, `progress:${id}`);

/**
 * Elements under the visible `testId` that reach past the window's left or right edge. The page's
 * Screen is a react-native-web ScrollView, which clips sideways overflow, so the document's own
 * scrollWidth cannot see it; this reads every box instead. Elements inside a sideways scroller of
 * their own (overflow-x auto or scroll) are skipped: scrolling sideways is that row's design.
 */
function outsideWindow(page: Page, testId: string): Promise<string[]> {
  return shown(page, testId).evaluate((root) => {
    const out: string[] = [];
    const scrollsSideways = (el: Element): boolean => {
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        const x = getComputedStyle(p).overflowX;
        if (x === 'auto' || x === 'scroll') return true;
      }
      return false;
    };
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.left >= -1 && r.right <= window.innerWidth + 1) continue;
      if (scrollsSideways(el)) continue;
      out.push(`${el.getAttribute('data-testid') ?? el.tagName.toLowerCase()} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
    }
    return out;
  });
}

/** The left edge and width of the visible `testId`. */
async function boxOf(page: Page, testId: string): Promise<{ x: number; width: number; height: number }> {
  const box = await shown(page, testId).boundingBox();
  expect(box, testId).not.toBeNull();
  return { x: box?.x ?? 0, width: box?.width ?? 0, height: box?.height ?? 0 };
}

function events(page: Page, name: string): Promise<Array<Record<string, unknown> | undefined>> {
  return page.evaluate(
    (n) => ((window as E2eWindow).__hrStoryE2E?.events() ?? []).filter((e) => e.name === n).map((e) => e.payload),
    name,
  );
}

async function openLibrary(page: Page): Promise<void> {
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
}

async function openSection(page: Page, name: 'Cards' | 'Story Time' | 'Culture'): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/** A bookmark at scene 3 of the listen tier, written the way the reader writes it, then the app loads again. */
async function seedSceneThree(page: Page, id: string): Promise<void> {
  await seedStored(page, `story:bookmarks:${id}`, {
    v: 1,
    byStory: { [STORY]: { level: 'listen', sceneIndex: 2, updatedAt: '2026-10-11T09:00:00.000Z' } },
  });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await expect.poll(async () => (await bookmarksOf(page, id))?.byStory[STORY]).toMatchObject({ level: 'listen', sceneIndex: 2 });
}

/** From the reader at its last scene: the end page, every check right, the word recap, the story in order, Results. */
async function finishFromLastScene(page: Page): Promise<void> {
  await nextPage(page);
  await page.getByTestId('story-reader-end-primary').click();
  await expect(stepHeading(page, 'A few questions')).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const answer of CHECK_ANSWERS) {
    await page.getByTestId(`story-check-option-${answer}`).click();
    await page.getByTestId('story-check-next').click();
  }
  // The unscored word recap (F-STORY-003 PR 3.4b) ends the check step with Done.
  const sequence = stepHeading(page, 'Put the story in order');
  const recapDone = page.getByTestId('story-recap-done');
  await expect(sequence.or(recapDone)).toBeVisible();
  if (await recapDone.isVisible()) await recapDone.click();
  await expect(sequence).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const scene of ORDER) await page.getByTestId(`story-sequence-card-${scene}`).click();
  await page.getByRole('button', { name: 'Skip replay' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByTestId('story-results-extras')).toBeVisible();
}

test.describe('story shelf (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('Home story card: start, leave at scene 3, reload, Keep reading resumes on scene 3, finish, the note is found', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await onboard(page);

    // Day one (§3.14 row 1): a real story first, the first Journey quest, then the explore card. The
    // old "Story time" label on a lesson episode is gone.
    await expect(missionCards(page)).toHaveCount(3);
    await expect(missionCards(page).first()).toHaveAccessibleName('Hangul Day. A short story.');
    // Slot 2 is the Journey cursor, which comes from the grid alone: never the shelf quest (§3.14 rows 1, 9).
    await expect(missionCards(page).nth(1)).toHaveAccessibleName('Meet a, eo, g, n. Something new today.');
    // Slot 3 is a second story when the shelf has one (§3.14 row 1): the bundle's Culture fixture.
    await expect(missionCards(page).nth(2)).toHaveAccessibleName('The Hangul Book. A short story.');
    await expect(page.getByTestId('home-missions').locator('[data-testid^="home-mission-cover-"]')).toHaveCount(2);
    await expect(page.getByTestId('home-missions')).not.toContainText('Story time');

    // Start from Home: the quest opens on its intro.
    await storyCard(page).click();
    await expect(stepHeading(page, 'Story time')).toBeVisible();
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'home', mode: 'start' }]);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('1 / 5');
    await nextPage(page);
    await nextPage(page);
    await expect(position(page)).toHaveText('3 / 5');
    await expect.poll(() => bookmarksOf(page, id)).toMatchObject({ v: 1, byStory: { [STORY]: { level: 'listen', sceneIndex: 2 } } });

    // Leave and load the app again: the bookmark is device storage, the quest run is not.
    await reloadHome(page);
    await expect(storyCard(page)).toHaveAccessibleName('Hangul Day. Keep reading.');

    // Keep reading: straight to the read step (the intro skipped), the reader on scene 3.
    await storyCard(page).click();
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    // "2 / 5" here is the quest's step counter (read is step 2 of 5): the reader is not open yet, so
    // its own "n / 5" scene position cannot be the match. The scene is pinned below, after Play.
    await expect(position(page)).toHaveCount(0);
    await expect(page.getByText('2 / 5', { exact: true })).toBeVisible();
    await expect(stepHeading(page, 'Story time')).toHaveCount(0);
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'home', mode: 'continue' }]);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');
    expect(await events(page, 'story.bookmark.resumed')).toEqual([{ storyId: STORY, sceneIndex: 2 }]);

    // Read to the end and finish: three stars, the story's card, and the bookmark is cleared.
    for (const n of [4, 5]) {
      await nextPage(page);
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await finishFromLastScene(page);
    await expect(page.getByText('Wonderful!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
    await expect(page.getByTestId('story-results-title-en')).toHaveText('Hangul Day');
    await expect.poll(async () => (await snapshotOf(page, id))?.quests.find((q) => q.questId === QUEST)?.stars).toBe(3);
    await expect.poll(async () => (await snapshotOf(page, id))?.cards.map((c) => c.cardId)).toContain(REWARD_CARD);
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory).toEqual({});
    // Results is a story surface too: no gating copy and no emoji with the flag off.
    const results = await page.locator('body').innerText();
    expect(results).not.toMatch(GATING_WORDS);
    expect(results).not.toMatch(EMOJI);

    await page.getByTestId('story-results-home').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    // The note is found: the Library's Culture section counts it and Culture notes lists it.
    await openLibrary(page);
    await openSection(page, 'Culture');
    const notesCard = shown(page, 'library-culture-notes');
    await expect(notesCard).toHaveAccessibleName('Culture notes. 1 found. Hangul Day.');
    await notesCard.click();
    await expect(shown(page, 'culture-notes')).toBeVisible();
    await expect(shown(page, 'culture-notes-count')).toHaveText('1 found');
    const group = shown(page, 'culture-notes-group-letters');
    await expect(group).toContainText('Letters & Books');
    await expect(group.getByTestId(`culture-note-${NOTE}`)).toBeVisible();
    await expect(shown(page, `culture-note-story-${NOTE}`)).toContainText('From the story: Hangul Day');
    // "Where this comes from": closed at first; open, it lists the sources as plain text (no links).
    const sources = shown(page, `culture-note-sources-${NOTE}`);
    await expect(sources).toHaveAttribute('aria-expanded', 'false');
    await expect(shown(page, `culture-note-source-list-${NOTE}`)).toHaveCount(0);
    await sources.click();
    await expect(sources).toHaveAttribute('aria-expanded', 'true');
    const sourceList = shown(page, `culture-note-source-list-${NOTE}`);
    await expect(sourceList).toBeVisible();
    expect((await sourceList.innerText()).trim().length).toBeGreaterThan(0);
    await expect(sourceList.locator('a[href]')).toHaveCount(0);
    // "From the story" opens that story's episode page.
    await shown(page, `culture-note-story-${NOTE}`).click();
    await expect(shown(page, 'story-episode-title')).toHaveText('Hangul Day');
    await expect(shown(page, `story-episode-state-${STORY}`)).toHaveText('Finished');
    await page.getByLabel('Go back').filter({ visible: true }).first().click();
    await expect(shown(page, 'culture-notes-count')).toHaveText('1 found');

    // Story Time: the tile says Finished with its stars; the hero offers Read it again.
    await shown(page, 'culture-notes-back').click();
    await openSection(page, 'Story Time');
    await expect(tile(page)).toHaveAccessibleName('Hangul Day. Finished. About 4 minutes. 3 stars.');
    await expect(shown(page, 'library-hero-cta')).toHaveText('Read it again');

    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(EMOJI);
    expect(errors).toEqual([]);
  });

  // Known bug, booked as F-STORY-004 PR 4.8c: Home pins the day's plan in a ref inside HomeScreen, and
  // Results' Back home resets the stack to Main after every quest, which mounts Home again. The pin is
  // lost and the plan is built again, so the finished story's slot turns into an "again" card ("Read it
  // again") instead of keeping its story with the collected look (§3.7 "Pinned all day", F-HW-001 §3.2).
  // Grid cards lose their pin the same way; 4.8c fixes both and adds the grid check on the regular
  // build. Remove the fixme when 4.8c lands.
  test.fixme('Back home after finishing the Home story card: the slot keeps "A short story", collected', async ({ page }) => {
    const id = await onboard(page);
    await expect(storyCard(page)).toHaveAccessibleName('Hangul Day. A short story.');
    await storyCard(page).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const n of [2, 3, 4, 5]) {
      await nextPage(page);
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await finishFromLastScene(page);
    await expect.poll(async () => (await snapshotOf(page, id))?.quests.find((q) => q.questId === QUEST)?.stars).toBe(3);
    await page.getByTestId('story-results-home').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    await expect(missionCards(page)).toHaveCount(3);
    await expect(missionCards(page).first()).toHaveAccessibleName('Hangul Day. A short story. Collected.');
  });

  test('Library: the section tabs, the Story Time hero and tile, the Culture section before a note is found', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page);
    await openLibrary(page);

    // A tab row under the title, Cards selected; every tab at least 64 px tall (§3.3, §3.12).
    const tablist = page.getByRole('tablist', { name: 'Library sections' });
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole('tab');
    // Words is the fixture bundle's topic section (F-VOC-003); Story Time and Culture are this feature's.
    await expect(tabs).toHaveText(['Cards', 'Story Time', 'Culture', 'Words']);
    await expect(page.getByRole('tab', { name: 'Cards', exact: true })).toHaveAttribute('aria-selected', 'true');
    for (const box of await tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(64);
    }
    expect(await events(page, 'story.shelf.viewed')).toEqual([]);

    // Story Time: "Picked for you" with one primary, then the tile in shelf order.
    await openSection(page, 'Story Time');
    const hero = shown(page, 'library-hero');
    await expect(hero).toContainText('Picked for you');
    await expect(hero).toContainText('한글날');
    await expect(hero).toContainText('hangeullal');
    await expect(hero).toContainText('about 4 min');
    await expect(shown(page, 'library-hero-cta')).toHaveText('Start');
    await expect(shown(page, 'library-hero-cta')).toHaveAccessibleName('Start: Hangul Day');
    expect((await boxOf(page, 'library-hero-cta')).height).toBeGreaterThanOrEqual(64);
    await expect(shown(page, 'library-shelf-story-time-grid').getByRole('button')).toHaveCount(1);
    await expect(tile(page)).toHaveAccessibleName('Hangul Day. New. About 4 minutes.');
    const tileBox = await tile(page).boundingBox();
    expect(tileBox?.height ?? 0).toBeGreaterThanOrEqual(64);
    await expect.poll(() => events(page, 'story.shelf.viewed')).toEqual([{ section: 'story-time', stories: 1, started: 0, finished: 0 }]);

    // Culture before any story is finished: the notes card says how notes are found; the one tile is
    // the bundle's Culture fixture (F-STORY-005 PR 5.5b), never Story Time's story.
    await openSection(page, 'Culture');
    await expect(shown(page, 'library-culture-notes')).toHaveAccessibleName(
      'Culture notes. Finish a story to find your first culture note.',
    );
    await expect(shown(page, 'library-shelf-culture-grid').getByRole('button')).toHaveCount(1);
    await expect(shown(page, 'story-tile-story:cell-stories-fixture')).toBeVisible();
    await expect(shown(page, 'library-shelf-culture-grid').getByTestId(`story-tile-${STORY}`)).toHaveCount(0);
    await expect.poll(async () => (await events(page, 'story.shelf.viewed')).map((p) => p?.section)).toEqual(['story-time', 'culture']);
    // Culture notes with nothing found: no placeholders, one way to Story Time.
    await shown(page, 'library-culture-notes').click();
    await expect(shown(page, 'culture-notes-empty')).toContainText('Finish a story to find your first culture note.');
    await expect(page.locator('[data-testid^="culture-note-cn-"]')).toHaveCount(0);
    await shown(page, 'culture-notes-to-story-time').click();
    await expect(page.getByRole('tab', { name: 'Story Time', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(tile(page)).toBeVisible();

    // A tile opens the story's episode page; the hero opens the story itself.
    await tile(page).click();
    await expect(shown(page, 'story-episode')).toBeVisible();
    await page.getByLabel('Go back').filter({ visible: true }).first().click();
    await shown(page, 'library-hero-cta').click();
    await expect(stepHeading(page, 'Story time')).toBeVisible();
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'library', mode: 'start' }]);
    expect(errors).toEqual([]);
  });

  test('a story in progress: the tile and hero say Keep reading, and the hero resumes on the saved scene', async ({ page }) => {
    const id = await onboard(page);
    await seedSceneThree(page, id);
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await expect(tile(page)).toHaveAccessibleName('Hangul Day. Keep reading. About 4 minutes.');
    await expect(shown(page, 'library-hero-cta')).toHaveText('Keep reading');
    await expect.poll(() => events(page, 'story.shelf.viewed')).toEqual([{ section: 'story-time', stories: 1, started: 1, finished: 0 }]);

    await shown(page, 'library-hero-cta').click();
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    // The quest's step counter (read is step 2 of 5), not a scene: the reader is not open yet.
    await expect(position(page)).toHaveCount(0);
    await expect(page.getByText('2 / 5', { exact: true })).toBeVisible();
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'library', mode: 'continue' }]);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');
  });

  test('episode page: new has one Start; in progress has Keep reading and Start over; Start over begins at scene 1', async ({ page }) => {
    const id = await onboard(page);
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await tile(page).click();

    // New: the three story pills (never the "Hangul" stage pill), the titles, Hoya, one large Start.
    const pills = shown(page, 'story-episode-pills');
    await expect(pills).toHaveText(/Story Time.*Letters & Books.*4 min/);
    await expect(pills.locator(':scope > *')).toHaveCount(3);
    await expect(pills).not.toContainText(/\bHangul\b/);
    await expect(shown(page, 'story-episode-title')).toHaveText('Hangul Day');
    await expect(shown(page, 'story-episode-title-ko')).toContainText('한글날');
    await expect(shown(page, 'story-episode')).toContainText(HOYA_INTRO);
    await expect(shown(page, `story-episode-state-${STORY}`)).toHaveText('New');
    await expect(shown(page, `story-episode-start-${STORY}`)).toHaveAccessibleName('Start: Hangul Day');
    await expect(shown(page, 'story-episode').locator(`[data-testid$="-${STORY}"][role="button"]`)).toHaveCount(1);
    // The word chips, each with its own speaker.
    const words = shown(page, 'story-episode-words');
    await expect(words).toContainText('한글날');
    const chips = words.locator('[data-testid^="story-episode-word-"]');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);
    await expect(words.locator('[data-testid^="story-episode-hear-"]')).toHaveCount(chipCount);
    // No note is found yet, so no Culture notes line; the reward card is a silhouette, which opens nothing.
    await expect(shown(page, 'story-episode-notes')).toHaveCount(0);
    await expect(shown(page, 'story-episode-cards').locator(`[data-testid="story-episode-card-${REWARD_CARD}"]`)).toHaveCount(1);
    await expect(shown(page, 'story-episode-cards').getByRole('button')).toHaveCount(0);

    // In progress: Keep reading resumes on the saved scene, with the intro skipped.
    await seedSceneThree(page, id);
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await tile(page).click();
    await expect(shown(page, `story-episode-state-${STORY}`)).toHaveText('Keep reading');
    await expect(shown(page, `story-episode-continue-${STORY}`)).toHaveText('Keep reading');
    await expect(shown(page, `story-episode-restart-${STORY}`)).toHaveText('Start over');
    await shown(page, `story-episode-continue-${STORY}`).click();
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    await expect(stepHeading(page, 'Story time')).toHaveCount(0);
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'episode', mode: 'continue' }]);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');

    // Start over clears the bookmark and opens the intro. (The app loads again, so the event buffer is new.)
    await reloadHome(page);
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory[STORY]).toMatchObject({ level: 'listen', sceneIndex: 2 });
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await tile(page).click();
    await shown(page, `story-episode-restart-${STORY}`).click();
    await expect(stepHeading(page, 'Story time')).toBeVisible();
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory).toEqual({});
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'episode', mode: 'restart' }]);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('1 / 5');
    expect(await events(page, 'story.bookmark.resumed')).toEqual([]);
  });

  test('episode page when finished: Play again and Read it again, the notes line opens that story\'s notes', async ({ page }) => {
    const id = await onboard(page);
    await storyCard(page).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const n of [2, 3, 4, 5]) {
      await nextPage(page);
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await finishFromLastScene(page);
    await expect.poll(async () => (await snapshotOf(page, id))?.quests.find((q) => q.questId === QUEST)?.completedAt).toEqual(expect.any(String));
    await page.getByTestId('story-results-home').click();
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await tile(page).click();

    await expect(shown(page, `story-episode-state-${STORY}`)).toHaveText('Finished');
    await expect(shown(page, `story-episode-play-again-${STORY}`)).toHaveText('Play again');
    await expect(shown(page, `story-episode-read-again-${STORY}`)).toHaveText('Read it again');
    await expect(shown(page, `story-episode-start-${STORY}`)).toHaveCount(0);
    // The earned card is a button with its picture and title now (no silhouette).
    const earned = shown(page, 'story-episode-cards').getByRole('button');
    await expect(earned).toHaveCount(1);
    await expect(earned).toHaveAttribute('data-testid', `story-episode-card-${REWARD_CARD}`);
    await expect(earned).toContainText(REWARD_TITLE);
    await expect(earned).toContainText(REWARD_KO);

    const line = shown(page, 'story-episode-notes');
    await expect(line).toHaveText('Culture notes: 1 found');
    await line.click();
    await expect(shown(page, 'culture-notes-count')).toHaveText('1 found');
    await expect(shown(page, `culture-note-${NOTE}`)).toBeVisible();
    await shown(page, 'culture-notes-back').click();

    // Read it again: the unscored replay of the story, from the episode page.
    await shown(page, `story-episode-read-again-${STORY}`).click();
    await expect(page.getByTestId('story-reader-next')).toBeVisible();
    expect((await events(page, 'story.opened')).at(-1)).toEqual({ storyId: STORY, source: 'episode', mode: 'read-again' });

    // The earned card opens its Card detail. (That screen's close control has no label to find it by,
    // so the app loads again to leave it.)
    await reloadHome(page);
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await tile(page).click();
    await shown(page, `story-episode-card-${REWARD_CARD}`).click();
    await expect(page.getByRole('heading', { name: REWARD_TITLE, exact: true }).filter({ visible: true })).toBeVisible();
    await expect(shown(page, 'card-detail-hear')).toBeVisible();

    // Play again: the scored quest from its intro (the app loads again, so the event buffer is new).
    await reloadHome(page);
    await openLibrary(page);
    await openSection(page, 'Story Time');
    await tile(page).click();
    await shown(page, `story-episode-play-again-${STORY}`).click();
    await expect(stepHeading(page, 'Story time')).toBeVisible();
    expect(await events(page, 'story.opened')).toEqual([{ storyId: STORY, source: 'episode', mode: 'play-again' }]);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('1 / 5');
  });

  // A guard on the default build's copy: it proves no story surface draws lock or Premium copy with
  // the flag at its launch default. The bundle's one shelf story is the sampler, open either way, so
  // it cannot tell gating off from gating on; the gated build is PR 4.8b.
  test('default build: no lock or "Premium" copy and no emoji on any story surface', async ({ page }) => {
    await onboard(page);
    await expect(missionCards(page)).toHaveCount(3);
    await expect(storyCard(page)).toBeVisible();
    const surfaces: Array<[string, string]> = [['Home', await page.getByTestId('home-missions').innerText()]];

    await openLibrary(page);
    await openSection(page, 'Story Time');
    await expect(tile(page)).toBeVisible();
    surfaces.push(['Story Time', await shown(page, 'library-shelf-story-time').innerText()]);
    await openSection(page, 'Culture');
    await expect(shown(page, 'library-culture-notes')).toBeVisible();
    surfaces.push(['Culture', await shown(page, 'library-culture').innerText()]);
    await shown(page, 'library-culture-notes').click();
    await expect(shown(page, 'culture-notes')).toBeVisible();
    surfaces.push(['Culture notes', await shown(page, 'culture-notes').innerText()]);
    await shown(page, 'culture-notes-to-story-time').click();
    await expect(tile(page)).toBeVisible();
    await tile(page).click();
    await expect(shown(page, 'story-episode-title')).toHaveText('Hangul Day');
    // The tap opened the episode page: no lock event and no grown-up PIN screen.
    expect(await events(page, 'story.locked.tapped')).toEqual([]);
    await expect(page.getByRole('button', { name: 'Unlock', exact: true }).filter({ visible: true })).toHaveCount(0);
    surfaces.push(['episode page', await shown(page, 'story-episode').innerText()]);

    for (const [name, text] of surfaces) {
      expect(text, `${name}: lock or Premium copy`).not.toMatch(GATING_WORDS);
      expect(text, `${name}: emoji`).not.toMatch(EMOJI);
    }
    // Results is checked in the first test, where the story is finished.
  });

  // §3.12's four layouts, plus a wide window (four columns).
  for (const vp of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    test(`${vp.width}x${vp.height}: Story Time, the episode page and Culture notes fit the window with no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await openLibrary(page);
      await openSection(page, 'Story Time');
      await expect(tile(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // The tile, the hero and its button all lie inside the window, and nothing in Story Time reaches past it.
      for (const testId of [`story-tile-${STORY}`, 'library-hero', 'library-hero-cta']) {
        const box = await boxOf(page, testId);
        expect(box.x >= 0 && box.x + box.width <= vp.width + 0.5, testId).toBe(true);
      }
      expect(await outsideWindow(page, 'library-shelf-story-time'), 'Story Time').toEqual([]);
      // §3.4 columns: 1 under 360, 2 up to 767, 3 or 4 from 768 (the one tile is one cell of the grid).
      const columns = vp.width < 360 ? 1 : vp.width < 768 ? 2 : vp.width < 1024 ? 3 : 4;
      const share = (await boxOf(page, `story-tile-${STORY}`)).width / (await boxOf(page, 'library-shelf-story-time-grid')).width;
      const [least, most] = columns === 1 ? [0.95, 1.01] : columns === 2 ? [0.4, 0.55] : [0.15, 0.34];
      expect(share, `${columns} column(s)`).toBeGreaterThan(least);
      expect(share, `${columns} column(s)`).toBeLessThanOrEqual(most);
      // The hero: cover and text side by side from three columns, stacked below that.
      const hero = await boxOf(page, 'library-hero');
      const cta = await boxOf(page, 'library-hero-cta');
      if (columns >= 3) {
        expect(cta.x, 'hero side by side: the button sits right of the cover').toBeGreaterThan(hero.x + hero.width * 0.2);
        expect(cta.width, 'hero side by side: the button is not full width').toBeLessThan(hero.width * 0.6);
      } else {
        expect(cta.width, 'hero stacked: a full-width button').toBeGreaterThan(hero.width * 0.8);
      }
      await page.screenshot({ path: `test-results/story-shelf-${vp.width}x${vp.height}.png`, fullPage: true });

      // The story's episode page and the Culture notes screen fit too.
      await tile(page).click();
      await expect(shown(page, `story-episode-start-${STORY}`)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'episode page').toBe(true);
      expect(await outsideWindow(page, 'story-episode'), 'episode page').toEqual([]);
      const start = await shown(page, `story-episode-start-${STORY}`).boundingBox();
      expect((start?.x ?? -1) >= 0 && (start?.x ?? 0) + (start?.width ?? 0) <= vp.width + 0.5, 'Start').toBe(true);
      await page.getByLabel('Go back').filter({ visible: true }).first().click();
      await openSection(page, 'Culture');
      await shown(page, 'library-culture-notes').click();
      await expect(shown(page, 'culture-notes-empty')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Culture notes').toBe(true);
      expect(await outsideWindow(page, 'culture-notes'), 'Culture notes').toEqual([]);
    });
  }
});
