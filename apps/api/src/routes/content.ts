import { Hono } from 'hono';
import { ok } from '../envelope';

export const contentRoutes = new Hono();

/**
 * Catalog endpoints — minimal slices of content stored as constants.
 * In production these are served from R2 with content-schema validation.
 */

contentRoutes.get('/jamo', (c) =>
  ok(c, {
    jamo: [
      { id: 'jamo:giyeok', char: 'ㄱ', romanization: 'g/k', kind: 'consonant' },
      { id: 'jamo:nieun', char: 'ㄴ', romanization: 'n', kind: 'consonant' },
      { id: 'jamo:digeut', char: 'ㄷ', romanization: 'd/t', kind: 'consonant' },
      { id: 'jamo:rieul', char: 'ㄹ', romanization: 'r/l', kind: 'consonant' },
      { id: 'jamo:a', char: 'ㅏ', romanization: 'a', kind: 'vowel' },
      { id: 'jamo:eo', char: 'ㅓ', romanization: 'eo', kind: 'vowel' },
    ],
  }),
);

contentRoutes.get('/stages', (c) =>
  ok(c, {
    stages: [
      { key: 'stage1', titleEn: 'Hangul' },
      { key: 'stage2', titleEn: 'Words' },
      { key: 'stage3', titleEn: 'Sentences' },
      { key: 'stage4', titleEn: 'Dialogue' },
      { key: 'stage5', titleEn: 'Stories' },
      { key: 'stage6', titleEn: 'Real-use' },
      { key: 'stage7', titleEn: 'Self-expression' },
    ],
  }),
);

contentRoutes.get('/themes', (c) =>
  ok(c, {
    themes: [
      { key: 'letters', titleEn: 'Letters & Books' },
      { key: 'life', titleEn: 'Food & Daily Life' },
      { key: 'rites', titleEn: 'Holidays & Traditions' },
      { key: 'nature', titleEn: 'Nature & Animals' },
      { key: 'crafts', titleEn: 'Play & Crafts' },
    ],
  }),
);
