import type { ReactElement } from 'react';
import { View } from 'react-native';
import { REALIA_KIND_REGISTRY } from '../../scene-art/realia-kinds-registry';
import { borderWidth, colors, spacing } from '../../tokens';
import { Icon } from '../Icon';
import { Dressing, LineButton, RealiaSheet, SheetGroup, Title } from './RealiaSheet';
import { REALIA_KIND_LOOKS, REALIA_PIN_SIZE, REALIA_TILE, isRealiaAddedKind, realiaRowRule, type RealiaKindDressing, type RealiaKindLook } from './kinds-style';
import type { RealiaAddedKind, RealiaSheetProps } from './types';

/**
 * RealiaKindSheet: the eight realia layouts of F-CURR-002 row CM-47 (a recipe card, a receipt, a packaged-food
 * label, a weather forecast card, a calendar page, a timetable, a park map and a poster), with the same two layers
 * as `RealiaSheet`: decorative scene art (`REALIA_KIND_REGISTRY`, hidden from assistive tech) around live text,
 * each line a button (tap = hear it; never an answer) at least `touchTarget.min` tall, with the same found and
 * look-here marks. A G-2 kind, or one this build does not know, is `RealiaSheet`'s own (the plain sheet at worst).
 * It lives in the realia kinds chunk (`screen-chunk:realia-kinds`) and is reached by its own path, never a barrel.
 * Design: design/screens/minigame-realia-read/ (D9-D12), design/wireframes/minigame/realia-read.md "The eight kinds".
 */

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

function Strip({ dressing }: { dressing: RealiaKindDressing }): ReactElement {
  return (
    <View style={dressing.band ? { backgroundColor: dressing.band, borderTopLeftRadius: spacing.sm, borderTopRightRadius: spacing.sm } : undefined}>
      <Dressing refId={dressing.ref} height={dressing.height} stretch={dressing.stretch} centered={dressing.centered ?? false} registry={REALIA_KIND_REGISTRY} />
    </View>
  );
}

function body(kind: RealiaAddedKind, look: RealiaKindLook, props: RealiaSheetProps): ReactElement {
  const { title, titleLabel, lines, lineHint, onPressLine, testID } = props;
  const lineId = (id: string): string | undefined => (testID ? `${testID}-line-${id}` : undefined);
  const heading = title ? <Title title={title} label={titleLabel} centered={look.centeredTitle} /> : null;
  const sheet = { ...look.paper, padding: spacing.md, gap: spacing.sm };

  switch (look.anatomy) {
    case 'tiles':
      return (
        <View style={sheet}>
          {heading}
          <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {lines.map((line) => (
              <View role="listitem" key={line.id} style={{ flexGrow: 1, flexBasis: look.tileMin, minWidth: look.tileMin, ...REALIA_TILE }}>
                <LineButton line={line} layout="stack" hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
              </View>
            ))}
          </View>
        </View>
      );
    case 'poster':
      return (
        <View style={{ ...sheet, paddingVertical: spacing.lg, alignItems: 'stretch' }}>
          {heading}
          <View role="list" style={{ gap: spacing.xs }}>
            {lines.map((line) => (
              <View role="listitem" key={line.id}>
                <LineButton line={line} layout="stack" hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
              </View>
            ))}
          </View>
        </View>
      );
    case 'legend':
      return (
        <View style={sheet}>
          {heading}
          <View role="list" style={{ gap: spacing.xs }}>
            {lines.map((line) => (
              <View role="listitem" key={line.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View {...hidden}>
                  <Icon name="pin" size={REALIA_PIN_SIZE} color={colors.text.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <LineButton line={line} layout="row" leader={look.leader} hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    default:
      // rows: a recipe card, a receipt, a label, a timetable.
      return (
        <View style={{ ...sheet, gap: spacing.xs }}>
          {title ? (
            <View style={kind === 'label' ? { borderBottomWidth: borderWidth.thick, borderColor: look.paper.borderColor, paddingBottom: spacing.xs } : undefined}>{heading}</View>
          ) : null}
          <View role="list">
            {lines.map((line, i) => (
              <View role="listitem" key={line.id} style={{ ...realiaRowRule(look, i), paddingVertical: spacing.xxs }}>
                <LineButton line={line} layout="row" leader={look.leader} hint={lineHint} onPress={onPressLine} testID={lineId(line.id)} />
              </View>
            ))}
          </View>
        </View>
      );
  }
}

export function RealiaKindSheet(props: RealiaSheetProps): ReactElement {
  const { kind, accessibilityLabel, testID } = props;
  if (!isRealiaAddedKind(kind)) return <RealiaSheet {...props} />;
  const look = REALIA_KIND_LOOKS[kind];
  return (
    <SheetGroup accessibilityLabel={accessibilityLabel} testID={testID}>
      <View testID={testID ? `${testID}-kind-${kind}` : undefined} style={{ width: '100%', maxWidth: look.maxWidth, alignSelf: 'center' }}>
        {look.top ? <Strip dressing={look.top} /> : null}
        {body(kind, look, props)}
        {look.bottom ? <Strip dressing={look.bottom} /> : null}
      </View>
    </SheetGroup>
  );
}
