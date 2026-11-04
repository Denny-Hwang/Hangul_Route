import type { Page } from '@playwright/test';
import '@hangul-route/content-schema/blend-generator';
import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  CurriculumMetaSchema,
  InboxPlanSchema,
  PlanItemShapeSchema,
  StoredCurriculumParamsSchema,
  generateCurriculum,
  isDateKey,
  toMeta,
  toPlanItems,
  type InboxPlan,
  type ProgressSnapshot,
  type SelfRoute,
} from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoClippedText, expectNoSidewaysScroll } from './text-fit';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND row BL-10 (sections 7, 8, 9.3, 14 and 17 b; BL-OD-12): class days and practice days on
 * the learner's device in the launch state, the release build with `flags.routeBlendEnabled` on by default (no
 * `EXPO_PUBLIC_ROUTE_BLEND_ENABLED` needed). The class plan is the generator's own: a Tuesday class (30 min) with
 * practice 3 times a week (10 min, Wednesday, Friday and Sunday), overlap, 4 weeks from Monday 2026-11-02, so every
 * item, `lectureDate`, Refresh date and `sessionsPerWeek` is what a published plan carries.
 *
 * - **A plan as an older app keeps it (assumption b).** The blended plan parses with the schema frozen at cf7a4e483
 *   (no `lectureDate`, no `meta.refresh`, no `params.blend`; the Worker test `inbox-blend.test.ts` freezes the same one),
 *   which is the older app's own check. The stripped copy is then seeded into THIS app: every practice item lands on
 *   its date, the weekly goal is 4 days from `sessionsPerWeek`, and none of the blended words draw. That shows the
 *   stripped plan still carries every date and the goal; the older app's own derivation is not run here (it is
 *   unchanged code, covered by the frozen-schema parse above and by `inbox-blend.test.ts`).
 * - **This app.** On the class day "Class today." and the Route line; the From class pill with the class glyph and its
 *   label "From class. You met this in class."; on a practice day with its lessons done, Refresh opens the review.
 * - **The own plan rests** while the class plan has practice days: Profile reads the resting line with See it, and its
 *   lessons leave Home and Homework (none removed).
 * - **The weekly goal** is the plan's distinct days: 4.
 *
 * At 320 x 568 and 1280 x 800, at the Largest text size on 320, and in en, es and ko (screenshots with `HR_SHOTS=1`).
 * The browser clock is fixed at midday UTC on the day under test.
 */

test.use({ timezoneId: 'UTC' });

/**
 * A kill-switch build (`EXPO_PUBLIC_ROUTE_BLEND_ENABLED=false`, run with `E2E_ROUTE_BLEND=0`) draws none of the blended
 * views, so the tests that look at them skip; the plan's derivation is not flagged (section 14), so the older-app copy,
 * the own plan resting out of sight and the weekly goal still run there.
 */
const KILL_SWITCH = process.env.E2E_ROUTE_BLEND === '0';
const KILL_SWITCH_SKIP = 'the kill-switch build (EXPO_PUBLIC_ROUTE_BLEND_ENABLED=false) draws none of this';

const en = getMessages('en');
const words = en.learner.route.blend;
const day = (key: string): number => Date.parse(`${key}T12:00:00.000Z`);
const TUESDAY = day('2026-11-03');
const WEDNESDAY = day('2026-11-04');
const FRIDAY = day('2026-11-06');

/** The class's published plan, as the console's wizard writes it (BL-4): the blended generator's draft. */
function blendedPlan(): InboxPlan {
  const draft = generateCurriculum(
    {
      audience: 'class',
      level: { stage: 'stage1', band: 0 },
      startDate: '2026-11-02',
      weeks: 4,
      sessionsPerWeek: 4,
      minutesPerSession: 10,
      goals: { focus: 'balanced', motivation: 'kculture' },
      unlockedStages: ['stage1'],
      reviewEvery: 4,
      blend: { mode: 'overlap', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 }, classDaysOff: [], keepAverage: false },
    },
    CATALOG,
  );
  return {
    id: 'plan:e2e-blend',
    spaceId: 'space:e2e-class',
    spaceKind: 'class',
    spaceName: 'Sunflower',
    title: 'Weekly plan',
    items: toPlanItems(draft),
    publishedAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    meta: toMeta(draft),
  };
}

/**
 * The cross-field check of an app built before BL-W, frozen from `curriculum/params.ts` at cf7a4e483 (as in the
 * Worker's `inbox-blend.test.ts`): it counts `sessionDays` (or `sessionsPerWeek`) only and knows nothing of `blend`.
 */
const preBlendRefineParams = (
  params: { startDate: string; weeks: number; sessionsPerWeek: number; sessionDays?: readonly string[] | undefined; daysOff: ReadonlyArray<{ from: string; to: string }> },
  ctx: { addIssue: (issue: { code: 'custom'; path: Array<string | number>; params: { code: string } }) => void },
): void => {
  const fail = (code: string, path: Array<string | number>): void => ctx.addIssue({ code: 'custom', path, params: { code } });
  const days = params.sessionDays ?? [];
  days.forEach((d, index) => {
    if (days.indexOf(d) !== index) fail('session-day-repeated', ['sessionDays', index]);
  });
  const perWeek = params.sessionDays === undefined ? params.sessionsPerWeek : params.sessionDays.length;
  if (params.weeks * perWeek > CURRICULUM_MAX_ITEMS) fail('too-many-sessions', ['weeks']);
  params.daysOff.forEach((range, index) => {
    if (!isDateKey(range.from)) fail('not-a-real-day', ['daysOff', index, 'from']);
    if (!isDateKey(range.to)) fail('not-a-real-day', ['daysOff', index, 'to']);
    if (range.from > range.to) fail('days-off-reversed', ['daysOff', index, 'to']);
  });
  if (!isDateKey(params.startDate)) fail('not-a-real-day', ['startDate']);
};

/** The parser of an app built before BL-W: the same shapes without `lectureDate`, `meta.refresh` and `params.blend`. */
const OldInboxPlanSchema = InboxPlanSchema.extend({
  items: PlanItemShapeSchema.omit({ lectureDate: true }).array(),
  meta: CurriculumMetaSchema.omit({ refresh: true })
    .extend({ params: StoredCurriculumParamsSchema.innerType().omit({ blend: true }).superRefine(preBlendRefineParams) })
    .nullable()
    .default(null),
});

/** A record holding the quests done before `before` (so that day's lessons are done) and, if given, the own plan. */
function snapshotOf(profileId: string, plan: InboxPlan, before: string, selfRoute?: SelfRoute): ProgressSnapshot {
  const done = plan.items.filter((item) => item.targetDate !== undefined && item.targetDate <= before);
  return {
    profileId,
    updatedAt: `${before}T09:00:00.000Z`,
    episodes: [],
    quests: done.map((item) => ({ questId: item.id, episodeId: `episode:${item.id.slice('quest:'.length).replace(/-q\d+$/, '')}`, startedAt: `${item.targetDate}T09:00:00.000Z`, completedAt: `${item.targetDate}T09:05:00.000Z`, stars: 3, attempts: 1, accuracy: 1 })),
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    ...(selfRoute ? { selfRoute } : {}),
  } as ProgressSnapshot;
}

/** The learner's own weekly plan, made on the device before the class added practice days: one lesson a day. */
function ownPlan(): SelfRoute {
  return {
    id: 'route:mine',
    createdAt: '2026-10-26T09:00:00.000Z',
    updatedAt: '2026-10-26T09:00:00.000Z',
    archivedAt: null,
    meta: { kind: 'curriculum', horizonDays: 7 },
    items: [
      { kind: 'quest', id: 'quest:stage1-nature-q1', targetDate: '2026-11-03' },
      { kind: 'quest', id: 'quest:stage1-crafts-q1', targetDate: '2026-11-04' },
    ],
  } as unknown as SelfRoute;
}

async function closeInstallGuide(page: Page, locale: UiLocale = 'en'): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: getMessages(locale).caregiver.install.notNow.cta, exact: true }).click();
}

interface Setup {
  now: number;
  plan?: InboxPlan | Record<string, unknown>;
  doneBefore?: string;
  selfRoute?: SelfRoute;
  locale?: UiLocale;
  largest?: boolean;
  goals?: boolean;
}

/** Mina, a child on this device, with the class plan in her inbox copy (`plans:<learner>`, no network). */
async function learner(page: Page, s: Setup): Promise<string> {
  await page.clock.setFixedTime(s.now);
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
  const plan = s.plan ?? blendedPlan();
  await seedStored(page, `plans:${profileId}`, [plan]);
  await seedStored(page, `progress:${profileId}`, snapshotOf(profileId, plan as InboxPlan, s.doneBefore ?? '0000-00-00', s.selfRoute));
  if (s.locale !== undefined || s.largest === true) {
    await seedStored(page, 'device:settings', { uiLocale: s.locale ?? 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', ...(s.largest === true ? { textSize: 'largest' } : {}) });
  }
  if (s.goals === true) await seedStored(page, 'remote-config', { v: 1, fetchedAt: s.now, maxAgeS: 300, flags: { goals: { on: true, pct: 100 } } });
  await page.goto('/');
  await expect(page.getByText(getMessages(s.locale ?? 'en').learner.home.greeting('Mina'))).toBeVisible();
  await closeInstallGuide(page, s.locale);
  return profileId;
}

const noBadWords = async (page: Page): Promise<void> => {
  const text = (await page.locator('body').innerText()).toLowerCase();
  for (const word of ['late', 'missed', 'overdue', 'behind', 'stopped', 'cancelled']) expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`));
  expect(text).not.toMatch(/%/);
};

test.describe('a plan as an older app keeps it (assumption b)', () => {
  test('the frozen schema parses the blended plan; this app on that stripped copy keeps every practice item on its date and a weekly goal of 4 days', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const plan = blendedPlan();
    const old = OldInboxPlanSchema.parse(plan);
    expect(old.items).toHaveLength(plan.items.length);
    expect(old.items.some((item) => 'lectureDate' in item)).toBe(false);
    expect(old.meta && 'refresh' in old.meta).toBe(false);
    expect(old.meta && 'blend' in old.meta.params).toBe(false);
    expect(old.meta?.params.sessionsPerWeek).toBe(4);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await learner(page, { now: WEDNESDAY, plan: old, goals: true });

    // Wednesday: the class's first practice day. The day's lesson is on Home and in Homework, from class.
    await expect(page.getByTestId('home-class-today')).toHaveCount(0);
    await page.getByRole('button', { name: en.a11y.openHomework }).click();
    const today = page.getByRole('button', { name: /, Today$/ });
    await expect(today).toHaveCount(1);
    await expect(today).toContainText(en.learner.homework.from.teacher);
    // Every practice item of the coming week is derived on its own date, and nothing on a date the plan does not give it.
    const stored = await readStored<ProgressSnapshot>(page, `progress:${profileId}`);
    const derived = (stored?.homework ?? []).filter((h) => h.id.startsWith(`${plan.id}#`)).map((h) => `${h.questId}@${h.targetDate}`);
    const planned = new Set(plan.items.map((item) => `${item.id}@${item.targetDate}`));
    for (const entry of derived) expect(planned.has(entry), entry).toBe(true);
    const week = plan.items.filter((item) => item.targetDate !== undefined && item.targetDate >= '2026-11-04' && item.targetDate <= '2026-11-10');
    expect(week.length).toBeGreaterThanOrEqual(3);
    for (const item of week) expect(derived, item.id).toContain(`${item.id}@${item.targetDate}`);

    // The weekly goal: 4 days from the plan's sessionsPerWeek (the goals sheet says where it comes from).
    await page.goto('/');
    await page.getByRole('button', { name: /^This week: / }).click();
    await expect(page.getByText(en.learner.goals.sheet.fromPlan(4))).toBeVisible();
    await shot(page, 'route-blend-old-app-goal-320');
    expect(errors).toEqual([]);
  });
});

for (const size of [
  { width: 320, height: 568 },
  { width: 1280, height: 800 },
] as const) {
  test.describe(`this app at ${size.width} x ${size.height} (the flag on by default)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
    });

    test('the class day: Class today, the Route line, the From class pill with its glyph and label', async ({ page }) => {
      test.skip(KILL_SWITCH, KILL_SWITCH_SKIP);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await learner(page, { now: TUESDAY });
      await expect(page.getByTestId('home-class-today')).toHaveText(words.classToday);
      expect(await page.getByTestId('home-class-today').innerText()).not.toMatch(/\?/);
      await expectNoSidewaysScroll(page, 'Home on the class day');
      await shot(page, `route-blend-launch-home-${size.width}`);

      await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
      await expect(page.getByTestId('my-route-blend-line')).toHaveText("Your class's weekly plan: class on Tuesday, practice on Wednesday, Friday, and Sunday.");
      await expectNoSidewaysScroll(page, 'the Route line');
      await shot(page, `route-blend-launch-line-${size.width}`);

      await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.home }).click();
      await page.getByRole('button', { name: en.a11y.openHomework }).click();
      const pill = page.getByTestId('homework-row-pill').first();
      await expect(pill).toHaveAccessibleName(en.a11y.route.blend.fromClassMet);
      await expect(pill).toHaveText(en.learner.homework.from.teacher);
      // One label per row: never two with the same words.
      for (const row of await page.getByTestId('homework-row-pill').all()) await expect(row).toHaveText(en.learner.homework.from.teacher);
      await noBadWords(page);
      await shot(page, `route-blend-launch-homework-${size.width}`);
      expect(errors).toEqual([]);
    });

    test("a practice day with its lessons done: Refresh takes card (2) and opens the review", async ({ page }) => {
      test.skip(KILL_SWITCH, KILL_SWITCH_SKIP);
      // Friday: Wednesday's and Friday's lessons are done, and Friday is a Refresh date of the plan.
      const plan = blendedPlan();
      expect(plan.meta?.refresh?.some((entry) => entry.date === '2026-11-06')).toBe(true);
      await learner(page, { now: FRIDAY, plan, doneBefore: '2026-11-06' });
      const refresh = page.getByRole('button', { name: en.a11y.route.blend.refresh });
      await expect(refresh).toBeVisible();
      await expect(page.getByTestId('home-refresh')).toContainText(words.refreshLine);
      // Never a to-do and never a count.
      expect(await page.getByTestId('home-refresh').innerText()).not.toMatch(/\d/);
      await expect(page.getByTestId('home-class-today')).toHaveCount(0);
      await shot(page, `route-blend-launch-refresh-${size.width}`);
      await refresh.click();
      await expect(page.getByTestId('home-refresh')).toBeHidden();
      // The review itself is on screen, as the plan's Refresh step says (`refreshRouteOf`): the Daily Review's rounds,
      // its All refreshed page, or the Cell Check.
      const review = page
        .getByTestId('daily-review-dots')
        .or(page.getByRole('heading', { name: en.learner.dailyReview.allRefreshed.title }))
        .or(page.getByTestId('cell-check-title'));
      await expect(review.first()).toBeVisible();
      await shot(page, `route-blend-launch-refresh-opened-${size.width}`);
    });

    test('the own weekly plan rests: the resting line with See it, and its lessons wait out of sight', async ({ page }) => {
      const profileId = await learner(page, { now: TUESDAY, selfRoute: ownPlan() });
      await page.getByRole('button', { name: en.a11y.profileEntry }).click();
      const resting = page.getByTestId('profile-plan-resting');
      if (KILL_SWITCH) {
        // The resting line is a blended view; the rest itself (below) is derivation and still holds.
        await expect(resting).toHaveCount(0);
      } else {
        await resting.scrollIntoViewIfNeeded();
        await expect(resting).toContainText(words.ownResting);
        await expect(page.getByTestId('profile-plan-see-it')).toBeVisible();
      }
      await noBadWords(page);
      await expectNoSidewaysScroll(page, 'Profile, own plan resting');
      await shot(page, `route-blend-launch-resting-${size.width}`);
      // Kept on the device, not on Home or in Homework, and nothing is removed.
      const stored = await readStored<ProgressSnapshot>(page, `progress:${profileId}`);
      expect(stored?.selfRoute?.archivedAt).toBeNull();
      await page.goto('/');
      await page.getByRole('button', { name: en.a11y.openHomework }).click();
      await expect(page.getByText(en.learner.homework.from.route, { exact: true })).toHaveCount(0);
    });

    test('the weekly goal is the plan\'s distinct days: 4', async ({ page }) => {
      await learner(page, { now: WEDNESDAY, goals: true });
      await page.getByRole('button', { name: /^This week: / }).click();
      await expect(page.getByText(en.learner.goals.sheet.fromPlan(4))).toBeVisible();
      await shot(page, `route-blend-launch-goal-${size.width}`);
    });
  });
}

test('320 at the Largest text size: Class today and the Route line fit, nothing clipped or sideways', async ({ page }) => {
  test.skip(KILL_SWITCH, KILL_SWITCH_SKIP);
  await page.setViewportSize({ width: 320, height: 568 });
  await learner(page, { now: TUESDAY, largest: true });
  await expect(page.getByTestId('home-class-today')).toHaveText(words.classToday);
  await expectNoSidewaysScroll(page, 'Home at Largest');
  await expectNoClippedText(page, 'Home at Largest');
  await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
  await expect(page.getByTestId('my-route-blend-line')).toBeVisible();
  await expectNoSidewaysScroll(page, 'the Route line at Largest');
  await expectNoClippedText(page, 'the Route line at Largest');
  await shot(page, 'route-blend-launch-line-320-largest');
});

for (const locale of ['es', 'ko'] as const) {
  test(`${locale} at 320: Class today, the Route line and the resting line in ${locale}`, async ({ page }) => {
    test.skip(KILL_SWITCH, KILL_SWITCH_SKIP);
    await page.setViewportSize({ width: 320, height: 568 });
    const m = getMessages(locale);
    await learner(page, { now: TUESDAY, locale, selfRoute: ownPlan() });
    await expect(page.getByTestId('home-class-today')).toHaveText(m.learner.route.blend.classToday);
    await expectNoSidewaysScroll(page, `Home in ${locale}`);
    await shot(page, `route-blend-launch-home-${locale}-320`);
    await page.getByRole('tablist').getByRole('link', { name: m.a11y.myRoute.tab }).click();
    const line = page.getByTestId('my-route-blend-line');
    await expect(line).toBeVisible();
    expect(await line.innerText()).not.toMatch(/\{|\}|undefined/);
    await expectNoSidewaysScroll(page, `the Route line in ${locale}`);
    await expectNoClippedText(page, `the Route line in ${locale}`);
    await shot(page, `route-blend-launch-line-${locale}-320`);
    await page.getByRole('tablist').getByRole('link', { name: m.a11y.tabs.home }).click();
    await page.getByRole('button', { name: m.a11y.profileEntry }).click();
    const resting = page.getByTestId('profile-plan-resting');
    await resting.scrollIntoViewIfNeeded();
    await expect(resting).toContainText(m.learner.route.blend.ownResting);
    await shot(page, `route-blend-launch-resting-${locale}-320`);
  });
}
