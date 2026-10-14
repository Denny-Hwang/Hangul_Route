import {
  LECTURE_TITLE_RE,
  LectureDeckSchema,
  encodeDeck,
  type BrowseKeptPass,
  type LectureBlock,
  type LectureDeck,
  type LecturePicker,
  type UiLocale,
} from '@hangul-route/content-schema';
import { PRESENTER_PATH } from '../../platform/presenter';
import { expandDeck, type LectureBundle } from '../lecture/deck-builder';
import type { ItemAccess } from './access';

/**
 * [ Present this ] on the All lessons item page (F-BROWSE-001 section 4.6
 * secondary action, OD-9, BR-13; design `design/screens/presenter/present-this.md`).
 * The item becomes a one-block deck (`source: 'catalogue'`, a numbers picker
 * of 12, no names) that opens in the presenter at `/present#d=…` (F-TCH-004
 * section 3.2). Pure: the clock, the randomness and the bundle are passed in.
 * Nothing here touches a learner: the presenter keeps the deck in this
 * device's Recent lessons and changes no one's progress.
 */

export type PresentItemKind = 'quest' | 'story' | 'vocab-topic';

type PassScope = BrowseKeptPass['scope'];

/** Numbers 1 to 12: All lessons never hands names to the presenter. */
export const PRESENT_PICKER: LecturePicker = { mode: 'numbers', count: 12 };

const TITLE_MAX = 60;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DECK_ID_LENGTH = 10;
const SEED_MAX = 2_147_483_647;

export function presentBlock(kind: PresentItemKind, id: string): LectureBlock {
  switch (kind) {
    case 'quest':
      return { kind: 'quest', id };
    case 'story':
      return { kind: 'story', storyId: id, checks: true };
    case 'vocab-topic':
      return { kind: 'vocab', topicId: id };
  }
}

/**
 * The item's title in the deck grammar (`LECTURE_TITLE_RE`, at most 60
 * characters): a character the grammar refuses becomes a space, spaces
 * collapse. Null when nothing usable is left (the button is then not shown).
 */
export function presentTitle(title: string): string | null {
  const kept = Array.from(title)
    .map((ch) => (LECTURE_TITLE_RE.test(ch) ? ch : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const capped = Array.from(kept).slice(0, TITLE_MAX).join('').trim();
  return capped.length > 0 && LECTURE_TITLE_RE.test(capped) ? capped : null;
}

export interface PresentDeckEnv {
  now: Date;
  /** Uniform in [0, 1): the deck id and the quiz seed. */
  rng: () => number;
  /** The page's language, so the slides speak it too. */
  uiLocale: UiLocale;
}

export function presentDeck(item: { kind: PresentItemKind; id: string; title: string }, env: PresentDeckEnv): LectureDeck | null {
  const title = presentTitle(item.title);
  if (title === null) return null;
  let id = 'lecture:';
  for (let i = 0; i < DECK_ID_LENGTH; i += 1) id += ID_CHARS[Math.floor(env.rng() * ID_CHARS.length)];
  const parsed = LectureDeckSchema.safeParse({
    v: 1,
    id,
    title,
    createdAt: env.now.toISOString(),
    seed: Math.floor(env.rng() * SEED_MAX),
    blocks: [presentBlock(item.kind, item.id)],
    options: { uiLocale: env.uiLocale },
    picker: PRESENT_PICKER,
    source: 'catalogue',
  });
  return parsed.success ? parsed.data : null;
}

/** The same-origin presenter link: the deck rides in the fragment only, never in a request. */
export function presentHref(deck: LectureDeck): string {
  return `${PRESENTER_PATH}#d=${encodeDeck(deck)}`;
}

/**
 * Whether [ Present this ] is drawn: a full pass (OD-9), the presenter root in
 * this build, and at least one slide from the one-block deck on this bundle.
 * Today that is a lesson, a story the Library lists (F-TCH-004 PR 11) or a
 * ready word topic (F-TCH-004 PR 12); anything else expands to nothing, so it
 * never lands on the invalid-link state.
 */
export function presentThisShown(input: { scope: PassScope; presenterRoot: boolean; deck: LectureDeck | null; bundle: LectureBundle }): boolean {
  if (input.scope !== 'full' || !input.presenterRoot || input.deck === null) return false;
  return expandDeck(input.deck, input.bundle, { canPlayKorean: true }).slides.length > 0;
}

/** A check deck for the show rule only: a fixed clock and id, never opened. */
const CHECK_ENV = { now: new Date(0), rng: () => 0 } as const;

/**
 * The item page's whole rule for [ Present this ] (BR-13): an item this build holds, a pass, an
 * item the pass does not close, and `presentThisShown` on the item's own one-block deck. A story
 * gives its title in the page's language (`title.gloss`, localized by `localizeStory`), as a lesson does.
 */
export function presentItemShown(input: {
  item: { kind: PresentItemKind; id: string; title: string } | null;
  scope: PassScope | null;
  access: ItemAccess;
  presenterRoot: boolean;
  uiLocale: UiLocale;
  bundle: LectureBundle;
}): boolean {
  if (input.item === null || input.scope === null || input.access === 'closed') return false;
  return presentThisShown({
    scope: input.scope,
    presenterRoot: input.presenterRoot,
    deck: presentDeck(input.item, { ...CHECK_ENV, uiLocale: input.uiLocale }),
    bundle: input.bundle,
  });
}

/** One group of the item page's actions: the preview (and a story's questions, on the `main` group) and Present this. */
export interface PresentSlot {
  preview: boolean;
  present: boolean;
  /** The group that holds the preview's companions (a story's [ Preview the questions ]). */
  main: boolean;
}

/**
 * Where the item page draws its actions (BR-13, D16; review of #590). A phone pins them to the
 * bottom edge; a short phone window (`LayoutClass.short`: below `layout.shortHeight`, 480, a phone
 * in landscape) pins only the preview and ends the page with Present this. The layout class counts
 * a first frame with no height yet as not short, the usual case, so nothing jumps. From the regular
 * class the bar is inline. A closed item shows its closed line inline instead.
 */
export function presentPlacement(input: {
  compact: boolean;
  closed: boolean;
  canPreview: boolean;
  presentShown: boolean;
  short: boolean;
}): { footer: PresentSlot | 'closed' | null; inline: PresentSlot | 'closed' | null } {
  if (input.closed) return { footer: null, inline: 'closed' };
  const slot = (present: boolean): PresentSlot | null => (input.canPreview || present ? { preview: input.canPreview, present, main: true } : null);
  if (!input.compact) return { footer: null, inline: slot(input.presentShown) };
  const pinPresent = !input.short;
  const overflow = input.presentShown && !pinPresent;
  return {
    footer: slot(input.presentShown && pinPresent),
    inline: overflow ? { preview: false, present: true, main: !input.canPreview } : null,
  };
}
