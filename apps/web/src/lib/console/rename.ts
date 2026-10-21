import { SPACE_NAME_MAX, checkSpaceName, type SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ApiResult } from './api';

/**
 * The one-tap rename of a family, class or school where its name is shown ([SA] AMENDMENTS-SEATS-ADMINS section 5.3;
 * wireframe design/wireframes/console/rename-inline.md, mock design/screens/console/rename-inline.md). Pure: the field
 * checks the typed name with the Worker's own `checkSpaceName` (NFC, whitespace collapsed, trimmed, 1 to 40, no control
 * or format character, a letter or a digit), and the save is a small state machine the page drives: the new name
 * shows at once (optimistic), the old one comes back when the save does not land.
 */

/** What the field holds: a name to send, the stored name again (Save stays unavailable), or why not. */
export type RenameCheck = { state: 'ok'; name: string } | { state: 'unchanged'; name: string } | { state: 'empty' | 'too_long' | 'invalid' };

/** The typed value against the stored name, both normalized the Worker's way, so "Sunday  Class A " is unchanged. */
export function checkRename(draft: string, stored: string): RenameCheck {
  const checked = checkSpaceName(draft);
  if (!checked.ok) return { state: checked.reason };
  const before = checkSpaceName(stored);
  const same = before.ok ? before.name === checked.name : stored === checked.name;
  return same ? { state: 'unchanged', name: checked.name } : { state: 'ok', name: checked.name };
}

/** The line under the field for a value that cannot be sent; null while it can (or is unchanged). */
export function renameCheckLine(check: RenameCheck, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const r = getMessages(locale).console.rename;
  if (check.state === 'empty') return r.empty;
  if (check.state === 'too_long') return r.tooLong(SPACE_NAME_MAX);
  if (check.state === 'invalid') return r.invalid;
  return null;
}

/** Why a save did not land: offline, the space archived meanwhile (`422 archived`), too many renames (`429`), anything else. */
export type RenameFailure = 'failed' | 'offline' | 'archived' | 'tooManyAttempts';

export function renameFailureOf(result: Extract<ApiResult<unknown>, { ok: false }>, online = true): RenameFailure {
  if (result.error === 'network' || !online) return 'offline';
  if (result.status === 429) return 'tooManyAttempts';
  if (result.status === 422 && result.code === 'archived') return 'archived';
  // `422 bad_name` cannot reach the page (the field runs the same check) and reads as any other failure.
  return 'failed';
}

export function renameFailureLine(failure: RenameFailure, locale: UiLocale = DEFAULT_LOCALE): string {
  const m = getMessages(locale);
  if (failure === 'offline') return m.caregiver.retry.offline;
  if (failure === 'tooManyAttempts') return m.caregiver.retry.tooManyAttempts;
  if (failure === 'archived') return m.console.rename.archived;
  return m.console.rename.failed;
}

/** Who sees the name, under the field (`console.rename.hint[kind]`). */
export function renameHint(kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.rename.hint[kind];
}

/** Whether the Rename button shows: the response says this grown-up may (`canRename`), and the space is live. */
export function renameShown(space: { archivedAt: string | null }, canRename: boolean | undefined): boolean {
  return canRename === true && space.archivedAt === null;
}

/**
 * The field's state. `stored` is the last name the Worker confirmed (what a failed save goes back to); the name the
 * page shows lives in the page's own state, which `onName` keeps in step (title, Back labels, the frame).
 */
export interface RenameState {
  open: boolean;
  draft: string;
  stored: string;
  saving: boolean;
  /** The name being saved, kept so a failed save reopens the field with what was typed. */
  pending: string | null;
  failure: RenameFailure | null;
}

export function renameIdle(stored: string): RenameState {
  return { open: false, draft: stored, stored, saving: false, pending: null, failure: null };
}

/** Rename pressed: the field opens with the current name (the page selects it). */
export function renameOpen(state: RenameState, current: string): RenameState {
  return { ...state, open: true, draft: current, stored: state.saving ? state.stored : current, failure: null };
}

export function renameEdit(state: RenameState, draft: string): RenameState {
  return { ...state, draft, failure: state.failure === 'archived' ? state.failure : null };
}

export function renameCancel(state: RenameState): RenameState {
  return { ...state, open: false, failure: null, draft: state.stored };
}

/** Save or Enter: the name to send and the optimistic state, or nothing to do (invalid, unchanged, saving, archived). */
export function renameSubmit(state: RenameState): { state: RenameState; send: string | null } {
  if (state.saving || state.failure === 'archived') return { state, send: null };
  const check = checkRename(state.draft, state.stored);
  if (check.state !== 'ok') return { state, send: null };
  return { state: { ...state, open: false, saving: true, pending: check.name, failure: null }, send: check.name };
}

/** The answer: the Worker's name (and whether to announce it), or the failure and the field open again. */
export function renameSettled(state: RenameState, outcome: { ok: true; name: string; changed: boolean } | { ok: false; failure: RenameFailure }): { state: RenameState; name: string; announce: boolean } {
  if (outcome.ok) return { state: { ...renameIdle(outcome.name) }, name: outcome.name, announce: outcome.changed };
  return { state: { open: true, draft: state.pending ?? state.draft, stored: state.stored, saving: false, pending: null, failure: outcome.failure }, name: state.stored, announce: false };
}
