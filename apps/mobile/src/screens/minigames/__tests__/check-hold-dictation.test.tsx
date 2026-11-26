import type { TypeHangulRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, hostNodes, press, render, unmount } from '../../../test-support/render';
import * as kit from '../dictation-chunk';
import type { AnswerMeta, HostMode, MinigameHost } from '../host';
import { TypeHangulGame } from '../TypeHangulGame';

/**
 * AMENDMENTS-STAGE1-DECODING-CHECK sections 3.1 and 3.2 (row DC-1c) on Type Hangul's Dictation round in a quest Check:
 * "Show how it sounds" is not offered (a held line cannot be revealed by a tap), and a heard round that cannot be heard
 * (sound off, no Korean voice, two failed plays) stands in for the sound with the romanization only, never the Hangul, and
 * is not marked hinted. Practice is unchanged: the Hangul shows and the hint is there.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const EN = getMessages('en');
const AUDIO = EN.learner.audio;
const SHOW_SOUND = EN.learner.minigame.typeHangul.hear.showSound;

const APPLE: TypeHangulRound = { id: 'd-apple', promptEn: 'Type the word you hear.', mode: 'hear', target: { ko: '사과', romanization: 'sagwa', en: 'apple' } };

type Answer = [string | number, boolean, AnswerMeta | undefined];
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useAudioStore.setState({ muted: false, showLetters: false });
});

async function play(mode: HostMode, size = { width: 768, height: 1024 }): Promise<{ r: ReactTestRenderer; answers: Answer[] }> {
  const answers: Answer[] = [];
  const host: MinigameHost = { mode, answer: (k, c, meta) => void answers.push([k, c, meta]), complete: () => undefined };
  const r = await render(
    <LayoutProvider value={layoutClassFor(size)}>
      <RomanizationModeOverride mode="always">
        <TypeHangulGame scope={{ kind: 'type-hangul', rounds: 1, typeHangul: { rounds: [APPLE] } }} host={host} hear={kit} />
      </RomanizationModeOverride>
    </LayoutProvider>,
    { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) },
  );
  mounted.push(r);
  await settle();
  return { r, answers };
}
const settle = async (ms = 30): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const typeKeys = async (r: ReactTestRenderer, jamo: string): Promise<void> => {
  for (const j of jamo) await tap(r, `hangul-key-${j}`);
};

const off = (node: ReactTestInstance): boolean => node.props['aria-hidden'] === true || JSON.stringify(node.props.style ?? {}).includes('"opacity":0');
/** The words a sighted learner reads: text not under a held (hidden or invisible) ancestor. */
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
const reads = (r: ReactTestRenderer, text: string): boolean => visible(r.root).some((t) => t.includes(text));
const heldLines = (node: ReactTestInstance): number => hostNodes(node, (n) => off(n) && n.children.some((c) => typeof c === 'string' && c.trim() !== '')).length;
const keyLine = (r: ReactTestRenderer): string[] => visible(byTestId(r.root, 'hangul-key-ㅅ')[0]!);

describe('the Dictation hint in a Check', () => {
  it.each([
    ['a roomy window', { width: 768, height: 1024 }],
    ['a compact-height window', { width: 360, height: 500 }],
  ])('%s: "Show how it sounds" is not offered in a Check, and is in practice', async (_name, size) => {
    const check = await play('check', size);
    expect(reads(check.r, SHOW_SOUND)).toBe(false);
    expect(byTestId(check.r.root, 'dictation-prompt-show-sound')).toHaveLength(0);
    expect(reads(check.r, 'sagwa')).toBe(false);
    const practice = await play('quest', size);
    expect(reads(practice.r, SHOW_SOUND)).toBe(true);
  });
});

describe('a heard round that cannot be heard, in a Check: the romanization stands in, never the Hangul (section 3.2)', () => {
  const standsIn = async (r: ReactTestRenderer): Promise<void> => {
    // The word's romanization is the sound to find; its Hangul is the answer to type and is not drawn.
    expect(reads(r, 'sagwa')).toBe(true);
    expect(reads(r, '사과')).toBe(false);
    // The meaning stays; the keyboard's Latin line is held; there is no Show the letters.
    expect(reads(r, 'apple')).toBe(true);
    expect(keyLine(r)).toEqual(['ㅅ']);
    expect(byTestId(r.root, 'cant-hear')).toHaveLength(0);
  };

  it('sound off', async () => {
    useAudioStore.setState({ muted: true });
    const { r, answers } = await play('check');
    await standsIn(r);
    expect(reads(r, AUDIO.soundIsOff)).toBe(true);
    // A right answer is as scored, and never marked hinted.
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('no Korean voice', async () => {
    rig.current = createAudioRig({ voices: [] });
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    const { r, answers } = await play('check');
    await standsIn(r);
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('two failed plays', async () => {
    const { r, answers } = await play('check');
    expect(reads(r, '사과')).toBe(false);
    for (let i = 0; i < 2; i += 1) {
      rig.current!.synth.failNext('synthesis-failed');
      await tap(r, 'dictation-prompt-speaker');
      await settle();
    }
    await standsIn(r);
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(answers).toEqual([[0, true, { itemId: 'd-apple' }]]);
  });

  it('once the round is passed the Korean shows with its romanization, as the answer', async () => {
    useAudioStore.setState({ muted: true });
    const { r } = await play('check');
    await typeKeys(r, 'ㅅㅏㄱㅗㅏ');
    await tap(r, 'type-hangul-done');
    expect(reads(r, '사과')).toBe(true);
  });
});

describe('the same in practice: unchanged', () => {
  it.each([
    ['sound off', () => useAudioStore.setState({ muted: true })],
    ['no Korean voice', () => useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } })],
  ])('%s: the Hangul word shows with the sound notice', async (_name, setUp) => {
    if (_name === 'no Korean voice') rig.current = createAudioRig({ voices: [] });
    setUp();
    const { r } = await play('quest');
    expect(reads(r, '사과')).toBe(true);
    expect(reads(r, 'sagwa')).toBe(true);
    expect(keyLine(r).length).toBe(2);
    expect(heldLines(r.root)).toBe(0);
  });

  it('two failed plays: the Hangul word shows', async () => {
    const { r } = await play('quest');
    for (let i = 0; i < 2; i += 1) {
      rig.current!.synth.failNext('synthesis-failed');
      await tap(r, 'dictation-prompt-speaker');
      await settle();
    }
    expect(reads(r, '사과')).toBe(true);
  });
});
