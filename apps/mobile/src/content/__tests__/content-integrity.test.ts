import { describe, expect, it } from 'vitest';
import {
  EpisodeSchema,
  QuestSchema,
  StoryCheckSchema,
  type Story,
  type StoryCheck,
} from '@hangul-route/content-schema';
import { minigameScopes, scopeFor } from '../../logic/minigame-config';
import { levelOfQuest, storyIdOfQuest, storyScopeFor } from '../../logic/story/story-ref';
import { readyStory } from '../../logic/story/__tests__/story-fixture';
import { cardById } from '../heritage-cards';
import { episodesAll } from '../episodes';
import { jamoAll } from '../jamo';
import { strokesForJamo, type JamoStrokePoint } from '../jamo-strokes';
import { questById, questsAll } from '../quests';
import { storiesAll, storyById, storyEpisodes, storyQuests } from '../stories';

describe('content integrity', () => {
  it('every quest step minigameRef resolves to a scope of the matching kind', () => {
    for (const q of questsAll) {
      for (const s of q.steps) {
        if (!s.minigameRef) continue;
        const scope = scopeFor(s.minigameRef);
        expect(scope, `${q.id}/${s.id} -> ${s.minigameRef}`).toBeDefined();
        if (s.minigameKind && scope) {
          expect(scope.kind, `${q.id}/${s.id}`).toBe(s.minigameKind);
        }
      }
    }
  });

  it('every episode questId resolves to a quest', () => {
    for (const e of episodesAll) {
      for (const qid of e.questIds) {
        expect(questById(qid), `${e.id} -> ${qid}`).toBeDefined();
      }
    }
  });

  it('every reward card id resolves to a card', () => {
    for (const e of episodesAll) {
      for (const cid of e.rewardCardIds) {
        expect(cardById(cid), `${e.id} -> ${cid}`).toBeDefined();
      }
    }
    for (const q of questsAll) {
      if (q.rewardCardId) {
        expect(cardById(q.rewardCardId), `${q.id} -> ${q.rewardCardId}`).toBeDefined();
      }
    }
  });

  it('build-letter scopes reference real jamo characters', () => {
    const chars = new Set(jamoAll.map((j) => j.char));
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind !== 'build-letter') continue;
      for (const syl of scope.syllables ?? []) {
        for (const ch of syl.jamoChars) {
          expect(chars.has(ch), `${ref} -> ${syl.ko} -> ${ch}`).toBe(true);
        }
      }
    }
  });

  it('selection-style scopes carry enough jamo', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind === 'match-sound' || scope.kind === 'odd-one-out') {
        expect((scope.jamoIds ?? []).length, ref).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('card-based scopes carry enough pairs', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind === 'card-match' || scope.kind === 'culture-quiz') {
        expect((scope.cardPairs ?? []).length, ref).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('tap-respond scopes have dialogue with exactly one correct option per turn', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind !== 'tap-respond') continue;
      expect((scope.dialogue ?? []).length, ref).toBeGreaterThanOrEqual(1);
      for (const turn of scope.dialogue ?? []) {
        expect(turn.options.filter((o) => o.isCorrect).length, `${ref} -> ${turn.npcKo}`).toBe(1);
        expect(turn.options.length, `${ref} -> ${turn.npcKo}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('jamo stroke skeletons', () => {
  /** Shoelace area on screen (y down): > 0 clockwise, < 0 counter-clockwise. */
  const signedArea = (stroke: JamoStrokePoint[]): number =>
    stroke.reduce((sum, a, i) => {
      const b = stroke[(i + 1) % stroke.length]!;
      return sum + (a.x * b.y - b.x * a.y) / 2;
    }, 0);

  // ㅇ is written from the top, counter-clockwise. The Show-me demo walks
  // these points and F-006 compares the child's winding against them, so a
  // clockwise skeleton would teach — and then reward — the wrong way round.
  it.each([
    ['jamo:ieung', 0],
    ['jamo:ieung-batchim', 0],
    ['jamo:hieut', 2],
  ] as const)('%s circle starts at the top and runs counter-clockwise', (jamoId, strokeIdx) => {
    const circle = strokesForJamo(jamoId)?.[strokeIdx];
    expect(circle, jamoId).toBeDefined();
    const pts = circle!;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first).toEqual(last);
    expect(first.y).toBe(Math.min(...pts.map((p) => p.y)));
    expect(signedArea(pts)).toBeLessThan(0);
  });
});

// ---- Story checks and Story Order v2 (F-STORY-003 §3.8) ---------------------------

const SEQUENCE_SLOTS = 4;
const MIN_STORY_QUEST_ROUNDS = 3 + SEQUENCE_SLOTS;
const CAPTION_MAX = 48;

/** Problems with one check: exactly one correct option, resolvable facts, no answer leak. */
function checkProblems(story: Story, check: StoryCheck): string[] {
  const problems: string[] = [];
  const correct = check.options.filter((o) => o.isCorrect);
  if (correct.length !== 1) problems.push(`${check.id}: ${correct.length} correct options`);
  const factIds = new Set(story.facts.map((f) => f.id));
  for (const id of check.factIds) {
    if (!factIds.has(id)) problems.push(`${check.id}: fact ${id} does not exist`);
  }
  const answer = (correct[0]?.en ?? '').toLowerCase();
  if (answer && check.promptEn.toLowerCase().includes(answer)) {
    problems.push(`${check.id}: the prompt contains the answer "${answer}"`);
  }
  return problems;
}

/** Problems with the sequence scenes of every tier: caption length and art (or an explicit artPending). */
function sequenceProblems(story: Story): string[] {
  const problems: string[] = [];
  for (const tier of story.tiers) {
    for (const id of tier.sequenceSceneIds) {
      const scene = tier.scenes.find((sc) => sc.id === id);
      if (!scene) {
        problems.push(`${tier.level}/${id}: sequence scene does not exist`);
        continue;
      }
      if (!scene.captionEn || scene.captionEn.length > CAPTION_MAX) {
        problems.push(`${tier.level}/${id}: captionEn missing or over ${CAPTION_MAX} chars`);
      }
      if (!scene.art && scene.artPending !== true) {
        problems.push(`${tier.level}/${id}: needs art or artPending: true`);
      }
    }
  }
  return problems;
}

/** Rounds a story quest scores at one level: checks + sequence slots + reader checkpoints. */
function storyQuestRounds(story: Story, level: string): number {
  const tier = story.tiers.find((t) => t.level === level);
  return tier ? tier.checks.length + SEQUENCE_SLOTS + tier.checkpoints.length : 0;
}

describe('story content integrity (F-STORY-003 §3.8)', () => {
  it('every story-check / story-sequence minigameRef resolves through storyScopeFor with the same kind', () => {
    for (const q of storyQuests) {
      for (const step of q.steps) {
        if (step.minigameKind !== 'story-check' && step.minigameKind !== 'story-sequence') continue;
        const scope = step.minigameRef ? storyScopeFor(step.minigameRef) : undefined;
        expect(scope, `${q.id}/${step.id}`).toBeDefined();
        expect(scope?.kind, `${q.id}/${step.id}`).toBe(step.minigameKind);
      }
    }
  });

  it('every story quest scores at least 7 rounds', () => {
    for (const q of storyQuests) {
      const story = storyById(storyIdOfQuest(q) ?? '');
      const level = levelOfQuest(q);
      expect(story, q.id).toBeDefined();
      expect(storyQuestRounds(story as Story, level ?? ''), q.id).toBeGreaterThanOrEqual(MIN_STORY_QUEST_ROUNDS);
    }
  });

  it('every check of every shipped story is sound', () => {
    for (const story of storiesAll) {
      for (const tier of story.tiers) {
        for (const check of [...tier.checks, ...tier.checkpoints]) {
          expect(checkProblems(story, check), `${story.id}/${tier.level}`).toEqual([]);
        }
      }
    }
  });

  it('every sequence scene of every shipped story has a short caption and art (or artPending)', () => {
    for (const story of storiesAll) expect(sequenceProblems(story), story.id).toEqual([]);
  });

  it('every legacy storySteps entry with labelKo has a romanization', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      for (const step of scope.storySteps ?? []) {
        if (step.labelKo) expect(step.romanization, `${ref}/${step.id}`).toBeTruthy();
      }
    }
  });

  it('QuestSchema, EpisodeSchema and StoryCheckSchema parse every shipped story quest, episode and check', () => {
    for (const q of storyQuests) expect(() => QuestSchema.parse(q), q.id).not.toThrow();
    for (const e of storyEpisodes) expect(() => EpisodeSchema.parse(e), e.id).not.toThrow();
    for (const story of storiesAll) {
      for (const tier of story.tiers) {
        for (const check of [...tier.checks, ...tier.checkpoints]) {
          expect(() => StoryCheckSchema.parse(check), `${story.id}/${check.id}`).not.toThrow();
        }
      }
    }
  });

  it('EpisodeSchema, with the catalogue rules of F-STORY-005 §3.2, parses every episode in the app', () => {
    for (const e of episodesAll) expect(EpisodeSchema.safeParse(e).error?.issues ?? [], e.id).toEqual([]);
  });
});

describe('story content rules, exercised on the ready fixture story', () => {
  it('a sound story passes every rule', () => {
    const story = readyStory();
    for (const tier of story.tiers) {
      for (const check of [...tier.checks, ...tier.checkpoints]) {
        expect(checkProblems(story, check)).toEqual([]);
      }
      expect(storyQuestRounds(story, tier.level)).toBeGreaterThanOrEqual(MIN_STORY_QUEST_ROUNDS);
    }
    expect(sequenceProblems(story)).toEqual([]);
  });

  it('flags zero or two correct options, an unknown fact and an answer leak', () => {
    const story = readyStory();
    const check = structuredClone(story.tiers[0]!.checks[0]!);
    check.options.forEach((o) => (o.isCorrect = false));
    expect(checkProblems(story, check).join()).toContain('0 correct options');
    check.options.forEach((o) => (o.isCorrect = true));
    expect(checkProblems(story, check).join()).toContain(`${check.options.length} correct options`);
    const unknownFact = { ...structuredClone(story.tiers[0]!.checks[0]!), factIds: ['f999'] };
    expect(checkProblems(story, unknownFact).join()).toContain('f999');
    const leaky = structuredClone(story.tiers[0]!.checks[0]!);
    const right = leaky.options.find((o) => o.isCorrect)!;
    right.en = 'Hangul';
    leaky.promptEn = 'Which day celebrates Hangul?';
    expect(checkProblems(story, leaky).join()).toContain('contains the answer');
  });

  it('flags a long or missing caption, missing art and a missing scene', () => {
    const story = readyStory();
    const tier = story.tiers[0]!;
    const [a, b, c] = tier.sequenceSceneIds;
    tier.scenes.find((s) => s.id === a)!.captionEn = 'x'.repeat(CAPTION_MAX + 1);
    delete tier.scenes.find((s) => s.id === b)!.captionEn;
    const sceneC = tier.scenes.find((s) => s.id === c)!;
    delete sceneC.art;
    delete sceneC.artPending;
    tier.sequenceSceneIds = [a!, b!, c!, 's99'];
    const text = sequenceProblems(story).join('\n');
    expect(text).toContain(`${a}: captionEn missing or over`);
    expect(text).toContain(`${b}: captionEn missing or over`);
    expect(text).toContain(`${c}: needs art or artPending`);
    expect(text).toContain('s99: sequence scene does not exist');
  });

  it('counts checks + 4 slots + checkpoints, and 0 for a level the story lacks', () => {
    const story = readyStory();
    const listen = story.tiers.find((t) => t.level === 'listen')!;
    expect(storyQuestRounds(story, 'listen')).toBe(listen.checks.length + 4 + listen.checkpoints.length);
    expect(storyQuestRounds(story, 'read')).toBe(0);
  });
});
