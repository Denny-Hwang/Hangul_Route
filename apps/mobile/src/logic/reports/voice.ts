import type { LearnerType, ProfileRole, ReportVoice } from '@hangul-route/content-schema';
import { deviceAudience } from '../profiles/learner-type';

/**
 * The in-app report's voice — F-REPORT-001 section 3.9, OD-17 (RP-9). The second person is for an adult learning
 * alone who reads their **own** report: the device is self-only (`deviceAudience(profiles) === 'self'`, every
 * learner profile manages itself) **and** the report is the active profile's. Everything else reads the third
 * person, like the console.
 *
 * `gateOpensDirectly` is deliberately not an input: it is also true while a grown-up session is open, so it would
 * give a parent on a shared family device the second voice. The helper takes no session input at all.
 */
export interface ReportVoiceInput {
  profiles: readonly { id: string; role: ProfileRole; learnerType?: LearnerType }[];
  activeProfileId: string | null;
  /** The profile whose report is open. */
  profileId: string;
}

export function reportVoice(i: ReportVoiceInput): ReportVoice {
  return deviceAudience(i.profiles) === 'self' && i.activeProfileId === i.profileId ? 'second' : 'third';
}
