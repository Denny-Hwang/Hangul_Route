import { JOIN_HANDOFF_MS, JoinHandoffSchema, parseLenient } from '@hangul-route/content-schema';

/**
 * The join hand-off from the family home (F-APP-001 sections 3.6 and 3.8): "Open the app on this
 * device" leaves `sessionStorage` `hr:shell:joinCode` = `{ v: 1, code, at }` (no name, no space id)
 * in the tab, and the learner app's Join screen fills the code in the next time it is shown within
 * 30 minutes. The F-SPACE-001 steps that follow (consent included) are unchanged. Pure:
 * `platform/join-handoff.web.ts` reads and removes the stored value.
 *
 * Returns the code while `now - at` is in `[0, JOIN_HANDOFF_MS)`; anything else (missing, corrupt,
 * another shape, too old, from the future) is `null`.
 */
export function joinPrefillCode(raw: string | null, now: number): string | null {
  const record = parseLenient(JoinHandoffSchema, raw);
  if (record === null) return null;
  const age = now - record.at;
  return age >= 0 && age < JOIN_HANDOFF_MS ? record.code : null;
}
