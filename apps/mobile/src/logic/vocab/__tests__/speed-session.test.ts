import { describe, expect, it } from 'vitest';
import type { VocabFormat, VocabQuestion } from '../question-builder';
import {
  HINT_RING_MS,
  HINT_SOFT_MS,
  initSession,
  reduce,
  type SessionConfig,
  type SpeedEvent,
  type SpeedState,
} from '../speed-session';

// ---------- fixtures ----------

const FORMATS: readonly VocabFormat[] = ['word-to-image', 'audio-to-image', 'image-to-word'];

function question(index: number, itemId = `vocab:w${index}`): VocabQuestion {
  const format = FORMATS[index % FORMATS.length]!;
  const ids = [itemId, `vocab:d${index}a`, `vocab:d${index}b`, `vocab:d${index}c`];
  return {
    key: `q${index}:${itemId}:${format}`,
    itemId,
    format,
    prompt: { kind: 'word', ko: 'x', romanization: 'x' },
    options: ids.map((id) => ({ id, pictureRef: `word:${id}` })),
    answerId: itemId,
  };
}

const questions = (n: number): VocabQuestion[] => Array.from({ length: n }, (_, i) => question(i));

const relaxed = (n = 10, hintsEnabled = true): SessionConfig => ({ mode: 'relaxed', questions: questions(n), clockMs: null, hintsEnabled });
const challenge = (n = 40, clockMs = 60_000): SessionConfig => ({ mode: 'challenge', questions: questions(n), clockMs, hintsEnabled: false });

function run(cfg: SessionConfig, events: readonly SpeedEvent[], from: SpeedState = initSession(cfg)): SpeedState {
  return events.reduce((s, e) => reduce(s, e, cfg), from);
}

const right = (cfg: SessionConfig, s: SpeedState): SpeedEvent => ({ type: 'answer', optionId: cfg.questions[s.index]!.answerId });
const miss = (cfg: SessionConfig, s: SpeedState): SpeedEvent => ({ type: 'answer', optionId: cfg.questions[s.index]!.options[1]!.id });

// ---------- init / start ----------

describe('initSession and start (F-VOC-004 §3.4)', () => {
  it('starts ready with nothing counted', () => {
    const s = initSession(challenge());
    expect(s).toEqual({
      phase: 'ready',
      index: 0,
      sparks: 0,
      results: [],
      chosenId: null,
      hint: 'none',
      elapsedMs: 0,
      remainingMs: 60_000,
      totalActiveMs: 0,
      pauses: 0,
      pausedMs: 0,
      pendingPause: null,
      endedBy: null,
    });
    expect(initSession(relaxed()).remainingMs).toBeNull();
  });

  it('start opens question 0; the Challenge clock starts with the question, not the button', () => {
    const cfg = challenge();
    const ready = initSession(cfg);
    // Ticks before start count nothing.
    const s0 = reduce(ready, { type: 'tick', dtMs: 5_000 }, cfg);
    expect(s0).toBe(ready);
    const s = reduce(ready, { type: 'start' }, cfg);
    expect(s.phase).toBe('question');
    expect(s.index).toBe(0);
    expect(s.remainingMs).toBe(60_000);
    expect(s.elapsedMs).toBe(0);
  });

  it('start is ignored outside ready', () => {
    const cfg = relaxed();
    const s = run(cfg, [{ type: 'start' }]);
    expect(reduce(s, { type: 'start' }, cfg)).toBe(s);
  });

  it('a round with no questions ends at start without a result', () => {
    const cfg = relaxed(0);
    const s = run(cfg, [{ type: 'start' }]);
    expect(s.phase).toBe('done');
    expect(s.endedBy).toBe('questions');
    expect(s.results).toEqual([]);
  });
});

// ---------- answer ----------

describe('answer: the first tap decides (S5) and only a right answer lights a spark (S3)', () => {
  it('a right answer records a result, lights one spark and opens the reveal', () => {
    const cfg = relaxed();
    let s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 1_500 }]);
    s = reduce(s, right(cfg, s), cfg);
    expect(s.phase).toBe('reveal');
    expect(s.sparks).toBe(1);
    expect(s.chosenId).toBe('vocab:w0');
    expect(s.results).toEqual([{ itemId: 'vocab:w0', format: 'word-to-image', correct: true, hinted: false, ms: 1_500 }]);
  });

  it('a miss records the tap, leaves the meter as it was and opens the reveal', () => {
    const cfg = relaxed();
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'reveal-done' }, cfg);
    s = reduce(s, miss(cfg, s), cfg);
    expect(s.phase).toBe('reveal');
    expect(s.sparks).toBe(1);
    expect(s.chosenId).toBe('vocab:d1a');
    expect(s.results[1]).toEqual({ itemId: 'vocab:w1', format: 'audio-to-image', correct: false, hinted: false, ms: 0 });
  });

  it('a second tap during the reveal is ignored', () => {
    const cfg = relaxed();
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, miss(cfg, s), cfg);
    const again = reduce(s, { type: 'answer', optionId: 'vocab:w0' }, cfg);
    expect(again).toBe(s);
  });

  it('an id that is not one of the options is not a tap', () => {
    const cfg = relaxed();
    const s = run(cfg, [{ type: 'start' }]);
    expect(reduce(s, { type: 'answer', optionId: 'vocab:elsewhere' }, cfg)).toBe(s);
  });

  it('answers outside a question are ignored', () => {
    const cfg = relaxed();
    const ready = initSession(cfg);
    expect(reduce(ready, { type: 'answer', optionId: 'vocab:w0' }, cfg)).toBe(ready);
  });
});

// ---------- reveal-done ----------

describe('reveal-done', () => {
  it('moves to the next question with a clean slate', () => {
    const cfg = relaxed();
    let s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 13_000 }]);
    expect(s.hint).toBe('soft');
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'reveal-done' }, cfg);
    expect(s).toMatchObject({ phase: 'question', index: 1, chosenId: null, elapsedMs: 0, hint: 'none' });
  });

  it('after the last question the round is done by questions', () => {
    const cfg = relaxed(2);
    let s = run(cfg, [{ type: 'start' }]);
    for (let i = 0; i < 2; i += 1) {
      s = reduce(s, right(cfg, s), cfg);
      s = reduce(s, { type: 'reveal-done' }, cfg);
    }
    expect(s.phase).toBe('done');
    expect(s.endedBy).toBe('questions');
    expect(s.results).toHaveLength(2);
    expect(s.index).toBe(1);
  });

  it('is ignored outside the reveal', () => {
    const cfg = relaxed();
    const s = run(cfg, [{ type: 'start' }]);
    expect(reduce(s, { type: 'reveal-done' }, cfg)).toBe(s);
  });
});

// ---------- tick / clock ----------

describe('tick: active time only (S2)', () => {
  it('adds to the question and total time; Challenge counts the clock down', () => {
    const cfg = challenge();
    const s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 250 }, { type: 'tick', dtMs: 1_000 }]);
    expect(s.elapsedMs).toBe(1_250);
    expect(s.totalActiveMs).toBe(1_250);
    expect(s.remainingMs).toBe(58_750);
  });

  it('Relaxed never has a clock', () => {
    const cfg = relaxed();
    const s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 120_000 }]);
    expect(s.remainingMs).toBeNull();
    expect(s.phase).toBe('question');
  });

  it('the clock does not run during the reveal: a miss costs no time (behaviour 7)', () => {
    const cfg = challenge();
    let s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 2_000 }]);
    s = reduce(s, miss(cfg, s), cfg);
    const before = s.remainingMs;
    const during = run(cfg, [{ type: 'tick', dtMs: 250 }, { type: 'tick', dtMs: 250 }, { type: 'tick', dtMs: 250 }, { type: 'tick', dtMs: 250 }], s);
    expect(during).toBe(s);
    expect(during.remainingMs).toBe(before);
  });

  it('ignores negative and non-finite deltas', () => {
    const cfg = challenge();
    const s = run(cfg, [{ type: 'start' }]);
    expect(reduce(s, { type: 'tick', dtMs: -100 }, cfg)).toBe(s);
    expect(reduce(s, { type: 'tick', dtMs: Number.NaN }, cfg)).toBe(s);
    expect(reduce(s, { type: 'tick', dtMs: 0 }, cfg)).toBe(s);
  });

  it('time-out ends the round and records nothing for the question on screen (S2, behaviour 6)', () => {
    const cfg = challenge(40, 3_000);
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'reveal-done' }, cfg);
    s = run(cfg, [{ type: 'tick', dtMs: 2_000 }, { type: 'tick', dtMs: 2_000 }], s);
    expect(s.phase).toBe('done');
    expect(s.endedBy).toBe('clock');
    expect(s.remainingMs).toBe(0);
    expect(s.results).toHaveLength(1);
    expect(s.results.every((r) => r.correct)).toBe(true);
    expect(s.sparks).toBe(1);
  });

  it('ends exactly at zero', () => {
    const cfg = challenge(40, 1_000);
    const s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 1_000 }]);
    expect(s).toMatchObject({ phase: 'done', endedBy: 'clock', remainingMs: 0, results: [] });
  });

  it('a Challenge round can still end by questions before the clock', () => {
    const cfg = challenge(1);
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'reveal-done' }, cfg);
    expect(s.endedBy).toBe('questions');
    expect(s.remainingMs).toBe(60_000);
  });
});

describe('hints (Relaxed only, §3.6)', () => {
  it('soft at 12 s and a ring at 20 s', () => {
    expect(HINT_SOFT_MS).toBe(12_000);
    expect(HINT_RING_MS).toBe(20_000);
    const cfg = relaxed();
    let s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 11_999 }]);
    expect(s.hint).toBe('none');
    s = reduce(s, { type: 'tick', dtMs: 1 }, cfg);
    expect(s.hint).toBe('soft');
    s = run(cfg, [{ type: 'tick', dtMs: 7_999 }], s);
    expect(s.hint).toBe('soft');
    s = reduce(s, { type: 'tick', dtMs: 1 }, cfg);
    expect(s.hint).toBe('ring');
  });

  it('a hinted right answer lights a spark and is marked hinted', () => {
    const cfg = relaxed();
    let s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 12_500 }]);
    s = reduce(s, right(cfg, s), cfg);
    expect(s.sparks).toBe(1);
    expect(s.results[0]).toMatchObject({ correct: true, hinted: true, ms: 12_500 });
  });

  it('no hints when they are off (a screen reader is on)', () => {
    const cfg = relaxed(10, false);
    const s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 30_000 }]);
    expect(s.hint).toBe('none');
  });

  it('Challenge never hints, even if asked to', () => {
    const cfg: SessionConfig = { ...challenge(40, 120_000), hintsEnabled: true };
    const s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 25_000 }]);
    expect(s.hint).toBe('none');
  });
});

// ---------- pause / resume ----------

describe('pause and resume (§3.4, behaviour 8)', () => {
  it('a paused Challenge round never expires and resumes with the same time left', () => {
    const cfg = challenge();
    let s = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 5_000 }]);
    s = reduce(s, { type: 'pause', reason: 'background' }, cfg);
    expect(s).toMatchObject({ phase: 'paused', resumePhase: 'question', pauses: 1 });
    const frozen = run(cfg, [{ type: 'tick', dtMs: 2_000 }, { type: 'tick', dtMs: 2_000 }], s);
    expect(frozen).toBe(s);
    expect(reduce(s, { type: 'answer', optionId: 'vocab:w0' }, cfg)).toBe(s);
    s = reduce(s, { type: 'resume', pausedMs: 90_000 }, cfg);
    expect(s).toMatchObject({ phase: 'question', remainingMs: 55_000, pausedMs: 90_000, elapsedMs: 5_000 });
    expect(s.resumePhase).toBeUndefined();
  });

  it('resume without a wall time adds nothing', () => {
    const cfg = challenge();
    const s = run(cfg, [{ type: 'start' }, { type: 'pause', reason: 'user' }, { type: 'resume' }]);
    expect(s.pausedMs).toBe(0);
    const bad = run(cfg, [{ type: 'start' }, { type: 'pause', reason: 'user' }, { type: 'resume', pausedMs: -4 }]);
    expect(bad.pausedMs).toBe(0);
  });

  it('a pause during the reveal waits for the reveal, then pauses on the next question', () => {
    const cfg = challenge();
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'pause', reason: 'background' }, cfg);
    expect(s.phase).toBe('reveal');
    expect(s.pendingPause).toBe('background');
    expect(reduce(s, { type: 'pause', reason: 'user' }, cfg)).toBe(s);
    s = reduce(s, { type: 'reveal-done' }, cfg);
    expect(s).toMatchObject({ phase: 'paused', resumePhase: 'question', index: 1, pauses: 1, pendingPause: null, chosenId: null });
    s = reduce(s, { type: 'resume' }, cfg);
    expect(s.phase).toBe('question');
  });

  it('coming back before the reveal ends cancels the queued pause', () => {
    const cfg = challenge();
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'pause', reason: 'background' }, cfg);
    s = reduce(s, { type: 'resume' }, cfg);
    expect(s.pendingPause).toBeNull();
    s = reduce(s, { type: 'reveal-done' }, cfg);
    expect(s.phase).toBe('question');
    expect(s.pauses).toBe(0);
  });

  it('a queued pause is dropped when the round ends at that reveal', () => {
    const cfg = challenge(1);
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    s = reduce(s, { type: 'pause', reason: 'user' }, cfg);
    s = reduce(s, { type: 'reveal-done' }, cfg);
    expect(s).toMatchObject({ phase: 'done', endedBy: 'questions', pendingPause: null, pauses: 0 });
  });

  it('Relaxed has no clock, so it never pauses', () => {
    const cfg = relaxed();
    const s = run(cfg, [{ type: 'start' }]);
    expect(reduce(s, { type: 'pause', reason: 'background' }, cfg)).toBe(s);
  });

  it('pause and resume are ignored where they mean nothing', () => {
    const cfg = challenge();
    const ready = initSession(cfg);
    expect(reduce(ready, { type: 'pause', reason: 'user' }, cfg)).toBe(ready);
    const q = run(cfg, [{ type: 'start' }]);
    expect(reduce(q, { type: 'resume' }, cfg)).toBe(q);
    const paused = reduce(q, { type: 'pause', reason: 'user' }, cfg);
    expect(reduce(paused, { type: 'pause', reason: 'user' }, cfg)).toBe(paused);
    const reveal = reduce(q, right(cfg, q), cfg);
    expect(reduce(reveal, { type: 'resume' }, cfg)).toBe(reveal);
  });
});

// ---------- quit / done ----------

describe('quit and the absorbing done', () => {
  it('quit ends the round from any live phase and keeps the answers already given', () => {
    const cfg = challenge();
    let s = run(cfg, [{ type: 'start' }]);
    s = reduce(s, right(cfg, s), cfg);
    for (const from of [initSession(cfg), run(cfg, [{ type: 'start' }]), s, run(cfg, [{ type: 'start' }, { type: 'pause', reason: 'user' }])]) {
      const q = reduce(from, { type: 'quit' }, cfg);
      expect(q.phase).toBe('done');
      expect(q.endedBy).toBe('quit');
      expect(q.results).toBe(from.results);
    }
  });

  it('after done every event but quit is a no-op returning the same object', () => {
    const cfg = challenge(40, 500);
    const done = run(cfg, [{ type: 'start' }, { type: 'tick', dtMs: 600 }]);
    for (const e of [
      { type: 'start' },
      { type: 'tick', dtMs: 100 },
      { type: 'answer', optionId: 'vocab:w0' },
      { type: 'reveal-done' },
      { type: 'pause', reason: 'user' },
      { type: 'resume' },
    ] as SpeedEvent[]) {
      expect(reduce(done, e, cfg)).toBe(done);
    }
    const quit = reduce(done, { type: 'quit' }, cfg);
    expect(quit.endedBy).toBe('quit');
    expect(reduce(quit, { type: 'quit' }, cfg)).toBe(quit);
  });
});

// ---------- invariants over random sequences ----------

/** A small seeded generator, so each failing sequence can be replayed by its seed. */
function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x1_0000_0000;
  };
}

function randomEvent(next: () => number, cfg: SessionConfig, s: SpeedState): SpeedEvent {
  const q = cfg.questions[Math.min(s.index, cfg.questions.length - 1)];
  const roll = next();
  if (roll < 0.03) return { type: 'start' };
  if (roll < 0.45) return { type: 'tick', dtMs: Math.floor(next() * 2_400) - 100 };
  if (roll < 0.7 && q !== undefined) return { type: 'answer', optionId: q.options[Math.floor(next() * q.options.length)]!.id };
  if (roll < 0.85) return { type: 'reveal-done' };
  if (roll < 0.91) return { type: 'pause', reason: next() < 0.5 ? 'user' : 'background' };
  if (roll < 0.98) return { type: 'resume', pausedMs: Math.floor(next() * 5_000) };
  return { type: 'quit' };
}

describe('invariants over 500 seeded random event sequences (§3.4)', () => {
  it('hold after every step', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const next = rng(seed);
      const cfg = next() < 0.5 ? challenge(12, 5_000 + Math.floor(next() * 20_000)) : relaxed(8 + Math.floor(next() * 4), next() < 0.5);
      let s = reduce(initSession(cfg), { type: 'start' }, cfg);
      let wasDone = false;
      for (let step = 0; step < 120; step += 1) {
        const event = randomEvent(next, cfg, s);
        const prev = s;
        s = reduce(prev, event, cfg);
        const label = `seed ${seed} step ${step} ${JSON.stringify(event)}`;

        expect(s.sparks, label).toBeGreaterThanOrEqual(prev.sparks);
        expect(s.sparks, label).toBe(s.results.filter((r) => r.correct).length);
        expect(s.results.length, label).toBeLessThanOrEqual(cfg.questions.length);
        if (cfg.clockMs === null) expect(s.remainingMs, label).toBeNull();
        else {
          expect(s.remainingMs!, label).toBeLessThanOrEqual(prev.remainingMs!);
          expect(s.remainingMs!, label).toBeGreaterThanOrEqual(0);
        }
        if (wasDone) {
          expect(s.phase, label).toBe('done');
          if (event.type !== 'quit') expect(s, label).toBe(prev);
        }
        // A result is added only by the learner's own tap on a shown question.
        if (s.results.length > prev.results.length) {
          expect(event.type, label).toBe('answer');
          expect(s.results.length, label).toBe(prev.results.length + 1);
          expect(prev.phase, label).toBe('question');
        }
        if (s.endedBy === 'clock' && prev.endedBy !== 'clock') {
          // Time-out added nothing: the last result was given before expiry.
          expect(s.results, label).toBe(prev.results);
        }
        wasDone = s.phase === 'done';
      }
    }
  });
});
