import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { colors } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clipRefsFor, type PlaySpec } from '../../../logic/audio/controller';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, screenTexts, textOf, unmount } from '../../../test-support/render';
import type { AnswerMeta, HostMode, MinigameHost } from '../host';
import { loadContrastKit } from '../contrast-entry';
import { ListenPickGame } from '../ListenPickGame';

/**
 * A contrast round of Listen & Pick (AMENDMENTS-MINIMAL-PAIRS sections 3.6 to 3.9, row MP-2a), over fixture sets the owner
 * has "approved" (the shipped catalogue has no approval until MP-3): it plays on its clips only, scores nothing, and drops
 * a round whose clip cannot play.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const fixture = vi.hoisted(() => {
  const member = (text: string, romanization: string, kind: 'plain' | 'aspirated' | 'tense', ref: string) => ({
    text,
    romanization,
    en: `the syllable ${romanization}`,
    ref,
    kind,
  });
  const set = (id: string, series: string, members: ReturnType<typeof member>[]) => ({
    id,
    series,
    unit: 'minigame:s1-life-q3-pairs',
    members,
    approved: true,
  });
  return {
    sets: [
      set('ga-ka', 'k', [member('가', 'ga', 'plain', 'audio/fixture/ga.mp3'), member('카', 'ka', 'aspirated', 'audio/fixture/ka.mp3')]),
      set('da-ta', 't', [member('다', 'da', 'plain', 'audio/fixture/da.mp3'), member('타', 'ta', 'aspirated', 'audio/fixture/ta.mp3')]),
      set('ja-cha', 'c', [member('자', 'ja', 'plain', 'audio/fixture/ja.mp3'), member('차', 'cha', 'aspirated', 'audio/fixture/cha.mp3')]),
      set('dal-tal-ttal', 't', [
        member('달', 'dal', 'plain', 'audio/fixture/dal.mp3'),
        member('탈', 'tal', 'aspirated', 'audio/fixture/tal.mp3'),
        member('딸', 'ttal', 'tense', 'audio/fixture/ttal.mp3'),
      ]),
    ],
  };
});
vi.mock('../../../content/__generated__/contrast-sets', () => ({ CONTRAST_SETS: fixture.sets }));

const audio = vi.hoisted(() => ({
  clips: new Set<string>(),
  played: [] as PlaySpec[],
  /** What the next `playPrompt` resolves; `'played'` unless a test says otherwise. */
  result: 'played' as 'played' | 'unavailable',
  /** Resolves per call, in order, before falling back to `result`. */
  script: [] as Array<'played' | 'unavailable'>,
  /** How long a clip sounds (fake timers), so a test can look while one plays. */
  delayMs: 0,
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(async (spec: PlaySpec) => {
    audio.played.push(spec);
    if (audio.delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, audio.delayMs));
    return audio.script.shift() ?? audio.result;
  }),
  hasClip: (ref: string | undefined) => ref !== undefined && audio.clips.has(ref),
  hasClipFor: (spec: PlaySpec) => clipRefsFor(spec).some((ref) => audio.clips.has(ref)),
  hasPackClips: () => false,
  warmClips: () => Promise.resolve(),
  stop: vi.fn(),
  noteFallbackShown: vi.fn(),
}));
const events = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    events.push(event);
  }),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await importOriginal<object>()));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

// After the mocks: `lp.pair` reads the fixture sets.
const { lp } = await import('../../../logic/scope-builders');

const en = getMessages('en');
const C = en.learner.minigame.contrast;
const A = en.learner.audio;
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const KO_OF: Record<string, string> = Object.fromEntries(fixture.sets.flatMap((s) => s.members.map((m) => [m.text, m.romanization])));
const KIND_OF: Record<string, 'plain' | 'aspirated' | 'tense'> = Object.fromEntries(fixture.sets.flatMap((s) => s.members.map((m) => [m.text, m.kind])));
const SET_OF: Record<string, string> = Object.fromEntries(fixture.sets.flatMap((s) => s.members.map((m) => [m.text, s.id])));

const mounted: ReactTestRenderer[] = [];
/** What the host was told: [round, correct]. */
const answers: Array<[string | number, boolean]> = [];
const metas: Array<AnswerMeta | undefined> = [];
let completed = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-26T09:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.37);
  audio.clips = new Set(fixture.sets.flatMap((s) => s.members.map((m) => m.ref)));
  audio.played = [];
  audio.result = 'played';
  audio.script = [];
  audio.delayMs = 0;
  useAudioStore.setState({ muted: false, showLetters: false, voiceCheckPending: false, clips: true });
  useLocaleStore.setState({ device: null });
  clearReaderLog(reader);
  events.length = 0;
  answers.length = 0;
  metas.length = 0;
  completed = 0;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const PAIRS = ['ga-ka', 'da-ta', 'ja-cha'];

async function game(mode: HostMode = 'quest', setIds: readonly string[] = PAIRS): Promise<ReactTestRenderer> {
  return gameOf(setIds.map((id) => lp.pair(id)), mode);
}

/** The game over these scope rounds (stubs, full contrast rounds or plain ones), as the lesson player hands them. */
async function gameOf(rounds: ListenPickRound[], mode: HostMode = 'quest'): Promise<ReactTestRenderer> {
  const host: MinigameHost = {
    mode,
    answer: (round, correct, meta) => void (answers.push([round, correct]), metas.push(meta)),
    complete: () => void (completed += 1),
  };
  // The contrast chunk is a dynamic import (a real file read, which fake timers do not move): have it in, as the precache has.
  await loadContrastKit();
  const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } }} host={host} />, {
    createNodeMock: focusNodes(['listen-pick-speaker']) as never,
  });
  mounted.push(r);
  await tick(SCREEN_SETTLE_MS);
  return r;
}

const hear = async (r: ReactTestRenderer): Promise<PlaySpec> => {
  await press(pressableById(r.root, 'listen-pick-speaker'));
  await tick(0);
  return audio.played.at(-1)!;
};
/** The option of the round on screen that is not the target. */
const otherOptions = (r: ReactTestRenderer, targetKo: string): string[] => {
  const ids = byTestId(r.root, 'listen-pick-options')[0]!.findAll((n) => typeof n.type === 'string' && String(n.props['data-testid'] ?? '').startsWith('listen-pick-option-')).map((n) => String(n.props['data-testid']).slice('listen-pick-option-'.length));
  return [...new Set(ids)].filter((id) => id !== KO_OF[targetKo]);
};
const tapOption = async (r: ReactTestRenderer, romanization: string): Promise<void> => {
  await press(pressableById(r.root, `listen-pick-option-${romanization}`));
};
const progress = (r: ReactTestRenderer): string => screenTexts(r.root).find((t) => /^\d+ \/ \d+$/.test(t)) ?? '';
const textsOf = (r: ReactTestRenderer): string[] => screenTexts(r.root);
const noDanger = (r: ReactTestRenderer): boolean => !JSON.stringify(r.toJSON()).includes(colors.feedback.danger);
const open = (r: ReactTestRenderer): ReactTestInstance => byTestId(r.root, 'listen-pick-options')[0]!;

describe('a contrast round plays on clips only (section 3.6)', () => {
  it('the speaker plays the target by its own clip, clip only, never by its text and never by the voice', async () => {
    const r = await game();
    const spec = await hear(r);
    const [member] = fixture.sets.flatMap((s) => s.members).filter((m) => m.text === spec.text);
    expect(spec).toEqual({ text: member!.text, audioRef: member!.ref, kind: 'sound', source: 'listen-pick', clipOnly: true });
  });

  it('draws the rounds when the step starts: three sets, each target from its own set, plain and aspirated both asked', async () => {
    const targets: string[] = [];
    const r = await game();
    for (let i = 0; i < 3; i++) {
      const spec = await hear(r);
      targets.push(spec.text);
      await tapOption(r, KO_OF[spec.text]!);
      await tick(5000);
    }
    expect(new Set(targets.map((t) => SET_OF[t]))).toEqual(new Set(PAIRS));
    expect(new Set(targets.map((t) => KIND_OF[t]))).toEqual(new Set(['plain', 'aspirated']));
  });

  it('shows no text for the prompt, before or after a failed play, and prints no Hangul above the options', async () => {
    audio.result = 'unavailable';
    const r = await game();
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
    await press(pressableById(r.root, 'listen-pick-speaker'));
    await tick(50);
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
    expect(textsOf(r)).not.toContain(A.readHere);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
  });
});

describe('a contrast round scores nothing (section 3.8)', () => {
  it('right, wrong and the end of the step reach no host answer: no star, no missed list, no memory store', async () => {
    const r = await game();
    for (let i = 0; i < 3; i++) {
      const spec = await hear(r);
      // A miss first on every round, then (a pair is over after its miss) the next round.
      await tapOption(r, otherOptions(r, spec.text)[0]!);
      await tick(5000);
    }
    expect(answers).toEqual([]);
    expect(metas).toEqual([]);
    expect(completed).toBe(1);
  });

  it('a right answer is not reported either, and the step still completes once', async () => {
    const r = await game();
    for (let i = 0; i < 3; i++) {
      const spec = await hear(r);
      await tapOption(r, KO_OF[spec.text]!);
      await tick(5000);
    }
    expect(answers).toEqual([]);
    expect(completed).toBe(1);
  });
});

describe('a round whose clip cannot play is dropped (section 3.6)', () => {
  it('a set with a member whose clip is not there is never drawn: the count is the playable rounds', async () => {
    audio.clips.delete('audio/fixture/ta.mp3');
    const r = await game();
    expect(progress(r)).toBe('1 / 2');
    const seen = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const spec = await hear(r);
      seen.add(SET_OF[spec.text]!);
      await tapOption(r, KO_OF[spec.text]!);
      await tick(5000);
    }
    expect(seen).toEqual(new Set(['ga-ka', 'ja-cha']));
    expect(completed).toBe(1);
  });

  it('a clip that fails when played ends the round with nothing scored, shows no text, and the next round opens; the count shrinks', async () => {
    const r = await game();
    expect(progress(r)).toBe('1 / 3');
    audio.script = ['unavailable'];
    await press(pressableById(r.root, 'listen-pick-speaker'));
    await tick(50);
    expect(progress(r)).toBe('1 / 2');
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
    expect(answers).toEqual([]);
    // The next round plays by itself (it opened after a tap).
    expect(audio.played).toHaveLength(2);
    expect(completed).toBe(0);
  });

  it('every round failing completes the step, having scored nothing', async () => {
    audio.result = 'unavailable';
    const r = await game();
    // One tap on the speaker: each round that cannot play ends at once and the next opens, until none is left.
    await press(pressableById(r.root, 'listen-pick-speaker'));
    await tick(100);
    expect(audio.played).toHaveLength(3);
    expect(answers).toEqual([]);
    expect(completed).toBe(1);
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
  });

  it('a pack switched off while the step is open drops the later rounds just before they open', async () => {
    const r = await game();
    const spec = await hear(r);
    const here = SET_OF[spec.text]!;
    // The learner answers right; before the next round opens, every other set loses a clip.
    for (const s of fixture.sets) if (s.id !== here) audio.clips.delete(s.members[0]!.ref);
    await tapOption(r, KO_OF[spec.text]!);
    await tick(5000);
    expect(completed).toBe(1);
    expect(answers).toEqual([]);
  });

  it('with nothing playable when it opens, the step completes at once and shows no round', async () => {
    audio.clips.clear();
    const r = await game();
    expect(completed).toBe(1);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
    expect(answers).toEqual([]);
  });

  it.each<[string, () => void]>([
    ['sound off', () => useAudioStore.setState({ muted: true })],
    ['Always show the letters', () => useAudioStore.setState({ showLetters: true })],
  ])('%s: the rounds are not playable, so the step completes with nothing shown', async (_name, set) => {
    set();
    const r = await game();
    expect(completed).toBe(1);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
  });

  it.each<HostMode>(['check', 'review', 'vocab'])('the %s host never plays a contrast round', async (mode) => {
    const r = await game(mode);
    expect(completed).toBe(1);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
    expect(audio.played).toEqual([]);
  });

  it('fewer than two playable sets is no step', async () => {
    const r = await game('quest', ['ga-ka']);
    expect(completed).toBe(1);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
  });
});

describe('a miss: Listen to both (section 3.7)', () => {
  it('Hoya says "Listen to both.", the tapped card is amber with its mark and locked, and the compare row shows the right one first, each with its kind line', async () => {
    const r = await game();
    const spec = await hear(r);
    const wrong = otherOptions(r, spec.text)[0]!;
    await tapOption(r, wrong);
    expect(textsOf(r)).toContain(C.missHoya);
    const right = KO_OF[spec.text]!;
    const lines = byTestId(r.root, 'contrast-compare')[0]!;
    const items = lines.findAll((n) => typeof n.type === 'string' && /^contrast-compare-(?!line)/.test(String(n.props['data-testid'] ?? '')));
    const order = [...new Set(items.map((n) => String(n.props['data-testid']).replace('contrast-compare-', '')))];
    expect(order).toEqual([right, wrong]);
    const kindOf = (id: string): string => {
      const ko = Object.keys(KO_OF).find((k) => KO_OF[k] === id)!;
      return KIND_OF[ko] === 'plain' ? C.kind.plain : C.kind.aspirated;
    };
    expect(textOf(byTestId(r.root, `contrast-compare-line-${right}`)[0]!)).toBe(kindOf(right));
    expect(textOf(byTestId(r.root, `contrast-compare-line-${wrong}`)[0]!)).toBe(kindOf(wrong));
    expect(noDanger(r)).toBe(true);
    // The tapped card is the amber, locked one ("Not this one", the replay mark), and Hoya thinks.
    const tapped = byTestId(r.root, `listen-pick-option-${wrong}`).find((n) => n.props['aria-label'] !== undefined)!;
    expect(String(tapped.props['aria-label'])).toContain(en.a11y.minigame.option.wrong(''));
    // The two are named by romanization and kind line, never by Hangul.
    const names = items.map((n) => String(n.props['aria-label'] ?? '')).filter((n) => n !== '');
    expect(names).toContain(`${right}, ${kindOf(right)}`);
    expect(names.some((n) => HANGUL.test(n))).toBe(false);
  });

  it('plays the right clip and then the tapped one, 400 ms after it, clip only; the one playing is outlined', async () => {
    const r = await game();
    const spec = await hear(r);
    const wrong = otherOptions(r, spec.text)[0]!;
    audio.played.length = 0;
    audio.delayMs = 200;
    await tapOption(r, wrong);
    await tick(0);
    const right = KO_OF[spec.text]!;
    const playing = (id: string): boolean => hasId(r.root, `contrast-sounding-${id}`);
    expect(audio.played.map((s) => KO_OF[s.text])).toEqual([right]);
    expect(audio.played.every((s) => s.clipOnly === true)).toBe(true);
    // The one playing is marked (the outline and the speaker glyph follow it), and only that one.
    expect([playing(right), playing(wrong)]).toEqual([true, false]);
    // The right clip ended at 200 ms; the tapped one starts 400 ms after it, at 600 ms.
    await tick(300);
    expect(audio.played).toHaveLength(1);
    await tick(400);
    expect(audio.played.map((s) => KO_OF[s.text])).toEqual([right, wrong]);
    expect(audio.played.every((s) => s.clipOnly === true && s.audioRef !== undefined)).toBe(true);
    expect([playing(right), playing(wrong)]).toEqual([false, true]);
    // No replay of the prompt after 800 ms, and no text: the two clips are all that sounded after the miss.
    await tick(1500);
    expect(audio.played).toHaveLength(2);
    expect(textsOf(r)).not.toContain(A.readHere);
    expect([playing(right), playing(wrong)]).toEqual([false, false]);
  });

  it('a pair ends after its miss: the next round opens by itself, nothing scored', async () => {
    const r = await game();
    expect(progress(r)).toBe('1 / 3');
    const spec = await hear(r);
    await tapOption(r, otherOptions(r, spec.text)[0]!);
    await tick(6000);
    expect(progress(r)).toBe('2 / 3');
    expect(answers).toEqual([]);
  });

  it('the miss is announced once by romanization: Hoya\'s line, then the two items', async () => {
    const r = await game();
    const spec = await hear(r);
    const wrong = otherOptions(r, spec.text)[0]!;
    await tapOption(r, wrong);
    const live = textsOf(r).filter((t) => t.startsWith(C.missHoya) && t !== C.missHoya);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((t) => !HANGUL.test(t))).toBe(true);
    expect(live[0]).toContain(`${KO_OF[spec.text]!}, `);
  });
});

describe('a triple stays open after a miss (section 3.7)', () => {
  const triple = async (): Promise<ReactTestRenderer> => game('quest', ['dal-tal-ttal', 'da-ta']);

  it('a miss compares and locks the tapped option; the round is still open and the second miss rings the right one', async () => {
    const r = await triple();
    // Find a triple round: the draw may open the pair first, so go on until the triple is on screen.
    for (let i = 0; i < 2; i++) {
      const spec = await hear(r);
      if (SET_OF[spec.text] === 'dal-tal-ttal') break;
      await tapOption(r, KO_OF[spec.text]!);
      await tick(5000);
    }
    const spec = audio.played.filter((s) => SET_OF[s.text] === 'dal-tal-ttal').at(-1)!;
    const wrongs = otherOptions(r, spec.text);
    expect(wrongs).toHaveLength(2);
    const right = KO_OF[spec.text]!;
    const label = (id: string): string => String(byTestId(r.root, `listen-pick-option-${id}`).find((n) => n.props['aria-label'] !== undefined)!.props['aria-label']);
    await tapOption(r, wrongs[0]!);
    expect(hasId(r.root, 'contrast-compare')).toBe(true);
    // Still open: no kind lines on the options yet, no ring, and the tapped one is locked.
    expect(byTestId(r.root, `contrast-kind-${right}`)).toHaveLength(0);
    expect(label(wrongs[0]!)).toContain(en.a11y.minigame.option.wrong(''));
    expect(label(right)).not.toContain(en.a11y.minigame.option.hint(''));
    // The second miss rings the right option (as every Listen & Pick round).
    await tick(500);
    await tapOption(r, wrongs[1]!);
    expect(label(right)).toContain(en.a11y.minigame.option.hint(''));
    expect(answers).toEqual([]);
    expect(completed).toBe(0);
    // The right option can still be tapped: the round resolves, and all three members show their kind lines.
    await tick(500);
    expect(textsOf(r)).toContain(C.missHoya);
    await tapOption(r, right);
    // The right answer is not "Listen to both.": Hoya's miss line leaves with the round's open state.
    expect(textsOf(r)).not.toContain(C.missHoya);
    const lines = [right, ...wrongs].map((id) => textOf(byTestId(r.root, `contrast-kind-${id}`)[0]!));
    expect(new Set(lines)).toEqual(new Set([C.kind.plain, C.kind.aspirated, C.kind.tense]));
    expect(answers).toEqual([]);
  });
});

describe('a right answer (section 3.7)', () => {
  it('every option shows its meaning and kind line, is named by both, and has a button that plays its own clip', async () => {
    const r = await game();
    const spec = await hear(r);
    const right = KO_OF[spec.text]!;
    await tapOption(r, right);
    for (const id of [right, ...otherOptions(r, spec.text)]) {
      const ko = Object.keys(KO_OF).find((k) => KO_OF[k] === id)!;
      const kind = KIND_OF[ko] === 'plain' ? C.kind.plain : C.kind.aspirated;
      expect(textOf(byTestId(r.root, `contrast-kind-${id}`)[0]!)).toBe(kind);
      const card = byTestId(r.root, `listen-pick-option-${id}`).find((n) => n.props['aria-label'] !== undefined)!;
      expect(String(card.props['aria-label'])).toContain(`${id}, ${kind}`);
      expect(HANGUL.test(String(card.props['aria-label']))).toBe(false);
    }
    audio.played.length = 0;
    const other = otherOptions(r, spec.text)[0]!;
    await press(pressableById(r.root, `contrast-hear-${other}`));
    await tick(0);
    expect(audio.played).toHaveLength(1);
    expect(audio.played[0]).toMatchObject({ clipOnly: true });
    expect(KO_OF[audio.played[0]!.text]).toBe(other);
    expect(noDanger(r)).toBe(true);
    expect(answers).toEqual([]);
  });
});

describe('the gloss after the answer follows the UI language (section 3.7, CLAUDE.md languages)', () => {
  const glossOf = (r: ReactTestRenderer, id: string): string => textOf(byTestId(r.root, `listen-pick-option-${id}`)[0]!);

  it.each([
    ['es', 'la sílaba'],
    ['ko', '음절'],
  ] as const)('a Stage 1 syllable option shows the %s gloss, not the English "the syllable"', async (locale, word) => {
    useLocaleStore.setState({ device: locale });
    const r = await game();
    const spec = await hear(r);
    const right = KO_OF[spec.text]!;
    await tapOption(r, right);
    for (const id of [right, ...otherOptions(r, spec.text)]) {
      const text = glossOf(r, id);
      expect(text).toContain(word);
      expect(text).toContain(id);
      expect(text).not.toContain('the syllable');
    }
  });

  it('keeps the gloss the scope itself holds for an option (a localized round written out in full), not the catalogue English', async () => {
    useLocaleStore.setState({ device: 'es' });
    const full = (setId: string): ListenPickRound => {
      const members = fixture.sets.find((s) => s.id === setId)!.members;
      return {
        id: `lp:pair:${setId}`,
        contrastSet: setId,
        prompt: { ko: members[0]!.text, romanization: members[0]!.romanization, en: `ES ${members[0]!.romanization}` },
        options: members.map((m) => ({ id: m.romanization, text: { ko: m.text, romanization: m.romanization, en: `ES ${m.romanization}` } })),
        answerId: members[0]!.romanization,
      };
    };
    const r = await gameOf(['ga-ka', 'da-ta', 'ja-cha'].map(full));
    const spec = await hear(r);
    const right = KO_OF[spec.text]!;
    await tapOption(r, right);
    for (const id of [right, ...otherOptions(r, spec.text)]) {
      expect(glossOf(r, id)).toContain(`ES ${id}`);
      expect(glossOf(r, id)).not.toContain('the syllable');
    }
  });
});

describe("Can't hear it? on a contrast round (section 3.9)", () => {
  it('is guidance only: the line and Hear it, no Show the letters, and the prompt\'s Korean is never printed', async () => {
    const r = await game();
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    await press(pressableById(r.root, 'cant-hear'));
    expect(hasId(r.root, 'cant-hear-sheet')).toBe(true);
    expect(hasId(r.root, 'cant-hear-show-letters')).toBe(false);
    expect(hasId(r.root, 'cant-hear-hear')).toBe(true);
    expect(byTestId(r.root, 'listen-pick-prompt-text')).toHaveLength(0);
  });

  it('once the learner has opened it, the step\'s later contrast rounds are dropped after the current one; the current round stays answerable, unscored', async () => {
    const r = await game();
    expect(progress(r)).toBe('1 / 3');
    await press(pressableById(r.root, 'cant-hear'));
    expect(progress(r)).toBe('1 / 1');
    const spec = await hear(r);
    await tapOption(r, KO_OF[spec.text]!);
    await tick(6000);
    expect(completed).toBe(1);
    expect(answers).toEqual([]);
  });
});

describe('a scope that holds contrast and plain rounds together', () => {
  const plainRound = (n: number): ListenPickRound => ({
    id: `lp:syl:plain${n}`,
    prompt: { ko: '나', romanization: 'na', en: 'the syllable na' },
    options: [
      { id: 'a', text: { ko: '나', romanization: 'na', en: 'the syllable na' } },
      { id: 'b', text: { ko: '마', romanization: 'ma', en: 'the syllable ma' } },
    ],
    answerId: 'a',
  });

  it('expands a contrast stub into its set (the members as options, a target from the set): no blank option cards', async () => {
    const r = await gameOf([lp.pair('ga-ka'), plainRound(1)]);
    expect(progress(r)).toBe('1 / 2');
    expect(byTestId(r.root, 'listen-pick-option-ga').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-option-ka').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-option-a')).toHaveLength(0);
    const spec = await hear(r);
    expect(['ga', 'ka']).toContain(KO_OF[spec.text]);
    expect(spec).toMatchObject({ clipOnly: true });
  });

  it("Can't hear it? on the contrast round drops only the later contrast rounds: the plain rounds stay", async () => {
    const r = await gameOf([lp.pair('ga-ka'), plainRound(1), plainRound(2)]);
    expect(progress(r)).toBe('1 / 3');
    await press(pressableById(r.root, 'cant-hear'));
    expect(progress(r)).toBe('1 / 3');
  });

  it("Can't hear it? drops a later contrast round and keeps the plain one between", async () => {
    const r = await gameOf([lp.pair('ga-ka'), plainRound(1), lp.pair('da-ta')]);
    expect(progress(r)).toBe('1 / 3');
    await press(pressableById(r.root, 'cant-hear'));
    expect(progress(r)).toBe('1 / 2');
  });
});

describe('the other Listen & Pick rounds are as before', () => {
  it('a plain round still reports to the host and has no compare row', async () => {
    const plain: ListenPickRound = {
      id: 'lp:syl:가',
      prompt: { ko: '가', romanization: 'ga', en: 'the syllable ga' },
      options: [
        { id: 'a', text: { ko: '가', romanization: 'ga', en: 'the syllable ga' } },
        { id: 'b', text: { ko: '나', romanization: 'na', en: 'the syllable na' } },
      ],
      answerId: 'a',
    };
    const host: MinigameHost = { mode: 'quest', answer: (round, correct) => void answers.push([round, correct]), complete: () => void (completed += 1) };
    const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: [plain] } }} host={host} />, { createNodeMock: focusNodes(['listen-pick-speaker']) as never });
    mounted.push(r);
    await tick(SCREEN_SETTLE_MS);
    await press(pressableById(r.root, 'listen-pick-option-b'));
    expect(answers).toEqual([[0, false]]);
    expect(byTestId(r.root, 'contrast-compare')).toHaveLength(0);
    expect(open(r)).toBeDefined();
  });
});
