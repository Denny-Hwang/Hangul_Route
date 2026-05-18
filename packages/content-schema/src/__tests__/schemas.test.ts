import { describe, expect, it } from 'vitest';
import {
  EpisodeSchema,
  FamilySchema,
  HeritageCardSchema,
  JamoSchema,
  MinigameSchema,
  ProfileSchema,
  ProgressSnapshotSchema,
  QuestSchema,
  StageDefSchema,
  ThemeDefSchema,
} from '../index';

describe('JamoSchema', () => {
  it('accepts a valid consonant jamo', () => {
    expect(() =>
      JamoSchema.parse({
        id: 'jamo:giyeok',
        char: 'ㄱ',
        romanization: 'g/k',
        nameEn: 'giyeok',
        kind: 'consonant',
        order: 1,
      }),
    ).not.toThrow();
  });

  it('rejects unknown kind', () => {
    expect(() =>
      JamoSchema.parse({
        id: 'jamo:x',
        char: 'ㄱ',
        romanization: 'g',
        nameEn: 'x',
        kind: 'consonants',
        order: 1,
      }),
    ).toThrow();
  });

  it('rejects bad id format', () => {
    expect(() =>
      JamoSchema.parse({
        id: 'INVALID',
        char: 'ㄱ',
        romanization: 'g',
        nameEn: 'x',
        kind: 'vowel',
        order: 1,
      }),
    ).toThrow();
  });
});

describe('HeritageCardSchema', () => {
  it('requires theme, stage, rarity', () => {
    expect(() =>
      HeritageCardSchema.parse({
        id: 'card:tiger',
        titleEn: 'Tiger',
        blurbEn: 'A tiger.',
        theme: 'nature',
        stage: 'stage1',
        rarity: 'legendary',
        unlockedBy: 'first-launch',
      }),
    ).not.toThrow();
  });

  it('rejects invalid rarity', () => {
    expect(() =>
      HeritageCardSchema.parse({
        id: 'card:x',
        titleEn: 'x',
        blurbEn: 'x',
        theme: 'nature',
        stage: 'stage1',
        rarity: 'ultra',
        unlockedBy: 'x',
      }),
    ).toThrow();
  });
});

describe('EpisodeSchema', () => {
  it('accepts a minimal valid episode', () => {
    expect(() =>
      EpisodeSchema.parse({
        id: 'episode:s1-letters',
        stage: 'stage1',
        theme: 'letters',
        order: 1,
        titleEn: 'Meet the Letters',
        hoyaIntroEn: 'Hi!',
        questIds: ['quest:x'],
        rewardCardIds: [],
        estimatedMinutes: 10,
        status: 'shipped',
      }),
    ).not.toThrow();
  });

  it('rejects empty questIds', () => {
    expect(() =>
      EpisodeSchema.parse({
        id: 'episode:x',
        stage: 'stage1',
        theme: 'letters',
        order: 1,
        titleEn: 't',
        hoyaIntroEn: 'h',
        questIds: [],
        rewardCardIds: [],
        estimatedMinutes: 10,
        status: 'shipped',
      }),
    ).toThrow();
  });
});

describe('QuestSchema', () => {
  it('accepts the 5-step intro→present→practice→apply→reward pattern', () => {
    expect(() =>
      QuestSchema.parse({
        id: 'quest:test',
        titleEn: 'Test',
        estimatedMinutes: 5,
        steps: [
          { id: 's1', kind: 'intro', titleEn: 'Intro' },
          { id: 's2', kind: 'present', titleEn: 'Present' },
          { id: 's3', kind: 'practice', titleEn: 'Practice' },
          { id: 's4', kind: 'apply', titleEn: 'Apply' },
          { id: 's5', kind: 'reward', titleEn: 'Reward' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects fewer than 3 steps', () => {
    expect(() =>
      QuestSchema.parse({
        id: 'quest:test',
        titleEn: 'Test',
        estimatedMinutes: 5,
        steps: [
          { id: 's1', kind: 'intro', titleEn: 'Intro' },
          { id: 's2', kind: 'reward', titleEn: 'Reward' },
        ],
      }),
    ).toThrow();
  });
});

describe('ProfileSchema', () => {
  it('enforces 1-20 char displayName', () => {
    expect(() =>
      ProfileSchema.parse({
        id: 'profile:abc',
        displayName: '',
        ageGroup: '5-7',
        avatar: 'hoya-orange',
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();

    expect(() =>
      ProfileSchema.parse({
        id: 'profile:abc',
        displayName: 'a'.repeat(21),
        ageGroup: '5-7',
        avatar: 'hoya-orange',
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});

describe('FamilySchema', () => {
  it('accepts a family with no profiles', () => {
    expect(() =>
      FamilySchema.parse({
        id: 'family:abc',
        profiles: [],
        createdAt: new Date().toISOString(),
      }),
    ).not.toThrow();
  });
});

describe('MinigameSchema', () => {
  it('accepts a match-sound minigame', () => {
    expect(() =>
      MinigameSchema.parse({
        id: 'minigame:test',
        kind: 'match-sound',
        family: 'recognition',
        titleEn: 'Test',
        blurbEn: 'Test',
        rounds: [
          {
            kind: 'match-sound',
            data: { promptJamoId: 'jamo:a', tileJamoIds: ['jamo:a', 'jamo:b'] },
          },
        ],
      }),
    ).not.toThrow();
  });
});

describe('ProgressSnapshotSchema', () => {
  it('accepts an empty snapshot', () => {
    expect(() =>
      ProgressSnapshotSchema.parse({
        profileId: 'profile:abc',
        updatedAt: new Date().toISOString(),
        episodes: [],
        quests: [],
        cards: [],
        sessions: [],
        homework: [],
        reviews: [],
        streakDays: 0,
      }),
    ).not.toThrow();
  });
});

describe('StageDefSchema + ThemeDefSchema', () => {
  it('enforces stage order 1-7 and theme order 1-5', () => {
    expect(() =>
      StageDefSchema.parse({
        key: 'stage1',
        order: 1,
        titleEn: 'Hangul',
        oneLinerEn: '',
        anchorSkillEn: '',
        unlockedByDefault: true,
      }),
    ).not.toThrow();

    expect(() =>
      StageDefSchema.parse({
        key: 'stage1',
        order: 8,
        titleEn: 'Hangul',
        oneLinerEn: '',
        anchorSkillEn: '',
        unlockedByDefault: true,
      }),
    ).toThrow();

    expect(() =>
      ThemeDefSchema.parse({
        key: 'letters',
        order: 6,
        titleEn: 'Letters',
        oneLinerEn: '',
      }),
    ).toThrow();
  });
});
