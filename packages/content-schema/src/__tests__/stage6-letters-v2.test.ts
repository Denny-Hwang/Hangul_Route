import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG, StageKeySchema, checkKindsFor, classPosition, learnerPosition, resolvePreset } from '..';
import { allowlistedInstitution, lintCurriculum } from '../lesson-lint';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE } from '../review-items/sources';
import { LessonCellSchema, clozePickIssues, type LessonCell, type LessonQuest, type LessonScope } from '../schemas/lesson';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 row CM-44 S6: Letters & Books, Stage 6, Volume 2 ("Library Day", section 5.2: a library card, a book
 * cover, a Hangeul Day poster and a subway station board, drawn and generic), over the repository's own content.
 * Section 5.1: three quests, triples that differ from Volume 1's, at least two sourced culture notes, every section 9.3
 * rule an error from day one. Section 7.1: Realia Read with the CM-47 kind `poster`, Cloze Pick on values, and Checks
 * within `checkKindsFor('stage6')` (the CM-3A S6 decision record).
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

const FILE = 'content/episodes/stage-6/letters.v2.json';
const V2: LessonCell = LessonCellSchema.parse(tree.get(FILE));
const V1: LessonCell = LessonCellSchema.parse(tree.get('content/episodes/stage-6/letters.json'));

const scopeOf = (quest: LessonQuest, kind: 'practice' | 'apply' | 'check'): LessonScope => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  const scope = quest.scopes.find((s) => s.ref === ref);
  if (scope === undefined) throw new Error(`${quest.id} has no ${kind} scope`);
  return scope;
};
const triple = (q: LessonQuest): string => (['practice', 'apply', 'check'] as const).map((k) => scopeOf(q, k).kind).join(' / ');
const realiaKinds = (cell: LessonCell): string[] =>
  cell.quests.flatMap((q) => q.scopes.flatMap((s) => ('realia' in s && s.realia?.kind !== undefined ? [s.realia.kind] : [])));

describe('Letters Volume 2, Stage 6 (row CM-44 S6)', () => {
  it('is the second volume of the shipped Letters cell, three quests, ids with -v2', () => {
    expect([V2.id, V2.volume, V2.stage, V2.theme, V2.status, V1.status]).toEqual(['episode:stage6-letters-v2', 2, 'stage6', 'letters', 'ready', 'ready']);
    expect(V2.quests.map((q) => q.id)).toEqual(['quest:stage6-letters-v2-q1', 'quest:stage6-letters-v2-q2', 'quest:stage6-letters-v2-q3']);
  });

  it('passes every section 9.3 rule with zero findings, on the day its sources were read', () => {
    const findings = lintCurriculum(tree, { today: '2026-10-31' }).filter((f) => f.file === FILE);
    expect(findings.map((f) => `${f.rule} ${f.severity} ${f.path}: ${f.message}`)).toEqual([]);
  });

  it('plays triples that differ from each other and from every Volume 1 triple, with Realia Read in each', () => {
    const v1 = new Set(V1.quests.map(triple));
    const v2 = V2.quests.map(triple);
    expect(new Set(v2).size).toBe(v2.length);
    for (const t of v2) expect(v1.has(t), t).toBe(false);
    for (const q of V2.quests) expect(scopeOf(q, 'practice').kind, q.id).toBe('realia-read');
  });

  it('rotates its Checks: three games, each within checkKindsFor(stage6) (the CM-3A S6 decision record)', () => {
    const checks = V2.quests.map((q) => scopeOf(q, 'check').kind);
    expect(new Set(checks).size).toBe(3);
    for (const k of checks) expect(checkKindsFor('stage6'), k).toContain(k);
  });

  it('reads the CM-47 poster beside the shipped ticket kind, on a library card, a book cover, a poster and a station board', () => {
    const kinds = new Set(realiaKinds(V2));
    expect(kinds).toContain('poster');
    expect(kinds).toContain('ticket');
    const refs = new Set(V2.quests.flatMap((q) => q.scopes.flatMap((s) => ('realia' in s && s.realia !== undefined ? [s.realia.ref] : []))));
    expect([...refs].sort()).toEqual(['realia:s6-letters-v2-q1-book', 'realia:s6-letters-v2-q1-card', 'realia:s6-letters-v2-q2-poster', 'realia:s6-letters-v2-q3-board']);
  });

  it('every Cloze Pick gap is a value read from its card, with no clozePickIssues', () => {
    const cloze = V2.quests.flatMap((q) => q.scopes.filter((s): s is Extract<LessonScope, { kind: 'cloze-pick' }> => s.kind === 'cloze-pick'));
    expect(cloze).toHaveLength(3);
    for (const scope of cloze) {
      expect(clozePickIssues(scope), scope.ref).toEqual([]);
      expect(scope.realia, scope.ref).toBeDefined();
      expect(scope.rounds.some((r) => r.gapKind === 'value'), scope.ref).toBe(true);
    }
  });

  it('dictates only words with one spelling and no sound change (도서관, 책)', () => {
    const hear = V2.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'type-hangul' ? s.rounds.filter((r) => r.mode === 'hear').map((r) => r.target.ko) : [])));
    expect(hear).toEqual(['도서관', '책']);
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
    expect(V2.review).toMatchObject({ reviewedBy: 'MAR' });
  });

  it('adds notes that neither Volume 1 nor the Stage 4 Hangeul Day notes carry (the 국경일 law and the days off)', () => {
    const v1Text = V1.culture.map((n) => n.textEn);
    for (const note of V2.culture) expect(v1Text, note.id).not.toContain(note.textEn);
    const all = V2.culture.map((n) => n.textEn).join(' ');
    for (const fact of ['국경일', '2005', '1946', '1991', '2013']) expect(all, fact).toContain(fact);
    // Section 5.2 S4 owns why 9 October and 가갸날 (row CM-44 S4); Stage 4 Volume 1 owns 1443, 1446 and UNESCO.
    expect(all).not.toMatch(/가갸날|1926|1928|1940|Why 9 October|Memory of the World|1997/);
  });

  it('names no brand, operator, publisher or real line on any sheet', () => {
    const copy = JSON.stringify(V2.quests);
    expect(copy).not.toMatch(/코레일|서울교통공사|Korail|Seoul Metro|[0-9]호선|교보|Kyobo|Yes24|알라딘/);
  });
});

describe('Letters Volume 2 of Stage 6 stays off the lecture route (row CM-40)', () => {
  const v2 = new Set(V2.quests.map((q) => q.id));
  const questIds = (blocks: readonly { kind: string; id?: string }[]): string[] => blocks.flatMap((b) => (b.kind === 'quest' && b.id !== undefined ? [b.id] : []));

  it('the catalogue ships it as the later volume of its cell', () => {
    expect(CATALOG.cells.find((c) => c.episodeId === 'episode:stage6-letters')?.episodeIds).toEqual(['episode:stage6-letters', 'episode:stage6-letters-v2']);
  });

  it('no preset of any stage and length plays one of its quests', () => {
    for (const stage of StageKeySchema.options) {
      for (const minutes of [10, 20, 30]) {
        for (const preset of ['by-stage', 'next-lesson'] as const) {
          const r = resolvePreset(preset, minutes, { catalog: CATALOG, stage, position: { questId: 'quest:stage6-letters-q3' } });
          for (const id of questIds(r.blocks)) expect(v2.has(id), `${preset} ${stage} ${minutes}: ${id}`).toBe(false);
        }
      }
    }
  });

  it('the learner and class positions never land on one of its quests', () => {
    expect(learnerPosition(null, ['quest:stage6-letters-q3'], CATALOG)?.questId).not.toMatch(/-v2-/);
    const journey = { v: 1, here: 'stage6', stages: [{ stage: 'stage6', done: 15, known: 0 }] };
    expect(classPosition([{ journey }] as never, CATALOG)?.questId).not.toMatch(/-v2-/);
  });
});
