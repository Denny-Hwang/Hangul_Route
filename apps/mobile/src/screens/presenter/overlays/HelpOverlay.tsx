import type { RomanizationMode } from '@hangul-route/content-schema';
import { Icon, borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import React, { useRef } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { HELP_KEYS, type KeyCap } from '../../../logic/lecture/help-keys';
import { HELP_WIDTH, KBD_MIN, KEY_COL } from '../stage-metrics';
import { usePresenterView } from '../presenter-context';
import { ChipRadios, Cover, ToolButton } from './OverlayParts';

/**
 * Keys and controls (H or ?; design/screens/presenter/overlays.md "Help", README D13): every key
 * of section 3.5 as key caps beside what it does, two columns from `layout.breakpoint.wide`; the
 * clicker line; the Romanization switch (flips the deck's option live, section 3.7); Keep controls
 * visible (section 3.5); Close. Real pixels; it scrolls inside the stage box when taller.
 */
export function HelpOverlay({
  romanization,
  onRomanization,
  keepVisible,
  onKeepVisible,
  onClose,
}: {
  romanization: RomanizationMode;
  onRomanization: (mode: RomanizationMode) => void;
  keepVisible: boolean;
  onKeepVisible: (on: boolean) => void;
  onClose: () => void;
}): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.help;
  const { width } = useWindowDimensions();
  const twoColumns = width >= layout.breakpoint.wide;
  const close = useRef<View>(null);
  const cap = (c: KeyCap, i: number): React.ReactElement => (
    <View
      key={i}
      style={{
        minWidth: KBD_MIN,
        minHeight: KBD_MIN,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
        borderWidth: borderWidth.base,
        borderColor: colors.border.strong,
        backgroundColor: colors.surface.paper,
      }}
    >
      {c.kind === 'arrow' ? (
        // arrow-right turned a quarter clockwise points down; arrow-left turned the same way points up.
        <View style={{ transform: [{ rotate: c.dir === 'up' || c.dir === 'down' ? '90deg' : '0deg' }] }}>
          <Icon name={c.dir === 'right' || c.dir === 'down' ? 'arrow-right' : 'arrow-left'} size={typography.size.body} color={colors.text.primary} />
        </View>
      ) : (
        <Text style={{ fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>{c.kind === 'named' ? m.key[c.name] : c.text}</Text>
      )}
    </View>
  );
  return (
    <Cover label={m.title} testID="presenter-help" initialFocus={close}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: layout.gutter.regular }}>
        <View style={{ width: '100%', maxWidth: HELP_WIDTH, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg }}>
            <Text role="heading" aria-level={2} style={{ fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {m.title}
            </Text>
            <ToolButton ref={close} testID="presenter-help-close" label={messages.common.buttons.close} onPress={onClose} />
          </View>
          <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, columnGap: spacing.xl }}>
            {HELP_KEYS.map((row) => (
              <View key={row.row} role="listitem" style={{ width: twoColumns ? '47%' : '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: KEY_COL, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{row.caps.map(cap)}</View>
                <Text style={{ flex: 1, fontSize: typography.size.body, color: colors.text.primary }}>{m.row[row.row]}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: typography.size.body, color: colors.text.secondary }}>{m.clicker}</Text>
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>{m.romanization}</Text>
            <ChipRadios
              testID="presenter-help-romanization"
              label={m.romanization}
              options={[
                { value: 'always', label: m.romanizationAlways },
                { value: 'tap', label: m.romanizationTap },
              ]}
              selected={romanization}
              onSelect={onRomanization}
            />
          </View>
          <KeepVisibleSwitch on={keepVisible} label={m.keepVisible} onChange={onKeepVisible} />
        </View>
      </ScrollView>
    </Cover>
  );
}

function KeepVisibleSwitch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }): React.ReactElement {
  return (
    <Pressable
      testID="presenter-help-keep-visible"
      role="switch"
      aria-checked={on}
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      style={(state) => ({
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        ...((state as { focused?: boolean }).focused
          ? ({ outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: borderWidth.base } as ViewStyle)
          : {}),
      })}
    >
      <View
        style={{
          width: spacing.xxl,
          height: spacing.xxl,
          borderRadius: radii.sm,
          borderWidth: borderWidth.thick,
          borderColor: colors.text.primary,
          backgroundColor: colors.surface.paper,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {on ? <Icon name="check" size={spacing.xl} color={colors.text.primary} /> : null}
      </View>
      <Text style={{ fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{label}</Text>
    </Pressable>
  );
}
