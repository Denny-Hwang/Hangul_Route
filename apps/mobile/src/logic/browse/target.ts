import type { AdultPersona, BrowseTarget, StageKey } from '@hangul-route/content-schema';
import { stage1QuestsFrom, teachingQuestFor } from '../stage1/curriculum';
import { episodeOfQuest, type BrowseBundle } from './bundle';
import { accessSource, type AccessSource, type ResolvedPass } from './pass';

/**
 * Deep-link resolution (F-BROWSE-001 section 4.4): a target carries content
 * ids only and resolves to one browse screen. Pure: the bundle comes in.
 * Access applies after resolution: without an active pass every target lands
 * on the Access screen; a closed item still opens its page (in closed form).
 */

/** `letter-across-stage1`: "This letter is practiced across Stage 1."; `not-in-version`: "This lesson is not in this version of the app yet." */
export type BrowseNote = 'letter-across-stage1' | 'not-in-version';

export type BrowseDestination =
  /** `section: null` = the default section; `stage` scrolls the Journey to that row. */
  | { screen: 'home'; section: 'journey' | null; stage?: StageKey; note?: BrowseNote }
  | { screen: 'episode'; episodeId: string }
  | { screen: 'item'; kind: 'quest' | 'story' | 'vocab-topic'; id: string; focusJamoId?: string }
  | { screen: 'card'; cardId: string };

export type BrowseEntry = BrowseDestination | { screen: 'access'; reason: 'none' | 'expired'; source: AccessSource };

const NOT_IN_VERSION: BrowseDestination = { screen: 'home', section: null, note: 'not-in-version' };

function resolveJamo(jamoId: string, bundle: BrowseBundle): BrowseDestination {
  if (!bundle.jamo.some((j) => j.id === jamoId)) return NOT_IN_VERSION;
  const teacher = teachingQuestFor(jamoId, stage1QuestsFrom(bundle.episodes, bundle.quests));
  if (!teacher) return { screen: 'home', section: 'journey', stage: 'stage1', note: 'letter-across-stage1' };
  return { screen: 'item', kind: 'quest', id: teacher.id, focusJamoId: jamoId };
}

export function resolveTarget(target: BrowseTarget | null, bundle: BrowseBundle): BrowseDestination {
  if (target === null) return { screen: 'home', section: null };
  switch (target.kind) {
    case 'stage':
      return { screen: 'home', section: 'journey', stage: target.stage };
    case 'episode': {
      const episode = bundle.episodes.find((e) => e.id === target.id);
      return episode && episode.status !== 'draft' ? { screen: 'episode', episodeId: episode.id } : NOT_IN_VERSION;
    }
    case 'quest':
      return bundle.quests.some((q) => q.id === target.id) && episodeOfQuest(bundle, target.id) ? { screen: 'item', kind: 'quest', id: target.id } : NOT_IN_VERSION;
    case 'story':
      return bundle.storyIndex.some((e) => e.storyId === target.id) ? { screen: 'item', kind: 'story', id: target.id } : NOT_IN_VERSION;
    case 'vocab-topic':
      return bundle.vocabTopics.some((t) => t.id === target.id) ? { screen: 'item', kind: 'vocab-topic', id: target.id } : NOT_IN_VERSION;
    case 'card':
      return bundle.cards.some((c) => c.id === target.id) ? { screen: 'card', cardId: target.id } : NOT_IN_VERSION;
    case 'jamo':
      return resolveJamo(target.id, bundle);
    case 'char': {
      // A report holds the compatibility jamo; the letter is the initial form, never the final consonant.
      const jamo = bundle.jamo.find((j) => j.char === target.char && j.kind !== 'batchim');
      return jamo ? resolveJamo(jamo.id, bundle) : NOT_IN_VERSION;
    }
  }
}

/** Where a browse load or `hashchange` lands: the Access screen without an active pass, else the target's screen. */
export function resolveEntry(i: { target: BrowseTarget | null; pass: ResolvedPass; lastPersona: AdultPersona | null; bundle: BrowseBundle }): BrowseEntry {
  if (i.pass.status !== 'active') {
    return { screen: 'access', reason: i.pass.reason, source: accessSource({ expiredSource: i.pass.expiredSource, lastPersona: i.lastPersona }) };
  }
  return resolveTarget(i.target, i.bundle);
}
