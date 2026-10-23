import { Body, Button, Heading, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { guestSaveGate, guestTtlDays } from '../../logic/guest/guest-model';
import { guestLaterCard } from '../../logic/guest/guest-save-cards';
import { guestSaveTarget } from '../../logic/guest/guest-save';
import { ROOT_HEADER } from '../../navigation/screen-header-variants';
import type { GuestStackParamList } from '../../navigation/types';
import { focusForScreenReader } from '../../platform/screen-reader';
import { useAccountStore } from '../../store/account-store';
import { noteGuestSaveEntry } from '../../store/guest-save';
import { useProfileStore } from '../../store/profile-store';
import { useBackGuard } from '../use-back-guard';
import { leaveGuestRun, openGuestSave } from './guest-exits';

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestLater'>;

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 8.6 (row GU-3 registers it; row GU-4 draws the card of
 * `design/screens/onboarding/guest-save.md` D9): the Not now card, where Results' Not now and Back and a reopen of a
 * done quest land. Hoya, the heading **Hoya can keep your quest in this browser for up to {days} days without play.**
 * (`guestTtlDays`: 30, or 7 on a device that holds learner profiles; it takes focus when the card opens), the line
 * **It isn't backed up yet…**, **Add my name** (the save, section 8.2) and **Close** (outlined), which ends the run (the
 * record stays) for Welcome with the waiting card, or the chooser. On a device someone else uses (`owner`) the
 * ask-the-owner line takes the place of the line and Add my name, and Close is the one filled button. Nothing here
 * counts down or removes anything. Its header has no leading control and keeps the Display control, as "Who is using
 * this?" does. It replaced Results in history (Results' Back is a `replace`), and the browser's or the phone's back
 * here does what Close does.
 */
export function GuestLaterScreen({ navigation }: Props): ReactElement {
  const m = useMessages();
  const g = m.learner.guest;
  const profiles = useProfileStore((s) => s.profiles);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const card = guestLaterCard(guestSaveGate({ profiles, parentPinHash }));
  const headingRef = useRef<object | null>(null);
  const close = (): void => leaveGuestRun(navigation, null);
  const save = (): void => {
    noteGuestSaveEntry('later');
    openGuestSave(navigation, guestSaveTarget({ profiles, parentPinHash }));
  };
  useBackGuard(navigation, () => {
    close();
    return true;
  }, true);
  // Section 14: the heading is the first thing read when the card opens.
  useEffect(() => {
    focusForScreenReader(headingRef.current);
  }, []);
  return (
    <Screen tone="canvas" header={ROOT_HEADER} testID="guest-later">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl }}>
        <Hoya pose="idle" size={140} accessibilityLabel={m.a11y.hoya('idle')} />
        <Spacer size="lg" />
        <View
          ref={(node) => {
            headingRef.current = node;
          }}
          focusable
          testID="guest-later-heading"
        >
          <Heading level="prompt" align="center">
            {g.later.title(guestTtlDays(profiles))}
          </Heading>
        </View>
        <Spacer size="sm" />
        <Body tone="secondary" align="center" testID="guest-later-line">
          {card.line === 'line' ? g.later.line : g.results.askOwner}
        </Body>
      </View>
      <Spacer size="lg" />
      {card.save ? (
        <>
          <Button label={g.later.save} tone="primary" size="hero" fullWidth onPress={save} testID="guest-later-save" />
          <Spacer size="sm" />
        </>
      ) : null}
      <Button label={g.later.close} tone={card.close === 'filled' ? 'primary' : 'ghost'} size={card.close === 'filled' ? 'hero' : 'md'} fullWidth onPress={close} testID="guest-later-close" />
      <Spacer size="lg" />
    </Screen>
  );
}
