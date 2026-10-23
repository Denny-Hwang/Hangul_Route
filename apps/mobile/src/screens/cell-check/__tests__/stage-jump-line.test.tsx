import type { Profile, ProgressSnapshot, QuestProgress } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { jumpCells } from '../../../logic/reviews/cell-check-offer';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { buttonsNamed, cleanup, press, render, screenTexts } from '../../../test-support/render';
import { StageJumpLine, stageJumpRuleNow } from '../StageJumpLine';

/**
 * F-CURR-002 row CM-25: Stage Jump Ahead's line under a Journey stage. On the stage the route has reached, before it
 * is started, with every quest open (F-ENT-003) and 10 or more playable rounds; it opens the CellCheck route in its
 * jump mode with the stage key. A locked stage, a stage ahead of the route and `cellCheck` off show nothing.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const navigate = vi.fn();
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ navigate, goBack: () => undefined }),
  };
});
const jumpOfferable = vi.fn(async () => true);
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({ cellCheckApi: () => ({ jumpOfferable }) }),
}));
let open: (questId: string) => boolean = () => true;
vi.mock('../../../store/tier-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuestAccess: () => open,
}));

const EN = getMessages('en');
const ID = 'profile:sora';
const learner: Profile = { id: ID, displayName: 'Sora', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const AT = '2026-10-01T10:00:00.000Z';
const CELLS = jumpCells(episodesAll);
const questsOfStage = (stage: string): string[] => CELLS.filter((c) => c.stage === stage).flatMap((c) => c.questIds);
const STAGE2 = { key: 'stage2' as const, order: 2, titleEn: 'Words' };
const STAGE3 = { key: 'stage3' as const, order: 3, titleEn: 'First Sentences' };

function snapshot(done: readonly string[], over: Partial<ProgressSnapshot> = {}): void {
  const quests: QuestProgress[] = done.map((questId) => ({ questId, episodeId: 'episode:x', startedAt: AT, completedAt: AT, stars: 2, attempts: 1, accuracy: 0.9 }) as QuestProgress);
  useProgressStore.setState({ byProfile: { [ID]: { profileId: ID, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over } as ProgressSnapshot } });
}

async function draw(element: React.ReactElement) {
  const r = await render(element);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return r;
}

beforeEach(() => {
  navigate.mockClear();
  jumpOfferable.mockClear();
  jumpOfferable.mockImplementation(async () => true);
  open = () => true;
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  snapshot(questsOfStage('stage1'));
});
afterEach(async () => {
  await cleanup();
});

describe('the Jump ahead line', () => {
  it('on the reached stage: the prompt and the button, named by the stage, which opens the jump', async () => {
    const r = await draw(<StageJumpLine profileId={ID} stage={STAGE2} checkOn />);
    expect(screenTexts(r.root)).toContain(EN.learner.stageJump.prompt);
    const [button] = buttonsNamed(r.root, EN.learner.stageJump.label(2, 'Words'));
    expect(button).toBeDefined();
    // The prompt is read once, as its own line: the button carries no hint repeating it.
    expect(Object.values(button!.props).filter((v) => v === EN.learner.stageJump.prompt)).toEqual([]);
    expect(screenTexts(r.root).filter((t) => t === EN.learner.stageJump.prompt)).toHaveLength(1);
    await press(button!);
    expect(navigate).toHaveBeenCalledWith('CellCheck', { cellId: 'stage2', mode: 'jump' });
    expect(jumpOfferable).toHaveBeenCalledWith(ID, 'stage2', CELLS.filter((c) => c.stage === 'stage2').map((c) => c.id));
  });

  it('entitlement (F-ENT-003): a locked stage offers no jump and reads no memory', async () => {
    const locked = new Set(questsOfStage('stage2').slice(-1));
    open = (q) => !locked.has(q);
    const r = await draw(<StageJumpLine profileId={ID} stage={STAGE2} checkOn />);
    expect(r.toJSON()).toBeNull();
    expect(jumpOfferable).not.toHaveBeenCalled();
  });

  it('nothing on a stage ahead of the route, a started stage, a jumped stage, with too few rounds or with cellCheck off', async () => {
    expect((await draw(<StageJumpLine profileId={ID} stage={STAGE3} checkOn />)).toJSON()).toBeNull();
    await cleanup();
    snapshot([...questsOfStage('stage1'), questsOfStage('stage2')[0] as string]);
    expect((await draw(<StageJumpLine profileId={ID} stage={STAGE2} checkOn />)).toJSON()).toBeNull();
    await cleanup();
    snapshot(questsOfStage('stage1'), { testedOut: { stage2: AT } });
    expect((await draw(<StageJumpLine profileId={ID} stage={STAGE2} checkOn />)).toJSON()).toBeNull();
    await cleanup();
    snapshot(questsOfStage('stage1'));
    jumpOfferable.mockImplementation(async () => false);
    expect((await draw(<StageJumpLine profileId={ID} stage={STAGE2} checkOn />)).toJSON()).toBeNull();
    await cleanup();
    jumpOfferable.mockImplementation(async () => true);
    expect((await draw(<StageJumpLine profileId={ID} stage={STAGE2} checkOn={false} />)).toJSON()).toBeNull();
  });

  it('stageJumpRuleNow (the route re-check): the reached open stage only, from the stores now', () => {
    expect(stageJumpRuleNow(ID, 'stage2', () => true)).toBe(true);
    expect(stageJumpRuleNow(ID, 'stage3', () => true)).toBe(false);
    expect(stageJumpRuleNow(ID, 'stage2', () => false)).toBe(false);
    expect(stageJumpRuleNow(null, 'stage2', () => true)).toBe(false);
    snapshot(questsOfStage('stage1'), { testedOut: { stage2: AT } });
    expect(stageJumpRuleNow(ID, 'stage2', () => true)).toBe(false);
  });

  it('after a Stage 2 jump, Stage 3 is the reached stage and offers its own', async () => {
    const testedOut = { ...Object.fromEntries(CELLS.filter((c) => c.stage === 'stage2').map((c) => [c.id, AT])), stage2: AT };
    snapshot(questsOfStage('stage1'), { testedOut });
    const r = await draw(<StageJumpLine profileId={ID} stage={STAGE3} checkOn />);
    expect(buttonsNamed(r.root, EN.learner.stageJump.label(3, 'First Sentences'))).toHaveLength(1);
  });
});
