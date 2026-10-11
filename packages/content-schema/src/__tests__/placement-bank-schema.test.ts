import { describe, expect, it } from 'vitest';
import {
  PLACEMENT_FORMATS,
  PlacementBankSchema,
  PlacementTemplateSchema,
  RUNG_TABLE,
  type PlacementBank,
  type PlacementBankInput,
  type PlacementTemplate,
  type PlacementTemplateInput,
} from '../index';

/**
 * F-PLC-001 section 3.4: the bank template and the bank. The two schemas must
 * stay assignable to P-3's structural `PlacementTemplateInput` / `PlacementBankInput`.
 */

type Opt = PlacementTemplate['question']['options'][number];
const ko = (id: string, text: string, isCorrect = false): Opt => ({ id, ko: text, romanization: id, en: `gloss ${id}`, isCorrect });
const pic = (slug: string, isCorrect = false): Opt => ({ id: slug, pictureRef: `card:${slug}`, en: slug, isCorrect });
const chip = (id: string, isCorrect = false): Opt => ({ id, sound: id, isCorrect });

const base = (over: Omit<Partial<PlacementTemplate>, 'question'> & { question: PlacementTemplate['question'] }): PlacementTemplate => ({
  id: 'pitem:x',
  strand: 'sound-letter',
  gate: 'sound-basic',
  form: 'decode',
  glossEn: 'gloss',
  status: 'ready',
  ...over,
});

const recog = (): PlacementTemplate =>
  base({
    id: 'pitem:recog-odd-giyeok-nieun',
    strand: 'hangul-recognition',
    gate: 'recog',
    question: {
      format: 'shape-odd-one-out',
      options: [ko('t1', 'ㄴ'), ko('t2', 'ㄴ'), ko('t3', 'ㄱ', true), ko('t4', 'ㄴ')],
      tags: ['sym:ㄱ', 'sym:ㄴ', 'look-alike'],
      requires: { audio: false, picture: null },
      leaks: false,
    },
  });
const soundHear = (): PlacementTemplate =>
  base({
    id: 'pitem:sound-basic-hear-giyeok',
    question: {
      format: 'hear-pick-written',
      spokenKo: '가',
      promptRomanization: 'ga',
      options: [ko('giyeok', 'ㄱ', true), ko('kieuk', 'ㅋ'), ko('nieun', 'ㄴ'), ko('digeut', 'ㄷ')],
      tags: ['sym:ㄱ', 'group:basic'],
      requires: { audio: true, picture: null },
      leaks: true,
    },
  });
const soundSee = (): PlacementTemplate =>
  base({
    id: 'pitem:sound-basic-see-giyeok',
    question: {
      format: 'see-pick-sound',
      promptKo: 'ㄱ',
      promptRomanization: 'ga',
      options: [chip('ga', true), chip('ka'), chip('na'), chip('da')],
      tags: ['sym:ㄱ', 'group:basic'],
      requires: { audio: false, picture: null },
      leaks: true,
    },
  });
const restHear = (): PlacementTemplate => {
  const t = soundHear();
  return {
    ...t,
    id: 'pitem:sound-rest-hear-jieut',
    gate: 'sound-rest',
    question: { ...t.question, spokenKo: '자', options: [ko('jieut', 'ㅈ', true), ko('chieut', 'ㅊ'), ko('siot', 'ㅅ'), ko('giyeok', 'ㄱ')], tags: ['sym:ㅈ', 'group:rest'] },
  };
};
const cvBuild = (): PlacementTemplate =>
  base({
    id: 'pitem:syl-cv-build-ga',
    strand: 'syllable-reading',
    gate: 'syl-cv',
    question: {
      format: 'build-syllable',
      spokenKo: '가',
      promptRomanization: 'ga',
      options: [ko('ga', '가', true), ko('gi', '기'), ko('na', '나'), ko('geo', '거')],
      tags: ['sym:ㄱ', 'sym:ㅏ', 'syl:ga', 'shape:cv'],
      requires: { audio: true, picture: null },
      leaks: true,
    },
  });
const cvcHear = (): PlacementTemplate => {
  const t = cvBuild();
  return {
    ...t,
    id: 'pitem:syl-cvc-hear-dal',
    gate: 'syl-cvc',
    question: {
      ...t.question,
      format: 'hear-pick-written',
      spokenKo: '달',
      options: [ko('dal', '달', true), ko('dan', '단'), ko('dam', '담'), ko('deol', '덜')],
      tags: ['sym:ㄷ', 'sym:ㅏ', 'sym:ㄹ/final', 'syl:dal', 'shape:cvc'],
    },
  };
};
const vocabHear = (): PlacementTemplate =>
  base({
    id: 'pitem:vocab-hear-gimchi',
    strand: 'vocabulary',
    gate: 'vocab',
    form: 'oral',
    question: {
      format: 'hear-pick-picture',
      promptKo: '김치',
      promptRomanization: 'gimchi',
      options: [pic('kimchi', true), pic('tiger'), pic('moon'), pic('kite')],
      tags: ['word:gimchi', 'topic:life'],
      requires: { audio: true, picture: 'card' },
      leaks: false,
    },
  });
const vocabRead = (): PlacementTemplate => {
  const t = vocabHear();
  return { ...t, id: 'pitem:vocab-read-gimchi', form: 'read', question: { ...t.question, format: 'read-pick-picture', requires: { audio: false, picture: 'card' }, leaks: true } };
};
const reply = (): PlacementTemplate =>
  base({
    id: 'pitem:sent-reply-1',
    strand: 'sentences',
    gate: 'sentence',
    form: 'read',
    status: 'draft',
    incompatibleWith: ['pitem:sent-reply-3'],
    question: {
      format: 'reply-pick',
      promptKo: '안녕하세요!',
      promptRomanization: 'annyeonghaseyo',
      options: [ko('reply-1', '안녕하세요', true), ko('reply-2', '저는 호야예요'), ko('reply-5', '안녕히 계세요')],
      tags: ['pattern:reply'],
      requires: { audio: true, picture: null },
      leaks: true,
    },
  });
const sentHear = (): PlacementTemplate => {
  const t = vocabHear();
  return { ...t, id: 'pitem:sent-n-hear-horangiyeyo', strand: 'sentences', gate: 'sentence', status: 'draft', question: { ...t.question, promptKo: '호랑이예요', tags: ['pattern:n-ieyo', 'word:horangi'] } };
};

const ALL = [recog, soundHear, soundSee, restHear, cvBuild, cvcHear, vocabHear, vocabRead, reply, sentHear];

const messages = (t: unknown): string[] => {
  const r = PlacementTemplateSchema.safeParse(t);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};
const change = (make: () => PlacementTemplate, fn: (t: PlacementTemplate) => void): PlacementTemplate => {
  const t = structuredClone(make());
  fn(t);
  return t;
};
const rejects = (make: () => PlacementTemplate, fn: (t: PlacementTemplate) => void, part: string): void => {
  expect(messages(change(make, fn)).join(' | ')).toContain(part);
};

describe('PlacementTemplateSchema', () => {
  it('accepts a well-formed template of every format', () => {
    for (const make of ALL) expect(messages(make()), make().id).toEqual([]);
  });

  it('is assignable to the engine input types (P-3 structural contract)', () => {
    const t: PlacementTemplate = soundHear();
    const input: PlacementTemplateInput = t;
    const bank: PlacementBank = { version: 1, templates: [t] };
    const bankInput: PlacementBankInput = bank;
    expect(input.id).toBe(t.id);
    expect(bankInput.templates).toHaveLength(1);
  });

  it('keeps the optional incompatibleWith list', () => {
    expect(PlacementTemplateSchema.parse(reply()).incompatibleWith).toEqual(['pitem:sent-reply-3']);
    expect(PlacementTemplateSchema.parse(soundHear()).incompatibleWith).toBeUndefined();
    rejects(reply, (t) => (t.incompatibleWith = ['sent-reply-3']), 'Invalid');
  });

  it('checks the id, the gloss length and the status', () => {
    rejects(soundHear, (t) => (t.id = 'sound-basic-hear'), 'Invalid');
    rejects(soundHear, (t) => (t.glossEn = 'x'.repeat(61)), 'at most 60');
    rejects(soundHear, (t) => ((t as { status: string }).status = 'live'), 'Invalid enum');
  });

  it('keeps the strand, the form and the format on the gate table', () => {
    rejects(soundHear, (t) => (t.strand = 'vocabulary'), 'strand must be sound-letter');
    rejects(soundHear, (t) => (t.form = 'read'), 'form read is not used by gate sound-basic');
    rejects(vocabHear, (t) => (t.form = 'decode'), 'form decode is not used by gate vocab');
    rejects(soundHear, (t) => (t.question.format = 'shape-odd-one-out'), 'format shape-odd-one-out is not used by gate sound-basic');
    rejects(reply, (t) => (t.form = 'oral'), 'format reply-pick is not used by gate sentence (oral)');
  });

  it('knows which formats each gate and form may use, and agrees with the rung table', () => {
    for (const spec of RUNG_TABLE) {
      for (const form of spec.forms) expect(PLACEMENT_FORMATS[spec.gate][form], `${spec.gate}:${form}`).toBeDefined();
      expect(Object.keys(PLACEMENT_FORMATS[spec.gate]).sort(), spec.gate).toEqual([...spec.forms].sort());
    }
  });

  it('sets leaks and requires.audio from the format', () => {
    rejects(soundHear, (t) => (t.question.leaks = false), 'leaks must be true for hear-pick-written');
    rejects(vocabHear, (t) => (t.question.leaks = true), 'leaks must be false for hear-pick-picture');
    rejects(recog, (t) => (t.question.leaks = true), 'leaks must be false for shape-odd-one-out');
    rejects(soundHear, (t) => (t.question.requires.audio = false), 'requires.audio must be true for hear-pick-written');
    rejects(cvBuild, (t) => (t.question.requires.audio = false), 'requires.audio must be true for build-syllable');
    rejects(soundSee, (t) => (t.question.requires.audio = true), 'requires.audio must be false for see-pick-sound');
  });

  it('counts options: four, or three or four for a reply', () => {
    rejects(soundHear, (t) => t.question.options.pop(), 'needs 4 options');
    rejects(reply, (t) => t.question.options.pop(), 'needs 3 or 4 options');
    const four = change(reply, (t) => t.question.options.push(ko('reply-9', '괜찮아요')));
    expect(messages(four)).toEqual([]);
  });

  it('gives each format the option content it needs', () => {
    rejects(soundSee, (t) => (t.question.options[0] = ko('ga', '가', true)), 'every option needs a sound chip');
    rejects(soundHear, (t) => (t.question.options[1] = chip('ka')), 'every option needs Korean');
    rejects(vocabHear, (t) => (t.question.options[1] = ko('tiger', '호랑이')), 'every option needs a picture');
    rejects(vocabHear, (t) => (t.question.options[1] = { ...pic('tiger'), ko: '호랑이', romanization: 'horangi', en: 'tiger' }), 'no text label');
    rejects(vocabHear, (t) => (t.question.requires.picture = null), 'requires.picture must be card or word');
    rejects(vocabHear, (t) => (t.question.requires.picture = 'word'), 'pictures must be word: refs');
    rejects(soundHear, (t) => (t.question.requires.picture = 'card'), 'requires.picture must be null');
  });

  it('gives Korean options a romanization and a gloss (CLAUDE.md section 1)', () => {
    rejects(soundHear, (t) => delete t.question.options[1]!.romanization, 'needs a romanization');
    rejects(soundHear, (t) => delete t.question.options[1]!.en, 'needs a gloss');
  });

  it('keeps the prompt and the voice on the format', () => {
    rejects(soundHear, (t) => delete t.question.spokenKo, 'needs spokenKo');
    rejects(cvBuild, (t) => delete t.question.spokenKo, 'needs spokenKo');
    rejects(soundHear, (t) => (t.question.promptKo = 'ㄱ'), 'must not show the answer as promptKo');
    rejects(soundSee, (t) => delete t.question.promptKo, 'needs promptKo');
    rejects(reply, (t) => delete t.question.promptKo, 'needs promptKo');
    rejects(vocabHear, (t) => delete t.question.promptKo, 'needs promptKo');
    rejects(soundSee, (t) => delete t.question.promptRomanization, 'needs promptRomanization');
    expect(messages(change(recog, (t) => (t.question.promptRomanization = undefined)))).toEqual([]);
  });

  it('only allows the known tags', () => {
    rejects(soundHear, (t) => t.question.tags.push('sym:ㄲ'), 'unknown tag sym:ㄲ');
    rejects(soundHear, (t) => t.question.tags.push('level:3'), 'unknown tag level:3');
    rejects(soundHear, (t) => t.question.tags.push('topic:space'), 'unknown tag topic:space');
    expect(messages(change(soundHear, (t) => t.question.tags.push('look-alike')))).toEqual([]);
  });

  it('recognition: three tiles show one letter, one differs, two symbols and look-alike', () => {
    rejects(recog, (t) => (t.question.options[1]!.ko = 'ㅂ'), 'three tiles must show the same letter');
    rejects(recog, (t) => (t.question.options[2]!.ko = 'ㄴ'), 'the correct tile must differ');
    rejects(recog, (t) => (t.question.tags = ['sym:ㄱ', 'look-alike']), 'two sym tags');
    rejects(recog, (t) => (t.question.tags = ['sym:ㄱ', 'sym:ㄴ']), 'look-alike tag');
  });

  it('sound gates: one symbol of their own group, the group tag, and the correct option is that symbol', () => {
    rejects(soundHear, (t) => (t.question.tags = ['group:basic']), 'exactly one sym tag');
    rejects(soundHear, (t) => (t.question.tags = ['sym:ㅈ', 'group:basic']), 'sym tag must be in the basic group');
    rejects(soundHear, (t) => (t.question.tags = ['sym:ㄱ']), 'group:basic tag');
    rejects(restHear, (t) => (t.question.tags = ['sym:ㄱ', 'group:rest']), 'sym tag must be in the rest group');
    rejects(soundHear, (t) => (t.question.options[0]!.ko = 'ㅋ'), 'must be the tagged symbol');
    rejects(soundSee, (t) => (t.question.promptKo = 'ㅋ'), 'must be the tagged symbol');
  });

  it('syllable gates: shape, one syl tag and the right number of symbols', () => {
    rejects(cvBuild, (t) => (t.question.tags = ['sym:ㄱ', 'sym:ㅏ', 'syl:ga']), 'shape:cv tag');
    rejects(cvBuild, (t) => (t.question.tags = ['sym:ㄱ', 'sym:ㅏ', 'shape:cv']), 'exactly one syl tag');
    rejects(cvBuild, (t) => (t.question.tags = ['sym:ㄱ', 'syl:ga', 'shape:cv']), 'two sym tags');
    rejects(cvBuild, (t) => (t.question.tags = ['sym:ㄱ', 'sym:ㄴ/final', 'syl:ga', 'shape:cv']), 'no final');
    rejects(cvcHear, (t) => (t.question.tags = ['sym:ㄷ', 'sym:ㅏ', 'sym:ㄹ', 'syl:dal', 'shape:cvc']), 'one final');
    rejects(cvcHear, (t) => (t.question.tags = ['sym:ㄷ', 'sym:ㅏ', 'sym:ㄹ/final', 'syl:dal', 'shape:cv']), 'shape:cvc tag');
    rejects(cvcHear, (t) => (t.question.tags = ['sym:ㄷ', 'sym:ㅏ', 'syl:dal', 'shape:cvc']), 'three sym tags');
  });

  it('vocabulary needs one word tag, sentences one pattern tag', () => {
    rejects(vocabHear, (t) => (t.question.tags = ['topic:life']), 'exactly one word tag');
    rejects(sentHear, (t) => (t.question.tags = ['word:horangi']), 'exactly one pattern tag');
    expect(messages(sentHear())).toEqual([]);
  });

  it('keeps a sentence out of ready until it carries its language review record', () => {
    rejects(reply, (t) => (t.status = 'ready'), 'needs its language review record');
    rejects(sentHear, (t) => (t.status = 'ready'), 'needs its language review record');
    rejects(sentHear, (t) => Object.assign(t, { status: 'ready', reviewedBy: 'ab' }), 'needs its language review record');
    rejects(sentHear, (t) => Object.assign(t, { status: 'ready', reviewedAt: '2026-10-11' }), 'needs its language review record');
    expect(messages({ ...sentHear(), status: 'ready', reviewedBy: 'ab', reviewedAt: '2026-10-11' })).toEqual([]);
    expect(messages({ ...reply(), status: 'ready', reviewedBy: 'ab', reviewedAt: '2026-10-11' })).toEqual([]);
  });

  it('checks the shape of the review record', () => {
    expect(PlacementTemplateSchema.safeParse({ ...sentHear(), reviewedAt: '11/10/2026' }).success).toBe(false);
    expect(PlacementTemplateSchema.safeParse({ ...sentHear(), reviewedBy: ' ' }).success).toBe(false);
    expect(PlacementTemplateSchema.safeParse({ ...sentHear(), reviewedBy: 'x'.repeat(17) }).success).toBe(false);
  });

  it('still applies the shared question rules', () => {
    rejects(soundHear, (t) => (t.question.options[1]!.isCorrect = true), 'exactly one option must be correct');
    rejects(soundHear, (t) => (t.question.options[1]!.ko = 'ㄱ'), 'same Korean text');
  });
});

describe('PlacementBankSchema', () => {
  const many = (make: () => PlacementTemplate, n: number, prefix: string): PlacementTemplate[] =>
    Array.from({ length: n }, (_, i) => ({ ...structuredClone(make()), id: `pitem:${prefix}-${i}` }));
  const plainReply = (id: string, over: (t: PlacementTemplate) => void = () => undefined): PlacementTemplate =>
    change(reply, (t) => {
      t.id = id;
      delete t.incompatibleWith;
      over(t);
    });
  const goodBank = (): PlacementBank => ({
    version: 1,
    templates: [...many(recog, 9, 'a'), ...many(soundHear, 9, 'b'), plainReply('pitem:c-0')],
  });
  const bankMessages = (b: unknown): string[] => {
    const r = PlacementBankSchema.safeParse(b);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it('accepts a bank whose ready gates have three full draws', () => {
    expect(bankMessages(goodBank())).toEqual([]);
  });

  it('needs a positive integer version and at least one template', () => {
    expect(bankMessages({ ...goodBank(), version: 0 }).length).toBeGreaterThan(0);
    expect(bankMessages({ version: 1, templates: [] }).length).toBeGreaterThan(0);
  });

  it('rejects duplicate ids', () => {
    const b = goodBank();
    b.templates.push({ ...b.templates[0]! });
    expect(bankMessages(b).join('|')).toContain('duplicate template id');
  });

  it('needs nine ready templates for every (gate, form) that has any; drafts neither count nor trigger the rule', () => {
    const short: PlacementBank = { version: 1, templates: [...many(recog, 9, 'a'), ...many(soundHear, 8, 'b')] };
    expect(bankMessages(short).join('|')).toContain('sound-basic decode needs at least 9 ready templates, has 8');
    const draftsOnly: PlacementBank = { version: 1, templates: [...many(recog, 9, 'a'), plainReply('pitem:c-0'), plainReply('pitem:c-1')] };
    expect(bankMessages(draftsOnly)).toEqual([]);
    const draftSound = many(soundHear, 9, 'b').map((t) => ({ ...t, status: 'draft' as const }));
    expect(bankMessages({ version: 1, templates: [...many(recog, 9, 'a'), ...draftSound] })).toEqual([]);
  });

  it('checks that incompatibleWith ids exist and are never offered as distractors', () => {
    const r1 = change(reply, (t) => (t.id = 'pitem:sent-reply-1'));
    const lonely: PlacementBank = { version: 1, templates: [...many(recog, 9, 'a'), r1] };
    expect(bankMessages(lonely).join('|')).toContain('incompatibleWith pitem:sent-reply-3 is not in the bank');
    const r3 = change(reply, (t) => {
      t.id = 'pitem:sent-reply-3';
      t.incompatibleWith = ['pitem:sent-reply-1'];
      t.question.options = [ko('reply-3', '저도 반가워요', true), ko('reply-2', '저는 호야예요'), ko('reply-5', '안녕히 계세요')];
    });
    expect(bankMessages({ version: 1, templates: [...many(recog, 9, 'a'), r1, r3] })).toEqual([]);
    // reply-3's correct answer shows up as a distractor of reply-1
    const leaky = change(reply, (t) => {
      t.id = 'pitem:sent-reply-1';
      t.question.options = [ko('reply-1', '안녕하세요', true), ko('reply-3', '저도 반가워요'), ko('reply-5', '안녕히 계세요')];
    });
    expect(bankMessages({ version: 1, templates: [...many(recog, 9, 'a'), leaky, r3] }).join('|')).toContain('offers the natural answer of pitem:sent-reply-3');
  });
});
