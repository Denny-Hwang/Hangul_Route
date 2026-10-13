import { CATALOG, CONSOLE_SESSION_KEY, freeRouteDays } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-ENT-003 E3-12b (section 3.9.2; wireframe console/free-lessons-line B): the free-lessons line on
 * the on-device parent dashboard child row. It shows only for the owner of the learner's space, and
 * the row's standing default says who that is on a device: the device's signed-in account owns the
 * learner's space, and never without a signed-in account. The learner app holds no grown-up sign-in
 * (F-APP-001 section 3.9 clears the console session on every learner boot), so on every build, the
 * release build (switch off) and a web build with the free-plan switch on alike, a learner who
 * finished every free lesson gets no line on the dashboard. The gated run:
 *
 *   EXPO_PUBLIC_CONTENT_GATING_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_CONTENT_GATING=1 pnpm --filter @hangul-route/mobile exec playwright test dashboard-free-line
 */

const GATED = process.env.E2E_CONTENT_GATING === '1';
const AT = '2026-10-01T00:00:00.000Z';

for (const vp of [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const) {
  test(`${vp.width}x${vp.height}: a family learner at the end of the free lessons gets no dashboard line without a signed-in account`, async ({ page }) => {
    await page.setViewportSize(vp);
    await onboardChild(page, { name: 'Mina' });
    const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
    const id = profiles?.[0]?.id;
    if (!id) throw new Error('no profile stored');
    // Every free lesson finished, a family space, and the server answered free for this learner.
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
    await seedStored(page, `progress:${id}`, { ...snapshot, quests, updatedAt: new Date().toISOString() });
    await seedStored(page, `memberships:${id}`, [{ spaceId: 'space:fam', kind: 'family', name: 'Kim family', role: 'learner', joinedAt: AT }]);
    await seedStored(page, `tier:${id}`, { tier: 'free', source: null, validUntil: null, fetchedAt: new Date().toISOString() });
    // A console session left in this tab by a grown-up page: the learner boot clears it, so it signs nobody in here.
    await page.evaluate(([k]) => sessionStorage.setItem(k, JSON.stringify({ token: 't', accountId: 'acct:owner', displayName: 'Kim' })), [CONSOLE_SESSION_KEY] as const);

    await page.goto('/');
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await page.waitForTimeout(800);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();
    await unlockWithPin(page);
    await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
    // The card is drawn with its figures, and nothing about the free lessons or billing.
    await expect(page.getByText('Mina', { exact: true }).last()).toBeVisible();
    await expect(page.getByTestId(`dashboard-free-line-${id}`)).toHaveCount(0);
    await expect(page.getByText(/finished the free lessons|Family Plan|Group License/)).toHaveCount(0);
    await expect(page.getByText('Open billing', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, `e3-12b-dashboard-no-account-${GATED ? 'gated' : 'release'}-${vp.width}`);
  });
}
