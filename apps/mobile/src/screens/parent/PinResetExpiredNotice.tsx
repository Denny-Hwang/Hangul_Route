import { Body, colors, radii, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { usePinResetNotice } from '../../store/pin-reset-notice';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 5 (row OA-6; mock `design/screens/profiles/pin-entry-v2.md`
 * board 10): over the normal start, once, when the console's sign-in reset ticket was refused: "That took a while.
 * Sign in again to set a new PIN." A polite status in an info notice (`feedback.infoLight`, `text.primary`), never a
 * warning colour and no button: Forgot PIN? is where a grown-up starts again. It stays while this screen is mounted
 * and is gone on the next visit.
 */
export function PinResetExpiredNotice(): React.ReactElement | null {
  const m = useMessages().caregiver.pin.reset.signIn;
  const expired = usePinResetNotice((s) => s.expired);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!expired) return;
    setShown(true);
    usePinResetNotice.getState().takeExpired();
  }, [expired]);
  if (!shown && !expired) return null;
  return (
    <View
      testID="pin-reset-expired"
      role="status"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.feedback.infoLight, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg }}
    >
      <Body>{m.expired}</Body>
    </View>
  );
}
