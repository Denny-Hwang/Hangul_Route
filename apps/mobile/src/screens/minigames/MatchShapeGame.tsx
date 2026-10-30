import { Body, Button, Heading, Pill, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { sourcesOf } from '../../logic/match-shape/facts';
import type { MinigameScope } from '../../logic/minigame-config';
import type { MinigameHost } from './host';
import { MatchShapeBoard } from './MatchShapeBoard';

/**
 * Match Shape in a quest step (F-CURR-002 section 7.1 F4, row CM-33; design/wireframes/minigame/match-shape.md, layout A
 * of minigame/shell.md): the round count, the heading of an origin round ("Which letter comes from this shape?"; a pair
 * round draws its own, with its letter), then one board a round. No Skip: it is a recognition game. The first answer
 * of a round goes to the host (`answer`, the round id naming its letter for the memory store, at the produce rung); the
 * step completes after the last round. Played only while `game.match-shape` is on (`match-shape-entry.tsx`); off, the
 * step is Read Pick.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
}

export function MatchShapeGame({ scope, host, onBack }: Props): ReactElement {
  const copy = useMessages().learner.minigame;
  const rounds = scope.matchShape?.rounds ?? [];
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
    <Screen tone="canvas" testID="match-shape-game">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pill label={copy.progress.pill(index + 1, rounds.length)} size="sm" />
      </View>
      <Spacer size="md" />
      {round.shape === 'origin' ? (
        <>
          <Heading level="prompt">{copy.matchShape.heading.origin}</Heading>
          <Spacer size="md" />
        </>
      ) : null}
      <MatchShapeBoard
        key={round.id}
        round={round}
        sources={round.shape === 'origin' ? sourcesOf(round.fact) : []}
        source="match-shape"
        // A pair round's first answer is its letter's, at the produce rung (memory store); an origin round teaches the
        // fact it shows, so its answer scores the step and says nothing about the letter.
        onFirst={(correct) => host.answer(round.id, correct, round.shape === 'pair' ? { itemId: round.id } : undefined)}
        onSolved={() => {
          if (index + 1 >= rounds.length) complete();
          else setIndex(index + 1);
        }}
      />
    </Screen>
  );
}
