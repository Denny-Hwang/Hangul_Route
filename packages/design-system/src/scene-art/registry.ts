/**
 * The scene-art registry (F-STORY-002 §3.9.4): every item a scene may name.
 * PR 2.3a seeded it with Hoya's five poses; PR 2.3b adds the first library
 * batch (3 settings, 13 props) for the flagship stories; PR 2.10a adds the
 * records-joseon cluster batch; PR 2.10b the hangul-printing batch. Later
 * batches (PR 2.10c-d) each add entries here.
 */
import { HOYA_POSES, hoyaItem } from './hoya';
import {
  FORTRESS_GATE,
  FORTRESS_WALL,
  HALL_SECTION,
  JANGGYEONG_HALL,
  MUSEUM_BUILDING,
  NIGHT_WINDOW,
  PANJEON_PLAN,
  SAGO_ARCHIVE,
  TEMPLE_SITE,
} from './props/architecture';
import {
  BANCHADO_STRIP,
  BOOK_BUNDLE,
  BOOK_CHEST_OPEN,
  BOOK_GEOJUNGGI,
  BOOK_OPEN,
  BOOK_OPEN_ENTRY,
  BOOK_THREAD_BOUND,
  BOOKS_AIRING,
  BOOKS_CASE,
  BOOKS_STACK,
  DOCUMENT_BOX,
  UIGWE_OPEN,
} from './props/books';
import { BEAD_CURTAIN, CEREMONY_GOODS, FEAST_TABLE, PALANQUIN, PROCESSION_ROW, SILK_BOLTS } from './props/festival';
import { FLAT_ROCK, FULL_MOON, HORSE, LEAFY_TREE, NIGHT_SKY, PINE_TREE } from './props/nature';
import {
  ARCHIVE_SHELF,
  BLANK_SHEET,
  BLANK_TILES,
  BREEZE,
  CALENDAR_PAGE,
  CRAFT_EMBROIDERY,
  CRAFT_PAINTING,
  CRAFT_WOOD,
  GLOW_BURST,
  MUSEUM_CASE,
  OIL_LAMP,
  SIGNPOST,
  TABLET,
  WEATHER_SIGNS,
} from './props/objects';
import {
  FIG_ARTISAN,
  FIG_CARVER,
  FIG_CHILD,
  FIG_DANCER,
  FIG_GRANDMOTHER,
  FIG_HISTORIAN,
  FIG_KING,
  FIG_KING_SEATED,
  FIG_MODERN,
  FIG_MONK,
  FIG_MONK_SEATED,
  FIG_OFFICIAL,
  FIG_OFFICIALS_KNEELING,
  FIG_RESEARCHER,
  FIG_SCHOLAR,
  FIG_VILLAGER,
  FIG_WORKER,
  FIG_WRITER_SEATED,
} from './props/people';
import {
  DESK_LOW,
  ORGAN_STONES,
  PAPER_STACK,
  PAPERS_LOOSE,
  PRINT_SHEET,
  RIBBON_TRAILS,
  SHEET_CURSIVE,
  SPEECH_G,
  SPEECH_NM,
  STICK_DOT,
  STROKE_SPARKS,
  TYPE_TRAY,
  WOODBLOCK,
  WOODBLOCK_SHELVES,
  WRITING_LINES,
  WRITING_SET,
} from './props/writing';
import type { Registry } from './resolve';
import { COUNTRYSIDE } from './settings/countryside';
import { HANJI_BACKDROP } from './settings/hanji-backdrop';
import { HANOK_ROOM } from './settings/hanok-room';
import { MODERN_ROOM } from './settings/modern-room';
import { MOUNTAIN_STREAM } from './settings/mountain-stream';
import { MOUNTAINS } from './settings/mountains';
import { PALACE_COURTYARD } from './settings/palace-courtyard';
import { PALACE_HALL } from './settings/palace-hall';
import { TEMPLE } from './settings/temple';
import { VILLAGE_LANE } from './settings/village-lane';
import type { ItemDef } from './types';

const LIBRARY: readonly ItemDef[] = [
  PALACE_COURTYARD,
  PALACE_HALL,
  VILLAGE_LANE,
  FIG_KING,
  FIG_OFFICIAL,
  FIG_SCHOLAR,
  FIG_HISTORIAN,
  FIG_VILLAGER,
  FIG_GRANDMOTHER,
  FIG_CHILD,
  DESK_LOW,
  WRITING_SET,
  WRITING_LINES,
  BOOK_THREAD_BOUND,
  BOOKS_CASE,
  DOCUMENT_BOX,
  // PR 2.10a: records-joseon cluster
  HANJI_BACKDROP,
  HANOK_ROOM,
  COUNTRYSIDE,
  MOUNTAINS,
  MOUNTAIN_STREAM,
  MODERN_ROOM,
  FIG_OFFICIALS_KNEELING,
  FIG_KING_SEATED,
  FIG_WRITER_SEATED,
  FIG_ARTISAN,
  FIG_DANCER,
  FIG_MODERN,
  FIG_WORKER,
  FIG_RESEARCHER,
  BOOKS_STACK,
  BOOK_BUNDLE,
  BOOK_CHEST_OPEN,
  BOOKS_AIRING,
  BOOK_OPEN_ENTRY,
  UIGWE_OPEN,
  BOOK_GEOJUNGGI,
  BOOK_OPEN,
  BANCHADO_STRIP,
  PAPER_STACK,
  PAPERS_LOOSE,
  SHEET_CURSIVE,
  PRINT_SHEET,
  TYPE_TRAY,
  HORSE,
  PINE_TREE,
  FLAT_ROCK,
  SAGO_ARCHIVE,
  FORTRESS_GATE,
  FORTRESS_WALL,
  NIGHT_WINDOW,
  OIL_LAMP,
  TABLET,
  WEATHER_SIGNS,
  SIGNPOST,
  ARCHIVE_SHELF,
  CRAFT_WOOD,
  CRAFT_EMBROIDERY,
  CRAFT_PAINTING,
  PALANQUIN,
  PROCESSION_ROW,
  FEAST_TABLE,
  BEAD_CURTAIN,
  SILK_BOLTS,
  CEREMONY_GOODS,
  // PR 2.10b: hangul-printing cluster
  TEMPLE,
  FIG_MONK,
  FIG_MONK_SEATED,
  FIG_CARVER,
  BOOK_OPEN,
  WOODBLOCK,
  WOODBLOCK_SHELVES,
  SPEECH_G,
  SPEECH_NM,
  ORGAN_STONES,
  RIBBON_TRAILS,
  STICK_DOT,
  STROKE_SPARKS,
  JANGGYEONG_HALL,
  PANJEON_PLAN,
  HALL_SECTION,
  TEMPLE_SITE,
  MUSEUM_BUILDING,
  GLOW_BURST,
  FULL_MOON,
  NIGHT_SKY,
  LEAFY_TREE,
  BREEZE,
  MUSEUM_CASE,
  CALENDAR_PAGE,
  BLANK_SHEET,
  BLANK_TILES,
];

export const SCENE_ART_REGISTRY: Registry = Object.freeze({
  ...Object.fromEntries(HOYA_POSES.map((pose) => [`hoya:${pose}`, hoyaItem(pose)])),
  ...Object.fromEntries(LIBRARY.map((item) => [item.id, item])),
});

/** Whether a `setting` or layer `ref` names a registered item. */
export function hasItem(ref: string): boolean {
  return Object.hasOwn(SCENE_ART_REGISTRY, ref);
}
