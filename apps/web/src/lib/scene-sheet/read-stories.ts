/**
 * Build-time reader for the contact sheet (F-STORY-002 §3.9.6): the story
 * files in `content/stories/*.json`, read with node:fs while `next build`
 * renders the static page. Server only; never shipped to the browser.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface StoryFile {
  /** File name inside the stories folder, e.g. `sejong-new-letters.json`. */
  file: string;
  /** Parsed JSON, or undefined when the file is not JSON. */
  json: unknown;
  /** Why the file could not be read as JSON. */
  error?: string;
}

/** `content/stories` seen from `apps/web` (the working directory of `next build` and the web tests). */
export function storiesDir(cwd: string = process.cwd()): string {
  return resolve(cwd, '../../content/stories');
}

/** Every top-level `*.json` story file, sorted by name; sub-folders (research/) are skipped. */
export function readStoryFiles(dir: string = storiesDir()): StoryFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json') && statSync(join(dir, name)).isFile())
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      try {
        return { file, json: JSON.parse(text) as unknown };
      } catch (e) {
        return { file, json: undefined, error: `Not valid JSON: ${(e as Error).message}` };
      }
    });
}
