import { gateRequired, type DeviceAudience } from './learner-type';

/**
 * Whether a grown-up action (Add a profile, Save my progress, Restore, Unlock
 * the journey, the dashboard) opens directly instead of through the PIN
 * screen — F-LEARN-001 L7. It does while a grown-up session is open, and on a
 * self-only device that never set a PIN, so a learner managing their own
 * profile is not made to invent a PIN just to reach their own settings.
 * Every other device goes through the PIN screen exactly as before.
 */
export function gateOpensDirectly(i: {
  profiles: Parameters<typeof gateRequired>[0]['profiles'];
  parentPinHash: string | null;
  sessionOpen: boolean;
}): boolean {
  return i.sessionOpen || !gateRequired({ profiles: i.profiles, parentPinHash: i.parentPinHash });
}
