import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { describe, expect, it } from 'vitest';
import { ALL_LESSON_SCOPES } from '../../../content/__tests__/helpers/lesson-stages';
import { minigameScopes, type MinigameScope } from '../../minigame-config';
import { PLAYABLE_KINDS } from '../../minigame-renderers';
import { playedScope, rolePlayMainPath, rolePlayToTapRespond } from '../fallback';

const fixtureScope: MinigameScope = { kind: 'role-play', rounds: 4, rolePlay: { scene: LIBRARY_SCENE } };

describe('Role Play fallback: Tap to Respond on the same turns (sections 7.1 F6 and 12.2, row CM-35)', () => {
  it('follows the main path: each turn with its first natural reply, to the end', () => {
    expect(rolePlayMainPath(LIBRARY_SCENE).map((t) => t.id)).toEqual(['t1', 't2', 't3a', 't4']);
  });

  it('each turn: the line, the first natural reply as the one right answer, the less natural replies as the others', () => {
    const turns = rolePlayToTapRespond(LIBRARY_SCENE);
    expect(turns.map((t) => [t.npcKo, t.options.map((o) => [o.ko, o.isCorrect])])).toEqual([
      ['안녕하세요!', [['안녕하세요!', true], ['잘 먹겠습니다!', false]]],
      // The second natural reply (한글 책을 찾아요.) is left out, so the turn keeps one right answer.
      ['무슨 책을 찾아요?', [['동화책을 찾아요.', true], ['괜찮아요.', false]]],
      ['동화책은 여기 있어요.', [['감사합니다!', true], ['미안합니다.', false]]],
      ['또 오세요!', [['안녕히 계세요!', true], ['안녕히 가세요!', false]]],
    ]);
    expect(turns[0]).toMatchObject({ npcRomanization: 'annyeonghaseyo', npcEn: 'Hello!' });
    expect(turns[0]?.options[0]).toEqual({ ko: '안녕하세요!', romanization: 'annyeonghaseyo', en: 'Hello!', isCorrect: true });
  });

  it('keeps a line or reply recording and spoken form, so the fallback is heard as the game would be', () => {
    const scene = structuredClone(LIBRARY_SCENE);
    const t1 = scene.nodes[0]!;
    if (!('line' in t1)) throw new Error('t1 is a turn');
    t1.line = { ...t1.line, spokenKo: '안녕하세요', audioRef: 'audio/dialogue/annyeonghaseyo.mp3' };
    t1.replies[0] = { ...t1.replies[0]!, text: { ...t1.replies[0]!.text, audioRef: 'audio/dialogue/hello.mp3' } };
    const [turn] = rolePlayToTapRespond(scene);
    expect(turn).toMatchObject({ npcSpokenKo: '안녕하세요', npcAudioRef: 'audio/dialogue/annyeonghaseyo.mp3' });
    expect(turn?.options[0]?.audioRef).toBe('audio/dialogue/hello.mp3');
  });

  it('stops at a node met twice or missing, so a broken scene never loops', () => {
    const loop = structuredClone(LIBRARY_SCENE);
    const t1 = loop.nodes[0]!;
    if ('replies' in t1) t1.replies[0]!.next = 't1';
    expect(rolePlayMainPath(loop).map((t) => t.id)).toEqual(['t1']);
    expect(rolePlayMainPath({ ...LIBRARY_SCENE, start: 'gone' })).toEqual([]);
  });

  it('playedScope: on, the role-play scope as it is; off, the Tap to Respond scope, so telemetry names the kind shown', () => {
    expect(playedScope(fixtureScope, true)).toBe(fixtureScope);
    const off = playedScope(fixtureScope, false);
    expect(off.kind).toBe('tap-respond');
    expect(off.rounds).toBe(4);
    expect(off.dialogue).toEqual(rolePlayToTapRespond(LIBRARY_SCENE));
    expect(playedScope({ kind: 'role-play' }, false)).toEqual({ kind: 'tap-respond', rounds: 0, dialogue: [] });
  });

  it('with game.role-play off, every quest step (Stage 1, every lesson cell and a role-play step) plays a shipped game', () => {
    const all: Array<[string, MinigameScope]> = [...Object.entries(minigameScopes), ...Object.entries(ALL_LESSON_SCOPES), ['minigame:s4-letters-q1-apply', fixtureScope]];
    expect(all.length).toBeGreaterThan(100);
    for (const [ref, scope] of all) {
      const played = playedScope(scope, false);
      expect(played.kind, ref).not.toBe('role-play');
      expect(PLAYABLE_KINDS.has(played.kind) || played.kind === 'voice-echo', ref).toBe(true);
      if (scope.kind !== 'role-play') expect(played, ref).toBe(scope);
      for (const turn of played.kind === 'tap-respond' ? (played.dialogue ?? []) : []) {
        expect(turn.options.length, ref).toBeGreaterThanOrEqual(2);
        expect(turn.options.filter((o) => o.isCorrect), ref).toHaveLength(1);
      }
    }
  });
});
