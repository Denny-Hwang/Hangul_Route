import type { RuntimeVocabItem, VocabTopic } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { createVocabCatalog, localizedGloss, pictureKind, sameSense } from '../catalog';

function topic(key: VocabTopic['key'], status: VocabTopic['status'], fixedOrder = false): VocabTopic {
  return {
    id: `vocab-topic:${key}`,
    key,
    order: 1,
    titleEn: key,
    titleKo: { ko: '음식', romanization: 'eumsik', en: key },
    blurbEn: 'Words.',
    hoyaIntroEn: 'Hi.',
    tint: 'theme.life',
    coverItemId: 'vocab:a',
    status,
    fixedOrder,
  };
}

function item(
  id: string,
  ko: string,
  level: 1 | 2 | 3,
  topics: RuntimeVocabItem['topics'],
  extra: Partial<RuntimeVocabItem> = {},
): RuntimeVocabItem {
  return {
    id,
    ko,
    romanization: id.slice('vocab:'.length),
    en: id.slice('vocab:'.length),
    pos: 'noun',
    topics,
    level,
    visual: 'word:test',
    glosses: { en: id.slice('vocab:'.length) },
    ...extra,
  };
}

const TOPICS: readonly VocabTopic[] = [
  topic('food', 'ready'),
  topic('animals', 'shipped'),
  topic('colors', 'preview', true),
  topic('family', 'draft'),
];

const ITEMS: readonly RuntimeVocabItem[] = [
  item('vocab:c', '가', 3, ['food']),
  item('vocab:a', '나', 1, ['food']),
  item('vocab:b', '다', 2, ['food', 'animals']),
  item('vocab:d', '라', 1, ['food']),
  item('vocab:red', '빨강', 3, ['colors']),
  item('vocab:blue', '파랑', 1, ['colors']),
  item('vocab:nun-eye', '눈', 1, ['body'], { senseGroup: 'nun' }),
  item('vocab:nun-snow', '눈', 1, ['nature'], { senseGroup: 'nun' }),
  item('vocab:eonni', '언니', 1, ['family'], { senseGroup: 'older-sister' }),
  item('vocab:nuna', '누나', 1, ['family'], { senseGroup: 'older-sister' }),
  item('vocab:appa', '아빠', 1, ['family']),
];

describe('vocabTopics (draft hiding, V12)', () => {
  it('hides draft topics by default and keeps file order', () => {
    const { vocabTopics } = createVocabCatalog(TOPICS, ITEMS);
    expect(vocabTopics.map((t) => t.key)).toEqual(['food', 'animals', 'colors']);
  });

  it('hides draft topics when showDrafts is false', () => {
    const { vocabTopics } = createVocabCatalog(TOPICS, ITEMS, { showDrafts: false });
    expect(vocabTopics.map((t) => t.status)).not.toContain('draft');
  });

  it('includes draft topics when showDrafts is true', () => {
    const { vocabTopics } = createVocabCatalog(TOPICS, ITEMS, { showDrafts: true });
    expect(vocabTopics.map((t) => t.key)).toEqual(['food', 'animals', 'colors', 'family']);
  });
});

describe('vocabTopic', () => {
  const { vocabTopic } = createVocabCatalog(TOPICS, ITEMS);

  it('finds a topic by key', () => {
    expect(vocabTopic('animals')?.status).toBe('shipped');
  });

  it('returns undefined for an unknown key', () => {
    expect(vocabTopic('nope')).toBeUndefined();
  });
});

describe('topicItems', () => {
  const { topicItems } = createVocabCatalog(TOPICS, ITEMS);

  it('orders by level, then file order, unless the topic is fixedOrder', () => {
    expect(topicItems('food').map((i) => i.id)).toEqual(['vocab:a', 'vocab:d', 'vocab:b', 'vocab:c']);
  });

  it('keeps file order for a fixedOrder topic whatever the levels say', () => {
    expect(topicItems('colors').map((i) => i.id)).toEqual(['vocab:red', 'vocab:blue']);
  });

  it('includes an item that lists the topic as a secondary topic', () => {
    expect(topicItems('animals').map((i) => i.id)).toEqual(['vocab:b']);
  });

  it('returns an empty list for an unknown topic', () => {
    expect(topicItems('nope')).toEqual([]);
  });

  it('does not mutate the source array', () => {
    const before = ITEMS.map((i) => i.id);
    topicItems('food');
    expect(ITEMS.map((i) => i.id)).toEqual(before);
  });
});

describe('vocabItem', () => {
  const { vocabItem } = createVocabCatalog(TOPICS, ITEMS);

  it('finds an item by id', () => {
    expect(vocabItem('vocab:red')?.ko).toBe('빨강');
  });

  it('returns undefined for an unknown id', () => {
    expect(vocabItem('vocab:nope')).toBeUndefined();
  });
});

describe('localizedGloss', () => {
  const withEs = item('vocab:a', '나', 1, ['food'], { glosses: { en: 'apple', es: 'manzana' } });

  it('returns the gloss for the locale when present', () => {
    expect(localizedGloss(withEs, 'es')).toBe('manzana');
  });

  it('falls back to English when the locale has no gloss', () => {
    expect(localizedGloss(withEs, 'ko')).toBe('apple');
  });

  it('returns English for en', () => {
    expect(localizedGloss(withEs, 'en')).toBe('apple');
  });
});

describe('sameSense (F-VOC-001 §3.7 criterion 7)', () => {
  const { vocabItem } = createVocabCatalog(TOPICS, ITEMS);
  const get = (id: string): RuntimeVocabItem => {
    const found = vocabItem(id);
    if (found === undefined) throw new Error(`missing fixture ${id}`);
    return found;
  };

  it('is true for homonyms with the same ko', () => {
    expect(sameSense(get('vocab:nun-eye'), get('vocab:nun-snow'))).toBe(true);
  });

  it('is true for items sharing a senseGroup', () => {
    expect(sameSense(get('vocab:eonni'), get('vocab:nuna'))).toBe(true);
  });

  it('is false for unrelated items', () => {
    expect(sameSense(get('vocab:eonni'), get('vocab:appa'))).toBe(false);
  });

  it('is false when only one side has a senseGroup', () => {
    expect(sameSense(get('vocab:appa'), get('vocab:nuna'))).toBe(false);
  });

  it('is true for an item compared with itself', () => {
    expect(sameSense(get('vocab:appa'), get('vocab:appa'))).toBe(true);
  });
});

describe('pictureKind', () => {
  it('classifies card refs', () => {
    expect(pictureKind('card:kimchi')).toBe('card');
  });

  it('classifies word refs', () => {
    expect(pictureKind('word:food-apple')).toBe('word');
  });
});
