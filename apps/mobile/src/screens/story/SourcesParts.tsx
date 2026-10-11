import {
  Body,
  Button,
  Caption,
  Card,
  Icon,
  KOREAN_LANGUAGE,
  Pill,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { hasHangul } from '../../logic/story/source-link';
import type { ApproximationView, CorrectionView, FactCardView, SourceView, SourcesCopy } from '../../logic/story/sources-view';

/**
 * The presentational pieces of the Sources screen (F-STORY-002 §3.8,
 * wireframe design/wireframes/story/reader.md I-J, screen spec
 * design/components/StorySourcesScreen/spec.md). No state and no rules: each
 * piece draws what `StorySourcesScreen` passes in. Tokens only.
 */

// `lang` and `aria-level` are web-only props react-native-web forwards to the DOM; spread so the
// native Text props need no type for them (the KoreanText pattern).
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };
const korean = (text: string): Record<string, string> => (hasHangul(text) ? koreanSpeech : {});
const headingLevel = (level: 1 | 2 | 3): Record<string, string | number> => ({ role: 'heading', 'aria-level': level });

/** A heading with a real level (screen 1, sections 2, "Sources (n)" 3). */
export function SourcesHeading({
  level,
  children,
  testID,
}: {
  level: 1 | 2 | 3;
  children: React.ReactNode;
  testID?: string;
}): React.ReactElement {
  const size = level === 1 ? typography.size.title : level === 2 ? typography.size.prompt : typography.size.body;
  return (
    <Text
      {...headingLevel(level)}
      accessibilityRole="header"
      testID={testID}
      style={{
        fontSize: size,
        lineHeight: size * typography.leading.normal,
        fontWeight: typography.weight.bold,
        color: colors.text.primary,
      }}
    >
      {children}
    </Text>
  );
}

/** Back (64) and the screen heading; stays above the scroll. */
export function SourcesHeader({ copy, onBack }: { copy: SourcesCopy; onBack: () => void }): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={copy.back}
        testID="story-sources-back"
        style={({ pressed }) => ({
          width: touchTarget.min,
          height: touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          backgroundColor: pressed ? colors.surface.sunken : 'transparent',
        })}
      >
        <Icon name="arrow-left" size={spacing.xxl} color={colors.text.secondary} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <SourcesHeading level={1} testID="story-sources-title">
          {copy.title}
        </SourcesHeading>
      </View>
    </View>
  );
}

/** A quiet show/hide row (How it was checked, Korean). */
export function Disclosure({
  label,
  open,
  onToggle,
  testID,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  testID: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        testID={testID}
        style={({ pressed }) => ({
          minHeight: touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.md,
          backgroundColor: pressed ? colors.surface.sunken : 'transparent',
        })}
      >
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="arrow-right" size={spacing.lg} color={colors.brand.primary} />
        </View>
        <Body weight="semibold" tone="brand">
          {label}
        </Body>
      </Pressable>
      {open ? <View style={{ paddingLeft: spacing.sm }}>{children}</View> : null}
    </View>
  );
}

/** Plain text that may hold a citation in Korean, marked `lang="ko"` when it does. */
export function CitationText({
  text,
  size = 'md',
  tone = 'primary',
  selectable = false,
  testID,
}: {
  text: string;
  size?: 'sm' | 'md';
  tone?: 'primary' | 'secondary';
  selectable?: boolean;
  testID?: string;
}): React.ReactElement {
  const fontSize = size === 'sm' ? typography.size.bodySm : typography.size.body;
  return (
    <Text
      {...korean(text)}
      selectable={selectable}
      testID={testID}
      style={{
        fontSize,
        lineHeight: fontSize * typography.leading.relaxed,
        color: tone === 'primary' ? colors.text.primary : colors.text.secondary,
        // Long URLs and titles wrap instead of widening the page.
        // @ts-expect-error web-only style react-native-web forwards
        overflowWrap: 'anywhere',
      }}
    >
      {text}
    </Text>
  );
}

export function CorrectionsList({ copy, corrections }: { copy: SourcesCopy; corrections: readonly CorrectionView[] }): React.ReactElement {
  return (
    <View style={{ gap: spacing.sm }} testID="story-sources-corrections">
      <SourcesHeading level={2}>{copy.corrections}</SourcesHeading>
      {corrections.map((c) => (
        <View key={c.id} style={{ gap: spacing.xxs }} testID={`story-sources-correction-${c.id}`}>
          <Caption tone="secondary">{c.date}</Caption>
          <Body>{c.summaryEn}</Body>
          {c.facts.map((f) => (
            <Caption key={f.id} tone="muted">
              {`${f.id}: ${f.claimEn}`}
            </Caption>
          ))}
        </View>
      ))}
    </View>
  );
}

/** One citation: one focusable group labelled "Source 2 of 3: title, publisher". */
export function SourceBlock({
  copy,
  source,
  note,
  onCopy,
  onOpen,
  testID,
}: {
  copy: SourcesCopy;
  source: SourceView;
  /** The outcome line (copied, or how to open it by hand), or null. */
  note: string | null;
  onCopy: () => void;
  onOpen: (() => void) | null;
  testID: string;
}): React.ReactElement {
  return (
    <View
      role="group"
      aria-label={source.label}
      accessibilityLabel={source.label}
      testID={testID}
      style={{
        gap: spacing.xs,
        paddingTop: spacing.sm,
        borderTopWidth: borderWidth.thin,
        borderTopColor: colors.border.subtle,
      }}
    >
      <Text {...korean(source.title)} style={{ fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
        {source.title}
      </Text>
      <Text style={{ fontSize: typography.size.bodySm, color: colors.text.secondary }}>
        <Text {...korean(source.publisher)}>{source.publisher}</Text>
        {` · ${source.accessedLabel}`}
      </Text>
      <CitationText text={source.quoteOrLocator} size="sm" />
      <CitationText text={source.url} size="sm" tone="secondary" selectable testID={`${testID}-url`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={copy.copyLink.cta} tone="ghost" size="md" onPress={onCopy} testID={`${testID}-copy`} />
        {onOpen ? <Button label={copy.openLink.cta} tone="secondary" size="md" onPress={onOpen} testID={`${testID}-open`} /> : null}
      </View>
      {note !== null ? (
        <View accessibilityLiveRegion="polite" aria-live="polite">
          <CitationText text={note} size="sm" selectable testID={`${testID}-note`} />
        </View>
      ) : null}
    </View>
  );
}

function Approximation({ item }: { item: ApproximationView }): React.ReactElement {
  return (
    <View style={{ gap: spacing.xxs }}>
      <Body size="sm" tone="secondary">
        {item.label}
      </Body>
      {item.note !== null ? (
        <Caption tone="muted">{item.note}</Caption>
      ) : null}
    </View>
  );
}

/** A fact card: scope, claim, Korean claim, its sources and approximations. */
export function FactCard({
  copy,
  fact,
  highlighted,
  koreanOpen,
  onToggleKorean,
  noteFor,
  onCopy,
  onOpen,
  onLayout,
}: {
  copy: SourcesCopy;
  fact: FactCardView;
  highlighted: boolean;
  koreanOpen: boolean;
  onToggleKorean: () => void;
  noteFor: (sourceIndex: number) => string | null;
  onCopy: (source: SourceView, sourceIndex: number) => void;
  onOpen: (source: SourceView, sourceIndex: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
}): React.ReactElement {
  const id = `story-sources-fact-${fact.id}`;
  return (
    <View onLayout={onLayout} style={{ gap: spacing.sm }}>
      <Card
        padding="md"
        elevation="flat"
        testID={id}
        style={{
          gap: spacing.sm,
          borderWidth: highlighted ? borderWidth.base : borderWidth.thin,
          borderColor: highlighted ? colors.border.focus : colors.border.subtle,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {highlighted ? <Pill label={copy.highlighted.pill} tone="info" size="sm" testID={`${id}-highlighted`} /> : null}
          <Pill label={fact.scopeLabel} tone={fact.scope === 'documented' ? 'neutral' : 'secondary'} size="sm" testID={`${id}-scope`} />
          {fact.updatedLabel !== null ? <Pill label={fact.updatedLabel} tone="info" size="sm" testID={`${id}-updated`} /> : null}
        </View>
        <Body testID={`${id}-claim`}>{fact.claimEn}</Body>
        <Disclosure label={copy.korean.cta} open={koreanOpen} onToggle={onToggleKorean} testID={`${id}-korean`}>
          <CitationText text={fact.claimKo} testID={`${id}-claim-ko`} />
        </Disclosure>
        <SourcesHeading level={3}>{fact.sourcesHeading}</SourcesHeading>
        <View role="list" style={{ gap: spacing.sm }}>
          {fact.sources.map((source, i) => (
            <View role="listitem" key={`${source.url}#${i}`}>
              <SourceBlock
                copy={copy}
                source={source}
                note={noteFor(i)}
                onCopy={() => onCopy(source, i)}
                onOpen={source.openable ? () => onOpen(source, i) : null}
                testID={`${id}-source-${i}`}
              />
            </View>
          ))}
        </View>
      </Card>
      {fact.approximations.map((a) => (
        <Approximation key={`${a.text}\n${a.rationaleEn}`} item={a} />
      ))}
    </View>
  );
}

/** "See fact f3": a later citation is one row that jumps to the card. */
export function SeeFactRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      testID={testID}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.surface.sunken : 'transparent',
      })}
    >
      <Icon name="arrow-right" size={spacing.lg} color={colors.brand.primary} />
      <Body weight="semibold" tone="brand">
        {label}
      </Body>
    </Pressable>
  );
}
