import { Body, Button, spacing } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { useMessages } from '../../i18n/use-messages';
import { memoryChunk } from '../../logic/memory/boot';
import { placedOutSkipSet } from '../../logic/placement/route-skip';
import { jumpCells, stageJumpOffer, testOutArmFor } from '../../logic/reviews/cell-check-offer';
import type { RootStackParamList } from '../../navigation/types';
import { useProgressStore } from '../../store/progress-store';
import { useQuestAccess } from '../../store/tier-store';
import type { StageJumpSlotProps } from './cell-check-entry';

/**
 * Stage Jump Ahead's line on the Journey stage header (F-CURR-002 row CM-25): "Already know this stage?" and a
 * secondary Jump ahead button under the stage's cells, the stage-wide twin of a cell's Test out line (cell-check.md B).
 * Part of the Cell Check's chunk. Drawn only on the stage the route has reached, before it is started, with every quest
 * of it open to the learner (`stageJumpOffer`), and only once the memory chunk says the stage has 10 or more playable
 * rounds. Never a lock, a price or a plan word: a locked stage simply has no line.
 */

export interface StageJumpLineProps extends StageJumpSlotProps {
  checkOn: boolean;
}

const CELLS = jumpCells(episodesAll);

/**
 * The jump rule for a stage from the stores now, without the round count (`cellCheck` is the session's own gate): the
 * `CellCheck` route checks it in jump mode before it plans and again before it latches, so a stale or future way in
 * can never jump a locked, started, passed or later stage.
 */
export function stageJumpRuleNow(profileId: string | null, stage: string, open: (questId: string) => boolean): boolean {
  if (profileId === null) return false;
  const snap = useProgressStore.getState().byProfile[profileId];
  if (snap === undefined) return false;
  const done = new Set(snap.quests.filter((q) => q.completedAt !== undefined).map((q) => q.questId));
  const placedOut = placedOutSkipSet(snap.placements, questsAll, episodesAll);
  return stageJumpOffer({ stage, cells: CELLS, done, placedOut, testedOut: snap.testedOut, open, checkOn: true, arm: testOutArmFor(profileId), playable: true });
}

export function StageJumpLine({ profileId, stage, checkOn }: StageJumpLineProps): ReactElement | null {
  const m = useMessages();
  const copy = m.learner.stageJump;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  const open = useQuestAccess();
  const placements = snap?.placements;
  const placedOut = useMemo(() => placedOutSkipSet(placements, questsAll, episodesAll), [placements]);
  const quests = snap?.quests;
  const done = useMemo(() => new Set((quests ?? []).filter((q) => q.completedAt !== undefined).map((q) => q.questId)), [quests]);
  const own = useMemo(() => CELLS.filter((c) => c.stage === stage.key).map((c) => c.id), [stage.key]);
  const base = { stage: stage.key, cells: CELLS, done, placedOut, testedOut: snap?.testedOut, open, checkOn, arm: testOutArmFor(profileId) };
  // The memory read only for a stage the rest of the rule already offers it on.
  const candidate = snap !== undefined && stageJumpOffer({ ...base, playable: true });
  const [playable, setPlayable] = useState(false);
  useEffect(() => {
    if (!candidate) return undefined;
    let live = true;
    memoryChunk()
      .then((chunk) => chunk.cellCheckApi().jumpOfferable(profileId, stage.key, own))
      .then(
        (yes) => live && setPlayable(yes),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [candidate, profileId, stage.key, own]);

  if (!candidate || !stageJumpOffer({ ...base, playable })) return null;
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }} testID={`journey-stage-jump-${stage.key}`}>
      <Body tone="secondary">{copy.prompt}</Body>
      <Button
        label={copy.cta}
        tone="secondary"
        size="md"
        fullWidth
        // No hint: the prompt line just above is read on its own, so a hint would say it twice.
        accessibilityLabel={copy.label(stage.order, stage.titleEn)}
        onPress={() => navigation.navigate('CellCheck', { cellId: stage.key, mode: 'jump' })}
        testID="journey-stage-jump"
      />
    </View>
  );
}
