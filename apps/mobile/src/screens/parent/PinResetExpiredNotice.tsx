import { Body, colors, radii, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { expiredNoticeLive, usePinResetNotice } from '../../store/pin-reset-notice';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 5 (row OA-6; mock `design/screens/profiles/pin-entry-v2.md`
 * board 10): over the normal start, once, when the console's sign-in reset ticket was refused: "That took a while.
 * Sign in again to set a new PIN." A polite status in an info notice (`feedback.infoLight`, `text.primary`), never a
 * warning colour and no button: Forgot PIN? is where a grown-up starts again. It stays while this screen is mounted
 * and is gone on the next visit. A line raised for a boot that started elsewhere has gone stale by the time Home first
 * renders (`expiredNoticeLive`): it is taken and not shown.
 */
export function PinResetExpiredNotice(): React.ReactElement | null {
  const m = useMessages().caregiver.pin.reset.signIn;
  const expiredAt = usePinResetNotice((s) => s.expiredAt);
  const [shown, setShown] = useState(false);
  const live = expiredNoticeLive(expiredAt, Date.now());
  useEffect(() => {
    if (expiredAt === null) return;
    if (expiredNoticeLive(expiredAt, Date.now())) setShown(true);
    usePinResetNotice.getState().takeExpired();
  }, [expiredAt]);
  const visible = shown || live;
  // [OA] Row OA-6 review round 2: many screen readers do not announce a live region's text that exists when the region
  // is created, so the status mounts empty and the line goes in on the next turn, as a change the reader announces.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => setFilled(true), 0);
    return () => clearTimeout(timer);
  }, [visible]);
  if (!visible) return null;
  return (
    <View
      testID="pin-reset-expired"
      role="status"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.feedback.infoLight, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg }}
    >
      {filled ? <Body>{m.expired}</Body> : null}
    </View>
  );
}
