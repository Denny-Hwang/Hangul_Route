import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import * as index from '../__generated__/stories-index';
import * as shelfChunk from '../__generated__/stories-shelf';
import { localizeStory } from '../../logic/content-locale';
import { STORY_BODY_FIELDS, SHELF_DEFAULTS, createStoryStore, splitStory, storiesOverStore, type StoryBodyChunk } from '../../logic/story/story-chunk-store';
import { storiesAll, storyContent, storyEpisodes, storyQuests } from '../stories';

/**
 * The story shelf and its chunks (F-CURR-002 §10, rows CM-8 and CM-8b): the start bundle imports only the
 * story index, which reaches the shelf chunk and each story's body through exactly one literal `import()` each
 * (Metro splits each into its own web bundle); only the native and test reader imports the shelf statically,
 * nothing imports a body chunk statically, every chunk fits its line, and the TypeScript twins (the split, the
 * derived shelf episodes and quests) equal the generator.
 */
const SRC = new URL('../../', import.meta.url).pathname;
const REPO = new URL('../../../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const INDEX = 'content/__generated__/stories-index.ts';
const SHELF = 'content/__generated__/stories-shelf.ts';
const CHUNKS = 'content/__generated__/story-chunks';

interface StoriesScript {
  STORY_BODY_FIELDS: readonly string[];
  SHELF_DEFAULTS: Record<string, unknown>;
  BUDGET: { perStoryRaw: number; totalRaw: number; manifestRaw: number; shelfRaw: number };
  buildBundle: (stories: unknown[]) => { episodes: unknown[]; quests: unknown[] };
  readChunkManifest: (root: string) => { name: string; hash: string; namedBy?: string }[];
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
  const start = read(INDEX);
  const shelf = read(SHELF);
  const slug = (id: string): string => `story-${id.replace(/^story:/, '')}`;

  it('the start-loaded index imports types only, and reaches the shelf and each body chunk by exactly one literal import()', () => {
    for (const line of start.split('\n').filter((l) => /^\s*import\s/.test(l))) expect(line, line).toMatch(/^import type /);
    expect(start).not.toMatch(/\brequire\(|import\(`|import\([^'")]/);
    const imports = start.match(/import\('[^']+'\)/g) ?? [];
    expect(imports.sort()).toEqual(["import('./stories-shelf')", ...shelfChunk.STORY_SHELF.map((e) => `import('./story-chunks/${slug(e.id)}')`)].sort());
    expect(Object.keys(index).sort()).toEqual(['STORY_SHELF_HASH', 'loadStoryBody', 'loadStoryShelf']);
    // No shelf and no body in the start bundle (row CM-8b): only the loaders and the shelf's hash.
    expect(start).not.toContain('"title":');
    for (const field of STORY_BODY_FIELDS) expect(start, field).not.toContain(`"${field}":`);
  });

  it('the shelf chunk imports types only, carries the hash the index names, and holds no body field', async () => {
    for (const line of shelf.split('\n').filter((l) => /^\s*import\s/.test(l))) expect(line, line).toMatch(/^import type /);
    expect(shelf).not.toMatch(/\bimport\(|\brequire\(/);
    expect(Object.keys(shelfChunk).sort()).toEqual(['CHUNK_HASH', 'HELD_STORY_CARDS', 'STORY_SHELF']);
    expect(shelfChunk.CHUNK_HASH).toBe(index.STORY_SHELF_HASH);
    expect(await index.loadStoryShelf()).toBe(shelfChunk);
    for (const field of STORY_BODY_FIELDS.filter((f) => f !== 'review')) expect(shelf, field).not.toContain(`"${field}":`);
    // Row CM-8b: the advisory note and the card's keyword (id, gloss, kind) are in the body; the card's Korean word stays.
    expect(shelf).not.toContain('"advisoryNoteEn":');
    expect(shelf).not.toContain('"cardKeyword":');
    expect(shelfChunk.STORY_SHELF.some((e) => e.cardWord !== undefined)).toBe(true);
  });

  it('no app source names a body chunk or the old one-file bundle, and only the native and test reader imports the shelf statically', () => {
    const files = [...sources(SRC), ...['../App.tsx', '../BrowseApp.tsx', '../PresenterApp.tsx', '../index.ts']];
    const naming = files.filter((f) => f !== INDEX && /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"][^'"]*(story-chunks\/|stories\.generated)/.test(read(f)));
    expect(naming).toEqual([]);
    const shelfReaders = files.filter((f) => f !== INDEX && /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"][^'"]*__generated__\/stories-shelf['"]/.test(read(f)));
    expect(shelfReaders).toEqual(['content/story-shelf.ts']);
  });

  it('every story of the shelf has one chunk carrying the hash the shelf names, within the per-story line', async () => {
    expect(readdirSync(join(SRC, CHUNKS)).sort()).toEqual(shelfChunk.STORY_SHELF.map((e) => `${slug(e.id)}.ts`).sort());
    let total = Buffer.byteLength(start) + Buffer.byteLength(shelf);
    for (const entry of shelfChunk.STORY_SHELF) {
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
    // The post-build checks each body bundle against the shelf bundle, which names its hash, and the shelf against the start bundle.
    expect(script.readChunkManifest(REPO)).toEqual([
      ...shelfChunk.STORY_SHELF.map((e) => ({ name: slug(e.id), hash: e.chunk, namedBy: 'stories-shelf' })),
      { name: 'stories-shelf', hash: index.STORY_SHELF_HASH },
    ]);
  });

  it('the manifest the start bundle loads (lessons and the story index) stays within 60,000 B, and the shelf chunk within its line', () => {
    const lessons = Buffer.byteLength(read('content/__generated__/lessons-index.ts'));
    expect(lessons + Buffer.byteLength(start)).toBeLessThanOrEqual(script.BUDGET.manifestRaw);
    expect(Buffer.byteLength(shelf)).toBeLessThanOrEqual(script.BUDGET.shelfRaw);
  });

  /**
   * F-CURR-002 §10 (CM-8 decision record, row CM-8b): the plan's 35 stories with CM-40's Volume 1 + 2 lesson manifest
   * (about 36,300 B without the display lines, the CM-40 part 1 projection) must leave the start-loaded manifest under
   * 80% of its line, and the shelf chunk inside its own. A story adds its loader to the index and its entry to the
   * shelf; the projection scales today's per-story bytes, with CM-46a's tier levels (about 300 B) on top.
   */
  it('the projection for the 35 stories of the plan stays under 80% of the manifest line and inside the shelf line', () => {
    const PLAN_STORIES = 35;
    const LESSONS_VOLUME_1_AND_2 = 36_300;
    const stories = shelfChunk.STORY_SHELF.length;
    const perStory = (text: string, empty: string): number => (Buffer.byteLength(text) - Buffer.byteLength(empty)) / stories;
    const emptyIndex = start.replace(/ {4}case "[^"]+":\n {6}return import\('[^']+'\);\n/g, '');
    const emptyShelf = shelf.replace(/export const STORY_SHELF: StoryShelfEntry\[\] = .*;\n/, 'export const STORY_SHELF: StoryShelfEntry[] = [];\n');
    const indexAt35 = Buffer.byteLength(emptyIndex) + PLAN_STORIES * perStory(start, emptyIndex);
    const shelfAt35 = Buffer.byteLength(emptyShelf) + PLAN_STORIES * perStory(shelf, emptyShelf) + 300;
    expect(LESSONS_VOLUME_1_AND_2 + indexAt35).toBeLessThanOrEqual(0.8 * script.BUDGET.manifestRaw);
    expect(shelfAt35).toBeLessThanOrEqual(script.BUDGET.shelfRaw);
  });
});

describe('the TypeScript twins equal the generator', () => {
  it('STORY_BODY_FIELDS and SHELF_DEFAULTS', () => {
    expect([...STORY_BODY_FIELDS]).toEqual([...script.STORY_BODY_FIELDS]);
    expect(SHELF_DEFAULTS).toEqual(script.SHELF_DEFAULTS);
  });

  it('splitStory gives the shelf entry and the body the generator wrote, story by story', async () => {
    expect(shelfChunk.STORY_SHELF.map((e) => e.id)).toEqual(contentStories.map((s) => s.id));
    for (const story of contentStories) {
      const generated = shelfChunk.STORY_SHELF.find((e) => e.id === story.id);
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
    const store = createStoryStore({ entries: shelfChunk.STORY_SHELF }, index.loadStoryBody);
    const lazy = storiesOverStore(shelfChunk.STORY_SHELF, store);
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
