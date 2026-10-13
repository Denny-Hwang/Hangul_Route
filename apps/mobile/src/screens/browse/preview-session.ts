import { previewEndedEvent, previewStartedEvent, type PreviewKind } from '../../logic/browse/preview';
import { sendBrowseEvent } from './browse-ui';

/**
 * The preview under way in this tab (F-BROWSE-001 section 9), memory only:
 * `beginPreview` sends `browse.preview_started` when a grown-up presses a
 * preview button and starts the clock; `endPreview` sends
 * `browse.preview_ended` once, from the end screen (`reachedEnd`) or when the
 * preview is left early. Nothing here is stored, and no event names a person.
 */
let current: { kind: PreviewKind; itemId: string; startedAt: number } | null = null;

export function beginPreview(kind: PreviewKind, itemId: string, now: number = Date.now()): void {
  current = { kind, itemId, startedAt: now };
  sendBrowseEvent(previewStartedEvent(kind, itemId));
}

/** Sends the end of the preview under way, once; a second call (or none started) does nothing. */
export function endPreview(reachedEnd: boolean, now: number = Date.now()): void {
  const run = current;
  if (!run) return;
  current = null;
  sendBrowseEvent(previewEndedEvent({ ...run, reachedEnd, now }));
}
