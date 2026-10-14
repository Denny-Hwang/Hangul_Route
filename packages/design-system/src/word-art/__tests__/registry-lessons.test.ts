import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORD_ART, WORD_ART_KEYS, getWordArt } from '../registry';

/**
 * Lesson pictures outside the vocabulary topics (F-VOC-002 §3.9): Stage 2
 * Playground Words (F-CURR-001 S2-3) reads 그네, 미끄럼틀 and 모래, which no
 * topic file teaches. Their glyphs are `reserved`, so the one-user check and
 * the family plan leave them out; every other glyph rule (glyphs.test.ts)
 * holds for them.
 */
const LESSON_KEYS = ['sport-swing', 'sport-slide', 'nature-sand'] as const;

const VOCAB_DIR = join(__dirname, '..', '..', '..', '..', '..', 'content', 'vocab');
const topicVisuals = readdirSync(VOCAB_DIR)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .flatMap((name) => (JSON.parse(readFileSync(join(VOCAB_DIR, name), 'utf8')) as { items: { visual: string }[] }).items.map((i) => i.visual));

describe('lesson pictures (Playground Words)', () => {
  it.each(LESSON_KEYS)('%s is drawn, approved and reserved', (key) => {
    expect(getWordArt(key)!.length).toBeGreaterThan(0);
    expect(WORD_ART[key]!.meta).toEqual({ family: key.split('-')[0], status: 'approved', reserved: true });
  });

  it.each(LESSON_KEYS)('%s is used by no vocabulary topic (else it would not be reserved)', (key) => {
    expect(topicVisuals).not.toContain(`word:${key}`);
  });

  it('are the only reserved keys', () => {
    expect(WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.reserved === true).sort()).toEqual([...LESSON_KEYS].sort());
  });

  it('the swing hangs a red seat from two ropes under a frame; the slide has a ladder and a yellow chute; the sand has a bucket', () => {
    const fills = (key: string) => getWordArt(key)!.map((s) => s.f);
    expect(fills('sport-swing')).toContain('vocab.red');
    expect(getWordArt('sport-swing')!.filter((s) => s.t === 'rect')).toHaveLength(2);
    expect(fills('sport-slide')).toContain('vocab.yellow');
    expect(fills('nature-sand')).toEqual(expect.arrayContaining(['feedback.nudgeLight', 'vocab.red']));
  });
});
