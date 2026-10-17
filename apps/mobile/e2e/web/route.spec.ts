import type { Page } from '@playwright/test';
import type { HomeworkAssignment, ProgressSnapshot, SelfRoute } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { questsAll } from '../../src/content/quests';
import { expect, test } from './fixtures';
import { onboardSelf, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-PLAN-002 P2-8 (section 5 `mobile/e2e/web/route.spec.ts`, section 6 beta check; wireframes
 * route/proposal.md, route/setup.md, route/overview.md): the learner's own weekly plan end to end.
 *
 * - The journey: the proposal, **More choices** into the four set-up steps, the preview, **Start this
 *   plan**, the overview; Home card (2) and the Homework list follow the plan; **Move my plan along**
 *   re-lays it from today; **Change the plan** opens the steps from the plan in force; **Stop this plan**.
 * - The seven-day cap of the beta check: with the longest, busiest plan (6 months, Brisk), no learner
 *   screen lists more than seven days ahead, today and a week later.
 * - The pre-flip 320 px pass (section 6, P2-8 row): set-up, preview and overview in Spanish and Korean
 *   push nothing past the side of the window.
 *
 * The screens sit behind `flags.routeEnabled` (on by default since P2-8b, English only); this runs
 * on the weekly plan build, which also shows Spanish and Korean:
 *
 *   pnpm --filter @hangul-route/mobile build:web:route      (writes dist-e2e-route/)
 *   E2E_ROUTE=1 pnpm --filter @hangul-route/mobile exec playwright test route
 *
 * The browser clock is fixed on a Monday at midday UTC, so the app and the test agree on today.
 */

const ROUTE = process.env.E2E_ROUTE === '1';
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const DAY = 86_400_000;
const dayKey = (at: number): string => new Date(at).toISOString().slice(0, 10);
/** The device derives a curriculum up to today + 7 (`HORIZON_DAYS`); the Homework list shows the next seven days. */
const WINDOW_DAYS = 7;
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on a learner plan screen: a product word, "route" (OD-7), shame words, a score shape. */
const NEVER = /premium|\bprice\b|\broute\b|\blate\b|\bbehind\b|\bmissed\b|\boverdue\b|%|\d\s*\/\s*\d/i;
/** A score shape in any locale. */
const SCORE = /%|\d\s*\/\s*\d/;
/**
 * Shame words of the Spanish and Korean plan screens: late, behind, missed, overdue, unfinished.
 * Korean is written as Unicode escapes (romanized: millin, neuj, nochin, mi-wallyo, jiyeon), so
 * this file holds no Hangul outside the romanization check.
 */
const LOCALE_SHAME: Record<'es' | 'ko', RegExp> = {
  es: /atrasad|retrasad|tarde\b|perdid|vencid/i,
  ko: /\uBC00\uB9B0|\uB2A6|\uB193\uCE5C|\uBBF8\uC644\uB8CC|\uC9C0\uC5F0/,
};

const snapshotWithOneQuest = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: new Date(NOW - 3_600_000).toISOString(),
  episodes: [],
  quests: [
    {
      questId: 'quest:stage1-letters-q1',
      episodeId: 'episode:stage1-letters',
      stars: 3,
      accuracy: 1,
      attempts: 1,
      startedAt: new Date(NOW - 7_200_000).toISOString(),
      completedAt: new Date(NOW - 7_000_000).toISOString(),
    },
  ],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 1,
});

async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function selfLearnerWithAQuest(page: Page, name: string): Promise<string> {
  await page.clock.setFixedTime(NOW);
  await onboardSelf(page, { name, startJourney: false });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, `progress:${profileId}`, snapshotWithOneQuest(profileId));
  await closeInstallGuide(page);
  // After "I am new to Korean" the level-check card waits for three quests (owner request 2026-10-16, item 8), so
  // Home's quiet slot is the weekly plan's already.
  await expect(page.getByTestId('home-level-check')).toHaveCount(0);
  return profileId;
}

async function stored(page: Page, profileId: string): Promise<ProgressSnapshot> {
  return (await readStored<ProgressSnapshot>(page, `progress:${profileId}`)) as ProgressSnapshot;
}

/** The plan's derived homework that is still to do. */
function pendingFromPlan(snapshot: ProgressSnapshot): HomeworkAssignment[] {
  const route = snapshot.selfRoute;
  if (route === undefined || route === null) return [];
  return snapshot.homework.filter((h) => h.id.startsWith(`${route.id}#`) && h.completedAt === undefined);
}

async function noBannedWords(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(NEVER);
  expect(text).not.toMatch(EMOJI);
}

/** The Homework list's due labels ("Today", "Tomorrow", "In 3 days"): none further than the window, and no Later row. */
async function expectHomeworkWithinAWeek(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open homework' }).click();
  await expect(page.getByRole('heading', { name: 'Homework' })).toBeVisible();
  await expect(page.getByRole('button', { name: /, (Today|Tomorrow|In \d+ days)$/ }).first()).toBeVisible();
  const labels = await page.getByRole('button', { name: /, In \d+ days$/ }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  for (const label of labels) expect(Number(/In (\d+) days$/.exec(label)?.[1])).toBeLessThanOrEqual(WINDOW_DAYS);
  await expect(page.getByTestId('homework-later')).toHaveCount(0);
  await noBannedWords(page);
}

test.describe('the weekly plan end to end (flag on)', () => {
  test.skip(!ROUTE, 'needs the weekly plan build (build:web:route) and E2E_ROUTE=1');

  test('set-up, preview and Start; Home and Homework follow the plan; Move my plan along, Change the plan, Stop this plan', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await selfLearnerWithAQuest(page, 'Rae');

    // RouteProposal -> More choices -> the four steps with their defaults -> the preview.
    await page.getByTestId('home-plan-prompt-open').click();
    await expect(page.getByTestId('route-proposal-headline')).toBeVisible();
    await page.getByTestId('route-proposal-more-choices').click();
    for (const step of [1, 2, 3]) {
      await expect(page.getByTestId('route-setup-step')).toHaveText(`Step ${step} of 4`);
      await noBannedWords(page);
      // A choice that is not the default (15 minutes), so Change the plan can show it came from the plan in force.
      if (step === 2) await page.getByTestId('route-setup-minutes-20').click();
      await page.getByTestId('route-setup-next').click();
    }
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 4 of 4');
    await noBannedWords(page);
    await page.getByTestId('route-setup-see').click();
    await expect(page.getByTestId('route-preview-stats')).toBeVisible();
    await expect(page.getByTestId('route-preview-week-1')).toBeVisible();
    await noBannedWords(page);
    await page.getByTestId('route-preview-start').click();

    // RouteOverview: this week first, later weeks folded away.
    await expect(page.getByText('We found a path for you.')).toBeVisible();
    await expect(page.getByTestId('route-overview-current')).toBeVisible();
    await noBannedWords(page);
    await shot(page, 'route-e2e-overview');
    await expect.poll(async () => pendingFromPlan(await stored(page, profileId)).length).toBeGreaterThan(0);
    const created = (await stored(page, profileId)).selfRoute as SelfRoute;
    expect(created.meta.params.minutesPerSession).toBe(20);

    // Home follows the plan: today's lesson from the plan is card (2), picked for the learner.
    await page.getByTestId('route-overview-back').click();
    await page.goto('/');
    await expect(page.getByText('Hi, Rae!')).toBeVisible();
    await closeInstallGuide(page);
    const today = pendingFromPlan(await stored(page, profileId)).filter((h) => (h.targetDate ?? '') <= dayKey(NOW));
    expect(today.length).toBeGreaterThan(0);
    // Card (2) is the plan's lesson for today, not just any assigned item. It is also the one next, so it is the Next
    // lesson hero's lesson and card (2) is drawn as the hero's quiet row (AMENDMENTS-DISPLAY-NAV 9.1).
    const first = [...today].sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? ''))[0] as HomeworkAssignment;
    const title = questsAll.find((q) => q.id === first.questId)?.titleEn;
    expect(title, `a title for ${first.questId}`).toBeTruthy();
    await expect(page.getByTestId('home-missions').getByRole('button')).toHaveCount(2);
    await expect(page.getByTestId('home-mission-same-as-hero-2')).toContainText(title as string);
    await expect(page.getByTestId('home-next-lesson')).toContainText(title as string);
    await shot(page, 'route-e2e-home-card-2');
    await expectHomeworkWithinAWeek(page);
    await expect(page.getByRole('button', { name: /, Today$/ }).first()).toContainText('Your plan');

    // Two days on, nothing played: below the automatic re-pace (fewer than three pending past items), so the
    // plan has not moved yet; Move my plan along lays the rest again from today; same plan.
    const later = NOW + 2 * DAY;
    await page.clock.setFixedTime(later);
    await page.goto('/');
    await expect(page.getByText('Hi, Rae!')).toBeVisible();
    await closeInstallGuide(page);
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByTestId('profile-plan-row').click();
    await expect(page.getByTestId('route-overview-current')).toBeVisible();
    const beforeMove = await stored(page, profileId);
    expect(beforeMove.selfRoute?.meta.repacedAt ?? null).toBeNull();
    await page.getByTestId('route-overview-move-along').click();
    await expect(page.getByTestId('route-overview-moved-by-hand')).toHaveText('Your plan moved along. It starts again from today.');
    await expect.poll(async () => (await stored(page, profileId)).selfRoute?.meta.repacedAt ?? null).toBe(new Date(later).toISOString());
    const moved = await stored(page, profileId);
    expect(moved.selfRoute?.id).toBe(created.id);
    const pending = pendingFromPlan(moved);
    expect(pending.length).toBeGreaterThan(0);
    for (const h of pending) {
      expect(h.targetDate ?? '').not.toBe('');
      expect((h.targetDate ?? '') >= dayKey(later)).toBe(true);
      expect((h.targetDate ?? '') <= dayKey(later + WINDOW_DAYS * DAY)).toBe(true);
    }

    // Change the plan: the steps open on the plan in force (its 20 minutes, not the default 15); Back from
    // step 2 to step 1 and out returns to the overview with the plan unchanged.
    const beforeChange = (await stored(page, profileId)).selfRoute as SelfRoute;
    await page.getByTestId('route-overview-change').click();
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 1 of 4');
    await page.getByTestId('route-setup-next').click();
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 2 of 4');
    await expect(page.getByTestId('route-setup-minutes-20')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('route-setup-minutes-15')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('route-setup-back').click();
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 1 of 4');
    await page.getByTestId('route-setup-back').click();
    await expect(page.getByTestId('route-overview-current')).toBeVisible();
    const afterBack = (await stored(page, profileId)).selfRoute as SelfRoute;
    expect(afterBack.id).toBe(created.id);
    expect(afterBack.items).toEqual(beforeChange.items);
    expect(afterBack.meta.params).toEqual(beforeChange.meta.params);

    // Stop this plan: asked once, archived (never removed), its pending items leave the list.
    await page.getByTestId('route-overview-stop').click();
    await page.getByTestId('route-overview-stop-yes').click();
    await expect(page.getByTestId('route-overview-none')).toBeVisible();
    await expect.poll(async () => (await stored(page, profileId)).selfRoute?.archivedAt ?? null).not.toBeNull();
    const after = await stored(page, profileId);
    expect(after.homework.filter((h) => h.id.startsWith(`${created.id}#`) && h.completedAt === undefined)).toHaveLength(0);
    expect(after.quests.map((q) => q.questId)).toContain('quest:stage1-letters-q1');
    expect(errors).toEqual([]);
  });

  test('beta check: the longest, busiest plan never lists more than seven days ahead, today or a week later', async ({ page }) => {
    const profileId = await selfLearnerWithAQuest(page, 'Ola');
    await page.getByTestId('home-plan-prompt-open').click();
    await page.getByTestId('route-proposal-pace-brisk').click();
    await page.getByTestId('route-proposal-length-6-month').click();
    await page.getByTestId('route-proposal-start').click();
    await expect(page.getByText('Hi, Ola!')).toBeVisible();
    await expect.poll(async () => (await stored(page, profileId)).selfRoute?.meta.params.sessionsPerWeek ?? 0).toBe(4);
    const route = (await stored(page, profileId)).selfRoute as SelfRoute;
    // The stored plan holds the whole half year; only the window reaches the learner's lists.
    expect(route.items.some((item) => (item.targetDate ?? '') > dayKey(NOW + 30 * DAY))).toBe(true);

    for (const at of [NOW, NOW + 7 * DAY]) {
      await page.clock.setFixedTime(at);
      await page.goto('/');
      await expect(page.getByText('Hi, Ola!')).toBeVisible();
      await closeInstallGuide(page);
      const derived = (await stored(page, profileId)).homework.filter((h) => h.id.startsWith(`${route.id}#`));
      expect(derived.length).toBeGreaterThan(0);
      for (const h of derived) expect((h.targetDate ?? '') <= dayKey(at + WINDOW_DAYS * DAY)).toBe(true);
      await expectHomeworkWithinAWeek(page);
      await shot(page, `route-e2e-seven-days-${dayKey(at)}`);

      // The overview opens on this week; the later weeks stay folded until the learner opens them.
      await page.goto('/');
      await expect(page.getByText('Hi, Ola!')).toBeVisible();
      await closeInstallGuide(page);
      await page.getByRole('button', { name: /profile/i }).first().click();
      await page.getByTestId('profile-plan-row').click();
      await expect(page.getByTestId('route-overview-current')).toBeVisible();
      await expect(page.getByTestId('route-overview-later')).toBeVisible();
      await expect(page.locator('[data-testid^="route-overview-week-"]')).toHaveCount(0);
    }
  });
});

for (const locale of ['es', 'ko'] as const) {
  test.describe(`the weekly plan at 320 px in ${locale} (flag on)`, () => {
    test.skip(!ROUTE, 'needs the weekly plan build (build:web:route, es and ko shown) and E2E_ROUTE=1');
    test.use({ viewport: { width: 320, height: 568 } });

    test(`set-up, preview and overview keep every control inside the window (${locale})`, async ({ page }) => {
      const t = getMessages(locale).learner.weeklyPlan;
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await selfLearnerWithAQuest(page, 'Ana');
      await seedStored(page, 'device:settings', { uiLocale: locale });
      await closeInstallGuide(page);

      const check = async (name: string): Promise<void> => {
        await expectNoHorizontalOverflow(page, `${name}: horizontal overflow`);
        expect(await page.evaluate(controlsPastEdge), `${name}: controls past the edge`).toEqual([]);
        const text = await page.locator('body').innerText();
        expect(text).not.toMatch(EMOJI);
        expect(text, `${name}: a score shape`).not.toMatch(SCORE);
        expect(text, `${name}: a shame word`).not.toMatch(LOCALE_SHAME[locale]);
        await shot(page, `route-e2e-320-${locale}-${name}`);
      };

      await page.getByTestId('home-plan-prompt-open').click();
      await expect(page.getByTestId('route-proposal-headline')).toBeVisible();
      await expect(page.getByText(t.proposal.intro)).toBeVisible();
      await check('proposal');
      await page.getByTestId('route-proposal-more-choices').click();
      for (const step of [1, 2, 3, 4]) {
        await expect(page.getByTestId('route-setup-step')).toHaveText(t.setup.stepOf(step, 4));
        await check(`setup-${step}`);
        await page.getByTestId(step === 4 ? 'route-setup-see' : 'route-setup-next').click();
      }
      await expect(page.getByText(t.planPreview.title)).toBeVisible();
      await check('preview');
      await page.getByTestId('route-preview-start').click();
      await expect(page.getByText(t.overview.intro)).toBeVisible();
      await check('overview');
      await page.getByTestId('route-overview-later').click();
      await expect(page.locator('[data-testid^="route-overview-week-"]').first()).toBeVisible();
      await check('overview-open');
      expect(errors).toEqual([]);
    });
  });
}
