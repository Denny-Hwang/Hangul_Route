import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SoundCheckOutcome, VoiceCheck } from '../../../logic/lecture/shell';
import { byTestId, press, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { StartScreen, type StartScreenProps } from '../StartScreen';

/**
 * Test the sound on the presenter start screen (F-TCH-004 section 3.7, design/screens/presenter/
 * start-screen.md): the button sits in the voice row, under the voice line (in the phone's
 * Details), and the line under it follows the test's outcome. The voice line keeps its wording and
 * the phone's Ready line never waits for a test.
 */
const en = getMessages('en');
const m = en.learner.presenter.start;

function screen(over: Partial<StartScreenProps> = {}, locale: UiLocale = 'en'): React.ReactElement {
  const props: StartScreenProps = {
    deckTitle: 'Week 3 letters',
    slides: 12,
    minutes: 9,
    parts: [],
    partTitle: () => null,
    offlineReady: true,
    voice: { kind: 'local', name: 'Yuna' },
    fullscreenSupported: true,
    wakeLockSupported: true,
    fontReady: true,
    onStart: () => undefined,
    ...over,
  };
  return (
    <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>
      <StartScreen {...props} />
    </PresenterViewProvider>
  );
}

describe('Test the sound (start screen voice row)', () => {
  it('sits in the voice row under the unchanged voice line, and a tap asks for the test', async () => {
    const onTestSound = vi.fn();
    const r = await render(screen({ onTestSound }));
    const row = byTestId(r.root, 'presenter-check-voice')[0]!;
    expect(textOf(row)).toContain(m.voiceLocal('Yuna'));
    const button = byTestId(row, 'presenter-test-sound')[0]!;
    expect(button.props['aria-label']).toBe(m.testSound.cta);
    await press(button);
    expect(onTestSound).toHaveBeenCalledTimes(1);
    // Nothing under the button before a result.
    expect(screenTexts(byTestId(r.root, 'presenter-test-sound-result')[0]!)).toEqual([]);
  });

  it.each<[SoundCheckOutcome, string]>([
    ['played', m.testSound.played],
    ['failed', m.testSound.failed],
  ])('%s: the line under the button, in a polite live region', async (outcome, line) => {
    const r = await render(screen({ onTestSound: () => undefined, soundCheck: outcome }));
    const result = byTestId(r.root, 'presenter-test-sound-result')[0]!;
    expect(result.props.role).toBe('status');
    expect(textOf(result)).toBe(line);
    expect(byTestId(r.root, 'presenter-test-sound-on')).toHaveLength(0);
  });

  it('muted: the shipped Turn sound on, which turns it on', async () => {
    const onTurnSoundOn = vi.fn();
    const r = await render(screen({ onTestSound: () => undefined, soundCheck: 'muted', onTurnSoundOn }));
    const on = byTestId(r.root, 'presenter-test-sound-on')[0]!;
    expect(on.props['aria-label']).toBe(en.learner.audio.action.turn_on.cta);
    await press(on);
    expect(onTurnSoundOn).toHaveBeenCalledTimes(1);
    expect(textOf(byTestId(r.root, 'presenter-test-sound-result')[0]!)).not.toContain(m.testSound.failed);
  });

  it('is offered for a device with no Korean voice too, whose line stays the no-voice line', async () => {
    const voice: VoiceCheck = { kind: 'none' };
    const r = await render(screen({ voice, onTestSound: () => undefined, soundCheck: 'failed' }));
    const row = byTestId(r.root, 'presenter-check-voice')[0]!;
    expect(textOf(row)).toContain(m.voiceNone);
    expect(textOf(row)).toContain(m.testSound.failed);
  });

  it('is not drawn while the voice is still being checked, nor without a handler', async () => {
    const checking = await render(screen({ voice: { kind: 'checking' }, onTestSound: () => undefined }));
    expect(byTestId(checking.root, 'presenter-test-sound')).toHaveLength(0);
    const none = await render(screen());
    expect(byTestId(none.root, 'presenter-test-sound')).toHaveLength(0);
  });

  it('on a phone it is in Details, and Ready does not wait for a test', async () => {
    const r = await render(screen({ phone: true, onTestSound: () => undefined, soundCheck: 'failed' }));
    expect(byTestId(r.root, 'presenter-test-sound')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-start-some-checks')).toHaveLength(0);
    await press(byTestId(r.root, 'presenter-start-details')[0]!);
    expect(byTestId(r.root, 'presenter-test-sound')).toHaveLength(1);
    expect(textOf(byTestId(r.root, 'presenter-test-sound-result')[0]!)).toBe(m.testSound.failed);
  });

  it.each(['es', 'ko'] as const)('%s: the button and lines come from the dictionary', async (locale) => {
    const t = getMessages(locale).learner.presenter.start.testSound;
    const r = await render(screen({ onTestSound: () => undefined, soundCheck: 'played' }, locale));
    expect(byTestId(r.root, 'presenter-test-sound')[0]!.props['aria-label']).toBe(t.cta);
    expect(textOf(byTestId(r.root, 'presenter-test-sound-result')[0]!)).toBe(t.played);
  });
});
