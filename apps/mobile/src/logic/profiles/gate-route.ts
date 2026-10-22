import type { GuestRecord } from '@hangul-route/content-schema';
import { gateProfiles } from '../guest/guest-model';
import { gateRequired, type DeviceAudience } from './learner-type';

/**
 * Whether a grown-up action (Add a profile, Save my progress, Restore, Open
 * billing on the web, the dashboard) opens directly instead of through the PIN
 * screen — F-LEARN-001 L7. It does while a grown-up session is open, and on a
 * self-only device that never set a PIN, so a learner managing their own
 * profile is not made to invent a PIN just to reach their own settings.
 * Every other device goes through the PIN screen exactly as before.
 * [GU] GU-D14 (row GU-2): a live guest counts as a learner whose `learnerType` is unset (`gateProfiles`), so while one
 * lives on a self-only device without a PIN the gate asks a grown-up to set one, and once it is saved or swept the
 * device opens directly again.
 */
export function gateOpensDirectly(i: {
  /** [GU] With their ids, so a saved guest (its id on the list) is not counted twice. */
  profiles: readonly (Parameters<typeof gateRequired>[0]['profiles'][number] & { id?: string })[];
  parentPinHash: string | null;
  sessionOpen: boolean;
  guest?: GuestRecord | null;
}): boolean {
  return i.sessionOpen || !gateRequired({ profiles: gateProfiles(i.profiles, i.guest), parentPinHash: i.parentPinHash });
}
