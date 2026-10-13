import type { StorySetDef } from '../logic/awards/story-cards';

/**
 * The four collections of heritage stories, one per research cluster
 * (F-STORY-006 §3.8 "Set cards"). Hand-written because no story file can hold
 * a cross-story object. A set exists only once all six member stories are in
 * the bundle with a `card` block (`logic/awards/story-cards.ts`); its
 * legendary card arrives when every member card is owned. Set cards make no
 * factual claim (no fact, no citation), and their art is the collection plate
 * of the member cards (D7), so they need no new drawing. A set's theme is
 * the most common theme of its member stories, a tie going to the theme of
 * the first tied member in shelf order (Science, Art and Life: crafts and
 * life have two members each, and the rain gauge comes first); the
 * card-award integrity test checks it against the story files. Titles and
 * Korean words passed the F-STORY-006 PR 6.8 language and culture review
 * (pinned in card-award-integrity.test.ts): the Hangul and Printing set's
 * word names the collection's printing half, printing (inswae), not movable
 * type (hwalja), because two of its printing stories are about woodblocks; the
 * Hangul half is named by the collection title. Treasure (bomul) is the
 * everyday word, not the official Treasure designation tier.
 */
const BLURB = 'Six stories, one collection.';

export const storySetDefs: readonly StorySetDef[] = [
  {
    id: 'set:records-joseon',
    cardId: 'card:set-records-joseon',
    memberStoryIds: [
      'story:sillok-royal-historians',
      'story:sillok-mountain-archives',
      'story:seungjeongwon-ilgi-every-day',
      'story:ilseongnok-daily-reflection',
      'story:uigwe-royal-birthday',
      'story:joseon-records-today',
    ],
    collectionEn: 'Joseon Records',
    titleEn: 'Record',
    headword: { ko: '기록', romanization: 'girok', en: 'record' },
    blurbEn: BLURB,
    theme: 'letters',
    rarity: 'legendary',
  },
  {
    id: 'set:hangul-printing',
    cardId: 'card:set-hangul-printing',
    memberStoryIds: [
      'story:sejong-new-letters',
      'story:shapes-of-hangeul',
      'story:hangeul-day',
      'story:jikji-metal-type',
      'story:tripitaka-koreana',
      'story:janggyeong-panjeon',
    ],
    collectionEn: 'Hangul and Printing',
    titleEn: 'Printing',
    headword: { ko: '인쇄', romanization: 'inswae', en: 'printing' },
    blurbEn: BLURB,
    theme: 'letters',
    rarity: 'legendary',
  },
  {
    id: 'set:science-art-life',
    cardId: 'card:set-science-art-life',
    memberStoryIds: [
      'story:cheugugi-rain-gauge',
      'story:angbuilgu-sundial',
      'story:jagyeongnu-water-clock',
      'story:donguibogam',
      'story:nanjung-ilgi',
      'story:kim-hongdo-genre-paintings',
    ],
    collectionEn: 'Science, Art and Life',
    titleEn: 'Treasure',
    headword: { ko: '보물', romanization: 'bomul', en: 'treasure' },
    blurbEn: BLURB,
    theme: 'crafts',
    rarity: 'legendary',
  },
  {
    id: 'set:seasons-tales',
    cardId: 'card:set-seasons-tales',
    memberStoryIds: [
      'story:seollal-new-year',
      'story:dano-ssireum',
      'story:chuseok-ganggangsullae',
      'story:gimjang-arirang',
      'story:sun-and-moon',
      'story:pansori-tales',
    ],
    collectionEn: 'Seasons and Tales',
    titleEn: 'Arirang',
    headword: { ko: '아리랑', romanization: 'arirang', en: 'Arirang (a folk song)' },
    blurbEn: BLURB,
    theme: 'rites',
    rarity: 'legendary',
  },
];
