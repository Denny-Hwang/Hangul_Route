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
  // Reserved: F-VOC-003 registers the Theme packs section together with its own flag.
  { id: 'theme-packs', isAvailable: () => false },
];

export function visibleSections(ctx: LibrarySectionContext): LibrarySectionId[] {
  return LIBRARY_SECTIONS.filter((s) => s.isAvailable(ctx)).map((s) => s.id);
}
