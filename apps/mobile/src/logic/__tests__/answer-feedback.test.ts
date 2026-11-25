import { getMessages } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterSound } from '../audio/reply-advance';
import {
  ANNOUNCE_WAIT_MAX_MS,
  ANNOUNCE_WAIT_MIN_MS,
  RESULT_MARK_MIN_MS,
  afterMiss,
  afterRightAnswer,
  announceWaitMs,
  answerAnnouncement,
  answerItem,
  answerOptionLabel,
  lookHereLine,
  readerPath,
  resultLeastWait,
  segmentsText,
  spokenParts,
  type AnswerResult,
} from '../answer-feedback';

/**
 * F-A11Y-001 §6 tests 1 to 4: the pure rules behind the answer announcer (§3.2 to §3.4). Every decision of the hook and
 * the announcer is here; the React glue only wires these to the platform calls.
 */

const a11y = getMessages('en').a11y;
const option = a11y.minigame.option;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

const RESULTS: readonly [AnswerResult, string][] = [
  [{ kind: 'right', item: answerItem(a11y, 'sagwa', 'apple') }, 'Right answer: sagwa, apple.'],
  [{ kind: 'miss', item: 'pear' }, 'Not this one: pear. Try another.'],
  [{ kind: 'missListen', item: 'n' }, 'Not this one: n. Listen again.'],
  [{ kind: 'missHint', item: 'silent or ng', hint: 'Look again: one sound is different.' }, 'Not this one: silent or ng. Look again: one sound is different.'],
  [{ kind: 'notMatched', word: 'gimchi', meaning: 'rice' }, 'Not a match: gimchi and rice. Try another.'],
  [{ kind: 'line', text: 'Not quite. Try again. Look at the shape.' }, 'Not quite. Try again. Look at the shape.'],
];

describe('answerAnnouncement (§3.2, test 1)', () => {
  it.each(RESULTS)('%o says the English line of §3.7', (result, line) => {
    const segments = answerAnnouncement(result, a11y);
    expect(segmentsText(segments)).toBe(line);
  });

  it('never doubles punctuation: an item that ends a sentence takes no extra full stop, in en, es and ko', () => {
    const say = (result: AnswerResult, locale: 'en' | 'es' | 'ko' = 'en'): string => segmentsText(answerAnnouncement(result, getMessages(locale).a11y));
    expect(say({ kind: 'right', item: 'annyeong, Hello!' })).toBe('Right answer: annyeong, Hello!');
    expect(say({ kind: 'miss', item: 'Really?' })).toBe('Not this one: Really? Try another.');
    expect(say({ kind: 'missListen', item: 'Wait...' })).toBe('Not this one: Wait... Listen again.');
    expect(say({ kind: 'missHint', item: 'Hi!', hint: 'Look again.' })).toBe('Not this one: Hi! Look again.');
    expect(say({ kind: 'notMatched', word: 'jinjja', meaning: 'Really?' })).toBe('Not a match: jinjja and Really? Try another.');
    expect(say({ kind: 'right', item: 'annyeong, \u00a1Hola!' }, 'es')).toBe('Respuesta correcta: annyeong, \u00a1Hola!');
    expect(say({ kind: 'miss', item: 'annyeong, Hello!' }, 'ko')).not.toContain('!.');
    // An item that does not end a sentence keeps the template's full stop.
    expect(say({ kind: 'right', item: 'sagwa, apple' })).toBe('Right answer: sagwa, apple.');
  });

  it('returns UI-language segments only (no lang until LP-3)', () => {
    for (const [result] of RESULTS) {
      for (const segment of answerAnnouncement(result, a11y)) expect(segment.lang).toBeUndefined();
    }
  });

  it('names a Korean answer by romanization and gloss, and by romanization alone with no gloss', () => {
    expect(answerItem(a11y, 'sagwa', 'apple')).toBe('sagwa, apple');
    expect(answerItem(a11y, 'sagwa')).toBe('sagwa');
    expect(answerItem(a11y, 'sagwa', '')).toBe('sagwa');
  });

  it('holds no Hangul code point in any line, the round label or a spoken {ko:} line (OD-AF5)', () => {
    for (const [result] of RESULTS) expect(segmentsText(answerAnnouncement(result, a11y))).not.toMatch(HANGUL);
    expect(a11y.answer.round(2, 4, 'What does this mean? sagwa')).toBe('Question 2 of 4. What does this mean? sagwa');
    expect(a11y.answer.round(2, 4, 'What does this mean? sagwa')).not.toMatch(HANGUL);
    const spoken = spokenParts([{ text: 'Use ' }, { ko: '은', romanization: 'eun' }, { text: ' after ' }, { ko: '책', romanization: 'chaek' }, { text: '.' }]);
    expect(spoken).toBe('Use eun after chaek.');
    expect(spoken).not.toMatch(HANGUL);
  });

  it('spokenParts drops a token that has no romanization rather than read Hangul', () => {
    expect(spokenParts([{ text: 'Try ' }, { ko: '뷁', romanization: '' }, { text: 'again.' }])).toBe('Try again.');
    expect(spokenParts([])).toBe('');
  });
});

describe('answerOptionLabel (§3.2, test 2)', () => {
  it('starts an answered option\'s name with its state, and leaves an idle one as it is', () => {
    expect(answerOptionLabel('idle', 'apple', option)).toBe('apple');
    expect(answerOptionLabel('correct', 'apple', option)).toBe('Right answer: apple');
    expect(answerOptionLabel('wrong', 'pear', option)).toBe('Not this one: pear');
    expect(answerOptionLabel('hint', 'Moon', option)).toBe('Look here: Moon');
  });
});

describe('lookHereLine (§3.2: the line a miss that turns the hint on carries)', () => {
  it('names the answer to look at by its option name, in every locale, and takes no second full stop', () => {
    expect(lookHereLine(a11y, 'sagwa, apple')).toBe('Look here: sagwa, apple.');
    expect(lookHereLine(a11y, 'Hola!')).toBe('Look here: Hola!');
    expect(lookHereLine(getMessages('es').a11y, 'manzana')).toBe(`${getMessages('es').a11y.minigame.option.hint('manzana')}.`);
    expect(lookHereLine(a11y, 'sagwa')).not.toMatch(HANGUL);
  });
});

describe('resultLeastWait and readerPath (§3.4, OD-AF2 (b), OD-AF3 (d); test 3)', () => {
  it('floors every game\'s least wait at RESULT_MARK_MIN_MS = 1000, reduced motion\'s 0 included', () => {
    expect(RESULT_MARK_MIN_MS).toBe(1000);
    expect(resultLeastWait(0)).toBe(1000);
    expect(resultLeastWait(700)).toBe(1000);
    expect(resultLeastWait(900)).toBe(1000);
    expect(resultLeastWait(1200)).toBe(1200);
    expect(resultLeastWait(-5)).toBe(1000);
  });

  it('native follows the platform reader; the web follows the device flag', () => {
    expect(readerPath({ platform: 'ios', nativeReader: true, webFlag: false })).toBe('reader');
    expect(readerPath({ platform: 'android', nativeReader: true, webFlag: false })).toBe('reader');
    expect(readerPath({ platform: 'ios', nativeReader: false, webFlag: true })).toBe('plain');
    expect(readerPath({ platform: 'android', nativeReader: false, webFlag: true })).toBe('plain');
    expect(readerPath({ platform: 'web', nativeReader: true, webFlag: false })).toBe('plain');
    expect(readerPath({ platform: 'web', nativeReader: false, webFlag: true })).toBe('reader');
  });
});

describe('announceWaitMs (§3.4: Android and the web cannot tell when the line is said)', () => {
  it('grows with the line and stays within its bounds', () => {
    const short = announceWaitMs('Right answer: n.');
    const long = announceWaitMs('Not this one: silent or ng. Look again: one sound is different from the other three.');
    expect(long).toBeGreaterThan(short);
    expect(announceWaitMs('')).toBe(ANNOUNCE_WAIT_MIN_MS);
    expect(announceWaitMs('x'.repeat(10_000))).toBe(ANNOUNCE_WAIT_MAX_MS);
    expect(ANNOUNCE_WAIT_MAX_MS).toBeGreaterThanOrEqual(8000);
  });

  it('counts a Hangul syllable of the Korean UI as longer than a letter', () => {
    expect(announceWaitMs('정답: sagwa, 사과.')).toBeGreaterThan(announceWaitMs('ab: sagwa, ab.'));
  });
});

describe('afterRightAnswer and afterMiss (§3.4, OD-AF9 (b); test 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A sound that ends after `ms`. */
  const soundOf = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it('reader off: the line is written, the sound plays, and the round advances after the sound and the least wait, as today', async () => {
    const log: string[] = [];
    let sound: Promise<void> | null = null;
    afterRightAnswer({
      readerOn: false,
      gameMinMs: 700,
      announce: () => {
        log.push('announce');
        return new Promise<void>(() => undefined);
      },
      play: () => {
        log.push('play');
        sound = soundOf(1800);
      },
      showNext: () => log.push('next'),
      waitThenAdvance: (minMs) => {
        void afterSound(sound, { minMs }).then(() => log.push('advance'));
      },
    });
    expect(log).toEqual(['announce', 'play']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(log).toEqual(['announce', 'play']);
    await vi.advanceTimersByTimeAsync(800);
    expect(log).toEqual(['announce', 'play', 'advance']);
  });

  it('reader off with no sound: the advance comes after the 1000 ms floor, not the game\'s 700', async () => {
    const log: string[] = [];
    afterRightAnswer({
      readerOn: false,
      gameMinMs: 700,
      announce: () => Promise.resolve(),
      showNext: () => log.push('next'),
      waitThenAdvance: (minMs) => {
        void afterSound(null, { minMs }).then(() => log.push('advance'));
      },
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(log).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(log).toEqual(['advance']);
  });

  it('reader on: Next shows first (focus), the line is queued after it, the answer\'s sound starts once it is said, and nothing advances', async () => {
    const log: string[] = [];
    let said!: () => void;
    const done = afterRightAnswer({
      readerOn: true,
      gameMinMs: 900,
      announce: () => {
        log.push('announce');
        return new Promise<void>((resolve) => {
          said = resolve;
        });
      },
      play: () => log.push('play'),
      showNext: () => log.push('next'),
      waitThenAdvance: () => log.push('advance'),
    });
    expect(log).toEqual(['next', 'announce']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(log).toEqual(['next', 'announce']);
    said();
    await done;
    expect(log).toEqual(['next', 'announce', 'play']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(log).not.toContain('advance');
  });

  it('a miss is announced; the game\'s own replay runs only with the reader off', () => {
    const log: string[] = [];
    afterMiss({ readerOn: false, announce: () => log.push('announce'), replay: () => log.push('replay') });
    expect(log).toEqual(['announce', 'replay']);
    log.length = 0;
    afterMiss({ readerOn: true, announce: () => log.push('announce'), replay: () => log.push('replay') });
    expect(log).toEqual(['announce']);
    log.length = 0;
    afterMiss({ readerOn: false, announce: () => log.push('announce') });
    expect(log).toEqual(['announce']);
  });
});
