import type { StageDef, ThemeDef } from '@hangul-route/content-schema';

/**
 * 7 stages × 5 themes — Heritage Journey grid (CLAUDE.md §1).
 */

export const stages: StageDef[] = [
  {
    key: 'stage1',
    order: 1,
    titleEn: 'Hangul',
    oneLinerEn: 'Meet every Korean letter and the sound it makes.',
    anchorSkillEn: 'Recognize 24 jamo + 6 batchim at ≥90% accuracy',
    unlockedByDefault: true,
  },
  {
    key: 'stage2',
    order: 2,
    titleEn: 'Words',
    oneLinerEn: 'Stack letters into your first 60 Korean words.',
    anchorSkillEn: 'Read and pronounce 60 core words across daily themes',
    unlockedByDefault: false,
  },
  {
    key: 'stage3',
    order: 3,
    titleEn: 'Sentences',
    oneLinerEn: 'Connect words into tiny, useful sentences.',
    anchorSkillEn: 'Construct subject-verb sentences in present tense',
    unlockedByDefault: false,
  },
  {
    key: 'stage4',
    order: 4,
    titleEn: 'Dialogue',
    oneLinerEn: 'Have your first real-life mini conversations.',
    anchorSkillEn: 'Hold a 4-turn greeting + question dialogue',
    unlockedByDefault: false,
  },
  {
    key: 'stage5',
    order: 5,
    titleEn: 'Stories',
    oneLinerEn: 'Read short tales and Korean folk stories with Hoya.',
    anchorSkillEn: 'Read a 5-sentence story with 80%+ comprehension',
    unlockedByDefault: false,
  },
  {
    key: 'stage6',
    order: 6,
    titleEn: 'Real-use',
    oneLinerEn: 'Take Korean out into the world — menus, signs, calls.',
    anchorSkillEn: 'Order food, ask directions, message a cousin',
    unlockedByDefault: false,
  },
  {
    key: 'stage7',
    order: 7,
    titleEn: 'Self-expression',
    oneLinerEn: 'Say what you think, feel, and create — in Korean.',
    anchorSkillEn: 'Record a 1-minute personal introduction',
    unlockedByDefault: false,
  },
];

export const themes: ThemeDef[] = [
  {
    key: 'letters',
    order: 1,
    titleEn: 'Letters & Books',
    oneLinerEn: 'Jamo, words on the page, and the joy of reading.',
  },
  {
    key: 'life',
    order: 2,
    titleEn: 'Food & Daily Life',
    oneLinerEn: 'Kimchi, lunchboxes, school, family, sleep.',
  },
  {
    key: 'rites',
    order: 3,
    titleEn: 'Holidays & Traditions',
    oneLinerEn: 'Seollal, Chuseok, bows, and family table.',
  },
  {
    key: 'nature',
    order: 4,
    titleEn: 'Nature & Animals',
    oneLinerEn: 'Tigers, magpies, mountains, sky, sea.',
  },
  {
    key: 'crafts',
    order: 5,
    titleEn: 'Play & Crafts',
    oneLinerEn: 'Yut, kites, pottery, paper, and games.',
  },
];

export function stageByKey(key: string): StageDef | undefined {
  return stages.find((s) => s.key === key);
}

export function themeByKey(key: string): ThemeDef | undefined {
  return themes.find((t) => t.key === key);
}
