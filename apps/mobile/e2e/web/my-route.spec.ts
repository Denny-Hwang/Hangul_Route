import type { Locator, Page } from '@playwright/test';
import { CATALOG, generateCurriculum, toMeta } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * The Learning Route page as the Route tab and its route card (AMENDMENTS-ROUTE-LEARNING-ROUTE section 12,
 * `my-route.spec.ts` row, LR-10; design/screens/learning-route/route-card.md and tab-bar.md). F-ROUTE-001 R-10
 * extends this spec with the Home strip entry and flips the flag; until then the whole spec needs a build made
 * with the flag on:
 *
 *   EXPO_PUBLIC_MY_ROUTE_ENABLED=true EXPO_PUBLIC_SHOW_ALL_LOCALES=1 pnpm --filter @hangul-route/mobile build:web
 *   E2E_MY_ROUTE=1 E2E_ALL_LOCALES=1 pnpm --filter @hangul-route/mobile exec playwright test my-route route-tab
 *
 * CI builds with the flag off, so it skips this spec. The tab labels per shipped UI locale are measured by
 * `route-tab.spec.ts`; the 5-second comprehension check (LR-OD-3, assumption g) reads this spec's screenshots.
 */

const ROUTE_TAB = process.env.E2E_MY_ROUTE === '1';
/** The gating fixture bundle (`build:web:fixtures:gated`, served from dist-e2e-gated/): the free-plan switch on. */
const GATED_BUILD = process.env.STORY_FIXTURES_GATED === '1';
const en = getMessages('en');
const m = en.learner.myRoute;
const AT = '2026-10-09T10:00:00.000Z';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 844, height: 390 },
  { width: 1180, height: 820 },
] as const;

/**
 * The Stage 1 lesson with the longest English title: the hardest Next line to fit above the tab bar. English only:
 * the fit test below runs in the en UI. Once R-10 ships es and ko, the fit is measured again with each locale's
 * longest localized Stage 1 title (`localizeQuest`), which may be longer.
 */
const LONGEST_STAGE1 = (() => {
  const longest = [...CATALOG.quests]
    .filter((q) => q.stage === 'stage1' && q.kind === 'lesson')
    .sort((a, b) => b.title.length - a.title.length || a.id.localeCompare(b.id))[0];
  if (longest === undefined) throw new Error('the catalogue has no Stage 1 lesson');
  return longest;
})();

const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: en.caregiver.install.notNow.cta, exact: true }).click();
}

/** A child learner on Home; returns the profile id. */
async function learnerOnHome(page: Page): Promise<string> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await closeInstallGuide(page);
  return (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
}

/** Letters q1 finished and a level check that started the learner in Stage 1: here, the goal and the start in one row. */
async function seedStartedLearner(page: Page, profileId: string): Promise<void> {
  await seedStored(page, `progress:${profileId}`, {
    profileId,
    updatedAt: AT,
    episodes: [],
    quests: [{ questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    placements: [
      {
        id: 'placement:seeded',
        startedAt: AT,
        completedAt: AT,
        source: 'home',
        testLocale: 'en',
        length: 'full',
        mode: 'standard',
        revealMode: 'tap',
        bankVersion: 1,
        contentVer: 'e2e',
        responses: [],
        gates: [],
        strands: { 'hangul-recognition': 'not-tested', 'sound-letter': 'not-tested', 'syllable-reading': 'not-tested', vocabulary: 'not-tested', sentences: 'not-tested' },
        level: { stage: 'stage1', band: 1 },
        oralStage: null,
        beyondContent: false,
        startQuestId: 'quest:stage1-life-q1',
        placedOutQuestIds: [],
        priorityTokens: [],
        needsStage: null,
        stopReason: 'complete',
      },
    ],
  });
}

/**
 * The class's live weekly plan in the device's inbox copy (`plans:<id>`, read again at app start): a curriculum
 * from this week's Monday whose one item is `questId`, so the plan leads Next (F-ENT-003 `routeNext`).
 */
async function seedClassPlan(page: Page, profileId: string, questId: string): Promise<void> {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const draft = generateCurriculum(
    {
      audience: 'class',
      level: { stage: 'stage1', band: 0 },
      startDate: monday.toISOString().slice(0, 10),
      weeks: 4,
      sessionsPerWeek: 2,
      sessionDays: ['mon', 'wed'],
      minutesPerSession: 10,
      goals: { focus: 'balanced', motivation: 'kculture' },
      unlockedStages: ['stage1'],
      reviewEvery: 4,
    },
    CATALOG,
  );
  await seedStored(page, `plans:${profileId}`, [
    {
      id: 'plan:e2e-class',
      spaceId: 'space:e2e-class',
      spaceKind: 'class',
      spaceName: 'Sunflower',
      title: 'Weekly plan',
      items: [{ kind: 'quest', id: questId, week: 1 }],
      publishedAt: monday.toISOString(),
      updatedAt: monday.toISOString(),
      meta: toMeta(draft),
    },
  ]);
}

/** The quest player's first step: its heading and its words (the player names no quest title). */
async function firstStep(page: Page): Promise<{ heading: string; text: string }> {
  const leave = page.getByRole('button', { name: en.a11y.leaveQuest, exact: true });
  await expect(leave).toBeVisible();
  const heading = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
  const text = await page.evaluate(() => document.body.innerText);
  return { heading, text };
}

async function openRouteTab(page: Page): Promise<Locator> {
  await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
  const screen = page.getByTestId('my-route-screen');
  await expect(screen).toBeVisible();
  return screen;
}

test.describe('the Route tab and its route card (LR-10)', () => {
  test.skip(!ROUTE_TAB, 'needs a build made with EXPO_PUBLIC_MY_ROUTE_ENABLED=true (E2E_MY_ROUTE=1)');

  for (const size of VIEWPORTS) {
    test(`${size.width} x ${size.height}: four tabs, the route card's words, the goal tag on the trail, no side scroll`, async ({ page }) => {
      await page.setViewportSize(size);
      await learnerOnHome(page);
      await expect(page.getByRole('tablist').getByRole('link')).toHaveCount(4);
      await openRouteTab(page);

      const card = page.getByTestId('my-route-card');
      await expect(card).toBeVisible();
      // A new learner: the start line, the goal (Hoya's suggestion, Stage 1), the one Next and Start.
      await expect(card.getByText(m.hero.start, { exact: true })).toBeVisible();
      await expect(page.getByTestId('my-route-card-from')).toHaveText(m.goal.from.default);
      await expect(page.getByTestId('my-route-card-next')).toHaveText(/^Next: /);
      await expect(page.getByTestId('my-route-card-cta')).toBeVisible();
      await expect(page.getByTestId('my-route-stage-1').getByText(m.tag.goal, { exact: true })).toBeVisible();
      // Fill-only: no digits, no "of", no ratio anywhere on the card.
      expect(await card.innerText()).not.toMatch(/\d\s*\/\s*\d|\bof \d/);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `my-route-card-${size.width}`);
      // The 5-second check (LR-OD-3) sets the two first screens side by side: Route, then Journey.
      await page.screenshot({ path: test.info().outputPath(`route-first-${size.width}.png`) });
      await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.journey }).click();
      await expect(page.getByText(en.learner.journey.intro, { exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`journey-first-${size.width}.png`) });
    });
  }

  test('320 x 568: here, goal and start on one stage take at most two rows, nothing cut off', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const id = await learnerOnHome(page);
    await seedStartedLearner(page, id);
    await closeInstallGuide(page);
    await openRouteTab(page);

    const row = page.getByTestId('my-route-stage-1');
    const tags = [m.tag.here, m.tag.goal, m.tag.start].map((t) => row.getByText(t, { exact: true }));
    const boxes = [];
    for (const tag of tags) {
      await tag.scrollIntoViewIfNeeded();
      await expect(tag).toBeVisible();
      boxes.push(await tag.boundingBox());
    }
    const tops = new Set(boxes.map((b) => Math.round(b?.y ?? -1)));
    expect(tops.size).toBeLessThanOrEqual(2);
    // Each word fits its chip: never wider than the box it is drawn in.
    for (const tag of tags) expect(await tag.evaluate((el) => el.scrollWidth <= el.clientWidth + 0.5)).toBe(true);
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, 'my-route-three-tags-320');
  });

  /** A started learner with the class plan whose one item is the longest Stage 1 title, on the Route tab. */
  async function classPlanOnRoute(page: Page): Promise<void> {
    await page.setViewportSize({ width: 320, height: 568 });
    const id = await learnerOnHome(page);
    await seedStartedLearner(page, id);
    await seedClassPlan(page, id, LONGEST_STAGE1.id);
    await page.reload();
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await closeInstallGuide(page);
  }

  test('a class plan: its source line, the longest Stage 1 title as Next, the same quest as Home card (2), and Continue opens it', async ({ page }) => {
    await classPlanOnRoute(page);
    // Home card (2) names the plan's quest (F-ENT-003 section 3.5).
    const homeCard = page.getByTestId('home-missions').getByRole('button').nth(1);
    await expect(homeCard).toHaveAccessibleName(new RegExp(LONGEST_STAGE1.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    await openRouteTab(page);
    await expect(page.getByTestId('my-route-card-from')).toHaveText(m.goal.from.class);
    await expect(page.getByTestId('my-route-card-next')).toHaveText(m.hero.next(LONGEST_STAGE1.title));
    const cta = page.getByTestId('my-route-card-cta');
    await expect(cta).toHaveAccessibleName(m.hero.cta.continue);
    expect(await noSideScroll(page)).toBe(true);
    // The first screen as the learner sees it (the 5-second check reads this one).
    await page.screenshot({ path: test.info().outputPath('my-route-first-screen-320.png') });
    await shot(page, 'my-route-class-plan-320');

    // Continue opens the quest player on the same quest as Home card (2): the same first step, word for word.
    await cta.click();
    await expect(page.getByTestId('my-route-screen')).toBeHidden();
    const fromRoute = await firstStep(page);
    await shot(page, 'my-route-continue-opens-quest-320');
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await closeInstallGuide(page);
    await page.getByTestId('home-missions').getByRole('button').nth(1).click();
    expect(await firstStep(page)).toEqual(fromRoute);
  });

  test('320 x 568: where Continue ends against the tab bar, with the longest Stage 1 title as Next (blocks R-10)', async ({ page }) => {
    // Known finding of the LR-10 run (issue linked in the spec's review log, section 16): since Stage 1 grew to 15
    // quests (F-QUEST-002 Q-8) the goal pips wrap to two rows at 320, and the card's Continue ends about 75 px under
    // the tab bar's top edge (LR-D measured 13 px to spare with 8 pips). Every setup step below is asserted as usual,
    // so a broken setup fails this test; only the measured overlap records the finding. The layout fix PR turns the
    // last assertion into `toBeLessThanOrEqual(0)` (Continue fully above the tab bar), a precondition of R-10's flip.
    test.info().annotations.push({ type: 'finding', description: 'LR-10: Continue is below the tab bar at 320 x 568; fix before R-10 flips the flag' });
    await classPlanOnRoute(page);
    await openRouteTab(page);
    await expect(page.getByTestId('my-route-card-next')).toHaveText(m.hero.next(LONGEST_STAGE1.title));
    const cta = page.getByTestId('my-route-card-cta');
    await expect(cta).toHaveAccessibleName(m.hero.cta.continue);
    const bar = page.getByRole('tablist');
    await expect(bar).toBeVisible();
    const [buttonBox, barBox] = await Promise.all([cta.boundingBox(), bar.boundingBox()]);
    if (buttonBox === null || barBox === null) throw new Error('Continue or the tab bar has no box');
    const overlap = buttonBox.y + buttonBox.height - barBox.y;
    test.info().annotations.push({ type: 'overlap-px', description: String(Math.round(overlap)) });
    expect(overlap, 'LR-10 finding: Continue ends under the tab bar at 320 x 568').toBeGreaterThan(0);
  });

  test('320 x 568: "Not open yet" and "Coming later" share the dotted ring and are told apart by their words and the legend (assumption h)', async ({ page }) => {
    // A free learner on the gating fixture bundle: Stage 2's playable quests are not open (F-ENT-003), its other
    // cells are coming later. Build it with the flag on:
    //   EXPO_PUBLIC_MY_ROUTE_ENABLED=true pnpm --filter @hangul-route/mobile build:web:fixtures:gated
    //   STORY_FIXTURES_GATED=1 E2E_MY_ROUTE=1 pnpm --filter @hangul-route/mobile exec playwright test my-route -g "assumption h"
    test.skip(!GATED_BUILD, 'needs the gating fixture bundle (STORY_FIXTURES_GATED=1, dist-e2e-gated/)');
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);
    await openRouteTab(page);

    expect(m.state.notOpen).not.toBe(m.state.later);
    expect(m.legend.notOpen).not.toBe(m.legend.later);
    const row = page.getByTestId('my-route-stage-2');
    await row.getByRole('button').first().click();
    // The cells: each pip group carries its word, so the two kinds read differently while their rings match.
    await expect(row.getByText(m.state.notOpen, { exact: true }).first()).toBeVisible();
    await expect(row.getByText(m.state.later, { exact: true }).first()).toBeVisible();
    // The legend lists both, "Not open yet" just before "Coming later".
    await row.getByRole('button', { name: m.legend.title, exact: true }).click();
    const notOpen = row.getByTestId('my-route-legend-not-open');
    await notOpen.scrollIntoViewIfNeeded();
    await expect(notOpen).toHaveText(m.legend.notOpen);
    const later = row.getByText(m.legend.later, { exact: true }).last();
    await expect(later).toBeVisible();
    const [a, b] = await Promise.all([notOpen.boundingBox(), later.boundingBox()]);
    if (a === null || b === null) throw new Error('a legend line has no box');
    expect(a.y).toBeLessThan(b.y);
    // A stage that is coming later says so on its own row, in its own words.
    await expect(page.getByTestId('my-route-later-3').getByText(m.state.later, { exact: true })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, 'my-route-not-open-and-later-320');
  });
});
