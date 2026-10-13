import { CATALOG, freeRouteDays } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-ENT-003 E3-7 (sections 3.7, 3.16; wireframe home/next-and-free-end-card B and C; mock
 * design/components/RouteMarkers "The cards"): Home at the end of the free lessons. With the
 * free-plan switch on, a free learner who finished every free lesson sees the celebration once
 * (Hoya cheering, the title, the line, Play a favorite again and the ask), the device keeps
 * `free-end-seen:<profileId>`, and from then on card (2) is the plain practice card with no ask.
 * The release build (switch off) never shows either card.
 *
 *   EXPO_PUBLIC_CONTENT_GATING_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_CONTENT_GATING=1 pnpm --filter @hangul-route/mobile exec playwright test free-end
 */
const access = getMessages('en').learner.access;
const GATED = process.env.E2E_CONTENT_GATING === '1';
const AT = '2026-10-01T00:00:00.000Z';

/** A learner who finished every free lesson, with the app reloaded on Home; returns the profile id. */
async function finishedFreeLessons(page: Page, name: string): Promise<string> {
  await onboardChild(page, { name, startJourney: false });
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  const quests = freeRouteDays(CATALOG).flatMap((day) =>
    day.questIds.map((questId) => ({ questId, episodeId: day.episodeId, startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 })),
  );
  const snapshot = (await readStored<Record<string, unknown>>(page, `progress:${id}`)) ?? {
    profileId: id,
    episodes: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
  // The tier first: the progress seed reloads the app, and that first Home is where the celebration shows.
  await seedStored(page, `tier:${id}`, { tier: 'free', source: null, validUntil: null, fetchedAt: new Date().toISOString() });
  await seedStored(page, `progress:${id}`, { ...snapshot, quests, updatedAt: new Date().toISOString() });
  return id;
}

async function home(page: Page, name: string, reload = true): Promise<void> {
  if (reload) await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('release build (switch off)', () => {
  test.skip(GATED, 'the release build has the switch off');

  test('a learner who finished Stage 1 gets no free-end card and no practice card', async ({ page }) => {
    const id = await finishedFreeLessons(page, 'Mina');
    await home(page, 'Mina', false);
    await expect(page.getByTestId('home-free-end-card')).toHaveCount(0);
    await expect(page.getByText(access.freeEnd.title)).toHaveCount(0);
    await expect(page.getByText(access.practice.subtitle)).toHaveCount(0);
    expect(await readStored(page, `free-end-seen:${id}`)).toBeNull();
  });
});

test.describe('free plan switch on (web)', () => {
  test.skip(!GATED, 'needs a web build with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true');

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 320, height: 568 },
    { width: 1180, height: 820 },
  ] as const) {
    test(`${viewport.width}: the celebration once on Home, then the practice card with no ask`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.setViewportSize(viewport);
      const id = await finishedFreeLessons(page, 'Mina');
      await home(page, 'Mina', false);

      const card = page.getByTestId('home-free-end-card');
      await expect(card).toBeVisible();
      await expect(card.getByText(access.freeEnd.title)).toBeVisible();
      await expect(card.getByText(access.openForYou)).toBeVisible();
      await expect(card.getByRole('button', { name: access.replay.cta })).toBeVisible();
      await expect(card.getByRole('button', { name: access.ask.family })).toBeVisible();
      await expect(page.getByText(/locked|premium|trial|price|\bday\b/i)).toHaveCount(0);
      expect(await noSideScroll(page)).toBe(true);
      await expect.poll(() => readStored(page, `free-end-seen:${id}`)).toBe(true);
      await shot(page, `free-end-home-${viewport.width}`);

      // The next visit: the practice card, "Keep practicing", and no ask anywhere on Home.
      await home(page, 'Mina');
      await expect(page.getByText(access.practice.subtitle)).toBeVisible();
      await expect(page.getByTestId('home-free-end-card')).toHaveCount(0);
      await expect(page.getByText(access.freeEnd.title)).toHaveCount(0);
      await expect(page.getByRole('button', { name: access.ask.family })).toHaveCount(0);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `free-end-practice-${viewport.width}`);
      expect(errors).toEqual([]);
    });
  }

  test('the ask on the celebration goes through the PIN screen to the Plan screen', async ({ page }) => {
    await finishedFreeLessons(page, 'Mina');
    await home(page, 'Mina', false);
    await page.getByTestId('home-free-end-ask').click();
    await expect(page.getByRole('heading', { name: 'Grown-up zone' })).toBeVisible();
    await unlockWithPin(page);
    await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
  });
});
