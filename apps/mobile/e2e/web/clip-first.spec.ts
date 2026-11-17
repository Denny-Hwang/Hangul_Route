import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openPlaygroundWordsQuest } from './helpers';

/**
 * [FU] AMENDMENTS-FOLLOWUPS-2026-11 FU-3: every Korean sound plays the recording when one exists (F-AUDIO-004 AD4:
 * clip, then the device voice, then text). Pic-Word Match, the Practice of the first Stage 2 Play & Crafts quest, says
 * each word as its pair is made. Its prompt slot was never told about clips, so on a device with no Korean voice the
 * word's recording (its say clip, the stage2 pack) played and the panel still said "No Korean voice on this device."
 * With a Korean voice on the device the recording still wins: the voice never says the word.
 *
 * Release build (the Stage 2 quest and its real clips); clips on, as audio.spec.ts's clip specs do.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const NO_VOICE = 'No Korean voice on this device.';
/** Past the board's 400 ms tap lock, with room for a busy machine. */
const AFTER_LOCK = 700;

type ClipWindow = Window & { __clipStarts?: number[]; __said?: Array<{ text: string; lang: string }> };

/** Records every Web Audio buffer that starts (its duration), as audio.spec.ts does: a clip is longer than 0.1 s. */
async function recordClipStarts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const starts: number[] = [];
    (window as ClipWindow).__clipStarts = starts;
    const proto = window.AudioBufferSourceNode?.prototype;
    if (!proto) return;
    const start = proto.start;
    proto.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
      starts.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
  });
}

const clipStarts = async (page: Page): Promise<number> =>
  (await page.evaluate(() => (window as ClipWindow).__clipStarts ?? [])).filter((d) => d > 0.1).length;

/** A device with a ko-KR voice that ends each line at once and keeps what it was asked to say (not the silent unlock). */
async function koreanVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const said: Array<{ text: string; lang: string }> = [];
    (window as ClipWindow).__said = said;
    const v = (name: string, lang: string, isDefault = false) => ({ name, lang, voiceURI: name, localService: true, default: isDefault });
    const voices = [v('Yuna', 'ko-KR'), v('Samantha', 'en-US', true)];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: { name: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak: (u: Utterance) => {
        if (u.volume !== 0) said.push({ text: u.text, lang: u.lang });
        setTimeout(() => {
          u.onstart?.();
          u.onend?.();
        }, 0);
      },
      cancel: () => undefined,
      resume: () => undefined,
      getVoices: () => voices,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  });
}

/** Makes the first pair of the board (its picture, then its word) and returns the word's Korean. */
async function makeFirstPair(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('pic-word-pictures')).toBeVisible();
  await page.waitForTimeout(AFTER_LOCK);
  const picture = page.locator('[data-testid^="pic-word-picture-"][role="button"]').first();
  const id = ((await picture.getAttribute('data-testid')) ?? '').replace('pic-word-picture-', '');
  expect(id).not.toBe('');
  const word = page.locator(`[data-testid="pic-word-word-${id}"][role="button"]`);
  await picture.click();
  await word.click();
  return ((await word.getAttribute('aria-label')) ?? '').split(',')[0]!.trim();
}

test.describe('[FU] FU-3: a word is said from its recording first (Pic-Word Match)', () => {
  test.skip(FIXTURE_BUILD, 'the release build: the Stage 2 quest and its clips');
  test.use({ clipsOn: true });

  test('no Korean voice on the device: the recording plays and the panel does not say there is no voice', async ({ page }) => {
    test.setTimeout(120_000);
    await recordClipStarts(page);
    await openPlaygroundWordsQuest(page, { largest: false });
    await makeFirstPair(page);
    await expect.poll(() => clipStarts(page), { message: 'the word\'s recording starts', timeout: 10_000 }).toBeGreaterThan(0);
    // The slot has had the play's result: a wrong "no voice" line would be up by now.
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('pic-word-sound').getByText(NO_VOICE).filter({ visible: true })).toHaveCount(0);
    // No Korean was handed to the device voice (it has none; the blank unlock utterance is not a prompt).
    expect((await page.evaluate(() => (window as Window & { __silentSpeech?: string[] }).__silentSpeech ?? [])).filter((t) => /[\uAC00-\uD7A3]/.test(t))).toEqual([]);
  });

  test('a Korean voice on the device: the recording still wins, and the voice never says the word', async ({ page }) => {
    test.setTimeout(120_000);
    await koreanVoice(page);
    await recordClipStarts(page);
    await openPlaygroundWordsQuest(page, { largest: false });
    const before = (await page.evaluate(() => (window as ClipWindow).__said ?? [])).length;
    await makeFirstPair(page);
    await expect.poll(() => clipStarts(page), { message: 'the word\'s recording starts', timeout: 10_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1_000);
    const said = (await page.evaluate(() => (window as ClipWindow).__said ?? [])).slice(before).filter((u) => u.lang === 'ko-KR');
    expect(said).toEqual([]);
  });
});
