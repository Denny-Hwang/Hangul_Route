// Types for the unit tests in apps/mobile (F-STORY-001 PR 1.4, F-CURR-002 CM-8); the script itself is dependency-free JS.
import type { Episode, HeldStoryCard, Quest, Story } from '../packages/content-schema/src/index';

export function slugOf(storyId: string): string;
export function levelCode(level: string): string;
export function buildBundle(stories: Story[]): { stories: Story[]; episodes: Episode[]; quests: Quest[] };
export function heldStoryCards(stories: Story[]): HeldStoryCard[];
/** The module sources (the shelf `stories-index.ts` and one `story-chunks/story-<slug>.ts` per story) by path. */
export function buildModules(bundle: { stories: Story[]; held?: HeldStoryCard[] }): Record<string, string>;
/** The chunk names and hashes of the ready stories of content/stories under `root`. */
export function readChunkManifest(root: string): { name: string; hash: string }[];
export const STORY_BODY_FIELDS: readonly string[];
export const SHELF_DEFAULTS: Readonly<Record<string, unknown>>;
export const BUDGET: Readonly<{ perStoryRaw: number; totalRaw: number; totalGzip: number; manifestRaw: number; artRaw: number }>;
