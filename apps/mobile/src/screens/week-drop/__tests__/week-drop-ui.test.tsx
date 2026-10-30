import { LayoutProvider, layoutClassFor, touchTarget } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';

/**
 * "This week in Korea", the card and the pages (F-CURR-002 §5.7, row CM-48; design/wireframes/home/this-week-in-korea.md
 * A, B, C, D): drawn from the real week-drop chunk; the practice's plan and record (memory chunk) and the round view
 * (Daily Review chunk) are stand-ins. Accessible names, 48 dp (here the 64 dp floor) targets at 320 px, the calm Done
 * page and the done mark; never a score, a count or a word about another week.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const navigate = vi.fn();
const goBack = vi.fn();
vi.mock('@react-navigation/native', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ navigate, goBack, canGoBack: () => true }),
  };
});
const storage = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', async (load) => ({
  ...(await load<object>()),
  readJsonStrict: vi.fn(async (k: string) => storage.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => void storage.set(k, v)),
}));
const recorded = vi.hoisted(() => [] as Array<{ index: number; correct: boolean }>);
const planned = vi.hoisted(() => ({ rounds: 5 as number | null }));
vi.mock('../../../logic/memory/boot', async (load) => ({
  ...(await load<object>()),
  memoryChunk: async () => ({
    weekPracticeApi: () => ({
      plan: async (_p: string, cell: string) =>
        planned.rounds === null ? null : { cell, soundNotice: false, rounds: Array.from({ length: planned.rounds }, (_, i) => ({ type: 'pick', question: { itemId: `i${i}`, rung: 'read' } })) },
      record: async (_p: string, _plan: unknown, index: number, answer: { correct: boolean }) => void recorded.push({ index, correct: answer.correct }),
    }),
  }),
}));
vi.mock('../../reviews/DailyReviewRoute', async () => {
  const { createElement } = await import('react');
  return {
    dailyReviewChunk: async () => ({
      TopRow: ({ filled, total }: { filled: number; total: number }) => createElement('div', { 'data-testid': 'top-row', 'data-filled': filled, 'data-total': total }),
      RoundView: ({ onFirst, onSolved }: { onFirst: (a: { correct: boolean }) => void; onSolved: () => void }) =>
        createElement('button', { 'data-testid': 'round-stub', role: 'button', onClick: () => (onFirst({ correct: false }), onSolved()) }, 'answer'),
    }),
  };
});

const { WeekDropCard } = await import('../WeekDropCard');
const { WeekDropScreen } = await import('../WeekDropScreen');
const { WEEK_DROP_KEY } = await import('../../../store/week-drop-store');

const ID = 'profile:mina';
const EN = getMessages('en');
const mounted: ReactTestRenderer[] = [];
const idle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
async function draw(node: ReactElement, width = 320): Promise<ReactTestRenderer> {
  const r = await render(<LayoutProvider value={layoutClassFor({ width, height: 800 })}>{node}</LayoutProvider>);
  mounted.push(r);
  await idle();
  return r;
}
const screen = (): ReactElement => <WeekDropScreen navigation={{ navigate, goBack, canGoBack: () => true } as never} route={{ key: 'k', name: 'WeekDrop' } as never} />;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-04T10:00:00.000Z'));
  storage.clear();
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { weeklyDrop: { on: true, pct: 100 } } } });
  recorded.length = 0;
  planned.rounds = 5;
  navigate.mockClear();
  goBack.mockClear();
  useProfileStore.setState({ profiles: [{ id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }], activeId: ID });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [], activeId: null });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

describe('WeekDropCard (A1, A2)', () => {
  it.each([320, 1024])('at %i: one button named with the title and minutes, the first word and its romanization, at least the touch floor', async (width) => {
    const r = await draw(<WeekDropCard profileId={ID} week="2026-11-02" />, width);
    const [card] = byTestId(r.root, 'home-week-drop');
    expect(card?.props['aria-label']).toBe('This week in Korea: Winter Begins. About 2 minutes.');
    expect(card?.props.role).toBe('button');
    const style = [card?.props.style].flat(Infinity).reduce((a: Record<string, unknown>, s) => ({ ...a, ...(s ?? {}) }), {});
    expect(parseFloat(String(style.minHeight))).toBeGreaterThanOrEqual(touchTarget.min);
    expect(screenTexts(r.root).join(' ')).toContain('입동');
    expect(screenTexts(r.root).join(' ')).toContain('ipdong');
    await press(card!);
    expect(navigate).toHaveBeenCalledWith('WeekDrop');
  });

  it('done this week: "Done for this week" in place of the minutes; never a count or a missed week', async () => {
    storage.set(WEEK_DROP_KEY(ID), ['2026-10-26', '2026-11-02']);
    const r = await draw(<WeekDropCard profileId={ID} week="2026-11-02" />);
    expect(byTestId(r.root, 'home-week-drop-done')).toHaveLength(1);
    const text = screenTexts(r.root).join(' ');
    expect(text).toContain(EN.learner.weekDrop.done);
    expect(text).not.toMatch(/missed|behind|late|\d+\s*(of|\/)\s*\d+|%/i);
  });

  it('a week the chunk has no drop for: nothing drawn', async () => {
    const r = await draw(<WeekDropCard profileId={ID} week="2026-10-19" />);
    expect(byTestId(r.root, 'home-week-drop')).toEqual([]);
  });
});

describe('WeekDropScreen (B, C, D)', () => {
  it('B: the drop of this local week, its note with taught Korean and its source line, 5 named words, one primary', async () => {
    const r = await draw(screen());
    expect(byTestId(r.root, 'week-drop-title')[0] && screenTexts(byTestId(r.root, 'week-drop-title')[0]!).join('')).toBe('Winter Begins');
    const note = screenTexts(byTestId(r.root, 'week-drop-note')[0]!).join('');
    expect(note).toContain('입동');
    expect(note).toContain('Source: Korea Astronomy and Space Science Institute');
    expect(note).not.toMatch(/https?:/);
    const words = byTestId(r.root, 'week-drop-words')[0]!;
    expect(screenTexts(words).join(' ')).toContain('napa cabbage');
    expect(buttonsNamed(r.root, EN.learner.weekDrop.practice.cta)).toHaveLength(1);
    const close = byTestId(r.root, 'week-drop-close')[0]!;
    expect(close.props["aria-label"]).toBe(EN.common.buttons.close);
    const style = [close.props.style].flat(Infinity).reduce((a: Record<string, unknown>, s) => ({ ...a, ...(s ?? {}) }), {});
    expect(parseFloat(String(style.width))).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('C and D: 5 rounds with fill-only dots, each first answer recorded, then Done, the week marked done, Back home', async () => {
    const r = await draw(screen());
    await press(buttonsNamed(r.root, EN.learner.weekDrop.practice.cta)[0]!);
    await idle();
    for (let i = 0; i < 5; i += 1) {
      expect(byTestId(r.root, 'top-row')[0]?.props['data-total']).toBe(5);
      await press(byTestId(r.root, 'round-stub')[0]!);
      await idle();
    }
    expect(recorded).toEqual([0, 1, 2, 3, 4].map((index) => ({ index, correct: false })));
    const done = byTestId(r.root, 'week-drop-done')[0]!;
    const text = screenTexts(done).join(' ');
    expect(text).toContain(EN.learner.weekDrop.done);
    expect(text).toContain(EN.learner.weekDrop.next);
    expect(text).not.toMatch(/star|score|%|\d+\s*(of|\/)\s*\d+/i);
    expect(storage.get(WEEK_DROP_KEY(ID))).toEqual(['2026-11-02']);
    await press(buttonsNamed(r.root, EN.learner.results.backHome.cta)[0]!);
    expect(goBack).toHaveBeenCalled();
  });

  it('no playable practice (the items cannot load): Practice goes straight to Done', async () => {
    planned.rounds = null;
    const r = await draw(screen());
    await press(buttonsNamed(r.root, EN.learner.weekDrop.practice.cta)[0]!);
    await idle();
    expect(byTestId(r.root, 'week-drop-done')).toHaveLength(1);
  });

  it('weeklyDrop off (a remote turn, a stale visit): back home at once, nothing drawn', async () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { weeklyDrop: { on: false, pct: 0 } } } });
    const r = await draw(screen());
    expect(goBack).toHaveBeenCalled();
    expect(byTestId(r.root, 'week-drop-meet')).toEqual([]);
  });

  it('a week with no drop: back home at once', async () => {
    vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
    await draw(screen());
    expect(goBack).toHaveBeenCalled();
  });

  it('in Korean: the title, words and buttons in the UI language, the taught Korean unchanged', async () => {
    useLocaleStore.setState({ device: 'ko', byProfile: {} });
    const r = await draw(screen());
    const text = screenTexts(r.root).join(' ');
    expect(text).toContain('겨울이 시작돼요');
    expect(text).toContain(getMessages('ko').learner.weekDrop.practice.cta);
    expect(text).toContain('ipdong');
  });
});
