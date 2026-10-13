import { FAMILY_LABEL_IDS, NOTE_LEARNER_ID_MAX, NOTE_PRESET_IDS, NOTE_SEND_MAX_LEARNERS, QUEST_ID_RE, type FamilyLabelId, type NotePresetId } from '@hangul-route/content-schema';
import { readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';

/**
 * The note being written, kept across the composer's [ Preview ] (F-FEEDBACK-001 FB-15). Preview opens All lessons
 * in the same tab, so before it goes the composer writes its form here, in this tab's `sessionStorage` (guarded,
 * lib/i18n/safe-storage), and puts it back when the adult returns with `&compose=1`. One draft per space; dropped
 * on close and on a send; older than COMPOSER_DRAFT_MAX_MS, ignored. It holds learner ids (never names) and only
 * ever lives in the adult's own tab.
 */
export interface ComposerDraft {
  mode: 'everyone' | 'learners';
  picked: string[];
  presetId: NotePresetId | null;
  text: string;
  questId: string | null;
  label: FamilyLabelId;
}

/** A draft older than this is left behind (an hour: long enough to look at a quest, short enough to be this note). */
export const COMPOSER_DRAFT_MAX_MS = 60 * 60_000;

/** Loose bound on stored words; the composer's own counter judges the real limit. */
const TEXT_MAX = 2000;

const LEARNER_ID_RE = /^profile:[a-z0-9-]+$/;
const DRAFT_KEYS = ['v', 'savedAt', 'mode', 'picked', 'presetId', 'text', 'questId', 'label'];

export function composerDraftKey(spaceId: string): string {
  return `hr.notes.composerDraft:${spaceId}`;
}

/** True when the draft was kept; false with no storage or a refusal (the composer still opens Preview). */
export function saveComposerDraft(storage: KeyValueStorage | null, spaceId: string, draft: ComposerDraft, now: number): boolean {
  return writeItem(storage, composerDraftKey(spaceId), JSON.stringify({ v: 1, savedAt: now, ...draft }));
}

export function clearComposerDraft(storage: KeyValueStorage | null, spaceId: string): void {
  removeItem(storage, composerDraftKey(spaceId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDraft(raw: string, now: number): ComposerDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== 1) return null;
  if (Object.keys(value).some((k) => !DRAFT_KEYS.includes(k))) return null;
  const { savedAt, mode, picked, presetId, text, questId, label } = value;
  if (typeof savedAt !== 'number' || savedAt > now || now - savedAt > COMPOSER_DRAFT_MAX_MS) return null;
  if (mode !== 'everyone' && mode !== 'learners') return null;
  if (!Array.isArray(picked) || picked.length > NOTE_SEND_MAX_LEARNERS) return null;
  const ids: string[] = [];
  for (const id of picked) {
    if (typeof id !== 'string' || id.length > NOTE_LEARNER_ID_MAX || !LEARNER_ID_RE.test(id)) return null;
    ids.push(id);
  }
  const preset = (NOTE_PRESET_IDS as readonly unknown[]).includes(presetId) ? (presetId as NotePresetId) : null;
  if (presetId !== null && preset === null) return null;
  if (typeof text !== 'string' || text.length > TEXT_MAX) return null;
  if (questId !== null && (typeof questId !== 'string' || !QUEST_ID_RE.test(questId))) return null;
  const familyLabel = (FAMILY_LABEL_IDS as readonly unknown[]).includes(label) ? (label as FamilyLabelId) : null;
  if (familyLabel === null) return null;
  return { mode, picked: ids, presetId: preset, text, questId, label: familyLabel };
}

/** The kept draft for this space, or null; a stale or malformed one is removed. */
export function readComposerDraft(storage: KeyValueStorage | null, spaceId: string, now: number): ComposerDraft | null {
  const raw = readItem(storage, composerDraftKey(spaceId));
  if (raw === null) return null;
  const draft = parseDraft(raw, now);
  if (draft === null) clearComposerDraft(storage, spaceId);
  return draft;
}
