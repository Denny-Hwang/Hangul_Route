import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, pastTapLock, readStored, seedStoredAll } from './helpers';

/**
 * AMENDMENTS-AUDIO-CANT-HEAR row CH-1b (review of #1099): "Can't hear it?" on the Syllable Build quest step must never
 * overlap the block's slots. At 320 x 568 with the largest text the speaker column is about 128 wide, narrower than the
 * link's label, so the link has to wrap inside it; at 360 x 740 it stays one line under the speaker. Letters Volume 2,
 * quest 1 (Stage 2) plays Syllable Build as its Apply step; `volumes` and `game.syllable-build` are turned on through
 * the stored remote copy, with Volume 1 done so the cell opens Volume 2.
 */

const LETTERS_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-letters');
const lettersCell = (page: Page) => page.getByRole('button', { name: /^Stage 2 [^,]+, Letters & Books/ });
const FLAGS = { volumes: { on: true, pct: 100 }, 'game.syllable-build': { on: true, pct: 100 } };

/** A ko-KR voice that "plays" every utterance (headless Chromium has none, and with none the link gives way to the no-voice text). */
async function koreanVoiceThatPlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: SpeechSynthesisUtterance) => {
          setTimeout(() => {
            u.onstart?.call(u, new Event('start') as SpeechSynthesisEvent);
            u.onend?.call(u, new Event('end') as SpeechSynthesisEvent);
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: true }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

async function openSyllableBuild(page: Page, largest: boolean): Promise<void> {
  await koreanVoiceThatPlays(page);
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = LETTERS_V1?.questIds ?? [];
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage2-letters', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
  await seedStoredAll(page, {
    [`progress:${id}`]: { profileId: id, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt: Object.fromEntries(questIds.map((q) => [q, AT])) },
    'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: FLAGS },
    ...(largest ? { 'device:settings': { uiLocale: 'en', textSize: 'largest', uiLocaleAt: '2026-10-16T09:00:00.000Z' } } : {}),
  });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
  await lettersCell(page).scrollIntoViewIfNeeded();
  await lettersCell(page).click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  // Practice (Pic-Word Match): pair each picture with the word of the same id, board after board; Apply is Syllable Build.
  await page.getByRole('button', { name: 'Play minigame' }).click();
  const next = page.getByRole('button', { name: 'Play minigame' });
  for (let attempt = 0; attempt < 12 && !(await next.isVisible()); attempt += 1) {
    const pictures = page.locator('[data-testid^="pic-word-picture-"]');
    await pictures.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
    const ids = await pictures.evaluateAll((els) => els.map((el) => (el.getAttribute('data-testid') ?? '').replace('pic-word-picture-', '')));
    for (const pairId of ids) {
      if (await next.isVisible()) break;
      await pastTapLock(page);
      // A board that has just advanced no longer has this picture: read the board again.
      const paired = await page
        .getByTestId(`pic-word-picture-${pairId}`)
        .click({ timeout: 1500 })
        .then(() => page.getByTestId(`pic-word-word-${pairId}`).click({ timeout: 1500 }))
        .then(() => true, () => false);
      if (!paired) break;
    }
    await page.waitForTimeout(600);
  }
  await next.click();
  await expect(page.getByTestId('syllable-build-game')).toBeVisible();
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const rectOf = async (page: Page, testId: string): Promise<Rect> => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  return box;
};
const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [label, size, largest] of [
  ['320 x 568, largest text', { width: 320, height: 568 }, true],
  ['360 x 740', { width: 360, height: 740 }, false],
] as const) {
  test(`${label}: the Syllable Build link never overlaps a slot, and stays inside the window`, async ({ page }) => {
    await page.setViewportSize(size);
    await openSyllableBuild(page, largest);
    const link = page.getByTestId('cant-hear');
    await expect(link).toBeVisible();
    const linkRect = await rectOf(page, 'cant-hear');
    for (const zone of ['first', 'vowel', 'final']) {
      expect(intersects(linkRect, await rectOf(page, `syllable-build-zone-${zone}`)), `the link overlaps the ${zone} slot`).toBe(false);
    }
    expect(linkRect.x).toBeGreaterThanOrEqual(0);
    expect(linkRect.x + linkRect.width).toBeLessThanOrEqual(size.width);
    await shot(page, `ch1b-syllable-build-link-${size.width}x${size.height}`);
    // Still a 64 dp target.
    expect(linkRect.height).toBeGreaterThanOrEqual(64);
  });
}
