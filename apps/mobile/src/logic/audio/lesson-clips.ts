import { AUDIO_PACKS, type AudioPack } from '@hangul-route/content-schema/audio-packs';

/**
 * What a lesson's screen loads and warms when it opens (AMENDMENTS-AUDIO-CLIPS AC-B6, warming; row AC-6): the map
 * chunks of the packs its clips may come from, and the clips of this lesson and the next one, so a learner who goes
 * offline after starting a lesson still hears it, and the next one too. Pure: the quests and episodes are arguments.
 *
 * The warm units are the clip manifest's sources as the map generator writes them (`clipUnitOfSource` in
 * scripts/audio/lib.mjs): a Stage 1 quest (`quest:<id>`) and its games (`minigame:<ref>`), a lesson cell (its episode
 * id, `episode:stage2-life`) and a story (`story:<slug>`).
 */

export interface ClipPlanQuest {
  id: string;
  steps: readonly { minigameRef?: string | undefined }[];
}

export interface ClipPlanEpisode {
  id: string;
  stage: string;
  format?: string | undefined;
  questIds: readonly string[];
}

export interface LessonClipPlan {
  /** The scopes to load (`ClipAssets.loadFor`): this lesson's and the next one's, each once. */
  scopes: AudioPack[];
  /** The warm units of this lesson and the next one, each once. */
  units: string[];
}

const LAST_PACK: AudioPack = AUDIO_PACKS[AUDIO_PACKS.length - 1] ?? 'cards';

/** The scope that loads every pack (the grown-up roots, which open any lesson, story or word list). */
export const ALL_CLIP_PACKS: AudioPack = LAST_PACK;
const isPack = (value: string): value is AudioPack => (AUDIO_PACKS as readonly string[]).includes(value);

/**
 * The pack scope of an episode: a story or a Stage 5 book plays the `stories` pack (and every pack before it), a
 * lesson cell its stage's pack, and an episode the app cannot place every pack (a clip is never missed for a scope).
 */
export function clipScopeOfEpisode(episode: Pick<ClipPlanEpisode, 'stage' | 'format'> | undefined): AudioPack {
  if (episode === undefined) return LAST_PACK;
  if (episode.format === 'story' || episode.stage === 'stage5') return 'stories';
  return isPack(episode.stage) ? episode.stage : LAST_PACK;
}

const SHELF_EPISODE = /^episode:shelf-([a-z0-9-]+)$/;

function unitsOf(quest: ClipPlanQuest, episode: ClipPlanEpisode | undefined): string[] {
  const units = [quest.id];
  for (const step of quest.steps) if (step.minigameRef !== undefined && step.minigameRef !== '') units.push(step.minigameRef);
  if (episode !== undefined) {
    units.push(episode.id);
    const shelf = SHELF_EPISODE.exec(episode.id);
    if (shelf !== null) units.push(`story:${shelf[1]}`);
  }
  return units;
}

/**
 * The plan for the quest `questId` opened under `episodeId`: this quest and the next one in the cursor order
 * (`quests`, `questsAll`), each with its episode's scope.
 */
export function lessonClipPlan(input: {
  questId: string;
  episodeId?: string | undefined;
  quests: readonly ClipPlanQuest[];
  episodes: readonly ClipPlanEpisode[];
}): LessonClipPlan {
  const index = input.quests.findIndex((q) => q.id === input.questId);
  if (index < 0) return { scopes: [], units: [] };
  const episodeOf = (questId: string): ClipPlanEpisode | undefined => input.episodes.find((e) => e.questIds.includes(questId));
  const here = input.quests[index];
  const hereEpisode = input.episodes.find((e) => e.id === input.episodeId) ?? (here === undefined ? undefined : episodeOf(here.id));
  const lessons: { quest: ClipPlanQuest; episode: ClipPlanEpisode | undefined }[] = [];
  if (here !== undefined) lessons.push({ quest: here, episode: hereEpisode });
  const next = input.quests[index + 1];
  if (next !== undefined) lessons.push({ quest: next, episode: episodeOf(next.id) });
  const scopes: AudioPack[] = [];
  const units: string[] = [];
  for (const { quest, episode } of lessons) {
    const scope = clipScopeOfEpisode(episode);
    if (!scopes.includes(scope)) scopes.push(scope);
    for (const unit of unitsOf(quest, episode)) if (!units.includes(unit)) units.push(unit);
  }
  return { scopes, units };
}
