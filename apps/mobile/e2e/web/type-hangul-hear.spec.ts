import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-31: Dictation (Type Hangul `hear`, section 7.1 F2) and the spelling round of Letters S2 (section
 * 4.5), through the fixture bundle's `window.__hrTypeHangulE2E` hook, which opens them the way a quest step does: the
 * `game.type-hangul-hear` and `game.spelling-pick` switches are read as the step opens (remote config, built-in pct
 * 0), and the dictation chunk loads when a round plays from it. Design: design/wireframes/minigame/type-hangul.md,
 * audio-fallback.md W11, design/screens/minigame-variety/README.md D4 and mock/dictation.html.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-hear
 *
 * Every target is checked at the 48 dp floor of section 14 (the games draw them at 64). In the production build the
 * suite is skipped.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words a learner never reads here (anti-shame, CLAUDE.md §1). */
const SHAME = /\b(wrong|fail\w*|incorrect|missed|lost)\b/i;
const MIN_TARGET = 48;

type SpeechWindow = Window & { __utterances?: string[] };
interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string; hinted?: boolean }>;
  completes: number;
}
type E2eWindow = Window & {
  __hrTypeHangulE2E?: { open(params: { rounds: string[]; spelling?: string[] }): void; log(): Log };
};

/** A device with a Korean voice (the fixture's default engine has none, like CI's Chromium). */
async function koreanVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as SpeechWindow).__utterances = said;
    const voices = [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false }];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          if (u.volume !== 0) said.push(u.text);
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

/** The two switches on (pct 100) or left at their built-in pct 0 (never fetched: off). */
async function boot(page: Page, switches: 'on' | 'off'): Promise<void> {
  await page.goto('/');
  if (switches === 'on') {
    const flags = { 'game.type-hangul-hear': { on: true, pct: 100 }, 'game.spelling-pick': { on: true, pct: 100 } };
    await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
    await page.reload();
  }
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTypeHangulE2E), undefined, { timeout: 10_000 });
  // The app shell's "ready offline" toast is not part of the game; keep it out of the screenshots.
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

async function open(page: Page, params: { rounds: string[]; spelling?: string[] }): Promise<void> {
  await page.evaluate((p) => (window as E2eWindow).__hrTypeHangulE2E?.open(p), params);
}

const key = (page: Page, id: string) => page.getByTestId(`hangul-key-${id}`);
const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrTypeHangulE2E!.log());
const said = (page: Page): Promise<string[]> => page.evaluate(() => (window as SpeechWindow).__utterances ?? []);
async function typeKeys(page: Page, jamo: string): Promise<void> {
  for (const j of jamo) await key(page, j).click();
}

/** Every visible button and key: at least 48 x 48 and inside the window's width. */
async function expectTargets(page: Page, width: number): Promise<void> {
  const boxes = await page
    .locator('[role="button"]:visible, button:visible')
    .evaluateAll((els) => els.map((el) => ({ label: el.getAttribute('aria-label') ?? el.textContent ?? '', ...el.getBoundingClientRect().toJSON() }) as { label: string; width: number; height: number; left: number; right: number }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(Math.min(b.width, b.height), b.label).toBeGreaterThanOrEqual(MIN_TARGET - 0.5);
    expect(b.left, b.label).toBeGreaterThanOrEqual(-0.5);
    expect(b.right, b.label).toBeLessThanOrEqual(width + 0.5);
  }
}

test.describe('Dictation and the spelling round (F-CURR-002 CM-31)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('320 x 568, switch on, a Korean voice: hear and type; the word is hidden until Done; Show how it sounds is a hint', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await koreanVoice(page);
    await boot(page, 'on');
    await open(page, { rounds: ['hearApple', 'hearMilk'] });
    const speaker = page.getByTestId('dictation-prompt-speaker');
    await expect(speaker).toBeVisible();
    await expect(speaker).toHaveAttribute('aria-label', 'Hear the word');
    // Below 640 tall: one row of speaker, meaning button (with its link line) and Skip; no count pill.
    const meaning = page.getByTestId('dictation-prompt-meaning');
    await expect(meaning).toHaveAttribute('aria-label', 'Meaning: apple. Show how it sounds');
    await expect(page.getByText('1 / 2')).toHaveCount(0);
    await expect(page.getByTestId('type-hangul-field')).toHaveAttribute('aria-label', 'Type the word you hear');
    // The Korean and its romanization are not drawn before Done.
    await expect(page.getByText('사과')).toHaveCount(0);
    await expect(page.getByText('sagwa')).toHaveCount(0);
    await expectTargets(page, 320);
    await expectNoHorizontalOverflow(page);
    const sb = await speaker.boundingBox();
    const kb = await key(page, 'ㅅ').boundingBox();
    expect(sb!.y + sb!.height).toBeLessThanOrEqual(kb!.y);
    await shot(page, 'dictation-320-hear');

    // Round 1 waits for a tap on the speaker; then the word is said.
    expect(await said(page)).toEqual([]);
    await speaker.click();
    await expect.poll(() => said(page)).toEqual(['사과']);

    await meaning.click();
    await expect(page.getByTestId('dictation-prompt-romanization')).toHaveText('sagwa');
    await shot(page, 'dictation-320-show-sound');
    await typeKeys(page, 'ㅅㅏㄱㅗㅏ');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
    await expect(page.getByTestId('type-hangul-word')).toContainText('사과');
    await expect(page.getByTestId('type-hangul-word')).toContainText('sagwa');
    expect((await log(page)).answers).toEqual([{ key: '0', correct: true, itemId: 'e2e-hear-apple', hinted: true }]);

    // Round 2 opens heard: the word is said as it opens.
    await expect.poll(() => said(page), { timeout: 5_000 }).toEqual(['사과', '우유']);
    // A near miss: amber, the word shown with its romanization; recorded as hinted, scored as a missed round.
    await typeKeys(page, 'ㅇㅜㅇㅗ');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('Almost! Check the marked block.')).toBeVisible();
    await expect(page.getByTestId('type-hangul-result')).toContainText('uyu');
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await shot(page, 'dictation-320-near');
    expect((await log(page)).answers[1]).toEqual({ key: '1', correct: false, itemId: 'e2e-hear-milk', hinted: true });
  });

  test('768 x 1024, switch on: the hero speaker, Hear it again, the meaning and Show how it sounds', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await koreanVoice(page);
    await boot(page, 'on');
    await open(page, { rounds: ['hearApple'] });
    await expect(page.getByTestId('dictation-prompt-speaker')).toBeVisible();
    await expect(page.getByText('Meaning: apple')).toBeVisible();
    await expect(page.getByTestId('dictation-prompt-again')).toBeVisible();
    await expect(page.getByTestId('dictation-prompt-show-sound')).toBeVisible();
    await expect(page.getByText('사과')).toHaveCount(0);
    const hero = await page.getByTestId('dictation-prompt-speaker').boundingBox();
    expect(hero!.width).toBeGreaterThanOrEqual(96 - 0.5);
    await expectTargets(page, 768);
    await shot(page, 'dictation-768-hear');
  });

  test('switch on, no Korean voice: the round opens as see with the sound notice, decided before it opens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await boot(page, 'on');
    await open(page, { rounds: ['hearApple'] });
    await expect(page.getByTestId('dictation-notice')).toContainText('No sound? Read it here.');
    await expect(page.getByTestId('type-hangul-prompt')).toContainText('사과');
    await expect(page.getByTestId('dictation-prompt-speaker')).toHaveCount(0);
    await expect(page.getByTestId('type-hangul-field')).toHaveAttribute('aria-label', 'Type this word');
    await expectTargets(page, 320);
    await shot(page, 'dictation-320-no-voice');
    await typeKeys(page, 'ㅅㅏㄱㅗㅏ');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
    expect((await log(page)).answers).toEqual([{ key: '0', correct: true, itemId: 'e2e-hear-apple' }]);
  });

  test('switch off (built-in pct 0): the round is the shipped Type Hangul see round of the word, with no notice', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await koreanVoice(page);
    await boot(page, 'off');
    await open(page, { rounds: ['hearApple'] });
    await expect(page.getByTestId('type-hangul-prompt')).toContainText('사과');
    await expect(page.getByText('1 / 1')).toBeVisible();
    await expect(page.getByTestId('dictation-prompt-speaker')).toHaveCount(0);
    await expect(page.getByTestId('dictation-notice')).toHaveCount(0);
    await shot(page, 'dictation-320-switch-off');
    await typeKeys(page, 'ㅅㅏㄱㅗㅏ');
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
  });

  test('the spelling round at 320: the meaning settles it; each option is spelled by letter name for screen readers', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await koreanVoice(page);
    await boot(page, 'on');
    await open(page, { rounds: [], spelling: ['book'] });
    await expect(page.getByText('Which spelling matches this word?')).toBeVisible();
    await expect(page.getByTestId('spelling-cue-gloss')).toHaveText('book');
    await expect(page.getByTestId('listen-pick-option-a')).toHaveAttribute('aria-label', '치읓 애 기역, 이응 이. chaegi');
    await expect(page.getByTestId('listen-pick-option-b')).toHaveAttribute('aria-label', '치읓 애, 기역 이. chaegi');
    await expectTargets(page, 320);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'spelling-320');
    await page.getByTestId('listen-pick-option-b').click();
    await expect(page.getByText('Look at the meaning again.')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await shot(page, 'spelling-320-miss');
    await page.getByTestId('listen-pick-option-a').click();
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
    expect((await log(page)).answers.map((a) => a.correct)).toEqual([false, true]);
  });

  test('the spelling round with game.spelling-pick off: Listen & Pick on the same word, the look-alike left out', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await koreanVoice(page);
    await boot(page, 'off');
    await open(page, { rounds: [], spelling: ['book'] });
    await expect(page.getByText('Listen, then pick')).toBeVisible();
    await expect(page.getByTestId('listen-pick-option-b')).toHaveCount(0);
    for (const id of ['a', 'c', 'd']) await expect(page.getByTestId(`listen-pick-option-${id}`)).toBeVisible();
    await expect(page.getByTestId('spelling-cue')).toHaveCount(0);
    await shot(page, 'spelling-320-switch-off');
    await page.getByTestId('listen-pick-option-a').click();
    await expect.poll(async () => (await log(page)).completes, { timeout: 5_000 }).toBe(1);
  });
});
