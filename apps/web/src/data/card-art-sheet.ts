/**
 * The 60 heritage cards whose art the design system draws, for the card-art
 * contact sheet at /design-preview/cards (AMENDMENTS-PICTURES-2026-11, row
 * PX-0): the 30 Stage 1 cards by theme (`HeritageCardArt`), then the 25
 * upper-cell album cards and the five legendary cards (`UpperCellCardArt`).
 *
 * The ids and English titles mirror the app's cards
 * (apps/mobile/src/content/heritage-cards.ts), because the web build does not
 * reach into the app; `card-art-sheet.test.tsx` pins the ids to the design
 * system's lists and every title to the app's source. Stage 1 rows keep the
 * Korean word with its romanization, as the page showed before; the sheet's
 * job is the picture, so the upper cards carry the id and title only.
 */
export interface SheetCard {
  id: string;
  title: string;
  ko?: string;
  romanization?: string;
}

export interface SheetCardGroup {
  group: string;
  /** Which component draws the group. */
  art: 'stage1' | 'upper';
  cards: SheetCard[];
}

const upper = (rows: ReadonlyArray<readonly [string, string]>): SheetCard[] => rows.map(([id, title]) => ({ id: `card:${id}`, title }));

export const CARD_ART_SHEET: readonly SheetCardGroup[] = [
  {
    group: 'Stage 1 · Letters & Books',
    art: 'stage1',
    cards: [
      { id: 'card:book', ko: '책', romanization: 'chaek', title: 'Book' },
      { id: 'card:hanji', ko: '한지', romanization: 'hanji', title: 'Hanji Paper' },
      { id: 'card:brush', ko: '붓', romanization: 'but', title: 'Calligraphy Brush' },
      { id: 'card:ink', ko: '먹', romanization: 'meok', title: 'Ink Stick' },
      { id: 'card:origami', ko: '종이접기', romanization: 'jongijeopgi', title: 'Paper Folding' },
      { id: 'card:hangul-day', ko: '한글날', romanization: 'hangeullal', title: 'Hangul Day' },
    ],
  },
  {
    group: 'Stage 1 · Food & Daily Life',
    art: 'stage1',
    cards: [
      { id: 'card:kimchi', ko: '김치', romanization: 'gimchi', title: 'Kimchi' },
      { id: 'card:rice', ko: '밥', romanization: 'bap', title: 'Rice' },
      { id: 'card:chopsticks', ko: '젓가락', romanization: 'jeotgarak', title: 'Chopsticks' },
      { id: 'card:hanbok', ko: '한복', romanization: 'hanbok', title: 'Hanbok' },
      { id: 'card:kimbap', ko: '김밥', romanization: 'gimbap', title: 'Kimbap' },
      { id: 'card:family-table', ko: '가족 식탁', romanization: 'gajok siktak', title: 'Family Table' },
    ],
  },
  {
    group: 'Stage 1 · Holidays & Traditions',
    art: 'stage1',
    cards: [
      { id: 'card:seollal', ko: '설날', romanization: 'seollal', title: 'Lunar New Year' },
      { id: 'card:chuseok', ko: '추석', romanization: 'chuseok', title: 'Harvest Festival' },
      { id: 'card:tteokguk', ko: '떡국', romanization: 'tteokguk', title: 'Rice Cake Soup' },
      { id: 'card:songpyeon', ko: '송편', romanization: 'songpyeon', title: 'Songpyeon' },
      { id: 'card:sebae', ko: '세배', romanization: 'sebae', title: 'New Year Bow' },
      { id: 'card:lantern', ko: '연등', romanization: 'yeondeung', title: 'Paper Lantern' },
    ],
  },
  {
    group: 'Stage 1 · Nature & Animals',
    art: 'stage1',
    cards: [
      { id: 'card:tiger', ko: '호랑이', romanization: 'horangi', title: 'Tiger' },
      { id: 'card:magpie', ko: '까치', romanization: 'kkachi', title: 'Magpie' },
      { id: 'card:mugunghwa', ko: '무궁화', romanization: 'mugunghwa', title: 'Rose of Sharon' },
      { id: 'card:mountain', ko: '산', romanization: 'san', title: 'Mountain' },
      { id: 'card:sea', ko: '바다', romanization: 'bada', title: 'Sea' },
      { id: 'card:moon', ko: '달', romanization: 'dal', title: 'Moon' },
    ],
  },
  {
    group: 'Stage 1 · Play & Crafts',
    art: 'stage1',
    cards: [
      { id: 'card:yutnori', ko: '윷놀이', romanization: 'yunnori', title: 'Yut Game' },
      { id: 'card:jegi', ko: '제기', romanization: 'jegi', title: 'Foot Shuttlecock' },
      { id: 'card:kite', ko: '연', romanization: 'yeon', title: 'Kite' },
      { id: 'card:top', ko: '팽이', romanization: 'paengi', title: 'Spinning Top' },
      { id: 'card:pottery', ko: '청자', romanization: 'cheongja', title: 'Celadon Pottery' },
      { id: 'card:gayageum', ko: '가야금', romanization: 'gayageum', title: 'Gayageum Zither' },
    ],
  },
  {
    group: 'Stage 2 album cards',
    art: 'upper',
    cards: upper([
      ['norae', 'Song'],
      ['dosirak', 'Lunch Box'],
      ['bokjumeoni', 'Lucky Pouch'],
      ['byeol', 'Star'],
      ['swing', 'Swing'],
    ]),
  },
  {
    group: 'Stage 3 album cards',
    art: 'upper',
    cards: upper([
      ['hangeul', 'Hangeul'],
      ['tteok', 'Rice Cake'],
      ['full-moon', 'Full Moon'],
      ['gom', 'Bear'],
      ['yut', 'Yut Sticks'],
    ]),
  },
  {
    group: 'Stage 4 album cards',
    art: 'upper',
    cards: upper([
      ['mwoyeyo', 'What Is This?'],
      ['masisseoyo', 'It Is Tasty'],
      ['insa', 'Greeting'],
      ['biga-wayo', 'It Is Raining'],
      ['gachi', 'Do It Together?'],
    ]),
  },
  {
    group: 'Stage 6 album cards',
    art: 'upper',
    cards: upper([
      ['won', 'Won'],
      ['yeogiyo', 'Over Here!'],
      ['gichapyo', 'Train Ticket'],
      ['jeongsang', 'Summit'],
      ['deom', 'A Little Extra'],
    ]),
  },
  {
    group: 'Stage 7 album cards',
    art: 'upper',
    cards: upper([
      ['ireum', 'Name'],
      ['achim', 'Morning'],
      ['saengil', 'Birthday'],
      ['tokki', 'Rabbit'],
      ['bihaenggi', 'Plane'],
    ]),
  },
  {
    group: 'Legendary album cards',
    art: 'upper',
    cards: upper([
      ['hunminjeongeum', 'Hangul Book'],
      ['jang', 'Jang Making'],
      ['hangawi', 'Hangawi'],
      ['jirisan', 'Jirisan'],
      ['ssireum', 'Ssireum'],
    ]),
  },
];

/** The sizes the sheet draws each card at: the full art, and the two a question shows (64 and 54 px). */
export const CARD_ART_SIZES = [200, 64, 54] as const;
