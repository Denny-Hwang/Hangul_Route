export {};

/**
 * Setup for every vitest project: the app loads each lesson cell's chunk on demand and the es / ko
 * titles for the active locale only (F-CURR-002 §10, `content/lessons.ts`), and each story's body
 * from its own chunk (row CM-8, `content/stories.ts`); a test reads the shipped content as if every
 * chunk had loaded, from the first line of the test file (some build their fixtures at module
 * level). The real loaders (the manifests' literal `import()`s) run here;
 * `logic/lessons/__tests__/lesson-store.test.ts` and `logic/story/__tests__/story-chunk-store.test.ts`
 * cover the lazy paths themselves.
 */
const [{ lessonContent }, { storyContent }] = await Promise.all([import('../content/lessons'), import('../content/stories')]);
await Promise.all([lessonContent.ensureAll(), lessonContent.ensureTitles('es'), lessonContent.ensureTitles('ko'), storyContent.ensureAll()]);
