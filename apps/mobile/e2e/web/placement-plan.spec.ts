import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, waitForSaved } from './helpers';
import { shot } from './shots';

/**
 * F-PLC-001 P-7b (section 3.1 step 7, section 3.9, AM-5, AM-10, AM-23; wireframes
 * placement/result.md, placement/report.md and journey/my-route-overview.md J1, K2, K3): the
 * result screen's weekly-plan strip, Just start, and the report's "Suggested weekly plan" card
 * with Update the plan after a retake. Everything lives behind `flags.routeEnabled` (off), so
 * this suite runs on a fixture bundle exported with the flag on, into a directory of its own:
 *
 *   EXPO_PUBLIC_ROUTE_ENABLED=true node scripts/build-web-fixtures.mjs dist-e2e-route
 *   E2E_ROUTE=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test placement-plan
 *     (with the web server pointed at dist-e2e-route/)
 *
 * Metro caches the inlined `EXPO_PUBLIC_*` values: export with a Metro cache of its own (TMPDIR)
 * or `--clear` when switching the flag. P-10 adds this flow to the nightly run with the flag flip.
 */

const ROUTE = process.env.E2E_ROUTE === '1' && process.env.STORY_FIXTURES === '1';
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on these screens: a product or price word, a score shape, shame words. */
const NEVER = /premium|\$|\bprice\b|\bbuy\b|upgrade|%|\d\s*\/\s*\d|\bbehind\b|\blate\b|\bmissed\b|\bfailed\b/i;

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
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Type a name').fill('Sam');
  await page.getByRole('radio', { name: /^Some reading/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  await expect(page.getByText('Hi, Sam!')).toBeVisible();
  return (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
}

/** A short run: one answer, then "That is enough" (the result keeps the opening start). */
async function runACheck(page: Page): Promise<void> {
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
}

/** A stored result as the app writes it. */
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
    responses: [{ questionId: 'pitem:sound-basic-hear-a', outcome: 'correct', chosenOptionId: 'a', assisted: false, ms: 1500 }],
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
    startQuestId: 'quest:stage1-letters-q1',
    placedOutQuestIds: [],
    priorityTokens: [],
    needsStage: null,
    stopReason: 'complete',
    ...over,
  };
}

async function seedResults(page: Page, profileId: string, results: Record<string, unknown>[]): Promise<void> {
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
  await seedStored(page, `progress:${profileId}`, { ...progress, placements: results });
}

async function openReport(page: Page, profileId: string): Promise<void> {
  await hook(page);
  await page.evaluate((id) => (window as E2eWindow).__hrPlacementE2E?.openReport(id), profileId);
  await expect(page.getByTestId('placement-report')).toBeVisible();
}

test.describe('the weekly plan after the level check (route flag on)', () => {
  test.skip(!ROUTE, 'runs on the fixture bundle exported with EXPO_PUBLIC_ROUTE_ENABLED=true (E2E_ROUTE=1, STORY_FIXTURES=1)');

  test('self: the strip with the pace chips; Use this plan makes the plan with one tap and opens the start quest', async ({ page }) => {
    const id = await onboardSelf(page);
    await runACheck(page);
    const strip = page.getByTestId('placement-plan-strip');
    await expect(strip).toBeVisible();
    await expect(strip.getByText('Hoya made a weekly plan for you')).toBeVisible();
    // Steady is pre-selected for "Some reading" (OD-13).
    await expect(page.getByTestId('placement-plan-pace-steady')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('placement-plan-basis')).toHaveText(/^\d+ (weeks|months), 3 days a week, about 15 minutes a day$/);
    // Four actions; Use this plan is the only primary, no pinned Start.
    await expect(page.getByTestId('placement-result-primary')).toHaveCount(0);
    await expect(page.getByTestId('placement-plan-change')).toBeVisible();
    await expect(page.getByTestId('placement-plan-just-start')).toBeVisible();
    await expect(page.getByTestId('placement-link-forGrownUps')).toBeVisible();
    const text = await screenText(page);
    expect(text).not.toMatch(NEVER);
    expect(text).not.toMatch(EMOJI);
    await page.getByTestId('placement-link-forGrownUps').scrollIntoViewIfNeeded();
    await shot(page, 'placement-plan-strip');

    await page.getByTestId('placement-plan-pace-brisk').click();
    await expect(page.getByTestId('placement-plan-pace-brisk')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('placement-plan-basis')).toContainText('4 days a week');
    await page.getByTestId('placement-plan-use').click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect
      .poll(async () => (await readStored<{ selfRoute?: { meta: { params: { sessionsPerWeek: number } } } }>(page, `progress:${id}`))?.selfRoute?.meta.params.sessionsPerWeek)
      .toBe(4);
    const names = (await events(page)).map((e) => e.name);
    expect(names).toContain('route.proposed');
    expect(names).toContain('route.created');
  });

  test('self: Just start plays at once and hides the plan for now', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const id = await onboardSelf(page);
    await runACheck(page);
    await expect(page.getByTestId('placement-plan-strip')).toBeVisible();
    await page.getByTestId('placement-plan-just-start').scrollIntoViewIfNeeded();
    await shot(page, 'placement-plan-strip-320');
    // A double tap skips (and counts the skip) once.
    await page.getByTestId('placement-plan-just-start').dblclick();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect.poll(async () => (await readStored<{ dismissedAt?: string }>(page, `route-ui:${id}`))?.dismissedAt).toBeTruthy();
    expect((await events(page)).filter((e) => e.name === 'route.proposal_skipped')).toEqual([
      expect.objectContaining({ profileId: id, payload: { source: 'placement' } }),
    ]);
    expect((await readStored<{ selfRoute?: unknown }>(page, `progress:${id}`))?.selfRoute ?? null).toBeNull();
  });

  test('child: the report opens with the Suggested weekly plan card, Use this plan, then Update the plan after a later check', async ({ page }) => {
    await onboardChild(page, { name: 'Dani', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    const id = (await readStored<string>(page, 'profiles:active')) as string;
    await seedResults(page, id, [storedResult({})]);
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await openReport(page, id);
    const card = page.getByTestId('placement-report-plan');
    await expect(card).toBeVisible();
    await expect(card.getByText('Suggested weekly plan for Dani')).toBeVisible();
    await expect(page.getByTestId('placement-report-plan-basis')).toHaveText(/^Based on: Hangul · At the beginning, 3 days a week, 15 minutes$/);
    await expect(page.getByTestId('placement-report-plan-pace-steady')).toHaveAttribute('aria-checked', 'true');
    // The three lengths, the suggested one selected.
    const selected = page.locator('[data-testid^="placement-report-plan-length-"][aria-checked="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText('Suggested');
    const text = await screenText(page);
    expect(text).not.toMatch(NEVER);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'placement-report-plan-card');
    await page.getByTestId('placement-report-plan-not-now').scrollIntoViewIfNeeded();
    await shot(page, 'placement-report-plan-card-actions');

    await page.getByTestId('placement-report-plan-length-6-month').click();
    await page.getByTestId('placement-report-plan-use').click();
    await expect(page.getByTestId('placement-report-plan-done')).toHaveText('Dani has a weekly plan now. It shows on Home.');
    await expect
      .poll(async () => (await readStored<{ selfRoute?: { meta: { params: { weeks: number } } } }>(page, `progress:${id}`))?.selfRoute?.meta.params.weeks)
      .toBe(26);
    expect((await events(page)).filter((e) => e.name === 'route.proposed')).toEqual([
      expect.objectContaining({ profileId: id, payload: expect.objectContaining({ source: 'parent', kind: 'new' }) }),
    ]);

    // A newer check that places out the first six lessons: Update the plan.
    const placedOut = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3'];
    const now = new Date().toISOString();
    const stored = (await readStored<{ placements: unknown[] }>(page, `progress:${id}`)) as { placements: Record<string, unknown>[] };
    await seedStored(page, `progress:${id}`, {
      ...stored,
      placements: [
        ...stored.placements,
        storedResult({ id: 'placement:later', startedAt: now, completedAt: now, level: { stage: 'stage1', band: 2 }, startQuestId: 'quest:stage1-rites-q1', placedOutQuestIds: placedOut }),
      ],
    });
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await openReport(page, id);
    await expect(page.getByTestId('placement-report-plan-update')).toContainText("Dani's newest check found a later place to start.");
    await shot(page, 'placement-report-plan-update');
    await page.getByTestId('placement-report-plan-update-cta').click();
    await expect(page.getByTestId('placement-report-plan-done')).toHaveText('The weekly plan moved ahead.');
    await expect
      .poll(async () => (await readStored<{ selfRoute?: { meta: { params: { level: { band: number }; weeks: number } } } }>(page, `progress:${id}`))?.selfRoute?.meta.params)
      .toMatchObject({ level: { band: 2 }, weeks: 26 });
    expect((await events(page)).filter((e) => e.name === 'route.updated')).toEqual([
      expect.objectContaining({ profileId: id, payload: expect.objectContaining({ source: 'retake' }) }),
    ]);
  });

  test('self: a later check with a plan offers Update my plan; Keep my plan folds into Start, Update my plan re-seeds and plays', async ({ page }) => {
    const id = await onboardSelf(page);
    await runACheck(page);
    await page.getByTestId('placement-plan-use').click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect.poll(async () => (await readStored<{ selfRoute?: unknown }>(page, `progress:${id}`))?.selfRoute ?? null).not.toBeNull();

    // A stored check that places out the first six lessons, then a new check: the plan is behind.
    const placedOut = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3'];
    const now = new Date().toISOString();
    const stored = (await readStored<{ placements: unknown[] }>(page, `progress:${id}`)) as { placements: Record<string, unknown>[] };
    await seedStored(page, `progress:${id}`, {
      ...stored,
      placements: [
        ...stored.placements,
        storedResult({ id: 'placement:later', startedAt: now, completedAt: now, level: { stage: 'stage1', band: 2 }, startQuestId: 'quest:stage1-rites-q1', placedOutQuestIds: placedOut }),
      ],
    });
    await page.goto('/');
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await runACheck(page);
    await expect(page.getByTestId('placement-plan-update')).toBeVisible();
    // The one primary sits in the card; no pinned Start, no strip.
    await expect(page.getByTestId('placement-result-primary')).toHaveCount(0);
    await expect(page.getByTestId('placement-plan-strip')).toHaveCount(0);
    expect(await screenText(page)).not.toMatch(NEVER);
    await page.getByTestId('placement-plan-keep').click();
    await expect(page.getByTestId('placement-plan-update')).toHaveCount(0);
    await expect(page.getByText('Your plan stays right where it is.')).toBeVisible();
    await expect(page.getByTestId('placement-result-primary')).toBeVisible();
    await expect.poll(async () => (await readStored<{ keptFor?: string }>(page, `route-ui:${id}`))?.keptFor).toBeTruthy();

    // The next check brings the update back (a new change); Update my plan re-seeds and opens the quest.
    await page.goto('/');
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await runACheck(page);
    await page.getByTestId('placement-plan-update-cta').click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    await expect
      .poll(async () => (await readStored<{ selfRoute?: { meta: { params: { level: { band: number } } } } }>(page, `progress:${id}`))?.selfRoute?.meta.params.level.band)
      .toBe(2);
    expect((await events(page)).filter((e) => e.name === 'route.updated')).toEqual([
      expect.objectContaining({ profileId: id, payload: expect.objectContaining({ source: 'retake' }) }),
    ]);
  });

  test('report: Not now hides the card (the report card only)', async ({ page }) => {
    const id = await onboardSelf(page);
    await seedResults(page, id, [storedResult({})]);
    await page.goto('/');
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    await openReport(page, id);
    await expect(page.getByTestId('placement-report-plan')).toBeVisible();
    await page.getByTestId('placement-report-plan-not-now').click();
    await expect(page.getByTestId('placement-report-plan')).toHaveCount(0);
    await expect.poll(async () => (await readStored<{ reportDismissedAt?: string }>(page, `route-ui:${id}`))?.reportDismissedAt).toBeTruthy();
    expect((await readStored<{ dismissedAt?: string }>(page, `route-ui:${id}`))?.dismissedAt).toBeUndefined();
  });
});
