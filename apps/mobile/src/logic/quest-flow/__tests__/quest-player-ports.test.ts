import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Quest } from '@hangul-route/content-schema';
import { useProgressStore } from '../../../store/progress-store';
import type { Bookmark } from '../../story/bookmarks';
import {
  learnerQuestExits,
  learnerQuestSession,
  previewQuestPorts,
  questFinish,
  resultsReset,
  runQuestFinish,
  runQuestLeave,
  runQuestStart,
  type QuestPlayerPorts,
} from '../quest-player-ports';

/**
 * F-BROWSE-001 BR-5a (§4.7): the quest player body is `QuestPlayerView`, and everything it does
 * to the outside world goes through `QuestPlayerPorts`. These tests pin today's learner ports
 * (session, Results, leave, telemetry) and the view's own start / Leave / finish rules (the pure
 * `runQuest*` helpers its effect and handlers call), and read the view and screen sources to hold the
 * seam: the view reaches no learner store, no navigation stack and no telemetry client of its own
 * (`useFocusEffect` is its one allowed navigation coupling). The screens have no renderer harness;
 * rendered behaviour is held by the full mobile Playwright suite.
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
  const release = vi.fn();
  return {
    profileId: 'p1' as string | null,
    resume: undefined as boolean | undefined,
    questById: vi.fn((_id: string): Quest | undefined => storyQuest),
    bookmarkOf: vi.fn((_profileId: string, _storyId: string): Bookmark | undefined => undefined),
    /** What `holdSession` hands back: the release the player calls on `end`. */
    release,
    holdSession: vi.fn((_profileId: string, _options: { owner: string; streak: boolean }) => release),
    ...overrides,
  };
}

const heldDeps = sessionDeps;

describe('learnerQuestSession (questStartStep + a held session, F-REPORT-001 RP-3b)', () => {
  it('starts at step 0 and holds a streak session owned by the quest for the active profile', () => {
    const deps = heldDeps();
    const session = learnerQuestSession(deps);
    expect(session.start('quest:q1', 'episode:e1')).toBe(0);
    expect(deps.questById).toHaveBeenCalledWith('quest:q1');
    expect(deps.holdSession).toHaveBeenCalledWith('p1', { owner: 'quest:quest:q1', streak: true });
    expect(deps.release).not.toHaveBeenCalled();
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
    expect(deps.holdSession).toHaveBeenCalledTimes(1);
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

  it('end releases the session the start held, once', () => {
    const deps = heldDeps();
    const session = learnerQuestSession(deps);
    session.start('quest:q1', 'episode:e1');
    session.end();
    session.end();
    expect(deps.release).toHaveBeenCalledTimes(1);
  });

  it('end without a start releases nothing; a second start releases the first hold first', () => {
    const deps = heldDeps();
    const session = learnerQuestSession(deps);
    session.end();
    expect(deps.release).not.toHaveBeenCalled();
    session.start('quest:q1', 'episode:e1');
    session.start('quest:q2', 'episode:e1');
    expect(deps.release).toHaveBeenCalledTimes(1);
    expect(deps.holdSession).toHaveBeenLastCalledWith('p1', { owner: 'quest:quest:q2', streak: true });
  });

  it('with no active profile nothing begins and nothing ends (the run is not started)', () => {
    const deps = sessionDeps({ profileId: null });
    const session = learnerQuestSession(deps);
    expect(session.start('quest:q1', 'episode:e1')).toBeNull();
    session.end();
    expect(deps.holdSession).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.questById).not.toHaveBeenCalled();
  });
});

describe('questFinish (honest outcome + retries)', () => {
  it('scores first tries and carries retries for telemetry', () => {
    expect(questFinish({ correctCount: 4, totalCount: 5, retryCount: 2 })).toEqual({
      stars: 2,
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

function stubPorts() {
  const calls: string[] = [];
  const ports = {
    start: vi.fn((_q: string, _e: string): number | null => {
      calls.push('start');
      return 1;
    }),
    end: vi.fn(() => calls.push('end')),
    finish: vi.fn(() => calls.push('finish')),
    leave: vi.fn(() => calls.push('leave')),
  };
  return { ports, calls };
}

describe("the view's run rules (runQuestStart / runQuestLeave / runQuestFinish)", () => {
  it('start begins the run on the step the ports pick and returns end as the cleanup', () => {
    const { ports, calls } = stubPorts();
    const begin = vi.fn(() => calls.push('begin'));
    const cleanup = runQuestStart(ports, begin, 'quest:q1', 'episode:e1');
    expect(ports.start).toHaveBeenCalledWith('quest:q1', 'episode:e1');
    expect(begin).toHaveBeenCalledWith('quest:q1', 'episode:e1', 1);
    expect(ports.end).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
    cleanup?.();
    expect(ports.end).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['start', 'begin', 'end']);
  });

  it('a null start leaves the run unstarted and has no cleanup, so end never runs', () => {
    const { ports } = stubPorts();
    ports.start.mockReturnValue(null);
    const begin = vi.fn();
    expect(runQuestStart(ports, begin, 'quest:q1', 'episode:e1')).toBeUndefined();
    expect(begin).not.toHaveBeenCalled();
    expect(ports.end).not.toHaveBeenCalled();
  });

  it('a confirmed Leave discards the run before the ports take the player back', () => {
    const { ports, calls } = stubPorts();
    const reset = vi.fn(() => calls.push('reset'));
    runQuestLeave(reset, ports);
    expect(calls).toEqual(['reset', 'leave']);
  });

  it('finish hands the honest outcome of the store counters to the ports and leaves the run in place', () => {
    const { ports } = stubPorts();
    runQuestFinish({ correctCount: 4, totalCount: 5, retryCount: 2 }, ports);
    expect(ports.finish).toHaveBeenCalledWith({ stars: 2, correct: 4, total: 5, played: true, retries: 2 });
    expect(ports.leave).not.toHaveBeenCalled();
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

describe('previewQuestPorts (F-BROWSE-001 BR-8, section 4.7: a preview saves nothing)', () => {
  function previewDeps() {
    return { resetRun: vi.fn(), toEnd: vi.fn(), toItem: vi.fn() };
  }

  /** Every writer of the learner progress store, spied: a preview may call none of them. */
  function spyProgressWriters(): ReturnType<typeof vi.fn>[] {
    const state = useProgressStore.getState() as unknown as Record<string, unknown>;
    return Object.keys(state)
      .filter((key) => typeof state[key] === 'function')
      .map((key) => vi.spyOn(state as Record<string, (...args: unknown[]) => unknown>, key) as unknown as ReturnType<typeof vi.fn>);
  }

  it('starts at step 0 with no session and no profile, and ends with nothing to release', () => {
    const deps = previewDeps();
    const ports = previewQuestPorts(deps);
    expect(ports.start('quest:stage1-letters-q1', 'episode:stage1-letters')).toBe(0);
    ports.end();
    expect(deps.resetRun).not.toHaveBeenCalled();
    expect(deps.toEnd).not.toHaveBeenCalled();
    expect(deps.toItem).not.toHaveBeenCalled();
  });

  it('finish resets the run itself and goes to the preview end screen, never Results', () => {
    const deps = previewDeps();
    const order: string[] = [];
    deps.resetRun.mockImplementation(() => order.push('reset'));
    deps.toEnd.mockImplementation(() => order.push('end'));
    previewQuestPorts(deps).finish(questFinish({ correctCount: 2, totalCount: 2, retryCount: 1 }));
    expect(order).toEqual(['reset', 'end']);
    expect(deps.toItem).not.toHaveBeenCalled();
  });

  it('leave goes back to the item page (the view has already discarded the run)', () => {
    const deps = previewDeps();
    const reset = vi.fn();
    runQuestLeave(reset, previewQuestPorts(deps));
    expect(reset).toHaveBeenCalledOnce();
    expect(deps.toItem).toHaveBeenCalledOnce();
    expect(deps.toEnd).not.toHaveBeenCalled();
  });

  it('track sends nothing: the view names no person and the preview adds none', () => {
    const deps = previewDeps();
    const ports = previewQuestPorts(deps);
    expect(ports.track({ name: 'quest.discover_completed', payload: { questId: 'quest:x', pages: 1, heard: 0 } })).toBeUndefined();
  });

  it('a whole preview run (start, end, finish, leave, track) calls no learner store writer', () => {
    const spies = spyProgressWriters();
    expect(spies.length).toBeGreaterThan(0);
    const ports = previewQuestPorts(previewDeps());
    const cleanup = runQuestStart(ports, vi.fn(), 'quest:stage1-letters-q1', 'episode:stage1-letters');
    runQuestFinish({ correctCount: 2, totalCount: 2, retryCount: 0 }, ports);
    runQuestLeave(vi.fn(), ports);
    ports.track({ name: 'quest.check_completed', payload: { questId: 'quest:x', correct: 2, retries: 0 } });
    cleanup?.();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
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
    const forbidden =
      /store\/(progress|profile|story)-store|platform\/telemetry|navigation\/types|@react-navigation\/native-stack|^\.\.\/\.\.\/store(\/index)?(\.ts)?$/;
    for (const spec of importsOf(view)) expect(spec).not.toMatch(forbidden);
    const navigationImports = importsOf(view).filter((spec) => spec.startsWith('@react-navigation/'));
    expect(navigationImports).toEqual(['@react-navigation/native']);
    expect(view).toMatch(/import \{ useFocusEffect \} from '@react-navigation\/native'/);
    expect(view).not.toContain('navigation.');
    expect(view).not.toContain('CommonActions');
  });

  it('the view runs every exit through the ports', () => {
    expect(view).toContain('runQuestFinish(useQuestRunStore.getState(), ports)');
    expect(view).toContain('runQuestLeave(useQuestRunStore.getState().reset, ports)');
    expect(view).toMatch(/runQuestStart\(\{ start, end \}, begin, questId, episodeId\)/);
    expect(view).toMatch(/ports(Ref\.current)?\.track\(/);
    // The ports ref is updated after commit, never during render.
    expect(view).toMatch(/useLayoutEffect\(\(\) => \{\n\s*portsRef\.current = ports;\n\s*\}\);/);
  });

  it('the screen is a thin wrapper that keeps the learner wiring', () => {
    expect(screen).toContain('<QuestPlayerView');
    expect(screen).toContain('learnerQuestSession(');
    expect(screen).toContain('learnerQuestExits(');
    expect(screen).toContain("navigation.navigate('Minigame', { questId, episodeId, stepIndex })");
    expect(screen).toContain('navigation.goBack()');
    expect(screen).toContain('CommonActions.reset(');
    expect(screen).not.toContain('<DiscoverStep');
  });
});
