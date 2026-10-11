import type { AssessmentQuestion, Overlays } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { PLACEMENT_BANK } from '../../../content/placement.generated';
import {
  KO_SPOKEN_ONLY_FORMATS,
  TWO_COLUMN_MIN_WIDTH,
  audioFallback,
  choiceColumns,
  estimatedPromptMs,
  instructionFor,
  optionViews,
  promptView,
  questionLabel,
  revealAvailable,
  shortLayout,
  type AssessmentFormat,
} from '../item-view';

const en = getMessages('en');

function question(id: string): AssessmentQuestion {
  const template = PLACEMENT_BANK.templates.find((t) => t.id === id);
  if (template === undefined) throw new Error(`no template ${id}`);
  return { id: template.id, ...template.question };
}

const SHAPE = question('pitem:recog-odd-giyeok-nieun');
const HEAR_LETTER = question('pitem:sound-basic-hear-a');
const SEE_LETTER = question('pitem:sound-basic-see-a');
const BUILD = question('pitem:syl-cv-build-ga');
const READ_WORD = question('pitem:vocab-read-gimchi');
const REPLY = question('pitem:sent-reply-1');
const HEAR_WORD = PLACEMENT_BANK.templates.find((t) => t.question.format === 'hear-pick-picture');
const HEAR_PICTURE: AssessmentQuestion = { id: HEAR_WORD?.id ?? '', ...(HEAR_WORD?.question as AssessmentQuestion) };

const ALL_FORMATS: AssessmentFormat[] = [
  'shape-odd-one-out',
  'hear-pick-written',
  'see-pick-sound',
  'build-syllable',
  'hear-pick-picture',
  'read-pick-picture',
  'reply-pick',
];

describe('instructionFor (section 3.2)', () => {
  it('writes and speaks the same line in English and Spanish', () => {
    for (const format of ALL_FORMATS) {
      const line = instructionFor(en, format, 'en');
      expect(line.visible).toBe(line.spoken);
      expect(line.spoken.length).toBeGreaterThan(0);
      expect(instructionFor(getMessages('es'), format, 'es').visible).not.toBeNull();
    }
  });

  it('T-leak: in Korean the four letter formats are spoken only; the word and sentence formats may be written', () => {
    const ko = getMessages('ko');
    expect(KO_SPOKEN_ONLY_FORMATS).toEqual(['shape-odd-one-out', 'hear-pick-written', 'see-pick-sound', 'build-syllable']);
    for (const format of ALL_FORMATS) {
      const line = instructionFor(ko, format, 'ko');
      if (KO_SPOKEN_ONLY_FORMATS.includes(format)) expect(line.visible).toBeNull();
      else expect(line.visible).toBe(line.spoken);
    }
  });

  it('T-copy: no instruction names a letter, a Korean word or an answer', () => {
    const hangul = /[ᄀ-ᇿ㄰-㆏가-힯]/;
    for (const line of Object.values(en.learner.placement.instruction)) {
      expect(line).not.toMatch(hangul);
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });
});

describe('promptView', () => {
  it('shapes have no prompt beyond the instruction', () => {
    expect(promptView(SHAPE, false)).toEqual({ kind: 'none' });
  });

  it('heard formats show a speaker with the spoken form (spokenKo wins over promptKo)', () => {
    expect(promptView(HEAR_LETTER, false)).toEqual({ kind: 'speaker', text: '아' });
    expect(promptView(BUILD, false)).toEqual({ kind: 'speaker', text: '가' });
    expect(promptView(REPLY, false)).toEqual({ kind: 'speaker', text: '안녕하세요!' });
    expect(promptView(HEAR_PICTURE, false).kind).toBe('speaker');
    expect(promptView({ ...HEAR_LETTER, audioRef: 'audio/a.mp3' }, false)).toEqual({ kind: 'speaker', text: '아', audioRef: 'audio/a.mp3' });
    expect(promptView({ ...HEAR_LETTER, spokenKo: undefined, promptKo: undefined }, false)).toEqual({ kind: 'speaker', text: '' });
  });

  it('read formats draw the Hangul; the romanization appears only once revealed', () => {
    expect(promptView(SEE_LETTER, false)).toEqual({ kind: 'written', ko: 'ㅏ', romanization: '' });
    expect(promptView(READ_WORD, true)).toEqual({ kind: 'written', ko: '김치', romanization: 'gimchi' });
    expect(promptView({ ...READ_WORD, promptRomanization: undefined }, true)).toEqual({ kind: 'written', ko: '김치', romanization: '' });
  });
});

describe('audioFallback (section 3.11)', () => {
  it('words and replies may be read; a heard letter or syllable is skipped', () => {
    expect(audioFallback('hear-pick-picture')).toBe('text');
    expect(audioFallback('reply-pick')).toBe('text');
    expect(audioFallback('hear-pick-written')).toBe('skip');
    expect(audioFallback('build-syllable')).toBe('skip');
  });
});

describe('optionViews', () => {
  const base = { revealed: false, mode: 'standard' as const, testLocale: 'en' as const, m: en };

  it('Korean options hide the romanization until revealed, and never show it in Short', () => {
    const hidden = optionViews(HEAR_LETTER, base);
    expect(hidden.map((o) => [o.kind, o.ko, o.romanization, o.label])).toEqual([
      ['korean', 'ㅏ', '', 'ㅏ'],
      ['korean', 'ㅓ', '', 'ㅓ'],
      ['korean', 'ㅑ', '', 'ㅑ'],
      ['korean', 'ㅣ', '', 'ㅣ'],
    ]);
    const shown = optionViews(HEAR_LETTER, { ...base, revealed: true });
    expect(shown[0]).toMatchObject({ romanization: 'a', label: 'ㅏ, a' });
    expect(optionViews(HEAR_LETTER, { ...base, revealed: true, mode: 'short' })[0]?.romanization).toBe('');
    const bare = optionViews({ ...HEAR_LETTER, options: HEAR_LETTER.options.map((o) => ({ ...o, romanization: undefined })) }, { ...base, revealed: true });
    expect(bare[0]?.label).toBe('ㅏ');
  });

  it('sound chips are language-neutral', () => {
    expect(optionViews(SEE_LETTER, base).map((o) => [o.kind, o.sound, o.label])).toEqual([
      ['sound', 'a', 'a'],
      ['sound', 'eo', 'eo'],
      ['sound', 'ya', 'ya'],
      ['sound', 'i', 'i'],
    ]);
    const noChip = optionViews({ ...SEE_LETTER, options: SEE_LETTER.options.map((o) => ({ ...o, sound: undefined, ko: undefined, pictureRef: undefined })) }, base);
    expect(noChip[0]?.sound).toBe('a');
  });

  it('a picture reads its meaning in the test language, never in Korean', () => {
    expect(optionViews(READ_WORD, base).map((o) => [o.kind, o.pictureRef, o.label])[0]).toEqual(['picture', 'card:kimchi', 'Kimchi']);
    const overlays: Overlays = { en: {}, es: { [READ_WORD.id]: { 'options.kimchi.gloss': 'Kimchi (es)' } }, ko: {} };
    const es = optionViews(READ_WORD, { ...base, testLocale: 'es', m: getMessages('es'), overlays });
    expect(es[0]?.label).toBe('Kimchi (es)');
    const ko = optionViews(READ_WORD, { ...base, testLocale: 'ko', m: getMessages('ko') });
    expect(ko.map((o) => o.label)).toEqual(['Picture 1', 'Picture 2', 'Picture 3', 'Picture 4']);
    const noGloss = optionViews({ ...READ_WORD, options: READ_WORD.options.map((o) => ({ ...o, en: undefined })) }, base);
    expect(noGloss[1]?.label).toBe('Picture 2');
  });

  it('uses the generated overlays by default', () => {
    expect(optionViews(READ_WORD, { ...base, testLocale: 'es', m: getMessages('es') })).toHaveLength(4);
  });
});

describe('revealAvailable (section 3.2, P19)', () => {
  const tap = { mode: 'standard' as const, revealMode: 'tap' as const };

  it('shows "Show how it sounds" on leaking items of a tap run', () => {
    expect(revealAvailable(HEAR_LETTER, tap)).toBe(true);
    expect(revealAvailable(READ_WORD, tap)).toBe(true);
    expect(revealAvailable(REPLY, { ...tap, mode: 'deep' })).toBe(true);
  });

  it('never in Short, never with the guide shown, never on an item that does not leak or has nothing to show', () => {
    expect(revealAvailable(HEAR_LETTER, { ...tap, mode: 'short' })).toBe(false);
    expect(revealAvailable(HEAR_LETTER, { ...tap, revealMode: 'always' })).toBe(false);
    expect(revealAvailable(SHAPE, tap)).toBe(false);
    expect(revealAvailable(HEAR_PICTURE, tap)).toBe(false);
    const nothing = { ...HEAR_LETTER, promptRomanization: undefined, options: HEAR_LETTER.options.map((o) => ({ ...o, romanization: undefined })) };
    expect(revealAvailable(nothing, tap)).toBe(false);
  });
});

describe('questionLabel, estimatedPromptMs, layouts', () => {
  it('announces the number of choices', () => {
    expect(questionLabel(en, HEAR_LETTER)).toBe('Question, 4 choices');
    expect(questionLabel(en, REPLY)).toBe('Question, 3 choices');
  });

  it('estimates a prompt from its length, ignoring spaces', () => {
    expect(estimatedPromptMs('아')).toBe(950);
    expect(estimatedPromptMs('한복을 입어요')).toBe(600 + 6 * 350);
  });

  it('Short: portrait 2 x 2, landscape two columns, scrolling only at a larger text size in landscape', () => {
    expect(shortLayout({ width: 320, height: 568 }, 2)).toBe('portrait');
    expect(shortLayout({ width: 568, height: 320 }, 1)).toBe('landscape');
    expect(shortLayout({ width: 568, height: 320 }, 1.5)).toBe('landscape-scroll');
  });

  it('Standard and Deep stack on narrow content or large text; Short keeps two columns', () => {
    expect(choiceColumns({ mode: 'short', contentWidth: 200, fontScale: 2 })).toBe(2);
    expect(choiceColumns({ mode: 'standard', contentWidth: TWO_COLUMN_MIN_WIDTH, fontScale: 1 })).toBe(2);
    expect(choiceColumns({ mode: 'deep', contentWidth: TWO_COLUMN_MIN_WIDTH - 1, fontScale: 1 })).toBe(1);
    expect(choiceColumns({ mode: 'standard', contentWidth: 600, fontScale: 1.5 })).toBe(1);
  });
});
