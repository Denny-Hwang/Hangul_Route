/**
 * Stage 1 content for the landing page.
 *
 * Sourced from content/episodes/stage-1/cards.json + jamo.json.
 * Mirrored here so the web app's build doesn't reach across the
 * monorepo into `content/`. When `packages/content-schema` grows a
 * loader, this file becomes a thin re-export.
 */

export type CardTheme = 'letters' | 'life' | 'rites' | 'nature' | 'crafts';
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface LandingCard {
  id: string;
  title: string;
  ko: string;
  romanization: string;
  en: string;
  blurb: string;
  theme: CardTheme;
  rarity: CardRarity;
  unlockedBy: string;
}

export const stage1Cards: LandingCard[] = [
  { id: 'card:gangaji', title: 'Puppy', ko: '강아지', romanization: 'gang-a-ji', en: 'Puppy', blurb: 'One of the first Korean words children learn at home.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:giyeok' },
  { id: 'card:nabi', title: 'Butterfly', ko: '나비', romanization: 'na-bi', en: 'Butterfly', blurb: 'A tiny flying flower in every Korean kids’ song.', theme: 'nature', rarity: 'common', unlockedBy: 'jamo:nieun' },
  { id: 'card:boreumdal', title: 'Full Moon', ko: '보름달', romanization: 'bo-reum-dal', en: 'Full moon', blurb: 'The brightest moon of the year shines on Chuseok.', theme: 'rites', rarity: 'uncommon', unlockedBy: 'jamo:digeut' },
  { id: 'card:ramyeon', title: 'Ramyeon', ko: '라면', romanization: 'ra-myeon', en: 'Instant ramen', blurb: 'Steaming noodles in a red-hot bowl. Korea’s most-loved snack.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:rieul' },
  { id: 'card:mugunghwa', title: 'Rose of Sharon', ko: '무궁화', romanization: 'mu-gung-hwa', en: 'Korea’s national flower', blurb: 'A pink-and-white flower that blooms all summer.', theme: 'nature', rarity: 'rare', unlockedBy: 'jamo:mieum' },
  { id: 'card:bap', title: 'Bap', ko: '밥', romanization: 'bap', en: 'Rice / a meal', blurb: '"Did you eat bap?" is how grandparents say hello.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:bieup' },
  { id: 'card:sagwa', title: 'Sagwa', ko: '사과', romanization: 'sa-gwa', en: 'Apple', blurb: 'Big, red, and crunchy. Korean apples are extra sweet.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:siot' },
  { id: 'card:inhyeong', title: 'Doll', ko: '인형', romanization: 'in-hyeong', en: 'Doll', blurb: 'From handmade fabric dolls to K-pop figures.', theme: 'crafts', rarity: 'common', unlockedBy: 'jamo:ieung' },
  { id: 'card:jamjari', title: 'Dragonfly', ko: '잠자리', romanization: 'jam-ja-ri', en: 'Dragonfly', blurb: 'Speedy, see-through wings on summer ponds.', theme: 'nature', rarity: 'common', unlockedBy: 'jamo:jieut' },
  { id: 'card:chaek', title: 'Book', ko: '책', romanization: 'chaek', en: 'Book', blurb: 'Korea loves books so much it has Book Festivals every year.', theme: 'letters', rarity: 'common', unlockedBy: 'jamo:chieut' },
  { id: 'card:kpop', title: 'K-pop', ko: '케이팝', romanization: 'K-pop', en: 'K-pop music', blurb: 'Big songs, big dances. How the world hears Korean daily.', theme: 'letters', rarity: 'rare', unlockedBy: 'jamo:kieuk' },
  { id: 'card:taegeukgi', title: 'Taegeukgi', ko: '태극기', romanization: 'tae-geuk-gi', en: 'The Korean flag', blurb: 'A red-and-blue swirl with four black symbols.', theme: 'rites', rarity: 'rare', unlockedBy: 'jamo:tieut' },
  { id: 'card:paengi', title: 'Paengi', ko: '팽이', romanization: 'paeng-i', en: 'Spinning top', blurb: 'Wooden tops that kids spin on icy ground in winter.', theme: 'crafts', rarity: 'uncommon', unlockedBy: 'jamo:pieup' },
  { id: 'card:horangi', title: 'Tiger', ko: '호랑이', romanization: 'ho-rang-i', en: 'Tiger — like Hoya!', blurb: 'Korea’s old tales all start with "Long ago, when tigers smoked tobacco..."', theme: 'letters', rarity: 'legendary', unlockedBy: 'jamo:hieut' },
  { id: 'card:arirang', title: 'Arirang', ko: '아리랑', romanization: 'a-ri-rang', en: 'Korea’s most loved folk song', blurb: 'A song about missing home. UNESCO world heritage.', theme: 'rites', rarity: 'rare', unlockedBy: 'jamo:a' },
  { id: 'card:yagu', title: 'Yagu', ko: '야구', romanization: 'ya-gu', en: 'Baseball', blurb: 'Korea’s loudest sport. Fans bring drums.', theme: 'crafts', rarity: 'common', unlockedBy: 'jamo:ya' },
  { id: 'card:eomuk', title: 'Eomuk', ko: '어묵', romanization: 'eo-muk', en: 'Fish cake on a stick', blurb: 'A warm winter street snack served with hot broth.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:eo' },
  { id: 'card:yeou', title: 'Fox', ko: '여우', romanization: 'yeo-u', en: 'Fox', blurb: 'Clever and a little bit magic in old Korean tales.', theme: 'nature', rarity: 'uncommon', unlockedBy: 'jamo:yeo' },
  { id: 'card:ori', title: 'Ori', ko: '오리', romanization: 'o-ri', en: 'Duck', blurb: 'Brown ducks waddle around Korean ponds.', theme: 'nature', rarity: 'common', unlockedBy: 'jamo:o' },
  { id: 'card:yong', title: 'Dragon', ko: '용', romanization: 'yong', en: 'Sky-flying water spirit', blurb: 'Korean dragons live in rivers and bring the rain.', theme: 'nature', rarity: 'legendary', unlockedBy: 'jamo:yo' },
  { id: 'card:usan', title: 'Usan', ko: '우산', romanization: 'u-san', en: 'Umbrella', blurb: 'Korea’s rainy season lasts a month — every kid has one.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:u' },
  { id: 'card:yutnori', title: 'Yutnori', ko: '윷놀이', romanization: 'yut-no-ri', en: 'Traditional New Year’s board game', blurb: 'Four wooden sticks instead of dice. A Seollal favourite.', theme: 'crafts', rarity: 'rare', unlockedBy: 'jamo:yu' },
  { id: 'card:geune', title: 'Geune', ko: '그네', romanization: 'geu-ne', en: 'Swing', blurb: 'Girls in old paintings ride giant swings on Dano festival.', theme: 'crafts', rarity: 'uncommon', unlockedBy: 'jamo:eu' },
  { id: 'card:ibul', title: 'Ibul', ko: '이불', romanization: 'i-bul', en: 'Warm Korean blanket', blurb: 'Korean kids sleep on the floor under bright padded blankets.', theme: 'rites', rarity: 'common', unlockedBy: 'jamo:i' },
];

export function cardsByRarity(): Record<CardRarity, LandingCard[]> {
  const groups: Record<CardRarity, LandingCard[]> = {
    common: [],
    uncommon: [],
    rare: [],
    legendary: [],
  };
  for (const card of stage1Cards) {
    groups[card.rarity].push(card);
  }
  return groups;
}
