import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, waitForSaved } from './helpers';
import { shot } from './shots';

/**
 * F-PLC-001 P-8: the grown-up report of the level check and "Choose a
 * different start". The entry points stay behind `flags.placementEnabled`
 * (off), so this suite reaches the report from the result screen's "For
 * grown-ups" link after a real check, or through the fixture bundle's
 * `window.__hrPlacementE2E.openReport(profileId)` with a seeded result:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test placement-report
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on the report: a percent, a ratio, a count out of six, comparison or purchase words. */
const FORBIDDEN = /%|\d\s*\/\s*\d|of 6\b|\bfirst (time|try)\b|\bbehind\b|other learners|premium|\$|\bbuy\b|upgrade/i;

type E2eWindow = Window & {
  __hrPlacementE2E?: {
    open(source: string): void;
    openReport(profileId: string): void;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
};

const screenText = (page: Page): Promise<string> => page.evaluate(() => document.body.innerText);
const events = (page: Page) => page.evaluate(() => (window as E2eWindow).__hrPlacementE2E?.events() ?? []);

async function hook(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrPlacementE2E), undefined, { timeout: 10_000 });
}

async function onboardSelf(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByRole('radio', { name: /^Me\./ }).click();
  await page.getByPlaceholder('Type a name').fill('Sam');
  await page.getByRole('radio', { name: /^Some reading/ }).click();
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  await expect(page.getByText('Hi, Sam!')).toBeVisible();
  return (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
}

const response = (questionId: string, outcome: 'correct' | 'wrong' | 'skipped') => ({
  questionId,
  outcome,
  chosenOptionId: outcome === 'skipped' ? null : 'a',
  assisted: false,
  ms: 1500,
});
const row = (gate: string, form: string, result: string, correct: number, extra: Record<string, unknown> = {}) => ({
  gate,
  form,
  asked: 3,
  correct,
  assisted: 0,
  result,
  ...extra,
});

/** A stored result as the app writes it; only what the report reads differs between cases. */
function storedResult(over: Record<string, unknown>) {
  return {
    id: 'placement:seeded',
    startedAt: '2026-10-09T10:00:00.000Z',
    completedAt: '2026-10-09T10:06:00.000Z',
    source: 'home',
    testLocale: 'en',
    length: 'full',
    mode: 'standard',
    revealMode: 'tap',
    bankVersion: 1,
    contentVer: 'e2e',
    responses: [response('pitem:sound-basic-hear-a', 'correct')],
    gates: [],
    strands: {
      'hangul-recognition': 'not-tested',
      'sound-letter': 'not-tested',
      'syllable-reading': 'not-tested',
      vocabulary: 'not-tested',
      sentences: 'not-tested',
    },
    level: { stage: 'stage1', band: 0 },
    oralStage: null,
    beyondContent: false,
    startQuestId: null,
    placedOutQuestIds: [],
    priorityTokens: [],
    needsStage: null,
    stopReason: 'complete',
    ...over,
  };
}

async function seedResult(page: Page, profileId: string, result: Record<string, unknown>): Promise<void> {
  const progress = (await readStored<Record<string, unknown>>(page, `progress:${profileId}`)) ?? {
    profileId,
    updatedAt: '2026-10-09T10:00:00.000Z',
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
  await seedStored(page, `progress:${profileId}`, { ...progress, placements: [result] });
}

async function openReport(page: Page, profileId: string): Promise<void> {
  await hook(page);
  await page.evaluate((id) => (window as E2eWindow).__hrPlacementE2E?.openReport(id), profileId);
  await expect(page.getByTestId('placement-report')).toBeVisible();
}

test.describe('placement report (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'runs on the fixture bundle (STORY_FIXTURES=1, dist-e2e/)');

  test('from the result: the report, a different start, the override stored and announced', async ({ page }) => {
    const id = await onboardSelf(page);
    await hook(page);
    await page.evaluate(() => (window as E2eWindow).__hrPlacementE2E?.open('home'));
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await page.getByTestId('placement-guide-tap').click();
    await page.getByTestId('placement-next').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
    await page.getByTestId('placement-warmup-option-rice').click();
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await page.getByTestId('placement-exit').click();
    await page.getByTestId('placement-enough').click();
    await expect(page.getByTestId('placement-result')).toBeVisible();

    // "For grown-ups": a self-only device without a PIN opens the report at once.
    await page.getByTestId('placement-link-forGrownUps').click();
    await expect(page.getByTestId('placement-report')).toBeVisible();
    await expect(page.getByText('Starting spot', { exact: true })).toBeVisible();
    await expect(page.getByTestId('placement-report-level')).toHaveText('Hangul · At the beginning');
    await expect(page.getByText('What we saw')).toBeVisible();
    await expect(page.getByTestId('placement-report-strand-sound-letter')).toBeVisible();
    await expect(page.getByText('The check ended early, so some parts were not reached.')).toBeVisible();
    await expect(page.getByText(/^The level check looks at reading and listening\./)).toBeVisible();
    await expect(page.getByTestId('placement-report-start-quest')).toBeVisible();
    await expect(page.getByTestId('placement-report-retake')).toHaveText('Take the check again');
    const text = await screenText(page);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'placement-report-standard');

    // Choose a different start: the current start is selected, Save waits for another pick.
    const before = await readStored<{ quests: unknown[]; cards: unknown[] }>(page, `progress:${id}`);
    const startTitle = (await page.getByTestId('placement-report-start-quest').innerText()).trim();
    await page.getByTestId('placement-report-choose').click();
    await expect(page.getByTestId('placement-report-sheet')).toBeVisible();
    await expect(page.getByTestId('placement-report-sheet-save')).toBeDisabled();
    await expect(page.getByRole('radio', { name: `${startTitle}, starts here` })).toHaveAttribute('aria-checked', 'true');
    await shot(page, 'placement-report-choose-start');
    const second = page.locator('[data-testid^="placement-report-choice-"]').nth(1);
    const chosenId = ((await second.getAttribute('data-testid')) ?? '').replace('placement-report-choice-', '');
    await second.click();
    await page.getByTestId('placement-report-sheet-save').click();
    await expect(page.getByTestId('placement-report-sheet')).toHaveCount(0);
    await expect(page.getByTestId('placement-report-saved')).toHaveText('The start is changed.');
    await expect(page.getByText('Changed by a grown-up')).toBeVisible();

    await expect
      .poll(async () => (await readStored<{ placements?: Array<{ override?: { startQuestId: string } }> }>(page, `progress:${id}`))?.placements?.[0]?.override?.startQuestId)
      .toBe(chosenId);
    const progress = await readStored<{ quests: unknown[]; cards: unknown[] }>(page, `progress:${id}`);
    // Only the placement record changed: no quest, no card.
    expect(progress?.quests ?? []).toEqual(before?.quests ?? []);
    expect(progress?.cards ?? []).toEqual(before?.cards ?? []);
    expect((await events(page)).filter((e) => e.name === 'placement.override_applied')).toEqual([
      expect.objectContaining({ profileId: id, payload: { by: 'parent' } }),
    ]);

    // Back returns to the result underneath.
    await page.getByTestId('placement-report-back').click();
    await expect(page.getByTestId('placement-result')).toBeVisible();
  });

  test('a Short result: not tested (short check), the hint and Try the standard check', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const id = await onboardSelf(page);
    await seedResult(
      page,
      id,
      storedResult({
        mode: 'short',
        length: 'quick',
        responses: [
          response('pitem:sound-basic-hear-a', 'correct'),
          response('pitem:sound-basic-hear-giyeok', 'correct'),
          response('pitem:sound-basic-hear-eo', 'wrong'),
          response('pitem:syl-cv-hear-ga', 'correct'),
          response('pitem:syl-cv-hear-geo', 'correct'),
          response('pitem:syl-cv-hear-go', 'skipped'),
        ],
        gates: [row('sound-basic', 'decode', 'pass', 2), row('syl-cv', 'decode', 'fail', 2), row('vocab', 'oral', 'pass', 3)],
        strands: {
          'hangul-recognition': 'not-tested',
          'sound-letter': 'getting-there',
          'syllable-reading': 'getting-there',
          vocabulary: 'secure',
          sentences: 'not-tested',
        },
      }),
    );
    await openReport(page, id);
    await expect(page.getByText('not tested (short check)')).toHaveCount(2);
    await expect(page.getByText('Shapes of letters and sentences are not part of the short check.')).toBeVisible();
    await expect(page.getByText('First letter sounds, reading: 2 of 3')).toBeVisible();
    // Letters drawn as taught Korean with their sound value: right ones known, a miss new for now.
    await expect(page.getByTestId('placement-report-strand-sound-letter').getByTestId('placement-report-known')).toBeVisible();
    await expect(page.getByTestId('placement-report-strand-sound-letter').getByTestId('placement-report-new')).toContainText('eo');
    await expect(page.getByTestId('placement-report-short-hint')).toContainText(
      'The short check looks at the first letters only. The standard check can find a later starting spot.',
    );
    await expect(page.getByTestId('placement-report-try-standard')).toBeVisible();
    const text = await screenText(page);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'placement-report-short-320');

    // Try the standard check opens the check with Standard pre-selected (defaultMode rule 1).
    await page.getByTestId('placement-report-try-standard').click();
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
  });

  test('a Deep result on a child profile: status words, checked twice, tiles; the hidden-guide retake', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await page.goto('/');
    const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    await seedResult(
      page,
      id,
      storedResult({
        mode: 'deep',
        responses: [
          response('pitem:recog-odd-giyeok-nieun', 'correct'),
          response('pitem:sound-basic-hear-a', 'correct'),
          response('pitem:sound-basic-hear-giyeok', 'correct'),
          response('pitem:syl-cv-hear-ga', 'correct'),
          response('pitem:syl-cv-build-ga', 'correct'),
          response('pitem:syl-cv-build-na', 'wrong'),
        ],
        gates: [
          row('recog', 'decode', 'pass', 3),
          row('sound-basic', 'decode', 'pass', 3),
          row('syl-cv', 'decode', 'pass', 2),
          row('sound-basic', 'decode', 'pass', 2),
          row('syl-cv', 'decode', 'not-run', 0, { asked: 1, reason: 'stopped' }),
          row('vocab', 'oral', 'pass', 3),
        ],
        strands: {
          'hangul-recognition': 'secure',
          'sound-letter': 'getting-there',
          'syllable-reading': 'getting-there',
          vocabulary: 'secure',
          sentences: 'not-tested',
        },
        level: { stage: 'stage1', band: 1 },
        stopReason: 'quit',
      }),
    );
    await openReport(page, id);
    await expect(page.getByTestId('placement-report-level')).toHaveText('Hangul · Letters and sounds');
    await expect(page.getByText('First letter sounds, reading: secure, checked twice')).toBeVisible();
    await expect(page.getByText('Simple syllables, reading: secure, not finished')).toBeVisible();
    await expect(page.getByTestId('placement-report-tiles')).toContainText('Spelling with tiles');
    await expect(page.getByTestId('placement-report-tiles')).toContainText('getting there');
    await expect(page.getByTestId('placement-report-retry-hidden')).toHaveCount(0);
    await expect(page.getByTestId('placement-report-short-hint')).toHaveCount(0);
    let text = await screenText(page);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'placement-report-deep-child');

    // Reading not tested (the sound guide was always shown): on a child profile the retake offer is here.
    await seedResult(
      page,
      id,
      storedResult({
        mode: 'deep',
        revealMode: 'always',
        responses: [response('pitem:recog-odd-giyeok-nieun', 'correct'), response('pitem:vocab-hear-bap', 'correct')],
        gates: [row('recog', 'decode', 'pass', 3), row('vocab', 'oral', 'pass', 3), row('sentence', 'oral', 'pass', 2)],
        strands: {
          'hangul-recognition': 'secure',
          'sound-letter': 'not-tested',
          'syllable-reading': 'not-tested',
          vocabulary: 'secure',
          sentences: 'secure',
        },
      }),
    );
    await openReport(page, id);
    await expect(page.getByText('Reading was not checked: the sound guide was set to always show.')).toBeVisible();
    await expect(page.getByTestId('placement-report-retry-hidden')).toHaveText('Try it with the sound guide hidden');
    await expect(page.getByTestId('placement-report-known')).toHaveCount(0);
    text = await screenText(page);
    expect(text).not.toMatch(FORBIDDEN);
    await shot(page, 'placement-report-not-tested-child');
  });

  test('no check yet: the empty state and the take-it button', async ({ page }) => {
    const id = await onboardSelf(page);
    await openReport(page, id);
    await expect(page.getByTestId('placement-report-empty')).toHaveText('No check taken yet.');
    await expect(page.getByTestId('placement-report-retake')).toHaveText('Take the level check');
    await shot(page, 'placement-report-empty');
    await page.getByTestId('placement-report-retake').click();
    await expect(page.getByTestId('placement-options')).toBeVisible();
  });
});
