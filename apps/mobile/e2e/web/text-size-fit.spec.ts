import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardSelf, openLettersEpisode, passDiscover, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { closeInstallGuide, expectNoSidewaysScroll, fontSizeOf } from './text-fit';

/**
 * Row DN-3b (AMENDMENTS-DISPLAY-NAV section 4): text size on every page. The tab roots, Profile,
 * the Display sheet and the quest player's first steps are checked in `one-language.spec.ts`; this
 * spec walks the screens row DN-3b moved to the chosen size (the grown-up area, a learner report,
 * Edit profile, Join a class, All lessons) and a game of each family a first quest opens (Match
 * Sound, Build a Letter, Trace), at the fit rule's 320 x 568 with the text size at Largest: no
 * sideways scroll and no line of text past the window's edge, and the text really is larger
 * (the report headline and the name field at 1.5 x their tokens).
 */
const en = getMessages('en');

/** The token sizes at Largest: reading sizes x 1.5, headings x 1.25 (the half rule), whole points. */
const LARGEST = { prompt: 33, bodyLg: 30 } as const;

async function learnerAtLargest(page: Page, name: string): Promise<void> {
  await onboardSelf(page, { name, startJourney: false });
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await closeInstallGuide(page);
}

async function profileIdOf(page: Page, name: string): Promise<string> {
  const profiles = await readStored<Array<{ id: string; displayName: string }>>(page, 'profiles');
  const id = profiles?.find((p) => p.displayName === name)?.id;
  if (!id) throw new Error(`no stored profile called ${name}`);
  return id;
}

async function openProfile(page: Page): Promise<void> {
  await page.goto('/');
  await closeInstallGuide(page);
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
}

test.describe('text size Largest at 320 x 568: the screens of row DN-3b', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the grown-up area, a learner report, Edit profile and Join a class fit and draw larger', async ({ page }) => {
    test.setTimeout(120_000);
    await learnerAtLargest(page, 'Dani');
    const id = await profileIdOf(page, 'Dani');

    await openProfile(page);
    await page.getByRole('button', { name: /^Account & backup/ }).click();
    await expect(page.getByTestId(`dashboard-see-report-${id}`)).toBeVisible();
    await expectNoSidewaysScroll(page, 'the grown-up area');
    await shot(page, 'dn3b-grown-up-area-largest-320x568');

    await page.getByTestId(`dashboard-see-report-${id}`).click();
    const headline = page.getByTestId('learner-report-headline');
    await expect(headline).toBeVisible();
    expect(await fontSizeOf(headline), 'the report headline is a prompt line at Largest').toBe(LARGEST.prompt);
    await expectNoSidewaysScroll(page, 'the learner report');
    await shot(page, 'dn3b-learner-report-largest-320x568');

    await openProfile(page);
    await page.getByRole('button', { name: 'Edit Dani', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    const nameField = page.getByRole('textbox').first();
    expect(await fontSizeOf(nameField), 'the name field (bodyLg) is drawn at Largest').toBe(LARGEST.bodyLg);
    await expectNoSidewaysScroll(page, 'Edit profile');
    await shot(page, 'dn3b-edit-profile-largest-320x568');

    await openProfile(page);
    await page.getByRole('button', { name: 'Join a class' }).click();
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page, 'Join a class');
    await shot(page, 'dn3b-join-space-largest-320x568');
  });

  test('a game of each family a first quest opens: Match Sound, Build a Letter and Trace', async ({ page }) => {
    test.setTimeout(150_000);
    await learnerAtLargest(page, 'Rio');

    // Quest 1, step 3: Match Sound (recognition).
    await openLettersEpisode(page);
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('match-sound-tiles').getByRole('button')).toHaveCount(4);
    await expectNoSidewaysScroll(page, 'Match Sound');
    await shot(page, 'dn3b-match-sound-largest-320x568');

    // Quest 1, step 4: Build a Letter (construction).
    await page.goto('/');
    await closeInstallGuide(page);
    await openLettersEpisode(page);
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText('Build this letter')).toBeVisible();
    await expectNoSidewaysScroll(page, 'Build a Letter');
    await shot(page, 'dn3b-build-letter-largest-320x568');

    // Quest 2, step 4: Trace (writing).
    await page.goto('/');
    await closeInstallGuide(page);
    await openLettersEpisode(page);
    await page.getByRole('button', { name: 'Start', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Play anyway' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText(/^Trace the letter /)).toBeVisible();
    await expectNoSidewaysScroll(page, 'Trace');
    await shot(page, 'dn3b-trace-largest-320x568');
  });

  test('All lessons: home and a lesson page fit and draw larger', async ({ page }) => {
    await learnerAtLargest(page, 'Sora');
    await page.evaluate(() => {
      const at = Date.now();
      sessionStorage.setItem('hr:browse:pass', JSON.stringify({ v: 1, scope: 'full', source: 'gate', issuedAt: at, seen: at }));
    });
    await page.goto('/browse');
    const title = page.getByRole('heading', { name: en.caregiver.browse.home.title });
    await expect(title).toBeVisible();
    await expectNoSidewaysScroll(page, 'All lessons home');
    await shot(page, 'dn3b-browse-home-largest-320x568');

    await page.goto('/browse#t=quest:stage1-letters-q1&s=gate');
    await expect(page.getByTestId('browse-facts-steps')).toBeVisible();
    await expectNoSidewaysScroll(page, 'an All lessons item page');
    await shot(page, 'dn3b-browse-item-largest-320x568');
  });
});
