import { describe, expect, it } from 'vitest';
import { CHOOSER_KEY_RE, CHOOSER_PAGE, HOME_DEFAULT, lengthOf, parseHomeSnapshot, type HomeSnapshot } from '../home-state';

/**
 * The presenter home's kept state (AMENDMENTS-LECTURE-V2 section 18.2, row LV-3): ids and chip
 * values only, read back field by field, so a damaged or hand-edited history state can never bring
 * a name or a bad value back to the home.
 */

const full: HomeSnapshot = {
  open: 'by-stage',
  lengths: { 'by-stage': 30, 'word-review': 20 },
  stage: 'stage3',
  customize: true,
  tab: 'topics',
  chooserStage: 'stage2',
  chosen: ['episode:stage2-letters', 'quest:stage1-life-q1', 'story:hangeul-day', 'vocab-topic:k-culture', 'letters:vowels'],
  expanded: ['episode:stage2-letters'],
  more: { stories: 16, topics: 8 },
  scrollY: 1240,
};

describe('parseHomeSnapshot', () => {
  it('round-trips a full state through JSON (history.state is structured-cloned)', () => {
    expect(parseHomeSnapshot(JSON.parse(JSON.stringify(full)))).toEqual(full);
  });

  it('reads nothing from a non-object', () => {
    for (const raw of [null, undefined, 'x', 3, []]) expect(parseHomeSnapshot(raw)).toBeNull();
    expect(parseHomeSnapshot({})).toEqual(HOME_DEFAULT);
  });

  it('drops every value outside its grammar: names, unknown presets, lengths a preset does not offer, bad stages and tabs', () => {
    const read = parseHomeSnapshot({
      open: 'Minho',
      lengths: { 'warm-up': 20, 'word-review': 30, 'story-time': 10, Suni: 10 },
      stage: 'stage9',
      customize: 'yes',
      tab: 'names',
      chooserStage: 3,
      chosen: ['Minho', 'quest:stage1-life-q1', 'quest:stage1-life-q1', 'quest:STAGE', `quest:${'a'.repeat(70)}`, 42],
      expanded: ['quest:stage1-life-q1', 'episode:stage1-life'],
      more: { stories: -3, topics: 1e9 },
      scrollY: Number.NaN,
    });
    expect(read).toEqual({
      ...HOME_DEFAULT,
      lengths: { 'story-time': 10 },
      chosen: ['quest:stage1-life-q1'],
      expanded: ['episode:stage1-life'],
      more: { stories: CHOOSER_PAGE, topics: 999 },
    });
  });

  it('keeps at most a deck\'s worth of choices and never a page below 8 rows', () => {
    const many = Array.from({ length: 200 }, (_, i) => `quest:stage2-life-q${i}`);
    expect(parseHomeSnapshot({ chosen: many })!.chosen).toHaveLength(120);
    expect(parseHomeSnapshot({ more: { stories: 2, topics: 24 } })!.more).toEqual({ stories: 8, topics: 24 });
  });

  it('the key grammar matches the chooser keys and nothing else', () => {
    for (const key of ['episode:stage1-letters', 'quest:stage2-letters-q6', 'story:hangeul-day', 'vocab-topic:k-culture', 'letters:consonants']) expect(CHOOSER_KEY_RE.test(key), key).toBe(true);
    for (const key of ['episode:stage8-letters', 'card:x', 'letters:all', 'quest:', 'Minho', 'story:Hangeul']) expect(CHOOSER_KEY_RE.test(key), key).toBe(false);
  });
});

describe('lengthOf', () => {
  it('is the chip the teacher chose, else the preset default', () => {
    expect(lengthOf(full, 'by-stage', 20)).toBe(30);
    expect(lengthOf(full, 'story-time', 20)).toBe(20);
  });
});
