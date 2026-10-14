import type { Page } from '@playwright/test';
import type { ProgressSnapshot, SelfRoute } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';
import { controlsPastEdge, expectNoHorizontalOverflow } from './viewport';

/**
 * F-PLAN-002 P2-7a (section 3.9; wireframe journey/my-route-overview.md K1): the Home prompt
 * "Hoya can make a weekly plan for you", the proposal screen and the Profile row. The entries
 * live behind `flags.routeEnabled`, on by default since P2-8b (English only, `routeEnabledFor`),
 * so the default build checks that both entries show in English, and the weekly plan build
 * (the flag on, es and ko shown) checks the flow:
 *
 *   pnpm --filter @hangul-route/mobile build:web:route      (writes dist-e2e-route/)
 *   E2E_ROUTE=1 pnpm --filter @hangul-route/mobile exec playwright test route-proposal
 *
 * CI plays it on that bundle in its own step of web-app.yml (F-PLAN-002 P2-8).
 *
 * build:web:route exports on a Metro cache of its own, so the flag never leaks into the release build.
 *
 * The browser clock is fixed on a Monday at midday UTC, so the app and the test agree on today.
 * P2-8 adds route.spec.ts (the journey, the seven-day window, the 320 px pass in es and ko).
 */

const ROUTE = process.env.E2E_ROUTE === '1';
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const EMOJI = /\p{Extended_Pictographic}/u;
/** Never on a learner plan screen: a product word, "route" (OD-7), shame words, a score shape. */
const NEVER = /premium|\bprice\b|\broute\b|\blate\b|\bbehind\b|\bmissed\b|\boverdue\b|%|\d\s*\/\s*\d/i;

/** One finished quest: enough for the prompt (AM-6). */
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

/** The install guide shows from the third cached open and covers Home. */
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
  return profileId;
}

/** A child profile never gets the Home prompt; the Profile row opens the plan only past the grown-up PIN. */
async function childSeesNoPromptAndThePinGate(page: Page): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, `progress:${profileId}`, snapshotWithOneQuest(profileId));
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await closeInstallGuide(page);
  await expect(page.getByTestId('home-plan-prompt')).toHaveCount(0);
  await page.getByRole('button', { name: /profile/i }).first().click();
  await page.getByTestId('profile-plan-row').click();
  await expect(page.getByTestId('route-proposal-headline')).toHaveCount(0);
  await unlockWithPin(page);
  await expect(page.getByTestId('route-proposal-headline')).toBeVisible();
}

test.describe('weekly plan entries on the default build (flag on by default, P2-8b)', () => {
  test.skip(ROUTE, 'runs on the default build only');

  test('the Home prompt and the Profile row show in English', async ({ page }) => {
    await selfLearnerWithAQuest(page, 'Rae');
    await expect(page.getByTestId('home-plan-prompt')).toBeVisible();
    await page.getByRole('button', { name: /profile/i }).first().click();
    await expect(page.getByTestId('profile-plan-row')).toBeVisible();
  });

  test('a child profile sees no prompt, and the Profile row asks for the grown-up PIN', async ({ page }) => {
    await childSeesNoPromptAndThePinGate(page);
  });
});

test.describe('the weekly plan at 320 px in English on the default build (P2-8b)', () => {
  test.skip(ROUTE, 'runs on the default build only');
  // React Native Web draws text in px, so 200 % browser zoom of a 640 px window lays out as this 320 px window.
  test.use({ viewport: { width: 320, height: 568 } });

  test('the proposal, the four set-up steps, the preview and the overview keep every control inside the window', async ({ page }) => {
    const t = getMessages('en').learner.weeklyPlan;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await selfLearnerWithAQuest(page, 'Bo');
    const check = async (name: string): Promise<void> => {
      await expectNoHorizontalOverflow(page, `${name}: horizontal overflow`);
      expect(await page.evaluate(controlsPastEdge), `${name}: controls past the edge`).toEqual([]);
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(EMOJI);
      expect(text, `${name}: a product, shame or score word`).not.toMatch(NEVER);
      await shot(page, `route-e2e-320-en-${name}`);
    };
    await page.getByTestId('home-plan-prompt-open').click();
    await expect(page.getByTestId('route-proposal-headline')).toBeVisible();
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
    expect(errors).toEqual([]);
  });
});

test.describe('weekly plan proposal (flag on)', () => {
  test.skip(!ROUTE, 'needs a build with EXPO_PUBLIC_ROUTE_ENABLED=true and E2E_ROUTE=1');

  test('a self learner makes a plan from the Home prompt with one tap', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const profileId = await selfLearnerWithAQuest(page, 'Rae');

    const prompt = page.getByTestId('home-plan-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText('Hoya can make a weekly plan for you');
    await prompt.scrollIntoViewIfNeeded();
    await shot(page, 'route-proposal-home-prompt');
    await page.getByRole('button', { name: 'Make my plan' }).click();

    // K1: the intro, the headline, the pace chips (Steady for "Some reading"), the suggested length.
    await expect(page.getByText('Hoya made a weekly plan for you.')).toBeVisible();
    await expect(page.getByTestId('route-proposal-headline')).toHaveText('We go on with Hangul from where you are.');
    await expect(page.getByRole('radio', { name: 'Steady, 3 days a week' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('route-proposal-suggested')).toHaveCount(1);
    await expect(page.getByRole('radio', { name: /^4 weeks/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^12 weeks/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^6 months/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true');
    const firstWeek = page.getByTestId('route-proposal-first-week');
    await expect(firstWeek.locator('[aria-label]')).toHaveCount(3);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(NEVER);
    expect(text).not.toMatch(EMOJI);
    await shot(page, 'route-proposal-k1');
    await page.getByRole('button', { name: 'Start this plan' }).scrollIntoViewIfNeeded();
    await shot(page, 'route-proposal-k1-end');

    // Brisk: four days a week in the first week; days and time open under the disclosure.
    await page.getByRole('radio', { name: 'Brisk, 4 days a week' }).click();
    await expect(firstWeek.locator('[aria-label]')).toHaveCount(4);
    await page.getByRole('button', { name: 'Change days and time' }).click();
    await expect(page.getByTestId('route-proposal-days')).toBeVisible();
    await expect(page.getByText('Pick 4 days.')).toBeVisible();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(4);
    await shot(page, 'route-proposal-days');
    // One day unticked: the plan waits for the day count and says so beside Start, never "free practice".
    await page.getByRole('checkbox', { checked: true }).first().click();
    await page.getByRole('button', { name: 'Hide days and time' }).click();
    await expect(page.getByTestId('route-proposal-days-waiting')).toHaveText('Pick 4 days.');
    await expect(page.getByText('This week is free practice.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Start this plan/ })).toBeDisabled();
    await page.getByRole('radio', { name: 'Steady, 3 days a week' }).click();

    await page.getByRole('button', { name: 'Start this plan' }).click();
    await expect(page.getByText('Hi, Rae!')).toBeVisible();
    await expect(page.getByTestId('home-plan-prompt')).toHaveCount(0);

    // Stored in the snapshot (it rides sync and the backup); the first week is derived as homework.
    await expect
      .poll(async () => {
        const route = (await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.selfRoute;
        return route === undefined || route === null ? 'none' : route.archivedAt;
      })
      .toBeNull();
    const stored = (await readStored<ProgressSnapshot>(page, `progress:${profileId}`)) as ProgressSnapshot & { selfRoute: SelfRoute };
    expect(stored.selfRoute.id).toMatch(/^route:[a-z0-9-]+$/);
    expect(stored.selfRoute.meta.params.sessionsPerWeek).toBe(3);
    const fromPlan = stored.homework.filter((h) => h.id.startsWith(`${stored.selfRoute.id}#`));
    expect(fromPlan.length).toBeGreaterThan(0);
    expect(fromPlan.every((h) => h.assignedBy === 'system' && (h.targetDate ?? '') <= '2026-10-19')).toBe(true);

    // Profile now reads "Your weekly plan" and opens the overview with this week (P2-7b, G3).
    await page.getByRole('button', { name: /profile/i }).first().click();
    await page.getByTestId('profile-plan-row').click();
    await expect(page.getByText('We found a path for you.')).toBeVisible();
    await expect(page.getByTestId('route-overview-current-rows').locator('[aria-label]')).not.toHaveCount(0);
    await shot(page, 'route-proposal-has-plan');
    expect(errors).toEqual([]);
  });

  test('Not now hides the Home prompt and remembers it; Profile keeps the row', async ({ page }) => {
    const profileId = await selfLearnerWithAQuest(page, 'Ola');
    await expect(page.getByTestId('home-plan-prompt')).toBeVisible();
    await page.getByTestId('home-plan-prompt-not-now').click();
    await expect(page.getByTestId('home-plan-prompt')).toHaveCount(0);
    await expect.poll(() => readStored<{ dismissedAt?: string }>(page, `route-ui:${profileId}`)).toEqual({ dismissedAt: new Date(NOW).toISOString() });
    await page.goto('/');
    await expect(page.getByText('Hi, Ola!')).toBeVisible();
    await expect(page.getByTestId('home-plan-prompt')).toHaveCount(0);

    await page.getByRole('button', { name: /profile/i }).first().click();
    await expect(page.getByTestId('profile-plan-row')).toContainText('Make a weekly plan');
    await page.getByTestId('profile-plan-row').click();
    await expect(page.getByText('Hoya made a weekly plan for you.')).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByTestId('profile-plan-row')).toBeVisible();
  });

  test('a child profile sees no prompt, and the Profile row asks for the grown-up PIN', async ({ page }) => {
    await childSeesNoPromptAndThePinGate(page);
  });
});
