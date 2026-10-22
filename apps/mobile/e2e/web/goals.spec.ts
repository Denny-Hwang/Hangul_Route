import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-CURR-002 section 7.4, OD-6, row CM-17 (design/wireframes/home/goal-ring-weekly-dots.md): the Home week strip
 * behind `goals`, which ships at built-in pct 0, so each case turns it on through the stored remote config, as a
 * ramp would. The strip is one button read as one sentence; the goals sheet changes the daily goal at any time;
 * the steady-weeks latch runs when Home opens; a run that ended shows "Start a new run" with the best run kept.
 * A fixed clock (Friday 23 October 2026, UTC) keeps the week stable.
 */

const m = getMessages('en');
const NOW = new Date('2026-10-23T10:00:00.000Z');
const [MON, TUE, THU, FRI] = ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23'];

test.use({ timezoneId: 'UTC' });

const quest = (day: string, i: number) => ({ id: `session:${day}T09:00:00.000Z:${i}`, profileId: '', startedAt: `${day}T09:00:00.000Z`, endedAt: `${day}T09:05:00.000Z`, durationSeconds: 300, episodesTouched: [], localDay: day });

function snapshotFor(profileId: string, over: Partial<ProgressSnapshot>): ProgressSnapshot {
  return { profileId, updatedAt: NOW.toISOString(), episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt: {}, ...over };
}

/** A learner Dani with `goals` on (the remote copy as a 100 % ramp leaves it) and the record `over`. */
async function learnerWith(page: Page, over: (profileId: string) => Partial<ProgressSnapshot>): Promise<void> {
  await page.clock.install({ time: NOW });
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: NOW.getTime(), maxAgeS: 300, flags: { goals: { on: true, pct: 100 } } });
  const fields = over(profileId);
  await seedStored(page, `progress:${profileId}`, snapshotFor(profileId, { ...fields, sessions: (fields.sessions ?? []).map((s) => ({ ...s, profileId })) }));
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
}

const strip = (page: Page) => page.getByRole('button', { name: /^This week: / });

test.describe('Home week strip (goals on)', () => {
  for (const width of [320, 1024]) {
    test(`${width}: dots, steady weeks as the headline, the streak below, and the ring; one button, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await learnerWith(page, () => ({
        sessions: [quest(MON, 1), quest(TUE, 2), quest(THU, 3)],
        dayLog: { [MON]: { 'ik-e2e0000000000000': 3 }, [TUE]: { 'ik-e2e0000000000000': 3 }, [THU]: { 'ik-e2e0000000000000': 3 } },
        goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-01T00:00:00.000Z' },
        steadyWeeks: { '2026-10-12': '2026-10-15T09:00:00.000Z' },
      }));
      // Home open latched this week (3 learned days, the default 3-day goal): the headline is 2 steady weeks.
      await expect(strip(page)).toHaveAccessibleName(
        'This week: Monday learned, Tuesday learned, Wednesday rest day, Thursday learned, Friday today, Saturday, Sunday. 2 steady weeks. Streak 3 days. Daily goal: Light, about 5 minutes, ready to start. Change goals.',
      );
      await expect(page.getByTestId('goal-headline')).toHaveText('2 steady weeks');
      await expect(page.getByTestId('goal-streak-line')).toHaveText('Streak 3 days');
      // The streak pill left the pills row: one streak string on Home.
      await expect(page.getByText('Streak 3 days', { exact: true })).toHaveCount(1);
      const box = await strip(page).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(96);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByText(/%|lost|missed/)).toHaveCount(0);
      const stored = await readStored<ProgressSnapshot>(page, `progress:${(await readStored<string>(page, 'profiles:active')) as string}`);
      expect(Object.keys(stored?.steadyWeeks ?? {})).toEqual(['2026-10-12', MON]);
      await shot(page, `goals-home-${width}`);
    });
  }

  test('320: the goals sheet changes the daily goal; Done saves it and the strip reads it', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await learnerWith(page, () => ({ sessions: [quest(THU, 1)], goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-01T00:00:00.000Z' } }));
    await strip(page).click();
    const sheet = page.getByRole('dialog', { name: m.learner.goals.sheet.title });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('radio', { name: 'Light, about 5 minutes' })).toBeChecked();
    await expect(sheet.getByText(m.learner.goals.sheet.restHelp)).toBeVisible();
    await shot(page, 'goals-sheet-320');
    await sheet.getByRole('radio', { name: 'Steady, about 10 minutes' }).click();
    await sheet.getByRole('radio', { name: '5 days' }).click();
    await sheet.getByRole('button', { name: m.learner.goals.sheet.done.cta }).click();
    await expect(sheet).toBeHidden();
    await expect(strip(page)).toHaveAccessibleName(/Daily goal: Steady, about 10 minutes, ready to start\. Change goals\.$/);
    const stored = await readStored<ProgressSnapshot>(page, `progress:${(await readStored<string>(page, 'profiles:active')) as string}`);
    expect(stored?.goals).toMatchObject({ daily: 6, weeklyDays: 5 });
  });

  test('320: a run that ended shows "Start a new run" with the best run kept, never a loss', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await learnerWith(page, () => ({ sessions: [quest(MON, 1)], streakLocal: { run: 1, lastDay: MON }, streakBest: 12, goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-01T00:00:00.000Z' } }));
    await expect(page.getByTestId('goal-streak-line')).toHaveText('Start a new run! Best run: 12 days');
    await expect(page.getByTestId('goal-dot-rest')).toHaveCount(2);
    await expect(page.getByText(/lost|broken|missed/i)).toHaveCount(0);
    await shot(page, 'goals-new-run-320');
  });

  test('the first choice shows once after the first finished activity; Not now keeps Light and never asks again', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await learnerWith(page, () => ({ sessions: [quest(FRI, 1)] }));
    const first = page.getByTestId('home-goal-first');
    await expect(first).toBeVisible();
    await expect(first.getByText(m.learner.goals.first.title)).toBeVisible();
    await first.getByRole('button', { name: m.learner.goals.first.later.cta }).click();
    await expect(first).toBeHidden();
    // Not now stores the default goals (Light, 3 days), so no device asks again.
    const profileId = (await readStored<string>(page, 'profiles:active')) as string;
    await expect.poll(async () => (await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.goals).toMatchObject({ daily: 3, weeklyDays: 3 });
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await expect(page.getByTestId('home-goal-first')).toHaveCount(0);
    await expect(strip(page)).toHaveAccessibleName(/Daily goal: Light, about 5 minutes/);
  });
});

test('goals off (the built-in pct 0): no strip, the streak pill as before', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await page.setViewportSize({ width: 320, height: 800 });
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await expect(page.getByTestId('home-goal-strip')).toHaveCount(0);
});
