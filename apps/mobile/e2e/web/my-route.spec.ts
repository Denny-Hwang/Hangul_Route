import type { Locator, Page } from '@playwright/test';
import { CATALOG, generateCurriculum, toMeta } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * The Learning Route page as the Route tab and its route card (AMENDMENTS-ROUTE-LEARNING-ROUTE section 12,
 * `my-route.spec.ts` row, LR-10; design/screens/learning-route/route-card.md and tab-bar.md). F-ROUTE-001 R-10
 * extends this spec with the Home strip entry; `flags.myRouteEnabled` is on by default since the R-10b flip, so CI
 * runs this spec on the release build, and the assumption h case on the gating fixture bundle. The evidence run
 * with every UI locale and the telemetry case:
 *
 *   EXPO_PUBLIC_SHOW_ALL_LOCALES=1 EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid \
 *     pnpm --filter @hangul-route/mobile build:web
 *   E2E_ALL_LOCALES=1 E2E_TELEMETRY=1 pnpm --filter @hangul-route/mobile exec playwright test my-route route-tab
 *
 * The tab labels per shipped UI locale are measured by `route-tab.spec.ts`; the 5-second comprehension check
 * (LR-OD-3, assumption g) reads this spec's screenshots.
 */

/** The gating fixture bundle (`build:web:fixtures:gated`, served from dist-e2e-gated/): the free-plan switch on. */
const GATED_BUILD = process.env.STORY_FIXTURES_GATED === '1';
const en = getMessages('en');
const m = en.learner.myRoute;
const AT = '2026-10-09T10:00:00.000Z';

// The browser and the seeds agree on the calendar: `seedClassPlan` takes this week's Monday in UTC, so the page
// reads the plan's week in UTC too, whatever the host's timezone.
test.use({ timezoneId: 'UTC' });

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

  /** How far the card's button ends below the tab bar's top edge (px); at most 0 means fully above the bar. */
  async function ctaOverlap(page: Page, cta: Locator): Promise<number> {
    const bar = page.getByRole('tablist');
    await expect(bar).toBeVisible();
    // Measure after the web fonts load: the longest title's line breaks depend on them.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const [buttonBox, barBox] = await Promise.all([cta.boundingBox(), bar.boundingBox()]);
    if (buttonBox === null || barBox === null) throw new Error('the button or the tab bar has no box');
    const overlap = buttonBox.y + buttonBox.height - barBox.y;
    test.info().annotations.push({ type: 'overlap-px', description: String(Math.round(overlap)) });
    return overlap;
  }

  test('320 x 568: Continue sits fully above the tab bar, with the longest Stage 1 title as Next (G2; LR-11, precondition of R-10)', async ({ page }) => {
    // The LR-10 run found Continue about 75 px under the tab bar once Stage 1 grew to 15 quests (F-QUEST-002 Q-8;
    // issue #530). LR-11's narrow-width card (design/screens/learning-route/route-card.md, "Narrow width") brings it
    // back onto the first screen: one tap away without scrolling.
    await classPlanOnRoute(page);
    await openRouteTab(page);
    await expect(page.getByTestId('my-route-card-next')).toHaveText(m.hero.next(LONGEST_STAGE1.title));
    const cta = page.getByTestId('my-route-card-cta');
    await expect(cta).toHaveAccessibleName(m.hero.cta.continue);
    expect(await ctaOverlap(page, cta), 'Continue ends under the tab bar at 320 x 568').toBeLessThanOrEqual(0);
    expect(await noSideScroll(page)).toBe(true);
    // The first screen the 5-second check (LR-OD-3, assumption g) reads again for LR-11.
    await page.screenshot({ path: test.info().outputPath('route-first-class-plan-320.png') });
  });

  test('320 x 568: a new learner\'s Start sits fully above the tab bar (G2; LR-11)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);
    await openRouteTab(page);
    const card = page.getByTestId('my-route-card');
    await expect(card.getByText(m.hero.start, { exact: true })).toBeVisible();
    const cta = page.getByTestId('my-route-card-cta');
    await expect(cta).toHaveAccessibleName(m.hero.cta.start);
    expect(await ctaOverlap(page, cta), 'Start ends under the tab bar at 320 x 568').toBeLessThanOrEqual(0);
    expect(await noSideScroll(page)).toBe(true);
  });

  test('320 x 568: "Not open yet" and "Coming later" share the dotted ring and are told apart by their words and the legend (assumption h)', async ({ page }) => {
    // A free learner on the gating fixture bundle: Stage 2's playable quests are not open (F-ENT-003), its other
    // cells are coming later. CI's gating run plays it:
    //   pnpm --filter @hangul-route/mobile build:web:fixtures:gated
    //   STORY_FIXTURES_GATED=1 pnpm --filter @hangul-route/mobile exec playwright test my-route.spec -g "assumption h"
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
    // A stage that is coming later says so on its own row, in its own words (Stage 7: Stage 3 has a taste since
    // First Sentences, F-CURR-001 S3-1, and Stage 6 since Read the Menu, S6-1).
    await expect(page.getByTestId('my-route-later-7').getByText(m.state.later, { exact: true })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, 'my-route-not-open-and-later-320');
  });
});

/**
 * The Home strip entry (F-ROUTE-001 R-10; R-4b, section 3.1 entry 2, OD-3; amendment LR-A6 and section 5.2): with
 * the flag on, Home shows one tappable Learning Route card where the "Stage 1 progress" bar was, read as one button,
 * and a tap opens the Route tab. The page then sends `route_map.viewed` with `source: 'tab'`: since LR-4 every
 * entry of the active learner opens the tab, and the tab sends `'tab'` on each focus (amendment section 5.1, LR-A7);
 * the R-10 row's older `source: 'home'` named the root-stack page the strip opened before LR-4.
 *
 * The telemetry case needs a build with an API address, so `track` posts (the route below answers it; nothing
 * leaves the machine):
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.e2e.invalid pnpm --filter @hangul-route/mobile build:web
 *   E2E_TELEMETRY=1 pnpm --filter @hangul-route/mobile exec playwright test my-route -g "Home strip"
 *
 * Without E2E_TELEMETRY=1 that case is reported as skipped, not passed. The flip PR's evidence run is the full
 * command in the file header, which sets both.
 */
const TELEMETRY_BUILD = process.env.E2E_TELEMETRY === '1';

test.describe('the Home strip entry (R-10)', () => {
  test.use({ serviceWorkers: 'block' });

  for (const size of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ] as const) {
    test(`${size.width} x ${size.height}: the strip in place of "Stage 1 progress", one button with one label, no side scroll`, async ({ page }) => {
      await page.setViewportSize(size);
      await learnerOnHome(page);

      const strip = page.getByTestId('home-route-strip');
      await strip.scrollIntoViewIfNeeded();
      await expect(strip).toBeVisible();
      await expect(page.getByText(en.learner.home.progress.heading, { exact: true })).toHaveCount(0);
      // Its words: the page name and where the learner is (a new learner: Stage 1), Hoya's goal for Stage 1.
      // The here line is `hero.here` for Stage 1 with the stage's title from the bundle.
      const here = new RegExp(`^${escapeRe(m.hero.here(1, '<t>')).replace('<t>', '[^.]+')}$`);
      await expect(strip.getByText(m.home.strip.title, { exact: true })).toBeVisible();
      await expect(strip.getByText(here)).toBeVisible();
      await expect(strip.getByText(m.home.strip.stages, { exact: true })).toBeVisible();

      // One button: the whole card, named by one label that starts with the page name and says where the learner
      // is; nothing inside it is a second button or link, and the drawn pips are hidden from screen readers.
      const hereText = (await strip.getByText(here).innerText()).trim();
      await expect(page.getByRole('button', { name: new RegExp(`^${escapeRe(`${m.home.strip.title}. ${hereText}`)}`) })).toHaveCount(1);
      expect(await strip.getAttribute('role')).toBe('button');
      await expect(strip.getByRole('button')).toHaveCount(0);
      await expect(strip.getByRole('link')).toHaveCount(0);
      await expect(page.getByRole('button', { name: m.home.strip.title, exact: true })).toHaveCount(0);

      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `home-route-strip-${size.width}`);
    });
  }

  test('a tap opens the Route tab: the page, its purpose line, no back button', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);

    const strip = page.getByTestId('home-route-strip');
    await strip.scrollIntoViewIfNeeded();
    await strip.click();
    const screen = page.getByTestId('my-route-screen');
    await expect(screen).toBeVisible();
    await expect(screen.getByText(m.purpose, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: en.a11y.goBack, exact: true })).toHaveCount(0);
    await expect(page.getByRole('tablist').getByRole('link')).toHaveCount(4);
    await expect(page.getByTestId('home-route-strip')).toBeHidden();
    await shot(page, 'home-route-strip-opens-route-320');
  });

  test('a tap sends route_map.viewed exactly once, with source tab', async ({ page }) => {
    test.skip(!TELEMETRY_BUILD, 'route_map.viewed not asserted: needs E2E_TELEMETRY=1 on a build with EXPO_PUBLIC_API_BASE_URL');
    const viewed: Array<Record<string, unknown>> = [];
    await page.route('**/api/telemetry', async (route) => {
      const body = route.request().postDataJSON() as { name?: string; payload?: Record<string, unknown> } | null;
      if (body?.name === 'route_map.viewed' && body.payload) viewed.push(body.payload);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);

    const strip = page.getByTestId('home-route-strip');
    await strip.scrollIntoViewIfNeeded();
    await strip.click();
    await expect(page.getByTestId('my-route-screen')).toBeVisible();

    await expect.poll(() => viewed.length).toBe(1);
    // "Exactly once" is a check that nothing more arrives, so it needs a window: a second send from a second focus
    // or a re-render would land within it (the client posts at once; it queues only offline).
    await page.waitForTimeout(1500);
    expect(viewed).toHaveLength(1);
    expect(viewed[0]).toMatchObject({ source: 'tab', stage: 'stage1' });
  });
});

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
