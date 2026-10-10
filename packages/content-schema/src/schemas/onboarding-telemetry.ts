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
    .object({ level: LearnerLevelIdSchema, firstRun: z.boolean(), hasEmail: z.boolean() })
    .strict(),
  'profile.updated': z.object({ field: z.enum(['level', 'avatar', 'name', 'learner_type']) }).strict(),
  'pin.created': z.object({ where: z.enum(['first_run', 'gate', 'reset', 'optional']) }).strict(),
  'pin.reset_requested': z.object({ method: z.enum(['rescue_code', 'wait']) }).strict(),
  'pin.reset_completed': z.object({ method: z.enum(['rescue_code', 'wait']) }).strict(),
} as const;
