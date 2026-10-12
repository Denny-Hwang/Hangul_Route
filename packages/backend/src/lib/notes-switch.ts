/**
 * The Worker switch for sending notes — F-FEEDBACK-001 section 7.8 (decision
 * D7). A dashboard text variable on `hangul-route-api`, kept across deploys by
 * `keep_vars = true`, so the owner turns sending on or off in a minute without
 * a deploy or an app build. Unset (the default) means nobody can send: the two
 * send routes answer 404 before any auth or body check. Only sending is
 * switched; the inbox, hide, report, block, oversight and prefs routes always
 * work. Turning it on is the owner's step (OD-19, FB-14), never a code change.
 */
export interface NotesEnv {
  NOTES_SEND?: string;
}

/** True only for the exact value `enabled` (the CLASS_TRANSFER pattern). */
export function notesSendEnabled(env: NotesEnv | undefined): boolean {
  return env?.NOTES_SEND === 'enabled';
}
