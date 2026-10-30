import { Body, Button, Spacer } from '@hangul-route/design-system';
import { useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { fallbackScope } from '../../logic/syllable-build/fallback';
import type { MinigameHost } from './host';
import { ListenPickGame } from './ListenPickGame';
import { SyllableBuildGame } from './SyllableBuildGame';

/**
 * What a `syllable-build` quest step plays (F-CURR-002 sections 7.1 F3 and 12.2, row CM-32), in the Syllable Build chunk:
 * the game while `game.syllable-build` is on; while it is off, **Listen & Pick on the built block** (`fallbackScope`,
 * drawn by the shipped Listen & Pick, its answers read from its own scope), so no switch bricks a quest. The switch is
 * read once by the entry (`SyllableBuildStep`), so a remote copy arriving mid-step never swaps the game.
 */
export interface SyllableBuildStepBodyProps {
  scope: MinigameScope;
  hostFor: (played: MinigameScope) => MinigameHost;
  onBack: () => void;
  on: boolean;
}

export function SyllableBuildStepBody({ scope, hostFor, onBack, on }: SyllableBuildStepBodyProps): ReactElement {
  const [played] = useState(() => (on ? scope : fallbackScope(scope)));
  if (on) return <SyllableBuildGame scope={scope} host={hostFor(scope)} onBack={onBack} />;
  return <ListenPickGame scope={played} host={hostFor(played)} onBack={onBack} />;
}

/** The Block Sprint's bonus line and button (after Stage 1), drawn by the entry's `DecodingSprintOffer` while `decodingSprint` is on. */
export function SprintOffer({ onOpen, testID }: { onOpen: () => void; testID: string }): ReactElement {
  const copy = useMessages().learner.decodingSprint;
  return (
    <View testID={testID}>
      <Spacer size="sm" />
      <Body tone="secondary">{copy.offer}</Body>
      <Spacer size="xs" />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label={copy.title} tone="secondary" size="md" onPress={onOpen} testID={`${testID}-cta`} />
      </View>
    </View>
  );
}
