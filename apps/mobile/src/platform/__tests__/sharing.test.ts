import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));
vi.mock('react-native-view-shot', () => ({
  captureRef: vi.fn(async () => 'file:///tmp/card.png'),
}));

import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { isShareAvailable, shareSnapshot } from '../sharing';

const input = { viewRef: { current: {} }, filename: 'card-tiger' };

describe('platform/sharing (F-CARD-003 wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    vi.mocked(captureRef).mockResolvedValue('file:///tmp/card.png');
  });

  it('captures the view and opens the share sheet with a png mime type', async () => {
    const result = await shareSnapshot(input);
    expect(result).toEqual({ ok: true });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///tmp/card.png',
      expect.objectContaining({ mimeType: 'image/png' }),
    );
  });

  it('jpg format shares with an image/jpeg mime type', async () => {
    await shareSnapshot({ ...input, format: 'jpg' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///tmp/card.png',
      expect.objectContaining({ mimeType: 'image/jpeg' }),
    );
  });

  it('reports share-unavailable without capturing when the OS has no share sheet', async () => {
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    expect(await shareSnapshot(input)).toEqual({ ok: false, reason: 'share-unavailable' });
    expect(captureRef).not.toHaveBeenCalled();
  });

  it('reports capture-failed when the view snapshot throws', async () => {
    vi.mocked(captureRef).mockRejectedValueOnce(new Error('boom'));
    expect(await shareSnapshot(input)).toEqual({ ok: false, reason: 'capture-failed' });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('reports unknown when the share sheet itself rejects', async () => {
    vi.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('nope'));
    expect(await shareSnapshot(input)).toEqual({ ok: false, reason: 'unknown' });
  });

  it('isShareAvailable returns false when the probe throws', async () => {
    vi.mocked(Sharing.isAvailableAsync).mockRejectedValueOnce(new Error('bridge'));
    expect(await isShareAvailable()).toBe(false);
  });
});
