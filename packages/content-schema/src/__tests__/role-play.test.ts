import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  LessonScopeSchema,
  MinigameKindSchema,
  RolePlayReplySchema,
  RolePlaySceneSchema,
  RoundSchema,
  isRolePlayEnd,
  localize,
  rolePlayTurnCount,
  romanize,
  scopeRoundCount,
  translatableFields,
  type RolePlayNode,
  type RolePlayScene,
} from '../index';
import { lintCurriculum } from '../lesson-lint';
import { lessonOccurrences } from '../review-items/extract';
import { ROLE_PLAY_PATHS_MAX, isSoundRolePlayScene, lintRolePlayScopes, rolePlayIssues, rolePlayPaths } from '../role-play-rules';
import { LIBRARY_SCENE } from './fixtures/role-play-scenes';

const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const clone = (): RolePlayScene => structuredClone(LIBRARY_SCENE);
/** The shape's issues, else the graph rules' findings as `<rule>: <message>`. */
const messages = (scene: unknown): string[] => {
  const r = RolePlaySceneSchema.safeParse(scene);
  return r.success ? rolePlayIssues(r.data).map((i) => `${i.rule}: ${i.message}`) : r.error.issues.map((i) => i.message);
};
const turn = (scene: RolePlayScene, id: string) => scene.nodes.find((n) => n.id === id) as Extract<RolePlayNode, { line: unknown }>;

describe('Role Play scene (F-CURR-002 section 7.1 F6, row CM-35)', () => {
  it('is a new kind, added after every shipped one', () => {
    expect(MinigameKindSchema.options.at(-1)).toBe('role-play');
  });

  it('parses the library fixture: 4 turns, two ways through it, each ending at the closing line', () => {
    expect(RolePlaySceneSchema.parse(LIBRARY_SCENE)).toEqual(LIBRARY_SCENE);
    expect(rolePlayIssues(LIBRARY_SCENE)).toEqual([]);
    expect(rolePlayTurnCount(LIBRARY_SCENE)).toBe(4);
    expect(rolePlayPaths(LIBRARY_SCENE)).toEqual([
      ['t1', 't2', 't3a', 't4', 'end'],
      ['t1', 't2', 't3b', 't4', 'end'],
    ]);
  });

  it('every line, reply and title of the fixture is romanized as the repo converter reads it', () => {
    const texts = [LIBRARY_SCENE.title, LIBRARY_SCENE.partner, ...LIBRARY_SCENE.nodes.flatMap((n) => (isRolePlayEnd(n) ? [] : [n.line, ...n.replies.map((r) => r.text)]))];
    for (const t of texts) {
      const r = romanize(t.ko);
      expect(r.unknown, t.ko).toEqual([]);
      expect(t.romanization, t.ko).toBe(r.text);
    }
  });

  it('names the partner by role and carries no speaking or bad-ending copy', () => {
    const copy = JSON.stringify(LIBRARY_SCENE);
    expect(copy).not.toMatch(/\b(say it|speak|microphone|record|wrong|fail\w*|lost|bad)\b/i);
    expect(LIBRARY_SCENE.partner.en).toBe('librarian');
  });

  it('a reply: a natural one has a next node and no why; a less natural one a why and no next', () => {
    const text = kt('네.', 'ne', 'Yes.');
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'natural', next: 't2' }).success).toBe(true);
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'lessNatural', whyEn: 'Try a greeting.' }).success).toBe(true);
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'natural' }).success).toBe(false);
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'natural', next: 't2', whyEn: 'x' }).success).toBe(false);
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'lessNatural' }).success).toBe(false);
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'lessNatural', whyEn: 'x', next: 't2' }).success).toBe(false);
    expect(RolePlayReplySchema.safeParse({ id: 'a', text, kind: 'natural', next: 't2', extra: 1 }).success).toBe(false);
  });

  it('role-play-turn-options: every turn has a natural and a less natural reply', () => {
    const noNudge = clone();
    turn(noNudge, 't1').replies = [turn(noNudge, 't1').replies[0]!, { id: 'hi', text: kt('안녕!', 'annyeong', 'Hi!'), kind: 'natural', next: 't2' }];
    expect(messages(noNudge).join()).toMatch(/role-play-turn-options/);
    const noNatural = clone();
    turn(noNatural, 't4').replies = [turn(noNatural, 't4').replies[1]!, { id: 'x', text: kt('네.', 'ne', 'Yes.'), kind: 'lessNatural', whyEn: 'Try again.' }];
    expect(messages(noNatural).join()).toMatch(/role-play-turn-options/);
  });

  it('role-play-good-endings: a next that names no node, a cycle and a missing end are refused', () => {
    const dangling = clone();
    turn(dangling, 't4').replies[0]!.next = 'gone';
    expect(messages(dangling).join()).toMatch(/role-play-good-endings: gone is not a node/);
    const cycle = clone();
    turn(cycle, 't4').replies[0]!.next = 't1';
    expect(messages(cycle).join()).toMatch(/role-play-good-endings: the way t1 > t2 > t3a > t4 > t1 does not end/);
  });

  it('role-play-even-branches: every way has the same number of turns, 4 to 6', () => {
    const uneven = clone();
    turn(uneven, 't3b').replies[0]!.next = 'end';
    // t4 is still reached through t3a, so only the turn counts differ.
    expect(messages(uneven).join()).toMatch(/role-play-even-branches/);
    const short = clone();
    turn(short, 't3a').replies[0]!.next = 'end';
    turn(short, 't3b').replies[0]!.next = 'end';
    short.nodes = short.nodes.filter((n) => n.id !== 't4');
    expect(messages(short).join()).toMatch(/4 to 6 turns \(has 3\)/);
  });

  it('refuses a node no way reaches, a start that is not a turn, and repeated ids or replies', () => {
    const stray = clone();
    stray.nodes.push({ id: 'spare', end: true, closingEn: 'Bye.' });
    expect(messages(stray).join()).toMatch(/role-play-good-endings: node spare cannot be reached/);
    expect(messages({ ...clone(), start: 'end' }).join()).toMatch(/role-play-good-endings: the scene starts on one of its turns/);
    expect(messages({ ...clone(), start: 'nowhere' }).join()).toMatch(/starts on one of its turns/);
    const twice = clone();
    twice.nodes.push({ ...turn(twice, 't4') });
    expect(messages(twice).join()).toMatch(/node id t4 is used twice/);
    const sameReply = clone();
    const t1 = turn(sameReply, 't1');
    t1.replies[1] = { ...t1.replies[1]!, id: 'hello' };
    expect(messages(sameReply).join()).toMatch(/reply ids must be unique/);
    const sameKo = clone();
    turn(sameKo, 't1').replies[1]!.text = kt('안녕하세요!', 'annyeonghaseyo', 'Hello!');
    expect(messages(sameKo).join()).toMatch(/share the same Korean/);
  });

  it(`refuses more than ${ROLE_PLAY_PATHS_MAX} ways through a scene, so the review can read every one`, () => {
    const wide = clone();
    for (const id of ['t3a', 't3b']) {
      const t = turn(wide, id);
      t.replies.splice(1, 0, { id: 'welcome', text: kt('네, 고맙습니다.', 'ne gomapseumnida', 'Yes, thank you.'), kind: 'natural', next: 't4b' });
    }
    wide.nodes.push({ ...turn(wide, 't4'), id: 't4b' });
    expect(rolePlayPaths(wide)).toHaveLength(4);
    expect(messages(wide)).toEqual([]);
    turn(wide, 't1').replies.splice(1, 0, { id: 'hi', text: kt('안녕하세요.', 'annyeonghaseyo', 'Hello.'), kind: 'natural', next: 't2b' });
    wide.nodes.push({ ...turn(wide, 't2'), id: 't2b' });
    expect(messages(wide).join()).toMatch(/at most 4 ways/);
  });

  it('counts two natural replies that lead to the same line as two ways, so converging choices cannot pass the cap', () => {
    const converging = clone();
    // t1 gains a second natural reply to t2 (2 x 2 = 4 ways), then t4 a second one to the end (8 ways).
    turn(converging, 't1').replies.splice(1, 0, { id: 'hi', text: kt('안녕하세요.', 'annyeonghaseyo', 'Hello.'), kind: 'natural', next: 't2' });
    expect(rolePlayPaths(converging)).toHaveLength(4);
    expect(messages(converging)).toEqual([]);
    turn(converging, 't4').replies.splice(1, 0, { id: 'bye', text: kt('안녕히 계세요.', 'annyeonghi gyeseyo', 'Goodbye.'), kind: 'natural', next: 'end' });
    expect(rolePlayPaths(converging)).toHaveLength(8);
    expect(messages(converging).join()).toMatch(/at most 4 ways/);
  });

  it('rides in RoundSchema and LessonScopeSchema; a lesson scope counts its learner turns', () => {
    expect(RoundSchema.safeParse({ kind: 'role-play', data: LIBRARY_SCENE }).success).toBe(true);
    const scope = LessonScopeSchema.parse({ ref: 'minigame:s4-letters-q1-apply', kind: 'role-play', scene: LIBRARY_SCENE });
    expect(scopeRoundCount(scope)).toBe(4);
    // The schema holds the shape (it rides in the start bundle); the graph rules are the lint's.
    const bad = { ...LIBRARY_SCENE, start: 'end' };
    expect(LessonScopeSchema.safeParse({ ref: 'minigame:s4-letters-q1-apply', kind: 'role-play', scene: bad }).success).toBe(true);
    expect(isSoundRolePlayScene(bad)).toBe(false);
    expect(isSoundRolePlayScene(LIBRARY_SCENE)).toBe(true);
    expect(isSoundRolePlayScene({ ...LIBRARY_SCENE, nodes: [] })).toBe(false);
  });

  it('rolePlayTurnCount is 0 for a scene with no way through it', () => {
    expect(rolePlayTurnCount({ start: 'x', nodes: [] })).toBe(0);
    const loop = clone();
    turn(loop, 't4').replies[0]!.next = 't1';
    expect(rolePlayTurnCount(loop)).toBe(0);
    const dangling = clone();
    turn(dangling, 't4').replies[0]!.next = 'gone';
    expect(rolePlayTurnCount(dangling)).toBe(0);
    expect(rolePlayIssues({ start: 'x', nodes: [] }).map((i) => i.message)).toEqual(['the scene starts on one of its turns']);
  });
});

/**
 * Property (section 7.7, "no bad ending in a Role Play branch"): any graph the schema accepts ends well on every way
 * through it. The graphs are layered (every natural reply goes to the next layer or the end), with random widths,
 * random links, random reply counts and, sometimes, a dangling link, a back link or a missing end, so the generator
 * makes both sound and broken scenes.
 */
const sceneArb = fc
  .record({
    layers: fc.array(fc.constantFrom(1, 1, 1, 2), { minLength: 3, maxLength: 7 }),
    links: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 60, maxLength: 60 }),
    flaw: fc.constantFrom('none', 'none', 'none', 'dangling', 'back', 'noEnd', 'noNudge'),
  })
  .map(({ layers, links, flaw }): RolePlayScene => {
    let li = 0;
    const pick = (n: number): number => (links[li++ % links.length] as number) % n;
    const ids = layers.map((w, l) => Array.from({ length: w }, (_, i) => `l${l}n${i}`));
    const nodes: RolePlayNode[] = [];
    ids.forEach((layer, l) =>
      layer.forEach((id) => {
        const nextLayer = ids[l + 1] ?? ['end'];
        const naturals = pick(3) === 0 ? 2 : 1;
        const replies = Array.from({ length: naturals }, (_, r) => ({
          id: `n${r}`,
          text: kt(`네${'요'.repeat(r)}.`, `ne${'yo'.repeat(r)}`, 'Yes.'),
          kind: 'natural' as const,
          next: nextLayer[pick(nextLayer.length)] as string,
        }));
        const nudge = { id: 'x', text: kt('아니요.', 'aniyo', 'No.'), kind: 'lessNatural' as const, whyEn: 'Try another.' };
        nodes.push({ id, line: kt('뭐예요?', 'mwoyeyo', 'What is it?'), replies: flaw === 'noNudge' && l === 1 ? replies.concat({ ...replies[0]!, id: 'n9', text: kt('응.', 'eung', 'Yeah.') }) : [...replies, nudge] });
      }),
    );
    if (flaw !== 'noEnd') nodes.push({ id: 'end', end: true, closingEn: 'Well done!' });
    const first = nodes[0] as Extract<RolePlayNode, { line: unknown }>;
    if (flaw === 'dangling') first.replies[0]!.next = 'gone';
    if (flaw === 'back' && nodes.length > 2) (nodes[1] as typeof first).replies[0]!.next = 'l0n0';
    return { title: kt('도서관', 'doseogwan', 'At the library'), partner: kt('사서', 'saseo', 'librarian'), start: 'l0n0', nodes };
  });

describe('every branch of an accepted scene ends well (property)', () => {
  it('any scene the schema accepts: every way ends at a closing line, with one turn count of 4 to 6', () => {
    let accepted = 0;
    fc.assert(
      fc.property(sceneArb, (scene) => {
        if (!isSoundRolePlayScene(scene)) return;
        accepted += 1;
        const byId = new Map(scene.nodes.map((n) => [n.id, n]));
        const paths = rolePlayPaths(scene);
        expect(paths.length).toBeGreaterThan(0);
        expect(paths.length).toBeLessThanOrEqual(ROLE_PLAY_PATHS_MAX);
        for (const path of paths) {
          const last = byId.get(path.at(-1) as string);
          expect(isRolePlayEnd(last)).toBe(true);
          expect(path.length - 1).toBe(rolePlayTurnCount(scene));
          for (const id of path.slice(0, -1)) {
            const t = byId.get(id);
            expect(isRolePlayEnd(t)).toBe(false);
            if (!isRolePlayEnd(t)) {
              expect(t?.replies.some((r) => r.kind === 'natural')).toBe(true);
              expect(t?.replies.some((r) => r.kind === 'lessNatural')).toBe(true);
            }
          }
        }
        expect(rolePlayTurnCount(scene)).toBeGreaterThanOrEqual(4);
        expect(rolePlayTurnCount(scene)).toBeLessThanOrEqual(6);
      }),
      { numRuns: 400, seed: 35 },
    );
    expect(accepted).toBeGreaterThan(20);
  });

  it('a flawed scene (a dangling link, a cycle, no end, a turn with nothing to nudge) is never accepted', () => {
    fc.assert(
      fc.property(sceneArb, (scene) => {
        const hasEnd = scene.nodes.some((n) => isRolePlayEnd(n));
        const ids = new Set(scene.nodes.map((n) => n.id));
        const broken =
          !hasEnd ||
          scene.nodes.some((n) => !isRolePlayEnd(n) && (n.replies.some((r) => r.next !== undefined && !ids.has(r.next)) || !n.replies.some((r) => r.kind === 'lessNatural'))) ||
          rolePlayPaths(scene).some((p) => new Set(p).size !== p.length);
        if (broken) expect(isSoundRolePlayScene(scene)).toBe(false);
      }),
      { numRuns: 400, seed: 36 },
    );
  });
});

describe('Role Play content plumbing: review items and overlays', () => {
  it('each turn line with each natural reply is an exc item, glossed at the runtime overlay fields; a less natural reply teaches nothing', () => {
    const ref = 'minigame:s4-letters-q1-apply';
    const body = { quests: [{ id: 'quest:stage4-letters-q1', steps: [{ id: 's4', kind: 'apply', minigameRef: ref }], scopes: [{ ref, kind: 'role-play', scene: LIBRARY_SCENE }] }] };
    const occs = lessonOccurrences({ file: 'content/episodes/stage-4/letters.json', body, cellId: 'episode:stage4-letters', stage: 4, home: 'letters', volume: 1 }, []);
    expect(occs.map((o) => [o.kind, o.ko, o.reply?.ko, o.glossKey, o.reply?.glossKey])).toEqual([
      ['exc', '안녕하세요!', '안녕하세요!', `${ref}#rolePlay.scene.nodes.t1.line.gloss`, `${ref}#rolePlay.scene.nodes.t1.replies.hello.text.gloss`],
      ['exc', '무슨 책을 찾아요?', '동화책을 찾아요.', `${ref}#rolePlay.scene.nodes.t2.line.gloss`, `${ref}#rolePlay.scene.nodes.t2.replies.storybook.text.gloss`],
      ['exc', '무슨 책을 찾아요?', '한글 책을 찾아요.', `${ref}#rolePlay.scene.nodes.t2.line.gloss`, `${ref}#rolePlay.scene.nodes.t2.replies.hangeul.text.gloss`],
      ['exc', '동화책은 여기 있어요.', '감사합니다!', `${ref}#rolePlay.scene.nodes.t3a.line.gloss`, `${ref}#rolePlay.scene.nodes.t3a.replies.thanks.text.gloss`],
      ['exc', '한글 책은 여기 있어요.', '감사합니다!', `${ref}#rolePlay.scene.nodes.t3b.line.gloss`, `${ref}#rolePlay.scene.nodes.t3b.replies.thanks.text.gloss`],
      ['exc', '또 오세요!', '안녕히 계세요!', `${ref}#rolePlay.scene.nodes.t4.line.gloss`, `${ref}#rolePlay.scene.nodes.t4.replies.stay.text.gloss`],
    ]);
    // A scope with no scene asks nothing.
    const empty = { quests: [{ id: 'q', steps: [{ id: 's', kind: 'apply', minigameRef: ref }], scopes: [{ ref, kind: 'role-play' }] }] };
    expect(lessonOccurrences({ file: 'f', body: empty, cellId: 'episode:stage4-letters', stage: 4, home: 'letters', volume: 1 }, [])).toEqual([]);
  });

  it('every translatable field of the runtime scope has an overlay path, and localize lands each one', () => {
    const runtime = { kind: 'role-play', rounds: 4, rolePlay: { scene: LIBRARY_SCENE } };
    const fields = translatableFields('minigame:s4-letters-q1-apply', runtime).map((f) => f.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'rolePlay.scene.title.gloss',
        'rolePlay.scene.partner.gloss',
        'rolePlay.scene.nodes.t2.line.gloss',
        'rolePlay.scene.nodes.t2.replies.fine.text.gloss',
        'rolePlay.scene.nodes.t2.replies.fine.why',
        'rolePlay.scene.nodes.end.closing',
      ]),
    );
    // Title, partner, 5 lines, 11 replies, 5 why lines and the closing line.
    expect(fields).toHaveLength(2 + 5 + 11 + 5 + 1);
    const es = localize(runtime, 'minigame:s4-letters-q1-apply', 'es', {
      es: { 'minigame:s4-letters-q1-apply': { 'rolePlay.scene.partner.gloss': 'bibliotecario', 'rolePlay.scene.nodes.t4.replies.go.why': 'Te vas tú.', 'rolePlay.scene.nodes.end.closing': '¡Encontraste tu libro!' } },
      ko: {},
    });
    expect(es.rolePlay.scene.partner.en).toBe('bibliotecario');
    expect(turn(es.rolePlay.scene, 't4').replies[1]?.whyEn).toBe('Te vas tú.');
    expect(es.rolePlay.scene.nodes.find((n) => n.id === 'end')).toEqual({ id: 'end', end: true, closingEn: '¡Encontraste tu libro!' });
    expect(LIBRARY_SCENE.partner.en).toBe('librarian');
  });
});

describe('the Role Play graph rules in the content lint (row CM-35)', () => {
  const ref = 'minigame:s4-letters-q1-apply';
  const broken = (): RolePlayScene => {
    const b = clone();
    turn(b, 't3b').replies[0]!.next = 'end';
    return b;
  };
  const findings = (quests: unknown, shapeErrors?: boolean): string[] => {
    const out: string[] = [];
    lintRolePlayScopes(quests, (rule, path, message) => out.push(`${rule} ${path}: ${message}`), shapeErrors);
    return out;
  };

  it('names each finding by its rule and its path in the file; a sound scene and other scopes have none', () => {
    expect(findings([{ scopes: [{ ref, kind: 'role-play', scene: LIBRARY_SCENE }, { ref, kind: 'tap-respond', turns: [] }] }])).toEqual([]);
    expect(findings([{ scopes: [] }, { scopes: [{ ref, kind: 'role-play', scene: broken() }] }])).toEqual([
      'role-play-even-branches quests[1].scopes[0].scene.nodes: every way through the scene has the same number of turns',
      'role-play-even-branches quests[1].scopes[0].scene.nodes: a way through the scene has 4 to 6 turns (has 3)',
    ]);
    expect(findings('not quests')).toEqual([]);
  });

  it('a scene that is not the shape: one lesson-schema finding, unless the cell schema already reports it', () => {
    expect(findings([{ scopes: [{ ref, kind: 'role-play', scene: { start: 't1' } }] }])).toEqual([expect.stringMatching(/^lesson-schema quests\[0\]\.scopes\[0\]\.scene\.title: not a Role Play scene/)]);
    expect(findings([{ scopes: [{ ref, kind: 'role-play' }] }], false)).toEqual([]);
  });

  it('lintCurriculum: a Volume 2 cell with a scene that ends badly is an error', () => {
    const body = {
      id: 'episode:stage4-letters',
      stage: 'stage4',
      volume: 2,
      status: 'ready',
      quests: [{ id: 'quest:stage4-letters-q1', steps: [], scopes: [{ ref, kind: 'role-play', scene: broken() }] }],
      culture: [],
    };
    const tree = new Map<string, unknown>([['content/episodes/stage-4/letters.v2.json', body]]);
    const mine = lintCurriculum(tree, { today: '2026-10-23' }).filter((f) => f.rule.startsWith('role-play-'));
    expect(mine.map((f) => [f.rule, f.severity, f.path])).toEqual([
      ['role-play-even-branches', 'error', 'quests[0].scopes[0].scene.nodes'],
      ['role-play-even-branches', 'error', 'quests[0].scopes[0].scene.nodes'],
    ]);
  });
});
