import type { HeritageCard } from '@hangul-route/content-schema';

/**
 * The backs of the upper-cell cards (F-CURR-002 §5.1, §6.6 and §7.2, row CM-23): the blurb, the fact and its source
 * line, the first allowlisted entry of the card's `sources[]` (content/upper-cell-card-sources.ts, with the review
 * record). Only the upper-cards chunk imports this file; the card page merges a back onto its card once the chunk is in
 * (`useUpperCardBack`). The es and ko text is in the card overlays (content/i18n/{es,ko}/stage1-cards.json).
 */
export type UpperCardBack = Pick<HeritageCard, 'blurbEn' | 'factEn' | 'citation'>;

const KHS = '국가유산청 (Korea Heritage Service)';
const NIKL = '국립국어원 (National Institute of Korean Language)';
const back = (blurbEn: string, factEn: string, title: string, publisher: string, more: number): UpperCardBack => ({
  blurbEn,
  factEn,
  citation: { title, publisher, more },
});

export const UPPER_CARD_BACKS: Readonly<Record<string, UpperCardBack>> = {
  'card:norae': back(
    'A song to sing together.',
    "Arirang is a popular Korean folk song. 'Arirang, lyrical folk song in the Republic of Korea' was inscribed on UNESCO's Representative List in 2012.",
    'Arirang, lyrical folk song in the Republic of Korea',
    'UNESCO Intangible Cultural Heritage',
    1,
  ),
  'card:bokjumeoni': back(
    'A little pouch that holds a wish for good luck.',
    'At the start of the year, a bokjumeoni with a few grains inside was tied to clothes as a wish for good luck.',
    '복주머니 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:swing': back(
    'A swing that flies up high.',
    'Swinging is an old custom of Dano, the holiday on the fifth day of the fifth lunar month. Records from the Goryeo and Joseon eras tell of it.',
    '국가무형유산 단오',
    KHS,
    0,
  ),
  'card:hangeul': back(
    'The letters you are learning to read.',
    'King Sejong created 28 letters in 1443 and called them Hunminjeongeum. Today they are called Hangeul.',
    '알고 싶은 한글',
    NIKL,
    1,
  ),
  'card:tteok': back(
    'Soft, chewy rice cake to share.',
    'Making and sharing tteok, rice cake, was designated a National Intangible Heritage of Korea in 2021.',
    '국가무형유산 떡 만들기',
    KHS,
    0,
  ),
  'card:full-moon': back(
    'A big, round moon on a holiday night.',
    'Chuseok falls on the fifteenth day of the eighth lunar month, when the moon is full. That moon stands for plenty.',
    '국가무형유산 추석',
    KHS,
    0,
  ),
  'card:gom': back(
    'A big, strong bear.',
    'The bandalgaseumgom is a black bear with a white half-moon mark on its chest. It sleeps through the winter, and in Korea it is a natural monument.',
    '반달가슴곰 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:yut': back(
    'Four sticks to throw in a game of yunnori.',
    'Yunnori is played with four yut sticks. Two sides throw them, and how the sticks land decides how their pieces move.',
    '국가무형유산 윷놀이',
    KHS,
    0,
  ),
  // Stage 4 (row CM-23 part 2). Greeting Dialogues' album card, `card:insa`, keeps its shipped back.
  'card:mwoyeyo': back(
    'Point at something new and ask what it is.',
    "Ige mwoyeyo uses two short forms: ige for igeosi, 'this thing', and mwo for mueo, 'what'.",
    '이게 (표준국어대사전)',
    NIKL,
    1,
  ),
  'card:masisseoyo': back(
    'What you say when the food tastes good.',
    'The standard Korean pronunciation rules give two ways to say this word: with a d sound in the middle, or with an s sound. Both are correct.',
    '표준어 규정 제2부 표준 발음법 제15항',
    NIKL,
    0,
  ),
  'card:biga-wayo': back(
    'Rain is falling, so it is time to head home.',
    'Jangma is the word for summer weather when rain falls for many days in a row.',
    '장마 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:gachi': back(
    'A polite way to ask someone to join in.',
    'Without yo, gachi halkka is banmal, a way of talking used between people who are very close. It neither raises nor lowers the other person.',
    '반말 (표준국어대사전)',
    NIKL,
    0,
  ),
};

/** A card with its back, when it has one here; the card itself otherwise. */
export function withUpperBack(card: HeritageCard): HeritageCard {
  const b = UPPER_CARD_BACKS[card.id];
  return b ? { ...card, ...b } : card;
}
