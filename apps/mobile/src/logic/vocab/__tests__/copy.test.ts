import { VOCAB_AGE_WORDS } from '@hangul-route/content-schema';
import { getMessages, type Messages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { speedActivityLine, summaryPrimaryLabel, vocabCopyOf } from '../copy';

const m: Messages = getMessages('en');
const copy = vocabCopyOf(m);

/** Arguments for each function message under `learner.vocab`; a new function message needs a row. */
const SAMPLE_ARGS: Record<string, readonly (readonly unknown[])[]> = {
  'library.collected': [[0], [1], [12]],
  'topics.collected': [[0], [5]],
  'topics.tileA11y': [['Food', 1], ['Food', 5]],
  'topics.lockedA11y': [['Food']],
  'topic.collected': [[0], [5]],
  'topic.speed.needMore': [[1], [3], [4]],
  'cards.summary.newlyCollected': [[0], [1], [3]],
  'speed.nudge.right.named': [['apple']],
  'speed.nudge.miss.first': [['apple']],
  'speed.nudge.miss.second': [['apple']],
  'speed.relaxed.line': [[8], [10]],
  'speed.results.caught': [[0], [1], [7]],
};

function render(node: unknown, path: string, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node);
  } else if (typeof node === 'function') {
    const rows = SAMPLE_ARGS[path];
    expect(rows, `${path} needs a row in SAMPLE_ARGS`).toBeDefined();
    for (const args of rows ?? []) out.push((node as (...a: unknown[]) => string)(...args));
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => render(v, `${path}.${i}`, out));
  } else if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) render(v, path === '' ? k : `${path}.${k}`, out);
  }
}

const ALL: string[] = [];
render(copy, '', ALL);

describe('vocabulary learner copy (F-VOC-003 section 3.2, D1, D3)', () => {
  it('reads the learner.vocab dictionary', () => {
    expect(copy).toBe(m.learner.vocab);
    expect(ALL.length).toBeGreaterThan(40);
  });

  it('passes the anti-shame scan', () => {
    expect(scanLearnerCopy(ALL)).toEqual([]);
  });

  it('never prints a percentage or a fraction', () => {
    for (const s of ALL) {
      expect(s, s).not.toMatch(/\d+\s*%/);
      expect(s, s).not.toMatch(/\d+\s*\/\s*\d+/);
    }
  });

  it('has no age word and no emoji', () => {
    for (const s of ALL) {
      for (const w of VOCAB_AGE_WORDS) expect(s.toLowerCase(), s).not.toContain(w);
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('counts words in the singular for one', () => {
    expect(copy.topics.tileA11y('Food', 1)).toBe('Food. 1 word collected.');
    expect(copy.topics.tileA11y('Food', 5)).toBe('Food. 5 words collected.');
    expect(copy.cards.summary.newlyCollected(1)).toBe('1 new word collected');
    expect(copy.cards.summary.newlyCollected(3)).toBe('3 new words collected');
  });
});

describe('copy helpers', () => {
  it('labels the summary button by its action', () => {
    expect(summaryPrimaryLabel(copy, { kind: 'next', chunk: 1 })).toBe('Next words');
    expect(summaryPrimaryLabel(copy, { kind: 'review', chunk: 0 })).toBe('Review these');
  });

  it('the Speed round line names the words still to learn until it is available, never a dead end', () => {
    expect(speedActivityLine(copy, 4, 4)).toBe('Catch the words you know.');
    expect(speedActivityLine(copy, 6, 4)).toBe('Catch the words you know.');
    expect(speedActivityLine(copy, 0, 4)).toBe('Learn 4 words first');
    expect(speedActivityLine(copy, 1, 4)).toBe('Learn 3 words first');
    expect(speedActivityLine(copy, 3, 4)).toBe('Learn 1 word first');
    expect(speedActivityLine(copy, 0, 3)).toBe('Learn 3 words first');
  });
});
