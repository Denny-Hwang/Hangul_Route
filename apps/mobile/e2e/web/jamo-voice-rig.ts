import type { Locator, Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect } from './fixtures';
import { onboardChild, openLettersEpisode } from './helpers';

/**
 * AMENDMENTS-AUDIO-CLIPS JV-4: what `jamo-voice.spec.ts` (the device voice, release build) and
 * `jamo-voice-audio.spec.ts` (the fixture clips) share: the section 5 table of what a letter question
 * says, the JV-A1 invariant, a stand-in speech engine that records every utterance (the pattern of
 * `audio.spec.ts`, `learner-audio.spec.ts` and `test-support/audio-rig.ts`), and the way to Quest 1's
 * Discover. Not a spec file: a spec file may not import another.
 */

export const en = getMessages('en');

/**
 * The Stage 1 letters and what a letter question says for each (section 5 of the amendment, pinned
 * by `jamo-voice.test.ts`): a consonant's name, a vowel's sound (its name), and 이응 for ㅇ.
 */
export const NAME: Readonly<Record<string, string>> = {
  ㄱ: '기역',
  ㄴ: '니은',
  ㄷ: '디귿',
  ㄹ: '리을',
  ㅁ: '미음',
  ㅂ: '비읍',
  ㅅ: '시옷',
  ㅇ: '이응',
  ㅈ: '지읒',
  ㅊ: '치읓',
  ㅋ: '키읔',
  ㅌ: '티읕',
  ㅍ: '피읖',
  ㅎ: '히읗',
  ㅏ: '아',
  ㅑ: '야',
  ㅓ: '어',
  ㅕ: '여',
  ㅗ: '오',
  ㅛ: '요',
  ㅜ: '우',
  ㅠ: '유',
  ㅡ: '으',
  ㅣ: '이',
};
/** The letter a name says (니은 is ㄴ). */
export const LETTER_OF: ReadonlyMap<string, string> = new Map(Object.entries(NAME).map(([letter, name]) => [name, letter]));
/** The six Stage 1 finals and the closed syllable a sound question says for each (악 for the final ㄱ). */
export const FINAL_SYLLABLE: Readonly<Record<string, string>> = { ㄱ: '악', ㄴ: '안', ㄹ: '알', ㅁ: '암', ㅂ: '압', ㅇ: '앙' };
export const FINAL_SYLLABLES: ReadonlySet<string> = new Set(Object.values(FINAL_SYLLABLE));

/** A compatibility (U+3131-318E) or conjoining (U+1100-11FF) jamo: never spoken (JV-A1, JV-A2's runtime guard). */
export const JAMO = /[ㄱ-ㆎᄀ-ᇿ]/u;
/** A lone jamo, as the speech engine would be handed it. */
export const LONE_JAMO = /^\s*[ㄱ-ㆎᄀ-ᇿ]\s*$/u;

export interface Said {
  text: string;
  lang: string;
}
export type VoiceWindow = Window & { __said?: Said[]; __clips?: string[] };

/**
 * A device with one ko-KR voice that ends each line at once and keeps what it was asked to say. The silent
 * unlock utterance of the first gesture (volume 0) is not a prompt and is not kept.
 */
export async function captureSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const said: Said[] = [];
    (window as VoiceWindow).__said = said;
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: { name: string } | null = null;
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
          if (u.volume !== 0) said.push({ text: u.text, lang: u.lang });
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => [
          { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false },
          { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: true },
        ],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

export const said = (page: Page): Promise<Said[]> => page.evaluate(() => [...((window as VoiceWindow).__said ?? [])]);
export const saidCount = async (page: Page): Promise<number> => (await said(page)).length;

/** Waits for the next utterance after `before` and returns its text. */
export async function nextSaid(page: Page, before: number): Promise<string> {
  await expect.poll(() => saidCount(page)).toBeGreaterThan(before);
  return (await said(page)).at(-1)!.text;
}

/** The invariant over a whole run: every utterance is Korean in ko-KR, and none is (or holds) a jamo. */
export async function expectNoLoneJamo(page: Page): Promise<void> {
  const all = await said(page);
  expect(all.length).toBeGreaterThan(0);
  for (const u of all) {
    expect(u.text, `"${u.text}" is a lone jamo`).not.toMatch(LONE_JAMO);
    expect(u.text, `"${u.text}" holds a jamo`).not.toMatch(JAMO);
    expect(u.lang).toBe('ko-KR');
  }
}

/** Screens under the top one stay in the page (hidden): every lookup takes the visible one. */
export const shown = (page: Page, testId: string): Locator => page.getByTestId(testId).filter({ visible: true });
/** Match Sound's round pill ("3 / 6") on the screen in front. */
export const roundPill = (page: Page, round: number): Locator => page.getByText(`${round} / 6`, { exact: true }).filter({ visible: true });

/** A new learner at Stage 1 / Letters / Quest 1's Discover step (the episode's first Start). */
export async function openQuestOneDiscover(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await openLettersEpisode(page);
  await page.getByTestId('episode-quest-quest:stage1-letters-q1').getByRole('button', { name: en.learner.episode.quests.start.cta, exact: true }).click();
  await page.getByRole('button', { name: en.learner.quest.continue.cta }).click();
  await expect(page.getByText(en.learner.quest.step.discover.pill, { exact: true })).toBeVisible();
}

/** Discover's two buttons for one letter (`jamo:nieun`): Hear it, and Hear it with a vowel. */
export const hearIt = (page: Page, jamoId: string): Locator => shown(page, `discover-hear-${jamoId}|sound`);
export const hearWithVowel = (page: Page, jamoId: string): Locator => shown(page, `discover-hear-${jamoId}|vowel`);

/** Continue to the next Discover page, the one that shows `jamoId`. */
export async function discoverPageOf(page: Page, jamoId: string): Promise<void> {
  for (let i = 0; i < 6 && (await hearIt(page, jamoId).count()) === 0; i += 1) {
    await page.getByRole('button', { name: en.learner.quest.discover.continue.cta }).click();
  }
  await expect(hearIt(page, jamoId)).toBeVisible();
}

/** Taps Hear it on a Discover letter and returns what was said. */
export async function hear(page: Page, button: Locator): Promise<string> {
  const before = await saidCount(page);
  await button.click();
  return nextSaid(page, before);
}

/** The fixture runs play clips for some letters, so they may say little aloud; whatever they say keeps the invariant. */
export async function expectNoJamoSaid(page: Page): Promise<void> {
  for (const u of await said(page)) {
    expect(u.text).not.toMatch(LONE_JAMO);
    expect(u.text).not.toMatch(JAMO);
  }
}
