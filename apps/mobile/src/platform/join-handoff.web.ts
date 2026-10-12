import { JOIN_HANDOFF_KEY } from '@hangul-route/content-schema';
import { joinPrefillCode } from '../logic/shell/join-prefill';
import { sessionArea, type SessionArea } from './grown-up-handoff.web';

/**
 * Reads the family home's join hand-off once (F-APP-001 sections 3.6 and 3.8): `sessionStorage`
 * `hr:shell:joinCode`, removed on read whatever it holds, so the code fills the Join screen the
 * next time it is shown in this tab within 30 minutes and never again. The record holds a join
 * code and a time only. Every access is guarded (blocked storage reads as nothing).
 */
export function takeJoinHandoff(area: SessionArea | null = sessionArea(), now: number = Date.now()): string | null {
  if (area === null) return null;
  let raw: string | null;
  try {
    raw = area.getItem(JOIN_HANDOFF_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    area.removeItem(JOIN_HANDOFF_KEY);
  } catch {
    // A storage that refuses keeps the record; it expires on its own after 30 minutes.
  }
  return joinPrefillCode(raw, now);
}
