import type { DiscoverPage } from '@hangul-route/content-schema';
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
  SyllableBlock,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { hasPicture } from '../../logic/picture-ref';
import {
  buildDiscover,
  pageRender,
  startDiscover,
  stepDiscover,
  type DiscoverEffect,
  type DiscoverEvent,
  type DiscoverItemRender,
  type DiscoverState,
  type HearAction,
} from '../../logic/stage1/discover-flow';
import { clipRefsOf } from '../../logic/audio/clip-refs';
import { playPrompt, warmClips } from '../../platform/audio';
import { useReducedMotion } from '../../platform/motion';
import { PICTURE_CONTEXT, PictureArt } from '../minigames/PictureArt';

/**
 * Discover (F-QUEST-002 §3.2): teach before play. One or two new things per
 * page, each shown, named and heard on request; nothing autoplays and
 * Continue is enabled at once. The behaviour lives in
 * `logic/stage1/discover-flow.ts` (view model, reducer, effects); this file
 * renders it and runs the effects.
 * Design: design/wireframes/quest/discover.md (S1, S2), design/components/SyllableBlock/spec.md.
 */

interface Props {
  pages: readonly DiscoverPage[];
  /** The step's Hoya line, shown once and small. */
  hoyaLine?: string;
  /** Continue on the last page: the player advances and reports `quest.discover_completed`. */
  onDone: (result: { pages: number; heard: number }) => void;
}

type DiscoverMessages = Messages['learner']['quest']['discover'];

export function DiscoverStep({ pages, hoyaLine, onDone }: Props): React.ReactElement {
  const m = useMessages();
  const copy = m.learner.quest.discover;
  const locale = useLocale();
  const model = useMemo(() => buildDiscover(pages, copy, m.a11y, locale), [pages, copy, m.a11y, locale]);
  const actions = useMemo(() => {
    const map = new Map<string, HearAction>();
    for (const page of model.pages) {
      for (const item of page.items) {
        map.set(item.hear.id, item.hear);
        if (item.letterName) map.set(item.letterName.action.id, item.letterName.action);
        if (item.example) map.set(item.example.hear.id, item.example.hear);
      }
    }
    return map;
  }, [model]);

  // Recordings for every Hear it on these pages are fetched and decoded ahead (§3.10).
  useEffect(() => {
    void warmClips(clipRefsOf([...actions.values()].map((a) => a.spec)));
  }, [actions]);

  const romanizationMode = useRomanizationMode();

  const [state, setState] = useState<DiscoverState>(() => startDiscover(model));
  const stateRef = useRef(state);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const dispatchRef = useRef<(event: DiscoverEvent) => void>(() => undefined);
  const scrollRef = useRef<ScrollView | null>(null);

  const runEffect = useCallback(
    (effect: DiscoverEffect): void => {
      if (effect.type === 'done') {
        onDoneRef.current({ pages: effect.pages, heard: effect.heard });
        return;
      }
      const action = actions.get(effect.id);
      if (!action) return;
      void playPrompt(action.spec).then((result) => dispatchRef.current({ type: 'audio', id: effect.id, result }));
    },
    [actions],
  );

  const dispatch = useCallback(
    (event: DiscoverEvent): void => {
      const out = stepDiscover(stateRef.current, event);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  // A new page starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [state.page]);

  const render = pageRender(model, state, romanizationMode, copy);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {hoyaLine ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Hoya pose="waving" size={touchTarget.min} />
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{hoyaLine}</Body>
              </View>
            </View>
            <Spacer size="md" />
          </>
        ) : null}

        {render.empty ? (
          <Body testID="discover-empty">{render.emptyLine}</Body>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Caption tone="secondary">{copy.pageLabel(render.dots.value, render.dots.max)}</Caption>
              <View style={{ flex: 1 }}>
                <Progress variant="dots" value={render.dots.value} max={render.dots.max} tone="primary" />
              </View>
            </View>
            {render.title ? (
              <>
                <Spacer size="sm" />
                <Heading level="prompt">{render.title}</Heading>
              </>
            ) : null}
            <Spacer size="md" />
            <View key={state.page} style={{ gap: spacing.lg }}>
              {render.items.map((r) => (
                <DiscoverItemCard key={r.item.key} render={r} dispatch={dispatch} copy={copy} a11y={m.a11y} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <View style={{ paddingTop: spacing.md }}>
        <Button
          label={copy.continue.cta}
          tone="primary"
          size="lg"
          fullWidth
          disabled={!render.continueEnabled}
          onPress={() => dispatch({ type: 'next' })}
          testID="discover-continue"
        />
        <Spacer size="lg" />
      </View>
    </View>
  );
}

function HearButton({
  action,
  label,
  accessibilityLabel,
  size,
  pulse,
  tone,
  dispatch,
}: {
  action: HearAction;
  label: string;
  accessibilityLabel: string;
  size: 'md' | 'lg';
  pulse?: boolean;
  tone: 'secondary' | 'ghost';
  dispatch: (event: DiscoverEvent) => void;
}): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!pulse || reducedMotion) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: motion.duration.slow }),
      withTiming(1, { duration: motion.duration.slow }),
    );
  }, [pulse, reducedMotion, scale]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={pulse && !reducedMotion ? pulseStyle : undefined}>
      <Button
        label={label}
        accessibilityLabel={accessibilityLabel}
        tone={tone}
        size={size}
        leading={<Icon name="speaker" size={spacing.xl} />}
        onPress={() => dispatch({ type: 'hear', id: action.id })}
        testID={`discover-hear-${action.id}`}
      />
    </Animated.View>
  );
}

function DiscoverItemCard({
  render,
  dispatch,
  copy,
  a11y,
}: {
  render: DiscoverItemRender;
  dispatch: (event: DiscoverEvent) => void;
  copy: DiscoverMessages;
  a11y: Messages['a11y'];
}): React.ReactElement {
  const { item } = render;
  const example = item.example;
  // The gloss each picture is given below, so "is there a picture" matches what PictureArt draws.
  const itemGloss = item.gloss ?? item.glyph;
  const itemPicture = item.kind === 'word' && hasPicture(item.picture, itemGloss, PICTURE_CONTEXT);
  const examplePicture = example !== undefined && hasPicture(item.picture, example.gloss, PICTURE_CONTEXT);

  return (
    <Card padding="lg" tone="paper" testID={`discover-item-${item.key}`}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        {render.heard ? <Pill tone="success" size="sm" label={copy.heard.pill} /> : null}

        <KoreanText
          ko={item.glyph}
          romanization={item.romanization}
          {...(item.gloss === undefined ? {} : { gloss: item.gloss })}
          size={item.kind === 'symbol' ? 'lg' : 'md'}
          accessibilityLabel={item.accessibilityLabel}
        />
        {item.soundHint ? (
          <Body tone="secondary" align="center">
            {item.soundHint}
          </Body>
        ) : null}
        {item.note ? (
          <Body tone="secondary" align="center">
            {item.note}
          </Body>
        ) : null}
        {/* Decorative: the KoreanText line above already names the word (F-VOC-002 §3.7). */}
        {itemPicture ? <PictureArt pictureRef={item.picture} gloss={itemGloss} size={touchTarget.hero} decorative /> : null}

        <HearButton
          action={item.hear}
          label={copy.hearIt.cta}
          accessibilityLabel={a11y.hearItLabel(item.accessibilityLabel)}
          size="lg"
          tone="secondary"
          pulse={render.pulse}
          dispatch={dispatch}
        />

        {item.letterName ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <HearButton
              action={item.letterName.action}
              label={copy.letterName.cta}
              accessibilityLabel={copy.letterName.cta}
              size="md"
              tone="ghost"
              dispatch={dispatch}
            />
            {render.nameShown ? (
              <KoreanText ko={item.letterName.ko} romanization={item.letterName.romanization} size="sm" />
            ) : null}
          </View>
        ) : null}

        {item.block ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <SyllableBlock
              vowel={item.block.vowel}
              hasFinal={item.block.hasFinal}
              highlight={item.block.highlight}
              parts={item.block.parts}
              size="sm"
              accessibilityLabel={`${item.batchimLine ?? ''} ${item.accessibilityLabel}`.trim()}
              testID={`discover-block-${item.key}`}
            />
            {item.batchimLine ? <Body tone="secondary" align="center">{item.batchimLine}</Body> : null}
          </View>
        ) : null}

        {render.sayLines.length > 0 ? (
          <View accessibilityLiveRegion="polite" style={{ alignItems: 'center' }}>
            {render.sayLines.map((line) => (
              <Body key={line} tone="secondary" align="center" weight="semibold">
                {line}
              </Body>
            ))}
          </View>
        ) : null}

        {example ? (
          <View
            style={{
              alignSelf: 'stretch',
              alignItems: 'center',
              gap: spacing.sm,
              borderTopWidth: borderWidth.thin,
              borderTopColor: colors.border.subtle,
              paddingTop: spacing.md,
            }}
          >
            {example.blocks.length > 1 ? (
              <ExampleBlocks blocks={example.blocks} />
            ) : null}
            <KoreanText
              ko={example.ko}
              romanization={example.romanization}
              gloss={example.gloss}
              size="sm"
              romanizationShown={render.exampleRomanizationShown}
              onPress={() => dispatch({ type: 'hear', id: example.hear.id })}
              accessibilityLabel={a11y.hearExample(
                render.exampleRomanizationShown
                  ? `${example.ko}, ${example.romanization}, ${example.gloss}`
                  : `${example.ko}, ${example.gloss}`,
              )}
              testID={`discover-hear-${example.hear.id}`}
            />
            {/* Decorative: the example's KoreanText line already names it. */}
            {examplePicture ? (
              <PictureArt pictureRef={item.picture} gloss={example.gloss} size={touchTarget.hero} decorative />
            ) : null}
            {render.showReveal ? (
              <Button
                label={copy.showHowToSay.cta}
                tone="ghost"
                size="md"
                onPress={() => dispatch({ type: 'reveal', key: item.key })}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** The example's syllable blocks, the one that holds the symbol lit. Decorative: the word itself is read by KoreanText. */
function ExampleBlocks({ blocks }: { blocks: Array<{ text: string; emphasised: boolean }> }): React.ReactElement {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: spacing.sm }}
    >
      {blocks.map((block, i) => (
        <View
          // the same syllable can repeat in a word, so the index is part of the key
          key={`${block.text}-${i}`}
          style={{
            minWidth: touchTarget.min,
            minHeight: touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.lg,
            borderWidth: block.emphasised ? borderWidth.thick : borderWidth.base,
            borderColor: block.emphasised ? colors.brand.primary : colors.border.subtle,
            backgroundColor: block.emphasised ? colors.brand.primaryLight : colors.surface.paper,
          }}
        >
          <Text
            style={{
              fontFamily: typography.family.sansKr,
              fontSize: typography.size.display,
              fontWeight: block.emphasised ? typography.weight.bold : typography.weight.regular,
              color: colors.text.primary,
            }}
          >
            {block.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
