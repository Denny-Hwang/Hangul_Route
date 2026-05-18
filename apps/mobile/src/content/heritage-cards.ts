import type { HeritageCard, Rarity, StageKey, ThemeKey } from '@hangul-route/content-schema';

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
  make('book', 'Book', '책', 'chaek', 'A book waiting to be read.', 'Korean kids first learn to read books printed left-to-right, top-to-bottom — same as English.', 'letters', 'stage1', 'common', 'episode:stage1-letters'),
  make('hanji', 'Hanji Paper', '한지', 'hanji', 'Traditional Korean paper, soft and strong.', 'Hanji is made from mulberry bark and can last over 1,000 years.', 'letters', 'stage1', 'uncommon', 'episode:stage1-letters'),
  make('brush', 'Calligraphy Brush', '붓', 'but', 'A brush that writes the most beautiful letters.', 'Korean calligraphy is called seoye (서예).', 'letters', 'stage1', 'uncommon', 'episode:stage1-letters'),
  make('ink', 'Ink Stick', '먹', 'meok', 'Black ink for writing big, bold letters.', 'You grind a meok stick with water to make ink — fresh every day.', 'letters', 'stage1', 'common', 'episode:stage1-letters'),
  make('origami', 'Paper Folding', '종이접기', 'jong-i-jeop-gi', 'Paper folded into magical shapes.', 'A paper crane is called jong-i-hak.', 'letters', 'stage1', 'rare', 'episode:stage1-letters'),
  make('hangul-day', 'Hangul Day', '한글날', 'hangeul-nal', 'October 9 — the birthday of Korean letters.', 'King Sejong invented Hangul in 1443 so everyone could read.', 'letters', 'stage1', 'legendary', 'stage1-complete'),

  // Food & Daily Life
  make('kimchi', 'Kimchi', '김치', 'gimchi', 'Spicy red cabbage — Korea on a plate.', 'There are over 200 kinds of kimchi.', 'life', 'stage1', 'common', 'episode:stage1-life'),
  make('rice', 'Rice', '밥', 'bap', 'A bowl of warm rice — every meal starts here.', '"Have you eaten rice?" is how friends say hello.', 'life', 'stage1', 'common', 'episode:stage1-life'),
  make('chopsticks', 'Chopsticks', '젓가락', 'jeotgarak', 'Slim metal chopsticks — try them with kimbap.', 'Korean chopsticks are usually flat metal, not round wood.', 'life', 'stage1', 'common', 'episode:stage1-life'),
  make('hanbok', 'Hanbok', '한복', 'hanbok', 'A beautiful traditional outfit.', 'You wear hanbok on Seollal and Chuseok.', 'life', 'stage1', 'rare', 'episode:stage1-life'),
  make('kimbap', 'Kimbap', '김밥', 'gimbap', 'Rice and veggies rolled in seaweed.', 'Kimbap means "seaweed-rice" — perfect for picnics.', 'life', 'stage1', 'uncommon', 'episode:stage1-life'),
  make('family-table', 'Family Table', '가족식탁', 'gajok-siktak', 'Where everyone gathers to eat.', 'Koreans share many small side dishes called banchan.', 'life', 'stage1', 'uncommon', 'episode:stage1-life'),

  // Holidays & Traditions
  make('seollal', 'Lunar New Year', '설날', 'seollal', 'The new year — bows, hanbok, tteokguk.', 'Children bow and receive sebaetdon (lucky money).', 'rites', 'stage1', 'rare', 'episode:stage1-rites'),
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
  make('yutnori', 'Yut Game', '윷놀이', 'yutnori', 'Throw the four sticks — yut!', 'Yutnori is played on New Year\'s Day.', 'crafts', 'stage1', 'rare', 'episode:stage1-crafts'),
  make('jegi', 'Foot Shuttlecock', '제기', 'jegi', 'Kick the feathered weight as many times as you can.', 'Jegichagi is a winter playground favorite.', 'crafts', 'stage1', 'uncommon', 'episode:stage1-crafts'),
  make('kite', 'Kite', '연', 'yeon', 'A diamond kite painted with a tiger\'s face.', 'Bangpaeyeon — shield kite — has a hole in the middle for steering.', 'crafts', 'stage1', 'uncommon', 'episode:stage1-crafts'),
  make('top', 'Spinning Top', '팽이', 'paengi', 'A wooden top that spins on ice.', 'Spinning tops on frozen ponds is a winter tradition.', 'crafts', 'stage1', 'common', 'episode:stage1-crafts'),
  make('pottery', 'Celadon Pottery', '청자', 'cheongja', 'A jade-green Korean pot, 1000 years old.', 'Goryeo cheongja is famous worldwide for its color.', 'crafts', 'stage1', 'rare', 'episode:stage1-crafts'),
  make('gayageum', 'Gayageum Zither', '가야금', 'gayageum', 'A 12-string Korean zither — soft as rain.', 'The gayageum is over 1,400 years old.', 'crafts', 'stage1', 'legendary', 'stage1-complete'),
];

export const heritageCardsAll: HeritageCard[] = [...stage1Cards];

export function cardById(id: string): HeritageCard | undefined {
  return heritageCardsAll.find((c) => c.id === id);
}

export function cardsByTheme(theme: ThemeKey, stage: StageKey): HeritageCard[] {
  return heritageCardsAll.filter((c) => c.theme === theme && c.stage === stage);
}
