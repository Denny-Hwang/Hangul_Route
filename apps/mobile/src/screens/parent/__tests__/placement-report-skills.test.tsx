import type { PlacementResult, Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../../../content/placement.generated';
import { gate, placementResult } from '../../../logic/placement/__tests__/fixtures';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, render, textOf, unmount } from '../../../test-support/render';

/**
 * AMENDMENTS-PLC-VALIDITY section 3.8 (row PV-4): the report's "Reading and listening" block, the per-form pills of the
 * Words and Sentences rows and the older-sentences line. The heritage listener of section 3.9 is on screen as two lines
 * and distinct form rows; a result stored before the block (no forms, an older bank) still renders.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../placement/use-placement-bank', () => ({
  usePlacementBank: () => ({ bank: { bank: PLACEMENT_BANK, warmup: PLACEMENT_WARMUP }, failed: false, retry: vi.fn() }),
}));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: vi.fn() }), useFocusEffect: () => undefined }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => true) }));
const { PlacementReportScreen } = await import('../PlacementReportScreen');

const m = getMessages('en').caregiver.placementReport;
const ID = 'profile:sam';
const profile: Profile = { id: ID, displayName: 'Sam', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' };
const props = {
  navigation: { goBack: vi.fn(), replace: vi.fn(), navigate: vi.fn() },
  route: { key: 'k', name: 'PlacementReport', params: { profileId: ID } },
} as unknown as Parameters<typeof PlacementReportScreen>[0];

const decoded = () => [
  gate('sound-basic', 'decode', 'pass', 3),
  gate('syl-cv', 'decode', 'pass', 3),
  gate('sound-rest', 'decode', 'pass', 3),
  gate('syl-cvc', 'decode', 'pass', 3),
];
const NONE = {
  'hangul-recognition': 'not-tested',
  'sound-letter': 'not-tested',
  'syllable-reading': 'not-tested',
  vocabulary: 'not-tested',
  sentences: 'not-tested',
} as const;

/** The heritage listener: hears the words and the sentences, reads only the first sounds. */
const listener = (): PlacementResult =>
  placementResult({
    gates: [gate('sound-basic', 'decode', 'fail', 1), gate('vocab', 'oral', 'pass', 3), gate('sentence', 'oral', 'pass', 3)],
    strands: { ...NONE, 'sound-letter': 'getting-there', vocabulary: 'secure', sentences: 'secure' },
    level: { stage: 'stage1', band: 0 },
    oralStage: 'stage3',
  });

async function open(result: PlacementResult | null) {
  useProgressStore.setState({
    byProfile: { [ID]: { profileId: ID, updatedAt: '2026-10-09T10:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, placements: result === null ? [] : [result] } as never },
    hydratedFor: new Set([ID]),
  });
  return render(<PlacementReportScreen {...props} />);
}

beforeEach(() => {
  useProfileStore.setState({ profiles: [profile], activeId: ID });
});
afterEach(() => {
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
});

describe('the report block "Reading and listening" (PV-4)', () => {
  it('a heritage listener: reading at the beginning, listening at the sentences, the ahead line, distinct form rows', async () => {
    const r = await open(listener());
    const text = (id: string) => textOf(byTestId(r.root, id)[0]!);
    expect(text('placement-report-skills-title')).toBe('Reading and listening');
    expect(text('placement-report-skills-reading')).toBe('Reading At the beginning');
    expect(text('placement-report-skills-listening')).toBe('Listening Understood the short sentences we said');
    expect(byTestId(r.root, 'placement-report-skills-reading')[0]?.props['aria-label']).toBe('Reading, At the beginning');
    expect(byTestId(r.root, 'placement-report-skills-listening')[0]?.props['aria-label']).toBe(
      'Listening, Understood the short sentences we said',
    );
    expect(text('placement-report-skills-ahead')).toBe('In this check, Sam understood more Korean than Sam could read. That is common.');
    // Words and Sentences say "listening: secure" and no reading form, because none was asked.
    expect(text('placement-report-forms-vocabulary')).toBe('listening: secure');
    expect(text('placement-report-forms-sentences')).toBe('listening: secure');
    expect(byTestId(r.root, 'placement-report-form-vocabulary-read')).toHaveLength(0);
    // The sounds row keeps its one word, and the older-sentences line is not there.
    expect(byTestId(r.root, 'placement-report-forms-sound-letter')).toHaveLength(0);
    expect(byTestId(r.root, 'placement-report-older-sentences')).toHaveLength(0);
    // The block and the form rows (the report's older "can only move forward" line is not part of this change).
    const all = [...byTestId(r.root, 'placement-report-skills'), ...byTestId(r.root, 'placement-report-forms-vocabulary'), ...byTestId(r.root, 'placement-report-forms-sentences')]
      .map((n) => textOf(n))
      .join(' | ');
    expect(all).not.toMatch(/behind|\bonly\b|can't|fail|\d\s*\/\s*\d/i);
    await unmount(r);
  });

  it('a reader sees each form of Words with its own word; no ahead line when reading is level', async () => {
    const result = placementResult({
      gates: [...decoded(), gate('vocab', 'read', 'fail', 1), gate('vocab', 'oral', 'pass', 3)],
      strands: { ...NONE, 'sound-letter': 'secure', 'syllable-reading': 'secure', vocabulary: 'secure' },
      level: { stage: 'stage1', band: 3 },
      oralStage: 'stage2',
    });
    const r = await open(result);
    expect(textOf(byTestId(r.root, 'placement-report-form-vocabulary-read')[0]!)).toBe('reading: getting there');
    expect(textOf(byTestId(r.root, 'placement-report-form-vocabulary-oral')[0]!)).toBe('listening: secure');
    expect(textOf(byTestId(r.root, 'placement-report-skills-listening')[0]!)).toBe(`Listening ${m.listening.stage2}`);
    expect(textOf(byTestId(r.root, 'placement-report-skills-reading')[0]!)).toBe('Reading Reading words');
    // Listening is at the words and reading at Stage 1: still ahead by stage, so the line shows (spec: listening above reading).
    expect(byTestId(r.root, 'placement-report-skills-ahead')).toHaveLength(1);
    await unmount(r);
  });

  it('says "not checked" for reading when no decoding strand ran, and for listening when no oral stage was found', async () => {
    const result = placementResult({
      revealMode: 'always',
      gates: [gate('recog', 'decode', 'pass', 3)],
      strands: { ...NONE, 'hangul-recognition': 'secure' },
      oralStage: null,
    });
    const r = await open(result);
    expect(textOf(byTestId(r.root, 'placement-report-skills-reading')[0]!)).toBe('Reading not checked');
    expect(textOf(byTestId(r.root, 'placement-report-skills-listening')[0]!)).toBe('Listening not checked');
    expect(byTestId(r.root, 'placement-report-skills-ahead')).toHaveLength(0);
    await unmount(r);
  });

  it('an older result (no forms asked, three-question rows, bank version 1) renders: a strand with no form keeps its one word', async () => {
    const result = placementResult({
      bankVersion: 1,
      gates: [gate('sound-basic', 'decode', 'pass', 3)],
      strands: { ...NONE, 'sound-letter': 'secure' },
      oralStage: 'stage1',
    });
    const r = await open(result);
    expect(byTestId(r.root, 'placement-report-forms-vocabulary')).toHaveLength(0);
    expect(textOf(byTestId(r.root, 'placement-report-strand-vocabulary')[0]!)).toContain('Words not tested');
    expect(byTestId(r.root, 'placement-report-skills-ahead')).toHaveLength(0);
    await unmount(r);
  });

  it('a Stage 3 route placed by the older sentence items says so next to Choose a different start; the revised items do not, at the same bank version', async () => {
    const response = (questionId: string) => ({ questionId, outcome: 'correct' as const, chosenOptionId: 'a', assisted: false, ms: 1000 });
    const stage3 = (bankVersion: number, ids: string[]) =>
      placementResult({
        bankVersion,
        responses: ids.map(response),
        level: { stage: 'stage3', band: 0 },
        gates: [...decoded(), gate('vocab', 'read', 'pass', 3), gate('sentence', 'read', 'pass', 3)],
        strands: { ...NONE, 'sound-letter': 'secure', 'syllable-reading': 'secure', vocabulary: 'secure', sentences: 'secure' },
        oralStage: null,
      });
    const old = await open(stage3(3, ['pitem:sent-n-read-horangiyeyo', 'pitem:sent-reply-2']));
    expect(textOf(byTestId(old.root, 'placement-report-older-sentences')[0]!)).toBe(m.olderSentences);
    await unmount(old);
    const revised = await open(stage3(3, ['pitem:sent-read-run-bear', 'pitem:sent-reply-2']));
    expect(byTestId(revised.root, 'placement-report-older-sentences')).toHaveLength(0);
    await unmount(revised);
  });

  it('no check yet: no block', async () => {
    const r = await open(null);
    expect(byTestId(r.root, 'placement-report-skills')).toHaveLength(0);
    await unmount(r);
  });
});
