import { KOREAN_LINE_BREAK, Screen, TapBoard, TapControl, TapTarget, borderWidth, colors, radii, spacing, touchTarget, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { e2eLog as log } from './tap-board-e2e';
import type { RootStackParamList } from './types';

/**
 * The `TapBoard` e2e screen (docs/specs/AMENDMENTS-TOUCH.md row KT-1; fixture builds only), loaded by
 * `./tap-board-e2e.tsx` through its literal `import()`. Four targets of `touchTarget.hero` (96) on a row that wraps,
 * `spacing.md` (12) apart, and one plain control after them (in `TapControl`) within the gap reach of a target; under
 * them, in the `tall` layout, a block taller than any window so the screen scrolls and the board drives it. A pressed
 * target draws the press look of section 4.3 (`border.shape` at `borderWidth.thick`), so the e2e can read it.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'TapBoardE2e'>;

/** Target names: taught letters, so the screen carries no UI copy. */
const LETTERS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] as const;
const CONTROL = 'ㅁ';
/** The `tall` layout's block: taller than a tablet window, in tile rows. */
const TALL_ROWS = 20;

export function TapBoardE2eBody({ route }: Props): ReactElement {
  const { lock, layout, disabled = [] } = route.params;
  const scale = useTypeScale().size;
  return (
    <Screen testID="tap-board-e2e">
      <TapBoard lock={lock} testID="tap-board">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {LETTERS.map((letter, index) => (
            <TapTarget
              key={letter}
              accessibilityLabel={letter}
              disabled={disabled.includes(index)}
              testID={`tap-target-${index}`}
              onCommit={() => log.commits.push({ index, at: Date.now() })}
              style={({ pressed }) => ({
                width: touchTarget.hero,
                height: touchTarget.hero,
                borderRadius: radii.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: disabled.includes(index) ? colors.surface.sunken : colors.surface.paper,
                borderWidth: pressed ? borderWidth.thick : borderWidth.base,
                borderColor: pressed ? colors.border.shape : colors.border.subtle,
              })}
            >
              {() => <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.title, color: colors.text.primary }}>{letter}</Text>}
            </TapTarget>
          ))}
          <TapControl testID="tap-control-wrap">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CONTROL}
              testID="tap-control"
              onPress={() => {
                log.controls += 1;
              }}
              style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken, borderRadius: radii.pill }}
            >
              <Text {...KOREAN_LINE_BREAK} style={{ fontSize: scale.body, color: colors.text.primary }}>{CONTROL}</Text>
            </Pressable>
          </TapControl>
        </View>
      </TapBoard>
      {layout === 'tall' ? <View testID="tap-board-e2e-tall" style={{ height: touchTarget.hero * TALL_ROWS }} /> : null}
    </Screen>
  );
}
