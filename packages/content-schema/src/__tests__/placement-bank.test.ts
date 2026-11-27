import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as builder from '../../../../scripts/build-placement-bank.mjs';
import {
  EAR_RULED_OUT,
  HOMONYMS,
  PERSON_PICTURES,
  PLACEMENT_BASELINE_FILE,
  PLACEMENT_LINT_MINIMA,
  PLACEMENT_RULES,
  TEXT_PICTURES,
  chipParts,
  lintPlacementTree,
  niklIndex,
  // @ts-expect-error plain-Node script (no declaration file)
} from '../../../../scripts/placement-rules.mjs';
import {
  PLACEMENT_AUDIO_FORMATS,
  PLACEMENT_FORMATS,
  PLACEMENT_NO_LEAK_FORMATS,
  PlacementBankSchema,
  PlacementTemplateSchema,
  RUNG_SYMBOLS,
  RUNG_TABLE,
  checkJamoRomanization,
  checkRomanization,
  composeSyllable,
  decomposeSyllable,
  romanizeReviewed,
  ROMANIZATION_EXCEPTIONS,
  PLACEMENT_MODES,
  startRun,
  type PlacementBank,
  type PlacementConfig,
  type PlacementGate,
  type PlacementStrand,
  type PlacementTemplate,
} from '../index';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-PLC-001 section 3.4 and appendix A: the shipped bank under content/placement/.
 * The JSON is shaped by scripts/build-placement-bank.mjs (the same code that writes
 * placement.generated.ts) and then parsed by PlacementBankSchema.
 */

const build = builder as unknown as { loadModel: (root: string) => { bank: PlacementBank; warmup: PlacementTemplate } };
const model = build.loadModel(REPO_ROOT);
const parsed = PlacementBankSchema.parse(model.bank);
const warmup = PlacementTemplateSchema.parse(model.warmup);
const all = parsed.templates;
const ready = all.filter((t) => t.status === 'ready');

const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const SYMBOLS: string[] = [...RUNG_SYMBOLS.basic, ...RUNG_SYMBOLS.rest];
const CONSONANTS = SYMBOLS.filter((s) => !MEDIALS.includes(s));
const VOWELS = SYMBOLS.filter((s) => MEDIALS.includes(s));
const TAUGHT_FINALS = RUNG_SYMBOLS.finals.map((f) => f.replace('/final', ''));

const part = (syllable: string): { initial: string; medial: string; final: string } => {
  const p = decomposeSyllable(syllable);
  if (p === null) throw new Error(`not a syllable: ${syllable}`);
  return { initial: p.initial, medial: MEDIALS[p.medial] as string, final: p.final };
};
const symTags = (t: PlacementTemplate): string[] => t.question.tags.filter((x) => x.startsWith('sym:')).map((x) => x.slice(4));
const byStrand = (s: PlacementStrand): PlacementTemplate[] => all.filter((t) => t.strand === s);
const byGate = (g: PlacementGate): PlacementTemplate[] => all.filter((t) => t.gate === g);
const tagOf = (t: PlacementTemplate, prefix: string): string => (t.question.tags.find((x) => x.startsWith(prefix)) ?? '').slice(prefix.length);
const correctOf = (t: PlacementTemplate) => t.question.options.find((o) => o.isCorrect)!;

/** The Stage 2 cards have no art in HeritageCardArt (spec 3.4), so no template may show them. */
const NO_ART = ['sagwa', 'uyu', 'ppang', 'dosirak', 'haneul', 'kkot', 'namu', 'byeol'];

describe('content/placement: the bank as shipped', () => {
  it('has the five strand files, the index and a warm-up that is not a bank template', () => {
    const index = JSON.parse(readFileSync(join(REPO_ROOT, 'content/placement/index.json'), 'utf8')) as { version: number; warmup: string; files: string[] };
    expect(index.files).toEqual(['recognition.json', 'sound-letter.json', 'syllable-reading.json', 'vocabulary.json', 'sentences.json']);
    expect(parsed.version).toBe(index.version);
    expect(warmup.id).toBe(index.warmup);
    expect(all.some((t) => t.id === index.warmup)).toBe(false);
    expect(warmup).toMatchObject({ gate: 'vocab', form: 'oral', status: 'ready', strand: 'vocabulary' });
    expect(warmup.question.options.find((o) => o.isCorrect)?.pictureRef).toBe('card:rice');
  });

  it('holds the 274 templates of appendix A (vocabulary as PV-2 rebuilt it, sentences as PV-1c did), by strand', () => {
    expect(byStrand('hangul-recognition')).toHaveLength(40);
    expect(byStrand('sound-letter')).toHaveLength(46);
    expect(byStrand('syllable-reading')).toHaveLength(72);
    expect(byStrand('vocabulary')).toHaveLength(46);
    expect(byStrand('sentences')).toHaveLength(70);
    expect(all).toHaveLength(274);
  });

  it('counts the gates and forms the way appendix A does', () => {
    const count = (gate: PlacementGate, format: string): number => byGate(gate).filter((t) => t.question.format === format).length;
    expect(byGate('recog')).toHaveLength(40);
    expect(count('sound-basic', 'hear-pick-written')).toBe(11);
    expect(count('sound-basic', 'see-pick-sound')).toBe(11);
    expect(count('sound-rest', 'hear-pick-written')).toBe(12);
    expect(count('sound-rest', 'see-pick-sound')).toBe(12);
    expect([count('syl-cv', 'hear-pick-written'), count('syl-cv', 'see-pick-sound'), count('syl-cv', 'build-syllable')]).toEqual([18, 12, 6]);
    expect([count('syl-cvc', 'hear-pick-written'), count('syl-cvc', 'see-pick-sound'), count('syl-cvc', 'build-syllable')]).toEqual([18, 12, 6]);
    expect(byGate('vocab').filter((t) => t.form === 'oral')).toHaveLength(25);
    expect(byGate('vocab').filter((t) => t.form === 'read')).toHaveLength(21);
    // PV-1c: ten families of three action pictures, each picture the right one of one template per form, and ten replies.
    expect(count('sentence', 'reply-pick')).toBe(10);
    expect(byGate('sentence').filter((t) => t.question.format !== 'reply-pick' && t.form === 'oral')).toHaveLength(30);
    expect(byGate('sentence').filter((t) => t.question.format === 'read-pick-picture')).toHaveLength(30);
  });

  it('is production ready: every template is ready, at least 40 per strand', () => {
    expect(all.filter((t) => t.status !== 'ready').map((t) => t.id)).toEqual([]);
    for (const strand of ['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary', 'sentences'] as const) {
      expect(byStrand(strand).filter((t) => t.status === 'ready').length, strand).toBeGreaterThanOrEqual(40);
    }
    expect(ready).toHaveLength(274);
  });

  it('every sentence carries the language review record (section 9; PV-1c re-reviewed the strand)', () => {
    for (const t of byStrand('sentences')) {
      expect(t.reviewedBy, t.id).toBe('ai-3-lens');
      expect(t.reviewedAt, t.id).toBe('2026-11-26');
    }
  });

  it('shows no Stage 2 card, whose art does not exist', () => {
    for (const t of all) {
      for (const o of t.question.options) expect(NO_ART.some((s) => o.pictureRef === `card:${s}`), `${t.id} ${o.pictureRef}`).toBe(false);
    }
  });

  it('every (gate, form) has three full draws of ready templates', () => {
    for (const spec of RUNG_TABLE) {
      for (const form of spec.forms) {
        const n = ready.filter((t) => t.gate === spec.gate && t.form === form).length;
        expect(n, `${spec.gate} ${form}`).toBeGreaterThanOrEqual(9);
      }
    }
  });

  it('covers every rung symbol with at least two templates of its gate', () => {
    const covered = (gate: PlacementGate, symbol: string): number => ready.filter((t) => t.gate === gate && symTags(t).includes(symbol)).length;
    for (const s of RUNG_SYMBOLS.basic) {
      if (s === 'ㅇ') expect(covered('syl-cv', s), s).toBeGreaterThanOrEqual(2);
      else expect(covered('sound-basic', s), s).toBeGreaterThanOrEqual(2);
    }
    for (const s of RUNG_SYMBOLS.rest) expect(covered('sound-rest', s), s).toBeGreaterThanOrEqual(2);
    for (const s of RUNG_SYMBOLS.finals) expect(covered('syl-cvc', s), s).toBeGreaterThanOrEqual(2);
  });

  it('has unique ids that follow the appendix patterns', () => {
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    const pattern: Record<PlacementGate, RegExp> = {
      recog: /^pitem:recog-odd-[a-z]+-[a-z]+$/,
      'sound-basic': /^pitem:sound-basic-(hear|see)-[a-z]+$/,
      'sound-rest': /^pitem:sound-rest-(hear|see)-[a-z]+$/,
      'syl-cv': /^pitem:syl-cv-(hear|see|build)-[a-z]+$/,
      'syl-cvc': /^pitem:syl-cvc-(hear|see|build)-[a-z]+$/,
      vocab: /^pitem:vocab-(hear|read)-[a-z]+$/,
      sentence: /^pitem:sent-(hear|read)-(run|swim|sleep|eat|fly)-[a-z]+$|^pitem:sent-reply-([1-9]|1[0-9])$/,
    };
    for (const t of all) expect(t.id, t.id).toMatch(pattern[t.gate]);
  });
});

describe('content/placement: romanization and the language policy', () => {
  const koTexts = (t: PlacementTemplate): Array<{ ko: string; romanization: string | undefined }> => {
    const q = t.question;
    const out: Array<{ ko: string; romanization: string | undefined }> = [];
    if (q.promptKo !== undefined) out.push({ ko: q.promptKo, romanization: q.promptRomanization });
    // an audio-only prompt: the voice says spokenKo and the sound guide shows promptRomanization
    if (q.promptKo === undefined && q.spokenKo !== undefined) out.push({ ko: q.spokenKo, romanization: q.promptRomanization });
    for (const o of q.options) if (o.ko !== undefined) out.push({ ko: o.ko, romanization: o.romanization });
    return out;
  };

  it('every Korean string that is not a single jamo carries the converter romanization, unhyphenated', () => {
    let checked = 0;
    for (const t of [...all, warmup]) {
      for (const { ko, romanization } of koTexts(t)) {
        if (!/[가-힣]/.test(ko)) continue;
        checked += 1;
        expect(romanization, `${t.id} ${ko}`).toBeDefined();
        expect(romanization, `${t.id} ${ko}`).not.toContain('-');
        expect(checkRomanization(ko, romanization as string, { exceptions: ROMANIZATION_EXCEPTIONS }), `${t.id} ${ko}`).toEqual([]);
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it('every single jamo carries a sound value of the jamo table (checkJamoRomanization)', () => {
    let checked = 0;
    for (const t of all) {
      for (const { ko, romanization } of koTexts(t)) {
        if (!/^[ㄱ-ㅎㅏ-ㅣ]$/.test(ko)) continue;
        checked += 1;
        expect(romanization, `${t.id} ${ko}`).toBeDefined();
        expect(checkJamoRomanization(ko, romanization as string), `${t.id} ${ko}`).toEqual([]);
      }
    }
    expect(checked).toBe(275);
  });

  it('labels one letter the same way everywhere in the bank', () => {
    const seen = new Map<string, Set<string>>();
    for (const t of all) {
      for (const { ko, romanization } of koTexts(t)) {
        if (!/^[ㄱ-ㅎㅏ-ㅣ]$/.test(ko)) continue;
        seen.set(ko, (seen.get(ko) ?? new Set()).add(romanization as string));
      }
    }
    for (const [ko, values] of seen) expect([...values], ko).toHaveLength(1);
  });

  it('the spoken form of a template has the converter romanization as its prompt romanization', () => {
    const source = JSON.parse(readFileSync(join(REPO_ROOT, 'content/placement/sound-letter.json'), 'utf8')) as {
      templates: Array<{ id: string; question: { spoken?: { ko: string; romanization: string } } }>;
    };
    const spoken = source.templates.flatMap((t) => (t.question.spoken ? [t.question.spoken] : []));
    expect(spoken).toHaveLength(23);
    for (const s of spoken) expect(romanizeReviewed(s.ko).text).toBe(s.romanization);
  });

  it('the sound-guide romanization of a word, syllable or sentence tag is the converter output', () => {
    for (const t of all.filter((x) => x.gate === 'vocab' || x.gate === 'sentence')) {
      const ko = t.question.promptKo;
      if (ko === undefined || t.question.format === 'reply-pick') continue;
      expect(t.question.promptRomanization, t.id).toBe(romanizeReviewed(ko).text);
    }
  });

  it('has no Hangul outside the Korean fields (glosses, ids and tags are Latin, except the sym: tags)', () => {
    for (const t of [...all, warmup]) {
      expect(t.glossEn, t.id).not.toMatch(/[ㄱ-㆏가-힣]/);
      for (const o of t.question.options) expect(`${o.id}${o.en ?? ''}${o.romanization ?? ''}`, t.id).not.toMatch(/[ㄱ-㆏가-힣]/);
      for (const tag of t.question.tags.filter((x) => !x.startsWith('sym:'))) expect(tag, t.id).not.toMatch(/[ㄱ-㆏가-힣]/);
    }
  });

  it('shows no shaming word and no number-like copy in any gloss', () => {
    for (const t of all) {
      expect(t.glossEn, t.id).not.toMatch(/\b(missed|incomplete|failed|overdue|score|passed|level)\b/i);
      expect(t.glossEn, t.id).not.toMatch(/%/);
    }
  });
});

describe('content/placement: recognition (A.1)', () => {
  const recog = byGate('recog');
  it('has 20 look-alike pairs, each in both directions, with the odd tile shown once and the base tile three times', () => {
    expect(recog).toHaveLength(40);
    const pairs = new Set(recog.map((t) => symTags(t).slice().sort().join('')));
    expect(pairs.size).toBe(20);
    for (const t of recog) {
      const [odd, base] = symTags(t) as [string, string];
      expect(t.question.options).toHaveLength(4);
      expect(correctOf(t).ko).toBe(odd);
      expect(t.question.options.filter((o) => o.ko === base)).toHaveLength(3);
      expect(t.question.tags).toContain('look-alike');
    }
    const keys = recog.map((t) => symTags(t).join('>'));
    for (const k of keys) expect(keys, k).toContain(k.split('>').reverse().join('>'));
  });
  it('is visual only: no audio, no picture, nothing that leaks', () => {
    for (const t of recog) expect(t.question).toMatchObject({ requires: { audio: false, picture: null }, leaks: false, format: 'shape-odd-one-out' });
  });
});

describe('content/placement: sound-letter (A.2)', () => {
  const CONFUSABLE: Record<string, string> = {
    ㄱ: 'ㅋㄴㄷ', ㄴ: 'ㄱㄷㄹ', ㄷ: 'ㅌㄹㄴ', ㄹ: 'ㄷㄴㅁ', ㅁ: 'ㅂㅇㄴ', ㅂ: 'ㅍㅁㅅ', ㅅ: 'ㅈㅊㅇ', ㅇ: 'ㅎㅁㅅ', ㅈ: 'ㅊㅅㄱ', ㅊ: 'ㅈㅅㅎ', ㅋ: 'ㄱㅌㅍ',
    ㅌ: 'ㄷㅋㅍ', ㅍ: 'ㅂㅋㅌ', ㅎ: 'ㅇㅊㅅ', ㅏ: 'ㅓㅑㅣ', ㅑ: 'ㅏㅕㅛ', ㅓ: 'ㅏㅕㅗ', ㅕ: 'ㅓㅑㅠ', ㅗ: 'ㅜㅓㅛ', ㅛ: 'ㅗㅠㅑ', ㅜ: 'ㅗㅡㅠ', ㅠ: 'ㅜㅛㅕ',
    ㅡ: 'ㅜㅣㅓ', ㅣ: 'ㅡㅏㅓ',
  };
  const sound = all.filter((t) => t.gate === 'sound-basic' || t.gate === 'sound-rest');

  it('tests 11 basic and 12 rest symbols, twice each (ㅇ is tested inside syllables)', () => {
    expect(sound.filter((t) => t.gate === 'sound-basic').map((t) => symTags(t)[0]).sort()).toEqual([...RUNG_SYMBOLS.basic.filter((s) => s !== 'ㅇ'), ...RUNG_SYMBOLS.basic.filter((s) => s !== 'ㅇ')].sort());
    expect(sound.filter((t) => t.gate === 'sound-rest').map((t) => symTags(t)[0]).sort()).toEqual([...RUNG_SYMBOLS.rest, ...RUNG_SYMBOLS.rest].sort());
  });

  it('offers the symbol and its three confusables of the same kind (F-QUEST-002 section 3.9)', () => {
    for (const t of sound) {
      const s = symTags(t)[0] as string;
      const expected = [s, ...(CONFUSABLE[s] as string)];
      const letters = t.question.format === 'hear-pick-written' ? t.question.options.map((o) => o.ko as string) : t.question.options.map((o) => o.id);
      if (t.question.format === 'hear-pick-written') {
        expect(letters.slice().sort(), t.id).toEqual(expected.slice().sort());
        const isVowel = VOWELS.includes(s);
        for (const l of letters) expect(isVowel ? VOWELS.includes(l) : CONSONANTS.includes(l) || l === 'ㅇ', t.id).toBe(true);
      } else {
        expect(new Set(letters).size, t.id).toBe(4);
      }
    }
  });

  it('speaks a symbol as a sound (consonant plus ㅏ, vowel as ㅇ plus the vowel), never by its name', () => {
    for (const t of sound.filter((x) => x.question.format === 'hear-pick-written')) {
      const s = symTags(t)[0] as string;
      const spoken = t.question.spokenKo as string;
      const { initial, medial } = part(spoken);
      if (VOWELS.includes(s)) expect([initial, medial]).toEqual(['ㅇ', s]);
      else expect([initial, medial]).toEqual([s, 'ㅏ']);
      expect(part(spoken).final).toBe('');
    }
  });

  it('see-pick-sound chips are the carrier sounds of the symbol and its confusables; the sound guide is the letter value', () => {
    for (const t of sound.filter((x) => x.question.format === 'see-pick-sound')) {
      const s = symTags(t)[0] as string;
      expect(t.question.options.every((o) => o.ko === undefined && /^[a-z]{1,8}$/.test(o.sound as string))).toBe(true);
      const carrier = VOWELS.includes(s)
        ? composeSyllable({ initial: 'ㅇ', medial: MEDIALS.indexOf(s), final: '' })
        : composeSyllable({ initial: s, medial: MEDIALS.indexOf('ㅏ'), final: '' });
      expect(correctOf(t).sound, t.id).toBe(romanizeReviewed(carrier as string).text);
      expect(checkJamoRomanization(s, t.question.promptRomanization as string), t.id).toEqual([]);
    }
  });
});

describe('content/placement: syllable-reading (A.3)', () => {
  const syl = all.filter((t) => t.gate === 'syl-cv' || t.gate === 'syl-cvc');
  const targetOf = (t: PlacementTemplate): string => (t.question.format === 'see-pick-sound' ? (t.question.promptKo as string) : (correctOf(t).ko as string));

  it('tags every syllable with the symbols it is made of, the finals as /final', () => {
    for (const t of syl) {
      const { initial, medial, final } = part(targetOf(t));
      expect(symTags(t), t.id).toEqual([initial, medial, ...(final === '' ? [] : [`${final}/final`])]);
      expect(t.question.tags).toContain(t.gate === 'syl-cv' ? 'shape:cv' : 'shape:cvc');
    }
  });

  it('uses only the 24 consonant and vowel jamo and the six taught finals', () => {
    for (const t of syl) {
      for (const o of t.question.options) {
        if (o.ko === undefined) continue;
        const { initial, medial, final } = part(o.ko);
        expect([...CONSONANTS, 'ㅇ'], `${t.id} ${o.ko}`).toContain(initial);
        expect(VOWELS, `${t.id} ${o.ko}`).toContain(medial);
        if (final !== '') expect(TAUGHT_FINALS, `${t.id} ${o.ko}`).toContain(final);
        else expect(t.gate).toBe('syl-cv');
      }
    }
  });

  it('every distractor differs from the target in exactly one jamo', () => {
    for (const t of syl.filter((x) => x.question.format !== 'see-pick-sound')) {
      const target = part(targetOf(t));
      for (const o of t.question.options.filter((x) => !x.isCorrect)) {
        const p = part(o.ko as string);
        const diff = [p.initial !== target.initial, p.medial !== target.medial, p.final !== target.final].filter(Boolean).length;
        expect(diff, `${t.id} ${o.ko}`).toBe(1);
      }
    }
  });

  it('see-pick-sound chips are the romanizations of syllables that differ in one sound, all different', () => {
    for (const t of syl.filter((x) => x.question.format === 'see-pick-sound')) {
      const chips = t.question.options.map((o) => o.sound as string);
      expect(new Set(chips).size, t.id).toBe(4);
      expect(correctOf(t).sound, t.id).toBe(romanizeReviewed(targetOf(t)).text);
    }
  });

  it('the build-syllable templates reuse the syllables the appendix lists', () => {
    expect(byGate('syl-cv').filter((t) => t.question.format === 'build-syllable').map((t) => targetOf(t))).toEqual(['가', '나', '다', '마', '모', '구']);
    expect(byGate('syl-cvc').filter((t) => t.question.format === 'build-syllable').map((t) => targetOf(t))).toEqual(['달', '물', '문', '산', '강', '곰']);
  });
});

describe('content/placement: vocabulary and sentences (A.4, A.5)', () => {
  /** Pictures that could be mistaken for each other are never offered together (spec A.4 `avoidWith`). */
  const AVOID_ROWS: string[][] = [
    ['kimchi', 'kimbap', 'rice', 'tteokguk', 'songpyeon', 'chopsticks', 'family-table'],
    ['seollal', 'chuseok', 'sebae', 'lantern', 'hanbok'],
    ['yutnori', 'jegi', 'kite', 'top'],
    ['book', 'hanji', 'brush', 'ink', 'origami', 'hangul-day'],
    ['tiger', 'magpie'],
    ['mountain', 'sea', 'moon', 'mugunghwa'],
    ['pottery', 'gayageum'],
  ];
  /**
   * Pictures that share what they show, or that belong to each other, are never offered
   * together, so each item has one clearly correct picture (production review 2026-10-11):
   * a full moon is on the moon and the Chuseok card; the lantern is a round glowing disc
   * like the moon; tteokguk, the folk games and the magpie (the Seollal song) belong to
   * Seollal; songpyeon and rice stalks to Chuseok; the kite carries a tiger face; the paper
   * crane looks like a bird and like the crane on the celadon vase; the yut sticks look like
   * chopsticks; the lantern is hanji paper; 연 (kite) is the first syllable of 연등.
   */
  const CONFLICTS: Array<[string, string]> = [
    ['moon', 'chuseok'], ['moon', 'lantern'], ['songpyeon', 'chuseok'], ['rice', 'chuseok'],
    ['tteokguk', 'seollal'], ['seollal', 'top'], ['seollal', 'yutnori'], ['seollal', 'kite'], ['seollal', 'jegi'],
    ['seollal', 'magpie'], ['tiger', 'kite'], ['magpie', 'origami'], ['pottery', 'origami'],
    ['chopsticks', 'yutnori'], ['hanji', 'lantern'], ['kite', 'lantern'],
  ];
  const picture = all.filter((t) => t.question.requires.picture === 'card');

  it('offers four different pictures, no two from one avoid row, and no text label', () => {
    for (const t of [...picture, warmup]) {
      const slugs = t.question.options.map((o) => (o.pictureRef as string).slice('card:'.length));
      expect(new Set(slugs).size, t.id).toBe(4);
      const rows = slugs.map((s) => AVOID_ROWS.findIndex((r) => r.includes(s)));
      expect(rows.every((r) => r >= 0), t.id).toBe(true);
      expect(new Set(rows).size, `${t.id} ${slugs.join(' ')}`).toBe(4);
      expect(t.question.options.every((o) => o.ko === undefined && o.en !== undefined), t.id).toBe(true);
    }
  });

  it('never offers two pictures that share what they show or belong to each other', () => {
    for (const t of [...picture, warmup]) {
      const slugs = t.question.options.map((o) => (o.pictureRef as string).slice('card:'.length));
      for (const [a, b] of CONFLICTS) expect(slugs.includes(a) && slugs.includes(b), `${t.id} ${a} + ${b}`).toBe(false);
    }
  });

  it('a read item never shows the Hangul Day picture, whose art carries written Hangul', () => {
    for (const t of picture.filter((x) => x.form === 'read')) {
      expect(t.question.options.some((o) => o.pictureRef === 'card:hangul-day'), t.id).toBe(false);
    }
  });

  it('the read list holds only words built from the 24 jamo and the six taught finals', () => {
    for (const t of byGate('vocab').filter((x) => x.form === 'read')) {
      for (const ch of t.question.promptKo as string) {
        const { initial, medial, final } = part(ch);
        expect([...CONSONANTS, 'ㅇ'], t.id).toContain(initial);
        expect(VOWELS, t.id).toContain(medial);
        if (final !== '') expect(TAUGHT_FINALS, `${t.id} ${ch}`).toContain(final);
      }
    }
  });

  it('a word has the same ids in both forms where both exist, and tags word and topic', () => {
    for (const t of byGate('vocab')) {
      expect(tagOf(t, 'word:'), t.id).toBe(romanizeReviewed(t.question.promptKo as string).text);
      expect(t.id.endsWith(tagOf(t, 'word:')), t.id).toBe(true);
      expect(tagOf(t, 'topic:'), t.id).not.toBe('');
    }
  });

  it('replies: three written options, the other two come from other rows, and never a natural answer too', () => {
    const replies = byGate('sentence').filter((t) => t.question.format === 'reply-pick');
    // PV-1c: rows 3 (만나서 반가워요!), 7 (이거 김치예요?) and 8 (밥 먹었어요?) left, because their right reply was the
    // only reply that echoed the line (S6); rows 11 to 13 are new.
    const rows = [1, 2, 4, 5, 6, 9, 10, 11, 12, 13];
    expect(replies.map((t) => t.id)).toEqual(rows.map((n) => `pitem:sent-reply-${n}`));
    const rowOf = (optionId: string): PlacementTemplate => replies.find((t) => t.id === `pitem:sent-${optionId}`) as PlacementTemplate;
    for (const t of replies) {
      expect(t.question.options, t.id).toHaveLength(3);
      expect(t.question.requires, t.id).toEqual({ audio: true, picture: null });
      expect(t.form).toBe('read');
    }
    for (const t of replies) {
      // standard punctuation (표준 문장 부호): every line and every reply ends a sentence
      expect(t.question.promptKo, t.id).toMatch(/[.?!]$/);
      for (const o of t.question.options) expect(o.ko, `${t.id} ${o.id}`).toMatch(/[.?!]$/);
      // a reply of a row is the same text wherever it is offered
      for (const o of t.question.options) expect(o.ko, `${t.id} ${o.id}`).toBe(correctOf(rowOf(o.id)).ko);
      // a distractor is never the natural answer of an incompatible row
      for (const o of t.question.options.filter((x) => !x.isCorrect)) expect(t.incompatibleWith ?? [], `${t.id} ${o.id}`).not.toContain(`pitem:sent-${o.id}`);
    }
    // Thanks and sorry: each of their replies would also answer the others (아니에요 after 미안해요), so they never meet.
    const clusters = [[4, 9, 10]];
    for (const n of rows) {
      const t = replies.find((x) => x.id === `pitem:sent-reply-${n}`) as PlacementTemplate;
      const cluster = clusters.find((c) => c.includes(n)) ?? [n];
      expect(t.incompatibleWith?.slice().sort(), t.id).toEqual(cluster.filter((m) => m !== n).map((m) => `pitem:sent-reply-${m}`).sort());
    }
  });

  it('replies follow S6: 아니에요 for thanks (no 천만에요), no yes-no line offered a no, one row per line and right reply', () => {
    const replies = byGate('sentence').filter((t) => t.question.format === 'reply-pick');
    const texts = replies.flatMap((t) => [t.question.promptKo as string, ...t.question.options.map((o) => o.ko as string)]);
    expect(texts.some((x) => x.includes('천만에요'))).toBe(false);
    expect(correctOf(replies.find((t) => t.question.promptKo === '감사합니다.') as PlacementTemplate).ko).toBe('아니에요.');
    // A yes-no line (잘 지냈어요?) is never offered 아니요, 아니에요 or a negative reply: each could be true.
    const NO = /^(아니요|아니에요)|안 |못 |없어요/;
    const yesNo = replies.filter((x) => (x.question.promptKo as string).endsWith('?') && !/뭐|어디|누구|언제|어때/.test(x.question.promptKo as string));
    expect(yesNo.map((t) => t.question.promptKo)).toEqual(['잘 지냈어요?']);
    for (const t of yesNo) for (const o of t.question.options.filter((x) => !x.isCorrect)) expect(o.ko, `${t.id} ${o.id}`).not.toMatch(NO);
    // No wrong reply is the line said back (안녕히 가세요. after 안녕히 가세요. is right when both leave).
    for (const t of replies) for (const o of t.question.options.filter((x) => !x.isCorrect)) expect(o.ko, t.id).not.toBe(t.question.promptKo);
    const pairs = replies.map((t) => `${t.question.promptKo} > ${correctOf(t).ko}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    // WO-18's heard 주세요 enters as a line, answered as Stage 4 teaches it.
    expect(correctOf(replies.find((t) => t.question.promptKo === '물 주세요.') as PlacementTemplate).ko).toBe('네, 여기 있어요.');
  });
});

describe('content/placement: the sentence pictures (AMENDMENTS-PLC-VALIDITY S1 to S5, row PV-1c)', () => {
  type Word = { ko: string; romanization: string; en: string; slug: string };
  type Family = { noun: Word; predicates: Word[] };
  const families = (JSON.parse(readFileSync(join(REPO_ROOT, 'content/placement/sentence-families.json'), 'utf8')) as { families: Family[] }).families;
  const index = JSON.parse(readFileSync(join(REPO_ROOT, 'content/placement/index.json'), 'utf8')) as { families?: string; version: number };
  const pictures = byGate('sentence').filter((t) => t.question.format !== 'reply-pick');
  const partsOf = (ref: string | undefined): { predicate: string; noun: string } => {
    const m = /^word:act-([a-z]+)-([a-z]+)$/.exec(ref ?? '');
    if (m === null) throw new Error(`not an act picture: ${ref}`);
    return { predicate: m[1] as string, noun: m[2] as string };
  };
  /** The registry's family table, read from its source (`ACT_FAMILIES`, packages/design-system/src/word-art/registry.ts). */
  const registry = readFileSync(join(REPO_ROOT, 'packages/design-system/src/word-art/registry.ts'), 'utf8');
  const table = registry.slice(registry.indexOf('export const ACT_FAMILIES')).split('});')[0] as string;
  const actFamilies = [...table.matchAll(/(\w+): Object\.freeze\(\[([^\]]*)\]\)/g)].map((m) => [m[1] as string, [...(m[2] as string).matchAll(/'([a-z]+)'/g)].map((x) => x[1] as string)] as const);
  /** Pictures that look alike at tile size (design/brief/illustrations/word-art.md section 10): never offered together. */
  const LOOK_ALIKE: Array<[string, string]> = [['tiger', 'cat'], ['bear', 'monkey'], ['bear', 'puppy'], ['monkey', 'puppy'], ['bird', 'duck'], ['sibling', 'friend']];

  it('index.json names the families file, and the bank is version 3 (PV-2 took 2; up by one per content row, section 3.7)', () => {
    expect(index.families).toBe('sentence-families.json');
    expect(index.version).toBe(3);
    expect(parsed.version).toBe(3);
  });

  it('the families are the action pictures PV-1a drew: the same nouns and predicates, in the same order', () => {
    expect(actFamilies).toHaveLength(10);
    expect(families.map((f) => [f.noun.slug, f.predicates.map((p) => p.slug)])).toEqual(actFamilies.map(([n, ps]) => [n, ps]));
  });

  it('a family row carries its Korean with the converter romanization and an English word; the noun romanization is the word: tag', () => {
    for (const f of families) {
      expect(f.noun.romanization).toBe(romanizeReviewed(f.noun.ko).text);
      for (const p of f.predicates) expect(p.romanization, p.ko).toBe(romanizeReviewed(p.ko).text);
      const own = pictures.filter((x) => partsOf(correctOf(x).pictureRef).noun === f.noun.slug);
      expect(own, f.noun.slug).toHaveLength(6);
      for (const t of own) expect(tagOf(t, 'word:'), t.id).toBe(f.noun.romanization);
    }
  });

  it('every sentence is the noun with its subject particle and one predicate of its family (N이/가 V-요, pattern:n-i-v)', () => {
    for (const t of pictures) {
      const { predicate, noun } = partsOf(correctOf(t).pictureRef);
      const f = families.find((x) => x.noun.slug === noun) as Family;
      const p = f.predicates.find((x) => x.slug === predicate) as Word;
      const last = (f.noun.ko.codePointAt(f.noun.ko.length - 1) as number) - 0xac00;
      expect(t.question.promptKo, t.id).toBe(`${f.noun.ko}${last % 28 === 0 ? '가' : '이'} ${p.ko}.`);
      expect(t.question.tags, t.id).toEqual(['pattern:n-i-v', `word:${f.noun.romanization}`]);
      expect(t.id).toBe(`pitem:sent-${t.form === 'oral' ? 'hear' : 'read'}-${predicate}-${noun}`);
      expect(t.question.requires, t.id).toEqual({ audio: t.form === 'oral', picture: 'word' });
      expect(t.question.leaks, t.id).toBe(t.form === 'read');
    }
    // N-이에요 left the sentence gate (S4); N을 V-요 stays only in the replies (S5).
    expect(byGate('sentence').filter((t) => ['n-ieyo', 'n-eul-v'].includes(tagOf(t, 'pattern:'))).map((t) => t.id)).toEqual([]);
  });

  it('a picture option is named in English by what it shows (its accessible label), never in Korean', () => {
    for (const t of pictures) {
      for (const o of t.question.options) {
        const { predicate, noun } = partsOf(o.pictureRef);
        expect(o.id, t.id).toBe(`${predicate}-${noun}`);
        expect(o.en, `${t.id} ${o.id}`).toMatch(/^(The|My) [a-z ]+ (runs|hops|swims|sleeps|eats|flies)$/);
        expect(o.ko, t.id).toBeUndefined();
      }
    }
  });

  it('never offers two pictures that look alike at tile size (cat and tiger; bear, monkey and puppy; bird and duck; the two children)', () => {
    for (const t of pictures) {
      const nouns = new Set(t.question.options.map((o) => partsOf(o.pictureRef).noun));
      for (const [a, b] of LOOK_ALIKE) expect(nouns.has(a) && nouns.has(b), `${t.id} ${a} + ${b}`).toBe(false);
    }
  });

  it('every sentence is true of something a learner could see: only the bird and the duck fly (no 토끼가 날아요)', () => {
    for (const t of pictures) {
      const { predicate, noun } = partsOf(correctOf(t).pictureRef);
      if (predicate === 'fly') expect(['bird', 'duck'], t.id).toContain(noun);
    }
  });

  it('the read and the heard item of one sentence offer different fourth pictures', () => {
    const fourthOf = (t: PlacementTemplate): string | undefined => {
      const right = partsOf(correctOf(t).pictureRef);
      return t.question.options.find((o) => partsOf(o.pictureRef).noun !== right.noun)?.pictureRef;
    };
    for (const t of pictures.filter((x) => x.form === 'read')) {
      const heard = pictures.find((x) => x.id === t.id.replace('-read-', '-hear-')) as PlacementTemplate;
      expect(heard, t.id).toBeDefined();
      expect(fourthOf(heard), t.id).not.toBe(fourthOf(t));
    }
  });
});

describe('content/placement: the word items (AMENDMENTS-PLC-VALIDITY section 3.2, row PV-2)', () => {
  const vocab = byGate('vocab');
  const keyOf = (ref: string | undefined): string => (ref ?? '').slice('word:'.length);
  /** The warm-up's word: the app leaves its templates out of every draw (`avoidTags`), so they are not balanced with the rest. */
  const WARMUP_WORDS = warmup.question.tags.filter((x) => x.startsWith('word:'));
  const drawable = vocab.filter((t) => !t.question.tags.some((x) => WARMUP_WORDS.includes(x)));
  /**
   * Pictures that look alike at tile size or belong to one group share a row, and an item shows four rows (W3):
   * every figure (the family, the teacher and the friends, the body parts, which are one figure with a ring, and the
   * other drawn people) is one row, so an item never shows two people; food and festivals, school things and balls,
   * nature and travel, and animals are the others.
   */
  const FIGURES = /^(family-|body-|school-(teacher|friend)$|culture-(dance|seollal)$|science-shadow$|sport-(swimming|taekwondo|running|jumprope|skiing)$)/;
  const ROWS: Record<string, string> = { food: 'food', culture: 'food', school: 'school', sport: 'school', nature: 'nature', travel: 'nature', science: 'nature', animal: 'animal', prop: 'animal' };
  const rowOf = (key: string): string => (FIGURES.test(key) ? 'figure' : (ROWS[key.slice(0, key.indexOf('-'))] ?? key));
  /**
   * Pictures of two rows that still show the same thing, belong to each other or sound alike, never offered together
   * (the conflict list of F-PLC-001 section 3.4, for `word:` keys; review 2026-11-26): two round things; the duck on its
   * blue wave and the water pictures; the Chuseok moon and the moon; the bird on its branch and the tree; the fish, the
   * boat and the water; the head and nose pictures (a face) and the animal faces; and, in the heard form, the words a
   * beginner hears as near pairs: 산 / 손, 꽃 / 공, 달 / 딸기.
   */
  const WORD_CONFLICTS: Array<[string, string]> = [
    ['sport-ball', 'food-apple'],
    ['animal-duck', 'nature-sea'],
    ['animal-duck', 'nature-river'],
    ['culture-chuseok', 'nature-moon'],
    ['animal-bird', 'nature-tree'],
    ['animal-fish', 'nature-sea'],
    ['animal-fish', 'nature-river'],
    ['travel-boat', 'nature-sea'],
    ...(['body-nose', 'body-head', 'body-face'] as const).flatMap((f) =>
      ['animal-bear', 'animal-tiger', 'animal-fox', 'animal-cat', 'animal-puppy', 'animal-monkey', 'animal-rabbit', 'animal-elephant'].map((a): [string, string] => [f, a]),
    ),
    ['nature-mountain', 'body-hand'],
    ['nature-flower', 'sport-ball'],
    ['nature-moon', 'food-strawberry'],
  ];
  const glyphKeys = ((): Set<string> => {
    const dir = join(REPO_ROOT, 'packages/design-system/src/word-art');
    const sources = readdirSync(join(dir, 'glyphs')).map((f) => readFileSync(join(dir, 'glyphs', f), 'utf8')).join('\n');
    const keys = new Set([...sources.matchAll(/^\s+'([a-z]+-[a-z0-9-]+)':/gm)].map((m) => m[1] as string));
    const body = /BODY_PARTS = Object\.freeze\(\[([^\]]+)\]/.exec(readFileSync(join(dir, 'generated/body.ts'), 'utf8'));
    for (const m of (body?.[1] ?? '').matchAll(/'([a-z]+)'/g)) keys.add(`body-${m[1] as string}`);
    return keys;
  })();

  it('shows four different word pictures that the WordArt registry draws, with no text label', () => {
    expect(glyphKeys.has('family-mom') && glyphKeys.has('body-hand')).toBe(true);
    for (const t of vocab) {
      expect(t.question.requires.picture, t.id).toBe('word');
      const keys = t.question.options.map((o) => keyOf(o.pictureRef));
      expect(new Set(keys).size, t.id).toBe(4);
      for (const k of keys) expect(glyphKeys.has(k), `${t.id} ${k}`).toBe(true);
      expect(t.question.options.every((o) => o.ko === undefined && o.en !== undefined), t.id).toBe(true);
    }
  });

  it('offers four rows, so an item never shows two people or two foods, and never a conflict pair', () => {
    for (const t of vocab) {
      const keys = t.question.options.map((o) => keyOf(o.pictureRef));
      expect(new Set(keys.map(rowOf)).size, `${t.id} ${keys.join(' ')}`).toBe(4);
      for (const [a, b] of WORD_CONFLICTS) expect(keys.includes(a) && keys.includes(b), `${t.id} ${a} + ${b}`).toBe(false);
    }
  });

  it('every item of a form shows the same four rows, so the rows on screen never point at the answer', () => {
    for (const form of ['oral', 'read'] as const) {
      const signatures = new Set(drawable.filter((t) => t.form === form).map((t) => t.question.options.map((o) => rowOf(keyOf(o.pictureRef))).sort().join(' ')));
      expect([...signatures], form).toHaveLength(1);
    }
  });

  it('no picture or row tells the answer by how often it is shown: each picture is right once and wrong three times in its form', () => {
    for (const form of ['oral', 'read'] as const) {
      const items = drawable.filter((t) => t.form === form);
      const shown = new Map<string, number>();
      const right = new Map<string, number>();
      for (const t of items) {
        for (const o of t.question.options) shown.set(keyOf(o.pictureRef), (shown.get(keyOf(o.pictureRef)) ?? 0) + 1);
        right.set(keyOf(correctOf(t).pictureRef), (right.get(keyOf(correctOf(t).pictureRef)) ?? 0) + 1);
      }
      expect([...shown.keys()].sort(), form).toEqual([...right.keys()].sort());
      for (const [k, n] of shown) expect([n, right.get(k)], `${form} ${k}`).toEqual([4, 1]);
    }
  });

  it('a word is heard or read, not both, so the read rung never shows the heard answers first (the warm-up word aside)', () => {
    const heard = new Set(drawable.filter((t) => t.form === 'oral').map((t) => t.question.promptKo));
    for (const t of drawable.filter((x) => x.form === 'read')) expect(heard.has(t.question.promptKo), t.id).toBe(false);
  });

  it('read words carry a nikl tag of that word, grade A or B; the one culture word without it is a Stage 1 card name', () => {
    const nikl = niklIndex(JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/nikl-vocab-2003.json'), 'utf8'))).byRank as Map<number, { word: string; grade: string }>;
    const untagged: string[] = [];
    for (const t of vocab.filter((x) => x.form === 'read')) {
      const rank = tagOf(t, 'nikl:');
      if (rank === '') {
        untagged.push(t.question.promptKo as string);
        continue;
      }
      const entry = nikl.get(Number(rank));
      expect(/[가-힣]+/.exec(entry?.word ?? '')?.[0], t.id).toBe(t.question.promptKo);
      expect(['A', 'B'], t.id).toContain(entry?.grade);
    }
    expect(untagged).toEqual(['추석']);
    expect(readFileSync(join(REPO_ROOT, 'apps/mobile/src/content/quests.ts'), 'utf8')).toContain("ko: '추석'");
  });

  it('every mode draws three different heard words besides the warm-up word, and full read draws', () => {
    const config = (mode: PlacementConfig['mode'], seed: number, over: Partial<PlacementConfig> = {}): PlacementConfig => ({
      mode,
      avoidTags: WARMUP_WORDS,
      revealMode: 'tap',
      audio: true,
      visual: true,
      takeMyTime: false,
      seed,
      exclude: [],
      resolvesPicture: () => true,
      ...over,
    });
    const wordsOf = (qs: ReadonlyArray<{ tags: readonly string[] }>): string[] => qs.map((q) => q.tags.find((x) => x.startsWith('word:')) as string);
    for (const mode of PLACEMENT_MODES) {
      for (const over of [{}, { listenFirst: true }, { revealMode: 'always' as const }]) {
        for (let seed = 1; seed <= 100; seed += 1) {
          const state = startRun(parsed, config(mode, seed, over), 0);
          // the first rung that can be asked is already open (with the guide always shown, Short opens on the heard words)
          const open = (form: string) => (state.current?.gate === 'vocab' && state.current.form === form ? state.current.questions : undefined);
          const oral = state.draws['vocab:oral'] ?? open('oral');
          expect(oral, `${mode} ${JSON.stringify(over)} ${seed}`).toBeDefined();
          const heard = wordsOf(oral ?? []);
          expect(heard, `${mode} ${seed}`).toHaveLength(3);
          expect(new Set(heard).size).toBe(3);
          for (const w of heard) expect(WARMUP_WORDS).not.toContain(w);
          const read = state.draws['vocab:read'] ?? open('read');
          if (read !== undefined) {
            expect(new Set(wordsOf(read)).size).toBe(3);
            for (const w of wordsOf(read)) expect(WARMUP_WORDS).not.toContain(w);
          }
        }
      }
    }
  });
});

describe('content/i18n/es/placement.json: the Spanish overlay skeleton', () => {
  const overlay = JSON.parse(readFileSync(join(REPO_ROOT, 'content/i18n/es/placement.json'), 'utf8')) as {
    locale: string;
    domain: string;
    entries: Record<string, Record<string, string>>;
  };
  it('has a gloss for every template and the warm-up, and an option gloss for every picture option', () => {
    expect(overlay).toMatchObject({ locale: 'es', domain: 'placement' });
    for (const t of [...all, warmup]) {
      const entry = overlay.entries[t.id];
      expect(entry?.gloss, t.id).toBeTruthy();
      for (const o of t.question.options) {
        if (o.pictureRef !== undefined || t.question.format === 'reply-pick') expect(entry?.[`options.${o.id}.gloss`], `${t.id} ${o.id}`).toBeTruthy();
      }
    }
    expect(Object.keys(overlay.entries)).toHaveLength(all.length + 1);
  });
  it('translates nothing but gloss and options.<id>.gloss, with no Hangul', () => {
    for (const [id, entry] of Object.entries(overlay.entries)) {
      for (const [field, value] of Object.entries(entry)) {
        expect(field, id).toMatch(/^(gloss|options\.[a-z0-9-]+\.gloss)$/);
        expect(value, `${id} ${field}`).not.toMatch(/[ㄱ-㆏가-힣]/);
      }
    }
  });
});

describe('content/i18n/ko/placement*.json: the Korean overlays', () => {
  const dir = join(REPO_ROOT, 'content/i18n/ko');
  const files = readdirSync(dir).filter((f) => /^placement.*\.json$/.test(f)).sort();
  const overlays = files.map((file) => ({
    file,
    overlay: JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
      locale: string;
      domain: string;
      entries: Record<string, Record<string, string>>;
    },
  }));
  it('each file has the overlay shape and holds only known ids and allowed fields', () => {
    expect(files).toContain('placement.json');
    const ids = new Set([...all, warmup].map((t) => t.id));
    for (const { file, overlay } of overlays) {
      expect(overlay, file).toMatchObject({ locale: 'ko', domain: file.slice(0, -'.json'.length) });
      for (const [id, entry] of Object.entries(overlay.entries)) {
        expect(ids.has(id), `${file} ${id}`).toBe(true);
        for (const field of Object.keys(entry)) expect(field, `${file} ${id}`).toMatch(/^(gloss|options\.[a-z0-9-]+\.gloss)$/);
      }
    }
  });
  it('puts an entity in one file only and never repeats the Korean a gloss explains', () => {
    const seen = new Map<string, string>();
    const byId = new Map([...all, warmup].map((t) => [t.id, t]));
    for (const { file, overlay } of overlays) {
      for (const [id, entry] of Object.entries(overlay.entries)) {
        expect(seen.get(id), `${id} in ${file}`).toBeUndefined();
        seen.set(id, file);
        const t = byId.get(id) as PlacementTemplate;
        const taught = [t.question.promptKo, t.question.spokenKo, ...t.question.options.map((o) => o.ko)].filter((ko): ko is string => typeof ko === 'string');
        for (const [field, value] of Object.entries(entry)) {
          for (const ko of taught) expect(value.trim(), `${id} ${field}`).not.toBe(ko.trim());
        }
      }
    }
  });
  it('never spells out a taught word of two or more syllables inside a gloss (떡국 in a 떡국 definition)', () => {
    // The picture each vocabulary item teaches, by option id: an option gloss for that
    // picture must not contain the word, on any item. Single syllables (밥, 먹, 연) are left
    // out, because they are also everyday morphemes (먹어요).
    const wordOf = new Map<string, Set<string>>();
    const byId = new Map([...all, warmup].map((t) => [t.id, t]));
    for (const t of [...byStrand('vocabulary'), warmup]) {
      const ko = t.question.promptKo;
      if (ko === undefined || [...ko].length < 2) continue;
      const set = wordOf.get(correctOf(t).id) ?? new Set<string>();
      set.add(ko);
      wordOf.set(correctOf(t).id, set);
    }
    expect(wordOf.get('sea')).toEqual(new Set(['바다']));
    for (const { file, overlay } of overlays) {
      for (const [id, entry] of Object.entries(overlay.entries)) {
        const t = byId.get(id) as PlacementTemplate;
        const promptKo = t.question.promptKo;
        for (const [field, value] of Object.entries(entry)) {
          const optionId = /^options\.([a-z0-9-]+)\.gloss$/.exec(field)?.[1];
          const words = optionId === undefined ? [promptKo] : [...(wordOf.get(optionId) ?? [])];
          for (const w of words) if (w !== undefined && [...w].length >= 2) expect(value, `${file} ${id} ${field}`).not.toContain(w);
        }
      }
    }
  });
});

describe('the validator and the schema agree on the gate table', () => {
  it('placement-rules.mjs mirrors PLACEMENT_FORMATS and the audio and leak lists', () => {
    const rules = PLACEMENT_RULES as { formats: unknown; strandOfGate: Record<string, string>; audioFormats: string[]; noLeakFormats: string[] };
    expect(rules.formats).toEqual(PLACEMENT_FORMATS);
    expect([...rules.audioFormats].sort()).toEqual([...PLACEMENT_AUDIO_FORMATS].sort());
    expect([...rules.noLeakFormats].sort()).toEqual([...PLACEMENT_NO_LEAK_FORMATS].sort());
    for (const spec of RUNG_TABLE) expect(rules.strandOfGate[spec.gate]).toBe(spec.strand);
  });
});

describe('the placement lint (AMENDMENTS-PLC-VALIDITY section 3.4, row PV-3)', () => {
  const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));
  const jsonIn = (dir: string): string[] => readdirSync(join(REPO_ROOT, dir)).filter((f) => f.endsWith('.json')).sort().map((f) => `${dir}/${f}`);
  const tree = new Map<string, unknown>([...jsonIn('content/placement'), ...jsonIn('content/episodes/stage-2')].map((rel) => [rel, readJson(rel)]));
  const nikl = niklIndex(readJson('scripts/nikl-vocab-2003.json'));
  type Finding = { rule: string; templateId: string };
  const findings = lintPlacementTree(tree, { nikl }) as Finding[];
  const baseline = readJson(PLACEMENT_BASELINE_FILE) as Finding[];
  const pairs = (list: Finding[]): string[] => list.map((f) => `${f.rule} ${f.templateId}`).sort();

  it('the baseline lists exactly the pairs that fail today: none missing, none stale', () => {
    expect(pairs(baseline)).toEqual(pairs(findings));
    expect(new Set(pairs(baseline)).size).toBe(baseline.length);
  });

  it("counts today's findings per rule (each row that fixes a rule empties its count; PV-7 deletes the file)", () => {
    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.rule] = (counts[f.rule] ?? 0) + 1;
    // PV-2 emptied the word rules and PV-1c the sentence rules (sentence-options, sentence-family, reply-echo, both sentence pools).
    expect(counts).toEqual({
      'placement-decode-balanced': 60,
      'placement-decode-ear': 29,
    });
  });

  it('keeps the warm-up out of the lint, and the read items clear of the pictures that show letters', () => {
    expect(findings.some((f) => f.templateId === warmup.id)).toBe(false);
    expect(findings.some((f) => f.rule === 'placement-text-picture')).toBe(false);
  });

  it('every template the lint names is a template of the bank (or a bank, pool, picture or family id)', () => {
    const ids = new Set(all.map((t) => t.id));
    for (const f of findings) expect(ids.has(f.templateId) || /^(bank|pool|picture|family):/.test(f.templateId), f.templateId).toBe(true);
  });

  it('the pool floors of the lint are the ones of spec sections 3.1 and 3.2, and the schema floor holds', () => {
    const m = PLACEMENT_LINT_MINIMA as Record<string, number>;
    expect(m).toMatchObject({ sentenceReadPicture: 24, sentenceReply: 6, sentenceOralPicture: 24, vocabOral: 24, vocabRead: 18, families: 10, predicates: 5, maxPredicateShare: 0.4 });
    for (const spec of RUNG_TABLE) for (const form of spec.forms) expect(ready.filter((t) => t.gate === spec.gate && t.form === form).length).toBeGreaterThanOrEqual(9);
  });

  it('the pictures the lint names exist in the art: a card id, or a WordArt glyph key', () => {
    const cards = readFileSync(join(REPO_ROOT, 'packages/design-system/src/components/HeritageCardArt/card-ids.ts'), 'utf8');
    const dir = join(REPO_ROOT, 'packages/design-system/src/word-art/glyphs');
    const glyphs = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    for (const ref of [...(TEXT_PICTURES as string[]), ...(PERSON_PICTURES as string[])]) {
      if (ref.startsWith('card:')) expect(cards, ref).toContain(`'${ref}'`);
      else expect(glyphs, ref).toContain(`'${ref.slice('word:'.length)}'`);
    }
  });

  it('the homonym list holds Hangul words and not the warm-up word', () => {
    for (const word of HOMONYMS as string[]) expect(word).toMatch(/^[가-힣]+$/);
    expect((HOMONYMS as string[]).includes('밥')).toBe(false);
  });

  it('the ear lists use Stage 1 symbols only, and finals only the six taught ones', () => {
    const ruled = EAR_RULED_OUT as { initials: string[]; vowels: string[]; finalClasses: string[]; sibilants: string[] };
    for (const pair of [...ruled.initials, ...ruled.sibilants]) for (const ch of pair) expect(CONSONANTS, pair).toContain(ch);
    for (const pair of ruled.vowels) for (const ch of pair) expect(VOWELS, pair).toContain(ch);
    for (const cls of ruled.finalClasses) for (const ch of cls) expect(TAUGHT_FINALS, cls).toContain(ch);
  });

  it('a Latin chip reads as the parts of the syllable the converter romanized: one jamo, one token, in every syllable', () => {
    const initial = new Map<string, Set<string>>();
    const medial = new Map<string, Set<string>>();
    const final = new Map<string, Set<string>>();
    const note = (m: Map<string, Set<string>>, jamo: string, token: string): void => void m.set(jamo, (m.get(jamo) ?? new Set()).add(token));
    let checked = 0;
    for (const i of [...CONSONANTS, 'ㅇ']) {
      for (const v of VOWELS) {
        for (const f of ['', ...TAUGHT_FINALS]) {
          const syllable = composeSyllable({ initial: i, medial: MEDIALS.indexOf(v), final: f });
          if (syllable === null) continue;
          const text = romanizeReviewed(syllable).text;
          const parts = chipParts(text) as { initial: string; medial: string; final: string } | null;
          expect(parts, `${syllable} ${text}`).not.toBeNull();
          expect(`${parts!.initial}${parts!.medial}${parts!.final}`).toBe(text);
          note(initial, i, parts!.initial);
          note(medial, v, parts!.medial);
          note(final, f, parts!.final);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    for (const m of [initial, medial, final]) for (const [jamo, tokens] of m) expect([...tokens], jamo).toHaveLength(1);
  });

  it('every see-pick-sound chip of the bank reads as one syllable, and the right chip is the converter romanization of the prompt', () => {
    const seen = all.filter((t) => t.question.format === 'see-pick-sound' && (t.gate === 'syl-cv' || t.gate === 'syl-cvc'));
    expect(seen).toHaveLength(24);
    for (const t of seen) {
      for (const o of t.question.options) expect(chipParts(o.sound), `${t.id} ${o.sound}`).not.toBeNull();
      expect(correctOf(t).sound, t.id).toBe(romanizeReviewed(t.question.promptKo as string).text);
    }
  });

  it('the committed NIKL list grades the words as the spec says (section 1.1 row 3, section 3.2)', () => {
    const byRank = nikl.byRank as Map<number, { word: string; grade: string }>;
    const gradeA = nikl.gradeA as Set<string>;
    expect(byRank.get(353)).toEqual({ word: '밥', grade: 'A' });
    expect(byRank.get(3237)).toEqual({ word: '사과', grade: 'A' });
    expect(byRank.get(4064)).toEqual({ word: '사과', grade: 'C' });
    for (const word of ['물', '엄마', '학교', '친구', '책', '나무', '꽃', '하늘', '공']) expect(gradeA.has(word), word).toBe(true);
    for (const word of ['청자', '가야금', '연등']) expect(gradeA.has(word), word).toBe(false);
  });
});
