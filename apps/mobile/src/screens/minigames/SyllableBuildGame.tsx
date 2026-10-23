import { Body, Button, Heading, Pill, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { partsOf } from '../../logic/syllable-build/pool';
import { shuffled } from '../../logic/syllable-build/tiles';
import type { MinigameHost } from './host';
import { SyllableBuildBoard } from './SyllableBuildBoard';

/**
 * Syllable Build in a quest step (F-CURR-002 section 7.1 F3, row CM-32; design/wireframes/minigame/syllable-build.md,
 * layout A of minigame/shell.md): the compact top row (the count, the heading, Skip), then one board a round. Each
 * round's tiles are its authored rows, in a fresh order a mount. The first full block of a round goes to the host
 * (`answer`, with the hint flag of Show how it sounds); the step completes after the last round, or on Skip, which
 * records nothing more. Played only while `game.syllable-build` is on (`syllable-build-entry.tsx`); off, the step is
 * Listen & Pick on the block.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
}

export function SyllableBuildGame({ scope, host, onBack }: Props): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(
    () =>
      (scope.syllableBuild?.rounds ?? [])
        .filter((r) => partsOf(r.target.ko) !== null)
        .map((r, i) => ({
          ...r,
          firstTiles: shuffled(r.firstTiles, seed + 3 * i),
          vowelTiles: shuffled(r.vowelTiles, seed + 3 * i + 1),
          finalTiles: shuffled(r.finalTiles, seed + 3 * i + 2),
        })),
    [scope, seed],
  );
  const [index, setIndex] = useState(0);
  const done = useRef(false);
  const complete = (): void => {
    if (done.current) return;
    done.current = true;
    host.complete();
  };

  const round = rounds[index];
  if (round === undefined) {
    return (
      <Screen>
        <Body>{copy.listenPick.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" testID="syllable-build-game">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pill label={copy.progress.pill(index + 1, rounds.length)} size="sm" />
        <View style={{ flex: 1 }}>
          <Heading level="prompt">{copy.syllableBuild.heading}</Heading>
        </View>
        <Button label={copy.skip.cta} tone="ghost" size="md" onPress={complete} testID="syllable-build-skip" />
      </View>
      <Spacer size="md" />
      <SyllableBuildBoard
        key={round.id}
        target={{
          ko: round.target.ko,
          romanization: round.target.romanization,
          ...(round.target.en !== undefined ? { gloss: round.target.en } : {}),
          ...(round.target.spokenKo !== undefined ? { spokenKo: round.target.spokenKo } : {}),
          ...(round.target.audioRef !== undefined ? { audioRef: round.target.audioRef } : {}),
        }}
        tiles={round}
        {...(round.fixedZone !== undefined ? { fixed: round.fixedZone } : {})}
        // Round 1 never autoplays (the first sound needs a tap), as Listen & Pick.
        autoplay={index > 0}
        source="syllable-build"
        onFirst={(correct, hinted) => host.answer(round.id, correct, { itemId: round.id, ...(hinted ? { hinted: true } : {}) })}
        onSolved={() => {
          if (index + 1 >= rounds.length) complete();
          else setIndex(index + 1);
        }}
      />
    </Screen>
  );
}
