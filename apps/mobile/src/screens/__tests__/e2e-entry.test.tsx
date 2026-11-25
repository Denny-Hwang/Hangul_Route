import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-2: the fixture build's e2e entry (`navigation/e2e-entry.tsx`) mounts every
 * `window.__hr*E2E` hook and registers every e2e screen the root navigator registered before the registry, under the
 * same route names and with the same components. The e2e modules are stood in for by named stubs: this test pins the
 * wiring; the fixture-build e2e specs exercise the hooks themselves.
 */

const stub = (name: string): (() => null) => Object.defineProperty(() => null, 'name', { value: name });
const stubs = (...names: string[]): Record<string, () => null> => Object.fromEntries(names.map((n) => [n, stub(n)]));

vi.mock('../../navigation/story-e2e', () => stubs('StoryE2eHook'));
vi.mock('../../navigation/placement-e2e', () => stubs('PlacementE2eHook'));
vi.mock('../../navigation/vocab-question-e2e', () => stubs('VocabE2eHook', 'VocabQuestionE2eScreen'));
vi.mock('../../navigation/sentence-builder-e2e', () => stubs('SentenceE2eHook', 'SentenceBuilderE2eScreen'));
vi.mock('../../navigation/realia-read-e2e', () => stubs('RealiaE2eHook', 'RealiaReadE2eScreen'));
vi.mock('../../navigation/type-hangul-e2e', () => stubs('TypeHangulE2eHook', 'TypeHangulE2eScreen'));
vi.mock('../../navigation/trace-word-e2e', () => stubs('TraceWordE2eHook', 'TraceWordE2eScreen'));
vi.mock('../../navigation/write-frame-e2e', () => stubs('WriteFrameE2eHook', 'WriteFrameE2eScreen'));
vi.mock('../../navigation/story-order-e2e', () => stubs('StoryOrderE2eHook', 'StoryOrderE2eScreen'));
vi.mock('../../navigation/role-play-e2e', () => stubs('RolePlayE2eHook', 'RolePlayE2eScreen'));
vi.mock('../../navigation/hidden-heritage-e2e', () => stubs('HiddenHeritageE2eHook', 'HiddenHeritageE2eScreen'));
vi.mock('../../navigation/tap-board-e2e', () => stubs('TapBoardE2eHook', 'TapBoardE2eScreen'));
vi.mock('../minigames/cloze-pick-entry', () => ({ useClozePickChunk: () => ({ chunk: null, failed: false }) }));
vi.mock('../lesson-content', () => stubs('LessonWaiting'));

const childrenOf = (element: ReactElement): ReactElement[] =>
  ([] as ReactNode[]).concat((element.props as { children?: ReactNode }).children).filter(isValidElement);
const nameOf = (type: unknown): string => (type as { name: string }).name;

describe('the e2e entry (AMENDMENTS-START-BUNDLE-2026-11 SB-2)', () => {
  it('registers the eleven e2e screens with their components, under the route names root.tsx used', async () => {
    const { e2eEntry } = await import('../../navigation/e2e-entry');
    function Screen(): null {
      return null;
    }
    const stack = { Screen } as unknown as Parameters<typeof e2eEntry.screens>[0];
    const screens = childrenOf(e2eEntry.screens(stack));
    expect(screens.every((s) => s.type === Screen)).toBe(true);
    expect(screens.map((s) => [(s.props as { name: string }).name, nameOf((s.props as { component: unknown }).component)])).toEqual([
      ['VocabQuestionE2e', 'VocabQuestionE2eScreen'],
      ['SentenceBuilderE2e', 'SentenceBuilderE2eScreen'],
      ['RealiaReadE2e', 'RealiaReadE2eScreen'],
      ['TypeHangulE2e', 'TypeHangulE2eScreen'],
      ['TraceWordE2e', 'TraceWordE2eScreen'],
      ['WriteFrameE2e', 'WriteFrameE2eScreen'],
      ['ClozePickE2e', 'ClozePickE2eScreen'],
      ['StoryOrderE2e', 'StoryOrderE2eScreen'],
      ['RolePlayE2e', 'RolePlayE2eScreen'],
      ['HiddenHeritageE2e', 'HiddenHeritageE2eScreen'],
      ['TapBoardE2e', 'TapBoardE2eScreen'],
    ]);
  });

  it('mounts the thirteen hooks', async () => {
    const { e2eEntry } = await import('../../navigation/e2e-entry');
    expect(childrenOf(e2eEntry.Hooks()).map((h) => nameOf(h.type))).toEqual([
      'StoryE2eHook',
      'PlacementE2eHook',
      'VocabE2eHook',
      'SentenceE2eHook',
      'RealiaE2eHook',
      'TypeHangulE2eHook',
      'TraceWordE2eHook',
      'WriteFrameE2eHook',
      'ClozePickE2eHook',
      'StoryOrderE2eHook',
      'RolePlayE2eHook',
      'HiddenHeritageE2eHook',
      'TapBoardE2eHook',
    ]);
  });
});
