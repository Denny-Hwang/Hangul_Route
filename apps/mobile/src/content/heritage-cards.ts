import type { HeritageCard, Rarity, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { storyCards } from './story-cards';

const make = (
  id: string,
  titleEn: string,
  ko: string,
  romanization: string,
  blurb: string,
  fact: string,
  theme: ThemeKey,
  stage: StageKey,
  rarity: Rarity,
  unlockedBy: string,
): HeritageCard => ({
  id: `card:${id}`,
  titleEn,
  subtitleKo: ko,
  romanization,
  blurbEn: blurb,
  factEn: fact,
  theme,
  stage,
  rarity,
  illustrationRef: `cards/${id}.svg`,
  unlockedBy,
});

export const stage1Cards: HeritageCard[] = [
  // Letters & Books
  make('book', 'Book', '책', 'chaek', 'A book waiting to be read.', 'Most Korean books today are printed left-to-right, top-to-bottom — the same as English.', 'letters', 'stage1', 'common', 'episode:stage1-letters'),
  make('hanji', 'Hanji Paper', '한지', 'hanji', 'Traditional Korean paper, soft and strong.', 'Hanji is made from mulberry bark and can last over 1,000 years.', 'letters', 'stage1', 'uncommon', 'episode:stage1-letters'),
  make('brush', 'Calligraphy Brush', '붓', 'but', 'A brush that writes the most beautiful letters.', 'Korean calligraphy is called seoye (서예).', 'letters', 'stage1', 'uncommon', 'episode:stage1-letters'),
  make('ink', 'Ink Stick', '먹', 'meok', 'Black ink for writing big, bold letters.', 'You grind a meok stick with water to make ink — fresh every day.', 'letters', 'stage1', 'common', 'episode:stage1-letters'),
  make('origami', 'Paper Folding', '종이접기', 'jongijeopgi', 'Paper folded into magical shapes.', 'A paper crane is called jongihak.', 'letters', 'stage1', 'rare', 'episode:stage1-letters'),
  make('hangul-day', 'Hangul Day', '한글날', 'hangeullal', 'October 9 — the birthday of Korean letters.', 'King Sejong invented Hangul in 1443 so everyone could read.', 'letters', 'stage1', 'legendary', 'stage1-complete'),

  // Food & Daily Life
  make('kimchi', 'Kimchi', '김치', 'gimchi', 'Spicy red cabbage — Korea on a plate.', 'There are over 200 kinds of kimchi.', 'life', 'stage1', 'common', 'episode:stage1-life'),
  make('rice', 'Rice', '밥', 'bap', 'A bowl of warm rice — every meal starts here.', '"Have you eaten rice?" is how friends say hello.', 'life', 'stage1', 'common', 'episode:stage1-life'),
  make('chopsticks', 'Chopsticks', '젓가락', 'jeotgarak', 'Slim metal chopsticks — try them with kimbap.', 'Korean chopsticks are usually flat metal, not round wood.', 'life', 'stage1', 'common', 'episode:stage1-life'),
  make('hanbok', 'Hanbok', '한복', 'hanbok', 'A beautiful traditional outfit.', 'You wear hanbok on Seollal and Chuseok.', 'life', 'stage1', 'rare', 'episode:stage1-life'),
  make('kimbap', 'Kimbap', '김밥', 'gimbap', 'Rice and veggies rolled in seaweed.', 'Kimbap means "seaweed-rice" — perfect for picnics.', 'life', 'stage1', 'uncommon', 'episode:stage1-life'),
  make('family-table', 'Family Table', '가족 식탁', 'gajok siktak', 'Where everyone gathers to eat.', 'Koreans share many small side dishes called banchan.', 'life', 'stage1', 'uncommon', 'episode:stage1-life'),

  // Holidays & Traditions
  make('seollal', 'Lunar New Year', '설날', 'seollal', 'The new year — bows, hanbok, tteokguk.', 'People bow to their elders, and the elders often give sebaetdon (lucky money).', 'rites', 'stage1', 'rare', 'episode:stage1-rites'),
  make('chuseok', 'Harvest Festival', '추석', 'chuseok', 'A harvest moon and a family feast.', 'Families share songpyeon — half-moon rice cakes.', 'rites', 'stage1', 'rare', 'episode:stage1-rites'),
  make('tteokguk', 'Rice Cake Soup', '떡국', 'tteokguk', 'On New Year, eat tteokguk to grow one year older.', 'Sliced rice cakes look like coins for good luck.', 'rites', 'stage1', 'uncommon', 'episode:stage1-rites'),
  make('songpyeon', 'Songpyeon', '송편', 'songpyeon', 'Half-moon rice cakes filled with sweet fillings.', 'They are steamed on pine needles for fragrance.', 'rites', 'stage1', 'uncommon', 'episode:stage1-rites'),
  make('sebae', 'New Year Bow', '세배', 'sebae', 'A polite bow to grandparents.', 'After the bow, you receive sebaetdon — lucky money.', 'rites', 'stage1', 'common', 'episode:stage1-rites'),
  make('lantern', 'Paper Lantern', '연등', 'yeondeung', 'A glowing paper lantern at festivals.', 'Yeondeunghoe is a UNESCO-listed lantern festival.', 'rites', 'stage1', 'legendary', 'stage1-complete'),

  // Nature & Animals
  make('tiger', 'Tiger', '호랑이', 'horangi', 'The proud Korean tiger — Hoya is one!', 'Tigers appear in many Korean folk tales.', 'nature', 'stage1', 'legendary', 'first-launch'),
  make('magpie', 'Magpie', '까치', 'kkachi', 'A black-and-white bird that brings good news.', 'Hearing a magpie in the morning means visitors are coming.', 'nature', 'stage1', 'uncommon', 'episode:stage1-nature'),
  make('mugunghwa', 'Rose of Sharon', '무궁화', 'mugunghwa', 'Korea\'s national flower — it blooms all summer.', 'Mugunghwa means "eternal flower".', 'nature', 'stage1', 'rare', 'episode:stage1-nature'),
  make('mountain', 'Mountain', '산', 'san', 'Korea is full of green mountains.', 'About 70% of Korean land is mountainous.', 'nature', 'stage1', 'common', 'episode:stage1-nature'),
  make('sea', 'Sea', '바다', 'bada', 'The blue sea on three sides of Korea.', 'Korea has the East, West, and South seas.', 'nature', 'stage1', 'common', 'episode:stage1-nature'),
  make('moon', 'Moon', '달', 'dal', 'A glowing moon over mountains.', 'A Korean folk tale says a rabbit lives in the moon.', 'nature', 'stage1', 'uncommon', 'episode:stage1-nature'),

  // Play & Crafts
  make('yutnori', 'Yut Game', '윷놀이', 'yunnori', 'Throw the four sticks — yut!', 'Yunnori, also written yutnori, is played on New Year\'s Day.', 'crafts', 'stage1', 'rare', 'episode:stage1-crafts'),
  make('jegi', 'Foot Shuttlecock', '제기', 'jegi', 'Kick the feathered weight as many times as you can.', 'Jegichagi is a winter playground favorite.', 'crafts', 'stage1', 'uncommon', 'episode:stage1-crafts'),
  make('kite', 'Kite', '연', 'yeon', 'A diamond kite painted with a tiger\'s face.', 'Bangpaeyeon — shield kite — has a hole in the middle for steering.', 'crafts', 'stage1', 'uncommon', 'episode:stage1-crafts'),
  make('top', 'Spinning Top', '팽이', 'paengi', 'A wooden top that spins on ice.', 'Spinning tops on frozen ponds is a winter tradition.', 'crafts', 'stage1', 'common', 'episode:stage1-crafts'),
  make('pottery', 'Celadon Pottery', '청자', 'cheongja', 'A jade-green Korean pot, 1000 years old.', 'Goryeo cheongja is famous worldwide for its color.', 'crafts', 'stage1', 'rare', 'episode:stage1-crafts'),
  make('gayageum', 'Gayageum Zither', '가야금', 'gayageum', 'A 12-string Korean zither — soft as rain.', 'The gayageum is over 1,400 years old.', 'crafts', 'stage1', 'legendary', 'stage1-complete'),
];

export const stage2Cards: HeritageCard[] = [
  // Stage 2 / Food & Daily Life — Lunch Box Words
  make('sagwa', 'Apple', '사과', 'sagwa', 'A sweet red apple for your lunch box.', 'Korea grows famous apples in Daegu.', 'life', 'stage2', 'common', 'episode:stage2-life'),
  make('uyu', 'Milk', '우유', 'uyu', 'A cold glass of milk to drink.', 'Banana-flavored milk is a Korean favorite.', 'life', 'stage2', 'common', 'episode:stage2-life'),
  make('ppang', 'Bread', '빵', 'ppang', 'Soft bread fresh from the bakery.', 'The word ppang comes from Portuguese "pão".', 'life', 'stage2', 'uncommon', 'episode:stage2-life'),
  make('dosirak', 'Lunch Box', '도시락', 'dosirak', 'A packed lunch box to share with friends.', 'Shaking a dosirak to mix it is a fun Korean tradition.', 'life', 'stage2', 'rare', 'episode:stage2-life'),

  // Stage 2 / Nature & Animals — Outdoor Words
  make('haneul', 'Sky', '하늘', 'haneul', 'The wide blue sky above.', 'Haneul also means "heaven" in old Korean songs.', 'nature', 'stage2', 'common', 'episode:stage2-nature'),
  make('kkot', 'Flower', '꽃', 'kkot', 'A bright flower in the field.', 'Korea celebrates cherry blossoms — beotkkot — every spring.', 'nature', 'stage2', 'common', 'episode:stage2-nature'),
  make('namu', 'Tree', '나무', 'namu', 'A tall green tree.', 'Korea\'s oldest tree, a ginkgo, is over 1,000 years old.', 'nature', 'stage2', 'uncommon', 'episode:stage2-nature'),
  make('byeol', 'Star', '별', 'byeol', 'A twinkling star at night.', 'Long ago, Koreans prayed to the Big Dipper (Chilseong) for a long life.', 'nature', 'stage2', 'rare', 'episode:stage2-nature'),
];

export const stage4Cards: HeritageCard[] = [
  // Stage 4 / Holidays & Traditions — Greeting Dialogues
  make('annyeong', 'Hello', '안녕', 'annyeong', 'A friendly hello.', 'Annyeong means both "hi" and "bye" between friends.', 'rites', 'stage4', 'common', 'episode:stage4-rites'),
  make('gamsa', 'Thank You', '감사', 'gamsa', 'A polite thank you.', 'Gamsahamnida is the full, polite form.', 'rites', 'stage4', 'common', 'episode:stage4-rites'),
  make('chingu', 'Friend', '친구', 'chingu', 'A good friend to greet.', 'Close friends of the same age are called chingu.', 'rites', 'stage4', 'uncommon', 'episode:stage4-rites'),
  make('insa', 'Greeting', '인사', 'insa', 'A bow or a hello — a greeting.', 'A small bow is a polite Korean greeting.', 'rites', 'stage4', 'rare', 'episode:stage4-rites'),
];

/**
 * An upper-cell card's front (F-CURR-002 §7.2, row CM-23): the rare card of a Stage 2-7 cell, earned by finishing the
 * cell's first volume. Its back (blurb, fact and source line) is in the upper-cards chunk (`content/upper-card-backs.ts`),
 * which the card page loads, so the start bundle carries only what the Library, Results and the catch-up show.
 */
// The romanization is the id when the two are spelled alike (row CM-23 part 2: the shorter call keeps the start bundle
// under its line); either way it is the F-CNT-002 converter's (content/__tests__/upper-cell-cards.test.ts).
const upper = (id: string, titleEn: string, ko: string, theme: ThemeKey, stage: StageKey, romanization: string = id): HeritageCard => ({
  id: `card:${id}`,
  titleEn,
  subtitleKo: ko,
  romanization,
  // Empty until the back is merged in; the es and ko overlays land on these fields.
  blurbEn: '',
  factEn: '',
  theme,
  stage,
  rarity: 'rare',
  unlockedBy: `episode:${stage}-${theme}`,
});

/** The five albums in the Journey's theme order (row CM-23 part 3): each stage row of cards and the legendary cards follow it. */
export const ALBUM_ORDER: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];

/**
 * One stage's upper-cell cards in theme order, `[id, titleEn, ko, romanization?]` per cell; `0` for a taste cell whose
 * album card is its shipped q1 card (row CM-23 part 3: a row per stage keeps the start bundle under its line).
 */
const row = (stage: StageKey, cards: readonly (readonly [string, string, string, string?] | 0)[]): HeritageCard[] =>
  cards.flatMap((c, i) => (c ? [upper(c[0], c[1], c[2], ALBUM_ORDER[i]!, stage, c[3])] : []));

/**
 * The upper-cell cards of Stages 2 to 7 (row CM-23 parts 1 to 3): one per upper cell. Lunch Box Words, Outdoor Words and
 * Greeting Dialogues keep their shipped four cards (F-CURR-001 "Cards"); their album card is their q1 card
 * (`content/upper-cell-cards.ts`), so these twenty-two are the other cells'. Gated on `upperCards` (logic/awards/upper-cards.ts).
 */
export const upperCellCards: HeritageCard[] = [
  ...row('stage2', [['norae', 'Song', '노래'], 0, ['bokjumeoni', 'Lucky Pouch', '복주머니'], 0, ['swing', 'Swing', '그네', 'geune']]),
  ...row('stage3', [
    ['hangeul', 'Hangeul', '한글'],
    ['tteok', 'Rice Cake', '떡'],
    ['full-moon', 'Full Moon', '보름달', 'boreumdal'],
    ['gom', 'Bear', '곰'],
    ['yut', 'Yut Sticks', '윷'],
  ]),
  // Stage 4 (row CM-23 part 2): a polite line of each cell's talk. Greeting Dialogues keeps its four shipped cards; its
  // album card is its q1 card, `card:insa` (content/upper-cell-cards.ts).
  ...row('stage4', [
    ['mwoyeyo', 'What Is This?', '이게 뭐예요?', 'ige mwoyeyo'],
    ['masisseoyo', 'It Is Tasty', '맛있어요'],
    0,
    ['biga-wayo', 'It Is Raining', '비가 와요', 'biga wayo'],
    ['gachi', 'Do It Together?', '같이 할까요?', 'gachi halkkayo'],
  ]),
  // Stages 6 and 7 (row CM-23 part 3): every cell gives a new card. Stage 6 cards are things read out in the world (a
  // price, a call to the server, a ticket, a trail sign, a market extra); Stage 7 cards are words the cell's word bank
  // writes with.
  ...row('stage6', [
    ['won', 'Won', '원'],
    ['yeogiyo', 'Over Here!', '여기요'],
    ['gichapyo', 'Train Ticket', '기차표'],
    ['jeongsang', 'Summit', '정상'],
    ['deom', 'A Little Extra', '덤'],
  ]),
  ...row('stage7', [
    ['ireum', 'Name', '이름'],
    ['achim', 'Morning', '아침'],
    ['saengil', 'Birthday', '생일'],
    ['tokki', 'Rabbit', '토끼'],
    ['bihaenggi', 'Plane', '비행기'],
  ]),
];

/**
 * The legendary card of each category album (F-CURR-002 §7.2, row CM-23c), in album order: it arrives once the learner
 * holds every card of its album (`set:album-<theme>`, the set rule; content/award-world.ts builds the sets). Never
 * random, never sold. Their backs are in the upper-cards chunk, like the album cards'.
 */
export const albumLegendCards: HeritageCard[] = (
  [
    ['hunminjeongeum', 'Hangul Book', '훈민정음'],
    ['jang', 'Jang Making', '장 담그기', 'jang damgeugi'],
    ['hangawi', 'Hangawi', '한가위'],
    ['jirisan', 'Jirisan', '지리산'],
    ['ssireum', 'Ssireum', '씨름'],
  ] as const
).map(([id, titleEn, ko, romanization], i): HeritageCard => {
  const theme = ALBUM_ORDER[i]!;
  return { ...upper(id, titleEn, ko, theme, 'stage7', romanization), rarity: 'legendary', unlockedBy: `set:album-${theme}` };
});

/** The cards row CM-23 adds: awarded, listed and drawn only while `upperCards` is on (held ones always stay). */
export const UPPER_CARD_GATED_IDS: ReadonlySet<string> = new Set([...upperCellCards, ...albumLegendCards].map((c) => c.id));

/** The hand-written cards, then the heritage story cards and their collection cards (F-STORY-006 §3.8). */
export const heritageCardsAll: HeritageCard[] = [...stage1Cards, ...stage2Cards, ...stage4Cards, ...upperCellCards, ...albumLegendCards, ...storyCards];

export function cardById(id: string): HeritageCard | undefined {
  return heritageCardsAll.find((c) => c.id === id);
}

export function cardsByTheme(theme: ThemeKey, stage: StageKey): HeritageCard[] {
  return heritageCardsAll.filter((c) => c.theme === theme && c.stage === stage);
}
