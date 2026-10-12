// Types for the unit tests in apps/mobile (F-STORY-001 PR 1.4); the script itself is dependency-free JS.
import type { Episode, HeldStoryCard, Quest, Story } from '../packages/content-schema/src/index';

export function slugOf(storyId: string): string;
export function levelCode(level: string): string;
export function buildBundle(stories: Story[]): { stories: Story[]; episodes: Episode[]; quests: Quest[] };
export function heldStoryCards(stories: Story[]): HeldStoryCard[];
export function renderBundle(bundle: { stories: Story[]; episodes: Episode[]; quests: Quest[]; held?: HeldStoryCard[] }): string;
