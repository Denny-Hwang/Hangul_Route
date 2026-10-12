import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VocabTopicFileSchema, romanizeWord } from '../index';

/**
 * F-VOC-001 PR V-6a: the Family, School, Body and Nature topics, from the spec's
 * section 3.4 seed lists, with the family policy of section 3.6 and the sense
 * registry of section 3.2. The expected rows below are written out independently of
 * `content/vocab/*.json`, so a drifted word, gloss, level, picture or note fails here.
 * The four topics shipped as `status: 'draft'`; V-7 applied the production review
 * (V12, owner decision 2026-10-11) and flipped them to `ready`.
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
  /** Only for the one pronoun (na); every other launch word here is a noun. */
  pos?: 'pronoun';
  /** English senseNote and its Spanish overlay, only for rows that carry one. */
  note?: { en: string; es: string };
  /** Sense group registered in _senses.json, only on homonyms and the sibling pairs. */
  senseGroup?: string;
}

interface TopicSpec {
  key: 'family' | 'school' | 'body' | 'nature';
  order: number;
  titleEn: string;
  titleEs: string;
  titleKo: { ko: string; romanization: string; en: string };
  tint: string;
  coverItemId: string;
  rows: Row[];
}

const FAMILY: Row[] = [
  { id: 'vocab:eomma', ko: '엄마', romanization: 'eomma', en: 'mom', es: 'mamá', visual: 'word:family-mom', level: 1, note: { en: 'The everyday word. The formal word for mother is eomeoni.', es: 'La palabra de todos los días. La palabra formal para madre es eomeoni.' } },
  { id: 'vocab:appa', ko: '아빠', romanization: 'appa', en: 'dad', es: 'papá', visual: 'word:family-dad', level: 1, note: { en: 'The everyday word. The formal word for father is abeoji.', es: 'La palabra de todos los días. La palabra formal para padre es abeoji.' } },
  { id: 'vocab:halmeoni', ko: '할머니', romanization: 'halmeoni', en: 'grandmother', es: 'abuela', visual: 'word:family-grandma', level: 2 },
  { id: 'vocab:harabeoji', ko: '할아버지', romanization: 'harabeoji', en: 'grandfather', es: 'abuelo', visual: 'word:family-grandpa', level: 3 },
  { id: 'vocab:eonni', ko: '언니', romanization: 'eonni', en: 'older sister (said by a woman or girl)', es: 'hermana mayor (lo dice una mujer o niña)', visual: 'word:family-eonni', level: 1, note: { en: 'A woman or girl calls her older sister this. A man or boy says nuna.', es: 'Así llama una mujer o niña a su hermana mayor. Un hombre o niño dice nuna.' }, senseGroup: 'older-sister' },
  { id: 'vocab:nuna', ko: '누나', romanization: 'nuna', en: 'older sister (said by a man or boy)', es: 'hermana mayor (lo dice un hombre o niño)', visual: 'word:family-nuna', level: 1, note: { en: 'A man or boy calls his older sister this. A woman or girl says eonni.', es: 'Así llama un hombre o niño a su hermana mayor. Una mujer o niña dice eonni.' }, senseGroup: 'older-sister' },
  { id: 'vocab:oppa', ko: '오빠', romanization: 'oppa', en: 'older brother (said by a woman or girl)', es: 'hermano mayor (lo dice una mujer o niña)', visual: 'word:family-oppa', level: 1, note: { en: 'A woman or girl calls her older brother this. A man or boy says hyeong.', es: 'Así llama una mujer o niña a su hermano mayor. Un hombre o niño dice hyeong.' }, senseGroup: 'older-brother' },
  { id: 'vocab:hyeong', ko: '형', romanization: 'hyeong', en: 'older brother (said by a man or boy)', es: 'hermano mayor (lo dice un hombre o niño)', visual: 'word:family-hyeong', level: 1, note: { en: 'A man or boy calls his older brother this. A woman or girl says oppa.', es: 'Así llama un hombre o niño a su hermano mayor. Una mujer o niña dice oppa.' }, senseGroup: 'older-brother' },
  { id: 'vocab:dongsaeng', ko: '동생', romanization: 'dongsaeng', en: 'younger brother or sister', es: 'hermano o hermana menor', visual: 'word:family-dongsaeng', level: 1, note: { en: 'Anyone can say it, for a younger brother or a younger sister.', es: 'Lo dice cualquiera, para un hermano menor o una hermana menor.' } },
  { id: 'vocab:agi', ko: '아기', romanization: 'agi', en: 'baby', es: 'bebé', visual: 'word:family-baby', level: 1 },
  { id: 'vocab:gajok', ko: '가족', romanization: 'gajok', en: 'family', es: 'familia', visual: 'word:family-family', level: 1 },
  { id: 'vocab:na', ko: '나', romanization: 'na', en: 'I, me', es: 'yo', visual: 'word:family-me', level: 1, pos: 'pronoun', note: { en: 'The casual word. To be polite, say jeo.', es: 'La palabra informal. Para hablar con cortesía, se dice jeo.' } },
];

const SCHOOL: Row[] = [
  { id: 'vocab:hakgyo', ko: '학교', romanization: 'hakgyo', en: 'school', es: 'escuela', visual: 'word:school-school', level: 1 },
  { id: 'vocab:seonsaengnim', ko: '선생님', romanization: 'seonsaengnim', en: 'teacher', es: 'maestro o maestra', visual: 'word:school-teacher', level: 2, note: { en: 'Also how you address a teacher; the ending nim shows respect.', es: 'También se usa para dirigirse a un maestro o una maestra; el sufijo nim muestra respeto.' } },
  { id: 'vocab:chingu', ko: '친구', romanization: 'chingu', en: 'friend', es: 'amigo o amiga', visual: 'word:school-friend', level: 1 },
  { id: 'vocab:chaek', ko: '책', romanization: 'chaek', en: 'book', es: 'libro', visual: 'card:book', level: 1 },
  { id: 'vocab:yeonpil', ko: '연필', romanization: 'yeonpil', en: 'pencil', es: 'lápiz', visual: 'word:school-pencil', level: 1 },
  { id: 'vocab:gabang', ko: '가방', romanization: 'gabang', en: 'bag', es: 'bolsa o mochila', visual: 'word:school-bag', level: 1 },
  { id: 'vocab:gongchaek', ko: '공책', romanization: 'gongchaek', en: 'notebook', es: 'cuaderno', visual: 'word:school-notebook', level: 1 },
  { id: 'vocab:jiugae', ko: '지우개', romanization: 'jiugae', en: 'eraser', es: 'goma de borrar', visual: 'word:school-eraser', level: 2 },
  { id: 'vocab:chaeksang', ko: '책상', romanization: 'chaeksang', en: 'desk', es: 'escritorio', visual: 'word:school-desk', level: 1 },
  { id: 'vocab:uija', ko: '의자', romanization: 'uija', en: 'chair', es: 'silla', visual: 'word:school-chair', level: 1 },
  { id: 'vocab:gawi', ko: '가위', romanization: 'gawi', en: 'scissors', es: 'tijeras', visual: 'word:school-scissors', level: 1 },
  { id: 'vocab:chilpan', ko: '칠판', romanization: 'chilpan', en: 'blackboard', es: 'pizarrón', visual: 'word:school-board', level: 1 },
];

const BODY: Row[] = [
  { id: 'vocab:nun-eye', ko: '눈', romanization: 'nun', en: 'eye', es: 'ojo', visual: 'word:body-eye', level: 1, senseGroup: 'nun' },
  { id: 'vocab:ko', ko: '코', romanization: 'ko', en: 'nose', es: 'nariz', visual: 'word:body-nose', level: 1 },
  { id: 'vocab:ip', ko: '입', romanization: 'ip', en: 'mouth', es: 'boca', visual: 'word:body-mouth', level: 1 },
  { id: 'vocab:gwi', ko: '귀', romanization: 'gwi', en: 'ear', es: 'oreja', visual: 'word:body-ear', level: 1 },
  { id: 'vocab:meori', ko: '머리', romanization: 'meori', en: 'head', es: 'cabeza', visual: 'word:body-head', level: 1, note: { en: 'It also means hair.', es: 'También significa cabello.' } },
  { id: 'vocab:eolgul', ko: '얼굴', romanization: 'eolgul', en: 'face', es: 'cara', visual: 'word:body-face', level: 1 },
  { id: 'vocab:son', ko: '손', romanization: 'son', en: 'hand', es: 'mano', visual: 'word:body-hand', level: 1 },
  { id: 'vocab:pal-arm', ko: '팔', romanization: 'pal', en: 'arm', es: 'brazo', visual: 'word:body-arm', level: 1, senseGroup: 'pal' },
  { id: 'vocab:dari-leg', ko: '다리', romanization: 'dari', en: 'leg', es: 'pierna', visual: 'word:body-leg', level: 1, senseGroup: 'dari' },
  { id: 'vocab:bal', ko: '발', romanization: 'bal', en: 'foot', es: 'pie', visual: 'word:body-foot', level: 1 },
  { id: 'vocab:bae-belly', ko: '배', romanization: 'bae', en: 'belly', es: 'barriga', visual: 'word:body-belly', level: 1, senseGroup: 'bae' },
  { id: 'vocab:i-tooth', ko: '이', romanization: 'i', en: 'tooth', es: 'diente', visual: 'word:body-tooth', level: 1, note: { en: 'Also called chia, a more formal word.', es: 'También se dice chia, una palabra más formal.' }, senseGroup: 'i' },
];

const NATURE: Row[] = [
  { id: 'vocab:san', ko: '산', romanization: 'san', en: 'mountain', es: 'montaña', visual: 'card:mountain', level: 1 },
  { id: 'vocab:bada', ko: '바다', romanization: 'bada', en: 'sea', es: 'mar', visual: 'card:sea', level: 1 },
  { id: 'vocab:haneul', ko: '하늘', romanization: 'haneul', en: 'sky', es: 'cielo', visual: 'word:nature-sky', level: 1 },
  { id: 'vocab:hae-sun', ko: '해', romanization: 'hae', en: 'sun', es: 'sol', visual: 'word:nature-sun', level: 1, senseGroup: 'hae' },
  { id: 'vocab:dal-moon', ko: '달', romanization: 'dal', en: 'moon', es: 'luna', visual: 'card:moon', level: 1, senseGroup: 'dal' },
  { id: 'vocab:byeol', ko: '별', romanization: 'byeol', en: 'star', es: 'estrella', visual: 'word:nature-star', level: 1 },
  { id: 'vocab:namu', ko: '나무', romanization: 'namu', en: 'tree', es: 'árbol', visual: 'word:nature-tree', level: 1 },
  { id: 'vocab:kkot', ko: '꽃', romanization: 'kkot', en: 'flower', es: 'flor', visual: 'word:nature-flower', level: 1 },
  { id: 'vocab:bi-rain', ko: '비', romanization: 'bi', en: 'rain', es: 'lluvia', visual: 'word:nature-rain', level: 1, senseGroup: 'bi' },
  { id: 'vocab:nun-snow', ko: '눈', romanization: 'nun', en: 'snow', es: 'nieve', visual: 'word:nature-snow', level: 1, senseGroup: 'nun' },
  { id: 'vocab:gang', ko: '강', romanization: 'gang', en: 'river', es: 'río', visual: 'word:nature-river', level: 1 },
  { id: 'vocab:gureum', ko: '구름', romanization: 'gureum', en: 'cloud', es: 'nube', visual: 'word:nature-cloud', level: 1 },
];

/** Topic blurbs after the V-7 review (School now names its people too, not only things). */
const REVIEWED_BLURBS: Record<TopicSpec['key'], { en: string; es: string }> = {
  family: { en: 'Words for the people in a family.', es: 'Palabras para las personas de una familia.' },
  school: { en: 'Words for school: the people, the classroom and your bag.', es: 'Palabras de la escuela: las personas, el salón de clases y la mochila.' },
  body: { en: 'Parts of the body you can point to.', es: 'Partes del cuerpo que puedes señalar.' },
  nature: { en: 'Things you see outdoors, from the sky to the sea.', es: 'Lo que ves al aire libre, del cielo al mar.' },
};

const TOPICS: TopicSpec[] = [
  { key: 'family', order: 5, titleEn: 'Family', titleEs: 'Familia', titleKo: { ko: '가족', romanization: 'gajok', en: 'family' }, tint: 'theme.rites', coverItemId: 'vocab:gajok', rows: FAMILY },
  { key: 'school', order: 6, titleEn: 'School', titleEs: 'Escuela', titleKo: { ko: '학교', romanization: 'hakgyo', en: 'school' }, tint: 'theme.letters', coverItemId: 'vocab:yeonpil', rows: SCHOOL },
  { key: 'body', order: 7, titleEn: 'Body', titleEs: 'Cuerpo', titleKo: { ko: '몸', romanization: 'mom', en: 'body' }, tint: 'stage.stage2', coverItemId: 'vocab:meori', rows: BODY },
  { key: 'nature', order: 8, titleEn: 'Nature', titleEs: 'Naturaleza', titleKo: { ko: '자연', romanization: 'jayeon', en: 'nature' }, tint: 'theme.nature', coverItemId: 'vocab:san', rows: NATURE },
];

interface Overlay {
  locale: string;
  domain: string;
  entries: Record<string, Record<string, string>>;
}

/** Level rule of section 3.4: one or two syllables = 1, three = 2, four or more = 3. */
const levelByRule = (ko: string): 1 | 2 | 3 => {
  const n = ko.replace(/ /g, '').length;
  return n <= 2 ? 1 : n === 3 ? 2 : 3;
};

describe.each(TOPICS)('content/vocab/$key.json (F-VOC-001 V-6a)', (spec) => {
  const file = VocabTopicFileSchema.parse(readJson(`vocab/${spec.key}.json`));
  const es = readJson(`i18n/es/vocab-${spec.key}.json`) as Overlay;

  it('holds the 12 words of the seed list, in seed order', () => {
    expect(file.items.map((i) => i.id)).toEqual(spec.rows.map((r) => r.id));
    expect(new Set(file.items.map((i) => i.id)).size).toBe(12);
  });

  it.each(spec.rows)('$id matches its row', (row) => {
    const item = file.items.find((i) => i.id === row.id)!;
    expect(item.ko).toBe(row.ko);
    expect(item.romanization).toBe(row.romanization);
    expect(item.en).toBe(row.en);
    expect(item.visual).toBe(row.visual);
    expect(item.level).toBe(row.level);
    expect(item.topics).toEqual([spec.key]);
    expect(item.pos).toBe(row.pos ?? 'noun');
    expect(item.senseNote).toBe(row.note?.en);
    expect(item.senseGroup).toBe(row.senseGroup);
  });

  it.each(spec.rows)('$id romanization equals the converter output (unhyphenated RR)', (row) => {
    expect(romanizeWord(row.ko)).toBe(row.romanization);
    expect(row.romanization).not.toContain('-');
  });

  it.each(spec.rows)('$id follows the syllable level rule', (row) => {
    expect(row.level).toBe(levelByRule(row.ko));
  });

  it('declares the topic as ready (the V-7 production review is applied, V12)', () => {
    expect(file.topic).toMatchObject({
      id: `vocab-topic:${spec.key}`,
      key: spec.key,
      order: spec.order,
      titleEn: spec.titleEn,
      tint: spec.tint,
      coverItemId: spec.coverItemId,
      status: 'ready',
      fixedOrder: false,
    });
    expect(file.topic.titleKo).toMatchObject(spec.titleKo);
    expect(romanizeWord(spec.titleKo.ko)).toBe(spec.titleKo.romanization);
  });

  it('keeps the topic copy plain: no Hangul and no age words', () => {
    for (const text of [file.topic.titleEn, file.topic.blurbEn, file.topic.hoyaIntroEn]) {
      expect(text).not.toMatch(/[가-힣]/);
      expect(text.toLowerCase()).not.toMatch(/\b(kids?|children|ages?|years? old|toddler|grown-?ups?)\b/);
    }
  });

  it('uses no spokenKo, audioRef or example at launch', () => {
    for (const item of file.items) {
      expect(item.spokenKo).toBeUndefined();
      expect(item.audioRef).toBeUndefined();
      expect(item.example).toBeUndefined();
    }
  });

  it('is a Spanish overlay of the vocab domain with the glosses from the rows', () => {
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

  it('carries the reviewed topic blurb in English and Spanish (V-7)', () => {
    expect(file.topic.blurbEn).toBe(REVIEWED_BLURBS[spec.key].en);
    expect(es.entries[`vocab-topic:${spec.key}`]!.blurb).toBe(REVIEWED_BLURBS[spec.key].es);
  });

  it('has no Korean overlay, like the merged topics', () => {
    expect(() => readJson(`i18n/ko/vocab-${spec.key}.json`)).toThrow();
  });
});

/** Korean source of every romanized word the V-6a notes use. */
const NOTE_ROMANIZATIONS = [
  ['어머니', 'eomeoni'],
  ['아버지', 'abeoji'],
  ['누나', 'nuna'],
  ['언니', 'eonni'],
  ['형', 'hyeong'],
  ['오빠', 'oppa'],
  ['저', 'jeo'],
  ['님', 'nim'],
  ['치아', 'chia'],
] as const;

/** The romanized words each note carries; rows not listed carry none. */
const NOTE_RR_BY_ID: Record<string, readonly string[]> = {
  'vocab:eomma': ['eomeoni'],
  'vocab:appa': ['abeoji'],
  'vocab:eonni': ['nuna'],
  'vocab:nuna': ['eonni'],
  'vocab:oppa': ['hyeong'],
  'vocab:hyeong': ['oppa'],
  'vocab:na': ['jeo'],
  'vocab:seonsaengnim': ['nim'],
  'vocab:i-tooth': ['chia'],
};

describe('topic-specific rules', () => {
  const parse = (key: string) => VocabTopicFileSchema.parse(readJson(`vocab/${key}.json`));
  const senses = readJson('vocab/_senses.json') as { groups: { group: string; members: { id: string; state: string }[] }[] };
  const membersOf = (group: string) => senses.groups.find((g) => g.group === group)?.members;
  const catalogItems = readdirSync(join(CONTENT, 'vocab'))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .flatMap((f) => VocabTopicFileSchema.parse(readJson(`vocab/${f}`)).items);
  const catalogIds = catalogItems.map((i) => i.id);

  it('Family: all four older-sibling words, each pair in one sense group, registered as launch (V6)', () => {
    const file = parse('family');
    expect(file.items.filter((i) => i.senseGroup !== undefined).map((i) => [i.id, i.senseGroup])).toEqual([
      ['vocab:eonni', 'older-sister'],
      ['vocab:nuna', 'older-sister'],
      ['vocab:oppa', 'older-brother'],
      ['vocab:hyeong', 'older-brother'],
    ]);
    expect(membersOf('older-sister')).toEqual([
      expect.objectContaining({ id: 'vocab:eonni', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:nuna', state: 'launch' }),
    ]);
    expect(membersOf('older-brother')).toEqual([
      expect.objectContaining({ id: 'vocab:oppa', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:hyeong', state: 'launch' }),
    ]);
  });

  it('Family: the speaker-dependent glosses name the speaker, and the note repeats it (section 3.6)', () => {
    const file = parse('family');
    for (const id of ['vocab:eonni', 'vocab:nuna', 'vocab:oppa', 'vocab:hyeong']) {
      const item = file.items.find((i) => i.id === id)!;
      expect(item.en).toMatch(/\(said by (a woman or girl|a man or boy)\)$/);
      expect(item.senseNote).toMatch(/^(A woman or girl|A man or boy) calls (her|his) older (sister|brother) this\./);
    }
  });

  it('Family: every picture is a drawn family glyph; na is the one pronoun', () => {
    const file = parse('family');
    expect(file.items.every((i) => i.visual.startsWith('word:family-'))).toBe(true);
    expect(file.items.filter((i) => i.pos === 'pronoun').map((i) => i.id)).toEqual(['vocab:na']);
  });

  it('School: eleven drawn school glyphs and exactly one card (the book)', () => {
    const file = parse('school');
    expect(file.items.filter((i) => i.visual.startsWith('word:school-')).length).toBe(11);
    expect(file.items.filter((i) => i.visual.startsWith('card:')).map((i) => i.visual)).toEqual(['card:book']);
    expect(file.items.every((i) => i.senseGroup === undefined)).toBe(true);
  });

  it('Body: every picture is a generated body key (the topic is exempt from the drawn count)', () => {
    const file = parse('body');
    expect(file.items.every((i) => i.visual.startsWith('word:body-'))).toBe(true);
    expect(file.items.filter((i) => i.senseGroup !== undefined).map((i) => [i.id, i.senseGroup])).toEqual([
      ['vocab:nun-eye', 'nun'],
      ['vocab:pal-arm', 'pal'],
      ['vocab:dari-leg', 'dari'],
      ['vocab:bae-belly', 'bae'],
      ['vocab:i-tooth', 'i'],
    ]);
  });

  it('Nature: exactly three card pictures (mountain, sea, moon) and the rest drawn nature glyphs', () => {
    const file = parse('nature');
    expect(file.items.filter((i) => i.visual.startsWith('card:')).map((i) => i.visual)).toEqual(['card:mountain', 'card:sea', 'card:moon']);
    expect(file.items.filter((i) => !i.visual.startsWith('card:')).every((i) => i.visual.startsWith('word:nature-'))).toBe(true);
    expect(file.items.filter((i) => i.senseGroup !== undefined).map((i) => [i.id, i.senseGroup])).toEqual([
      ['vocab:hae-sun', 'hae'],
      ['vocab:dal-moon', 'dal'],
      ['vocab:bi-rain', 'bi'],
      ['vocab:nun-snow', 'nun'],
    ]);
  });

  it('eye (Body) and snow (Nature) are the two launch senses of one homonym, both shipped now', () => {
    expect(parse('body').items.find((i) => i.id === 'vocab:nun-eye')?.ko).toBe(parse('nature').items.find((i) => i.id === 'vocab:nun-snow')?.ko);
    expect(membersOf('nun')).toEqual([
      expect.objectContaining({ id: 'vocab:nun-eye', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:nun-snow', state: 'launch' }),
    ]);
  });

  it('the Body and Nature homonyms keep their other senses reserved, never used by an item', () => {
    for (const [group, launch, reserved] of [
      ['i', 'vocab:i-tooth', 'vocab:i-two'],
      ['pal', 'vocab:pal-arm', 'vocab:pal-eight'],
      ['dari', 'vocab:dari-leg', 'vocab:dari-bridge'],
      ['hae', 'vocab:hae-sun', 'vocab:hae-year'],
      ['dal', 'vocab:dal-moon', 'vocab:dal-month'],
      ['bi', 'vocab:bi-rain', 'vocab:bi-broom'],
    ] as const) {
      expect(membersOf(group), group).toEqual([
        expect.objectContaining({ id: launch, state: 'launch' }),
        expect.objectContaining({ id: reserved, state: 'reserved' }),
      ]);
    }
    const reservedIds = senses.groups.flatMap((g) => g.members.filter((m) => m.state === 'reserved').map((m) => m.id));
    expect(reservedIds.length).toBeGreaterThan(0);
    for (const id of reservedIds) expect(catalogIds, id).not.toContain(id);
  });

  it('every romanized word inside a note (English and Spanish) is listed and is the converter output', () => {
    const catalogRomanizations = new Set(catalogItems.map((i) => i.romanization));
    const tableRr = new Set<string>(NOTE_ROMANIZATIONS.map(([, rr]) => rr));
    const romanizedIn = (text: string | undefined): string[] =>
      [...new Set((text ?? '').match(/\p{L}+/gu) ?? [])].filter((t) => tableRr.has(t) || catalogRomanizations.has(t)).sort();

    for (const [ko, rr] of NOTE_ROMANIZATIONS) expect(romanizeWord(ko), ko).toBe(rr);

    const used = new Set<string>();
    for (const spec of TOPICS) {
      for (const row of spec.rows) {
        const expected = [...(NOTE_RR_BY_ID[row.id] ?? [])].sort();
        expect(romanizedIn(row.note?.en), `${row.id} en`).toEqual(expected);
        expect(romanizedIn(row.note?.es), `${row.id} es`).toEqual(expected);
        for (const rr of expected) used.add(rr);
      }
    }
    expect([...used].sort()).toEqual([...tableRr].sort());
  });
});
