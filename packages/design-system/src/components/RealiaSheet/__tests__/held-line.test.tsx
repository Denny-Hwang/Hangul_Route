import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Part, Title } from '../RealiaSheet';

/**
 * A held realia romanization line (AMENDMENTS-STAGE1-DECODING-CHECK DC-1c): a Check's open question keeps the line's room
 * but draws it invisible and hidden from assistive tech, in a line's part and in the title. Called directly with
 * react-native's hosts as plain tags, as the other component tests do.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: { OS: 'ios' } }));
vi.mock('react-native-svg', () => ({ Svg: 'Svg', Circle: 'Circle', Ellipse: 'Ellipse', Line: 'Line', Path: 'Path', Polygon: 'Polygon', Rect: 'Rect' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});

type Props = Record<string, unknown>;
type El = ReactElement<Props>;
const kids = (el: El): El[] => Children.toArray(el.props.children as ReactNode).filter(isValidElement) as El[];
const style = (el: El): Props => el.props.style as Props;

describe('a realia part and title with a held romanization', () => {
  it('Part: a drawn line is plain; a held one is the same Text, invisible and off the accessibility tree', () => {
    const drawn = kids(Part({ part: { ko: '사과', romanization: 'sagwa' } }) as El)[1]!;
    expect(style(drawn).opacity).toBeUndefined();
    expect(drawn.props['aria-hidden']).toBeUndefined();
    const held = kids(Part({ part: { ko: '사과', romanization: 'sagwa', romanizationReserved: true } }) as El)[1]!;
    expect(style(held).opacity).toBe(0);
    expect(held.props['aria-hidden']).toBe(true);
    expect(held.props.accessibilityElementsHidden).toBe(true);
    expect(held.props.importantForAccessibility).toBe('no');
    expect(style(held).fontSize).toBe(style(drawn).fontSize);
  });

  it('Part: an empty romanization draws no line at all, reserved or not', () => {
    expect(kids(Part({ part: { ko: '사과', romanization: '', romanizationReserved: true } }) as El)).toHaveLength(1);
  });

  it('Title: the same contract', () => {
    const drawn = kids(Title({ title: { ko: '시장', romanization: 'sijang' }, centered: false }) as El)[1]!;
    expect(style(drawn).opacity).toBeUndefined();
    const held = kids(Title({ title: { ko: '시장', romanization: 'sijang', romanizationReserved: true }, centered: false }) as El)[1]!;
    expect(style(held).opacity).toBe(0);
    expect(held.props['aria-hidden']).toBe(true);
    expect(held.props.importantForAccessibility).toBe('no');
  });
});
