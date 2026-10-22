import { z } from 'zod';
import type { TelemetryEventName } from './telemetry';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.1 (row GU-1): the guest record that lets someone try quest 1 before a
 * profile exists. Stored on the device only (`hr:guest` through platform/storage); it never leaves the device. No
 * name, email, level, cub, `learnerType` or answer is in the record: the quest's results live where every learner's
 * do, under the id.
 */
export const GuestViaSchema = z.enum(['site', 'chooser', 'welcome']);
export type GuestVia = z.infer<typeof GuestViaSchema>;

export const GuestRecordSchema = z.object({
  v: z.literal(1),
  /** An ordinary profile id: the id the saved profile keeps (GU-D2). */
  id: z.string().regex(/^profile:[a-z0-9-]+$/),
  /** ISO. */
  startedAt: z.string(),
  /** ISO, the last quest step entered or finished. */
  lastAt: z.string(),
  /** How the run began; local only. */
  via: GuestViaSchema,
  /** Quest 1 finished at least once. */
  questDone: z.boolean(),
});
export type GuestRecord = z.infer<typeof GuestRecordSchema>;

/** Stored as `hr:guest` through platform/storage. */
export const GUEST_KEY = 'guest';
/** Reload and return window (GU-D12). */
export const GUEST_REOPEN_MS = 30 * 60 * 1000;
/** Never-saved record life, no learner profile on the device (GU-D13). */
export const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** The same on a device that holds learner profiles. */
export const GUEST_TTL_SHARED_MS = 7 * 24 * 60 * 60 * 1000;
/** The values the Not now card and the policy bullet show. */
export const GUEST_TTL_DAYS = 30;
export const GUEST_TTL_SHARED_DAYS = 7;
/** `?try=1` (GU-D5). */
export const TRY_INTENT_PARAM = 'try';

/** [GU] Section 12: seconds from the run's start to the first letter, as a bucket (never a time). */
export const GUEST_SECONDS_IN = ['0-15', '15-30', '30-60', '60+'] as const;

/**
 * [GU] Section 12: the payload of every `guest.*` event. Strict: codes, booleans and bounded whole numbers only,
 * never a profile id, a name, free text or `learnerType` (F-LEARN-001 section 3.8). The Worker enforces the same keys
 * and values (`GUEST_PAYLOAD_RULES`, packages/backend) and stores every one of these events without a profile id
 * (CS-G7).
 */
export const GUEST_TELEMETRY_PAYLOADS = {
  'guest.started': z.object({ via: GuestViaSchema, resumed: z.boolean() }).strict(),
  'guest.first_letter': z.object({ secondsIn: z.enum(GUEST_SECONDS_IN) }).strict(),
  'guest.quest_done': z.object({ stars: z.number().int().min(0).max(3) }).strict(),
  'guest.left': z.object({ at: z.enum(['quest', 'save']) }).strict(),
  'guest.saved': z
    .object({
      gated: z.boolean(),
      consent: z.enum(['new', 'existing']),
      via: z.enum(['results', 'welcome', 'later', 'setup']),
    })
    .strict(),
  'guest.expired': z.object({ questDone: z.boolean() }).strict(),
} as const satisfies Partial<Record<TelemetryEventName, z.AnyZodObject>>;

export type GuestTelemetryName = keyof typeof GUEST_TELEMETRY_PAYLOADS;
export const GUEST_TELEMETRY_NAMES = Object.keys(GUEST_TELEMETRY_PAYLOADS) as GuestTelemetryName[];
