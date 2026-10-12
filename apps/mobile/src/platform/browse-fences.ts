import { BROWSE_EVENT_NAMES } from '@hangul-route/content-schema';
import { setWriteFence } from './storage-fence';
import { configureTelemetryQueue, setTelemetryFence } from './telemetry';

/**
 * What the All lessons root (`/browse`) may write and send (F-BROWSE-001
 * section 4.10). It reuses learner screens, so these fences are the layer
 * that holds even when a reused screen tries to save progress or report a
 * learner event: nothing it does can reach a learner's record, queue or
 * streak.
 */

/** Browse's own telemetry queue; the learner queue (`telemetry:queue`) is never touched. */
export const BROWSE_TELEMETRY_QUEUE_KEY = 'browse:telemetry-queue';

/**
 * The only storage keys Browse writes: the kept pass and Lesson display
 * settings (keep switch only), its telemetry queue, and the device mute
 * (`AUDIO_PREFS_KEY`, the trade-off F-TCH-004 section 8 records).
 */
export const BROWSE_WRITABLE_KEYS = ['browse:pass', 'browse:prefs', BROWSE_TELEMETRY_QUEUE_KEY, 'device:audio'] as const;

const WRITABLE: ReadonlySet<string> = new Set(BROWSE_WRITABLE_KEYS);
const EVENT_NAMES: ReadonlySet<string> = new Set(BROWSE_EVENT_NAMES);

export function isBrowseWritableKey(key: string): boolean {
  return WRITABLE.has(key);
}

/** Only the five `browse.*` names (section 9); learner events from reused screens are dropped. */
export function isBrowseEventName(name: string): boolean {
  return EVENT_NAMES.has(name);
}

/** The browse root's boot step, before any write or event: write fence, telemetry fence, own queue. */
export function applyBrowseFences(): void {
  setWriteFence(isBrowseWritableKey);
  setTelemetryFence(isBrowseEventName);
  configureTelemetryQueue(BROWSE_TELEMETRY_QUEUE_KEY);
}
