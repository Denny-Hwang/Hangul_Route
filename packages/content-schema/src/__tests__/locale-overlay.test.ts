import { describe, expect, it } from 'vitest';
import {
  LocaleOverlayFileSchema,
  NEVER_OVERRIDABLE_FIELDS,
  OVERLAY_ENTITY_ID,
  OVERLAY_FIELDS,
  OVERLAY_LOCALES,
  OVERLAYS,
  isOverlayFieldAllowed,
  localize,
  localizeGloss,
  overlayElementKey,
  overlayPrefix,
  overlayTargets,
  translatableFields,
  type HeritageCard,
  type LocalizedFields,
  type Overlays,
} from '../index';

/** F-I18N-001 §3.6: overlay file shape, the allow-list per id prefix, `localize` and `localizeGloss`. */

const card: HeritageCard = {
  id: 'card:gangaji',
  titleEn: 'Puppy',
  subtitleKo: '강아지',
  romanization: 'gangaji',
  blurbEn: 'A friendly little dog.',
  factEn: 'Families call small dogs gangaji.',
  theme: 'life',
  stage: 'stage1',
  rarity: 'common',
  unlockedBy: 'jamo:giyeok',
};

const overlays: Overlays = {
  es: {
    'card:gangaji': { title: 'Perrito', blurb: 'Un perro pequeño y simpático.' },
    'jamo:giyeok': { gloss: 'G, como en gato', soundHint: 'como la g de gato', 'exampleWord.gloss': 'cachorro' },
    'quest:s1-letters-1': { title: 'Primeras letras', 'steps.intro.title': 'Hola', 'steps.nope.title': 'x' },
    'stage:stage1': { title: 'Hangul', oneLiner: 'Conoce cada letra.' },
    'story:demo': {
      title: 'Demo',
      summary: 'Resumen',
      'scenes.s2.narration': 'Hoya ve {kw:dal}.',
      'checks.c1.options.b': 'Luna',
      'keywords.dal.gloss': 'luna',
    },
    'minigame:s1-life-card-1': {
      'cardPairs.gimchi.gloss': 'Kimchi (es)',
      'storySteps.b.label': 'Poner la mesa',
      'dialogue.0.npc': '¡Hola!',
      'dialogue.0.options.jal-gayo.gloss': 'Adiós',
      'listenPick.rounds.r1.prompt': 'la letra g',
      'listenPick.rounds.lp-sym-jamo-giyeok.prompt': 'la letra giyeok',
      'listenPick.rounds.2.prompt': 'la sílaba ga',
    },
    'pitem:vocab-hear-gimchi': { gloss: 'kimchi (oír)', 'options.moon.gloss': 'Luna' },
  },
  ko: {
    'card:gangaji': { title: '강아지 카드', fact: '작은 개를 부르는 말이에요.' },
  },
};

describe('overlay vocabulary (F-I18N-001 §3.6)', () => {
  it('has the two overlay locales and never en', () => {
    expect([...OVERLAY_LOCALES]).toEqual(['es', 'ko']);
  });

  it('accepts entity ids of the documented grammar only', () => {
    for (const ok of ['card:gangaji', 'jamo:giyeok-batchim', 'vocab-topic:food', 'story:sun-and-moon', 'pitem:a1', 'x:a.b:c']) {
      expect(OVERLAY_ENTITY_ID.test(ok), ok).toBe(true);
    }
    for (const bad of ['card', 'Card:x', 'card:', ':x', 'card:Gangaji', 'card:gang aji']) {
      expect(OVERLAY_ENTITY_ID.test(bad), bad).toBe(false);
    }
  });

  it('takes the prefix before the first colon', () => {
    expect(overlayPrefix('vocab-topic:food')).toBe('vocab-topic');
    expect(overlayPrefix('jamo:giyeok')).toBe('jamo');
    expect(overlayPrefix('nocolon')).toBe('');
  });

  it('has a row for every prefix the specs ask for (F-I18N-001, F-STORY-001, F-VOC-001, F-PLC-001)', () => {
    expect(Object.keys(OVERLAY_FIELDS).sort()).toEqual(
      ['card', 'episode', 'jamo', 'minigame', 'pitem', 'quest', 'stage', 'story', 'theme', 'vocab', 'vocab-topic'].sort(),
    );
    expect(OVERLAY_FIELDS.vocab).toEqual(['gloss', 'senseNote']);
    expect(OVERLAY_FIELDS['vocab-topic']).toEqual(['title', 'blurb', 'hoyaIntro']);
    expect(OVERLAY_FIELDS.pitem).toEqual(['gloss', 'options.<optionId>.gloss']);
  });

  it('addresses Listen & Pick rounds where the scope keeps them, and Discover content and the teaser of a quest', () => {
    expect(OVERLAY_FIELDS.minigame).toContain('listenPick.rounds.<roundId>.prompt');
    expect(OVERLAY_FIELDS.minigame).not.toContain('rounds.<roundId>.prompt');
    expect(OVERLAY_FIELDS.quest).toEqual(
      expect.arrayContaining([
        'teaser',
        'steps.<stepId>.discover.pages.<page>.caption',
        'steps.<stepId>.discover.pages.<page>.items.<item>.example.gloss',
        'steps.<stepId>.discover.pages.<page>.items.<item>.word.gloss',
        'steps.<stepId>.discover.pages.<page>.items.<item>.note',
      ]),
    );
  });

  it('allows listed fields and dotted paths with ids', () => {
    const allowed: Array<[string, string]> = [
      ['jamo:giyeok', 'gloss'],
      ['jamo:giyeok', 'soundHint'],
      ['jamo:giyeok', 'exampleWord.gloss'],
      ['jamo:giyeok', 'nameHint'],
      ['card:gangaji', 'fact'],
      ['episode:s1-letters', 'hoyaIntro'],
      ['quest:s1-letters-1', 'steps.intro.hoyaLine'],
      ['minigame:s1-life-card-1', 'dialogue.0.options.jal-gayo.gloss'],
      ['minigame:s1-letters-recognize-1', 'listenPick.rounds.lp-sym-jamo-eo.prompt'],
      ['minigame:s1-letters-recognize-1', 'listenPick.rounds.3.prompt'],
      ['quest:s1-letters-1', 'teaser'],
      ['quest:s1-letters-1', 'steps.discover.discover.pages.0.items.1.example.gloss'],
      ['quest:s1-letters-1', 'steps.discover.discover.pages.1.items.0.word.gloss'],
      ['quest:s1-letters-1', 'steps.discover.discover.pages.1.items.0.note'],
      ['quest:s1-letters-1', 'steps.discover.discover.pages.0.caption'],
      ['stage:stage1', 'anchorSkill'],
      ['theme:letters', 'oneLiner'],
      ['story:sun-and-moon', 'scenes.s1.narration'],
      ['story:sun-and-moon', 'checks.c-1.options.a'],
      ['story:sun-and-moon', 'errata.e1.summary'],
      ['vocab:sagwa', 'senseNote'],
      ['vocab-topic:food', 'hoyaIntro'],
      ['pitem:vocab-hear-gimchi', 'options.moon.gloss'],
    ];
    for (const [id, field] of allowed) expect(isOverlayFieldAllowed(id, field), `${id} ${field}`).toBe(true);
  });

  it('rejects never-overridable fields, unknown fields, bad ids and unknown prefixes', () => {
    expect([...NEVER_OVERRIDABLE_FIELDS]).toEqual(
      expect.arrayContaining(['ko', 'char', 'romanization', 'target', 'answer_ko', 'lang_ko', 'audioRef', 'id', 'order']),
    );
    const rejected: Array<[string, string]> = [
      ['card:gangaji', 'romanization'],
      ['card:gangaji', 'ko'],
      ['card:gangaji', 'titleEn'],
      ['jamo:giyeok', 'char'],
      ['jamo:giyeok', 'audioRef'],
      ['quest:q', 'steps.intro'],
      ['quest:q', 'steps.Intro.title'],
      ['quest:q', 'steps..title'],
      ['story:s', 'scenes.s1.narration.extra'],
      ['vocab-topic:food', 'gloss'],
      ['vocab:sagwa', 'title'],
      ['pitem:x', 'options.a.ko'],
      ['minigame:s1-letters-recognize-1', 'rounds.r1.prompt'],
      ['minigame:s1-letters-recognize-1', 'listenPick.rounds.lp:sym:jamo:eo.prompt'],
      ['quest:q', 'steps.discover.discover.pages.0.items.0.example.ko'],
      ['quest:q', 'steps.discover.discover.pages.0.items.0.word.romanization'],
      ['planet:mars', 'title'],
      ['nocolon', 'title'],
    ];
    for (const [id, field] of rejected) expect(isOverlayFieldAllowed(id, field), `${id} ${field}`).toBe(false);
  });
});

describe('LocaleOverlayFileSchema', () => {
  const file = (over: Record<string, unknown> = {}) => ({
    locale: 'es',
    domain: 'stage1-cards',
    entries: { 'card:gangaji': { title: 'Perrito' } },
    ...over,
  });

  it('parses a well-formed overlay file', () => {
    expect(LocaleOverlayFileSchema.parse(file())).toEqual(file());
  });

  it('rejects en, unknown locales, bad domains, extra keys and a missing entries object', () => {
    expect(LocaleOverlayFileSchema.safeParse(file({ locale: 'en' })).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse(file({ locale: 'fr' })).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse(file({ domain: 'Stage 1' })).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse(file({ extra: true })).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse({ locale: 'es', domain: 'x' }).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse(file({ entries: [] })).success).toBe(false);
  });

  it('rejects bad entity ids, non-string and blank values', () => {
    expect(LocaleOverlayFileSchema.safeParse(file({ entries: { Card: { title: 'x' } } })).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse(file({ entries: { 'card:a': { title: 3 } } })).success).toBe(false);
    expect(LocaleOverlayFileSchema.safeParse(file({ entries: { 'card:a': { title: '  ' } } })).success).toBe(false);
  });

  it('reports a field outside the allow-list as overlay-forbidden-field at its path', () => {
    const result = LocaleOverlayFileSchema.safeParse(file({ entries: { 'card:gangaji': { romanization: 'kangaji' } } }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['entries', 'card:gangaji', 'romanization']);
      expect(result.error.issues[0]?.message).toMatch(/^overlay-forbidden-field/);
    }
  });
});

describe('localize (F-I18N-001 §3.6 runtime)', () => {
  it('returns the very same entity for en, a locale without entries and an entity without an entry', () => {
    expect(localize(card, card.id, 'en', overlays)).toBe(card);
    expect(localize(card, card.id, 'es', { es: {}, ko: {} })).toBe(card);
    expect(localize({ ...card, id: 'card:other' }, 'card:other', 'es', overlays)).toEqual({ ...card, id: 'card:other' });
  });

  it('replaces *En fields and leaves the taught Korean and its romanization untouched', () => {
    const es = localize(card, card.id, 'es', overlays);
    expect(es).toEqual({ ...card, titleEn: 'Perrito', blurbEn: 'Un perro pequeño y simpático.' });
    expect(es).not.toBe(card);
    expect(card.titleEn).toBe('Puppy');
    const ko = localize(card, card.id, 'ko', overlays);
    expect(ko.titleEn).toBe('강아지 카드');
    expect(ko.factEn).toBe('작은 개를 부르는 말이에요.');
    expect(ko.blurbEn).toBe(card.blurbEn);
    expect(ko.subtitleKo).toBe('강아지');
    expect(ko.romanization).toBe('gangaji');
  });

  it('replaces JSON fields (title, blurb, en) and nested JSON glosses', () => {
    const jsonCard = { id: 'card:gangaji', title: 'Puppy', ko: '강아지', romanization: 'gangaji', en: 'Puppy', blurb: 'A dog.' };
    expect(localize(jsonCard, jsonCard.id, 'es', overlays)).toEqual({ ...jsonCard, title: 'Perrito', blurb: 'Un perro pequeño y simpático.' });
    const jsonJamo = {
      id: 'jamo:giyeok',
      ko: 'ㄱ',
      romanization: 'g/k',
      en: "G as in 'go'",
      exampleWord: { ko: '강아지', romanization: 'gangaji', en: 'puppy' },
    };
    const es = localize(jsonJamo, jsonJamo.id, 'es', overlays);
    expect(es.en).toBe('G, como en gato');
    expect(es.exampleWord).toEqual({ ko: '강아지', romanization: 'gangaji', en: 'cachorro' });
    expect(jsonJamo.exampleWord.en).toBe('puppy');
  });

  it('serves the TypeScript jamo shape: exampleWord.gloss lands on exampleWordEn, soundHint on soundHint', () => {
    const tsJamo = { id: 'jamo:giyeok', char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', exampleWordEn: 'family', soundHint: 'soft g' };
    expect(localize(tsJamo, tsJamo.id, 'es', overlays)).toEqual({ ...tsJamo, exampleWordEn: 'cachorro', soundHint: 'como la g de gato' });
  });

  it('never takes a gloss from the romanized letter name of a TypeScript jamo (nameEn is romanization, not a gloss)', () => {
    const tsJamo = { id: 'jamo:giyeok', char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', exampleWordEn: 'family' };
    expect(overlayTargets(tsJamo, 'gloss')).toEqual([]);
    const es = localize(tsJamo, tsJamo.id, 'es', overlays);
    expect(es.nameEn).toBe('giyeok');
    expect(Object.keys(es)).not.toContain('gloss');
    expect(translatableFields('jamo:giyeok', tsJamo).map((f) => f.field)).toEqual(['exampleWord.gloss']);
  });

  it('adds a jamo sound hint the English base does not have yet (hints are authored per language), nothing else', () => {
    const bare = { id: 'jamo:giyeok', char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok' };
    const es = localize(bare, bare.id, 'es', overlays);
    expect(es).toEqual({ ...bare, soundHint: 'como la g de gato' });
    expect(Object.keys(es)).not.toContain('gloss');
    expect(overlayTargets(bare, 'nameHint')).toEqual([['nameHint']]);
    expect(overlayTargets(bare, 'title')).toEqual([]);
    expect(overlayTargets({ nested: {} }, 'nested.soundHint')).toEqual([]);
    expect(overlayTargets({ soundHint: 3 }, 'soundHint')).toEqual([]);
    expect(translatableFields('jamo:giyeok', bare)).toEqual([]);
  });

  it('addresses array elements by id and ignores paths that resolve to nothing', () => {
    const quest = {
      id: 'quest:s1-letters-1',
      titleEn: 'First letters',
      steps: [
        { id: 'intro', titleEn: 'Hi', kind: 'intro' },
        { id: 'play', titleEn: 'Play', kind: 'practice' },
      ],
    };
    const es = localize(quest, quest.id, 'es', overlays);
    expect(es.titleEn).toBe('Primeras letras');
    expect(es.steps[0]).toEqual({ id: 'intro', titleEn: 'Hola', kind: 'intro' });
    expect(es.steps[1]).toBe(quest.steps[1]);
    expect(quest.steps[0]?.titleEn).toBe('Hi');
  });

  it('finds nested story collections (scenes and checks inside tiers, KoText titles, option labels)', () => {
    const story = {
      id: 'story:demo',
      title: { ko: '데모', romanization: 'demo', en: 'Demo story' },
      summaryEn: 'Summary',
      keywords: [{ id: 'dal', ko: '달', romanization: 'dal', en: 'moon' }],
      tiers: [
        {
          level: 'listen',
          scenes: [
            { id: 's1', narrationEn: 'One.' },
            { id: 's2', narrationEn: 'Hoya sees the {kw:dal}.' },
          ],
          checks: [{ id: 'c1', promptEn: 'Which?', options: [{ id: 'a', en: 'Sun' }, { id: 'b', en: 'Moon' }] }],
          checkpoints: [],
        },
      ],
    };
    const es = localize(story, story.id, 'es', overlays);
    expect(es.title).toEqual({ ko: '데모', romanization: 'demo', en: 'Demo' });
    expect(es.summaryEn).toBe('Resumen');
    expect(es.keywords[0]?.en).toBe('luna');
    expect(es.tiers[0]?.scenes[1]?.narrationEn).toBe('Hoya ve {kw:dal}.');
    expect(es.tiers[0]?.scenes[0]).toBe(story.tiers[0]?.scenes[0]);
    expect(es.tiers[0]?.checks[0]?.options[1]).toEqual({ id: 'b', en: 'Luna' });
    expect(story.tiers[0]?.scenes[1]?.narrationEn).toBe('Hoya sees the {kw:dal}.');
  });

  it('localizes a minigame scope: pairs by romanization slug, steps by id, turns by index, prompts by round key', () => {
    const scope = {
      kind: 'card-match',
      cardPairs: [
        { ko: '김치', en: 'Kimchi', romanization: 'gimchi' },
        { ko: '밥', en: 'Rice', romanization: 'bap' },
      ],
      storySteps: [
        { id: 'a', labelEn: 'Wash hands' },
        { id: 'b', labelEn: 'Set the table' },
      ],
      dialogue: [
        {
          npcKo: '안녕하세요!',
          npcEn: 'Hello!',
          options: [
            { ko: '안녕하세요', romanization: 'annyeonghaseyo', en: 'Hello', isCorrect: true },
            { ko: '잘 가요', romanization: 'jal gayo', en: 'Goodbye', isCorrect: false },
          ],
        },
      ],
      rounds: 3,
      listenPick: {
        rounds: [
          { id: 'r1', prompt: { ko: '가', romanization: 'ga', en: 'the letter g' } },
          { id: 'lp:sym:jamo:giyeok', prompt: { ko: '가', romanization: 'ga', en: 'the letter giyeok' } },
          { id: 'lp:syl:가', prompt: { ko: '가', romanization: 'ga', en: 'the syllable ga' } },
        ],
      },
    };
    const es = localize(scope, 'minigame:s1-life-card-1', 'es', overlays);
    expect(es.cardPairs.map((p) => p.en)).toEqual(['Kimchi (es)', 'Rice']);
    expect(es.storySteps.map((s) => s.labelEn)).toEqual(['Wash hands', 'Poner la mesa']);
    expect(es.dialogue[0]?.npcEn).toBe('¡Hola!');
    expect(es.dialogue[0]?.options.map((o) => o.en)).toEqual(['Hello', 'Adiós']);
    expect(es.listenPick.rounds.map((r) => r.prompt)).toEqual([
      { ko: '가', romanization: 'ga', en: 'la letra g' },
      { ko: '가', romanization: 'ga', en: 'la letra giyeok' },
      { ko: '가', romanization: 'ga', en: 'la sílaba ga' },
    ]);
    expect(es.rounds).toBe(3);
  });

  it('localizes the Discover pages and the teaser of a quest; the taught Korean and its romanization stay', () => {
    const quest = {
      id: 'quest:discover-demo',
      titleEn: 'Demo',
      teaserEn: 'Meet two new letters.',
      steps: [
        {
          id: 'discover',
          titleEn: 'Discover',
          discover: {
            pages: [
              {
                captionEn: 'Two letters',
                items: [
                  { type: 'jamo', jamoId: 'jamo:giyeok', example: { ko: '가방', romanization: 'gabang', en: 'bag' } },
                  { type: 'word', word: { ko: '나비', romanization: 'nabi', en: 'butterfly' }, noteEn: 'It flies.' },
                ],
              },
            ],
          },
        },
      ],
    };
    const local: Overlays = {
      es: {
        [quest.id]: {
          teaser: 'Conoce dos letras nuevas.',
          'steps.discover.discover.pages.0.caption': 'Dos letras',
          'steps.discover.discover.pages.0.items.0.example.gloss': 'bolso',
          'steps.discover.discover.pages.0.items.1.word.gloss': 'mariposa',
          'steps.discover.discover.pages.0.items.1.note': 'Vuela.',
        },
      },
      ko: {},
    };
    const es = localize(quest, quest.id, 'es', local);
    const page = es.steps[0]!.discover.pages[0]!;
    expect(es.teaserEn).toBe('Conoce dos letras nuevas.');
    expect(page.captionEn).toBe('Dos letras');
    expect(page.items[0]).toEqual({ type: 'jamo', jamoId: 'jamo:giyeok', example: { ko: '가방', romanization: 'gabang', en: 'bolso' } });
    expect(page.items[1]).toEqual({ type: 'word', word: { ko: '나비', romanization: 'nabi', en: 'mariposa' }, noteEn: 'Vuela.' });
    expect(quest.steps[0]!.discover.pages[0]!.items[1]!.noteEn).toBe('It flies.');
    expect(translatableFields(quest.id, quest).map((f) => f.field)).toEqual([
      'title',
      'teaser',
      'steps.discover.title',
      'steps.discover.discover.pages.0.caption',
      'steps.discover.discover.pages.0.items.0.example.gloss',
      'steps.discover.discover.pages.0.items.1.word.gloss',
      'steps.discover.discover.pages.0.items.1.note',
    ]);
  });

  it('serves placement templates: gloss on glossEn, option glosses inside the question', () => {
    const template = {
      id: 'pitem:vocab-hear-gimchi',
      glossEn: 'kimchi (hear)',
      question: { options: [{ id: 'kimchi', en: 'Kimchi' }, { id: 'moon', en: 'Moon' }] },
    };
    const es = localize(template, template.id, 'es', overlays);
    expect(es.glossEn).toBe('kimchi (oír)');
    expect(es.question.options.map((o) => o.en)).toEqual(['Kimchi', 'Luna']);
  });

  it('defaults to the generated OVERLAYS', () => {
    expect(localize(card, card.id, 'es')).toEqual(localize(card, card.id, 'es', OVERLAYS));
    expect(Object.keys(OVERLAYS).sort()).toEqual(['es', 'ko']);
  });

  it('types the localized fields of an entity', () => {
    const fields: LocalizedFields<HeritageCard> = { title: 'Perrito', blurb: 'x', fact: 'y' };
    expect(Object.keys(fields)).toEqual(['title', 'blurb', 'fact']);
  });
});

describe('localizeGloss (inline { ko, en, romanization } pairs)', () => {
  const pair = { ko: '김치', en: 'Kimchi', romanization: 'gimchi' };
  const ref = { entityId: 'minigame:s1-life-card-1', path: 'cardPairs.gimchi' };

  it('replaces the English gloss from the entity overlay at the pair path', () => {
    expect(localizeGloss(pair, 'es', ref, overlays)).toEqual({ ...pair, en: 'Kimchi (es)' });
  });

  it('returns the same pair for en, without a ref, or without an overlay value', () => {
    expect(localizeGloss(pair, 'en', ref, overlays)).toBe(pair);
    expect(localizeGloss(pair, 'es', undefined, overlays)).toBe(pair);
    expect(localizeGloss(pair, 'ko', ref, overlays)).toBe(pair);
    expect(localizeGloss(pair, 'es', { ...ref, path: 'cardPairs.bap' }, overlays)).toBe(pair);
    expect(localizeGloss(pair, 'es', ref)).toEqual(localizeGloss(pair, 'es', ref, OVERLAYS));
  });
});

describe('overlay targets and translatable fields (shared by the validator mirror and the mobile overlay test)', () => {
  it('lists the concrete source paths a field lands on', () => {
    const quest = { id: 'quest:q', titleEn: 'T', steps: [{ id: 'intro', titleEn: 'Hi' }] };
    expect(overlayTargets(quest, 'steps.intro.title')).toEqual([['steps', 0, 'titleEn']]);
    expect(overlayTargets(quest, 'steps.none.title')).toEqual([]);
    expect(overlayTargets(quest, 'blurb')).toEqual([]);
    expect(overlayTargets({ title: { en: 'x' } }, 'title')).toEqual([['title', 'en']]);
    expect(overlayTargets({ en: 'x', gloss_en: 'y' }, 'gloss')).toEqual([['en']]);
    expect(overlayTargets({ gloss_en: 'y' }, 'gloss')).toEqual([['gloss_en']]);
    expect(overlayTargets({ options: [{ id: 'a', en: 'A' }] }, 'options.a')).toEqual([['options', 0, 'en']]);
    expect(overlayTargets({ options: [{ id: 'a' }] }, 'options.a')).toEqual([]);
    expect(overlayTargets('not an object', 'title')).toEqual([]);
    expect(overlayTargets({ steps: 'x' }, 'steps.a.title')).toEqual([]);
  });

  it('keys array elements by id, key, romanization slug, then index', () => {
    expect(overlayElementKey({ id: 'a', key: 'k' }, 3)).toBe('a');
    // An id that is not a path segment is slugged when it is plain ASCII (Listen & Pick round ids)...
    expect(overlayElementKey({ id: 'lp:sym:jamo:eo' }, 3)).toBe('lp-sym-jamo-eo');
    expect(overlayElementKey({ id: 'Intro' }, 3)).toBe('intro');
    expect(overlayElementKey({ key: 'Odd Key' }, 3)).toBe('odd-key');
    // ...and skipped when it carries Korean (`lp:syl:가`): the next rule names the element.
    expect(overlayElementKey({ id: 'lp:syl:가' }, 3)).toBe('3');
    expect(overlayElementKey({ id: 'lp:syl:가', key: 'k' }, 3)).toBe('k');
    expect(overlayElementKey({ id: '::' }, 4)).toBe('4');
    expect(overlayElementKey({ id: 'a--b' }, 4)).toBe('a--b');
    expect(overlayElementKey({ key: 'k' }, 3)).toBe('k');
    expect(overlayElementKey({ romanization: 'ne, joayo' }, 3)).toBe('ne-joayo');
    expect(overlayElementKey({ romanization: '!!' }, 3)).toBe('3');
    expect(overlayElementKey('x', 2)).toBe('2');
  });

  it('enumerates the translatable fields of an entity with their English source', () => {
    const quest = { id: 'quest:q', titleEn: 'T', steps: [{ id: 'intro', titleEn: 'Hi', bodyEn: 'Body' }, { id: 'p', titleEn: 'P' }] };
    expect(translatableFields('quest:q', quest)).toEqual([
      { field: 'title', path: ['titleEn'], source: 'T' },
      { field: 'steps.intro.title', path: ['steps', 0, 'titleEn'], source: 'Hi' },
      { field: 'steps.p.title', path: ['steps', 1, 'titleEn'], source: 'P' },
      { field: 'steps.intro.body', path: ['steps', 0, 'bodyEn'], source: 'Body' },
    ]);
    expect(translatableFields('planet:x', quest)).toEqual([]);
    const pitem = { id: 'pitem:a', glossEn: 'g', question: { options: [{ id: 'o1', en: 'One' }, { id: 'o2' }] } };
    expect(translatableFields('pitem:a', pitem).map((f) => f.field)).toEqual(['gloss', 'options.o1.gloss']);
  });

  it('enumerates the JSON and the TypeScript jamo shapes, story checks and their options', () => {
    const jsonJamo = { id: 'jamo:g', en: 'G', exampleWord: { ko: '강아지', en: 'puppy' } };
    expect(translatableFields('jamo:g', jsonJamo).map((f) => f.field)).toEqual(['gloss', 'exampleWord.gloss']);
    expect(translatableFields('jamo:g', { nameEn: 'giyeok', exampleWordEn: 'family', soundHint: 'soft' })).toEqual([
      { field: 'soundHint', path: ['soundHint'], source: 'soft' },
      { field: 'exampleWord.gloss', path: ['exampleWordEn'], source: 'family' },
    ]);
    expect(translatableFields('jamo:g', { exampleWord: 'x' })).toEqual([]);
    expect(translatableFields('jamo:g', 'not an entity')).toEqual([]);
    const story = { tiers: [{ checks: [{ id: 'c1', promptEn: 'P', options: [{ id: 'a', en: 'A' }, { id: 'b' }] }], checkpoints: [] }] };
    expect(translatableFields('story:s', story).map((f) => f.field)).toEqual(['checks.c1.prompt', 'checks.c1.options.a']);
  });
});
