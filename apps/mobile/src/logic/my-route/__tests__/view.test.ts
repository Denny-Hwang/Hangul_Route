import { describe, expect, it } from 'vitest';
import { MinigameKindSchema, type ProgressSnapshot, type StageKey, type ThemeKey } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { buildMyRoute } from '../model';
import { SKILL_OF_KIND } from '../skills';
import type { MyRouteInput, MyRouteModel, SeenRecord } from '../types';
import {
  GAME_NAME_KEY,
  emptySnapshot,
  PIP_ROW_MIN_WIDTH,
  gamesFor,
  myRouteMessages,
  myRouteView,
  stageFill,
  stageGroups,
  stageRowLook,
  withConnectors,
  type LaterRowView,
  type MyRouteViewInput,
  type StageRowView,
} from '../view';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { seed } from './fixtures/route';

const EN = getMessages('en');
const THEME_TITLES: Record<ThemeKey, string> = { letters: 'Letters', life: 'Life', rites: 'Rites', nature: 'Nature', crafts: 'Crafts' };
const APPENDIX_C = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1'];

const model = (done: string[], over: Partial<MyRouteInput> = {}, bundle: Bundle = BUNDLE_8, extra: Partial<ProgressSnapshot> = {}): MyRouteModel =>
  buildMyRoute({
    snapshot: snapshotWith(done, extra),
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
    route: null,
    now: new Date('2026-10-11T00:00:00.000Z'),
    ...over,
  });

const inputOf = (snapshot: ProgressSnapshot): MyRouteInput => ({
  snapshot,
  catalog: catalogOf(BUNDLE_8),
  episodes: BUNDLE_8.episodes,
  quests: BUNDLE_8.quests,
  cards: [],
  stages: STAGE_DEFS,
  themes: THEME_DEFS,
  isEntitled: () => true,
  route: null,
  now: new Date('2026-10-11T00:00:00.000Z'),
});

const view = (m: MyRouteModel, over: Partial<MyRouteViewInput> = {}) =>
  myRouteView({ model: m, messages: EN, viewer: 'self', name: 'Sam', themeTitles: THEME_TITLES, nextTitle: null, hasStories: false, seen: undefined, ...over });

const stageRow = (v: ReturnType<typeof view>, stage: StageKey): StageRowView =>
  v.trail.find((r): r is StageRowView => r.kind === 'stage' && r.stage === stage) as StageRowView;
const laterRows = (v: ReturnType<typeof view>): LaterRowView[] => v.trail.filter((r): r is LaterRowView => r.kind === 'later');

describe('myRouteMessages', () => {
  it('reads the four slices the copy selectors need from one locale dictionary', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale);
      const slices = myRouteMessages(m);
      expect(slices.learner).toBe(m.learner.myRoute);
      expect(slices.grownup).toBe(m.caregiver.journey);
      expect(slices.skillsNote).toBe(m.caregiver.skillsNote);
      expect(slices.a11y).toBe(m.a11y.myRoute);
    }
  });
});

describe('emptySnapshot', () => {
  it('a profile with no progress draws the new-learner page', () => {
    const snap = emptySnapshot('p1');
    expect(snap).toMatchObject({ profileId: 'p1', quests: [], cards: [], streakDays: 0 });
    expect(view(model([]))).toEqual(view(buildMyRoute({ ...inputOf(snap) })));
  });
});

describe('stageRowLook (section 3.4: below 360 a bar, else the pips)', () => {
  it('switches at 360', () => {
    expect(PIP_ROW_MIN_WIDTH).toBe(360);
    expect(stageRowLook(320)).toBe('bar');
    expect(stageRowLook(359)).toBe('bar');
    expect(stageRowLook(360)).toBe('pips');
    expect(stageRowLook(1180)).toBe('pips');
  });
});

describe('myRouteView: wireframe A (Appendix C, today mid-progress)', () => {
  const v = view(model(APPENDIX_C), { nextTitle: 'Family at the Table' });

  it('the hero: the stage line, the next quest and Continue', () => {
    expect(v.hero).toBe('continue');
    expect(v.heroCopy).toEqual({ lines: ['You are on Stage 1: Hangul.', 'Next: Family at the Table'], cta: { action: 'quest', label: 'Continue' } });
    expect(v.pose).toBe('idle');
    expect(v.viewing).toBeNull();
    expect(v.newQuests).toBeNull();
  });

  it('the trail: Stage 1, Stage 2, Stage 3 compact, Stage 4, Stages 5 to 7 merged', () => {
    expect(v.trail.map((r) => (r.kind === 'stage' ? r.stage : r.title))).toEqual(['stage1', 'stage2', 'Sentences', 'stage4', 'Stages 5 to 7']);
    expect(v.initialOpen).toBe('stage1');
  });

  it('Stage 1: open, here, four discs then four rings in one group, the cursor on life q2', () => {
    const s1 = stageRow(v, 'stage1');
    expect(s1).toMatchObject({ title: 'Hangul', stateWord: 'Open', tone: 'primary', badge: 'number', captions: ['4 quests played'], order: 1 });
    expect(s1.tags).toEqual([{ label: 'You are here', pin: false }]);
    expect(s1.a11yLabel).toBe('Stage 1, Hangul. Open. You are here. 4 quests played.');
    expect(s1.groups).toHaveLength(1);
    expect(s1.groups[0]?.map((p) => p.state)).toEqual(['done', 'done', 'done', 'done', 'open', 'open', 'open', 'open']);
    expect(s1.groups[0]?.filter((p) => p.isCursor).map((p) => p.key)).toEqual(['quest:stage1-life-q2']);
    expect(s1.fill).toEqual({ value: 4, max: 8 });
    expect(s1.canDo).toEqual({ lead: 'By the end of this stage you can:', line: 'Read any Hangul letter and syllable and know its sound.' });
    expect(s1.builds.map((b) => [b.label, b.icon])).toEqual([
      ['Read', 'book'],
      ['Listen', 'ear'],
      ['Write', 'pencil'],
    ]);
    expect(s1.fresh).toBe(false);
  });

  it('Stage 1 cells: theme, title, word; each a button to its episode', () => {
    const cells = stageRow(v, 'stage1').cells;
    expect(cells.map((c) => c.word)).toEqual(['Complete', 'Playing', 'Open', 'Open', 'Open']);
    expect(cells.map((c) => c.themeLabel)).toEqual(['Letters', 'Life', 'Rites', 'Nature', 'Crafts']);
    expect(cells.every((c) => c.episodeId !== null)).toBe(true);
    expect(cells[0]?.a11yLabel).toBe(`Letters: ${cells[0]?.title}. Complete.`);
  });

  it('Stage 2: a taste, two quest rings then three coming-later pips as their own group; later cells are not buttons', () => {
    const s2 = stageRow(v, 'stage2');
    expect(s2).toMatchObject({ stateWord: 'A taste', tone: 'secondary', badge: 'number', captions: ['Ready when you are'] });
    expect(s2.groups.map((g) => g.map((p) => p.state))).toEqual([['open', 'open'], ['later', 'later', 'later']]);
    expect(s2.fill).toEqual({ value: 0, max: 2 });
    expect(s2.cells.filter((c) => c.episodeId === null).map((c) => c.word)).toEqual(['Coming later', 'Coming later', 'Coming later']);
  });

  it('coming-later rows: Stage 3 alone with its title, Stages 5 to 7 merged; each opens to can-do lines and a note', () => {
    const [s3, run] = laterRows(v);
    expect(s3).toMatchObject({ merged: false, title: 'Sentences', stateWord: 'Coming later', order: 3, stage: 'stage3', a11yLabel: 'Stage 3, Sentences. Coming later.' });
    expect(s3?.details).toEqual([
      { stage: 'stage3', order: 3, title: 'Sentences', canDo: 'Read and build short, simple sentences.', builds: [{ skill: 'read', label: 'Read', icon: 'book' }, { skill: 'write', label: 'Write', icon: 'pencil' }] },
    ]);
    expect(s3?.note).toBe('It will appear here when it is ready.');
    expect(run).toMatchObject({ merged: true, title: 'Stages 5 to 7', order: 5, stage: 'stage5', a11yLabel: 'Stages 5 to 7. Coming later.', key: 'later:stage5-stage6-stage7' });
    expect(run?.details.map((d) => d.title)).toEqual(['Stories', 'Real-use', 'Self-expression']);
  });

  it('the trail line: solid into Stage 1 only reached; dotted below; none after the last row', () => {
    expect(v.trail.map((r) => r.connector)).toEqual(['dotted', 'dotted', 'dotted', 'dotted', null]);
  });

  it('skills: Read and Listen with 3 marks and a faint next slot, Write with 1 mark and no slot', () => {
    expect(v.skillsTitle).toBe('What your quests practice');
    expect(v.skills.map((s) => [s.label, s.detail, s.marks.map((p) => p.state).join(',')])).toEqual([
      ['Read', 'In 4 quests you finished', 'done,done,done,open'],
      ['Listen', 'In 4 quests you finished', 'done,done,done,open'],
      ['Write', 'In 1 quest you finished', 'done'],
    ]);
    expect(v.skills[0]?.a11yLabel).toBe('Read. In 4 quests you finished.');
    expect(v.skills.map((s) => s.icon)).toEqual(['book', 'ear', 'pencil']);
    expect(v.skills[2]?.sheet).toEqual({ title: 'Games that count for Write', note: 'A finished quest counts here when it has one of these games.', games: ['Trace a letter'] });
    expect(new Set(v.skills.flatMap((s) => s.marks.map((p) => p.key))).size).toBe(9);
    expect(v.skillsNote).toBeNull();
    expect(v.tiles).toBeNull();
  });

  it('gains show the stars only (no card, no story yet); no stories note without a reviewed story', () => {
    expect(v.gains.map((g) => g.key)).toEqual(['stars']);
    expect(v.storiesNote).toBeNull();
    expect(view(model([])).gains).toEqual([]);
  });
});

describe('myRouteView: other states', () => {
  it('a new learner: Start with the goal line; skills read "Ready when you are" with no slot', () => {
    const v = view(model([]), { nextTitle: 'Meet the First Letters' });
    expect(v.heroCopy.lines).toEqual(['Your Hangul route starts here.', 'Your first goal: read every Hangul letter.']);
    expect(v.heroCopy.cta).toEqual({ action: 'quest', label: 'Start' });
    expect(v.skills.map((s) => [s.detail, s.marks.length])).toEqual([
      ['Ready when you are', 0],
      ['Ready when you are', 0],
      ['Ready when you are', 0],
    ]);
    expect(stageRow(v, 'stage1').connector).toBe('dotted');
  });

  it('gains: absolute numbers, zero tiles hidden; cards and stories open the Library', () => {
    const m = model(APPENDIX_C, {}, BUNDLE_8, {
      cards: [
        { cardId: 'card:a', unlockedAt: 't', newSinceLastView: false },
        { cardId: 'card:b', unlockedAt: 't', newSinceLastView: false },
      ],
    });
    const v = view(m);
    expect(v.gains.map((g) => [g.key, g.value, g.label, g.a11yLabel, g.opensLibrary, g.icon])).toEqual([
      ['stars', m.gains.stars, 'Stars', `Stars: ${m.gains.stars}`, false, 'star'],
      ['cards', 2, 'Cards', 'Cards: 2', true, 'card'],
    ]);
    const withStory = view({ ...m, gains: { stars: 0, cards: 0, storiesRead: 2 } });
    expect(withStory.gains.map((g) => [g.key, g.icon, g.opensLibrary])).toEqual([['stories', 'book', true]]);
  });

  it('rest with a reviewed story: Open stories and the stories note', () => {
    const v = view(model(BUNDLE_8.quests.map((q) => q.id)), { hasStories: true });
    expect(v.hero).toBe('rest');
    expect(v.heroCopy.cta).toEqual({ action: 'stories', label: 'Open stories' });
    expect(v.storiesNote).toBe('Heritage stories are open any time.');
    expect(stageRow(v, 'stage2')).toMatchObject({ stateWord: 'Explored', tone: 'success', badge: 'explored' });
    expect(stageRow(v, 'stage1')).toMatchObject({ stateWord: 'Complete', tone: 'success', badge: 'complete' });
    // Stage 4 is the highest stage with progress: the trail is solid down to it.
    expect(v.trail.map((r) => r.connector)).toEqual(['solid', 'solid', 'solid', 'dotted', null]);
    expect(stageRow(v, 'stage4').tags.map((t) => t.label)).toEqual(['You are here']);
  });

  it('a stage the level check placed out: You knew this, the info tone and the ring-with-disc badge', () => {
    const v = view(model([], { route: seed(STAGE1_8) }));
    expect(stageRow(v, 'stage1')).toMatchObject({ stateWord: 'You knew this', tone: 'info', badge: 'known' });
    expect(stageRow(v, 'stage1').fill).toEqual({ value: 0, max: 8 });
  });

  it('a start marker tag carries the pin glyph (R-7a sets isStart)', () => {
    const m = model([]);
    const stages = m.stages.map((s) => (s.stage === 'stage1' ? { ...s, isStart: true } : s));
    expect(stageRow(view({ ...m, stages }), 'stage1').tags).toEqual([
      { label: 'You are here', pin: false },
      { label: 'You started here', pin: true },
    ]);
    const notHere = m.stages.map((s) => (s.stage === 'stage2' ? { ...s, isStart: true } : s));
    expect(stageRow(view({ ...m, stages: notHere }), 'stage2').tags).toEqual([{ label: 'You started here', pin: true }]);
  });

  it('latched at 8 of 8 with 7 new quests: the earned group, then the new group; the bar stays full; the new-quests line', () => {
    const seen: SeenRecord = { totals: { stage1: 8 }, doneKeys: STAGE1_8, at: 't' };
    const m = model(STAGE1_8, { seen }, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    const v = view(m, { seen });
    const s1 = stageRow(v, 'stage1');
    expect(s1.groups.map((g) => g.length)).toEqual([8, 7]);
    expect(s1.groups[1]?.every((p) => p.state === 'new')).toBe(true);
    expect(s1.fill).toEqual({ value: 1, max: 1 });
    expect(s1.captions).toEqual(['8 quests played', 'New quests joined']);
    expect(v.newQuests).toBe('7 new quests joined Stage 1.');
  });

  it('a quest done since the last open marks its row fresh and makes Hoya cheer when it completed an episode', () => {
    const before: SeenRecord = { totals: {}, doneKeys: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2'], at: 't' };
    const v = view(model(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']), { seen: before });
    expect(stageRow(v, 'stage1').fresh).toBe(true);
    expect(stageRow(v, 'stage2').fresh).toBe(false);
    expect(v.pose).toBe('cheering');
  });

  it('read-only (a grown-up viewing a child): third person, no button, the note, the tiles line, the viewing line', () => {
    const v = view(model(APPENDIX_C), { viewer: 'grownup', name: 'Sam', nextTitle: 'Family at the Table' });
    expect(v.viewing).toBe("Viewing Sam's journey");
    expect(v.heroCopy).toEqual({ lines: ['Sam is on Stage 1: Hangul.', 'Next: Family at the Table'], cta: null });
    expect(v.skillsTitle).toBe("What Sam's quests practice");
    expect(v.skills[0]?.detail).toBe('In 4 quests Sam finished');
    expect(v.skillsNote).toBe(EN.caregiver.skillsNote);
    expect(v.tiles).toBe('Spelling with tiles: 2 quests');
    expect(stageRow(v, 'stage1').tags).toEqual([{ label: 'Sam is here', pin: false }]);
    expect(v.newQuests).toBeNull();
  });

  it('OD-4 other branch: a not-open-yet stage keeps its own row and reads "Not open yet"; its cells are not buttons', () => {
    const v = view(model([], { isEntitled: (s) => s === 'stage1' }));
    const s2 = stageRow(v, 'stage2');
    expect(s2).toMatchObject({ stateWord: 'Not open yet', tone: 'neutral', badge: 'later' });
    expect(s2.cells.every((c) => c.episodeId === null)).toBe(true);
  });
});

describe('the pieces', () => {
  it('stageGroups drops empty groups; stageFill is null without a quest pip', () => {
    const m = model([]);
    const s3 = m.stages.find((s) => s.stage === 'stage3');
    expect(s3 && stageGroups(s3).map((g) => g.map((p) => p.state))).toEqual([['later', 'later', 'later', 'later', 'later']]);
    expect(s3 && stageFill(s3)).toBeNull();
  });

  it('withConnectors: solid into every row whose first stage is reached', () => {
    const m = model([]);
    const rows = view(m).trail;
    expect(withConnectors(rows, { stages: m.stages, trailReached: 4 }).map((r) => r.connector)).toEqual(['solid', 'solid', 'solid', 'solid', null]);
    expect(withConnectors(rows, { stages: m.stages, trailReached: 2 }).map((r) => r.connector)).toEqual(['solid', 'solid', 'dotted', 'dotted', null]);
    expect(withConnectors([], m)).toEqual([]);
  });

  it('every kind mapped to a skill has a game name; gamesFor lists them per skill', () => {
    for (const kind of MinigameKindSchema.options) {
      if (SKILL_OF_KIND[kind].length > 0) expect(GAME_NAME_KEY[kind], kind).toBeDefined();
    }
    const games = EN.learner.myRoute.games;
    expect(gamesFor('read', games)).toEqual([
      'Hear a sound, find its letter',
      'Hear it, then tap the answer',
      'Match the shapes',
      'Find the one that is different',
      'Match a picture to its word',
      'Read a story',
    ]);
    expect(gamesFor('listen', games)).toEqual(['Hear a sound, find its letter', 'Hear it, then tap the answer', 'Listen and pick']);
    expect(gamesFor('write', games)).toEqual(['Trace a letter']);
  });
});
