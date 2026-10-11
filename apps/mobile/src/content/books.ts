import type { Episode } from '@hangul-route/content-schema';

/**
 * Stage 5 books (F-STORY-005 §3.2, §3.3): hand-written grid story episodes,
 * one per Stage 5 cell, each reusing its placeholder id
 * (`episode:stage5-<theme>`) and listing its `storyIds`. A book replaces its
 * cell's "Coming soon" preview automatically (`previewEpisodesFor`).
 *
 * Empty until a story has a reviewed `read` tier: a cell stays a placeholder
 * until its book has at least two reviewed quests (§3.1 rule 5, PR 5.6).
 */
export const bookEpisodes: Episode[] = [];
