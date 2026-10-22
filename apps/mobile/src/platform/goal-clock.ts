import { cappedNow, readServerTime, type ServerClockSeen } from '../logic/goals/server-clock';
import { readJson, writeJson } from './storage';

/*
 * The last server time seen, on the device (F-CURR-002 section 13, row CM-17): `meta.serverTime` of every API
 * answer, kept in memory and in the storage wrapper (`hr:goals:server-clock`), so a write of `goals`, `dayLog`,
 * `streakLocal` or `steadyWeeks` is never dated later than the server's clock carried forward
 * (`logic/goals/server-clock.ts`). The install key is in `install-key.ts`.
 */

const CLOCK_KEY = 'goals:server-clock';

let seen: ServerClockSeen | null = null;
let clockRead: Promise<void> | null = null;

function isSeen(v: unknown): v is ServerClockSeen {
  return typeof v === 'object' && v !== null && Number.isFinite((v as ServerClockSeen).serverMs) && Number.isFinite((v as ServerClockSeen).deviceMs);
}

/** Reads the stored reading once; a reading seen in this session wins over it. */
export function loadGoalClock(): Promise<void> {
  if (clockRead) return clockRead;
  clockRead = (async () => {
    const stored = await readJson<unknown>(CLOCK_KEY);
    if (seen === null && isSeen(stored)) seen = stored;
  })().catch(() => undefined);
  return clockRead;
}

/** Called with every API answer's `meta.serverTime`; a value that does not parse is ignored. */
export function noteServerTime(serverTime: unknown, deviceNow: Date = new Date()): void {
  const reading = readServerTime(serverTime, deviceNow);
  if (reading === null) return;
  seen = reading;
  void writeJson(CLOCK_KEY, reading).catch(() => undefined);
}

/** The time a goals write uses: the device clock, capped at the last server time seen carried forward. */
export function goalNow(deviceNow: Date = new Date()): Date {
  return cappedNow(deviceNow, seen);
}

/** Test seam. */
export function resetGoalClockForTests(): void {
  seen = null;
  clockRead = null;
}
