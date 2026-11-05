import type { Page } from '@playwright/test';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, readStored, seedStored } from './helpers';
import { en } from './jamo-voice-rig';

/**
 * "No sound? Read it here." must never move answers already on screen (AMENDMENTS-TOUCH: nothing moves under a
 * finger). This browser has no Korean voice (the fixture's silent engine), so the notice shows; before this fix it came
 * in above the answers once the voice check settled (up to 1.5 s after the app opened), and moved them down by up to
 * about 400 px at 320 px with the largest text, under a child's finger. Now a round holds its answers while the check
 * runs (`slot.settled`, `<TapBoard held>`), so they first show with the notice, where they stay.
 *
 * An in-page sampler reads every answer's rectangle on every animation frame from the moment the round mounts: once an
 * answer is drawn, its rectangle never changes while the notice comes in. Release build, 320 x 640, largest text.
 */

type Rect = { x: number; y: number; w: number; h: number };
interface Sample {
  t: number;
  notice: boolean;
  answers: Record<string, Rect>;
}

/** Starts sampling in the page: every frame, the answers' rectangles (document coordinates) and whether the notice is up. */
async function startSampler(page: Page, answerPrefix: string, noticeTestId: string): Promise<void> {
  await page.evaluate(
    ({ answerPrefix, noticeTestId }) => {
      const w = window as Window & { __shiftSamples?: Sample[]; __shiftStop?: boolean };
      w.__shiftSamples = [];
      w.__shiftStop = false;
      const visible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const tick = (): void => {
        if (w.__shiftStop) return;
        const answers: Record<string, Rect> = {};
        for (const el of Array.from(document.querySelectorAll(`[data-testid^="${answerPrefix}"]`))) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          // Document coordinates: a page scroll is not a shift; a layout change is.
          answers[el.getAttribute('data-testid') ?? ''] = { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
        }
        const notice = Array.from(document.querySelectorAll(`[data-testid="${noticeTestId}"]`)).some((el) => visible(el) && (el.textContent ?? '').length > 0);
        w.__shiftSamples!.push({ t: performance.now(), notice, answers });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { answerPrefix, noticeTestId },
  );
}

async function stopSampler(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const w = window as Window & { __shiftSamples?: Sample[]; __shiftStop?: boolean };
    w.__shiftStop = true;
    return w.__shiftSamples ?? [];
  });
}

/** Every answer keeps the rectangle it was first drawn with; returns the moves found (empty when none). */
function movesOf(samples: Sample[]): string[] {
  const first = new Map<string, Rect>();
  const moves: string[] = [];
  for (const s of samples) {
    for (const [id, r] of Object.entries(s.answers)) {
      const f = first.get(id);
      if (f === undefined) {
        first.set(id, r);
        continue;
      }
      if (f.x !== r.x || f.y !== r.y) moves.push(`${id} moved from (${f.x}, ${f.y}) to (${r.x}, ${r.y}) at ${Math.round(s.t)} ms (notice ${s.notice ? 'up' : 'not up'})`);
    }
  }
  return moves;
}

/** The case only checks something when the answers were drawn and the notice came up while sampling. */
function expectCoverage(samples: Sample[]): void {
  const withAnswers = samples.filter((s) => Object.keys(s.answers).length > 0);
  expect(withAnswers.length, 'answers were drawn while sampling').toBeGreaterThan(0);
  expect(samples.some((s) => s.notice), 'the no-voice notice came up while sampling').toBe(true);
  // Every frame that draws answers draws the notice with them: the notice never comes in after the answers.
  const answersBeforeNotice = withAnswers.filter((s) => !s.notice);
  expect(answersBeforeNotice.map((s) => Math.round(s.t)), 'no frame shows answers without the notice').toEqual([]);
}

const LARGEST = { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' };

const largestText = async (page: Page): Promise<void> => {
  await page.goto('/');
  await seedStored(page, 'device:settings', LARGEST);
};

/** Taught single words of this build with distinct spellings and meanings (as `daily-review.spec.ts`). */
function wordIds(n: number): Array<{ id: string; stage: number }> {
  const seenKo = new Set<string>();
  const seenEn = new Set<string>();
  const out: Array<{ id: string; stage: number }> = [];
  for (const [id, ko, , meaning, , , meta] of REVIEW_ITEM_ROWS) {
    if (!id.startsWith('lex:') || meaning === '' || ko.includes(' ') || seenKo.has(ko) || seenEn.has(meaning)) continue;
    seenKo.add(ko);
    seenEn.add(meaning);
    out.push({ id, stage: meta & 7 });
    if (out.length === n) break;
  }
  return out;
}

test.describe('the no-voice notice never moves the answers, phone 320, largest text', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('Daily Review: a round opened while the voice check runs shows its answers only with the notice, and they never move', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    await page.getByRole('button', { name: "Let's start" }).click();
    await completeChildForm(page, { name: 'Dami' });
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const rows: Record<string, unknown> = {};
    for (const w of wordIds(4)) rows[w.id] = { sh: `stage${Math.max(1, w.stage)}`, st: { b: 1, d: today, c: 0, r: 0, n: 1, f: '2026-01-01', s: 1, at: '2026-01-02T09:00:00.000Z' } };
    await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null });
    await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 } } });
    await seedStored(page, 'device:settings', LARGEST);
    // The install guide (it shows from a later open and covers Home on a phone) is snoozed, so the timed tap is the card.
    await seedStored(page, 'pwa:install-guide', { visits: 0, snoozedUntilVisit: 1000, installed: false });
    // A fresh page: the voice check starts again (it settles 1.5 s later with this voiceless engine), and the round
    // opens inside that window, the case that used to move the answers.
    await page.reload();
    const card = page.getByRole('button', { name: /^Daily Review\. About 3 minutes\./ });
    await expect(card).toBeVisible();
    await startSampler(page, 'daily-review-option-', 'daily-review-sound-notice');
    const opened = await page.evaluate(() => performance.now());
    await card.click();
    await expect(page.getByTestId('daily-review-sound-notice')).toContainText('No sound? Read it here.');
    await expect(page.locator('[data-testid^="daily-review-option-"]').first()).toBeVisible();
    // Past the voice check's 1.5 s and the store's 2 s cap, so a late move would be seen.
    await page.waitForTimeout(2_500);
    const samples = await stopSampler(page);
    const noticeAt = samples.find((s) => s.notice)?.t ?? Infinity;
    test.info().annotations.push({ type: 'timing', description: `the notice came up ${Math.round(noticeAt - opened)} ms after the card was tapped` });
    expectCoverage(samples);
    expect(movesOf(samples)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Listen & Pick: a round opened while the voice check runs shows its cards only with the notice, and they never move', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await largestText(page);
    await page.goto('/?try=1');
    await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
    const go = page.getByRole('button', { name: 'Go', exact: true });
    await expect(go).toBeVisible();
    await startSampler(page, 'listen-pick-option-', 'listen-pick-prompt');
    await go.click();
    await expect(page.getByTestId('listen-pick-prompt-detail').filter({ visible: true })).toBeVisible();
    await page.waitForTimeout(2_500);
    const samples = await stopSampler(page);
    expectCoverage(samples);
    expect(movesOf(samples)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
