import { z } from 'zod';
import { LearnerLevelIdSchema } from './learner-level';

/**
 * Payload shapes for the onboarding / PIN telemetry events (F-LEARN-001
 * §3.8). Every schema is strict: owner decision 2026-10-10 is that
 * `learnerType` is never sent in telemetry (only the level), and no payload
 * may carry a name, free text or an email. The Worker whitelists names only
 * (`TELEMETRY_EVENT_NAMES`); these schemas are the client-side contract that
 * the sending code and its tests parse against.
 */
export const ONBOARDING_TELEMETRY_PAYLOADS = {
  'onboarding.who_selected': z.object({ firstRun: z.boolean() }).strict(),
  'onboarding.level_selected': z.object({ level: LearnerLevelIdSchema }).strict(),
  'onboarding.consent_given': z
    .object({ basis: z.enum(['guardian', 'self_13plus']), hasEmail: z.boolean(), pinSet: z.boolean() })
    .strict(),
  'onboarding.started': z
    // [GU] AMENDMENTS-GUEST-FIRST-LESSON section 12: `fromGuest` (the profile was saved from a guest run, GU-4);
    // the Worker counts this event in telemetry_daily with only `firstRun` and `fromGuest` as dims.
    .object({ level: LearnerLevelIdSchema, firstRun: z.boolean(), hasEmail: z.boolean(), fromGuest: z.boolean().optional() })
    .strict(),
  'profile.updated': z.object({ field: z.enum(['level', 'avatar', 'name', 'learner_type']) }).strict(),
  'pin.created': z.object({ where: z.enum(['first_run', 'gate', 'reset', 'optional']) }).strict(),
  // [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15: `sign_in` (reset by signing in, OA-6) and, on a request,
  // `wait_cancelled` (Cancel the wait, OA-4a). The Worker stores both without a profile id.
  'pin.reset_requested': z.object({ method: z.enum(['rescue_code', 'wait', 'sign_in', 'wait_cancelled']) }).strict(),
  'pin.reset_completed': z.object({ method: z.enum(['rescue_code', 'wait', 'sign_in']) }).strict(),
} as const;
