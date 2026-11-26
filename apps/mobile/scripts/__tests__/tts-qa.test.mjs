// The two-pass QA's evaluators (AMENDMENTS-AUDIO-CLIPS section 9, G4; row AC-4): normalization and the exact-match
// rule with accepted variants, the closed set of confusables, the Whisper grammar, Pass 1 and Pass 2 on synthetic
// recognizer outputs, the CTC decoding and forced alignment on synthetic emissions, and the verdict that needs both
// passes. No recognizer runs here: both are local-only tools (never in CI) and are mocked.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CTC_MARGIN_NATS,
  G5_GATING,
  LETTER_NAMES,
  clipVerdict,
  closedSetOf,
  composeCompatJamo,
  ctcGreedyText,
  ctcTokensOf,
  ctcVocabOf,
  ctcViterbiLogLik,
  evaluateContrastSet,
  evaluateDistinct,
  evaluateFrame,
  evaluateLikeForLike,
  evaluatePass1,
  evaluatePass2,
  evaluatePlayable,
  isClosedSetRow,
  isExactMatch,
  nativeNumeral,
  normalizeTranscript,
  packsLoadedBy,
  pass2MarginAmong,
  seriesFormsOf,
  sinoNumeral,
  spokenVariantsOf,
  parseWhisperText,
  sameSoundSpellingsOf,
  scoreCtcClip,
  standardPronunciationsOf,
  syllableConfusables,
  targetFormsOf,
  whisperGrammar,
  withSeriesForms,
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

  it('accept variants follow the kinds entry of the row: a letter row and a word row of one text can accept different forms', () => {
    const overrides = { 낮: { say: '낟.', accept: ['낟'], reason: 'x', engine: 'polly', voice: 'Seoyeon', kinds: { word: { say: '낮', accept: ['낫'] } } } };
    expect(isExactMatch('낟', targetFormsOf(row('syllable', '낮'), overrides))).toBe(true);
    expect(isExactMatch('낫', targetFormsOf(row('syllable', '낮'), overrides))).toBe(false);
    expect(isExactMatch('낫', targetFormsOf(row('word', '낮'), overrides))).toBe(true);
    expect(isExactMatch('낟', targetFormsOf(row('word', '낮'), overrides))).toBe(false);
  });

  it('a word passes only on an exact match: 가방 heard as 가반 fails', () => {
    const forms = targetFormsOf(row('word', '가방'), NO_OVERRIDES);
    expect(isExactMatch('가방.', forms)).toBe(true);
    expect(isExactMatch('가반', forms)).toBe(false);
    expect(isExactMatch('가방이', forms)).toBe(false);
  });

  it('Whisper digits are read aloud: 사과 3개 주세요 is 사과 세 개 주세요 (the native numeral before a counter)', () => {
    const forms = targetFormsOf(row('sentence', '사과 세 개 주세요.'), NO_OVERRIDES);
    expect(isExactMatch('사과 3개 주세요.', forms)).toBe(true);
    expect(isExactMatch('사과 3 개 주세요', forms)).toBe(true);
    expect(isExactMatch('사과 세 개 주세요', forms)).toBe(true);
    expect(isExactMatch('사과 4개 주세요', forms)).toBe(false);
    expect(isExactMatch('사과 33개 주세요', forms)).toBe(false);
  });

  it('numerals: native before a counter (한 두 세 네 스무), Sino-Korean otherwise', () => {
    expect([1, 2, 3, 4, 5, 10, 11, 20, 21, 99].map((n) => nativeNumeral(n, true))).toEqual(['한', '두', '세', '네', '다섯', '열', '열한', '스무', '스물한', '아흔아홉']);
    expect([0, 3, 10, 12, 40, 99].map(sinoNumeral)).toEqual(['영', '삼', '십', '십이', '사십', '구십구']);
    expect(spokenVariantsOf('5월')).toEqual(['오월']);
    expect(spokenVariantsOf('2명')).toEqual(['이명', '두명']);
    expect(spokenVariantsOf('안녕')).toEqual(['안녕']);
    expect(isExactMatch('이거 3000원', targetFormsOf(row('sentence', '이거 삼천 원'), NO_OVERRIDES))).toBe(false);
    expect(isExactMatch('오 월', targetFormsOf(row('word', '오 월'), NO_OVERRIDES))).toBe(true);
    expect(isExactMatch('5 월', targetFormsOf(row('word', '오 월'), NO_OVERRIDES))).toBe(true);
    expect(isExactMatch('3시', targetFormsOf(row('word', '세 시'), NO_OVERRIDES))).toBe(true);
  });

  it('얼마에요 is 얼마예요: a spelling variant of one sound (the sound itself still has to match)', () => {
    const forms = targetFormsOf(row('sentence', '이거 얼마예요?'), NO_OVERRIDES);
    expect(isExactMatch('이거 얼마에요', forms)).toBe(true);
    expect(isExactMatch('이거 얼마예요.', forms)).toBe(true);
    expect(isExactMatch('이거 얼마애요', forms)).toBe(false);
    expect(isExactMatch('이거 얼마예', forms)).toBe(false);
    const reverse = targetFormsOf(row('sentence', '학생이에요'), NO_OVERRIDES);
    expect(isExactMatch('학생이예요', reverse)).toBe(true);
  });

  it('digits and 에요 slack does not loosen a miss: 가반 and 가방이 still fail', () => {
    const forms = targetFormsOf(row('word', '가방'), NO_OVERRIDES);
    expect(isExactMatch('가반', forms)).toBe(false);
    expect(isExactMatch('가방 3개', forms)).toBe(false);
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

  it('a sound change across the syllables makes the standard pronunciation a target, never a confusable', () => {
    // Tensing after a stop coda (학교 [학꾜], 있다 [읻따], 십 분 [십뿐]), aspiration after ㅎ (좋다 [조타], not 좋따),
    // nasalization (국물 [궁물]) and ㄴ next to ㄹ (신라 [실라], 설날 [설랄]).
    expect(standardPronunciationsOf('학교')).toEqual(['학꾜']);
    expect(standardPronunciationsOf('있다')).toEqual(['있따']);
    expect(standardPronunciationsOf('십분')).toEqual(['십뿐']);
    expect(standardPronunciationsOf('좋다')).toEqual(['좋타']);
    expect(standardPronunciationsOf('국물')).toEqual(['궁물']);
    expect(standardPronunciationsOf('입니')).toEqual(['임니']);
    expect(standardPronunciationsOf('신라')).toEqual(['실라']);
    expect(standardPronunciationsOf('설날')).toEqual(['설랄']);
    // No change: no coda, a sonorant coda before a plain stop, or one syllable.
    for (const form of ['가방', '기역', '사과', '안녕', '가']) expect(standardPronunciationsOf(form)).toEqual([]);
    for (const [text, said] of [['학교', '학꾜'], ['떡국', '떡꾹'], ['책상', '책쌍'], ['십 분', '십뿐'], ['국물', '궁물'], ['밥상', '밥쌍'], ['햇볕', '햇뼡']]) {
      const set = closedSetOf(row('word', text), NO_OVERRIDES);
      expect(set.targets).toContain(said);
      expect(set.confusables).not.toContain(said);
    }
    // The real confusables stay: 학교 against 학쿄 and 한교.
    expect(closedSetOf(row('word', '학교'), NO_OVERRIDES).confusables).toEqual(expect.arrayContaining(['학쿄', '한교']));
  });

  it('a final-sound clip accepts the spellings said the same: 앋 as 앗, 악 as 앜', () => {
    expect(sameSoundSpellingsOf('앋')).toEqual(['앗', '았', '앚', '앛', '앝', '앟']);
    expect(sameSoundSpellingsOf('악')).toEqual(['앆', '앇', '앍', '앜']);
    expect(sameSoundSpellingsOf('아')).toEqual([]);
    const t = closedSetOf(row('jamo-sound', '앋'), NO_OVERRIDES);
    expect(t.targets).toEqual(['앋', '앗', '았', '앚', '앛', '앝', '앟']);
    expect(t.confusables).toEqual(['악', '안', '알', '암', '압', '앙']);
    // A forced choice of 앗 is the target; 악 is not.
    const forms = targetFormsOf(row('jamo-sound', '앋'), NO_OVERRIDES);
    expect(evaluatePass1({ forms, closedSet: t, free: '앗.', forced: '앗' })).toMatchObject({ ok: true, flags: ['free transcript "앗." differs from 앋 (the forced choice decides)'] });
    expect(evaluatePass1({ forms, closedSet: t, free: '앗.', forced: '악' }).ok).toBe(false);
    // Only a jamo clip: a one-syllable word keeps its own spelling.
    expect(closedSetOf(row('word', '옷'), NO_OVERRIDES).targets).toEqual(['옷']);
  });

  it('a forced choice or a CTC top score on the standard pronunciation passes', () => {
    const r = row('word', '학교');
    const set = closedSetOf(r, NO_OVERRIDES);
    const forms = targetFormsOf(r, NO_OVERRIDES);
    expect(evaluatePass1({ forms, closedSet: set, free: '학교', forced: '학꾜' }).ok).toBe(true);
    const scores = Object.fromEntries([...set.targets, ...set.confusables].map((c) => [c, -20]));
    scores['학꾜'] = -8;
    scores['학교'] = -9;
    expect(evaluatePass2({ forms, closedSet: set, free: '학교', scores })).toMatchObject({ ok: true, target: '학꾜', margin: 12 });
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

describe('Pass 2: CTC free decode and per-candidate margins (advisory)', () => {
  const ga = row('jamo-sound', '가', { say: '가.' });
  const gaSet = closedSetOf(ga, NO_OVERRIDES);
  const gaForms = targetFormsOf(ga, NO_OVERRIDES);
  const scores = (target, ...others) => ({ 가: target, 카: others[0] ?? -30, 까: others[1] ?? -31, 의: -40, 아: -50 });

  it('the default margin is 0.5 nats (AC-5 pilot calibration), and a margin over it is not advisory', () => {
    expect(CTC_MARGIN_NATS).toBe(0.5);
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: scores(-10, -12.5) });
    expect(out).toMatchObject({ ok: true, advisory: false, margin: 2.5, best: '카', failures: [], flags: [] });
  });

  it('never fails a clip: a target that is not top is an advisory flag', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '카', scores: scores(-12, -10) });
    expect(out).toMatchObject({ ok: true, advisory: true, failures: [] });
    expect(out.flags.some((f) => /target is not top: 카 scores -10/.test(f))).toBe(true);
  });

  it('flags a top-but-narrow target (margin under the threshold)', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: scores(-10, -10.3) });
    expect(out).toMatchObject({ ok: true, advisory: true, margin: 0.3 });
    expect(out.flags[0]).toMatch(/margin 0.3 nats over 카 is under 0.5/);
  });

  it('the threshold is configurable', () => {
    const s = scores(-10, -11.2);
    expect(evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: s }).advisory).toBe(false);
    expect(evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: s, threshold: 2.0 }).advisory).toBe(true);
  });

  it('an accepted form counts as the target, not as a confusable', () => {
    const r = row('jamo-name', '시옷');
    const set = closedSetOf(r, NO_OVERRIDES);
    const s = Object.fromEntries([...set.targets, ...set.confusables].map((c) => [c, -40]));
    s.시옫 = -9;
    s.시옷 = -15;
    s.시온 = -12;
    const out = evaluatePass2({ forms: targetFormsOf(r, NO_OVERRIDES), closedSet: set, free: '시옫', scores: s });
    expect(out).toMatchObject({ ok: true, advisory: false, target: '시옫', best: '시온', margin: 3 });
  });

  it('a target that cannot be scored (outside the model vocabulary) is an advisory flag, not a failure', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '가', scores: { ...scores(-10), 가: null } });
    expect(out).toMatchObject({ ok: true, advisory: true, failures: [] });
    expect(out.flags[0]).toMatch(/cannot score the target/);
  });

  it('a word or sentence is no longer gated on an exact greedy decode: a miss is a flag', () => {
    const r = row('sentence', '안녕히 가세요.');
    const forms = targetFormsOf(r, NO_OVERRIDES);
    expect(evaluatePass2({ forms, closedSet: null, free: '안녕히 가세요' })).toMatchObject({ ok: true, advisory: false, freeMatch: true });
    const miss = evaluatePass2({ forms, closedSet: null, free: '안명이 가세요' });
    expect(miss).toMatchObject({ ok: true, advisory: true, freeMatch: false, failures: [] });
    expect(miss.flags[0]).toMatch(/greedy decode "안명이 가세요" differs from/);
  });

  it('a short clip whose greedy decode differs is a flag; the margins decide', () => {
    const out = evaluatePass2({ forms: gaForms, closedSet: gaSet, free: '각', scores: scores(-10, -13) });
    expect(out).toMatchObject({ ok: true, advisory: false });
    expect(out.flags[0]).toMatch(/greedy decode "각" differs/);
  });
});

describe('the verdict: both passes and the shared checks', () => {
  const ok = { ok: true, failures: [], flags: [] };
  const bad = (m) => ({ ok: false, failures: [m], flags: [] });

  it('passes only when Pass 1, Pass 2, the signal and the identity checks all pass', () => {
    expect(clipVerdict({ pass1: ok, pass2: ok, signal: ok, identity: ok })).toEqual({ verdict: 'pass', reasons: [] });
  });

  it('Pass 1 gates; Pass 2 is advisory, so a clip passes without it and its advisory result does not fail it', () => {
    const advisory = { ok: true, advisory: true, failures: [], flags: ['margin 0.1 nats'] };
    expect(clipVerdict({ pass1: ok, pass2: advisory, signal: ok, identity: ok })).toEqual({ verdict: 'pass', reasons: [] });
    expect(clipVerdict({ pass1: ok, pass2: undefined, signal: ok, identity: ok })).toEqual({ verdict: 'pass', reasons: [] });
    expect(clipVerdict({ pass1: undefined, pass2: ok, signal: ok, identity: ok })).toEqual({ verdict: 'fail', reasons: ['Pass 1: did not run'] });
    expect(clipVerdict({ pass1: bad('forced choice "카"'), pass2: ok, signal: ok, identity: ok }).verdict).toBe('fail');
    expect(clipVerdict({ pass1: ok })).toEqual({ verdict: 'fail', reasons: ['signal: not measured', 'identity: not checked'] });
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

describe('the contrast-set gate (AMENDMENTS-MINIMAL-PAIRS section 3.2, G2-G6)', () => {
  const PACKS = ['jamo-s1', 'jamo-wb', 'stage1', 'placement', 'stage2', 'stage3'];
  const man = (text, say, extra = {}) => ({ ref: `audio/say/${text}.mp3`, key: `k-${text}`, kind: 'syllable', text, say, rate: 0.85, pack: 'stage1', sources: ['x'], ...extra });
  const SET = { id: 'ga-ka', unit: 'minigame:s1-life-q3-pairs', members: [{ text: '가', ref: 'audio/say/가.mp3' }, { text: '카', ref: 'audio/say/카.mp3' }] };
  const rows = [man('가', '가.'), man('카', '카.')];
  const rowByRef = new Map(rows.map((r) => [r.ref, r]));
  /** One member's QA result: Pass 1 forced choice, its signal and its bytes. */
  const result = (text, extra = {}) => ({
    key: `k-${text}`,
    ref: `audio/say/${text}.mp3`,
    verdict: 'pass',
    reasons: [],
    sha256: `sha-${text}`,
    pass1: { forced: text },
    pass2: { ranking: [{ candidate: text, score: -8 }, { candidate: text === '가' ? '카' : '가', score: -9.5 }, { candidate: '까', score: -12 }] },
    signal: { summary: { voicedSpanS: 0.5 }, loudness: { integratedLufs: -16 } },
    ...extra,
  });
  const run = (patch = {}, opts = {}) => {
    const results = new Map([['가', result('가')], ['카', result('카')]].map(([t, r]) => [r.ref, { ...r, ...(patch[t] ?? {}) }]));
    return evaluateContrastSet(opts.set ?? SET, { rowByRef: opts.rowByRef ?? rowByRef, resultByRef: opts.resultByRef ?? results, packOrder: PACKS, g5Gating: opts.g5Gating });
  };

  it('seriesFormsOf is the whole series at the member\'s place and vowel, for a syllable and a word', () => {
    expect(seriesFormsOf('가')).toEqual(['가', '카', '까']);
    expect(seriesFormsOf('달')).toEqual(['달', '탈', '딸']);
    expect(seriesFormsOf('자다')).toEqual(['자다', '차다', '짜다']);
    expect(seriesFormsOf('방')).toEqual(['방', '팡', '빵']);
    expect(seriesFormsOf('사다')).toEqual(['사다', '싸다']);
    expect(seriesFormsOf('나')).toEqual(['나']);
    expect(seriesFormsOf('abc')).toEqual(['abc']);
  });

  it('withSeriesForms adds the series forms a closed set lacks, and leaves a complete one and a missing one alone', () => {
    const lacking = { targets: ['가'], confusables: ['카'] };
    expect(withSeriesForms(lacking, '가')).toEqual({ targets: ['가'], confusables: ['카', '까'] });
    const closed = closedSetOf(row('syllable', '가'), NO_OVERRIDES);
    expect(withSeriesForms(closed, '가')).toBe(closed);
    expect(withSeriesForms(null, '가')).toBeNull();
    // closedSetOf already holds the series of a one- or two-syllable clip.
    for (const text of ['가', '달', '자다', '빵', '사다', '개']) {
      const set = closedSetOf(row('word', text), NO_OVERRIDES);
      for (const form of seriesFormsOf(text)) expect([...set.targets, ...set.confusables], `${text}: ${form}`).toContain(form);
    }
  });

  it('a set whose members agree passes every gate, and prints Pass 2 margins against the other members', () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(Object.fromEntries(Object.entries(r.gates).map(([k, g]) => [k, g.ok]))).toEqual({ G1: true, G2: true, G3: true, G4: true, G5: true, G6: true });
    expect(r.regenerate).toEqual([]);
    expect(r.margins).toEqual([{ text: '가', margin: 1.5, over: '카' }, { text: '카', margin: 1.5, over: '가' }]);
  });

  it('G1: a member that fails the per-clip gate, is vetoed or has no clip fails the set', () => {
    const failed = run({ 카: { verdict: 'fail', reasons: ['Pass 1: free transcript "가" is not 카'] } });
    expect(failed.ok).toBe(false);
    expect(failed.gates.G1.failures[0]).toMatch(/카: fails the per-clip gate \(Pass 1: free transcript/);
    expect(failed.regenerate).toEqual(['k-카']);
    const vetoed = run({ 가: { vetoed: true } });
    expect(vetoed.gates.G1.failures).toEqual(['가: vetoed in the owner listen']);
    const noClip = run({}, { resultByRef: new Map([['audio/say/가.mp3', result('가')]]) });
    expect(noClip.gates.G1.failures).toEqual(['카: no clip']);
    expect(noClip.gates.G2).toMatchObject({ ok: false, ran: false });
    expect(noClip.gates.G4.ran).toBe(false);
    expect(noClip.gates.G5.ran).toBe(false);
    expect(noClip.members.map((m) => m.present)).toEqual([true, false]);
  });

  it('G2: a 가 that the forced choice over the whole series hears as 까 fails a 가 / 카 pair, and is regenerated', () => {
    const r = run({ 가: { pass1: { forced: '까' } } });
    expect(r.gates.G2.ok).toBe(false);
    expect(r.gates.G2.failures).toEqual(['가: the series forced choice heard "까"']);
    expect(r.regenerate).toEqual(['k-가']);
    expect(run({ 카: { pass1: { forced: null } } }).gates.G2.failures[0]).toMatch(/no forced choice over the series/);
    expect(run({ 가: { pass1: { forced: '가.' } } }).gates.G2.ok).toBe(true);
  });

  it('G2 reads an authored accept variant as the member (the exact-match rule of the per-clip gate)', () => {
    const overrides = { 가: { say: '가.', accept: ['가아'], reason: 'x', engine: 'polly', voice: 'Seoyeon' } };
    expect(isExactMatch('가아', targetFormsOf(rows[0], overrides))).toBe(true);
  });

  it('G3: members sent with different end marks, an IPA phoneme on one, other kinds or other rates are not one frame', () => {
    const frame = (...rs) => evaluateFrame(rs);
    expect(frame(man('가', '가.'), man('카', '카.')).ok).toBe(true);
    expect(frame(man('가', '가,'), man('카', '카,')).ok).toBe(true);
    expect(frame(man('가', '가'), man('카', '카')).ok).toBe(true);
    const mixed = frame(man('바', '바!'), man('파', '파.'));
    expect(mixed.ok).toBe(false);
    expect(mixed.failures[0]).toMatch(/바 sent as "바!", 파 sent as "파\."/);
    expect(frame(man('까', '까,'), man('카', '카.')).ok).toBe(false);
    expect(frame(man('가', '가.', { ipa: 'ka' }), man('카', '카.')).failures[0]).toMatch(/IPA phoneme/);
    expect(frame(man('가', '가.', { ipa: 'ka' }), man('카', '카.', { ipa: 'kha' })).ok).toBe(true);
    expect(frame(man('가', '가.', { kind: 'jamo-sound' }), man('카', '카.')).failures[0]).toMatch(/different clip kinds/);
    expect(frame(man('가', '가.', { rate: 0.9 }), man('카', '카.')).failures[0]).toMatch(/different rates/);
    const gate = run({}, { rowByRef: new Map([...rowByRef, ['audio/say/카.mp3', man('카', '카!')]]) });
    expect(gate.gates.G3.ok).toBe(false);
    expect(gate.ok).toBe(false);
    // A frame problem is a content decision: nothing to regenerate.
    expect(gate.regenerate).toEqual([]);
  });

  it('G4: byte-identical members fail, and the second of them is regenerated', () => {
    const r = run({ 카: { sha256: 'sha-가' } });
    expect(r.gates.G4.ok).toBe(false);
    expect(r.gates.G4.failures).toEqual(['가 and 카 are byte-identical']);
    expect(r.regenerate).toEqual(['k-카']);
    expect(evaluateDistinct([{ text: 'a', sha256: '1' }, { text: 'b', sha256: '2' }, { text: 'c', sha256: '1' }]).failures).toEqual(['a and c are byte-identical']);
  });

  it('G5: a member 1.5 times the median voiced span is flagged while advisory, and fails when gating', () => {
    const wide = { 카: { signal: { summary: { voicedSpanS: 1.0 }, loudness: { integratedLufs: -16 } } } };
    const advisory = run(wide);
    expect(advisory.gates.G5).toMatchObject({ ok: true, advisory: true });
    expect(advisory.gates.G5.flags[0]).toMatch(/가 voiced 0\.5 s is 0\.67 times the set's median 0\.75 s/);
    expect(advisory.ok).toBe(true);
    // Two members are always within 1.33 of their own median, so a triple shows the bound.
    const triple = evaluateLikeForLike([{ text: 'a', voicedSpanS: 0.4 }, { text: 'b', voicedSpanS: 0.4 }, { text: 'c', voicedSpanS: 0.6 }], { gating: true });
    expect(triple.ok).toBe(false);
    expect(triple.failures).toEqual(["c voiced 0.6 s is 1.5 times the set's median 0.4 s (allowed 0.75-1.33)"]);
    expect(triple.outliers).toEqual(['c']);
    const advisoryTriple = evaluateLikeForLike([{ text: 'a', voicedSpanS: 0.4 }, { text: 'b', voicedSpanS: 0.4 }, { text: 'c', voicedSpanS: 0.6 }]);
    expect(advisoryTriple).toMatchObject({ ok: true, advisory: true });
    expect(advisoryTriple.flags).toHaveLength(1);
    expect(G5_GATING).toBe(false);
    expect(evaluateLikeForLike([{ text: 'a', voicedSpanS: 0.4, lufs: -16 }, { text: 'b', voicedSpanS: 0.4, lufs: -14 }], { gating: true }).failures).toEqual(['loudness differs by 2 LU (allowed 1.5)']);
    expect(evaluateLikeForLike([{ text: 'a', voicedSpanS: 0.4, lufs: -16 }, { text: 'b', voicedSpanS: 0.4, lufs: -15 }], { gating: true }).ok).toBe(true);
  });

  it('G5 gating regenerates the outlier in the set gate', () => {
    const members = [...SET.members, { text: '까', ref: 'audio/say/까.mp3' }];
    const set = { ...SET, members };
    const threeRows = new Map([...rowByRef, ['audio/say/까.mp3', man('까', '까.')]]);
    const results = new Map([
      ['audio/say/가.mp3', result('가')],
      ['audio/say/카.mp3', result('카')],
      ['audio/say/까.mp3', result('까', { signal: { summary: { voicedSpanS: 0.9 }, loudness: { integratedLufs: -16 } } })],
    ]);
    const r = evaluateContrastSet(set, { rowByRef: threeRows, resultByRef: results, packOrder: PACKS, g5Gating: true });
    expect(r.gates.G5.ok).toBe(false);
    expect(r.regenerate).toEqual(['k-까']);
    expect(evaluateContrastSet(set, { rowByRef: threeRows, resultByRef: results, packOrder: PACKS }).ok).toBe(true);
  });

  it('G6: every member must be in a pack that the quest playing the set loads', () => {
    expect(packsLoadedBy('minigame:s1-life-q3-pairs', PACKS)).toEqual(['jamo-s1', 'jamo-wb', 'stage1']);
    expect(packsLoadedBy('minigame:s2-letters-q2-pairs', PACKS)).toEqual(['jamo-s1', 'jamo-wb', 'stage1', 'placement', 'stage2']);
    expect(packsLoadedBy('quest:stage1-life-q3', PACKS)).toEqual([]);
    const late = new Map([...rowByRef, ['audio/say/카.mp3', man('카', '카.', { pack: 'stage7' })]]);
    const r = run({}, { rowByRef: late });
    expect(r.gates.G6.ok).toBe(false);
    expect(r.gates.G6.failures[0]).toMatch(/카 is in pack stage7, which minigame:s1-life-q3-pairs does not load \(loads jamo-s1, jamo-wb, stage1\)/);
    expect(evaluatePlayable({ ...SET, unit: 'minigame:s2-letters-q2-pairs' }, late, PACKS).ok).toBe(false);
    expect(evaluatePlayable({ ...SET, unit: 'minigame:s2-letters-q2-pairs' }, new Map([...rowByRef, ['audio/say/카.mp3', man('카', '카.', { pack: 'placement' })]]), PACKS).ok).toBe(true);
    expect(evaluatePlayable(SET, new Map(), PACKS).failures[0]).toMatch(/not a manifest row/);
    expect(evaluatePlayable({ ...SET, unit: 'x' }, rowByRef, PACKS).failures[0]).toMatch(/names no stage/);
  });

  it('Pass 2 margins are printed and never fail a set', () => {
    const narrow = run({ 가: { pass2: { ranking: [{ candidate: '가', score: -10 }, { candidate: '카', score: -9 }] } } });
    expect(narrow.ok).toBe(true);
    expect(narrow.margins[0]).toEqual({ text: '가', margin: -1, over: '카' });
    expect(run({ 가: { pass2: null } }).margins[0]).toEqual({ text: '가', margin: null, over: null });
    expect(pass2MarginAmong({ ranking: [{ candidate: '가', score: -8 }] }, '가', ['카'])).toBeNull();
  });
});
