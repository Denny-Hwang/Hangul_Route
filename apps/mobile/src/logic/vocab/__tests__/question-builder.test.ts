import { decomposeSyllable, type RuntimeVocabItem } from '@hangul-route/content-schema';
import { COLOR_CONFUSION_PAIRS } from '@hangul-route/design-system/word-art';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';
import { VOCAB_EXCLUDED_PAIRS } from '../excluded-pairs';
import {
  NotEnoughWords,
  buildQuestions,
  distractorsFor,
  normaliseSeed,
  pictureFamily,
  type BuildInput,
  type VocabQuestion,
} from '../question-builder';

// ---------- fixtures ----------

function item(id: string, ko: string, visual: string, extra: Partial<RuntimeVocabItem> = {}): RuntimeVocabItem {
  const slug = id.slice('vocab:'.length);
  return {
    id,
    ko,
    romanization: slug,
    en: slug,
    pos: 'noun',
    topics: ['body'],
    level: 1,
    visual,
    glosses: { en: slug },
    ...extra,
  };
}

const topicOf = (key: string): readonly RuntimeVocabItem[] =>
  VOCAB_ITEMS.filter((i) => (i.topics as readonly string[]).includes(key));
const FOOD = topicOf('food');
const ANIMALS = topicOf('animals');
const COLORS = topicOf('colors');
const NUMBERS = topicOf('numbers');
const byId = (id: string): RuntimeVocabItem => {
  const found = VOCAB_ITEMS.find((i) => i.id === id);
  if (found === undefined) throw new Error(`fixture ${id} missing`);
  return found;
};

/** Body and family words with homonyms and sense groups (draft topics, so built here). */
const BODY: readonly RuntimeVocabItem[] = [
  item('vocab:nun-eye', '눈', 'word:body-eye', { senseGroup: 'nun', en: 'eye' }),
  item('vocab:bae-belly', '배', 'word:body-belly', { senseGroup: 'bae', en: 'belly' }),
  item('vocab:ko', '코', 'word:body-nose', { en: 'nose' }),
  item('vocab:ip', '입', 'word:body-mouth', { en: 'mouth' }),
  item('vocab:son', '손', 'word:body-hand', { en: 'hand' }),
  item('vocab:bal', '발', 'word:body-foot', { en: 'foot' }),
];
const NATURE: readonly RuntimeVocabItem[] = [
  item('vocab:nun-snow', '눈', 'word:nature-snow', { senseGroup: 'nun', en: 'snow', topics: ['nature'] }),
  item('vocab:san', '산', 'word:nature-mountain', { en: 'mountain', topics: ['nature'] }),
  item('vocab:kkot', '꽃', 'word:nature-flower', { en: 'flower', topics: ['nature'] }),
  item('vocab:namu', '나무', 'word:nature-tree', { en: 'tree', topics: ['nature'] }),
];
const TRAVEL: readonly RuntimeVocabItem[] = [
  item('vocab:bae-boat', '배', 'word:travel-boat', { senseGroup: 'bae', en: 'boat', topics: ['travel'] }),
  item('vocab:bus', '버스', 'word:travel-bus', { en: 'bus', topics: ['travel'] }),
  item('vocab:gicha', '기차', 'word:travel-train', { en: 'train', topics: ['travel'] }),
];
const FAMILY: readonly RuntimeVocabItem[] = [
  item('vocab:eonni', '언니', 'word:family-eonni', { senseGroup: 'older-sister', topics: ['family'] }),
  item('vocab:nuna', '누나', 'word:family-nuna', { senseGroup: 'older-sister', topics: ['family'] }),
  item('vocab:oppa', '오빠', 'word:family-oppa', { senseGroup: 'older-brother', topics: ['family'] }),
  item('vocab:hyeong', '형', 'word:family-hyeong', { senseGroup: 'older-brother', topics: ['family'] }),
  item('vocab:eomma', '엄마', 'word:family-mom', { topics: ['family'] }),
  item('vocab:appa', '아빠', 'word:family-dad', { topics: ['family'] }),
];
const MIXED: readonly RuntimeVocabItem[] = [...VOCAB_ITEMS, ...BODY, ...NATURE, ...TRAVEL, ...FAMILY];

function input(over: Partial<BuildInput> & Pick<BuildInput, 'pool'>): BuildInput {
  return {
    universe: over.pool,
    count: 10,
    optionCount: 4,
    levelOrder: 1,
    boxOf: () => 0,
    seed: 1,
    canRender: () => true,
    canPlay: true,
    ...over,
  };
}

const optionKo = (q: VocabQuestion): string[] => q.options.map((o) => o.text?.ko ?? '');
const optionPictures = (q: VocabQuestion): string[] => q.options.map((o) => o.pictureRef ?? '');
const all = (pool: readonly RuntimeVocabItem[]): Map<string, RuntimeVocabItem> => new Map(pool.map((i) => [i.id, i]));
const pairKey = (a: string, b: string): string => [a, b].sort().join('|');
const CONFUSED = new Set(COLOR_CONFUSION_PAIRS.map(([a, b]) => pairKey(a, b)));

/** Every property of §3.3 for one built round. */
function assertProperties(questions: readonly VocabQuestion[], i: BuildInput): void {
  const items = all([...i.universe, ...i.pool]);
  questions.forEach((q, index) => {
    expect(q.key).toBe(`q${index}:${q.itemId}:${q.format}`);
    expect(q.answerId).toBe(q.itemId);
    expect(q.options).toHaveLength(i.optionCount);
    const ids = q.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(q.answerId);
    const answer = items.get(q.itemId)!;
    for (const o of q.options) {
      if (o.id === answer.id) continue;
      const other = items.get(o.id)!;
      expect(other.ko).not.toBe(answer.ko);
      if (answer.senseGroup !== undefined) expect(other.senseGroup).not.toBe(answer.senseGroup);
      expect(other.visual).not.toBe(answer.visual);
    }
    if (q.format === 'image-to-word') {
      expect(new Set(optionKo(q)).size).toBe(i.optionCount);
      expect(q.options.every((o) => o.pictureRef === undefined && o.text !== undefined)).toBe(true);
    } else {
      expect(new Set(optionPictures(q)).size).toBe(i.optionCount);
      expect(q.options.every((o) => o.text === undefined && o.pictureRef !== undefined)).toBe(true);
    }
    if (!i.canPlay) expect(q.format).not.toBe('audio-to-image');
    if (i.levelOrder === 0) expect(q.format).not.toBe('image-to-word');
  });
}

// ---------- tests ----------

describe('pictureFamily', () => {
  it('names card art "card" and WordArt by its family', () => {
    expect(pictureFamily('card:kimchi')).toBe('card');
    expect(pictureFamily('word:food-apple')).toBe('word-food');
    expect(pictureFamily('word:count-10')).toBe('word-count');
    expect(pictureFamily('word:body-eye')).toBe('word-body');
    expect(pictureFamily('word:color-skyblue')).toBe('word-color');
  });
});

describe('buildQuestions: the properties of F-VOC-004 §3.3 on the shipped topics', () => {
  const topics = { FOOD, ANIMALS, COLORS, NUMBERS };
  for (const [name, pool] of Object.entries(topics)) {
    for (const levelOrder of [0, 1, 2] as const) {
      it(`${name}, level ${levelOrder}: every question is well formed over 60 seeds`, () => {
        for (let seed = 0; seed < 60; seed++) {
          const optionCount = levelOrder === 0 ? 3 : 4;
          const i = input({
            pool,
            optionCount,
            levelOrder,
            count: levelOrder === 0 ? 8 : 10,
            seed: seed * 104729 + 3,
            boxOf: (id) => (id.length + seed) % 6,
            canPlay: seed % 3 !== 0,
          });
          const questions = buildQuestions(i);
          expect(questions).toHaveLength(i.count);
          assertProperties(questions, i);
        }
      });
    }
  }

  it('walks the pool in its given order on the first pass', () => {
    const questions = buildQuestions(input({ pool: FOOD, count: 12 }));
    expect(questions.map((q) => q.itemId)).toEqual(FOOD.map((i) => i.id));
  });

  it('gives the same output for the same seed and a different one for another seed', () => {
    const a = buildQuestions(input({ pool: ANIMALS, seed: 42 }));
    const b = buildQuestions(input({ pool: ANIMALS, seed: 42 }));
    const c = buildQuestions(input({ pool: ANIMALS, seed: 43 }));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('does not place the answer in the same slot on every question of a round', () => {
    const questions = buildQuestions(input({ pool: FOOD, count: 12, seed: 7 }));
    const slots = new Set(questions.map((q) => q.options.findIndex((o) => o.id === q.answerId)));
    expect(slots.size).toBeGreaterThan(1);
  });

  it('places the answer uniformly within +-5 % per slot across 1,000 seeds (4 and 3 options)', () => {
    for (const optionCount of [4, 3] as const) {
      const first = new Array<number>(optionCount).fill(0);
      const every = new Array<number>(optionCount).fill(0);
      let total = 0;
      for (let seed = 0; seed < 1000; seed++) {
        const questions = buildQuestions(
          input({ pool: ANIMALS, optionCount, levelOrder: optionCount === 3 ? 0 : 1, count: 8, seed: 1_700_000_000_000 + seed }),
        );
        questions.forEach((q, index) => {
          const slot = q.options.findIndex((o) => o.id === q.answerId);
          every[slot]! += 1;
          if (index === 0) first[slot]! += 1;
          total += 1;
        });
      }
      const expected = 1 / optionCount;
      for (const n of first) expect(Math.abs(n / 1000 - expected)).toBeLessThanOrEqual(0.05);
      for (const n of every) expect(Math.abs(n / total - expected)).toBeLessThanOrEqual(0.05);
    }
  });

  it('dedupes a pool that lists a word twice', () => {
    const pool = [FOOD[0]!, FOOD[0]!, ...FOOD.slice(1, 5)];
    const questions = buildQuestions(input({ pool, universe: FOOD, count: 5 }));
    expect(questions.map((q) => q.itemId)).toEqual(FOOD.slice(0, 5).map((i) => i.id));
  });
});

describe('formats (§3.2)', () => {
  it('follows each word box: 0-1 word-to-image, 2 audio-to-image, 3+ image-to-word', () => {
    const boxes: Record<string, number> = { 'vocab:gom': 0, 'vocab:tokki': 1, 'vocab:ori': 2, 'vocab:yeou': 3, 'vocab:nabi': 5 };
    const pool = ['vocab:gom', 'vocab:tokki', 'vocab:ori', 'vocab:yeou', 'vocab:nabi'].map(byId);
    const formats = buildQuestions(input({ pool, universe: ANIMALS, count: 5, boxOf: (id) => boxes[id] ?? 0 })).map((q) => q.format);
    expect(formats).toEqual(['word-to-image', 'word-to-image', 'audio-to-image', 'image-to-word', 'image-to-word']);
  });

  it('Pictures first never asks image-to-word: a high box falls back to the sound question', () => {
    const questions = buildQuestions(input({ pool: ANIMALS, levelOrder: 0, optionCount: 3, count: 8, boxOf: () => 5 }));
    expect(questions.every((q) => q.format === 'audio-to-image')).toBe(true);
  });

  it('with no voice there is no audio-to-image question at any box or level (S7)', () => {
    for (const levelOrder of [0, 1, 2] as const) {
      for (let box = 0; box <= 5; box++) {
        const questions = buildQuestions(
          input({ pool: FOOD, levelOrder, optionCount: levelOrder === 0 ? 3 : 4, boxOf: () => box, canPlay: false }),
        );
        expect(questions.some((q) => q.format === 'audio-to-image')).toBe(false);
      }
    }
  });

  it('builds the prompt for each format', () => {
    const apple = byId('vocab:sagwa-apple');
    const boxes: Record<string, number> = { 'vocab:sagwa-apple': 0, 'vocab:uyu': 2, 'vocab:ppang': 3 };
    const pool = [apple, byId('vocab:uyu'), byId('vocab:ppang')];
    const [word, audio, image] = buildQuestions(input({ pool, universe: FOOD, count: 3, boxOf: (id) => boxes[id] ?? 0 }));
    expect(word!.prompt).toEqual({ kind: 'word', ko: '사과', romanization: 'sagwa', audioRef: 'audio/vocab/sagwa-apple.mp3' });
    expect(audio!.prompt).toEqual({ kind: 'audio', ko: '우유', romanization: 'uyu', audioRef: 'audio/vocab/uyu.mp3' });
    expect(image!.prompt).toEqual({ kind: 'image', pictureRef: 'word:food-bread' });
    const answerOption = word!.options.find((o) => o.id === apple.id);
    expect(answerOption).toEqual({ id: apple.id, pictureRef: 'word:food-apple', labelEn: 'apple' });
    const wordOption = image!.options.find((o) => o.id === 'vocab:ppang');
    expect(wordOption).toEqual({ id: 'vocab:ppang', text: { ko: '빵', romanization: 'ppang', en: 'bread' } });
  });

  it('carries spokenKo and audioRef on word and sound prompts when the item has them', () => {
    const spoken = item('vocab:yeol-ten', '열', 'word:count-10', {
      spokenKo: '열 개',
      audioRef: 'audio/vocab/yeol-ten.mp3',
      pos: 'number',
      topics: ['numbers'],
    });
    const universe = [spoken, ...NUMBERS.filter((n) => n.id !== 'vocab:yeol-ten')];
    const [word] = buildQuestions(input({ pool: [spoken], universe, count: 1 }));
    expect(word!.prompt).toEqual({
      kind: 'word',
      ko: '열',
      romanization: 'yeol-ten',
      spokenKo: '열 개',
      audioRef: 'audio/vocab/yeol-ten.mp3',
    });
    const [audio] = buildQuestions(input({ pool: [spoken], universe, count: 1, boxOf: () => 2 }));
    expect(audio!.prompt).toMatchObject({ kind: 'audio', spokenKo: '열 개', audioRef: 'audio/vocab/yeol-ten.mp3' });
  });
});

describe('a pool shorter than count (§3.3 selection, behaviour 12)', () => {
  it('4 words and count 10 give 10 questions, never the same word twice in a row, never one format twice per word', () => {
    for (let seed = 0; seed < 50; seed++) {
      const pool = ANIMALS.slice(seed % 8, (seed % 8) + 4);
      const questions = buildQuestions(input({ pool, universe: ANIMALS, count: 10, seed, boxOf: (id) => (id.length + seed) % 6 }));
      expect(questions).toHaveLength(10);
      for (let k = 1; k < questions.length; k++) expect(questions[k]!.itemId).not.toBe(questions[k - 1]!.itemId);
      const seen = new Set<string>();
      for (const q of questions) {
        const key = `${q.itemId}:${q.format}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      // 2.5 passes: every word at least twice, none more than three times.
      const counts = new Map<string, number>();
      for (const q of questions) counts.set(q.itemId, (counts.get(q.itemId) ?? 0) + 1);
      expect([...counts.values()].sort()).toEqual([2, 2, 3, 3]);
    }
  });

  it('stops early when a word has no format left to repeat in (Pictures first, no voice)', () => {
    const pool = ANIMALS.slice(0, 4);
    const questions = buildQuestions(input({ pool, universe: ANIMALS, levelOrder: 0, optionCount: 3, count: 8, canPlay: false }));
    expect(questions.map((q) => q.itemId)).toEqual(pool.map((i) => i.id));
    expect(questions.every((q) => q.format === 'word-to-image')).toBe(true);
  });

  it('a single word is asked once: it can never follow itself', () => {
    const questions = buildQuestions(input({ pool: [ANIMALS[0]!], universe: ANIMALS, count: 5 }));
    expect(questions).toHaveLength(1);
  });
});

describe('unresolved pictures and NotEnoughWords', () => {
  it('drops a pool word whose picture does not resolve, and never shows such a picture as an option', () => {
    const broken = 'word:food-apple';
    for (let seed = 0; seed < 40; seed++) {
      const questions = buildQuestions(input({ pool: FOOD, seed, canRender: (ref) => ref !== broken, boxOf: () => seed % 6 }));
      expect(questions.some((q) => q.itemId === 'vocab:sagwa-apple')).toBe(false);
      for (const q of questions) expect(optionPictures(q)).not.toContain(broken);
    }
  });

  it('may still offer that word as a written option in image-to-word (its picture is not shown)', () => {
    const broken = 'word:food-apple';
    let offered = false;
    for (let seed = 0; seed < 60 && !offered; seed++) {
      const questions = buildQuestions(input({ pool: FOOD, seed, canRender: (ref) => ref !== broken, boxOf: () => 4 }));
      offered = questions.some((q) => q.format === 'image-to-word' && q.options.some((o) => o.id === 'vocab:sagwa-apple'));
    }
    expect(offered).toBe(true);
  });

  it('throws NotEnoughWords only when no question can be built', () => {
    expect(() => buildQuestions(input({ pool: [] }))).toThrow(NotEnoughWords);
    expect(() => buildQuestions(input({ pool: FOOD, canRender: () => false }))).toThrow(NotEnoughWords);
    // Two words cannot make a 3-option question.
    expect(() => buildQuestions(input({ pool: FOOD.slice(0, 2), universe: FOOD.slice(0, 2), optionCount: 3 }))).toThrow(
      NotEnoughWords,
    );
    const error = (() => {
      try {
        buildQuestions(input({ pool: [] }));
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('NotEnoughWords');
  });

  it('returns fewer than count when only some words can be asked', () => {
    // 눈 eye can face 코 and 입 (never 눈 snow): with 3 options both words build.
    const universe = [BODY[0]!, NATURE[0]!, BODY[2]!, BODY[3]!];
    expect(buildQuestions(input({ pool: [BODY[0]!, BODY[2]!], universe, optionCount: 3, count: 2 }))).toHaveLength(2);
    // Here eye conflicts with everything but 코 (a same-ko word and a same-sense word), while 코 can face those two.
    const sameKo = item('vocab:nun-other', '눈', 'word:body-other');
    const sameSense = item('vocab:nunsseop', '눈썹', 'word:body-brow', { senseGroup: 'nun' });
    const tight = buildQuestions(
      input({ pool: [BODY[0]!, BODY[2]!], universe: [BODY[0]!, sameKo, sameSense, BODY[2]!], optionCount: 3, count: 2 }),
    );
    expect(tight.map((q) => q.itemId)).toEqual(['vocab:ko']);
  });
});

describe('distractor rules (§3.3)', () => {
  it('rule 1: never a homonym or a sense-group partner (눈, 배, 언니/누나, 오빠/형)', () => {
    const cases: [RuntimeVocabItem, string][] = [
      [BODY[0]!, 'vocab:nun-snow'],
      [NATURE[0]!, 'vocab:nun-eye'],
      [BODY[1]!, 'vocab:bae-boat'],
      [TRAVEL[0]!, 'vocab:bae-belly'],
      [FAMILY[0]!, 'vocab:nuna'],
      [FAMILY[1]!, 'vocab:eonni'],
      [FAMILY[2]!, 'vocab:hyeong'],
      [FAMILY[3]!, 'vocab:oppa'],
    ];
    const universe = [...BODY, ...NATURE, ...TRAVEL, ...FAMILY];
    for (const [answer, partner] of cases) {
      for (let seed = 0; seed < 200; seed++) {
        for (const format of ['word-to-image', 'image-to-word', 'audio-to-image'] as const) {
          const picked = distractorsFor(answer, format, input({ pool: [answer], universe, seed }));
          expect(picked).toHaveLength(3);
          expect(picked.map((p) => p.id)).not.toContain(partner);
        }
      }
    }
  });

  it('rule 1 also keeps options apart from each other: never two of one sense in one question', () => {
    const universe = [...FAMILY, BODY[2]!];
    for (let seed = 0; seed < 200; seed++) {
      const picked = distractorsFor(FAMILY[4]!, 'image-to-word', input({ pool: [FAMILY[4]!], universe, seed }));
      const groups = picked.map((p) => p.senseGroup).filter((g) => g !== undefined);
      expect(new Set(groups).size).toBe(groups.length);
    }
  });

  it('rule 1 never puts two overlapping words together (VOCAB_EXCLUDED_PAIRS: 공 and each ball sport, 불 and 빛)', () => {
    const SPORTS = topicOf('sports');
    const SCIENCE = topicOf('science');
    const cases: [string, readonly RuntimeVocabItem[], string[]][] = [
      ['vocab:gong-ball', SPORTS, ['vocab:chukgu', 'vocab:yagu', 'vocab:nonggu', 'vocab:baegu']],
      ['vocab:chukgu', SPORTS, ['vocab:gong-ball']],
      ['vocab:yagu', SPORTS, ['vocab:gong-ball']],
      ['vocab:nonggu', SPORTS, ['vocab:gong-ball']],
      ['vocab:baegu', SPORTS, ['vocab:gong-ball']],
      ['vocab:bul', SCIENCE, ['vocab:bit']],
      ['vocab:bit', SCIENCE, ['vocab:bul']],
    ];
    for (const [id, topic, partners] of cases) {
      for (const levelOrder of [1, 2] as const) {
        for (let seed = 0; seed < 15; seed++) {
          for (const format of ['word-to-image', 'image-to-word', 'audio-to-image'] as const) {
            for (const universe of [topic, VOCAB_ITEMS]) {
              const picked = distractorsFor(byId(id), format, input({ pool: topic, universe, levelOrder, seed }));
              expect(picked).toHaveLength(3);
              for (const partner of partners) expect(picked.map((p) => p.id)).not.toContain(partner);
            }
          }
        }
      }
    }
  });

  it('rule 1 keeps every pair of VOCAB_EXCLUDED_PAIRS apart both ways, in its topic and in the whole catalogue', () => {
    for (const [a, b] of VOCAB_EXCLUDED_PAIRS) {
      for (const [answer, partner] of [[a, b], [b, a]] as const) {
        const topic = topicOf(byId(answer).topics[0]!);
        for (let seed = 0; seed < 10; seed++) {
          for (const format of ['word-to-image', 'image-to-word', 'audio-to-image'] as const) {
            for (const universe of [topic, VOCAB_ITEMS]) {
              const picked = distractorsFor(byId(answer), format, input({ pool: topic, universe, seed }));
              expect(picked).toHaveLength(3);
              expect(picked.map((p) => p.id), `${answer} ${format} ${seed}`).not.toContain(partner);
            }
          }
        }
      }
    }
  });

  it('rule 1 keeps an overlapping pair apart among the options of another answer too', () => {
    const SPORTS = topicOf('sports');
    for (let seed = 0; seed < 300; seed++) {
      for (const format of ['word-to-image', 'image-to-word'] as const) {
        const ids = distractorsFor(byId('vocab:suyeong'), format, input({ pool: SPORTS, seed })).map((p) => p.id);
        expect(ids).toHaveLength(3);
        for (const [a, b] of VOCAB_EXCLUDED_PAIRS) expect(ids.includes(a) && ids.includes(b), `${seed} ${a} ${b}`).toBe(false);
      }
    }
  });

  it('builds full Sports and Science rounds that never show an overlapping pair', () => {
    for (const key of ['sports', 'science']) {
      const pool = topicOf(key);
      for (let seed = 0; seed < 40; seed++) {
        const i = input({ pool, seed, count: pool.length, boxOf: (id) => (id.length + seed) % 6 });
        const questions = buildQuestions(i);
        assertProperties(questions, i);
        for (const q of questions) {
          const ids = q.options.map((o) => o.id);
          for (const [a, b] of VOCAB_EXCLUDED_PAIRS) expect(ids.includes(a) && ids.includes(b), `${q.key} ${a} ${b}`).toBe(false);
        }
      }
    }
  });

  it('rule 2: never the same picture as the answer or as another option', () => {
    const twin = item('vocab:twin', '쌍둥이', 'word:food-apple', { topics: ['food'] });
    const twin2 = item('vocab:twin-two', '쌍', 'word:food-milk', { topics: ['food'] });
    const universe = [...FOOD, twin, twin2];
    for (let seed = 0; seed < 200; seed++) {
      const apple = distractorsFor(byId('vocab:sagwa-apple'), 'word-to-image', input({ pool: FOOD, universe, seed }));
      expect(apple.map((p) => p.id)).not.toContain('vocab:twin');
      const pictures = apple.map((p) => p.visual);
      expect(new Set(pictures).size).toBe(pictures.length);
    }
  });

  it('rule 3: a colour never faces a colour it collapses with, and no pair shares a question', () => {
    for (let seed = 0; seed < 300; seed++) {
      const questions = buildQuestions(input({ pool: COLORS, seed, count: 12, boxOf: () => seed % 6 }));
      for (const q of questions) {
        const ids = q.options.map((o) => o.id);
        for (let a = 0; a < ids.length; a++) {
          for (let b = a + 1; b < ids.length; b++) expect(CONFUSED.has(pairKey(ids[a]!, ids[b]!))).toBe(false);
        }
      }
    }
  });

  it('rule 3 prefers other colours for a colour (same picture family)', () => {
    const universe = [...COLORS, ...FOOD];
    for (let seed = 0; seed < 100; seed++) {
      const picked = distractorsFor(byId('vocab:paransaek'), 'word-to-image', input({ pool: COLORS, universe, seed }));
      expect(picked.every((p) => pictureFamily(p.visual) === 'word-color')).toBe(true);
    }
  });

  it('rule 3 relaxes when the colours left would be too few', () => {
    const universe = ['vocab:ppalgansaek', 'vocab:galsaek', 'vocab:choroksaek', 'vocab:paransaek'].map(byId);
    const picked = distractorsFor(universe[0]!, 'word-to-image', input({ pool: universe, universe, seed: 3 }));
    expect(picked.map((p) => p.id).sort()).toEqual(['vocab:choroksaek', 'vocab:galsaek', 'vocab:paransaek']);
  });

  it('rule 4: at Pictures first a count never faces a neighbour (differs by 2 or more), nor zero or twenty', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const answer of NUMBERS.filter((n) => n.id !== 'vocab:yeong-zero' && n.id !== 'vocab:seumul')) {
        const picked = distractorsFor(answer, 'word-to-image', input({ pool: NUMBERS, levelOrder: 0, optionCount: 3, seed }));
        const a = Number(answer.visual.slice('word:count-'.length));
        for (const p of picked) {
          const c = Number(p.visual.slice('word:count-'.length));
          expect(Math.abs(c - a)).toBeGreaterThanOrEqual(2);
          expect([0, 20]).not.toContain(c);
        }
      }
    }
  });

  it('rule 4: above Pictures first neighbours are fine, but zero and twenty stay out unless one is the answer', () => {
    let neighbour = false;
    for (let seed = 0; seed < 200; seed++) {
      const picked = distractorsFor(byId('vocab:daseot'), 'word-to-image', input({ pool: NUMBERS, levelOrder: 1, seed }));
      const counts = picked.map((p) => Number(p.visual.slice('word:count-'.length)));
      expect(counts).not.toContain(0);
      expect(counts).not.toContain(20);
      if (counts.includes(4) || counts.includes(6)) neighbour = true;
    }
    expect(neighbour).toBe(true);
    let twentyForZero = false;
    for (let seed = 0; seed < 200 && !twentyForZero; seed++) {
      const picked = distractorsFor(byId('vocab:yeong-zero'), 'word-to-image', input({ pool: NUMBERS, levelOrder: 1, seed }));
      twentyForZero = picked.some((p) => p.id === 'vocab:seumul');
    }
    expect(twentyForZero).toBe(true);
  });

  it('rule 4 never offers the same count twice and relaxes when too few counts are far enough', () => {
    const sameCount = item('vocab:sip', '십', 'word:count-10', { pos: 'number', topics: ['numbers'] });
    const universe = [...NUMBERS, sameCount];
    for (let seed = 0; seed < 100; seed++) {
      const picked = distractorsFor(byId('vocab:yeol-ten'), 'word-to-image', input({ pool: universe, universe, seed }));
      expect(picked.map((p) => p.id)).not.toContain('vocab:sip');
    }
    const small = ['vocab:hana', 'vocab:dul', 'vocab:set', 'vocab:net'].map(byId);
    const picked = distractorsFor(small[1]!, 'word-to-image', input({ pool: small, universe: small, levelOrder: 0, optionCount: 4 }));
    expect(picked.map((p) => p.id).sort()).toEqual(['vocab:hana', 'vocab:net', 'vocab:set']);
  });

  it('rule 4 leaves non-count candidates alone in a mixed universe', () => {
    const universe = [byId('vocab:hana'), byId('vocab:dul'), ...ANIMALS.slice(0, 3)];
    const picked = distractorsFor(universe[0]!, 'word-to-image', input({ pool: universe, universe, levelOrder: 0, seed: 5 }));
    expect(picked).toHaveLength(3);
    expect(picked.map((p) => p.id)).not.toContain('vocab:dul');
  });

  it('rule 5: prefers the answer picture family, so card art does not give the answer away', () => {
    const cards = FOOD.filter((f) => f.visual.startsWith('card:'));
    expect(cards.length).toBe(3);
    for (let seed = 0; seed < 100; seed++) {
      const picked = distractorsFor(byId('vocab:gimchi'), 'word-to-image', input({ pool: FOOD, seed }));
      const ids = picked.map((p) => p.id);
      expect(ids).toContain('vocab:bap');
      expect(ids).toContain('vocab:gimbap');
      const apple = distractorsFor(byId('vocab:sagwa-apple'), 'word-to-image', input({ pool: FOOD, seed }));
      expect(apple.every((p) => p.visual.startsWith('word:food-'))).toBe(true);
    }
  });

  it('rule 6 (behaviour 14): at level 2 at least one option shares the first syllable or initial when one exists', () => {
    const initial = (ko: string): string | undefined => decomposeSyllable(ko[0]!)?.initial;
    for (let seed = 0; seed < 100; seed++) {
      for (const pool of [ANIMALS, FOOD, COLORS, [...BODY, ...FAMILY]]) {
        const questions = buildQuestions(input({ pool, levelOrder: 2, seed, count: pool.length, boxOf: () => seed % 6 }));
        for (const q of questions) {
          const answer = pool.find((p) => p.id === q.itemId)!;
          const eligible = pool.some(
            (c) => c.id !== answer.id && c.ko !== answer.ko && (c.senseGroup === undefined || c.senseGroup !== answer.senseGroup) &&
              c.visual !== answer.visual && (c.ko[0] === answer.ko[0] || initial(c.ko) === initial(answer.ko)),
          );
          if (!eligible) continue;
          const shares = q.options.some((o) => {
            if (o.id === answer.id) return false;
            const c = pool.find((p) => p.id === o.id)!;
            return c.ko[0] === answer.ko[0] || initial(c.ko) === initial(answer.ko);
          });
          expect(shares).toBe(true);
        }
      }
    }
  });

  it('rule 6: 곰 at level 2 meets a ㄱ word (고양이 or 강아지)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = distractorsFor(byId('vocab:gom'), 'word-to-image', input({ pool: ANIMALS, levelOrder: 2, seed }));
      expect(picked.some((p) => p.id === 'vocab:goyangi' || p.id === 'vocab:gangaji')).toBe(true);
    }
  });

  it('rule 7: a mixed review prefers the answer topic', () => {
    for (let seed = 0; seed < 100; seed++) {
      const picked = distractorsFor(byId('vocab:gom'), 'word-to-image', input({ pool: ANIMALS, universe: VOCAB_ITEMS, seed }));
      expect(picked.every((p) => (p.topics as readonly string[]).includes('animals'))).toBe(true);
    }
  });

  it('rule 7 breaks ties inside one picture family: same-topic card art first', () => {
    const mask = item('vocab:tal', '탈', 'card:mask', { topics: ['k-culture'] });
    const universe = [...FOOD, mask];
    for (let seed = 0; seed < 100; seed++) {
      const picked = distractorsFor(byId('vocab:gimchi'), 'word-to-image', input({ pool: FOOD, universe, optionCount: 3, seed }));
      expect(picked.map((p) => p.id).sort()).toEqual(['vocab:bap', 'vocab:gimbap']);
    }
  });

  it('is deterministic for a seed and returns optionCount - 1 distractors', () => {
    const i = input({ pool: ANIMALS, seed: 99 });
    expect(distractorsFor(ANIMALS[0]!, 'word-to-image', i)).toEqual(distractorsFor(ANIMALS[0]!, 'word-to-image', i));
    expect(distractorsFor(ANIMALS[0]!, 'word-to-image', { ...i, optionCount: 3 })).toHaveLength(2);
  });

  it('returns fewer when the universe cannot supply enough', () => {
    const tiny = ANIMALS.slice(0, 2);
    expect(distractorsFor(tiny[0]!, 'word-to-image', input({ pool: tiny, universe: tiny }))).toHaveLength(1);
  });
});

describe('topicChip (behaviour 13)', () => {
  it('a homonym in a mixed universe carries its topic, and never meets its twin', () => {
    for (let seed = 0; seed < 50; seed++) {
      const questions = buildQuestions(input({ pool: [BODY[0]!, NATURE[0]!, ...BODY.slice(2)], universe: MIXED, seed }));
      const eye = questions.find((q) => q.itemId === 'vocab:nun-eye')!;
      const snow = questions.find((q) => q.itemId === 'vocab:nun-snow')!;
      expect(eye.topicChip).toBe('body');
      expect(snow.topicChip).toBe('nature');
      expect(eye.options.map((o) => o.id)).not.toContain('vocab:nun-snow');
      expect(snow.options.map((o) => o.id)).not.toContain('vocab:nun-eye');
      for (const q of questions.filter((x) => x.itemId !== 'vocab:nun-eye' && x.itemId !== 'vocab:nun-snow')) {
        expect(q.topicChip).toBeUndefined();
      }
    }
  });

  it('a word with no homonym in its universe has no chip', () => {
    const questions = buildQuestions(input({ pool: [BODY[0]!, ...BODY.slice(2)], universe: BODY }));
    expect(questions.every((q) => q.topicChip === undefined)).toBe(true);
  });
});

describe('review follow-ups (F-VOC-004 S-2)', () => {
  it('rule 6 never breaks rule 3: at level 2 over the whole catalogue a colour only ever meets colours', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const answer of COLORS) {
        for (const format of ['word-to-image', 'audio-to-image', 'image-to-word'] as const) {
          const picked = distractorsFor(answer, format, input({ pool: COLORS, universe: VOCAB_ITEMS, levelOrder: 2, seed }));
          expect(picked).toHaveLength(3);
          expect(picked.every((p) => pictureFamily(p.visual) === 'word-color')).toBe(true);
        }
      }
    }
  });

  it('rule 6 still reserves a confusable from another family for a word that is not a colour', () => {
    // 호랑이 is the only card art in Animals: its ㅎ partner comes from another family.
    const picked = distractorsFor(byId('vocab:horangi'), 'image-to-word', input({ pool: ANIMALS, universe: VOCAB_ITEMS, levelOrder: 2, seed: 4 }));
    const initial = (ko: string): string | undefined => decomposeSyllable(ko[0]!)?.initial;
    expect(picked.some((p) => initial(p.ko) === 'ㅎ')).toBe(true);
  });

  it('a lone card art answer is asked as image-to-word when the level allows it, so its style never gives it away', () => {
    for (const levelOrder of [1, 2] as const) {
      for (let seed = 0; seed < 40; seed++) {
        for (const box of [0, 1, 2]) {
          const questions = buildQuestions(input({ pool: ANIMALS, levelOrder, seed, count: ANIMALS.length, boxOf: () => box }));
          const tiger = questions.find((q) => q.itemId === 'vocab:horangi')!;
          expect(tiger.format).toBe('image-to-word');
        }
      }
    }
  });

  it('a card art answer with other cards in its options keeps its box format (Food has three cards)', () => {
    const questions = buildQuestions(input({ pool: FOOD, boxOf: () => 0, count: FOOD.length }));
    const kimchi = questions.find((q) => q.itemId === 'vocab:gimchi')!;
    expect(kimchi.format).toBe('word-to-image');
    expect(kimchi.options.filter((o) => o.pictureRef?.startsWith('card:')).length).toBeGreaterThan(1);
  });

  it('at Pictures first (no image-to-word) the lone card art is still asked rather than dropped', () => {
    const questions = buildQuestions(input({ pool: ANIMALS, levelOrder: 0, optionCount: 3, count: ANIMALS.length }));
    const tiger = questions.find((q) => q.itemId === 'vocab:horangi')!;
    expect(tiger.format).toBe('word-to-image');
  });

  it('tries another allowed format before skipping a word whose box format cannot get enough options', () => {
    const apple = byId('vocab:sagwa-apple');
    const other = FOOD.find((f) => f.id !== apple.id && f.visual.startsWith('word:'))!;
    // Only two food pictures draw: no picture question can be built, a written one can.
    const canRender = (ref: string): boolean => ref === apple.visual || ref === other.visual;
    const [q] = buildQuestions(input({ pool: [apple], universe: FOOD, count: 1, boxOf: () => 0, canRender }));
    expect(q!.format).toBe('image-to-word');
    expect(q!.options).toHaveLength(4);
    // Pictures first has no written format, so the word cannot be asked at all.
    expect(() => buildQuestions(input({ pool: [apple], universe: FOOD, count: 1, levelOrder: 0, optionCount: 3, canRender }))).toThrow(
      NotEnoughWords,
    );
  });

  it('returns no questions for a count below 1 instead of throwing', () => {
    for (const count of [0, -3, Number.NaN]) expect(buildQuestions(input({ pool: FOOD, count }))).toEqual([]);
  });

  it('reads a negative or NaN seed as a whole number of at least 0, so options never have holes', () => {
    expect(normaliseSeed(-100)).toBe(100);
    expect(normaliseSeed(-1.7)).toBe(1);
    expect(normaliseSeed(Number.NaN)).toBe(0);
    expect(normaliseSeed(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normaliseSeed(42)).toBe(42);
    for (const seed of [-1, -100, -2147483648, Number.NaN]) {
      const i = input({ pool: FOOD, seed, boxOf: (id) => id.length % 6 });
      const questions = buildQuestions(i);
      expect(questions).toHaveLength(10);
      assertProperties(questions, i);
      expect(questions).toEqual(buildQuestions({ ...i, seed: normaliseSeed(seed) }));
      const picked = distractorsFor(byId('vocab:gimchi'), 'word-to-image', i);
      expect(picked).toHaveLength(3);
      expect(picked.every((p) => p !== undefined)).toBe(true);
    }
  });
});
