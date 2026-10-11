import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as builder from '../../../../scripts/build-placement-bank.mjs';
// @ts-expect-error plain-Node script (no declaration file)
import { PLACEMENT_RULES } from '../../../../scripts/placement-rules.mjs';
import {
  PLACEMENT_AUDIO_FORMATS,
  PLACEMENT_FORMATS,
  PLACEMENT_NO_LEAK_FORMATS,
  PlacementBankSchema,
  PlacementTemplateSchema,
  RUNG_SYMBOLS,
  RUNG_TABLE,
  checkRomanization,
  decomposeSyllable,
  romanize,
  ROMANIZATION_EXCEPTIONS,
  type PlacementBank,
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

/** The Stage 2 cards have no art in HeritageCardArt yet (spec 3.4): their templates stay draft. */
const NO_ART = ['sagwa', 'uyu', 'ppang', 'dosirak', 'haneul', 'kkot', 'namu', 'byeol'];
const noArt = (t: PlacementTemplate): boolean => t.question.options.some((o) => NO_ART.some((s) => o.pictureRef === `card:${s}`));

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

  it('holds the 265 templates of appendix A, by strand', () => {
    expect(byStrand('hangul-recognition')).toHaveLength(40);
    expect(byStrand('sound-letter')).toHaveLength(46);
    expect(byStrand('syllable-reading')).toHaveLength(72);
    expect(byStrand('vocabulary')).toHaveLength(53);
    expect(byStrand('sentences')).toHaveLength(54);
    expect(all).toHaveLength(265);
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
    expect(byGate('vocab').filter((t) => t.form === 'oral')).toHaveLength(30);
    expect(byGate('vocab').filter((t) => t.form === 'read')).toHaveLength(23);
    expect(count('sentence', 'reply-pick')).toBe(10);
    expect(byGate('sentence').filter((t) => t.question.format !== 'reply-pick' && t.form === 'oral')).toHaveLength(14 + 8);
    expect(byGate('sentence').filter((t) => t.question.format === 'read-pick-picture')).toHaveLength(14 + 8);
  });

  it('is ready where review is not pending: at least 40 ready templates per strand except sentences, which wait for a native reviewer', () => {
    for (const strand of ['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary'] as const) {
      expect(byStrand(strand).filter((t) => t.status === 'ready').length, strand).toBeGreaterThanOrEqual(40);
    }
    expect(byStrand('sentences').filter((t) => t.status === 'ready')).toEqual([]);
    expect(ready).toHaveLength(198);
  });

  it('keeps the 13 vocabulary templates whose art does not exist as draft, and every other vocabulary template ready', () => {
    const vocab = byStrand('vocabulary');
    const art = vocab.filter(noArt);
    expect(art).toHaveLength(13);
    expect(art.every((t) => t.status === 'draft')).toBe(true);
    expect(vocab.filter((t) => !noArt(t)).every((t) => t.status === 'ready')).toBe(true);
    expect(byStrand('sentences').filter(noArt)).toHaveLength(4);
  });

  it('every ready (gate, form) has three full draws, and every gate that is asked has ready templates', () => {
    for (const spec of RUNG_TABLE) {
      for (const form of spec.forms) {
        const n = ready.filter((t) => t.gate === spec.gate && t.form === form).length;
        if (spec.gate === 'sentence') expect(n, `${spec.gate} ${form}`).toBe(0);
        else expect(n, `${spec.gate} ${form}`).toBeGreaterThanOrEqual(9);
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
      sentence: /^pitem:sent-(n|v)-(hear|read)-[a-z]+$|^pitem:sent-reply-([1-9]|10)$/,
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

  it('the spoken form of a template has the converter romanization as its prompt romanization', () => {
    const source = JSON.parse(readFileSync(join(REPO_ROOT, 'content/placement/sound-letter.json'), 'utf8')) as {
      templates: Array<{ id: string; question: { spoken?: { ko: string; romanization: string } } }>;
    };
    const spoken = source.templates.flatMap((t) => (t.question.spoken ? [t.question.spoken] : []));
    expect(spoken).toHaveLength(23);
    for (const s of spoken) expect(romanize(s.ko).text).toBe(s.romanization);
  });

  it('the sound-guide romanization of a word, syllable or sentence tag is the converter output', () => {
    for (const t of all.filter((x) => x.gate === 'vocab' || x.gate === 'sentence')) {
      const ko = t.question.promptKo;
      if (ko === undefined || t.question.format === 'reply-pick') continue;
      expect(t.question.promptRomanization, t.id).toBe(romanize(ko).text);
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

  it('see-pick-sound chips are the carrier sounds of the symbol and its confusables', () => {
    for (const t of sound.filter((x) => x.question.format === 'see-pick-sound')) {
      expect(t.question.options.every((o) => o.ko === undefined && /^[a-z]{1,8}$/.test(o.sound as string))).toBe(true);
      expect(correctOf(t).sound).toBe(t.question.promptRomanization);
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
      expect(correctOf(t).sound, t.id).toBe(romanize(targetOf(t)).text);
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
    ['kimchi', 'kimbap', 'rice', 'tteokguk', 'songpyeon', 'chopsticks', 'family-table', 'sagwa', 'uyu', 'ppang', 'dosirak'],
    ['seollal', 'chuseok', 'sebae', 'lantern', 'hanbok'],
    ['yutnori', 'jegi', 'kite', 'top'],
    ['book', 'hanji', 'brush', 'ink', 'origami', 'hangul-day'],
    ['tiger', 'magpie'],
    ['mountain', 'sea', 'moon', 'mugunghwa', 'haneul', 'kkot', 'namu', 'byeol'],
    ['pottery', 'gayageum'],
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

  it('draws distractor pictures from cards that have art', () => {
    for (const t of picture) {
      for (const o of t.question.options.filter((x) => !x.isCorrect)) {
        expect(NO_ART.some((s) => o.pictureRef === `card:${s}`), `${t.id} ${o.pictureRef}`).toBe(false);
      }
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
      expect(tagOf(t, 'word:'), t.id).toBe(romanize(t.question.promptKo as string).text);
      expect(t.id.endsWith(tagOf(t, 'word:')), t.id).toBe(true);
      expect(tagOf(t, 'topic:'), t.id).not.toBe('');
    }
  });

  it('sentences are all draft, use the two patterns and the ten replies, and name the picture noun', () => {
    const sentences = byGate('sentence');
    expect(sentences.every((t) => t.status === 'draft')).toBe(true);
    expect(sentences.filter((t) => tagOf(t, 'pattern:') === 'n-ieyo')).toHaveLength(28);
    expect(sentences.filter((t) => tagOf(t, 'pattern:') === 'n-eul-v')).toHaveLength(16);
    expect(sentences.filter((t) => tagOf(t, 'pattern:') === 'reply')).toHaveLength(10);
    for (const t of sentences.filter((x) => x.question.format !== 'reply-pick')) {
      expect(t.question.promptKo, t.id).toMatch(/(예요|이에요|먹어요|마셔요|읽어요)$/);
      expect(tagOf(t, 'word:'), t.id).not.toBe('');
    }
  });

  it('replies: three written options, the other two come from other rows, and never a natural answer too', () => {
    const replies = byGate('sentence').filter((t) => t.question.format === 'reply-pick');
    expect(replies.map((t) => t.id)).toEqual(Array.from({ length: 10 }, (_, i) => `pitem:sent-reply-${i + 1}`));
    for (const t of replies) {
      expect(t.question.options, t.id).toHaveLength(3);
      expect(t.question.requires, t.id).toEqual({ audio: true, picture: null });
      expect(t.form).toBe('read');
    }
    const clusters = [[1, 3], [4, 9, 10], [6, 8]];
    for (const cluster of clusters) {
      for (const n of cluster) {
        const t = replies[n - 1] as PlacementTemplate;
        expect(t.incompatibleWith?.slice().sort(), t.id).toEqual(cluster.filter((m) => m !== n).map((m) => `pitem:sent-reply-${m}`).sort());
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

describe('content/i18n/ko/placement.json: the Korean overlay skeleton', () => {
  /**
   * Korean glosses wait for the locale-aware validator of F-I18N-001 section 3.7 (today the
   * base rule rejects Hangul in a gloss) and for native review, so the skeleton has no entries
   * yet; every template falls back to English until then.
   */
  it('exists with the overlay shape and holds only known ids and allowed fields', () => {
    const overlay = JSON.parse(readFileSync(join(REPO_ROOT, 'content/i18n/ko/placement.json'), 'utf8')) as {
      locale: string;
      domain: string;
      entries: Record<string, Record<string, string>>;
    };
    expect(overlay).toMatchObject({ locale: 'ko', domain: 'placement' });
    const ids = new Set([...all, warmup].map((t) => t.id));
    for (const [id, entry] of Object.entries(overlay.entries)) {
      expect(ids.has(id), id).toBe(true);
      for (const field of Object.keys(entry)) expect(field, id).toMatch(/^(gloss|options\.[a-z0-9-]+\.gloss)$/);
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
