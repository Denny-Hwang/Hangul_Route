import {
  FAMILY_LABELS_SELF_LEARNER_ONLY,
  NOTE_PRESET_IDS,
  NOTE_REACTION_IDS,
  type FamilyLabelId,
  type LearnerType,
  type NotePresetId,
  type NoteReactionId,
  type UiLocale,
} from '@hangul-route/content-schema';
import { formatDate, type Messages } from '@hangul-route/i18n';

/**
 * Dictionary selectors for notes on the learner side (F-FEEDBACK-001 FB-7, section 6.11). Ids are
 * rendered in the viewer's UI language; anything this app does not know reads as the safe
 * fallback, so a newer Worker never breaks an older app. Pure.
 */

const PRESETS: ReadonlySet<string> = new Set(NOTE_PRESET_IDS);
const REACTIONS: ReadonlySet<string> = new Set(NOTE_REACTION_IDS);

export const isPresetId = (id: string): id is NotePresetId => PRESETS.has(id);
export const isReactionId = (id: string | null): id is NoteReactionId => id !== null && REACTIONS.has(id);

/** The preset line; an unknown id renders "A note for you." */
export function presetText(m: Messages, presetId: string): string {
  return isPresetId(presetId) ? m.common.notes.presets[presetId] : m.common.notes.presetFallback;
}

/**
 * How a family sender signs. A missing label reads "Your family", and so does "Your partner" on
 * any profile that is not a self learner (`FAMILY_LABELS_SELF_LEARNER_ONLY`; an absent learner
 * type reads as `child`), so a child never sees "Your partner".
 */
export function familyLabelText(m: Messages, label: FamilyLabelId | null, learnerType: LearnerType | undefined): string {
  const labels = m.common.notes.familyLabels;
  if (label === null) return labels.family;
  if (FAMILY_LABELS_SELF_LEARNER_ONLY.has(label) && (learnerType ?? 'child') !== 'self') return labels.family;
  return labels[label];
}

/** A class note's sender: "Your teacher · <class>", or "Your teacher" while the class name is unknown here. */
export function teacherLabelText(m: Messages, className: string | null): string {
  const name = className?.trim() ?? '';
  return name === '' ? m.common.notes.teacherOnly : m.common.notes.teacherLabel(name);
}

/** The words of a reaction; an id this app does not know is ignored (null). */
export function reactionText(m: Messages, reaction: string | null): string | null {
  return isReactionId(reaction) ? m.common.notes.reactions[reaction] : null;
}

/** Who sees the learner's answer (section 6.6). */
export function seenByText(m: Messages, who: 'teacher' | 'family'): string {
  return m.learner.notes.reactionSeenBy[who];
}

/** The quiet link at the bottom of the note page: "Report this note" on a self-managed profile (section 6.10 item 4). */
export function reportLinkText(m: Messages, selfManaged: boolean): string {
  return selfManaged ? m.learner.notes.detail.reportSelf.cta : m.learner.notes.detail.tellGrownUp.cta;
}

const DAY_MS = 86_400_000;

/** "Today", "Yesterday", otherwise a short date (section 6.11); an unreadable date reads as nothing. */
export function noteDateText(m: Messages, locale: UiLocale, iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const startOf = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
  if (days <= 0) return m.common.notes.date.today;
  if (days === 1) return m.common.notes.date.yesterday;
  return formatDate(locale, then, 'monthDay');
}

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/;

/**
 * The `lang` of a grown-up's free text, so a screen reader picks a voice (section 6.11): Korean
 * when it holds Hangul, otherwise the sender's console locale, otherwise none.
 */
export function textLang(note: { text: string | null; textLocale: UiLocale | null }): string | undefined {
  if (note.text === null) return undefined;
  if (HANGUL.test(note.text)) return 'ko';
  return note.textLocale ?? undefined;
}
