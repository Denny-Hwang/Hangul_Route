import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROGRESS_LABELS, progressA11y, type ProgressLabels } from '../../../labels';
import { Progress } from '../Progress';
import type { ProgressProps } from '../types';
import { borderWidth, colors } from '../../../tokens';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17d (audit A11Y-3: axe "progressbar without an accessible name"). Every `Progress`
 * has a name and a value in words, from the app's `ProgressLabelsContext` pair or the English default. Checked on the
 * element built by calling the component directly with react-native's hosts as plain tags; the context is read
 * through a mocked `useContext` (as Screen.header.test.tsx does).
 */
const labels = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { DEFAULT_PROGRESS_LABELS: fallback } = await import('../../../labels');
  const stubs = { useContext: (): unknown => labels.value ?? fallback };
  return { ...actual, ...stubs, default: { ...actual, ...stubs } };
});

type Props = Record<string, unknown>;
const bar = (props: Partial<ProgressProps>): Props => (Progress({ value: 2, max: 6, ...props }) as ReactElement<Props>).props;

const SPANISH: ProgressLabels = { name: 'Progreso', value: (now, max) => `${now} de ${max}` };

describe('Progress accessible name and value (AU-17d)', () => {
  afterEach(() => {
    labels.value = null;
  });

  it.each(['bar', 'dots'] as const)('%s: a progressbar with a name, its numbers and its value in words, for native and for the web', (variant) => {
    const props = bar({ variant });
    expect(props).toMatchObject({
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: 'Progress',
      accessibilityValue: { now: 2, min: 0, max: 6, text: '2 of 6' },
      'aria-label': 'Progress',
      'aria-valuenow': 2,
      'aria-valuemin': 0,
      'aria-valuemax': 6,
      'aria-valuetext': '2 of 6',
    });
  });

  it.each(['bar', 'dots'] as const)("%s: reads the app's localised pair from ProgressLabelsContext", (variant) => {
    labels.value = SPANISH;
    const props = bar({ variant });
    expect(props.accessibilityLabel).toBe('Progreso');
    expect(props['aria-label']).toBe('Progreso');
    expect(props['aria-valuetext']).toBe('2 de 6');
    expect(props.accessibilityValue).toEqual({ now: 2, min: 0, max: 6, text: '2 de 6' });
  });

  it('a meter that draws its own line is read with that line, so the spoken value is what the screen shows', () => {
    const props = bar({ label: '2 of 6 quests' });
    expect(props['aria-valuetext']).toBe('2 of 6 quests');
    expect(props['aria-label']).toBe('Progress');
  });

  it("the caller's own name and value text win", () => {
    labels.value = SPANISH;
    const props = bar({ accessibilityLabel: 'Steps', accessibilityValueText: 'Step 2 of 6', label: '2 / 6' });
    expect(props.accessibilityLabel).toBe('Steps');
    expect(props['aria-label']).toBe('Steps');
    expect(props['aria-valuetext']).toBe('Step 2 of 6');
  });

  it('the value never passes the ends: the words use the clamped number', () => {
    expect(bar({ value: 9, max: 6 })).toMatchObject({ 'aria-valuenow': 6, 'aria-valuetext': '6 of 6' });
    expect(bar({ value: -1, max: 6 })).toMatchObject({ 'aria-valuenow': 0, 'aria-valuetext': '0 of 6' });
  });

  it.each(['bar', 'dots'] as const)('%s decorative (a screen where nothing reads as a score): no progressbar, no name, no number, skipped by screen readers', (variant) => {
    const props = bar({ variant, decorative: true, testID: 'review-dots' });
    expect(props).toMatchObject({ 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', testID: 'review-dots' });
    for (const key of ['accessible', 'accessibilityRole', 'accessibilityLabel', 'accessibilityValue', 'aria-label', 'aria-valuenow', 'aria-valuemax', 'aria-valuetext']) {
      expect(key in props, key).toBe(false);
    }
  });

  it('keeps its testID', () => {
    expect(bar({ testID: 'quest-dots', variant: 'dots' }).testID).toBe('quest-dots');
  });
});

describe('[QB] the dot shown now (AMENDMENTS-QUEST-SOUND-BACK QB-1, QB-2)', () => {
  const dots = (props: Partial<ProgressProps>): ReactElement<Props>[] => (bar({ variant: 'dots', ...props }).children as [ReactElement<Props>[], unknown])[0];
  const style = (el: ReactElement<Props>): Record<string, unknown> => el.props.style as Record<string, unknown>;

  it('without `current` every dot is the plain dot, as always', () => {
    const all = dots({ value: 3, max: 6, testID: 'steps' });
    expect(all).toHaveLength(6);
    expect(all.every((d) => d.props.testID === undefined && style(d).borderWidth === undefined)).toBe(true);
  });

  it('the current dot is the same filled dot inside a ring; the meter keeps the furthest value', () => {
    const props = bar({ variant: 'dots', value: 5, max: 6, current: 3, testID: 'steps' });
    expect(props).toMatchObject({ 'aria-valuenow': 5 });
    const all = dots({ value: 5, max: 6, current: 3, testID: 'steps' });
    const ringed = all.filter((d) => d.props.testID === 'steps-current');
    expect(ringed).toHaveLength(1);
    expect(all.indexOf(ringed[0]!)).toBe(2);
    const ring = style(ringed[0]!);
    expect(ring.borderWidth).toBe(borderWidth.base);
    expect(ring.borderColor).toBe(colors.brand.primaryDark);
    const inner = ringed[0]!.props.children as ReactElement<Props>;
    expect(style(inner).backgroundColor).toBe(colors.brand.primary);
    // Filled dots: the furthest value, not the current one.
    expect(all.filter((d) => (d.props.testID === 'steps-current' ? style(d.props.children as ReactElement<Props>) : style(d)).backgroundColor === colors.brand.primary)).toHaveLength(5);
  });

  it('the ring takes no room: its extra size is given back as a negative margin', () => {
    const ring = style(dots({ value: 2, max: 2, current: 1, height: 12, testID: 'pages' })[0]!);
    const extra = (ring.width as number) - 12;
    expect(extra).toBeGreaterThan(0);
    expect(ring.height).toBe(ring.width);
    expect(ring.margin).toBe(-extra / 2);
  });

  it.each([
    ['secondary', colors.brand.secondaryDark],
    ['success', colors.feedback.successDark],
  ] as const)('the ring is the dark colour of the %s tone', (tone, dark) => {
    const ring = dots({ value: 2, max: 3, current: 1, tone, testID: 't' })[0]!;
    expect(style(ring).borderColor).toBe(dark);
  });

  it('the bar has no dots, so `current` changes nothing there', () => {
    expect(JSON.stringify(Progress({ value: 2, max: 6, current: 1 }))).toBe(JSON.stringify(Progress({ value: 2, max: 6 })));
  });
});

describe('progressA11y (pure)', () => {
  it('a blank name or text falls through to the next source, so the name is never empty', () => {
    expect(progressA11y(DEFAULT_PROGRESS_LABELS, 1, 3, { accessibilityLabel: ' ', accessibilityValueText: '', label: '  ' })).toEqual({
      name: 'Progress',
      valueText: '1 of 3',
    });
    expect(progressA11y({ name: '', value: (n, m) => `${n}/${m}` }, 1, 3).name).toBe('Progress');
  });

  it('with no words of its own: the labels pair', () => {
    expect(progressA11y(SPANISH, 3, 4)).toEqual({ name: 'Progreso', valueText: '3 de 4' });
  });
});
