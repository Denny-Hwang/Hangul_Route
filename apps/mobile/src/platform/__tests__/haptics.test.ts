import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success' },
}));

import * as Haptics from 'expo-haptics';
import { nudge, setHapticsEnabled, success, tapLight, tapMedium } from '../haptics';

describe('platform/haptics (anti-startle wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHapticsEnabled(true);
  });

  it('tapLight / tapMedium fire impact with the matching style', () => {
    tapLight();
    tapMedium();
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, 'light');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'medium');
  });

  it('success fires a success notification, nudge fires a Soft impact (never heavy)', () => {
    success();
    nudge();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('soft');
  });

  it('setHapticsEnabled(false) silences every haptic', () => {
    setHapticsEnabled(false);
    tapLight();
    tapMedium();
    success();
    nudge();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
