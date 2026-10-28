import type { Locator, Page } from '@playwright/test';
import { heritageCardsAll } from '../../src/content/heritage-cards';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheck, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoSidewaysScroll, expectTextFits } from './text-fit';

/**
 * F-CURR-002 §5.7 (row CM-3C) on the web PWA, behind `upperCards` (the remote copy is the stored one: this build has
 * no API). Stage 2 Nature & Animals, one of the four cells that had no note: quest 1's reward step shows its Did you
 * know? tip, the magpie and the tiger in minhwa, with its taught Korean marked and its source line, and nothing else
 * on the step moves; the cell's card shows the same note on its back and, where a screen reader reads it, in the fact
 * card under it. With the switch off (its built-in pct 0) neither shows. At 320 px nothing scrolls sideways.
 */

const NOTE = /Korean folk paintings, called/;
const SOURCE = /^Source: 국립민속박물관 \(National Folk Museum of Korea\)/;

/** `on`: the stored remote copy turns `upperCards` on (pct 100) or off (pct 0); `null`: no remote copy stored at all. */
async function onboard(page: Page, on: boolean | null, textSize?: 'largest'): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  expect(profileId).toBeTruthy();
  if (textSize) await seedStored(page, 'device:settings', { uiLocale: 'en', textSize, uiLocaleAt: '2026-10-16T09:00:00.000Z' });
  if (on !== null) await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards: { on, pct: on ? 100 : 0 } } });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  return profileId;
}

/** Quest 1 of Outdoor Words from its launcher to the reward step: Discover, the two games skipped, the Check played. */
async function toReward(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(2, 'Nature & Animals') }).first().click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheck(page);
  await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
}

/** The Library page of `card:byeol` (Stage 2 Nature & Animals), seeded as held, on its front. */
async function openCard(page: Page, profileId: string): Promise<void> {
  const T = '2026-10-20T09:00:00.000Z';
  await seedStored(page, `progress:${profileId}`, {
    profileId,
    updatedAt: T,
    episodes: [],
    quests: [],
    cards: [{ cardId: 'card:byeol', unlockedAt: T, newSinceLastView: false }],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByRole('tablist').getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  const cards = page.getByRole('tab', { name: 'Cards', exact: true });
  if ((await cards.count()) > 0) await cards.click();
  const title = heritageCardsAll.find((c) => c.id === 'card:byeol')!.titleEn;
  await page.getByRole('button', { name: title, exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Tap to flip card to back' })).toBeVisible();
}

/** The URLs of the tip's own chunk (`screen-chunk:culture-tip`, `culture-tip-chunk-<hash>.js`) the page asks for. */
function tipChunkRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (/culture-tip-chunk/.test(request.url())) urls.push(request.url());
  });
  return urls;
}

const tipAt = (page: Page, place: 'reward' | 'back' | 'fact-card'): Locator => page.getByTestId(`culture-tip-${place}`).filter({ visible: true });

async function shots(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoSidewaysScroll(page, name);
  await shot(page, `${name}-320`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, `${name}-wide`);
  await page.setViewportSize({ width: 393, height: 851 });
}

test("on: the reward step's Did you know? tip, a named region with its note, Korean marked and its source line", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const chunk = tipChunkRequests(page);
  await onboard(page, true);
  await toReward(page);
  const tip = tipAt(page, 'reward');
  await expect(tip).toBeVisible();
  // A landmark a screen reader can jump to, with a heading.
  await expect(page.getByRole('region', { name: 'Lesson note' })).toBeVisible();
  await expect(tip.getByRole('heading', { name: 'Did you know?' })).toBeVisible();
  await expect(tip.getByTestId('culture-tip-text')).toHaveText(NOTE);
  await expect(tip.getByTestId('culture-tip-text').locator('[lang="ko"]', { hasText: '까치호랑이' })).toHaveCount(1);
  await expect(tip.getByTestId('culture-tip-source').locator('[lang="ko"]', { hasText: '국립민속박물관' })).toHaveCount(1);
  await expect(tip.getByText(/kkachihorangi/)).toBeVisible();
  await expect(tip.getByTestId('culture-tip-source')).toHaveText(SOURCE);
  await expect(tip.getByText(/https?:|folkency/)).toHaveCount(0);
  // The tip came in its own chunk (the off tests below look for the same request and find none).
  expect(chunk.length).toBeGreaterThan(0);
  // See results is still the step's button, under the tip, and 48 dp or more at 320 px.
  await page.setViewportSize({ width: 320, height: 720 });
  const results = page.getByRole('button', { name: 'See results' });
  const [tipBox, buttonBox] = [await tip.boundingBox(), await results.boundingBox()];
  expect(buttonBox!.y).toBeGreaterThan(tipBox!.y + tipBox!.height - 1);
  expect(Math.min(buttonBox!.width, buttonBox!.height)).toBeGreaterThanOrEqual(48);
  await shots(page, 'culture-tip-reward');
  expect(errors).toEqual([]);
});

test("on: the cell's card shows its note in the fact card and on its back", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const profileId = await onboard(page, true);
  await openCard(page, profileId);
  const facts = tipAt(page, 'fact-card');
  await expect(facts).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lesson note' })).toBeVisible();
  await expect(facts.getByTestId('culture-tip-text')).toHaveText(NOTE);
  await shots(page, 'culture-tip-card-front');
  await page.getByRole('button', { name: 'Tap to flip card to back' }).click();
  const back = tipAt(page, 'back');
  await expect(back).toBeVisible();
  await expect(back.getByTestId('culture-tip-source')).toHaveText(SOURCE);
  await shots(page, 'culture-tip-card-back');
  expect(errors).toEqual([]);
});

test('on, 320 px at the Largest text size (150%): the tip fits above See results, and on the card back', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const profileId = await onboard(page, true, 'largest');
  await toReward(page);
  const tip = tipAt(page, 'reward');
  await expect(tip).toBeVisible();
  await expectTextFits(page, 'the reward step tip at Largest');
  const results = page.getByRole('button', { name: 'See results' });
  await results.scrollIntoViewIfNeeded();
  const [tipBox, buttonBox] = [await tip.boundingBox(), await results.boundingBox()];
  expect(buttonBox!.y).toBeGreaterThan(tipBox!.y + tipBox!.height - 1);
  expect(Math.min(buttonBox!.width, buttonBox!.height)).toBeGreaterThanOrEqual(48);
  await openCard(page, profileId);
  await expect(tipAt(page, 'fact-card')).toBeVisible();
  await expectTextFits(page, 'the card front and its fact card at Largest');
  await page.getByRole('button', { name: 'Tap to flip card to back' }).click();
  await expect(tipAt(page, 'back')).toBeVisible();
  await expectTextFits(page, 'the card back tip at Largest');
  await shot(page, 'culture-tip-card-back-largest-320');
});

for (const [name, on] of [
  ['switched off in the stored copy', false],
  ['no remote copy stored, the built-in pct 0 (the launch state)', null],
] as const) {
  test(`off (${name}): no tip at the reward step or on the card, and its chunk is never loaded`, async ({ page }) => {
    const chunk = tipChunkRequests(page);
    const profileId = await onboard(page, on);
    await toReward(page);
    // Let any lazy load the step could start settle before looking (a late tip would show up here).
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
    await expect(page.getByTestId('culture-tip-reward')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Lesson note' })).toHaveCount(0);
    await openCard(page, profileId);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('culture-tip-fact-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tap to flip card to back' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('culture-tip-back')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Lesson note' })).toHaveCount(0);
    expect(chunk).toEqual([]);
  });
}
