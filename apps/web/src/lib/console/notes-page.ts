import { CATALOG, type Catalog, type NoteReactionId, type SpaceKind, type SpaceRole, type StageKey } from '@hangul-route/content-schema';
import type { iconNames } from '@hangul-route/design-system/icon-glyphs';
import type { RecipientRow } from './notes';
import { ROUTES, spaceIdFrom } from './routing';

type IconName = (typeof iconNames)[number];

/**
 * The notes page of a space (F-FEEDBACK-001 FB-11a, section 6.13; wireframes console/notes-sent.md and
 * console/note-composer.md; screen specs design/screens/notes/sent-list.md, composer.md, family-notes.md): what the
 * URL says, where the page's links go and what the composer starts with. Ids only: no learner name ever reaches a URL.
 */

/**
 * The family page's tabs, the default first. FB-11a builds the Sent tab; FB-12 adds `received` in front of it, the
 * default tab of section 6.13.
 */
export const FAMILY_TABS = ['sent'] as const satisfies ReadonlyArray<'received' | 'sent'>;
export type FamilyTab = (typeof FAMILY_TABS)[number];

export interface NotesPageQuery {
  spaceId: string;
  /** An opaque `profile:` id: the sent list's filter, and the composer's preselected learner. */
  learner: string | null;
  /** A catalogue quest id the composer prefills (checked against the catalogue by `questPrefill`). */
  quest: string | null;
  compose: boolean;
  tab: FamilyTab;
}

const value = (params: { get(name: string): string | null } | null, name: string): string | null => {
  const raw = params?.get(name)?.trim() ?? '';
  return raw === '' ? null : raw;
};

/** What the notes page URL asks for; anything it does not know reads as the default. */
export function notesPageQuery(params: { get(name: string): string | null } | null): NotesPageQuery {
  const tab = value(params, 'tab');
  return {
    spaceId: spaceIdFrom(params),
    learner: value(params, 'learner'),
    quest: value(params, 'quest'),
    compose: value(params, 'compose') === '1',
    tab: (FAMILY_TABS as readonly string[]).includes(tab ?? '') ? (tab as FamilyTab) : FAMILY_TABS[0],
  };
}

/** The notes page with the composer opened or closed, keeping the learner filter and the tab. */
export function notesPageHref(spaceId: string, kind: SpaceKind, opts: { learner?: string | null; compose?: boolean; tab?: FamilyTab }): string {
  return ROUTES.spaceNotes(spaceId, kind, {
    ...(opts.compose ? { compose: true } : {}),
    ...(opts.learner ? { learner: opts.learner } : {}),
    ...(opts.tab ? { tab: opts.tab } : {}),
  });
}

/**
 * The learners the composer starts with: the `&learner` one when it can be picked, else the family's only learner
 * (section 6.13), else nobody. Never a learner whose notes are off or who is at today's limit.
 */
export function composerPrefill(rows: readonly RecipientRow[], kind: SpaceKind, learner: string | null): string[] {
  if (learner !== null) {
    const wanted = rows.find((row) => row.id === learner);
    return wanted?.selectable ? [wanted.id] : [];
  }
  if (kind === 'family' && rows.length === 1 && rows[0]?.selectable) return [rows[0].id];
  return [];
}

/** The `&quest` id when it names a catalogue quest; the preset is never prefilled (section 9). */
export function questPrefill(quest: string | null, catalog: Catalog = CATALOG): string | null {
  return quest !== null && catalog.quests.some((q) => q.id === quest) ? quest : null;
}

export interface QuestOptionGroup {
  stage: StageKey;
  title: string;
  quests: Array<{ id: string; title: string }>;
}

/** The quest picker: every catalogue quest, grouped by stage in catalogue order (never by a learner's progress). */
export function questOptions(stageTitle: (stage: StageKey) => string, catalog: Catalog = CATALOG): QuestOptionGroup[] {
  const groups: QuestOptionGroup[] = [];
  for (const quest of catalog.quests) {
    let group = groups.find((g) => g.stage === quest.stage);
    if (!group) {
      group = { stage: quest.stage, title: stageTitle(quest.stage), quests: [] };
      groups.push(group);
    }
    group.quests.push({ id: quest.id, title: quest.title });
  }
  return groups;
}

const REACTION_GLYPHS: Readonly<Record<NoteReactionId, IconName>> = {
  thanks: 'heart',
  will_try: 'pencil',
  did_it: 'check-circle',
  happy: 'sparkle',
};

/** The glyph drawn beside an answer's label (design/screens/notes/note-page.md); the label carries the meaning. */
export function reactionGlyph(reaction: string | null): IconName | null {
  return reaction !== null && Object.prototype.hasOwnProperty.call(REACTION_GLYPHS, reaction) ? REACTION_GLYPHS[reaction as NoteReactionId] : null;
}

/**
 * Whether this viewer's role sends notes in this space (section 6.1): the owner, a class's teachers, a family's
 * caregivers. A school admin, a student and an unknown role never do (no cascade, section 8.2 and OD-6), and a school
 * has no notes page at all. The Worker still decides; this only keeps the console from offering what it would refuse.
 */
export function notesSender(role: SpaceRole | null, kind: SpaceKind): boolean {
  if (kind === 'school' || role === null) return false;
  return role === 'owner' || (kind === 'class' && role === 'teacher') || (kind === 'family' && role === 'caregiver');
}

/**
 * The roster's notes entries (section 6.13 item 3): **Notes** in the roster header and **Send a note** on each student
 * card, the composer with that learner preselected. None while the flag is off, and none for a viewer whose role does
 * not send here (`notesSender`: a school admin opening a class roster sees neither). An archived space keeps Notes (its
 * list and take back still work) and has no Send a note (an archived space cannot send, section 6.1 item 3).
 */
export function rosterNotesLinks(opts: { enabled: boolean; archived: boolean; role: SpaceRole | null; spaceId: string; kind: SpaceKind }): {
  header: string | null;
  card: (learnerId: string) => string | null;
} {
  if (!opts.enabled || !notesSender(opts.role, opts.kind)) return { header: null, card: () => null };
  return {
    header: ROUTES.spaceNotes(opts.spaceId, opts.kind),
    card: (learnerId) => (opts.archived ? null : ROUTES.spaceNotes(opts.spaceId, opts.kind, { compose: true, learner: learnerId })),
  };
}
