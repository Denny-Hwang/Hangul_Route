import type { FamilyLabelId, NoteReportReason, NotesMode, NoteSuggest } from '@hangul-route/content-schema';

/*
 * Notes from grown-ups as the Worker stores them — F-FEEDBACK-001 section 7.4
 * (PR FB-2). Tables of migration 0008. A note row names the learner, the space
 * it was sent in and the sending account; the account never reaches the
 * learner. Rows are never edited in place except through the narrow state
 * methods of `Db` (read, reaction, hide, withdraw, report).
 */

export type NoteStatus = 'live' | 'hidden' | 'reported' | 'withdrawn';
export type NoteSenderRole = 'teacher' | 'family';
/** Who acted on a note or a setting: an adult in the console, or the learner's device. */
export type NoteActVia = 'family' | 'device';
export type NoteBatchKind = 'everyone' | 'learners';
export type NoteHoldReason = 'reports' | 'unsafe' | 'owner';
export type NoteReportOutcome = 'kept_hidden' | 'restored' | 'sender_held';
export type NoteDeviceScope = 'full' | 'class';

/** One `feedback_notes` row. */
export interface StoredNote {
  id: string;
  learnerId: string;
  spaceId: string;
  senderAccountId: string;
  senderRole: NoteSenderRole;
  /** A family label id; always null for a teacher's note. */
  senderLabel: FamilyLabelId | null;
  batchId: string;
  batchKind: NoteBatchKind;
  presetId: string;
  /** The adult's text as checked by `checkNoteText`; null when none. */
  body: string | null;
  bodyLocale: string | null;
  suggest: NoteSuggest | null;
  status: NoteStatus;
  hiddenVia: NoteActVia | null;
  /** The caregiver who hid it from the console; null for device actions. */
  actedByAccountId: string | null;
  createdAt: string;
  readAt: string | null;
  reaction: string | null;
  reactionAt: string | null;
  hiddenAt: string | null;
  withdrawnAt: string | null;
}

/** What a send inserts: a live, unread note (every state column starts empty). */
export type NewNote = Pick<StoredNote, 'id' | 'learnerId' | 'spaceId' | 'senderAccountId' | 'senderRole' | 'senderLabel' | 'batchId' | 'batchKind' | 'presetId' | 'body' | 'bodyLocale' | 'suggest' | 'createdAt'>;

/**
 * One note as the inbox delivers it (section 6.8): the stored row, except that
 * the text of a class note is null while the learner's class notes are in
 * `presets` mode (the stored row keeps it for the sender and the family).
 */
export type DeliveredNote = StoredNote;

/** One `feedback_reports` row. `evidence` is an account id or a device id, never a name. */
export interface StoredNoteReport {
  id: string;
  noteId: string;
  learnerId: string;
  senderAccountId: string;
  reason: NoteReportReason;
  via: NoteActVia;
  evidence: string;
  /** `family:<spaceId>` or `device:<deviceId>` (section 8.4): reports count once per reporting family. */
  reporterKey: string;
  attest: 'grown_up_pin' | 'self' | null;
  createdAt: string;
  reviewedAt: string | null;
  outcome: NoteReportOutcome | null;
}

/** One `feedback_sender_holds` row; a hold is active while `liftedAt` is null. */
export interface StoredSenderHold {
  accountId: string;
  reason: NoteHoldReason;
  createdAt: string;
  liftedAt: string | null;
}

/** One `learner_note_prefs` row. A learner without a row has class notes `all` (OD-3) and no acknowledgement. */
export interface StoredNotePrefs {
  learnerId: string;
  classes: NotesMode;
  acknowledgedAt: string | null;
  updatedAt: string;
  updatedVia: NoteActVia;
  /** Null for device changes. */
  updatedByAccount: string | null;
}

/** One `feedback_sender_blocks` row: this sender's notes never reach this learner. */
export interface StoredSenderBlock {
  learnerId: string;
  senderAccountId: string;
  familySpaceId: string;
  createdByAccount: string;
  createdAt: string;
}

/** One `feedback_send_grants` row: the family owner let this co-caregiver send (OD-17). */
export interface StoredSendGrant {
  spaceId: string;
  accountId: string;
  grantedBy: string;
  grantedAt: string;
}

/** One durable counter hit (`rate_hits`). */
export interface RateHitRow {
  key: string;
  at: string;
}

/** What the inbox query answers: the delivered notes and the learner's prefs row (null without one). */
export interface LearnerNotesInbox {
  notes: DeliveredNote[];
  prefs: StoredNotePrefs | null;
}

/** Days a live, hidden or withdrawn note is kept and delivered (OD-9). */
export const NOTE_RETENTION_DAYS = 180;
/** Days a reported note and its reports are kept after the report. */
export const NOTE_REPORT_RETENTION_DAYS = 90;
/** Days a lifted hold is kept after it was lifted. */
export const NOTE_HOLD_RETENTION_DAYS = 365;
/** At most this many notes reach a device per inbox (rule 7). */
export const NOTE_INBOX_LIMIT = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The cut-offs every note read applies (section 8.7): purge lag is never visible. */
export interface NoteRetentionCuts {
  /** Live, hidden and withdrawn notes created before this are gone. */
  notesSince: string;
  /** Reported notes whose newest report is before this are gone. */
  reportsSince: string;
}

export function noteRetentionCuts(now: Date): NoteRetentionCuts {
  return {
    notesSince: new Date(now.getTime() - NOTE_RETENTION_DAYS * DAY_MS).toISOString(),
    reportsSince: new Date(now.getTime() - NOTE_REPORT_RETENTION_DAYS * DAY_MS).toISOString(),
  };
}

/** The durable counter keys (`rate_hits.key`) of section 7.3. */
export const noteRateKey = {
  /** Notes from one account, all learners. */
  account: (accountId: string): string => `note:acct:${accountId}`,
  /** Notes from one account to one learner. */
  pair: (learnerId: string, accountId: string): string => `note:pair:${learnerId}:${accountId}`,
  /** Notes to one learner from every sender. */
  learner: (learnerId: string): string => `note:learner:${learnerId}`,
  /** Family reports from one account. */
  reportAccount: (accountId: string): string => `note:report:acct:${accountId}`,
  /** Device reports for one learner. */
  reportLearner: (learnerId: string): string => `note:report:learner:${learnerId}`,
};

/** Every `note:pair` key of a learner starts with this (erased with the learner, section 7.3). */
export const notePairPrefix = (learnerId: string): string => `note:pair:${learnerId}:`;
