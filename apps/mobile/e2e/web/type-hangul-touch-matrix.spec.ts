import type { Page } from '@playwright/test';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, seedStored } from './helpers';
import { Touchscreen } from './touch';
import { FULL_MATRIX, MATRIX, clearDevice, expectTargets, fitOf, runMatrix } from './touch-matrix';

/**
 * AMENDMENTS-TOUCH row KT-11, section 11.2: the graze matrix (`touch-matrix.ts`) on the answer boards that only the
 * fixture bundle reaches, through the e2e hooks of their own suites: Cloze Pick (`window.__hrClozePickE2E`), the
 * vocabulary question (`window.__hrVocabE2E`) and Story Check inside the fixture story's quest (`window.__hrStoryE2E`).
 * The release-build boards are in `touch-matrix.spec.ts`.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-touch-matrix
 *
 * Named under `type-hangul` so the fixture e2e run in web-app.yml selects it (the precedent of the KT-1 and KT-2 specs).
 * CI runs the smoke set (`smoke` on a board below), as in `touch-matrix.spec.ts`; `E2E_TOUCH_MATRIX=full` runs every board
 * at both profiles with all nine grazes, and the fit audit.
 *
 * Profiles of section 11.2: 320 x 640 with touch and the largest text size, and the 820 x 1180 tablet.
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

type E2eWindow = Window & {
  __hrClozePickE2E?: { open(params: { rounds: Array<'word' | 'particle' | 'value'> }): void };
  __hrVocabE2E?: { openQuestion(params: { format: 'word-to-image' | 'image-to-word' | 'audio-to-image'; mode: 'speed' | 'check'; optionCount?: 3 | 4 }): void };
  __hrStoryE2E?: { openQuest(p: { questId: string; episodeId: string }): void };
};

/** The profile's text size and the UI language, seeded when either is not the default. */
async function textSize(page: Page, profile: Profile, locale: UiLocale = 'en'): Promise<void> {
  if (profile.largest || locale !== 'en') await seedStored(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-16T09:00:00.000Z', ...(profile.largest ? { textSize: 'largest' } : {}) });
}

const hidePwaBanner = (page: Page): Promise<unknown> => page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });

/** Cloze Pick on three fixture rounds, switched on by a stored remote copy (as `sentence-builder-cloze-pick.spec.ts`). */
async function openClozePick(page: Page, profile: Profile, locale: UiLocale = 'en'): Promise<void> {
  await page.goto('/');
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.cloze-pick': { on: true, pct: 100 } } });
  await textSize(page, profile, locale);
  await page.reload();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrClozePickE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() => (window as E2eWindow).__hrClozePickE2E?.open({ rounds: ['word', 'particle', 'value'] }));
  await expect(page.getByTestId('cloze-pick-tiles')).toBeVisible();
  await hidePwaBanner(page);
}

/** The shared vocabulary question, one word with four picture or word cards, in the quick check's mode (a miss stays open). */
async function openVocabQuestion(page: Page, profile: Profile, locale: UiLocale = 'en'): Promise<void> {
  await page.goto('/');
  await textSize(page, profile, locale);
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.openQuestion({ format: 'word-to-image', mode: 'check', optionCount: 4 }));
  await expect(page.getByTestId('vocab-question-options')).toBeVisible();
  await hidePwaBanner(page);
  // The first gesture unlocks sound on the web (F-AUDIO-004 section 3.6) and brings in the no-voice notice: a click on the empty canvas.
  await page.mouse.click(2, 2);
}

/** The fixture story's check step (three items), reached from a fresh learner as `story-checks.spec.ts` does. */
async function openStoryCheck(page: Page, profile: Profile, locale: UiLocale = 'en'): Promise<void> {
  const m = getMessages(locale);
  await clearDevice(page, test.info().project.use.baseURL);
  await keepSidewaysIfAsked(page);
  // The sign-up form is English; the language and the text size are set once the learner exists.
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await textSize(page, profile, locale);
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId: 'quest:story-hangul-day-listen', episodeId: 'episode:shelf-hangul-day' }));
  await page.getByRole('button', { name: m.learner.quest.continue.cta, exact: true }).click();
  await page.getByRole('button', { name: m.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await page.getByRole('button', { name: m.learner.quest.launcher.game.play.cta, exact: true }).click();
  await expect(page.getByTestId('story-check-prompt')).toBeVisible();
}

/** After a right answer the item waits on its Next; the last item's Next ends the step. */
async function storyCheckNext(page: Page): Promise<boolean> {
  const next = page.getByTestId('story-check-next');
  if (!(await next.isVisible())) return false;
  await next.click();
  return true;
}

const BOARDS: ReadonlyArray<{ name: string; open: (page: Page, profile: Profile) => Promise<void>; stateful?: boolean; smoke?: ReadonlyArray<Profile['key']>; onIdle?: (page: Page) => Promise<boolean>; maxRestarts?: number }> = [
  { name: 'Cloze Pick', open: openClozePick, stateful: true, smoke: ['phone'] },
  { name: 'Vocabulary question', open: openVocabQuestion, stateful: true, maxRestarts: 4 },
  { name: 'Story Check', open: openStoryCheck, stateful: true, onIdle: storyCheckNext, maxRestarts: 3 },
];

for (const profile of PROFILES) {
  test.describe(`answer boards on fixtures, the touch matrix, ${profile.name} (AMENDMENTS-TOUCH KT-11, section 11.2)`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    for (const board of BOARDS.filter((b) => FULL_MATRIX || b.smoke?.includes(profile.key))) {
      test(`${board.name}: every distance of the matrix commits; outside, slide and drag commit nothing`, async ({ page }) => {
        test.setTimeout(240_000);
        await board.open(page, profile);
        const touch = await Touchscreen.of(page);
        await runMatrix(page, touch, {
          name: board.name,
          statefulAnswers: board.stateful,
          grazes: FULL_MATRIX ? MATRIX.length : undefined,
          maxRestarts: board.maxRestarts,
          onIdle: board.onIdle === undefined ? undefined : () => board.onIdle!(page),
          restart: () => board.open(page, profile),
          note: (type, description) => test.info().annotations.push({ type, description }),
        });
      });
    }
  });
}

/**
 * The target ratchet in the other two languages (section 11.2): these boards at 320 x 640 with the largest text in es and
 * ko, whose labels are the longest. (en is measured inside every matrix run above.)
 */
for (const locale of ['es', 'ko'] as const) {
  test.describe(`answer boards on fixtures, the 64 px floor, ${locale} (AMENDMENTS-TOUCH KT-11, section 11.2)`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
    test.use({ viewport: PROFILES[0].viewport, hasTouch: true, isMobile: true });

    for (const [name, open] of [
      ['Cloze Pick', openClozePick],
      ['Vocabulary question', openVocabQuestion],
      ['Story Check', openStoryCheck],
    ] as const) {
      test(`${name} answers are at least 64 x 64`, async ({ page }) => {
        test.setTimeout(90_000);
        await open(page, PROFILES[0], locale);
        await page.waitForTimeout(1_500);
        await expectTargets(page, `${name} (${locale})`);
      });
    }
  });
}

/** The fit audit (section 11.2, report only) for these boards: fits or scrolls at 320 x 640, at the default and the largest text. */
test.describe('answer boards on fixtures, the fit audit at 320 x 640 (AMENDMENTS-TOUCH KT-11, section 11.2)', () => {
  test.skip(!FIXTURE_BUILD || !FULL_MATRIX, 'needs the fixture bundle (STORY_FIXTURES=1) and E2E_TOUCH_MATRIX=full: a report, not a check');
  test.use({ viewport: PROFILES[0].viewport, hasTouch: true, isMobile: true });

  for (const board of BOARDS) {
    test(`${board.name}: fits or scrolls at the default and the largest text`, async ({ page }) => {
      test.setTimeout(120_000);
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
