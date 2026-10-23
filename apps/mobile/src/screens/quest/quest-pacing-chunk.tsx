import { CURR_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { useRef } from 'react';
import type { ReactElement } from 'react';
import { episodeById, questById } from '../../content';
import { useMessages } from '../../i18n/use-messages';
import { localizeScope } from '../../logic/content-locale';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { compactFor, compactSource, hardRound, noteStrongRound, shortenScope, strongRound, tallyOf } from '../../logic/quest-flow/quest-adapt';
import { SCAFFOLD_ROUND_ID, scaffoldScope } from '../../logic/quest-flow/quest-scaffold';
import type { QuestPlayerEvent } from '../../logic/quest-flow/quest-player-ports';
import { answerAside, useQuestRunStore } from '../../store/quest-run-store';
import { ListenPickGame } from '../minigames/ListenPickGame';

/**
 * The pacing chunk (F-CURR-002 section 4.6, row CM-24): the strong and hard round rules, the shorter Apply, the
 * scaffold round and its view, one precached web bundle of its own, reached only through the literal `import()` of
 * `./quest-pacing.ts`. Never import it statically from the start bundle (Metro would then fold it back in). Its
 * marker is `QUEST_PACING_CHUNK`.
 */
export const QUEST_PACING_CHUNK = 'quest-pacing-chunk:adapt';

type Track = (event: QuestPlayerEvent) => void;

/** `quest.adapt { questId, dir }`, parsed before it is sent (no person and no item: the ports add who). */
function sendAdapt(track: Track, questId: string, dir: 'compact' | 'scaffold'): void {
  const parsed = CURR_TELEMETRY_PAYLOADS['quest.adapt'].safeParse({ questId, dir });
  if (parsed.success) track({ name: 'quest.adapt', payload: parsed.data });
}

export interface PacingPlan {
  /** The quest's index in its cell. */
  index: number;
  /** A strong round earlier in the cell: the second Discover page is compact and Apply one round shorter. */
  compact: boolean;
}

/**
 * The run's pace, once this quest's run has begun (no run, or another quest's in the store: the standard path). A
 * compact quest puts its shorter Apply scope in the run store (the game screen plays it) when the run is not yet past
 * Apply, and sends `quest.adapt { dir: 'compact' }` only when the run will reach what changes: a two-word second
 * Discover page the run is not past, or the shorter Apply. A run resumed past both sends nothing.
 */
export function planPacing(input: { profileId: string; episodeId: string; questId: string; track: Track }): PacingPlan {
  const { profileId, episodeId, questId } = input;
  const index = episodeById(episodeId)?.questIds.indexOf(questId) ?? -1;
  const run = useQuestRunStore.getState();
  if (run.questId !== questId || run.episodeId !== episodeId) return { index, compact: false };
  const compact = compactFor(profileId, episodeId, index);
  const quest = questById(questId);
  if (compact && quest) {
    const apply = quest.steps.findIndex((s) => s.kind === 'apply');
    const discover = quest.steps.findIndex((s) => s.kind === 'discover');
    const ref = quest.steps[apply]?.minigameRef;
    const source = ref && run.stepIndex <= apply ? scopeFor(ref) : undefined;
    const shorter = source ? shortenScope(source) : null;
    if (shorter) useQuestRunStore.setState({ short: { step: apply, scope: shorter } });
    const page2 = discover >= 0 && run.stepIndex <= discover && compactSource(quest.steps[discover]?.discover?.pages[1]);
    if (shorter || page2) sendAdapt(input.track, questId, 'compact');
  }
  return { index, compact };
}

/**
 * Past Practice (the player is on the step after it): a strong round is noted for the cell's later quests; a hard
 * one returns the scaffold round's scope, over this Practice's own items in the UI language, and sends
 * `quest.adapt { dir: 'scaffold' }`. Null otherwise, or when the Practice asks no listed word.
 */
export function afterPractice(input: {
  profileId: string;
  episodeId: string;
  questId: string;
  plan: PacingPlan;
  practiceAt: number;
  locale: UiLocale;
  track: Track;
}): MinigameScope | null {
  const { tries } = useQuestRunStore.getState();
  const tally = tallyOf(tries, input.practiceAt);
  if (strongRound(tally)) noteStrongRound(input.profileId, input.episodeId, input.plan.index);
  const ref = questById(input.questId)?.steps[input.practiceAt]?.minigameRef;
  const source = ref ? scopeFor(ref) : undefined;
  if (!hardRound(tally) || !source || !ref) return null;
  const missed = tries.flatMap((t) => (t.step === input.practiceAt && t.asked ? [t.asked] : []));
  const scope = scaffoldScope(localizeScope(source, ref, input.locale), missed);
  if (scope) sendAdapt(input.track, input.questId, 'scaffold');
  return scope;
}

/**
 * The scaffold round: Listen & Pick, the shipped format, with the right card ringed from the start and the hint line
 * over it. Its first answer goes to the memory store marked hinted, through the run store's listener as every
 * round's does; it is not scored, so the stars and the step counter are the quest's own.
 */
export function ScaffoldRound({ scope, onDone }: { scope: MinigameScope; onDone: () => void }): ReactElement {
  const hint = useMessages().learner.quest.adapt.scaffoldHint;
  const answered = useRef(false);
  return (
    <ListenPickGame
      scope={scope}
      hint={hint}
      host={{
        mode: 'quest',
        answer: (_key, correct) => {
          if (answered.current) return;
          answered.current = true;
          answerAside({ scope, itemId: SCAFFOLD_ROUND_ID }, correct);
        },
        complete: onDone,
      }}
      onBack={onDone}
    />
  );
}
