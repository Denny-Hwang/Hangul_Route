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
  type DiscoverExchangeRender,
  type DiscoverItemRender,
  type DiscoverState,
  type HearAction,
} from '../../logic/stage1/discover-flow';
import { clipRefsOf } from '../../logic/audio/clip-refs';
import { playPrompt, stop as stopAudio, warmClips } from '../../platform/audio';
import { useReducedMotion } from '../../platform/motion';
import { announceAndWait } from '../../platform/screen-reader';
import { PICTURE_CONTEXT, PictureArt } from '../minigames/PictureArt';

/**
 * Discover (F-QUEST-002 §3.2): teach before play. One or two new things per
 * page, each shown, named and heard on request; nothing autoplays and
 * Continue is enabled at once. The behaviour lives in
 * `logic/stage1/discover-flow.ts` (view model, reducer, effects); this file
 * renders it and runs the effects.
 * Design: design/wireframes/quest/discover.md (S1, S2), design/components/SyllableBlock/spec.md;
 * the exchange page and its Read along: design/wireframes/quest/discover-sentences.md (S3).
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
      for (const line of page.exchange?.lines ?? []) map.set(line.hear.id, line.hear);
    }
    return map;
  }, [model]);
  // Read along: each exchange line's label for the screen reader, and each item's line count.
  const exchanges = useMemo(() => {
    const labels = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const page of model.pages) {
      const ex = page.exchange;
      if (!ex) continue;
      counts.set(ex.key, ex.lines.length);
      ex.lines.forEach((l, i) => labels.set(l.hear.id, copy.exchange.lineLabel(i + 1, ex.lines.length, l.speaker)));
    }
    return { labels, lineCount: (item: string): number => counts.get(item) ?? 0 };
  }, [model, copy]);

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

  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pauseTimer.current !== null) clearTimeout(pauseTimer.current);
    },
    [],
  );

  /** Runs one effect; the returned promise settles when the next effect of the same batch may start. */
  const runEffect = useCallback(
    (effect: DiscoverEffect): Promise<void> | void => {
      switch (effect.type) {
        case 'done':
          onDoneRef.current({ pages: effect.pages, heard: effect.heard });
          return;
        case 'stopAudio':
          if (pauseTimer.current !== null) clearTimeout(pauseTimer.current);
          stopAudio();
          return;
        case 'pause':
          pauseTimer.current = setTimeout(() => dispatchRef.current({ type: 'readAlongNext', run: effect.run }), motion.duration.slow);
          return;
        case 'announce':
          // Announce, then play: the line's audio starts once the screen reader has said the label.
          return announceAndWait(exchanges.labels.get(effect.id) ?? '', motion.duration.slow);
        case 'play': {
          const action = actions.get(effect.id);
          if (!action) return;
          void playPrompt(action.spec).then((result) => dispatchRef.current({ type: 'audio', id: effect.id, result, ...(effect.run === undefined ? {} : { run: effect.run }) }));
          return;
        }
      }
    },
    [actions, exchanges],
  );

  const dispatch = useCallback(
    (event: DiscoverEvent): void => {
      const out = stepDiscover(stateRef.current, event, exchanges.lineCount);
      stateRef.current = out.state;
      setState(out.state);
      // In order, at once until an effect has to finish first (an announce holds back the play after
      // it); if anything happened meanwhile (Stop, Continue, another line), the rest is dropped.
      const runFrom = (index: number): void => {
        for (let i = index; i < out.effects.length; i++) {
          const pending = runEffect(out.effects[i]!);
          if (pending) {
            void pending.then(() => {
              if (stateRef.current === out.state) runFrom(i + 1);
            });
            return;
          }
        }
      };
      runFrom(0);
    },
    [runEffect, exchanges],
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
              {render.exchange ? (
                <ExchangeCard render={render.exchange} dispatch={dispatch} copy={copy} m={m} scrollRef={scrollRef} />
              ) : null}
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

/**
 * An `exchange` item (D-1 S3): two lines between named speakers, each with its own speaker button,
 * and Read along, which plays the lines in order and lights each one while it plays. The highlight is
 * a thick start border, a tint, the arrow glyph and the words "Reading now": never colour alone, and
 * the line waiting next is never dimmed.
 */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

function ExchangeCard({
  render,
  dispatch,
  copy,
  m,
  scrollRef,
}: {
  render: DiscoverExchangeRender;
  dispatch: (event: DiscoverEvent) => void;
  copy: DiscoverMessages;
  m: Messages;
  scrollRef: React.RefObject<ScrollView | null>;
}): React.ReactElement {
  const ex = copy.exchange;
  const status =
    render.status === 'muted' ? m.learner.audio.soundIsOff : render.status === 'unavailable' ? m.learner.audio.noKoreanVoiceSentence : undefined;
  return (
    <View style={{ gap: spacing.md }} testID={`discover-exchange-${render.item.key}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md }}>
        <Button
          label={render.reading ? ex.stop.cta : ex.readAlong.cta}
          tone="secondary"
          size="md"
          {...(render.reading ? {} : { leading: <Icon name="play" size={spacing.xl} /> })}
          onPress={() => dispatch({ type: 'readAlong', item: render.item.key })}
          testID="discover-read-along"
        />
        {render.heard ? <Pill tone="success" size="sm" label={copy.heard.pill} /> : null}
      </View>
      {status ? (
        <Body tone="secondary" weight="semibold" testID="discover-read-along-status">
          {status}
        </Body>
      ) : null}
      {/* The lit line, said politely; visually hidden (the line card carries the visible cues). */}
      <Text aria-live="polite" accessibilityLiveRegion="polite" style={srOnly} testID="discover-read-along-live">
        {render.liveLine ?? ''}
      </Text>
      {render.lines.map((r) => (
        <ExchangeLine key={r.line.key} render={r} dispatch={dispatch} copy={copy} a11y={m.a11y} scrollRef={scrollRef} />
      ))}
    </View>
  );
}

function ExchangeLine({
  render,
  dispatch,
  copy,
  a11y,
  scrollRef,
}: {
  render: DiscoverExchangeRender['lines'][number];
  dispatch: (event: DiscoverEvent) => void;
  copy: DiscoverMessages;
  a11y: Messages['a11y'];
  scrollRef: React.RefObject<ScrollView | null>;
}): React.ReactElement {
  const { line, lit } = render;
  const reducedMotion = useReducedMotion();
  const ref = useRef<View | null>(null);
  // A lit line that is off screen scrolls into view (instantly under reduced motion).
  useEffect(() => {
    if (!lit) return;
    const scroll = scrollRef.current;
    const inner = scroll?.getInnerViewNode?.();
    if (!scroll || !inner || !ref.current) return;
    try {
      ref.current.measureLayout(
        inner,
        (_x, y) => scroll.scrollTo({ y: Math.max(0, y - spacing.lg), animated: !reducedMotion }),
        () => undefined,
      );
    } catch {
      // Not measurable here: the line is still on the page.
    }
  }, [lit, reducedMotion, scrollRef]);
  const start = line.side === 'a';
  const portrait = (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: touchTarget.min,
        height: touchTarget.min,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.sunken,
      }}
    >
      <Icon name="profile" size={spacing.xl} />
    </View>
  );
  return (
    <View ref={ref}>
      <Card
        padding="md"
        tone={lit ? 'brand' : 'paper'}
        testID={`discover-line-${line.key}`}
        style={{
          borderWidth: borderWidth.base,
          borderStartWidth: lit ? borderWidth.thick : borderWidth.base,
          borderColor: lit ? colors.brand.primary : colors.border.subtle,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: start ? 'row' : 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
            {portrait}
            {lit ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="discover-line-reading-now">
                <Icon name="arrow-right" size={spacing.lg} />
                <Pill tone="primary" size="sm" label={copy.exchange.readingNow.pill} />
              </View>
            ) : null}
            <Body weight="semibold">{line.speaker}</Body>
          </View>
          {/* The speaker button wraps under the line when the two do not fit side by side (320 px), so a
              Korean word never breaks inside itself (F-CURR-001 §3.14 layout). */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: '60%', alignItems: 'flex-start' }}>
              <KoreanText
                ko={line.ko}
                romanization={line.romanization}
                gloss={line.gloss}
                size="md"
                romanizationShown={render.romanizationShown}
                accessibilityLabel={
                  render.romanizationShown ? line.accessibilityLabel : `${line.speaker}: ${line.ko}, ${line.gloss}`
                }
              />
            </View>
            <Button
              label={copy.hearIt.cta}
              accessibilityLabel={a11y.hearItLabel(line.accessibilityLabel)}
              tone="ghost"
              size="md"
              leading={<Icon name="speaker" size={spacing.xl} />}
              onPress={() => dispatch({ type: 'hear', id: line.hear.id })}
              testID={`discover-hear-${line.hear.id}`}
            />
          </View>
          {render.showReveal ? (
            <Button label={copy.showHowToSay.cta} tone="ghost" size="md" onPress={() => dispatch({ type: 'reveal', key: line.key })} />
          ) : null}
        </View>
      </Card>
    </View>
  );
}
