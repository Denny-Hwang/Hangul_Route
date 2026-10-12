import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VOCAB_TOPIC_KEYS, VocabTopicFileSchema, romanizeWord } from '../index';

/**
 * F-VOC-001 PR V-6b: the Travel, Sports, K-Culture and Science topics, from the
 * spec's section 3.4 seed lists, with the sense registry of section 3.2 and the
 * no-real-people rule of V11. The expected rows below are written out
 * independently of `content/vocab/*.json`, so a drifted word, gloss, level,
 * picture or note fails here. The four topics ship as `status: 'draft'` (the
 * picker hides them, V12). With them, all twelve launch topics exist.
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
  /** English senseNote and its Spanish overlay, only for rows that carry one. */
  note?: { en: string; es: string };
  /** Sense group registered in _senses.json, only on homonyms. */
  senseGroup?: string;
}

interface TopicSpec {
  key: 'travel' | 'sports' | 'k-culture' | 'science';
  order: number;
  titleEn: string;
  titleEs: string;
  titleKo: { ko: string; romanization: string; en: string };
  tint: string;
  coverItemId: string;
  rows: Row[];
}

const TRAVEL: Row[] = [
  { id: 'vocab:bihaenggi', ko: '비행기', romanization: 'bihaenggi', en: 'airplane', es: 'avión', visual: 'word:travel-airplane', level: 2 },
  { id: 'vocab:gicha', ko: '기차', romanization: 'gicha', en: 'train', es: 'tren', visual: 'word:travel-train', level: 1 },
  { id: 'vocab:beoseu', ko: '버스', romanization: 'beoseu', en: 'bus', es: 'autobús', visual: 'word:travel-bus', level: 1 },
  { id: 'vocab:taeksi', ko: '택시', romanization: 'taeksi', en: 'taxi', es: 'taxi', visual: 'word:travel-taxi', level: 1 },
  { id: 'vocab:jihacheol', ko: '지하철', romanization: 'jihacheol', en: 'subway', es: 'metro', visual: 'word:travel-subway', level: 2 },
  { id: 'vocab:jadongcha', ko: '자동차', romanization: 'jadongcha', en: 'car', es: 'automóvil', visual: 'word:travel-car', level: 2, note: { en: 'In everyday talk, people often just say cha.', es: 'En el habla de todos los días, se suele decir solo cha.' } },
  { id: 'vocab:bae-boat', ko: '배', romanization: 'bae', en: 'boat', es: 'barco', visual: 'word:travel-boat', level: 1, senseGroup: 'bae' },
  { id: 'vocab:jido', ko: '지도', romanization: 'jido', en: 'map', es: 'mapa', visual: 'word:travel-map', level: 1 },
  { id: 'vocab:yeogwon', ko: '여권', romanization: 'yeogwon', en: 'passport', es: 'pasaporte', visual: 'word:travel-passport', level: 1 },
  { id: 'vocab:pyo-ticket', ko: '표', romanization: 'pyo', en: 'ticket', es: 'boleto', visual: 'word:travel-ticket', level: 1, note: { en: 'A ticket for a bus, a train or a show.', es: 'Un boleto para el autobús, el tren o un espectáculo.' }, senseGroup: 'pyo' },
  { id: 'vocab:gonghang', ko: '공항', romanization: 'gonghang', en: 'airport', es: 'aeropuerto', visual: 'word:travel-airport', level: 1 },
  { id: 'vocab:hotel', ko: '호텔', romanization: 'hotel', en: 'hotel', es: 'hotel', visual: 'word:travel-hotel', level: 1 },
];

const SPORTS: Row[] = [
  { id: 'vocab:chukgu', ko: '축구', romanization: 'chukgu', en: 'soccer (football)', es: 'fútbol', visual: 'word:sport-soccer', level: 1 },
  { id: 'vocab:yagu', ko: '야구', romanization: 'yagu', en: 'baseball', es: 'béisbol', visual: 'word:sport-baseball', level: 1 },
  { id: 'vocab:nonggu', ko: '농구', romanization: 'nonggu', en: 'basketball', es: 'baloncesto', visual: 'word:sport-basketball', level: 1 },
  { id: 'vocab:baegu', ko: '배구', romanization: 'baegu', en: 'volleyball', es: 'voleibol', visual: 'word:sport-volleyball', level: 1 },
  { id: 'vocab:takgu', ko: '탁구', romanization: 'takgu', en: 'table tennis', es: 'tenis de mesa', visual: 'word:sport-tabletennis', level: 1 },
  { id: 'vocab:suyeong', ko: '수영', romanization: 'suyeong', en: 'swimming', es: 'natación', visual: 'word:sport-swimming', level: 1 },
  { id: 'vocab:taegwondo', ko: '태권도', romanization: 'taegwondo', en: 'taekwondo', es: 'taekwondo', visual: 'word:sport-taekwondo', level: 2, note: { en: 'A Korean martial art, known for its high kicks.', es: 'Un arte marcial coreano, conocido por sus patadas altas.' } },
  { id: 'vocab:dalligi', ko: '달리기', romanization: 'dalligi', en: 'running', es: 'correr', visual: 'word:sport-running', level: 2 },
  { id: 'vocab:julleomgi', ko: '줄넘기', romanization: 'julleomgi', en: 'jump rope', es: 'saltar la cuerda', visual: 'word:sport-jumprope', level: 2 },
  { id: 'vocab:jajeongeo', ko: '자전거', romanization: 'jajeongeo', en: 'bicycle', es: 'bicicleta', visual: 'word:sport-bicycle', level: 2 },
  { id: 'vocab:seuki', ko: '스키', romanization: 'seuki', en: 'skiing', es: 'esquí', visual: 'word:sport-skiing', level: 1 },
  { id: 'vocab:gong-ball', ko: '공', romanization: 'gong', en: 'ball', es: 'pelota', visual: 'word:sport-ball', level: 1, senseGroup: 'gong' },
];

const K_CULTURE: Row[] = [
  { id: 'vocab:hanbok', ko: '한복', romanization: 'hanbok', en: 'hanbok (traditional clothes)', es: 'hanbok (ropa tradicional)', visual: 'card:hanbok', level: 1, note: { en: 'Often worn on holidays such as Seollal and Chuseok.', es: 'Se suele llevar en fiestas como Seollal y Chuseok.' } },
  { id: 'vocab:hangeul', ko: '한글', romanization: 'hangeul', en: 'Hangul (the Korean alphabet)', es: 'hangul (el alfabeto coreano)', visual: 'word:culture-hangul', level: 1, note: { en: 'The alphabet you are learning here.', es: 'El alfabeto que estás aprendiendo aquí.' } },
  { id: 'vocab:hanok', ko: '한옥', romanization: 'hanok', en: 'hanok (traditional house)', es: 'hanok (casa tradicional)', visual: 'word:culture-hanok', level: 1 },
  { id: 'vocab:bibimbap', ko: '비빔밥', romanization: 'bibimbap', en: 'bibimbap (mixed rice bowl)', es: 'bibimbap (tazón de arroz mixto)', visual: 'word:culture-bibimbap', level: 2, note: { en: 'Rice topped with vegetables, mixed together before you eat.', es: 'Arroz con verduras encima, que se mezcla antes de comer.' } },
  { id: 'vocab:tteokbokki', ko: '떡볶이', romanization: 'tteokbokki', en: 'tteokbokki (spicy rice cakes)', es: 'tteokbokki (pasteles de arroz picantes)', visual: 'word:culture-tteokbokki', level: 2 },
  { id: 'vocab:seollal', ko: '설날', romanization: 'seollal', en: 'Lunar New Year', es: 'Año Nuevo lunar', visual: 'card:seollal', level: 1, note: { en: 'People wear hanbok and bow to their elders.', es: 'La gente lleva hanbok y hace una reverencia a los mayores.' } },
  { id: 'vocab:chuseok', ko: '추석', romanization: 'chuseok', en: 'Chuseok (harvest festival)', es: 'Chuseok (fiesta de la cosecha)', visual: 'card:chuseok', level: 1, note: { en: 'Families gather and share songpyeon, half-moon rice cakes.', es: 'Las familias se reúnen y comparten songpyeon, pasteles de arroz en forma de media luna.' } },
  { id: 'vocab:yunnori', ko: '윷놀이', romanization: 'yunnori', en: 'yut game (board game with sticks)', es: 'juego de yut (tablero y palitos)', visual: 'card:yutnori', level: 2, note: { en: 'Players throw four wooden sticks, often at Lunar New Year.', es: 'Se lanzan cuatro palitos de madera, sobre todo en el Año Nuevo lunar.' } },
  { id: 'vocab:gayageum', ko: '가야금', romanization: 'gayageum', en: 'gayageum (Korean zither)', es: 'gayageum (cítara coreana)', visual: 'card:gayageum', level: 2, note: { en: 'A long string instrument, plucked with the fingers.', es: 'Un instrumento largo de cuerdas que se toca con los dedos.' } },
  { id: 'vocab:norae', ko: '노래', romanization: 'norae', en: 'song', es: 'canción', visual: 'word:culture-song', level: 1 },
  { id: 'vocab:chum', ko: '춤', romanization: 'chum', en: 'dance', es: 'baile', visual: 'word:culture-dance', level: 1 },
  { id: 'vocab:deurama', ko: '드라마', romanization: 'deurama', en: 'TV drama', es: 'serie de televisión', visual: 'word:culture-drama', level: 2 },
];

const SCIENCE: Row[] = [
  { id: 'vocab:bul', ko: '불', romanization: 'bul', en: 'fire', es: 'fuego', visual: 'word:science-fire', level: 1, note: { en: 'It also means a light that is on, such as a lamp.', es: 'También significa una luz encendida, como la de una lámpara.' } },
  { id: 'vocab:eoreum', ko: '얼음', romanization: 'eoreum', en: 'ice', es: 'hielo', visual: 'word:science-ice', level: 1 },
  { id: 'vocab:dol', ko: '돌', romanization: 'dol', en: 'stone', es: 'piedra', visual: 'word:science-stone', level: 1 },
  { id: 'vocab:jaseok', ko: '자석', romanization: 'jaseok', en: 'magnet', es: 'imán', visual: 'word:science-magnet', level: 1 },
  { id: 'vocab:jigu', ko: '지구', romanization: 'jigu', en: 'Earth', es: 'Tierra', visual: 'word:science-earth', level: 1 },
  { id: 'vocab:uju', ko: '우주', romanization: 'uju', en: 'outer space', es: 'espacio exterior', visual: 'word:science-space', level: 1, note: { en: 'It also means the whole universe.', es: 'También significa todo el universo.' } },
  { id: 'vocab:robot', ko: '로봇', romanization: 'robot', en: 'robot', es: 'robot', visual: 'word:science-robot', level: 1 },
  { id: 'vocab:ssiat', ko: '씨앗', romanization: 'ssiat', en: 'seed', es: 'semilla', visual: 'word:science-seed', level: 1 },
  { id: 'vocab:mujigae', ko: '무지개', romanization: 'mujigae', en: 'rainbow', es: 'arcoíris', visual: 'word:science-rainbow', level: 2 },
  { id: 'vocab:geurimja', ko: '그림자', romanization: 'geurimja', en: 'shadow', es: 'sombra', visual: 'word:science-shadow', level: 2 },
  { id: 'vocab:baram', ko: '바람', romanization: 'baram', en: 'wind', es: 'viento', visual: 'word:science-wind', level: 1 },
  { id: 'vocab:bit', ko: '빛', romanization: 'bit', en: 'light', es: 'luz', visual: 'word:science-light', level: 1, note: { en: 'Light from the sun or a lamp, not light in weight.', es: 'La luz del sol o de una lámpara.' } },
];

const TOPICS: TopicSpec[] = [
  { key: 'travel', order: 9, titleEn: 'Travel', titleEs: 'Viajes', titleKo: { ko: '여행', romanization: 'yeohaeng', en: 'travel' }, tint: 'theme.crafts', coverItemId: 'vocab:bihaenggi', rows: TRAVEL },
  { key: 'sports', order: 10, titleEn: 'Sports', titleEs: 'Deportes', titleKo: { ko: '운동', romanization: 'undong', en: 'sports' }, tint: 'theme.crafts', coverItemId: 'vocab:chukgu', rows: SPORTS },
  { key: 'k-culture', order: 11, titleEn: 'K-Culture', titleEs: 'Cultura coreana', titleKo: { ko: '한국 문화', romanization: 'hanguk munhwa', en: 'Korean culture' }, tint: 'theme.rites', coverItemId: 'vocab:hanbok', rows: K_CULTURE },
  { key: 'science', order: 12, titleEn: 'Science', titleEs: 'Ciencia', titleKo: { ko: '과학', romanization: 'gwahak', en: 'science' }, tint: 'theme.nature', coverItemId: 'vocab:jigu', rows: SCIENCE },
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

describe.each(TOPICS)('content/vocab/$key.json (F-VOC-001 V-6b)', (spec) => {
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
    expect(item.pos).toBe('noun');
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

  it('declares the topic as a draft (native review is a later step, V12)', () => {
    expect(file.topic).toMatchObject({
      id: `vocab-topic:${spec.key}`,
      key: spec.key,
      order: spec.order,
      titleEn: spec.titleEn,
      tint: spec.tint,
      coverItemId: spec.coverItemId,
      status: 'draft',
      fixedOrder: false,
    });
    expect(file.topic.titleKo).toMatchObject(spec.titleKo);
    expect(spec.titleKo.ko.split(' ').map((w) => romanizeWord(w)).join(' ')).toBe(spec.titleKo.romanization);
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
    for (const text of Object.values(topic)) expect(text).not.toMatch(/[가-힣]/);
  });

  it('has no Korean overlay, like the merged topics', () => {
    expect(() => readJson(`i18n/ko/vocab-${spec.key}.json`)).toThrow();
  });
});

/** Korean source of every romanized word the V-6b notes use (compared lower-case: festival names are capitalised in prose). */
const NOTE_ROMANIZATIONS = [
  ['차', 'cha'],
  ['설날', 'seollal'],
  ['추석', 'chuseok'],
  ['한복', 'hanbok'],
  ['송편', 'songpyeon'],
] as const;

/** The romanized words each note carries; rows not listed carry none. */
const NOTE_RR_BY_ID: Record<string, readonly string[]> = {
  'vocab:jadongcha': ['cha'],
  'vocab:hanbok': ['chuseok', 'seollal'],
  'vocab:seollal': ['hanbok'],
  'vocab:chuseok': ['songpyeon'],
};

describe('topic-specific rules', () => {
  const parse = (key: string) => VocabTopicFileSchema.parse(readJson(`vocab/${key}.json`));
  const senses = readJson('vocab/_senses.json') as { groups: { group: string; members: { id: string; state: string }[] }[] };
  const membersOf = (group: string) => senses.groups.find((g) => g.group === group)?.members;
  const topicFiles = readdirSync(join(CONTENT, 'vocab')).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  const catalogItems = topicFiles.flatMap((f) => VocabTopicFileSchema.parse(readJson(`vocab/${f}`)).items);

  it('Travel: every picture is a drawn travel glyph; boat and ticket carry their registered sense groups', () => {
    const file = parse('travel');
    expect(file.items.every((i) => i.visual.startsWith('word:travel-'))).toBe(true);
    expect(file.items.filter((i) => i.senseGroup !== undefined).map((i) => [i.id, i.senseGroup])).toEqual([
      ['vocab:bae-boat', 'bae'],
      ['vocab:pyo-ticket', 'pyo'],
    ]);
    expect(membersOf('pyo')).toEqual([expect.objectContaining({ id: 'vocab:pyo-ticket', state: 'launch' })]);
  });

  it('Sports: every picture is a drawn sport glyph; the ball is the gong homonym, its zero sense reserved', () => {
    const file = parse('sports');
    expect(file.items.every((i) => i.visual.startsWith('word:sport-'))).toBe(true);
    expect(file.items.filter((i) => i.senseGroup !== undefined).map((i) => [i.id, i.senseGroup])).toEqual([['vocab:gong-ball', 'gong']]);
    expect(membersOf('gong')).toEqual([
      expect.objectContaining({ id: 'vocab:gong-ball', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:gong-zero', state: 'reserved' }),
    ]);
  });

  it('K-Culture: exactly five card pictures (hanbok, Seollal, Chuseok, yut game, gayageum) and seven drawn culture glyphs', () => {
    const file = parse('k-culture');
    expect(file.items.filter((i) => i.visual.startsWith('card:')).map((i) => i.visual)).toEqual([
      'card:hanbok',
      'card:seollal',
      'card:chuseok',
      'card:yutnori',
      'card:gayageum',
    ]);
    expect(file.items.filter((i) => i.visual.startsWith('word:culture-')).length).toBe(7);
    expect(file.items.every((i) => i.senseGroup === undefined)).toBe(true);
  });

  it('K-Culture: the yut game id and romanization use the pronunciation form, not yutnori (F-CNT-002 D13)', () => {
    const item = parse('k-culture').items.find((i) => i.ko === '윷놀이')!;
    expect(item.id).toBe('vocab:yunnori');
    expect(item.romanization).toBe('yunnori');
    expect(JSON.stringify(item)).not.toMatch(/"yutnori"|yut-no-ri/);
  });

  it('Science: every picture is a drawn science glyph and water stays in Food', () => {
    const file = parse('science');
    expect(file.items.every((i) => i.visual.startsWith('word:science-'))).toBe(true);
    expect(file.items.map((i) => i.ko)).not.toContain('물');
    expect(file.items.every((i) => i.senseGroup === undefined)).toBe(true);
  });

  it('boat (Travel) and belly (Body) are the two launch senses of one homonym, both shipped now', () => {
    expect(parse('travel').items.find((i) => i.id === 'vocab:bae-boat')?.ko).toBe(parse('body').items.find((i) => i.id === 'vocab:bae-belly')?.ko);
    expect(membersOf('bae')).toEqual([
      expect.objectContaining({ id: 'vocab:bae-belly', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:bae-boat', state: 'launch' }),
      expect.objectContaining({ id: 'vocab:bae-pear', state: 'reserved' }),
    ]);
  });

  it('all twelve launch topics now exist: 144 unique words, and every launch sense in the registry is an item', () => {
    expect(topicFiles.map((f) => f.replace(/\.json$/, '')).sort()).toEqual([...VOCAB_TOPIC_KEYS].sort());
    const ids = catalogItems.map((i) => i.id);
    expect(ids).toHaveLength(144);
    expect(new Set(ids).size).toBe(144);
    const byKo = new Map<string, typeof catalogItems>();
    for (const item of catalogItems) byKo.set(item.ko, [...(byKo.get(item.ko) ?? []), item]);
    const homonyms = [...byKo.values()].filter((group) => group.length > 1);
    expect(homonyms.map((group) => group.map((i) => i.id)).sort()).toEqual([
      ['vocab:bae-belly', 'vocab:bae-boat'],
      ['vocab:nun-eye', 'vocab:nun-snow'],
    ]);
    for (const group of homonyms) expect(new Set(group.map((i) => i.senseGroup)).size, group[0]!.ko).toBe(1);
    const launch = senses.groups.flatMap((g) => g.members.filter((m) => m.state === 'launch').map((m) => m.id));
    for (const id of launch) expect(ids, id).toContain(id);
    const reserved = senses.groups.flatMap((g) => g.members.filter((m) => m.state === 'reserved').map((m) => m.id));
    for (const id of reserved) expect(ids, id).not.toContain(id);
  });

  it('the launch set has the section 3.4 picture counts: 13 card pictures and 131 word pictures', () => {
    expect(catalogItems.filter((i) => i.visual.startsWith('card:'))).toHaveLength(13);
    expect(catalogItems.filter((i) => i.visual.startsWith('word:'))).toHaveLength(131);
  });

  it('every romanized word inside a note (English and Spanish) is listed and is the converter output', () => {
    const catalogRomanizations = new Set(catalogItems.map((i) => i.romanization));
    const tableRr = new Set<string>(NOTE_ROMANIZATIONS.map(([, rr]) => rr));
    const romanizedIn = (text: string | undefined): string[] =>
      [...new Set(((text ?? '').match(/\p{L}+/gu) ?? []).map((t) => t.toLowerCase()))]
        .filter((t) => tableRr.has(t) || catalogRomanizations.has(t))
        .sort();

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
