import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { STORY_CHECK_COPY } from '../copy';

type Msg = string | ((...args: never[]) => string);

/** Every string the copy can render, calling each function message with sample arguments. */
function allStrings(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (typeof node === 'function') {
      for (const args of [[0, 0], [1, 1], [2, 3], ['Seollal'], ['Seollal', 2]]) {
        const text = (node as (...a: unknown[]) => unknown)(...args);
        if (typeof text === 'string') out.push(text);
      }
    } else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(STORY_CHECK_COPY);
  return out;
}

describe('STORY_CHECK_COPY', () => {
  const strings = allStrings();

  it('has strings to scan', () => {
    expect(strings.length).toBeGreaterThan(30);
  });

  it('passes the anti-shame banned-word scan', () => {
    expect(scanLearnerCopy(strings)).toEqual([]);
  });

  it('has no Hangul, emoji or HTML entities in rendered text', () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/[ㄱ-㆏가-힣]/);
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s, s).not.toMatch(/&[a-z]+;/);
      expect(s.trim(), s).toBe(s);
      expect(s.length, s).toBeGreaterThan(0);
    }
  });

  it('uses the wireframe wording for the key moments', () => {
    expect(STORY_CHECK_COPY.check.tryAnother).toBe('Try another');
    expect(STORY_CHECK_COPY.check.next).toBe('Next');
    expect(STORY_CHECK_COPY.sequence.title).toBe('Put the story in order');
    expect(STORY_CHECK_COPY.sequence.skip).toBe('Skip this one');
    expect(STORY_CHECK_COPY.recap.title).toBe('Words from this story');
    expect(STORY_CHECK_COPY.results.nextStory).toBe('Next story');
    expect(STORY_CHECK_COPY.results.readAgain).toBe('Read it again');
    expect(STORY_CHECK_COPY.results.episodePage).toBe('Episode page');
    expect(STORY_CHECK_COPY.results.backHome).toBe('Back home');
  });

  it('never uses red-and-cross wording for a wrong tap (D3)', () => {
    const wrongSide = [
      STORY_CHECK_COPY.check.tryAnother,
      STORY_CHECK_COPY.check.defaultHint,
      STORY_CHECK_COPY.check.lookHere,
    ].join(' ');
    expect(wrongSide).not.toMatch(/wrong|incorrect|error|mistake|fail/i);
  });

  it('pluralises function messages', () => {
    expect(STORY_CHECK_COPY.check.position(2, 3)).toBe('2 / 3');
    expect(STORY_CHECK_COPY.check.positionLabel(2, 3)).toBe('Question 2 of 3');
    expect(STORY_CHECK_COPY.sequence.positionLabel(1, 4)).toBe('Picture 1 of 4');
    expect(STORY_CHECK_COPY.sequence.slotLabel(2, 4)).toBe('Place 2 of 4, empty');
    expect(STORY_CHECK_COPY.sequence.slotLabel(2, 4, 'Eat')).toBe('Place 2 of 4: Eat');
    expect(STORY_CHECK_COPY.sequence.stepHint).toMatch(/^Tap each step/);
    expect(STORY_CHECK_COPY.recap.wordsLabel(1)).toBe('1 word from this story');
    expect(STORY_CHECK_COPY.recap.wordsLabel(3)).toBe('3 words from this story');
    expect(STORY_CHECK_COPY.recap.hearWord('seollal')).toBe('Hear seollal');
  });

  it('keeps the Msg type honest (strings and functions only)', () => {
    const walk = (node: unknown): void => {
      if (node && typeof node === 'object') Object.values(node).forEach(walk);
      else expect(['string', 'function']).toContain(typeof node);
    };
    walk(STORY_CHECK_COPY);
    const sample: Msg = STORY_CHECK_COPY.check.next;
    expect(sample).toBe('Next');
  });
});
