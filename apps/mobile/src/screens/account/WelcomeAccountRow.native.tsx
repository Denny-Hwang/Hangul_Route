import { Body, Button, borderWidth, colors, spacing } from '@hangul-route/design-system';
import { useMemo, type ReactElement } from 'react';
import { View } from 'react-native';
import { nativeSignInConfig } from '../../config/native-signin';
import { useMessages } from '../../i18n/use-messages';
import { useAccountStore } from '../../store/account-store';
import type { EntryNavigation } from './account-entries';
import { openAccountEntry } from './account-entries.native';
import { useAccountOnline } from './account-session.native';

/**
 * F-AUTH-004 section 7.1 (Welcome's row), ND-9 and CS-N14, design `entries.md` boards 8 and 9 (row NS-4): on iOS and
 * Android, under **I already have progress**, the lead "Here to support a learner?" and **one** outlined button,
 * **Sign in as a grown-up**; **Let's start** stays the only filled button. Never a use row: a device with no learner
 * profile keeps no session (ND-9), so every visit starts with a sign-in. Offline the button waits, with **Needs the
 * internet** under it as its description (board 9). It draws nothing while the native account is off (CS-N13).
 *
 * Reached from Welcome only through an `EXPO_OS` test the web build folds away. The press goes where a chooser row
 * goes (`openAccountEntry`): with no PIN, the sign-in, inside its AccountGate, which decides on the exact gate state
 * (a profile-read failure at boot reads `unknown` there and opens nothing, CS-N14).
 */
export function WelcomeAccountRow({ navigation }: { navigation: EntryNavigation | undefined }): ReactElement | null {
  const m = useMessages();
  const enabled = useMemo(() => nativeSignInConfig().enabled, []);
  // CS-N13: with the native account off nothing is subscribed.
  const online = useAccountOnline(enabled);
  if (!enabled) return null;
  const hint = online ? undefined : m.learner.welcome.grownUps.needsInternet;
  const press = (): void => {
    if (!online || navigation === undefined) return;
    // A PIN on this device: the typed PIN first (CS-N11). Otherwise the sign-in at once: Welcome's device has no learner
    // profile, so its exact gate state is `open` (the chooser's in-memory marker would read `nopin` there); a live
    // guest's `nopin`, or a state that cannot be read, is the sign-in's AccountGate's to decide (setup, or nothing).
    openAccountEntry(navigation, 'signin', useAccountStore.getState().parentPinHash !== null ? 'pin' : 'none');
  };
  return (
    <View
      testID="welcome-account"
      style={{
        alignSelf: 'stretch',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
        paddingTop: spacing.md,
        borderTopWidth: borderWidth.thin,
        borderTopColor: colors.border.subtle,
      }}
    >
      <Body tone="secondary" align="center">
        {m.learner.welcome.grownUps.lead}
      </Body>
      <View style={{ alignSelf: 'stretch' }}>
        <Button label={m.learner.who.use.signIn} tone="ghost" size="md" fullWidth disabled={!online} accessibilityHint={hint} onPress={press} testID="welcome-account-sign-in" />
      </View>
      {online ? null : (
        <Body tone="secondary" size="sm" align="center" testID="welcome-account-offline">
          {m.learner.welcome.grownUps.needsInternet}
        </Body>
      )}
    </View>
  );
}

/** The web twin's shape is this module's: callers are type-checked against the twin (no `moduleSuffixes`). */
export const NATIVE_SHAPE: typeof import('./WelcomeAccountRow') = { WelcomeAccountRow };
