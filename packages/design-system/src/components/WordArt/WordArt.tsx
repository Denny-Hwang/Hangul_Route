import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { borderWidth, colors } from '../../tokens';
import { wordArtModel } from '../../word-art/model';
import type { WordArtModel } from '../../word-art/model';
import type { RenderShape } from '../../word-art/render';
import type { WordArtProps } from './types';

/**
 * WordArt: a vocabulary word's picture (F-VOC-002 §3.7), hand-authored data
 * on a 0 0 100 100 viewBox with design tokens only. What to draw and how to
 * name it is decided in `word-art/model.ts`; this only paints the render list.
 * An unknown key renders nothing, so the caller shows its text tile. No
 * motion inside the art. Design: design/components/WordArt/spec.md.
 */

const TAGS = { circle: Circle, ellipse: Ellipse, rect: Rect, path: Path } as const;

function Shape({ shape }: { shape: RenderShape }): React.ReactElement {
  const Tag = TAGS[shape.tag] as React.ComponentType<Record<string, unknown>>;
  return (
    <Tag
      {...shape.geometry}
      fill={shape.fill}
      stroke={shape.stroke}
      strokeWidth={shape.strokeWidth}
      strokeLinecap={shape.strokeLinecap}
      strokeLinejoin={shape.strokeLinejoin}
      opacity={shape.opacity}
    />
  );
}

/**
 * The painted picture of a model, without hooks (tests call it directly). A
 * named picture is one `image` element with its label; a decorative one is
 * hidden on every platform: `aria-hidden` is the attribute react-native-web
 * writes to the DOM, the other two are the native iOS and Android props.
 * `flagged` (development builds only, like StoryScene) draws a dashed frame
 * round a picture that carries the meaning but was given a blank label.
 */
export function WordArtView({ model, testID, flagged = false }: { model: WordArtModel; testID?: string; flagged?: boolean }): React.ReactElement {
  const named = model.label !== undefined;
  return (
    <View
      testID={testID}
      accessible={named}
      accessibilityRole={named ? 'image' : undefined}
      accessibilityLabel={model.label}
      aria-hidden={model.decorative ? true : undefined}
      accessibilityElementsHidden={model.decorative}
      importantForAccessibility={model.decorative ? 'no-hide-descendants' : undefined}
      style={{
        width: model.size,
        height: model.size,
        ...(flagged ? { borderWidth: borderWidth.base, borderStyle: 'dashed', borderColor: colors.border.strong } : {}),
      }}
    >
      <Svg width={model.size} height={model.size} viewBox={model.viewBox}>
        {model.shapes.map((shape, index) => (
          <Shape key={index} shape={shape} />
        ))}
      </Svg>
    </View>
  );
}

function WordArtBase({ artKey, size, mono, decorative, accessibilityLabel, testID }: WordArtProps): React.ReactElement | null {
  const model = useMemo(() => wordArtModel({ artKey, size, mono, decorative, accessibilityLabel }), [artKey, size, mono, decorative, accessibilityLabel]);
  if (model === null) return null;
  return <WordArtView model={model} testID={testID} flagged={__DEV__ && model.unlabelled} />;
}

/** Memoised: a glyph is data and never changes while it is shown. */
export const WordArt = React.memo(WordArtBase);
