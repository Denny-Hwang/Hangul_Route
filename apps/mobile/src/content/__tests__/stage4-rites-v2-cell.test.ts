import { readFileSync, readdirSync } from 'node:fs';
import { LessonCellSchema, isRolePlayEnd, type LessonCell, type LessonQuest, type LessonScope, type RolePlayScene } from '@hangul-route/content-schema';
import { allowlistedInstitution, lintCurriculum, practiceCheckItems, rolePlayPaths } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { playedScope, rolePlayMainPath } from '../../logic/role-play/fallback';
import { startRolePlay, stepRolePlay, type RpState } from '../../logic/role-play/reducer';
import { ALL_LESSON_SCOPES } from './helpers/lesson-stages';

/**
 * F-CURR-002 row CM-45 S4, Stage 4 Holidays & Traditions Volume 2, Seollal Visit (`content/episodes/stage-4/rites.v2.json`):
 * the §5.1 and §5.4 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every file,
 * the review-item freeze, the game switches) run over it with every other cell; this file holds what is particular to it:
 * the Seollal visit exchange with Hoya's grandparents (the New Year bow, 세배; the elders' kind words; replies to elders in
 * the polite register, the elders in plain speech), Role Play read-and-tap scenes of 4 turns where every way ends well
 * (§7.1 F6, row CM-35) and whose Tap to Respond fallback plays the main path, a greeting pick by occasion, triples that
 * differ from Volume 1's, a Check rotation of its own, recycling and sourced notes.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const FILE = 'content/episodes/stage-4/rites.v2.json';
const cell: LessonCell = LessonCellSchema.parse(read(FILE));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-4/rites.json'));

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const scenes = cell.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'role-play' ? [[s.ref, s.scene] as const] : [])));
const naturals = (scene: RolePlayScene): string[] =>
  scene.nodes.flatMap((n) => ('replies' in n ? n.replies.filter((r) => r.kind === 'natural').map((r) => r.text.ko) : []));
const lessNaturals = (scene: RolePlayScene): string[] =>
  scene.nodes.flatMap((n) => ('replies' in n ? n.replies.filter((r) => r.kind === 'lessNatural').map((r) => r.text.ko) : []));

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

describe('Stage 4 Holidays & Traditions, Volume 2: Seollal Visit (row CM-45 S4)', () => {
  it('is the second volume of its cell, ready, with three quests stamped after main', () => {
    expect(cell).toMatchObject({ id: 'episode:stage4-rites-v2', stage: 'stage4', theme: 'rites', volume: 2, status: 'ready' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage4-rites-v2-q1', 'quest:stage4-rites-v2-q2', 'quest:stage4-rites-v2-q3']);
    for (const q of cell.quests) expect(q.addedIn, q.id).toBe(20261031);
  });

  it('plays Practice / Apply / Check triples that differ from Volume 1 and from each other, with three different Checks', () => {
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['role-play / cloze-pick / tap-respond', 'tap-respond / role-play / order-it', 'role-play / tap-respond / cloze-pick']);
    for (const t of triples) expect(v1.quests.map(tripleOf)).not.toContain(t);
    expect(new Set(cell.quests.map((q) => scopeOf(q, 'check')?.kind)).size).toBe(3);
  });

  it('every Role Play scene has 4 turns on every way, at most 4 ways, and every way ends on its closing line', () => {
    expect(scenes.map(([ref]) => ref)).toEqual(['minigame:s4-rites-v2-q1-practice', 'minigame:s4-rites-v2-q2-apply', 'minigame:s4-rites-v2-q3-practice']);
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

  it('the cast is Hoya’s grandparents, named by their kinship terms; the learner is never asked about their own family', () => {
    expect(scenes.map(([, scene]) => scene.partner.ko)).toEqual(['할머니', '할아버지', '할머니']);
    const text = JSON.stringify(cell.quests);
    // No second-person family question and no speaking step.
    expect(text).not.toMatch(/your (family|grandma|grandpa|grandmother|grandfather|parents)/i);
    for (const q of cell.quests) for (const s of q.steps) expect(s.minigameKind, `${q.id} ${s.id}`).not.toBe('voice-echo');
  });

  it('Hoya answers his elders in the polite register; the elders’ plain speech is never a right answer for Hoya', () => {
    // Plain-speech endings (해라체 and 반말) that only the grandparents say.
    const plain = /(받아라|해라|지냈다|맛있어|와라|가라|있어라|먹자|지냈니|이야)\.?\??$/;
    for (const [ref, scene] of scenes) {
      for (const ko of naturals(scene)) expect(plain.test(ko), `${ref} natural ${ko}`).toBe(false);
      for (const node of scene.nodes) if ('replies' in node) expect(plain.test(node.line.ko) || node.line.ko.endsWith('?'), `${ref} ${node.id}`).toBe(true);
    }
    // A plain-speech reply to an elder is offered only as a less natural one, with Hoya's reason.
    expect(scenes.some(([, scene]) => lessNaturals(scene).includes('네, 잘 지냈다.'))).toBe(true);
    // Hoya honours Grandpa as the subject with -시- (지내셨어요), taught on Discover and built in the q2 Check.
    const q2Check = scopeOf(cell.quests[1] as LessonQuest, 'check');
    if (q2Check?.kind !== 'order-it') throw new Error('q2 Check is Sentence Builder');
    expect(q2Check.rounds.map((r) => r.sentence.ko)).toContain('할아버지도 잘 지내셨어요?');
  });

  it('after the bow the elder speaks first, and Hoya thanks her and returns the wish (NIKL 「표준 언어 예절」, Folk Museum 세배)', () => {
    const [, first] = scenes[0] ?? [];
    if (first === undefined) throw new Error('q1 has a scene');
    const opening = first.nodes.find((n) => n.id === first.start);
    if (opening === undefined || !('replies' in opening)) throw new Error('the scene opens on a turn');
    expect(opening.line.ko).toBe('새해 복 많이 받아라.');
    expect(opening.replies.filter((r) => r.kind === 'natural').map((r) => r.text.ko)).toEqual(['감사합니다. 할머니도 새해 복 많이 받으세요.', '감사합니다.']);
  });

  it('the greeting pick by occasion: 계세요 for the one who stays, 가세요 for the one who leaves, never the other way round', () => {
    const q3 = cell.quests[2] as LessonQuest;
    const apply = scopeOf(q3, 'apply');
    if (apply?.kind !== 'tap-respond') throw new Error('q3 Apply is Tap to Respond');
    const right = (line: string): string | undefined => apply.turns.find((t) => t.line.ko === line)?.replies.find((r) => r.correct)?.text.ko;
    expect(right('잘 가라.')).toBe('할머니, 안녕히 계세요.');
    expect(right('호야, 잘 가요.')).toBe('선생님, 안녕히 계세요.');
    expect(right('잘 있어라.')).toBe('할머니, 안녕히 가세요.');
    const leaving = apply.turns.find((t) => t.line.ko === '잘 가라.');
    expect(leaving?.replies.find((r) => r.text.ko === '할머니, 안녕히 가세요.')?.correct).toBe(false);
    const q1Check = scopeOf(cell.quests[0] as LessonQuest, 'check');
    if (q1Check?.kind !== 'tap-respond') throw new Error('q1 Check is Tap to Respond');
    // A friend's wish and Grandma's wish take different replies: the elder's own wording is never Hoya's answer.
    expect(q1Check.turns.map((t) => t.speakerEn)).toEqual(['Mina', 'Grandma']);
    for (const t of q1Check.turns) expect(t.replies.find((r) => r.text.ko === '새해 복 많이 받아라.')?.correct ?? false).toBe(false);
  });

  it('recycles Volume 1 and earlier cells: at least 30 in 100 of each quest’s Practice and Check items were taught before', () => {
    const tree = new Map<string, unknown>();
    for (const stage of readdirSync(new URL('../../../../../content/episodes/', import.meta.url))) {
      if (!stage.startsWith('stage-')) continue;
      for (const f of readdirSync(new URL(`../../../../../content/episodes/${stage}/`, import.meta.url))) {
        if (f.endsWith('.json')) tree.set(`content/episodes/${stage}/${f}`, read(`content/episodes/${stage}/${f}`));
      }
    }
    expect(tree.has(FILE)).toBe(true);
    const findings = lintCurriculum(tree, { today: new Date().toISOString().slice(0, 10) }).filter((f) => f.file === FILE && f.severity === 'error');
    expect(findings.map((f) => `${f.rule} ${f.path}: ${f.message}`)).toEqual([]);
    // The cell's own recycled items, by name: Volume 1's New Year exchange and replies, Stage 4's 감사합니다 and 네, 좋아요.
    const asked = cell.quests.flatMap((q) => practiceCheckItems(q as unknown as Parameters<typeof practiceCheckItems>[0]));
    for (const ko of ['호야, 새해 복 많이 받으세요', '고마워요. 미나도 새해 복 많이 받으세요', '네, 잘 지냈어요', '감사합니다', '네, 좋아요']) expect(asked, ko).toContain(ko);
  });

  it('carries three notes, two of them culture notes, each with two sources and an allowlisted one first, accessed 2026-10-31', () => {
    expect(cell.culture.filter((n) => n.kind === 'culture')).toHaveLength(2);
    expect(cell.culture).toHaveLength(3);
    for (const note of cell.culture) {
      const sources = note.sources ?? [];
      expect(sources.length, note.id).toBeGreaterThanOrEqual(2);
      const first = sources[0];
      expect(first && allowlistedInstitution(first.publisher, first.accessed, first.url), note.id).toBeDefined();
      for (const s of sources) expect(s.accessed, note.id).toBe('2026-10-31');
      expect(note.verification?.passes, note.id).toBeGreaterThanOrEqual(3);
    }
    expect(cell.review).toMatchObject({ reviewedBy: 'MAR' });
    // OD-9: the memorial rite is Stage 2's reading word; this cell shows no 차례.
    expect(JSON.stringify(cell.quests)).not.toContain('차례');
  });
});
