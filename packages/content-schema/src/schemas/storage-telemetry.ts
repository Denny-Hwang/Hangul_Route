import { z } from 'zod';
import type { TelemetryEventName } from './telemetry';

/**
 * [DP] The storage names (AMENDMENTS-DURABLE-PROGRESS section 3.9, TELEMETRY-NAMES-2 section W, row DP-3, Worker
 * first): a learner app record that could not be read, a progress write that did not land, and the write that landed
 * after it. Strict payloads of codes, one boolean and one small count: which record (never its key, a profile id or a
 * learner name), why the read failed, whether the damaged bytes were kept aside, and how many writes the save needed.
 * The Worker stores each without a profile id and keeps per key only a value these schemas accept
 * (`STORAGE_PAYLOAD_RULES`, packages/backend). Reached by the `@hangul-route/content-schema/storage-telemetry` subpath,
 * so the schemas stay out of the learner start bundle.
 */

/** The records under the read contract: a learner's progress, and the profile list, the active id and the tombstones. */
export const STORAGE_RECORDS = ['progress', 'profiles', 'active', 'tombstones'] as const;
/** `read`: the read threw (for a profile record, twice: the retry on a fresh connection too). `parse`: the bytes were read and could not be used. */
export const STORAGE_READ_CAUSES = ['read', 'parse'] as const;
/** Only progress writes are watched (section 3.7). */
export const STORAGE_WRITE_RECORDS = ['progress'] as const;
/** `tries` counts the writes after the first failure, the one that landed included; 4 stands for four or more. */
export const STORAGE_WRITE_TRIES_MAX = 4;

const writeRecord = z.enum(STORAGE_WRITE_RECORDS);

export const STORAGE_TELEMETRY_PAYLOADS = {
  'storage.read_failed': z
    .object({
      record: z.enum(STORAGE_RECORDS),
      cause: z.enum(STORAGE_READ_CAUSES),
      /** The damaged bytes were copied aside (`progress-corrupt:<id>`, `profiles-corrupt`); only ever with `parse`. */
      kept: z.boolean(),
    })
    .strict(),
  'storage.write_failed': z.object({ record: writeRecord }).strict(),
  'storage.write_recovered': z.object({ record: writeRecord, tries: z.number().int().min(1).max(STORAGE_WRITE_TRIES_MAX) }).strict(),
} as const satisfies Partial<Record<TelemetryEventName, z.AnyZodObject>>;

export type StorageTelemetryName = keyof typeof STORAGE_TELEMETRY_PAYLOADS;
export type StorageTelemetryPayload<N extends StorageTelemetryName> = z.infer<(typeof STORAGE_TELEMETRY_PAYLOADS)[N]>;
export type StorageRecord = (typeof STORAGE_RECORDS)[number];
export type StorageReadCause = (typeof STORAGE_READ_CAUSES)[number];
export const STORAGE_TELEMETRY_NAMES = Object.keys(STORAGE_TELEMETRY_PAYLOADS) as StorageTelemetryName[];
