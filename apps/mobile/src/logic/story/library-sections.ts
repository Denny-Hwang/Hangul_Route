import type { StoryIndexEntry } from './story-index';

/**
 * The Library sections registry (F-STORY-004 §3.3). With only `cards`
 * available the Library is exactly today's gallery, with no tab row; two or
 * more sections draw `SectionTabs`. Titles come from the dictionary
 * (`learner.storyShelf.sections`, read through `shelf-copy.ts`), never from
 * here.
 */

export type LibrarySectionId = 'cards' | 'story-time' | 'culture' | 'theme-packs';

export interface LibrarySectionContext {
  /** The story index: playable and (in production) reviewed stories only. */
  entries: readonly StoryIndexEntry[];
  /**
   * Words (F-VOC-003 T1): `flags.vocabTopicsEnabled` is on and the topic picker
   * has at least one topic to show. Absent = off.
   */
  words?: boolean;
}

export interface LibrarySection {
  id: LibrarySectionId;
  isAvailable: (ctx: LibrarySectionContext) => boolean;
}

const hasShelf = (ctx: LibrarySectionContext, category: 'story-time' | 'culture'): boolean =>
  ctx.entries.some((e) => e.placement === 'shelf' && e.category === category);

/** In tab order. */
export const LIBRARY_SECTIONS: readonly LibrarySection[] = [
  { id: 'cards', isAvailable: () => true },
  { id: 'story-time', isAvailable: (ctx) => hasShelf(ctx, 'story-time') },
  {
    id: 'culture',
    isAvailable: (ctx) => hasShelf(ctx, 'culture') || ctx.entries.some((e) => e.story.cultureNotes.length > 0),
  },
  // Words (F-VOC-003 T1): the reserved slot, titled "Words", offered with its flag and a ready topic.
  { id: 'theme-packs', isAvailable: (ctx) => ctx.words === true },
];

export function visibleSections(ctx: LibrarySectionContext): LibrarySectionId[] {
  return LIBRARY_SECTIONS.filter((s) => s.isAvailable(ctx)).map((s) => s.id);
}

/**
 * The section the Library opens on (§3.3): the requested one
 * (`route.params.section`, a deep link) when it is offered, else Cards.
 */
export function selectedSection(
  requested: LibrarySectionId | undefined,
  visible: readonly LibrarySectionId[],
): LibrarySectionId {
  return requested !== undefined && visible.includes(requested) ? requested : 'cards';
}

/** The sections this build can draw (Words, the `theme-packs` slot, joined with F-VOC-003 C-4). */
export const DRAWN_LIBRARY_SECTIONS: ReadonlySet<LibrarySectionId> = new Set<LibrarySectionId>(['cards', 'story-time', 'culture', 'theme-packs']);

/**
 * The Library's tab row (§3.3): the offered sections this build draws, in
 * registry order, or none at all when fewer than two remain (Cards alone is
 * exactly today's gallery, with no tab row).
 */
export function librarySectionTabs(
  ctx: LibrarySectionContext,
  drawn: ReadonlySet<LibrarySectionId> = DRAWN_LIBRARY_SECTIONS,
): LibrarySectionId[] {
  const tabs = visibleSections(ctx).filter((id) => drawn.has(id));
  return tabs.length >= 2 ? tabs : [];
}
