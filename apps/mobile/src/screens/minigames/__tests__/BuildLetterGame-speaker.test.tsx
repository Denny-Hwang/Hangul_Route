import { sayRef } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { LayoutProvider, TapLockProvider, layoutClassFor } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_PACK as STAGE1_PACK } from '../../../content/__generated__/audio-packs/audio-pack-stage1';
import type { ClipFailure, ClipPlayer } from '../../../logic/audio/controller';
import { minigameScopes, type MinigameScope } from '../../../logic/minigame-config';
import { createWebAudio, type WebAudio, type WebAudioEnv } from '../../../platform/audio.web';
import { useAudioStore } from '../../../store/audio-store';
import { FakeSpeechSynthesis, FakeUtterance } from '../../../test-support/fake-speech-synthesis';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { BuildLetterGame } from '../BuildLetterGame';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-13 (audit FUNC-5): on a device with no Korean voice, the Build a Letter speaker
 * ("Hear ga") plays the syllable's recorded clip, and the screen does not say "No Korean voice on this device" under
 * it. The speaker already asked the controller for the text-keyed say clip (AMENDMENTS-AUDIO-CLIPS AC-B7), but the
 * screen's prompt slot was never told the syllable has one, so the first tap showed the no-voice line and the
 * "How to add a voice" link over a recording that played. Device speech stays the fallback for a syllable with no
 * clip, and only then does the line show.
 *
 * Through the shipped web adapter and controller over a fake speech engine with no voice, a clip player double, and
 * the real `stage1` pack map (`__generated__/audio-packs/audio-pack-stage1.ts`).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ audio: null as WebAudio | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: (spec: Parameters<WebAudio['playPrompt']>[0]) => rig.audio!.playPrompt(spec),
  stop: () => rig.audio!.stop(),
  hasClip: (ref: string | undefined) => rig.audio!.hasClip(ref),
  hasClipFor: (spec: Parameters<WebAudio['hasClipFor']>[0]) => rig.audio!.hasClipFor(spec),
  noteFallbackShown: (...args: Parameters<WebAudio['noteFallbackShown']>) => rig.audio!.noteFallbackShown(...args),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

/** A clip player double: every clip plays to its end. */
class FakeClipPlayer implements ClipPlayer {
  readonly played: string[] = [];
  play(ref: string, h: { onStart(): void; onDone(): void; onError(reason: ClipFailure): void }): { stop(): void } {
    this.played.push(ref);
    queueMicrotask(() => {
      h.onStart();
      h.onDone();
    });
    return { stop: () => undefined };
  }
  warm(): Promise<void> {
    return Promise.resolve();
  }
  unlock(): void {}
  stopAll(): void {}
}

class FakeDoc extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible';
}

const AUDIO = getMessages('en').learner.audio;
const STAGE1_CLIPS: Readonly<Record<string, number | string>> = STAGE1_PACK.clips;
let synth: FakeSpeechSynthesis;
let player: FakeClipPlayer;
const mounted: ReactTestRenderer[] = [];

/** A device with no Korean voice whose build holds the `stage1` pack's clips (its map chunk has landed). */
beforeEach(() => {
  useAudioStore.setState({ muted: false, tts: { state: 'unknown' }, clips: false, unlocked: false, lastFailure: null });
  synth = new FakeSpeechSynthesis();
  synth.setVoices([]);
  player = new FakeClipPlayer();
  const env: WebAudioEnv = {
    synth: synth as unknown as WebAudioEnv['synth'],
    Utterance: FakeUtterance as unknown as NonNullable<WebAudioEnv['Utterance']>,
    doc: new FakeDoc() as unknown as WebAudioEnv['doc'],
    win: new EventTarget() as unknown as WebAudioEnv['win'],
    isOnline: () => true,
    clips: {
      player,
      assets: {
        has: (ref) => ref in STAGE1_CLIPS,
        size: Object.keys(STAGE1_CLIPS).length,
        packOf: (ref) => (ref in STAGE1_CLIPS ? STAGE1_PACK.pack : undefined),
        packHas: (pack) => pack === STAGE1_PACK.pack,
      },
      enabled: () => true,
      packEnabled: () => true,
      supported: true,
    },
  };
  rig.audio = createWebAudio(env);
  synth.fireVoicesChanged();
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  rig.audio?.dispose();
  rig.audio = null;
  vi.useRealTimers();
});

const scope = (syllables: NonNullable<MinigameScope['syllables']>): MinigameScope => ({ kind: 'build-letter', rounds: syllables.length, syllables });

async function draw(s: MinigameScope): Promise<ReactTestRenderer> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <TapLockProvider>
        <BuildLetterGame scope={s} onFinish={() => undefined} />
      </TapLockProvider>
    </LayoutProvider>,
  );
  mounted.push(r);
  return r;
}

const speaker = (root: ReactTestInstance): ReactTestInstance => {
  const node = byTestId(root, 'build-letter-speaker').find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error('no speaker');
  return node;
};
/** Long enough for the adapter's 1.5 s wait for late voices to end when there are none. */
const settle = async (ms = 20): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const detail = (root: ReactTestInstance): string | null => {
  const node = byTestId(root, 'prompt-panel-detail')[0];
  return node ? textOf(node) : null;
};

/** Every Build a Letter round of the shipped scopes (all of them are Stage 1 games, `minigame:s1-...`). */
const BUILD_LETTER = Object.entries(minigameScopes).filter(([, s]) => s.kind === 'build-letter');
const TARGETS = BUILD_LETTER.flatMap(([ref, s]) => (s.syllables ?? []).map((syllable) => ({ ref, ko: syllable.ko })));

describe('Build a Letter: every shipped target has a recorded clip (AU-13)', () => {
  it('there are Build a Letter games, all in Stage 1', () => {
    expect(BUILD_LETTER.length).toBeGreaterThanOrEqual(7);
    for (const [ref] of BUILD_LETTER) expect(ref).toMatch(/^minigame:s1-/);
    expect(TARGETS.map((t) => t.ko)).toEqual(expect.arrayContaining(['가', '거', '나', '너']));
  });

  it.each(TARGETS)('$ref $ko: its say clip is in the stage1 pack map', ({ ko }) => {
    expect(STAGE1_CLIPS[sayRef(ko)], `no clip for ${ko}: ${sayRef(ko)}`).toBeDefined();
  });

  it.each(TARGETS)('$ref $ko: the clip is in the game\'s warm unit, so it is fetched when the lesson opens', ({ ref, ko }) => {
    const refs = Object.keys(STAGE1_CLIPS);
    const unit = (STAGE1_PACK.units[ref] ?? []).map((i) => refs[i]);
    expect(unit).toContain(sayRef(ko));
  });

  it.each(TARGETS)('$ref $ko: with no Korean voice the prompt plays the clip, and the voice is never asked', async ({ ko }) => {
    await expect(rig.audio!.playPrompt({ text: ko, kind: 'sound', source: 'build-letter' })).resolves.toBe('played');
    expect(player.played).toEqual([sayRef(ko)]);
    expect(synth.spoken).toHaveLength(0);
    expect(rig.audio!.hasClipFor({ text: ko })).toBe(true);
  });
});

describe('Build a Letter: the speaker on a device with no Korean voice (AU-13)', () => {
  const GA = scope([
    { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
    { ko: '거', romanization: 'geo', jamoChars: ['ㄱ', 'ㅓ'] },
  ]);

  it('the device has no Korean voice (the case of the audit)', async () => {
    await settle(1_700);
    expect(useAudioStore.getState().tts.state).toBe('none');
    expect(useAudioStore.getState().clips).toBe(true);
  });

  it('Hear ga plays the recorded clip and says nothing about a missing voice', async () => {
    await settle(1_700);
    const r = await draw(GA);
    expect(speaker(r.root).props['aria-label']).toBe('Hear ga');
    expect(detail(r.root)).toBeNull();

    await press(speaker(r.root));
    await settle();
    expect(player.played).toEqual([sayRef('가')]);
    expect(synth.spoken).toHaveLength(0);
    expect(detail(r.root)).toBeNull();
    expect(byTestId(r.root, 'prompt-panel-help')).toHaveLength(0);
    expect(textOf(r.root)).not.toContain(AUDIO.noKoreanVoiceSentence);

    // A second tap plays it again, and still shows nothing.
    await press(speaker(r.root));
    await settle();
    expect(player.played).toEqual([sayRef('가'), sayRef('가')]);
    expect(detail(r.root)).toBeNull();
  });

  it('a syllable with no clip falls back to the device voice, and only then says there is none', async () => {
    await settle(1_700);
    // Not a taught syllable: no clip is recorded for it.
    const noClip = '뷁';
    expect(STAGE1_CLIPS[sayRef(noClip)]).toBeUndefined();
    const r = await draw(scope([{ ko: noClip, romanization: 'bwelk', jamoChars: ['ㅂ', 'ㅞ', 'ㄺ'] }]));
    expect(detail(r.root)).toBeNull();

    await press(speaker(r.root));
    await settle();
    expect(player.played).toEqual([]);
    expect(detail(r.root)).toBe(AUDIO.noKoreanVoiceSentence);
    expect(byTestId(r.root, 'prompt-panel-help').length).toBeGreaterThan(0);
  });
});
