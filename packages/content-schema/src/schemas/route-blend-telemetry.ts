import { z } from 'zod';
import type { TelemetryEventName } from './telemetry';

/**
 * The two names of AMENDMENTS-ROUTE-CLASS-BLEND section 18 (TELEMETRY-NAMES-2 section T, row BL-W, Worker first).
 * Strict payloads: a count and codes only. No plan, space, cell or learner id, no date and no weekday list; the
 * Worker stores them without a profile id and keeps per key only a value these schemas accept.
 */
export const ROUTE_BLEND_TELEMETRY_PAYLOADS = {
  /** The learner's practice days changed (BL-8): how many days, and who changed them. */
  'route.practice_days_changed': z.object({ days: z.number().int().min(1).max(7), by: z.enum(['self', 'grownup']) }).strict(),
  /** A Refresh started (BL-7): through the Cell Check or Daily Review. */
  'route.refresh_started': z.object({ via: z.enum(['cell-check', 'daily-review']) }).strict(),
} as const satisfies Partial<Record<TelemetryEventName, z.AnyZodObject>>;

export type RouteBlendTelemetryName = keyof typeof ROUTE_BLEND_TELEMETRY_PAYLOADS;
export const ROUTE_BLEND_TELEMETRY_NAMES = Object.keys(ROUTE_BLEND_TELEMETRY_PAYLOADS) as RouteBlendTelemetryName[];
