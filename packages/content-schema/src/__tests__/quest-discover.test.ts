import { describe, expect, it } from 'vitest';
import {
  DiscoverItemSchema,
  DiscoverPageSchema,
  DiscoverSchema,
  QuestSchema,
  QuestStepKindSchema,
  QuestStepSchema,
  type Quest,
} from '../index';

const jamoItem = {
  type: 'jamo' as const,
  jamoId: 'jamo:a',
  example: { ko: '나', romanization: 'na', en: 'I, me' },
};
const wordItem = {
  type: 'word' as const,
  word: { ko: '고추', romanization: 'gochu', en: 'chili pepper' },
};
const discover = { pages: [{ items: [jamoItem] }] };

const intro = { id: 's1', kind: 'intro', titleEn: 'Hello' };
const disc = { id: 's2', kind: 'discover', titleEn: 'Look and learn', discover };
const practice = { id: 's3', kind: 'practice', titleEn: 'Practice', minigameKind: 'match-sound', minigameRef: 'minigame:p' };
const apply = { id: 's4', kind: 'apply', titleEn: 'Try it', minigameKind: 'build-letter', minigameRef: 'minigame:a' };
const check = { id: 's5', kind: 'check', titleEn: 'Quick check', minigameKind: 'listen-pick', minigameRef: 'minigame:c' };
const reward = { id: 's6', kind: 'reward', titleEn: 'Finish' };

function quest(steps: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { id: 'quest:test', titleEn: 'Test', estimatedMinutes: 5, steps, ...extra };
}

function issuePaths(input: unknown): string[] {
  const r = QuestSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
}

describe('step kinds', () => {
  it('lists the seven kinds, discover and check included', () => {
    expect(QuestStepKindSchema.options).toEqual(['intro', 'present', 'discover', 'practice', 'apply', 'check', 'reward']);
  });
});

describe('DiscoverItemSchema / DiscoverPageSchema / DiscoverSchema', () => {
  it('accepts a jamo item with an example and an optional picture', () => {
    expect(DiscoverItemSchema.safeParse(jamoItem).success).toBe(true);
    expect(DiscoverItemSchema.safeParse({ ...jamoItem, picture: 'card:kimchi' }).success).toBe(true);
  });

  it('accepts a word item with an optional picture and note', () => {
    expect(DiscoverItemSchema.safeParse(wordItem).success).toBe(true);
    expect(
      DiscoverItemSchema.safeParse({ ...wordItem, picture: 'card:kimchi', noteEn: 'a spicy side dish' }).success,
    ).toBe(true);
  });

  it('rejects a bad jamo id, a missing example, an unknown type and a bad picture', () => {
    expect(DiscoverItemSchema.safeParse({ ...jamoItem, jamoId: 'giyeok' }).success).toBe(false);
    expect(DiscoverItemSchema.safeParse({ ...jamoItem, jamoId: 'jamo:A' }).success).toBe(false);
    expect(DiscoverItemSchema.safeParse({ type: 'jamo', jamoId: 'jamo:a' }).success).toBe(false);
    expect(DiscoverItemSchema.safeParse({ type: 'sentence', word: wordItem.word }).success).toBe(false);
    expect(DiscoverItemSchema.safeParse({ ...wordItem, picture: 'kimchi' }).success).toBe(false);
  });

  it('caps a word note at 80 characters', () => {
    expect(DiscoverItemSchema.safeParse({ ...wordItem, noteEn: 'x'.repeat(80) }).success).toBe(true);
    expect(DiscoverItemSchema.safeParse({ ...wordItem, noteEn: 'x'.repeat(81) }).success).toBe(false);
  });

  it('allows one or two items per page, never zero or three', () => {
    expect(DiscoverPageSchema.safeParse({ items: [jamoItem] }).success).toBe(true);
    expect(DiscoverPageSchema.safeParse({ items: [jamoItem, wordItem] }).success).toBe(true);
    expect(DiscoverPageSchema.safeParse({ items: [] }).success).toBe(false);
    expect(DiscoverPageSchema.safeParse({ items: [jamoItem, jamoItem, wordItem] }).success).toBe(false);
  });

  it('caps a page caption at 90 characters', () => {
    expect(DiscoverPageSchema.safeParse({ items: [jamoItem], captionEn: 'x'.repeat(90) }).success).toBe(true);
    expect(DiscoverPageSchema.safeParse({ items: [jamoItem], captionEn: 'x'.repeat(91) }).success).toBe(false);
  });

  it('allows one to three pages', () => {
    const page = { items: [jamoItem] };
    expect(DiscoverSchema.safeParse({ pages: [page] }).success).toBe(true);
    expect(DiscoverSchema.safeParse({ pages: [page, page, page] }).success).toBe(true);
    expect(DiscoverSchema.safeParse({ pages: [] }).success).toBe(false);
    expect(DiscoverSchema.safeParse({ pages: [page, page, page, page] }).success).toBe(false);
  });
});

describe('QuestStepSchema', () => {
  it('carries an optional discover payload', () => {
    expect(QuestStepSchema.safeParse(disc).success).toBe(true);
    expect(QuestStepSchema.safeParse({ ...disc, discover: { pages: [] } }).success).toBe(false);
  });
});

describe('QuestSchema, the six-step Stage 1 shape', () => {
  it('accepts intro, discover, practice, apply, check, reward', () => {
    expect(QuestSchema.safeParse(quest([intro, disc, practice, apply, check, reward])).success).toBe(true);
  });

  it('accepts a quest with a discover step and no check, and one with a check and no discover', () => {
    expect(QuestSchema.safeParse(quest([intro, disc, practice, reward])).success).toBe(true);
    expect(QuestSchema.safeParse(quest([intro, practice, check, reward])).success).toBe(true);
  });

  it('still accepts the five-step Stage 2 / Stage 4 shape with present', () => {
    const present = { id: 's2', kind: 'present', titleEn: 'Look', minigameKind: 'card-match', minigameRef: 'minigame:x' };
    expect(QuestSchema.safeParse(quest([intro, present, practice, apply, reward])).success).toBe(true);
  });

  it('keeps the 3-7 step and 3-15 minute limits', () => {
    expect(QuestSchema.safeParse(quest([intro, disc])).success).toBe(false);
    expect(QuestSchema.safeParse(quest([intro, disc, practice, apply, check, reward, reward, reward])).success).toBe(false);
    expect(QuestSchema.safeParse(quest([intro, disc, practice, reward], { estimatedMinutes: 2 })).success).toBe(false);
    expect(QuestSchema.safeParse(quest([intro, disc, practice, reward], { estimatedMinutes: 16 })).success).toBe(false);
  });

  it('allows teaserEn up to 70 characters', () => {
    const steps = [intro, disc, practice, apply, check, reward];
    expect(QuestSchema.safeParse(quest(steps, { teaserEn: 'x'.repeat(70) })).success).toBe(true);
    expect(QuestSchema.safeParse(quest(steps, { teaserEn: 'x'.repeat(71) })).success).toBe(false);
  });

  it('returns the parsed quest typed with the new fields', () => {
    const parsed = QuestSchema.parse(quest([intro, disc, practice, apply, check, reward], { teaserEn: 'New letters' })) as Quest;
    expect(parsed.teaserEn).toBe('New letters');
    expect(parsed.steps[1]?.discover?.pages).toHaveLength(1);
  });
});

describe('QuestSchema.superRefine, discover and check rules', () => {
  it('fails a discover step that has no discover data', () => {
    const { discover: _d, ...bare } = disc;
    expect(issuePaths(quest([intro, bare, practice, reward]))).toContain('steps.1.discover');
  });

  it('fails a discover step that carries a minigameRef or a minigameKind, with the step path', () => {
    expect(issuePaths(quest([intro, { ...disc, minigameRef: 'minigame:x' }, practice, reward]))).toContain('steps.1.minigameRef');
    expect(issuePaths(quest([intro, { ...disc, minigameKind: 'match-sound' }, practice, reward]))).toContain('steps.1.minigameKind');
  });

  it('fails a check step without a minigameKind or a minigameRef', () => {
    const noKind = { ...check, minigameKind: undefined };
    const noRef = { ...check, minigameRef: undefined };
    expect(issuePaths(quest([intro, disc, practice, noKind, reward]))).toContain('steps.3.minigameKind');
    expect(issuePaths(quest([intro, disc, practice, noRef, reward]))).toContain('steps.3.minigameRef');
  });

  it('fails a discover payload on any other step kind', () => {
    for (const kind of ['intro', 'present', 'practice', 'apply', 'reward'] as const) {
      const odd = { id: 'sx', kind, titleEn: 'Odd', discover };
      const steps = kind === 'intro' ? [odd, practice, reward] : [intro, odd, reward];
      expect(issuePaths(quest(steps)).some((p) => p.endsWith('.discover')), kind).toBe(true);
    }
  });

  it('fails two check steps', () => {
    const second = { ...check, id: 's5b', minigameRef: 'minigame:c2' };
    expect(issuePaths(quest([intro, practice, check, second, reward]))).toContain('steps.3.kind');
  });

  it('fails two discover steps', () => {
    const second = { ...disc, id: 's2b' };
    expect(issuePaths(quest([intro, disc, second, practice, reward]))).toContain('steps.2.kind');
  });

  it('fails a practice, apply or check step that comes before the discover step', () => {
    expect(issuePaths(quest([intro, practice, disc, reward]))).toContain('steps.1.kind');
    expect(issuePaths(quest([intro, apply, disc, reward]))).toContain('steps.1.kind');
    expect(issuePaths(quest([check, disc, practice, reward]))).toContain('steps.0.kind');
  });

  it('fails a check step before a practice or apply step', () => {
    expect(issuePaths(quest([intro, check, practice, reward]))).toContain('steps.1.kind');
    expect(issuePaths(quest([intro, disc, check, apply, reward]))).toContain('steps.2.kind');
  });

  it('fails a check step after the reward', () => {
    expect(issuePaths(quest([intro, practice, reward, check]))).toContain('steps.3.kind');
  });

  it('fails a check quest with no scored step', () => {
    const noRef = { ...check, minigameRef: undefined };
    const paths = issuePaths(quest([intro, disc, noRef, reward]));
    expect(paths).toContain('steps');
  });

  it('counts a check step with a ref as the scored step', () => {
    expect(QuestSchema.safeParse(quest([intro, disc, check, reward])).success).toBe(true);
  });

  it('does not demand a scored step from a quest with no check', () => {
    const bare = { id: 's3', kind: 'practice', titleEn: 'Practice' };
    expect(QuestSchema.safeParse(quest([intro, disc, bare, reward])).success).toBe(true);
  });
});
