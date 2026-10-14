import type { Page } from '@playwright/test';
import type { ProgressSnapshot, SelfRoute } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-PLAN-002 P2-7b (section 3.9; wireframe console/curriculum-planner.md G1 to G3; section 3.7
 * and FP-B14): **Change the plan** in four steps, the preview, "Your weekly plan", Move my plan
 * along, Stop this plan, and the Hoya check-in at the start of week 5. The screens live behind
 * `flags.routeEnabled` (on by default since P2-8b); this runs on the weekly plan build:
 *
 *   pnpm --filter @hangul-route/mobile build:web:route      (writes dist-e2e-route/)
 *   E2E_ROUTE=1 pnpm --filter @hangul-route/mobile exec playwright test route-plan
 *
 * CI plays it on that bundle in its own step of web-app.yml (F-PLAN-002 P2-8).
 *
 * The browser clock is fixed on a Monday at midday UTC; the check-in test moves it 29 days on.
 */

const ROUTE = process.env.E2E_ROUTE === '1';
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const DAY = 86_400_000;
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on a learner plan screen: a product word, "route" (OD-7), shame words, a score shape. */
const NEVER = /premium|\bprice\b|\broute\b|\blate\b|\bbehind\b|\bmissed\b|\boverdue\b|%|\d\s*\/\s*\d/i;

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
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await closeInstallGuide(page);
  // The level-check card holds Home's one quiet slot while it is eligible (F-PLC-001 section 3.10, on since P-10);
  // its Not now hands the slot to the weekly plan.
  await page.getByTestId('home-level-check-not-now').click();
  return profileId;
}

async function storedRoute(page: Page, profileId: string): Promise<SelfRoute | null> {
  return (await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.selfRoute ?? null;
}

async function noBannedWords(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(NEVER);
  expect(text).not.toMatch(EMOJI);
}

test.describe('weekly plan set-up, preview and overview (flag on)', () => {
  test.skip(!ROUTE, 'needs a build with EXPO_PUBLIC_ROUTE_ENABLED=true and E2E_ROUTE=1');

  test('More choices: four steps, the preview, Start this plan, then Move my plan along, Change the plan and Stop this plan', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await selfLearnerWithAQuest(page, 'Rae');
    await page.getByRole('button', { name: 'Make my plan' }).click();
    await expect(page.getByText('Hoya made a weekly plan for you.')).toBeVisible();
    await page.getByRole('button', { name: 'More choices' }).click();

    // G1 step 1: where to start, prefilled (no level check: Brand new).
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 1 of 4');
    await expect(page.getByRole('radio', { name: 'Brand new' })).toHaveAttribute('aria-checked', 'true');
    await noBannedWords(page);
    await shot(page, 'route-setup-start');
    await page.getByRole('radio', { name: 'Knows some letters' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: time. Gentle, then two days picked; minutes.
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 2 of 4');
    await page.getByRole('radio', { name: 'Gentle, 2 days a week' }).click();
    await expect(page.getByText('Pick 2 days.')).toBeVisible();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(2);
    await page.getByRole('radio', { name: '10 minutes a day' }).click();
    await shot(page, 'route-setup-time');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: how long.
    await page.getByRole('radio', { name: '4 weeks' }).click();
    await shot(page, 'route-setup-length');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: what you like; themes keep the order tapped.
    await page.getByRole('radio', { name: 'Culture and stories' }).click();
    await page.getByTestId('route-setup-theme-nature').click();
    await page.getByTestId('route-setup-theme-rites').click();
    await expect(page.getByTestId('route-setup-theme-nature')).toHaveText('1. Nature');
    await expect(page.getByTestId('route-setup-theme-rites')).toHaveText('2. Holidays');
    await shot(page, 'route-setup-likes');
    await page.getByRole('button', { name: 'See my plan' }).click();

    // G2: the new plan, its weeks and stats; never Premium.
    await expect(page.getByText('Your new plan')).toBeVisible();
    await expect(page.getByTestId('route-preview-stats')).toBeVisible();
    await expect(page.getByTestId('route-preview-week-1')).toBeVisible();
    await expect(page.getByTestId('route-preview-week-1-rows').locator('[aria-label]')).toHaveCount(2);
    await noBannedWords(page);
    await shot(page, 'route-preview');
    await page.getByRole('button', { name: 'Start this plan' }).click();

    // G3: the overview, with this week first.
    await expect(page.getByText('We found a path for you.')).toBeVisible();
    await expect(page.getByTestId('route-overview-current-rows').locator('[aria-label]')).toHaveCount(2);
    await noBannedWords(page);
    await shot(page, 'route-overview');
    const created = (await storedRoute(page, profileId)) as SelfRoute;
    expect(created.meta.params).toMatchObject({ sessionsPerWeek: 2, minutesPerSession: 10, weeks: 4, level: { stage: 'stage1', band: 1 }, goals: { focus: 'culture', themes: ['nature', 'rites'] } });

    // Move my plan along: same plan, re-paced today, calm words.
    await page.getByRole('button', { name: 'Move my plan along' }).click();
    await expect(page.getByTestId('route-overview-moved-by-hand')).toHaveText('Your plan moved along. It starts again from today.');
    await expect.poll(async () => (await storedRoute(page, profileId))?.meta.repacedAt ?? null).toBe(new Date(NOW).toISOString());
    expect((await storedRoute(page, profileId))?.id).toBe(created.id);

    // Change the plan: the steps start from the plan in force, and Start this plan replaces it.
    await page.getByRole('button', { name: 'Change the plan' }).click();
    await expect(page.getByTestId('route-setup-step')).toHaveText('Step 1 of 4');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('radio', { name: 'Steady, 3 days a week' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'See my plan' }).click();
    await expect(page.getByText('Your new plan')).toBeVisible();
    await page.getByRole('button', { name: 'Start this plan' }).click();
    await expect(page.getByText('We found a path for you.')).toBeVisible();
    await expect(page.getByText('That did not work. Try again.')).toHaveCount(0);
    await expect.poll(async () => (await storedRoute(page, profileId))?.meta.params.sessionsPerWeek ?? 0).toBe(3);
    const changed = (await storedRoute(page, profileId)) as SelfRoute;
    expect(changed.id).not.toBe(created.id);
    expect(changed.archivedAt).toBeNull();
    expect(changed.meta.params).toMatchObject({ weeks: 4, level: { stage: 'stage1', band: 1 } });

    // Stop this plan: asked once; what was finished stays; the plan is archived, never removed.
    await page.getByRole('button', { name: 'Stop this plan' }).click();
    await expect(page.getByTestId('route-overview-stop-confirm')).toContainText('Everything you finished stays yours.');
    await shot(page, 'route-overview-stop');
    await page.getByRole('button', { name: 'Yes, stop it' }).click();
    await expect(page.getByTestId('route-overview-none')).toBeVisible();
    await expect.poll(async () => (await storedRoute(page, profileId))?.archivedAt ?? null).not.toBeNull();
    const after = (await readStored<ProgressSnapshot>(page, `progress:${profileId}`)) as ProgressSnapshot;
    expect(after.homework.filter((h) => (h.id.startsWith(`${created.id}#`) || h.id.startsWith(`${changed.id}#`)) && h.completedAt === undefined)).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('week 5: Hoya offers a lighter week once, and yes moves the plan to Gentle', async ({ page }) => {
    const profileId = await selfLearnerWithAQuest(page, 'Ola');
    await page.getByRole('button', { name: 'Make my plan' }).click();
    await page.getByRole('radio', { name: /^12 weeks/ }).click();
    await page.getByRole('button', { name: 'Start this plan' }).click();
    await expect(page.getByText('Hi, Ola!')).toBeVisible();
    await expect.poll(async () => (await storedRoute(page, profileId))?.meta.params.sessionsPerWeek ?? 0).toBe(3);

    // 29 days on, nothing finished in weeks 1 to 4: Hoya asks.
    await page.clock.setFixedTime(NOW + 29 * DAY);
    await page.goto('/');
    await expect(page.getByText('Hi, Ola!')).toBeVisible();
    await closeInstallGuide(page);
    const card = page.getByTestId('home-plan-check-in');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Want a lighter week?');
    await expect(card).toContainText('Gentle: 2 days a week.');
    const cardText = await card.innerText();
    expect(cardText).not.toMatch(NEVER);
    expect(cardText).not.toMatch(EMOJI);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'route-check-in-home');
    await page.getByRole('button', { name: 'Yes, lighter' }).click();
    await expect(page.getByTestId('home-plan-check-in-done')).toHaveText('Your plan now has 2 days a week.');
    await expect.poll(async () => (await storedRoute(page, profileId))?.meta.params.sessionsPerWeek ?? 0).toBe(2);
    await expect.poll(() => readStored<{ checkInFor?: string }>(page, `route-ui:${profileId}`).then((ui) => ui?.checkInFor ?? null)).not.toBeNull();

    // Once per plan: back on Home later, no check-in.
    await page.goto('/');
    await expect(page.getByText('Hi, Ola!')).toBeVisible();
    await expect(page.getByTestId('home-plan-check-in')).toHaveCount(0);
  });

  test('week 5: answered on the overview, Home lets its card go without a reload', async ({ page }) => {
    const profileId = await selfLearnerWithAQuest(page, 'Ida');
    await page.getByRole('button', { name: 'Make my plan' }).click();
    await page.getByRole('radio', { name: /^12 weeks/ }).click();
    await page.getByRole('button', { name: 'Start this plan' }).click();
    await expect(page.getByText('Hi, Ida!')).toBeVisible();
    await expect.poll(async () => (await storedRoute(page, profileId))?.meta.params.sessionsPerWeek ?? 0).toBe(3);

    await page.clock.setFixedTime(NOW + 29 * DAY);
    await page.goto('/');
    await expect(page.getByText('Hi, Ida!')).toBeVisible();
    await closeInstallGuide(page);
    await expect(page.getByTestId('home-plan-check-in')).toBeVisible();

    // The same offer on the overview; Not now there closes it for this plan.
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByTestId('profile-plan-row').click();
    await expect(page.getByTestId('route-overview-check-in')).toBeVisible();
    await page.getByTestId('route-overview-check-in-not-now').click();
    await expect(page.getByTestId('route-overview-check-in')).toHaveCount(0);
    await expect.poll(() => readStored<{ checkInFor?: string }>(page, `route-ui:${profileId}`).then((ui) => ui?.checkInFor ?? null)).not.toBeNull();

    // Back to Home through the app (no reload): the card is gone, the plan kept its pace.
    await page.getByTestId('route-overview-back').click();
    await expect(page.getByTestId('profile-plan-row')).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).first().click();
    await expect(page.getByText('Hi, Ida!')).toBeVisible();
    await expect(page.getByTestId('home-plan-check-in')).toHaveCount(0);
    expect((await storedRoute(page, profileId))?.meta.params.sessionsPerWeek).toBe(3);
  });

  test('a child\'s plan: no check-in without the grown-up, and Stop this plan asks for the grown-up PIN first', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await onboardChild(page, { name: 'Dani', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    const profileId = (await readStored<string>(page, 'profiles:active')) as string;
    await seedStored(page, `progress:${profileId}`, snapshotWithOneQuest(profileId));
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await closeInstallGuide(page);
    // Not now on the level-check card leaves Home's quiet slot to the plan (F-PLC-001 section 3.10).
    await page.getByTestId('home-level-check-not-now').click();
    // The grown-up makes the plan through the gate.
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByTestId('profile-plan-row').click();
    await unlockWithPin(page);
    await page.getByRole('radio', { name: /^12 weeks/ }).click();
    await page.getByRole('button', { name: 'Start this plan' }).click();
    await expect.poll(async () => (await storedRoute(page, profileId))?.meta.params.sessionsPerWeek ?? 0).toBeGreaterThan(0);
    const pace = (await storedRoute(page, profileId))?.meta.params.sessionsPerWeek;

    // Week 5, a new visit (the grown-up session is over): Hoya does not ask the child; the plan moved along quietly.
    await page.clock.setFixedTime(NOW + 29 * DAY);
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await closeInstallGuide(page);
    await expect(page.getByTestId('home-plan-moved')).toBeVisible();
    await expect(page.getByTestId('home-plan-check-in')).toHaveCount(0);

    // See my plan opens the overview with no check-in; Stop this plan goes to the grown-up PIN, not the confirm step.
    await page.getByTestId('home-plan-moved-open').click();
    await expect(page.getByTestId('route-overview-current')).toBeVisible();
    await expect(page.getByTestId('route-overview-check-in')).toHaveCount(0);
    await page.getByTestId('route-overview-stop').click();
    await expect(page.getByTestId('route-overview-stop-confirm')).toHaveCount(0);
    await unlockWithPin(page);
    // Back on the overview with the gate open: the confirm step shows, and the check-in is the grown-up's to answer.
    await expect(page.getByTestId('route-overview-stop-confirm')).toBeVisible();
    await expect(page.getByTestId('route-overview-check-in')).toBeVisible();
    expect((await storedRoute(page, profileId))?.archivedAt).toBeNull();
    expect((await storedRoute(page, profileId))?.meta.params.sessionsPerWeek).toBe(pace);
    await page.getByTestId('route-overview-stop-yes').click();
    await expect.poll(async () => (await storedRoute(page, profileId))?.archivedAt ?? null).not.toBeNull();
  });
});

/**
 * F-ROUTE-001 R-7d: **Open plan** on the Learning Route's weekly plan line opens "Your weekly plan"
 * (`RouteOverview`) for the learner's own plan. The Route tab (`flags.myRouteEnabled`) is on by default since
 * F-ROUTE-001 R-10b, so this needs only the weekly plan flag:
 *
 *   EXPO_PUBLIC_ROUTE_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_ROUTE=1 pnpm --filter @hangul-route/mobile exec playwright test route-plan -g "Open plan"
 */
test.describe('Open plan on the Learning Route (flags on)', () => {
  test.skip(!ROUTE, 'needs a build with EXPO_PUBLIC_ROUTE_ENABLED=true and E2E_ROUTE=1');

  test('the plan line names the week and Open plan opens the weekly plan; back returns to the Route tab', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await selfLearnerWithAQuest(page, 'Noa');
    await page.getByRole('button', { name: 'Make my plan' }).click();
    await page.getByRole('button', { name: 'Start this plan' }).click();
    await expect(page.getByText('Hi, Noa!')).toBeVisible();
    await expect.poll(async () => (await storedRoute(page, profileId))?.id ?? null).not.toBeNull();

    await page.getByRole('tablist').getByRole('link', { name: 'Learning Route' }).click();
    await expect(page.getByTestId('my-route-plan-line')).toHaveText('Week 1 of your weekly plan');
    const open = page.getByRole('button', { name: 'Open plan', exact: true });
    await expect(open).toBeVisible();
    await open.scrollIntoViewIfNeeded();
    await shot(page, 'my-route-open-plan');
    await open.click();

    await expect(page.getByText('We found a path for you.')).toBeVisible();
    await page.getByTestId('route-overview-back').click();
    await expect(page.getByTestId('my-route-plan-line')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
