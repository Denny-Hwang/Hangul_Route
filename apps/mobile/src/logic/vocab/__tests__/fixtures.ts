import type { RuntimeVocabItem, VocabItemState, VocabProgress, VocabTopic, VocabTopicProgress } from '@hangul-route/content-schema';

/** Test fixtures for the F-VOC-003 logic tests (not a test file itself). */

export function word(slug: string, extra: Partial<RuntimeVocabItem> = {}): RuntimeVocabItem {
  return {
    id: `vocab:${slug}`,
    ko: '가',
    romanization: slug,
    en: slug,
    pos: 'noun',
    topics: ['food'],
    level: 1,
    visual: `word:food-${slug}`,
    glosses: { en: slug },
    ...extra,
  };
}

export function topic(key: VocabTopic['key'], extra: Partial<VocabTopic> = {}): VocabTopic {
  return {
    id: `vocab-topic:${key}`,
    key,
    order: 1,
    titleEn: key,
    titleKo: { ko: '음식', romanization: 'eumsik', en: key },
    blurbEn: '',
    hoyaIntroEn: '',
    tint: 'theme.life',
    coverItemId: 'vocab:a',
    status: 'ready',
    fixedOrder: false,
    ...extra,
  } as VocabTopic;
}

export function state(slug: string, extra: Partial<VocabItemState> = {}): VocabItemState {
  return {
    id: `vocab:${slug}`,
    first: '2026-10-01',
    seen: 0,
    right: 0,
    bestBox: 1,
    last: '2026-10-01',
    box: 1,
    due: '2026-10-02',
    at: '2026-10-01T10:00:00.000Z',
    ...extra,
  };
}

export function topicRow(key: string, extra: Partial<VocabTopicProgress> = {}): VocabTopicProgress {
  return { topic: key, bestStars: 0, sessions: 1, last: '2026-10-01', bestCaught: 0, ...extra };
}

export function progress(items: readonly VocabItemState[] = [], topics: readonly VocabTopicProgress[] = []): VocabProgress {
  return { v: 1, items: [...items], topics: [...topics] };
}
