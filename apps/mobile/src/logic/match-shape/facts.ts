/**
 * The sourced facts of Match Shape's origin rounds (F-CURR-002 sections 5.1, 5.2 and 6.6, row CM-33): where the five
 * basic consonants and the vowel bases come from. Each fact cites public institutions of the 6.6 allowlist, under
 * their names as of the access date: a page whose quoted words name the letter itself (the National Institute of
 * Korean Language, or for ㄱ and ㅁ the National Hangeul Museum's About Hangeul page, which keeps to the Haerye
 * wording), and the National Hangeul Museum for the principle (consonants modelled on the vocal organs, the three
 * primary vowels on sky, earth and humanity). The lines say what these sources say, which is what the
 * Hunminjeongeum Haerye states, and nothing stronger; they restate the shipped, sourced facts f2, f3, f5 and f6 of
 * `content/stories/shapes-of-hangeul.json` and add no new claim. "Where this comes from" shows a fact's sources in
 * place, as plain text (title and publisher), never a link. Read only by the Match Shape chunk, so the start bundle
 * carries none of it.
 */

export interface ShapeSource {
  title: string;
  /** The institution, under its name as of the access date. */
  publisher: string;
  url: string;
  /** YYYY-MM-DD */
  accessed: string;
  /** The quoted words the fact rests on. */
  quote: string;
}

const NIKL = 'National Institute of Korean Language';
const CONSONANTS = { title: 'Principles of Han-geul: consonant letters', publisher: NIKL, url: 'https://www.korean.go.kr/eng_hangeul/principle/002.html', accessed: '2026-10-23' };
const VOWELS = { title: 'Principles of Han-geul: vowel letters', publisher: NIKL, url: 'https://www.korean.go.kr/eng_hangeul/principle/003.html', accessed: '2026-10-23' };
const MUSEUM = { title: 'SOUND×HANGEUL: Variation of The Korean Alphabet (exhibition)', publisher: 'National Hangeul Museum', url: 'https://www.hangeul.go.kr/exhibition/512', accessed: '2026-10-23' };
const CONSONANT_PRINCIPLE: ShapeSource = { ...MUSEUM, quote: 'While the consonants of Hangeul were modeled on the vocal organs' };
const VOWEL_PRINCIPLE: ShapeSource = { ...MUSEUM, quote: 'the three primary vowels are based on the concept of the "Three Realms" (sky, earth, and humanity)' };
/** The National Hangeul Museum's About Hangeul page, which states the Haerye account of ㄱ and ㅁ in its own words. */
const MUSEUM_HANGEUL = { title: 'About Hangeul: Hunminjeongeum', publisher: 'National Hangeul Museum', url: 'https://www.hangeul.go.kr/lang/en/html/education/Hangeul.do', accessed: '2026-10-29' };
const consonant = (quote: string): ShapeSource[] => [{ ...CONSONANTS, quote }, CONSONANT_PRINCIPLE];
const museumConsonant = (quote: string): ShapeSource[] => [{ ...MUSEUM_HANGEUL, quote }, CONSONANT_PRINCIPLE];
const vowel = (quote: string): ShapeSource[] => [{ ...VOWELS, quote }, VOWEL_PRINCIPLE];

/** Fact id (the origin round's `fact`) to its sources. */
export const SHAPE_FACTS: Readonly<Record<string, readonly ShapeSource[]>> = {
  // ㄱ and ㅁ keep to the Haerye wording (象舌根閉喉之形, 象口形), as the shipped f3 does; the NIKL English page
  // glosses ㄱ in modern terms (the velum) and ㅁ as closed lips, which says more than the Haerye.
  giyeok: museumConsonant('The consonant “ㄱ,” which is a velar sound, reflects the shape of the tongue covering the throat.'),
  nieun: consonant('ㄴ The shape of the tip of tongue touching the alveola'),
  mieum: museumConsonant('The consonant “ㅁ,” which is a labial sound, reflects the shape of the mouth or lips.'),
  siot: consonant('ㅅ The shape of a tooth'),
  ieung: consonant('ㅇ The shape of the throat'),
  eu: vowel("the letter ‘ㅡ’ means the plate shape of the land"),
  i: vowel('the letter ‘ㅣ’ indicates the upright shape of the human'),
  a: vowel("The letter 'ㆍ' symbolizes the round shape of the sky ... If 'ㆍ' is written on the right side of ‘ㅣ’, it becomes ‘ㅏ’"),
};

/** The sources of a fact; none for an unknown id (the content test holds every origin round to one). */
export function sourcesOf(fact: string): readonly ShapeSource[] {
  return Object.prototype.hasOwnProperty.call(SHAPE_FACTS, fact) ? (SHAPE_FACTS[fact] as readonly ShapeSource[]) : [];
}
