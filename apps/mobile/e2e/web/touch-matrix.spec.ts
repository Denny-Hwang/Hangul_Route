import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { journeyCellName, keepSidewaysIfAsked, onboardChild, passDiscover, readStored, seedStoredAll, seedStored } from './helpers';
import { Touchscreen } from './touch';
import { FULL_MATRIX, MATRIX, clearDevice, expectTargets, fitOf, runMatrix } from './touch-matrix';

/**
 * AMENDMENTS-TOUCH row KT-11, section 11.2: the graze matrix on every answer board that is on main, found by what the
 * page shows (`touch-matrix.ts`), at the two profiles of the section: 320 x 640 with touch and the largest text size, and
 * the 820 x 1180 tablet. Per board: a move of 0, 8, 16, 24 and 32 px commits (both axes where the game's rounds
 * allow); a move that ends 40 px outside an answer commits nothing and leaves no press look; a slide into the
 * neighbour commits nothing; on a scrolling board a 72 px drag scrolls the page and commits nothing. Release build.
 *
 * CI runs the smoke set (`smoke` on a board below): the PWA e2e shards have 20 minutes and the suite already uses most
 * of them. `E2E_TOUCH_MATRIX=full` runs every board at both profiles with all nine grazes, and the fit audit.
 *
 * Boards of the pick-one family that the KT-3 spec (`pick-one-graze.spec.ts`) already runs in the guest's first quest
 * (Match Sound, Listen & Pick) are not repeated. Each later KT row adds its own boards here.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

interface Profile {
  /** `phone` or `tablet`. */
  key: 'phone' | 'tablet';
  name: string;
  viewport: { width: number; height: number };
  largest: boolean;
}

const PROFILES: readonly [Profile, Profile] = [
  { key: 'phone', name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { key: 'tablet', name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
];

/** A fresh device: nothing stored, the profile's text size, a learner named Dami on Home. */
async function freshLearner(page: Page, profile: Profile): Promise<void> {
  await clearDevice(page, test.info().project.use.baseURL);
  if (profile.largest) await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await dismissInstallGuide(page);
}

/** The install guide comes in a moment after Home opens and covers the cards; Not now. */
async function dismissInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => undefined);
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
  await dismissInstallGuide(page);
  await page.getByRole('button', { name: /^Daily Review\. About 3 minutes\./ }).click();
  await expect(page.getByTestId('daily-review-dots')).toBeVisible();
}

const MATRIX_ALL = MATRIX.length;

const BOARDS: ReadonlyArray<{ name: string; open: (page: Page, profile: Profile) => Promise<void>; stateful?: boolean; smoke?: ReadonlyArray<Profile['key']> }> = [
  { name: 'Culture Quiz', open: openCultureQuiz, smoke: ['phone', 'tablet'] },
  { name: 'Tap & Respond', open: openTapRespond },
  { name: 'Odd One Out', open: openOddOneOut, stateful: true, smoke: ['phone'] },
  { name: 'Read Pick', open: openReadPick, stateful: true },
  { name: 'Realia Read', open: openRealiaRead, stateful: true },
  { name: 'Daily Review', open: openDailyReview, stateful: true, smoke: ['phone'] },
];

for (const profile of PROFILES) {
  test.describe(`answer boards, the touch matrix, ${profile.name} (AMENDMENTS-TOUCH KT-11, section 11.2)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the learner journey');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    for (const board of BOARDS.filter((b) => FULL_MATRIX || b.smoke?.includes(profile.key))) {
      test(`${board.name}: every distance of the matrix commits; outside, slide and drag commit nothing`, async ({ page }) => {
        test.setTimeout(240_000);
        await board.open(page, profile);
        const touch = await Touchscreen.of(page);
        await runMatrix(page, touch, {
          name: board.name,
          statefulAnswers: board.stateful,
          grazes: FULL_MATRIX ? MATRIX_ALL : undefined,
          restart: () => board.open(page, profile),
          note: (type, description) => test.info().annotations.push({ type, description }),
        });
      });
    }
  });
}

/**
 * The fit audit (section 11.2, report only): which boards hold their screen at 320 x 640 at the default and at the
 * largest text size. A graze no longer depends on it (KT-D3), so this reports and never fails; a screen that fits also
 * keeps a touch in a gap safe from a vertical pan.
 */
test.describe('answer boards, the fit audit at 320 x 640 (AMENDMENTS-TOUCH KT-11, section 11.2)', () => {
  test.skip(FIXTURE_BUILD || !FULL_MATRIX, 'the release build, and E2E_TOUCH_MATRIX=full: a report, not a check');
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  for (const board of BOARDS) {
    test(`${board.name}: fits or scrolls at the default and the largest text`, async ({ page }) => {
      test.setTimeout(240_000);
      const cells: string[] = [];
      for (const profile of [{ ...PROFILES[0], largest: false }, PROFILES[0]]) {
        await board.open(page, profile);
        await page.waitForTimeout(2_000);
        const fit = await fitOf(page);
        cells.push(`${profile.largest ? 'largest' : 'default'} text: ${fit.fits ? 'fits' : `scrolls ${Math.round(fit.room)} px`}`);
      }
      const row = `${board.name}: ${cells.join('; ')}`;
      await test.info().attach('fit-audit.txt', { body: row, contentType: 'text/plain' });
      test.info().annotations.push({ type: 'fit', description: row });
    });
  }
});

/**
 * The target ratchet in the three languages (section 11.2): the guest's first quest reaches Match Sound and the Check's
 * Listen & Pick without an account, so each is measured at 320 x 640 with the largest text in en, es and ko (the longest
 * labels). The journey boards above are measured in en, whose recipes name their buttons in English.
 */
for (const locale of FULL_MATRIX ? (['en', 'es', 'ko'] as const) : (['es', 'ko'] as const)) {
  test.describe(`guest quest boards, the 64 px floor, ${locale} (AMENDMENTS-TOUCH KT-11, section 11.2)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the guest quest');
    test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
    const m = getMessages(locale);

    /** The guest's first quest from its start to the launcher card of its first game. */
    async function toLauncher(page: Page): Promise<void> {
      await page.goto('/');
      await seedStored(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
      await page.goto('/?try=1');
      const play = page.getByRole('button', { name: m.learner.quest.launcher.game.play.cta, exact: true });
      const next = page.getByRole('button', { name: m.learner.quest.continue.cta, exact: true });
      // Continue through the intro and Discover until the game card shows (no page text of the language is read).
      for (let i = 0; i < 20 && !(await play.isVisible()); i += 1) {
        if (await next.isVisible()) await next.click();
        await page.waitForTimeout(250);
      }
      await expect(play).toBeVisible();
    }

    test('Match Sound and Listen & Pick answers are at least 64 x 64', async ({ page }) => {
      test.setTimeout(120_000);
      await toLauncher(page);
      await page.getByRole('button', { name: m.learner.quest.launcher.game.play.cta, exact: true }).click();
      await expect(page.getByTestId('match-sound-tiles').first()).toBeVisible();
      await page.waitForTimeout(1_500);
      expect(await expectTargets(page, `Match Sound (${locale})`)).toBe(4);
      // Past the game, the Check: Skip the game, then Go.
      await page.goto('/');
      await toLauncher(page);
      const skip = page.getByRole('button', { name: m.learner.quest.launcher.game.skip.cta, exact: true });
      await skip.click();
      await skip.click();
      await page.getByRole('button', { name: m.learner.quest.launcher.check.go.cta, exact: true }).click();
      await expect(page.locator('[data-testid^="listen-pick-option-"]').first()).toBeVisible();
      await page.waitForTimeout(1_500);
      expect(await expectTargets(page, `Listen & Pick (${locale})`)).toBeGreaterThanOrEqual(3);
    });
  });
}
