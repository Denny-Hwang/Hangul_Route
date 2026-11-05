import type { ReactElement } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxPlan, UiLocale } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';

/**
 * My practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4 and 13, row BL-8; wireframe B7) at 320 x 568: count chips
 * 1 to 7 and weekday chips as KT-1 `TapTarget`s on one board, the class day marked and allowed, the class's days
 * chosen until the learner moves them. A self learner changes them directly; a child on a gated device sees "PIN
 * required" and every tap opens the grown-up gate, which comes back as the grown-up's view. The change is stored in
 * `snapshot.practiceDays` and sends `route.practice_days_changed` with the count and who changed them only.
 */

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
const gate = vi.hoisted(() => ({ open: true }));
vi.mock('../use-plan-gate', () => ({ usePlanChangesOpen: () => gate.open }));
vi.mock('../use-today', () => ({ useToday: () => '2026-11-06' }));
const sent = vi.hoisted(() => [] as unknown[]);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/telemetry')>()),
  track: vi.fn(async (event: unknown) => {
    sent.push(event);
  }),
}));

import { blendedMeta } from '../../../logic/homework/__tests__/curriculum-fixture';
import { useLocaleStore } from '../../../store/locale-store';
import { usePlanStore } from '../../../store/plan-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, hostNodes, press, render, resetPlatform, screenTexts } from '../../../test-support/render';
import { PracticeDaysRow } from '../BlendParts';
import { PracticeDaysScreen } from '../PracticeDaysScreen';

const PHONE = layoutClassFor({ width: 320, height: 568 });

const plan: InboxPlan = {
  id: 'plan:thu',
  spaceId: 'space:c',
  spaceKind: 'class',
  spaceName: 'A',
  title: 'Thursday class',
  items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', lectureDate: '2026-11-05', targetDate: '2026-11-06' }],
  publishedAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  meta: blendedMeta({ startDate: '2026-11-02', weeks: 4, lectureDays: ['thu'], practiceDays: ['fri', 'sun', 'tue'] }),
};

const navigation = { navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn() };

function setUp(learnerType: 'self' | 'child'): void {
  useProfileStore.setState({
    profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: learnerType === 'self' ? 'adult' : '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't', learnerType }],
    activeId: 'profile:a',
    hydrated: true,
  } as never);
  usePlanStore.setState({ byLearner: { 'profile:a': [plan] }, notReady: {} });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
  useProgressStore.getState().ensure('profile:a');
}

async function show(viewer?: 'grownup', locale: UiLocale = 'en'): Promise<ReactTestInstance> {
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: locale, byProfile: {} });
  const el: ReactElement = (
    <LayoutProvider value={PHONE}>
      <PracticeDaysScreen navigation={navigation as never} route={{ key: 'k', name: 'PracticeDays', params: { profileId: 'profile:a', ...(viewer === undefined ? {} : { viewer }) } } as never} />
    </LayoutProvider>
  );
  return (await render(el)).root;
}

const chip = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id)[0];
  if (node === undefined) throw new Error(`no ${id}`);
  return node;
};
const checked = (root: ReactTestInstance, id: string): boolean => chip(root, id).props['aria-checked'] === true;
const stored = () => useProgressStore.getState().byProfile['profile:a']?.practiceDays;

beforeEach(() => {
  mem.clear();
  gate.open = true;
  sent.length = 0;
  navigation.navigate.mockReset();
  vi.spyOn(usePlanStore.getState(), 'rederive').mockResolvedValue(null);
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

describe('My practice days at 320 x 568', () => {
  it('shows the title, the hint, 7 count chips and 7 weekday chips from Sunday, with the class day marked', async () => {
    setUp('self');
    const root = await show();
    const texts = screenTexts(root);
    expect(texts).toContain('My practice days');
    expect(texts).toContain('Pick the days you practice. Your lessons stay the same.');
    expect(texts).toContain('Days a week');
    for (let n = 1; n <= 7; n += 1) expect(byTestId(root, `practice-days-count-${n}`)).toHaveLength(1);
    const days = hostNodes(root, (n) => String(n.props['data-testid'] ?? '').startsWith('practice-days-day-')).map((n) => n.props['data-testid']);
    expect(days).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => `practice-days-day-${d}`));
    expect(byTestId(root, 'practice-days-class-thu')).toHaveLength(1);
    expect(byTestId(root, 'practice-days-class-tue')).toHaveLength(0);
    // The class's days until the learner moves them.
    expect(['fri', 'sun', 'tue'].every((d) => checked(root, `practice-days-day-${d}`))).toBe(true);
    expect(checked(root, 'practice-days-day-thu')).toBe(false);
    expect(checked(root, 'practice-days-count-3')).toBe(true);
    // Every chip is a KT-1 TapTarget: a weekday is a checkbox named "Practice day, {weekday}", a count a radio.
    expect(chip(root, 'practice-days-day-thu').props.role).toBe('checkbox');
    expect(chip(root, 'practice-days-count-3').props.role).toBe('radio');
    expect(chip(root, 'practice-days-day-thu').props['aria-label']).toBe('Practice day, Thursday');
    expect(byTestId(root, 'practice-days-gate')).toHaveLength(0);
  });

  it('a self learner picks the class day directly: stored, with the count and "self" only in telemetry', async () => {
    setUp('self');
    const root = await show();
    await press(chip(root, 'practice-days-day-thu'));
    expect(stored()).toEqual([{ planId: 'plan:thu', days: ['tue', 'thu', 'fri', 'sun'], updatedAt: expect.any(String) }]);
    expect(sent).toEqual([{ name: 'route.practice_days_changed', payload: { days: 4, by: 'self' } }]);
    expect(JSON.stringify(sent)).not.toMatch(/thu|plan:|profile:/);
    expect(usePlanStore.getState().rederive).toHaveBeenCalledWith('profile:a');
    expect(checked(root, 'practice-days-count-4')).toBe(true);
  });

  it('a count keeps the chosen days and trims or fills them; the last day never goes', async () => {
    setUp('self');
    const root = await show();
    await press(chip(root, 'practice-days-count-1'));
    expect(stored()?.[0]?.days).toHaveLength(1);
    const [only] = stored()?.[0]?.days ?? [];
    await press(chip(root, `practice-days-day-${only as string}`));
    // The one day left stays on: nothing new is stored or sent.
    expect(stored()?.[0]?.days).toEqual([only]);
    expect(sent).toHaveLength(1);
    await press(chip(root, 'practice-days-count-7'));
    expect(stored()?.[0]?.days).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  });

  it('picking the count already chosen changes nothing', async () => {
    setUp('self');
    const root = await show();
    await press(chip(root, 'practice-days-count-3'));
    expect(stored()).toBeUndefined();
    expect(sent).toEqual([]);
  });

  it('a child on a gated device: "PIN required" on every control, and a tap opens the grown-up gate, never a change', async () => {
    gate.open = false;
    setUp('child');
    const root = await show();
    expect(screenTexts(byTestId(root, 'practice-days-gate')[0] as ReactTestInstance)).toContain('PIN required');
    expect(chip(root, 'practice-days-day-mon').props['aria-label']).toBe('Practice day, Monday (PIN required)');
    expect(chip(root, 'practice-days-count-2').props['aria-label']).toBe('2 (PIN required)');
    await press(chip(root, 'practice-days-day-mon'));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'PracticeDays', profileId: 'profile:a' });
    expect(stored()).toBeUndefined();
    expect(sent).toEqual([]);
  });

  it('after the gate, the grown-up changes a child\'s days ("grownup" in telemetry)', async () => {
    gate.open = false;
    setUp('child');
    const root = await show('grownup');
    expect(byTestId(root, 'practice-days-gate')).toHaveLength(0);
    await press(chip(root, 'practice-days-day-mon'));
    expect(stored()?.[0]?.days).toEqual(['mon', 'tue', 'fri', 'sun']);
    expect(sent).toEqual([{ name: 'route.practice_days_changed', payload: { days: 4, by: 'grownup' } }]);
  });

  it('a child on a device that opens grown-up screens directly changes them as a grown-up', async () => {
    setUp('child');
    const root = await show();
    await press(chip(root, 'practice-days-day-sat'));
    expect(sent).toEqual([{ name: 'route.practice_days_changed', payload: { days: 4, by: 'grownup' } }]);
  });

  it('without a class plan with practice days, only the title and the hint show', async () => {
    setUp('self');
    usePlanStore.setState({ byLearner: { 'profile:a': [] }, notReady: {} });
    const root = await show();
    expect(byTestId(root, 'practice-days')).toHaveLength(0);
    expect(screenTexts(root)).toContain('My practice days');
  });

  it.each(['es', 'ko'] as const)('%s: the words and the weekday names come from the locale', async (locale) => {
    setUp('self');
    const root = await show(undefined, locale);
    const words = getMessages(locale).learner.route.blend.practiceDays;
    expect(screenTexts(root)).toEqual(expect.arrayContaining([words.title, words.hint, words.count]));
    expect(chip(root, 'practice-days-day-thu').props['aria-label']).toBe(getMessages(locale).a11y.route.blend.practiceDay(locale === 'es' ? 'jueves' : '목요일'));
  });
});

describe('Profile -> weekly plan: the My practice days row', () => {
  it('is one button named "My practice days" that opens the screen', async () => {
    const onOpen = vi.fn();
    const root = (await render(<PracticeDaysRow onOpen={onOpen} />)).root;
    const row = byTestId(root, 'profile-practice-days')[0] as ReactTestInstance;
    expect(row.props.role).toBe('button');
    expect(row.props['aria-label']).toBe('My practice days');
    await press(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
