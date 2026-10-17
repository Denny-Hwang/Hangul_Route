import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, openForGrownUps, seedStored } from './helpers';
import { shot } from './shots';

/**
 * Owner request 2026-10-16, item 8 (learner and grown-up UX), on a 360 x 640 phone: the app's own confirm sheet in
 * every UI language, the Next lesson hero, the Library's first shelf and Profile's two groups.
 */
test.use({ viewport: { width: 360, height: 640 } });

/** A brand-new learner on Home: onboarded, "I am new to Korean", the first-quest preview left for Home. */
async function newLearnerHome(page: Page, name = 'Mina'): Promise<void> {
  await onboardChild(page, { name, startJourney: false });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
}

/** The install guide covers Home from the third cached open: dismiss it whenever it shows, in any UI language. */
async function dismissInstallGuide(page: Page): Promise<void> {
  const notNow = new RegExp(`^(${(['en', 'es', 'ko'] as const).map((l) => getMessages(l).caregiver.install.notNow.cta).join('|')})$`);
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: notNow }).click();
  });
}

test.describe('ConfirmSheet: leaving a quest (design/components/ConfirmSheet)', () => {
  for (const locale of ['en', 'es', 'ko'] as const satisfies readonly UiLocale[]) {
    test(`${locale}: the quest X opens the app's own sheet in that language; Keep playing and Escape stay in the quest`, async ({ page }) => {
      const m = getMessages(locale);
      const leave = m.learner.quest.leave;
      let nativeDialog = false;
      page.on('dialog', (dialog) => {
        nativeDialog = true;
        void dialog.dismiss();
      });
      await newLearnerHome(page);
      await dismissInstallGuide(page);
      // The device language, as the Display sheet stores it; the page reloads into it.
      if (locale !== 'en') await seedStored(page, 'device:settings', { uiLocale: locale });
      await page.getByTestId('home-next-lesson-start').click();

      const x = page.getByRole('button', { name: m.a11y.leaveQuest, exact: true });
      await expect(x).toBeVisible();
      await x.click();
      const sheet = page.getByTestId('quest-leave-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('heading', { name: leave.title })).toBeVisible();
      await expect(sheet.getByText(leave.message)).toBeVisible();
      // Keep playing first and focused, Leave under it; never the browser's OK / Cancel.
      await expect(sheet.getByRole('button')).toHaveText([leave.keep.cta, leave.confirm.cta]);
      await expect(sheet.getByTestId('quest-leave-sheet-keep')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(sheet.getByTestId('quest-leave-sheet-confirm')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(sheet.getByTestId('quest-leave-sheet-keep')).toBeFocused();
      await shot(page, `ux-confirm-sheet-${locale}-360`);

      await sheet.getByTestId('quest-leave-sheet-keep').click();
      await expect(sheet).toHaveCount(0);
      await expect(x).toBeVisible();

      // Escape keeps playing too.
      await x.click();
      await expect(sheet).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(x).toBeVisible();

      // Leave leaves.
      await x.click();
      await sheet.getByTestId('quest-leave-sheet-confirm').click();
      await expect(x).toHaveCount(0);
      expect(nativeDialog).toBe(false);
    });
  }
});

test.describe('Home, Library and Profile for a brand-new learner', () => {
  test("Home: the first card is the next lesson, where it sits, its length, a full-width Start and the way to the route; card 2 is compact; no empty streak or stars", async ({ page }) => {
    const h = getMessages('en').learner.home;
    await newLearnerHome(page);
    await dismissInstallGuide(page);
    const hero = page.getByTestId('home-next-lesson');
    await expect(hero).toBeVisible();
    await expect(hero.getByText(h.next.heading)).toBeVisible();
    await expect(hero.getByText(/^About \d+ minutes?$/)).toBeVisible();
    // Where it sits (AMENDMENTS-DISPLAY-NAV 9.1) and the one way to the whole route; the route strip is folded in.
    await expect(page.getByTestId('home-next-lesson-where')).toHaveText(/^Stage 1 · .+ · lesson 1 of \d+$/);
    await expect(page.getByTestId('home-next-lesson-route')).toHaveAccessibleName(h.next.route.cta);
    await expect(page.getByTestId('home-route-strip')).toHaveCount(0);
    // Card 2 names the same lesson: one quiet row that is not a button, so Home never offers it twice.
    const same = page.getByTestId('home-mission-same-as-hero-2');
    await expect(same).toBeVisible();
    await expect(same.getByText(h.mission.sameAsHero, { exact: true })).toBeVisible();
    await expect(same).not.toHaveAttribute('role', 'button');
    await expect(page.getByTestId('home-missions').getByRole('button')).toHaveCount(2);
    const start = page.getByTestId('home-next-lesson-start');
    await expect(start).toHaveText(h.next.start.cta);
    // Above the three slots ("Today with Hoya") and the first card on the screen.
    const heroBox = await hero.boundingBox();
    const slots = await page.getByTestId('home-missions').boundingBox();
    expect(heroBox?.y ?? Infinity).toBeLessThan(slots?.y ?? 0);
    await expect(start).toBeInViewport();
    const startBox = await start.boundingBox();
    expect(startBox?.width ?? 0).toBeGreaterThan((heroBox?.width ?? 0) * 0.8);
    // The one big way in: touchTarget.hero (96), in a region named by its eyebrow (section 9.1, home-hero.md).
    expect(startBox?.height ?? 0).toBeGreaterThanOrEqual(96);
    await expect(page.getByRole('region', { name: h.next.heading, exact: true })).toBeVisible();
    // No "Streak 0 days", no empty Recent stars, the singular card pill, and the first-lesson tip.
    await expect(page.getByText(/^Streak/)).toHaveCount(0);
    await expect(page.getByTestId('home-recent-stars')).toHaveCount(0);
    await expect(page.getByText('1 card', { exact: true })).toBeVisible();
    await expect(page.getByText(h.tip.first)).toBeAttached();
    await expect(page.getByText(/keep your streak/i)).toHaveCount(0);
    // "I am new to Korean" was just answered: no level-check card right away.
    await expect(page.getByTestId('home-level-check')).toHaveCount(0);
    await shot(page, 'ux-home-hero-360');
  });

  test('Library: the first screen shows the collected card under Your cards; cards to find are rows with one Next card hint', async ({ page }) => {
    const l = getMessages('en').learner.library;
    await newLearnerHome(page);
    await dismissInstallGuide(page);
    await page.getByRole('tablist').getByRole('link', { name: /Library/ }).click();
    const yours = page.getByTestId('library-your-cards');
    await expect(page.getByRole('heading', { name: l.yours.title })).toBeVisible();
    await expect(yours).toBeVisible();
    const first = yours.getByRole('button').first();
    await expect(first).toBeInViewport();
    await expect(page.getByRole('heading', { name: l.toFind.title })).toBeAttached();
    await expect(page.getByTestId('library-next-card')).toHaveCount(1);
    await expect(page.getByText('Finish the episode: Meet the Letters')).toHaveCount(1);
    await shot(page, 'ux-library-360');
    // A group row opens its cards: silhouettes, never a lock or a repeated hint.
    const group = page.getByTestId('library-group-episode:episode:stage1-letters');
    await group.scrollIntoViewIfNeeded();
    await expect(group).toHaveAttribute('aria-expanded', 'false');
    await group.click();
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('library-group-episode:episode:stage1-letters-cards').getByRole('button').first()).toBeVisible();
    await expect(page.getByText('Finish the episode: Meet the Letters')).toHaveCount(1);
    await page.getByTestId('library-next-card').scrollIntoViewIfNeeded();
    await shot(page, 'ux-library-to-find-360');
  });

  test('Profile: Classes and family under the stats, My settings open, For grown-ups collapsed until tapped', async ({ page }) => {
    const p = getMessages('en').learner.profile;
    await newLearnerHome(page);
    await dismissInstallGuide(page);
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await expect(page.getByTestId('profile-group-mine')).toBeVisible();
    await expect(page.getByRole('heading', { name: p.groups.mine })).toBeVisible();
    const toggle = page.getByTestId('profile-group-grown-ups-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Grown-up area (PIN required)' })).toHaveCount(0);
    // Classes and family is moved up (owner decision 2026-10-17): drawn above My settings, with its Join a class.
    const spaces = page.getByTestId('spaces-card');
    await expect(spaces).toBeVisible();
    const [spacesBox, mineBox] = await Promise.all([spaces.boundingBox(), page.getByTestId('profile-group-mine').boundingBox()]);
    expect(spacesBox?.y ?? Infinity).toBeLessThan(mineBox?.y ?? 0);
    await expect(spaces.getByRole('button', { name: getMessages('en').caregiver.spaces.join.cta })).toBeVisible();
    await shot(page, 'ux-profile-groups-360');
    await openForGrownUps(page);
    await expect(page.getByRole('button', { name: 'Grown-up area (PIN required)' })).toBeVisible();
    await expect(page.getByText('Everything is open right now.')).toBeVisible();
    await page.getByTestId('profile-group-grown-ups-toggle').scrollIntoViewIfNeeded();
    await shot(page, 'ux-profile-grown-ups-360');
    // The Plan screen opened from Profile says Back and goes back to Profile.
    await page.getByRole('button', { name: p.plan.details.cta, exact: true }).click();
    const back = page.getByTestId('plan-back');
    await expect(back).toHaveText(getMessages('en').caregiver.plan.back.cta);
    await back.click();
    await expect(page.getByTestId('profile-group-mine')).toBeVisible();
  });
});
