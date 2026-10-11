import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Icon,
  KoreanText,
  Pill,
  Progress,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useMediaSize,
} from '@hangul-route/design-system';
import type { KoText } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NarrationPartView, SceneKorean } from '../../logic/story/scene-view';

/**
 * The presentational pieces of the story reader (F-STORY-002 §3.3-3.7,
 * wireframe design/wireframes/story/reader.md A-F, H; component spec
 * design/components/StoryReaderView/spec.md). No state and no rules: each
 * piece draws what `StoryReaderView` passes in. Tokens only.
 */

type ReaderCopy = Messages['learner']['story']['reader'];
type EndCopy = Messages['learner']['story']['end'];
type KoreanItemLabel = Messages['a11y']['koreanItem'];

// ---------------------------------------------------------------------------
// Top bar: Close · fill-only dots · page number · (Sources, PR 2.7)
// ---------------------------------------------------------------------------

export function ReaderTopBar({
  copy,
  furthest,
  total,
  position,
  positionLabel,
  onClose,
  onSources,
}: {
  copy: ReaderCopy;
  /** 0-based furthest scene reached: the dots fill to it and never drop (D3). */
  furthest: number;
  total: number;
  /** "3 / 8": a page number, or null on the end page. */
  position: string | null;
  /** What a screen reader says for the page number ("Scene 3 of 8"), not "three slash eight". */
  positionLabel: string;
  onClose: () => void;
  onSources?: () => void;
}): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={copy.close}
        testID="story-reader-close"
        style={({ pressed }) => ({
          width: touchTarget.min,
          height: touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          backgroundColor: pressed ? colors.surface.sunken : 'transparent',
        })}
      >
        <Icon name="close" size={spacing.xxl} color={colors.text.secondary} />
      </Pressable>
      {/* The dots carry no value a screen reader can say; the labelled page number does (§3.10). */}
      <View
        style={{ flex: 1, alignItems: 'center', minWidth: 0 }}
        testID="story-reader-dots"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <Progress variant="dots" value={furthest + 1} max={total} height={spacing.sm} tone="primary" />
      </View>
      {position !== null ? (
        <View
          style={{ justifyContent: 'center' }}
          accessible
          accessibilityLabel={positionLabel}
          aria-label={positionLabel}
          role="group"
          testID="story-reader-position-group"
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <Pill label={position} size="md" tone="neutral" testID="story-reader-position" />
          </View>
        </View>
      ) : null}
      {onSources ? (
        <Button
          label={copy.sources.cta}
          tone="ghost"
          size="md"
          leading={<Icon name="library" size={spacing.xl} color={colors.brand.primary} />}
          onPress={onSources}
          testID="story-reader-sources"
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Narration card with inline term chips (§3.5)
// ---------------------------------------------------------------------------

export interface TermChipState {
  romanizationShown: boolean;
  open: boolean;
}

/**
 * The narration paragraph: English text with each `{kw}` drawn inline as a
 * `KoreanText` chip (Korean + romanization; tap = hear it and open the gloss
 * card). One `Text`, so the words wrap like a paragraph at any text size; the
 * chips are inline boxes (react-native-web renders a `View` inside `Text` as
 * `inline-flex`, native as an inline view).
 */
export function NarrationText({
  parts,
  copy,
  chipState,
  onTerm,
}: {
  parts: readonly NarrationPartView[];
  copy: ReaderCopy;
  chipState: (keywordId: string) => TermChipState;
  onTerm: (keywordId: string) => void;
}): React.ReactElement {
  return (
    <Text
      testID="story-reader-narration-text"
      style={{
        fontSize: typography.size.bodyLg,
        lineHeight: typography.size.bodyLg * typography.leading.relaxed,
        color: colors.text.primary,
      }}
    >
      {parts.map((part, i) => {
        if ('text' in part) return <Text key={`t${i}`}>{part.text}</Text>;
        const state = chipState(part.kw.id);
        return (
          <View
            key={`k${i}-${part.kw.id}`}
            style={{
              marginHorizontal: spacing.xxs,
              borderBottomWidth: borderWidth.thick,
              borderBottomColor: state.open ? colors.brand.secondaryDark : 'transparent',
            }}
          >
            <KoreanText
              ko={part.kw.ko}
              romanization={part.kw.romanization}
              size="sm"
              romanizationShown={state.romanizationShown}
              onPress={() => onTerm(part.kw.id)}
              accessibilityLabel={copy.termLabel(part.kw.romanization, part.kw.en)}
              testID={`story-reader-term-${part.kw.id}`}
            />
          </View>
        );
      })}
    </Text>
  );
}

/** A round 64 dp speaker button (narration card corner, gloss card). */
export function SpeakerButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => ({
        width: touchTarget.min,
        height: touchTarget.min,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.brand.secondaryLight : colors.surface.paper,
        borderWidth: borderWidth.base,
        borderColor: colors.brand.secondary,
      })}
    >
      <Icon name="speaker" size={spacing.xxl} color={colors.brand.secondaryDark} />
    </Pressable>
  );
}

/** The inline gloss card under the narration (§3.5, wireframe C): never a floating popover. */
export function GlossCard({
  text,
  copy,
  koreanItem,
  romanizationShown,
  onHear,
  onClose,
}: {
  text: KoText;
  copy: ReaderCopy;
  koreanItem: KoreanItemLabel;
  romanizationShown: boolean;
  onHear: () => void;
  onClose: () => void;
}): React.ReactElement {
  // Wireframe C: the card pushes the text down and scrolls into view (web: the node is the DOM element).
  const ref = useRef<View | null>(null);
  useEffect(() => {
    const node = ref.current as unknown as { scrollIntoView?: (o: { block: 'nearest' }) => void } | null;
    node?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  return (
    <View ref={ref} accessibilityLiveRegion="polite" testID="story-reader-gloss">
      <Card tone="paper" padding="lg" elevation="flat">
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <KoreanText
                ko={text.ko}
                romanization={text.romanization}
                gloss={text.en}
                size="sm"
                romanizationShown={romanizationShown}
                onPress={onHear}
                accessibilityLabel={koreanItem({ ko: text.ko, romanization: text.romanization, gloss: text.en })}
                testID="story-reader-gloss-text"
              />
            </View>
            <SpeakerButton label={copy.hearTerm(text.romanization)} onPress={onHear} testID="story-reader-gloss-hear" />
          </View>
          <View style={{ alignSelf: 'center' }}>
            <Button label={copy.closeGloss.cta} tone="ghost" size="md" onPress={onClose} testID="story-reader-gloss-close" />
          </View>
        </View>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Korean block (§3.3 item 4, §3.5)
// ---------------------------------------------------------------------------

export function KoreanBlock({
  korean,
  size,
  copy,
  koreanItem,
  romanizationShown,
  wordState,
  onHear,
  onWord,
}: {
  korean: SceneKorean;
  size: 'sm' | 'md';
  copy: ReaderCopy;
  koreanItem: KoreanItemLabel;
  romanizationShown: boolean;
  wordState: (index: number) => TermChipState;
  onHear: () => void;
  onWord: (index: number) => void;
}): React.ReactElement {
  const { text, words } = korean;
  if (!words || words.length === 0) {
    // One tap target: hear the word or the whole line (and reveal its romanization in tap mode),
    // plus its 64 dp speaker (§3.3 item 4).
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <KoreanText
            ko={text.ko}
            romanization={text.romanization}
            gloss={text.en}
            size={size}
            romanizationShown={romanizationShown}
            onPress={onHear}
            accessibilityLabel={koreanItem({ ko: text.ko, romanization: text.romanization, gloss: text.en })}
            testID="story-reader-korean"
          />
        </View>
        <SpeakerButton label={copy.hearKorean} onPress={onHear} testID="story-reader-hear-korean" />
      </View>
    );
  }
  // Authored words: each is a chip that opens the gloss card; the whole-line gloss stays beneath.
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }} testID="story-reader-korean">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
        {words.map((word, i) => {
          const state = wordState(i);
          return (
            <View
              key={`${i}-${word.ko}`}
              style={{
                borderBottomWidth: borderWidth.thick,
                borderBottomColor: state.open ? colors.brand.secondaryDark : 'transparent',
              }}
            >
              <KoreanText
                ko={word.ko}
                romanization={word.romanization}
                size="sm"
                romanizationShown={state.romanizationShown}
                onPress={() => onWord(i)}
                accessibilityLabel={copy.termLabel(word.romanization, word.en)}
                testID={`story-reader-word-${i}`}
              />
            </View>
          );
        })}
      </View>
      <Body align="center" tone="secondary" testID="story-reader-line-gloss">
        {text.en}
      </Body>
      <View style={{ alignSelf: 'center' }}>
        <Button
          label={copy.hearKorean}
          tone="secondary"
          size="md"
          leading={<Icon name="speaker" size={spacing.xl} color={colors.text.onSecondary} />}
          onPress={onHear}
          testID="story-reader-hear-line"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom bar: Read to me · Back · Next (§3.3 item 6)
// ---------------------------------------------------------------------------

/** A labelled switch, one 64 dp target (no nested native input). */
export function ReadToMeSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}): React.ReactElement {
  const track = spacing.xxxl;
  const knob = spacing.xl;
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      testID="story-reader-read-to-me"
      style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      <View
        style={{
          width: track,
          height: knob + spacing.xs,
          borderRadius: radii.pill,
          padding: spacing.xxs,
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? colors.brand.secondary : colors.surface.sunken,
          borderWidth: borderWidth.base,
          borderColor: value ? colors.brand.secondaryDark : colors.border.strong,
        }}
      >
        <View
          style={{
            width: knob - spacing.xxs,
            height: knob - spacing.xxs,
            borderRadius: radii.pill,
            backgroundColor: colors.surface.paper,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.strong,
          }}
        />
      </View>
      <Body weight="semibold">{label}</Body>
    </Pressable>
  );
}

export function ReaderBottomBar({
  copy,
  readToMe,
  onReadToMe,
  isFirst,
  nextLabel,
  nextSize,
  onBack,
  onNext,
}: {
  copy: ReaderCopy;
  readToMe: boolean;
  onReadToMe: (next: boolean) => void;
  isFirst: boolean;
  nextLabel: string;
  nextSize: 'lg' | 'hero';
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  // Back and Next stay together; the switch takes its own line when the row is narrow.
  return (
    <View
      testID="story-reader-bottom-bar"
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.lg, rowGap: spacing.xs, paddingTop: spacing.sm }}
    >
      <ReadToMeSwitch label={copy.readToMe} value={readToMe} onChange={onReadToMe} />
      <View style={{ flexGrow: 1, flexBasis: touchTarget.hero * 2 + spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Button
          label={copy.back.cta}
          tone="secondary"
          size="lg"
          disabled={isFirst}
          onPress={onBack}
          testID="story-reader-back"
        />
        <View style={{ flex: 1 }}>
          <Button label={nextLabel} tone="primary" size={nextSize} fullWidth onPress={onNext} testID="story-reader-next" />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// End page (§3.7, wireframe H) and the content fallback (§3.3, §3.11)
// ---------------------------------------------------------------------------

export function ReaderEndPage({
  copy,
  mode,
  hoyaLabel,
  retellingNote,
  onPrimary,
  onReadAgain,
  onSources,
}: {
  copy: EndCopy;
  mode: 'quest' | 'replay';
  hoyaLabel: string;
  /** Traditional tales only: "one version of a tale told in many versions". */
  retellingNote: string | null;
  onPrimary: () => void;
  onReadAgain: () => void;
  onSources?: () => void;
}): React.ReactElement {
  const hoya = useMediaSize(touchTarget.hero + spacing.xxl);
  return (
    <View testID="story-reader-end" style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl }}>
      <Hoya pose="cheering" size={hoya} accessibilityLabel={hoyaLabel} />
      <Spacer size="lg" />
      <Heading level="display" align="center">
        {copy.title}
      </Heading>
      {retellingNote !== null ? (
        <>
          <Spacer size="md" />
          <Body tone="secondary" align="center" testID="story-reader-retelling">
            {retellingNote}
          </Body>
        </>
      ) : null}
      <Spacer size="xl" />
      <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
        <Button
          label={mode === 'quest' ? copy.continue.cta : copy.done.cta}
          tone="primary"
          size="hero"
          fullWidth
          onPress={onPrimary}
          testID="story-reader-end-primary"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
          <Button label={copy.readAgain.cta} tone="ghost" size="md" onPress={onReadAgain} testID="story-reader-read-again" />
          {onSources ? (
            <Button label={copy.sources.cta} tone="ghost" size="md" onPress={onSources} testID="story-reader-end-sources" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ReaderFallback({
  copy,
  backLabel,
  onBack,
  onContinue,
}: {
  copy: ReaderCopy;
  backLabel: string;
  onBack: () => void;
  /** Quest mode only: a content error never traps a quest. */
  onContinue?: () => void;
}): React.ReactElement {
  return (
    <View testID="story-reader-unavailable" style={{ flexGrow: 1, justifyContent: 'center', gap: spacing.lg }}>
      <Body size="lg" align="center">
        {copy.unavailable}
      </Body>
      <View style={{ gap: spacing.sm }}>
        {onContinue ? (
          <Button label={copy.continue.cta} tone="primary" size="lg" fullWidth onPress={onContinue} testID="story-reader-continue" />
        ) : null}
        <Button label={backLabel} tone="secondary" size="lg" fullWidth onPress={onBack} testID="story-reader-fallback-back" />
      </View>
    </View>
  );
}

/** "In English" above the narration on the read-along level (§3.3 level table). */
export function InEnglishLabel({ label }: { label: string }): React.ReactElement {
  return <Caption tone="muted">{label}</Caption>;
}
