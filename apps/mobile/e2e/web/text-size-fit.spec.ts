import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import {
  journeyCellName,
  onboardChild,
  onboardSelf,
  openGrownUpZone,
  openLettersEpisode,
  passDiscover,
  readStored,
  seedRescueCode,
  seedStored,
  unlockWithPin,
} from './helpers';
import { shot } from './shots';
import { closeInstallGuide, expectTextFits, fontSizeOf } from './text-fit';

/**
 * Row DN-3b (AMENDMENTS-DISPLAY-NAV section 4): text size on every page. The tab roots, Profile,
 * the Display sheet and the quest player's first steps are checked in `one-language.spec.ts`; this
 * spec walks the screens row DN-3b moved to the chosen size (the grown-up area, a learner report,
 * Edit profile, Join a class with its code, the Rescue Code fields of Restore and Forgot PIN, Stage
 * complete's letter wall, All lessons) and a game of each of the four families (recognition: Match
 * Sound; construction: Build a Letter and Trace; interaction: Tap & Respond; discovery: the Culture
 * Quiz), at the fit rule's 320 x 568 with the text size at Largest: no sideways scroll, no line of
 * text past the window's edge or clipped by its box, no text field hiding part of what it holds,
 * and the text really is larger (the report headline, the name field and All lessons' fact labels at
 * 1.5 x their tokens).
 */
const en = getMessages('en');

/** The token sizes at Largest: reading sizes x 1.5, headings x 1.25 (the half rule), whole points. */
const LARGEST = { bodySm: 24, bodyLg: 30, prompt: 33 } as const;

/** The widest class code the alphabet can make (W is its widest letter), so the code field is checked at its worst. */
const WIDEST_JOIN_CODE = 'WWWWWW';
/** A Rescue Code pasted with its hyphens, as the Save my progress screen and a backup show it. */
const PASTED_RESCUE_CODE = 'LIGHTHOUSE-SUNFLOWER-LIGHTHOUSE-SUNFLOWER-482139';

async function learnerAtLargest(page: Page, name: string): Promise<void> {
  await onboardSelf(page, { name, startJourney: false });
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await closeInstallGuide(page);
}

/** A family device (a PIN, a learner) at Largest. */
async function childAtLargest(page: Page, name: string): Promise<void> {
  await onboardChild(page, { name, startJourney: false });
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

const STAGE1_AT = '2026-10-01T09:05:00.000Z';
const STAGE1: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['episode:stage1-letters', ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']],
  ['episode:stage1-life', ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3']],
  ['episode:stage1-rites', ['quest:stage1-rites-q1', 'quest:stage1-rites-q2', 'quest:stage1-rites-q3']],
  ['episode:stage1-nature', ['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']],
  ['episode:stage1-crafts', ['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3']],
];

/** The three legendary cards completing Stage 1 awards (`unlockedBy: 'stage1-complete'`). */
const STAGE1_PRIZE = ['card:hangul-day', 'card:lantern', 'card:gayageum'] as const;

/** Every Stage 1 quest done at one star and its prize held: the Journey's Stage 1 header offers the ceremony again (F-QUEST-002 §3.8). */
const stageOneDone = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: STAGE1_AT,
  episodes: [],
  quests: STAGE1.flatMap(([episodeId, questIds]) =>
    questIds.map((questId) => ({ questId, episodeId, startedAt: STAGE1_AT, completedAt: STAGE1_AT, stars: 1 as const, attempts: 1, accuracy: 0.5 })),
  ),
  cards: STAGE1_PRIZE.map((cardId) => ({ cardId, unlockedAt: STAGE1_AT, newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

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
    await expectTextFits(page, 'the grown-up area');
    await shot(page, 'dn3b-grown-up-area-largest-320x568');

    await page.getByTestId(`dashboard-see-report-${id}`).click();
    const headline = page.getByTestId('learner-report-headline');
    await expect(headline).toBeVisible();
    expect(await fontSizeOf(headline), 'the report headline is a prompt line at Largest').toBe(LARGEST.prompt);
    await expectTextFits(page, 'the learner report');
    await shot(page, 'dn3b-learner-report-largest-320x568');

    await openProfile(page);
    await page.getByRole('button', { name: 'Edit Dani', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    const nameField = page.getByRole('textbox').first();
    expect(await fontSizeOf(nameField), 'the name field (bodyLg) is drawn at Largest').toBe(LARGEST.bodyLg);
    await expectTextFits(page, 'Edit profile');
    await shot(page, 'dn3b-edit-profile-largest-320x568');

    await openProfile(page);
    await page.getByRole('button', { name: 'Join a class' }).click();
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
    // The code field at its worst: the widest code the alphabet can make, all of it in view.
    await page.getByTestId('join-code').fill(WIDEST_JOIN_CODE);
    await expect(page.getByTestId('join-code')).toHaveValue(WIDEST_JOIN_CODE);
    await expectTextFits(page, 'Join a class');
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
    await expectTextFits(page, 'Match Sound');
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
    await expectTextFits(page, 'Build a Letter');
    await shot(page, 'dn3b-build-letter-largest-320x568');

    // Quest 2, step 4: Trace (construction).
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
    await expectTextFits(page, 'Trace');
    await shot(page, 'dn3b-trace-largest-320x568');
  });

  test('a game of the other two families: Tap & Respond (interaction) and the Culture Quiz (discovery)', async ({ page }) => {
    test.setTimeout(120_000);
    await learnerAtLargest(page, 'Ana');

    // Stage 4 Holidays & Traditions, quest 1, step 3: Tap & Respond.
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: journeyCellName(4, 'Holidays & Traditions') }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText('Choose your reply', { exact: true })).toBeVisible();
    await expectTextFits(page, 'Tap & Respond');
    await shot(page, 'dn3b-tap-respond-largest-320x568');

    // Stage 1 Food & Daily Life, quest 3 (Picnic Snacks), step 4: the Culture Quiz.
    await page.goto('/');
    await closeInstallGuide(page);
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).nth(2).click();
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('culture-quiz-hear')).toBeVisible();
    await expectTextFits(page, 'the Culture Quiz');
    await shot(page, 'dn3b-culture-quiz-largest-320x568');
  });

  test('Stage complete: the letter wall\'s fixed tiles hold their letters at Largest', async ({ page }) => {
    await learnerAtLargest(page, 'Dami');
    const id = await profileIdOf(page, 'Dami');
    await seedStored(page, `progress:${id}`, stageOneDone(id));
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await closeInstallGuide(page);
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByTestId('journey-stage-prize').click();
    const wall = page.getByTestId('stage-complete-wall');
    await expect(wall.locator('[data-testid^="stage-complete-tile-"]')).toHaveCount(30);
    await wall.scrollIntoViewIfNeeded();
    await expectTextFits(page, 'Stage complete');
    // Each tile holds its glyph and its sound value inside its border (the longest is silent/ng).
    const spill = await wall.evaluate((el) =>
      Array.from(el.querySelectorAll('[data-testid^="stage-complete-tile-"]')).flatMap((tile) => {
        const box = tile.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(tile);
        return Array.from(range.getClientRects())
          .filter((r) => r.width > 1 && (r.left < box.left - 1 || r.right > box.right + 1))
          .map(() => `${tile.getAttribute('data-testid')}: ${(tile.textContent ?? '').trim()}`);
      }),
    );
    expect(spill, 'a wall tile whose text passes its border').toEqual([]);
    await shot(page, 'dn3b-stage-complete-largest-320x568');
  });

  test('the Rescue Code fields of Restore and Forgot PIN show a whole pasted code', async ({ page }) => {
    test.setTimeout(120_000);
    await childAtLargest(page, 'Mina');

    // Restore: Profile, the PIN, then the Rescue Code path; the code pasted with its hyphens.
    await openProfile(page);
    await page.getByRole('button', { name: 'Restore from a file (PIN required)' }).click();
    await unlockWithPin(page);
    await page.getByRole('button', { name: 'I have a rescue code' }).click();
    const restoreField = page.getByTestId('rescue-code-input');
    await restoreField.fill(PASTED_RESCUE_CODE);
    await expect(restoreField).toHaveValue(PASTED_RESCUE_CODE);
    expect(await fontSizeOf(restoreField), 'the code (bodyLg) is drawn at Largest').toBe(LARGEST.bodyLg);
    await expectTextFits(page, 'Restore');
    await shot(page, 'dn3b-restore-code-largest-320x568');

    // Forgot PIN: the same code in the reset field.
    await seedRescueCode(page, 'TIGER-MOON-RIVER-APPLE-482139');
    await openGrownUpZone(page, 'Mina');
    await page.getByRole('button', { name: 'Forgot PIN?' }).click();
    const resetField = page.getByTestId('pin-reset-code-input');
    await resetField.fill(PASTED_RESCUE_CODE);
    await expect(resetField).toHaveValue(PASTED_RESCUE_CODE);
    await expectTextFits(page, 'Forgot PIN');
    await shot(page, 'dn3b-pin-reset-code-largest-320x568');
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
    await expectTextFits(page, 'All lessons home');
    await shot(page, 'dn3b-browse-home-largest-320x568');

    await page.goto('/browse#t=quest:stage1-letters-q1&s=gate');
    const steps = page.getByTestId('browse-facts-steps');
    await expect(steps).toBeVisible();
    // The fact label (bodySm) is drawn at Largest: All lessons reads the device's text size too.
    expect(await fontSizeOf(steps.getByText(en.caregiver.browse.facts.steps, { exact: true })), 'the fact label at Largest').toBe(LARGEST.bodySm);
    await expectTextFits(page, 'an All lessons item page');
    await shot(page, 'dn3b-browse-item-largest-320x568');
  });
});
