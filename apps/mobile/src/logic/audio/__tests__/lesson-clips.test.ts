import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clipUnitsOf } from '../../../../scripts/audio/lib.mjs';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { vocabTopics } from '../../../content/vocab';
import { ALL_CLIP_PACKS, clipScopeOfEpisode, lessonClipPlan, type ClipPlanEpisode, type ClipPlanQuest } from '../lesson-clips';

/** AMENDMENTS-AUDIO-CLIPS AC-B6 warming (row AC-6): what a lesson loads and warms when it opens. */

const quests: ClipPlanQuest[] = [
  { id: 'quest:stage1-letters-q1', steps: [{ minigameRef: 'minigame:s1-letters-q1-play' }, {}, { minigameRef: 'minigame:s1-letters-q1-check' }] },
  { id: 'quest:stage1-letters-q2', steps: [{ minigameRef: 'minigame:s1-letters-q2-check' }] },
  { id: 'quest:stage2-life-q1', steps: [] },
  { id: 'quest:shelf-hangeul-day', steps: [] },
];
const episodes: ClipPlanEpisode[] = [
  { id: 'episode:stage1-letters', stage: 'stage1', questIds: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2'] },
  { id: 'episode:stage2-life', stage: 'stage2', questIds: ['quest:stage2-life-q1'] },
  { id: 'episode:shelf-hangeul-day', stage: 'stage1', format: 'story', questIds: ['quest:shelf-hangeul-day'] },
];

describe('logic/audio/lesson-clips', () => {
  it('a lesson warms its own clips and the next lesson\'s: the quest, its games and its cell', () => {
    expect(lessonClipPlan({ questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', quests, episodes })).toEqual({
      scopes: ['stage1'],
      units: [
        'quest:stage1-letters-q1',
        'minigame:s1-letters-q1-play',
        'minigame:s1-letters-q1-check',
        'episode:stage1-letters',
        'quest:stage1-letters-q2',
        'minigame:s1-letters-q2-check',
      ],
    });
  });

  it('the next lesson in another stage adds that stage\'s scope', () => {
    const plan = lessonClipPlan({ questId: 'quest:stage1-letters-q2', episodeId: 'episode:stage1-letters', quests, episodes });
    expect(plan.scopes).toEqual(['stage1', 'stage2']);
    expect(plan.units).toContain('episode:stage2-life');
  });

  it('a story quest plays the stories pack and warms its story', () => {
    const plan = lessonClipPlan({ questId: 'quest:shelf-hangeul-day', episodeId: 'episode:shelf-hangeul-day', quests, episodes });
    expect(plan).toEqual({ scopes: ['stories'], units: ['quest:shelf-hangeul-day', 'episode:shelf-hangeul-day', 'story:hangeul-day'] });
  });

  it('a Stage 5 book\'s Read quest (and any story quest) warms its story by the quest id', () => {
    const book: ClipPlanQuest = { id: 'quest:story-sejong-new-letters-read', steps: [{ minigameRef: 'minigame:story-read-read-sejong-new-letters' }] };
    const bookEpisode: ClipPlanEpisode = { id: 'episode:stage5-letters', stage: 'stage5', format: 'story', questIds: [book.id] };
    const plan = lessonClipPlan({ questId: book.id, episodeId: bookEpisode.id, quests: [book], episodes: [bookEpisode] });
    expect(plan.scopes).toEqual(['stories']);
    expect(plan.units).toContain('story:sejong-new-letters');
    const along = lessonClipPlan({ questId: 'quest:story-hangeul-day-along', quests: [{ id: 'quest:story-hangeul-day-along', steps: [] }], episodes: [] });
    expect(along.units).toContain('story:hangeul-day');
  });

  it('an unknown quest plans nothing; an episode the app cannot place loads every pack', () => {
    expect(lessonClipPlan({ questId: 'quest:none', quests, episodes })).toEqual({ scopes: [], units: [] });
    expect(clipScopeOfEpisode(undefined)).toBe(ALL_CLIP_PACKS);
    expect(ALL_CLIP_PACKS).toBe('cards');
    expect(clipScopeOfEpisode({ stage: 'stage5' })).toBe('stories');
    expect(clipScopeOfEpisode({ stage: 'stage7' })).toBe('stage7');
  });

  it('every shipped quest has a plan whose scopes are packs, and the first lesson\'s plan names Stage 1', () => {
    for (const quest of questsAll) {
      const plan = lessonClipPlan({ questId: quest.id, quests: questsAll, episodes: episodesAll });
      expect(plan.units[0], quest.id).toBe(quest.id);
      expect(plan.scopes.length, quest.id).toBeGreaterThan(0);
    }
    expect(lessonClipPlan({ questId: 'quest:stage1-letters-q1', quests: questsAll, episodes: episodesAll }).scopes[0]).toBe('stage1');
  });

  const manifest = JSON.parse(readFileSync(join(__dirname, '../../../../../../content/audio/tts-manifest.json'), 'utf8')) as Parameters<typeof clipUnitsOf>[0];
  const manifestUnits = new Set([...clipUnitsOf(manifest).values()].flat());
  const ownUnits = (questId: string): string[] => {
    const quest = questsAll.find((q) => q.id === questId);
    if (quest === undefined) return [];
    const episode = episodesAll.find((e) => e.questIds.includes(questId));
    return lessonClipPlan({ questId, episodeId: episode?.id, quests: [quest], episodes: episodesAll }).units;
  };

  it('every shipped quest\'s own plan reaches at least one warm unit of the real clip manifest (books included)', () => {
    expect(manifestUnits.size).toBeGreaterThan(30);
    const missed = questsAll.filter((q) => !ownUnits(q.id).some((u) => manifestUnits.has(u))).map((q) => q.id);
    expect(missed).toEqual([]);
    const books = questsAll.filter((q) => episodesAll.some((e) => e.stage === 'stage5' && e.questIds.includes(q.id)));
    expect(books.length).toBeGreaterThan(0);
    for (const q of books) expect(ownUnits(q.id).some((u) => u.startsWith('story:') && manifestUnits.has(u)), q.id).toBe(true);
  });

  it('every warm unit of the real manifest is reached by a lesson, the level check, a vocabulary topic or a card page', () => {
    const byLesson = new Set(questsAll.flatMap((q) => ownUnits(q.id)));
    const topics = new Set(vocabTopics.map((t) => `topic:${t.key}`));
    const unreached = [...manifestUnits].filter((u) => !byLesson.has(u) && u !== 'placement' && !topics.has(u) && !/^card:[a-z0-9-]+$/.test(u));
    expect(unreached).toEqual([]);
    // The Word Builder clips (`jamo-wb`) warm with the Word Builder cell (AC-B6): that cell's lessons reach it.
    expect(manifestUnits.has('episode:stage2-letters')).toBe(true);
    expect(byLesson.has('episode:stage2-letters')).toBe(true);
  });
});
