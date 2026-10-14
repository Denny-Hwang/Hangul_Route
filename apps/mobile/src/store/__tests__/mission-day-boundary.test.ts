import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchDay } from '../../logic/day-clock';
import { buildTodaysMission, type MissionPlan } from '../../logic/homework/mission-builder';
import { clearMissionPins, pinMission, pinnedMission } from '../mission-pin-store';

/**
 * Home across the day boundary (F-ROUTE-001 R-7e): Home builds today's mission from `useToday`
 * (`logic/day-clock.ts`) and pins it per profile and day (F-HW-001 section 3.2). This drives the
 * same steps Home takes on each render with fake timers: the pinned plan never reshuffles before
 * the boundary, the day turns over at UTC midnight, and the new day's plan is then pinned in turn.
 */
const ZONES = ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const;
const PROFILE = 'profile:kid1';

function quest(id: string): Quest {
  return {
    id,
    titleEn: id,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi' },
      { id: 's2', kind: 'reward', titleEn: 'Yay' },
    ],
  };
}

const QUESTS = [quest('quest:a'), quest('quest:b'), quest('quest:c')];
const EPISODES: Episode[] = [
  {
    id: 'episode:one',
    stage: 'stage1',
    theme: 'letters',
    order: 1,
    titleEn: 'One',
    hoyaIntroEn: 'Hello!',
    questIds: ['quest:a', 'quest:b', 'quest:c'],
    rewardCardIds: [],
    estimatedMinutes: 10,
    status: 'shipped',
  },
];

function snapshot(quests: ProgressSnapshot['quests']): ProgressSnapshot {
  return { profileId: PROFILE, updatedAt: '2026-10-13T09:00:00.000Z', episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 1 };
}

function played(questId: string, at: string, accuracy: number): ProgressSnapshot['quests'][number] {
  return { questId, episodeId: 'episode:one', startedAt: at, completedAt: at, stars: accuracy >= 1 ? 3 : 2, attempts: 1, accuracy };
}

/** One Home render: read the pin for the day, build, pin (as `HomeScreen`'s mission memo does). */
function homeRender(today: string, snap: ProgressSnapshot): MissionPlan {
  const plan = buildTodaysMission({ profileId: PROFILE, snapshot: snap, quests: QUESTS, episodes: EPISODES, today, pinned: pinnedMission(PROFILE, today) });
  pinMission(plan);
  return plan;
}

describe.each(ZONES)('Home mission across the UTC day boundary under TZ=%s', (zone) => {
  let savedTz: string | undefined;
  beforeEach(() => {
    savedTz = process.env.TZ;
    process.env.TZ = zone;
    vi.useFakeTimers();
    clearMissionPins();
  });
  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('keeps the pinned plan until 00:00 UTC, then pins the new day once without reshuffling it', () => {
    vi.setSystemTime(new Date('2026-10-13T23:59:00.000Z'));
    let today = '';
    const stop = watchDay({ onDay: (d) => (today = d), subscribeVisibility: () => () => undefined });
    expect(today).toBe('2026-10-13');

    // Yesterday's missed round makes quest:a today's replay card.
    const before = snapshot([played('quest:a', '2026-10-12T10:00:00.000Z', 0.5)]);
    const first = homeRender(today, before);
    expect(first.date).toBe('2026-10-13');

    // Replaying it to a perfect score at 23:59:30 collects the card; nothing shifts (F-HW-001 section 3.2).
    vi.advanceTimersByTime(30_000);
    const replayed = snapshot([played('quest:a', '2026-10-13T23:59:30.000Z', 1)]);
    const same = homeRender(today, replayed);
    expect(same.cards.map((c) => c.questId)).toEqual(first.cards.map((c) => c.questId));
    expect(same.cards[0]?.collected).toBe(true);

    // The boundary timer turns the day over with no focus or foreground event.
    vi.advanceTimersByTime(31_000);
    expect(today).toBe('2026-10-14');
    const fresh = homeRender(today, replayed);
    expect(fresh.date).toBe('2026-10-14');
    expect(pinnedMission(PROFILE, '2026-10-13')).toBeNull();

    // The new day's plan is pinned in turn: a later render that day keeps its cards.
    vi.advanceTimersByTime(60_000);
    const later = homeRender(today, snapshot([...replayed.quests, played('quest:b', '2026-10-14T00:02:00.000Z', 1)]));
    expect(later.date).toBe('2026-10-14');
    expect(later.cards.map((c) => c.questId)).toEqual(fresh.cards.map((c) => c.questId));
    stop();
  });
});

/**
 * The dependency list of the `useMemo(` call that starts at `marker` (a reflow or a reordering
 * keeps it): the names in its last top-level array.
 */
function memoDeps(source: string, marker: string): string[] {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const open = source.indexOf('useMemo(', start) + 'useMemo'.length;
  let depth = 0;
  let close = open;
  for (; close < source.length; close += 1) {
    const ch = source[close];
    if (ch === '(') depth += 1;
    else if (ch === ')' && (depth -= 1) === 0) break;
  }
  const deps = /\[([^[\]]*)\]\s*,?\s*$/.exec(source.slice(open + 1, close));
  if (!deps) throw new Error(`no dependency list after: ${marker}`);
  return (deps[1] ?? '').split(',').map((d) => d.trim()).filter(Boolean);
}

/**
 * Source guard for the wiring (the mobile vitest lane does not render screens; the hook itself is
 * tested in `use-today-hook.test.ts`): Home and the Learning Route page take today from
 * `useToday`, never from a render-time `new Date()`, and their memos rebuild when it changes.
 */
describe('Home and the Learning Route page read today from useToday (F-ROUTE-001 R-7e)', () => {
  const read = (...parts: string[]): string => readFileSync(join(__dirname, '..', '..', 'screens', ...parts), 'utf8');
  const home = read('home', 'HomeScreen.tsx');
  const page = read('my-route', 'MyRouteScreen.tsx');

  it('Home keys the homework count and the route input by useToday', () => {
    expect(home).toMatch(/const\s+today\s*=\s*useToday\(\s*\)/);
    expect(home).toMatch(/dueTodayCount\(\s*snap\?\.homework\s*,\s*today\s*\)/);
    expect(home).not.toMatch(/dayKey\(\s*new Date\(\)/);
    expect(memoDeps(home, 'const routeInput = useMemo(')).toContain('today');
  });

  it('the Learning Route page keys the route input by useToday', () => {
    expect(page).toMatch(/const\s+today\s*=\s*useToday\(\s*\)/);
    expect(page).not.toMatch(/dayKey\(\s*now\.toISOString\(\)\s*\)/);
    expect(memoDeps(page, 'const built = useMemo(')).toContain('today');
  });
});
