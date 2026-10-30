// The two-pass QA's evaluators (AMENDMENTS-AUDIO-CLIPS section 9, G4; row AC-4): normalization and the exact-match
// rule with accepted variants, the closed set of confusables, the Whisper grammar, Pass 1 and Pass 2 on synthetic
// recognizer outputs, the CTC decoding and forced alignment on synthetic emissions, and the verdict that needs both
// passes. No recognizer runs here: both are local-only tools (never in CI) and are mocked.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CTC_MARGIN_NATS,
  LETTER_NAMES,
  clipVerdict,
  closedSetOf,
  composeCompatJamo,
  ctcGreedyText,
  ctcTokensOf,
  ctcVocabOf,
  ctcViterbiLogLik,
  evaluatePass1,
  evaluatePass2,
  isClosedSetRow,
  isExactMatch,
  normalizeTranscript,
  parseWhisperText,
  scoreCtcClip,
  syllableConfusables,
  targetFormsOf,
  whisperGrammar,
} from '../audio/tts/qa-lib.mjs';

const row = (kind, text, extra = {}) => ({ ref: `audio/say/${kind}.mp3`, key: `k-${text}`, kind, text, say: text, rate: 0.9, pack: 'stage2', sources: ['x'], ...extra });
const NO_OVERRIDES = {};

describe('normalization and the exact-match rule (section 9)', () => {
  it('NFC, with punctuation and spaces removed', () => {
    expect(normalizeTranscript(' 안녕히 가세요. ')).toBe('안녕히가세요');
    expect(normalizeTranscript('이거, 얼마예요?!')).toBe('이거얼마예요');
    expect(normalizeTranscript('「가방」…')).toBe('가방');
    // A decomposed (NFD) transcript compares equal to the composed text.
    expect(normalizeTranscript('가방'.normalize('NFD'))).toBe('가방');
  });

  it('a word passes only on an exact match: 가방 heard as 가반 fails', () => {
    const forms = targetFormsOf(row('word', '가방'), NO_OVERRIDES);
    expect(isExactMatch('가방.', forms)).toBe(true);
    expect(isExactMatch('가반', forms)).toBe(false);
    expect(isExactMatch('가방이', forms)).toBe(false);
  });

  it('an authored accept variant passes; the text still passes', () => {
    const overrides = { 국물: { say: '궁물', reason: 'nasalization', engine: 'polly', voice: 'Seoyeon', accept: ['궁물'] } };
    const forms = targetFormsOf(row('word', '국물'), overrides);
    expect(forms).toEqual(['국물', '궁물']);
    expect(isExactMatch('궁물', forms)).toBe(true);
    expect(isExactMatch('국물', forms)).toBe(true);
    expect(isExactMatch('굼물', forms)).toBe(false);
  });

  it('an override without accept adds nothing: its say is not an accepted transcript', () => {
    const overrides = { 신라: { say: '실라', reason: 'liquidization', engine: 'polly', voice: 'Seoyeon' } };
    expect(targetFormsOf(row('word', '신라'), overrides)).toEqual(['신라']);
  });

  it('a letter name accepts its isolated pronunciation (AC-B3 table)', () => {
    expect(targetFormsOf(row('jamo-name', '시옷'), NO_OVERRIDES)).toEqual(['시옷', '시옫']);
    expect(targetFormsOf(row('jamo-name', '키읔'), NO_OVERRIDES)).toEqual(['키읔', '키윽']);
    expect(targetFormsOf(row('jamo-sound', '이응'), NO_OVERRIDES)).toEqual(['이응']);
  });

  it('reads a whisper.cpp text output (several segments, blank lines)', () => {
    expect(parseWhisperText(' 안녕히\n 가세요.\n\n')).toBe('안녕히 가세요.');
    expect(parseWhisperText('')).toBe('');
  });
});

describe('the closed set of confusables (section 9, Pass 1 and Pass 2)', () => {
  it('plain, aspirated and tense: 가 -> 카, 까; 다 -> 타, 따; 바 -> 파, 빠; 자 -> 차, 짜; 사 -> 싸', () => {
    expect(syllableConfusables('가')).toEqual(expect.arrayContaining(['카', '까']));
    expect(syllableConfusables('카')).toEqual(expect.arrayContaining(['가', '까']));
    expect(syllableConfusables('다')).toEqual(expect.arrayContaining(['타', '따']));
    expect(syllableConfusables('빠')).toEqual(expect.arrayContaining(['바', '파']));
    expect(syllableConfusables('자')).toEqual(expect.arrayContaining(['차', '짜']));
    expect(syllableConfusables('사')).toEqual(['싸']);
  });

  it('a syllable the section 9 rules give nothing gets its nearest sounds, never a merged vowel', () => {
    expect(syllableConfusables('나')).toEqual(['다', '라', '냐', '놔']);
    expect(syllableConfusables('마')).toEqual(['바', '먀', '뫄']);
    expect(syllableConfusables('하')).toEqual(['아', '햐', '화']);
    expect(syllableConfusables('아')).toEqual(['하', '야', '와']);
    expect(syllableConfusables('위')).toEqual(['휘', '이']);
    expect(syllableConfusables('애')).toEqual(['해', '얘', '왜']);
    expect(syllableConfusables('애')).not.toContain('에');
    expect(syllableConfusables('외')).toEqual(['회', '오']);
    // A syllable with its own confusables gets no extra ones: 가 stays {카, 까}.
    expect(syllableConfusables('가')).toEqual(['카', '까']);
  });

  it('every jamo clip of the manifest has at least one confusable', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../../../content/audio/tts-manifest.json'), 'utf8'));
    const empty = manifest.rows.filter((r) => r.ref.startsWith('audio/jamo/')).filter((r) => closedSetOf(r, NO_OVERRIDES).confusables.length === 0);
    expect(empty.map((r) => r.key)).toEqual([]);
  });

  it('the other finals: 안 -> 악 알 암 압 앙 앋, and a final that sounds as ㄷ is not its own confusable', () => {
    expect(syllableConfusables('안')).toEqual(['악', '알', '암', '압', '앙', '앋']);
    expect(syllableConfusables('앋')).toEqual(['악', '안', '알', '암', '압', '앙']);
    // 옷 sounds [옫]: 옫 is the same sound, so it is not offered as a different one.
    expect(syllableConfusables('옷')).toEqual(expect.arrayContaining(['옥', '온', '올', '옴', '옵', '옹']));
    expect(syllableConfusables('옷')).not.toContain('옫');
  });

  it('ㅓ/ㅗ, ㅡ/ㅜ, and 의 against 이 and 으', () => {
    expect(syllableConfusables('어')).toEqual(['오']);
    expect(syllableConfusables('오')).toEqual(['어']);
    expect(syllableConfusables('으')).toEqual(['우', '의']);
    expect(syllableConfusables('우')).toEqual(['으']);
    expect(syllableConfusables('의')).toEqual(['이', '으']);
    expect(syllableConfusables('이')).toEqual(['의']);
  });

  it('a two-syllable word swaps one syllable at a time: 가방 includes 가반 and 카방', () => {
    const set = closedSetOf(row('word', '가방'), NO_OVERRIDES);
    expect(set.targets).toEqual(['가방']);
    expect(set.confusables).toEqual(expect.arrayContaining(['카방', '까방', '가박', '가반', '가발', '가밤', '가밥', '가받', '가빵', '가팡']));
    expect(set.confusables).not.toContain('가방');
  });

  it('letter names: names that share a syllable, the same series and the 쌍 name', () => {
    const giyeok = closedSetOf(row('jamo-name', '기역'), NO_OVERRIDES);
    expect(giyeok.confusables).toEqual(expect.arrayContaining(['쌍기역', '키읔', '키역', '끼역']));
    const ssang = closedSetOf(row('jamo-name', '쌍기역'), NO_OVERRIDES);
    expect(ssang.targets).toEqual(['쌍기역']);
    expect(ssang.confusables).toEqual(expect.arrayContaining(['기역', '쌍디귿', '쌍비읍', '쌍시옷', '쌍지읒']));
    // 지읒 [지읃] and 치읓 [치읃] share the heard syllable 읃; the heard forms are confusables too.
    const jieut = closedSetOf(row('jamo-name', '지읒'), NO_OVERRIDES);
    expect(jieut.targets).toEqual(['지읒', '지읃']);
    expect(jieut.confusables).toEqual(expect.arrayContaining(['치읓', '치읃', '쌍지읒', '티읕', '히읗']));
    expect(jieut.confusables).not.toContain('지읃');
  });

  it('the letter-name table lists the 19 names of AC-B3', () => {
    expect(LETTER_NAMES.map((n) => n.name)).toEqual([
      '기역', '니은', '디귿', '리을', '미음', '비읍', '시옷', '이응', '지읒', '치읓', '키읔', '티읕', '피읖', '히읗',
      '쌍기역', '쌍디귿', '쌍비읍', '쌍시옷', '쌍지읒',
    ]);
  });

  it('closed-set rows: every jamo clip and every say clip of 1-2 syllables; longer words and sentences are free only', () => {
    expect(isClosedSetRow(row('jamo-sound', '가'))).toBe(true);
    expect(isClosedSetRow(row('jamo-name', '쌍기역'))).toBe(true);
    expect(isClosedSetRow(row('syllable', '나'))).toBe(true);
    expect(isClosedSetRow(row('word', '가방'))).toBe(true);
    expect(isClosedSetRow(row('sentence', '네.'))).toBe(true);
    expect(isClosedSetRow(row('word', '박물관'))).toBe(false);
    expect(isClosedSetRow(row('sentence', '안녕히 가세요.'))).toBe(false);
    expect(closedSetOf(row('word', '박물관'), NO_OVERRIDES)).toBeNull();
  });

  it('the Whisper grammar allows exactly the closed set, with an optional leading space and full stop', () => {
    const g = whisperGrammar(['가', '카', '까']);
    expect(g).toBe('root ::= " "? choice [.?!]?\nchoice ::= "가" | "카" | "까"\n');
    expect(() => whisperGrammar([])).toThrow(/candidate/);
    expect(() => whisperGrammar(['가"'])).toThrow(/Hangul/);
  });
});

describe('Pass 1: Whisper free transcription and forced choice', () => {
  const ga = row('jamo-sound', '가', { say: '가.' });
  const gaSet = closedSetOf(ga, NO_OVERRIDES);
  const gaForms = targetFormsOf(ga, NO_OVERRIDES);

  it('a word passes on an exact free transcript', () => {
    const r = row('word', '박물관');
    expect(evaluatePass1({ forms: targetFormsOf(r, NO_OVERRIDES), closedSet: null, free: ' 박물관.' })).toMatchObject({ ok: true, freeMatch: true, failures: [] });
  });

  it('a word fails on any other transcript', () => {
    const r = row('word', '박물관');
    const out = evaluatePass1({ forms: targetFormsOf(r, NO_OVERRIDES), closedSet: null, free: '방물관' });
    expect(out.ok).toBe(false);
    expect(out.failures[0]).toMatch(/free transcript "방물관" is not 박물관/);
  });

  it('a short clip whose forced choice is another candidate fails', () => {
    const out = evaluatePass1({ forms: gaForms, closedSet: gaSet, free: '가', forced: '카' });
    expect(out.ok).toBe(false);
    expect(out.failures[0]).toMatch(/forced choice "카" is not the target/);
  });

  it('a short clip whose free transcript differs is a flag, not a failure: the forced choice decides', () => {
    const out = evaluatePass1({ forms: gaForms, closedSet: gaSet, free: '가요', forced: '가' });
    expect(out.ok).toBe(true);
    expect(out.flags[0]).toMatch(/free transcript "가요" differs/);
  });

  it('a short clip with no forced choice fails', () => {
    expect(evaluatePass1({ forms: gaForms, closedSet: gaSet, free: '가' }).failures[0]).toMatch(/no forced choice/);
  });
});

describe('Pass 2: CTC free decode and per-candidate margins', () => {
  const ga = row('jamo-sound', '가', { say: '가.' });
  const gaSet = closedSetOf(ga, NO_OVERRIDES);
  const gaForms = targetFormsOf(ga, NO_OVERRIDES);
  const scores = (target, ...others) => ({ 가: target, 카: others[0] ?? -30, 까: others[1] ?? -31, 의: -40, 아: -50 });

  it('passes when the target is top by at least the threshold (default 2.0 nats)', () => {
    expect(CTC_MARGIN_NATS).toBe(2.0);
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: scores(-10, -12.5) });
    expect(out).toMatchObject({ ok: true, margin: 2.5, best: '카', failures: [] });
  });

  it('fails when the target is not top', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '카', scores: scores(-12, -10) });
    expect(out.ok).toBe(false);
    expect(out.failures[0]).toMatch(/target is not top: 카 scores -10/);
  });

  it('fails a top-but-narrow target (margin under the threshold)', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: scores(-10, -11.2) });
    expect(out.ok).toBe(false);
    expect(out.margin).toBe(1.2);
    expect(out.failures[0]).toMatch(/margin 1.2 nats over 카 is under 2/);
  });

  it('the threshold is configurable (AC-5 calibrates it)', () => {
    expect(evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: scores(-10, -11.2), threshold: 1.0 }).ok).toBe(true);
  });

  it('an accepted form counts as the target, not as a confusable', () => {
    const r = row('jamo-name', '시옷');
    const set = closedSetOf(r, NO_OVERRIDES);
    const s = Object.fromEntries([...set.targets, ...set.confusables].map((c) => [c, -40]));
    s.시옫 = -9;
    s.시옷 = -15;
    s.시온 = -12;
    const out = evaluatePass2({ forms: targetFormsOf(r, NO_OVERRIDES), closedSet: set, free: '시옫', scores: s });
    expect(out).toMatchObject({ ok: true, target: '시옫', best: '시온', margin: 3 });
  });

  it('fails when the target cannot be scored (a syllable outside the model vocabulary)', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: { ...scores(-10), 가: null } });
    expect(out.ok).toBe(false);
    expect(out.failures[0]).toMatch(/cannot score the target/);
  });

  it('a word or sentence needs an exact greedy decode', () => {
    const r = row('sentence', '안녕히 가세요.');
    const forms = targetFormsOf(r, NO_OVERRIDES);
    expect(evaluatePass2({ forms, closedSet: null, free: '안녕히 가세요' }).ok).toBe(true);
    expect(evaluatePass2({ forms, closedSet: null, free: '안녕이 가세요' }).failures[0]).toMatch(/greedy decode "안녕이 가세요" is not/);
  });

  it('a short clip whose greedy decode differs is a flag; the margins decide', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '각', scores: scores(-10, -13) });
    expect(out.ok).toBe(true);
    expect(out.flags[0]).toMatch(/greedy decode "각" differs/);
  });
});

describe('the verdict: both passes and the shared checks', () => {
  const ok = { ok: true, failures: [], flags: [] };
  const bad = (m) => ({ ok: false, failures: [m], flags: [] });

  it('passes only when Pass 1, Pass 2, the signal and the identity checks all pass', () => {
    expect(clipVerdict({ pass1: ok, pass2: ok, signal: ok, identity: ok })).toEqual({ verdict: 'pass', reasons: [] });
  });

  it('a clip that passes only one recognizer fails', () => {
    expect(clipVerdict({ pass1: ok, pass2: bad('margin 1.2 nats') })).toEqual({ verdict: 'fail', reasons: ['Pass 2: margin 1.2 nats', 'signal: not measured', 'identity: not checked'] });
    expect(clipVerdict({ pass1: ok, pass2: undefined, signal: ok, identity: ok })).toEqual({ verdict: 'fail', reasons: ['Pass 2: did not run'] });
    expect(clipVerdict({ pass1: bad('forced choice "카"'), pass2: ok, signal: ok, identity: ok }).verdict).toBe('fail');
  });

  it('a signal or identity failure fails the clip even when both recognizers agree', () => {
    expect(clipVerdict({ pass1: ok, pass2: ok, signal: bad('duration 1.7 s'), identity: ok }).reasons).toEqual(['signal: duration 1.7 s']);
    expect(clipVerdict({ pass1: ok, pass2: ok, signal: ok, identity: bad('not in the lock') }).reasons).toEqual(['identity: not in the lock']);
  });
});

// --- CTC decoding and forced alignment (Pass 2), on synthetic emissions -----------------------------------------

const JAMO_VOCAB = Object.fromEntries(
  ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㅇ', 'ㅋ', 'ㅅ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅡ', 'ㅢ', 'ㅣ', ' ', '[UNK]', '[PAD]'].map((t, i) => [t, i]),
);
const SYLLABLE_VOCAB = { 가: 0, 나: 1, 다: 2, 방: 3, '|': 4, '[UNK]': 5, '[PAD]': 6 };

describe('Pass 2 internals: the CTC vocabulary, tokens, greedy decode and Viterbi forced alignment', () => {
  it('reads a jamo vocabulary (compatibility jamo) and a syllable vocabulary, with the blank from config.json', () => {
    const jamo = ctcVocabOf(JAMO_VOCAB, { pad_token_id: 15 });
    expect(jamo).toMatchObject({ unit: 'jamo', blankId: 15, delimiterId: 13 });
    const syl = ctcVocabOf(SYLLABLE_VOCAB, {});
    expect(syl).toMatchObject({ unit: 'syllable', blankId: 6, delimiterId: 4 });
  });

  it('spells a candidate in the model units, or returns null when it cannot', () => {
    const jamo = ctcVocabOf(JAMO_VOCAB, { pad_token_id: 15 });
    expect(ctcTokensOf('가', jamo)).toEqual([0, 7]);
    expect(ctcTokensOf('안', jamo)).toEqual([4, 7, 2]);
    expect(ctcTokensOf('의', jamo)).toEqual([4, 11]);
    expect(ctcTokensOf('밤', jamo)).toBeNull();
    const syl = ctcVocabOf(SYLLABLE_VOCAB, {});
    expect(ctcTokensOf('가방', syl)).toEqual([0, 3]);
    expect(ctcTokensOf('가반', syl)).toBeNull();
  });

  it('recomposes compatibility jamo into syllables', () => {
    expect(composeCompatJamo('ㄱㅏㅂㅏㅇ')).toBe('가방');
    expect(composeCompatJamo('ㅇㅏㄴㄴㅕㅇ')).toBe('안녕');
    expect(composeCompatJamo('ㄷㅏㄺ ㄱㅗㄱㅣ')).toBe('닭 고기');
    expect(composeCompatJamo('ㄲㅏ')).toBe('까');
    expect(composeCompatJamo('ㅏ')).toBe('ㅏ');
  });

  it('greedy decoding collapses repeats, drops the blank and keeps the word delimiter as a space', () => {
    const jamo = ctcVocabOf(JAMO_VOCAB, { pad_token_id: 15 });
    // ㄱ ㄱ _ ㅏ ㅏ | ㄴ ㅏ  =>  가 나
    expect(ctcGreedyText([0, 0, 15, 7, 7, 13, 2, 7], jamo)).toBe('가 나');
    const syl = ctcVocabOf(SYLLABLE_VOCAB, {});
    expect(ctcGreedyText([6, 0, 0, 6, 0, 3, 6], syl)).toBe('가가방');
  });

  it('the Viterbi log-likelihood is the best path through blank, label, blank', () => {
    // Columns: 0 = blank, 1 = A, 2 = B. Three frames.
    const ln = Math.log;
    const em = [
      [ln(0.1), ln(0.8), ln(0.1)],
      [ln(0.7), ln(0.2), ln(0.1)],
      [ln(0.1), ln(0.1), ln(0.8)],
    ];
    // A then B: best path A, blank, B = 0.8 * 0.7 * 0.8.
    expect(ctcViterbiLogLik(em, [1, 2], 0)).toBeCloseTo(ln(0.8 * 0.7 * 0.8), 10);
    // A alone: the best path is A, blank, blank (0.8 * 0.7 * 0.1).
    expect(ctcViterbiLogLik(em, [1], 0)).toBeCloseTo(ln(0.8 * 0.7 * 0.1), 10);
    // A repeated label needs a blank between: A, blank, A over three frames.
    expect(ctcViterbiLogLik(em, [1, 1], 0)).toBeCloseTo(ln(0.8 * 0.7 * 0.1), 10);
    // Too few frames for the labels: impossible.
    expect(ctcViterbiLogLik(em.slice(0, 2), [1, 1], 0)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('scores every candidate of a clip from the recognizer output (emissions for the requested tokens only)', () => {
    const jamo = ctcVocabOf(JAMO_VOCAB, { pad_token_id: 15 });
    const ln = Math.log;
    // Requested columns: [PAD], ㄱ, ㄲ, ㅋ, ㅏ. Frames say ㄱ, ㅏ clearly.
    const ids = [15, 0, 1, 5, 7];
    const emissions = [
      [ln(0.05), ln(0.8), ln(0.05), ln(0.05), ln(0.05)],
      [ln(0.8), ln(0.05), ln(0.05), ln(0.05), ln(0.05)],
      [ln(0.05), ln(0.05), ln(0.05), ln(0.05), ln(0.8)],
    ];
    const out = scoreCtcClip({ argmax: [0, 15, 7], ids, emissions }, ['가', '카', '까', '밤'], jamo);
    expect(out.free).toBe('가');
    expect(out.scores.밤).toBeNull();
    expect(out.scores.가).toBeGreaterThan(out.scores.카);
    expect(out.scores.가 - out.scores.카).toBeCloseTo(ln(0.8 / 0.05), 10);
    expect(() => scoreCtcClip({ argmax: [], ids: [15], emissions: [[0]] }, ['가'], jamo)).toThrow(/not requested/);
  });
});
