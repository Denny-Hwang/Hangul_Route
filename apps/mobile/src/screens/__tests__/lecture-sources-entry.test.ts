import { describe, expect, it, vi } from 'vitest';

/**
 * [SB] AMENDMENTS-START-BUNDLE-2026-11 row SB-4e: the start bundle's door to the lecture sources both grown-up roots
 * read (`lecture-sources-entry.ts`). The roots' loader puts the chunk in before a root draws; a read before that is a
 * named wiring error, never a state to draw.
 */
describe('the lecture sources door', () => {
  it('reads as a named error until the chunk is in, then gives the three sources', async () => {
    vi.resetModules();
    const door = await import('../lecture-sources-entry');
    expect(door.lectureSourcesDoor.now()).toBeNull();
    expect(() => door.lectureSourcesNow()).toThrow(door.LectureSourcesMissing);
    expect(() => door.useLectureSources()).toThrow(/not loaded/);
    const chunk = await door.lectureSourcesDoor.load();
    expect(door.lectureSourcesNow()).toBe(chunk);
    expect(door.useLectureSources()).toBe(chunk);
    expect(Object.keys(chunk).sort()).toEqual(['PAUSE_WORD', 'ROOT_CHUNK', 'lectureBundle', 'lectureStories', 'lectureVocabTopics', 'soundCheckSpec']);
    expect(chunk.ROOT_CHUNK).toBe('root-chunk:lecture-sources');
    expect(chunk.PAUSE_WORD.ko).toBe('잠깐');
    expect(chunk.lectureBundle('en').locale).toBe('en');
  });

  it('names the web bundle the roots\' timeout gives up', async () => {
    const { LECTURE_SOURCES_BUNDLE } = await import('../lecture-sources-entry');
    expect(LECTURE_SOURCES_BUNDLE).toBe('lecture-sources-chunk');
  });
});
