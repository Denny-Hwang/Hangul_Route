import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Circle, Path, Text as SvgText } from 'react-native-svg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoKnown } from '../../../content/jamo';
import { strokesForJamo } from '../../../content/jamo-strokes';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { STROKE_LINE } from '../../../logic/lecture/stage-constants';
import { render, textOf, unmount } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { LetterSlide } from '../slides/LetterSlide';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §6 test 9, OD-SO2 (design: presenter/slide-letter.md): an untaught letter's
 * stroke panel has no numbered start dots; on the stroke build the panel letter steps aside while `StrokeHint` plays
 * the shape reveal (`orderTaught` false, the slide's romanization) and comes back when it ends; under reduced motion
 * the unnumbered panel letter stays alone.
 *
 * Row SO-1b (owner decisions 2026-11-23): OD-SO8, the untaught panel's caption is "Letter shape" and a taught letter
 * has no caption (OD-SO8 as corrected 2026-11-23 to match spec §8 and F-TCH-004 §3.6, row SO-1d); OD-SO10, the shape
 * label reads a slash in the romanization with the deck language's word for "or", and the hint is given the same word.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
interface HintProps {
  orderTaught: boolean;
  romanization: string;
  romanizationOr?: string;
  onShow?: (mode: 'animated' | 'static') => void;
  onComplete?: () => void;
}
const hint = vi.hoisted(() => ({ last: null as HintProps | null, mounted: 0 }));
vi.mock('../../../components/StrokeHint', () => ({
  StrokeHint: (props: HintProps) => {
    hint.last = props;
    hint.mounted += 1;
    return null;
  },
}));

type LetterBody = Extract<Slide, { kind: 'letter' }>;
const ALL: ReadonlySet<BuildName> = new Set(['ko', 'rom', 'stroke', 'sound', 'name', 'example']);
const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  hint.last = null;
  hint.mounted = 0;
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

function letter(jamoId: string): LetterBody {
  const blocks: LectureBlock[] = [{ kind: 'jamo-set', jamoIds: [jamoId] }];
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:letter01', title: 'Letters', createdAt: '2026-10-29T09:00:00Z', seed: 3, blocks });
  const bundle = { ...lectureBundle('en'), jamoAll: jamoKnown };
  return expandDeck(deck, bundle, { canPlayKorean: true }).slides.find((s): s is LetterBody => s.kind === 'letter')!;
}

const element = (slide: LetterBody, strokeToken: number, locale: 'en' | 'es' | 'ko' = 'en') => (
  <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: false }}>
    <LetterSlide slide={slide} shown={ALL} strokeToken={strokeToken} onPlaySound={() => undefined} />
  </PresenterViewProvider>
);

const panelStrokes = (root: ReactTestInstance): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === STROKE_LINE).length;
const numerals = (root: ReactTestInstance): number => root.findAll((n) => n.type === SvgText || n.type === Circle).length;

describe('LetterSlide stroke panel, untaught letter (§6 test 9)', () => {
  const slide = letter('jamo:mieum');
  const n = strokesForJamo('jamo:mieum')!.length;

  it('the slide is untaught and its panel shows the letter with no numbered start dots, captioned "Letter shape" (OD-SO8)', async () => {
    expect(slide.strokeReviewed).toBe(false);
    const r = await render(element(slide, 0));
    mounted.push(r);
    expect(panelStrokes(r.root)).toBe(n);
    expect(numerals(r.root)).toBe(0);
    expect(textOf(r.root)).toContain('Letter shape');
    expect(textOf(r.root)).not.toContain('Simplified stroke guide');
    expect(textOf(r.root)).not.toContain('Shape guide');
    expect(hint.mounted).toBe(0);
  });

  it.each([
    ['es', 'Forma de la letra', 'Guía de trazos simplificada'],
    ['ko', '글자 모양', '간단한 획순 안내'],
  ] as const)('%s deck: the untaught caption is in the deck language (OD-SO8)', async (locale, shape, stroke) => {
    const r = await render(element(slide, 0, locale));
    mounted.push(r);
    expect(textOf(r.root)).toContain(shape);
    expect(textOf(r.root)).not.toContain(stroke);
  });

  it('the stroke build: a shape reveal (orderTaught false, the romanization); the panel letter steps aside, then is back', async () => {
    const r = await render(element(slide, 1));
    mounted.push(r);
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'm' });
    await act(async () => hint.last!.onShow?.('animated'));
    expect(panelStrokes(r.root)).toBe(0);
    await act(async () => hint.last!.onComplete?.());
    expect(panelStrokes(r.root)).toBe(n);
    expect(numerals(r.root)).toBe(0);
    // The hint (and its label) is gone once the reveal ends; the panel carries the shape label.
    const rendered = hint.mounted;
    await act(async () => r.update(element(slide, 1)));
    expect(hint.mounted).toBe(rendered);
    expect(r.root.findAll((x) => x.props.accessibilityLabel === 'm, shape guide.').length).toBeGreaterThan(0);
    // R plays it again.
    await act(async () => r.update(element(slide, 2)));
    await act(async () => hint.last!.onShow?.('animated'));
    expect(panelStrokes(r.root)).toBe(0);
  });

  it('reduced motion: the unnumbered panel letter stays alone (the still is not laid over it)', async () => {
    const r = await render(element(slide, 1));
    mounted.push(r);
    await act(async () => hint.last!.onShow?.('static'));
    const after = hint.mounted;
    await act(async () => r.update(element(slide, 1)));
    // The hint is gone for this play: a re-render of the slide does not render it again.
    expect(hint.mounted).toBe(after);
    expect(panelStrokes(r.root)).toBe(n);
    expect(numerals(r.root)).toBe(0);
  });
});

describe('LetterSlide stroke panel, "or" in the shape label (OD-SO10)', () => {
  const ieung = letter('jamo:ieung');
  it.each([
    ['en', 'or', 'silent or ng, shape guide.'],
    ['es', 'o', 'silent o ng, guía de la forma.'],
    ['ko', '또는', 'silent 또는 ng, 모양 안내.'],
  ] as const)('%s deck: the hint gets the deck word and the panel label reads it', async (locale, or, label) => {
    expect(ieung.romanization).toBe('silent/ng');
    const r = await render(element(ieung, 1, locale));
    mounted.push(r);
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'silent/ng', romanizationOr: or });
    await act(async () => hint.last!.onShow?.('animated'));
    await act(async () => hint.last!.onComplete?.());
    expect(r.root.findAll((x) => x.props.accessibilityLabel === label).length).toBeGreaterThan(0);
  });
});

describe('LetterSlide stroke panel, taught letter (after SO-3)', () => {
  it('has no caption: "Simplified stroke guide" goes away once a letter is reviewed (OD-SO8 as corrected, §8, F-TCH-004 §3.6)', async () => {
    const slide = { ...letter('jamo:mieum'), strokeReviewed: true };
    const r = await render(element(slide, 0));
    mounted.push(r);
    expect(textOf(r.root)).not.toContain('Simplified stroke guide');
    expect(textOf(r.root)).not.toContain('Letter shape');
  });

  it('keeps the numbered start dots and today\'s demo over the letter', async () => {
    const slide = { ...letter('jamo:mieum'), strokeReviewed: true };
    const r = await render(element(slide, 1));
    mounted.push(r);
    expect(hint.last).toMatchObject({ orderTaught: true });
    await act(async () => hint.last!.onShow?.('animated'));
    expect(panelStrokes(r.root)).toBe(3);
    expect(r.root.findAll((n) => n.type === SvgText).map((t) => t.props.children)).toEqual(['1', '2', '3']);
  });
});
