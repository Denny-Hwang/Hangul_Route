import type { Page } from '@playwright/test';
import type { HomeworkAssignment, ProgressSnapshot, SelfRoute } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * F-PLAN-002 section 3.6 display fixes (PR P2-5): Home counts today's items
 * only; the Homework list shows at most three Today rows and one neutral line,
 * the next seven days of Coming up, then one collapsed "later" row; the
 * learner's own weekly plan reads "Your plan" and is derived on the device
 * with no network. Nothing says late or missed. The browser clock is fixed at
 * midday UTC, so the test and the app agree on "today" whenever it runs.
 */

const DAY_MS = 86_400_000;
const NOW = Date.parse('2026-10-14T12:00:00.000Z');
const dayKey = (offset: number): string => new Date(NOW + offset * DAY_MS).toISOString().slice(0, 10);

const assignment = (id: string, questId: string, offset: number, assignedBy: HomeworkAssignment['assignedBy'] = 'parent'): HomeworkAssignment => ({
  id,
  profileId: '', // set by snapshotWith
  questId,
  episodeId: questId.startsWith('quest:stage1-letters') ? 'episode:stage1-letters' : 'episode:stage1-life',
  assignedBy,
  assignedAt: `${dayKey(-10)}T08:00:00.000Z`,
  targetDate: dayKey(offset),
});

/** The install guide shows from the third cached open and covers Home (as in `openGrownUpZone`). */
async function openHomework(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Open homework' }).click();
}

/** A fresh learner's record holding only `homework` (the app keeps no record until something is played). */
const snapshotWith = (profileId: string, homework: HomeworkAssignment[], selfRoute?: SelfRoute): ProgressSnapshot => ({
  profileId,
  updatedAt: new Date(NOW).toISOString(),
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: homework.map((h) => ({ ...h, profileId })),
  reviews: [],
  streakDays: 0,
  ...(selfRoute ? { selfRoute } : {}),
});

test('a long plan shows one calm week: three Today rows, the next seven days, one later row', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(NOW);
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();

  const activeId = await readStored<string>(page, 'profiles:active');
  expect(activeId).not.toBeNull();
  const profileId = activeId as string;
  const homework = [
    assignment('plan:term#quest:stage1-letters-q1', 'quest:stage1-letters-q1', -2, 'teacher'),
    assignment('hw:home-1', 'quest:stage1-letters-q2', 0),
    assignment('hw:home-2', 'quest:stage1-letters-q3', 0),
    assignment('route:mine#quest:stage1-life-q1', 'quest:stage1-life-q1', -1, 'system'),
    assignment('hw:home-3', 'quest:stage1-life-q2', 0),
    assignment('hw:soon', 'quest:stage1-life-q2', 3),
    assignment('hw:week', 'quest:stage1-letters-q2', 7),
    assignment('hw:later', 'quest:stage1-letters-q3', 12),
    assignment('hw:much-later', 'quest:stage1-life-q1', 40),
  ];
  await seedStored(page, `progress:${profileId}`, snapshotWith(profileId, homework));

  // Home: five are due today or earlier (more than the list shows), so the line has no number; later ones are not counted.
  await expect(page.getByText('A few to do today')).toBeVisible();
  await openHomework(page);
  await expect(page.getByRole('heading', { name: 'Homework' })).toBeVisible();
  await expect(page.getByText('You have a few things to do today.')).toBeVisible();

  // Today: three rows in precedence order (class first), then the neutral line.
  const todayRows = page.getByRole('button', { name: /, Today$/ });
  await expect(todayRows).toHaveCount(3);
  await expect(todayRows.first()).toContainText('From class');
  await expect(page.getByText('More are waiting. They come one at a time.')).toBeVisible();

  // Coming up: tomorrow-to-seven days only; the rest behind one collapsed row.
  await expect(page.getByRole('button', { name: /, In 3 days$/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /, In 7 days$/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /, In 12 days$/ })).toHaveCount(0);
  const later = page.getByTestId('homework-later');
  await expect(later).toContainText('Later');
  await expect(later).not.toHaveAttribute('aria-expanded', 'true');
  await shot(page, 'homework-window-collapsed');

  await later.click();
  await expect(later).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: /, In 12 days$/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /, In 40 days$/ })).toHaveCount(1);
  await shot(page, 'homework-window-expanded');

  const text = (await page.locator('body').innerText()).toLowerCase();
  for (const word of ['late', 'missed', 'overdue', 'behind']) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  expect(errors).toEqual([]);
});

test('the own weekly plan is derived on the device with no inbox and reads "Your plan"', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await onboardChild(page, { name: 'Mina', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  // Only the fields the device reads; the route holds one item today and one past the seven-day horizon.
  const route = {
    id: 'route:mine',
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    archivedAt: null,
    meta: { kind: 'curriculum', horizonDays: 7 },
    items: [
      { kind: 'quest', id: 'quest:stage1-letters-q2', targetDate: dayKey(0) },
      { kind: 'quest', id: 'quest:stage1-letters-q3', targetDate: dayKey(10) },
    ],
  } as unknown as SelfRoute;
  await seedStored(page, `progress:${profileId}`, snapshotWith(profileId, [], route));

  await expect(page.getByText('1 to do today')).toBeVisible();
  await openHomework(page);
  const row = page.getByRole('button', { name: /, Today$/ });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Your plan');
  await expect(page.getByText('More are waiting. They come one at a time.')).toHaveCount(0);
  await expect(page.getByTestId('homework-later')).toHaveCount(0);
  // Saved on the device: the derived item only, nothing past the horizon.
  await expect.poll(async () => (await readStored<ProgressSnapshot>(page, `progress:${profileId}`))?.homework.map((h) => h.id)).toEqual(['route:mine#quest:stage1-letters-q2']);
  await shot(page, 'homework-your-plan');
});
