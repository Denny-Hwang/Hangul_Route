import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The files that read a quest's `steps` or a game scope (F-CURR-002 §10, row CM-5). A lesson quest's
 * steps and scopes come from its cell's chunk, so on a cold web start they are empty until it loads,
 * while the global test setup preloads every chunk and no other test sees that state. Each file here
 * is listed with why it is safe; a new file that reads them fails this test until it is listed, so
 * whoever adds it decides how it waits: behind `useLessonQuestReady` (a screen that plays one quest),
 * `useLessonContentVersion` (a count over every quest that fills as chunks arrive) or `withLessonContent`
 * (a root that reads the whole catalogue), or from the manifest (`lessonQuestTeaches`).
 */
const READS = /\.steps\b|\bscopeFor\(|\bstepsOf\(|\bloadedScopes\(/;

const ALLOWED: Readonly<Record<string, string>> = {
  'components/InstallGuideSheet.tsx': 'not a quest: the install guide message steps',
  'components/VoiceHelpSheet.tsx': 'not a quest: the voice help sections',
  'logic/audio/voice-help.ts': 'not a quest: the voice help sections',
  'logic/browse/facts.ts': 'All lessons: the browse root mounts through withLessonContent',
  'logic/lecture/build-steps.ts': 'not a quest: a lecture slide body, built once the presenter root has every chunk',
  'logic/lecture/content.ts': 'the presenter and lecture roots mount through withLessonContent',
  'logic/lecture/deck-builder.ts': 'the presenter and lecture roots mount through withLessonContent',
  'logic/lecture/slide-view.ts': 'not a quest: a lecture slide',
  'logic/lecture/tools.ts': 'not a quest: a lecture slide',
  'logic/lessons/lesson-store.ts': 'the store itself',
  'logic/minigame-config.ts': 'scopeFor delegates to the store; its callers (the game screen, lecture) wait for the chunk',
  'logic/my-route/skills.ts': 'My Route and the reports count through useLessonContentVersion',
  'logic/sentence-builder/view.ts': 'the game screen, behind useLessonQuestReady',
  'logic/stage1/curriculum.ts': 'a lesson quest reads LESSON_TEACHES from the manifest (questTeaches); steps only for Stage 1',
  'logic/story/reader-effects.ts': 'not a quest: a story reader step list',
  'logic/story/story-ref.ts': 'storyReadStep: browse (withLessonContent) and the story minigame refs',
  'screens/browse/BrowseItemScreen.tsx': 'All lessons: the browse root mounts through withLessonContent',
  'screens/minigames/MinigameScreen.tsx': 'behind useLessonQuestReady',
  'screens/presenter/slides/SequenceSlide.tsx': 'not a quest: a lecture slide',
  'screens/quest/QuestPlayerView.tsx': 'behind useLessonQuestReady',
  'screens/story/use-reader-audio.ts': 'not a quest: a story reader step list',
};

const SRC = join(__dirname, '..', '..', '..');
const SKIP = /(^|\/)(__tests__|__generated__|test-support)(\/|$)|\.test\.tsx?$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP.test(relative(SRC, path)) ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !SKIP.test(relative(SRC, path)) ? [path] : [];
  });
}

describe('readers of quest steps and game scopes (they are empty until a lesson chunk loads)', () => {
  const readers = sourceFiles(SRC)
    .filter((path) => READS.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path).split('\\').join('/'))
    .sort();

  it('every file that reads them is listed with how it waits for the chunk', () => {
    const unlisted = readers.filter((file) => ALLOWED[file] === undefined);
    expect(unlisted, 'put the new reader behind a lesson wait (screens/lesson-content.tsx), then list it here').toEqual([]);
  });

  it('the list names no file that no longer reads them', () => {
    expect(Object.keys(ALLOWED).filter((file) => !readers.includes(file))).toEqual([]);
  });
});
