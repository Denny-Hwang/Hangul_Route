import { describe, expect, it } from 'vitest';
import {
  EpisodeObjectSchema,
  EpisodeSchema,
  PILLAR_HOME_THEME,
  PILLAR_TAGS,
  StoryObjectSchema,
  ThemeKeySchema,
  isPillarTag,
  lintStory,
  parseStory,
  type Story,
} from '../index';
import readyJson from '../__fixtures__/story/valid.ready.json';

/** F-STORY-005 §3.2 / §3.8 (PR 5.1): the pillar registry, the episode merge and the tag lint. */

const BLUEPRINT_IDS = [
  'A1', 'A2', 'A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
  'E1', 'E2', 'E3', 'E4', 'E5',
];
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

describe('PILLAR_TAGS registry (§3.8)', () => {
  it('holds the 23 blueprint 04 sub-themes plus the proposed D5, in id order', () => {
    expect(PILLAR_TAGS.map((t) => t.id)).toEqual([...BLUEPRINT_IDS.slice(0, 18), 'D5', ...BLUEPRINT_IDS.slice(18)]);
    expect(PILLAR_TAGS).toHaveLength(24);
  });

  it('keeps the blueprint Korean titles verbatim', () => {
    const ko = Object.fromEntries(PILLAR_TAGS.map((t) => [t.id, t.ko]));
    expect(ko).toMatchObject({
      A1: '훈민정음',
      A2: '팔만대장경',
      A3: '조선왕조실록',
      A4: '승정원일기',
      A5: '직지심체요절',
      B1: '김홍도의 시장',
      B2: '신윤복의 도시',
      B3: '농촌의 사계절',
      B4: '한복과 옷차림',
      B5: '명절과 세시풍속',
      C1: '종묘제례',
      C2: '궁궐의 하루',
      C3: '판소리 마당',
      C4: '무형문화재',
      D1: '한옥마을',
      D2: '산과 강',
      D3: '사찰과 서원',
      D4: '정원과 정자',
      D5: '옛이야기',
      E1: '한지와 붓',
      E2: '도자기 만들기',
      E3: '측우기와 자격루',
      E4: '동의보감',
      E5: '천문과 우주',
    });
  });

  it('gives every entry its pillar letter, Korean and an English gloss without Hangul', () => {
    for (const tag of PILLAR_TAGS) {
      expect(tag.pillar, tag.id).toBe(tag.id[0]);
      expect(tag.ko.trim().length, tag.id).toBeGreaterThan(0);
      expect(HANGUL.test(tag.ko), tag.id).toBe(true);
      expect(tag.en.trim().length, tag.id).toBeGreaterThan(0);
      expect(HANGUL.test(tag.en), tag.id).toBe(false);
    }
    expect(new Set(PILLAR_TAGS.map((t) => t.id)).size).toBe(PILLAR_TAGS.length);
  });

  it('isPillarTag answers registry membership, not the regex', () => {
    expect(isPillarTag('A1')).toBe(true);
    expect(isPillarTag('D5')).toBe(true);
    expect(isPillarTag('A9')).toBe(false);
    expect(isPillarTag('C5')).toBe(false);
    expect(isPillarTag('a1')).toBe(false);
  });

  it('suggests one home theme per pillar, each a grid theme', () => {
    expect(PILLAR_HOME_THEME).toEqual({ A: 'letters', B: 'life', C: 'rites', D: 'nature', E: 'crafts' });
    for (const theme of Object.values(PILLAR_HOME_THEME)) expect(ThemeKeySchema.options).toContain(theme);
    expect(new Set(PILLAR_TAGS.map((t) => t.pillar))).toEqual(new Set(Object.keys(PILLAR_HOME_THEME)));
  });
});

const lesson = {
  id: 'episode:stage1-rites',
  stage: 'stage1',
  theme: 'rites',
  order: 3,
  titleEn: 'New Year',
  hoyaIntroEn: 'Hi!',
  questIds: ['quest:stage1-rites-q1'],
  rewardCardIds: [],
  estimatedMinutes: 8,
  status: 'shipped',
} as const;

const shelf = {
  ...lesson,
  id: 'episode:shelf-dano-ssireum',
  order: 104,
  questIds: ['quest:story-dano-ssireum-listen'],
  status: 'ready',
  format: 'story',
  placement: 'shelf',
} as const;

const book = {
  ...lesson,
  id: 'episode:stage5-rites',
  stage: 'stage5',
  questIds: ['quest:story-a-read', 'quest:story-b-read'],
  status: 'ready',
  format: 'story',
  placement: 'grid',
  storyIds: ['story:a', 'story:b'],
} as const;

const messages = (input: unknown): string[] => {
  const result = EpisodeSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('EpisodeSchema catalogue fields (§3.2)', () => {
  it('defaults pillarTags to [] and companionId to hoya, so every existing episode parses', () => {
    const parsed = EpisodeSchema.parse(lesson);
    expect(parsed.pillarTags).toEqual([]);
    expect(parsed.companionId).toBe('hoya');
  });

  it('merges the fields into the plain object, which stays extendable', () => {
    expect(Object.keys(EpisodeObjectSchema.shape)).toEqual(expect.arrayContaining(['pillarTags', 'companionId']));
    expect(EpisodeObjectSchema.parse({ ...lesson, pillarTags: ['B5'] }).pillarTags).toEqual(['B5']);
  });

  it('accepts up to three known tags, the first being primary', () => {
    expect(EpisodeSchema.parse({ ...lesson, pillarTags: ['B5', 'C1', 'D5'] }).pillarTags).toEqual(['B5', 'C1', 'D5']);
  });

  it('rejects more than three tags, a malformed tag and a companion other than hoya', () => {
    expect(messages({ ...lesson, pillarTags: ['B5', 'C1', 'D2', 'E1'] })).not.toEqual([]);
    expect(messages({ ...lesson, pillarTags: ['Z1'] })).not.toEqual([]);
    expect(messages({ ...lesson, companionId: 'huni' })).not.toEqual([]);
  });

  it('rejects a well-formed tag that is not in PILLAR_TAGS', () => {
    expect(messages({ ...lesson, pillarTags: ['B5', 'A9'] })).toEqual([
      'pillarTags.1: pillar-tag-unknown: A9 is not in PILLAR_TAGS',
    ]);
  });

  it('rejects a duplicate tag', () => {
    expect(messages({ ...lesson, pillarTags: ['B5', 'B5'] })).toEqual([
      'pillarTags.1: pillar-tag-duplicate: B5 is listed twice',
    ]);
  });
});

describe('EpisodeSchema grid rules (§3.2)', () => {
  it('a grid episode sits at its theme order', () => {
    ThemeKeySchema.options.forEach((theme, i) => {
      expect(messages({ ...lesson, theme, order: i + 1 }), theme).toEqual([]);
    });
    expect(messages({ ...lesson, order: 4 })).toEqual(['order: a grid episode in rites has order 3, not 4']);
    expect(messages({ ...lesson, placement: 'grid', order: 101 })).toEqual([
      'order: a grid episode in rites has order 3, not 101',
    ]);
  });

  it('a preview placeholder obeys the theme order too', () => {
    expect(messages({ ...lesson, stage: 'stage3', questIds: [], status: 'preview' })).toEqual([]);
    expect(messages({ ...lesson, stage: 'stage3', questIds: [], status: 'preview', order: 1 })).not.toEqual([]);
  });

  it('a shelf episode is outside the grid and keeps its shelf order', () => {
    expect(messages(shelf)).toEqual([]);
  });

  it('a story book on the grid is a Stage 5 episode with 2-3 quests', () => {
    expect(messages(book)).toEqual([]);
    expect(messages({ ...book, questIds: [...book.questIds, 'quest:story-c-read'] })).toEqual([]);
    expect(messages({ ...book, stage: 'stage4' })).toEqual([
      'stage: a story episode on the grid is a stage5 book at launch, not stage4',
    ]);
    expect(messages({ ...book, questIds: ['quest:story-a-read'] })).toEqual([
      'questIds: a story book holds 2-3 quests, not 1',
    ]);
    expect(
      messages({ ...book, questIds: ['quest:a', 'quest:b', 'quest:c', 'quest:d'] }),
    ).toEqual(['questIds: a story book holds 2-3 quests, not 4']);
  });

  it('a preview book may hold fewer quests, never another stage', () => {
    expect(messages({ ...book, status: 'preview', questIds: [] })).toEqual([]);
    expect(messages({ ...book, status: 'preview', questIds: ['quest:story-a-read'] })).toEqual([]);
    expect(messages({ ...book, status: 'preview', questIds: [], stage: 'stage6' })).not.toEqual([]);
  });

  it('a lesson on the grid is not limited to Stage 5 or to 2-3 quests', () => {
    expect(messages({ ...lesson, questIds: ['q1', 'q2', 'q3', 'q4'] })).toEqual([]);
  });

  it('volume 2 or more needs the -v<volume> id suffix', () => {
    expect(messages({ ...book, volume: 1 })).toEqual([]);
    expect(messages({ ...book, id: 'episode:stage5-rites-v2', volume: 2 })).toEqual([]);
    expect(messages({ ...book, volume: 2 })).toEqual([
      'id: an episode of volume 2 has an id ending -v2 (got episode:stage5-rites)',
    ]);
    expect(messages({ ...book, id: 'episode:stage5-rites-v2', volume: 3 })).toEqual([
      'id: an episode of volume 3 has an id ending -v3 (got episode:stage5-rites-v2)',
    ]);
    expect(messages({ ...shelf, id: 'episode:shelf-dano-ssireum-v12', volume: 12 })).toEqual([]);
  });

  it('the questIds rule of F-STORY-001 still runs next to these', () => {
    expect(messages({ ...lesson, questIds: [] })).toEqual([
      'questIds: questIds needs at least one quest unless the episode is a preview',
    ]);
  });
});

describe('Story catalogue fields (§3.2; lint, F-STORY-001 §3.8)', () => {
  const story = (patch: Partial<Story> = {}): Story => ({ ...structuredClone(parseStory(readyJson)), ...patch });
  const tagFindings = (s: Story) =>
    lintStory(s, { today: '2026-10-10' }).filter((f) => f.rule.startsWith('pillar-tag-'));

  it('the strict Story schema still rejects other unknown keys', () => {
    expect(StoryObjectSchema.safeParse({ ...readyJson, pillarTags: ['A1'] }).success).toBe(true);
    expect(StoryObjectSchema.safeParse({ ...readyJson, pillars: ['A1'] }).success).toBe(false);
  });

  it('rejects more than three tags in the schema', () => {
    expect(StoryObjectSchema.safeParse({ ...readyJson, pillarTags: ['A1', 'A2', 'A3', 'A4'] }).success).toBe(false);
  });

  it('known tags lint clean', () => {
    expect(tagFindings(story({ pillarTags: ['A1', 'D5'] }))).toEqual([]);
    expect(tagFindings(story({ pillarTags: [] }))).toEqual([]);
  });

  it('pillar-tag-unknown: a well-formed tag outside PILLAR_TAGS is an error', () => {
    expect(tagFindings(story({ pillarTags: ['A1', 'E9'] }))).toEqual([
      {
        rule: 'pillar-tag-unknown',
        level: 'error',
        path: 'pillarTags[1]',
        message: 'E9 is not in PILLAR_TAGS (pillars.ts)',
      },
    ]);
  });

  it('pillar-tag-duplicate: a tag listed twice is an error', () => {
    expect(tagFindings(story({ pillarTags: ['B5', 'C1', 'B5'] }))).toEqual([
      { rule: 'pillar-tag-duplicate', level: 'error', path: 'pillarTags[2]', message: 'B5 is listed twice' },
    ]);
  });
});
