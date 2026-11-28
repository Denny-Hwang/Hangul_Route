import type { Profile, ProgressSnapshot, RomanizationChoice } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { snapshotWith } from '../../../logic/stage1/__tests__/fixtures';
import { STAGE1_QUESTS } from '../../../logic/stage1/curriculum';
import { FADE_READING_FROM_QUEST } from '../../../logic/locale/romanization-fade';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.9, row RF-2 (mock `design/screens/profile/reading-practice.md` Panel B): Hoya's
 * one-time reading line on the Hello step of the next quest run that starts while it is due. A second bubble with no
 * figure under the quest's own line, no Hoya 120 on the card for that run, marked shown when the step mounts (once per
 * profile), decided once for the run (Previous back to Hello shows it again), never for a guest, the All lessons preview,
 * a choice other than As I learn, a screen reader, phase `letters`, or a Word Builder quest in phase `reading`.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));
vi.mock('../../../platform/storage', async (importOriginal) => ({ ...(await importOriginal<object>()), writeJson: vi.fn(async () => undefined) }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const LINE = getMessages('en').learner.quest.readingNotice;
const FIRST_TEN = STAGE1_QUESTS.slice(0, 10).map((q) => ({ questId: q.id, episodeId: 'episode:x' }));
const SNAPSHOTS: Record<'letters' | 'reading' | 'all', () => ProgressSnapshot> = {
  letters: () => snapshotWith(FIRST_TEN.slice(0, 3)),
  reading: () => snapshotWith(FIRST_TEN),
  all: () => ({ ...snapshotWith([]), testedOut: { 'episode:stage2-letters': '2026-11-01T00:00:00.000Z' } }),
};

const Q11 = questById(FADE_READING_FROM_QUEST)!;
const WORD_BUILDER_QUEST = questById('quest:stage2-letters-q1')!;
const mounted: ReactTestRenderer[] = [];

type SeedOptions = { choice?: RomanizationChoice; phase: 'letters' | 'reading' | 'all'; noticeAt?: string; screenReader?: boolean };

function seed(options: SeedOptions): void {
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  const stored =
    options.choice === undefined
      ? { romanizationMode: 'always' as const }
      : { romanizationMode: options.choice === 'tap' ? ('tap' as const) : ('always' as const), romanizationChoice: options.choice };
  useLocaleStore.setState({
    byProfile: { [ID]: { ...stored, ...(options.noticeAt === undefined ? {} : { romanizationNoticeAt: options.noticeAt }) } },
    screenReader: options.screenReader === true,
    device: 'en',
  });
  useProgressStore.setState({ byProfile: { [ID]: SNAPSHOTS[options.phase]() } });
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function open(questId: string, reviewsFor: string | null = ID, step = 0) {
  const quest = questById(questId)!;
  const ports = { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
  const r = await render(
    <QuestPlayerView questId={quest.id} episodeId="episode:x" ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={reviewsFor} />,
  );
  mounted.push(r);
  await settle();
  return r;
}

const notice = (r: ReactTestRenderer) => byTestId(r.root, 'quest-reading-notice');
/** The waving Hoya figure the Hello card draws (the 120); the bubbles draw the idle 72. */
const bigHoya = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.type !== 'string' && n.props.pose === 'waving' && n.props.size === 120);
const noticeAt = (): string | undefined => useLocaleStore.getState().byProfile[ID]?.romanizationNoticeAt;

beforeEach(() => {
  useQuestRunStore.getState().reset();
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
});

describe('Hoya’s reading line, when it is due (section 3.9)', () => {
  it('quest 11 opens on an intro step, which is the Hello step', () => {
    expect(Q11.steps[0]?.kind).toBe('intro');
  });

  it('phase reading, a Stage 1 quest, As I learn: one bubble with the line, no Hoya 120, Continue is there; marked shown', async () => {
    seed({ phase: 'reading' });
    const r = await open(Q11.id);
    expect(notice(r)).toHaveLength(1);
    expect(screenTexts(notice(r)[0]!)).toContain(LINE);
    expect(bigHoya(r)).toHaveLength(0);
    expect(buttonsNamed(r.root, 'Continue')).toHaveLength(1);
    expect(noticeAt()).toBeDefined();
    expect(Number.isNaN(Date.parse(noticeAt()!))).toBe(false);
    // the choice and the rest of the record are kept
    expect(useLocaleStore.getState().byProfile[ID]?.romanizationMode).toBe('always');
  });

  it('the bubble is not a live region and the quest’s own bubble keeps its place above it', async () => {
    seed({ phase: 'reading' });
    const r = await open(Q11.id);
    expect(notice(r)[0]!.props['aria-live']).not.toBe('polite');
    const texts = screenTexts(r.root);
    expect(texts.indexOf(LINE)).toBeGreaterThan(texts.indexOf(Q11.steps[0]!.hoyaLineEn!));
  });

  it('phase all, any quest (even a Word Builder one): due', async () => {
    seed({ phase: 'all' });
    const r = await open(WORD_BUILDER_QUEST.id);
    expect(notice(r)).toHaveLength(1);
    expect(bigHoya(r)).toHaveLength(0);
    expect(noticeAt()).toBeDefined();
  });

  it('with a stored choice As I learn, as with none', async () => {
    seed({ choice: 'auto', phase: 'reading' });
    const r = await open(Q11.id);
    expect(notice(r)).toHaveLength(1);
  });

  it('shows once: the next run of any quest does not show it again', async () => {
    seed({ phase: 'reading' });
    const first = await open(Q11.id);
    expect(notice(first)).toHaveLength(1);
    await unmount(first);
    useQuestRunStore.getState().reset();
    const second = await open(Q11.id);
    expect(notice(second)).toHaveLength(0);
    // Hoya's 120 is back on a run with no line
    expect(bigHoya(second)).toHaveLength(1);
    const other = await open(STAGE1_QUESTS[0]!.id);
    expect(notice(other)).toHaveLength(0);
  });

  it('is decided once for the run: Previous from step 2 back to Hello shows the line again, with no Hoya 120', async () => {
    seed({ phase: 'reading' });
    const r = await open(Q11.id);
    expect(notice(r)).toHaveLength(1);
    const stored = noticeAt();
    await press(buttonsNamed(r.root, 'Continue')[0]!);
    await settle();
    expect(notice(r)).toHaveLength(0);
    await press(buttonsNamed(r.root, 'Previous')[0]!);
    await settle();
    expect(notice(r)).toHaveLength(1);
    expect(bigHoya(r)).toHaveLength(0);
    expect(noticeAt()).toBe(stored);
  });
});

describe('Hoya’s reading line, when it is not due', () => {
  it.each<[string, SeedOptions]>([
    ['phase letters', { phase: 'letters' }],
    ['the choice is Always', { choice: 'always', phase: 'reading' }],
    ['the choice is Only when I tap', { choice: 'tap', phase: 'all' }],
    ['a screen reader is in use (the device flag)', { phase: 'reading', screenReader: true }],
    ['it was shown before', { phase: 'reading', noticeAt: '2026-11-20T08:00:00.000Z' }],
  ])('%s', async (_, options) => {
    seed(options);
    const r = await open(Q11.id);
    expect(notice(r)).toHaveLength(0);
    // the step is exactly as it was: Hoya's 120 and Continue
    expect(bigHoya(r)).toHaveLength(1);
    expect(buttonsNamed(r.root, 'Continue')).toHaveLength(1);
    if (options.noticeAt === undefined) expect(noticeAt()).toBeUndefined();
  });

  it('phase reading on a quest that is not Stage 1 (a Word Builder quest): nothing folds there, so no line and not marked', async () => {
    seed({ phase: 'reading' });
    const r = await open(WORD_BUILDER_QUEST.id);
    expect(notice(r)).toHaveLength(0);
    expect(noticeAt()).toBeUndefined();
  });

  it('a guest or the All lessons preview (no learner id): no line', async () => {
    seed({ phase: 'all' });
    const r = await open(Q11.id, null);
    expect(notice(r)).toHaveLength(0);
    expect(bigHoya(r)).toHaveLength(1);
    expect(noticeAt()).toBeUndefined();
  });

  it('a run that resumes past its first step never gets it', async () => {
    seed({ phase: 'reading' });
    const r = await open(Q11.id, ID, 1);
    expect(notice(r)).toHaveLength(0);
    expect(noticeAt()).toBeUndefined();
  });
});
