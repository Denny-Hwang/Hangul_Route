import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { backOrHome, linkOpenRoute, resolveOptionalExit, resolveScreenExits } from '../screen-exits';

/**
 * F-BROWSE-001 §4.7 (BR-5c): the navigation adapter. `MinigameScreen`,
 * `StoryReaderScreen` and `StorySourcesScreen` leave through `onBack`,
 * `onHome` and `onOpenLink` props whose learner defaults keep today's routes,
 * so another stack (All lessons) can host them without registering learner
 * routes. `onOpenLink: null` means links are copy-only.
 */
function learner() {
  return { back: vi.fn(), home: vi.fn(), openLink: vi.fn() };
}

describe('backOrHome', () => {
  it('goes back when the stack can, else home', () => {
    const home = vi.fn();
    const stack = { canGoBack: vi.fn(() => true), goBack: vi.fn() };
    backOrHome(stack, home);
    expect(stack.goBack).toHaveBeenCalledTimes(1);
    expect(home).not.toHaveBeenCalled();

    stack.canGoBack.mockReturnValue(false);
    backOrHome(stack, home);
    expect(stack.goBack).toHaveBeenCalledTimes(1);
    expect(home).toHaveBeenCalledTimes(1);
  });
});

describe('resolveScreenExits', () => {
  it('keeps every learner default when no prop is given', () => {
    const d = learner();
    const exits = resolveScreenExits({}, d);
    exits.back();
    exits.home();
    exits.openLink?.('https://example.org/a');
    expect(d.back).toHaveBeenCalledTimes(1);
    expect(d.home).toHaveBeenCalledTimes(1);
    expect(d.openLink).toHaveBeenCalledWith('https://example.org/a');
  });

  it('uses the given exits instead of the learner routes', () => {
    const d = learner();
    const onBack = vi.fn();
    const onHome = vi.fn();
    const onOpenLink = vi.fn();
    const exits = resolveScreenExits({ onBack, onHome, onOpenLink }, d);
    exits.back();
    exits.home();
    exits.openLink?.('https://example.org/b');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onOpenLink).toHaveBeenCalledWith('https://example.org/b');
    expect(d.back).not.toHaveBeenCalled();
    expect(d.home).not.toHaveBeenCalled();
    expect(d.openLink).not.toHaveBeenCalled();
  });

  it('makes links copy-only for onOpenLink: null', () => {
    expect(resolveScreenExits({ onOpenLink: null }, learner()).openLink).toBeNull();
  });

  it('takes each prop on its own', () => {
    const d = learner();
    const onHome = vi.fn();
    const exits = resolveScreenExits({ onHome }, d);
    exits.back();
    exits.home();
    expect(d.back).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});

describe('resolveOptionalExit', () => {
  it('uses the host function when one is given', () => {
    const host = vi.fn();
    const learnerRoute = vi.fn();
    resolveOptionalExit(host, learnerRoute)?.('cn-a');
    expect(host).toHaveBeenCalledWith('cn-a');
    expect(learnerRoute).not.toHaveBeenCalled();
  });

  it('keeps the learner route when no prop is given, and has none without a learner stack', () => {
    const learnerRoute = vi.fn();
    resolveOptionalExit(undefined, learnerRoute)?.('cn-b');
    expect(learnerRoute).toHaveBeenCalledWith('cn-b');
    expect(resolveOptionalExit(undefined, undefined)).toBeUndefined();
  });

  it('null hides the exit even where the learner route exists', () => {
    expect(resolveOptionalExit(null, vi.fn())).toBeUndefined();
  });
});

describe('linkOpenRoute', () => {
  it('has no Open route when links are copy-only, and never reads the gate', () => {
    const gate = vi.fn(() => true);
    expect(linkOpenRoute(null, gate)).toBe('none');
    expect(gate).not.toHaveBeenCalled();
  });

  it('sends every press to a host function, even while the grown-up gate is open', () => {
    const gate = vi.fn(() => true);
    expect(linkOpenRoute(vi.fn(), gate)).toBe('host');
    expect(linkOpenRoute(vi.fn(), () => false)).toBe('host');
    expect(gate).not.toHaveBeenCalled();
  });

  it('keeps the learner path: the direct hand-off while the gate is open, else the gate', () => {
    expect(linkOpenRoute(undefined, () => true)).toBe('hand-off');
    expect(linkOpenRoute(undefined, () => false)).toBe('gate');
  });
});

describe('screens take their exits through the adapter (BR-5c)', () => {
  const read = (file: string): string => readFileSync(resolve(__dirname, '../../../screens', file), 'utf8');

  it.each(['minigames/MinigameScreen.tsx', 'story/StoryReaderScreen.tsx', 'story/StorySourcesScreen.tsx'])(
    '%s accepts the exit props and resolves them once',
    (file) => {
      const source = read(file);
      expect(source).toContain('ScreenExitProps');
      expect(source).toContain('resolveScreenExits(');
      // Every navigation call sits in the learner defaults; nothing else reaches the stack.
      expect(source).not.toMatch(/onPress=\{\(\) => navigation\./);
    },
  );

  it('the reader opens Sources through a prop with the learner route as default', () => {
    const source = read('story/StoryReaderScreen.tsx');
    expect(source).toContain('onOpenSources?:');
  });

  it.each(['story/StoryReaderScreen.tsx', 'minigames/MinigameScreen.tsx'])(
    '%s opens Culture notes through a prop, the learner route only as its default (F-STORY-004 PR 4.7)',
    (file) => {
      const source = read(file);
      expect(source).toContain('onOpenCultureNote?: ((noteId: string) => void) | null;');
      expect(source).toMatch(/resolveOptionalExit\(\s*onOpenCultureNote,/);
      // Pushed, so a Culture notes screen lower in the stack is never popped back to.
      expect(source).toContain("navigation.push('CultureNotes',");
      expect(source).not.toContain("navigate('CultureNotes'");
    },
  );

  it('the quest step takes Culture notes from the game shell, never from the learner stack itself', () => {
    const game = read('minigames/StoryReadGame.tsx');
    expect(game).not.toContain('useNavigation');
    expect(game).toContain('onOpenCultureNote');
    // Over a running quest the screen offers Back only.
    expect(read('minigames/MinigameScreen.tsx')).toContain("from: 'quest'");
  });

  it('Sources offers Copy link only when links are copy-only', () => {
    const screen = read('story/StorySourcesScreen.tsx');
    expect(screen).toContain('const openLink = exits.openLink;');
    expect(screen).toMatch(/onOpen=\{openLink === null \? null : /);
    // The press is routed by linkOpenRoute, so a host function is never bypassed by the learner gate.
    expect(screen).toContain('linkOpenRoute(exitProps.onOpenLink,');
    const parts = read('story/SourcesParts.tsx');
    expect(parts).toMatch(/onOpen: \(\(source: SourceView, sourceIndex: number\) => void\) \| null/);
  });
});
