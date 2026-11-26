import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { OrderItRound, TypeHangulRound } from '@hangul-route/content-schema';
import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { tileId } from '../../../logic/cloze-pick/round';
import { scopeFor } from '../../../logic/minigame-config';
import { validBoards } from '../../../logic/pic-word-flow';
import { playableRealia } from '../../../logic/realia-read-flow';
import { EAT_RICE } from '../../../logic/sentence-builder/__tests__/fixtures';
import { FIXTURE_ROUNDS } from '../../../logic/type-hangul/e2e-rounds';
import { REALIA_FIXTURES } from '../../../navigation/realia-read-e2e-fixture';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, hostNodes, press, render, unmount } from '../../../test-support/render';
import { ClozePickGame } from '../ClozePickGame';
import { ClozePickFallback } from '../cloze-pick-fallback';
import type { HostMode, MinigameHost } from '../host';
import { PicWordMatchGame } from '../PicWordMatchGame';
import { RealiaReadGame } from '../RealiaReadGame';
import { SentenceBuilderGame } from '../SentenceBuilderGame';
import { TapRespondGame } from '../TapRespondGame';
import { TypeHangulGame } from '../TypeHangulGame';

/**
 * AMENDMENTS-STAGE1-DECODING-CHECK section 3.3 (row DC-1c, OD-DC4): the quest Checks on the other games hold the romanization
 * until the question is answered. For each of Type Hangul (the keyboard's Latin line and the picture cue), Cloze Pick, Sentence
 * Builder, Pic-Word Match, Realia Read and Tap Respond: in a Check the held lines keep their room, draw nothing and are off the
 * accessibility tree before the answer (a miss does not end it) and show with it; in practice (`quest`) nothing is held. The
 * screen-reader names keep the romanization. What a sighted learner reads is the text not under an `aria-hidden` ancestor and
 * not invisible: the held lines are exactly the nodes this test cannot read.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));
const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => motion.reduced }));

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

const host = (mode: HostMode): MinigameHost => ({ mode, answer: () => undefined, complete: () => undefined });

/** Whether a host node is off the screen for a sighted learner: hidden from assistive tech, or invisible. */
const off = (node: ReactTestInstance): boolean => node.props['aria-hidden'] === true || JSON.stringify(node.props.style ?? {}).includes('"opacity":0');

/** The words a sighted learner reads in `node`: text not under a held (hidden or invisible) ancestor. */
function visible(node: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string, hidden: boolean): void => {
    if (typeof n === 'string') {
      if (!hidden && n.trim() !== '') out.push(n);
      return;
    }
    const nowHidden = hidden || (typeof n.type === 'string' && off(n));
    for (const child of n.children) walk(child, nowHidden);
  };
  walk(node, false);
  return out;
}
const reads = (node: ReactTestInstance, text: string): boolean => visible(node).some((t) => t.includes(text));
/** The held lines under `node`: invisible text kept for its room (`KoreanText`'s, the keyboard's and this file's). */
const heldLines = (node: ReactTestInstance): ReactTestInstance[] =>
  hostNodes(node, (n) => off(n) && n.children.some((c) => typeof c === 'string' && c.trim() !== ''));
const names = (node: ReactTestInstance): string => hostNodes(node, (n) => typeof n.props['aria-label'] === 'string').map((n) => String(n.props['aria-label'])).join(' | ');

/** The text metrics (`fontSize`, `lineHeight`, `fontStyle`, `fontWeight`) of the host node whose only child is `text`: held (off) or drawn. */
function metricsOf(root: ReactTestInstance, text: string, held: boolean): Record<string, unknown> {
  const node = hostNodes(root, (n) => n.children.length === 1 && n.children[0] === text && off(n) === held)[0];
  if (!node) throw new Error(`no ${held ? 'held' : 'drawn'} line "${text}"`);
  const flat: Record<string, unknown> = {};
  const merge = (style: unknown): void => {
    if (Array.isArray(style)) style.forEach(merge);
    else if (typeof style === 'object' && style !== null) Object.assign(flat, style);
  };
  merge(node.props.style);
  const { fontSize, lineHeight, fontStyle, fontWeight } = flat;
  return { fontSize, lineHeight, fontStyle, fontWeight };
}

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
/** A tap a beat after the last one: a touch inside the board's lock is a bounce (AMENDMENTS-TOUCH KT-D5). */
const tapNode = async (node: ReactTestInstance): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(TAP_LOCK_MS * 2);
  });
  await press(node);
};
const tapId = async (root: ReactTestInstance, id: string): Promise<void> => tapNode(pressable(root, id));

// ---------------------------------------------------------------------------------------------------------------------

describe('Cloze Pick', () => {
  const play = async (keys: Parameters<typeof clozeFixtureScope>[0], mode: HostMode): Promise<ReactTestInstance> => {
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <RomanizationModeOverride mode="always">
          <ClozePickGame scope={clozeFixtureScope(keys)} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    return r.root;
  };
  const RIGHT = tileId('e2e-cloze-word', 0);
  const WRONG = tileId('e2e-cloze-word', 1);

  it('a Check: the sentence line and every tile line wait, a miss keeps them held, the fit shows them all', async () => {
    const root = await play(['word'], 'check');
    const sentence = byTestId(root, 'cloze-pick-sentence')[0]!;
    expect(reads(sentence, 'chaegeul ___.')).toBe(false);
    // The meaning is the input the round reads from and stays; the name keeps the romanization.
    expect(reads(sentence, 'I read a book.')).toBe(true);
    expect(names(sentence)).toContain('chaegeul');
    const tiles = byTestId(root, 'cloze-pick-tiles')[0]!;
    for (const line of ['ilgeoyo', 'meogeoyo', 'masyeoyo']) expect(reads(tiles, line)).toBe(false);
    expect(heldLines(tiles)).toHaveLength(3);
    expect(heldLines(sentence)).toHaveLength(1);
    expect(names(tiles)).toContain('ilgeoyo');

    await tapId(root, `cloze-pick-tile-${WRONG}`);
    expect(reads(byTestId(root, 'cloze-pick-sentence')[0]!, 'chaegeul ___.')).toBe(false);
    expect(reads(byTestId(root, 'cloze-pick-tiles')[0]!, 'meogeoyo')).toBe(false);

    await tapId(root, `cloze-pick-tile-${RIGHT}`);
    expect(reads(byTestId(root, 'cloze-pick-sentence')[0]!, 'chaegeul ilgeoyo.')).toBe(true);
    for (const line of ['ilgeoyo', 'meogeoyo', 'masyeoyo']) expect(reads(byTestId(root, 'cloze-pick-tiles')[0]!, line)).toBe(true);
    expect(heldLines(root)).toHaveLength(0);
  });

  it('a value gap: the price card is held too, and shows with the answer', async () => {
    const root = await play(['value'], 'check');
    const card = byTestId(root, 'cloze-pick-realia')[0]!;
    expect(reads(card, 'sagwa')).toBe(false);
    expect(reads(card, 'samcheon won')).toBe(false);
    expect(reads(card, '사과')).toBe(true);
    expect(heldLines(card).length).toBeGreaterThan(0);
    await tapId(root, `cloze-pick-tile-${tileId('e2e-cloze-value', 0)}`);
    const after = byTestId(root, 'cloze-pick-realia')[0]!;
    expect(reads(after, 'sagwa')).toBe(true);
    expect(heldLines(after)).toHaveLength(0);
  });

  it('the fallback (Listen & Pick on the sentence): its price card is held with the sentence, and shows with the answer', async () => {
    const r = await render(<ClozePickFallback scope={clozeFixtureScope(['value'])} host={host('check')} />);
    mounted.push(r);
    const card = byTestId(r.root, 'cloze-pick-fallback-realia')[0]!;
    expect(reads(card, 'sagwa')).toBe(false);
    expect(reads(card, '사과')).toBe(true);
    expect(heldLines(card).length).toBeGreaterThan(0);
    await tapId(r.root, `listen-pick-option-${tileId('e2e-cloze-value', 0)}`);
    expect(reads(byTestId(r.root, 'cloze-pick-fallback-realia')[0]!, 'sagwa')).toBe(true);
  });

  it('practice: everything shows from the start, nothing is held', async () => {
    const root = await play(['word'], 'quest');
    expect(reads(byTestId(root, 'cloze-pick-sentence')[0]!, 'chaegeul ___.')).toBe(true);
    expect(reads(byTestId(root, 'cloze-pick-tiles')[0]!, 'ilgeoyo')).toBe(true);
    expect(heldLines(root)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe('Type Hangul', () => {
  const play = async (round: keyof typeof FIXTURE_ROUNDS, mode: HostMode, romanizationMode: 'always' | 'tap' = 'always'): Promise<ReactTestInstance> => {
    const list = [FIXTURE_ROUNDS[round] as TypeHangulRound];
    const scope = { kind: 'type-hangul' as const, rounds: 1, typeHangul: { rounds: list } };
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode={romanizationMode}>
          <TypeHangulGame scope={scope} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, nodeType: 1, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }) }) },
    );
    mounted.push(r);
    return r.root;
  };
  const type = async (root: ReactTestInstance, jamo: string): Promise<void> => {
    for (const j of jamo) await tapId(root, `hangul-key-${j}`);
  };

  it("a Check: the keyboard's Latin line is held on every key, the word's romanization waits, a pass shows it", async () => {
    const root = await play('hoya', 'check');
    const key = byTestId(root, 'hangul-key-ㅎ')[0]!;
    // The key still names its sound for a screen reader.
    expect(names(key)).toContain('ㅎ');
    expect(heldLines(key)).toHaveLength(1);
    expect(visible(key)).toEqual(['ㅎ']);
    const prompt = byTestId(root, 'type-hangul-prompt')[0]!;
    expect(reads(prompt, '호야')).toBe(true);
    expect(reads(prompt, 'hoya')).toBe(false);
    expect(heldLines(prompt)).toHaveLength(1);
    expect(names(root)).toContain('hoya');

    await type(root, 'ㅎㅗㅇㅑ');
    await tapId(root, 'type-hangul-done');
    expect(reads(byTestId(root, 'type-hangul-prompt')[0]!, 'hoya')).toBe(true);
  });

  it('a Check with the romanization on "tap": no Show button is offered while the question is open', async () => {
    const root = await play('hoya', 'check', 'tap');
    expect(byTestId(root, 'type-hangul-reveal')).toHaveLength(0);
    expect(reads(byTestId(root, 'type-hangul-prompt')[0]!, 'hoya')).toBe(false);
  });

  it('a picture round in a Check: the cue is held, the picture and its meaning stay (spelling from the picture)', async () => {
    const root = await play('bibimbap', 'check');
    const prompt = byTestId(root, 'type-hangul-prompt')[0]!;
    // The fixture's meaning and romanization read alike ("bibimbap"): one line is held, one is the meaning.
    expect(heldLines(prompt)).toHaveLength(1);
    expect(visible(prompt)).toEqual(['bibimbap']);
    expect(heldLines(byTestId(root, 'hangul-key-ㅂ')[0]!)).toHaveLength(1);
  });

  it('practice: the keyboard line and the word line show', async () => {
    const root = await play('hoya', 'quest');
    expect(visible(byTestId(root, 'hangul-key-ㅎ')[0]!).length).toBe(2);
    expect(reads(byTestId(root, 'type-hangul-prompt')[0]!, 'hoya')).toBe(true);
    expect(heldLines(root)).toHaveLength(0);
  });

  it('a practice picture round keeps its cue', async () => {
    const root = await play('bibimbap', 'quest');
    expect(visible(byTestId(root, 'type-hangul-prompt')[0]!)).toEqual(['bibimbap', 'bibimbap']);
    expect(heldLines(root)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe('Sentence Builder', () => {
  const play = async (mode: HostMode): Promise<ReactTestInstance> => {
    const rounds: OrderItRound[] = [EAT_RICE];
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode="always">
          <SentenceBuilderGame scope={{ kind: 'order-it', rounds: 1, orderIt: { rounds } }} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    return r.root;
  };
  const tile = (root: ReactTestInstance, ko: string): ReactTestInstance => {
    const node = hostNodes(root, (n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('sentence-builder-tile-') && typeof n.props.onClick === 'function').find((n) =>
      reads(n, ko),
    );
    if (!node) throw new Error(`no tile ${ko}`);
    return node;
  };

  it('a Check: no tray tile draws its line, a placed word waits too, the finished sentence shows them', async () => {
    const root = await play('check');
    const tray = byTestId(root, 'sentence-builder-tray')[0]!;
    for (const line of ['babeul', 'meogeoyo', 'mureul']) expect(reads(tray, line)).toBe(false);
    expect(heldLines(tray)).toHaveLength(3);
    expect(names(tray)).toContain('babeul');

    await tapNode(tile(root, '밥을'));
    const line = byTestId(root, 'sentence-builder-line')[0]!;
    expect(reads(line, '밥을')).toBe(true);
    expect(reads(line, 'babeul')).toBe(false);
    expect(names(line)).toContain('babeul');

    await tapNode(tile(root, '먹어요'));
    const done = byTestId(root, 'sentence-builder-line')[0]!;
    expect(reads(done, 'babeul')).toBe(true);
    expect(reads(done, 'meogeoyo')).toBe(true);
    expect(heldLines(done)).toHaveLength(0);
  });

  it('practice: every tile line shows from the start', async () => {
    const root = await play('quest');
    const tray = byTestId(root, 'sentence-builder-tray')[0]!;
    for (const line of ['babeul', 'meogeoyo', 'mureul']) expect(reads(tray, line)).toBe(true);
    expect(heldLines(tray)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe('Pic-Word Match', () => {
  const scope = scopeFor('minigame:s1-life-q1-apply')!;
  const pairs = validBoards(scope)[0]!.pairs;
  const play = async (mode: HostMode): Promise<ReactTestInstance> => {
    const r = await render(
      <RomanizationModeOverride mode="always">
        <PicWordMatchGame scope={scope} host={host(mode)} />
      </RomanizationModeOverride>,
    );
    mounted.push(r);
    return r.root;
  };
  const wordTile = (root: ReactTestInstance, i: number): ReactTestInstance => byTestId(root, `pic-word-word-${pairs[i]!.id}`)[0]!;

  it('a Check: every word waits for its own pair; a selected word and a miss stay held; a right match shows that word only', async () => {
    const root = await play('check');
    for (let i = 0; i < pairs.length; i += 1) {
      expect(reads(wordTile(root, i), pairs[i]!.word.romanization), pairs[i]!.id).toBe(false);
      expect(heldLines(wordTile(root, i)), pairs[i]!.id).toHaveLength(1);
      expect(names(wordTile(root, i))).toContain(pairs[i]!.word.romanization);
    }
    await tapId(root, `pic-word-word-${pairs[0]!.id}`);
    expect(reads(wordTile(root, 0), pairs[0]!.word.romanization)).toBe(false);
    await tapId(root, `pic-word-picture-${pairs[1]!.id}`);
    expect(reads(wordTile(root, 0), pairs[0]!.word.romanization)).toBe(false);
    expect(reads(wordTile(root, 1), pairs[1]!.word.romanization)).toBe(false);

    // The miss keeps the first word selected and flashes the picture; moving the selection to the right word of that picture
    // and picking the picture matches the pair: that pair shows its line, the others stay held.
    await tapId(root, `pic-word-word-${pairs[1]!.id}`);
    await tapId(root, `pic-word-picture-${pairs[1]!.id}`);
    expect(reads(wordTile(root, 1), pairs[1]!.word.romanization)).toBe(true);
    expect(reads(wordTile(root, 0), pairs[0]!.word.romanization)).toBe(false);
    expect(heldLines(wordTile(root, 1))).toHaveLength(0);
  });

  it('practice: every word line shows from the start', async () => {
    const root = await play('quest');
    for (let i = 0; i < pairs.length; i += 1) expect(reads(wordTile(root, i), pairs[i]!.word.romanization), pairs[i]!.id).toBe(true);
    expect(heldLines(root)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe('Realia Read', () => {
  const menu = playableRealia(REALIA_FIXTURES.menu)!;
  const round = menu.rounds[0]!;
  const play = async (mode: HostMode): Promise<ReactTestInstance> => {
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode="always">
          <RealiaReadGame scope={REALIA_FIXTURES.menu} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    return r.root;
  };

  it('a Check: the sheet, the key word and every option wait; a line tap and a miss show nothing; the answer shows them', async () => {
    const root = await play('check');
    const sheet = byTestId(root, 'realia-read-sheet')[0]!;
    expect(reads(sheet, '라면')).toBe(true);
    for (const line of ['ramyeon', 'gimbap', 'samcheon won']) expect(reads(sheet, line), line).toBe(false);
    expect(heldLines(sheet).length).toBeGreaterThan(0);
    // The lines keep their names.
    expect(names(sheet)).toContain('ramyeon');
    const options = byTestId(root, 'realia-read-options')[0]!;
    for (const o of round.options) if (o.text) expect(reads(options, o.text.romanization), o.id).toBe(false);
    expect(heldLines(options)).toHaveLength(round.options.filter((o) => o.text).length);
    if (round.key) expect(reads(byTestId(root, 'realia-read-key')[0]!, round.key.romanization)).toBe(false);

    const wrong = round.options.find((o) => o.id !== round.answerId && o.text)!;
    await tapId(root, `realia-read-option-${wrong.id}`);
    expect(reads(byTestId(root, 'realia-read-options')[0]!, wrong.text!.romanization)).toBe(false);

    await tapId(root, `realia-read-option-${round.answerId}`);
    const answered = round.options.find((o) => o.id === round.answerId)!;
    expect(reads(byTestId(root, 'realia-read-options')[0]!, answered.text!.romanization)).toBe(true);
    expect(reads(byTestId(root, 'realia-read-sheet')[0]!, 'ramyeon')).toBe(true);
  });

  it('practice: the sheet and the options show their lines from the start', async () => {
    const root = await play('quest');
    expect(reads(byTestId(root, 'realia-read-sheet')[0]!, 'ramyeon')).toBe(true);
    for (const o of round.options) if (o.text) expect(reads(byTestId(root, 'realia-read-options')[0]!, o.text.romanization), o.id).toBe(true);
    expect(heldLines(root)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe('Tap Respond (a `hold` boolean, no host)', () => {
  const scope = {
    kind: 'tap-respond' as const,
    dialogue: [
      {
        npcKo: '이름이 뭐예요?',
        npcRomanization: 'ireumi mwoyeyo?',
        npcEn: 'What is your name?',
        options: [
          { ko: '저는 다미예요.', romanization: 'jeoneun damiyeyo.', en: 'I am Dami.', isCorrect: true },
          { ko: '안녕히 가세요.', romanization: 'annyeonghi gaseyo.', en: 'Goodbye.', isCorrect: false },
        ],
      },
    ],
  };
  const play = async (hold: boolean): Promise<ReactTestInstance> => {
    const r = await render(<TapRespondGame scope={scope} onFinish={() => undefined} hold={hold} />);
    mounted.push(r);
    return r.root;
  };

  it('a Check: the NPC line, every reply and every reply meaning wait; the screen-reader names keep the romanization', async () => {
    const root = await play(true);
    const round = byTestId(root, 'tap-respond-round')[0]!;
    expect(reads(round, '이름이 뭐예요?')).toBe(true);
    expect(reads(round, 'ireumi mwoyeyo?')).toBe(false);
    // The NPC line's meaning is the stimulus the replies are chosen from.
    expect(reads(round, 'What is your name?')).toBe(true);
    for (const o of scope.dialogue[0]!.options) {
      const card = byTestId(root, `tap-respond-option-${o.ko}`)[0]!;
      expect(reads(card, o.ko)).toBe(true);
      expect(reads(card, o.romanization), o.ko).toBe(false);
      expect(reads(card, o.en), o.ko).toBe(false);
      expect(names(card)).toContain(o.romanization);
      expect(names(card)).toContain(o.en);
    }
    expect(heldLines(round)).toHaveLength(1);
    // The held lines hold the room the shown ones take: one romanization and one meaning a reply.
    expect(heldLines(byTestId(root, `tap-respond-option-${scope.dialogue[0]!.options[0]!.ko}`)[0]!)).toHaveLength(2);
  });

  it('a miss keeps the turn held; the right reply shows every line', async () => {
    const root = await play(true);
    await tapId(root, 'tap-respond-option-안녕히 가세요.');
    expect(reads(byTestId(root, 'tap-respond-option-안녕히 가세요.')[0]!, 'annyeonghi gaseyo.')).toBe(false);
    expect(reads(byTestId(root, 'tap-respond-round')[0]!, 'ireumi mwoyeyo?')).toBe(false);
    await tapId(root, 'tap-respond-option-저는 다미예요.');
    expect(reads(byTestId(root, 'tap-respond-round')[0]!, 'ireumi mwoyeyo?')).toBe(true);
    for (const o of scope.dialogue[0]!.options) {
      const card = byTestId(root, `tap-respond-option-${o.ko}`)[0]!;
      expect(reads(card, o.romanization), o.ko).toBe(true);
      expect(reads(card, o.en), o.ko).toBe(true);
    }
    expect(heldLines(root)).toHaveLength(0);
  });

  it('practice (no `hold`): every line shows from the start', async () => {
    const root = await play(false);
    expect(reads(byTestId(root, 'tap-respond-round')[0]!, 'ireumi mwoyeyo?')).toBe(true);
    for (const o of scope.dialogue[0]!.options) {
      const card = byTestId(root, `tap-respond-option-${o.ko}`)[0]!;
      expect(reads(card, o.romanization)).toBe(true);
      expect(reads(card, o.en)).toBe(true);
    }
    expect(heldLines(root)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe('a held line takes exactly the room of the line it replaces (same size, leading, style and weight)', () => {
  const cloze = async (mode: HostMode): Promise<ReactTestInstance> => {
    const r = await render(
      <RomanizationModeOverride mode="always">
        <ClozePickGame scope={clozeFixtureScope(['word'])} host={host(mode)} />
      </RomanizationModeOverride>,
    );
    mounted.push(r);
    return r.root;
  };
  const type = async (round: keyof typeof FIXTURE_ROUNDS, mode: HostMode, size = { width: 375, height: 667 }): Promise<ReactTestInstance> => {
    const scope = { kind: 'type-hangul' as const, rounds: 1, typeHangul: { rounds: [FIXTURE_ROUNDS[round] as TypeHangulRound] } };
    const r = await render(
      <LayoutProvider value={layoutClassFor(size)}>
        <RomanizationModeOverride mode="always">
          <TypeHangulGame scope={scope} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, nodeType: 1, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }) }) },
    );
    mounted.push(r);
    return r.root;
  };
  const builder = async (mode: HostMode): Promise<ReactTestInstance> => {
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode="always">
          <SentenceBuilderGame scope={{ kind: 'order-it', rounds: 1, orderIt: { rounds: [EAT_RICE] } }} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    return r.root;
  };
  const tapRespond = async (hold: boolean): Promise<ReactTestInstance> => {
    const scope = {
      kind: 'tap-respond' as const,
      dialogue: [
        {
          npcKo: '이름이 뭐예요?',
          npcRomanization: 'ireumi mwoyeyo?',
          npcEn: 'What is your name?',
          options: [{ ko: '저는 다미예요.', romanization: 'jeoneun damiyeyo.', en: 'I am Dami.', isCorrect: true }],
        },
      ],
    };
    const r = await render(<TapRespondGame scope={scope} onFinish={() => undefined} hold={hold} />);
    mounted.push(r);
    return r.root;
  };

  it('Cloze Pick: the sentence line and a tile line', async () => {
    const held = await cloze('check');
    const drawn = await cloze('quest');
    for (const line of ['chaegeul ___.', 'ilgeoyo']) expect(metricsOf(held, line, true), line).toEqual(metricsOf(drawn, line, false));
  });

  it('Type Hangul: the word line (see; in a compact-height window it is a plain line) and the picture cue', async () => {
    const small = { width: 320, height: 568 };
    expect(metricsOf(await type('hoya', 'check', small), 'hoya', true)).toEqual(metricsOf(await type('hoya', 'quest', small), 'hoya', false));
    expect(metricsOf(await type('hoya', 'check'), 'hoya', true)).toEqual(metricsOf(await type('hoya', 'quest'), 'hoya', false));
    const held = await type('bibimbap', 'check');
    const drawn = await type('bibimbap', 'quest');
    expect(hostNodes(held, (n) => off(n) && n.children[0] === 'bibimbap')).toHaveLength(1);
    const heldCue = hostNodes(held, (n) => off(n) && n.children[0] === 'bibimbap')[0]!;
    const drawnCue = hostNodes(drawn, (n) => !off(n) && n.children[0] === 'bibimbap')[0]!;
    const style = (n: ReactTestInstance): string => JSON.stringify(n.props.style).replace(/"opacity":0,?/, '');
    expect(style(heldCue).includes('lineHeight')).toBe(style(drawnCue).includes('lineHeight'));
  });

  it('Sentence Builder: a tray tile line', async () => {
    const held = await builder('check');
    const drawn = await builder('quest');
    expect(metricsOf(held, 'babeul', true)).toEqual(metricsOf(drawn, 'babeul', false));
  });

  it('Tap Respond: the NPC line', async () => {
    const held = await tapRespond(true);
    const drawn = await tapRespond(false);
    expect(metricsOf(held, 'ireumi mwoyeyo?', true)).toEqual(metricsOf(drawn, 'ireumi mwoyeyo?', false));
  });
});
