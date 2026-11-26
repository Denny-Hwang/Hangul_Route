/**
 * The converter's known gaps, as detectors (AMENDMENTS-ROMANIZER-GAPS §3.6). `rr.ts` reads a string
 * of syllable blocks and cannot know where a morpheme boundary is or what part of speech a word is,
 * so four patterns need a reviewed entry in `ROMANIZATION_EXCEPTIONS`; `detectGaps` names the
 * pattern so the checker (rule R9) can demand the entry. Pure, dependency-free, Hermes-safe; the
 * lists below are data: a content PR that adds a word the lists miss adds it here in the same PR.
 */
import { decomposeSyllable, isSyllable, type SyllableParts } from './hangul';

/** The converter gaps a detector names (AMENDMENTS-ROMANIZER-GAPS §3.4). */
export type RomanizationGap = 'n-insertion' | 'saisiot' | 'juncture' | 'predicate-h';

/** Every gap a detector names, in the order `detectGaps` returns them. */
export const ROMANIZATION_GAPS: readonly RomanizationGap[] = ['n-insertion', 'saisiot', 'juncture', 'predicate-h'];

/** The rule that decides each gap (for the R9 message). */
export const GAP_ARTICLES: Readonly<Record<RomanizationGap, string>> = {
  'n-insertion': '표준 발음법 제29항',
  saisiot: '표준 발음법 제30항 3',
  juncture: '표준 발음법 제15항',
  'predicate-h': '로마자 표기법 제3장 제1항 4, 표준 발음법 제12항 붙임 2',
};

/** The 하다 forms: the block after which a stop + ㅎ in the same token is read as a predicate. */
export const HADA_BLOCKS: readonly string[] = ['하', '한', '할', '함', '합', '해', '했'];

/** Second parts that take ㄴ / ㄹ insertion after a consonant final (SP 제29항 and its 붙임). */
export const N_INSERTION_HEADS: readonly string[] = [
  '잎', '잇', '윷', '엿', '이불', '이야기', '여름', '연필', '역', '약', '열차', '율', '여비', '여성', '요기', '여우',
  '유들', '여섯', '여덟', '일곱',
];

/** Whole words (a token that starts with one) whose ㄴ-insertion no head list can show. */
export const N_INSERTION_WORDS: readonly string[] = [
  '담요', '식용유', '휘발유', '맨입', '막일', '삯일', '들일', '집안일', '부엌일', '바깥일', '앞일', '밭일', '논일',
  '뒷일', '훗일', '큰일', '볼일', '궂은일', '일일이', '영업용', '늑막염', '설익', '십육',
];

/** Content morphemes after which the previous final is carried whole into a new syllable (SP 제15항). */
export const JUNCTURE_HEADS: readonly string[] = ['없', '있', '옷', '웃음', '아래', '어른', '앞', '위', '어미', '어치'];

/** Prefixes whose final is carried whole into a following vowel block (첫인상, 헛웃음). */
export const JUNCTURE_PREFIXES: readonly string[] = ['첫', '헛', '겉', '덧', '옛', '홑'];

/** Particles and endings that follow a final ㅅ without any morpheme boundary effect (옷이, 것이에요). */
export const GRAMMATICAL_TAILS: readonly string[] = [
  '이', '가', '은', '는', '을', '를', '도', '와', '과', '랑', '이랑', '에', '에서', '에게', '의', '만', '로', '으로',
  '하고', '처럼', '보다', '까지', '부터', '이나', '이고', '이면', '이지', '이다', '이야', '이요', '이에요', '이예요',
  '이죠', '이네요', '이며', '이어서', '이든지', '이지만', '이라도', '이래요', '이잖아요',
];

/** A tail that starts with one of these is a copula (것이었습니다, 것이라고). */
export const COPULA_STEMS: readonly string[] = ['이었', '이라', '이니', '이지', '이에', '입니', '이세', '이시'];

/** Whole copula forms after a noun (것인데, 무엇인가요, 곳인가요). */
export const COPULA_FORMS: readonly string[] = ['인데', '인데요', '인지', '인지요', '인가', '인가요', '일까', '일까요', '일지', '임', '입니까'];

const SIMPLE_STOPS: ReadonlySet<string> = new Set(['ㄱ', 'ㄲ', 'ㅋ', 'ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅂ', 'ㅍ']);
/** Finals whose liaison differs from their neutralised sound: ㅅ ㅆ ㅈ ㅊ ㅌ ㅍ ㅋ ㄲ and every compound final except ㄶ ㅀ. */
const JUNCTURE_FINALS: ReadonlySet<string> = new Set([
  'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅍ', 'ㅋ', 'ㄲ', 'ㄳ', 'ㄵ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅄ',
]);
/** The medials ㅑ ㅕ ㅛ ㅠ ㅣ (indices into MEDIAL_RR): the ones that take ㄴ-insertion. */
const I_LIKE_MEDIALS: ReadonlySet<number> = new Set([2, 6, 12, 17, 20]);

const startsWithAny = (text: string, list: readonly string[]): boolean => list.some((item) => text.startsWith(item));

/** True when `tail` (the token from a block to its end) is a particle, ending or copula, not a new morpheme. */
function isGrammatical(tail: string): boolean {
  return (
    tail === '' ||
    GRAMMATICAL_TAILS.includes(tail) ||
    (tail.startsWith('이') && GRAMMATICAL_TAILS.includes(tail.slice(1))) ||
    startsWithAny(tail, COPULA_STEMS) ||
    COPULA_FORMS.includes(tail)
  );
}

/**
 * Which converter gaps `token` falls into (empty for none). `token` is one word with no spaces or
 * marks; a token with a character that is not a syllable block, or of one block, gives `[]`.
 * Detection only: the checker demands a reviewed entry, the converter output is never changed.
 */
export function detectGaps(token: string): RomanizationGap[] {
  const blocks: SyllableParts[] = [];
  for (let i = 0; i < token.length; i++) {
    if (!isSyllable(token.charAt(i))) return [];
    blocks.push(decomposeSyllable(token.charAt(i)) as SyllableParts);
  }
  if (blocks.length < 2) return [];

  const found = new Set<RomanizationGap>();
  if (startsWithAny(token, N_INSERTION_WORDS)) found.add('n-insertion');
  if (startsWithAny(token, JUNCTURE_PREFIXES) && (blocks[1] as SyllableParts).initial === 'ㅇ' && !isGrammatical(token.slice(1))) {
    found.add('juncture');
  }
  const hasHada = blocks.some((_, i) => i > 0 && HADA_BLOCKS.includes(token.charAt(i)));

  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i] as SyllableParts;
    const next = blocks[i + 1] as SyllableParts;
    const tail = token.slice(i + 1);
    if (cur.final !== '' && cur.final !== 'ㅅ' && next.initial === 'ㅇ' && startsWithAny(tail, N_INSERTION_HEADS)) {
      found.add('n-insertion');
    }
    if (
      cur.final === 'ㅅ' &&
      next.initial === 'ㅇ' &&
      I_LIKE_MEDIALS.has(next.medial) &&
      !isGrammatical(tail) &&
      !tail.startsWith('있')
    ) {
      found.add('saisiot');
    }
    const exempt = tail.startsWith('있') && (token.charAt(i) === '맛' || token.charAt(i) === '멋');
    if (JUNCTURE_FINALS.has(cur.final) && startsWithAny(tail, JUNCTURE_HEADS) && !exempt) found.add('juncture');
    if (hasHada && SIMPLE_STOPS.has(cur.final) && next.initial === 'ㅎ') found.add('predicate-h');
  }
  return ROMANIZATION_GAPS.filter((gap) => found.has(gap));
}
