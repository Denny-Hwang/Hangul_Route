import type { Episode, ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content';
import { localizeEpisode } from '../../content-locale';
import { INTRO_ASSUMES, episodeIntro, stageDone } from '../intro';

/**
 * Cell intros that assume an earlier stage (owner request 2026-10-16, item 8): "You know 30 letters." is true only
 * for a learner who did Stage 1; anyone else reads the neutral line, in every UI language.
 */

const snap = (completed: string[]): Pick<ProgressSnapshot, 'quests' | 'placements'> => ({
  quests: completed.map((questId) => ({ questId, episodeId: 'e', stars: 3, completedAt: '2026-10-15T00:00:00.000Z' })) as ProgressSnapshot['quests'],
  placements: [],
});
const firstQuestOf = (stage: string): string => {
  const episode = episodesAll.find((e) => e.stage === stage && (e.placement ?? 'grid') === 'grid' && e.questIds.length > 0) as Episode;
  return episode.questIds[0] as string;
};
/** Every quest of the stage's grid episodes: the stage done. */
const allQuestsOf = (stage: string): string[] => [
  ...new Set(
    episodesAll.filter((e) => e.stage === stage && (e.placement ?? 'grid') === 'grid' && (e.status === 'shipped' || e.status === 'ready')).flatMap((e) => e.questIds),
  ),
];

describe('the cells whose intro assumes an earlier stage', () => {
  it('every named cell is a shipped episode of a later stage than the one it assumes', () => {
    for (const [id, stage] of Object.entries(INTRO_ASSUMES)) {
      const episode = episodesAll.find((e) => e.id === id);
      expect(episode, id).toBeDefined();
      expect(Number(episode?.stage.slice(5)), id).toBeGreaterThan(Number(stage.slice(5)));
    }
  });

  it('no other cell intro speaks of what the learner already knows or can do', () => {
    // "Did you know ...?" is a question, not a claim about the learner.
    const assumes = /(?<!\bdid )\byou know\b|\byou can (read|write)\b|\byou learned\b|\bnow that you\b|\byou already\b/i;
    for (const episode of episodesAll) {
      if (INTRO_ASSUMES[episode.id] !== undefined || (episode.placement ?? 'grid') !== 'grid') continue;
      expect(episode.hoyaIntroEn, episode.id).not.toMatch(assumes);
    }
    for (const id of Object.keys(INTRO_ASSUMES)) expect(episodesAll.find((e) => e.id === id)?.hoyaIntroEn, id).toMatch(assumes);
  });
});

describe('episodeIntro', () => {
  const words = episodesAll.find((e) => e.id === 'episode:stage2-letters') as Episode;
  const sentences = episodesAll.find((e) => e.id === 'episode:stage3-letters') as Episode;

  it.each(['en', 'es', 'ko'] as const)('%s: a learner who has not done Stage 1 reads the neutral line; after all of Stage 1, the cell\'s own', (locale) => {
    const fresh = getMessages(locale).learner.episode.introFresh;
    const local = localizeEpisode(words, locale);
    expect(episodeIntro({ episode: local, snapshot: snap([]), episodes: episodesAll, fresh })).toBe(fresh);
    expect(episodeIntro({ episode: local, snapshot: undefined, episodes: episodesAll, fresh })).toBe(fresh);
    // One Stage 1 lesson is not Stage 1: "You know 30 letters." would be untrue.
    expect(episodeIntro({ episode: local, snapshot: snap([firstQuestOf('stage1')]), episodes: episodesAll, fresh })).toBe(fresh);
    expect(episodeIntro({ episode: local, snapshot: snap(allQuestsOf('stage1').slice(1)), episodes: episodesAll, fresh })).toBe(fresh);
    expect(episodeIntro({ episode: local, snapshot: snap(allQuestsOf('stage1')), episodes: episodesAll, fresh })).toBe(local.hoyaIntroEn);
  });

  it('a later stage\'s lesson does not stand in for the stage; the level check placing the learner past it counts', () => {
    const fresh = 'fresh';
    expect(episodeIntro({ episode: words, snapshot: snap([firstQuestOf('stage3')]), episodes: episodesAll, fresh })).toBe(fresh);
    expect(episodeIntro({ episode: sentences, snapshot: snap(allQuestsOf('stage2')), episodes: episodesAll, fresh })).toBe(sentences.hoyaIntroEn);
    const placed = { quests: [], placements: [{ level: { stage: 'stage3' } }] } as unknown as Pick<ProgressSnapshot, 'quests' | 'placements'>;
    expect(episodeIntro({ episode: sentences, snapshot: placed, episodes: episodesAll, fresh })).toBe(sentences.hoyaIntroEn);
    const placedInStage2 = { quests: [], placements: [{ level: { stage: 'stage2' } }] } as unknown as Pick<ProgressSnapshot, 'quests' | 'placements'>;
    expect(episodeIntro({ episode: sentences, snapshot: placedInStage2, episodes: episodesAll, fresh })).toBe(fresh);
  });

  it('a cell whose intro assumes nothing always shows its own', () => {
    const plain = episodesAll.find((e) => INTRO_ASSUMES[e.id] === undefined && e.hoyaIntroEn !== '') as Episode;
    expect(episodeIntro({ episode: plain, snapshot: snap([]), episodes: episodesAll, fresh: 'fresh' })).toBe(plain.hoyaIntroEn);
  });

  it('the route\'s stage latch counts: a stage once complete stays done when new lessons join it', () => {
    const latched = { quests: [], placements: [], stageDoneAt: { stage1: '2026-10-10T00:00:00.000Z' } } as unknown as Pick<ProgressSnapshot, 'quests' | 'placements' | 'stageDoneAt'>;
    expect(episodeIntro({ episode: words, snapshot: latched, episodes: episodesAll, fresh: 'fresh' })).toBe(words.hoyaIntroEn);
  });

  it('an unfinished quest does not count as done', () => {
    const started = { quests: [{ questId: firstQuestOf('stage1'), episodeId: 'e', stars: 0 }], placements: [] } as unknown as Pick<ProgressSnapshot, 'quests'>;
    expect(stageDone({ stage: 'stage1', snapshot: started, episodes: episodesAll })).toBe(false);
  });
});
