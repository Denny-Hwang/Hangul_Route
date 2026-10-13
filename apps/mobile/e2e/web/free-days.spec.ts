import { CATALOG, freeRouteDays, routeDaysOf } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { themes } from '../../src/content/stages';
import { expect, test } from './fixtures';
import { answerCheckRounds, journeyCellName, onboardChild, onboardSelf, passDiscover, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-ENT-003 E3-11 (sections 3.7, 3.8, 3.16, 3.17): the free plan end to end on a web build with the
 * free-plan switch on. All of Stage 1 is open (OD-1), Stage 2 onward is a preview with the dotted
 * Not open yet ring, the ask goes to the grown-up gate (family device) or straight to the Plan
 * screen (self-only device with no PIN), the end of the free lessons is celebrated once on Results
 * and Home then offers the practice card, and a lesson finished before the switch stays open.
 * Phone (320 x 568) and tablet (1180 x 820), and offline once the app is cached.
 *
 * The switch is a build flag, so the switch-on half runs only against such a build (the
 * switch-on lane of the owner runbook, docs/launch/owner-runbook.md, "Turn on the free plan (web)"):
 *
 *   EXPO_PUBLIC_CONTENT_GATING_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_CONTENT_GATING=1 pnpm --filter @hangul-route/mobile exec playwright test free-days
 *
 * Direct navigation to a closed quest (the QuestPlayer guard) needs the fixture bundle's e2e hook,
 * `__hrStoryE2E.openQuest`, so that case runs on the gating fixture bundle:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures:gated
 *   STORY_FIXTURES_GATED=1 pnpm --filter @hangul-route/mobile exec playwright test free-days
 *
 * CI runs the release build (switch off): every lesson open, no ring and no preview.
 */
const GATED = process.env.E2E_CONTENT_GATING === '1';
const GATED_FIXTURES = process.env.STORY_FIXTURES_GATED === '1';
const access = getMessages('en').learner.access;
const AT = '2026-10-01T00:00:00.000Z';

const DAYS = routeDaysOf(CATALOG);
const FREE = freeRouteDays(CATALOG);
const FREE_IDS = new Set(FREE.map((day) => day.episodeId));
/** Every playable cell past the free stages: the dotted ring goes on these and only these. */
const CLOSED_CELLS = DAYS.filter((day) => !FREE_IDS.has(day.episodeId)).map((day) => `${day.stage}-${day.theme}`);
const FREE_CELLS = FREE.map((day) => `${day.stage}-${day.theme}`);
const LAST_FREE = FREE[FREE.length - 1];
const STAGE2_LIFE = DAYS.find((day) => day.episodeId === 'episode:stage2-life');
const STAGE2_NATURE = DAYS.find((day) => day.episodeId === 'episode:stage2-nature');
const themeTitle = (key: string): string => themes.find((t) => t.key === key)?.titleEn ?? key;
const stageNumber = (stage: string): number => Number(stage.replace('stage', ''));

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 1180, height: 820 },
] as const;

/** Home, with the install guide out of the way. */
async function home(page: Page, name: string, reload = true): Promise<void> {
  if (reload) await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function openJourney(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

async function openCell(page: Page, stage: string, theme: string): Promise<void> {
  await openJourney(page);
  await page.getByRole('button', { name: journeyCellName(stageNumber(stage), themeTitle(theme)) }).click();
}

async function profileId(page: Page): Promise<string> {
  const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

/** Marks quests finished in the learner's snapshot (free tier), then reloads. */
async function seedFinished(page: Page, questIds: Array<{ questId: string; episodeId: string }>): Promise<string> {
  const id = await profileId(page);
  const snapshot = (await readStored<Record<string, unknown>>(page, `progress:${id}`)) ?? { profileId: id, episodes: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
  const quests = questIds.map(({ questId, episodeId }) => ({ questId, episodeId, startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
  await seedStored(page, `tier:${id}`, { tier: 'free', source: null, validUntil: null, fetchedAt: new Date().toISOString() });
  await seedStored(page, `progress:${id}`, { ...snapshot, quests, updatedAt: new Date().toISOString() });
  return id;
}

/** Plays the open quest player to its Results: Discover read, the games skipped, the Check answered. */
async function playToResults(page: Page): Promise<void> {
  const seeResults = page.getByRole('button', { name: 'See results' });
  const discover = page.getByText('Look and learn', { exact: true });
  const skip = page.getByRole('button', { name: 'Skip for now' });
  const go = page.getByRole('button', { name: 'Go', exact: true });
  const cont = page.getByRole('button', { name: 'Continue' });
  for (let step = 0; step < 30; step += 1) {
    if (await seeResults.isVisible()) {
      await seeResults.click();
      return;
    }
    if (await discover.isVisible()) await passDiscover(page);
    else if (await skip.isVisible()) await skip.click();
    else if (await go.isVisible()) {
      await go.click();
      await answerCheckRounds(page);
    } else if (await cont.first().isVisible()) await cont.first().click();
    else await page.waitForTimeout(250);
  }
  throw new Error('the quest never reached See results');
}

test.describe('release build (switch off)', () => {
  test.skip(GATED || GATED_FIXTURES, 'the release build has the switch off');

  test('a new learner: no Not open yet ring on the Journey, and a Stage 2 lesson keeps its Start', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await openJourney(page);
    await expect(page.locator('[data-testid^="journey-ring-notOpen-"]')).toHaveCount(0);
    await expect(page.getByTestId('journey-legend')).not.toContainText(access.notOpen);
    await openCell(page, 'stage2', 'life');
    await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('episode-preview-card')).toHaveCount(0);
  });
});

test.describe('free plan switch on (web)', () => {
  test.skip(!GATED, 'needs a web build with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true (E2E_CONTENT_GATING=1)');

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: rings on the cells past Stage 1 only, and their lesson page is a preview`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.setViewportSize(viewport);
      await onboardChild(page, { name: 'Dami', startJourney: false });
      await home(page, 'Dami');
      await openJourney(page);

      // The dotted ring on every playable cell past Stage 1, none on Stage 1; Next on the first lesson.
      await expect(page.locator('[data-testid^="journey-ring-notOpen-"]')).toHaveCount(CLOSED_CELLS.length);
      for (const cell of CLOSED_CELLS) await expect(page.getByTestId(`journey-ring-notOpen-${cell}`)).toBeAttached();
      for (const cell of FREE_CELLS) await expect(page.getByTestId(`journey-ring-notOpen-${cell}`)).toHaveCount(0);
      await expect(page.getByTestId('journey-next-stage1-letters')).toBeVisible();
      await expect(page.getByTestId('journey-legend')).toContainText(access.notOpen);
      await expect(page.getByText(/locked|premium|trial|price/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await shot(page, `free-days-journey-${viewport.width}`);

      // A closed cell still opens its lesson page: the preview, never a Start.
      if (!STAGE2_NATURE) throw new Error('no stage2-nature route day');
      await page.getByRole('button', { name: journeyCellName(2, themeTitle(STAGE2_NATURE.theme)) }).click();
      const card = page.getByTestId('episode-preview-card');
      await expect(card.getByText(access.preview.line)).toBeVisible();
      await expect(page.getByTestId('episode-quest-not-open').first()).toHaveText(access.notOpen);
      await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
      await expect(card.getByRole('button', { name: access.ask.family })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await shot(page, `free-days-preview-${viewport.width}`);
      expect(errors).toEqual([]);
    });
  }

  test('every Stage 1 lesson is open for a new learner', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    for (const day of FREE) {
      await home(page, 'Dami');
      await openCell(page, day.stage, day.theme);
      await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(day.questIds.length);
      await expect(page.getByTestId('episode-preview-card')).toHaveCount(0);
      await expect(page.getByTestId('episode-quest-not-open')).toHaveCount(0);
    }
  });

  test('family device: the ask on the preview goes through the PIN screen to the Plan screen', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await openCell(page, 'stage4', 'rites');
    await page.getByTestId('episode-preview-ask').click();
    await expect(page.getByRole('heading', { name: 'Grown-up zone' })).toBeVisible();
    await unlockWithPin(page);
    await expect(page.getByText('Dami is on the free plan.')).toBeVisible();
  });

  test('self-only device with no PIN: the ask reads See how to open it and opens the Plan screen directly', async ({ page }) => {
    await onboardSelf(page, { name: 'Alex', startJourney: false });
    await home(page, 'Alex');
    await openCell(page, 'stage2', 'life');
    const ask = page.getByTestId('episode-preview-ask');
    await expect(ask).toHaveText(access.ask.self);
    await ask.click();
    await expect(page.getByText("You're on the free plan.")).toBeVisible();
  });

  test('a Stage 2 lesson finished before the switch stays open to play again; the next one is a preview', async ({ page }) => {
    if (!STAGE2_LIFE) throw new Error('no stage2-life route day');
    await onboardChild(page, { name: 'Mina', startJourney: false });
    await seedFinished(page, STAGE2_LIFE.questIds.map((questId) => ({ questId, episodeId: STAGE2_LIFE.episodeId })));
    await home(page, 'Mina', false);
    await openJourney(page);
    // A cell with a kept quest has no ring; the other Stage 2 cell keeps it.
    await expect(page.getByTestId('journey-ring-notOpen-stage2-life')).toHaveCount(0);
    await expect(page.getByTestId('journey-ring-notOpen-stage2-nature')).toBeAttached();

    await page.getByRole('button', { name: journeyCellName(2, themeTitle('life')) }).click();
    await expect(page.getByRole('heading', { name: 'Lunch Box Words' })).toBeVisible();
    await expect(page.getByTestId('episode-quest-not-open')).toHaveCount(0);
    await expect(page.getByTestId('episode-preview-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play again', exact: true }).first().click();
    // The player keeps the kept quest: it is not sent back to the lesson page.
    await expect(page.getByRole('heading', { name: 'Lunch Box Words' })).toHaveCount(0);
    await playToResults(page);
    await expect(page.getByRole('button', { name: 'Back home' }).first()).toBeVisible();
  });

  test('the last free lesson: the celebration once on Results, then the practice card on Home with no ask', async ({ page }) => {
    if (!LAST_FREE) throw new Error('no free route day');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboardChild(page, { name: 'Mina', startJourney: false });
    const last = LAST_FREE.questIds[LAST_FREE.questIds.length - 1] as string;
    const finished = FREE.flatMap((day) => day.questIds.filter((questId) => questId !== last).map((questId) => ({ questId, episodeId: day.episodeId })));
    const id = await seedFinished(page, finished);
    await home(page, 'Mina', false);
    // Not the end yet: no celebration on Home while one free lesson is left.
    await expect(page.getByTestId('home-free-end-card')).toHaveCount(0);

    await openCell(page, LAST_FREE.stage, LAST_FREE.theme);
    await page.getByRole('button', { name: 'Start', exact: true }).last().click();
    await playToResults(page);

    const card = page.getByTestId('results-free-end-card');
    await expect(card).toBeVisible();
    await expect(card.getByText(access.freeEnd.title)).toBeVisible();
    await expect(page.getByTestId('results-free-end-home')).toBeVisible();
    await expect(page.getByTestId('results-free-end-ask')).toHaveText(access.ask.family);
    await expect(page.getByTestId('next-up-card')).toHaveCount(0);
    await expect(page.getByText(/locked|premium|trial|price/i)).toHaveCount(0);
    await expect.poll(() => readStored(page, `free-end-seen:${id}`)).toBe(true);
    await shot(page, 'free-days-results-free-end');

    // Seen once: no second celebration on Home. Back home keeps the day's pinned cards (F-STORY-004
    // PR 4.8c), so the practice card shows on the next visit, with no ask.
    await page.getByTestId('results-free-end-home').click();
    await home(page, 'Mina', false);
    await expect(page.getByTestId('home-free-end-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: access.ask.family })).toHaveCount(0);
    await home(page, 'Mina');
    await expect(page.getByTestId('home-free-end-card')).toHaveCount(0);
    await expect(page.getByText(access.practice.subtitle)).toBeVisible();
    await expect(page.getByRole('button', { name: access.ask.family })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('offline: once the app is cached, the rings and the preview still show', async ({ page, context }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 30_000 });
    await context.setOffline(true);
    await home(page, 'Dami');
    await openJourney(page);
    await expect(page.locator('[data-testid^="journey-ring-notOpen-"]')).toHaveCount(CLOSED_CELLS.length);
    await page.getByRole('button', { name: journeyCellName(2, themeTitle('life')) }).click();
    await expect(page.getByTestId('episode-preview-card').getByText(access.preview.line)).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('gating fixture bundle: direct navigation to a closed quest', () => {
  test.skip(!GATED_FIXTURES, 'needs the gating fixture bundle (STORY_FIXTURES_GATED=1)');

  test('opening a closed quest by its id lands on its lesson page preview, not the player', async ({ page }) => {
    if (!STAGE2_NATURE) throw new Error('no stage2-nature route day');
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await page.waitForFunction(() => Boolean((window as { __hrStoryE2E?: unknown }).__hrStoryE2E), undefined, { timeout: 10_000 });
    const quest = { questId: STAGE2_NATURE.questIds[0] as string, episodeId: STAGE2_NATURE.episodeId };
    await page.evaluate((params) => (window as unknown as { __hrStoryE2E: { openQuest(p: typeof params): void } }).__hrStoryE2E.openQuest(params), quest);
    const card = page.getByTestId('episode-preview-card');
    await expect(card.getByText(access.preview.line)).toBeVisible();
    await expect(page.getByTestId('episode-quest-not-open').first()).toHaveText(access.notOpen);
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);
  });
});
