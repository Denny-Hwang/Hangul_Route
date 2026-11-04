import type { Page } from '@playwright/test';
import { CATALOG, generateCurriculum, toMeta } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 7 (row BL-7; design/wireframes/journey/route-class-blend.md B1 to B3): the
 * learner's class days and practice days on the web PWA, behind `flags.routeBlendEnabled`, on by default since BL-10
 * (BL-OD-12), so this runs on the release build; `E2E_ROUTE_BLEND=0` skips it on a kill-switch build
 * (`EXPO_PUBLIC_ROUTE_BLEND_ENABLED=false`). BL-10's `route-blend.spec.ts` covers the whole launch state. A class on Tuesday with practice on Wednesday, Friday and Sunday,
 * from Monday 2026-11-02; the browser clock is fixed at midday UTC on the day under test.
 */

test.skip(process.env.E2E_ROUTE_BLEND === '0', 'the kill-switch build (EXPO_PUBLIC_ROUTE_BLEND_ENABLED=false) draws none of this');
test.use({ timezoneId: 'UTC' });

const en = getMessages('en');
const words = en.learner.route.blend;
const TUESDAY = Date.parse('2026-11-03T12:00:00.000Z');
const FRIDAY = Date.parse('2026-11-06T12:00:00.000Z');

/**
 * The class's blended weekly plan in the device's inbox copy: one lesson met in class on `lectureDate`, played the day
 * after; Friday 2026-11-06 is a Refresh date.
 */
async function seedBlendedPlan(page: Page, profileId: string, lectureDate: string, targetDate: string): Promise<void> {
  const draft = generateCurriculum(
    {
      audience: 'class',
      level: { stage: 'stage1', band: 0 },
      startDate: '2026-11-02',
      weeks: 4,
      sessionsPerWeek: 4,
      sessionDays: ['tue', 'wed', 'fri', 'sun'],
      minutesPerSession: 10,
      goals: { focus: 'balanced', motivation: 'kculture' },
      unlockedStages: ['stage1'],
      reviewEvery: 4,
    },
    CATALOG,
  );
  const meta = toMeta(draft);
  await seedStored(page, `plans:${profileId}`, [
    {
      id: 'plan:e2e-blend',
      spaceId: 'space:e2e-class',
      spaceKind: 'class',
      spaceName: 'Sunflower',
      title: 'Weekly plan',
      items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', week: 1, lectureDate, targetDate }],
      publishedAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      meta: {
        ...meta,
        params: {
          ...meta.params,
          blend: {
            mode: 'overlap',
            lecture: { days: ['tue'], minutes: 30 },
            personal: { perWeek: 3, days: ['wed', 'fri', 'sun'], minutes: 10 },
            classDaysOff: [],
            keepAverage: false,
          },
        },
        refresh: [{ date: '2026-11-06', cellIds: ['episode:stage1-letters'] }],
      },
    },
  ]);
}

async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: en.caregiver.install.notNow.cta, exact: true }).click();
}

async function learnerWithPlan(page: Page, now: number, lectureDate = '2026-11-03', targetDate = '2026-11-04'): Promise<void> {
  await page.clock.setFixedTime(now);
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
  await seedBlendedPlan(page, profileId, lectureDate, targetDate);
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await closeInstallGuide(page);
}

const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const size of [
  { width: 320, height: 568 },
  { width: 1280, height: 800 },
] as const) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
    });

    test('a class day: "Class today." on Home, the weekly plan line on Route, one From class pill with the glyph', async ({ page }) => {
      await learnerWithPlan(page, TUESDAY);
      await expect(page.getByTestId('home-class-today')).toHaveText(words.classToday);
      await page.getByTestId('home-class-today').scrollIntoViewIfNeeded();
      // No "Week n of your weekly plan" for a class plan with practice days, and nothing asks about going to class.
      await expect(page.getByText(/Week \d+ of your weekly plan/)).toHaveCount(0);
      expect(await page.getByTestId('home-class-today').innerText()).not.toMatch(/\?/);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-blend-home-class-${size.width}`);
      await page.screenshot({ path: test.info().outputPath(`home-class-${size.width}.png`), fullPage: true });

      await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
      const line = page.getByTestId('my-route-blend-line');
      await expect(line).toHaveText("Your class's weekly plan: class on Tuesday, practice on Wednesday, Friday, and Sunday.");
      await line.scrollIntoViewIfNeeded();
      // No week count for the class plan, and no Open plan.
      await expect(page.getByTestId('my-route-plan-line')).toHaveCount(0);
      await expect(page.getByTestId('my-route-plan-open')).toHaveCount(0);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-blend-line-${size.width}`);
      await page.screenshot({ path: test.info().outputPath(`route-line-${size.width}.png`), fullPage: true });

      await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.home }).click();
      await page.getByRole('button', { name: en.a11y.openHomework }).click();
      const pill = page.getByTestId('homework-row-pill').first();
      await pill.scrollIntoViewIfNeeded();
      await expect(pill).toHaveAccessibleName(en.a11y.route.blend.fromClassMet);
      await expect(pill).toHaveText(en.learner.homework.from.teacher);
      await shot(page, `route-blend-homework-${size.width}`);
      await page.screenshot({ path: test.info().outputPath(`homework-${size.width}.png`), fullPage: true });
    });

    test('a practice day with nothing left: Refresh takes card (2) and opens Daily Review', async ({ page }) => {
      // The week's lesson comes from next Tuesday's class, so Friday has no lesson left: Refresh is the day's only step.
      await learnerWithPlan(page, FRIDAY, '2026-11-10', '2026-11-11');
      const refresh = page.getByRole('button', { name: en.a11y.route.blend.refresh });
      await expect(refresh).toBeVisible();
      await expect(page.getByTestId('home-refresh')).toContainText(words.refreshLine);
      await expect(page.getByTestId('home-class-today')).toHaveCount(0);
      expect(await page.getByTestId('home-refresh').innerText()).not.toMatch(/\d/);
      await page.getByTestId('home-refresh').scrollIntoViewIfNeeded();
      await shot(page, `route-blend-refresh-${size.width}`);
      await page.screenshot({ path: test.info().outputPath(`refresh-${size.width}.png`), fullPage: true });
      await refresh.click();
      // Daily Review opens over Home (its rounds, or its done page): Home's card is no longer on screen.
      await expect(page.getByTestId('home-refresh')).toBeHidden();
      await page.screenshot({ path: test.info().outputPath(`refresh-opened-${size.width}.png`), fullPage: true });
    });
  });
}
