import type { MatchShapeRound } from '@hangul-route/content-schema';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useLocale } from '../../i18n/use-messages';
import { localizeScope } from '../../logic/content-locale';
import { minigameScopes } from '../../logic/minigame-config';
import { fnv1a32 } from '../../logic/remote-config/remote-config';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import type { ShapeRound } from '../../logic/reviews/review-rounds';
import { MatchShapeBoard } from './MatchShapeBoard';

/**
 * A review round at the produce rung as Match Shape (F-CURR-002 section 4.3, row CM-33): the Daily Review, Keep going
 * and the Cell and Stage Checks draw it through `RoundView`, which loads this chunk at run time. A pair round of the
 * item's letter and its look-alike; its six tiles are laid out here, seeded by the item, so the same round shows the
 * same tiles. The difference line after a miss is the Stage 1 pair round's own (in the UI language), when one sets
 * these two letters against each other.
 */

/** Six-tile layouts with 2 or 3 copies, never two in a row at the start, so a first tap is not a giveaway. */
const LAYOUTS = ['tlltlt', 'ltlltt', 'tltllt', 'lttllt', 'ltltlt', 'tllttl'];

/** The Stage 1 pair round of these letters (either way round), with its lines in the UI language. */
function stagePair(target: string, lookAlike: string, locale: ReturnType<typeof useLocale>): MatchShapeRound | undefined {
  for (const [ref, scope] of Object.entries(minigameScopes)) {
    const hit = scope.matchShape?.rounds.find((r) => r.shape === 'pair' && ((r.target === target && r.lookAlike === lookAlike) || (r.target === lookAlike && r.lookAlike === target)));
    if (hit) return localizeScope(scope, ref, locale).matchShape?.rounds.find((r) => r.id === hit.id);
  }
  return undefined;
}

export interface ShapeRoundViewProps {
  round: ShapeRound;
  onFirst: (answer: RoundAnswer) => void;
  onSolved: () => void;
}

export function ShapeRoundView({ round, onFirst, onSolved }: ShapeRoundViewProps): ReactElement {
  const locale = useLocale();
  const pair = useMemo((): MatchShapeRound => {
    const own = stagePair(round.target, round.lookAlike, locale);
    return {
      id: `review-${round.question.itemId}`,
      shape: 'pair',
      target: round.target,
      lookAlike: round.lookAlike,
      layout: LAYOUTS[fnv1a32(`${round.question.itemId}|shape`) % LAYOUTS.length] as string,
      diffNoteEn: own?.shape === 'pair' ? own.diffNoteEn : '',
    };
  }, [round.question.itemId, round.target, round.lookAlike, locale]);
  return <MatchShapeBoard round={pair} source="daily-review" testID="daily-review-shape" onFirst={(correct) => onFirst({ correct })} onSolved={onSolved} />;
}
