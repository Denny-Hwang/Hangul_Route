import {
  JOIN_CODE_RE,
  LECTURE_MESSAGE_NS,
  LECTURE_REVISIT_CHAR_RE,
  LECTURE_TITLE_RE,
  LectureBlockSchema,
  LectureDeckSchema,
  PICKER_LABEL_RE,
  encodeDeck,
  rosterAlias,
  type LectureBlock,
  type LectureDeck,
  type LectureOptions,
  type LecturePicker,
  type LectureRosterMessage,
} from '@hangul-route/content-schema';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS, type LectureCatalogueStory } from '@/data/lecture-catalogue.generated';
import { questsOf, stage1Episodes, stage1Quests } from '@/data/stage1-catalog';
import type { PlanView, Roster } from './api';
import { findBannedWord } from './banned-text';

/**
 * Lecture setup, the pure half (F-TCH-004 §3.10, §3.11). The console composes a
 * deck (ids, a seed, options, the picker mode and count) that travels in the
 * presenter link; picker labels never do. They are built here for the
 * `roster` message the console tab posts to the presenter tab (`lecture-link.ts`).
 *
 * Names: `anonymizeRoster` means the roster already holds aliases ("M. K."),
 * so `names` is never offered and an alias is never reversed. Otherwise the
 * label is the first token of the display name (kept as typed: Hangul and
 * accents too). A label outside the picker's name class becomes its roster
 * position number. No summary, age, level, avatar or id is ever sent.
 */

export type LectureSource = 'plan' | 'catalogue' | 'revisit';
export type PickerChoice = 'names' | 'initials' | 'numbers' | 'none';
export type TitleProblem = 'empty' | 'chars' | 'banned' | 'name';

/** A class with no learners yet runs its picker over 1..12. */
export const NO_ROSTER_COUNT = 12;
/** The picker and the roster message hold at most this many labels. */
export const PICKER_MAX = 60;
const LABEL_MAX = 20;
const REVISIT_MAX = 6;
const TITLE_MAX = 60;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DECK_ID_LENGTH = 10;

type RosterPick = Pick<Roster, 'space' | 'learners'>;

/** `?from=plan|revisit` from an entry point (Present this plan, Revisit together). */
export function lectureSourceFrom(params: { get(name: string): string | null } | null): 'plan' | 'revisit' | null {
  const from = params?.get('from');
  return from === 'plan' || from === 'revisit' ? from : null;
}

/** One block per plan item, in order; an id the deck grammar refuses is left out. */
export function planBlocks(plan: Pick<PlanView, 'items'>): LectureBlock[] {
  return plan.items.flatMap((item) => {
    const parsed = LectureBlockSchema.safeParse({ kind: item.kind, id: item.id });
    return parsed.success ? [parsed.data] : [];
  });
}

/** The roll-up's "jamo to revisit" as one revisit block (compatibility jamo, at most 6). */
export function revisitBlock(chars: readonly string[]): LectureBlock | null {
  const kept = [...new Set(chars.filter((c) => LECTURE_REVISIT_CHAR_RE.test(c)))].slice(0, REVISIT_MAX);
  return kept.length > 0 ? { kind: 'revisit', chars: kept } : null;
}

export function classCodeBlock(joinCode: string | null): LectureBlock | null {
  return joinCode !== null && JOIN_CODE_RE.test(joinCode) ? { kind: 'class-code', code: joinCode } : null;
}

export function moveBlock(blocks: readonly LectureBlock[], from: number, to: number): LectureBlock[] {
  if (to < 0 || to >= blocks.length || from < 0 || from >= blocks.length) return [...blocks];
  const out = [...blocks];
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved as LectureBlock);
  return out;
}

export function updateBlock(blocks: readonly LectureBlock[], index: number, block: LectureBlock): LectureBlock[] {
  return blocks.map((b, i) => (i === index ? block : b));
}

/** A content block's title from the catalogue mirrors (titles are content); an unknown id shows itself. Null for other blocks. */
export function catalogueTitle(block: LectureBlock, stories: readonly LectureCatalogueStory[] = LECTURE_STORIES): string | null {
  switch (block.kind) {
    case 'quest':
      return stage1Quests.find((q) => q.id === block.id)?.titleEn ?? block.id;
    case 'episode':
      return stage1Episodes.find((e) => e.id === block.id)?.titleEn ?? block.id;
    case 'story':
      return stories.find((s) => s.id === block.storyId)?.titleEn ?? block.storyId;
    case 'vocab':
      return LECTURE_VOCAB_TOPICS.find((t) => t.id === block.topicId)?.titleEn ?? block.topicId;
    default:
      return null;
  }
}

const questMinutes = new Map(stage1Quests.map((q) => [q.id, q.estimatedMinutes]));

/**
 * About-minutes for the outline from the catalogue mirrors (the console has no
 * content bundle; exact slide counts appear on the presenter start screen).
 * Null when the catalogue does not know the item.
 */
export function blockMinutes(block: LectureBlock, stories: readonly LectureCatalogueStory[] = LECTURE_STORIES): number | null {
  switch (block.kind) {
    case 'quest':
      return questMinutes.get(block.id) ?? null;
    case 'episode': {
      const known = stage1Episodes.some((e) => e.id === block.id);
      return known ? questsOf(block.id).reduce((sum, q) => sum + q.estimatedMinutes, 0) : null;
    }
    case 'story':
      return stories.find((s) => s.id === block.storyId)?.minutes ?? null;
    case 'vocab':
      return null;
    case 'jamo-set':
      return block.jamoIds.length;
    case 'cards':
      return block.cardIds.length;
    case 'revisit':
      return block.chars.length + Math.min(4, block.chars.length);
    case 'quiz':
      return block.rounds;
    case 'activity':
      return block.minutes;
    case 'class-code':
      return 0;
  }
}

export function aboutMinutes(blocks: readonly LectureBlock[]): number {
  return blocks.reduce((sum, b) => sum + (blockMinutes(b) ?? 0), 0);
}

// ---- helper picker ---------------------------------------------------------------

export function pickerChoices(roster: RosterPick): { offered: PickerChoice[]; initial: PickerChoice } {
  const n = roster.learners.length;
  if (n === 0 || n > PICKER_MAX) return { offered: ['numbers', 'none'], initial: 'numbers' };
  if (roster.space.settings.anonymizeRoster) return { offered: ['initials', 'numbers', 'none'], initial: 'initials' };
  return { offered: ['names', 'initials', 'numbers', 'none'], initial: 'names' };
}

/** The first whitespace-separated token. */
function firstToken(text: string): string {
  return text.trim().replace(/\s[\s\S]*$/, '');
}

function asLabel(candidate: string): string | null {
  const label = candidate.trim().slice(0, LABEL_MAX).trim();
  return label.length > 0 && PICKER_LABEL_RE.test(label) ? label : null;
}

/** The first token of a display name, at most 20 characters, if it fits the picker's name class. */
export function firstName(displayName: string): string | null {
  return asLabel(firstToken(displayName));
}

/** The mode the deck may use: an anonymized roster never runs in names. */
function effectiveMode(choice: 'names' | 'initials', roster: RosterPick): 'names' | 'initials' {
  return roster.space.settings.anonymizeRoster ? 'initials' : choice;
}

export function pickerLabels(roster: RosterPick, choice: 'names' | 'initials'): string[] {
  const mode = effectiveMode(choice, roster);
  const anonymized = roster.space.settings.anonymizeRoster;
  return roster.learners.map((l, i) => {
    const label = mode === 'names' ? firstName(l.displayName) : asLabel(anonymized ? l.displayName : rosterAlias(l.displayName));
    return label ?? String(i + 1);
  });
}

/** What the deck carries: the mode and the count, never a label. */
export function deckPicker(choice: PickerChoice, roster: RosterPick): LecturePicker | null {
  if (choice === 'none') return null;
  const n = roster.learners.length;
  if (choice === 'numbers' || n === 0 || n > PICKER_MAX) {
    return { mode: 'numbers', count: Math.min(PICKER_MAX, n === 0 ? NO_ROSTER_COUNT : n) };
  }
  return { mode: effectiveMode(choice, roster), count: n };
}

/** The console -> presenter message: only the labels of the chosen mode; none for numbers. */
export function rosterMessage(deckId: string, choice: PickerChoice, roster: RosterPick): LectureRosterMessage | null {
  const picker = deckPicker(choice, roster);
  if (picker === null || picker.mode === 'numbers') return null;
  return { ns: LECTURE_MESSAGE_NS, v: 1, type: 'roster', deckId, mode: picker.mode, labels: pickerLabels(roster, picker.mode) };
}

// ---- title guard -----------------------------------------------------------------

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsToken(haystack: string, needle: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(haystack);
}

/**
 * The deck title travels in the link (TD8), so it must not hold a learner's name:
 * every roster first name and alias is refused as a whole token, in any case.
 */
export function titleProblem(title: string, roster: RosterPick): TitleProblem | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > TITLE_MAX || !LECTURE_TITLE_RE.test(trimmed)) return 'chars';
  if (findBannedWord(trimmed) !== null) return 'banned';
  const needles = roster.learners.flatMap((l) => {
    const alias = roster.space.settings.anonymizeRoster ? l.displayName.trim() : rosterAlias(l.displayName);
    return [firstToken(l.displayName), alias].filter((n) => n.length > 0);
  });
  return needles.some((n) => containsToken(trimmed, n)) ? 'name' : null;
}

// ---- deck and link -----------------------------------------------------------------

export interface DeckInput {
  title: string;
  blocks: readonly LectureBlock[];
  options: Partial<LectureOptions>;
  picker: LecturePicker | null;
  source: LectureSource;
  now: Date;
  /** Uniform in [0, 1): the deck id and the quiz seed. */
  rng: () => number;
}

export function buildDeck(input: DeckInput): LectureDeck {
  let id = 'lecture:';
  for (let i = 0; i < DECK_ID_LENGTH; i += 1) id += ID_CHARS[Math.floor(input.rng() * ID_CHARS.length)];
  return LectureDeckSchema.parse({
    v: 1,
    id,
    title: input.title.trim(),
    createdAt: input.now.toISOString(),
    seed: Math.floor(input.rng() * 2_147_483_647),
    blocks: input.blocks,
    options: input.options,
    picker: input.picker,
    source: input.source,
  });
}

/** `${APP_URL}/present#d=<deck>`: ids and options only, no label (D12). */
export function presenterUrl(appUrl: string, deck: LectureDeck): string {
  return `${appUrl}/present#d=${encodeDeck(deck)}`;
}
