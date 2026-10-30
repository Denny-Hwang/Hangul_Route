import { Heading, Spacer } from '@hangul-route/design-system';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import type { BuildRound } from '../../logic/reviews/review-rounds';
import { fnv1a32 } from '../../logic/remote-config/remote-config';
import { partsOf } from '../../logic/syllable-build/pool';
import { tilesFor } from '../../logic/syllable-build/tiles';
import { SyllableBuildBoard } from './SyllableBuildBoard';

/**
 * A review round at the produce rung as Syllable Build (F-CURR-002 section 4.3, row CM-32): the Daily Review, Keep going
 * and the Cell and Stage Checks draw it through `RoundView`, which loads this chunk at run time. The tiles are chosen
 * here from the target (`tilesFor`, seeded by the item, so the same round shows the same tiles), so no tile logic sits
 * in the memory chunk. A symbol item's own zone is filled and locked. The first full block is the round's answer, hinted
 * when Show how it sounds came first.
 */
export interface BuildRoundViewProps {
  round: BuildRound;
  onFirst: (answer: RoundAnswer) => void;
  onSolved: () => void;
}

export function BuildRoundView({ round, onFirst, onSolved }: BuildRoundViewProps): ReactElement | null {
  const copy = useMessages().learner.minigame.syllableBuild;
  const parts = useMemo(() => partsOf(round.target.ko), [round.target.ko]);
  const tiles = useMemo(() => (parts ? tilesFor(parts, fnv1a32(`${round.question.itemId}|${round.target.ko}`)) : null), [parts, round.question.itemId, round.target.ko]);
  if (parts === null || tiles === null) return null;
  return (
    <View testID="daily-review-build">
      <Heading level="prompt">{copy.heading}</Heading>
      <Spacer size="md" />
      <SyllableBuildBoard
        target={{ ko: round.target.ko, romanization: round.target.romanization, ...(round.gloss !== undefined ? { gloss: round.gloss } : {}) }}
        tiles={tiles}
        {...(round.fixed !== undefined ? { fixed: round.fixed } : {})}
        autoplay
        source="daily-review"
        testID="daily-review-build-board"
        onFirst={(correct, hinted) => onFirst({ correct, ...(hinted ? { hinted: true } : {}) })}
        onSolved={onSolved}
      />
    </View>
  );
}
