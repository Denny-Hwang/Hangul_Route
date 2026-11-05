import type { Page } from '@playwright/test';
import { CATALOG, generateCurriculum, toMeta } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';
import { expectNoClippedText, expectNoSidewaysScroll } from './text-fit';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 9.4 (row BL-8, BL-OD-7; wireframe design/wireframes/journey/route-class-blend.md
 * B7): My practice days on the web PWA, behind `flags.routeBlendEnabled`. The switch is off until BL-10, so this runs
 * only on a build made with `EXPO_PUBLIC_ROUTE_BLEND_ENABLED=1` and `E2E_ROUTE_BLEND=1`. A Tuesday class with practice
 * on Wednesday, Friday and Sunday, for a child on a device with a PIN: Profile -> My practice days shows "PIN required"
 * and names every chip so, a tap opens the grown-up gate, and after the PIN the grown-up moves the days. The chips are
 * KT-1 TapTargets; the Route line then names the learner's own days, and the stored snapshot holds them.
 */

test.skip(process.env.E2E_ROUTE_BLEND !== '1', 'needs a build with EXPO_PUBLIC_ROUTE_BLEND_ENABLED=1 (BL-10 turns it on)');
test.use({ timezoneId: 'UTC' });

const en = getMessages('en');
const words = en.learner.route.blend;
const MONDAY = Date.parse('2026-11-02T12:00:00.000Z');

async function seedBlendedPlan(page: Page, profileId: string): Promise<void> {
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
      items: [
        { kind: 'quest', id: 'quest:stage1-letters-q1', week: 1, lectureDate: '2026-11-03', targetDate: '2026-11-04' },
        { kind: 'quest', id: 'quest:stage1-letters-q2', week: 1, lectureDate: '2026-11-03', targetDate: '2026-11-06' },
      ],
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
      },
    },
  ]);
}

async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: en.caregiver.install.notNow.cta, exact: true }).click();
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

    test('Profile -> My practice days: the class days first, the grown-up gate for a child, then the Route line follows', async ({ page }) => {
      await page.clock.setFixedTime(MONDAY + 24 * 3600 * 1000);
      await onboardChild(page, { name: 'Mina', startJourney: false });
      const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
      await seedBlendedPlan(page, profileId);
      await page.goto('/');
      await expect(page.getByText('Hi, Mina!')).toBeVisible();
      await closeInstallGuide(page);

      await page.getByRole('button', { name: en.a11y.profileEntry }).click();
      const row = page.getByTestId('profile-practice-days');
      await row.scrollIntoViewIfNeeded();
      await expect(row).toHaveAccessibleName(words.practiceDays.title);
      await row.click();

      await expect(page.getByRole('heading', { name: words.practiceDays.title })).toBeVisible();
      await expect(page.getByText(words.practiceDays.hint)).toBeVisible();
      // The class's days are on; the class day is marked and may be picked.
      const gated = (name: string): string => en.caregiver.audience.gated(name, true);
      await expect(page.getByTestId('practice-days-gate')).toContainText(words.practiceDays.gate);
      for (const day of ['Wednesday', 'Friday', 'Sunday']) await expect(page.getByRole('checkbox', { name: gated(en.a11y.route.blend.practiceDay(day)) })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: gated(en.a11y.route.blend.practiceDay('Tuesday')) })).not.toBeChecked();
      await expect(page.getByTestId('practice-days-class-tue')).toHaveCount(1);
      await expect(page.getByRole('radio', { name: gated('3') })).toBeChecked();
      // Every chip is at least 64 x 64.
      for (const chip of await page.getByTestId(/^practice-days-(day|count)-/).all()) {
        const box = await chip.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
      }
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-blend-practice-days-${size.width}`);
      await page.screenshot({ path: test.info().outputPath(`practice-days-${size.width}.png`), fullPage: true });

      // A child's days change through the grown-up gate: the tap opens the PIN, nothing is stored yet.
      await page.getByRole('checkbox', { name: gated(en.a11y.route.blend.practiceDay('Sunday')) }).click();
      expect((await readStored<{ practiceDays?: unknown }>(page, `progress:${profileId}`))?.practiceDays).toBeUndefined();
      await unlockWithPin(page);
      await expect(page.getByTestId('practice-days-gate')).toHaveCount(0);

      // Sunday off: two days left, stored on the device for this plan only.
      await page.getByRole('checkbox', { name: en.a11y.route.blend.practiceDay('Sunday') }).click();
      await expect(page.getByRole('checkbox', { name: en.a11y.route.blend.practiceDay('Sunday') })).not.toBeChecked();
      await expect(page.getByRole('radio', { name: '2', exact: true })).toBeChecked();
      await expect
        .poll(async () => (await readStored<{ practiceDays?: Array<{ planId: string; days: string[] }> }>(page, `progress:${profileId}`))?.practiceDays)
        .toEqual([{ planId: 'plan:e2e-blend', days: ['wed', 'fri'], updatedAt: expect.any(String) }]);
      await page.screenshot({ path: test.info().outputPath(`practice-days-changed-${size.width}.png`), fullPage: true });

      // The Route line names the learner's days now.
      await page.goto('/');
      await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
      await expect(page.getByTestId('my-route-blend-line')).toHaveText("Your class's weekly plan: class on Tuesday, practice on Wednesday and Friday.");
    });
  });
}

test('320 px at the Largest text size (150%): every chip keeps its label, the rows wrap, no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.setFixedTime(MONDAY + 24 * 3600 * 1000);
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await seedBlendedPlan(page, profileId);
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await closeInstallGuide(page);

  await page.getByRole('button', { name: en.a11y.profileEntry }).click();
  const row = page.getByTestId('profile-practice-days');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole('heading', { name: words.practiceDays.title })).toBeVisible();
  // The gated names at Largest: every chip still says "PIN required" to a screen reader.
  const gated = (name: string): string => en.caregiver.audience.gated(name, true);
  for (const day of ['Wednesday', 'Friday', 'Sunday']) await expect(page.getByRole('checkbox', { name: gated(en.a11y.route.blend.practiceDay(day)) })).toBeChecked();
  await expect(page.getByRole('radio', { name: gated('3') })).toBeChecked();
  const chips = await page.getByTestId(/^practice-days-(day|count)-/).all();
  expect(chips.length).toBe(14);
  for (const chip of chips) {
    const box = await chip.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    // Inside the window: the rows wrap rather than run off the side.
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(-0.5);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320.5);
  }
  await expectNoSidewaysScroll(page, 'practice days at Largest');
  await expectNoClippedText(page, 'practice days at Largest');
  await shot(page, 'route-blend-practice-days-320-largest');
});
