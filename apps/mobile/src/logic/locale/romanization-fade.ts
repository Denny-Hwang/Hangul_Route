import { requiredQuestIds, type Episode, type ProgressSnapshot, type Quest } from '@hangul-route/content-schema';
import { episodesAll, questsAll } from '../../content';
import { placedOutSkipSet } from '../placement/route-skip';
import { completedQuestIdsOf } from '../route/self-route';
import { STAGE1_QUESTS, questTeaches, symbolsMetThrough } from '../stage1/curriculum';
import { isDecodable, type FadePhase } from './decodable';

export { isDecodable, type FadePhase };

/**
 * The fade phase (AMENDMENTS-ROMANIZATION-FADE section 3.3): what the learner has met, read from the progress
 * snapshot, and the one question the resolver asks of a text: could this learner read it by now (section 3.4).
 * Pure: no React, no store, no clock. It only moves forward, because every input only gains entries (a grown-up's reset
 * of a profile's progress excepted); a miss, a low star count or a forgotten word never moves it back.
 */
/** F-QUEST-002 section 3.6 rule R5: from quest 11 (nature-q2) no quest teaches a symbol; quests 1-10 teach all 30. */
export const FADE_READING_FROM_QUEST = 'quest:stage1-nature-q2';
/** Word Builder, volume 1 (F-CURR-001 section 3.3): the rest of the Hangul inventory. */
export const FADE_ALL_FROM_EPISODE = 'episode:stage2-letters';
/** The Stage Jump key that also latches a finished Word Builder (F-CURR-002 row CM-25). */
const STAGE2_TEST_OUT_KEY = 'stage2';

export interface FadeInput {
  /** Finished quests. */
  doneQuestIds: ReadonlySet<string>;
  /** The level check's placed-out quests. */
  placedOutQuestIds: ReadonlySet<string>;
  /** The snapshot's test-out latch (`snapshot.testedOut ?? {}`). */
  testedOut: Readonly<Record<string, string>>;
}

/**
 * The symbols (jamo ids) a learner has met: the union of what every finished or placed-out Stage 1 quest teaches. This
 * is the letter wall's own reading, so the Learning Route and the fade never disagree about which letters the learner
 * has. For in-order play it equals `symbolsMetThrough(<last done quest>)`; for out-of-order play it counts only what was
 * actually met.
 */
export function metSymbols(input: FadeInput, stage1Quests: readonly Quest[] = STAGE1_QUESTS): Set<string> {
  const met = new Set<string>();
  for (const quest of stage1Quests) {
    if (!input.doneQuestIds.has(quest.id) && !input.placedOutQuestIds.has(quest.id)) continue;
    for (const id of questTeaches(quest)) met.add(id);
  }
  return met;
}

/**
 * The phase: `all` once Word Builder is complete (every required quest done or placed out, or the test-out or the Stage
 * Jump latched); `reading` once every symbol of quests 1 to 10 is met; `letters` otherwise, and whenever a content
 * anchor is missing (then the phase it anchors never starts, never the other way).
 */
export function fadePhase(
  input: FadeInput,
  met: ReadonlySet<string>,
  stage1Quests: readonly Quest[] = STAGE1_QUESTS,
  episodes: readonly Episode[] = episodesAll,
): FadePhase {
  const wordBuilder = episodes.find((e) => e.id === FADE_ALL_FROM_EPISODE);
  if (wordBuilder !== undefined) {
    const required = requiredQuestIds(wordBuilder);
    const finished = required.length > 0 && required.every((id) => input.doneQuestIds.has(id) || input.placedOutQuestIds.has(id));
    const latched = input.testedOut[FADE_ALL_FROM_EPISODE] !== undefined || input.testedOut[STAGE2_TEST_OUT_KEY] !== undefined;
    if (finished || latched) return 'all';
  }
  const reading = symbolsMetThrough(FADE_READING_FROM_QUEST, stage1Quests);
  return reading.length > 0 && reading.every((id) => met.has(id)) ? 'reading' : 'letters';
}

const fades = new WeakMap<object, { phase: FadePhase; met: ReadonlySet<string> }>();

/**
 * The snapshot's phase and met symbols, computed once per snapshot object, so the many hook calls of one render share
 * one computation (the placed-out set runs the effective-route merge).
 */
export function fadeOfSnapshot(snapshot: ProgressSnapshot): { phase: FadePhase; met: ReadonlySet<string> } {
  const cached = fades.get(snapshot);
  if (cached !== undefined) return cached;
  const input: FadeInput = {
    doneQuestIds: new Set([...completedQuestIdsOf(snapshot.quests), ...Object.keys(snapshot.questDoneAt ?? {})]),
    placedOutQuestIds: placedOutSkipSet(snapshot.placements, questsAll, episodesAll) ?? new Set<string>(),
    testedOut: snapshot.testedOut ?? {},
  };
  const met = metSymbols(input);
  const result = { phase: fadePhase(input, met), met };
  fades.set(snapshot, result);
  return result;
}
