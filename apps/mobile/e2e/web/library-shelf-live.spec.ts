import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked } from './helpers';
import { controlsPastEdge, expectNoHorizontalOverflow, expectReachable } from './viewport';

/**
 * F-STORY-001 PR 1.9 inverts the F-STORY-004 PR 4.8 tripwire (library-cards-only.spec.ts): the
 * 24 launch stories are reviewed (language and culture sign-offs, `shelf` and `card` blocks), so
 * the regular build ships the story shelf. This suite checks that the release bundle, not a
 * fixture, puts it on the learner's own surfaces:
 *
 * - the Library has its Story Time and Culture sections beside Cards (and Words once
 *   `vocabTopicsEnabled` is on), with the six Story Time tiles (the seasons-tales cluster) and the
 *   eighteen Culture tiles of F-STORY-005 §3.3;
 * - Home's day-one plan holds a story card ("A short story");
 * - with content gating off (the launch default, D5) no tile or card reads locked or premium.
 *
 * The story journey itself (reader, checks, Results, Culture notes) is story-shelf.spec.ts on the
 * fixture bundle; this file skips there.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY_TIME = [
  'story:seollal-new-year',
  'story:dano-ssireum',
  'story:chuseok-ganggangsullae',
  'story:gimjang-arirang',
  'story:sun-and-moon',
  'story:pansori-tales',
];
const CULTURE_COUNT = 18;
const GATING_WORDS = /\bpremium\b|\blocked\b|not open yet/i;

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

async function openLibrary(page: Page): Promise<void> {
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
}

async function tileIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="story-tile-"]')
    .evaluateAll((els) => els.map((el) => (el.getAttribute('data-testid') ?? '').replace('story-tile-', '')));
}

/** Every accessible name on the story tiles: a lock shown only in an aria-label is not in innerText. */
async function tileNames(page: Page): Promise<string[]> {
  return page.locator('[data-testid^="story-tile-"]').evaluateAll((els) =>
    els.flatMap((el) => [el, ...Array.from(el.querySelectorAll('[aria-label]'))].map((n) => n.getAttribute('aria-label') ?? n.textContent ?? '')),
  );
}

test.describe('Library and Home with the reviewed launch stories (regular build)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture bundle has its own shelf stories: see story-shelf.spec.ts');

  test('the Library shows Story Time and Culture beside Cards, with every reviewed story as a tile', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page);
    await openLibrary(page);

    const sections = page.getByRole('tablist', { name: 'Library sections' });
    const labels = await sections.getByRole('tab').allInnerTexts();
    expect(labels.filter((label) => label !== 'Words')).toEqual(['Cards', 'Story Time', 'Culture']);

    await page.getByRole('tab', { name: 'Story Time', exact: true }).click();
    await expect(page.locator(`[data-testid="story-tile-${STORY_TIME[0]}"]`)).toBeVisible();
    expect((await tileIds(page)).sort()).toEqual([...STORY_TIME].sort());
    expect(await page.locator('body').innerText()).not.toMatch(GATING_WORDS);
    for (const name of await tileNames(page)) expect(name).not.toMatch(GATING_WORDS);

    await page.getByRole('tab', { name: 'Culture', exact: true }).click();
    await expect(page.locator('[data-testid="story-tile-story:sejong-new-letters"]')).toBeVisible();
    const culture = await tileIds(page);
    expect(culture).toHaveLength(CULTURE_COUNT);
    for (const id of STORY_TIME) expect(culture).not.toContain(id);
    expect(await page.locator('body').innerText()).not.toMatch(GATING_WORDS);
    const cultureNames = await tileNames(page);
    expect(cultureNames.length).toBeGreaterThanOrEqual(CULTURE_COUNT);
    for (const name of cultureNames) expect(name).not.toMatch(GATING_WORDS);

    expect(errors).toEqual([]);
  });

  test('Home has a story card on day one, and nothing reads locked', async ({ page }) => {
    await onboard(page);
    const missions = page.getByTestId('home-missions');
    await expect(missions.getByRole('button')).toHaveCount(3);
    const labels = await missions.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    expect(labels.some((label) => label.endsWith('A short story.'))).toBe(true);
    for (const label of labels) expect(label).not.toMatch(GATING_WORDS);
    await expect(missions.locator('[data-testid^="home-mission-cover-"]').first()).toBeVisible();
  });

  test('at 320 wide, Home and the Library tabs and shelf tiles stay on screen (F-STORY-004 Manual QA, 320 dp)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page);
    await expectNoHorizontalOverflow(page, 'Home at 320');
    expect(await page.evaluate(controlsPastEdge), 'Home controls past the edge').toEqual([]);

    await openLibrary(page);
    const sections = page.getByRole('tablist', { name: 'Library sections' });
    for (const name of ['Cards', 'Story Time', 'Culture']) await expectReachable(page, sections.getByRole('tab', { name, exact: true }));
    await expectNoHorizontalOverflow(page, 'Library at 320');

    for (const [tab, last] of [
      ['Story Time', STORY_TIME[STORY_TIME.length - 1]],
      ['Culture', null],
    ] as const) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const tiles = page.locator('[data-testid^="story-tile-"]');
      await expect(tiles.first()).toBeVisible();
      const target = last === null ? tiles.last() : page.locator(`[data-testid="story-tile-${last}"]`);
      // A tile with a long title can be taller than the screen at 320 x 568, so its last line
      // (the minutes) is what must scroll fully into view above the tab bar.
      // The Culture list runs past what the helper's fifteen wheel turns cover, so bring the tile near first.
      await target.scrollIntoViewIfNeeded();
      await expectReachable(page, target.getByText(/about \d+ min/));
      await expectNoHorizontalOverflow(page, `${tab} at 320`);
      expect(await page.evaluate(controlsPastEdge), `${tab} controls past the edge`).toEqual([]);
    }
  });
});
