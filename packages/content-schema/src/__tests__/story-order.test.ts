import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storyOrderIssues } from '../lesson-lint';
import { LessonScopeSchema } from '../schemas/lesson';
import {
  MinigameKindSchema,
  RoundSchema,
  StoryOrderRoundSchema,
  StorySequenceRoundSchema,
  storyOrderPictures,
  storyOrderTextSettled,
  storyOrderToSequence,
  type StoryOrderRound,
} from '../schemas/minigame';

/** F-CURR-002 §7.1 F5, row CM-34: the `story-order` round the CM-7 lint `story-order-text` reads. */

const line = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const MORNING = [
  { id: 'up', caption: line('먼저 일어나요.', 'meonjeo ireonayo', 'First, I get up.') },
  { id: 'wash', caption: line('그다음에 세수해요.', 'geudaeume sesuhaeyo', 'Next, I wash my face.') },
  { id: 'eat', caption: line('그리고 밥을 먹어요.', 'geurigo babeul meogeoyo', 'Then I eat.') },
  { id: 'park', caption: line('마지막에 공원에 가요.', 'majimage gongwone gayo', 'Last, I go to the park.') },
];
const captions = (over: Partial<StoryOrderRound> = {}) => ({ id: 'r1', panels: MORNING, captionsOnly: true, ...over });
const illustrated = (over: Partial<StoryOrderRound> = {}) => ({
  id: 'r2',
  panels: MORNING.map((p, i) => ({ ...p, pictureRef: `word:${['haneul', 'byeol', 'namu', 'kkot'][i]}` })),
  ...over,
});

describe('StoryOrderRoundSchema (CM-34)', () => {
  it('is a minigame kind and a Round', () => {
    expect(MinigameKindSchema.options).toContain('story-order');
    expect(RoundSchema.parse({ kind: 'story-order', data: captions() }).kind).toBe('story-order');
  });

  it('takes 3 to 5 panels in the right order, each a Korean caption with romanization and gloss', () => {
    expect(StoryOrderRoundSchema.safeParse(captions()).success).toBe(true);
    expect(StoryOrderRoundSchema.safeParse(captions({ panels: MORNING.slice(0, 3) })).success).toBe(true);
    expect(StoryOrderRoundSchema.safeParse(captions({ panels: MORNING.slice(0, 2) })).success).toBe(false);
    const six = [...MORNING, ...MORNING.slice(0, 2).map((p) => ({ ...p, id: `${p.id}-2`, caption: { ...p.caption, ko: `${p.caption.ko} ` } }))];
    expect(StoryOrderRoundSchema.safeParse(captions({ panels: six })).success).toBe(false);
    const noRomanization = MORNING.map((p, i) => (i === 0 ? { ...p, caption: { ko: p.caption.ko, en: p.caption.en } } : p));
    expect(StoryOrderRoundSchema.safeParse(captions({ panels: noRomanization as never })).success).toBe(false);
  });

  it('refuses repeated panel ids and repeated captions', () => {
    const twiceId = MORNING.map((p, i) => (i === 1 ? { ...p, id: 'up' } : p));
    expect(StoryOrderRoundSchema.safeParse(captions({ panels: twiceId })).error?.issues[0]?.message).toMatch(/panel ids must be unique/);
    const twiceKo = MORNING.map((p, i) => (i === 1 ? { ...p, caption: MORNING[0]!.caption } : p));
    expect(StoryOrderRoundSchema.safeParse(captions({ panels: twiceKo })).error?.issues[0]?.message).toMatch(/same caption/);
  });

  it('a round is text-settled when it has no picture, is captions only, or is marked as settled by its captions', () => {
    expect(storyOrderTextSettled(StoryOrderRoundSchema.parse(captions()))).toBe(true);
    expect(storyOrderTextSettled(StoryOrderRoundSchema.parse(captions({ captionsOnly: undefined })))).toBe(true);
    expect(storyOrderTextSettled(StoryOrderRoundSchema.parse(illustrated()))).toBe(false);
    expect(storyOrderTextSettled(StoryOrderRoundSchema.parse(illustrated({ captionsSettleOrder: true })))).toBe(true);
    // `captionsOnly` draws the round without its pictures (a story's scenes may name one), so it is text-settled too.
    expect(storyOrderTextSettled(StoryOrderRoundSchema.parse(illustrated({ captionsOnly: true })))).toBe(true);
    expect(storyOrderPictures(StoryOrderRoundSchema.parse(illustrated({ captionsOnly: true })))).toBe(false);
    expect(storyOrderPictures(StoryOrderRoundSchema.parse(illustrated()))).toBe(true);
    expect(storyOrderPictures(StoryOrderRoundSchema.parse(captions({ captionsOnly: undefined })))).toBe(false);
    // The lint reads the same rule off raw JSON: one picture-told round in two passes, two of three do not.
    const rounds = [captions(), illustrated()];
    expect(storyOrderIssues(rounds)).toBeUndefined();
    expect(storyOrderIssues([...rounds, illustrated({ id: 'r3' })])).toMatch(/1 of 3 rounds/);
  });

  it('derives its Story Sequence fallback: the same panels in order, the caption as the label, the picture kept', () => {
    const seq = storyOrderToSequence(StoryOrderRoundSchema.parse(illustrated()));
    expect(StorySequenceRoundSchema.parse(seq)).toEqual(seq);
    expect(seq.steps.map((s) => s.id)).toEqual(['up', 'wash', 'eat', 'park']);
    expect(seq.steps[0]).toEqual({ id: 'up', labelEn: 'First, I get up.', labelKo: '먼저 일어나요.', romanization: 'meonjeo ireonayo', illustrationRef: 'word:haneul' });
    expect(storyOrderToSequence(StoryOrderRoundSchema.parse(captions())).steps[0]).not.toHaveProperty('illustrationRef');
    // A captions-only round keeps its pictures out of the fallback too.
    expect(storyOrderToSequence(StoryOrderRoundSchema.parse(illustrated({ captionsOnly: true }))).steps[0]).not.toHaveProperty('illustrationRef');
  });
});

describe('the story-order lesson scope (CM-34)', () => {
  const scope = (rounds: unknown[]) => ({ ref: 'minigame:s4-crafts-q2-apply', kind: 'story-order', rounds });

  it('holds 1 or 2 rounds (the wireframe: rounds per step)', () => {
    expect(LessonScopeSchema.safeParse(scope([captions()])).success).toBe(true);
    expect(LessonScopeSchema.safeParse(scope([captions(), illustrated()])).success).toBe(true);
    expect(LessonScopeSchema.safeParse(scope([])).success).toBe(false);
    expect(LessonScopeSchema.safeParse(scope([captions(), illustrated(), captions({ id: 'r3' })])).success).toBe(false);
  });

  it('round ids are unique within the scope', () => {
    expect(LessonScopeSchema.safeParse(scope([captions(), captions()])).success).toBe(false);
  });

  it('every story-order round of the CM-7 lint fixtures is a valid round of this schema', () => {
    const fixtures = join(__dirname, '../../../../content/fixtures/curriculum-lint');
    const seen: unknown[] = [];
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(collect);
      if (typeof value !== 'object' || value === null) return;
      const rec = value as Record<string, unknown>;
      if (rec.kind === 'story-order' && Array.isArray(rec.rounds)) seen.push(...rec.rounds);
      Object.values(rec).forEach(collect);
    };
    for (const name of ['story-order-text.pass.json', 'story-order-text.fail.json']) collect(JSON.parse(readFileSync(join(fixtures, name), 'utf8')));
    expect(seen.length).toBeGreaterThan(5);
    for (const round of seen) expect(StoryOrderRoundSchema.safeParse(round).success, JSON.stringify(round).slice(0, 80)).toBe(true);
  });
});
