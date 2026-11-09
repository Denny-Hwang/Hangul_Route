import { z } from 'zod';
import type { TelemetryEventName } from './telemetry';

/**
 * The crash name (`app.crash`, TELEMETRY-NAMES-2 section U, Worker first): the top-level error boundary of an app root
 * caught an error and drew the crash screen ("Hoya tripped over a rock"). Strict payload, no learner data: which root
 * (`surface`), the screen's route name, the error's class name, a short scrubbed message (printable ASCII, 120 characters
 * at most, never an address, a link or a long number), whether it was a lesson or screen chunk that could not load
 * (`chunk`) and the app version. The Worker stores it without a profile id, so a crash never links to a learner.
 */
export const CRASH_SURFACES = ['learner', 'browse', 'presenter'] as const;
export const CRASH_MESSAGE_MAX = 120;

/** A route or error class name: letters and digits, at most 40 long. */
const CODE_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
/** Printable ASCII only, with no address, link or run of six digits (a phone, a card, an id) in it. */
const MESSAGE_RE = /^(?!.*(?:@|:\/\/|\d{6}))[\x20-\x7E]{0,120}$/;

export const CRASH_TELEMETRY_PAYLOADS = {
  'app.crash': z
    .object({
      surface: z.enum(CRASH_SURFACES),
      route: z.string().regex(CODE_RE),
      errorName: z.string().regex(CODE_RE),
      message: z.string().regex(MESSAGE_RE),
      chunk: z.boolean(),
      appVersion: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/),
    })
    .strict(),
} as const satisfies Partial<Record<TelemetryEventName, z.AnyZodObject>>;

export type CrashTelemetryPayload = z.infer<(typeof CRASH_TELEMETRY_PAYLOADS)['app.crash']>;
export const CRASH_TELEMETRY_NAMES = Object.keys(CRASH_TELEMETRY_PAYLOADS) as Array<keyof typeof CRASH_TELEMETRY_PAYLOADS>;
