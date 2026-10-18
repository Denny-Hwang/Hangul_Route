import {
  CATALOG,
  LectureOptionsSchema,
  chooserGroups,
  storyIsReady,
  type Catalog,
  type ChooserGroup,
  type LectureBlock,
  type LectureDeck,
  type UiLocale,
} from '@hangul-route/content-schema';
import { episodeById, jamoConsonants, jamoVowels, questById } from '../../content';
import { localizeEpisode, localizeQuest, localizeTitle } from '../content-locale';
import { lectureBundle } from './content';
import { expandDeck, type LectureBundle } from './deck-builder';

/**
 * The bundled content behind the presenter's Customize (AMENDMENTS-LECTURE-V2 section 18.3, row
 * LV-3): content-schema's grouped chooser model (`chooserGroups`, shared with the console) over
 * `CATALOG`, with what only the presenter's bundle knows:
 *
 * - **Titles in the presenter language**: episode and lesson titles from the bundle through
 *   their overlays, story and word-topic titles from the catalogue through theirs (F-I18N-001
 *   section 3.6), English where an overlay is missing.
 * - **Stories**: the ready catalogue stories the presenter's story adapter lists (the Library's
 *   review gate), so a chosen story is never skipped as not ready.
 * - **Word topics**: the topics the vocab adapter can show (ready or shipped), each row with the
 *   minutes the start screen will say (rule 12 as amended: word cards by two, plus the meaning
 *   quiz), not the catalogue's flat topic minutes.
 * - **Letters**: the consonant and vowel sets of Stage 1 (their own tab on the presenter).
 * - Lesson rows only for episodes the bundle can expand.
 */

export interface ChooserLabels {
  consonants: string;
  vowels: string;
}

export interface PresenterChooserInput {
  catalog?: Catalog;
  bundle?: LectureBundle;
}

const MINUTES_DECK: Omit<LectureDeck, 'blocks'> = {
  v: 1,
  id: 'lecture:minutes00',
  title: 'Minutes',
  createdAt: '2026-01-01T00:00:00.000Z',
  seed: 1,
  options: LectureOptionsSchema.parse({}),
  picker: null,
  source: 'quick',
};

/** The about-minutes the start screen gives one block (`expandDeck` on a deck of that block alone); 0 when nothing shows. */
export function blockMinutesOn(bundle: LectureBundle, block: LectureBlock): number {
  return expandDeck({ ...MINUTES_DECK, blocks: [block] }, bundle, { canPlayKorean: true }).minutes;
}

/** A content title in the presenter language: the overlay's, else the English; null for an id the bundle and catalogue do not know. */
function lookupTitle(locale: UiLocale, catalog: Catalog): (id: string) => string | null {
  const english = new Map<string, string>([
    ...catalog.cells.map((c) => [c.episodeId, c.title] as const),
    ...catalog.quests.map((q) => [q.id, q.title] as const),
    ...catalog.stories.map((s) => [s.id, s.title] as const),
    ...catalog.topics.map((t) => [`vocab-topic:${t.key}`, t.title] as const),
  ]);
  return (id) => {
    const quest = questById(id);
    if (quest) return localizeQuest(quest, locale).titleEn;
    const episode = episodeById(id);
    if (episode) return localizeEpisode(episode, locale).titleEn;
    const en = english.get(id);
    return en === undefined ? null : localizeTitle({ titleEn: en }, id, locale).titleEn;
  };
}

/** A content title in the presenter language (the chooser's rows; an unknown id shows itself). */
export function titleIn(locale: UiLocale, catalog: Catalog = CATALOG): (id: string) => string {
  const lookup = lookupTitle(locale, catalog);
  return (id) => lookup(id) ?? id;
}

/** A content block's title in the presenter language (the preview's rows); null for a block that is not content. */
export function blockTitleIn(locale: UiLocale, catalog: Catalog = CATALOG): (block: LectureBlock) => string | null {
  const title = lookupTitle(locale, catalog);
  return (block) => {
    switch (block.kind) {
      case 'quest':
      case 'episode':
        return title(block.id);
      case 'story':
        return title(block.storyId);
      case 'vocab':
        return title(block.topicId);
      default:
        return null;
    }
  };
}

/** The presenter's chooser groups in `locale`: Stage 1 to 7, Stories, Word topics (letter sets inside Stage 1). */
export function presenterChooserGroups(locale: UiLocale, labels: ChooserLabels, input: PresenterChooserInput = {}): ChooserGroup[] {
  const catalog = input.catalog ?? CATALOG;
  const bundle = input.bundle ?? lectureBundle(locale);
  const shows = (story: string): boolean => {
    const found = bundle.story?.(story);
    return found !== undefined && found !== 'not-ready';
  };
  const stories = catalog.stories.filter((s) => storyIsReady(s) && shows(s.id)).map((s) => s.id);
  const topics = catalog.topics
    .map((t) => `vocab-topic:${t.key}`)
    .filter((id) => {
      const topic = bundle.vocabTopic?.(id);
      return topic !== undefined && topic !== 'not-ready' && topic.words.length > 0;
    });
  // A cell the bundle cannot expand is not offered (with the shipped bundle, every ready cell is there).
  const expandable = { ...catalog, cells: catalog.cells.filter((c) => bundle.episodeById(c.episodeId) !== undefined) };
  const groups = chooserGroups({
    catalog: expandable,
    title: titleIn(locale, catalog),
    letters: {
      consonants: jamoConsonants.map((j) => j.id),
      vowels: jamoVowels.map((j) => j.id),
      titles: labels,
    },
    stories,
    topics,
  });
  return groups.map((group) =>
    group.id !== 'topics'
      ? group
      : { ...group, rows: group.rows.map((row) => (row.kind === 'topic' ? { ...row, minutes: blockMinutesOn(bundle, { kind: 'vocab', topicId: row.key }) } : row)) },
  );
}
