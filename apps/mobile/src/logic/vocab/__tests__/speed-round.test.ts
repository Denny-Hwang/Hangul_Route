import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import type { VocabQuestion } from '../question-builder';
import {
  CHALLENGE_COUNT,
  buildRound,
  PICTURES_FIRST_COUNT,
  RELAXED_COUNT,
  SPARK_CAPACITY,
  collectedWords,
  hoyaLine,
  isNewBest,
  previousBest,
  resultsView,
  roundCompleteEvent,
  roundPlan,
  roundStartEvent,
  sheetState,
  sparkLabel,
  speedAnswerEvent,
  speedRoundCanPlay,
  speedSessionEvent,
} from '../speed-round';
import { initSession, reduce, type SessionConfig, type SpeedState } from '../speed-session';
import { summarize, type RoundSummary } from '../stars';
import { progress, state, topicRow, word } from './fixtures';

const M = getMessages('en');
const COPY = M.learner.vocab.speed;
const A11Y = M.a11y.vocab.speed;

const question = (itemId: string, index = 0): VocabQuestion => ({
  key: `q${index}:${itemId}:word-to-image`,
  itemId,
  format: 'word-to-image',
  prompt: { kind: 'word', ko: '가', romanization: 'ga' },
  options: [
    { id: itemId, pictureRef: `word:${itemId}` },
    { id: 'vocab:x', pictureRef: 'word:x' },
    { id: 'vocab:y', pictureRef: 'word:y' },
  ],
  answerId: itemId,
});

const relaxed = (ids: readonly string[], hintsEnabled = true): SessionConfig => ({
  mode: 'relaxed',
  questions: ids.map((id, i) => question(id, i)),
  clockMs: null,
  hintsEnabled,
});

const summary = (extra: Partial<RoundSummary> = {}): RoundSummary => ({
  mode: 'relaxed',
  endedBy: 'questions',
  clockMs: null,
  answered: 10,
  firstTryCorrect: 7,
  hinted: 0,
  caught: 6,
  caughtIds: ['vocab:a'],
  seeAgainIds: ['vocab:b'],
  stars: 2,
  ...extra,
});

/** Words a learner never reads on a round screen (D3, S11, §3.7). */
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|streak|combo|lives)\b|%|\d\s*\/\s*\d|\d+ of \d+/i;

describe('roundPlan (F-VOC-004 §3.2 level ladder, §3.4)', () => {
  it('Pictures first: 3 options and 8 questions in Relaxed', () => {
    expect(roundPlan(0, 'relaxed')).toEqual({ level: 0, optionCount: 3, count: PICTURES_FIRST_COUNT });
    expect(PICTURES_FIRST_COUNT).toBe(8);
  });

  it('Some reading and Reads easily: 4 options and 10 questions in Relaxed', () => {
    expect(roundPlan(1, 'relaxed')).toEqual({ level: 1, optionCount: 4, count: RELAXED_COUNT });
    expect(roundPlan(2, 'relaxed')).toEqual({ level: 2, optionCount: 4, count: RELAXED_COUNT });
    expect(RELAXED_COUNT).toBe(10);
  });

  it('reads an unknown level (null) as 1', () => {
    expect(roundPlan(null, 'relaxed')).toEqual({ level: 1, optionCount: 4, count: 10 });
  });

  it('Challenge builds 40 questions and stops at the clock', () => {
    expect(roundPlan(0, 'challenge')).toEqual({ level: 0, optionCount: 3, count: CHALLENGE_COUNT });
    expect(roundPlan(2, 'challenge').count).toBe(40);
  });
});

describe('collectedWords and sheetState (§3.1 availability)', () => {
  const items = [word('a'), word('b'), word('c'), word('d')];

  it('keeps the topic words that have a saved state, in file order', () => {
    const p = progress([state('c'), state('a'), state('zz')]);
    expect(collectedWords(items, p).map((w) => w.id)).toEqual(['vocab:a', 'vocab:c']);
    expect(collectedWords(items, progress())).toEqual([]);
  });

  it('is ready from as many collected words as the level has options, otherwise learn first', () => {
    expect(sheetState(2, 3)).toBe('learn-first');
    expect(sheetState(3, 3)).toBe('ready');
    expect(sheetState(3, 4)).toBe('learn-first');
    expect(sheetState(4, 4)).toBe('ready');
    expect(sheetState(12, 4)).toBe('ready');
  });
});

describe('buildRound (§3.5: selectSpeedWords, then buildQuestions)', () => {
  const KO = ['사과', '바나나', '우유', '빵', '밥', '김치', '물', '떡'];
  const topicWords = KO.map((ko, i) => word(String.fromCharCode(97 + i), { ko }));
  const input = (n: number, plan = roundPlan(1, 'relaxed'), extra: Partial<Parameters<typeof buildRound>[0]> = {}) => ({
    collected: topicWords.slice(0, n),
    universe: topicWords,
    progress: progress(topicWords.slice(0, n).map((w) => state(w.id.replace('vocab:', ''), { box: 1 }))),
    today: '2026-10-12',
    plan,
    seed: 42,
    canRender: () => true,
    canPlay: false,
    ...extra,
  });

  it('asks the collected words with the plan options, as many questions as their formats allow', () => {
    const questions = buildRound(input(4));
    // Two formats without a voice at level 1 (word to picture, picture to word): 4 words x 2.
    expect(questions).toHaveLength(8);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(topicWords.slice(0, 4).map((w) => w.id)).toContain(q.answerId);
    }
    expect(buildRound(input(5))).toHaveLength(10);
  });

  it('Pictures first without a voice: one word-to-picture question per word, 3 options', () => {
    const questions = buildRound(input(3, roundPlan(0, 'relaxed')));
    expect(questions).toHaveLength(3);
    expect(questions.every((q) => q.format === 'word-to-image' && q.options.length === 3)).toBe(true);
  });

  it('a word with no saved box is asked as a new word (box 0)', () => {
    const questions = buildRound(input(4, roundPlan(1, 'relaxed'), { progress: progress() }));
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0]?.format).toBe('word-to-image');
  });

  it('the same seed builds the same round', () => {
    expect(buildRound(input(4))).toEqual(buildRound(input(4)));
  });

  it('no question at all (no picture resolves) is an empty round, never an error', () => {
    expect(buildRound(input(4, roundPlan(1, 'relaxed'), { canRender: () => false }))).toEqual([]);
  });

  it("with the voice list still unknown the round has its sound questions (speedRoundCanPlay, as the reader plays)", () => {
    const unknown = { tts: { state: 'unknown' as const }, clips: false, unlocked: false };
    const canPlay = speedRoundCanPlay(unknown, false);
    expect(canPlay).toBe(true);
    const questions = buildRound(input(4, roundPlan(1, 'relaxed'), { canPlay }));
    expect(questions.some((q) => q.format === 'audio-to-image')).toBe(true);
  });

  it('speedRoundCanPlay: no sound only for no Korean voice and no clip, or sound off', () => {
    const none = { tts: { state: 'none' as const, reason: 'no_korean_voice' as const }, clips: false, unlocked: true };
    const ready = { tts: { state: 'ready' as const, voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' as const }, clips: false, unlocked: true };
    expect(speedRoundCanPlay(none, false)).toBe(false);
    expect(speedRoundCanPlay({ ...none, clips: true }, false)).toBe(true);
    expect(speedRoundCanPlay(ready, false)).toBe(true);
    expect(speedRoundCanPlay(ready, true)).toBe(false);
    expect(speedRoundCanPlay({ tts: { state: 'unknown' }, clips: false, unlocked: false }, true)).toBe(false);
  });

  it('any other failure is not swallowed', () => {
    const boom = (): boolean => {
      throw new Error('boom');
    };
    expect(() => buildRound(input(4, roundPlan(1, 'relaxed'), { canRender: boom }))).toThrow('boom');
  });
});

describe('what each answer writes (§3.6, F-VOC-005)', () => {
  it('an answer event per first tap, with the format, the active time and the hint', () => {
    expect(speedAnswerEvent({ itemId: 'vocab:a', format: 'audio-to-image', correct: true, hinted: false, ms: 1840 })).toEqual({
      type: 'answer',
      id: 'vocab:a',
      correct: true,
      format: 'audio-to-image',
      source: 'speed',
      ms: 1840,
      hinted: false,
    });
    expect(speedAnswerEvent({ itemId: 'vocab:b', format: 'word-to-image', correct: false, hinted: true, ms: 21000 })).toMatchObject({
      correct: false,
      hinted: true,
      source: 'speed',
    });
  });

  it('one session event at the end with the stars, caught, mode and how it ended', () => {
    expect(speedSessionEvent('food', summary())).toEqual({
      type: 'session',
      topicKey: 'food',
      kind: 'speed',
      stars: 2,
      caught: 6,
      mode: 'relaxed',
      endedBy: 'questions',
    });
    expect(speedSessionEvent('animals', summary({ mode: 'challenge', endedBy: 'clock', stars: 3, caught: 9 }))).toMatchObject({
      mode: 'challenge',
      endedBy: 'clock',
      stars: 3,
      caught: 9,
    });
  });

  it('nothing when nothing was answered (no stars): the round was not played', () => {
    expect(speedSessionEvent('food', summary({ answered: 0, stars: null, caught: 0 }))).toBeNull();
  });
});

describe('personal best (S9, behaviour 11)', () => {
  it('reads the earlier Challenge best of the topic, 0 when there is none', () => {
    expect(previousBest(progress([], [topicRow('food', { bestCaught: 7 })]), 'food')).toBe(7);
    expect(previousBest(progress([], [topicRow('animals', { bestCaught: 7 })]), 'food')).toBe(0);
    expect(previousBest(progress(), 'food')).toBe(0);
  });

  it('is a new best only in Challenge, only above the earlier best', () => {
    expect(isNewBest(summary({ mode: 'challenge', caught: 8 }), 7)).toBe(true);
    expect(isNewBest(summary({ mode: 'challenge', caught: 7 }), 7)).toBe(false);
    expect(isNewBest(summary({ mode: 'challenge', caught: 1 }), 0)).toBe(true);
    expect(isNewBest(summary({ mode: 'challenge', caught: 0 }), 0)).toBe(false);
    expect(isNewBest(summary({ mode: 'relaxed', caught: 9 }), 0)).toBe(false);
    expect(isNewBest(summary({ mode: 'challenge', caught: 9, stars: null, answered: 0 }), 0)).toBe(false);
  });
});

describe('telemetry (§3.10)', () => {
  it('vocab.round.start: the level order, never an age; clockScale null in Relaxed', () => {
    expect(
      roundStartEvent({ topicKey: 'food', mode: 'relaxed', clockScale: 1.5, plan: roundPlan(0, 'relaxed'), questions: 8, audio: false }),
    ).toEqual({
      name: 'vocab.round.start',
      payload: { topicKey: 'food', mode: 'relaxed', clockScale: null, optionCount: 3, level: 0, questions: 8, audio: false },
    });
    expect(
      roundStartEvent({ topicKey: 'food', mode: 'challenge', clockScale: 2, plan: roundPlan(1, 'challenge'), questions: 40, audio: true }).payload,
    ).toMatchObject({ mode: 'challenge', clockScale: 2, optionCount: 4, level: 1, questions: 40, audio: true });
  });

  it('vocab.round.complete: the internal numbers, never for a round with no answer', () => {
    expect(roundCompleteEvent({ topicKey: 'food', summary: summary({ hinted: 1 }), pauses: 0, activeMs: 41250, newBest: false })).toEqual({
      name: 'vocab.round.complete',
      payload: {
        topicKey: 'food',
        mode: 'relaxed',
        endedBy: 'questions',
        answered: 10,
        firstTryCorrect: 7,
        hinted: 1,
        caught: 6,
        stars: 2,
        pauses: 0,
        activeMs: 41250,
        newBest: false,
      },
    });
    expect(roundCompleteEvent({ topicKey: 'food', summary: summary({ answered: 0, stars: null }), pauses: 0, activeMs: 0, newBest: false })).toBeNull();
  });

  it('carries no name, free text or question content', () => {
    const start = roundStartEvent({ topicKey: 'food', mode: 'relaxed', clockScale: 1, plan: roundPlan(1, 'relaxed'), questions: 10, audio: true });
    const done = roundCompleteEvent({ topicKey: 'food', summary: summary(), pauses: 2, activeMs: 1, newBest: true });
    for (const payload of [start.payload, done?.payload]) {
      for (const value of Object.values(payload ?? {})) expect(['string', 'number', 'boolean', 'object']).toContain(typeof value);
      expect(JSON.stringify(payload)).not.toMatch(/vocab:/);
    }
  });
});

describe('hoyaLine (§3.6, §3.7)', () => {
  const glossOf = (id: string): string | undefined => ({ 'vocab:a': 'apple', 'vocab:b': 'pear' })[id];
  const run = (c: SessionConfig, ...events: Parameters<typeof reduce>[1][]): SpeedState =>
    events.reduce((s, e) => reduce(s, e, c), initSession(c));

  it('"Ready when you are." on the first question, before any answer', () => {
    const c = relaxed(['vocab:a', 'vocab:b']);
    expect(hoyaLine(run(c, { type: 'start' }), glossOf, COPY)).toEqual({ pose: 'idle', line: 'Ready when you are.' });
  });

  it('nothing before the start, on later questions with no hint, and after the end', () => {
    const c = relaxed(['vocab:a', 'vocab:b']);
    expect(hoyaLine(initSession(c), glossOf, COPY)).toBeNull();
    const second = run(c, { type: 'start' }, { type: 'answer', optionId: 'vocab:a' }, { type: 'reveal-done' });
    expect(second.phase).toBe('question');
    expect(hoyaLine(second, glossOf, COPY)).toBeNull();
    const done = run(c, { type: 'start' }, { type: 'quit' });
    expect(hoyaLine(done, glossOf, COPY)).toBeNull();
  });

  it('the right-answer line during a right reveal, naming the word', () => {
    const c = relaxed(['vocab:a', 'vocab:b', 'vocab:a']);
    const right = run(c, { type: 'start' }, { type: 'answer', optionId: 'vocab:a' });
    const line = hoyaLine(right, glossOf, COPY);
    expect(line?.pose).toBe('cheering');
    expect([...COPY.nudge.right.lines, 'Yes, apple!']).toContain(line?.line);
  });

  it('the gentle line with the right word during a miss reveal (Hoya thinking)', () => {
    const c = relaxed(['vocab:a', 'vocab:b']);
    const miss = run(c, { type: 'start' }, { type: 'answer', optionId: 'vocab:x' });
    const line = hoyaLine(miss, glossOf, COPY);
    expect(line?.pose).toBe('thinking');
    expect(line?.line).toMatch(/apple/);
  });

  it('two reveals in a row never repeat a line', () => {
    const c = relaxed(['vocab:a', 'vocab:b', 'vocab:a', 'vocab:b']);
    let s = run(c, { type: 'start' });
    const lines: string[] = [];
    for (const optionId of ['vocab:x', 'vocab:x', 'vocab:a', 'vocab:b']) {
      s = reduce(s, { type: 'answer', optionId }, c);
      lines.push(hoyaLine(s, glossOf, COPY)?.line ?? '');
      s = reduce(s, { type: 'reveal-done' }, c);
    }
    for (let i = 1; i < lines.length; i += 1) expect(lines[i]).not.toBe(lines[i - 1]);
  });

  it('"Take your time." once the soft hint is up (Relaxed, 12 s), and with the ring', () => {
    const c = relaxed(['vocab:a', 'vocab:b']);
    const soft = run(c, { type: 'start' }, { type: 'answer', optionId: 'vocab:a' }, { type: 'reveal-done' }, { type: 'tick', dtMs: 12_000 });
    expect(soft.hint).toBe('soft');
    expect(hoyaLine(soft, glossOf, COPY)).toEqual({ pose: 'idle', line: 'Take your time.' });
    const ring = reduce(soft, { type: 'tick', dtMs: 8_000 }, c);
    expect(ring.hint).toBe('ring');
    expect(hoyaLine(ring, glossOf, COPY)?.line).toBe('Take your time.');
  });

  it('a reveal with no result (a state the reducer never makes) has no line', () => {
    expect(hoyaLine({ ...initSession(relaxed(['vocab:a'])), phase: 'reveal' }, glossOf, COPY)).toBeNull();
  });

  it('a word with no gloss still gets a line, never "undefined"', () => {
    const c = relaxed(['vocab:q', 'vocab:b']);
    const miss = run(c, { type: 'start' }, { type: 'answer', optionId: 'vocab:x' });
    expect(hoyaLine(miss, glossOf, COPY)?.line).not.toMatch(/undefined/);
  });
});

describe('resultsView (§3.6 results, S4, S11)', () => {
  it('stars, the plain caught count and Hoya by stars', () => {
    const view = resultsView(summary(), false, COPY);
    expect(view).toMatchObject({ stars: 2, caughtLine: '6 words caught', timeUp: null, newBest: null, seeAgainIds: ['vocab:b'], playAgainPrimary: false });
    expect(view?.hoya).toEqual({ pose: 'cheering', line: 'Nice round.' });
    expect(resultsView(summary({ caught: 1 }), false, COPY)?.caughtLine).toBe('1 word caught');
  });

  it('no first-try catch: one star and the F-RVW-001 line with Hoya thinking (behaviour 10)', () => {
    const view = resultsView(summary({ firstTryCorrect: 0, caught: 0, stars: 1 }), false, COPY);
    expect(view?.stars).toBe(1);
    expect(view?.caughtLine).toBe('0 words caught');
    expect(view?.hoya).toEqual({ pose: 'thinking', line: 'Good try! You collected a star!' });
  });

  it('Play again is primary only when there is nothing to see again', () => {
    expect(resultsView(summary({ seeAgainIds: [] }), false, COPY)?.playAgainPrimary).toBe(true);
    expect(resultsView(summary({ seeAgainIds: ['vocab:b'] }), false, COPY)?.playAgainPrimary).toBe(false);
  });

  it('the clock line for a round the clock ended, and New best! only when it is one', () => {
    const view = resultsView(summary({ mode: 'challenge', endedBy: 'clock' }), true, COPY);
    expect(view?.timeUp).toBe("Time's up. Here is what you caught.");
    expect(view?.newBest).toBe('New best!');
    expect(resultsView(summary({ mode: 'challenge' }), false, COPY)?.newBest).toBeNull();
  });

  it('null for a summary with no stars (nothing was played)', () => {
    expect(resultsView(summary({ answered: 0, stars: null }), false, COPY)).toBeNull();
  });

  it('the Relaxed line says the plain count, singular for a one-word round', () => {
    expect(COPY.relaxed.line(1)).toBe('1 word. No clock.');
    expect(COPY.relaxed.line(10)).toBe('10 words. No clock.');
  });

  it('every line a learner reads passes the anti-shame scans (behaviour 16)', () => {
    const views = [
      resultsView(summary(), false, COPY),
      resultsView(summary({ mode: 'challenge', endedBy: 'clock', stars: 3 }), true, COPY),
      resultsView(summary({ firstTryCorrect: 0, caught: 0, stars: 1 }), false, COPY),
    ];
    const lines = views.flatMap((v) => [v?.caughtLine, v?.timeUp, v?.newBest, v?.hoya.line]).filter((l): l is string => typeof l === 'string');
    lines.push(
      COPY.title,
      COPY.relaxed.label,
      COPY.relaxed.line(8),
      COPY.relaxed.line(10),
      COPY.start,
      COPY.noSound,
      COPY.learnFirst,
      COPY.learn,
      COPY.nothingToPlay,
      COPY.back,
      COPY.backToTopic,
      COPY.stop.title,
      COPY.stop.body,
      COPY.stop.keep,
      COPY.stop.stop,
      COPY.results.seeAgain,
      COPY.results.practice,
      COPY.results.playAgain,
      COPY.results.backToTopic,
      A11Y.sparks(3),
      A11Y.sparksFull,
    );
    for (const line of lines) {
      expect(scanLearnerCopy([line]), line).toEqual([]);
      expect(line, line).not.toMatch(SHAME);
      expect(line).not.toMatch(/\b(kids?|child(ren)?|ages?|years? old|adults?)\b/i);
    }
  });
});

describe('sparkLabel (§3.8)', () => {
  it('names the sparks, and "Full of sparks" once the meter is full', () => {
    expect(sparkLabel(0, A11Y)).toBe('0 sparks');
    expect(sparkLabel(1, A11Y)).toBe('1 spark');
    expect(sparkLabel(3, A11Y)).toBe('3 sparks');
    expect(sparkLabel(SPARK_CAPACITY - 1, A11Y)).toBe('29 sparks');
    expect(sparkLabel(SPARK_CAPACITY, A11Y)).toBe('Full of sparks');
    expect(sparkLabel(45, A11Y)).toBe('Full of sparks');
    expect(SPARK_CAPACITY).toBe(30);
  });
});

describe('the summary the results read (stars.ts, reused)', () => {
  it('a Relaxed round of right and missed answers summarises to stars and words to see again', () => {
    const c = relaxed(['vocab:a', 'vocab:b', 'vocab:a']);
    let s = reduce(initSession(c), { type: 'start' }, c);
    for (const optionId of ['vocab:a', 'vocab:x', 'vocab:a']) {
      s = reduce(reduce(s, { type: 'answer', optionId }, c), { type: 'reveal-done' }, c);
    }
    expect(s.phase).toBe('done');
    const sum = summarize(s.results, c, 'questions');
    expect(sum).toMatchObject({ answered: 3, caught: 1, seeAgainIds: ['vocab:b'], stars: 2 });
    expect(speedSessionEvent('food', sum)).toMatchObject({ stars: 2, caught: 1 });
  });
});
