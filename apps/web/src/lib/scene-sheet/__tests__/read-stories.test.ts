import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readStoryFiles, storiesDir } from '../read-stories';

describe('storiesDir', () => {
  it('points from apps/web to the repo content/stories folder', () => {
    expect(storiesDir('/repo/apps/web')).toBe(resolve('/repo/content/stories'));
    expect(storiesDir()).toBe(resolve(process.cwd(), '../../content/stories'));
  });
});

describe('readStoryFiles', () => {
  it('reads every top-level story file of the real folder, sorted by name', () => {
    const files = readStoryFiles();
    const expected = readdirSync(storiesDir()).filter((n) => n.endsWith('.json')).sort();
    expect(files.map((f) => f.file)).toEqual(expected);
    expect(files.length).toBeGreaterThanOrEqual(24);
    for (const f of files) expect(f.error, f.file).toBeUndefined();
  });

  it('skips sub-folders and other files, and reports a file that is not JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scene-sheet-'));
    mkdirSync(join(dir, 'research'));
    writeFileSync(join(dir, 'research', 'x.json'), '{}');
    writeFileSync(join(dir, 'README.md'), '# notes');
    writeFileSync(join(dir, 'b.json'), '{"id":"story:b"}');
    writeFileSync(join(dir, 'a.json'), '{ not json');
    const files = readStoryFiles(dir);
    expect(files.map((f) => f.file)).toEqual(['a.json', 'b.json']);
    expect(files[0]!.error).toMatch(/JSON/);
    expect(files[0]!.json).toBeUndefined();
    expect(files[1]).toEqual({ file: 'b.json', json: { id: 'story:b' } });
  });
});
