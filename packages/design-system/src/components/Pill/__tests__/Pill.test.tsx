import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { colors } from '../../../tokens';
import { Pill } from '../Pill';
import { PILL_TONES, pillStyle } from '../style';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17b (audit A11Y-1): the nudge pill's caption-size label is `text.primary` on the amber
 * tint (the old literal amber was 2.85:1). Checked on the element tree built by calling the component directly with
 * react-native's hosts as plain tags (as Tile.test.tsx does).
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('../../Icon/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});

type Props = Record<string, unknown>;
type El = ReactElement<Props>;
const kids = (el: El): El[] => (Children.toArray(el.props.children as ReactNode) as El[]).filter((k) => isValidElement(k));
const all = (el: El): El[] => [el, ...kids(el).flatMap((k) => all(k))];

describe('Pill tones (AU-17b)', () => {
  it('nudge: text.primary on the amber tint', () => {
    expect(pillStyle('nudge')).toEqual({ backgroundColor: colors.feedback.nudgeLight, textColor: colors.text.primary });
  });

  it('a nudge pill paints its label, and its glyph, in text.primary on feedback.nudgeLight', () => {
    const el = Pill({ label: 'Due today', tone: 'nudge', size: 'sm', icon: 'replay' }) as El;
    expect((el.props.style as Props).backgroundColor).toBe(colors.feedback.nudgeLight);
    const text = all(el).find((e) => e.type === 'Text')!;
    expect((text.props.style as Props).color).toBe(colors.text.primary);
    expect(all(el).find((e) => e.type === 'Icon')!.props.color).toBe(colors.text.primary);
  });

  it('every tone paints the pair its pure style names', () => {
    for (const tone of PILL_TONES) {
      const el = Pill({ label: 'x', tone }) as El;
      expect((el.props.style as Props).backgroundColor, tone).toBe(pillStyle(tone).backgroundColor);
      expect((all(el).find((e) => e.type === 'Text')!.props.style as Props).color, tone).toBe(pillStyle(tone).textColor);
    }
  });

  it('the default tone is neutral', () => {
    const el = Pill({ label: 'x' }) as El;
    expect((el.props.style as Props).backgroundColor).toBe(pillStyle('neutral').backgroundColor);
  });
});
