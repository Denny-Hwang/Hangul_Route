import { describe, expect, it } from 'vitest';
import { storiesAll } from '../../../content/stories';
import { checkGameItems } from '../../story/check-game';
import type { CheckView } from '../../story/check-view';
import { askedOfCheck, askedOfCheckpoint, resolveRound } from '../resolve';

/** F-CURR-002 section 4.3, row CM-12: what a story check and a reader checkpoint asked, for the memory store. */

const view = (over: Partial<CheckView>): CheckView => ({
  checkId: 'c1',
  kind: 'pick-meaning',
  promptParts: [],
  targetInline: false,
  hideTargetGloss: true,
  options: [
    { id: 'a', ko: '사과', isCorrect: true },
    { id: 'b', en: 'pear', isCorrect: false },
  ],
  correctOptionId: 'a',
  ...over,
});

describe('askedOfCheck', () => {
  it('asks one item, as reading: the Korean target, else a Korean right answer', () => {
    expect(askedOfCheck(view({ target: { ko: '배', romanization: 'bae', en: 'pear' } }))).toEqual({ texts: [{ ko: '배' }], jamoIds: [], rung: 'read' });
    expect(resolveRound({ check: view({}) })).toEqual({ texts: [{ ko: '사과' }], jamoIds: [], rung: 'read' });
  });

  it('a check with no Korean asks nothing', () => {
    expect(askedOfCheck(view({ options: [{ id: 'a', en: 'yes', isCorrect: true }] }))).toBeUndefined();
    expect(askedOfCheck(undefined)).toBeUndefined();
  });

  it('every check of the shipped stories reads without error', () => {
    for (const story of storiesAll) for (const tier of story.tiers) for (const item of checkGameItems(story, tier.level)) askedOfCheck(item);
  });
});

describe('askedOfCheckpoint', () => {
  // A shipped story with one of its checks also used as a checkpoint of its tier.
  const base = storiesAll.find((s) => s.tiers.some((t) => t.checks.some((c) => c.target !== undefined)));
  const baseTier = base?.tiers.find((t) => t.checks.some((c) => c.target !== undefined));
  const checkpoint = baseTier?.checks.find((c) => c.target !== undefined);
  const tier = baseTier && checkpoint ? { ...baseTier, checkpoints: [{ ...checkpoint, id: 'cp-one' }] } : undefined;
  const story = base && tier ? { ...base, tiers: base.tiers.map((t) => (t.level === tier.level ? tier : t)) } : undefined;

  it('reads a reader checkpoint by its round key', () => {
    expect(story && tier && checkpoint).toBeTruthy();
    const asked = resolveRound({ checkpoint: { story, level: tier?.level ?? 'listen', roundKey: 'cp:cp-one' } });
    expect(asked?.texts[0]?.ko).toBe(checkpoint?.target?.ko);
    expect(asked?.rung).toBe('read');
  });

  it('an unknown key, another namespace or no story asks nothing', () => {
    expect(askedOfCheckpoint({ story, level: tier?.level ?? 'listen', roundKey: 'cp:nope' })).toBeUndefined();
    expect(askedOfCheckpoint({ story, level: tier?.level ?? 'listen', roundKey: 'check:x' })).toBeUndefined();
    expect(askedOfCheckpoint({ story: undefined, level: 'listen', roundKey: 'cp:x' })).toBeUndefined();
  });
});
