import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { journeyCellName, keepSidewaysIfAsked, onboardChild, passDiscover, readStored, seedStoredAll, seedStored } from './helpers';
import { Touchscreen } from './touch';
import { runMatrix } from './touch-matrix';

/**
 * AMENDMENTS-TOUCH row KT-11, section 11.2: the graze matrix on every answer board that is on main, found by what the
 * page shows (`touch-matrix.ts`), at the two profiles of the section: 320 x 640 with touch and the largest text size, and
 * the 820 x 1180 tablet. Per board: a move of 0, 8, 16, 24 and 32 px commits (both axes where the game's rounds
 * allow); a move that ends 40 px outside an answer commits nothing and leaves no press look; a slide into the
 * neighbour commits nothing; on a scrolling board a 72 px drag scrolls the page and commits nothing. Release build.
 *
 * Boards of the pick-one family that the KT-3 spec (`pick-one-graze.spec.ts`) already runs in the guest's first quest
 * (Match Sound, Listen & Pick) are not repeated. Each later KT row adds its own boards here.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

const PROFILES = [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
] as const;

type Profile = (typeof PROFILES)[number];

/** A fresh device: nothing stored, the profile's text size, a learner named Dami on Home. */
async function freshLearner(page: Page, profile: Profile): Promise<void> {
  // Nothing of an earlier run stays: leave the app (it holds the database open), clear the origin's data, load it again.
  await page.goto('about:blank');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', { origin: new URL(test.info().project.use.baseURL ?? 'http://localhost:4173').origin, storageTypes: 'all' });
  await cdp.detach();
  await page.goto('/');
  if (profile.largest) await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/** From Home to a cell's quest: the Journey, the cell, Start on the `quest`th quest (0-based), past the soft prerequisite sheet and the intro. */
async function startQuest(page: Page, stage: number, theme: string, quest: number): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(stage, theme) }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(quest).click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

const skipStep = (page: Page) => page.getByRole('button', { name: 'Skip for now' }).click();

/** Stage 1 Picnic Snacks (Food & Daily Life, quest 3): Discover, Match the Sound (skipped), then the Culture Quiz. */
async function openCultureQuiz(page: Page, profile: Profile): Promise<void> {
  await freshLearner(page, profile);
  await startQuest(page, 1, 'Food & Daily Life', 2);
  await passDiscover(page);
  await skipStep(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('culture-quiz-hear')).toBeVisible();
}

/** Stage 4 Nature & Animals, quest 1: Discover, then Tap & Respond. */
async function openTapRespond(page: Page, profile: Profile): Promise<void> {
  await freshLearner(page, profile);
  await startQuest(page, 4, 'Nature & Animals', 0);
  await passDiscover(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('Choose your reply', { exact: true })).toBeVisible();
}

/** Stage 1 Letters & Books, quest 3: Discover, Match the Sound (skipped), then Odd One Out. */
async function openOddOneOut(page: Page, profile: Profile): Promise<void> {
  await freshLearner(page, profile);
  await startQuest(page, 1, 'Letters & Books', 2);
  await passDiscover(page);
  await skipStep(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('odd-one-out-tiles')).toBeVisible();
}

/** Stage 1 Play & Crafts, quest 4: the intro, then Read Pick (Match Shape is dark in the release build). */
async function openReadPick(page: Page, profile: Profile): Promise<void> {
  await freshLearner(page, profile);
  await startQuest(page, 1, 'Play & Crafts', 3);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('read-pick-game')).toBeVisible();
}

/** Stage 6 Letters & Books, quest 1: Discover, then Realia Read. */
async function openRealiaRead(page: Page, profile: Profile): Promise<void> {
  await freshLearner(page, profile);
  await startQuest(page, 6, 'Letters & Books', 0);
  await passDiscover(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('realia-read-question')).toBeVisible();
}

/** Words of this build with a distinct spelling and meaning (the Daily Review's pool), as `daily-review.spec.ts` seeds them. */
function reviewWords(count: number): Array<{ id: string; stage: number }> {
  const seenKo = new Set<string>();
  const seenEn = new Set<string>();
  const out: Array<{ id: string; stage: number }> = [];
  for (const [id, ko, , en, , , meta] of REVIEW_ITEM_ROWS) {
    if (!id.startsWith('lex:') || en === '' || ko.includes(' ') || seenKo.has(ko) || seenEn.has(en)) continue;
    seenKo.add(ko);
    seenEn.add(en);
    out.push({ id, stage: meta & 7 });
    if (out.length === count) break;
  }
  return out;
}

/** Home's Daily Review (slot 3) with twelve words due today, the memory record and the review switched on, opened. */
async function openDailyReview(page: Page, profile: Profile): Promise<void> {
  await freshLearner(page, profile);
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id ?? '';
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const rows: Record<string, unknown> = {};
  for (const w of reviewWords(12)) {
    rows[w.id] = { sh: `stage${Math.max(1, w.stage)}`, st: { b: 1, d: today, c: 0, r: 0, n: 1, f: '2026-01-01', s: 1, at: '2026-01-02T09:00:00.000Z' } };
  }
  await seedStoredAll(page, {
    [`memory:${id}`]: { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null },
    'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 } } },
  });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByRole('button', { name: /^Daily Review\. About 3 minutes\./ }).click();
  await expect(page.getByTestId('daily-review-dots')).toBeVisible();
}

const BOARDS: ReadonlyArray<{ name: string; open: (page: Page, profile: Profile) => Promise<void>; stateful?: boolean }> = [
  { name: 'Culture Quiz', open: openCultureQuiz },
  { name: 'Tap & Respond', open: openTapRespond },
  { name: 'Odd One Out', open: openOddOneOut, stateful: true },
  { name: 'Read Pick', open: openReadPick, stateful: true },
  { name: 'Realia Read', open: openRealiaRead, stateful: true },
  { name: 'Daily Review', open: openDailyReview, stateful: true },
];

for (const profile of PROFILES) {
  test.describe(`answer boards, the touch matrix, ${profile.name} (AMENDMENTS-TOUCH KT-11, section 11.2)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the learner journey');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    for (const board of BOARDS) {
      test(`${board.name}: every distance of the matrix commits; outside, slide and drag commit nothing`, async ({ page }) => {
        test.setTimeout(240_000);
        await board.open(page, profile);
        const touch = await Touchscreen.of(page);
        await runMatrix(page, touch, {
          name: board.name,
          statefulAnswers: board.stateful,
          restart: () => board.open(page, profile),
          note: (type, description) => test.info().annotations.push({ type, description }),
        });
      });
    }
  });
}
