import { Body, Card, Spacer } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { challengeSettings, scaleOnOptIn } from '../../logic/vocab/challenge';
import { isScreenReaderEnabled } from '../../platform/screen-reader';
import { useLocaleStore } from '../../store/locale-store';
import { ScaleChips, SwitchRow } from './ChallengeControls';

/**
 * The Profile's Challenge card (F-VOC-004 S8, §3.8; PR S-6): the one Challenge
 * switch of the app, so a learner can leave Challenge at any time, and while
 * it is on the clock length. Not behind the grown-up gate (the learner's own,
 * reversible setting). Shown only where Words is offered (ProfileScreen).
 * Design: design/screens/vocab/speed-round.md "Profile: the Challenge card".
 */
export function ChallengeCard({ profileId }: { profileId: string }): React.ReactElement {
  const messages = useMessages();
  const copy = messages.learner.vocab.speed.challenge;
  const settings = useLocaleStore((s) => s.byProfile[profileId]);
  const setChallengeMode = useLocaleStore((s) => s.setChallengeMode);
  const setClockScale = useLocaleStore((s) => s.setClockScale);
  const { on, scale } = challengeSettings(settings);
  // Turning Challenge on here pre-selects 2x for a screen reader too, as the start sheet does (§3.8, behaviour 9).
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  const [readerScale, setReaderScale] = useState(false);
  useEffect(() => {
    let live = true;
    void isScreenReaderEnabled().then((reader) => {
      if (live) setScreenReader(reader);
    });
    return () => {
      live = false;
    };
  }, []);
  const toggle = async (): Promise<void> => {
    if (on) {
      setReaderScale(false);
      setChallengeMode(profileId, false, 'profile');
      return;
    }
    const next = scaleOnOptIn(scale, screenReader ?? (await isScreenReaderEnabled()));
    setChallengeMode(profileId, true, 'profile', next);
    setReaderScale(next !== scale);
  };

  return (
    <Card padding="md" testID="profile-challenge">
      <SwitchRow
        title={copy.profile.title}
        line={copy.profile.line}
        on={on}
        onLabel={copy.profile.on}
        offLabel={copy.profile.off}
        onToggle={() => void toggle()}
        testID="profile-challenge-switch"
      />
      {on ? (
        <View>
          <Spacer size="sm" />
          <ScaleChips
            scale={scale}
            onSelect={(next) => {
              setReaderScale(false);
              setClockScale(profileId, next, 'profile');
            }}
            copy={copy}
            groupLabel={messages.a11y.vocab.speed.scales}
            testID="profile-challenge-scale"
          />
          <View accessibilityLiveRegion="polite">
            {readerScale ? <Body tone="secondary">{copy.screenReaderLine}</Body> : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
}
