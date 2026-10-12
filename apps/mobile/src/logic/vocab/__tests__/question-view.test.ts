import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { VocabQuestion } from '../question-builder';
import { startQuestionFlow, stepQuestionFlow, type QuestionFlowMode, type QuestionFlowState } from '../question-flow';
import {
  NARROW_WORD_COLUMN,
  QUESTION_AUDIO_SOURCE,
  announcement,
  optionColumns,
  optionView,
  promptView,
  speechFor,
  type QuestionViewContext,
} from '../question-view';

const m = getMessages('en');
const A11Y = m.a11y.minigame;
const SAY = m.a11y.vocab.question;

const GLOSSES: Record<string, string> = { 'vocab:sagwa': 'apple', 'vocab:bae': 'pear', 'vocab:podo': 'grapes', 'vocab:ttalgi': 'strawberry' };
const ctx = (over: Partial<QuestionViewContext> = {}): QuestionViewContext => ({
  mode: 'speed',
  romanizationShown: true,
  canPlay: true,
  glossOf: (id) => GLOSSES[id],
  topicTitle: (key) => (key === 'food' ? 'Food' : undefined),
  ...over,
});

const IDS = ['vocab:bae', 'vocab:sagwa', 'vocab:ttalgi', 'vocab:podo'] as const;
const ROMAN: Record<string, string> = { 'vocab:bae': 'bae', 'vocab:sagwa': 'sagwa', 'vocab:ttalgi': 'ttalgi', 'vocab:podo': 'podo' };
const KO: Record<string, string> = { 'vocab:bae': '배', 'vocab:sagwa': '사과', 'vocab:ttalgi': '딸기', 'vocab:podo': '포도' };

const WORD: VocabQuestion = {
  key: 'q0:vocab:sagwa:word-to-image',
  itemId: 'vocab:sagwa',
  format: 'word-to-image',
  prompt: { kind: 'word', ko: '사과', romanization: 'sagwa', spokenKo: '사과', audioRef: 'audio/vocab/sagwa.mp3' },
  options: IDS.map((id) => ({ id, pictureRef: `word:${id}`, labelEn: `${GLOSSES[id]}-en` })),
  answerId: 'vocab:sagwa',
};
const AUDIO: VocabQuestion = { ...WORD, key: 'q1:vocab:sagwa:audio-to-image', format: 'audio-to-image', prompt: { ...WORD.prompt, kind: 'audio' } };
const IMAGE: VocabQuestion = {
  key: 'q2:vocab:sagwa:image-to-word',
  itemId: 'vocab:sagwa',
  format: 'image-to-word',
  prompt: { kind: 'image', pictureRef: 'word:food-apple' },
  options: IDS.map((id) => ({ id, text: { ko: KO[id]!, romanization: ROMAN[id]!, en: `${GLOSSES[id]}-en` } })),
  answerId: 'vocab:sagwa',
};

function after(q: VocabQuestion, mode: QuestionFlowMode, taps: readonly string[], audioFailed = false): QuestionFlowState {
  let s = startQuestionFlow();
  if (audioFailed) s = stepQuestionFlow(s, { type: 'audio-failed' }, q, mode).state;
  taps.forEach((id, i) => {
    s = stepQuestionFlow(s, { type: 'tap', optionId: id, at: 1_000 * (i + 1) }, q, mode).state;
  });
  return s;
}

describe('promptView: word to picture (wireframe B)', () => {
  it('shows the Korean with the romanization and a small speaker while asking; no meaning yet', () => {
    expect(promptView(WORD, startQuestionFlow(), ctx())).toEqual({
      kind: 'word',
      word: { ko: '사과', romanization: 'sagwa', romanizationShown: true, gloss: undefined },
      picture: null,
      speaker: 'small',
      readHere: false,
      topicChip: null,
    });
  });

  it('follows the romanization setting while asking, and shows it with the meaning once the question is over', () => {
    const hidden = ctx({ romanizationShown: false });
    expect(promptView(WORD, startQuestionFlow(), hidden).word).toEqual({ ko: '사과', romanization: 'sagwa', romanizationShown: false, gloss: undefined });
    expect(promptView(WORD, after(WORD, 'speed', ['vocab:bae']), hidden).word).toEqual({
      ko: '사과',
      romanization: 'sagwa',
      romanizationShown: true,
      gloss: 'apple',
    });
  });

  it('a prompt word with no romanization shows the Korean alone', () => {
    const bare: VocabQuestion = { ...WORD, prompt: { kind: 'word', ko: '사과' } };
    expect(promptView(bare, startQuestionFlow(), ctx()).word).toEqual({ ko: '사과', romanization: '', romanizationShown: true, gloss: undefined });
  });

  it('has no speaker when no voice can play', () => {
    expect(promptView(WORD, startQuestionFlow(), ctx({ canPlay: false })).speaker).toBeNull();
  });
});

describe('promptView: sound to picture (wireframe D)', () => {
  it('shows only the large speaker while asking', () => {
    const view = promptView(AUDIO, startQuestionFlow(), ctx());
    expect(view).toMatchObject({ kind: 'audio', word: null, picture: null, speaker: 'large', readHere: false });
  });

  it('after the voice failed: the Korean and romanization, no meaning, with "No sound? Read it here."', () => {
    const view = promptView(AUDIO, after(AUDIO, 'speed', [], true), ctx({ romanizationShown: false }));
    expect(view.readHere).toBe(true);
    expect(view.word).toEqual({ ko: '사과', romanization: 'sagwa', romanizationShown: true, gloss: undefined });
    expect(view.speaker).toBe('large');
  });

  it('once over: the answer word with its meaning, with or without the failed voice', () => {
    expect(promptView(AUDIO, after(AUDIO, 'speed', ['vocab:sagwa']), ctx()).word).toEqual({
      ko: '사과',
      romanization: 'sagwa',
      romanizationShown: true,
      gloss: 'apple',
    });
    expect(promptView(AUDIO, after(AUDIO, 'speed', ['vocab:podo'], true), ctx())).toMatchObject({ readHere: true, word: { gloss: 'apple' } });
  });
});

describe('promptView: picture to word (wireframe C)', () => {
  it('shows the picture named by its meaning, no speaker and no word while asking', () => {
    expect(promptView(IMAGE, startQuestionFlow(), ctx())).toEqual({
      kind: 'image',
      word: null,
      picture: { ref: 'word:food-apple', gloss: 'apple' },
      speaker: null,
      readHere: false,
      topicChip: null,
    });
  });

  it('once over: the answer word under the picture, from the answer option', () => {
    expect(promptView(IMAGE, after(IMAGE, 'speed', ['vocab:sagwa']), ctx({ romanizationShown: false })).word).toEqual({
      ko: '사과',
      romanization: 'sagwa',
      romanizationShown: true,
      gloss: 'apple',
    });
  });

  it('a picture whose word has no localised meaning falls back to the English one; a broken question shows no word', () => {
    const noGloss = ctx({ glossOf: () => undefined });
    expect(promptView(IMAGE, after(IMAGE, 'speed', ['vocab:sagwa']), noGloss).word?.gloss).toBe('apple-en');
    expect(promptView(IMAGE, startQuestionFlow(), noGloss).picture).toEqual({ ref: 'word:food-apple', gloss: 'apple-en' });
    const broken: VocabQuestion = { ...IMAGE, prompt: { kind: 'image' }, options: IMAGE.options.filter((o) => o.id !== 'vocab:sagwa') };
    const view = promptView(broken, after(broken, 'speed', ['vocab:bae']), noGloss);
    expect(view.word).toBeNull();
    expect(view.picture).toEqual({ ref: '', gloss: '' });
  });
});

describe('promptView: the topic chip (homonym in a mixed pool)', () => {
  it('names the answer topic only when the question carries a chip and the topic is known', () => {
    expect(promptView({ ...WORD, topicChip: 'food' }, startQuestionFlow(), ctx()).topicChip).toBe('Food');
    expect(promptView({ ...WORD, topicChip: 'unknown' }, startQuestionFlow(), ctx()).topicChip).toBeNull();
  });
});

describe('optionView: pictures', () => {
  it('a waiting picture option has no written label (it would give the answer away) and is named by its meaning', () => {
    const v = optionView(WORD, WORD.options[0]!, startQuestionFlow(), ctx(), false, A11Y);
    expect(v).toEqual({ id: 'vocab:bae', cardState: 'idle', ko: undefined, romanization: '', pictureRef: 'word:vocab:bae', gloss: 'pear', accessibilityLabel: 'pear' });
  });

  it('a speed miss: the tapped one is the amber nudge, the right one is marked, the rest are dimmed, each named with its state', () => {
    const s = after(WORD, 'speed', ['vocab:bae']);
    const views = WORD.options.map((o) => optionView(WORD, o, s, ctx(), false, A11Y));
    expect(views.map((v) => v.cardState)).toEqual(['wrong', 'correct', 'disabled', 'disabled']);
    expect(views.map((v) => v.accessibilityLabel)).toEqual(['Not this one: pear', 'Right answer: apple', 'strawberry', 'grapes']);
  });

  it('the session hint ring marks the right option ("Look here")', () => {
    const v = optionView(WORD, WORD.options[1]!, startQuestionFlow(), ctx(), true, A11Y);
    expect(v).toMatchObject({ cardState: 'hint', accessibilityLabel: 'Look here: apple' });
  });

  it('check mode rings the answer after two misses', () => {
    const s = after(WORD, 'check', ['vocab:bae', 'vocab:podo']);
    expect(optionView(WORD, WORD.options[1]!, s, ctx({ mode: 'check' }), false, A11Y).cardState).toBe('hint');
    expect(optionView(WORD, WORD.options[2]!, s, ctx({ mode: 'check' }), false, A11Y).cardState).toBe('idle');
  });

  it('a picture with no meaning anywhere is named "Picture"', () => {
    const v = optionView(WORD, { id: 'vocab:x', pictureRef: 'word:x' }, startQuestionFlow(), ctx({ glossOf: () => undefined }), false, A11Y);
    expect(v.gloss).toBe('Picture');
    expect(v.accessibilityLabel).toBe('Picture');
    const en = optionView(WORD, WORD.options[0]!, startQuestionFlow(), ctx({ glossOf: () => undefined }), false, A11Y);
    expect(en.gloss).toBe('pear-en');
  });
});

describe('optionView: words', () => {
  it('a word option is named "ko, romanization" and shows the romanization by default', () => {
    const v = optionView(IMAGE, IMAGE.options[0]!, startQuestionFlow(), ctx(), false, A11Y);
    expect(v).toEqual({ id: 'vocab:bae', cardState: 'idle', ko: '배', romanization: 'bae', pictureRef: undefined, gloss: 'pear', accessibilityLabel: '배, bae' });
  });

  it('with romanization hidden, an untouched word shows none until it is answered', () => {
    const hidden = ctx({ romanizationShown: false });
    expect(optionView(IMAGE, IMAGE.options[0]!, startQuestionFlow(), hidden, false, A11Y)).toMatchObject({ romanization: '', accessibilityLabel: '배' });
    const s = after(IMAGE, 'speed', ['vocab:bae']);
    expect(optionView(IMAGE, IMAGE.options[0]!, s, hidden, false, A11Y)).toMatchObject({ cardState: 'wrong', romanization: 'bae', accessibilityLabel: 'Not this one: 배, bae' });
    expect(optionView(IMAGE, IMAGE.options[1]!, s, hidden, false, A11Y)).toMatchObject({ cardState: 'correct', romanization: 'sagwa' });
    expect(optionView(IMAGE, IMAGE.options[2]!, s, hidden, false, A11Y)).toMatchObject({ cardState: 'disabled', romanization: '' });
  });

  it('a word the catalogue has no meaning for is named by the English one the question carries', () => {
    const v = optionView(IMAGE, IMAGE.options[0]!, startQuestionFlow(), ctx({ glossOf: () => undefined }), false, A11Y);
    expect(v.gloss).toBe('pear-en');
  });

  it('an option with no word is drawn as a picture tile (PictureArt shows its meaning when the ref is missing), never as an id', () => {
    const v = optionView(IMAGE, { id: 'vocab:sagwa' }, startQuestionFlow(), ctx(), false, A11Y);
    expect(v).toMatchObject({ ko: undefined, pictureRef: undefined, gloss: 'apple', accessibilityLabel: 'apple' });
  });
});

describe('optionColumns (F-VOC-004 §3.6)', () => {
  const sizes = { minPictureCard: 170, gap: 12 };
  const three = { ...WORD, options: WORD.options.slice(0, 3) };

  it('four pictures: 2 x 2 when two cards fit, else one column', () => {
    expect(optionColumns(WORD, 361, sizes)).toBe(2);
    expect(optionColumns(WORD, 288, sizes)).toBe(1);
  });

  it('three pictures: three across when three fit, else one column', () => {
    expect(optionColumns(three, 600, sizes)).toBe(3);
    expect(optionColumns(three, 361, sizes)).toBe(1);
  });

  it('four words: 2 x 2 from 340 dp, one column under it', () => {
    expect(NARROW_WORD_COLUMN).toBe(340);
    expect(optionColumns(IMAGE, 340, sizes)).toBe(2);
    expect(optionColumns(IMAGE, 339, sizes)).toBe(1);
  });

  it('an unknown width is one column', () => {
    expect(optionColumns(WORD, 0, sizes)).toBe(1);
    expect(optionColumns(IMAGE, Number.NaN, sizes)).toBe(1);
  });
});

describe('announcement: the outcome in words (F-VOC-004 §3.8)', () => {
  it('nothing while asking', () => {
    expect(announcement(WORD, startQuestionFlow(), ctx(), SAY)).toBeNull();
  });

  it('a right first tap: "Right. apple."', () => {
    expect(announcement(WORD, after(WORD, 'speed', ['vocab:sagwa']), ctx(), SAY)).toBe('Right. apple.');
  });

  it('a speed miss: "Not this one. The answer is apple."', () => {
    expect(announcement(WORD, after(WORD, 'speed', ['vocab:bae']), ctx(), SAY)).toBe('Not this one. The answer is apple.');
  });

  it('check mode: "Try another" after a miss, then "Right" on the right tap', () => {
    const check = ctx({ mode: 'check' });
    expect(announcement(WORD, after(WORD, 'check', ['vocab:bae'], false), check, SAY)).toBe('Not this one. Try another.');
    expect(announcement(WORD, after(WORD, 'check', ['vocab:bae', 'vocab:sagwa']), check, SAY)).toBe('Right. apple.');
  });

  it('a question with no meaning anywhere names the Korean word instead', () => {
    const noGloss = ctx({ glossOf: () => undefined });
    const bare: VocabQuestion = { ...WORD, options: WORD.options.map(({ id, pictureRef }) => ({ id, pictureRef })) };
    expect(announcement(bare, after(bare, 'speed', ['vocab:sagwa']), noGloss, SAY)).toBe('Right. 사과.');
    const broken: VocabQuestion = { ...IMAGE, prompt: { kind: 'image' }, options: IMAGE.options.filter((o) => o.id !== 'vocab:sagwa') };
    expect(announcement(broken, after(broken, 'speed', ['vocab:bae']), noGloss, SAY)).toBe('Not this one. The answer is .');
  });

  it('never uses failure words, a number of misses, a percentage or a fraction', () => {
    const lines = [SAY.right('apple'), SAY.reveal('apple'), SAY.tryAnother, SAY.speaker, SAY.topic('Food')];
    for (const line of lines) {
      expect(line).not.toMatch(/\b(wrong|fail\w*|miss\w*|lost|lose)\b|\d+\s*%|\d+\s*\/\s*\d+/i);
    }
  });
});

describe('speechFor: what the reveal speaks', () => {
  it('prefers the catalogue item (its spoken form and clip)', () => {
    expect(speechFor(IMAGE, { ko: '사과', spokenKo: '사과요', audioRef: 'audio/vocab/sagwa.mp3' })).toEqual({ text: '사과요', audioRef: 'audio/vocab/sagwa.mp3' });
    expect(speechFor(IMAGE, { ko: '사과' })).toEqual({ text: '사과' });
  });

  it('falls back to the prompt, then to the answer option', () => {
    expect(speechFor(WORD, undefined)).toEqual({ text: '사과', audioRef: 'audio/vocab/sagwa.mp3' });
    expect(speechFor({ ...WORD, prompt: { kind: 'word', ko: '사과' } }, undefined)).toEqual({ text: '사과' });
    expect(speechFor(IMAGE, undefined)).toEqual({ text: '사과' });
    expect(speechFor({ ...IMAGE, options: [] }, undefined)).toBeNull();
  });

  it('names the telemetry source per mode', () => {
    expect(QUESTION_AUDIO_SOURCE).toEqual({ speed: 'vocab-speed', check: 'vocab-card' });
  });
});
