import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The F-CURR-002 switches' build-time floors and built-in pcts (section 12.2, row CM-2). The floor is `parseKillSwitch`
 * on a literal `EXPO_PUBLIC_CURR_*` variable; every flag ships with built-in pct 0 (no surface yet).
 */
const ORIGINAL_ENV = { ...process.env };

async function reload(): Promise<typeof import('../flags')> {
  vi.resetModules();
  return import('../flags');
}

const ENV_OF: Record<string, string> = {
  memoryRecord: 'EXPO_PUBLIC_CURR_MEMORY_RECORD',
  dailyReview: 'EXPO_PUBLIC_CURR_DAILY_REVIEW',
  questWarmup: 'EXPO_PUBLIC_CURR_QUEST_WARMUP',
  missedPractice: 'EXPO_PUBLIC_CURR_MISSED_PRACTICE',
  questAdapt: 'EXPO_PUBLIC_CURR_QUEST_ADAPT',
  mastery: 'EXPO_PUBLIC_CURR_MASTERY',
  cellCheck: 'EXPO_PUBLIC_CURR_CELL_CHECK',
  stageChecks: 'EXPO_PUBLIC_CURR_STAGE_CHECKS',
  upperCards: 'EXPO_PUBLIC_CURR_UPPER_CARDS',
  goals: 'EXPO_PUBLIC_CURR_GOALS',
  volumes: 'EXPO_PUBLIC_CURR_VOLUMES',
  topicPacks: 'EXPO_PUBLIC_CURR_TOPIC_PACKS',
  decodingSprint: 'EXPO_PUBLIC_CURR_DECODING_SPRINT',
  weeklyDrop: 'EXPO_PUBLIC_CURR_WEEKLY_DROP',
  weeklyQuests: 'EXPO_PUBLIC_CURR_WEEKLY_QUESTS',
  familyGoal: 'EXPO_PUBLIC_CURR_FAMILY_GOAL',
  classGoal: 'EXPO_PUBLIC_CURR_CLASS_GOAL',
  lectureGames: 'EXPO_PUBLIC_CURR_LECTURE_GAMES',
  fsrsShadow: 'EXPO_PUBLIC_CURR_FSRS_SHADOW',
};

describe('F-CURR-002 flags (CM-2)', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    for (const name of [...Object.values(ENV_OF), 'EXPO_PUBLIC_CURR_PACKS_OFF', 'EXPO_PUBLIC_CURR_GAMES_OFF']) delete process.env[name];
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('lists exactly the section 12.2 switches', async () => {
    const mod = await reload();
    expect([...mod.CURR_FLAGS].sort()).toEqual(Object.keys(ENV_OF).sort());
    expect(mod.CURR_FLAGS).toHaveLength(19);
  });

  it('every flag ships with built-in pct 0, keyed flags too', async () => {
    const mod = await reload();
    for (const flag of mod.CURR_FLAGS) expect(mod.currBuiltInPct(flag), flag).toBe(0);
    expect(mod.currBuiltInPct('pack.k-culture')).toBe(0);
    expect(mod.currBuiltInPct('game.cloze-pick')).toBe(0);
  });

  it('every floor is on by default', async () => {
    const mod = await reload();
    for (const flag of mod.CURR_FLAGS) expect(mod.currBuildFloor(flag), flag).toBe(true);
    expect(mod.currBuildFloor('pack.k-culture')).toBe(true);
    expect(mod.currBuildFloor('game.cloze-pick')).toBe(true);
  });

  it.each(['false', '0', 'off', 'no', ' FALSE ', 'Off'])('each floor is a kill switch: %j turns it off', async (value) => {
    for (const env of Object.values(ENV_OF)) process.env[env] = value;
    const mod = await reload();
    for (const flag of mod.CURR_FLAGS) expect(mod.currBuildFloor(flag), `${ENV_OF[flag]}=${value}`).toBe(false);
  });

  it('one variable turns off its own flag only', async () => {
    process.env.EXPO_PUBLIC_CURR_DAILY_REVIEW = 'false';
    process.env.EXPO_PUBLIC_CURR_FSRS_SHADOW = 'off';
    const mod = await reload();
    for (const flag of mod.CURR_FLAGS) expect(mod.currBuildFloor(flag), flag).toBe(flag !== 'dailyReview' && flag !== 'fsrsShadow');
  });

  it('a typo or "true" leaves the floor on', async () => {
    process.env.EXPO_PUBLIC_CURR_DAILY_REVIEW = 'flase';
    process.env.EXPO_PUBLIC_CURR_MASTERY = 'true';
    const mod = await reload();
    expect(mod.currBuildFloor('dailyReview')).toBe(true);
    expect(mod.currBuildFloor('mastery')).toBe(true);
  });

  it('a listed pack or game is off at build time; others stay on; an empty key or an unknown name is off', async () => {
    process.env.EXPO_PUBLIC_CURR_PACKS_OFF = ' K-Culture , , numbers-time ';
    process.env.EXPO_PUBLIC_CURR_GAMES_OFF = 'cloze-pick';
    const mod = await reload();
    expect(mod.currBuildFloor('pack.k-culture')).toBe(false);
    expect(mod.currBuildFloor('pack.numbers-time')).toBe(false);
    expect(mod.currBuildFloor('pack.arts-music')).toBe(true);
    expect(mod.currBuildFloor('game.cloze-pick')).toBe(false);
    expect(mod.currBuildFloor('game.dictation')).toBe(true);
    expect(mod.currBuildFloor('pack.' as never)).toBe(false);
    expect(mod.currBuildFloor('somethingElse' as never)).toBe(false);
  });

  it('reads each variable by its literal name (the web bundle inlines only those)', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    for (const env of [...Object.values(ENV_OF), 'EXPO_PUBLIC_CURR_PACKS_OFF', 'EXPO_PUBLIC_CURR_GAMES_OFF']) expect(src, env).toContain(`process.env.${env}`);
  });
});
