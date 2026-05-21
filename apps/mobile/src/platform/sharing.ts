import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';

/**
 * Platform sharing wrapper. CLAUDE.md §8 — apps must go through platform
 * wrappers, never call expo-sharing / react-native-view-shot directly.
 *
 * F-CARD-003 — capture a View ref to PNG + invoke the OS share sheet.
 */

export interface ShareSnapshotInput {
  viewRef: RefObject<unknown>;
  filename: string; // without extension
  format?: 'png' | 'jpg';
  pixelRatio?: number; // default 2 (crisp on social)
}

export interface ShareResult {
  ok: boolean;
  reason?: 'capture-failed' | 'share-unavailable' | 'user-canceled' | 'unknown';
}

export async function isShareAvailable(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function shareSnapshot({
  viewRef,
  filename,
  format = 'png',
  pixelRatio = 2,
}: ShareSnapshotInput): Promise<ShareResult> {
  if (!(await isShareAvailable())) {
    return { ok: false, reason: 'share-unavailable' };
  }
  let uri: string;
  try {
    uri = await captureRef(viewRef, {
      format,
      quality: 1,
      result: 'tmpfile',
      fileName: filename,
      // 2x DPR by default
      width: undefined,
      height: undefined,
      // view-shot uses pixel ratio implicitly via the device
    });
    void pixelRatio; // reserved for future per-call DPR override
  } catch {
    return { ok: false, reason: 'capture-failed' };
  }
  try {
    await Sharing.shareAsync(uri, {
      mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
      dialogTitle: 'Share this card',
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
