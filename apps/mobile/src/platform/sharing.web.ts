import type { RefObject } from 'react';

/**
 * Web variant of the sharing wrapper. react-native-view-shot has no web
 * implementation, so snapshot sharing is reported unavailable and the Share
 * button stays hidden (F-CARD-003 §3.4 "sharing unavailable" path). A
 * canvas-based capture + Web Share API is the follow-up (roadmap §2).
 */
export interface ShareSnapshotInput {
  viewRef: RefObject<unknown>;
  filename: string;
  format?: 'png' | 'jpg';
  pixelRatio?: number;
}

export interface ShareResult {
  ok: boolean;
  reason?: 'capture-failed' | 'share-unavailable' | 'user-canceled' | 'unknown';
}

export async function isShareAvailable(): Promise<boolean> {
  return false;
}

export async function shareSnapshot(_input: ShareSnapshotInput): Promise<ShareResult> {
  return { ok: false, reason: 'share-unavailable' };
}
