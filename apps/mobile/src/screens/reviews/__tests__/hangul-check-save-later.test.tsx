import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content';
import { gridEpisodesOf } from '../../../logic/my-route/order';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts } from '../../../test-support/render';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME OD-LR8 (row LR-4, test 28): the Hangul Check's result shows the words Results shows
 * (`learner.results.saveLater`) under the stars while the learner's progress write is waiting, and nothing otherwise.
 * The game is a stub that hands each part back at once.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../minigames/ListenPickGame', async () => {
  const { createElement } = await import('react');
  return {
    ListenPickGame: ({ host }: { host: { complete: () => void } }) => createElement('button', { 'data-testid': 'part-stub', role: 'button', onClick: () => host.complete() }, 'part'),
  };
});

const { StageReviewScreen } = await import('../StageReviewScreen');

const ID = 'profile:mina';
const AT = '2026-10-01T10:00:00.000Z';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: AT, learnerType: 'child' };
const EN = getMessages('en');

/** Every Stage 1 quest done: the check opens. */
function snapshot(): ProgressSnapshot {
  const quests = gridEpisodesOf(episodesAll)
    .filter((e) => e.stage === 'stage1')
    .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 0.9 })));
  return { profileId: ID, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 } as ProgressSnapshot;
}

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
};
const nav = () => ({ navigate: () => undefined, dispatch: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;

async function playThrough(): Promise<ReactTestRenderer> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <StageReviewScreen navigation={nav()} route={{ key: 'StageReview', name: 'StageReview', params: { stageKey: 'stage1' } } as never} />
    </LayoutProvider>,
  );
  await flush();
  await press(buttonsNamed(r.root, EN.learner.stageReview.intro.start.cta)[0] as ReactTestInstance);
  for (let part = 0; part < 5; part += 1) {
    await press(byTestId(r.root, 'part-stub').find((n) => typeof n.props.onClick === 'function')!);
    if (part < 4) await press(buttonsNamed(r.root, EN.learner.stageReview.pause.keepGoing.cta)[0] as ReactTestInstance);
  }
  await flush();
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({ byProfile: { [ID]: snapshot() }, hydratedFor: new Set([ID]), saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('the Hangul Check result and the save-later line (OD-LR8)', () => {
  it('shows no line when the progress is saved', async () => {
    const r = await playThrough();
    expect(byTestId(r.root, 'hangul-check-result')).toHaveLength(1);
    expect(byTestId(r.root, 'hangul-check-save-later')).toHaveLength(0);
    expect(screenTexts(r.root)).not.toContain(EN.learner.results.saveLater);
  });

  it('shows Results\' line while the learner is in saveRetryFailedFor or in loadFailedFor', async () => {
    for (const key of ['saveRetryFailedFor', 'loadFailedFor'] as const) {
      useProgressStore.setState({ saveRetryFailedFor: new Set(), loadFailedFor: new Set(), [key]: new Set([ID]) });
      const r = await playThrough();
      const line = byTestId(r.root, 'hangul-check-save-later');
      expect(line).toHaveLength(1);
      expect(screenTexts(line[0] as ReactTestInstance)).toEqual([EN.learner.results.saveLater]);
      await cleanup();
    }
  });

  it('another learner\'s waiting write does not show it', async () => {
    useProgressStore.setState({ saveRetryFailedFor: new Set(['profile:other']), loadFailedFor: new Set(['profile:other']) });
    const r = await playThrough();
    expect(byTestId(r.root, 'hangul-check-save-later')).toHaveLength(0);
  });
});
