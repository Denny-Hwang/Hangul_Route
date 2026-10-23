import type { HeritageCard, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { useEffect, useMemo, useState } from 'react';
import { episodesAll } from '../../content';
import { useLocale } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { completeStages } from '../../logic/my-route/latch';
import { gridEpisodesOf } from '../../logic/my-route/order';
import { bestStageStars, shownStageCards, stageOffer, type StageOffer } from '../../logic/reviews/stage-check-offer';
import { stagePrizeCards } from '../../logic/stage1/stage-complete';
import { useProgressStore } from '../../store/progress-store';
import { useCurrFlag } from '../../store/remote-config-store';
import { useQuestAccess } from '../../store/tier-store';
import { memoryChunk, memoryRecordsFor } from '../../logic/memory/boot';
import { useStageCeremonyOn } from './stage-check-entry';

/** `stageChecks` and `memoryRecord` on for this learner: the Stage Check itself (answers are recorded). */
export function useStageCheckOn(profileId: string | null): boolean {
  const ceremony = useStageCeremonyOn(profileId);
  const record = useCurrFlag('memoryRecord');
  return ceremony && record && memoryRecordsFor(profileId);
}

export interface StageOfferView {
  snapshot: ProgressSnapshot | undefined;
  complete: boolean;
  offer: StageOffer;
  /** Every quest of the stage is open to the learner (F-ENT-003). */
  open: boolean;
  /** The stage cards the learner holds, while `upperCards` is on (row CM-23's content). */
  cards: HeritageCard[];
}

/** The stage's quests, every grid cell of it, in content order. */
const stageQuests = (stage: StageKey): string[] => gridEpisodesOf(episodesAll).filter((e) => e.stage === stage).flatMap((e) => e.questIds);

/**
 * What a Stage 2-7 offers this learner now (`stageOffer`): read by the ceremony, the header buttons and the summary.
 * Whether the stage has 10 playable rounds is read from the memory chunk once the check could be offered at all.
 */
export function useStageOffer(profileId: string | null, stage: StageKey): StageOfferView {
  const locale = useLocale();
  const snapshot = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  const ceremonyOn = useStageCeremonyOn(profileId);
  const checkOn = useStageCheckOn(profileId);
  const upperCards = useCurrFlag('upperCards');
  const questOpen = useQuestAccess();
  const complete = useMemo(() => (snapshot ? completeStages(snapshot, episodesAll).has(stage) : false), [snapshot, stage]);
  const open = useMemo(() => {
    const quests = stageQuests(stage);
    return quests.length > 0 && quests.every(questOpen);
  }, [stage, questOpen]);
  const [playable, setPlayable] = useState(false);
  const ask = checkOn && complete && open;
  useEffect(() => {
    if (!ask) return undefined;
    let alive = true;
    memoryChunk()
      .then((chunk) => chunk.stageCheckApi().offerable(profileId, stage))
      .then(
        (yes) => alive && setPlayable(yes),
        () => alive && setPlayable(false),
      );
    return () => {
      alive = false;
    };
  }, [ask, profileId, stage]);
  const reviews = snapshot?.reviews;
  const best = useMemo(() => bestStageStars(reviews ?? [], stage), [reviews, stage]);
  const owned = snapshot?.cards;
  const cards = useMemo(
    () => shownStageCards(stagePrizeCards(stage), owned ?? [], upperCards).map((c) => localizeCard(c, locale)),
    [stage, owned, upperCards, locale],
  );
  const offer = stageOffer({ stage, complete, ceremonyOn, checkOn, playable: ask && playable, open, bestStars: best });
  return { snapshot, complete, offer, open, cards };
}
