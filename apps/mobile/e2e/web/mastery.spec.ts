import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { decodeReviewItems } from '@hangul-route/content-schema/review-items';
import * as chunk from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, onboardChild, passDiscover, playCheckByIds, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 sections 4.4, 7.7, 12.2 and 14, row CM-20 (design/wireframes/journey/mastery-ring.md): the mastery ring
 * round the Journey cells, Ready to refresh on a mastered cell with items due, the cell labels, Words known on Home,
 * cells still 54 dp at 320, the sparkle clear of the stage header, nothing animated with reduced motion, and nothing
 * drawn with `mastery` off. `mastery` ships at built-in pct 0, so each case turns it on through the stored remote
 * copy, as a ramp would (with `memoryRecord`, which the levels need, and `dailyReview`, which Ready to refresh needs).
 * The levels come from the latched `cellBest` (Mastered, Practiced, Done): the boxes of this learner hold only Done,
 * so the map also shows that a latched level never drops.
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web mastery
 */

const NOW = new Date('2026-10-22T10:00:00.000Z');
const TODAY = '2026-10-22';
const AT = '2026-10-01T10:00:00.000Z';
test.use({ timezoneId: 'UTC' });

const ITEMS = decodeReviewItems(chunk);
const cellOf = (theme: string) => `episode:stage1-${theme}`;
const questsOf = (cell: string): string[] => CATALOG.cells.find((c) => c.episodeId === cell)?.questIds ?? [];

type Flags = Record<string, { on: boolean; pct: number }>;
const ON: Flags = { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 }, mastery: { on: true, pct: 100 } };

/** Dami, with Stage 1 Letters, Food and Holidays done (latched Mastered, Practiced, Done), 120 words known and one Letters item due today. */
async function learner(page: Page, flags: Flags = ON): Promise<string> {
  await page.clock.install({ time: NOW });
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const cells = ['letters', 'life', 'rites'].map(cellOf);
  const questDoneAt = Object.fromEntries(cells.flatMap(questsOf).map((q) => [q, AT]));
  const quests = cells.flatMap((cell) => questsOf(cell).map((questId) => ({ questId, episodeId: cell, startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 })));
  await seedStored(page, `progress:${id}`, {
    profileId: id,
    updatedAt: AT,
    episodes: [],
    quests,
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    questDoneAt,
    memSeededAt: AT,
    cellBest: { [cellOf('letters')]: 3, [cellOf('life')]: 2, [cellOf('rites')]: 1 },
  });
  const words = ITEMS.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:')).slice(0, 120);
  const due = ITEMS.find((i) => i.cells.includes(cellOf('letters')) && !i.id.startsWith('vocab:'));
  const rows: Record<string, unknown> = {};
  for (const w of words) rows[w.id] = { sh: `stage${Math.max(1, w.stage)}`, st: { b: 2, d: '2026-12-01', c: 1, r: 1, n: 1, f: '2026-10-01', s: 2, at: AT } };
  if (due) rows[due.id] = { sh: 'stage1', st: { b: 3, d: TODAY, c: 1, r: 3, n: 3, f: '2026-10-01', s: 4, at: AT } };
  await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: AT, day: null, dailySent: null, wk: words.length });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: NOW.getTime(), maxAgeS: 300, flags });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  return id;
}

const cell = (page: Page, theme: string) => page.getByRole('button', { name: journeyCellName(1, theme) });
const openJourney = (page: Page) => page.getByText('Journey', { exact: true }).last().click();

test.describe('mastery on', () => {
  test('320: rings on the started cells, Ready to refresh on the mastered one, 54 dp cells, no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await learner(page);
    // Home: the Words known pill, first in the pills row.
    await expect(page.getByTestId('home-words-known')).toHaveText('120 words known');
    await openJourney(page);
    await expect(cell(page, 'Letters & Books')).toHaveAccessibleName(/\. Mastered\. Ready to refresh\.$/);
    await expect(cell(page, 'Food & Daily Life')).toHaveAccessibleName(/\. Practiced\.$/);
    await expect(cell(page, 'Holidays & Traditions')).toHaveAccessibleName(/\. Done\.$/);
    await expect(cell(page, 'Nature & Animals')).not.toHaveAccessibleName(/Done|Practiced|Mastered/);
    await expect(page.getByTestId('journey-mastery-stage1-letters-refresh')).toBeVisible();
    await expect(page.getByTestId('journey-mastery-stage1-life-refresh')).toHaveCount(0);
    // The ring is decorative.
    await expect(page.getByTestId('journey-mastery-stage1-letters')).toHaveAttribute('aria-hidden', 'true');
    // Cells still 54 dp wide at 320 (the 5 columns share the 288 dp grid less the gaps): a ringed cell is exactly as wide
    // and as tall as a level 0 one, so the ring adds no width.
    const plain = await cell(page, 'Nature & Animals').boundingBox();
    expect(Math.floor(plain?.width ?? 0)).toBe(54);
    for (const theme of ['Letters & Books', 'Food & Daily Life', 'Holidays & Traditions']) {
      const box = await cell(page, theme).boundingBox();
      expect(box?.width, theme).toBeCloseTo(plain?.width ?? 0, 1);
      expect(box?.height, theme).toBeCloseTo(plain?.height ?? 0, 1);
    }
    // The sparkle (8 dp above the cell) never overlaps the stage header above it.
    const sparkle = await page.getByTestId('journey-mastery-stage1-letters-refresh').boundingBox();
    const header = await page.getByTestId('journey-stage-pill-stage1').boundingBox();
    expect((sparkle?.y ?? 0) + 0.5).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
    await expectNoHorizontalOverflow(page);
    await cell(page, 'Letters & Books').scrollIntoViewIfNeeded();
    await shot(page, 'mastery-ring-320');
  });

  test('wide: the same rings on the bigger cells', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await learner(page);
    await openJourney(page);
    await expect(cell(page, 'Letters & Books')).toHaveAccessibleName(/Mastered\. Ready to refresh\.$/);
    await expect(page.getByTestId('journey-mastery-stage1-life')).toBeVisible();
    await shot(page, 'mastery-ring-wide');
  });

  test('reduced motion: nothing on the map animates; the glow never pulses', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 800 });
    await learner(page);
    await openJourney(page);
    await expect(page.getByTestId('journey-mastery-stage1-letters-refresh')).toBeVisible();
    const animated = await page.getByTestId('journey-mastery-stage1-letters').evaluate((el) =>
      [el, ...Array.from(el.querySelectorAll('*'))].filter((n) => {
        const cs = getComputedStyle(n);
        return cs.animationName !== 'none' || (cs.transitionDuration !== '0s' && cs.transitionProperty !== 'none' && cs.transitionDuration !== '');
      }).length,
    );
    expect(animated).toBe(0);
  });
});

test.describe('mastery off (section 12.2)', () => {
  test('no ring, no glow, no marker and no Words known pill; the latched levels stay in the record', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page, { ...ON, mastery: { on: true, pct: 0 } });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect(page.getByTestId('home-words-known')).toHaveCount(0);
    await openJourney(page);
    await expect(cell(page, 'Letters & Books')).toBeVisible();
    await expect(cell(page, 'Letters & Books')).not.toHaveAccessibleName(/Mastered|Ready to refresh/);
    await expect(page.locator('[data-testid^="journey-mastery-"]')).toHaveCount(0);
    expect((await readStored<{ cellBest?: Record<string, number> }>(page, `progress:${id}`))?.cellBest?.[cellOf('letters')]).toBe(3);
  });

  test('with memoryRecord off the levels do not show either (they need answered memory)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await learner(page, { ...ON, memoryRecord: { on: true, pct: 0 } });
    await openJourney(page);
    await expect(cell(page, 'Letters & Books')).toBeVisible();
    await expect(page.locator('[data-testid^="journey-mastery-"]')).toHaveCount(0);
  });
});

test.describe('the Results of a quest (Home and the Journey mounted under it)', () => {
  type SpeechWindow = Window & { __spoken?: string[] };
  /** Headless Chromium has no Korean voice: stand in for speechSynthesis with a ko-KR voice and end each utterance at once. */
  async function captureSpeech(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const spoken: string[] = [];
      (window as SpeechWindow).__spoken = spoken;
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speaking: false,
          pending: false,
          speak: (u: SpeechSynthesisUtterance) => {
            if (u.volume !== 0) spoken.push(u.text);
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

  test('finishing the last quest of a cell shows its level up and a Words known milestone, once', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await captureSpeech(page);
    await page.goto('/');
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Dami' });
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    const id = (await readStored<string>(page, 'profiles:active')) as string;
    // Holidays quests 1 and 2 done; the third (Hanbok and the Bow) finishes the cell, a Done rise.
    const rites = cellOf('rites');
    const firstTwo = questsOf(rites).slice(0, 2);
    await seedStored(page, `progress:${id}`, {
      profileId: id,
      updatedAt: AT,
      episodes: [],
      quests: firstTwo.map((questId) => ({ questId, episodeId: rites, startedAt: AT, completedAt: AT, stars: 1, attempts: 1, accuracy: 0.5 })),
      cards: [],
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 0,
      questDoneAt: Object.fromEntries(firstTwo.map((q) => [q, AT])),
      memSeededAt: AT,
      cellBest: {},
    });
    // 100 words known, and this device last read 99: the next read crosses the 100 milestone. Home reads first.
    const words = ITEMS.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:')).slice(0, 100);
    const rows = Object.fromEntries(words.map((w) => [w.id, { sh: `stage${Math.max(1, w.stage)}`, st: { b: 2, d: '2027-01-01', c: 1, r: 1, n: 1, f: '2026-10-01', s: 2, at: AT } }]));
    await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: AT, day: null, dailySent: null, wk: 99 });
    await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: ON });
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect(page.getByTestId('home-words-known')).toHaveText('100 words known');
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();

    await openJourney(page);
    await page.getByRole('button', { name: journeyCellName(1, 'Holidays') }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await playCheckByIds(page, [{ answer: 'jamo:yo' }, { answer: '한복' }]);
    await page.getByRole('button', { name: 'See results' }).click();

    // Home and the Journey re-read when the quest is written and latch first; the Results still shows both moments.
    const milestone = page.getByTestId('results-words-milestone');
    const levelUp = page.getByTestId('results-level-up');
    await expect(milestone).toHaveText(/^100 words! Hoya is so proud of you\.$/);
    await expect(levelUp).toHaveText('New Year & Festivals: Done');
    // Both are in the polite live region, so the web reads them.
    await expect(page.locator('[aria-live="polite"]').filter({ has: levelUp })).toHaveCount(1);
    expect((await readStored<{ cellBest?: Record<string, number> }>(page, `progress:${id}`))?.cellBest?.[rites]).toBe(1);

    // Shown once: a replay of the quest brings neither back.
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openJourney(page);
    await page.getByRole('button', { name: journeyCellName(1, 'Holidays') }).click();
    await page.getByRole('button', { name: 'Play again', exact: true }).nth(2).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await playCheckByIds(page, [{ answer: 'jamo:yo' }, { answer: '한복' }]);
    await page.getByRole('button', { name: 'See results' }).click();
    await expect(page.getByText('Wonderful!').or(page.getByText('Great!')).or(page.getByText('You tried!'))).toBeVisible();
    await expect(page.getByTestId('results-level-up')).toHaveCount(0);
    await expect(page.getByTestId('results-words-milestone')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
