import { getMessages } from '@hangul-route/i18n';
import type { StoryCheck } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { storiesAll } from '../../../content/stories';
import { localizeStory } from '../../content-locale';
import {
  EMPTY_CHECK_TALLY,
  STORY_CHECK_AUDIO_SOURCE,
  checkAnsweredPayload,
  checkBubble,
  checkFinishedPayload,
  checkGameItems,
  checkHasKorean,
  checkOptionColumns,
  checkProgress,
  checkSpeech,
  optionCardState,
  optionCardView,
  revealNeeded,
  speechLangOf,
  tallyResolved,
  targetView,
  uiSpeechLang,
} from '../check-game';
import { HIGHLIGHT_AFTER_WRONG, initCheckState, type CheckState } from '../check-player';
import { buildCheckView, type CheckView } from '../check-view';
import { readyStory } from './story-fixture';

const copy = getMessages('en').learner.story.check;

const answering = (over: Partial<CheckState> = {}): CheckState => ({ index: 0, phase: 'answering', wrong: [], taps: 0, ...over });
const explained = (over: Partial<CheckState> = {}): CheckState => ({ index: 0, phase: 'explained', wrong: [], taps: 1, ...over });

const textCheck: StoryCheck = {
  id: 'q1',
  kind: 'detail',
  promptEn: 'Why was it made?',
  options: [
    { id: 'a', en: 'So people could read', isCorrect: true },
    { id: 'b', en: 'To hide letters', isCorrect: false },
    { id: 'c', en: 'For fun', isCorrect: false },
  ],
  explainEn: 'It was made so people could read.',
  hintEn: 'Think of the king.',
  factIds: ['f1'],
  shuffle: false,
};

const target = { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' };

const meaningCheck: StoryCheck = {
  id: 'q2',
  kind: 'pick-meaning',
  promptEn: 'What does {target} mean?',
  target,
  options: [
    { id: 'a', en: 'Hangul Day', isCorrect: true },
    { id: 'b', en: 'New Year', isCorrect: false },
  ],
  factIds: ['f1'],
  shuffle: false,
};

const koreanOptionCheck: StoryCheck = {
  id: 'q3',
  kind: 'who',
  promptEn: 'Which letter is a vowel?',
  options: [
    { id: 'a', ko: 'ㅏ', romanization: 'a', en: 'the vowel a', isCorrect: true },
    { id: 'b', ko: 'ㄱ', romanization: 'g', en: 'the consonant g', isCorrect: false },
  ],
  factIds: ['f1'],
  shuffle: false,
};

const pictureCheck: StoryCheck = {
  id: 'q4',
  kind: 'pick-picture',
  promptEn: 'Which one is the book?',
  options: [
    { id: 'a', en: 'A book', art: 'card:book', isCorrect: true },
    { id: 'b', en: 'A brush', art: 'card:brush', isCorrect: false },
  ],
  factIds: ['f1'],
};

const view = (c: StoryCheck): CheckView => buildCheckView(c, 'story:t');

describe('checkGameItems (F-STORY-003 §3.4)', () => {
  const story = readyStory();

  it('builds every check of the tier, in authored order, as display views', () => {
    const items = checkGameItems(story, 'listen');
    const tier = story.tiers.find((t) => t.level === 'listen');
    expect(items.map((i) => i.checkId)).toEqual(tier?.checks.map((c) => c.id));
    expect(items[0]).toEqual(buildCheckView(tier!.checks[0]!, story.id));
  });

  it('follows a checkIds subset and order override, skipping unknown ids', () => {
    expect(checkGameItems(story, 'listen', ['c3', 'nope', 'c1']).map((i) => i.checkId)).toEqual(['c3', 'c1']);
  });

  it('is empty without a story, for a level the story lacks, or for an override that matches nothing', () => {
    expect(checkGameItems(undefined, 'listen')).toEqual([]);
    expect(checkGameItems(story, 'read')).toEqual([]);
    expect(checkGameItems(story, 'listen', ['nope'])).toEqual([]);
  });

  it('every bundled story tier yields at least three items', () => {
    for (const s of storiesAll) {
      for (const t of s.tiers) expect(checkGameItems(s, t.level).length, `${s.id} ${t.level}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('speech languages', () => {
  it('maps every UI locale to its speech language', () => {
    expect(uiSpeechLang('en')).toBe('en-US');
    expect(uiSpeechLang('es')).toBe('es-US');
    expect(uiSpeechLang('ko')).toBe('ko-KR');
  });

  it('speaks a string in the UI voice only when an overlay replaced the English source', () => {
    expect(speechLangOf('¿Por qué?', 'Why?', 'es-US')).toBe('es-US');
    expect(speechLangOf('Why?', 'Why?', 'es-US')).toBe('en-US');
    expect(speechLangOf('Why?', undefined, 'es-US')).toBe('en-US');
  });
});

describe('checkSpeech', () => {
  it('reads a text prompt, then each option in display order, in English', () => {
    const item = view(textCheck);
    const speech = checkSpeech(item, item, 'en-US');
    expect(speech.question).toEqual([
      { text: 'Why was it made?', language: 'en-US', kind: 'sentence', source: STORY_CHECK_AUDIO_SOURCE },
    ]);
    expect(speech.options.map((s) => s.text)).toEqual(['So people could read', 'To hide letters', 'For fun']);
    expect(speech.options.every((s) => s.language === 'en-US' && s.kind === 'sentence')).toBe(true);
    expect(speech.target).toBeNull();
  });

  it('says an inline target in Korean between the English parts, and on its own speaker', () => {
    const item = view(meaningCheck);
    const speech = checkSpeech(item, item, 'en-US');
    expect(speech.question).toEqual([
      { text: 'What does ', language: 'en-US', kind: 'sentence', source: STORY_CHECK_AUDIO_SOURCE },
      { text: '한글날', language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE },
      { text: ' mean?', language: 'en-US', kind: 'sentence', source: STORY_CHECK_AUDIO_SOURCE },
    ]);
    expect(speech.target).toEqual({ text: '한글날', language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE });
  });

  it('uses spokenKo and audioRef of the target, and adds a word-card target after the prompt', () => {
    const item = view({
      ...textCheck,
      target: { ...target, spokenKo: '한글랄', audioRef: 'audio/story/hangeullal.mp3' },
    });
    const speech = checkSpeech(item, item, 'en-US');
    const korean = { text: '한글랄', language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE, audioRef: 'audio/story/hangeullal.mp3' };
    expect(speech.question).toEqual([
      { text: 'Why was it made?', language: 'en-US', kind: 'sentence', source: STORY_CHECK_AUDIO_SOURCE },
      korean,
    ]);
    expect(speech.target).toEqual(korean);
  });

  it('skips a prompt chunk with nothing to say', () => {
    const item = view({ ...meaningCheck, promptEn: '{target}?' });
    expect(checkSpeech(item, item, 'en-US').question.map((s) => s.text)).toEqual(['한글날']);
  });

  it('reads a Korean option in Korean, then its gloss', () => {
    const item = view(koreanOptionCheck);
    expect(checkSpeech(item, item, 'en-US').options).toEqual([
      { text: 'ㅏ', language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE },
      { text: 'the vowel a', language: 'en-US', kind: 'sentence', source: STORY_CHECK_AUDIO_SOURCE },
      { text: 'ㄱ', language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE },
      { text: 'the consonant g', language: 'en-US', kind: 'sentence', source: STORY_CHECK_AUDIO_SOURCE },
    ]);
  });

  it('reads translated text in the UI voice and untranslated text in English', () => {
    const source = view(textCheck);
    const shown = view({
      ...textCheck,
      promptEn: '¿Por qué se hizo?',
      options: textCheck.options.map((o) => (o.id === 'a' ? { ...o, en: 'Para que la gente leyera' } : o)),
    });
    const speech = checkSpeech(shown, source, 'es-US');
    expect(speech.question[0]?.language).toBe('es-US');
    expect(speech.options.map((s) => s.language)).toEqual(['es-US', 'en-US', 'en-US']);
    // Without a source view everything is treated as the English source.
    expect(checkSpeech(shown, undefined, 'es-US').question[0]?.language).toBe('en-US');
  });

  it('reads the bundled checks of a localized story without throwing', () => {
    const story = storiesAll[0]!;
    const level = story.tiers[0]!.level;
    const shown = checkGameItems(localizeStory(story, 'es'), level);
    const source = checkGameItems(story, level);
    shown.forEach((item, i) => expect(checkSpeech(item, source[i], 'es-US').question.length).toBeGreaterThan(0));
  });
});

describe('optionCardState', () => {
  const item = view(textCheck); // correct: a

  it('is idle while answering, wrong once tapped wrong (locked)', () => {
    expect(optionCardState(item, 'a', answering())).toBe('idle');
    expect(optionCardState(item, 'b', answering({ wrong: ['b'] }))).toBe('wrong');
    expect(optionCardState(item, 'a', answering({ wrong: ['b'] }))).toBe('idle');
  });

  it(`rings the correct option after ${HIGHLIGHT_AFTER_WRONG} wrong taps`, () => {
    const state = answering({ wrong: ['b', 'c'] });
    expect(optionCardState(item, 'a', state)).toBe('hint');
    expect(optionCardState(item, 'b', state)).toBe('wrong');
  });

  it('once resolved: the correct option is correct and every other one is disabled', () => {
    const state = explained({ wrong: ['b'] });
    expect(optionCardState(item, 'a', state)).toBe('correct');
    expect(optionCardState(item, 'b', state)).toBe('disabled');
    expect(optionCardState(item, 'c', state)).toBe('disabled');
    expect(optionCardState(item, 'a', { ...state, phase: 'done' })).toBe('correct');
  });
});

describe('optionCardView', () => {
  const ctx = { romanizationMode: 'always' as const, revealed: false, copy };

  it('a text option: its label, and the outcome in words', () => {
    const item = view(textCheck);
    const opt = item.options[1]!;
    expect(optionCardView(item, opt, answering(), ctx)).toEqual({
      id: 'b',
      state: 'idle',
      label: 'To hide letters',
      romanization: '',
      status: null,
      accessibilityLabel: 'To hide letters',
    });
    const wrong = optionCardView(item, opt, answering({ wrong: ['b'] }), ctx);
    expect(wrong.status).toBe('tryAnother');
    expect(wrong.accessibilityLabel).toBe('To hide letters. Try another');
    const right = optionCardView(item, item.options[0]!, explained(), ctx);
    expect(right.status).toBe('correct');
    expect(right.accessibilityLabel).toBe('So people could read. Correct');
    const hint = optionCardView(item, item.options[0]!, answering({ wrong: ['b', 'c'] }), ctx);
    expect(hint.status).toBeNull();
    expect(hint.accessibilityLabel).toBe(`So people could read. ${copy.lookHere}`);
    expect(optionCardView(item, opt, explained(), ctx).accessibilityLabel).toBe('To hide letters');
  });

  it('a Korean option: Korean, romanization and gloss; romanization waits for a tap in tap mode', () => {
    const item = view(koreanOptionCheck);
    const opt = item.options[0]!;
    expect(optionCardView(item, opt, answering(), ctx)).toEqual({
      id: 'a',
      state: 'idle',
      ko: 'ㅏ',
      romanization: 'a',
      gloss: 'the vowel a',
      status: null,
      accessibilityLabel: 'ㅏ, a. the vowel a',
    });
    const tap = { ...ctx, romanizationMode: 'tap' as const };
    expect(optionCardView(item, opt, answering(), tap)).toMatchObject({ romanization: '', accessibilityLabel: 'ㅏ. the vowel a' });
    expect(optionCardView(item, opt, answering(), { ...tap, revealed: true }).romanization).toBe('a');
    expect(optionCardView(item, opt, explained(), tap).romanization).toBe('a');
  });

  it('a picture option: its art ref and label, named as a picture', () => {
    const item = view({ ...pictureCheck, shuffle: false });
    expect(optionCardView(item, item.options[0]!, answering(), ctx)).toEqual({
      id: 'a',
      state: 'idle',
      label: 'A book',
      art: 'card:book',
      romanization: '',
      status: null,
      accessibilityLabel: 'Picture: A book',
    });
  });
});

describe('optionCardView with options the schema would reject (defensive names)', () => {
  const ctx = { romanizationMode: 'always' as const, revealed: false, copy };
  const bare: CheckView = {
    ...view(textCheck),
    options: [
      { id: 'k', ko: 'ㅏ', romanization: 'a', isCorrect: true },
      { id: 'p', art: 'card:book', isCorrect: false },
      { id: 'x', isCorrect: false },
    ],
    correctOptionId: 'k',
  };

  it('still gives every card a name and never prints "undefined"', () => {
    const [k, p, x] = bare.options.map((o) => optionCardView(bare, o, answering(), ctx));
    expect(k?.accessibilityLabel).toBe('ㅏ, a');
    expect(k?.gloss).toBeUndefined();
    expect(p?.accessibilityLabel).toBe('Picture: ');
    expect(p?.label).toBeUndefined();
    expect(x?.accessibilityLabel).toBe('');
  });
});

describe('targetView and revealNeeded', () => {
  const always = { romanizationMode: 'always' as const, revealed: false };
  const tap = { romanizationMode: 'tap' as const, revealed: false };

  it('is null without a target', () => {
    expect(targetView(view(textCheck), answering(), always)).toBeNull();
  });

  it('hides the gloss of a pick-meaning target until the item resolves (the answer is never pre-printed)', () => {
    const item = view(meaningCheck);
    expect(targetView(item, answering(), always)).toEqual({ ko: '한글날', romanization: 'hangeullal', inline: true });
    expect(targetView(item, explained(), always)).toEqual({ ko: '한글날', romanization: 'hangeullal', gloss: 'Hangul Day', inline: true });
    expect(targetView(view({ ...meaningCheck, kind: 'fill-word' }), answering(), always)?.gloss).toBeUndefined();
  });

  it('shows the gloss of other kinds at once, and a word-card target is not inline', () => {
    const item = view({ ...textCheck, target });
    expect(targetView(item, answering(), always)).toEqual({ ko: '한글날', romanization: 'hangeullal', gloss: 'Hangul Day', inline: false });
  });

  it('tap mode: romanization hidden until revealed, and always shown once resolved', () => {
    const item = view(meaningCheck);
    expect(targetView(item, answering(), tap)?.romanization).toBe('');
    expect(targetView(item, answering(), { ...tap, revealed: true })?.romanization).toBe('hangeullal');
    expect(targetView(item, explained(), tap)?.romanization).toBe('hangeullal');
  });

  it('asks for the reveal button only while Korean on the item still hides its romanization', () => {
    expect(revealNeeded(view(meaningCheck), answering(), tap)).toBe(true);
    expect(revealNeeded(view(koreanOptionCheck), answering(), tap)).toBe(true);
    expect(revealNeeded(view(meaningCheck), answering(), { ...tap, revealed: true })).toBe(false);
    expect(revealNeeded(view(meaningCheck), explained(), tap)).toBe(false);
    expect(revealNeeded(view(meaningCheck), answering(), always)).toBe(false);
    expect(revealNeeded(view(textCheck), answering(), tap)).toBe(false);
  });

  it('checkHasKorean: a target or a Korean option', () => {
    expect(checkHasKorean(view(meaningCheck))).toBe(true);
    expect(checkHasKorean(view(koreanOptionCheck))).toBe(true);
    expect(checkHasKorean(view(textCheck))).toBe(false);
  });
});

describe('checkBubble', () => {
  const item = view(textCheck);

  it('says nothing before the first tap', () => {
    expect(checkBubble(item, answering(), copy)).toBeNull();
  });

  it('a first wrong tap: Hoya thinking with the hint, or the default line', () => {
    expect(checkBubble(item, answering({ wrong: ['b'] }), copy)).toEqual({ tone: 'thinking', message: 'Think of the king.' });
    const noHint = view({ ...textCheck, hintEn: undefined });
    expect(checkBubble(noHint, answering({ wrong: ['b'] }), copy)).toEqual({ tone: 'thinking', message: copy.defaultHint });
  });

  it('after the highlight: Hoya points at the ringed option', () => {
    expect(checkBubble(item, answering({ wrong: ['b', 'c'] }), copy)).toEqual({ tone: 'thinking', message: copy.lookHere });
  });

  it('resolved: Hoya cheering with the explanation; no line when the check has none', () => {
    expect(checkBubble(item, explained(), copy)).toEqual({ tone: 'cheering', message: 'It was made so people could read.' });
    expect(checkBubble(view({ ...textCheck, explainEn: undefined }), explained(), copy)).toBeNull();
  });
});

describe('checkProgress (fill-only)', () => {
  it('fills when an item resolves and never drops; the pill names the current item', () => {
    expect(checkProgress(answering(), 3)).toEqual({ value: 0, position: 1 });
    expect(checkProgress(explained(), 3)).toEqual({ value: 1, position: 1 });
    expect(checkProgress(answering({ index: 1 }), 3)).toEqual({ value: 1, position: 2 });
    expect(checkProgress(explained({ index: 2 }), 3)).toEqual({ value: 3, position: 3 });
    expect(checkProgress({ ...explained({ index: 2 }), phase: 'done' }, 3)).toEqual({ value: 3, position: 3 });
  });

  it('is zero for an empty step', () => {
    expect(checkProgress(initCheckState({ items: [], hasRecap: false }), 0)).toEqual({ value: 0, position: 0 });
  });
});

describe('checkOptionColumns', () => {
  it('two columns for picture options, one for text', () => {
    expect(checkOptionColumns(view(pictureCheck))).toBe(2);
    expect(checkOptionColumns(view(textCheck))).toBe(1);
    expect(checkOptionColumns(view(koreanOptionCheck))).toBe(1);
  });
});

describe('telemetry payloads (§3.9: ids and counts only)', () => {
  const ids = { storyId: 'story:t', level: 'listen' as const };

  it('story.check.answered', () => {
    expect(checkAnsweredPayload(ids, view(meaningCheck), { firstTry: false, taps: 2 })).toEqual({
      storyId: 'story:t',
      level: 'listen',
      checkId: 'q2',
      kind: 'pick-meaning',
      firstTry: false,
      taps: 2,
    });
  });

  it('tallies first-try answers and retries across items', () => {
    let tally = EMPTY_CHECK_TALLY;
    tally = tallyResolved(tally, { firstTry: true, taps: 1 });
    tally = tallyResolved(tally, { firstTry: false, taps: 3 });
    tally = tallyResolved(tally, { firstTry: false, taps: 2 });
    expect(tally).toEqual({ firstTryCorrect: 1, retries: 3 });
    expect(EMPTY_CHECK_TALLY).toEqual({ firstTryCorrect: 0, retries: 0 });
  });

  it('story.check.finished, also for an empty step', () => {
    expect(checkFinishedPayload(ids, 3, { firstTryCorrect: 2, retries: 1 })).toEqual({
      storyId: 'story:t',
      level: 'listen',
      items: 3,
      firstTryCorrect: 2,
      retries: 1,
    });
    expect(checkFinishedPayload({ storyId: null, level: null }, 0, EMPTY_CHECK_TALLY)).toEqual({
      storyId: null,
      level: null,
      items: 0,
      firstTryCorrect: 0,
      retries: 0,
    });
  });
});
