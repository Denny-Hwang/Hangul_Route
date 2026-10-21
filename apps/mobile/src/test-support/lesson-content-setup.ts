export {};

/**
 * Setup for every vitest project: the app loads each lesson cell's chunk on demand and the es / ko
 * titles for the active locale only (F-CURR-002 §10, `content/lessons.ts`); a test reads the
 * shipped content as if every chunk had loaded, from the first line of the test file (some build
 * their fixtures at module level). The real loaders (the manifest's literal `import()`s) run
 * here; `logic/lessons/__tests__/lesson-store.test.ts` covers the lazy path itself.
 */
const { lessonContent } = await import('../content/lessons');
await Promise.all([lessonContent.ensureAll(), lessonContent.ensureTitles('es'), lessonContent.ensureTitles('ko')]);
