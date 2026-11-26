import type { ListenPickRound } from '@hangul-route/content-schema';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, hostNodes, press, render, textOf, unmount } from '../../../test-support/render';
import type { HostMode, MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';

/**
 * AMENDMENTS-AUDIT-2026-11 AU-8 (audit EDU-3), widened by AMENDMENTS-STAGE1-DECODING-CHECK DC-1a: in a Check (the quest
 * "Quick check" and the Hangul Check, whatever the learner's mode) no answer option shows its romanization while the
 * question is open, so the sound cannot be matched to Latin letters; the lines come back, in the room they kept, once the
 * question is answered. The accessible names keep the romanization. A practice step of the same game is unchanged.
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

const text = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const OPTIONS = [
  { id: 'neo', text: text('너', 'neo', 'you') },
  { id: 'na', text: text('나', 'na', 'I') },
  { id: 'no', text: text('노', 'no', 'oar') },
  { id: 'nu', text: text('누', 'nu', 'who') },
];
const ROUNDS: ListenPickRound[] = [
  { id: 'lp:syl:neo', prompt: text('너', 'neo', 'you'), options: OPTIONS, answerId: 'neo' },
  { id: 'lp:syl:na', prompt: text('나', 'na', 'I'), options: OPTIONS, answerId: 'na' },
];
const ROMANIZATIONS = OPTIONS.map((o) => o.text.romanization).sort();
const NAMES = ['나, na', '너, neo', '노, no', '누, nu'];

const mounted: ReactTestRenderer[] = [];
let now = 1_000_000;

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  // The flow drops a second tap inside its bounce window (`touchWindowMs`); each tap here is a deliberate one.
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.restoreAllMocks();
});

async function game(mode: HostMode): Promise<ReactTestInstance> {
  const host: MinigameHost = { mode, answer: () => undefined, complete: () => undefined };
  const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: ROUNDS.length, listenPick: { rounds: ROUNDS } }} host={host} />);
  mounted.push(r);
  return r.root;
}

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

function hidden(node: ReactTestInstance): boolean {
  let at: ReactTestInstance | null = node;
  while (at) {
    if (at.props['aria-hidden'] === true) return true;
    at = at.parent;
  }
  return false;
}

const invisible = (node: ReactTestInstance): boolean => JSON.stringify(node.props.style ?? {}).includes('"opacity":0');

/** The romanization lines the option cards draw: `shown` are seen and read, `reserved` only keep their room. */
function lines(root: ReactTestInstance): { shown: string[]; reserved: string[] } {
  const board = byTestId(root, 'listen-pick-options')[0]!;
  const nodes = hostNodes(board, (n) => n.children.length === 1 && typeof n.children[0] === 'string' && ROMANIZATIONS.includes(textOf(n)));
  return {
    shown: nodes.filter((n) => !hidden(n) && !invisible(n)).map(textOf).sort(),
    reserved: nodes.filter((n) => hidden(n) && invisible(n)).map(textOf).sort(),
  };
}

const optionName = (root: ReactTestInstance, id: string): string => String(pressable(root, `listen-pick-option-${id}`).props['aria-label']);
const names = (root: ReactTestInstance): string[] => OPTIONS.map((o) => optionName(root, o.id)).sort();

describe("a quest Check holds the options' romanization until the answer (AU-8)", () => {
  it('open question: no option shows its romanization; each line keeps its room, invisible and unannounced', async () => {
    const root = await game('check');
    expect(lines(root)).toEqual({ shown: [], reserved: ROMANIZATIONS });
  });

  it('the accessible name of each option keeps the romanization', async () => {
    const root = await game('check');
    expect(names(root)).toEqual(NAMES);
  });

  it('a missed option stays without it while the question is open', async () => {
    const root = await game('check');
    await press(pressable(root, 'listen-pick-option-na'));
    expect(lines(root)).toEqual({ shown: [], reserved: ROMANIZATIONS });
    expect(optionName(root, 'na')).toContain('나, na');
  });

  it('answered: every option shows its romanization and nothing is reserved', async () => {
    const root = await game('check');
    await press(pressable(root, 'listen-pick-option-na'));
    await press(pressable(root, 'listen-pick-option-neo'));
    expect(lines(root)).toEqual({ shown: ROMANIZATIONS, reserved: [] });
  });

  it('the no-sound path reads the sound only: the prompt is its romanization, no Hangul, and the options stay held (DC-1a, section 3.2)', async () => {
    rig.current = createAudioRig({ voices: [] });
    const root = await game('check');
    const prompt = byTestId(root, 'listen-pick-prompt-text');
    expect(prompt.length).toBeGreaterThan(0);
    expect(hostNodes(prompt[0]!, (n) => n.children.length === 1 && n.children[0] === 'neo' && !hidden(n) && !invisible(n)).length).toBeGreaterThan(0);
    expect(textOf(prompt[0]!)).not.toContain('너');
    expect(lines(root)).toEqual({ shown: [], reserved: ROMANIZATIONS });
  });
});

describe('the Hangul Check holds them the same way (DC-1a)', () => {
  it('open question: no option shows its romanization; the names keep it; the answer shows every line', async () => {
    const root = await game('review');
    expect(lines(root)).toEqual({ shown: [], reserved: ROMANIZATIONS });
    expect(names(root)).toEqual(NAMES);
    await press(pressable(root, 'listen-pick-option-na'));
    expect(lines(root)).toEqual({ shown: [], reserved: ROMANIZATIONS });
    await press(pressable(root, 'listen-pick-option-neo'));
    expect(lines(root)).toEqual({ shown: ROMANIZATIONS, reserved: [] });
  });
});

describe('every other Listen & Pick host is unchanged (AU-8)', () => {
  it.each(['quest', 'vocab', 'preview'] as const)('%s: every option shows its romanization from the start', async (mode) => {
    const root = await game(mode);
    expect(lines(root)).toEqual({ shown: ROMANIZATIONS, reserved: [] });
    expect(names(root)).toEqual(NAMES);
  });

  it('a practice step: still shown after a miss and after the answer', async () => {
    const root = await game('quest');
    await press(pressable(root, 'listen-pick-option-na'));
    expect(lines(root)).toEqual({ shown: ROMANIZATIONS, reserved: [] });
    await press(pressable(root, 'listen-pick-option-neo'));
    expect(lines(root)).toEqual({ shown: ROMANIZATIONS, reserved: [] });
  });
});
