/**
 * Stage 1 content for the landing page.
 *
 * Sourced from content/episodes/stage-1/cards.json + jamo.json.
 * Mirrored here so the web app's build doesn't reach across the
 * monorepo into `content/`. When `packages/content-schema` grows a
 * loader, this file becomes a thin re-export.
 *
 * The `blurb` values (F-SITE-002 S-6, OD-9: no audience words) and the
 * short `en` glosses are site wording and intentionally differ from the
 * app's cards.json; the ids, titles, Korean, romanization, theme, rarity
 * and unlock must match it (stage1-cards.test.ts checks this).
 *
 * English is the source. In Spanish and Korean the site shows the app's
 * content overlays (content/i18n/{es,ko}/stage1-cards.json, F-I18N-001
 * §3.6): `stage1CardsIn` takes the gloss from the overlay's `title` and the
 * blurb from its `blurb`. It takes the overlays as an argument, so this
 * module never imports them: the server component that renders the cards
 * passes `OVERLAYS` (`@hangul-route/content-schema/overlays`), and no
 * client bundle carries them.
 */
import { localize, type Overlays, type UiLocale } from '@hangul-route/content-schema';

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
  { id: 'card:gangaji', title: 'Puppy', ko: '강아지', romanization: 'gangaji', en: 'Puppy', blurb: 'One of the first words heard in many Korean homes.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:giyeok' },
  { id: 'card:nabi', title: 'Butterfly', ko: '나비', romanization: 'nabi', en: 'Butterfly', blurb: 'A tiny flying flower that flutters through many Korean songs.', theme: 'nature', rarity: 'common', unlockedBy: 'jamo:nieun' },
  { id: 'card:boreumdal', title: 'Full Moon', ko: '보름달', romanization: 'boreumdal', en: 'Full moon', blurb: 'The brightest moon of the year shines on Chuseok.', theme: 'rites', rarity: 'uncommon', unlockedBy: 'jamo:digeut' },
  { id: 'card:ramyeon', title: 'Ramyeon', ko: '라면', romanization: 'ramyeon', en: 'Instant ramen', blurb: 'Steaming noodles in a red-hot bowl. Korea’s most-loved snack.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:rieul' },
  { id: 'card:mugunghwa', title: 'Rose of Sharon', ko: '무궁화', romanization: 'mugunghwa', en: 'Korea’s national flower', blurb: 'A pink-and-white flower that blooms all summer.', theme: 'nature', rarity: 'rare', unlockedBy: 'jamo:mieum' },
  { id: 'card:bap', title: 'Bap', ko: '밥', romanization: 'bap', en: 'Rice / a meal', blurb: '"Did you eat bap?" is how grandparents say hello.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:bieup' },
  { id: 'card:sagwa', title: 'Sagwa', ko: '사과', romanization: 'sagwa', en: 'Apple', blurb: 'Big, red, and crunchy. Korean apples are extra sweet.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:siot' },
  { id: 'card:inhyeong', title: 'Doll', ko: '인형', romanization: 'inhyeong', en: 'Doll', blurb: 'From handmade fabric dolls to K-pop figures.', theme: 'crafts', rarity: 'common', unlockedBy: 'jamo:ieung' },
  { id: 'card:jamjari', title: 'Dragonfly', ko: '잠자리', romanization: 'jamjari', en: 'Dragonfly', blurb: 'Speedy, see-through wings on summer ponds.', theme: 'nature', rarity: 'common', unlockedBy: 'jamo:jieut' },
  { id: 'card:chaek', title: 'Book', ko: '책', romanization: 'chaek', en: 'Book', blurb: 'Korea loves books so much it has Book Festivals every year.', theme: 'letters', rarity: 'common', unlockedBy: 'jamo:chieut' },
  { id: 'card:kpop', title: 'K-pop', ko: '케이팝', romanization: 'keipap', en: 'K-pop music', blurb: 'Big songs, big dances. How the world hears Korean daily.', theme: 'letters', rarity: 'rare', unlockedBy: 'jamo:kieuk' },
  { id: 'card:taegeukgi', title: 'Taegeukgi', ko: '태극기', romanization: 'taegeukgi', en: 'The Korean flag', blurb: 'A red-and-blue swirl with four black symbols.', theme: 'rites', rarity: 'rare', unlockedBy: 'jamo:tieut' },
  { id: 'card:paengi', title: 'Paengi', ko: '팽이', romanization: 'paengi', en: 'Spinning top', blurb: 'Wooden tops spun on the ice in winter.', theme: 'crafts', rarity: 'uncommon', unlockedBy: 'jamo:pieup' },
  { id: 'card:horangi', title: 'Tiger', ko: '호랑이', romanization: 'horangi', en: 'Tiger — like Hoya!', blurb: 'Many of Korea’s old tales start with "Long ago, when tigers smoked tobacco..."', theme: 'letters', rarity: 'legendary', unlockedBy: 'jamo:hieut' },
  { id: 'card:arirang', title: 'Arirang', ko: '아리랑', romanization: 'arirang', en: 'Korea’s most loved folk song', blurb: 'A song about missing home, on UNESCO’s intangible heritage list.', theme: 'rites', rarity: 'rare', unlockedBy: 'jamo:a' },
  { id: 'card:yagu', title: 'Yagu', ko: '야구', romanization: 'yagu', en: 'Baseball', blurb: 'Korea’s loudest sport. Fans bring drums.', theme: 'crafts', rarity: 'common', unlockedBy: 'jamo:ya' },
  { id: 'card:eomuk', title: 'Eomuk', ko: '어묵', romanization: 'eomuk', en: 'Fish cake on a stick', blurb: 'A warm winter street snack served with hot broth.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:eo' },
  { id: 'card:yeou', title: 'Fox', ko: '여우', romanization: 'yeou', en: 'Fox', blurb: 'Clever and a little bit magic in old Korean tales.', theme: 'nature', rarity: 'uncommon', unlockedBy: 'jamo:yeo' },
  { id: 'card:ori', title: 'Ori', ko: '오리', romanization: 'ori', en: 'Duck', blurb: 'Brown ducks waddle around Korean ponds.', theme: 'nature', rarity: 'common', unlockedBy: 'jamo:o' },
  { id: 'card:yong', title: 'Dragon', ko: '용', romanization: 'yong', en: 'Dragon', blurb: 'Korean dragons live in rivers and bring the rain.', theme: 'nature', rarity: 'legendary', unlockedBy: 'jamo:yo' },
  { id: 'card:usan', title: 'Usan', ko: '우산', romanization: 'usan', en: 'Umbrella', blurb: 'Korea’s rainy season lasts about a month. Keep one by the door.', theme: 'life', rarity: 'common', unlockedBy: 'jamo:u' },
  { id: 'card:yutnori', title: 'Yutnori', ko: '윷놀이', romanization: 'yunnori', en: 'Traditional New Year’s board game', blurb: 'Four wooden sticks instead of dice. A Seollal favourite.', theme: 'crafts', rarity: 'rare', unlockedBy: 'jamo:yu' },
  { id: 'card:geune', title: 'Geune', ko: '그네', romanization: 'geune', en: 'Swing', blurb: 'Women in old paintings ride giant swings at the Dano festival.', theme: 'crafts', rarity: 'uncommon', unlockedBy: 'jamo:eu' },
  { id: 'card:ibul', title: 'Ibul', ko: '이불', romanization: 'ibul', en: 'Warm Korean blanket', blurb: 'Many Korean homes spread padded blankets on a warm floor to sleep.', theme: 'rites', rarity: 'common', unlockedBy: 'jamo:i' },
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

/**
 * A card as the site shows it in one UI language: the Korean and romanization never change; `gloss` and `blurb` are
 * in the UI language. `gloss` is null where the overlay's title only repeats the Korean word or its romanization
 * (every Korean title, and Spanish titles such as Bap): the tile then shows the word and its romanization alone,
 * the rule the app's card face follows (a title that is the word itself is not shown twice).
 */
export interface SiteCard {
  id: string;
  ko: string;
  romanization: string;
  gloss: string | null;
  blurb: string;
  rarity: CardRarity;
}

/** Letters only, lower case: "K-pop" and "keipap" stay apart, "Bap" and "bap" match. */
const letters = (text: string): string => text.toLowerCase().replace(/[^\p{L}]/gu, '');

/** True when `title` only repeats the card's Korean word or its romanization. */
export function echoesCard(card: Pick<LandingCard, 'ko' | 'romanization'>, title: string): boolean {
  const t = letters(title);
  return t === letters(card.ko) || t === letters(card.romanization);
}

/** The Stage 1 cards in `locale`: English from this file; es and ko from `overlays` (the app's content overlays). */
export function stage1CardsIn(locale: UiLocale, overlays: Overlays): SiteCard[] {
  return stage1Cards.map((card) => {
    const base = { id: card.id, ko: card.ko, romanization: card.romanization, rarity: card.rarity };
    if (locale === 'en') return { ...base, gloss: card.en, blurb: card.blurb };
    // A field the overlay lacks keeps the English source (localize, §3.13): never a blank, never the key. Without an
    // overlay title the gloss is the site's English gloss, as on the English page.
    const shown = localize({ title: card.title, blurb: card.blurb }, card.id, locale, overlays);
    const gloss = overlays[locale][card.id]?.title === undefined ? card.en : shown.title;
    return { ...base, gloss: echoesCard(card, gloss) ? null : gloss, blurb: shown.blurb };
  });
}
