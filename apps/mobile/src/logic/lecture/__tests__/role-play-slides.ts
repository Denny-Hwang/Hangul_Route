import { LectureDeckSchema, type LectureDeckInput, type Quest, type RolePlayScene } from '@hangul-route/content-schema';
import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { lectureBundle } from '../content';
import { expandDeck, type LectureBundle, type Slide } from '../deck-builder';

/**
 * Role Play slides for the lecture tests (F-CURR-002 section 8, row CM-35): no shipped quest has a Role Play step
 * yet (the Stage 4 and pack rows author them), so a fixture quest with one apply step plays a fixture scene (the
 * library desk unless given) on the presenter's own English bundle, with `game.role-play` on.
 */
export const ROLE_PLAY_QUEST: Quest = {
  id: 'quest:role-play-fixture',
  titleEn: 'At the library',
  estimatedMinutes: 4,
  steps: [{ id: 's1', kind: 'apply', titleEn: 'Talk at the desk', minigameKind: 'role-play', minigameRef: 'mg:role-play-fixture' }],
  rewardCardId: 'card:book',
};

export function rolePlayBundle(scene: RolePlayScene = LIBRARY_SCENE): LectureBundle {
  const base = lectureBundle('en');
  return {
    ...base,
    scopeFor: (ref) => (ref === 'mg:role-play-fixture' ? { kind: 'role-play', rounds: 4, rolePlay: { scene } } : base.scopeFor(ref)),
    questById: (id) => (id === ROLE_PLAY_QUEST.id ? ROLE_PLAY_QUEST : base.questById(id)),
  };
}

export function rolePlaySlides(over: Partial<LectureDeckInput> = {}, scene?: RolePlayScene): Array<Extract<Slide, { kind: 'role-play' }>> {
  const deck = LectureDeckSchema.parse({
    v: 1,
    id: 'lecture:roleplay1',
    title: 'Role play',
    createdAt: '2026-10-27T09:00:00Z',
    seed: 3,
    blocks: [{ kind: 'quest', id: ROLE_PLAY_QUEST.id }],
    ...over,
  });
  return expandDeck(deck, rolePlayBundle(scene), { canPlayKorean: true }, { rolePlay: true }).slides.filter((s): s is Extract<Slide, { kind: 'role-play' }> => s.kind === 'role-play');
}
