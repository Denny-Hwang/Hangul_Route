import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked } from './helpers';

/**
 * F-STORY-004 PR 4.8 (§3.3, §3.14 rows 5 and 8; rollout §6): a build with no
 * reviewed story ships the shelf dark. The regular build is that build today:
 * every bundled story is still a `draft` for language and culture review, so
 * the story index is empty. Then the Library is exactly today's card gallery
 * with no Story Time or Culture section, and Home has no story card (slots ①
 * and ③ fall back to the `explore` card, never the old "Story time" label).
 *
 * Runs on the regular build (`pnpm --filter @hangul-route/mobile build:web`);
 * the fixture bundle carries a reviewed shelf story, so the suite skips there
 * (story-shelf.spec.ts covers that bundle).
 *
 * Words (F-VOC-003) is its own Library section behind `vocabTopicsEnabled`
 * (off until C-7). With it off, Cards is the only section and there is no tab
 * row at all; once it is on, the row holds Cards and Words only.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY_WORDS = /Story Time|Culture notes|Picked for you|A short story|Keep reading|Read it again/;

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

test.describe('Library with no reviewed story (regular build)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture bundle has a reviewed shelf story: see story-shelf.spec.ts');

  test('the Library is the card gallery alone: no story sections and, with Words off, no tab row', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page);
    await openLibrary(page);

    // Today's gallery: the count line, the theme filter and the welcome card the new learner holds.
    await expect(page.getByText('1 card collected', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All/ }).first()).toBeVisible();

    // No Story Time or Culture tab, and none of the shelf's surfaces.
    await expect(page.getByRole('tab', { name: 'Story Time', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Culture', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-testid^="library-shelf-"], [data-testid="library-hero"], [data-testid="library-culture"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="story-tile-"]')).toHaveCount(0);

    // Cards alone draws no tab row; Words, when its flag is on, is the only other tab. (The app's
    // bottom bar is a tablist of its own, so the Library's row is looked up by its name.)
    const sections = page.getByRole('tablist', { name: 'Library sections' });
    const labels = await sections.getByRole('tab').allInnerTexts();
    if (labels.length === 0) {
      await expect(sections).toHaveCount(0);
      await expect(page.getByTestId('library-sections')).toHaveCount(0);
    } else {
      expect(labels).toEqual(['Cards', 'Words']);
    }

    expect(await page.locator('body').innerText()).not.toMatch(STORY_WORDS);
    expect(errors).toEqual([]);
  });

  test('Home has no story card: the explore card stands in, and no lesson is labelled "Story time"', async ({ page }) => {
    await onboard(page);
    const missions = page.getByTestId('home-missions');
    await expect(missions.getByRole('button').first()).toBeVisible();
    const labels = await missions.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));

    // Day one: the first Journey quest and the current episode to look at; never a story.
    expect(labels).toContain('Meet the Letters. Take a look.');
    for (const label of labels) expect(label).not.toMatch(/A short story|Keep reading|Read it again|Story time/);
    await expect(missions.locator('[data-testid^="home-mission-cover-"]')).toHaveCount(0);
  });
});
