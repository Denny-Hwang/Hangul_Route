import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECK_KIND_SHARE_MAX, PRODUCE_KINDS, READ_MEANING_KINDS, SHIPPED_STORY_IDS, lintCurriculum } from '../lesson-lint';
import { askedKo } from '../lesson-lint-items';
import { REALIA_KINDS } from '../schemas/minigame';
import { LessonCellSchema, type LessonCell, type LessonScope } from '../schemas/lesson';
import { checkKindsFor } from '../schemas/quest';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 row CM-3A, Stage 6: the Check rotation re-authoring of the five Stage 6 Volume 1 cells
 * (section 7.1 Check rotation, default S6 Check a realia question; section 5.7 every realia scope has a
 * kind; section 4.2 the retired ids; section 9.3 every rule with no warning for Stage 6).
 */

const STAGE6 = 'content/episodes/stage-6';
const THEMES = ['letters', 'life', 'rites', 'nature', 'crafts'] as const;
const cells: Array<{ file: string; cell: LessonCell }> = THEMES.map((theme) => {
  const file = `${STAGE6}/${theme}.json`;
  return { file, cell: LessonCellSchema.parse(JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8'))) };
});

/** The content tree the validator lints (every lesson cell and shipped story), as `curriculum-lint.test.ts` reads it. */
function contentTree(): Map<string, unknown> {
  const tree = new Map<string, unknown>();
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(REPO_ROOT, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      const json = (): unknown => JSON.parse(readFileSync(join(REPO_ROOT, child), 'utf8'));
      if (entry.isDirectory()) walk(child);
      else if (/^content\/episodes\/stage-[2-467]\/[a-z]+\.json$/.test(child)) tree.set(child, json());
      else if (/^content\/stories\/[^/]+\.json$/.test(child) && SHIPPED_STORY_IDS.has((json() as { id: string }).id)) tree.set(child, json());
    }
  };
  walk('content/episodes');
  walk('content/stories');
  return tree;
}

const stepScope = (quest: LessonCell['quests'][number], kind: string): LessonScope | undefined =>
  quest.scopes.find((s) => s.ref === quest.steps.find((st) => st.kind === kind)?.minigameRef);
const checks = cells.flatMap(({ cell }) => cell.quests.map((q) => stepScope(q, 'check') as LessonScope));

/** The realia kinds row CM-47 adds; of these, Stage 6 Volume 1 uses only the two its re-kinded stand-ins take. */
const CM47_KINDS = ['recipe', 'receipt', 'label', 'forecast', 'calendar', 'timetable', 'map', 'poster'];

describe('Stage 6 Check rotation (F-CURR-002 row CM-3A S6)', () => {
  it('every section 9.3 rule passes for Stage 6 with no finding of any severity', () => {
    const findings = lintCurriculum(contentTree()).filter((f) => f.file.startsWith(`${STAGE6}/`));
    expect(findings.map((f) => `${f.severity} ${f.rule} ${f.file} ${f.path}: ${f.message}`)).toEqual([]);
  });

  it('a Stage 6 Check may be Listen & Pick, Realia Read, Cloze Pick or Type Hangul (Dictation)', () => {
    expect(checkKindsFor('stage6')).toEqual(['listen-pick', 'realia-read', 'cloze-pick', 'type-hangul']);
    for (const scope of checks) expect(checkKindsFor('stage6')).toContain(scope.kind);
  });

  it('no game holds more than 40% of the 15 Checks, and each one reads a meaning or produces', () => {
    expect(checks).toHaveLength(15);
    const counts = new Map<string, number>();
    for (const scope of checks) counts.set(scope.kind, (counts.get(scope.kind) ?? 0) + 1);
    for (const [kind, n] of counts) expect(n / checks.length, kind).toBeLessThanOrEqual(CHECK_KIND_SHARE_MAX);
    expect(Object.fromEntries(counts)).toEqual({ 'realia-read': 6, 'cloze-pick': 5, 'type-hangul': 4 });
    for (const scope of checks) expect(PRODUCE_KINDS.has(scope.kind) || READ_MEANING_KINDS.has(scope.kind), scope.ref).toBe(true);
  });

  it('the default S6 Check is a realia question: Realia Read, or Cloze Pick on a value read from the card', () => {
    const realiaQuestions = checks.filter((s) => s.kind === 'realia-read' || (s.kind === 'cloze-pick' && s.rounds.every((r) => r.gapKind === 'value') && s.realia !== undefined));
    expect(realiaQuestions).toHaveLength(11);
    // A Check reads the quest's own card: the same realia ref as its Practice, so its `rea` item is the quest's.
    for (const { cell } of cells) {
      for (const quest of cell.quests) {
        const check = stepScope(quest, 'check');
        const practice = stepScope(quest, 'practice');
        if (check?.kind !== 'realia-read' && check?.kind !== 'cloze-pick') continue;
        expect(check.realia?.ref, quest.id).toBe(practice?.kind === 'realia-read' ? practice.realia.ref : undefined);
      }
    }
  });

  it('a Dictation Check asks a taught word with no sound change, heard (Type Hangul hear)', () => {
    const dictation = checks.filter((s) => s.kind === 'type-hangul');
    for (const scope of dictation) for (const round of scope.rounds) expect(round.mode, `${scope.ref} ${round.id}`).toBe('hear');
    expect(dictation.flatMap((s) => (s.kind === 'type-hangul' ? s.rounds.map((r) => r.target.ko) : []))).toEqual(['이천 원', '칠천 원', '삼천 원', '천 원', '출발', '도착', '왼쪽', '오른쪽']);
  });

  it('adjacent quests of a cell never share the Practice, Apply and Check triple', () => {
    for (const { cell } of cells) {
      const triples = cell.quests.map((q) => ['practice', 'apply', 'check'].map((k) => stepScope(q, k)?.kind).join(' / '));
      triples.forEach((t, i) => i > 0 && expect(t, `${cell.id} q${i + 1}`).not.toBe(triples[i - 1]));
    }
  });

  it('section 5.7: every Stage 6 realia scope has a kind; the three stand-ins take their CM-47 kinds', () => {
    const realia = cells.flatMap(({ cell }) => cell.quests.flatMap((q) => q.scopes.flatMap((s) => ('realia' in s && s.realia ? [[s.ref, s.realia] as const] : []))));
    expect(realia.length).toBeGreaterThanOrEqual(15);
    for (const [ref, r] of realia) {
      expect(r.kind, `${ref} ${r.ref}`).toBeDefined();
      expect(REALIA_KINDS as readonly string[], ref).toContain(r.kind);
    }
    expect(REALIA_KINDS).toEqual(expect.arrayContaining(CM47_KINDS));
    const byRef = new Map(realia.map(([, r]) => [r.ref, r.kind]));
    // Row CM-47 re-kinds the stand-ins of the CM-3A S6 record: the departure board and the trip plan are timetables,
    // the order slip a receipt; every other Volume 1 realia keeps one of the four G-2 kinds.
    expect(byRef.get('realia:order-food-slip')).toBe('receipt');
    expect(byRef.get('realia:s6-rites-q2-board')).toBe('timetable');
    expect(byRef.get('realia:s6-rites-q3-plan')).toBe('timetable');
    const others = realia.filter(([, r]) => !['realia:order-food-slip', 'realia:s6-rites-q2-board', 'realia:s6-rites-q3-plan'].includes(r.ref));
    for (const [ref, r] of others) expect(CM47_KINDS, `${ref} ${r.ref}`).not.toContain(r.kind);
  });

  it('Role Play where it fits: the market stall Apply of crafts q3, on the turns of its Tap to Respond', () => {
    const crafts = cells.find((c) => c.cell.theme === 'crafts')?.cell;
    const apply = crafts?.quests[2] ? stepScope(crafts.quests[2], 'apply') : undefined;
    expect(apply?.kind).toBe('role-play');
    if (apply?.kind !== 'role-play') return;
    expect(apply.scene.title.ko).toBe('오일장');
    expect(apply.scene.partner.ko).toBe('할머니');
    const main: string[] = [];
    let node = apply.scene.nodes.find((n) => n.id === apply.scene.start);
    while (node && !('end' in node)) {
      const natural = node.replies.find((r) => r.kind === 'natural');
      main.push(`${node.line.ko} -> ${natural?.text.ko}`);
      node = apply.scene.nodes.find((n) => n.id === natural?.next);
    }
    expect(main).toEqual(['이거 사과예요. -> 이거 얼마예요?', '이천 원이에요. -> 사과 세 개 주세요.', '네, 이천 원이에요. -> 네, 여기 있어요.', '이건 덤이에요. -> 감사합니다.']);
  });

  it('section 4.2: the sentences only the old Listen & Pick Checks asked are retired, each a frozen id', () => {
    const snapshot = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/content-schema/src/review-items/items-stable-id.json'), 'utf8')) as {
      ids: Record<string, string>;
      retired: string[];
    };
    const frozen = new Set(Object.values(snapshot.ids));
    const s6 = [
      'pat:eolmana-geollyeoyo',
      'pat:eolmayeyo',
      'pat:han-sigan-geollyeoyo',
      'pat:icheon-wonieyo',
      'pat:jeongsangi-eodiyeyo',
      'pat:oreunjjogeuro-gaseyo',
      'pat:ramyeon-du-gae-juseyo',
      'pat:ramyeon-juseyo',
      'pat:sagwa-han-gae-juseyo',
      'pat:samcheon-wonieyo',
      'pat:uyu-se-gae-juseyo',
    ];
    for (const id of s6) {
      expect(snapshot.retired, id).toContain(id);
      expect(frozen.has(id), id).toBe(true);
    }
  });

  it('the lint reads a Cloze Pick round as the review-item build does: the completed sentence and answer word, a value gap as its card', () => {
    const k = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
    const word = { id: 'w', sentence: k('책을 ___.'), gapKind: 'word', tiles: [k('읽어요'), k('먹어요'), k('마셔요')], answerIndex: 0 };
    const particle = { id: 'p', sentence: k('물___ 마셔요.'), gapKind: 'particle', tiles: [k('을'), k('를'), k('이')], answerIndex: 0 };
    const value = { id: 'v', sentence: k('부채는 ___ 원이에요.'), gapKind: 'value', tiles: [k('오천'), k('천'), k('이천')], answerIndex: 0 };
    expect(askedKo({ kind: 'cloze-pick', rounds: [word] })).toEqual(['책을 읽어요', '읽어요']);
    expect(askedKo({ kind: 'cloze-pick', rounds: [particle] })).toEqual(['물을 마셔요']);
    expect(askedKo({ kind: 'cloze-pick', rounds: [value], realia: { entries: [{ text: k('부채') }] } })).toEqual([]);
    // A round written without its gap kind is a word gap (the schema default).
    expect(askedKo({ rounds: [{ ...word, gapKind: undefined }] })).toEqual(['책을 읽어요', '읽어요']);
  });

  it('the lint reads a Role Play scene by its lines, not its title and partner (the place and the role)', () => {
    const k = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
    const scene = { title: k('오일장'), partner: k('할머니'), start: 't1', nodes: [{ id: 't1', line: k('이거 사과예요.'), replies: [] }] };
    expect(askedKo({ kind: 'role-play', scene })).toEqual(['이거 사과예요']);
  });
});
