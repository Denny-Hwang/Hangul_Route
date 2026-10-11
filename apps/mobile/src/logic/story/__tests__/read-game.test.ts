import { describe, expect, it, vi } from 'vitest';
import { storiesAll } from '../../../content/stories';
import { readGameHandlers, readGameTarget } from '../read-game';
import { readyStory } from './story-fixture';

describe('readGameTarget (F-STORY-002 §3.1, PR 2.6b)', () => {
  const story = readyStory();
  const find = (id: string) => (id === story.id ? story : undefined);

  it('resolves the story and level of a story-read scope', () => {
    expect(readGameTarget({ story: { storyId: story.id, level: 'listen' } }, find)).toEqual({
      story,
      level: 'listen',
    });
  });

  it('keeps the level of the ref, even one the story lacks (the reader then shows its fallback)', () => {
    expect(readGameTarget({ story: { storyId: story.id, level: 'read' } }, find)).toEqual({ story, level: 'read' });
  });

  it('gives an undefined story for an unknown id, so the reader shows its one-line fallback', () => {
    expect(readGameTarget({ story: { storyId: 'story:nope', level: 'listen' } }, find)).toEqual({
      story: undefined,
      level: 'listen',
    });
  });

  it('gives an undefined story for a scope without a story (listen level as a stand-in)', () => {
    expect(readGameTarget({}, find)).toEqual({ story: undefined, level: 'listen' });
  });

  it('reads the content bundle by default', () => {
    const bundled = storiesAll[0];
    expect(bundled).toBeDefined();
    if (!bundled) return;
    const level = bundled.tiers[0]!.level;
    expect(readGameTarget({ story: { storyId: bundled.id, level } })).toEqual({ story: bundled, level });
    expect(readGameTarget({ story: { storyId: 'story:not-in-the-bundle', level: 'listen' } }).story).toBeUndefined();
  });
});

function deps() {
  const calls: string[] = [];
  return {
    calls,
    d: {
      saveBookmark: vi.fn((i: number) => calls.push(`save:${i}`)),
      answerRound: vi.fn((k: string, c: boolean) => calls.push(`answer:${k}:${c}`)),
      markStepComplete: vi.fn(() => calls.push('complete')),
      finish: vi.fn(() => calls.push('finish')),
      back: vi.fn(() => calls.push('back')),
    },
  };
}

describe('readGameHandlers (§3.3, §3.6: the quest host of the reader)', () => {
  it('Continue on the end page marks the step complete, then finishes the game', () => {
    const { calls, d } = deps();
    readGameHandlers(d).onFinish();
    expect(calls).toEqual(['complete', 'finish']);
  });

  it('Close goes back without completing the step (nothing is lost: reading records no score)', () => {
    const { calls, d } = deps();
    readGameHandlers(d).onClose();
    expect(calls).toEqual(['back']);
    expect(d.markStepComplete).not.toHaveBeenCalled();
    expect(d.finish).not.toHaveBeenCalled();
  });

  it('a scene change goes to the bookmark seam', () => {
    const { calls, d } = deps();
    readGameHandlers(d).onSceneChange(3);
    expect(calls).toEqual(['save:3']);
  });

  it('a checkpoint answer goes to the quest run with its cp: round key', () => {
    const { calls, d } = deps();
    const h = readGameHandlers(d);
    h.onAnswer('cp:cp1', true);
    h.onAnswer('cp:cp1', false);
    expect(calls).toEqual(['answer:cp:cp1:true', 'answer:cp:cp1:false']);
  });
});
