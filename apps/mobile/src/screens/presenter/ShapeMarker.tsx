import { colors, presenter, typography } from '@hangul-route/design-system';
import React from 'react';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { MARKER_BODY_FACTOR, MARKER_GEOMETRY, MARKER_STROKE, MARKER_VIEWBOX, SVG_UI_FONT, units, type MarkerShape } from '../../logic/lecture/stage-constants';
import { usePresenterView } from './presenter-context';

/**
 * The shape and number marker (spec section 3.4; README Constants `--marker`): circle 1, triangle
 * 2, square 3, star 4, in `text.primary` on paper, so the room answers "triangle, 2" and colour is
 * never the only cue. 80 units square on a 100 viewBox. Named "Option 2, triangle" for assistive
 * tech. The order slide draws it (PR 7); the quiz options reuse it (PR 9).
 */
export function ShapeMarker({ shape, n }: { shape: MarkerShape; n: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = units(unit, MARKER_BODY_FACTOR * presenter.size.body);
  const g = MARKER_GEOMETRY[shape];
  const line = { fill: 'none', stroke: colors.text.primary, strokeWidth: MARKER_STROKE, strokeLinejoin: 'round' as const };
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARKER_VIEWBOX} ${MARKER_VIEWBOX}`}
      role="img"
      accessibilityLabel={messages.a11y.presenter.option(n, messages.a11y.presenter.shape[shape])}
    >
      {g.kind === 'circle' ? <Circle cx={g.cx} cy={g.cy} r={g.r} {...line} /> : null}
      {g.kind === 'rect' ? <Rect x={g.x} y={g.y} width={g.size} height={g.size} rx={g.rx} {...line} /> : null}
      {g.kind === 'path' ? <Path d={g.d} {...line} /> : null}
      <SvgText
        x={MARKER_VIEWBOX / 2}
        y={g.baseline}
        textAnchor="middle"
        fontSize={g.numeral}
        fontWeight={typography.weight.bold}
        fontFamily={SVG_UI_FONT}
        fill={colors.text.primary}
      >
        {String(n)}
      </SvgText>
    </Svg>
  );
}
