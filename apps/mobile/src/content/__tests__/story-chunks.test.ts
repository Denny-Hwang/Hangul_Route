import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import * as index from '../__generated__/stories-index';
import { localizeStory } from '../../logic/content-locale';
import { STORY_BODY_FIELDS, SHELF_DEFAULTS, createStoryStore, splitStory, storiesOverStore, type StoryBodyChunk } from '../../logic/story/story-chunk-store';
import { storiesAll, storyContent, storyEpisodes, storyQuests } from '../stories';

/**
 * The story shelf and its chunks (F-CURR-002 §10, row CM-8): the start bundle imports only the
 * shelf; each story's body is reached through exactly one literal `import()` there (Metro splits
 * each into its own web bundle), nothing imports a chunk statically, every chunk fits its line, and
 * the TypeScript twins (the split, the derived shelf episodes and quests) equal the generator.
 */
const SRC = new URL('../../', import.meta.url).pathname;
const REPO = new URL('../../../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const INDEX = 'content/__generated__/stories-index.ts';
const CHUNKS = 'content/__generated__/story-chunks';

interface StoriesScript {
  STORY_BODY_FIELDS: readonly string[];
  SHELF_DEFAULTS: Record<string, unknown>;
  BUDGET: { perStoryRaw: number; totalRaw: number; manifestRaw: number };
  buildBundle: (stories: unknown[]) => { episodes: unknown[]; quests: unknown[] };
  readChunkManifest: (root: string) => { name: string; hash: string }[];
}
const script = (await import(join(REPO, 'scripts', 'build-stories.mjs'))) as StoriesScript;

/** The ready stories as content/stories holds them (the generator's input). */
const contentStories: Story[] = readdirSync(join(REPO, 'content', 'stories'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'content', 'stories', f), 'utf8')) as Story)
  .filter((s) => s.state === 'ready')
  .sort((a, b) => (a.id < b.id ? -1 : 1));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'story-chunks') sources(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(relative(SRC, full).split('\\').join('/'));
  }
  return out;
}

describe('the story shelf and its chunks', () => {
  const shelf = read(INDEX);
  const slug = (id: string): string => `story-${id.replace(/^story:/, '')}`;

  it('the shelf imports types only, and reaches each chunk by exactly one literal import()', () => {
    for (const line of shelf.split('\n').filter((l) => /^\s*import\s/.test(l))) expect(line, line).toMatch(/^import type /);
    expect(shelf).not.toMatch(/\brequire\(|import\(`|import\([^'")]/);
    const imports = shelf.match(/import\('[^']+'\)/g) ?? [];
    expect(imports.sort()).toEqual(index.STORY_SHELF.map((e) => `import('./story-chunks/${slug(e.id)}')`).sort());
    expect(Object.keys(index).sort()).toEqual(['HELD_STORY_CARDS', 'STORY_SHELF', 'loadStoryBody']);
    // No body field in the start bundle.
    for (const field of STORY_BODY_FIELDS.filter((f) => f !== 'review')) expect(shelf, field).not.toContain(`"${field}":`);
  });

  it('no other app source names a chunk or the old one-file bundle, so none can reach the start bundle', () => {
    const files = [...sources(SRC), ...['../App.tsx', '../BrowseApp.tsx', '../PresenterApp.tsx', '../index.ts']];
    const naming = files.filter((f) => f !== INDEX && /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"][^'"]*(story-chunks\/|stories\.generated)/.test(read(f)));
    expect(naming).toEqual([]);
  });

  it('every story of the shelf has one chunk carrying the hash the shelf names, within the per-story line', async () => {
    expect(readdirSync(join(SRC, CHUNKS)).sort()).toEqual(index.STORY_SHELF.map((e) => `${slug(e.id)}.ts`).sort());
    let total = Buffer.byteLength(shelf);
    for (const entry of index.STORY_SHELF) {
      const mod = (await index.loadStoryBody(entry.id)) as StoryBodyChunk;
      expect(mod.CHUNK_HASH, entry.id).toBe(entry.chunk);
      expect(Object.keys(mod).sort()).toEqual(['CHUNK_HASH', 'STORY_BODY']);
      const bytes = Buffer.byteLength(read(`${CHUNKS}/${slug(entry.id)}.ts`));
      // F-CURR-002 §10: 70,000 B raw per story chunk.
      expect(bytes, entry.id).toBeLessThanOrEqual(script.BUDGET.perStoryRaw);
      total += bytes;
    }
    expect(total).toBeLessThanOrEqual(script.BUDGET.totalRaw);
    expect(index.loadStoryBody('story:not-bundled')).toBeUndefined();
    expect(script.readChunkManifest(REPO)).toEqual(index.STORY_SHELF.map((e) => ({ name: slug(e.id), hash: e.chunk })));
  });

  it('the manifest the start bundle loads (lessons and story shelf) stays within 60,000 B', () => {
    const lessons = Buffer.byteLength(read('content/__generated__/lessons-index.ts'));
    expect(lessons + Buffer.byteLength(shelf)).toBeLessThanOrEqual(script.BUDGET.manifestRaw);
  });
});

describe('the TypeScript twins equal the generator', () => {
  it('STORY_BODY_FIELDS and SHELF_DEFAULTS', () => {
    expect([...STORY_BODY_FIELDS]).toEqual([...script.STORY_BODY_FIELDS]);
    expect(SHELF_DEFAULTS).toEqual(script.SHELF_DEFAULTS);
  });

  it('splitStory gives the shelf entry and the body the generator wrote, story by story', async () => {
    expect(index.STORY_SHELF.map((e) => e.id)).toEqual(contentStories.map((s) => s.id));
    for (const story of contentStories) {
      const generated = index.STORY_SHELF.find((e) => e.id === story.id);
      const { entry, body } = splitStory(story, generated?.chunk ?? '');
      expect(entry, story.id).toEqual(generated);
      expect(body, story.id).toEqual(((await index.loadStoryBody(story.id)) as StoryBodyChunk).STORY_BODY);
    }
  });

  it('the shelf and its chunks give back every story of content/stories (all chunks are loaded in tests)', () => {
    expect(storyContent.isAllReady()).toBe(true);
    expect(storiesAll).toEqual(contentStories);
  });

  it('the shelf episodes and quests the app derives are the ones buildBundle derives', () => {
    const { episodes, quests } = script.buildBundle(contentStories);
    expect(storyEpisodes).toEqual(episodes);
    expect(storyQuests).toEqual(quests);
  });
});

describe('the es / ko story overlays apply to a story read from its chunk', () => {
  it('the title before the chunk loads, and the scenes once it is in, as on a fully loaded story', async () => {
    const store = createStoryStore({ entries: index.STORY_SHELF }, index.loadStoryBody);
    const lazy = storiesOverStore(index.STORY_SHELF, store);
    const id = 'story:sun-and-moon';
    const story = lazy.find((s) => s.id === id) as Story;
    const loaded = storiesAll.find((s) => s.id === id) as Story;
    for (const locale of ['es', 'ko'] as const) {
      const before = localizeStory(story, locale);
      expect(before.title.en, locale).toBe(localizeStory(loaded, locale).title.en);
      expect(before.title.en, locale).not.toBe(story.title.en);
      expect(before.tiers).toEqual([]);
    }
    await store.ensureStories([id]);
    for (const locale of ['es', 'ko'] as const) {
      const after = localizeStory(story, locale);
      expect(after.tiers, locale).toEqual(localizeStory(loaded, locale).tiers);
      expect(after.tiers[0]?.scenes[0]?.narrationEn, locale).not.toBe(story.tiers[0]?.scenes[0]?.narrationEn);
    }
  });
});
