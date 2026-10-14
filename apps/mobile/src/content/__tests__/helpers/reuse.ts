import type { KoText, LessonQuest, LessonScope, StageKey } from '@hangul-route/content-schema';
import { discoverItemTexts } from '@hangul-route/content-schema';

/**
 * F-CURR-001 section 3.1 rules 4-6 as data: the Korean words a lesson quest shows, where they
 * were taught, and the symbols a scored read asks for. Used by U-3, U-4 and U-6 in
 * upper-stage-curriculum.test.ts. Pure.
 */

/**
 * What follows a noun in the Stage 3-4 patterns, longest first: the copula of "It is a N"
 * (책이에요, 학교예요) and the particles (하고 before the one-syllable ones).
 */
const PARTICLES = ['이에요', '예요', '하고', '에서', '을', '를', '이', '가', '에', '은', '는', '도', '의'] as const;

/** The space-separated words (어절) of a text, sentence marks dropped; only words with Hangul. */
export function eojeolOf(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?'"“”‘’…]/g, ''))
    .filter((w) => /[가-힣]/.test(w));
}

/**
 * The word a learner counts: an 어절 without its trailing particle (친구가 -> 친구, 학교에 -> 학교),
 * unless the whole 어절 is already a known word (고양이 stays 고양이). A predicate (먹어요) is its own word.
 */
export function stemOf(eojeol: string, known: ReadonlySet<string>): string {
  if (known.has(eojeol)) return eojeol;
  const p = PARTICLES.find((x) => eojeol.length > x.length && eojeol.endsWith(x));
  return p === undefined ? eojeol : eojeol.slice(0, -p.length);
}

/**
 * Section 3.1 rule 4 counts "new words or set phrases" in Stage 4: a fixed greeting of several
 * words is one item, learned and read as a whole (F-CURR-001 T-2). Longest first.
 */
export const SET_PHRASES: readonly string[] = ['새해 복 많이 받으세요', '만나서 반가워요'];

/** The cast's names (Hoya and his friends, section 3.5 "named characters"): names, not vocabulary. */
export const CAST_NAMES: ReadonlySet<string> = new Set(['호야', '미나', '다미']);

/** A text with each set phrase joined into one 어절 (`만나서_반가워요`), so it counts as one item. */
export const joinSetPhrases = (text: string): string =>
  SET_PHRASES.reduce((t, phrase) => t.split(phrase).join(phrase.replace(/ /g, '_')), text);

/** A text without its set phrases: a set phrase is read as a whole, not decoded (rule 6, T-2). */
export const withoutSetPhrases = (text: string): string => SET_PHRASES.reduce((t, phrase) => t.split(phrase).join(' '), text);

/**
 * Rule 4 counts one new grammar point a quest besides its words: a predicate in the Stage 4 future
 * -(으)ㄹ 거예요 (올 거예요, 갈 거예요, 좋을 거예요) is that grammar point at work on a known verb, not a
 * new word (F-CURR-001 S4-3), so it is left out of the word count.
 */
const withoutFutureForms = (text: string): string => text.replace(/[가-힣]+\s+거예요/g, ' ');

export const wordsOf = (texts: readonly string[], known: ReadonlySet<string>): string[] =>
  texts
    .flatMap((t) => eojeolOf(withoutFutureForms(joinSetPhrases(t))).map((w) => stemOf(w, known)))
    .filter((w) => !CAST_NAMES.has(w));

/** The Korean texts a quest's Discover step shows (a pattern's examples, not its frame: the frame is a slot, not a word). */
export function discoverTexts(quest: LessonQuest): string[] {
  return quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => discoverItemTexts(i).map((t) => t.ko))) ?? []);
}

/** The pattern items of a quest's Discover step (rule 4: one new pattern a quest in Stage 3). */
export const discoverPatterns = (quest: LessonQuest): number =>
  quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.filter((i) => i.type === 'pattern')) ?? []).length;

const kt = (t: KoText | undefined): string[] => (t === undefined ? [] : [t.ko]);

/**
 * The Korean a scope shows outside Discover, split by whether a scored round asks the learner to
 * read it (rule 6): Sentence Builder tiles, Pic-Word Match words and written Listen & Pick options
 * are read; a Listen & Pick prompt is heard (its text is the no-voice fallback). A particle choice
 * (을 or 를) is read but is no word of its own.
 */
export function scopeTexts(scope: LessonScope): { read: string[]; heard: string[]; particles: string[] } {
  switch (scope.kind) {
    case 'order-it':
      return {
        read: scope.rounds.flatMap((r) => [r.sentence.ko, ...r.distractors.map((d) => d.ko)]),
        heard: [],
        particles: scope.rounds.flatMap((r) => r.particle?.choices.map((c) => c.ko) ?? []),
      };
    case 'pic-word-match':
      return { read: scope.boards.flatMap((b) => b.pairs.map((p) => p.word.ko)), heard: [], particles: [] };
    case 'listen-pick':
      return {
        read: scope.rounds.flatMap((r) => r.options.flatMap((o) => kt(o.text))),
        heard: scope.rounds.flatMap((r) => kt(r.prompt)),
        particles: [],
      };
    default:
      return { read: [], heard: [], particles: [] };
  }
}

/** The phrases of a Discover text: split after each sentence mark, so 고마워! 이제 너야! is two set phrases (S4-4). */
export const phrasesOf = (ko: string): string[] =>
  ko
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p !== '');

/** Section 3.1 rule 4: new words a quest may Discover, per stage (Stage 2 Word Builder counts symbols instead). */
export const NEW_WORD_CAP: Readonly<Partial<Record<StageKey, number>>> = { stage2: 4, stage3: 4, stage4: 4, stage6: 6, stage7: 3 };

/**
 * Rule 5's "a vocabulary topic of the same level": the vocabulary levels (1-3) a stage may reuse.
 * Stage 2 reads level 1 (the Stage 1 reading words' level); each stage up adds one, so Stage 3 reuses
 * levels 1-2 (김밥, 라면) and Stage 4 on all three.
 */
export const vocabLevelFor = (stage: StageKey): number => Math.max(1, Math.min(3, Number(stage.slice(5)) - 1));

/** U-3 and U-6 for one cell, quest by quest, against what earlier stages and the cell's own Discover taught. */
export function reuseProblems(stage: StageKey, quests: readonly LessonQuest[], before: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const taught = new Set(before);
  const cap = NEW_WORD_CAP[stage];
  const seenPhrases = new Set<string>();
  for (const quest of quests) {
    if (discoverPatterns(quest) > 1) out.push(`U-3 ${quest.id}: Discover teaches ${discoverPatterns(quest)} patterns`);
    const shown = [...new Set(wordsOf(discoverTexts(quest), taught))];
    const freshAll = shown.filter((w) => !taught.has(w));
    // A word of a new set phrase (반가워요 in 만나서 반가워요, then 저도 반가워요) is that one item.
    const phraseWords = new Set(freshAll.filter((w) => w.includes('_')).flatMap((w) => w.split('_')));
    const fresh = freshAll.filter((w) => !phraseWords.has(w));
    // Stage 4 counts "new words or set phrases" (rule 4): a dialogue line between sentence marks is a set
    // phrase (같이 놀자!, 내 차례야!), so a quest within the cap by either count passes (S4-4 counted phrases).
    const phrases = stage === 'stage4' ? [...new Set(discoverTexts(quest).flatMap(phrasesOf))].filter((p) => !seenPhrases.has(p)) : [];
    for (const p of phrases) seenPhrases.add(p);
    const withinByPhrase = stage === 'stage4' && cap !== undefined && phrases.length <= cap;
    if (cap !== undefined && fresh.length > cap && !withinByPhrase) out.push(`U-3 ${quest.id}: ${fresh.length} new words (${fresh.join(', ')}), cap ${cap}`);
    for (const w of shown) taught.add(w);
    const outside = [...new Set(quest.scopes.flatMap((s) => {
      const { read, heard } = scopeTexts(s);
      return wordsOf([...read, ...heard], taught);
    }))];
    const reused = outside.filter((w) => taught.has(w));
    if (outside.length > 0 && reused.length * 2 < outside.length) {
      out.push(`U-6 ${quest.id}: ${reused.length} of ${outside.length} words reused (${outside.filter((w) => !taught.has(w)).join(', ')} not taught)`);
    }
  }
  return out;
}

// ---- rule 6: decodable reading ---------------------------------------------------------------

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** A syllable block's [initial, vowel, final?]; null for anything that is not one. */
export function jamoOfSyllable(ch: string): string[] | null {
  const code = (ch.codePointAt(0) ?? 0) - 0xac00;
  if ([...ch].length !== 1 || code < 0 || code > 11171) return null;
  const final = FINALS[code % 28] as string;
  return [INITIALS[Math.floor(code / 588)] as string, MEDIALS[Math.floor((code % 588) / 28)] as string, ...(final === '' ? [] : [final])];
}

/** The symbols a route has taught: initial consonants, vowels and final letters. */
export interface TaughtSymbols {
  initials: ReadonlySet<string>;
  vowels: ReadonlySet<string>;
  finals: ReadonlySet<string>;
}

/**
 * Word Builder's symbols (section 3.3): the five tense consonants, the eleven compound vowels and the
 * ten final letters of q5-q6. With Stage 1's 30 they are every modern initial and vowel and every
 * single final letter; double finals (겹받침) stay theme words, never a scored read.
 */
export const WORD_BUILDER_SYMBOLS: TaughtSymbols = {
  initials: new Set([...'ㄲㄸㅃㅆㅉ']),
  vowels: new Set([...'ㅐㅔㅒㅖㅘㅝㅟㅢㅚㅙㅞ']),
  finals: new Set([...'ㄷㅅㅈㅊㅌㅎㅆㅋㄲㅍ']),
};

export const unionSymbols = (a: TaughtSymbols, b: TaughtSymbols): TaughtSymbols => ({
  initials: new Set([...a.initials, ...b.initials]),
  vowels: new Set([...a.vowels, ...b.vowels]),
  finals: new Set([...a.finals, ...b.finals]),
});

/** The symbols of `text` that `taught` lacks, as `initial ㄸ in 뜨` lines (empty = decodable). */
export function untaughtSymbols(text: string, taught: TaughtSymbols): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (!/[가-힣]/.test(ch)) {
      if (/[ㄱ-ㆎ]/.test(ch)) out.push(`loose jamo ${ch}`);
      continue;
    }
    const [initial, vowel, final] = jamoOfSyllable(ch) as string[];
    if (!taught.initials.has(initial as string)) out.push(`initial ${initial} in ${ch}`);
    if (!taught.vowels.has(vowel as string)) out.push(`vowel ${vowel} in ${ch}`);
    if (final !== undefined && !taught.finals.has(final)) out.push(`final ${final} in ${ch}`);
  }
  return out;
}
