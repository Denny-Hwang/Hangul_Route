import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Quest } from '@hangul-route/content-schema';
import type { Bookmark } from '../../story/bookmarks';
import {
  learnerQuestExits,
  learnerQuestSession,
  questFinish,
  resultsReset,
  type QuestPlayerPorts,
} from '../quest-player-ports';

/**
 * F-BROWSE-001 BR-5a (§4.7): the quest player body is `QuestPlayerView`, and everything it does
 * to the outside world goes through `QuestPlayerPorts`. These tests pin today's learner ports
 * (session, Results, leave, telemetry), and read the view and screen sources to hold the seam:
 * the view reaches no learner store, no navigation and no telemetry client of its own.
 * The screens have no renderer harness; behaviour is held by the full mobile Playwright suite.
 */

const storyQuest: Quest = {
  id: 'quest:story-sun-and-moon-listen',
  titleEn: 'The sun and the moon',
  estimatedMinutes: 5,
  steps: [
    { id: 'q-intro', kind: 'intro', titleEn: 'Hi' },
    { id: 'q-read', kind: 'practice', titleEn: 'Read', minigameKind: 'story-read', minigameRef: 'minigame:story-read-listen-sun-and-moon' },
    { id: 'q-reward', kind: 'reward', titleEn: 'Yay' },
  ],
};
const mark = (level: Bookmark['level']): Bookmark => ({ level, sceneIndex: 2, updatedAt: '2026-10-11T09:00:00.000Z' });

function sessionDeps(overrides: Partial<Parameters<typeof learnerQuestSession>[0]> = {}) {
  return {
    profileId: 'p1' as string | null,
    resume: undefined as boolean | undefined,
    questById: vi.fn((_id: string): Quest | undefined => storyQuest),
    bookmarkOf: vi.fn((_profileId: string, _storyId: string): Bookmark | undefined => undefined),
    beginSession: vi.fn(),
    endSession: vi.fn(),
    ...overrides,
  };
}

describe('learnerQuestSession (today: questStartStep + beginSession / endSession)', () => {
  it('starts at step 0 and begins a session for the active profile', () => {
    const deps = sessionDeps();
    const session = learnerQuestSession(deps);
    expect(session.start('quest:q1', 'episode:e1')).toBe(0);
    expect(deps.questById).toHaveBeenCalledWith('quest:q1');
    expect(deps.beginSession).toHaveBeenCalledWith('p1');
    expect(deps.endSession).not.toHaveBeenCalled();
  });

  it('reads no bookmark without resume', () => {
    const deps = sessionDeps();
    learnerQuestSession(deps).start('quest:q1', 'episode:e1');
    expect(deps.bookmarkOf).not.toHaveBeenCalled();
  });

  it('a resumed story quest opens on its story-read step when the profile has a usable bookmark', () => {
    const deps = sessionDeps({ resume: true, bookmarkOf: vi.fn(() => mark('listen')) });
    expect(learnerQuestSession(deps).start('quest:q1', 'episode:e1')).toBe(1);
    expect(deps.bookmarkOf).toHaveBeenCalledWith('p1', 'story:sun-and-moon');
    expect(deps.beginSession).toHaveBeenCalledWith('p1');
  });

  it('a bookmark for another level starts at step 0', () => {
    const deps = sessionDeps({ resume: true, bookmarkOf: vi.fn(() => mark('read')) });
    expect(learnerQuestSession(deps).start('quest:q1', 'episode:e1')).toBe(0);
  });

  it('a resumed quest without a bookmark starts at step 0', () => {
    const deps = sessionDeps({ resume: true });
    expect(learnerQuestSession(deps).start('quest:q1', 'episode:e1')).toBe(0);
    expect(deps.bookmarkOf).toHaveBeenCalledWith('p1', 'story:sun-and-moon');
  });

  it('an unknown quest starts at step 0', () => {
    const deps = sessionDeps({ resume: true, questById: vi.fn(() => undefined) });
    expect(learnerQuestSession(deps).start('quest:missing', 'episode:e1')).toBe(0);
  });

  it('end closes the session of the same profile', () => {
    const deps = sessionDeps();
    learnerQuestSession(deps).end();
    expect(deps.endSession).toHaveBeenCalledWith('p1');
  });

  it('with no active profile nothing begins and nothing ends (the run is not started)', () => {
    const deps = sessionDeps({ profileId: null });
    const session = learnerQuestSession(deps);
    expect(session.start('quest:q1', 'episode:e1')).toBeNull();
    session.end();
    expect(deps.beginSession).not.toHaveBeenCalled();
    expect(deps.endSession).not.toHaveBeenCalled();
    expect(deps.questById).not.toHaveBeenCalled();
  });
});

describe('questFinish (honest outcome + retries)', () => {
  it('scores first tries and carries retries for telemetry', () => {
    expect(questFinish({ correctCount: 4, totalCount: 5, retryCount: 2 })).toEqual({
      stars: expect.any(Number),
      correct: 4,
      total: 5,
      played: true,
      retries: 2,
    });
  });

  it('a run with every game skipped is 0 / 0, not 5 / 5', () => {
    expect(questFinish({ correctCount: 0, totalCount: 0, retryCount: 0 })).toEqual({
      stars: 0,
      correct: 0,
      total: 0,
      played: false,
      retries: 0,
    });
  });
});

describe('resultsReset (today: reset to Main + Results)', () => {
  it('builds the two-route stack with the Results params', () => {
    expect(
      resultsReset('quest:q1', 'episode:e1', { stars: 3, correct: 5, total: 5, played: true, retries: 1 }),
    ).toEqual({
      index: 1,
      routes: [
        { name: 'Main' },
        {
          name: 'Results',
          params: { questId: 'quest:q1', episodeId: 'episode:e1', stars: 3, correct: 5, total: 5, retries: 1 },
        },
      ],
    });
  });
});

function exitDeps(overrides: Partial<Parameters<typeof learnerQuestExits>[0]> = {}) {
  return {
    questId: 'quest:q1',
    episodeId: 'episode:e1',
    profileId: 'p1' as string | undefined,
    panes: 1 as 1 | 2,
    under: vi.fn((): string | undefined => 'Main'),
    toResults: vi.fn(),
    toJourneyPane: vi.fn(),
    toEpisodeScreen: vi.fn(),
    track: vi.fn(),
    ...overrides,
  };
}

describe('learnerQuestExits', () => {
  it('finish resets to Results with the outcome', () => {
    const deps = exitDeps();
    const finish = { stars: 2 as const, correct: 3, total: 5, played: true, retries: 4 };
    learnerQuestExits(deps).finish(finish);
    expect(deps.toResults).toHaveBeenCalledWith(resultsReset('quest:q1', 'episode:e1', finish));
  });

  it('leave on one pane replaces with the episode screen', () => {
    const deps = exitDeps();
    learnerQuestExits(deps).leave();
    expect(deps.toEpisodeScreen).toHaveBeenCalledWith('episode:e1');
    expect(deps.toJourneyPane).not.toHaveBeenCalled();
  });

  it('leave on two panes from the tabs returns to the Journey pane with the episode selected', () => {
    const deps = exitDeps({ panes: 2, episodeId: 'episode:stage1-letters' });
    learnerQuestExits(deps).leave();
    expect(deps.toJourneyPane).toHaveBeenCalledWith('episode:stage1-letters');
    expect(deps.toEpisodeScreen).not.toHaveBeenCalled();
  });

  it('leave on two panes from another screen stays under it (episode screen)', () => {
    const deps = exitDeps({ panes: 2, under: vi.fn(() => 'Homework') });
    learnerQuestExits(deps).leave();
    expect(deps.toEpisodeScreen).toHaveBeenCalledWith('episode:e1');
  });

  it('track sends the event with the active profile id', () => {
    const deps = exitDeps();
    learnerQuestExits(deps).track({ name: 'quest.discover_completed', payload: { questId: 'quest:q1' } });
    expect(deps.track).toHaveBeenCalledWith({
      name: 'quest.discover_completed',
      profileId: 'p1',
      payload: { questId: 'quest:q1' },
    });
  });

  it('track without a profile sends no profile id', () => {
    const deps = exitDeps({ profileId: undefined });
    learnerQuestExits(deps).track({ name: 'quest.check_completed' });
    expect(deps.track).toHaveBeenCalledWith({ name: 'quest.check_completed', profileId: undefined });
  });
});

describe('ports shape', () => {
  it('session and exits together satisfy QuestPlayerPorts', () => {
    const ports: QuestPlayerPorts = { ...learnerQuestSession(sessionDeps()), ...learnerQuestExits(exitDeps()) };
    expect(Object.keys(ports).sort()).toEqual(['end', 'finish', 'leave', 'start', 'track']);
  });
});

const SCREENS = resolve(__dirname, '../../../screens/quest');
const read = (file: string): string => readFileSync(resolve(SCREENS, file), 'utf8');
const importsOf = (src: string): string[] =>
  [...src.matchAll(/from '([^']+)'/g)].map((match) => match[1] as string);

describe('QuestPlayerView extraction (source)', () => {
  const view = read('QuestPlayerView.tsx');
  const screen = read('QuestPlayerScreen.tsx');

  it('the view exports the component with the ports prop', () => {
    expect(view).toContain('export function QuestPlayerView(');
    expect(view).toMatch(/ports: QuestPlayerPorts/);
    expect(view).toMatch(/onOpenGame: \(stepIndex: number\) => void/);
    expect(view).toMatch(/onBack: \(\) => void/);
  });

  it('the view reaches no learner store, no navigation types and no telemetry client', () => {
    const forbidden = [
      '../../store/progress-store',
      '../../store/profile-store',
      '../../store/story-store',
      '../../platform/telemetry',
      '../../navigation/types',
      '@react-navigation/native-stack',
    ];
    for (const spec of importsOf(view)) expect(forbidden).not.toContain(spec);
    expect(view).not.toContain('navigation.');
    expect(view).not.toContain('CommonActions');
  });

  it('the view runs every exit through the ports', () => {
    expect(view).toContain('ports.finish(');
    expect(view).toContain('ports.leave()');
    expect(view).toMatch(/ports(Ref\.current)?\.track\(/);
    expect(view).toMatch(/start\(questId, episodeId\)/);
  });

  it('the screen is a thin wrapper that keeps the learner wiring', () => {
    expect(screen).toContain('<QuestPlayerView');
    expect(screen).toContain('learnerQuestSession(');
    expect(screen).toContain('learnerQuestExits(');
    expect(screen).toContain("navigation.navigate('Minigame', { questId, episodeId, stepIndex })");
    expect(screen).toContain('navigation.goBack()');
    expect(screen).toContain('CommonActions.reset(');
    expect(screen).not.toContain('<DiscoverStep');
    expect(screen.split('\n').length).toBeLessThan(90);
  });
});
