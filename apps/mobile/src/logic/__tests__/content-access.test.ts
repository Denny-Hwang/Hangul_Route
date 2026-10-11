import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Story } from '@hangul-route/content-schema';
import {
  FREE_STAGE_KEYS,
  FREE_VOCAB_TOPIC_IDS,
  isContentLocked,
  isFreeContent,
  type FreeContentRegistry,
} from '../content-access';
import { isStageEntitled, type Tier } from '../entitlement';

const registry: FreeContentRegistry = {
  stages: new Set(['stage1', 'stage9']),
  vocabTopics: new Set(['food']),
  samplerStories: new Set(['story:free-one']),
};

describe('free-set constants', () => {
  it('pins the intended free set', () => {
    expect([...FREE_STAGE_KEYS]).toEqual(['stage1']);
    expect([...FREE_VOCAB_TOPIC_IDS]).toEqual(['food', 'animals', 'colors', 'numbers']);
  });
});

describe('isFreeContent (injected registry)', () => {
  it('reads each kind from its own set', () => {
    expect(isFreeContent('stage', 'stage9', registry)).toBe(true);
    expect(isFreeContent('stage', 'stage2', registry)).toBe(false);
    expect(isFreeContent('vocab-topic', 'food', registry)).toBe(true);
    expect(isFreeContent('vocab-topic', 'animals', registry)).toBe(false);
    expect(isFreeContent('story', 'story:free-one', registry)).toBe(true);
    expect(isFreeContent('story', 'story:other', registry)).toBe(false);
  });

  it('does not mix kinds', () => {
    expect(isFreeContent('story', 'food', registry)).toBe(false);
    expect(isFreeContent('stage', 'story:free-one', registry)).toBe(false);
    expect(isFreeContent('vocab-topic', 'stage1', registry)).toBe(false);
  });
});

describe('isFreeContent (default registry)', () => {
  it('opens stage 1 and the four vocab topics', () => {
    expect(isFreeContent('stage', 'stage1')).toBe(true);
    expect(isFreeContent('stage', 'stage2')).toBe(false);
    for (const id of FREE_VOCAB_TOPIC_IDS) expect(isFreeContent('vocab-topic', id)).toBe(true);
    expect(isFreeContent('vocab-topic', 'family')).toBe(false);
  });

  it('builds the story sampler from the bundle shelf.sampler flags', async () => {
    vi.resetModules();
    const stub = (id: string, shelf?: { sampler: boolean }): Story => ({ id, shelf }) as unknown as Story;
    vi.doMock('../../content/stories', () => ({
      storiesAll: [
        stub('story:in', { sampler: true }),
        stub('story:out', { sampler: false }),
        stub('story:no-shelf'),
      ],
    }));
    const mod = await import('../content-access');
    expect(mod.isFreeContent('story', 'story:in')).toBe(true);
    expect(mod.isFreeContent('story', 'story:out')).toBe(false);
    expect(mod.isFreeContent('story', 'story:no-shelf')).toBe(false);
    vi.doUnmock('../../content/stories');
  });

  it('has an empty sampler while the bundle has no sampler story', () => {
    expect(isFreeContent('story', 'story:seollal-new-year')).toBe(false);
  });
});

describe('isContentLocked', () => {
  const base = { kind: 'story' as const, id: 'story:other', tier: 'free' as Tier, registry };

  it('is never locked while gating is off', () => {
    expect(isContentLocked({ ...base, gatingEnabled: false })).toBe(false);
    expect(isContentLocked({ ...base, kind: 'vocab-topic', id: 'animals', gatingEnabled: false })).toBe(false);
    expect(isContentLocked({ kind: 'story', id: 'story:any', tier: 'free', gatingEnabled: false })).toBe(false);
  });

  it('locks non-free content for the free tier when gating is on', () => {
    expect(isContentLocked({ ...base, gatingEnabled: true })).toBe(true);
    expect(isContentLocked({ ...base, kind: 'vocab-topic', id: 'animals', gatingEnabled: true })).toBe(true);
  });

  it('keeps sampler stories and free topics open', () => {
    expect(isContentLocked({ ...base, id: 'story:free-one', gatingEnabled: true })).toBe(false);
    expect(isContentLocked({ ...base, kind: 'vocab-topic', id: 'food', gatingEnabled: true })).toBe(false);
  });

  it('never locks premium', () => {
    expect(isContentLocked({ ...base, tier: 'premium', gatingEnabled: true })).toBe(false);
  });

  it('uses the default registry when none is injected', () => {
    expect(
      isContentLocked({ kind: 'vocab-topic', id: 'food', tier: 'free', gatingEnabled: true }),
    ).toBe(false);
    expect(
      isContentLocked({ kind: 'vocab-topic', id: 'family', tier: 'free', gatingEnabled: true }),
    ).toBe(true);
  });
});

describe('isStageEntitled golden parity (D5)', () => {
  // The pre-delegation behavior: premium sees everything, free sees stage1 only.
  const legacy = (stageKey: string, tier: Tier): boolean => tier === 'premium' || stageKey === 'stage1';
  const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

  it.each(stages.flatMap((s) => (['free', 'premium'] as const).map((t) => [s, t] as const)))(
    '%s x %s is unchanged',
    (stage, tier) => {
      expect(isStageEntitled(stage, tier)).toBe(legacy(stage, tier));
    },
  );
});
