import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { fallbackScope } from '../../../logic/match-shape/fallback';
import type { ShapeRound } from '../../../logic/reviews/review-rounds';
import { byTestId, hostNodes, press, render, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { PAIR_SOLVED_PAUSE_MS } from '../MatchShapeBoard';
import { MatchShapeGame } from '../MatchShapeGame';
import { MatchShapeStepBody } from '../MatchShapeStepBody';
import { ReadPickGame } from '../ReadPickGame';
import { ShapeRoundView } from '../ShapeRoundView';

/**
 * F-CURR-002 section 7.1 F4 and 12.2, row CM-33 (design/wireframes/minigame/match-shape.md): Match Shape rendered through
 * react-native-web, on the Stage 1 addition's own scopes. An origin round waits for Continue and opens its sources in
 * place, plain text, no link; a pair round is right first try only when every copy is found before a look-alike; a miss
 * is the amber nudge and the round stays open; while `game.match-shape` is off the step is Read Pick; the review round
 * at the produce rung draws the same board.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// A lone letter is said by its name (니은, 비읍), never a carrier syllable (나, 바): the owner's audio report of 2026-10-29.
const audio = vi.hoisted(() => ({
  playJamo: vi.fn((_jamo: unknown, _mode?: 'sound' | 'name') => Promise.resolve('played' as const)),
  stop: vi.fn(),
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));

type Host = MinigameHost & { answers: Array<[string | number, boolean, { itemId?: string } | undefined]>; completes: number };

function host(): Host {
  const h: Host = {
    mode: 'quest',
    answers: [],
    completes: 0,
    answer: (key, correct, meta) => void h.answers.push([key, correct, meta]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

const PLAY = scopeFor('minigame:s1-crafts-q4-play') as MinigameScope;
const APPLY = scopeFor('minigame:s1-crafts-q4-apply') as MinigameScope;

async function draw(element: React.ReactElement, width = 320): Promise<ReactTestRenderer> {
  return render(<LayoutProvider value={layoutClassFor({ width, height: 640 })}>{element}</LayoutProvider>);
}

const tapId = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (node === undefined) throw new Error(`no pressable ${id}`);
  await press(node);
};
const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  for (const [, mode] of audio.playJamo.mock.calls) expect(mode).toBe('name');
  audio.playJamo.mockClear();
});

describe('an origin round (the picture and its sourced line)', () => {
  it('asks among three letters, each named by its letter and sound; the right one waits for Continue', async () => {
    const h = host();
    const r = await draw(<MatchShapeGame scope={PLAY} host={h} />);
    const root = r.root;
    const texts = screenTexts(root);
    expect(texts).toContain('Which letter comes from this shape?');
    expect(texts).toContain('The tongue touches the upper gum.');
    expect(hostNodes(root, (n) => n.props.role === 'button' && typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'])).toEqual(
      expect.arrayContaining(['ㄱ, g or k', 'ㄴ, n', 'ㅁ, m']),
    );
    expect(has(root, 'match-shape-continue')).toBe(false);
    await tapId(root, 'match-shape-tile-jamo:nieun');
    expect(h.answers).toEqual([['ms:origin:nieun', true, undefined]]);
    expect(has(root, 'match-shape-letter')).toBe(true);
    // No auto-advance: the line stays until the learner moves on.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screenTexts(root)).toContain('The tongue touches the upper gum.');
    await tapId(root, 'match-shape-continue');
    expect(screenTexts(r.root)).toContain('The root of the tongue closes the throat.');
  });

  it('a miss is the amber nudge with Hoya, never red; the round stays open and only the first answer is scored', async () => {
    const h = host();
    const r = await draw(<MatchShapeGame scope={PLAY} host={h} />);
    await tapId(r.root, 'match-shape-tile-jamo:giyeok');
    expect(screenTexts(r.root)).toContain('Look at the picture again. Which letter has that shape?');
    await tapId(r.root, 'match-shape-tile-jamo:nieun');
    expect(h.answers).toEqual([['ms:origin:nieun', false, undefined]]);
    expect(has(r.root, 'match-shape-continue')).toBe(true);
  });

  it('"Where this comes from" opens the sources in place, as plain text: no link, no route', async () => {
    const r = await draw(<MatchShapeGame scope={PLAY} host={host()} />);
    expect(has(r.root, 'match-shape-sources')).toBe(false);
    await tapId(r.root, 'match-shape-tile-jamo:nieun');
    await tapId(r.root, 'match-shape-sources');
    const lines = byTestId(r.root, 'match-shape-source').map((n) => screenTexts(n).join(' '));
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).toContain('National Institute of Korean Language');
    expect(lines.join(' ')).toContain('National Hangeul Museum');
    expect(hostNodes(r.root, (n) => n.type === 'a' || typeof n.props.href === 'string')).toEqual([]);
    await tapId(r.root, 'match-shape-sources');
    expect(byTestId(r.root, 'match-shape-source')).toHaveLength(0);
  });
});

describe('a pair round (tap every copy among look-alikes)', () => {
  const toPair = async (h: Host): Promise<ReactTestRenderer> => {
    const r = await draw(<MatchShapeGame scope={PLAY} host={h} />);
    for (const id of ['jamo:nieun', 'jamo:giyeok']) {
      await tapId(r.root, `match-shape-tile-${id}`);
      await tapId(r.root, 'match-shape-continue');
    }
    return r;
  };
  const LAYOUT = 'tlltlt';

  it('names tiles by letter and letter name until found; every copy found first try is right, then the round moves on', async () => {
    const h = host();
    const r = await toPair(h);
    expect(screenTexts(r.root)).toContain('Tap every ㅂ, letter bieup, b or p');
    const names = [...LAYOUT].map((_t, i) => byTestId(r.root, `match-shape-tile-${i}`)[0]?.props['aria-label']);
    expect(names).toEqual(['ㅂ, letter bieup', 'ㅍ, letter pieup', 'ㅍ, letter pieup', 'ㅂ, letter bieup', 'ㅍ, letter pieup', 'ㅂ, letter bieup']);
    for (const i of [0, 3, 5]) await tapId(r.root, `match-shape-tile-${i}`);
    expect(h.answers.at(-1)).toEqual(['ms:pair:bieup', true, { itemId: 'ms:pair:bieup' }]);
    expect(byTestId(r.root, 'match-shape-tile-0')[0]?.props['aria-label']).toBe('ㅂ, letter bieup, b or p, found');
    await act(async () => {
      vi.advanceTimersByTime(PAIR_SOLVED_PAUSE_MS);
    });
    expect(screenTexts(r.root)).toContain('The shape of the mouth.');
  });

  it('a look-alike is the first, missed answer; the difference line follows the nudge', async () => {
    const h = host();
    const r = await toPair(h);
    await tapId(r.root, 'match-shape-tile-1');
    expect(screenTexts(r.root)).toContain('Look at the strokes again.');
    expect(screenTexts(byTestId(r.root, 'match-shape-diff')[0]!).join('')).toContain('stands up, with two tall sides.');
    for (const i of [0, 3, 5]) await tapId(r.root, `match-shape-tile-${i}`);
    expect(h.answers.slice(-1)).toEqual([['ms:pair:bieup', false, { itemId: 'ms:pair:bieup' }]]);
  });
});

describe('the step and the switch', () => {
  it('on: the game; the step completes after its last round', async () => {
    const h = host();
    const r = await draw(<MatchShapeStepBody scope={APPLY} hostFor={() => h} onBack={() => undefined} on />);
    expect(has(r.root, 'match-shape-game')).toBe(true);
    expect(has(r.root, 'read-pick-game')).toBe(false);
  });

  it('off: Read Pick on the same letters, its answers from its own scope, and no picture', async () => {
    const played: MinigameScope[] = [];
    const h = host();
    const r = await draw(<MatchShapeStepBody scope={PLAY} hostFor={(s) => (played.push(s), h)} onBack={() => undefined} on={false} />);
    expect(has(r.root, 'read-pick-game')).toBe(true);
    expect(has(r.root, 'match-shape-art')).toBe(false);
    expect(played.every((s) => s.kind === 'listen-pick' && (s.readPick?.rounds.length ?? 0) === PLAY.matchShape!.rounds.length)).toBe(true);
    expect(screenTexts(r.root)).toContain('Which sound does this letter make?');
  });

  it('Read Pick: the first tap is scored at its letter; a miss nudges, the right sound moves on, the last completes', async () => {
    const h = host();
    const scope = fallbackScope(PLAY);
    const r = await draw(<ReadPickGame scope={scope} host={h} />);
    for (const round of scope.readPick!.rounds) {
      const wrong = round.options.find((o) => o.id !== round.answerId)!;
      await tapId(r.root, `read-pick-option-${wrong.id}`);
      expect(screenTexts(r.root)).toContain('Look at the letter again.');
      await tapId(r.root, `read-pick-option-${round.answerId}`);
      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });
    }
    expect(h.answers.map(([k, c]) => [k, c])).toEqual(scope.readPick!.rounds.map((round) => [round.id, false]));
    expect(h.completes).toBe(1);
    // The right answer says the letter by its name, once a round.
    expect(audio.playJamo).toHaveBeenCalledTimes(scope.readPick!.rounds.length);
  });
});

describe('the review round at the produce rung', () => {
  it('draws the pair board of the item and its look-alike, with the Stage 1 difference line, scored once', async () => {
    const round: ShapeRound = {
      type: 'shape',
      question: { itemId: 'sym:eo', kind: 'sym', rung: 'produce', format: 'match-shape', theme: 'letters', stretch: false, voiceFallback: false },
      target: 'jamo:eo',
      lookAlike: 'jamo:o',
      answer: { ko: { ko: 'ㅓ', romanization: 'eo' } },
    };
    const first: boolean[] = [];
    let solved = 0;
    const r = await draw(<ShapeRoundView round={round} onFirst={(a) => first.push(a.correct)} onSolved={() => (solved += 1)} />);
    expect(has(r.root, 'daily-review-shape')).toBe(true);
    const tiles = byTestId(r.root, 'daily-review-shape').length > 0 ? hostNodes(r.root, (n) => /^daily-review-shape-tile-\d$/.test(String(n.props['data-testid'])) && typeof n.props.onClick === 'function') : [];
    expect(tiles).toHaveLength(6);
    const look = tiles.find((t) => t.props['aria-label'] === 'ㅗ, letter o')!;
    await press(look);
    expect(screenTexts(r.root).join(' ')).toContain('a short stroke points up from a flat line.');
    for (const t of tiles.filter((x) => x.props['aria-label'] === 'ㅓ, letter eo')) await press(t);
    await act(async () => {
      vi.advanceTimersByTime(PAIR_SOLVED_PAUSE_MS);
    });
    expect(first).toEqual([false]);
    expect(solved).toBe(1);
  });
});
