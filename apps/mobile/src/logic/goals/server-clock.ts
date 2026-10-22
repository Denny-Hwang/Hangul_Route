/*
 * The last server time seen (F-CURR-002 section 13, "A wrong device clock wins every merge"; row CM-17). Pure.
 *
 * The Worker bounds what a wrong clock sends, but the device keeps its own value and would send it again on
 * every sync. So every write of `goals`, `dayLog` and `streakLocal` (and the `steadyWeeks` latch) takes its
 * time from `cappedNow`: the device clock, never later than the server's clock as last seen, carried forward
 * by the device time that has passed since. A device clock set years ahead then writes today; a clock that
 * is right, or slow, is used as it is. Before any server time has been seen the device clock is used.
 */

export interface ServerClockSeen {
  /** The server's `meta.serverTime`, epoch ms. */
  serverMs: number;
  /** The device clock when that answer arrived, epoch ms. */
  deviceMs: number;
}

/** A reading from an envelope's `meta.serverTime`; null when it does not parse. */
export function readServerTime(serverTime: unknown, deviceNow: Date): ServerClockSeen | null {
  if (typeof serverTime !== 'string') return null;
  const serverMs = Date.parse(serverTime);
  const deviceMs = deviceNow.getTime();
  return Number.isFinite(serverMs) && Number.isFinite(deviceMs) ? { serverMs, deviceMs } : null;
}

/**
 * The time to write: the device clock, capped at the server's clock carried forward. A device clock that
 * moved back since the reading carries nothing forward (the cap is then the server time seen).
 */
export function cappedNow(deviceNow: Date, seen: ServerClockSeen | null): Date {
  const device = deviceNow.getTime();
  if (seen === null || !Number.isFinite(device)) return deviceNow;
  const cap = seen.serverMs + Math.max(0, device - seen.deviceMs);
  return device > cap ? new Date(cap) : deviceNow;
}
