import { describe, expect, it } from 'vitest';
import {
  bareLetterSpeech,
  isLoneLetter,
  isShownOnlyLetter,
  readShippedContent,
  spokenTextOf,
  walkKoTexts,
  type ContentFile,
} from '../../../scripts/audio/content-sources.mjs';
import { minigameScopes } from '../../logic/minigame-config';
import { stage1Quests } from '../quests';

/**
 * No shipped text makes the voice read a bare letter (AMENDMENTS-AUDIO-CLIPS section 6.2, M8). A
 * device voice reads a lone compatibility jamo by engine whim (its name on iOS, nothing or "Hangul
 * letter" elsewhere), so every taught Korean text whose spoken form (`spokenKo ?? ko`) is one letter
 * either carries the letter's name as `spokenKo` or sits where a letter is only shown
 * (`SHOWN_ONLY_LETTERS`). The walker is `scripts/audio/content-sources.mjs`, the one the clip
 * manifest (AC-2) reads; the content validator's rule lone-jamo-without-spokenKo shares its list.
 */

const shipped = readShippedContent();

describe('the content walker (scripts/audio/content-sources.mjs)', () => {
  it('reads the shipped folders, not research drafts, fixtures or overlays', () => {
    const files = shipped.map((f) => f.file);
    expect(files).toContain('content/stories/shapes-of-hangeul.json');
    expect(files).toContain('content/placement/sound-letter.json');
    expect(files).toContain('content/episodes/stage-1/jamo.json');
    expect(files.some((f) => f.startsWith('content/vocab/'))).toBe(true);
    expect(files.some((f) => f.startsWith('content/stories/research/') || f.startsWith('content/fixtures/') || f.startsWith('content/i18n/'))).toBe(false);
  });

  it('visits every object with a Korean `ko`, with its path', () => {
    const seen: string[] = [];
    walkKoTexts({ a: [{ ko: '가', b: { ko: 'ㄱ' } }], c: 'ㄴ' }, (text, path) => seen.push(`${path.join('.')}=${text.ko}`));
    expect(seen).toEqual(['a.0=가', 'a.0.b=ㄱ']);
  });

  it('a text says its spokenKo, else its ko (a blank spokenKo says nothing new)', () => {
    expect(spokenTextOf({ ko: 'ㅁ', spokenKo: '미음' })).toBe('미음');
    expect(spokenTextOf({ ko: 'ㅁ' })).toBe('ㅁ');
    expect(spokenTextOf({ ko: 'ㅁ', spokenKo: ' ' })).toBe('ㅁ');
  });

  it('a lone letter is one compatibility or conjoining jamo; a syllable or two letters is not', () => {
    for (const t of ['ㄱ', 'ㅏ', ' ㅎ ', 'ㆎ', 'ᄀ', 'ᇿ']) expect(isLoneLetter(t), t).toBe(true);
    for (const t of ['가', 'ㄱㄴ', '안', 'a', '']) expect(isLoneLetter(t), t).toBe(false);
  });

  it('the shown-only places are exactly the read-only letters, nothing that speaks', () => {
    expect(isShownOnlyLetter('content/episodes/stage-1/jamo.json', [0])).toBe(true);
    expect(isShownOnlyLetter('content/placement/sound-letter.json', ['templates', 3, 'question', 'options', 1])).toBe(true);
    expect(isShownOnlyLetter('content/placement/sound-letter.json', ['templates', 3, 'question', 'prompt'])).toBe(true);
    expect(isShownOnlyLetter('content/placement/sound-letter.json', ['templates', 3, 'question', 'spoken'])).toBe(false);
    expect(isShownOnlyLetter('content/episodes/stage-7/letters.json', ['quests', 0, 'scopes', 1, 'rounds', 0, 'soundTable', 'finals', 2])).toBe(true);
    expect(isShownOnlyLetter('content/episodes/stage-2/letters.json', ['quests', 0, 'scopes', 1, 'listenPick', 'rounds', 0, 'options', 1, 'text'])).toBe(true);
    expect(isShownOnlyLetter('content/stories/shapes-of-hangeul.json', ['keywords', 0])).toBe(false);
    expect(isShownOnlyLetter('content/stories/shapes-of-hangeul.json', ['tiers', 0, 'checks', 1, 'options', 1])).toBe(false);
    expect(isShownOnlyLetter('content/episodes/stage-2/jamo.json', [0])).toBe(false);
  });

  it('a story keyword with no spokenKo is found (the M8 case before this fix)', () => {
    const files: ContentFile[] = [{ file: 'content/stories/x.json', data: { keywords: [{ id: 'jamo-m', ko: 'ㅁ', romanization: 'm', en: 'the letter mieum' }] } }];
    expect(bareLetterSpeech(files)).toEqual([{ file: 'content/stories/x.json', path: 'keywords.0', ko: 'ㅁ' }]);
  });
});

describe('no shipped text speaks a bare letter (M8)', () => {
  it('every KoText of the shipped content JSON', () => {
    expect(bareLetterSpeech(shipped)).toEqual([]);
  });

  it('the shapes-of-hangeul story: its 17 letter keywords, targets and options say the letter name', () => {
    const story = shipped.find((f) => f.file === 'content/stories/shapes-of-hangeul.json')!;
    const letters: Array<{ ko: string; spoken: string }> = [];
    walkKoTexts(story.data, (text) => {
      if (isLoneLetter(text.ko)) letters.push({ ko: text.ko, spoken: spokenTextOf(text) });
    });
    expect(letters).toHaveLength(17);
    const NAMES: Readonly<Record<string, string>> = { ㄱ: '기역', ㄴ: '니은', ㄷ: '디귿', ㅁ: '미음', ㅅ: '시옷', ㅇ: '이응', ㅌ: '티읕', ㅏ: '아', ㅡ: '으', ㅣ: '이' };
    for (const l of letters) expect(l.spoken, l.ko).toBe(NAMES[l.ko]);
    expect((story.data as { contentVer: number }).contentVer).toBeGreaterThanOrEqual(7);
  });

  it('the app-side scopes and Stage 1 quests: every spoken KoText (Listen & Pick written options are shown only)', () => {
    const found: string[] = [];
    const walk = (label: string, value: unknown): void =>
      walkKoTexts(value, (text, path) => {
        // Listen & Pick's written options (`rounds[].options[].text`): the learner hears the prompt and picks how it is written.
        const shownOption = /(?:^|\.)rounds\.\d+\.options\.\d+\.text$/.test(path.join('.'));
        if (isLoneLetter(spokenTextOf(text)) && !shownOption) found.push(`${label}.${path.join('.')}: ${text.ko}`);
      });
    for (const [ref, scope] of Object.entries(minigameScopes)) walk(ref, scope);
    walk('stage1Quests', stage1Quests);
    expect(found).toEqual([]);
  });
});
