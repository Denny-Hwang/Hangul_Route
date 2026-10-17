import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-LAYOUT-001 PR 4 (§3.7): the Episode and Card detail bodies live in views
 * that a split pane can host, and the stack screens are thin wrappers that
 * render them. The screens have no renderer harness, so this reads the source.
 * Behaviour is held by the full mobile Playwright suite, unchanged.
 */
const SCREENS = resolve(__dirname, '../../screens');
const read = (file: string): string => readFileSync(resolve(SCREENS, file), 'utf8');

describe('EpisodeDetailView extraction (F-LAYOUT-001 PR 4)', () => {
  const view = read('episode/EpisodeDetailView.tsx');
  const screen = read('episode/EpisodeDetailScreen.tsx');

  it('the view exports the component with the spec props', () => {
    expect(view).toContain('export function EpisodeDetailView(');
    expect(view).toMatch(/episodeId: string/);
    expect(view).toMatch(/onStartQuest: \(questId: string, episodeId: string\) => void/);
    expect(view).toMatch(/onOpenCard: \(cardId: string\) => void/);
    expect(view).toMatch(/onBack\?: \(\) => void/);
  });

  it('the view owns the body: stores, prereq sheet and quest list', () => {
    expect(view).toContain('useProgressStore');
    expect(view).toContain('<PrereqSheet');
    expect(view).not.toContain('NativeStackScreenProps');
    expect(view).not.toContain('navigation');
  });

  it('the screen is a thin wrapper that keeps the navigation calls', () => {
    expect(screen).toContain('<EpisodeDetailView');
    expect(screen).toContain("navigation.navigate('QuestPlayer', { questId, episodeId })");
    expect(screen).toContain("navigation.navigate('CardDetail', { cardId })");
    expect(screen).toContain('navigation.goBack()');
    expect(screen).not.toContain('useProgressStore');
    expect(screen.split('\n').length).toBeLessThan(40);
  });
});

describe('CardDetailView extraction (F-LAYOUT-001 PR 4)', () => {
  const view = read('library/CardDetailView.tsx');
  const screen = read('library/CardDetailScreen.tsx');

  it('the view exports the component with the spec props', () => {
    expect(view).toContain('export function CardDetailView(');
    expect(view).toMatch(/cardId: string/);
    // Close is the route's ScreenHeader (AMENDMENTS-DISPLAY-NAV section 7.1): the view draws no close of its own.
    expect(view).not.toMatch(/onClose\?: \(\) => void/);
  });

  it('the view owns the flip, hear and share body', () => {
    // the flip animation itself lives in components/FlipCard.tsx since F-VOC-003 C-2
    expect(view).toContain('<FlipCard');
    expect(view).toContain('shareSnapshot');
    expect(view).not.toContain('NativeStackScreenProps');
    expect(view).not.toContain('navigation');
  });

  it('the screen is a thin wrapper; its Close is the route\'s ScreenHeader', () => {
    expect(screen).toContain('<CardDetailView');
    expect(screen).not.toContain('navigation.goBack()');
    expect(screen).not.toContain('useSharedValue');
    expect(screen.split('\n').length).toBeLessThan(30);
  });
});
