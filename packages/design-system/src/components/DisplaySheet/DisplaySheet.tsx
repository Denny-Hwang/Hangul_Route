import React, { useEffect, useId, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { KOREAN_LINE_BREAK } from '../../line-break';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '../../tokens';
import { Button } from '../Button';
import { Body, Heading } from '../Heading';
import { useLayoutClass } from '../Layout';
import { Spacer } from '../Spacer';
import { useTypeScale } from '../TextSize';
import { radioAfter, segmentGlyphSize, showLanguageRow, type DisplayOption } from './model';
import type { DisplaySheetProps } from './types';

/**
 * DisplaySheet — the Display (Aa) sheet (owner items 6 and 7): the device's UI language and text
 * size, the one record every surface reads. A bottom sheet on phones and a centred dialog from
 * the regular class. Two segmented controls (radio groups): Language (endonyms, each in its own
 * `lang`; hidden with one language) and Text size (four steps, each segment drawing the caller's
 * glyph, "Aa", at that step), then a live preview line at the chosen size. A text size applies at
 * once; another language first shows the caller's confirm step, written in that language, in place
 * of the radios (Use / Back; F-I18N-001 §3.3). Done only closes. No copy of its own: every label
 * comes from the caller's dictionary. Not behind the grown-up gate (display only, reversible).
 * Spec: docs/specs/AMENDMENTS-DISPLAY-NAV.md section 3.6, design/components/DisplaySheet/spec.md.
 */

/** The handle drawn on the phone sheet (32 x 4). */
const HANDLE_W = spacing.xxl;
const HANDLE_H = spacing.xs;
/** The dialog's width from the regular class (600, AMENDMENTS-DISPLAY-NAV section 3.6): the reading width. */
const DIALOG_MAX = layout.maxWidth.reading;

type Pressed = { pressed: boolean; focused?: boolean };

/** Anything React Native Web can move focus to (a View or Pressable node on the web; absent on native). */
type Focusable = { focus?: () => void } | null;

const focusNode = (node: Focusable): void => {
  if (Platform.OS === 'web') node?.focus?.();
};

/**
 * How a row lays its segments out: `content` (languages) sizes each to its endonym and wraps when the
 * row is full; `pairs` (text size on a phone) is two per row, so four steps fit 320 wide at Largest;
 * `even` (text size in the dialog) is four equal columns.
 */
type RowLayout = 'content' | 'pairs' | 'even';

/** The basis of a segment: two per row leave room for the gap between them. */
const PAIR_BASIS = '45%';

function segmentStyle(selected: boolean, state: Pressed, layout: RowLayout): Record<string, unknown> {
  const focused = state.focused === true;
  return {
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    flexGrow: 1,
    flexBasis: layout === 'pairs' ? PAIR_BASIS : layout === 'even' ? 0 : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: selected ? colors.brand.primary : colors.surface.paper,
    borderWidth: focused ? borderWidth.thick : borderWidth.base,
    borderColor: focused || state.pressed ? colors.border.focus : selected ? colors.brand.primary : colors.border.strong,
  };
}

function RadioRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  testID,
  layout,
  renderOption,
  focusSelectedOnMount = false,
}: {
  label: string;
  options: readonly DisplayOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  testID: string;
  layout: RowLayout;
  renderOption: (option: DisplayOption<T>, isSelected: boolean) => React.ReactNode;
  /** Focus the selected radio when the row mounts (the confirm step that held focus just closed). */
  focusSelectedOnMount?: boolean;
}): React.ReactElement {
  const refs = useRef(new Map<T, Focusable>());
  const values = options.map((o) => o.value);
  // Roving focus (WAI-ARIA radio group, README D19): only the selected radio is a Tab stop; the
  // arrows, Home and End move focus and the selection together.
  const onKey = (event: { key: string; preventDefault?: () => void }): void => {
    const next = radioAfter(values, selected, event.key);
    if (next === null) return;
    event.preventDefault?.();
    if (next !== selected) onSelect(next);
    focusNode(refs.current.get(next) ?? null);
  };
  useEffect(() => {
    if (focusSelectedOnMount) focusNode(refs.current.get(selected) ?? null);
    // Mount only: a later selection moves focus through the keys themselves.
  }, []);
  return (
    <View role="radiogroup" aria-label={label} accessibilityLabel={label} testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            ref={(node: unknown) => {
              refs.current.set(option.value, node as Focusable);
            }}
            role="radio"
            aria-checked={isSelected}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={option.label}
            {...(option.lang ? { accessibilityLanguage: option.lang, lang: option.lang } : {})}
            {...{ tabIndex: isSelected ? 0 : -1, onKeyDown: onKey }}
            testID={`${testID}-${option.value}`}
            onPress={() => onSelect(option.value)}
            style={(state: Pressed) => segmentStyle(isSelected, state, layout)}
          >
            {renderOption(option, isSelected)}
          </Pressable>
        );
      })}
    </View>
  );
}

export function DisplaySheet({
  visible,
  title,
  language,
  textSize,
  note,
  children,
  doneLabel,
  closeLabel,
  onClose,
  testID = 'display-sheet',
}: DisplaySheetProps): React.ReactElement {
  const titleId = `${testID}-title-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const dialog = useLayoutClass().width !== 'compact';
  const scale = useTypeScale();
  const labelSize = scale.size.bodySm;
  const showLanguage = language !== null && showLanguageRow(language.options);
  // The focused radio or button unmounts when the confirm step opens or closes: focus moves to the
  // confirm question when it opens, and back to the selected language when Use or Back closes it.
  const confirming = language?.confirm != null;
  const wasConfirming = useRef(confirming);
  const focusLanguageOnMount = wasConfirming.current && !confirming;
  const questionRef = useRef<Focusable>(null);
  useEffect(() => {
    if (confirming && !wasConfirming.current) focusNode(questionRef.current);
    wasConfirming.current = confirming;
  }, [confirming]);

  // Escape closes the sheet on the web, on keydown, and stops there: a page's own Escape under the sheet (an All
  // lessons card page closing) does not also run (AMENDMENTS-DISPLAY-NAV section 7.1).
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    type KeyEvent = { key?: string; stopPropagation?: () => void };
    const doc = (globalThis as { document?: { addEventListener: (t: string, f: (e: KeyEvent) => void) => void; removeEventListener: (t: string, f: (e: KeyEvent) => void) => void } }).document;
    if (!doc) return undefined;
    const onKey = (event: KeyEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation?.();
      onClose();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const optionText = (text: string, isSelected: boolean, extra: Record<string, unknown> = {}): React.ReactElement => (
    <Text
      {...KOREAN_LINE_BREAK}
      {...extra}
      style={{
        fontSize: labelSize,
        lineHeight: scale.lineHeight(labelSize, 'tight'),
        fontWeight: typography.weight.semibold,
        color: isSelected ? colors.text.onPrimary : colors.text.primary,
        textAlign: 'center',
      }}
    >
      {text}
    </Text>
  );

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          testID={`${testID}-scrim`}
        />
        <View
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          testID={testID}
          style={{
            width: '100%',
            maxWidth: dialog ? DIALOG_MAX : undefined,
            maxHeight: '90%',
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: dialog ? radii.xl : 0,
            borderBottomRightRadius: dialog ? radii.xl : 0,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.lg,
            ...shadows.modal,
          }}
        >
          {dialog ? null : (
            <View
              aria-hidden
              style={{ alignSelf: 'center', width: HANDLE_W, height: HANDLE_H, borderRadius: radii.pill, backgroundColor: colors.border.strong, marginBottom: spacing.md }}
            />
          )}
          <ScrollView style={{ flexShrink: 1 }}>
            <View nativeID={titleId} {...{ id: titleId }}>
              <Heading level="prompt">{title}</Heading>
            </View>
            {children ? (
              <>
                <Spacer size="md" />
                {children}
              </>
            ) : null}
            {showLanguage && language ? (
              <>
                <Spacer size="md" />
                <Body weight="bold">{language.label}</Body>
                <Spacer size="xs" />
                {language.confirm ? (
                  <View
                    testID={`${testID}-language-confirm`}
                    accessibilityLiveRegion="polite"
                    {...{ accessibilityLanguage: language.confirm.lang, lang: language.confirm.lang }}
                    style={{ gap: spacing.sm }}
                  >
                    <View
                      ref={(node: unknown) => {
                        questionRef.current = node as Focusable;
                      }}
                      {...{ tabIndex: -1 }}
                      testID={`${testID}-language-question`}
                    >
                      <Body weight="semibold">{language.confirm.question}</Body>
                    </View>
                    <Button label={language.confirm.use} tone="primary" size="md" fullWidth onPress={language.confirm.onUse} testID={`${testID}-language-use`} />
                    <Button label={language.confirm.back} tone="ghost" size="md" fullWidth onPress={language.confirm.onBack} testID={`${testID}-language-back`} />
                  </View>
                ) : (
                  <RadioRow
                    label={language.label}
                    options={language.options}
                    selected={language.selected}
                    onSelect={language.onSelect}
                    testID={`${testID}-language`}
                    layout="content"
                    focusSelectedOnMount={focusLanguageOnMount}
                    renderOption={(option, isSelected) => optionText(option.label, isSelected, option.lang ? { lang: option.lang } : {})}
                  />
                )}
              </>
            ) : null}
            <Spacer size="md" />
            <Body weight="bold">{textSize.label}</Body>
            <Spacer size="xs" />
            <RadioRow
              label={textSize.label}
              options={textSize.options}
              selected={textSize.selected}
              onSelect={textSize.onSelect}
              testID={`${testID}-text-size`}
              layout={dialog ? 'even' : 'pairs'}
              renderOption={(option, isSelected) => {
                const glyph = segmentGlyphSize(option.value);
                return (
                  <>
                    <Text
                      {...KOREAN_LINE_BREAK}
                      aria-hidden
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={{ fontSize: glyph, lineHeight: scale.lineHeight(glyph, 'tight'), fontWeight: typography.weight.bold, color: isSelected ? colors.text.onPrimary : colors.text.primary }}
                    >
                      {textSize.glyph}
                    </Text>
                    {optionText(option.label, isSelected)}
                  </>
                );
              }}
            />
            <Spacer size="sm" />
            <View
              testID={`${testID}-sample`}
              accessibilityLiveRegion="polite"
              style={{ padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }}
            >
              <Body size="lg">{textSize.sample}</Body>
            </View>
            {note ? (
              <>
                <Spacer size="md" />
                <Body tone="secondary">{note}</Body>
              </>
            ) : null}
            <Spacer size="lg" />
            <Button label={doneLabel} tone="primary" size="md" fullWidth onPress={onClose} testID={`${testID}-done`} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
