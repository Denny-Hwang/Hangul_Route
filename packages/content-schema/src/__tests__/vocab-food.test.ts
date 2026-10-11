import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VocabTopicFileSchema, romanizeWord } from '../index';

/**
 * F-VOC-001 PR V-2b: the Food topic as the spec's section 3.4 Food table defines it.
 * The expected rows below are the spec table, written out independently of
 * `content/vocab/food.json`, so a drifted word, gloss, level or picture fails here.
 * (The Korean description overlay waits for F-I18N-001 PR 12 and is not tested yet.)
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(HERE, '..', '..', '..', '..', 'content');
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(CONTENT, rel), 'utf8'));

interface Row {
  id: string;
  ko: string;
  romanization: string;
  en: string;
  es: string;
  visual: string;
  level: 1 | 2 | 3;
  /** senseNote (English in the item, Spanish in the overlay), only on rows that carry one. */
  note?: { en: string; es: string };
  /** Sense group registered in _senses.json, only on homonyms. */
  senseGroup?: string;
}

const TABLE: Row[] = [
  { id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', en: 'apple', es: 'manzana', visual: 'word:food-apple', level: 1, senseGroup: 'sagwa' },
  { id: 'vocab:banana', ko: '바나나', romanization: 'banana', en: 'banana', es: 'banana', visual: 'word:food-banana', level: 2 },
  { id: 'vocab:uyu', ko: '우유', romanization: 'uyu', en: 'milk', es: 'leche', visual: 'word:food-milk', level: 1 },
  { id: 'vocab:ppang', ko: '빵', romanization: 'ppang', en: 'bread', es: 'pan', visual: 'word:food-bread', level: 1 },
  { id: 'vocab:bap', ko: '밥', romanization: 'bap', en: 'cooked rice', es: 'arroz cocido', visual: 'card:rice', level: 1, note: { en: 'It also means a meal. Uncooked rice is ssal.', es: 'También significa una comida. El arroz sin cocinar es ssal.' } },
  { id: 'vocab:gimchi', ko: '김치', romanization: 'gimchi', en: 'kimchi', es: 'kimchi', visual: 'card:kimchi', level: 1, note: { en: 'A Korean side dish of fermented vegetables, often spicy.', es: 'Acompañamiento coreano de verduras fermentadas, a menudo picante.' } },
  { id: 'vocab:gimbap', ko: '김밥', romanization: 'gimbap', en: 'gimbap (seaweed rice roll)', es: 'gimbap (rollo de arroz con alga)', visual: 'card:kimbap', level: 2 },
  { id: 'vocab:ramyeon', ko: '라면', romanization: 'ramyeon', en: 'instant noodles', es: 'fideos instantáneos', visual: 'word:food-ramyeon', level: 2 },
  { id: 'vocab:mul', ko: '물', romanization: 'mul', en: 'water', es: 'agua', visual: 'word:food-water', level: 1 },
  { id: 'vocab:dalgyal', ko: '달걀', romanization: 'dalgyal', en: 'egg', es: 'huevo', visual: 'word:food-egg', level: 2, note: { en: 'Also called gyeran, which is just as common.', es: 'También se dice gyeran, igual de común.' } },
  { id: 'vocab:ttalgi', ko: '딸기', romanization: 'ttalgi', en: 'strawberry', es: 'fresa', visual: 'word:food-strawberry', level: 2 },
  { id: 'vocab:tteok', ko: '떡', romanization: 'tteok', en: 'rice cake', es: 'pastel de arroz', visual: 'word:food-tteok', level: 1, note: { en: 'A soft, chewy Korean food made from rice.', es: 'Comida coreana suave y masticable, hecha de arroz.' } },
];

const file = VocabTopicFileSchema.parse(readJson('vocab/food.json'));

interface Overlay {
  locale: string;
  domain: string;
  entries: Record<string, Record<string, string>>;
}
const es = readJson('i18n/es/vocab-food.json') as Overlay;

describe('content/vocab/food.json (F-VOC-001 V-2b)', () => {
  it('holds the 12 words of the spec table, in table order', () => {
    expect(file.items.map((i) => i.id)).toEqual(TABLE.map((r) => r.id));
  });

  it.each(TABLE)('$id matches its spec row', (row) => {
    const item = file.items.find((i) => i.id === row.id)!;
    expect(item.ko).toBe(row.ko);
    expect(item.romanization).toBe(row.romanization);
    expect(item.en).toBe(row.en);
    expect(item.visual).toBe(row.visual);
    expect(item.level).toBe(row.level);
    expect(item.topics).toEqual(['food']);
    expect(item.pos).toBe('noun');
    expect(item.senseNote).toBe(row.note?.en);
    expect(item.senseGroup).toBe(row.senseGroup);
  });

  it.each(TABLE)('$id romanization equals the converter output', (row) => {
    expect(romanizeWord(row.ko)).toBe(row.romanization);
  });

  it('declares the Food topic ready after the production review (V12)', () => {
    expect(file.topic).toMatchObject({
      id: 'vocab-topic:food',
      key: 'food',
      order: 1,
      titleEn: 'Food',
      tint: 'theme.life',
      coverItemId: 'vocab:sagwa-apple',
      status: 'ready',
    });
    expect(file.topic.hoyaIntroEn).toBe("Hungry? Let's name some tasty things together.");
    expect(file.topic.titleKo).toMatchObject({ ko: '음식', romanization: 'eumsik', en: 'food' });
    expect(romanizeWord('음식')).toBe('eumsik');
  });

  it('uses no spokenKo, audioRef or example at launch', () => {
    for (const item of file.items) {
      expect(item.spokenKo).toBeUndefined();
      expect(item.audioRef).toBeUndefined();
      expect(item.example).toBeUndefined();
    }
  });

  it('registers sagwa as a homonym: apple at launch, apology reserved', () => {
    const senses = readJson('vocab/_senses.json') as { groups: { group: string; members: { id: string; state: string }[] }[] };
    expect(senses.groups.find((g) => g.group === 'sagwa')?.members).toEqual([
      expect.objectContaining({ id: 'vocab:sagwa-apple', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:sagwa-apology', state: 'reserved' }),
    ]);
  });

  it('keeps at most four culturally Korean items and 8 or more hand-drawn or card pictures', () => {
    const korean = new Set(['vocab:gimchi', 'vocab:gimbap', 'vocab:tteok', 'vocab:ramyeon']);
    expect(file.items.filter((i) => korean.has(i.id))).toHaveLength(4);
    expect(file.items.filter((i) => /^(card|word):/.test(i.visual))).toHaveLength(12);
    expect(file.items.filter((i) => i.visual.startsWith('card:'))).toHaveLength(3);
  });
});

describe('content/i18n/es/vocab-food.json', () => {
  it('is a Spanish overlay of the vocab-food domain', () => {
    expect(es.locale).toBe('es');
    expect(es.domain).toBe('vocab-food');
  });

  it.each(TABLE)('$id has the Spanish gloss (and note) from the spec table', (row) => {
    expect(es.entries[row.id]).toEqual(row.note ? { gloss: row.es, senseNote: row.note.es } : { gloss: row.es });
  });

  it('translates the topic title, blurb and Hoya intro, and nothing else', () => {
    expect(Object.keys(es.entries).sort()).toEqual([...TABLE.map((r) => r.id), 'vocab-topic:food'].sort());
    const topic = es.entries['vocab-topic:food']!;
    expect(Object.keys(topic).sort()).toEqual(['blurb', 'hoyaIntro', 'title']);
    expect(topic.title).toBe('Comida');
  });
});
