import { readFileSync, readdirSync } from 'node:fs';
import { LessonCellSchema, isRolePlayEnd, type LessonCell, type LessonQuest, type LessonScope, type RolePlayScene } from '@hangul-route/content-schema';
import { allowlistedInstitution, lintCurriculum, practiceCheckItems, rolePlayPaths } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { playedScope, rolePlayMainPath } from '../../logic/role-play/fallback';
import { startRolePlay, stepRolePlay, type RpState } from '../../logic/role-play/reducer';
import { ALL_LESSON_SCOPES } from './helpers/lesson-stages';

/**
 * F-CURR-002 row CM-43 S4, Stage 4 Food & Daily Life Volume 2, Snack Bar Talk (`content/episodes/stage-4/life.v2.json`):
 * the §5.1 and §5.3 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every file,
 * the review-item freeze, the game switches) run over it with every other cell; this file holds what is particular to it:
 * a generic snack bar (분식집) with round practice prices in won, the mealtime set phrases, Role Play read-and-tap scenes
 * of 4 turns where every way ends well (§7.1 F6, row CM-35) and whose Tap to Respond fallback plays the main path,
 * triples that differ from Volume 1's, a Check rotation of its own, recycling and sourced culture notes.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const FILE = 'content/episodes/stage-4/life.v2.json';
const cell: LessonCell = LessonCellSchema.parse(read(FILE));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-4/life.json'));

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const scenes = cell.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'role-play' ? [[s.ref, s.scene] as const] : [])));

/** Every way through a scene by its natural replies, played on the game's reducer: the turns and the closing reached. */
function playEveryWay(scene: RolePlayScene): Array<{ turns: number; done: boolean }> {
  const out: Array<{ turns: number; done: boolean }> = [];
  const walk = (state: RpState): void => {
    if (state.done) {
      out.push({ turns: state.turn, done: true });
      return;
    }
    const turn = scene.nodes.find((n) => n.id === state.node);
    if (turn === undefined || !('replies' in turn)) {
      out.push({ turns: state.turn, done: false });
      return;
    }
    // A less natural tap first: it locks in amber and the turn stays open (no bad ending).
    const less = turn.replies.find((r) => r.kind === 'lessNatural');
    const nudged = less === undefined ? state : stepRolePlay(scene, state, { type: 'tap', reply: less.id }).state;
    expect(nudged.node).toBe(state.node);
    for (const reply of turn.replies.filter((r) => r.kind === 'natural')) {
      const tapped = stepRolePlay(scene, nudged, { type: 'tap', reply: reply.id }).state;
      walk(stepRolePlay(scene, tapped, { type: 'sent' }).state);
    }
  };
  walk(startRolePlay(scene).state);
  return out;
}

describe('Stage 4 Food & Daily Life, Volume 2: Snack Bar Talk (row CM-43 S4)', () => {
  it('is the second volume of its cell, ready, with three quests stamped after main', () => {
    expect(cell).toMatchObject({ id: 'episode:stage4-life-v2', stage: 'stage4', theme: 'life', volume: 2, status: 'ready' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage4-life-v2-q1', 'quest:stage4-life-v2-q2', 'quest:stage4-life-v2-q3']);
    for (const q of cell.quests) expect(q.addedIn, q.id).toBe(20261030);
  });

  it('plays Practice / Apply / Check triples that differ from Volume 1 and from each other, with three different Checks', () => {
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['role-play / cloze-pick / tap-respond', 'role-play / tap-respond / order-it', 'order-it / role-play / cloze-pick']);
    for (const t of triples) expect(v1.quests.map(tripleOf)).not.toContain(t);
    expect(new Set(cell.quests.map((q) => scopeOf(q, 'check')?.kind)).size).toBe(3);
  });

  it('every Role Play scene has 4 turns on every way, at most 4 ways, and every way ends on its closing line', () => {
    expect(scenes.map(([ref]) => ref)).toEqual(['minigame:s4-life-v2-q1-practice', 'minigame:s4-life-v2-q2-practice', 'minigame:s4-life-v2-q3-apply']);
    for (const [ref, scene] of scenes) {
      const paths = rolePlayPaths(scene);
      expect(paths.length, ref).toBeGreaterThan(0);
      expect(paths.length, ref).toBeLessThanOrEqual(4);
      for (const path of paths) expect(isRolePlayEnd(scene.nodes.find((n) => n.id === path.at(-1))), `${ref} ${path.join(' > ')}`).toBe(true);
      const ways = playEveryWay(scene);
      expect(ways.length, ref).toBe(paths.length);
      for (const way of ways) expect(way, ref).toEqual({ turns: 4, done: true });
      // Every turn offers a natural reply and a less natural one, and no turn repeats a reply.
      for (const node of scene.nodes) {
        if (!('replies' in node)) continue;
        expect(node.replies.some((r) => r.kind === 'natural'), `${ref} ${node.id}`).toBe(true);
        expect(node.replies.some((r) => r.kind === 'lessNatural'), `${ref} ${node.id}`).toBe(true);
        expect(new Set(node.replies.map((r) => r.text.ko)).size, `${ref} ${node.id}`).toBe(node.replies.length);
      }
    }
  });

  it('with game.role-play off each scene plays Tap to Respond on its main path: 4 turns, one right reply each', () => {
    for (const [ref, scene] of scenes) {
      expect(rolePlayMainPath(scene), ref).toHaveLength(4);
      const scope = ALL_LESSON_SCOPES[ref];
      expect(scope?.kind, ref).toBe('role-play');
      const off = playedScope(scope as NonNullable<typeof scope>, false);
      expect(off.kind, ref).toBe('tap-respond');
      expect(off.dialogue?.length, ref).toBe(4);
      for (const turn of off.dialogue ?? []) expect(turn.options.filter((o) => o.isCorrect), ref).toHaveLength(1);
    }
  });

  it('keeps the scene generic and the prices round practice amounts in won: a snack bar, a server by role, no brand or name', () => {
    for (const [ref, scene] of scenes) {
      expect(scene.title.ko, ref).toBe('분식집');
      expect(scene.partner.ko, ref).toBe('직원');
    }
    const korean = JSON.stringify(cell.quests).match(/[가-힣]+ 원/g) ?? [];
    expect(korean.length).toBeGreaterThan(0);
    for (const amount of korean) expect(['이천 원', '삼천 원'], amount).toContain(amount);
    for (const q of cell.quests) for (const s of q.steps) expect(s.minigameKind, `${q.id} ${s.id}`).not.toBe('voice-echo');
  });

  it('teaches the mealtime set phrases: 잘 먹겠습니다 before the meal and 잘 먹었습니다 after it, never the other way round', () => {
    const q3 = cell.quests[2] as LessonQuest;
    const apply = scopeOf(q3, 'apply');
    if (apply?.kind !== 'role-play') throw new Error('q3 Apply is a Role Play');
    const [first, , , last] = rolePlayMainPath(apply.scene);
    expect(first?.replies.filter((r) => r.kind === 'natural').map((r) => r.text.ko)).toEqual(['잘 먹겠습니다.']);
    expect(last?.replies.filter((r) => r.kind === 'natural').map((r) => r.text.ko)).toEqual(['네, 잘 먹었습니다.']);
    expect(first?.replies.find((r) => r.text.ko === '잘 먹었습니다.')?.kind).toBe('lessNatural');
    expect(last?.replies.find((r) => r.text.ko === '잘 먹겠습니다.')?.kind).toBe('lessNatural');
  });

  it('recycles Volume 1 and earlier stages: at least 30 in 100 of each quest’s Practice and Check items were taught before', () => {
    // Every lesson cell of the route: what was taught before is read from Volume 1 and the lower stages.
    const tree = new Map<string, unknown>();
    for (const stage of readdirSync(new URL('../../../../../content/episodes/', import.meta.url))) {
      if (!stage.startsWith('stage-')) continue;
      for (const f of readdirSync(new URL(`../../../../../content/episodes/${stage}/`, import.meta.url))) {
        if (f.endsWith('.json')) tree.set(`content/episodes/${stage}/${f}`, read(`content/episodes/${stage}/${f}`));
      }
    }
    expect(tree.has(FILE)).toBe(true);
    const findings = lintCurriculum(tree, { today: '2026-10-30' }).filter((f) => f.file === FILE && f.severity === 'error');
    expect(findings.map((f) => `${f.rule} ${f.path}: ${f.message}`)).toEqual([]);
    // The cell's own recycled items, by name: Volume 1's taste exchanges and Stage 3's sentences.
    const asked = cell.quests.flatMap((q) => practiceCheckItems(q as unknown as Parameters<typeof practiceCheckItems>[0]));
    for (const ko of ['맛이 어때요', '맛있어요', '아니요, 안 매워요', '김치가 맛있어요', '김밥이 맛있어요']) expect(asked, ko).toContain(ko);
  });

  it('carries three culture notes, each with two or more sources and an allowlisted one first, accessed 2026-10-30', () => {
    expect(cell.culture.filter((n) => n.kind === 'culture')).toHaveLength(3);
    for (const note of cell.culture) {
      const sources = note.sources ?? [];
      expect(sources.length, note.id).toBeGreaterThanOrEqual(2);
      const first = sources[0];
      expect(first && allowlistedInstitution(first.publisher, first.accessed, first.url), note.id).toBeDefined();
      for (const s of sources) expect(s.accessed, note.id).toBe('2026-10-30');
      expect(note.verification?.passes, note.id).toBeGreaterThanOrEqual(3);
    }
    expect(cell.review).toMatchObject({ reviewedBy: 'MAR' });
  });
});
