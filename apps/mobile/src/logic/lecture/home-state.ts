import { LECTURE_PRESETS, PRESET_LENGTHS, StageKeySchema, type LecturePreset, type PresetMinutes, type StageKey } from '@hangul-route/content-schema';

/**
 * The presenter home's state that Back keeps (AMENDMENTS-LECTURE-V2 section 18.2, row LV-3):
 * coming back from the start screen, the home shows the open preset card, its length and stage
 * chips, the Customize disclosure, the chooser's tab, choices and open episodes, how many stories
 * and topics were shown, and the scroll position as they were. It lives in the tab's memory and
 * in the home history entry's state, so a reload or a back onto the home finds it too.
 *
 * Only ids and chip values: content ids that match their grammar, preset ids, stage keys, lengths
 * and numbers. Nothing here can hold a name, and a damaged state reads as the default. Nothing is
 * written to storage.
 */

export type ChooserTab = 'lessons' | 'stories' | 'topics' | 'letters';
export const CHOOSER_TABS: readonly ChooserTab[] = ['lessons', 'stories', 'topics', 'letters'];

/** Stories and word topics show 8 rows, then 8 more at a time (section 18.3). */
export const CHOOSER_PAGE = 8;

export interface HomeSnapshot {
  /** The open preset card (one at a time). */
  open: LecturePreset | null;
  /** The length chip of each preset the teacher changed (the others keep their default). */
  lengths: Partial<Record<LecturePreset, PresetMinutes>>;
  /** Stage by stage's stage chip. */
  stage: StageKey;
  /** The Customize disclosure. */
  customize: boolean;
  tab: ChooserTab;
  /** The Lessons tab's stage chip; null: the stage of the open preset's first lesson, else Stage 1. */
  chooserStage: StageKey | null;
  /** The chooser's choices, in the order chosen (content ids and letter-set keys). */
  chosen: string[];
  /** Episode rows whose lessons are open. */
  expanded: string[];
  /** How many story and topic rows are shown. */
  more: { stories: number; topics: number };
  /** The page's scroll position, in pixels. */
  scrollY: number;
}

export const HOME_DEFAULT: HomeSnapshot = {
  open: null,
  lengths: {},
  stage: 'stage1',
  customize: false,
  tab: 'lessons',
  chooserStage: null,
  chosen: [],
  expanded: [],
  more: { stories: CHOOSER_PAGE, topics: CHOOSER_PAGE },
  scrollY: 0,
};

/** A chooser key: a content id or a letter set (the `lesson-chooser` keys); nothing else is kept. */
export const CHOOSER_KEY_RE = /^(episode:stage[1-7]-[a-z]+|(quest|story|vocab-topic):[a-z0-9]+(-[a-z0-9]+)*|letters:(consonants|vowels))$/;
const KEY_MAX = 64;
/** More than a deck can hold, so a full selection always fits. */
const KEYS_MAX = 120;
const MORE_MAX = 999;
const SCROLL_MAX = 1_000_000;

const isPreset = (v: unknown): v is LecturePreset => typeof v === 'string' && (LECTURE_PRESETS as readonly string[]).includes(v);
const isStage = (v: unknown): v is StageKey => StageKeySchema.safeParse(v).success;
const isTab = (v: unknown): v is ChooserTab => typeof v === 'string' && (CHOOSER_TABS as readonly string[]).includes(v);

function keys(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const k of v) {
    if (typeof k === 'string' && k.length <= KEY_MAX && CHOOSER_KEY_RE.test(k) && !out.includes(k)) out.push(k);
    if (out.length >= KEYS_MAX) break;
  }
  return out;
}

function count(v: unknown, fallback: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : fallback;
}

/** A stored snapshot read back: every field checked on its own, a bad field takes its default; null when it is not an object. */
export function parseHomeSnapshot(raw: unknown): HomeSnapshot | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const lengths: Partial<Record<LecturePreset, PresetMinutes>> = {};
  if (typeof r.lengths === 'object' && r.lengths !== null && !Array.isArray(r.lengths)) {
    for (const [preset, minutes] of Object.entries(r.lengths as Record<string, unknown>)) {
      if (isPreset(preset) && (PRESET_LENGTHS[preset] as readonly unknown[]).includes(minutes)) lengths[preset] = minutes as PresetMinutes;
    }
  }
  const more = typeof r.more === 'object' && r.more !== null ? (r.more as Record<string, unknown>) : {};
  return {
    open: isPreset(r.open) ? r.open : null,
    lengths,
    stage: isStage(r.stage) ? r.stage : HOME_DEFAULT.stage,
    customize: r.customize === true,
    tab: isTab(r.tab) ? r.tab : HOME_DEFAULT.tab,
    chooserStage: isStage(r.chooserStage) ? r.chooserStage : null,
    chosen: keys(r.chosen),
    expanded: keys(r.expanded).filter((k) => k.startsWith('episode:')),
    more: { stories: Math.max(CHOOSER_PAGE, count(more.stories, CHOOSER_PAGE, MORE_MAX)), topics: Math.max(CHOOSER_PAGE, count(more.topics, CHOOSER_PAGE, MORE_MAX)) },
    scrollY: count(r.scrollY, 0, SCROLL_MAX),
  };
}

/** The length a preset card builds: the chip the teacher chose, else the preset's default. */
export function lengthOf(snapshot: Pick<HomeSnapshot, 'lengths'>, preset: LecturePreset, fallback: PresetMinutes): PresetMinutes {
  return snapshot.lengths[preset] ?? fallback;
}
