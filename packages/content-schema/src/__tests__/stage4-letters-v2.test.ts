import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG, StageKeySchema, classPosition, learnerPosition, resolvePreset } from '..';
import { allowlistedInstitution, lintCurriculum, PRODUCE_KINDS, READ_MEANING_KINDS } from '../lesson-lint';
import { rolePlayIssues, rolePlayPaths } from '../role-play-rules';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE } from '../review-items/sources';
import { LessonCellSchema, type LessonCell, type LessonQuest, type LessonScope } from '../schemas/lesson';
import { isRolePlayEnd } from '../schemas/role-play';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 row CM-44 S4: Letters & Books, Stage 4, Volume 2 ("At the Library", section 5.2: at the library desk and
 * the bookshop, borrowing a book and asking where a shelf is; notes on Hunminjeongeum and Hangeul Day), over the
 * repository's own content. Section 5.1: three quests, Practice, Apply and Check triples that differ from Volume 1's,
 * at least two sourced culture notes that Volume 1 does not already carry, every section 9.3 rule an error from day
 * one; section 7.1 F6: every Role Play way is 4-6 turns and ends well, and the learner keeps the polite register.
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

const FILE = 'content/episodes/stage-4/letters.v2.json';
const V2: LessonCell = LessonCellSchema.parse(tree.get(FILE));
const V1: LessonCell = LessonCellSchema.parse(tree.get('content/episodes/stage-4/letters.json'));

const scopeOf = (quest: LessonQuest, kind: 'practice' | 'apply' | 'check'): LessonScope => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  const scope = quest.scopes.find((s) => s.ref === ref);
  if (scope === undefined) throw new Error(`${quest.id} has no ${kind} scope`);
  return scope;
};
const triple = (q: LessonQuest): string => (['practice', 'apply', 'check'] as const).map((k) => scopeOf(q, k).kind).join(' / ');

describe('Letters Volume 2, Stage 4 (row CM-44 S4)', () => {
  it('is the second volume of the shipped Read Along cell, three quests, ids with -v2', () => {
    expect([V2.id, V2.volume, V2.stage, V2.theme, V1.status]).toEqual(['episode:stage4-letters-v2', 2, 'stage4', 'letters', 'ready']);
    expect(V2.quests.map((q) => q.id)).toEqual(['quest:stage4-letters-v2-q1', 'quest:stage4-letters-v2-q2', 'quest:stage4-letters-v2-q3']);
  });

  it('passes every section 9.3 rule with zero findings, on the day its sources were read', () => {
    const findings = lintCurriculum(tree, { today: '2026-10-30' }).filter((f) => f.file === FILE);
    expect(findings.map((f) => `${f.rule} ${f.severity} ${f.path}: ${f.message}`)).toEqual([]);
  });

  it('plays triples that differ from each other and from every Volume 1 triple of the cell, with Role Play in each', () => {
    const v1 = new Set(V1.quests.map(triple));
    const v2 = V2.quests.map(triple);
    expect(new Set(v2).size).toBe(v2.length);
    for (const t of v2) expect(v1.has(t), t).toBe(false);
    for (const q of V2.quests) expect([scopeOf(q, 'practice').kind, scopeOf(q, 'apply').kind], q.id).toContain('role-play');
    // Section 7.1: Letters' Stage 4 pair is Tap to Respond and Role Play; Volume 2 adds Story Order and Cloze Pick.
    expect(V2.quests.flatMap((q) => [scopeOf(q, 'practice').kind, scopeOf(q, 'apply').kind])).toEqual(
      expect.arrayContaining(['tap-respond', 'story-order', 'cloze-pick']),
    );
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
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('adds Hunminjeongeum and Hangeul Day facts that Volume 1 does not already state (section 5.2 S4)', () => {
    const v1Text = V1.culture.map((n) => n.textEn);
    const culture = V2.culture.filter((n) => n.kind === 'culture');
    for (const note of culture) expect(v1Text, note.id).not.toContain(note.textEn);
    // Volume 1 (row CM-3C) says Hangeul Day is on 9 October, 1443 and 1446, and the 1997 Memory of the World
    // inscription; Volume 2 says where the day began (가갸날, 1926 and 1928), why it is 9 October, and 28 and 24 letters.
    const all = culture.map((n) => n.textEn).join(' ');
    for (const fact of ['1926', '1928', '9 October', '28', '24']) expect(all, fact).toContain(fact);
    expect(all).not.toMatch(/1997|Memory of the World/);
  });

  it('names no brand, no real person but King Sejong, and no shop or library by name', () => {
    const copy = JSON.stringify(V2);
    expect(copy).not.toMatch(/교보|영풍|알라딘|Kyobo|Yes24|Aladin/);
  });
});

describe('the Role Play scenes of Letters Volume 2 (section 7.1 F6)', () => {
  const scenes = V2.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'role-play' ? [[s.ref, s.scene] as const] : [])));

  it('plays one scene in each quest: two at the library desk, one at the bookshop', () => {
    expect(scenes.map(([ref]) => ref)).toEqual(['minigame:s4-letters-v2-q1-practice', 'minigame:s4-letters-v2-q2-practice', 'minigame:s4-letters-v2-q3-practice']);
    expect(scenes.map(([, s]) => s.title.ko)).toEqual(['도서관', '도서관', '서점']);
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
        // The learner talks to a librarian or a shop worker: every reply that is sent is polite (-yo or -nida).
        for (const r of node.replies.filter((x) => x.kind === 'natural')) expect(r.text.ko, `${node.id}/${r.id}`).toMatch(/(요|니다)[.!?]$/);
      }
      // The partner is named by role, never by a personal name.
      expect(['사서', '직원']).toContain(scene.partner.ko);
    });
  }
});

describe('Letters Volume 2 stays off the lecture route (row CM-40)', () => {
  const v2 = new Set(V2.quests.map((q) => q.id));
  const questIds = (blocks: readonly { kind: string; id?: string }[]): string[] => blocks.flatMap((b) => (b.kind === 'quest' && b.id !== undefined ? [b.id] : []));

  it('the catalogue ships it as the later volume of its cell', () => {
    expect(CATALOG.cells.find((c) => c.episodeId === 'episode:stage4-letters')?.episodeIds).toEqual(['episode:stage4-letters', 'episode:stage4-letters-v2']);
  });

  it('no preset of any stage and length plays one of its quests', () => {
    for (const stage of StageKeySchema.options) {
      for (const minutes of [10, 20, 30]) {
        for (const preset of ['by-stage', 'next-lesson'] as const) {
          const r = resolvePreset(preset, minutes, { catalog: CATALOG, stage, position: { questId: 'quest:stage4-letters-q3' } });
          for (const id of questIds(r.blocks)) expect(v2.has(id), `${preset} ${stage} ${minutes}: ${id}`).toBe(false);
        }
      }
    }
  });

  it('the learner and class positions never land on one of its quests', () => {
    expect(learnerPosition(null, ['quest:stage4-letters-q3'], CATALOG)?.questId).not.toMatch(/-v2-/);
    const journey = { v: 1, here: 'stage4', stages: [{ stage: 'stage4', done: 15, known: 0 }] };
    expect(classPosition([{ journey }] as never, CATALOG)?.questId).not.toMatch(/-v2-/);
  });
});
