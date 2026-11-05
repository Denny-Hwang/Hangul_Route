import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG, StageKeySchema, classPosition, learnerPosition, resolvePreset } from '..';
import { allowlistedInstitution, lintCurriculum, PRODUCE_KINDS, READ_MEANING_KINDS } from '../lesson-lint';
import { rolePlayIssues, rolePlayPaths } from '../role-play-rules';
import { Stage1TableSchema, reviewItemsOf } from '../review-items/build';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, lessonSourcesOfTree, storySourcesOfTree, vocabOfTree } from '../review-items/sources';
import { StableIdSnapshotSchema } from '../review-items/stable-ids';
import { LessonCellSchema, type LessonCell, type LessonQuest, type LessonScope } from '../schemas/lesson';
import { isRolePlayEnd } from '../schemas/role-play';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 row CM-42 S4: Play & Crafts, Stage 4, Volume 2 ("Who Goes First?", section 5.6: inviting a friend to
 * play; rock-paper-scissors, 가위바위보, and who goes first), over the repository's own content. Section 5.1: three
 * quests, Practice, Apply and Check triples that differ from Volume 1's, at least two sourced culture notes, every
 * section 9.3 rule an error from day one; section 7.1 F6: every Role Play way is 4-6 turns and ends well.
 */

const json = (rel: string): unknown => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));
const tree = new Map<string, unknown>();
const walk = (rel: string): void => {
  for (const e of readdirSync(join(REPO_ROOT, rel), { withFileTypes: true })) {
    const child = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(child);
    else if (e.isFile() && e.name.endsWith('.json')) tree.set(child, json(child));
  }
};
for (const dir of ['content/episodes', 'content/stories', 'content/vocab', 'content/packs']) {
  try {
    walk(dir);
  } catch {
    // content/packs may not exist yet
  }
}
for (const rel of [REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE]) tree.set(rel, json(rel));

const FILE = 'content/episodes/stage-4/crafts.v2.json';
const V2: LessonCell = LessonCellSchema.parse(tree.get(FILE));
const V1: LessonCell = LessonCellSchema.parse(tree.get('content/episodes/stage-4/crafts.json'));

const scopeOf = (quest: LessonQuest, kind: 'practice' | 'apply' | 'check'): LessonScope => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  const scope = quest.scopes.find((s) => s.ref === ref);
  if (scope === undefined) throw new Error(`${quest.id} has no ${kind} scope`);
  return scope;
};
const triple = (q: LessonQuest): string => (['practice', 'apply', 'check'] as const).map((k) => scopeOf(q, k).kind).join(' / ');

describe('Play Volume 2, Stage 4 (row CM-42 S4)', () => {
  it('is the second volume of the shipped Playdate Talk cell, three quests, ids with -v2', () => {
    expect([V2.id, V2.volume, V2.stage, V2.theme, V1.status]).toEqual(['episode:stage4-crafts-v2', 2, 'stage4', 'crafts', 'ready']);
    expect(V2.quests.map((q) => q.id)).toEqual(['quest:stage4-crafts-v2-q1', 'quest:stage4-crafts-v2-q2', 'quest:stage4-crafts-v2-q3']);
  });

  it('passes every section 9.3 rule with zero findings, on the day its sources were read', () => {
    const findings = lintCurriculum(tree, { today: '2026-10-30' }).filter((f) => f.file === FILE);
    expect(findings.map((f) => `${f.rule} ${f.severity} ${f.path}: ${f.message}`)).toEqual([]);
  });

  it('plays triples that differ from each other and from every Volume 1 triple of the cell', () => {
    const v1 = new Set(V1.quests.map(triple));
    const v2 = V2.quests.map(triple);
    expect(new Set(v2).size).toBe(v2.length);
    for (const t of v2) expect(v1.has(t), t).toBe(false);
    // Section 7.1: Play's Stage 4 pair is Role Play and Story Order; every quest plays Role Play.
    for (const q of V2.quests) expect([scopeOf(q, 'practice').kind, scopeOf(q, 'apply').kind], q.id).toContain('role-play');
    expect(V2.quests.some((q) => scopeOf(q, 'apply').kind === 'story-order')).toBe(true);
  });

  it('rotates its Checks: three games, each a read-meaning or produce game', () => {
    const checks = V2.quests.map((q) => scopeOf(q, 'check').kind);
    expect(new Set(checks).size).toBe(3);
    for (const k of checks) expect(PRODUCE_KINDS.has(k) || READ_MEANING_KINDS.has(k), k).toBe(true);
  });

  it('carries at least two culture notes, each first citing an allowlisted institution under its name on the access date', () => {
    expect(V2.culture.filter((n) => n.kind === 'culture').length).toBeGreaterThanOrEqual(2);
    for (const note of V2.culture) {
      const first = note.sources?.[0];
      expect(first, note.id).toBeDefined();
      expect(allowlistedInstitution(first!.publisher, first!.accessed, first!.url)?.nameAsOfAccess, note.id).toBe(true);
      expect(note.sources!.length, note.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('frames rock-paper-scissors as a game, never as Korean in origin (section 5.1)', () => {
    for (const note of V2.culture) expect(note.textEn, note.id).not.toMatch(/\b(?:korean (?:game|invention)|from korea|invented|originat)/i);
  });
});

describe('the Role Play scenes of Play Volume 2 (section 7.1 F6)', () => {
  const scenes = V2.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'role-play' ? [[s.ref, s.scene] as const] : [])));

  it('plays one scene in each quest', () => {
    expect(scenes.map(([ref]) => ref)).toEqual(['minigame:s4-crafts-v2-q1-practice', 'minigame:s4-crafts-v2-q2-apply', 'minigame:s4-crafts-v2-q3-practice']);
  });

  for (const [ref, scene] of scenes) {
    it(`${ref}: every way ends at the closing line after 4 turns, with something to nudge on every turn`, () => {
      expect(rolePlayIssues(scene)).toEqual([]);
      const paths = rolePlayPaths(scene);
      const byId = new Map(scene.nodes.map((n) => [n.id, n]));
      for (const path of paths) {
        expect(isRolePlayEnd(byId.get(path[path.length - 1] as string)), path.join(' > ')).toBe(true);
        expect(path.length - 1, path.join(' > ')).toBe(4);
      }
      for (const node of scene.nodes) {
        if (isRolePlayEnd(node)) continue;
        expect(node.replies.filter((r) => r.kind === 'natural').length, node.id).toBeGreaterThanOrEqual(1);
        // A less natural reply is never sent: Hoya gives its reason and the learner taps again (no bad ending).
        for (const r of node.replies.filter((x) => x.kind === 'lessNatural')) expect([r.next, r.whyEn !== undefined], `${node.id}/${r.id}`).toEqual([undefined, true]);
      }
      // The partner is named by role, never by a personal name.
      expect(scene.partner.ko).toBe('친구');
    });
  }
});

describe('a later volume stays off the lecture route (row CM-40, shipped by CM-42 S4)', () => {
  const v2 = new Set(V2.quests.map((q) => q.id));
  const questIds = (blocks: readonly { kind: string; id?: string }[]): string[] => blocks.flatMap((b) => (b.kind === 'quest' && b.id !== undefined ? [b.id] : []));

  it('the catalogue ships it as a later volume of its cell', () => {
    expect(CATALOG.cells.find((c) => c.episodeId === 'episode:stage4-crafts')?.episodeIds).toEqual(['episode:stage4-crafts', 'episode:stage4-crafts-v2']);
  });

  it('no preset of any stage and length plays a Volume 2 quest', () => {
    for (const stage of StageKeySchema.options) {
      for (const minutes of [10, 20, 30]) {
        for (const preset of ['by-stage', 'next-lesson'] as const) {
          const r = resolvePreset(preset, minutes, { catalog: CATALOG, stage, position: { questId: 'quest:stage4-crafts-q3' } });
          for (const id of questIds(r.blocks)) expect(v2.has(id), `${preset} ${stage} ${minutes}: ${id}`).toBe(false);
        }
      }
    }
  });

  it('the learner and class positions never land on a Volume 2 quest', () => {
    expect(learnerPosition(null, ['quest:stage7-crafts-q3'], CATALOG)).toBeNull();
    // After Volume 1's last Stage 4 quest comes the Stage 5 book, not the Volume 2 of the cell.
    expect(learnerPosition(null, ['quest:stage4-crafts-q3'], CATALOG)?.questId).toBe('quest:story-sejong-new-letters-read');
    const journey = { v: 1, here: 'stage4', stages: [{ stage: 'stage4', done: 15, known: 0 }] };
    expect(classPosition([{ journey }] as never, CATALOG)?.questId).not.toMatch(/-v2-/);
  });
});

describe('Play Volume 2, Stage 4: sound changes stay out of Dictation (section 4.5, review fix)', () => {
  const built = reviewItemsOf({
    stage1: Stage1TableSchema.parse(tree.get(REVIEW_STAGE1_FILE)),
    lessons: lessonSourcesOfTree(tree),
    stories: storySourcesOfTree(tree),
    ...vocabOfTree(tree),
    snapshot: StableIdSnapshotSchema.parse(tree.get(REVIEW_SNAPSHOT_FILE)),
  });
  const byId = new Map(built.items.map((i) => [i.id, i]));

  it('할게 is said [할께] (tensification after the -ㄹ ending), so lex:halge is a sound change and never a Dictation', () => {
    const item = byId.get('lex:halge');
    expect(item?.ko).toBe('할게');
    expect(item?.soundChange).toBe(true);
    expect(item?.formats).not.toContain('dictation');
  });

  it('the sentences with 할게 are asked by ear only (hear-pick)', () => {
    for (const id of ['pat:naega-meonjeo-halge', 'exc:naega-meonjeo-halge']) {
      const formats = byId.get(id)?.formats ?? [];
      expect(formats, id).not.toContain('dictation');
    }
  });
});
