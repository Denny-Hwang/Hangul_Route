// The rules of the two-pass QA (AMENDMENTS-AUDIO-CLIPS section 9 and G4; row AC-4), kept apart from the recognizers
// so every rule is tested on synthetic recognizer output, with no model, no audio and no network.
//
//   normalizeTranscript, targetFormsOf, isExactMatch    the exact-match rule (NFC, punctuation and spaces removed;
//                                                       the manifest text or an authored `accept` variant only; a
//                                                       digit run read aloud and 에요/예요 are the same spoken form)
//   syllableConfusables, closedSetOf                    the closed set of a jamo or 1-2 syllable clip
//   whisperGrammar, evaluatePass1                       Pass 1: whisper.cpp free transcription and forced choice
//   ctcVocabOf ... scoreCtcClip, evaluatePass2          Pass 2: CTC greedy decode and forced-alignment margins (advisory)
//   clipVerdict                                         a clip passes when Pass 1 and the shared checks do; Pass 2 only flags
//
// The shared signal and identity checks and the report are in qa-report.mjs; the recognizers in recognizers.mjs.

/**
 * The Pass 2 margin threshold in nats for the advisory flag (section 9, 13). The AC-5 pilot (216 closed-set clips, three
 * voices) put the pinned model's AUC at 0.64 and the target on top in 86 of 216 clips; at 2.0 nats it rejected 75 % of the
 * clips Whisper accepted. 0.5 nats loses the fewest good clips per bad clip flagged.
 */
export const CTC_MARGIN_NATS = 0.5;

// --- Normalization and the exact-match rule -------------------------------------------------------------------

const NOT_SPOKEN = /[\p{P}\p{S}\p{Z}\s]/gu;

/** NFC, with punctuation, symbols and spaces removed (section 9, both passes). */
export function normalizeTranscript(text) {
  return String(text ?? '').normalize('NFC').replace(NOT_SPOKEN, '');
}

/**
 * The 19 letter names and how each is said in isolation (AC-B3 table): a letter-name clip also passes on its heard
 * form (시옷 heard as [시옫]), and the names are each other's confusables.
 */
export const LETTER_NAMES = Object.freeze(
  [
    ['기역', '기역', 'ㄱ'],
    ['니은', '니은', 'ㄴ'],
    ['디귿', '디귿', 'ㄷ'],
    ['리을', '리을', 'ㄹ'],
    ['미음', '미음', 'ㅁ'],
    ['비읍', '비읍', 'ㅂ'],
    ['시옷', '시옫', 'ㅅ'],
    ['이응', '이응', 'ㅇ'],
    ['지읒', '지읃', 'ㅈ'],
    ['치읓', '치읃', 'ㅊ'],
    ['키읔', '키윽', 'ㅋ'],
    ['티읕', '티읃', 'ㅌ'],
    ['피읖', '피읍', 'ㅍ'],
    ['히읗', '히읃', 'ㅎ'],
    ['쌍기역', '쌍기역', 'ㄲ'],
    ['쌍디귿', '쌍디귿', 'ㄸ'],
    ['쌍비읍', '쌍비읍', 'ㅃ'],
    ['쌍시옷', '쌍시옫', 'ㅆ'],
    ['쌍지읒', '쌍지읃', 'ㅉ'],
  ].map(([name, heard, letter]) => Object.freeze({ name, heard, letter })),
);
const NAME_BY_TEXT = new Map(LETTER_NAMES.map((n) => [n.name, n]));
/** The plain / aspirated / tense series of the letters (and ㅅ / ㅆ). */
const LETTER_SERIES = [['ㄱ', 'ㅋ', 'ㄲ'], ['ㄷ', 'ㅌ', 'ㄸ'], ['ㅂ', 'ㅍ', 'ㅃ'], ['ㅈ', 'ㅊ', 'ㅉ'], ['ㅅ', 'ㅆ']];

const unique = (list) => [...new Set(list)];

/**
 * The transcripts a clip passes on, normalized: the manifest `text`, the heard form of a letter name, and the authored
 * `accept` variants of its pronunciation override. An override's `say` alone is not an accepted transcript.
 *
 * @param {{ text: string }} row a manifest row
 * @param {Record<string, { accept?: string[] }>} overrides the parsed pronunciation-overrides.json entries
 */
export function targetFormsOf(row, overrides) {
  const text = String(row.text).normalize('NFC').trim();
  const name = NAME_BY_TEXT.get(text);
  const accept = overrides[text]?.accept ?? [];
  return unique([text, ...(name ? [name.heard] : []), ...accept].map(normalizeTranscript));
}

// --- Spoken-equivalent spellings (Whisper writes digits; 에요 and 예요 sound the same) ---------------------------

const SINO_DIGIT = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const NATIVE_ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_ONES_BEFORE_COUNTER = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const NATIVE_TENS_BEFORE_COUNTER = ['', '열', '스무', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
/** Counters said with the native numerals (한 개, 두 명, 세 시); every other counter takes the Sino-Korean numeral. */
const NATIVE_COUNTERS = ['개', '명', '분', '마리', '살', '권', '잔', '병', '송이', '그릇', '장', '대', '번', '켤레', '시', '곳', '가지', '사람'];

/** 0 to 99 in Sino-Korean (3 -> 삼, 12 -> 십이, 40 -> 사십). */
export function sinoNumeral(n) {
  if (n === 0) return '영';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens === 0 ? '' : tens === 1 ? '십' : `${SINO_DIGIT[tens]}십`}${SINO_DIGIT[ones]}`;
}

/** 1 to 99 in native Korean; `beforeCounter` is the short form (1 -> 한, 2 -> 두, 3 -> 세, 4 -> 네, 20 -> 스무). */
export function nativeNumeral(n, beforeCounter) {
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const t = (beforeCounter && ones === 0 ? NATIVE_TENS_BEFORE_COUNTER : NATIVE_TENS)[tens];
  return `${t}${(beforeCounter ? NATIVE_ONES_BEFORE_COUNTER : NATIVE_ONES)[ones]}`;
}

/**
 * The readings of a digit run followed by `rest` (what is left of the transcript): before a native counter the short
 * native numeral (3개 -> 세) and the Sino-Korean one (for 분, 번, 시 ...); otherwise the Sino-Korean numeral, plus
 * the plain native one when nothing follows (3 -> 셋).
 */
function numeralReadings(digits, rest) {
  const n = Number(digits);
  if (!Number.isInteger(n) || n > 99 || (digits.length > 1 && digits.startsWith('0'))) return [];
  const counted = NATIVE_COUNTERS.some((c) => rest.startsWith(c));
  const out = [sinoNumeral(n)];
  if (n >= 1 && counted) out.push(nativeNumeral(n, true));
  if (n >= 1 && rest === '') out.push(nativeNumeral(n, false));
  return out;
}

/**
 * The normalized spoken forms a transcript may stand for: itself, with every digit run (up to 99) also read aloud
 * (사과 3개 -> 사과세개, the native numeral before a counter such as 개 or 명, the Sino-Korean one otherwise). Whisper
 * writes numerals as digits, which is a spelling choice and not a pronunciation miss. The result is never empty.
 */
export function spokenVariantsOf(transcript) {
  const base = normalizeTranscript(transcript);
  if (!/\d/u.test(base)) return [base];
  const parts = base.split(/(\d+)/u);
  let variants = [''];
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 0) {
      variants = variants.map((v) => v + parts[i]);
      continue;
    }
    const rest = parts.slice(i + 1).join('');
    const readings = numeralReadings(parts[i], rest);
    variants = variants.flatMap((v) => (readings.length === 0 ? [v + parts[i]] : readings.map((r) => v + r)));
    if (variants.length > 64) variants = variants.slice(0, 64);
  }
  return variants;
}

/** 얼마에요 and 얼마예요 are one spoken form (에요 after a vowel is a spelling variant of 예요); compare them as one. */
const foldSpelling = (normalized) => normalized.replaceAll('예요', '에요');

/**
 * Whether a transcript is one of the target forms after normalization: an exact match with only two kinds of slack, both
 * spelling and not sound: a digit run read aloud (3개 = 세 개) and 에요 = 예요. 가반 for 가방 still fails.
 */
export function isExactMatch(transcript, forms) {
  const folded = new Set(forms.map(foldSpelling));
  return spokenVariantsOf(transcript).some((v) => folded.has(foldSpelling(v)));
}

/** A whisper.cpp `-otxt` output: its segments joined by one space. */
export function parseWhisperText(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join(' ');
}

// --- Hangul syllables -----------------------------------------------------------------------------------------

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const MEDIALS = 21;
const FINALS = 28;

/** A precomposed syllable as initial, medial and final indexes (final 0 = none), or null. */
export function decomposeSyllable(syllable) {
  const code = syllable.codePointAt(0);
  if (syllable.length !== 1 || code < SYLLABLE_BASE || code > SYLLABLE_LAST) return null;
  const offset = code - SYLLABLE_BASE;
  return { l: Math.floor(offset / (MEDIALS * FINALS)), v: Math.floor(offset / FINALS) % MEDIALS, t: offset % FINALS };
}

export function composeSyllable({ l, v, t }) {
  return String.fromCodePoint(SYLLABLE_BASE + (l * MEDIALS + v) * FINALS + t);
}

// Initial indexes: ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18.
/** Plain, aspirated, tense (and ㅅ/ㅆ): 가/카/까 다/타/따 바/파/빠 자/차/짜 사/싸. */
const INITIAL_SERIES = [[0, 15, 1], [3, 16, 4], [7, 17, 8], [12, 14, 13], [9, 10]];
// Medial indexes: ㅓ4 ㅗ8 ㅜ13 ㅡ18 ㅢ19 ㅣ20.
/** ㅓ/ㅗ, ㅡ/ㅜ, and 의 against 이 and 으. */
const MEDIAL_PAIRS = [[4, 8], [18, 13], [19, 20], [19, 18]];
// Final indexes: ㄱ1 ㄲ2 ㄳ3 ㄴ4 ㄵ5 ㄶ6 ㄷ7 ㄹ8 ㄺ9 ㄻ10 ㄼ11 ㄽ12 ㄾ13 ㄿ14 ㅀ15 ㅁ16 ㅂ17 ㅄ18 ㅅ19 ㅆ20 ㅇ21
// ㅈ22 ㅊ23 ㅋ24 ㅌ25 ㅍ26 ㅎ27.
/** The seven final sounds, in the order of section 9: 악 안 알 암 압 앙 앋. */
const FINAL_SOUNDS = [1, 4, 8, 16, 17, 21, 7];
/** The sound each written final is said as at the end of a syllable (coda neutralization). */
const FINAL_SOUND_OF = { 1: 1, 2: 1, 3: 1, 4: 4, 5: 4, 6: 4, 7: 7, 8: 8, 9: 1, 10: 16, 11: 8, 12: 8, 13: 8, 14: 17, 15: 8, 16: 16, 17: 17, 18: 17, 19: 7, 20: 7, 21: 21, 22: 7, 23: 7, 24: 1, 25: 7, 26: 17, 27: 7 };

/**
 * Nearest sounds for a syllable the rules of section 9 give no confusable (나, 마, 하, 아, 야, 애, 와 ...), so its
 * forced choice and its margin still compare it with something: a nasal or liquid against the stop or nasal at the
 * same place (ㄴ/ㄷ, ㅁ/ㅂ, ㄹ/ㄴ), ㅎ against a dropped ㅎ (ㅇ), and a glide vowel against its plain vowel (ㅑ/ㅏ,
 * ㅘ/ㅏ, ㅟ/ㅣ ...). Vowels that most speakers no longer tell apart (ㅐ/ㅔ, ㅚ/ㅙ/ㅞ) are never paired.
 */
const FALLBACK_INITIALS = [[2, 3], [6, 7], [5, 2], [18, 11]];
const FALLBACK_MEDIALS = [[2, 0], [6, 4], [12, 8], [17, 13], [3, 1], [7, 5], [9, 0], [14, 4], [16, 20], [10, 1], [15, 5], [11, 8]];

const swaps = (pairs, value, set) => {
  const out = [];
  for (const [a, b] of pairs) {
    if (value === a) out.push(set(b));
    else if (value === b) out.push(set(a));
  }
  return out;
};

/**
 * The confusables of one syllable (section 9): the other members of its plain / aspirated / tense series, the other
 * final sounds (a final said the same as its own, such as 옷 and 옫, is not offered), ㅓ/ㅗ, ㅡ/ㅜ, and 의 against
 * 이 and 으. A syllable those rules give nothing gets its nearest sounds (FALLBACK_INITIALS, FALLBACK_MEDIALS).
 * Not a syllable: none.
 */
export function syllableConfusables(syllable) {
  const parts = decomposeSyllable(syllable);
  if (parts === null) return [];
  const out = [];
  for (const series of INITIAL_SERIES) {
    if (series.includes(parts.l)) for (const l of series) if (l !== parts.l) out.push(composeSyllable({ ...parts, l }));
  }
  out.push(...swaps(MEDIAL_PAIRS, parts.v, (v) => composeSyllable({ ...parts, v })));
  if (parts.t !== 0) {
    const own = FINAL_SOUND_OF[parts.t];
    for (const t of FINAL_SOUNDS) if (t !== own) out.push(composeSyllable({ ...parts, t }));
  }
  if (out.length === 0) {
    out.push(...swaps(FALLBACK_INITIALS, parts.l, (l) => composeSyllable({ ...parts, l })));
    out.push(...swaps(FALLBACK_MEDIALS, parts.v, (v) => composeSyllable({ ...parts, v })));
  }
  return unique(out).filter((s) => s !== syllable);
}

const syllablesOf = (text) => [...normalizeTranscript(text)];
const isHangulOnly = (text) => /^[가-힣]+$/u.test(text);

/** Whether a clip gets the closed-set checks: every jamo clip, and every other clip of one or two syllables. */
export function isClosedSetRow(row) {
  if (row.kind === 'jamo-sound' || row.kind === 'jamo-name') return true;
  const s = syllablesOf(row.text);
  return s.length >= 1 && s.length <= 2 && isHangulOnly(s.join(''));
}

/** The letter names a name is confused with: the same series, and every name that shares a written or heard syllable. */
function nameConfusables(name) {
  const series = LETTER_SERIES.find((s) => s.includes(name.letter)) ?? [name.letter];
  const mine = new Set([...name.name, ...name.heard]);
  const out = [];
  for (const other of LETTER_NAMES) {
    if (other === name) continue;
    const shares = [...other.name, ...other.heard].some((s) => mine.has(s));
    if (series.includes(other.letter) || shares) out.push(other.name, other.heard);
  }
  return out;
}

// Initial indexes of the plain obstruents that tense after a stop coda, and their tense forms: ㄱ>ㄲ ㄷ>ㄸ ㅂ>ㅃ ㅅ>ㅆ ㅈ>ㅉ.
const TENSE_OF = { 0: 1, 3: 4, 7: 8, 9: 10, 12: 13 };
// The aspirated forms after a final ㅎ (ㅎ ㄶ ㅀ): ㄱ>ㅋ ㄷ>ㅌ ㅈ>ㅊ.
const ASPIRATED_OF = { 0: 15, 3: 16, 12: 14 };
const H_FINALS = new Set([6, 15, 27]);
// The nasal a stop coda becomes before ㄴ or ㅁ: ㄱ>ㅇ ㄷ>ㄴ ㅂ>ㅁ (by the coda's sound).
const NASAL_OF_SOUND = { 1: 21, 7: 4, 17: 16 };
const NASAL_INITIALS = new Set([2, 6]);
const STOP_SOUNDS = new Set([1, 7, 17]);

/**
 * The standard pronunciation of a two-syllable form where an obligatory sound change across the syllable boundary
 * makes it sound like one of its own confusables (Standard Pronunciation rules 23, 12 and 18), written the way the
 * confusable generator writes it, one syllable changed:
 *   - tensing after a stop coda (ㄱ ㄷ ㅂ by sound): 학교 > 학꾜, 책상 > 책쌍, 있다 > 있따, 십분 > 십뿐;
 *   - aspiration after a final ㅎ: 좋다 > 좋타;
 *   - nasalization of a stop coda before ㄴ or ㅁ: 국물 > 궁물, 입니 > 임니;
 *   - ㄴ next to ㄹ said as ㄹ: 신라 > 실라, 설날 > 설랄.
 * A correctly spoken clip sounds like these, so they are targets, never confusables. Other forms: none.
 */
export function standardPronunciationsOf(form) {
  const syl = [...form];
  if (syl.length !== 2) return [];
  const a = decomposeSyllable(syl[0]);
  const b = decomposeSyllable(syl[1]);
  if (a === null || b === null || a.t === 0) return [];
  const sound = FINAL_SOUND_OF[a.t];
  const out = [];
  if (STOP_SOUNDS.has(sound) && !H_FINALS.has(a.t) && TENSE_OF[b.l] !== undefined) out.push(syl[0] + composeSyllable({ ...b, l: TENSE_OF[b.l] }));
  if (H_FINALS.has(a.t) && ASPIRATED_OF[b.l] !== undefined) out.push(syl[0] + composeSyllable({ ...b, l: ASPIRATED_OF[b.l] }));
  if (STOP_SOUNDS.has(sound) && NASAL_INITIALS.has(b.l)) out.push(composeSyllable({ ...a, t: NASAL_OF_SOUND[sound] }) + syl[1]);
  if (a.t === 4 && b.l === 5) out.push(composeSyllable({ ...a, t: 8 }) + syl[1]);
  if (a.t === 8 && b.l === 2) out.push(syl[0] + composeSyllable({ ...b, l: 5 }));
  return unique(out).filter((x) => x !== form);
}

/**
 * The spellings said the same as a final-sound clip's text (악 > 앆 앇 앍 앜; 앋 > 앗 앚 앛 앝 았 앟): one syllable whose
 * final is said as the same sound (coda neutralization). A recognizer trained on standard spelling usually writes the
 * common one (앗 for the shared t-final clip 앋), so these are targets of that clip. Other texts: none.
 */
export function sameSoundSpellingsOf(text) {
  const syl = [...String(text).normalize('NFC').trim()];
  if (syl.length !== 1) return [];
  const parts = decomposeSyllable(syl[0]);
  if (parts === null || parts.t === 0) return [];
  const own = FINAL_SOUND_OF[parts.t];
  const out = [];
  for (let t = 1; t < FINALS; t += 1) if (t !== parts.t && FINAL_SOUND_OF[t] === own) out.push(composeSyllable({ ...parts, t }));
  return out;
}

/**
 * The closed set of a clip (section 9: the same set in both passes), or null for a clip that is checked by free
 * transcription only. `targets` are the accepted forms (`targetFormsOf`), the standard pronunciation of a
 * two-syllable form (`standardPronunciationsOf`: 학교 is said [학꾜]) and, for a final-sound jamo clip, the spellings
 * said the same (`sameSoundSpellingsOf`: 앋 and 앗); `confusables` every other candidate: one syllable at a time
 * swapped for its confusables (1-2 syllable texts), and for a letter name the names of its series and those that
 * share a syllable (the 쌍 names against the plain names).
 */
export function closedSetOf(row, overrides) {
  if (!isClosedSetRow(row)) return null;
  const forms = targetFormsOf(row, overrides);
  const targets = unique([
    ...forms,
    ...forms.flatMap((f) => standardPronunciationsOf(f)),
    ...(row.kind === 'jamo-sound' ? sameSoundSpellingsOf(row.text) : []),
  ]);
  const out = [];
  for (const form of forms) {
    const syl = [...form];
    if (syl.length > 2) continue;
    syl.forEach((s, i) => {
      for (const c of syllableConfusables(s)) out.push([...syl.slice(0, i), c, ...syl.slice(i + 1)].join(''));
    });
  }
  const name = NAME_BY_TEXT.get(String(row.text).normalize('NFC').trim());
  if (name) out.push(...nameConfusables(name));
  const taken = new Set(targets);
  return { targets, confusables: unique(out).filter((c) => !taken.has(c)) };
}

// --- Pass 1: Whisper --------------------------------------------------------------------------------------------

/**
 * The GBNF grammar of a forced choice (whisper.cpp `--grammar`, with `--grammar-rule root`): exactly one candidate,
 * with Whisper's optional leading space and a closing full stop, question or exclamation mark.
 */
export function whisperGrammar(candidates) {
  if (candidates.length === 0) throw new Error('a forced choice needs at least one candidate');
  for (const c of candidates) if (!isHangulOnly(c)) throw new Error(`grammar candidate "${c}" must be Hangul syllables only`);
  return `root ::= " "? choice [.?!]?\nchoice ::= ${candidates.map((c) => `"${c}"`).join(' | ')}\n`;
}

const shownForms = (forms) => forms.join(' or ');

/**
 * Pass 1 on one clip: the free transcript must match exactly (a word or sentence fails otherwise; for a closed-set
 * clip a mismatch is a flag), and a closed-set clip's forced choice must be a target form.
 *
 * @param {{ forms: string[], closedSet: { targets: string[], confusables: string[] } | null, free?: string, forced?: string }} input
 */
export function evaluatePass1({ forms, closedSet, free, forced }) {
  const failures = [];
  const flags = [];
  const freeText = free === undefined ? undefined : String(free).trim();
  const freeMatch = freeText !== undefined && isExactMatch(freeText, forms);
  if (freeText === undefined) failures.push('no free transcript');
  else if (!freeMatch) {
    if (closedSet === null) failures.push(`free transcript "${freeText}" is not ${shownForms(forms)}`);
    else flags.push(`free transcript "${freeText}" differs from ${shownForms(forms)} (the forced choice decides)`);
  }
  const forcedText = forced === undefined ? undefined : String(forced).trim();
  if (closedSet !== null) {
    // The forced choice may land on any target of the closed set (a standard pronunciation, 학교 as 학꾜, included).
    if (forcedText === undefined) failures.push('no forced choice');
    else if (!isExactMatch(forcedText, closedSet.targets)) failures.push(`forced choice "${forcedText}" is not the target ${shownForms(closedSet.targets)}`);
  }
  return { ok: failures.length === 0, free: freeText ?? null, freeMatch, forced: closedSet === null ? null : forcedText ?? null, failures, flags };
}

// --- Pass 2: CTC ------------------------------------------------------------------------------------------------

// Compatibility jamo (U+3131-U+3163): the units of a jamo CTC vocabulary (the `jamo` package's h2j + j2hcj).
const COMPAT_CONSONANT = /[ㄱ-ㅎ]/u;
const COMPAT_VOWEL = /[ㅏ-ㅣ]/u;
const INITIAL_COMPAT = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIAL_COMPAT = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINAL_COMPAT = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
/** Two finals that write one compound final (ㄹ + ㄱ = ㄺ), for a model that emits them one by one. */
const COMPOUND_FINAL = { ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ' };

/**
 * The units of a wav2vec2 CTC model from its `vocab.json` and `config.json`: `jamo` (compatibility jamo, as the
 * Zeroth-Korean jamo models write them) or `syllable` (precomposed syllables). The blank is the pad token.
 */
export function ctcVocabOf(vocab, config = {}) {
  const idOf = new Map(Object.entries(vocab).map(([token, id]) => [token, Number(id)]));
  const tokenOf = new Map([...idOf].map(([token, id]) => [id, token]));
  const blankId = Number.isInteger(config.pad_token_id) ? config.pad_token_id : idOf.get('[PAD]') ?? idOf.get('<pad>');
  if (blankId === undefined) throw new Error('the CTC vocabulary has no pad (blank) token');
  const delimiterId = idOf.get('|') ?? idOf.get(' ') ?? null;
  const unit = idOf.has('ㅏ') ? 'jamo' : 'syllable';
  return { unit, blankId, delimiterId, idOf, tokenOf };
}

/** The model's token ids for a text (spaces and punctuation removed), or null when the vocabulary cannot spell it. */
export function ctcTokensOf(text, vocab) {
  const units = [];
  for (const s of normalizeTranscript(text)) {
    if (vocab.unit === 'syllable') {
      units.push(s);
      continue;
    }
    const parts = decomposeSyllable(s);
    if (parts === null) return null;
    units.push(INITIAL_COMPAT[parts.l], MEDIAL_COMPAT[parts.v]);
    if (parts.t !== 0) units.push(FINAL_COMPAT[parts.t]);
  }
  const ids = units.map((u) => vocab.idOf.get(u));
  return ids.some((id) => id === undefined) ? null : ids;
}

/** Compatibility jamo back into syllables; anything that does not form a syllable is kept as it is. */
export function composeCompatJamo(text) {
  const chars = [...text];
  const isC = (c) => c !== undefined && COMPAT_CONSONANT.test(c);
  const isV = (c) => c !== undefined && COMPAT_VOWEL.test(c);
  let out = '';
  for (let i = 0; i < chars.length; ) {
    const c = chars[i];
    const l = INITIAL_COMPAT.indexOf(c);
    if (isC(c) && l >= 0 && isV(chars[i + 1])) {
      const v = MEDIAL_COMPAT.indexOf(chars[i + 1]);
      let j = i + 2;
      let t = 0;
      const one = chars[j];
      if (isC(one) && !isV(chars[j + 1])) {
        const pair = COMPOUND_FINAL[`${one}${chars[j + 1] ?? ''}`];
        if (pair !== undefined && !isV(chars[j + 2])) {
          t = FINAL_COMPAT.indexOf(pair);
          j += 2;
        } else if (FINAL_COMPAT.indexOf(one) > 0) {
          t = FINAL_COMPAT.indexOf(one);
          j += 1;
        }
      }
      out += composeSyllable({ l, v, t });
      i = j;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Greedy CTC decoding of the per-frame best ids: repeats collapsed, the blank dropped, the delimiter as a space. */
export function ctcGreedyText(argmax, vocab) {
  let out = '';
  let prev = null;
  for (const id of argmax) {
    if (id !== prev && id !== vocab.blankId) out += id === vocab.delimiterId ? ' ' : vocab.tokenOf.get(id) ?? '';
    prev = id;
  }
  const text = vocab.unit === 'jamo' ? composeCompatJamo(out) : out;
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The forced-alignment (Viterbi) log-likelihood of a label sequence: the best CTC path through blank, label, blank
 * over every frame, in nats. `emissions[t][k]` is the log-probability of column k at frame t (log-softmax over the
 * whole vocabulary, then the requested columns); `labels` and `blank` are column indexes. Impossible: -Infinity.
 */
export function ctcViterbiLogLik(emissions, labels, blank) {
  const ext = [blank];
  for (const l of labels) ext.push(l, blank);
  const S = ext.length;
  const T = emissions.length;
  if (T === 0) return labels.length === 0 ? 0 : Number.NEGATIVE_INFINITY;
  let prev = new Array(S).fill(Number.NEGATIVE_INFINITY);
  prev[0] = emissions[0][ext[0]];
  if (S > 1) prev[1] = emissions[0][ext[1]];
  for (let t = 1; t < T; t += 1) {
    const cur = new Array(S).fill(Number.NEGATIVE_INFINITY);
    for (let s = 0; s < S; s += 1) {
      let best = prev[s];
      if (s >= 1 && prev[s - 1] > best) best = prev[s - 1];
      if (s >= 2 && ext[s] !== blank && ext[s] !== ext[s - 2] && prev[s - 2] > best) best = prev[s - 2];
      if (best !== Number.NEGATIVE_INFINITY) cur[s] = best + emissions[t][ext[s]];
    }
    prev = cur;
  }
  return Math.max(prev[S - 1], S > 1 ? prev[S - 2] : Number.NEGATIVE_INFINITY);
}

/** Every token id the candidates need, plus the blank: the columns the recognizer returns emissions for. */
export function ctcRequestIds(candidates, vocab) {
  const ids = new Set([vocab.blankId]);
  for (const c of candidates) for (const id of ctcTokensOf(c, vocab) ?? []) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}

/**
 * One clip's Pass 2 result from the recognizer's output (`argmax` per frame over the whole vocabulary; `emissions`
 * for the requested `ids` only): the greedy decode and each candidate's log-likelihood (null when the vocabulary
 * cannot spell it).
 */
export function scoreCtcClip({ argmax, ids, emissions }, candidates, vocab) {
  const column = new Map(ids.map((id, k) => [id, k]));
  const blank = column.get(vocab.blankId);
  const scores = {};
  for (const c of candidates) {
    const tokens = ctcTokensOf(c, vocab);
    if (tokens === null) {
      scores[c] = null;
      continue;
    }
    const labels = tokens.map((id) => column.get(id));
    if (blank === undefined || labels.some((k) => k === undefined)) throw new Error(`token of "${c}" was not requested from the recognizer`);
    scores[c] = ctcViterbiLogLik(emissions, labels, blank);
  }
  return { free: ctcGreedyText(argmax, vocab), scores };
}

const round = (n, places = 3) => (Number.isFinite(n) ? Math.round(n * 10 ** places) / 10 ** places : n);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/**
 * Pass 2 on one clip, as an ADVISORY opinion: it never fails a clip. The AC-5 pilot found the pinned model cannot gate
 * (AUC 0.64, the target on top in 86 of 216 clips, 0 of 27 words and sentences decoded exactly), so the greedy decode
 * (any kind of clip) and the closed-set margin are reported in `flags`, and `advisory` says whether the old gate would
 * have rejected the clip. The owner listen and the MAR reviewers read these; they are never alone a reason to regenerate.
 * For a closed-set clip the best target form is compared with the best confusable, against `threshold` nats.
 *
 * @param {{ forms: string[], closedSet: { targets: string[], confusables: string[] } | null, free?: string,
 *   scores?: Record<string, number | null>, threshold?: number }} input
 */
export function evaluatePass2({ forms, closedSet, free, scores = {}, threshold = CTC_MARGIN_NATS }) {
  const flags = [];
  const freeText = free === undefined ? undefined : String(free).trim();
  const freeMatch = freeText !== undefined && isExactMatch(freeText, forms);
  if (freeText === undefined) flags.push('no greedy decode');
  else if (!freeMatch) {
    flags.push(
      closedSet === null
        ? `greedy decode "${freeText}" differs from ${shownForms(forms)}`
        : `greedy decode "${freeText}" differs from ${shownForms(forms)} (the margins decide)`,
    );
  }
  let target = null;
  let best = null;
  let margin = null;
  let ranking = [];
  let lowMargin = false;
  if (closedSet !== null) {
    const candidates = [...closedSet.targets, ...closedSet.confusables];
    ranking = candidates
      .filter((c) => finite(scores[c]))
      .map((c) => ({ candidate: c, score: round(scores[c]), target: closedSet.targets.includes(c) }))
      .sort((a, b) => b.score - a.score);
    const top = (list) => list.reduce((acc, c) => (finite(scores[c]) && (acc === null || scores[c] > scores[acc]) ? c : acc), null);
    target = top(closedSet.targets);
    best = top(closedSet.confusables);
    if (target === null) {
      lowMargin = true;
      flags.push(`cannot score the target ${shownForms(closedSet.targets)} (outside the model vocabulary, or no alignment)`);
    } else if (best === null) {
      lowMargin = true;
      flags.push('no confusable could be scored, so there is no margin');
    } else {
      margin = round(scores[target] - scores[best]);
      if (margin <= 0) {
        lowMargin = true;
        flags.push(`target is not top: ${best} scores ${round(scores[best], 2)} against ${target} ${round(scores[target], 2)}`);
      } else if (margin < threshold) {
        lowMargin = true;
        flags.push(`margin ${margin} nats over ${best} is under ${threshold} (top but narrow)`);
      }
    }
  }
  const advisory = closedSet === null ? freeText === undefined || !freeMatch : lowMargin;
  return { ok: true, advisory, free: freeText ?? null, freeMatch, target, best, margin, ranking, failures: [], flags };
}

// --- The verdict --------------------------------------------------------------------------------------------------

const PARTS = [
  ['pass1', 'Pass 1', 'did not run', true],
  ['pass2', 'Pass 2', 'did not run', false],
  ['signal', 'signal', 'not measured', true],
  ['identity', 'identity', 'not checked', true],
];

/**
 * A clip passes when Pass 1 and the signal and identity checks all ran and passed. Pass 2 is advisory (its findings are
 * flags; section 9 and the AC-5 pilot): it adds no reason, and a clip passes whether or not it ran.
 */
export function clipVerdict(parts) {
  const reasons = [];
  for (const [key, label, missing, required] of PARTS) {
    const part = parts[key];
    if (part === undefined || part === null) {
      if (required) reasons.push(`${label}: ${missing}`);
    } else if (!part.ok) reasons.push(...part.failures.map((f) => `${label}: ${f}`));
  }
  return { verdict: reasons.length === 0 ? 'pass' : 'fail', reasons };
}
