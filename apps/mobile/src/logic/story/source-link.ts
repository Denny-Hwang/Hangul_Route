import type { Story } from '@hangul-route/content-schema';
import { findFactSection, findSceneSection, type SourcesCopy, type SourcesView } from './sources-view';

/**
 * The rules around the Sources screen's links and entry (F-STORY-002 §3.8,
 * §3.12, §3.14 #3-4). Pure: `StorySourcesScreen` only executes what these
 * return.
 *
 * Copying a link needs no gate (it is a string). Opening one is a grown-up
 * action: only an `https:` URL that is one of the story's own
 * `facts[].sources[]` is ever handed to the browser (F-STORY-001 §3.3 C4
 * guarantees the scheme; this re-checks and refuses anything else), and only
 * after the grown-up gate where the device has one.
 */

/** Where Sources was opened from (`story.sources.opened`). */
export type SourcesFrom = 'reader' | 'end' | 'episode' | 'notes' | 'scene';

/** The route params of `StorySources` (navigation/types.ts). */
export interface SourcesRouteParams {
  storyId: string;
  factId?: string;
  sceneIndex?: number;
  from?: SourcesFrom;
}

/**
 * A plain absolute `https:` URL: a host, no credentials, no whitespace or
 * control characters. Written without `URL` (React Native's is partial).
 */
const SAFE_HTTPS = /^https:\/\/[^\s/?#@\\]+(?:[/?#][^\s\\]*)?$/i;

export function isSafeHttpsUrl(url: string): boolean {
  // eslint-disable-next-line no-control-regex
  return SAFE_HTTPS.test(url) && !/[\u0000-\u001f\u007f]/.test(url);
}

export interface SourceLink {
  url: string;
  /** The first fact that cites the link (telemetry names it). */
  factId: string;
}

/** The link and its fact when the story cites it and it is safe to open; else null. */
export function findSourceLink(story: Story | undefined, url: string): SourceLink | null {
  if (!story || !isSafeHttpsUrl(url)) return null;
  const fact = story.facts.find((f) => f.sources.some((s) => s.url === url));
  return fact ? { url, factId: fact.id } : null;
}

/** Open link: straight to the browser where the gate opens directly, else through `PinEntry`. */
export function openLinkStep(gateOpensDirectly: boolean): 'open' | 'gate' {
  return gateOpensDirectly ? 'open' : 'gate';
}

/**
 * Back on Sources after the PIN screen: a waiting link opens only when the
 * gate is now through (a grown-up session is open); a cancelled gate drops it.
 */
export function pendingLinkStep(pending: SourceLink | null, gateOpensDirectly: boolean): 'none' | 'open' | 'drop' {
  if (pending === null) return 'none';
  return gateOpensDirectly ? 'open' : 'drop';
}

/** What the browser hand-off reported (platform/external-link). */
export type OpenLinkOutcome = 'opened' | 'offline' | 'failed';

/** The line shown after a hand-off: none on success; the link to open in a browser otherwise. */
export function openLinkNote(outcome: OpenLinkOutcome, url: string, copy: SourcesCopy): string | null {
  if (outcome === 'opened') return null;
  const fallback = copy.openFailed(url);
  return outcome === 'offline' ? `${copy.needsConnection} ${fallback}` : fallback;
}

/** `story.sources.opened` (§3.12): ids only. */
export function sourcesOpenedPayload(
  storyId: string,
  from: SourcesFrom,
  factId?: string,
): { storyId: string; from: SourcesFrom; factId?: string } {
  return factId === undefined ? { storyId, from } : { storyId, from, factId };
}

/** `story.sources.link_opened` (§3.12): fired only after a successful hand-off. */
export function linkOpenedPayload(storyId: string, factId: string): { storyId: string; factId: string } {
  return { storyId, factId };
}

/** From the reader: the top bar opens Sources at the scene being read, the end page at the top. */
export function sourcesRouteParams(storyId: string, from: 'reader' | 'end', sceneIndex: number): SourcesRouteParams {
  return from === 'reader' ? { storyId, from, sceneIndex } : { storyId, from };
}

/**
 * Where a deep link lands: a `factId` scrolls to and highlights that fact's
 * card; otherwise (or for an unknown fact) a `sceneIndex` scrolls to that
 * scene's section. Null stays at the top (also for the first section).
 */
export function sourcesTarget(
  view: SourcesView,
  params: { factId?: string; sceneIndex?: number },
): { section: number; highlightFactId: string | null } | null {
  if (params.factId !== undefined) {
    const found = findFactSection(view, params.factId);
    if (found) return { section: found.section, highlightFactId: params.factId };
  }
  if (params.sceneIndex !== undefined) {
    const section = findSceneSection(view, params.sceneIndex);
    if (section !== null && section > 0) return { section, highlightFactId: null };
  }
  return null;
}

// Jamo, compatibility jamo and syllables, written as escapes so this file holds no Hangul.
const HANGUL = new RegExp('[\\u1100-\\u11ff\\u3130-\\u318f\\uac00-\\ud7a3]');

/** Whether a citation (quote, title, notes) has Korean in it, so its node is marked `lang="ko"`. */
export function hasHangul(text: string): boolean {
  return HANGUL.test(text);
}
