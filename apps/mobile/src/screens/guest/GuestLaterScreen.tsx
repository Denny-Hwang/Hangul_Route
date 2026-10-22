import { Button, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { ROOT_HEADER } from '../../navigation/screen-header-variants';
import type { GuestStackParamList } from '../../navigation/types';
import { leaveGuestRun } from './guest-exits';

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestLater'>;

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 8.6 (row GU-3 registers it; row GU-4 draws the card of
 * `design/screens/onboarding/guest-save.md` D9 with its days, its lines, **Add my name** and `guest.left { at: 'save' }`):
 * the Not now card, where Results' Back and a reopen of a done quest land. Until GU-4 it holds Hoya and its one way
 * out, **Close** (filled), which ends the run (the record stays) for Welcome with the waiting card, or the chooser.
 * Its header has no leading control and keeps the Display control, as "Who is using this?" does.
 */
export function GuestLaterScreen({ navigation }: Props): React.ReactElement {
  const m = useMessages();
  return (
    <Screen tone="canvas" header={ROOT_HEADER} testID="guest-later">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl }}>
        <Hoya pose="waving" size={140} accessibilityLabel={m.a11y.hoya('waving')} />
      </View>
      <Spacer size="lg" />
      <Button label={m.common.buttons.close} tone="primary" size="hero" fullWidth onPress={() => leaveGuestRun(navigation, null)} testID="guest-later-close" />
      <Spacer size="lg" />
    </Screen>
  );
}
