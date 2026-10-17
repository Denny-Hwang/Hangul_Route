import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored, headerBack, headerClose } from './helpers';
import { shot } from './shots';
import { back, fullyVisible, next, nextPage, position, primaryButtons } from './story-reader-helpers';

/**
 * F-STORY-002 PR 2.8: the reader's culture note chip and card, the grown-up
 * advisory row and the end page recap (§3.7; wireframe
 * design/wireframes/story/reader.md F1, G1, H). Runs on the fixture bundle
 * (served from dist-e2e/), like the other reader suites:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-reader
 *
 * `story:hangul-day` has an advisory ("Mentions that most people could not
 * read long ago."), one culture note on listen scene 1 (`cn-hangul-day`, with
 * `card:hanji`, which has card art) and Story Order scenes s1, s2, s4, s5
 * (listen) and s1-s4 (read-along, s3 art pending).
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';
const QUEST = 'quest:story-hangul-day-listen';
const EPISODE = 'episode:shelf-hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;
const ADVISORY = 'A note for grown-ups: Mentions that most people could not read long ago.';

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openReader(p: { storyId: string; level: string; sceneIndex?: number }): void;
    openQuest(p: { questId: string; episodeId: string }): void;
    events(): Array<{ name: string; payload?: Record<string, unknown> }>;
  };
};

const NOTE = 'cn-hangul-day';
const T = '2026-10-10T09:00:00.000Z';

/** The fixture story's quest finished once (a synced or earlier finish), so its culture note is found. */
async function seedStoryFinished(page: Page): Promise<void> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const profileId = profiles?.[0]?.id;
  if (!profileId) throw new Error('no profile stored');
  await seedStored(page, `progress:${profileId}`, {
    profileId,
    updatedAt: T,
    episodes: [],
    quests: [{ questId: QUEST, episodeId: EPISODE, startedAt: T, completedAt: T, stars: 2, attempts: 1, accuracy: 1 }],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
}

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
}

async function openReplay(page: Page, level = 'listen', sceneIndex?: number): Promise<void> {
  await page.evaluate(
    ([storyId, lvl, scene]) =>
      (window as E2eWindow).__hrStoryE2E?.openReader({
        storyId: storyId as string,
        level: lvl as string,
        ...(scene === null ? {} : { sceneIndex: scene as number }),
      }),
    [STORY, level, sceneIndex ?? null] as const,
  );
  await expect(next(page)).toBeVisible();
}

/** The quest's intro step, then the read step's launcher, then the reader on scene 1 (quest mode). */
async function openQuestReader(page: Page): Promise<void> {
  await page.evaluate(
    ([questId, episodeId]) => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId, episodeId }),
    [QUEST, EPISODE] as const,
  );
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(next(page)).toBeVisible();
}

const advisory = (page: Page): Locator => page.getByTestId('story-reader-advisory');
const chip = (page: Page): Locator => page.getByTestId('story-reader-did-you-know');
const note = (page: Page): Locator => page.getByTestId('story-reader-note');

async function above(page: Page, upper: Locator, lower: Locator): Promise<boolean> {
  const a = await upper.boundingBox();
  const b = await lower.boundingBox();
  return a !== null && b !== null && a.y + a.height <= b.y + 0.5;
}

function noSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test.describe('story reader extras (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('quest mode: the grown-up note sits above the art on a fresh open of scene 1 and never blocks', async ({ page }) => {
    await onboard(page);
    await openQuestReader(page);
    await expect(advisory(page)).toBeVisible();
    await expect(page.getByTestId('story-reader-advisory-text')).toHaveText(ADVISORY);
    expect(await above(page, advisory(page), page.getByTestId('story-reader-art'))).toBe(true);
    // Never a gate: Next is right there and works.
    await expect(next(page)).toBeEnabled();
    expect(await page.getByTestId('story-reader').innerText()).not.toMatch(/\bages?\b|\bkids?\b|for children/i);

    // Dismiss (a 64 dp control named "Dismiss") removes it; from the keyboard, focus lands on the scene text.
    const dismiss = page.getByTestId('story-reader-advisory-dismiss');
    await expect(dismiss).toHaveAccessibleName('Dismiss');
    const box = await dismiss.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    await dismiss.focus();
    await page.keyboard.press('Enter');
    await expect(advisory(page)).toHaveCount(0);
    await expect(page.getByTestId('story-reader-narration')).toBeFocused();

    // A fresh open of scene 1 shows it again. Closed before any page turn, so no bookmark is saved and this
    // stays a fresh open once F-STORY-004 PR 4.4b wires the bookmark (a resume past scene 1 shows no note).
    await headerClose(page).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('1 / 5');
    await expect(advisory(page)).toBeVisible();

    // A page turn takes it away and Back does not bring it back in that visit.
    await nextPage(page);
    await expect(advisory(page)).toHaveCount(0);
    await back(page).click();
    await expect(position(page)).toHaveText('1 / 5');
    await expect(advisory(page)).toHaveCount(0);
  });

  test('replay mode shows no grown-up note', async ({ page }) => {
    await onboard(page);
    await openReplay(page);
    await expect(position(page)).toHaveText('1 / 5');
    await expect(chip(page)).toBeVisible();
    await expect(advisory(page)).toHaveCount(0);
  });

  test('Did you know? opens the note card inline: title, body, the term with its speaker, card art, Close', async ({ page }) => {
    await onboard(page);
    await openReplay(page);
    await expect(chip(page)).toHaveText('Did you know?');
    // A disclosure: a screen reader hears whether the note is open.
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    await chip(page).click();
    await expect(note(page)).toBeVisible();
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(note(page)).toBeInViewport();
    await expect(note(page)).toContainText('Did you know?');
    await expect(page.getByTestId('story-reader-note-title')).toHaveText('Hangul Day');
    await expect(page.getByTestId('story-reader-note-body')).toHaveText('Korea celebrates its alphabet every year in October.');
    // The taught term: Korean, romanization and gloss, and a 64 dp speaker.
    const term = page.getByTestId('story-reader-note-term');
    await expect(term).toContainText('한글날');
    await expect(term).toContainText('hangeullal');
    await expect(term).toContainText('Hangul Day');
    const hear = page.getByTestId('story-reader-note-hear');
    await expect(hear).toHaveAccessibleName('Hear hangeullal');
    const box = await hear.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    // Card art for card:hanji, hidden from screen readers (the title and term say what it shows).
    await expect(page.getByTestId('story-reader-note-art')).toBeVisible();
    await expect(page.getByTestId('story-reader-note-art')).toHaveAttribute('aria-hidden', 'true');
    // Not found yet (the story is not finished): the Culture notes screen would not list it, so no
    // "More in Culture notes" (F-STORY-004 PR 4.7).
    await expect(page.getByTestId('story-reader-note-more')).toHaveCount(0);
    // The note card adds no primary button.
    expect(await primaryButtons(page)).toEqual(['story-reader-next']);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);

    await page.getByTestId('story-reader-note-close').click();
    await expect(note(page)).toHaveCount(0);
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('once the story is finished, More in Culture notes opens the note: in view, outlined, sources open, viewed once', async ({ page }) => {
    await onboard(page);
    await seedStoryFinished(page);
    await openReplay(page);
    await chip(page).click();
    const more = page.getByTestId('story-reader-note-more');
    await expect(more).toHaveText('More in Culture notes');
    expect(await primaryButtons(page)).toEqual(['story-reader-next']);
    await more.click();

    await expect(page.getByTestId('culture-notes')).toBeVisible();
    const target = page.getByTestId(`culture-note-${NOTE}`);
    await expect(target).toBeInViewport();
    // The target note has the thicker focus outline (borderWidth.thick).
    expect(await target.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('3px');
    await expect(page.getByTestId(`culture-note-source-list-${NOTE}`)).toBeVisible();
    // The replay reader is not a quest run: the note links to its story.
    await expect(page.getByTestId(`culture-note-story-${NOTE}`)).toBeVisible();
    const viewed = async (): Promise<unknown[]> =>
      (await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []))
        .filter((e) => e.name === 'culture.note.viewed')
        .map((e) => e.payload);
    await expect.poll(viewed).toEqual([{ noteId: NOTE, storyId: STORY }]);

    // Back is the reader, on the scene it was on.
    await headerBack(page).click();
    await expect(next(page)).toBeVisible();
    await expect(position(page)).toHaveText('1 / 5');
    expect(await viewed()).toHaveLength(1);
  });

  test('quest mode: no More on a first read; once found, the notes screen over the quest offers Back only', async ({ page }) => {
    await onboard(page);
    await openQuestReader(page);
    await chip(page).click();
    await expect(note(page)).toBeVisible();
    await expect(page.getByTestId('story-reader-note-more')).toHaveCount(0);

    await seedStoryFinished(page);
    await openQuestReader(page);
    await chip(page).click();
    await page.getByTestId('story-reader-note-more').click();
    await expect(page.getByTestId(`culture-note-${NOTE}`)).toBeInViewport();
    // Nothing on the screen can unwind the running quest: no story link, no Story Time button.
    await expect(page.getByTestId(`culture-note-story-${NOTE}`)).toHaveCount(0);
    await expect(page.getByTestId('culture-notes-to-story-time')).toHaveCount(0);
    await headerBack(page).click();
    // Back in the same quest run, on the reader.
    await expect(next(page)).toBeVisible();
    await expect(position(page)).toHaveText('1 / 5');
  });

  test('the note card closes on a second tap, Escape, a term chip and a page turn; scenes without a note have no chip', async ({ page }) => {
    await onboard(page);
    await openReplay(page);
    await chip(page).click();
    await expect(note(page)).toBeVisible();
    await chip(page).click();
    await expect(note(page)).toHaveCount(0);

    await chip(page).click();
    await page.keyboard.press('Escape');
    await expect(note(page)).toHaveCount(0);

    // One inline card at a time: a term's gloss card replaces the note, and the other way round.
    await chip(page).click();
    await page.getByTestId('story-reader-term-sejong').click();
    await expect(page.getByTestId('story-reader-gloss')).toBeVisible();
    await expect(note(page)).toHaveCount(0);
    await chip(page).click();
    await expect(note(page)).toBeVisible();
    await expect(page.getByTestId('story-reader-gloss')).toHaveCount(0);

    await nextPage(page);
    await expect(position(page)).toHaveText('2 / 5');
    await expect(note(page)).toHaveCount(0);
    await expect(chip(page)).toHaveCount(0);
    await back(page).click();
    await expect(chip(page)).toBeVisible();
    await expect(note(page)).toHaveCount(0);
  });

  test('the end page recaps the story with its Story Order pictures, hidden from screen readers', async ({ page }) => {
    await onboard(page);
    await openReplay(page, 'listen', 4);
    await nextPage(page);
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    const recap = page.getByTestId('story-reader-recap');
    await expect(recap).toBeVisible();
    await expect(recap).toHaveAttribute('aria-hidden', 'true');
    for (const id of ['s1', 's2', 's4', 's5']) await expect(page.getByTestId(`story-reader-recap-${id}`)).toBeVisible();
    await expect(page.getByTestId('story-reader-recap-s3')).toHaveCount(0);
    // Under the heading, above the buttons; still one primary (Done in replay).
    expect(await above(page, page.getByRole('heading', { name: 'The End' }), recap)).toBe(true);
    expect(await above(page, recap, page.getByTestId('story-reader-end-primary'))).toBe(true);
    expect(await primaryButtons(page)).toEqual(['story-reader-end-primary']);
  });

  test('read-along: a Story Order scene whose art is pending is left out of the recap', async ({ page }) => {
    await onboard(page);
    await openReplay(page, 'read-along', 3);
    await nextPage(page);
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    for (const id of ['s1', 's2', 's4']) await expect(page.getByTestId(`story-reader-recap-${id}`)).toBeVisible();
    await expect(page.getByTestId('story-reader-recap-s3')).toHaveCount(0);
  });

  // Phone portrait, a phone held sideways and a tablet held sideways: the advisory row, the open note card
  // and the end page recap never push Next or Continue off screen, and nothing scrolls sideways.
  for (const vp of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1180, height: 820 },
  ]) {
    test(`${vp.width}x${vp.height}: grown-up note, note card and recap keep Next and Continue on screen`, async ({ page }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await openQuestReader(page);
      await expect(advisory(page)).toBeVisible();
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      await expect.poll(() => fullyVisible(page, page.getByTestId('story-reader-advisory-dismiss'))).toBe(true);
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `story-extras-advisory-${vp.width}x${vp.height}`);

      // The longest advisory the schema allows (140 characters) still leaves Next, Dismiss and a text area on
      // screen. react-native-web lays out with CSS, so swapping the text reflows the real layout.
      await page.getByTestId('story-reader-advisory-text').evaluate((el, longest) => {
        el.textContent = longest;
      }, `A note for grown-ups: ${'x'.repeat(140)}`.replace(/x{10}/g, 'xxxxxxxxx '));
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      await expect.poll(() => fullyVisible(page, page.getByTestId('story-reader-advisory-dismiss'))).toBe(true);
      const scroll = await page.getByTestId('story-reader-scroll').boundingBox();
      expect(scroll?.height ?? 0).toBeGreaterThanOrEqual(64);
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `story-extras-advisory-longest-${vp.width}x${vp.height}`);

      await chip(page).click();
      await expect(note(page)).toBeVisible();
      // The card scrolls into view inside the text area; its Close is reachable by scrolling that area.
      await expect(note(page)).toBeInViewport();
      await shot(page, `story-extras-note-open-${vp.width}x${vp.height}`);
      const close = page.getByTestId('story-reader-note-close');
      await close.scrollIntoViewIfNeeded();
      await expect(close).toBeInViewport();
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `story-extras-note-${vp.width}x${vp.height}`);

      for (let i = 0; i < 5; i += 1) await nextPage(page);
      const primary = page.getByTestId('story-reader-end-primary');
      await expect(primary).toHaveText('Continue');
      await expect(page.getByTestId('story-reader-recap')).toBeVisible();
      await expect.poll(() => fullyVisible(page, primary)).toBe(true);
      await expect.poll(() => fullyVisible(page, page.getByTestId('story-reader-recap'))).toBe(true);
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `story-extras-end-${vp.width}x${vp.height}`);
    });
  }
});
