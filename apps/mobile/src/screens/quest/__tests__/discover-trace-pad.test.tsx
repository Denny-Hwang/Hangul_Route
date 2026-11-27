import type { DiscoverPage } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { reviewedStrokeIds, strokesForJamo, type JamoStrokePoint } from '../../../content/jamo-strokes';
import { TRACE_IDLE_MS } from '../../../logic/trace-evaluator';
import { TRACE_KEEP_GOING_MS } from '../../../logic/trace-ready';
import { WRITE_ADVANCE_MS } from '../../../logic/stage1/discover-write';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { DiscoverStep } from '../DiscoverStep';
import { srOnly } from '../../minigames/sr-only';
import { discoverTraceDoor } from '../discover-trace-entry';

/**
 * [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE §6 tests 11 to 16 (row TC-1b): the trace page of Discover, "Trace the new letters",
 * on quest 1's pages (ㅏ ㅓ, ㄱ ㄴ) at a 390 x 844 window, with fake timers and a drawing driven through the pan gesture.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const bound = (await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!);
  return { ...(await importOriginal<object>()), ...bound };
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

interface Touch {
  id: number;
  x: number;
  y: number;
}
type Handler = (e?: { changedTouches?: Touch[] }) => void;
const pan = vi.hoisted(() => ({ latest: {} as Record<string, Handler> }));
vi.mock('react-native-gesture-handler', () => {
  const Pan = () => {
    const handlers: Record<string, Handler> = {};
    pan.latest = handlers;
    const on = (name: string) => (fn: Handler) => ((handlers[name] = fn), builder);
    const set = () => () => builder;
    const builder: Record<string, unknown> = {
      minDistance: set(),
      maxPointers: set(),
      onBegin: on('begin'),
      onUpdate: on('update'),
      onEnd: on('end'),
      onFinalize: on('finalize'),
      onTouchesDown: on('touchesDown'),
      onTouchesMove: on('touchesMove'),
      onTouchesUp: on('touchesUp'),
      onTouchesCancelled: on('touchesCancelled'),
    };
    return builder;
  };
  return { Gesture: { Pan }, GestureDetector: ({ children }: { children: ReactNode }) => children };
});
/** Show me stands in as a recorder of its props (the real one is checked in stroke-hint-shape.test.tsx). */
interface HintProps {
  orderTaught: boolean;
  romanization: string;
  onComplete?: () => void;
}
const hint = vi.hoisted(() => ({ last: null as HintProps | null, shown: 0 }));
vi.mock('../../../components/StrokeHint', () => ({
  StrokeHint: (props: HintProps) => {
    hint.last = props;
    return null;
  },
}));
/** The reviewed list the gate reads: empty as shipped; a test may mark a jamo taught. */
const gate = vi.hoisted(() => ({ reviewed: [] as string[] }));
vi.mock('../../../logic/stroke-order-taught', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../logic/stroke-order-taught')>();
  return {
    strokeOrderTaught: (id: string) => real.strokeOrderTaught(id, gate.reviewed),
    unitOrderTaught: (letters: readonly { jamoIds?: readonly string[] }[]) => real.unitOrderTaught(letters, gate.reviewed),
  };
});

const m = getMessages('en');
const COPY = m.learner.quest.discover;
const WRITE = COPY.write;
const TRACE = m.learner.minigame.trace;
const QUEST = questById('quest:stage1-letters-q1')!;
const PAGES: DiscoverPage[] = QUEST.steps.find((s) => s.kind === 'discover')!.discover!.pages;
const mounted: ReactTestRenderer[] = [];
const GHOST_WIDTH = 18;
const INK_WIDTH = 8;

beforeAll(async () => {
  await discoverTraceDoor.load();
});
beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useLocaleStore.setState({ device: 'en' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  useQuestRunStore.getState().reset();
  hint.last = null;
  gate.reviewed = [];
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
  vi.useRealTimers();
});

const wait = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const fire = async (name: string, touch?: Touch): Promise<void> => {
  await act(async () => {
    pan.latest[name]?.(touch ? { changedTouches: [touch] } : undefined);
  });
};
const canvasSize = (root: ReactTestInstance): number =>
  (root.find((n) => typeof n.type !== 'string' && n.props.nativeID === 'trace-canvas').props.style as { width: number }).width;
const paths = (root: ReactTestInstance, width: number): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === width).length;
const texts = (r: ReactTestRenderer): string[] => screenTexts(r.root);
const named = (r: ReactTestRenderer, label: string): ReactTestInstance[] => buttonsNamed(r.root, label);
const tap = async (r: ReactTestRenderer, label: string): Promise<void> => {
  await press(named(r, label)[0]!);
  await wait(0);
};
/** The line Hoya's strip shows now: the live region's (praise, keep going) or the idle / Shape guide line; the hidden room-holding copy is not it. */
const line = (r: ReactTestRenderer): string => {
  const live = screenTexts(byTestId(r.root, 'discover-write-live-line')[0]!).join(' ');
  return live !== '' ? live : (byTestId(r.root, 'discover-write-line')[0] ? screenTexts(byTestId(r.root, 'discover-write-line')[0]!).join(' ') : '');
};
const done = (r: ReactTestRenderer, jamoId: string): boolean => byTestId(r.root, `discover-write-done-${jamoId}`).length > 0;
const heading = (r: ReactTestRenderer): string => screenTexts(byTestId(r.root, 'discover-write-heading')[0]!).filter((t) => t.startsWith('Trace the')).slice(-1)[0] ?? '';

/** One stroke through viewBox points: down, each segment walked in a few moves, up. */
async function draw(root: ReactTestInstance, points: readonly JamoStrokePoint[], movesPerSegment = 6): Promise<void> {
  const k = canvasSize(root) / 200;
  const at = (p: JamoStrokePoint): { x: number; y: number } => ({ x: p.x * k, y: p.y * k });
  await fire('begin');
  await fire('touchesDown', { id: 0, ...at(points[0]!) });
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (let j = 1; j <= movesPerSegment; j += 1) {
      await fire('touchesMove', { id: 0, ...at({ x: a.x + ((b.x - a.x) * j) / movesPerSegment, y: a.y + ((b.y - a.y) * j) / movesPerSegment }) });
    }
  }
  await fire('touchesUp', { id: 0, ...at(points[points.length - 1]!) });
  await fire('finalize');
}
/** Every stroke of a letter's shown form. */
async function drawLetter(r: ReactTestRenderer, jamoId: string): Promise<void> {
  for (const stroke of strokesForJamo(jamoId)!) await draw(r.root, stroke);
}

/** Quest 1's step, opened on its trace page: Continue twice (two letter pages), the canvas laid out at 300. */
async function openTracePage(onDone: (result: { pages: number; heard: number; written?: number; writeSeconds?: number }) => void = () => undefined): Promise<ReactTestRenderer> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 390, height: 844 })}>
      <DiscoverStep pages={PAGES} onDone={onDone} writeOnce />
    </LayoutProvider>,
  );
  mounted.push(r);
  await wait(10);
  await tap(r, COPY.continue.cta);
  await tap(r, COPY.continue.cta);
  await layOut(r);
  return r;
}
async function layOut(r: ReactTestRenderer): Promise<void> {
  for (let pass = 0; pass < 2; pass += 1) {
    const slot = r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'discover-write-canvas-slot' && typeof n.props.onLayout === 'function');
    await act(async () => {
      for (const v of slot) (v.props.onLayout as ((e: unknown) => void) | undefined)?.({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
    });
  }
}

describe('[TC] the trace page opens', () => {
  it('is the third page, with the first letter, the idle line, no sound and Continue enabled', async () => {
    const r = await openTracePage();
    expect(texts(r)).toContain('Page 3 of 3');
    expect(heading(r)).toBe('Trace the letter a');
    expect(line(r)).toBe(WRITE.idle);
    expect(texts(r).join(' ')).toContain(m.a11y.discoverWriteProgress(0, 4));
    expect(canvasSize(r.root)).toBeGreaterThanOrEqual(160);
    expect(paths(r.root, GHOST_WIDTH)).toBe(2); // ㅏ has two strokes
    expect(rig.current!.synth.spoken).toEqual([]);
    for (const label of [COPY.hearIt.cta, TRACE.showMe.cta, TRACE.clear.cta, WRITE.next.cta, COPY.continue.cta]) expect(named(r, label)).toHaveLength(1);
    expect(named(r, 'Done')).toHaveLength(0);
  });

  it('says the letter row and the page label through the repo\'s srOnly style, not opacity 0 (VoiceOver skips it)', async () => {
    const r = await openTracePage();
    const holders = r.root.findAll((n) => typeof n.type !== 'string' && n.props.style === srOnly);
    const said = holders.map((h) => screenTexts(h).join(' ')).join(' | ');
    expect(said).toContain(m.a11y.discoverWriteProgress(0, 4));
    expect(holders.every((h) => (h.props.style as { opacity?: number }).opacity === undefined)).toBe(true);
  });

  it('never sits in a scroll view: the canvas has no scrolling ancestor', async () => {
    const r = await openTracePage();
    const canvas = r.root.find((n) => typeof n.type !== 'string' && n.props.nativeID === 'trace-canvas');
    let node: ReactTestInstance | null = canvas.parent;
    while (node) {
      const name = typeof node.type === 'string' ? node.type : ((node.type as { displayName?: string; name?: string }).displayName ?? (node.type as { name?: string }).name ?? '');
      expect(name).not.toMatch(/ScrollView/);
      node = node.parent;
    }
  });
});

describe('[TC] test 11: a finished letter is praised, the chip fills, the next letter comes up', () => {
  it('ㅏ finished: praise after TRACE_IDLE_MS, a filled chip, no ink during the beat, ㅓ with an empty canvas after WRITE_ADVANCE_MS', async () => {
    const r = await openTracePage();
    await drawLetter(r, 'jamo:a');
    expect(paths(r.root, INK_WIDTH)).toBe(2);
    expect(done(r, 'jamo:a')).toBe(false);
    await wait(TRACE_IDLE_MS - 100);
    expect(done(r, 'jamo:a')).toBe(false);
    await wait(150);
    expect(line(r)).toBe(TRACE.pass.clean);
    expect(done(r, 'jamo:a')).toBe(true);
    // During the beat the canvas takes no ink.
    await draw(r.root, [{ x: 20, y: 20 }, { x: 60, y: 60 }]);
    expect(paths(r.root, INK_WIDTH)).toBe(2);
    expect(heading(r)).toBe('Trace the letter a');
    await wait(WRITE_ADVANCE_MS);
    expect(heading(r)).toBe('Trace the letter eo');
    expect(paths(r.root, INK_WIDTH)).toBe(0);
    expect(line(r)).toBe(WRITE.idle);
    expect(done(r, 'jamo:a')).toBe(true);
    // Nothing is scored, answered or stored.
    const run = useQuestRunStore.getState();
    expect(run.totalCount).toBe(0);
    expect(run.correctCount).toBe(0);
  });

  it('Clear during the beat and Next letter during the beat do nothing (no double advance)', async () => {
    const r = await openTracePage();
    await drawLetter(r, 'jamo:a');
    await wait(TRACE_IDLE_MS + 50);
    expect(done(r, 'jamo:a')).toBe(true);
    await tap(r, WRITE.next.cta);
    await tap(r, TRACE.clear.cta);
    expect(heading(r)).toBe('Trace the letter a');
    expect(paths(r.root, INK_WIDTH)).toBe(2);
    await wait(WRITE_ADVANCE_MS);
    expect(heading(r)).toBe('Trace the letter eo');
    await wait(WRITE_ADVANCE_MS * 2);
    expect(heading(r)).toBe('Trace the letter eo');
  });

  it('a letter finished is recorded once, however the page is left', async () => {
    const onDone = vi.fn();
    const r = await openTracePage(onDone);
    await drawLetter(r, 'jamo:a');
    await wait(TRACE_IDLE_MS + WRITE_ADVANCE_MS + 50);
    await tap(r, COPY.continue.cta);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ pages: 3, written: 1 }));
  });
});

describe('[TC] test 12: an unfinished drawing waits; Next letter passes over a letter', () => {
  it('half of ㅏ for 10 s: still ㅏ, no fill, and after 3 s the line names Next letter', async () => {
    const r = await openTracePage();
    await draw(r.root, strokesForJamo('jamo:a')![0]!);
    await wait(TRACE_KEEP_GOING_MS - 200);
    expect(line(r)).not.toBe(WRITE.keepGoing);
    await wait(300);
    expect(line(r)).toBe(WRITE.keepGoing);
    await wait(10_000);
    expect(heading(r)).toBe('Trace the letter a');
    expect(done(r, 'jamo:a')).toBe(false);
    expect(line(r)).not.toBe(TRACE.pass.clean);
  });

  it('a rough but complete drawing (every stroke, one too short) gets the same line, never praise', async () => {
    const r = await openTracePage();
    const [stem, bar] = strokesForJamo('jamo:a')!;
    await draw(r.root, stem!);
    await draw(r.root, [bar![0]!, { x: bar![0]!.x + (bar![1]!.x - bar![0]!.x) * 0.3, y: bar![0]!.y }]);
    await wait(TRACE_IDLE_MS + TRACE_KEEP_GOING_MS + 200);
    expect(line(r)).toBe(WRITE.keepGoing);
    expect(line(r)).not.toBe(TRACE.pass.clean);
    expect(done(r, 'jamo:a')).toBe(false);
  });

  it('Next letter shows the next letter, the passed chip stays plain, and a new stroke goes back to the idle line', async () => {
    const r = await openTracePage();
    await draw(r.root, strokesForJamo('jamo:a')![0]!);
    await wait(TRACE_KEEP_GOING_MS + 100);
    await tap(r, WRITE.next.cta);
    expect(heading(r)).toBe('Trace the letter eo');
    expect(done(r, 'jamo:a')).toBe(false);
    expect(paths(r.root, INK_WIDTH)).toBe(0);
    expect(line(r)).toBe(WRITE.idle);
    expect(line(r)).not.toBe(WRITE.keepGoing);
  });

  it('a stroke after the keep-going line puts the idle line back', async () => {
    const r = await openTracePage();
    await draw(r.root, strokesForJamo('jamo:a')![0]!);
    await wait(TRACE_KEEP_GOING_MS + 100);
    expect(line(r)).toBe(WRITE.keepGoing);
    await draw(r.root, [{ x: 100, y: 100 }, { x: 140, y: 100 }]);
    expect(line(r)).not.toBe(WRITE.keepGoing);
  });
});

describe('[TC] test 13: the last letter', () => {
  async function toLastLetter(): Promise<ReactTestRenderer> {
    const r = await openTracePage();
    for (let i = 0; i < 3; i += 1) await tap(r, WRITE.next.cta);
    return r;
  }

  it('has no Next letter, keeps its praise, and Clear empties the canvas and brings the idle line back', async () => {
    const r = await toLastLetter();
    expect(heading(r)).toBe('Trace the letter n');
    expect(named(r, WRITE.next.cta)).toHaveLength(0);
    expect(byTestId(r.root, 'discover-write-next-place')).toHaveLength(1);
    await drawLetter(r, 'jamo:nieun');
    await wait(TRACE_IDLE_MS + 50);
    expect(line(r)).toBe(TRACE.pass.clean);
    await wait(5000);
    expect(line(r)).toBe(TRACE.pass.clean);
    expect(heading(r)).toBe('Trace the letter n');
    expect(paths(r.root, INK_WIDTH)).toBeGreaterThan(0);
    await tap(r, TRACE.clear.cta);
    expect(paths(r.root, INK_WIDTH)).toBe(0);
    expect(line(r)).toBe(WRITE.idle);
    // A second finish praises again; the chip is already filled.
    await drawLetter(r, 'jamo:nieun');
    await wait(TRACE_IDLE_MS + 50);
    expect(line(r)).toBe(TRACE.pass.clean);
    expect(done(r, 'jamo:nieun')).toBe(true);
  });

  it('its keep-going line names Continue', async () => {
    const r = await toLastLetter();
    await draw(r.root, [{ x: 50, y: 40 }, { x: 50, y: 90 }]);
    await wait(TRACE_KEEP_GOING_MS + 100);
    expect(line(r)).toBe(WRITE.keepGoingLast);
  });
});

describe('[TC] test 14: Show me', () => {
  it('on an untaught letter is a shape reveal with the "Shape guide" line, and plays the card\'s sound (가 for ㄱ), not the name', async () => {
    const r = await openTracePage();
    await tap(r, WRITE.next.cta);
    await tap(r, WRITE.next.cta);
    expect(heading(r)).toBe('Trace the letter g/k');
    await tap(r, TRACE.showMe.cta);
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'g/k' });
    expect(line(r)).toBe(TRACE.shapeGuide);
    expect(paths(r.root, GHOST_WIDTH)).toBe(0);
    await wait(50);
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['가']);
    await act(async () => {
      hint.last?.onComplete?.();
    });
    expect(line(r)).not.toBe(TRACE.shapeGuide);
    expect(paths(r.root, GHOST_WIDTH)).toBeGreaterThan(0);
  });

  it('on a letter a person has checked it plays the ordered animation (orderTaught true); tracing writes nothing to the list', async () => {
    gate.reviewed = ['jamo:a'];
    const before = [...reviewedStrokeIds];
    const r = await openTracePage();
    await tap(r, TRACE.showMe.cta);
    expect(hint.last).toMatchObject({ orderTaught: true });
    expect(line(r)).not.toBe(TRACE.shapeGuide);
    await drawLetter(r, 'jamo:a');
    await wait(TRACE_IDLE_MS + WRITE_ADVANCE_MS + 100);
    expect([...reviewedStrokeIds]).toEqual(before);
    expect(gate.reviewed).toEqual(['jamo:a']);
  });
});

describe('[TC] test 15: Hear it', () => {
  it('plays the card\'s sound, adds write|<jamo> to heard, and nothing played when the page opened', async () => {
    const onDone = vi.fn();
    const r = await openTracePage(onDone);
    expect(rig.current!.synth.spoken).toEqual([]);
    await tap(r, COPY.hearIt.cta);
    await wait(50);
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['아']);
    await tap(r, COPY.continue.cta);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ heard: 1 }));
  });

  it('a play that cannot sound shows the slot\'s status panel in the strip\'s place (sound off), and no "Can\'t hear it?" link here', async () => {
    const r = await openTracePage();
    useAudioStore.setState({ muted: true });
    await tap(r, COPY.hearIt.cta);
    await wait(50);
    expect(byTestId(r.root, 'discover-sound-write').length).toBeGreaterThan(0);
    expect(texts(r).join(' ')).not.toMatch(/Can.t hear it/);
  });
});

describe('[TC] test 16: Continue on the trace page', () => {
  it('with nothing drawn reports written 0 and the whole seconds the page was shown', async () => {
    const onDone = vi.fn();
    const r = await openTracePage(onDone);
    await wait(7400);
    await tap(r, COPY.continue.cta);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ pages: 3, heard: 0, written: 0, writeSeconds: 7 });
  });

  it('Previous goes back to the letter page and Continue returns to the same letter with its chips', async () => {
    const r = await openTracePage();
    await drawLetter(r, 'jamo:a');
    await wait(TRACE_IDLE_MS + WRITE_ADVANCE_MS + 100);
    expect(heading(r)).toBe('Trace the letter eo');
    await tap(r, 'Previous');
    expect(texts(r)).toContain('Page 2 of 3');
    await tap(r, COPY.continue.cta);
    await layOut(r);
    expect(heading(r)).toBe('Trace the letter eo');
    expect(done(r, 'jamo:a')).toBe(true);
  });
});

describe('[TC] quest 8: the songpyeon picture is on the final ㅇ card (OD-TC-3)', () => {
  it('the card of a letter with a picture draws that picture beside its example', async () => {
    const page: DiscoverPage = {
      items: [
        {
          type: 'jamo',
          jamoId: 'jamo:ieung-batchim',
          example: { ko: '송편', romanization: 'songpyeon', en: 'half-moon rice cake', syllables: ['song', 'pyeon'] },
          picture: 'card:songpyeon',
        },
      ],
    };
    const r = await render(<DiscoverStep pages={[page]} onDone={() => undefined} />);
    mounted.push(r);
    await wait(10);
    expect(r.root.findAll((n) => n.props.pictureRef === 'card:songpyeon').length).toBeGreaterThan(0);
  });
});
