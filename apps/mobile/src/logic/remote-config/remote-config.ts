/**
 * Remote config on the device (F-CURR-002 section 12.2, the switch list, and section 11.4 for the per-profile bucket;
 * row CM-2). Pure: the store (`store/remote-config-store.ts`) fetches `GET /api/config` and keeps the last copy, and
 * `config/flags.ts` holds each flag's build-time floor and built-in pct.
 *
 * Rules:
 * - **Remote can only reduce.** A flag the build has off is off whatever the remote says. The remote `on: false` or a
 *   lower `pct` turns a feature off or narrows it.
 * - **Value order.** The last known remote copy (fetched, or stored when offline); a flag that copy does not name, or
 *   no copy at all (never fetched), uses the flag's built-in pct.
 * - **Bucket.** `hash(profileId + flag) mod 100` on the device, per profile, with no new identifier: a profile is in
 *   when its bucket is below the pct, so widening a ramp keeps everyone who was already in.
 * - Anything the device cannot read fails toward off: a damaged entry is `{ on: false, pct: 0 }`.
 */

export interface RemoteFlagValue {
  on: boolean;
  /** 0-100. */
  pct: number;
}

/** The stored copy (`hr:remote-config`). `v` is the shape version; another value reads as never fetched. */
export interface RemoteConfigCache {
  v: 1;
  /** Epoch ms of the fetch that produced this copy (device clock). */
  fetchedAt: number;
  /** The response's `max-age`, in seconds. */
  maxAgeS: number;
  flags: Record<string, RemoteFlagValue>;
}

/** Refetch on foreground once the copy is at least this old (section 12.2). */
export const REFETCH_MIN_AGE_MS = 15 * 60 * 1000;
/** The longest `max-age` honoured, so a bad header can never freeze the config on a device. */
export const MAX_HONOURED_MAX_AGE_S = 6 * 60 * 60;
/** The server's `max-age` (packages/backend routes/config.ts), used when a response carries none. */
export const DEFAULT_MAX_AGE_S = 300;

/** The same name rule the Worker serves (`REMOTE_FLAG_NAME`, packages/backend db/remote-config-types.ts). */
const FLAG_NAME = /^[a-z][A-Za-z0-9]{0,47}(\.[a-z0-9][a-z0-9_-]{0,47})?$/;

const OFF: RemoteFlagValue = { on: false, pct: 0 };

/**
 * FNV-1a, 32-bit, over UTF-16 code units; unsigned. Frozen here (not shared with the story shuffle) because a change
 * would move learners between ramp arms.
 */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The profile's bucket for a flag, 0-99 (section 11.4): `hash(profileId + flag) mod 100`. */
export function bucketOf(profileId: string, flag: string): number {
  return fnv1a32(profileId + flag) % 100;
}

/** A pack flag also needs `topicPacks` (section 12.2, "What off does"); no other flag has a parent. */
export function parentFlagOf(flag: string): string | null {
  return flag.startsWith('pack.') ? 'topicPacks' : null;
}

/** The copy's value for a flag (own keys only), or undefined when the copy does not name it. */
export function remoteFlagValue(remote: Readonly<Record<string, RemoteFlagValue>> | null, flag: string): RemoteFlagValue | undefined {
  if (!remote || !Object.prototype.hasOwnProperty.call(remote, flag)) return undefined;
  return remote[flag];
}

export interface ResolveInput {
  flag: string;
  /** The build-time floor (`parseKillSwitch` on the flag's `EXPO_PUBLIC_*` variable). */
  buildOn: boolean;
  /** The flag's built-in pct, used when the copy does not name the flag or there is no copy. */
  builtInPct: number;
  /** The last known remote copy's flags, or null when never fetched. */
  remote: Readonly<Record<string, RemoteFlagValue>> | null;
  /** The active profile, or null before one exists (then only 0 and 100 decide). */
  profileId: string | null;
}

/** Whether one flag is on for this profile. Never true where the build has it off. */
export function resolveRemoteFlag({ flag, buildOn, builtInPct, remote, profileId }: ResolveInput): boolean {
  if (!buildOn) return false;
  const entry = remoteFlagValue(remote, flag);
  const pct = entry ? (entry.on ? entry.pct : 0) : builtInPct;
  if (!(pct > 0)) return false;
  if (pct >= 100) return true;
  if (!profileId) return false;
  return bucketOf(profileId, flag) < pct;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readValue(raw: unknown): RemoteFlagValue {
  if (!isRecord(raw) || typeof raw.on !== 'boolean' || typeof raw.pct !== 'number' || !Number.isFinite(raw.pct)) return OFF;
  return { on: raw.on, pct: Math.min(100, Math.max(0, Math.floor(raw.pct))) };
}

/** Valid names only; an entry that does not read is off. */
function readFlags(raw: Record<string, unknown>): Record<string, RemoteFlagValue> {
  const out: Record<string, RemoteFlagValue> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (FLAG_NAME.test(name)) out[name] = readValue(value);
  }
  return out;
}

/** The flags of a `GET /api/config` body (`{ ok: true, data: { flags } }`), or null when the body does not read. */
export function parseConfigBody(body: unknown): Record<string, RemoteFlagValue> | null {
  if (!isRecord(body) || body.ok !== true || !isRecord(body.data) || !isRecord(body.data.flags)) return null;
  return readFlags(body.data.flags);
}

/** `max-age` in seconds from a Cache-Control header, or null. */
export function parseMaxAge(cacheControl: string | null | undefined): number | null {
  const m = /(?:^|[,\s])max-age=(\d+)/i.exec(cacheControl ?? '');
  return m ? Number(m[1]) : null;
}

/** Whether a foreground should refetch: no copy, a copy at least 15 minutes old and past its max-age, or a clock moved back. */
export function refetchDue(cache: RemoteConfigCache | null, nowMs: number): boolean {
  if (!cache) return true;
  const age = nowMs - cache.fetchedAt;
  if (age < 0) return true;
  const maxAgeMs = Math.min(cache.maxAgeS, MAX_HONOURED_MAX_AGE_S) * 1000;
  return age >= Math.max(REFETCH_MIN_AGE_MS, maxAgeMs);
}

/** A stored copy read back, or null (damaged, or another shape version) so the device counts as never fetched. */
export function parseStoredConfig(stored: unknown): RemoteConfigCache | null {
  if (!isRecord(stored) || stored.v !== 1) return null;
  const { fetchedAt, maxAgeS, flags } = stored;
  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt)) return null;
  if (typeof maxAgeS !== 'number' || !Number.isFinite(maxAgeS) || maxAgeS < 0) return null;
  if (!isRecord(flags)) return null;
  return { v: 1, fetchedAt, maxAgeS, flags: readFlags(flags) };
}
