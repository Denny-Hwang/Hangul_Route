import type { Locator, Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, completeSelfForm, keepSidewaysIfAsked, unlockWithPin } from './helpers';

/**
 * F-STORY-004 PR 4.8b: the locked story tile and its grown-up gate, on the gating fixture bundle:
 * the story fixtures with content gating on (`EXPO_PUBLIC_CONTENT_GATING_ENABLED=true`), exported
 * into dist-e2e-gated/ on a Metro cache of its own:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures:gated
 *   STORY_FIXTURES_GATED=1 pnpm --filter @hangul-route/mobile test:e2e:web story-shelf-gated.spec
 *
 * Its non-sampler shelf story is `story:cell-stories-fixture` ("The Hangul Book", Culture,
 * `shelf.sampler: false`): for a free learner its tile reads the closed-tile word, and a tap sends
 * `story.locked.tapped { storyId }` and opens the grown-up gate (`StoryShelf.openTile`,
 * `lockedStoryGate`): `PinEntry { next: 'Paywall', from: 'library' }` on a device with a PIN, or
 * `Paywall { from: 'library' }` at once on a self-only device with no PIN. The sampler
 * (`story:hangul-day`, Story Time) stays open with gating on. `from` is read from the paywall's own
 * `paywall.viewed` event, the window's `__hrStoryE2E.events()`.
 *
 * The closed-tile word is read from its dictionary key, `learner.storyShelf.state.locked`: F-ENT-003
 * §3.11 changes its value from "Locked" to "Not open yet" (with the dotted ring for the lock glyph) in
 * PR E3-7, and this spec follows the key, so it holds before and after that PR.
 *
 * Release gate: any PR that turns `contentGatingEnabled` on for a build that ships a reviewed
 * non-sampler shelf story (the F-ENT-003 free-plan rollout) depends on this spec. The gating-off
 * half is story-shelf.spec.ts on the fixture bundle.
 */

const GATED_BUILD = process.env.STORY_FIXTURES_GATED === '1';
const LOCKED = 'story:cell-stories-fixture';
const LOCKED_TITLE = 'The Hangul Book';
const SAMPLER = 'story:hangul-day';
const SHELF = getMessages('en').learner.storyShelf;
/** The closed-tile word ("Not open yet" once F-ENT-003 E3-7 lands). */
const CLOSED = SHELF.state.locked;
const EMOJI = /\p{Extended_Pictographic}/u;

type E2eEvent = { name: string; profileId?: string; payload?: Record<string, unknown> };
type E2eWindow = Window & { __hrStoryE2E?: { events(): E2eEvent[] } };

/** Screens under the top one stay in the page (hidden), so lookups take the visible one. */
const shown = (page: Page, testId: string): Locator => page.getByTestId(testId).filter({ visible: true });

function events(page: Page, name: string): Promise<Array<Record<string, unknown> | undefined>> {
  return page.evaluate(
    (n) => ((window as E2eWindow).__hrStoryE2E?.events() ?? []).filter((e) => e.name === n).map((e) => e.payload),
    name,
  );
}

/** A new learner on Home, with the fixture bundle's e2e hook mounted and the install guide out of the way. */
async function onboard(page: Page, who: 'child' | 'self', name: string): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  if (who === 'child') await completeChildForm(page, { name });
  else await completeSelfForm(page, { name });
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
}

/** Library, Culture section: the locked tile, checked before the tap. */
async function lockedTile(page: Page): Promise<Locator> {
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  // The sampler stays open with gating on.
  await page.getByRole('tab', { name: 'Story Time', exact: true }).click();
  await expect(shown(page, `story-tile-${SAMPLER}`)).toHaveAccessibleName(SHELF.tileLabel('Hangul Day', SHELF.state.new, 4));
  const culture = page.getByRole('tab', { name: 'Culture', exact: true });
  await culture.click();
  await expect(culture).toHaveAttribute('aria-selected', 'true');
  const tile = shown(page, `story-tile-${LOCKED}`);
  await expect(tile).toHaveAccessibleName(SHELF.tileLabel(LOCKED_TITLE, CLOSED, 4));
  await expect(tile).toContainText(CLOSED);
  expect(await events(page, 'story.locked.tapped')).toEqual([]);
  return tile;
}

test.describe('story shelf, content gating on (gating fixture bundle)', () => {
  test.skip(!GATED_BUILD, 'needs the gating fixture bundle: build:web:fixtures:gated, then STORY_FIXTURES_GATED=1');

  test('a family device: the locked tile sends story.locked.tapped and opens PIN entry, then the paywall from the Library', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page, 'child', 'Dami');
    const tile = await lockedTile(page);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);

    await tile.click();
    await expect.poll(() => events(page, 'story.locked.tapped')).toEqual([{ storyId: LOCKED }]);
    // PinEntry { next: 'Paywall' }: the grown-up gate first, nothing behind it yet.
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    expect(await events(page, 'paywall.viewed')).toEqual([]);
    await unlockWithPin(page);
    // ...then the paywall (the Plan screen), opened from the Library.
    await expect(page.getByRole('heading', { name: 'Dami: Free plan.' })).toBeVisible();
    await expect.poll(() => events(page, 'paywall.viewed')).toEqual([{ state: 'free', from: 'library' }]);
    // The tap opened neither the story's episode page nor its reader.
    await expect(shown(page, 'story-episode-title')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a self-only device with no PIN: the locked tile opens the paywall at once, from the Library', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page, 'self', 'Rio');
    const tile = await lockedTile(page);

    await tile.click();
    await expect.poll(() => events(page, 'story.locked.tapped')).toEqual([{ storyId: LOCKED }]);
    await expect(page.getByRole('heading', { name: 'Rio: Free plan.' })).toBeVisible();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
    await expect.poll(() => events(page, 'paywall.viewed')).toEqual([{ state: 'free', from: 'library' }]);
    await expect(shown(page, 'story-episode-title')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
