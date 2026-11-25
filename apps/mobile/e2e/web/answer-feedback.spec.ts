import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, openPlaygroundWordsQuest, passDiscover } from './helpers';
import { shot } from './shots';

const m = getMessages('en');

/**
 * F-A11Y-001 row AF-2 (§6 test 18): in the Culture Quiz, after a right answer, one `aria-live="polite"` region holds
 * "Right answer:" once, the answered option carries a check and its state first in its name, and no element on the page
 * is `aria-live="assertive"`. The answer announcer is the region (answer-announcer.tsx); the web has no other channel.
 *
 * The quiz moves on `RESULT_MARK_MIN_MS` (1000 ms) after a right answer, so the page's own `setTimeout` is wrapped, as
 * the axe smoke does: while `window.__answerHold` is set, a 1000 ms timer is never scheduled.
 */
test('Culture Quiz: a right answer is said once, in one polite live region, and nothing is assertive', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as Window & { __answerHold?: boolean };
    const real = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      w.__answerHold && delay === 1000 ? 0 : real(handler, delay, ...args)) as typeof window.setTimeout;
  });
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(2).click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('culture-quiz-hear')).toBeVisible();
  await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();

  // The quiz word is one of five (`minigame:s1-life-q3-apply`); its English meaning is the answer.
  const english: Record<string, string> = { 토마토: 'Tomato', 코코아: 'Cocoa', 쿠키: 'Cookie', 토스트: 'Toast', 김밥: 'Kimbap' };
  const word = await page.getByRole('heading').filter({ hasText: new RegExp(`^(${Object.keys(english).join('|')})$`) }).first().innerText();
  const answer = english[word.trim()];
  expect(answer, `the quiz word ${word} is one of the five`).toBeDefined();

  // Before any result the announcer is there and empty.
  const announcer = page.getByTestId('answer-announcer');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toHaveText('');

  await page.evaluate(() => {
    (window as Window & { __answerHold?: boolean }).__answerHold = true;
  });
  const option = page.getByTestId(`culture-quiz-option-${answer}`);
  await expect(option).toHaveAccessibleName(answer!);
  await option.click();

  await expect(option).toHaveAccessibleName(`Right answer: ${answer}`);
  const said = page.locator('[aria-live="polite"]').filter({ hasText: 'Right answer:' });
  await expect(said).toHaveCount(1);
  await expect(said).toHaveText(new RegExp(`^Right answer: .+, ${answer}\\.$`));
  expect((await said.innerText()).match(/Right answer:/g)).toHaveLength(1);
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
  // Still the answered round: the quiz has not moved on while it was read.
  await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();
});

/**
 * F-A11Y-001 row AF-3 (§6 test 13, e2e): in Card Match a wrong meaning stays marked (named "Not this one: ...", with no
 * timer to let it go) while the Korean word is still picked, Hoya's try-another bubble is not a live region, the
 * announcer says each result once in the one polite region, a right pair names both cards "Right answer: ...", and
 * nothing on the page is `aria-live="assertive"`.
 */
test('Card Match: a miss stays marked, a right pair is named with its state first, each result is said once', async ({ page }) => {
  await openPlaygroundWordsQuest(page, { largest: false });
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('card-match-ko-board')).toBeVisible();

  // The first Korean word is geune (swing) and the second mikkeureomteul (slide); a pair shares its index across the columns.
  const announcer = page.getByTestId('answer-announcer');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toHaveText('');
  const swing = page.getByTestId('card-match-en-0');
  const slide = page.getByTestId('card-match-en-1');
  await expect(swing).toHaveText('swing');
  await expect(slide).toHaveText('slide');

  await page.getByTestId('card-match-ko-0').click();
  await expect(page.getByTestId('card-match-ko-0')).toHaveAttribute('aria-selected', 'true');
  await slide.click();
  await expect(slide).toHaveAccessibleName('Not this one: English meaning slide');
  await expect(announcer).toHaveText('Not a match: geune and slide. Try another.');
  // The try-another line is on the page and is not a live region.
  await expect(page.getByText('Not a match. Try another meaning.')).toBeVisible();
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Try another meaning' })).toHaveCount(0);

  // No timer lets the mark or the pick go.
  await page.waitForTimeout(2500);
  await expect(slide).toHaveAccessibleName('Not this one: English meaning slide');
  await expect(page.getByTestId('card-match-ko-0')).toHaveAttribute('aria-selected', 'true');

  // The right meaning at once: one result line, both cards named by their state first, the marks gone.
  await swing.click();
  await expect(swing).toHaveAccessibleName('Right answer: English meaning swing');
  await expect(page.getByTestId('card-match-ko-0')).toHaveAccessibleName('Right answer: Korean word geune');
  await expect(announcer).toHaveText('Right answer: geune, swing.');
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Right answer:' })).toHaveCount(1);
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
  await expect(slide).toHaveAccessibleName('English meaning slide');
});

/**
 * F-A11Y-001 row AF-4b (§6 test 16, e2e): in Pic-Word Match a wrong word keeps its mark and its "Not this one" name with no
 * timer to let it go (it went after 600 ms), Hoya's line is not a live region, the announcer says each result once (a miss
 * by the word's romanization, a pair by its word and meaning), and nothing on the page is `aria-live="assertive"`.
 */
test('Pic-Word Match: a miss stays marked, each result is said once, the miss line is not live', async ({ page }) => {
  await openPlaygroundWordsQuest(page, { largest: false });
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('pic-word-pictures')).toBeVisible();
  await page.waitForTimeout(700);

  const ids = await page
    .locator('[data-testid^="pic-word-picture-"]')
    .evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('pic-word-picture-', '')));
  const [first, other] = [ids[0]!, ids[1]!];
  const announcer = page.getByTestId('answer-announcer');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toHaveText('');

  await page.getByTestId(`pic-word-picture-${first}`).click();
  await page.waitForTimeout(500);
  await page.getByTestId(`pic-word-word-${other}`).click();
  const missed = page.getByTestId(`pic-word-word-${other}`);
  await expect(missed).toHaveAccessibleName(/^Not this one: /);
  await expect(announcer).toHaveText(/^Not this one: [^.]+\. Try another\.$/);
  // Hoya's line is on the page and is not a live region.
  await expect(page.getByTestId('pic-word-sound')).toBeAttached();
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: m.learner.minigame.picWord.missHoya })).toHaveCount(0);

  // No timer lets the mark go.
  await page.waitForTimeout(2500);
  await expect(missed).toHaveAccessibleName(/^Not this one: /);

  // The right word: one result line, the pair numbered on both tiles.
  await page.getByTestId(`pic-word-word-${first}`).click();
  await expect(page.getByTestId(`pic-word-word-${first}`)).toHaveAccessibleName(/^Matched, number 1: /);
  await expect(announcer).toHaveText(/^Right answer: [^,]+, .+\.$/);
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Right answer:' })).toHaveCount(1);
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
});

/**
 * F-A11Y-001 follow-up F6 (owner decision 2026-11-24, option a): in Pic-Word Match at 320 x 568 with the Largest text
 * size a word card's mark (the check of a right word, the replay of a miss) sits in its own space, on the card's corner
 * disc, and never overlaps the Korean word. The two columns are about 123 dp wide there; with the mark in a column beside
 * the Korean chip it was half hidden (shots/af-4b/pic-word-320-largest-*).
 */
test("Pic-Word Match: at 320 with the largest text a word card's mark never hides behind or covers its Korean word or its number", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openPlaygroundWordsQuest(page, { largest: true });
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('pic-word-pictures')).toBeVisible();
  await page.waitForTimeout(700);

  const ids = await page
    .locator('[data-testid^="pic-word-picture-"]')
    .evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('pic-word-picture-', '')));

  /** The card's mark (its one svg), its Korean word (the Hangul text) and the card, as boxes; the mark is null when none shows. */
  const boxes = (id: string) =>
    page.getByTestId(`pic-word-word-${id}`).evaluate((card) => {
      const svg = card.querySelector('svg');
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      const korean: DOMRect[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!/[가-힯]/.test(n.textContent ?? '')) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        korean.push(range.getBoundingClientRect());
      }
      // The mark is whole when the top element at its corners and centre is the mark itself (its disc), not the chip.
      const r = svg?.getBoundingClientRect();
      const host = svg?.parentElement ?? null;
      const covered = r
        ? [[2, 2], [r.width - 2, 2], [2, r.height - 2], [r.width - 2, r.height - 2], [r.width / 2, r.height / 2]].filter(([dx, dy]) => {
            const top = document.elementFromPoint(r.left + dx!, r.top + dy!);
            // The mark's own svg, or its disc (a host with no Korean in it); never the chip or the card's row.
            return !top || !(svg!.contains(top) || (top === host && !/[가-힯]/.test(host.textContent ?? '')));
          }).length
        : 0;
      // The match number of a matched pair: a leaf in the words column whose text is a number and that sits on this card.
      const cardBox = card.getBoundingClientRect();
      const numbers = [...document.querySelectorAll('[data-testid="pic-word-words"] *')]
        .filter((e) => e.children.length === 0 && /^\d+$/.test(e.textContent ?? ''))
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.left >= cardBox.left && b.right <= cardBox.right && b.top >= cardBox.top && b.bottom <= cardBox.bottom);
      return {
        numbers: numbers.map((n) => n.toJSON()),
        covered,
        mark: svg ? svg.getBoundingClientRect().toJSON() : null,
        korean: korean.map((k) => k.toJSON()),
        card: card.getBoundingClientRect().toJSON(),
      };
    });
  type Box = { left: number; right: number; top: number; bottom: number };
  const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  /** The card's mark is on the card, whole, and clear of the Korean and of the pair's number. */
  const markClearOfKorean = async (id: string): Promise<void> => {
    const b = await boxes(id);
    expect(b.mark, `word card ${id} shows its mark`).not.toBeNull();
    expect(b.korean.length, `word card ${id} draws its Korean`).toBeGreaterThan(0);
    const mark = b.mark!;
    expect(b.covered, `word card ${id}: the mark is drawn over the card, nothing hides a part of it`).toBe(0);
    expect(mark.left, 'the mark is inside the card (left)').toBeGreaterThanOrEqual(b.card.left);
    expect(mark.right, 'the mark is inside the card (right)').toBeLessThanOrEqual(b.card.right);
    for (const n of b.numbers) expect(overlaps(mark, n), `word card ${id}: the mark ${JSON.stringify(mark)} clear of the number ${JSON.stringify(n)}`).toBe(false);
    for (const k of b.korean) {
      expect(overlaps(mark, k), `word card ${id}: the mark ${JSON.stringify(mark)} clear of the Korean ${JSON.stringify(k)}`).toBe(false);
    }
  };

  // A miss on one word (the replay mark), then every word matched in turn (the check mark): each mark whole and clear.
  await page.getByTestId(`pic-word-picture-${ids[1]!}`).click();
  await page.waitForTimeout(500);
  await page.getByTestId(`pic-word-word-${ids[0]!}`).click();
  await expect(page.getByTestId(`pic-word-word-${ids[0]!}`)).toHaveAccessibleName(/^Not this one: /);
  await shot(page, 'pic-word-320-largest-miss');
  await markClearOfKorean(ids[0]!);
  for (const [i, id] of ids.entries()) {
    await page.waitForTimeout(500);
    await page.getByTestId(`pic-word-picture-${id}`).click();
    await page.waitForTimeout(500);
    await page.getByTestId(`pic-word-word-${id}`).click();
    await expect(page.getByTestId(`pic-word-word-${id}`)).toHaveAccessibleName(new RegExp(`^Matched, number ${i + 1}: `));
    if (i === 0) await shot(page, 'pic-word-320-largest-right');
    expect((await boxes(id)).numbers, `word card ${id} shows its pair number`).toHaveLength(1);
    await markClearOfKorean(id);
  }
});
