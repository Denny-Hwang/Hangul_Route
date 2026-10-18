import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { PlayResult, PlaySpec } from '../../../logic/audio/controller';
import { byTestId, press, render, screenTexts } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { StartScreen } from '../StartScreen';
import { useSoundCheck, type SoundCheckDeps } from '../use-sound-check';

/**
 * Test the sound as `PresenterApp` wires it (F-TCH-004 section 3.7): the hook and the start screen together, with
 * the platform calls faked. The order in the tap, the muted path through Turn sound on, a sound that fails, two
 * quick taps, and a result that belongs to the start screen it was asked on.
 */
const en = getMessages('en');
const t = en.learner.presenter.start.testSound;
const SPEC: PlaySpec = { text: 'greeting', kind: 'word', source: 'presenter-check' };

interface Fakes {
  calls: string[];
  results: Array<(r: PlayResult) => void>;
  deps: Omit<SoundCheckDeps, 'onStartScreen'>;
}

/** Each play waits until the test settles it (`results[i](...)`), so the order of results is the test's. */
function fakes(): Fakes {
  const calls: string[] = [];
  const results: Array<(r: PlayResult) => void> = [];
  return {
    calls,
    results,
    deps: {
      spec: () => SPEC,
      unlock: () => calls.push('unlock'),
      play: (spec) => {
        calls.push(`play:${spec.source}`);
        return new Promise<PlayResult>((resolve) => results.push(resolve));
      },
      turnSoundOn: () => calls.push('turnSoundOn'),
    },
  };
}

function Harness({ onStartScreen, deps }: { onStartScreen: boolean; deps: Fakes['deps'] }): React.ReactElement {
  const check = useSoundCheck({ ...deps, onStartScreen });
  return (
    <PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}>
      {onStartScreen ? (
        <StartScreen
          deckTitle="Week 3 letters"
          slides={12}
          minutes={9}
          parts={[]}
          partTitle={() => null}
          offlineReady
          voice={{ kind: 'local', name: 'Yuna' }}
          fullscreenSupported
          wakeLockSupported
          fontReady
          onStart={() => undefined}
          onTestSound={check.onTestSound}
          soundCheck={check.soundCheck}
          onTurnSoundOn={check.onTurnSoundOn}
        />
      ) : (
        <Text>stage</Text>
      )}
    </PresenterViewProvider>
  );
}

const resultLines = (root: Parameters<typeof byTestId>[0]): string[] => {
  const result = byTestId(root, 'presenter-test-sound-result')[0];
  return result ? screenTexts(result) : [];
};

const settle = async (resolve: ((r: PlayResult) => void) | undefined, result: PlayResult): Promise<void> => {
  await act(async () => {
    resolve?.(result);
  });
};

describe('Test the sound wired to the start screen (PresenterApp)', () => {
  it('a tap runs the unlock and then the play in the tap, and shows the played line', async () => {
    const f = fakes();
    const r = await render(<Harness onStartScreen deps={f.deps} />);
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    expect(f.calls).toEqual(['unlock', 'play:presenter-check']);
    expect(resultLines(r.root)).toEqual([]);
    await settle(f.results[0], 'played');
    expect(resultLines(r.root)).toEqual([t.played]);
  });

  it('muted, then Turn sound on: the sound goes on, the test runs again in that tap, and the played line shows', async () => {
    const f = fakes();
    const r = await render(<Harness onStartScreen deps={f.deps} />);
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    await settle(f.results[0], 'muted');
    expect(resultLines(r.root)[0]).toBe(en.learner.audio.soundIsOff);
    expect(resultLines(r.root)).toContain(en.learner.audio.action.turn_on.cta);
    await press(byTestId(r.root, 'presenter-test-sound-on')[0]!);
    expect(f.calls).toEqual(['unlock', 'play:presenter-check', 'turnSoundOn', 'unlock', 'play:presenter-check']);
    // While the new test plays, the old outcome is gone.
    expect(resultLines(r.root)).toEqual([]);
    await settle(f.results[1], 'played');
    expect(resultLines(r.root)).toEqual([t.played]);
  });

  it('a sound that does not play (no voice, blocked or an engine error) shows the failed line', async () => {
    const f = fakes();
    const r = await render(<Harness onStartScreen deps={f.deps} />);
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    await settle(f.results[0], 'unavailable');
    expect(resultLines(r.root)).toEqual([t.failed]);
  });

  it('two quick taps: only the newer result shows, whatever order they come back in', async () => {
    const f = fakes();
    const r = await render(<Harness onStartScreen deps={f.deps} />);
    const button = byTestId(r.root, 'presenter-test-sound')[0]!;
    await press(button);
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    expect(f.results).toHaveLength(2);
    await settle(f.results[1], 'played');
    expect(resultLines(r.root)).toEqual([t.played]);
    // The older one (superseded by the newer tap) comes back late: nothing changes.
    await settle(f.results[0], 'unavailable');
    expect(resultLines(r.root)).toEqual([t.played]);
  });

  it('leaving the start screen clears the result, and one that comes back after leaving never shows', async () => {
    const f = fakes();
    const r = await render(<Harness onStartScreen deps={f.deps} />);
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    await settle(f.results[0], 'played');
    expect(resultLines(r.root)).toEqual([t.played]);
    await act(async () => r.update(<Harness onStartScreen={false} deps={f.deps} />));
    await act(async () => r.update(<Harness onStartScreen deps={f.deps} />));
    expect(resultLines(r.root)).toEqual([]);

    // A test asked, then the screen left before its result: back on the start screen, no line.
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    await act(async () => r.update(<Harness onStartScreen={false} deps={f.deps} />));
    await settle(f.results[1], 'unavailable');
    await act(async () => r.update(<Harness onStartScreen deps={f.deps} />));
    expect(resultLines(r.root)).toEqual([]);
  });

  it('plays what the spec says at the tap (the capability then)', async () => {
    const f = fakes();
    const spec = vi.fn((): PlaySpec => ({ text: 'clip', audioRef: 'audio/jamo/a.mp3', kind: 'sound', source: 'presenter-check' }));
    const play = vi.fn(f.deps.play);
    const r = await render(<Harness onStartScreen deps={{ ...f.deps, spec, play }} />);
    expect(spec).not.toHaveBeenCalled();
    await press(byTestId(r.root, 'presenter-test-sound')[0]!);
    expect(play).toHaveBeenCalledWith({ text: 'clip', audioRef: 'audio/jamo/a.mp3', kind: 'sound', source: 'presenter-check' });
  });
});
