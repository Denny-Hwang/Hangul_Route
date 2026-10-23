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
const KNPS = '국립공원공단 (Korea National Park Service)';
const ICH = 'UNESCO Intangible Cultural Heritage';
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
  // Stage 6 (row CM-23 part 3): things read out in the world.
  'card:won': back(
    'Prices on a menu end in won.',
    "The won, with the sign ₩, is South Korea's unit of money. Today's won has been in use since June 10, 1962.",
    '원 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:yeogiyo': back(
    'Call this out to ask a server to come over.',
    'To call a server in a restaurant or a shop, people often say yeogiyo. It does not point to who serves and who is served, so it sits well with both.',
    '호칭을 정해주세요. (온라인가나다)',
    NIKL,
    0,
  ),
  'card:gichapyo': back(
    "A ticket with the train's stations and time on it.",
    'On a holiday, many people travel home to their parents. Yeokgwiseong is the other way round: the parents travel to where their sons and daughters live.',
    '역귀성 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:jeongsang': back(
    'The top of the mountain, where the trail ends.',
    "In Korea's national parks, each trail has set hours to begin the climb, chosen with its distance and walking time in mind.",
    '입산시간지정제',
    KNPS,
    0,
  ),
  'card:deom': back(
    'One more, added for free.',
    'Deom is a little extra that a seller adds for free, on top of what you paid for.',
    '덤 (표준국어대사전)',
    NIKL,
    0,
  ),
  // Stage 7 (row CM-23 part 3): words the cell's word bank writes with.
  'card:ireum': back(
    'A name, written in Hangul letters.',
    "Names from other languages are written with Hangul's own letters, so some sounds share one: f and p share a letter, and so do l and r.",
    '외래어 표기법, 제1장 표기의 원칙',
    NIKL,
    1,
  ),
  'card:achim': back(
    'The start of the day, when the sun comes up.',
    "Put e after a time word to say when: achime means 'in the morning', as in 'I exercise in the morning'.",
    '에 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:saengil': back(
    'A day to share cake with family and friends.',
    'Dol is the word for the day someone turns one, a full year from the day they were born.',
    '돌 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:tokki': back(
    'A rabbit with long ears that hops.',
    'A rabbit has long ears, back legs stronger than its front legs and a short tail. It eats plants.',
    '토끼 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:bihaenggi': back(
    'Fold the paper, then let the plane fly.',
    'Jongijeopgi is folding paper into shapes such as a crane, a boat or a plane.',
    '종이접기 (표준국어대사전)',
    NIKL,
    0,
  ),
  // The legendary card of each album (row CM-23 part 3).
  'card:hunminjeongeum': back(
    'The book that made the new letters known.',
    "The Hunminjeongum Manuscript of 1446 made King Sejong's new letters known. It was inscribed on UNESCO's Memory of the World Register in 1997.",
    'Hunminjeongum Manuscript',
    'UNESCO Memory of the World',
    0,
  ),
  'card:jang': back(
    'Sauces made and kept with care.',
    "Jang are fermented sauces, such as soybean paste and soy sauce. 'Knowledge, beliefs and practices related to jang making in the Republic of Korea' was inscribed by UNESCO in 2024.",
    'Knowledge, beliefs and practices related to jang making in the Republic of Korea',
    ICH,
    0,
  ),
  'card:hangawi': back(
    'Another name for the harvest holiday.',
    'Hangawi is another name for Chuseok, the fifteenth day of the eighth lunar month. Songpyeon are made from the new rice.',
    '한가위 (표준국어대사전)',
    NIKL,
    0,
  ),
  'card:jirisan': back(
    "A big mountain, Korea's first national park.",
    "Jirisan became Korea's first national park in 1967. Korea now has 24 national parks, and 19 of them are mountain parks.",
    '우리나라 국립공원',
    KNPS,
    0,
  ),
  'card:ssireum': back(
    'Two players, two cloth belts, one big push.',
    "'Traditional Korean wrestling (Ssirum/Ssireum)' was inscribed by UNESCO in 2018, on a joint application by the DPR Korea and the Republic of Korea.",
    'Traditional Korean wrestling (Ssirum/Ssireum)',
    ICH,
    1,
  ),
};

/** A card with its back, when it has one here; the card itself otherwise. */
export function withUpperBack(card: HeritageCard): HeritageCard {
  const b = UPPER_CARD_BACKS[card.id];
  return b ? { ...card, ...b } : card;
}
