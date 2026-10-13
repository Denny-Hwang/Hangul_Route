import { Card, Spacer } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { challengeSettings } from '../../logic/vocab/challenge';
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

  return (
    <Card padding="md" testID="profile-challenge">
      <SwitchRow
        title={copy.profile.title}
        line={copy.profile.line}
        on={on}
        onLabel={copy.profile.on}
        offLabel={copy.profile.off}
        onToggle={() => setChallengeMode(profileId, !on, 'profile')}
        testID="profile-challenge-switch"
      />
      {on ? (
        <View>
          <Spacer size="sm" />
          <ScaleChips
            scale={scale}
            onSelect={(next) => setClockScale(profileId, next, 'profile')}
            copy={copy}
            groupLabel={messages.a11y.vocab.speed.scales}
            testID="profile-challenge-scale"
          />
        </View>
      ) : null}
    </Card>
  );
}
