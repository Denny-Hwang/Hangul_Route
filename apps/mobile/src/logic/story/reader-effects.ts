import type { KoText, Story, StoryLevel, StoryTier } from '@hangul-route/content-schema';
import type { PlaySpec } from '../audio/controller';
import type { ReaderAction, ReaderState, SceneChangeVia } from './reader-state';
import type { SceneView } from './scene-view';

/**
 * The rules the reader screen applies around `reduceReader` (F-STORY-002
 * §3.3-3.7, §3.10-3.12): whether a story can open, what a scene change does
 * (bookmark, Read to me, focus), what is said when there is no Korean voice,
 * which gloss card is open, what a key does and what `story.read.finished`
 * carries. Pure: `StoryReaderView` only executes what these return.
 */

export type ReaderMode = 'quest' | 'replay';

/** A tier with fewer scenes is a content error: the one-line fallback shows (§3.3, §3.11). */
export const MIN_READER_SCENES = 4;

export type ReaderAvailability =
  | { ok: true; sceneCount: number }
  | { ok: false; reason: 'no-story' | 'no-tier' | 'too-short' };

export function readerAvailability(story: Story | undefined, level: StoryLevel): ReaderAvailability {
  if (!story) return { ok: false, reason: 'no-story' };
  const tier = story.tiers.find((t) => t.level === level);
  if (!tier) return { ok: false, reason: 'no-tier' };
  if (tier.scenes.length < MIN_READER_SCENES) return { ok: false, reason: 'too-short' };
  return { ok: true, sceneCount: tier.scenes.length };
}

/**
 * The checkpoint of each scene, for `initReader`. Until the inline question
 * card ships (PR 2.9, after F-STORY-003's `ChoiceCard`) a tier that defines
 * checkpoints simply reads straight through (§3.7): nothing is scored and no
 * learner is stuck on a card that cannot be drawn.
 */
export function readerCheckpoints(tier: Pick<StoryTier, 'scenes' | 'checkpoints'>, supported: boolean): Array<string | null> {
  return tier.scenes.map((scene) => {
    if (!supported || scene.checkpointId === undefined) return null;
    return tier.checkpoints.some((c) => c.id === scene.checkpointId) ? scene.checkpointId : null;
  });
}

export interface SceneChangeInput {
  mode: ReaderMode;
  index: number;
  via: SceneChangeVia;
  /** The effective Read to me setting (`effectiveReadToMe`). */
  readToMe: boolean;
  /** The first-gesture audio unlock has run (always true on native). */
  unlocked: boolean;
}

export interface SceneChangePlan {
  /** Quest mode, scene 2 on (F-STORY-004 §3.1); replay never writes. */
  saveBookmark: boolean;
  /** Read to me: play now, once the browser lets sound play, or not at all. */
  autoplay: 'now' | 'on-unlock' | 'none';
  /** Focus moves to the narration on a page turn; the first open only announces. */
  moveFocus: boolean;
}

export function planSceneChange(input: SceneChangeInput): SceneChangePlan {
  const plays = input.readToMe && input.via !== 'back';
  return {
    saveBookmark: input.mode === 'quest' && input.index >= 1,
    autoplay: !plays ? 'none' : input.unlocked ? 'now' : 'on-unlock',
    moveFocus: input.via !== 'open',
  };
}

/**
 * With no Korean voice on the device the Korean steps cannot play (F-AUDIO-004
 * reports them `unavailable`, which would end the whole chain), so they are left
 * out and the English narration still plays (§3.4). The Korean stays on screen.
 */
export function stepsForVoice(steps: readonly PlaySpec[], canPlayKorean: boolean): PlaySpec[] {
  if (canPlayKorean) return [...steps];
  return steps.filter((s) => (s.language ?? 'ko-KR') !== 'ko-KR');
}

export interface ReadFinishedInput {
  storyId: string;
  level: StoryLevel;
  mode: ReaderMode;
  sceneCount: number;
  /** `ReaderState.furthest` (0-based). */
  furthest: number;
  /** Plays that were heard (speaker taps and Read to me). */
  linesPlayed: number;
  /** Gloss cards the learner opened. */
  termsOpened: number;
}

export interface ReadFinishedPayload {
  storyId: string;
  level: StoryLevel;
  mode: ReaderMode;
  scenes: number;
  scenesSeen: number;
  linesPlayed: number;
  termsOpened: number;
}

function count(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The `story.read.finished` payload (§3.12): ids and counts only. */
export function readFinishedPayload(input: ReadFinishedInput): ReadFinishedPayload {
  const scenes = count(input.sceneCount);
  return {
    storyId: input.storyId,
    level: input.level,
    mode: input.mode,
    scenes,
    scenesSeen: Math.min(scenes, count(input.furthest) + 1),
    linesPlayed: count(input.linesPlayed),
    termsOpened: count(input.termsOpened),
  };
}

/** Item ids for `openTerm` and `revealed`: the Korean block, an inline term chip, a word of the line. */
export const KOREAN_BLOCK_ID = 'korean';
export const termId = (keywordId: string): string => `kw:${keywordId}`;
export const wordId = (index: number): string => `word:${index}`;

function koTextOf(source: KoText): KoText {
  const text: KoText = { ko: source.ko, romanization: source.romanization, en: source.en };
  if (source.spokenKo !== undefined) text.spokenKo = source.spokenKo;
  if (source.audioRef !== undefined) text.audioRef = source.audioRef;
  return text;
}

/** What the inline gloss card shows for the open item, or null when none is open (§3.5). */
export function glossTarget(
  view: Pick<SceneView, 'narrationParts' | 'korean'>,
  openTerm: string | null,
): { id: string; text: KoText } | null {
  if (openTerm === null) return null;
  if (openTerm.startsWith('kw:')) {
    const id = openTerm.slice('kw:'.length);
    for (const part of view.narrationParts) {
      if ('kw' in part && part.kw.id === id) return { id: openTerm, text: koTextOf(part.kw) };
    }
    return null;
  }
  const word = /^word:(\d+)$/.exec(openTerm);
  const text = word ? view.korean?.words?.[Number(word[1])] : undefined;
  return text ? { id: openTerm, text: koTextOf(text) } : null;
}

export type ReaderKey = 'ArrowRight' | 'ArrowLeft' | 'Escape';

/**
 * Web keyboard (§3.10): Right / Left turn the page, Escape closes the gloss
 * card. A key at either end does nothing, so a held key never runs past the
 * last scene (the platform listener also drops repeats).
 */
export function readerKeyAction(key: string, state: ReaderState): ReaderAction | null {
  if (key === 'Escape') return state.openTerm === null ? null : { type: 'closeTerm' };
  if (key === 'ArrowRight') return state.phase === 'scene' ? { type: 'next' } : null;
  if (key === 'ArrowLeft') return state.phase !== 'scene' || state.index > 0 ? { type: 'back' } : null;
  return null;
}
