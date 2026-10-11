import { describe, expect, it, vi } from 'vitest';
import type { Quest, StoryLevel } from '@hangul-route/content-schema';
import {
  levelOfQuest,
  parseStoryMinigameRef,
  storyIdOfQuest,
  storyMinigameRef,
  storyScopeFor,
} from '../story-ref';

const STORIES: Record<string, { tiers: Array<{ level: StoryLevel }> }> = {
  'story:seollal-new-year': { tiers: [{ level: 'listen' }, { level: 'read-along' }] },
  'story:read-check': { tiers: [{ level: 'read' }] },
};
const find = (id: string): { tiers: Array<{ level: StoryLevel }> } | undefined => STORIES[id];

const quest = (refs: Array<[string, string]>): Pick<Quest, 'steps'> => ({
  steps: refs.map(([kind, ref], i) => ({
    id: `s${i + 1}`,
    kind: 'practice' as const,
    titleEn: 't',
    minigameKind: kind as never,
    minigameRef: ref,
  })),
});

describe('parseStoryMinigameRef', () => {
  it('parses every step x level', () => {
    const levels: Array<['listen' | 'along' | 'read', StoryLevel]> = [
      ['listen', 'listen'],
      ['along', 'read-along'],
      ['read', 'read'],
    ];
    for (const step of ['read', 'check', 'seq'] as const) {
      for (const [code, level] of levels) {
        expect(parseStoryMinigameRef(`minigame:story-${step}-${code}-seollal-new-year`)).toEqual({
          step,
          level,
          storyId: 'story:seollal-new-year',
        });
      }
    }
  });

  it('keeps slugs that contain read / check / seq / listen intact', () => {
    expect(parseStoryMinigameRef('minigame:story-read-read-read-check-seq')).toEqual({
      step: 'read',
      level: 'read',
      storyId: 'story:read-check-seq',
    });
    expect(parseStoryMinigameRef('minigame:story-check-listen-listen-along')).toEqual({
      step: 'check',
      level: 'listen',
      storyId: 'story:listen-along',
    });
  });

  it('accepts single-segment and digit slugs', () => {
    expect(parseStoryMinigameRef('minigame:story-seq-listen-dokkaebi2')?.storyId).toBe(
      'story:dokkaebi2',
    );
  });

  it.each([
    '',
    'minigame:story-read-listen-',
    'minigame:story-read-listen',
    'minigame:story-play-listen-x',
    'minigame:story-read-fast-x',
    'minigame:story-read-listen-Upper',
    'minigame:story-read-listen-a_b',
    'minigame:story-read-listen--lead',
    'minigame:story-read-listen-trail-',
    'minigame:story-read-listen-a--b',
    'minigame:story-read-read-along-x-extra y',
    'minigame:s1-letters-recognize-1',
    'story-read-listen-x',
    'xminigame:story-read-listen-x',
    'minigame:story-read-listen-x\n',
  ])('returns null for %j', (ref) => {
    expect(parseStoryMinigameRef(ref)).toBeNull();
  });
});

describe('storyMinigameRef', () => {
  it('builds the ref with the level code', () => {
    expect(storyMinigameRef('check', 'listen', 'story:seollal-new-year')).toBe(
      'minigame:story-check-listen-seollal-new-year',
    );
    expect(storyMinigameRef('seq', 'read-along', 'story:seollal-new-year')).toBe(
      'minigame:story-seq-along-seollal-new-year',
    );
    expect(storyMinigameRef('read', 'read', 'story:seollal-new-year')).toBe(
      'minigame:story-read-read-seollal-new-year',
    );
  });

  it('round trips through parse for every step and level', () => {
    for (const step of ['read', 'check', 'seq'] as const) {
      for (const level of ['listen', 'read-along', 'read'] as const) {
        const ref = storyMinigameRef(step, level, 'story:read-check');
        expect(parseStoryMinigameRef(ref)).toEqual({ step, level, storyId: 'story:read-check' });
      }
    }
  });
});

describe('storyScopeFor', () => {
  it('maps each step to its kind and carries story + level', () => {
    expect(storyScopeFor('minigame:story-check-listen-seollal-new-year', find)).toEqual({
      kind: 'story-check',
      story: { storyId: 'story:seollal-new-year', level: 'listen' },
    });
    expect(storyScopeFor('minigame:story-read-along-seollal-new-year', find)).toEqual({
      kind: 'story-read',
      story: { storyId: 'story:seollal-new-year', level: 'read-along' },
    });
    expect(storyScopeFor('minigame:story-seq-listen-seollal-new-year', find)).toEqual({
      kind: 'story-sequence',
      story: { storyId: 'story:seollal-new-year', level: 'listen' },
    });
  });

  it('returns undefined for malformed refs, unknown stories and missing levels', () => {
    expect(storyScopeFor('minigame:s1-letters-recognize-1', find)).toBeUndefined();
    expect(storyScopeFor('minigame:story-check-listen-nope', find)).toBeUndefined();
    expect(storyScopeFor('minigame:story-check-read-seollal-new-year', find)).toBeUndefined();
  });

  it('defaults to the content bundle', async () => {
    vi.resetModules();
    vi.doMock('../../../content/stories', () => ({
      storyById: (id: string) => (id === 'story:bundled' ? { tiers: [{ level: 'listen' }] } : undefined),
    }));
    const mod = await import('../story-ref');
    expect(mod.storyScopeFor('minigame:story-check-listen-bundled')).toEqual({
      kind: 'story-check',
      story: { storyId: 'story:bundled', level: 'listen' },
    });
    expect(mod.storyScopeFor('minigame:story-check-listen-other')).toBeUndefined();
    vi.doUnmock('../../../content/stories');
    vi.resetModules();
  });
});

describe('storyIdOfQuest / levelOfQuest', () => {
  const q = quest([
    ['story-read', 'minigame:story-read-along-seollal-new-year'],
    ['story-check', 'minigame:story-check-along-seollal-new-year'],
  ]);

  it('read the story-read step ref', () => {
    expect(storyIdOfQuest(q)).toBe('story:seollal-new-year');
    expect(levelOfQuest(q)).toBe('read-along');
  });

  it('are null without a story-read step, without a ref, or with a malformed ref', () => {
    const none = quest([['story-check', 'minigame:story-check-listen-x']]);
    expect(storyIdOfQuest(none)).toBeNull();
    expect(levelOfQuest(none)).toBeNull();
    const noRef: Pick<Quest, 'steps'> = {
      steps: [{ id: 's1', kind: 'present', titleEn: 't', minigameKind: 'story-read' }],
    };
    expect(storyIdOfQuest(noRef)).toBeNull();
    const bad = quest([['story-read', 'minigame:s1-letters-recognize-1']]);
    expect(levelOfQuest(bad)).toBeNull();
    expect(storyIdOfQuest({ steps: [] })).toBeNull();
  });
});
