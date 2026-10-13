import { Body, Button, Caption, Card, Heading, Icon, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import { LOCALE_META, getMessages, type UiLocale } from '@hangul-route/i18n';
import { TRANSFER_CONSENT_LOCALES, type TransferConsentLocale } from '@hangul-route/content-schema';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LanguageChips } from '../../components/LanguageChips';
import { consentLines, identityLines, readToEndOpen, type ConsentSheetData } from '../../logic/transfers/consent-sheet';

const LANGUAGE_OPTIONS = TRANSFER_CONSENT_LOCALES.map((locale) => ({ locale, endonym: LOCALE_META[locale].endonym, htmlLang: LOCALE_META[locale].htmlLang }));

export interface ConsentSheetProps {
  data: ConsentSheetData;
  /** The sheet's starting language (the UI locale when it has a consent text). */
  initialLocale: TransferConsentLocale;
  /** A self-only device: "Move to {Destination}?" and "Yes, move me". */
  self: boolean;
  /** One line above the title ("Please check this again.", "This text was updated. Please read it again."). */
  notice?: string | null;
  /** One line under the buttons (`role="alert"`). */
  error?: string | null;
  busy: boolean;
  /** Back, drawn above the title by the screen. */
  header: React.ReactNode;
  onYes: (locale: TransferConsentLocale, introduce: boolean) => void;
  onNotNow: () => void;
}

/**
 * The app consent sheet — F-SPACE-002 section 4.11, T-7c (`design/screens/transfer/consent-sheet.md`, app
 * column; `app-sheets.md`). The canonical lines in the chosen language with every list open, the identity
 * block, the introduce option (off by default), then the buttons as the last element. The primary waits
 * until the end marker after `cannot_undo` has been in view once (D2), a scroll rule only.
 */
export function ConsentSheet({ data, initialLocale, self, notice, error, busy, header, onYes, onNotNow }: ConsentSheetProps): React.ReactElement {
  const [locale, setLocale] = useState<TransferConsentLocale>(initialLocale);
  const [introduce, setIntroduce] = useState(false);
  const [markerY, setMarkerY] = useState<number | null>(null);
  const [viewport, setViewport] = useState(0);
  const [read, setRead] = useState(false);
  const frame = getMessages(locale);
  const c = frame.console.transfer.consent;
  const lines = useMemo(() => consentLines(data, locale) ?? [], [data, locale]);
  const identity = useMemo(() => identityLines(data.destination, locale), [data.destination, locale]);

  const check = (scrollY: number, m: number | null = markerY, h: number = viewport): void => {
    if (!read && readToEndOpen({ markerY: m, scrollY, viewportHeight: h })) setRead(true);
  };

  const title = self ? frame.caregiver.transfer.consent.titleSelf(data.destination.name) : c.title(data.learnerName, data.destination.name);
  const yes = self ? frame.caregiver.transfer.consent.yesSelf : c.yes(data.learnerName);
  const statements = lines.filter((l) => l.id !== 'introduce');
  const option = lines.find((l) => l.id === 'introduce');

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      scrollEventThrottle={64}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        setViewport(h);
        check(0, markerY, h);
      }}
      onScroll={(e) => check(e.nativeEvent.contentOffset.y)}
      keyboardShouldPersistTaps="handled"
    >
      {header}
      {notice ? (
        <>
          <Card padding="md" tone="sunken">
            <Body>{notice}</Body>
          </Card>
          <Spacer size="md" />
        </>
      ) : null}
      <View {...{ lang: LOCALE_META[locale].htmlLang }}>
        <Heading level="title">{title}</Heading>
      </View>
      <Spacer size="md" />
      <Caption tone="secondary" weight="semibold">
        {c.language}
      </Caption>
      <Spacer size="xs" />
      <LanguageChips options={LANGUAGE_OPTIONS} selected={locale} onSelect={(l: UiLocale) => setLocale(l as TransferConsentLocale)} groupLabel={c.language} testID="consent-language" />
      <Spacer size="lg" />
      <View {...{ lang: LOCALE_META[locale].htmlLang }} style={{ gap: spacing.md }}>
        <Card padding="md" tone="sunken">
          <Caption tone="secondary" weight="semibold">
            {c.who}
          </Caption>
          <Spacer size="xxs" />
          <Body weight="semibold">{data.destination.name}</Body>
          {identity.map((line) => (
            <Caption key={line} tone="secondary">
              {line}
            </Caption>
          ))}
        </Card>
        {statements.map((line) =>
          line.kind === 'list' ? (
            <View key={line.id} testID={`consent-line-${line.id}`}>
              <Body weight="semibold">{line.text}</Body>
              <View accessibilityRole="list" style={{ gap: spacing.xxs, paddingTop: spacing.xs }}>
                {line.items.map((item) => (
                  <View key={item} accessibilityRole={'listitem' as never} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Body tone="secondary">{'•'}</Body>
                    <View style={{ flex: 1 }}>
                      <Body tone="secondary">{item}</Body>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View key={line.id} testID={`consent-line-${line.id}`}>
              <Body weight={line.conditional ? 'semibold' : 'regular'}>{line.text}</Body>
            </View>
          ),
        )}
        {option ? (
          <Pressable
            testID="consent-introduce"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: introduce }}
            aria-checked={introduce}
            onPress={() => setIntroduce((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.child }}
          >
            <View
              style={{
                width: spacing.xl,
                height: spacing.xl,
                borderRadius: radii.sm,
                borderWidth: borderWidth.base,
                borderColor: colors.brand.primary,
                backgroundColor: introduce ? colors.brand.primary : colors.surface.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {introduce ? <Icon name="check" size={16} color={colors.text.onPrimary} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Body>{option.text}</Body>
            </View>
          </Pressable>
        ) : null}
      </View>
      {/* The end marker (D2): measured inside the scrolled content. */}
      <View
        testID="consent-end"
        onLayout={(e) => {
          const y = e.nativeEvent.layout.y;
          setMarkerY(y);
          check(0, y, viewport);
        }}
        style={{ height: 1 }}
      />
      <Spacer size="lg" />
      <Button
        label={yes}
        tone="primary"
        size="lg"
        fullWidth
        disabled={!read || busy}
        accessibilityHint={read ? undefined : c.readToEnd}
        onPress={() => onYes(locale, introduce)}
        testID="consent-yes"
      />
      <Spacer size="sm" />
      <Button label={c.notNow.cta} tone="ghost" size="lg" fullWidth disabled={busy} onPress={onNotNow} testID="consent-not-now" />
      {error ? (
        <View accessibilityRole="alert" style={{ paddingTop: spacing.md }}>
          <Body tone="secondary" align="center">
            {error}
          </Body>
        </View>
      ) : null}
    </ScrollView>
  );
}
