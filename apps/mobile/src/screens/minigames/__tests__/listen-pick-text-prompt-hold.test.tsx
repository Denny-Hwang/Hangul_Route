import type { ListenPickRound } from '@hangul-route/content-schema';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { tileId } from '../../../logic/cloze-pick/round';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, hostNodes, press, render, textOf, unmount } from '../../../test-support/render';
import { ClozePickFallback } from '../cloze-pick-fallback';
import type { HostMode, MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';

/**
 * AMENDMENTS-STAGE1-DECODING-CHECK section 3.3 (row DC-1a): a text prompt round (Read Pick Meaning, the Cloze Pick
 * fallback) holds its prompt's own romanization, and its text options', while a Check's question is open. The held line
 * keeps its room, draws nothing and is off the accessibility tree; the answer shows it as the surface shows it. A
 * practice host is unchanged. The sentence's meaning (the Cloze fallback's stimulus) stays.
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

const mounted: ReactTestRenderer[] = [];
let now = 1_000_000;

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.restoreAllMocks();
});

const host = (mode: HostMode): MinigameHost => ({ mode, answer: () => undefined, complete: () => undefined });

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

const reserved = (root: ReactTestInstance): ReactTestInstance[] => hostNodes(root, (n) => n.props['data-testid'] === 'korean-text-romanization-reserved');
const hidden = (node: ReactTestInstance): boolean => node.props['aria-hidden'] === true;
const invisible = (node: ReactTestInstance): boolean => JSON.stringify(node.props.style ?? {}).includes('"opacity":0');
/** The text nodes of `root` that are drawn: not hidden from assistive tech and not invisible. */
const drawn = (root: ReactTestInstance, wanted: string): ReactTestInstance[] =>
  hostNodes(root, (n) => n.children.length === 1 && n.children[0] === wanted && !hidden(n) && !invisible(n));

describe('Read Pick Meaning: the prompt holds its romanization while a Check is open', () => {
  const options = [
    { id: 'gureum', pictureRef: 'word:nature-cloud', labelEn: 'cloud' },
    { id: 'bi', pictureRef: 'word:nature-rain', labelEn: 'rain' },
  ];
  const rounds: ListenPickRound[] = [{ id: 'pic-gureum', promptShown: true, prompt: { ko: '구름', romanization: 'gureum', en: 'cloud' }, options, answerId: 'gureum' }];

  async function game(mode: HostMode): Promise<ReactTestInstance> {
    const r = await render(
      <RomanizationModeOverride mode="always">
        <ListenPickGame scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host(mode)} />
      </RomanizationModeOverride>,
    );
    mounted.push(r);
    return r.root;
  }

  it.each(['check', 'review'] as const)('%s: the prompt keeps its line\'s room, invisible and unannounced, until the answer; the answer shows it', async (mode) => {
    const root = await game(mode);
    const prompt = byTestId(root, 'listen-pick-prompt-text')[0]!;
    expect(textOf(prompt)).toContain('구름');
    expect(drawn(prompt, 'gureum')).toHaveLength(0);
    expect(reserved(prompt).filter((n) => hidden(n) && invisible(n))).toHaveLength(1);
    await press(pressable(root, 'listen-pick-option-gureum'));
    const after = byTestId(root, 'listen-pick-prompt-text')[0]!;
    expect(drawn(after, 'gureum').length).toBeGreaterThan(0);
    expect(reserved(after)).toHaveLength(0);
  });

  it('a miss does not show it: the question is still open', async () => {
    const root = await game('check');
    await press(pressable(root, 'listen-pick-option-bi'));
    expect(drawn(byTestId(root, 'listen-pick-prompt-text')[0]!, 'gureum')).toHaveLength(0);
  });

  it.each(['quest', 'vocab', 'preview'] as const)('%s: unchanged, the romanization shows from the start', async (mode) => {
    const root = await game(mode);
    const prompt = byTestId(root, 'listen-pick-prompt-text')[0]!;
    expect(drawn(prompt, 'gureum').length).toBeGreaterThan(0);
    expect(reserved(prompt)).toHaveLength(0);
  });
});

describe('the Cloze Pick fallback: the sentence\'s romanization and the tiles\' are held, its meaning stays', () => {
  async function game(mode: HostMode): Promise<ReactTestInstance> {
    const r = await render(<ClozePickFallback scope={clozeFixtureScope(['word'])} host={host(mode)} />);
    mounted.push(r);
    return r.root;
  }
  const TILE_ROMANIZATIONS = ['ilgeoyo', 'meogeoyo', 'masyeoyo'];

  it('a Check: the sentence line is reserved, the meaning is drawn, every tile\'s line is reserved; the answer shows them all', async () => {
    const root = await game('check');
    const prompt = byTestId(root, 'listen-pick-prompt-text')[0]!;
    expect(drawn(prompt, 'chaegeul ___.')).toHaveLength(0);
    expect(drawn(prompt, 'I read a book.').length).toBeGreaterThan(0);
    expect(reserved(prompt)).toHaveLength(1);
    const options = byTestId(root, 'listen-pick-options')[0]!;
    for (const line of TILE_ROMANIZATIONS) expect(drawn(options, line)).toHaveLength(0);
    expect(reserved(options)).toHaveLength(3);
    await press(pressable(root, `listen-pick-option-${tileId('e2e-cloze-word', 0)}`));
    expect(drawn(byTestId(root, 'listen-pick-prompt-text')[0]!, 'chaegeul ___.').length).toBeGreaterThan(0);
    for (const line of TILE_ROMANIZATIONS) expect(drawn(byTestId(root, 'listen-pick-options')[0]!, line).length).toBeGreaterThan(0);
  });

  it('a practice step is unchanged: everything shows from the start', async () => {
    const root = await game('quest');
    const prompt = byTestId(root, 'listen-pick-prompt-text')[0]!;
    expect(drawn(prompt, 'chaegeul ___.').length).toBeGreaterThan(0);
    expect(reserved(prompt)).toHaveLength(0);
    const options = byTestId(root, 'listen-pick-options')[0]!;
    for (const line of TILE_ROMANIZATIONS) expect(drawn(options, line).length).toBeGreaterThan(0);
  });
});
