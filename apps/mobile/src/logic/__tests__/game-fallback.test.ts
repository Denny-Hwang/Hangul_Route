import { readdirSync, readFileSync } from 'node:fs';
import { MinigameKindSchema, MyStoryFrameSchema } from '@hangul-route/content-schema';
import { lessonOccurrences, lessonSourcesOfTree, normalizeKo, type ItemOccurrence } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { ALL_LESSON_SCOPES } from '../../content/__tests__/helpers/lesson-stages';
import { questsAll } from '../../content/quests';
import { GAME_FALLBACKS, SWITCHED_KINDS, gameFlagOf, playedScope } from '../game-fallback';
import { minigameScopes, type MinigameScope } from '../minigame-config';
import { PLAYABLE_KINDS } from '../minigame-renderers';
import { FIXTURE_CHAIN } from '../my-story/e2e-chain';
import { myStoryToWriteFrame } from '../my-story/fallback';
import { storyScopeFor } from '../story/story-ref';

/**
 * F-CURR-002 §12.2: "`game.<kind>` off: every round of that kind renders its fallback round (7.1). A test turns each
 * `game.<kind>` off and renders every quest." This is that test at the scope level (the screen test plays it): every
 * step of every quest, with every switch off, plays a shipped kind the app can draw; with every switch on, its own.
 */
const story: MinigameScope = { kind: 'my-story', rounds: FIXTURE_CHAIN.length, myStory: { frames: [...FIXTURE_CHAIN] } };
const allOff = (): boolean => false;
const allOn = (): boolean => true;

const everyStep = questsAll.flatMap((quest) =>
  quest.steps.flatMap((step, i) => {
    const ref = step.minigameRef;
    if (ref === undefined) return [];
    const scope = minigameScopes[ref] ?? ALL_LESSON_SCOPES[ref] ?? storyScopeFor(ref);
    return scope ? [{ at: `${quest.id} step ${i}`, scope }] : [];
  }),
);

describe('the game.<kind> switches and their fallbacks (F-CURR-002 §7.1, §12.2)', () => {
  it('every switched kind is a real kind with a fallback, and its flag is game.<kind>', () => {
    expect(SWITCHED_KINDS).toEqual(['my-story']);
    for (const kind of SWITCHED_KINDS) {
      expect(MinigameKindSchema.options).toContain(kind);
      expect(GAME_FALLBACKS[kind]).toBeTypeOf('function');
    }
    expect(gameFlagOf('my-story')).toBe('game.my-story');
  });

  it('with every switch off, every step of every quest plays a shipped kind the app draws', () => {
    expect(everyStep.length).toBeGreaterThan(100);
    const problems = everyStep.flatMap(({ at, scope }) => {
      const kind = playedScope(scope, allOff).kind;
      return SWITCHED_KINDS.includes(kind) || (!PLAYABLE_KINDS.has(kind) && kind !== 'voice-echo') ? [`${at}: ${kind}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it('shipped quests play a switched kind, so the switch-off pass above covers real content (row CM-41 S7 flipped it)', () => {
    // Review of PR #849: the pass above held no My Story step until the first chain shipped. Row CM-41 S7 (Stage 7
    // Nature Volume 2, q3 Apply) is that chain; this was `false` until then.
    const switched = everyStep.filter(({ scope }) => SWITCHED_KINDS.includes(scope.kind)).map(({ at }) => at);
    expect(switched).toContain('quest:stage7-nature-v2-q3 step 3');
    // Row CM-42 S7 (Stage 7 Play & Crafts Volume 2, q3 Apply) is the second.
    expect(switched).toContain('quest:stage7-crafts-v2-q3 step 3');
    // Row CM-43 S7 (Stage 7 Food & Daily Life Volume 2, q3 Apply) is the third.
    expect(switched).toContain('quest:stage7-life-v2-q3 step 3');
    // Row CM-45 S7 (Stage 7 Holidays & Traditions Volume 2, q3 Apply) is the fourth.
    expect(switched).toContain('quest:stage7-rites-v2-q3 step 3');
  });

  /**
   * The CM-38 hand-off, settled by row CM-41 S7: with `game.my-story` off (the launch state) only a chain's first frame
   * is played, so the frames after it teach nothing new. Every review item one of them holds (its frame pattern, each
   * bank word) is also taught by a step that plays with the switch off: another step of the same cell, or a Volume 1
   * cell of the route at or below its stage. So no item only an unplayed frame teaches joins a cell's mastery
   * denominator (section 4.4) or the Daily Review seed (section 4.8), and selection needs no hidden-source rule.
   */
  it('every item a My Story frame after the first holds is taught by a step that plays with game.my-story off', () => {
    const root = new URL('../../../../../', import.meta.url);
    const tree = new Map<string, unknown>();
    for (const n of [2, 3, 4, 6, 7]) {
      const dir = new URL(`content/episodes/stage-${n}/`, root);
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) tree.set(`content/episodes/stage-${n}/${f}`, JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
    }
    const sources = lessonSourcesOfTree(tree);
    const occurrences = sources.flatMap((source) => lessonOccurrences(source, []));
    // An occurrence inside frame k >= 2 of a chain (the extractor writes `<file> quests[q].scopes[s].frames[k]...`).
    const isTail = (o: ItemOccurrence): boolean => {
      const m = /quests\[(\d+)\]\.scopes\[(\d+)\]\.frames\[(\d+)\]/.exec(o.at);
      return m !== null && Number(m[3]) >= 1;
    };
    const played = occurrences.filter((o) => !isTail(o));
    const tail = occurrences.filter(isTail);
    expect(tail.length).toBeGreaterThan(0);
    const before = (o: ItemOccurrence, p: ItemOccurrence): boolean => p.cell === o.cell || (p.volume === 1 && p.stage <= o.stage);
    const orphans = tail.filter((o) => !played.some((p) => normalizeKo(p.ko) === normalizeKo(o.ko) && before(o, p))).map((o) => `${o.at}: ${o.ko}`);
    expect(orphans).toEqual([]);
  });

  it('with every switch off, a quest that holds a My Story step plays every step as a shipped kind', () => {
    const withStory = [...everyStep.slice(0, 3), { at: 'synthetic step', scope: story }];
    const played = withStory.map(({ scope }) => playedScope(scope, allOff).kind);
    expect(played.at(-1)).toBe('write-frame');
    expect(played.filter((kind) => SWITCHED_KINDS.includes(kind) || (!PLAYABLE_KINDS.has(kind) && kind !== 'voice-echo'))).toEqual([]);
  });

  it('with every switch on, a step plays its own scope, unchanged', () => {
    for (const { scope } of everyStep) expect(playedScope(scope, allOn)).toBe(scope);
    expect(playedScope(story, allOn)).toBe(story);
  });

  it('a kind without a switch is never replaced, whatever the switches say', () => {
    const listen: MinigameScope = { kind: 'listen-pick', listenPick: { rounds: [] } };
    expect(playedScope(listen, allOff)).toBe(listen);
  });

  it('My Story off: Write Frame on the first frame, its bank and neutral option included; the rest is not played', () => {
    const played = playedScope(story, (kind) => kind !== 'my-story');
    expect(played).toEqual(myStoryToWriteFrame(story));
    expect(played).toEqual({ kind: 'write-frame', rounds: 1, writeFrame: { rounds: [FIXTURE_CHAIN[0]] } });
    const bank = played.writeFrame!.rounds[0]!.slots[0]!.bank;
    expect(bank.map((w) => w.ko)).toEqual(['도서관', '시장', '공원']);
    expect(PLAYABLE_KINDS.has(played.kind)).toBe(true);
    // An empty chain (bad data) gives an empty Write Frame scope: the game's own empty state, never a crash.
    expect(myStoryToWriteFrame({ kind: 'my-story' })).toEqual({ kind: 'write-frame', rounds: 0, writeFrame: { rounds: [] } });
  });

  it('the fixture chain is a valid chain (3 frames, a neutral option in every bank)', () => {
    for (const frame of FIXTURE_CHAIN) expect(MyStoryFrameSchema.safeParse(frame).success, frame.id).toBe(true);
  });
});
