import { Body, Button, colors, radii, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { resetByWaitNoticeDue } from '../../logic/profiles/pin-reset';
import { useAccountStore } from '../../store/account-store';
import { useUiStore } from '../../store/ui-store';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D21 (section 8.5; mock `design/screens/profiles/pin-entry-v2.md` board
 * 11): at the top of the Grown-up area, once, after a PIN set by the finished 24-hour wait: "The grown-up PIN was
 * changed after the 24-hour wait. If that was not you, change it now." with **Change PIN**. Shown only at an entry
 * after a PIN entered later than that reset (never at the setup itself); the record is cleared as soon as it shows.
 * An info notice (`feedback.infoLight`, `text.primary`), never a warning colour.
 */
export function ResetByWaitNotice({ onChange }: { onChange: () => void }): React.ReactElement | null {
  const m = useMessages().caregiver.pin;
  const [due] = useState(() => resetByWaitNoticeDue(useAccountStore.getState().pinResetByWait, useUiStore.getState().lastPinVerifiedAt));
  // Once Change PIN is pressed the notice has done its job: it is gone when the grown-up comes back here.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (due) useAccountStore.getState().clearPinResetByWait();
  }, [due]);
  if (!due || dismissed) return null;
  return (
    <View
      testID="dashboard-reset-by-wait"
      style={{ backgroundColor: colors.feedback.infoLight, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}
    >
      <Body>{m.resetByWaitNotice}</Body>
      <Button
        label={m.resetByWaitChange}
        tone="primary"
        size="md"
        onPress={() => {
          setDismissed(true);
          onChange();
        }}
      />
    </View>
  );
}
