import type { HomeworkAssignment, ProgressSnapshot } from '@hangul-route/content-schema';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flagState = vi.hoisted(() => ({ blend: false }));
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: () => undefined,
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
// `flags.routeBlendEnabled` per test: off as shipped, on as BL-10 will set it.
vi.mock('../../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/flags')>();
  const flags = new Proxy(actual.flags, { get: (target, key) => (key === 'routeBlendEnabled' ? flagState.blend : Reflect.get(target, key)) });
  return { ...actual, flags };
});

import { getMessages } from '@hangul-route/i18n';
import { questsAll } from '../../../content';
import { useLocaleStore } from '../../../store/locale-store';
import { usePlanStore } from '../../../store/plan-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, hostNodes, render, resetPlatform } from '../../../test-support/render';
import { HomeworkScreen } from '../HomeworkScreen';

/**
 * HomeworkScreen's rows with a lesson met in class (AMENDMENTS-ROUTE-CLASS-BLEND section 7, row BL-7), rendered: one
 * From class pill per row (never a second tag with the same words); with the switch on, the class glyph and the
 * row's accessible name end "From class. You met this in class."; with it off, the row is as before.
 */

const PID = 'profile:a';
const TODAY = new Date().toISOString().slice(0, 10);
const QUEST = questsAll[0]!;
const en = getMessages('en');

function assignment(over: Partial<HomeworkAssignment>): HomeworkAssignment {
  return { id: 'hw:1', profileId: PID, questId: QUEST.id, episodeId: 'episode:x', assignedBy: 'teacher', assignedAt: `${TODAY}T00:00:00.000Z`, targetDate: TODAY, ...over };
}

function seed(homework: HomeworkAssignment[]): void {
  useProfileStore.setState({ profiles: [{ id: PID, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', learnerType: 'self', createdAt: 't' }], activeId: PID, hydrated: true } as never);
  useProgressStore.setState({ byProfile: { [PID]: { quests: [], placements: [], homework } as unknown as ProgressSnapshot } } as never);
  usePlanStore.setState({ byLearner: { [PID]: [] }, notReady: {} } as never);
}

/** Every text a host node of the row holds directly, read once per node. */
const wordsIn = (root: ReactTestInstance): string[] =>
  hostNodes(root, (n) => n.children.some((c) => typeof c === 'string')).map((n) => n.children.filter((c): c is string => typeof c === 'string').join(''));

beforeEach(() => {
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flagState.blend = false;
});

describe.each([false, true])('routeBlendEnabled %s', (on) => {
  it('one From class pill per row; no row shows two identical labels', async () => {
    flagState.blend = on;
    seed([assignment({ id: 'hw:1', fromClass: true }), assignment({ id: 'hw:2' })]);
    const r = await render(<HomeworkScreen />);
    const pills = byTestId(r.root, 'homework-row-pill');
    expect(pills).toHaveLength(2);
    const fromWords = en.learner.homework.from.teacher;
    const words = wordsIn(r.root);
    // Each row's pill says the from.teacher words once, and nothing else on the screen repeats them.
    expect(words.filter((w) => w === fromWords)).toHaveLength(2);
  });

  it(on ? 'a lesson met in class adds the glyph and says so to readers' : 'nothing new while the switch is off', async () => {
    flagState.blend = on;
    seed([assignment({ id: 'hw:1', fromClass: true })]);
    const r = await render(<HomeworkScreen />);
    const met = en.a11y.route.blend.fromClassMet;
    const labelled = hostNodes(r.root, (n) => typeof n.props['aria-label'] === 'string' && (n.props['aria-label'] as string).endsWith(met));
    const pill = byTestId(r.root, 'homework-row-pill')[0]!;
    const glyphs = hostNodes(pill, (n) => String(n.type) === 'svg-Svg');
    if (on) {
      expect(labelled.length).toBeGreaterThan(0);
      expect(glyphs.length).toBeGreaterThan(0);
    } else {
      expect(labelled).toHaveLength(0);
      expect(glyphs).toHaveLength(0);
    }
  });
});
