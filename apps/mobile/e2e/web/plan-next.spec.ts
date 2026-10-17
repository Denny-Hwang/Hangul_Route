import { CATALOG, generateCurriculum, toMeta, toPlanItems, type CurriculumItem } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { questsAll } from '../../src/content/quests';
import { expect, test } from './fixtures';
import { answerCheckRounds, journeyCellName, onboardSelf, passDiscover, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-ENT-003 E3-11 (sections 3.5, 3.7, 3.8, 3.17): one Next that follows the learner's own plan.
 * A self plan whose next item is `stage1-life-q2`, dated in two days, is seeded on the device;
 * then Home card (2) offers that lesson with "Next in your plan", the Journey draws Next on its
 * cell and In your plan on the plan's cells, and a lesson played outside the plan ends on Results
 * with "Back to your plan" naming the plan's next lesson (no other line, never "you skipped").
 *
 * Runs on both builds. The release build (switch off, what CI runs) also shows no Not open yet
 * ring. With the free-plan switch on, the off-plan lesson is a Stage 1 one (open on the free plan),
 * and the cells past Stage 1 carry the dotted ring:
 *
 *   EXPO_PUBLIC_CONTENT_GATING_ENABLED=true NEXT_PUBLIC_CONTENT_GATING_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_CONTENT_GATING=1 pnpm --filter @hangul-route/mobile exec playwright test plan-next
 */
const GATED = process.env.E2E_CONTENT_GATING === '1';
const GATED_FIXTURES = process.env.STORY_FIXTURES_GATED === '1';
const learner = getMessages('en').learner;
const PLAN_NEXT = 'quest:stage1-life-q2';
const PLAN_NEXT_TITLE = questsAll.find((q) => q.id === PLAN_NEXT)?.titleEn ?? '';
if (!PLAN_NEXT_TITLE) throw new Error(`no quest title for ${PLAN_NEXT}`);
/** A literal string as a RegExp source. */
const literal = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Not in the plan, open on every build. */
const OFF_PLAN_CELL = { stage: 1, theme: 'Nature & Animals' } as const;

/** The browser's day is UTC too, so the plan's dates and the app's "today" agree on any host time zone. */
test.use({ timezoneId: 'UTC' });

const dayKey = (offset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/**
 * A new self-only learner with a self plan of one lesson, `stage1-life-q2`, two days from today.
 * Home pins the day's cards per tab (F-STORY-004 PR 4.8c), and the first Home before the seed pinned
 * the cursor's card, so Home is opened in a new tab of the same device: the plan is what it reads.
 */
async function learnerWithPlan(first: Page, errors?: string[]): Promise<Page> {
  const page = first;
  await onboardSelf(page, { name: 'Alex', startJourney: false });
  const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  const draft = generateCurriculum(
    {
      audience: 'self',
      level: { stage: 'stage1', band: 0 },
      startDate: dayKey(0),
      weeks: 4,
      sessionsPerWeek: 7,
      sessionDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      minutesPerSession: 15,
      goals: { focus: 'balanced', motivation: 'kculture' },
      unlockedStages: ['stage1'],
      reviewEvery: 4,
    },
    CATALOG,
  );
  const base = toPlanItems(draft).find((item) => item.kind === 'quest');
  if (!base) throw new Error('the generator scheduled no lesson');
  const items: CurriculumItem[] = [{ ...base, id: PLAN_NEXT, targetDate: dayKey(2) }];
  const now = new Date().toISOString();
  const route = { id: 'route:e2e-plan-next', createdAt: now, updatedAt: now, archivedAt: null, meta: toMeta(draft), items };
  const progress = (await readStored<Record<string, unknown>>(page, `progress:${id}`)) ?? {
    profileId: id,
    updatedAt: now,
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
  await seedStored(page, `progress:${id}`, { ...progress, selfRoute: route });
  await expect(page.getByText('Hi, Alex!')).toBeVisible();
  const tab = await page.context().newPage();
  if (errors) tab.on('pageerror', (e) => errors.push(String(e)));
  await page.close();
  await home(tab);
  return tab;
}

async function home(page: Page, reload = true): Promise<void> {
  if (reload) await page.goto('/');
  await expect(page.getByText('Hi, Alex!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function openJourney(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
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

test.describe(`a self plan leads Next (${GATED ? 'switch on' : 'release build, switch off'})`, () => {
  test.skip(GATED_FIXTURES, 'runs on the release build or a switch-on build, not the gating fixture bundle');

  test('Home card (2) and the Journey follow the plan', async ({ page: first }) => {
    const errors: string[] = [];
    const page = await learnerWithPlan(first, errors);
    await page.setViewportSize({ width: 320, height: 568 });

    // Home: the plan's next lesson is the Next lesson hero's, so card (2), which names it, is the hero's quiet row
    // (AMENDMENTS-DISPLAY-NAV 9.1); the hero's Start names the lesson.
    await expect(page.getByRole('button', { name: `${learner.home.next.start.cta}: ${PLAN_NEXT_TITLE}`, exact: true })).toBeVisible();
    const card = page.getByTestId('home-mission-same-as-hero-2');
    await expect(card).toContainText(PLAN_NEXT_TITLE);
    await expect(card).toContainText(learner.home.mission.sameAsHero);
    await shot(page, 'plan-next-home-320');

    // Journey: Next on the plan's lesson cell (one Next only), In your plan on the plan's cell.
    await openJourney(page);
    await expect(page.locator('[data-testid^="journey-next-"]')).toHaveCount(1);
    await expect(page.getByTestId('journey-next-stage1-life')).toBeVisible();
    await expect(page.getByTestId('journey-ring-inPlan-stage1-life')).toBeAttached();
    await expect(page.getByTestId('journey-legend')).toContainText(learner.routeNext.tag.inPlan);
    if (GATED) {
      await expect(page.locator('[data-testid^="journey-ring-notOpen-"]').first()).toBeAttached();
      await expect(page.locator('[data-testid^="journey-ring-notOpen-stage1-"]')).toHaveCount(0);
    } else {
      // The switch-off build draws no Not open yet ring.
      await expect(page.locator('[data-testid^="journey-ring-notOpen-"]')).toHaveCount(0);
      await expect(page.getByTestId('journey-legend')).not.toContainText(learner.access.notOpen);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, 'plan-next-journey-320');
    expect(errors).toEqual([]);
  });

  test('a lesson outside the plan ends on Back to your plan, naming the plan next', async ({ page: first }) => {
    const page = await learnerWithPlan(first);
    await openJourney(page);
    await page.getByRole('button', { name: journeyCellName(OFF_PLAN_CELL.stage, OFF_PLAN_CELL.theme) }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    // Its letters come from a lesson not played yet: the soft-prerequisite offer, never a lock (F-QUEST-002 section 3.5).
    await page.getByRole('button', { name: learner.episode.prereq.playAnyway.cta }).click();
    // No warning before playing it.
    await expect(page.getByText(/not in your plan|skipped|wrong lesson/i)).toHaveCount(0);
    await playToResults(page);

    const next = page.getByTestId('next-up-card');
    await expect(next).toBeVisible();
    await expect(next.getByText(learner.routeNext.results.backToPlan, { exact: true })).toBeVisible();
    await expect(next.getByText(PLAN_NEXT_TITLE)).toBeVisible();
    await expect(page.getByText(/not in your plan|skipped|wrong lesson/i)).toHaveCount(0);
    await shot(page, 'plan-next-results-back-to-plan');
  });
});
