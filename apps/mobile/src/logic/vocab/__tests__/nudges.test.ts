import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { SPARK_MILESTONES, nudgeFor, type Nudge, type NudgeEvent } from '../nudges';

const COPY = getMessages('en').learner.vocab.speed;
const GLOSSES = ['apple', 'eye', 'red', 'three'];

/** Every line `nudgeFor` can produce, over every event, spark count and seed it can see. */
function everyNudge(): Nudge[] {
  const out: Nudge[] = [];
  const events: NudgeEvent[] = [{ kind: 'idle' }, { kind: 'start' }];
  for (const gloss of GLOSSES) events.push({ kind: 'right', gloss }, { kind: 'miss', gloss });
  for (const stars of [1, 2, 3] as const) for (const firstTryCorrect of [0, 1, 5]) events.push({ kind: 'results', stars, firstTryCorrect });
  for (const event of events) for (let sparks = 0; sparks <= 40; sparks += 1) for (const seed of [0, 1, 2, 7]) out.push(nudgeFor(event, sparks, seed, COPY));
  return out;
}

describe('nudgeFor (F-VOC-004 §3.7)', () => {
  it('a right answer cheers, sometimes naming the word', () => {
    const lines = new Set([0, 1, 2].map((seed) => nudgeFor({ kind: 'right', gloss: 'apple' }, 1, seed, COPY).line));
    expect(lines).toEqual(new Set(['Got it!', 'Nice catch.', 'Yes, apple!']));
    expect(nudgeFor({ kind: 'right', gloss: 'apple' }, 1, 0, COPY).pose).toBe('cheering');
  });

  it('milestones at 3, 5, 8 and 10 sparks replace the right-answer line', () => {
    expect([...SPARK_MILESTONES]).toEqual([3, 5, 8, 10]);
    const at = (sparks: number): Nudge => nudgeFor({ kind: 'right', gloss: 'apple' }, sparks, 4, COPY);
    expect(at(3)).toEqual({ pose: 'cheering', line: '3 sparks!' });
    expect(at(5)).toEqual({ pose: 'cheering', line: 'Look at that glow.' });
    expect(at(8)).toEqual({ pose: 'cheering', line: 'Your sparks are shining.' });
    expect(at(10)).toEqual({ pose: 'cheering', line: 'Full of sparks!' });
    for (const sparks of [1, 2, 4, 6, 7, 9, 11, 30]) expect(Object.values(COPY.nudge.milestone)).not.toContain(at(sparks).line);
  });

  it('a gentle miss uses Hoya thinking and names the right word', () => {
    const a = nudgeFor({ kind: 'miss', gloss: 'apple' }, 2, 0, COPY);
    const b = nudgeFor({ kind: 'miss', gloss: 'apple' }, 2, 1, COPY);
    expect(a.pose).toBe('thinking');
    expect(new Set([a.line, b.line])).toEqual(new Set(['That one is apple. Next time!', 'Good try. Now you know apple.']));
  });

  it('idle and start lines', () => {
    expect(nudgeFor({ kind: 'idle' }, 0, 0, COPY)).toEqual({ pose: 'idle', line: 'Take your time.' });
    expect(nudgeFor({ kind: 'start' }, 0, 0, COPY)).toEqual({ pose: 'idle', line: 'Ready when you are.' });
  });

  it('results by stars, and the F-RVW-001 line when nothing was right first try', () => {
    expect(nudgeFor({ kind: 'results', stars: 3, firstTryCorrect: 9 }, 9, 0, COPY)).toEqual({ pose: 'cheering', line: 'Wow, a bright round!' });
    expect(nudgeFor({ kind: 'results', stars: 2, firstTryCorrect: 6 }, 6, 0, COPY)).toEqual({ pose: 'cheering', line: 'Nice round.' });
    expect(nudgeFor({ kind: 'results', stars: 1, firstTryCorrect: 2 }, 2, 0, COPY)).toEqual({ pose: 'idle', line: 'Good round. Every word helps.' });
    expect(nudgeFor({ kind: 'results', stars: 1, firstTryCorrect: 0 }, 1, 0, COPY)).toEqual({
      pose: 'thinking',
      line: 'Good try! You collected a star!',
    });
  });

  it('reads a negative, fractional or non-finite seed safely', () => {
    const base = nudgeFor({ kind: 'miss', gloss: 'apple' }, 0, 1, COPY);
    expect(nudgeFor({ kind: 'miss', gloss: 'apple' }, 0, -1, COPY)).toEqual(base);
    expect(nudgeFor({ kind: 'miss', gloss: 'apple' }, 0, 1.7, COPY)).toEqual(base);
    expect(nudgeFor({ kind: 'miss', gloss: 'apple' }, 0, Number.NaN, COPY)).toEqual(nudgeFor({ kind: 'miss', gloss: 'apple' }, 0, 0, COPY));
    expect(nudgeFor({ kind: 'miss', gloss: 'apple' }, Number.POSITIVE_INFINITY, 0, COPY).pose).toBe('thinking');
  });

  it('never plays the same line twice in a row over a round of answers', () => {
    // seed = the number of answers already given; sparks = the meter after this answer.
    for (let pattern = 0; pattern < 1 << 12; pattern += 1) {
      let sparks = 0;
      let previous: string | null = null;
      for (let answer = 0; answer < 12; answer += 1) {
        const right = (pattern >> answer) & 1;
        if (right === 1) sparks += 1;
        const { line } = nudgeFor(right === 1 ? { kind: 'right', gloss: 'apple' } : { kind: 'miss', gloss: 'apple' }, sparks, answer, COPY);
        expect(line, `pattern ${pattern.toString(2)} answer ${answer}`).not.toBe(previous);
        previous = line;
      }
    }
  });
});

describe('the lines a learner can read (§3.7 "never produced")', () => {
  const lines = everyNudge().map((n) => n.line);

  it('has lines to scan', () => {
    expect(new Set(lines).size).toBeGreaterThan(15);
  });

  it('passes the anti-shame banned-word scan', () => {
    expect(scanLearnerCopy(lines)).toEqual([]);
  });

  it('holds no percentage, ratio or fraction', () => {
    for (const line of lines) {
      expect(line).not.toMatch(/\d+\s*%/);
      expect(line).not.toMatch(/\d+\s*\/\s*\d+/);
    }
  });

  it('never says streak, combo, lives, lose, lost, wrong or fail, nor names an age', () => {
    for (const line of lines) {
      expect(line).not.toMatch(/\b(streaks?|combos?|lives|lose|lost|wrong|fail\w*)\b/i);
      expect(line).not.toMatch(/\b(kids?|child(ren)?|ages?|years? old|adults?)\b/i);
    }
  });

  it('has no Hangul or emoji (taught words come in as the gloss only)', () => {
    for (const line of lines) {
      expect(line).not.toMatch(/[ㄱ-㆏가-힣]/);
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
