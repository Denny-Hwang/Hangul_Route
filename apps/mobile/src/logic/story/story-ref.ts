import type { Quest, StoryLevel } from '@hangul-route/content-schema';
import { storyById } from '../../content/stories';
import type { MinigameScope } from '../minigame-config';

/**
 * Story minigame refs (F-STORY-003 §3.1):
 *
 *   minigame:story-<step>-<level>-<slug>
 *     step  = read | check | seq
 *     level = listen | along | read      (along = read-along)
 *     slug  = the story id without "story:", kebab-case; last, so it may
 *             itself contain "read", "check" and so on.
 */

export type StoryRefStep = 'read' | 'check' | 'seq';

export interface StoryRef {
  step: StoryRefStep;
  level: StoryLevel;
  storyId: string;
}

const REF = /^minigame:story-(read|check|seq)-(listen|along|read)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

const LEVEL_OF_CODE: Record<string, StoryLevel> = {
  listen: 'listen',
  along: 'read-along',
  read: 'read',
};

const CODE_OF_LEVEL: Record<StoryLevel, string> = {
  listen: 'listen',
  'read-along': 'along',
  read: 'read',
};

const KIND_OF_STEP: Record<StoryRefStep, MinigameScope['kind']> = {
  read: 'story-read',
  check: 'story-check',
  seq: 'story-sequence',
};

/** Splits a story ref into its parts; null on anything that is not one. */
export function parseStoryMinigameRef(ref: string): StoryRef | null {
  const m = REF.exec(ref);
  if (!m) return null;
  return {
    step: m[1] as StoryRefStep,
    level: LEVEL_OF_CODE[m[2] as string] as StoryLevel,
    storyId: `story:${m[3] as string}`,
  };
}

/** Builds the ref of one story step. `storyId` is the full `story:<slug>` id. */
export function storyMinigameRef(step: StoryRefStep, level: StoryLevel, storyId: string): string {
  return `minigame:story-${step}-${CODE_OF_LEVEL[level]}-${storyId.replace(/^story:/, '')}`;
}

/** The part of the content bundle `storyScopeFor` needs: which levels a story has. */
export type StoryLookup = (id: string) => { tiers: ReadonlyArray<{ level: StoryLevel }> } | undefined;

/**
 * Resolves a story ref to a scope, or undefined when the ref is malformed or
 * names a story / level that does not exist (the shell then shows its
 * "Minigame not found." fallback).
 */
export function storyScopeFor(ref: string, find: StoryLookup = storyById): MinigameScope | undefined {
  const parsed = parseStoryMinigameRef(ref);
  if (!parsed) return undefined;
  const story = find(parsed.storyId);
  if (!story?.tiers.some((t) => t.level === parsed.level)) return undefined;
  return {
    kind: KIND_OF_STEP[parsed.step],
    story: { storyId: parsed.storyId, level: parsed.level },
  };
}

function storyReadRef(quest: Pick<Quest, 'steps'>): StoryRef | null {
  const step = quest.steps.find((s) => s.minigameKind === 'story-read');
  return step?.minigameRef ? parseStoryMinigameRef(step.minigameRef) : null;
}

/** The story a quest plays, read from its `story-read` step ref. */
export function storyIdOfQuest(quest: Pick<Quest, 'steps'>): string | null {
  return storyReadRef(quest)?.storyId ?? null;
}

/** The level a quest plays, read from its `story-read` step ref. */
export function levelOfQuest(quest: Pick<Quest, 'steps'>): StoryLevel | null {
  return storyReadRef(quest)?.level ?? null;
}
