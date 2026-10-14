import { describe, expect, it } from 'vitest';
import {
  CHECK_ROUNDS,
  LESSON_SCOPE_KINDS,
  LESSON_STAGES,
  LessonCellSchema,
  LessonNoteSchema,
  LessonQuestSchema,
  LessonReviewSchema,
  LessonScopeSchema,
  MinigameKindSchema,
  TapRespondTurnSchema,
  VerificationSchema,
  checkKindsFor,
  isLessonSignedOff,
  scopeRoundCount,
  type LessonScope,
} from '../index';
import { kt, lessonCell, lessonQuest, source, verification } from './helpers/lesson-fixtures';

type Json = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function messages(input: unknown): string[] {
  const r = LessonCellSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('LessonCellSchema (F-CURR-001 §3.10)', () => {
  it('parses a valid draft cell and applies defaults', () => {
    const cell = LessonCellSchema.parse(lessonCell());
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.review.notes).toEqual([]);
    expect(cell.quests).toHaveLength(3);
  });

  it('accepts a Stage 7 cell whose Check is Sentence Builder', () => {
    expect(messages(lessonCell('stage7', 'crafts'))).toEqual([]);
  });

  it('holds lesson cells in Stages 2, 3, 4, 6 and 7 only', () => {
    expect(LESSON_STAGES).toEqual(['stage2', 'stage3', 'stage4', 'stage6', 'stage7']);
    expect(messages(lessonCell('stage5', 'letters')).some((m) => m.startsWith('id:'))).toBe(true);
    expect(messages(lessonCell('stage1', 'letters')).some((m) => m.startsWith('id:'))).toBe(true);
  });

  it('is strict: an unknown key is an error', () => {
    expect(messages({ ...lessonCell(), estimatedMinutes: 13 })).toEqual([expect.stringContaining('Unrecognized key')]);
  });

  it('caps the title lengths and needs 3-6 quests', () => {
    expect(messages(lessonCell('stage3', 'letters', { titleEn: 'x'.repeat(29) }))).toHaveLength(1);
    const two = lessonCell();
    two.quests = two.quests.slice(0, 2);
    expect(messages(two)).toEqual([expect.stringMatching(/^quests:/)]);
  });

  it('rejects an id that does not match its stage and theme, and a wrong order', () => {
    expect(messages(lessonCell('stage3', 'letters', { id: 'episode:stage3-life' }))).toEqual([
      'id: a stage3 letters cell has id episode:stage3-letters',
    ]);
    expect(messages(lessonCell('stage3', 'letters', { order: 2 }))).toEqual(['order: a cell in letters has order 1']);
  });

  it('numbers quest ids q1, q2, q3 in cell order', () => {
    const cell = lessonCell();
    cell.quests.reverse();
    expect(messages(cell)).toEqual(
      expect.arrayContaining(['quests.0.id: quest 1 of this cell has id quest:stage3-letters-q1']),
    );
  });

  it('needs the six steps in order', () => {
    const cell = lessonCell() as Json;
    cell.quests[0].steps.splice(5, 1);
    expect(messages(cell)).toEqual([
      'quests.0.steps: a lesson quest has the six steps intro -> discover -> practice -> apply -> check -> reward',
    ]);
  });

  it('keeps the quest rules of QuestSchema (discover before games)', () => {
    const cell = lessonCell() as Json;
    const steps = cell.quests[0].steps;
    [steps[1], steps[2]] = [steps[2], steps[1]];
    expect(messages(cell)).toEqual(
      expect.arrayContaining(['quests.0.steps.1.kind: discover must come before practice, apply and check']),
    );
  });

  it('resolves every minigameRef to a scope of the same kind, once, and every scope is played', () => {
    const missing = lessonCell() as Json;
    missing.quests[0].scopes.splice(1, 1);
    expect(messages(missing)).toEqual([
      'quests.0.steps.3.minigameRef: minigame:s3-letters-q1-apply has no scope in this quest',
    ]);

    const wrongKind = lessonCell() as Json;
    wrongKind.quests[0].steps[3].minigameKind = 'pic-word-match';
    expect(messages(wrongKind)).toEqual(['quests.0.steps.3.minigameKind: the step plays pic-word-match but its scope is listen-pick']);

    const twice = lessonCell() as Json;
    twice.quests[0].steps[3].minigameRef = twice.quests[0].steps[2].minigameRef;
    twice.quests[0].steps[3].minigameKind = 'order-it';
    expect(messages(twice)).toEqual([
      'quests.0.steps.3.minigameRef: minigame:s3-letters-q1-practice is played twice in one quest',
      'quests.0.scopes.1.ref: scope minigame:s3-letters-q1-apply is not played by any step',
    ]);

    const noRef = lessonCell() as Json;
    delete noRef.quests[0].steps[3].minigameRef;
    expect(messages(noRef)).toEqual([
      'quests.0.steps.3.minigameRef: a game step needs a minigameRef',
      'quests.0.scopes.1.ref: scope minigame:s3-letters-q1-apply is not played by any step',
    ]);
  });

  it('names scope refs after their own quest and lists each ref once', () => {
    const foreign = lessonCell() as Json;
    foreign.quests[0].scopes[1].ref = 'minigame:s3-letters-q2-apply';
    foreign.quests[0].steps[3].minigameRef = 'minigame:s3-letters-q2-apply';
    expect(messages(foreign)).toEqual([
      'quests.0.scopes.1.ref: a scope of stage3-letters-q1 has a ref starting minigame:s3-letters-q1-',
    ]);

    const dup = lessonCell() as Json;
    dup.quests[0].scopes.push(clone(dup.quests[0].scopes[1]));
    expect(messages(dup)).toEqual(['quests.0.scopes.3.ref: scope ref minigame:s3-letters-q1-apply is listed twice']);
  });

  it('applies the Check rule: Listen & Pick (Sentence Builder too in stage7), exactly 2 rounds', () => {
    expect(CHECK_ROUNDS).toBe(2);
    expect(checkKindsFor('stage3')).toEqual(['listen-pick']);
    expect(checkKindsFor('stage7')).toEqual(['listen-pick', 'order-it']);

    const s3 = lessonCell() as Json;
    s3.quests[0] = lessonQuest('stage3', 'letters', 1, 'order-it');
    expect(messages(s3)).toEqual(['quests.0.steps.4.minigameKind: a stage3 Check plays listen-pick, not order-it']);

    const three = lessonCell() as Json;
    three.quests[0].scopes[2].rounds.push(clone(three.quests[0].scopes[2].rounds[0]));
    expect(messages(three)).toEqual(['quests.0.steps.4.minigameRef: a Check holds exactly 2 rounds (has 3)']);
  });

  it('refuses speech: voice-echo has no lesson scope and a step naming it fails lesson-no-speaking', () => {
    expect(LESSON_SCOPE_KINDS).not.toContain('voice-echo');
    const cell = lessonCell() as Json;
    cell.quests[0].steps[3].minigameKind = 'voice-echo';
    expect(messages(cell)).toEqual(
      expect.arrayContaining(['quests.0.steps.3.minigameKind: lesson-no-speaking: no lesson step records or asks for speech']),
    );
    const scope = { ref: 'minigame:s3-letters-q1-apply', kind: 'voice-echo', rounds: [] };
    expect(LessonScopeSchema.safeParse(scope).success).toBe(false);
  });

  it('keeps a quest card award inside the cell rewardCardIds (taste cells keep theirs; new cells award none)', () => {
    const cell = lessonCell() as Json;
    cell.quests[0].rewardCardId = 'card:insa';
    expect(messages(cell)).toEqual(["quests.0.rewardCardId: card:insa is not in the cell's rewardCardIds"]);
    cell.rewardCardIds = ['card:insa'];
    expect(messages(cell)).toEqual([]);
  });

  it('keeps a ready cell out until both multi-agent sign-offs are present (lesson-review-unsigned)', () => {
    const ready = lessonCell('stage3', 'letters', { status: 'ready' });
    expect(messages(ready)).toEqual([
      'review: lesson-review-unsigned: a ready cell needs both multi-agent review sign-offs, reviewedBy and reviewedAt',
    ]);
    const signed = { language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR', reviewedAt: '2026-10-14' };
    expect(messages({ ...ready, review: signed })).toEqual([]);
    expect(messages({ ...ready, review: { ...signed, culture: 'draft' } })).toHaveLength(1);
  });

  it('isLessonSignedOff needs both tokens, reviewedBy and reviewedAt', () => {
    const base = LessonReviewSchema.parse({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR', reviewedAt: '2026-10-14' });
    expect(isLessonSignedOff(base)).toBe(true);
    expect(isLessonSignedOff({ ...base, language: 'draft' })).toBe(false);
    expect(isLessonSignedOff({ ...base, reviewedBy: undefined })).toBe(false);
    expect(isLessonSignedOff({ ...base, reviewedAt: undefined })).toBe(false);
  });

  it('needs unique note ids', () => {
    const cell = lessonCell() as Json;
    cell.culture.push(clone(cell.culture[0]));
    expect(messages(cell)).toEqual(['culture: note ids must be unique']);
  });
});

describe('LessonQuestSchema', () => {
  it('is QuestSchema plus inline scopes', () => {
    expect(LessonQuestSchema.safeParse(lessonQuest('stage2', 'rites', 1)).success).toBe(true);
    const { scopes: _scopes, ...noScopes } = lessonQuest('stage2', 'rites', 1);
    expect(LessonQuestSchema.safeParse(noScopes).success).toBe(false);
  });
});

describe('LessonNoteSchema and the reused story shapes (§3.9)', () => {
  it('takes sources in the story SourceSchema shape, or a factRef, never both or neither', () => {
    const note = { id: 'n1', kind: 'culture', textEn: 'A note.', sources: [source], verification };
    expect(LessonNoteSchema.safeParse(note).success).toBe(true);
    const { sources: _s, ...bare } = note;
    expect(LessonNoteSchema.safeParse({ ...bare, factRef: 'story:seollal-new-year#f3' }).success).toBe(true);
    expect(LessonNoteSchema.safeParse(bare).success).toBe(false);
    expect(LessonNoteSchema.safeParse({ ...note, factRef: 'story:seollal-new-year#f3' }).success).toBe(false);
    expect(LessonNoteSchema.safeParse({ ...bare, factRef: 'story:Seollal#3' }).success).toBe(false);
    expect(LessonNoteSchema.safeParse({ ...note, sources: [{ ...source, extra: 1 }] }).success).toBe(false);
  });

  it("adds 'lesson' to the verification scope enum, additively", () => {
    for (const scope of ['story', 'cluster', 'lesson']) {
      expect(VerificationSchema.safeParse({ ...verification, scope }).success).toBe(true);
    }
    expect(VerificationSchema.parse({ passes: 1, checkedAt: '2026-10-13', notes: 'x' }).scope).toBe('story');
    expect(VerificationSchema.safeParse({ ...verification, scope: 'cell' }).success).toBe(false);
  });
});

describe('LessonScopeSchema', () => {
  const ref = 'minigame:s2-rites-q1-practice';
  const scopes: LessonScope[] = [
    LessonScopeSchema.parse({
      ref,
      kind: 'pic-word-match',
      boards: [{ pairs: [{ id: 'a', word: kt('연', 'yeon', 'kite') }, { id: 'b', word: kt('공', 'gong', 'ball') }, { id: 'c', word: kt('윷', 'yut', 'yut sticks') }] }],
    }),
    LessonScopeSchema.parse({ ref, kind: 'build-letter', words: [kt('설날', 'seollal', 'Lunar New Year'), kt('떡국', 'tteokguk', 'rice-cake soup')] }),
    LessonScopeSchema.parse({ ref, kind: 'card-match', pairs: [kt('연', 'yeon', 'kite'), kt('공', 'gong', 'ball'), kt('윷', 'yut', 'yut sticks')] }),
    LessonScopeSchema.parse({
      ref,
      kind: 'tap-respond',
      turns: [
        {
          speakerEn: 'Hoya',
          line: kt('밥 먹었어요?', 'bap meogeosseoyo', 'have you eaten?'),
          replies: [
            { id: 'a', text: kt('네, 먹었어요.', 'ne meogeosseoyo', 'yes, I have'), correct: true },
            { id: 'b', text: kt('저기예요.', 'jeogiyeyo', 'it is over there'), correct: false },
          ],
        },
      ],
    }),
    LessonScopeSchema.parse({
      ref,
      kind: 'story-sequence',
      lines: [
        { id: 'l1', speakerEn: 'Hoya', line: kt('안녕하세요.', 'annyeonghaseyo', 'hello') },
        { id: 'l2', line: kt('이게 뭐예요?', 'ige mwoyeyo', 'what is this?') },
        { id: 'l3', line: kt('책이에요.', 'chaegieyo', 'it is a book') },
      ],
    }),
    LessonScopeSchema.parse({
      ref,
      kind: 'realia-read',
      realia: { ref: 'realia:snack-menu', entries: [{ id: 'e1', text: kt('김밥', 'gimbap', 'gimbap'), value: kt('천 원', 'cheon won', '1,000 won') }], altEn: 'A snack-bar menu board' },
      rounds: [{ id: 'r1', questionEn: 'How much is gimbap?', options: [{ id: 'a', figure: '1,000' }, { id: 'b', figure: '5,000' }], answerId: 'a' }],
    }),
    LessonScopeSchema.parse({ ref, kind: 'type-hangul', rounds: [{ id: 'r1', promptEn: 'Type the dish', target: kt('김밥', 'gimbap', 'gimbap') }] }),
    LessonScopeSchema.parse({ ref, kind: 'trace-word', rounds: [{ id: 'r1', word: kt('호야', 'hoya', 'Hoya') }] }),
    LessonScopeSchema.parse({
      ref,
      kind: 'write-frame',
      rounds: [
        {
          id: 'r1',
          frame: kt('저는 ___을/를 좋아해요', 'jeoneun ___eul/reul joahaeyo', 'I like ___'),
          slots: [{ id: 'what', bank: [kt('사과', 'sagwa', 'apple'), kt('떡', 'tteok', 'rice cake')] }],
          entry: 'type',
        },
      ],
    }),
  ];

  it('counts the rounds each scope plays', () => {
    expect(scopes.map(scopeRoundCount)).toEqual([1, 2, 3, 1, 1, 1, 1, 1, 1]);
  });

  it('covers every kind a lesson plays, and only kinds of MinigameKindSchema', () => {
    expect([...LESSON_SCOPE_KINDS].sort()).toEqual(
      [
        'build-letter',
        'card-match',
        'listen-pick',
        'order-it',
        'pic-word-match',
        'realia-read',
        'story-sequence',
        'tap-respond',
        'trace-word',
        'type-hangul',
        'write-frame',
      ].sort(),
    );
    for (const kind of LESSON_SCOPE_KINDS) expect(MinigameKindSchema.options).toContain(kind);
  });

  it('rejects a ref outside the minigame:s<n>-<theme>-q<k>-<step> grammar', () => {
    expect(LessonScopeSchema.safeParse({ ref: 'minigame:s5-rites-q1-practice', kind: 'card-match', pairs: [] }).success).toBe(false);
    expect(LessonScopeSchema.safeParse({ ref: 'minigame:s2-rites-practice', kind: 'build-letter', words: [kt('연', 'yeon', 'kite')] }).success).toBe(false);
  });
});

describe('TapRespondTurnSchema', () => {
  const line = kt('매워요?', 'maewoyo', 'is it spicy?');
  const reply = (id: string, correct: boolean) => ({ id, text: kt(`답${id}`, `dap${id}`, 'a reply'), correct });

  it('needs exactly one natural reply with unique ids', () => {
    expect(TapRespondTurnSchema.safeParse({ speakerEn: 'Mina', line, replies: [reply('a', true), reply('b', false)] }).success).toBe(true);
    expect(TapRespondTurnSchema.safeParse({ speakerEn: 'Mina', line, replies: [reply('a', true), reply('b', true)] }).success).toBe(false);
    expect(TapRespondTurnSchema.safeParse({ speakerEn: 'Mina', line, replies: [reply('a', true), reply('a', false)] }).success).toBe(false);
  });
});
