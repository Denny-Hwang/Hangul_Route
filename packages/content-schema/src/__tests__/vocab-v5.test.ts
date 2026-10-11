import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VocabTopicFileSchema, romanizeWord } from '../index';

/**
 * F-VOC-001 PR V-5: the Colors, Numbers and Animals topics as the spec's section 3.4
 * tables define them. The expected rows below are the spec tables, written out
 * independently of `content/vocab/*.json`, so a drifted word, gloss, level, picture or
 * note fails here. (The Korean description overlay waits for F-I18N-001 PR 12.)
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
  /** Spanish senseNote draft, only for rows that carry a senseNote. */
  note?: { en: string; es: string };
}

interface TopicSpec {
  key: 'animals' | 'colors' | 'numbers';
  order: number;
  titleEn: string;
  titleEs: string;
  titleKo: { ko: string; romanization: string; en: string };
  tint: string;
  coverItemId: string;
  fixedOrder: boolean;
  pos: 'noun' | 'number';
  rows: Row[];
}

const ANIMALS: Row[] = [
  { id: 'vocab:horangi', ko: '호랑이', romanization: 'horangi', en: 'tiger', es: 'tigre', visual: 'card:tiger', level: 2 },
  { id: 'vocab:goyangi', ko: '고양이', romanization: 'goyangi', en: 'cat', es: 'gato', visual: 'word:animal-cat', level: 2 },
  { id: 'vocab:gangaji', ko: '강아지', romanization: 'gangaji', en: 'puppy', es: 'cachorro', visual: 'word:animal-puppy', level: 2 },
  { id: 'vocab:tokki', ko: '토끼', romanization: 'tokki', en: 'rabbit', es: 'conejo', visual: 'word:animal-rabbit', level: 1 },
  { id: 'vocab:gom', ko: '곰', romanization: 'gom', en: 'bear', es: 'oso', visual: 'word:animal-bear', level: 1 },
  { id: 'vocab:sae', ko: '새', romanization: 'sae', en: 'bird', es: 'pájaro', visual: 'word:animal-bird', level: 1 },
  { id: 'vocab:mulgogi', ko: '물고기', romanization: 'mulgogi', en: 'fish', es: 'pez', visual: 'word:animal-fish', level: 2 },
  { id: 'vocab:ori', ko: '오리', romanization: 'ori', en: 'duck', es: 'pato', visual: 'word:animal-duck', level: 1 },
  { id: 'vocab:yeou', ko: '여우', romanization: 'yeou', en: 'fox', es: 'zorro', visual: 'word:animal-fox', level: 1 },
  { id: 'vocab:wonsungi', ko: '원숭이', romanization: 'wonsungi', en: 'monkey', es: 'mono', visual: 'word:animal-monkey', level: 2 },
  { id: 'vocab:kokkiri', ko: '코끼리', romanization: 'kokkiri', en: 'elephant', es: 'elefante', visual: 'word:animal-elephant', level: 2 },
  { id: 'vocab:nabi', ko: '나비', romanization: 'nabi', en: 'butterfly', es: 'mariposa', visual: 'word:animal-butterfly', level: 1 },
];

const COLORS: Row[] = [
  { id: 'vocab:ppalgansaek', ko: '빨간색', romanization: 'ppalgansaek', en: 'red', es: 'rojo', visual: 'word:color-red', level: 2 },
  { id: 'vocab:juhwangsaek', ko: '주황색', romanization: 'juhwangsaek', en: 'orange', es: 'naranja', visual: 'word:color-orange', level: 2 },
  { id: 'vocab:noransaek', ko: '노란색', romanization: 'noransaek', en: 'yellow', es: 'amarillo', visual: 'word:color-yellow', level: 2 },
  { id: 'vocab:choroksaek', ko: '초록색', romanization: 'choroksaek', en: 'green', es: 'verde', visual: 'word:color-green', level: 2 },
  { id: 'vocab:paransaek', ko: '파란색', romanization: 'paransaek', en: 'blue', es: 'azul', visual: 'word:color-blue', level: 2 },
  { id: 'vocab:borasaek', ko: '보라색', romanization: 'borasaek', en: 'purple', es: 'morado', visual: 'word:color-purple', level: 2 },
  { id: 'vocab:bunhongsaek', ko: '분홍색', romanization: 'bunhongsaek', en: 'pink', es: 'rosa', visual: 'word:color-pink', level: 2 },
  { id: 'vocab:haneulsaek', ko: '하늘색', romanization: 'haneulsaek', en: 'sky blue', es: 'celeste', visual: 'word:color-skyblue', level: 2 },
  { id: 'vocab:galsaek', ko: '갈색', romanization: 'galsaek', en: 'brown', es: 'café', visual: 'word:color-brown', level: 1 },
  { id: 'vocab:hoesaek', ko: '회색', romanization: 'hoesaek', en: 'gray', es: 'gris', visual: 'word:color-gray', level: 1 },
  { id: 'vocab:hayansaek', ko: '하얀색', romanization: 'hayansaek', en: 'white', es: 'blanco', visual: 'word:color-white', level: 2 },
  { id: 'vocab:geomeunsaek', ko: '검은색', romanization: 'geomeunsaek', en: 'black', es: 'negro', visual: 'word:color-black', level: 2 },
];

const NUMBERS: Row[] = [
  { id: 'vocab:hana', ko: '하나', romanization: 'hana', en: 'one', es: 'uno', visual: 'word:count-1', level: 1, note: { en: 'Before a counting word it becomes han.', es: 'Antes de una palabra de conteo se convierte en han.' } },
  { id: 'vocab:dul', ko: '둘', romanization: 'dul', en: 'two', es: 'dos', visual: 'word:count-2', level: 1, note: { en: 'Before a counting word it becomes du.', es: 'Antes de una palabra de conteo se convierte en du.' } },
  { id: 'vocab:set', ko: '셋', romanization: 'set', en: 'three', es: 'tres', visual: 'word:count-3', level: 1, note: { en: 'Before a counting word it becomes se.', es: 'Antes de una palabra de conteo se convierte en se.' } },
  { id: 'vocab:net', ko: '넷', romanization: 'net', en: 'four', es: 'cuatro', visual: 'word:count-4', level: 1, note: { en: 'Before a counting word it becomes ne.', es: 'Antes de una palabra de conteo se convierte en ne.' } },
  { id: 'vocab:daseot', ko: '다섯', romanization: 'daseot', en: 'five', es: 'cinco', visual: 'word:count-5', level: 1 },
  { id: 'vocab:yeoseot', ko: '여섯', romanization: 'yeoseot', en: 'six', es: 'seis', visual: 'word:count-6', level: 1 },
  { id: 'vocab:ilgop', ko: '일곱', romanization: 'ilgop', en: 'seven', es: 'siete', visual: 'word:count-7', level: 1 },
  { id: 'vocab:yeodeol', ko: '여덟', romanization: 'yeodeol', en: 'eight', es: 'ocho', visual: 'word:count-8', level: 1 },
  { id: 'vocab:ahop', ko: '아홉', romanization: 'ahop', en: 'nine', es: 'nueve', visual: 'word:count-9', level: 1 },
  { id: 'vocab:yeol', ko: '열', romanization: 'yeol', en: 'ten', es: 'diez', visual: 'word:count-10', level: 1 },
  { id: 'vocab:seumul', ko: '스물', romanization: 'seumul', en: 'twenty', es: 'veinte', visual: 'word:count-20', level: 2, note: { en: 'Before a counting word it becomes seumu.', es: 'Antes de una palabra de conteo se convierte en seumu.' } },
  { id: 'vocab:yeong-zero', ko: '영', romanization: 'yeong', en: 'zero', es: 'cero', visual: 'word:count-0', level: 1, note: { en: 'Sino-Korean zero. In phone numbers people say gong.', es: 'Cero sinocoreano. En los números de teléfono se dice gong.' } },
];

const TOPICS: TopicSpec[] = [
  {
    key: 'animals', order: 2, titleEn: 'Animals', titleEs: 'Animales', titleKo: { ko: '동물', romanization: 'dongmul', en: 'animals' },
    tint: 'theme.nature', coverItemId: 'vocab:horangi', fixedOrder: false, pos: 'noun', rows: ANIMALS,
  },
  {
    key: 'colors', order: 3, titleEn: 'Colors', titleEs: 'Colores', titleKo: { ko: '색', romanization: 'saek', en: 'color' },
    tint: 'stage.stage2', coverItemId: 'vocab:ppalgansaek', fixedOrder: true, pos: 'noun', rows: COLORS,
  },
  {
    key: 'numbers', order: 4, titleEn: 'Numbers', titleEs: 'Números', titleKo: { ko: '숫자', romanization: 'sutja', en: 'number' },
    tint: 'stage.stage2', coverItemId: 'vocab:daseot', fixedOrder: true, pos: 'number', rows: NUMBERS,
  },
];

interface Overlay {
  locale: string;
  domain: string;
  entries: Record<string, Record<string, string>>;
}

describe.each(TOPICS)('content/vocab/$key.json (F-VOC-001 V-5)', (spec) => {
  const file = VocabTopicFileSchema.parse(readJson(`vocab/${spec.key}.json`));
  const es = readJson(`i18n/es/vocab-${spec.key}.json`) as Overlay;

  it('holds the 12 words of the spec table, in table order', () => {
    expect(file.items.map((i) => i.id)).toEqual(spec.rows.map((r) => r.id));
    expect(new Set(file.items.map((i) => i.id)).size).toBe(12);
  });

  it.each(spec.rows)('$id matches its spec row', (row) => {
    const item = file.items.find((i) => i.id === row.id)!;
    expect(item.ko).toBe(row.ko);
    expect(item.romanization).toBe(row.romanization);
    expect(item.en).toBe(row.en);
    expect(item.visual).toBe(row.visual);
    expect(item.level).toBe(row.level);
    expect(item.topics).toEqual([spec.key]);
    expect(item.pos).toBe(spec.pos);
    expect(item.senseNote).toBe(row.note?.en);
  });

  it.each(spec.rows)('$id romanization equals the converter output (unhyphenated RR)', (row) => {
    expect(romanizeWord(row.ko)).toBe(row.romanization);
    expect(row.romanization).not.toContain('-');
  });

  it('declares the topic as a draft that no learner can reach yet', () => {
    expect(file.topic).toMatchObject({
      id: `vocab-topic:${spec.key}`,
      key: spec.key,
      order: spec.order,
      titleEn: spec.titleEn,
      tint: spec.tint,
      coverItemId: spec.coverItemId,
      status: 'draft',
      fixedOrder: spec.fixedOrder,
    });
    expect(file.topic.titleKo).toMatchObject(spec.titleKo);
    expect(romanizeWord(spec.titleKo.ko)).toBe(spec.titleKo.romanization);
  });

  it('uses no spokenKo, audioRef or example at launch', () => {
    for (const item of file.items) {
      expect(item.spokenKo).toBeUndefined();
      expect(item.audioRef).toBeUndefined();
      expect(item.example).toBeUndefined();
    }
  });

  it('is a Spanish overlay of the vocab domain with the draft glosses from the spec table', () => {
    expect(es.locale).toBe('es');
    expect(es.domain).toBe(`vocab-${spec.key}`);
    for (const row of spec.rows) {
      expect(es.entries[row.id], row.id).toEqual(row.note ? { gloss: row.es, senseNote: row.note.es } : { gloss: row.es });
    }
  });

  it('translates the topic title, blurb and Hoya intro, and nothing else', () => {
    expect(Object.keys(es.entries).sort()).toEqual([...spec.rows.map((r) => r.id), `vocab-topic:${spec.key}`].sort());
    const topic = es.entries[`vocab-topic:${spec.key}`]!;
    expect(Object.keys(topic).sort()).toEqual(['blurb', 'hoyaIntro', 'title']);
    expect(topic.title).toBe(spec.titleEs);
  });

  it('has no Korean overlay yet (it waits for F-I18N-001 PR 12)', () => {
    expect(() => readJson(`i18n/ko/vocab-${spec.key}.json`)).toThrow();
  });
});

describe('topic-specific rules', () => {
  it('Animals: 8 or more hand-drawn or card pictures, exactly one card (the tiger)', () => {
    const file = VocabTopicFileSchema.parse(readJson('vocab/animals.json'));
    expect(file.items.filter((i) => /^(card|word):animal-|^card:/.test(i.visual)).length).toBeGreaterThanOrEqual(8);
    expect(file.items.filter((i) => i.visual.startsWith('card:')).map((i) => i.visual)).toEqual(['card:tiger']);
  });

  it('Colors: every picture is a generated colour key (the topic is exempt from the drawn count)', () => {
    const file = VocabTopicFileSchema.parse(readJson('vocab/colors.json'));
    expect(file.items.every((i) => i.visual.startsWith('word:color-'))).toBe(true);
  });

  it('Numbers: only the zero joins a sense group, and the group is registered as launch', () => {
    const file = VocabTopicFileSchema.parse(readJson('vocab/numbers.json'));
    expect(file.items.filter((i) => i.senseGroup !== undefined).map((i) => [i.id, i.senseGroup])).toEqual([['vocab:yeong-zero', 'yeong']]);
    const senses = readJson('vocab/_senses.json') as { groups: { group: string; members: { id: string; state: string }[] }[] };
    expect(senses.groups.find((g) => g.group === 'yeong')?.members).toEqual([expect.objectContaining({ id: 'vocab:yeong-zero', state: 'launch' })]);
  });

  it('Animals and Colors use no sense group', () => {
    for (const key of ['animals', 'colors']) {
      const file = VocabTopicFileSchema.parse(readJson(`vocab/${key}.json`));
      expect(file.items.every((i) => i.senseGroup === undefined && i.senseNote === undefined), key).toBe(true);
    }
  });
});
