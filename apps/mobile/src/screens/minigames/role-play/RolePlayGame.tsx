import type { RolePlayScene } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useTypeScale,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PromptPanel } from '../../../components/PromptPanel';
import { VoiceHelpSheet } from '../../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../../components/use-prompt-slot';
import { useMessages } from '../../../i18n/use-messages';
import { koSpeech } from '../../../logic/audio/ko-speech';
import { afterReply } from '../../../logic/audio/reply-advance';
import type { KoTokenPart } from '../../../logic/ko-tokens';
import { startRolePlay, stepRolePlay, turnOf, type RpEffect, type RpEvent, type RpState } from '../../../logic/role-play/reducer';
import { closingOf, logView, partsText, pinnedCap, progressOf, replyViews, whyParts, type BubbleView, type ReplyView } from '../../../logic/role-play/view';
import { playPrompt, stop } from '../../../platform/audio';
import { nudge, success, tapLight } from '../../../platform/haptics';
import { useReducedMotion } from '../../../platform/motion';
import { announceForScreenReader, focusForScreenReader } from '../../../platform/screen-reader';
import { useAudioStore } from '../../../store/audio-store';
import type { MinigameHost } from '../host';

/**
 * Role Play, read and tap (F-CURR-002 section 7.1 F6, row CM-35): design/wireframes/minigame/role-play.md and
 * design/screens/minigame-variety/ (mock/role-play.html, boards R, R1, R2; D1 layout B, D3, D7). The partner (named by
 * role) says a line; the learner reads the replies (Korean and romanization; meanings behind Show meanings) and taps
 * one. A natural reply is sent and said; a less natural one locks in amber while Hoya says why, and the learner taps
 * again. Every branch ends with the closing line and Continue. The rules are `logic/role-play/` (reducer, views);
 * this file lays them out (layout B: the chat log scrolls, the reply area is pinned under it) and runs the effects.
 *
 * Reading and listening only: there is no microphone, no "say it" and no record control. The partner's line is
 * heard; the learner's reply is said by the device voice as it is sent, never asked of the learner.
 */

export interface RolePlayGameProps {
  scope: { rolePlay?: { scene: RolePlayScene } };
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack: () => void;
}

const SOURCE = 'role-play';
const koreanSpeech = { accessibilityLanguage: 'ko', lang: 'ko' } as const;
/** Chat bubble width cap (design README "Constants"): the side of a bubble, who said it, stays visible. */
const BUBBLE_CAP = { compact: '85%', regular: '80%' } as const;
/** The scroll cue's fade ends at this share of its height; the chevron and caption sit on the solid rest. */
const CUE_FADE_STOP = 0.35;
/** The fade's steps from clear to `surface.canvas` (no gradient primitive in React Native). */
const CUE_FADE_STEPS = [0.25, 0.5, 0.75];
/** The chat log's bottom padding, under the newest bubble. */
const LOG_PAD = spacing.xs;
/** The scroll cue's height: one caption line on its solid part, under the fade. */
const CUE_HEIGHT = spacing.xxl + spacing.sm;
/** The pinned area's top padding. */
const PIN_PAD = spacing.xs;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

type Focusable = { focus?: (options?: { preventScroll?: boolean }) => void };
/** Moves assistive-tech focus to a node without scrolling it into view (the pinned area keeps Hoya's line on top). */
function focusNode(node: Focusable | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') node.focus?.({ preventScroll: true });
  else focusForScreenReader(node);
}

export function RolePlayGame({ scope, host, onBack }: RolePlayGameProps): ReactElement {
  const m = useMessages();
  const scene = scope.rolePlay?.scene;
  if (scene === undefined || turnOf(scene, { node: scene.start }) === undefined) {
    return (
      <Screen>
        <Body>{m.learner.minigame.listenPick.empty}</Body>
        <Spacer size="lg" />
        <Button label={m.learner.minigame.backToQuest.cta} tone="secondary" size="md" onPress={onBack} testID="role-play-back" />
      </Screen>
    );
  }
  return <Chat scene={scene} host={host} />;
}

function Chat({ scene, host }: { scene: RolePlayScene; host: MinigameHost }): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const textScale = useTypeScale();
  const reducedMotion = useReducedMotion();
  const { width: widthClass } = useLayoutClass();
  const { height: windowHeight } = useWindowDimensions();
  const bubbleCap = widthClass === 'compact' ? BUBBLE_CAP.compact : BUBBLE_CAP.regular;

  const first = useMemo(() => startRolePlay(scene), [scene]);
  const [state, setState] = useState<RpState>(first.state);
  const stateRef = useRef(state);
  stateRef.current = state;

  const slot = usePromptSlot({ source: SOURCE, textOnScreen: true });
  const { play, reset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const mounted = useRef(true);
  // While a reply is said, nothing may start the partner line again (it would cut the reply off).
  const replying = useRef(false);
  const replyRefs = useRef(new Map<string, Focusable | null>());
  const endRef = useRef<View | null>(null);
  const logRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving mid-line must not leave Korean playing over the next screen.
      stop();
    };
  }, []);

  const sayLine = useCallback(
    (nodeId: string): void => {
      const node = turnOf(scene, { node: nodeId });
      if (node === undefined || replying.current) return;
      void play(() => playPrompt(koSpeech(node.line, 'sentence', SOURCE)));
    },
    [scene, play],
  );

  const runRef = useRef<(event: RpEvent) => void>(() => undefined);
  const runEffects = useCallback(
    (effects: readonly RpEffect[], next: RpState): void => {
      for (const effect of effects) {
        switch (effect.type) {
          case 'answer':
            // Only a right answer goes as hinted: the host records a hinted answer as a hinted right one, a miss as a miss.
            host.answer(effect.node, effect.correct, { itemId: `${effect.node}/${effect.reply}`, ...(effect.hinted && effect.correct ? { hinted: true } : {}) });
            break;
          case 'nudge': {
            nudge();
            // Focus moves to the first reply still open (wireframe Accessibility).
            const open = replyViews(scene, next).find((r) => !r.disabled);
            if (open) focusNode(replyRefs.current.get(open.id) ?? null);
            const parts = whyParts(scene, next);
            if (parts) announceForScreenReader(partsText(parts));
            break;
          }
          case 'success':
            tapLight();
            success();
            break;
          case 'sayReply': {
            const node = turnOf(scene, { node: effect.node });
            const reply = node?.replies.find((r) => r.id === effect.reply);
            if (!reply) break;
            replying.current = true;
            const said = play(() => playPrompt(koSpeech(reply.text, 'sentence', SOURCE)));
            // The reply is said in full (at least 900 ms, at most 6 s) before the partner answers.
            void afterReply(said).then(() => {
              replying.current = false;
              if (mounted.current) runRef.current({ type: 'sent' });
            });
            break;
          }
          case 'sayLine':
            // A new turn: the panel starts from what is true now, except that "no Korean voice" stays once shown.
            if (slot.view.reason !== 'no_voice') reset();
            if (!useAudioStore.getState().muted) sayLine(effect.node);
            break;
          case 'end':
            setTimeout(() => focusNode(endRef.current as Focusable | null), 0);
            break;
        }
      }
    },
    [host, scene, play, reset, sayLine, slot.view.reason],
  );

  const run = useCallback(
    (event: RpEvent): void => {
      const step = stepRolePlay(scene, stateRef.current, event);
      if (step.state === stateRef.current) return;
      stateRef.current = step.state;
      setState(step.state);
      runEffects(step.effects, step.state);
    },
    [scene, runEffects],
  );
  runRef.current = run;

  // The chat opens with the start line, said once (with sound switched off it waits for a tap on Hear it).
  useEffect(() => {
    runEffects(first.effects, first.state);
    // Once per chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);

  const bubbles = logView(scene, state, m.a11y.minigame.rolePlay);
  const replies = replyViews(scene, state);
  const progress = progressOf(scene, state);
  const why = whyParts(scene, state);
  const closing = closingOf(scene, state);
  const newest = bubbles.filter((b) => b.who === 'partner').at(-1);

  // Layout B: the pinned area grows up to half the window, never over the newest partner bubble, never below its
  // instruction row and one reply (wireframe States).
  // The sound status joins the chat where it first shows (after that turn's line) and stays there, so "No Korean
  // voice" is said once for the scene and scrolls up with the chat instead of pushing every new line out of view.
  const [panelAt, setPanelAt] = useState<number | null>(null);
  const statusShown = slot.view.statusShown;
  useEffect(() => {
    if (statusShown && panelAt === null) setPanelAt(bubbles.length);
  }, [statusShown, panelAt, bubbles.length]);
  const panel = (
    <PromptPanel
      variant="status"
      compact
      view={slot.view}
      onAction={(action) => {
        if (!replying.current && newest) slot.act(action, () => sayLine(newest.node));
      }}
      onHelp={() => setHelpOpen(true)}
    />
  );

  // The log follows the newest partner line: to the end when the whole bubble fits, else to the bubble's top, so its
  // role and Korean line are what shows (Largest text at 320 x 568), with the rest a scroll away.
  const logH = useRef(0);
  const contentH = useRef(0);
  const trailH = useRef(0);
  const newestHRef = useRef(0);
  const follow = useCallback((): void => {
    const log = logRef.current;
    if (!log) return;
    // The newest partner bubble is the list's last item, under it only a sound status that has just shown, and the padding.
    const below = LOG_PAD + trailH.current;
    if (logH.current === 0 || newestHRef.current + below <= logH.current) log.scrollToEnd({ animated: !reducedMotion });
    else log.scrollTo({ y: Math.max(0, contentH.current - below - newestHRef.current), animated: !reducedMotion });
  }, [reducedMotion]);

  // The status trails the list until a later line joins the chat; then it sits in the chat and nothing trails.
  const trailing = panelAt === null || panelAt >= bubbles.length;
  if (!trailing) trailH.current = 0;

  const [bodyH, setBodyH] = useState(0);
  const [newestH, setNewestH] = useState(0);
  const [keepH, setKeepH] = useState(0);
  // The newest bubble's room includes the log's bottom padding, so the whole bubble shows above the pinned area.
  const cap = pinnedCap({ windowHeight, bodyHeight: bodyH, newestHeight: newestH > 0 ? newestH + LOG_PAD : 0, keepHeight: keepH });

  const onHear = (b: BubbleView): void => {
    if (replying.current) return;
    void play(() => playPrompt(koSpeech(b.speech, 'sentence', SOURCE)));
  };

  return (
    <Screen tone="canvas" scrollable={false} testID="role-play">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={progress.value} max={progress.max} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(progress.value, progress.max)} tone="neutral" size="sm" />
      </View>
      <Spacer size="md" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm }} testID="role-play-title">
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {scene.title.ko}
        </Text>
        <Body tone="secondary">{scene.title.romanization}</Body>
        <Body tone="secondary">{scene.title.en}</Body>
      </View>
      <Spacer size="sm" />

      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setBodyH(e.nativeEvent.layout.height)}>
        <ScrollView
          ref={logRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: LOG_PAD }}
          onLayout={(e: LayoutChangeEvent) => {
            logH.current = e.nativeEvent.layout.height;
            follow();
          }}
          onContentSizeChange={(_w: number, h: number) => {
            contentH.current = h;
            follow();
          }}
          testID="role-play-log"
        >
          <View role="list" aria-label={m.a11y.minigame.rolePlay.log} style={{ gap: spacing.md }}>
            {bubbles.map((b, i) => (
              <Rise key={b.key} reducedMotion={reducedMotion}>
                {i === panelAt ? panel : null}
                {b.who === 'partner' ? (
                  <PartnerBubble
                    bubble={b}
                    scene={scene}
                    cap={bubbleCap}
                    newest={b === newest}
                    onLayout={b === newest ? (h) => ((newestHRef.current = h), setNewestH(h), follow()) : undefined}
                    hearLabel={m.learner.audio.hearIt.cta}
                    hearA11y={m.a11y.minigame.hear(b.romanization)}
                    onHear={() => onHear(b)}
                  />
                ) : (
                  <MeBubble bubble={b} cap={bubbleCap} />
                )}
              </Rise>
            ))}
          </View>
          {trailing ? <View onLayout={(e: LayoutChangeEvent) => ((trailH.current = e.nativeEvent.layout.height), follow())}>{panel}</View> : null}
        </ScrollView>

        <View style={{ maxHeight: cap, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, paddingTop: PIN_PAD }} testID="role-play-pinned">
          {closing !== null ? (
            <View ref={endRef} focusable accessible testID="role-play-end">
              <HoyaBubble tone="cheering" message={closing} />
              <Spacer size="md" />
              <Button label={m.common.buttons.continue} tone="primary" size="lg" fullWidth onPress={host.complete} testID="role-play-continue" />
            </View>
          ) : (
            <Replies
              turn={state.node}
              whyId={state.why}
              replies={replies}
              why={why}
              meanings={state.meanings}
              disabled={state.sending !== null}
              tapLabel={copy.rolePlay.tapReply}
              showLabel={copy.rolePlay.showMeanings.cta}
              shownLabel={copy.rolePlay.meaningsShown}
              moreLabel={copy.rolePlay.moreReplies}
              wrongLabel={m.a11y.minigame.option.wrong}
              hintLabel={m.a11y.minigame.option.hint}
              reducedMotion={reducedMotion}
              onKeep={setKeepH}
              onShowMeanings={() => run({ type: 'showMeanings' })}
              onTap={(id) => run({ type: 'tap', reply: id })}
              refFor={(id, node) => replyRefs.current.set(id, node)}
            />
          )}
        </View>
      </View>
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}

/** A new bubble rises a little into place (`motion.duration.base`); with reduced motion it is simply there. */
function Rise({ reducedMotion, children }: { reducedMotion: boolean; children: ReactNode }): ReactElement {
  const offset = useSharedValue(reducedMotion ? 0 : spacing.sm);
  useEffect(() => {
    offset.value = withTiming(0, { duration: reducedMotion ? 0 : motion.duration.base });
  }, [offset, reducedMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

interface PartnerBubbleProps {
  bubble: BubbleView;
  scene: RolePlayScene;
  cap: string;
  newest: boolean;
  onLayout?: (height: number) => void;
  hearLabel: string;
  hearA11y: string;
  onHear: () => void;
}

function PartnerBubble({ bubble, scene, cap, newest, onLayout, hearLabel, hearA11y, onHear }: PartnerBubbleProps): ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      role="listitem"
      aria-label={bubble.label}
      aria-live={newest ? 'polite' : undefined}
      onLayout={onLayout ? (e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.height) : undefined}
      style={{ alignSelf: 'flex-start', maxWidth: cap as `${number}%`, backgroundColor: colors.surface.sunken, borderRadius: radii.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xxs }}
      testID={newest ? 'role-play-partner-newest' : 'role-play-partner'}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.caption, fontWeight: typography.weight.bold, color: colors.text.secondary }}>
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech}>{scene.partner.ko}</Text>
        {` ${scene.partner.romanization} · ${scene.partner.en}`}
      </Text>
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {bubble.ko}
      </Text>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, color: colors.text.secondary }}>{bubble.romanization}</Text>
      {bubble.meaning ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, color: colors.text.secondary }}>{bubble.meaning}</Text> : null}
      <View style={{ alignSelf: 'flex-start', marginTop: spacing.xxs }}>
        <Button
          label={hearLabel}
          tone="secondary"
          size="md"
          leading={<Icon name="speaker" size={20} color={colors.text.onSecondary} />}
          accessibilityLabel={hearA11y}
          onPress={onHear}
          testID={newest ? 'role-play-hear' : undefined}
        />
      </View>
    </View>
  );
}

function MeBubble({ bubble, cap }: { bubble: BubbleView; cap: string }): ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      role="listitem"
      aria-label={bubble.label}
      style={{ alignSelf: 'flex-end', maxWidth: cap as `${number}%`, backgroundColor: colors.brand.secondaryLight, borderRadius: radii.xl, padding: spacing.md, gap: spacing.xxs }}
      testID="role-play-me"
    >
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {bubble.ko}
      </Text>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, color: colors.brand.secondaryDark }}>{bubble.romanization}</Text>
    </View>
  );
}

interface RepliesProps {
  /** The turn on screen: each turn's replies open scrolled to their top. */
  turn: string;
  /** The less natural reply Hoya is explaining (its id), or null. */
  whyId: string | null;
  replies: ReplyView[];
  why: KoTokenPart[] | null;
  meanings: boolean;
  disabled: boolean;
  tapLabel: string;
  showLabel: string;
  shownLabel: string;
  moreLabel: string;
  wrongLabel: (label: string) => string;
  hintLabel: (label: string) => string;
  reducedMotion: boolean;
  onKeep: (height: number) => void;
  onShowMeanings: () => void;
  onTap: (id: string) => void;
  refFor: (id: string, node: Focusable | null) => void;
}

function Replies(props: RepliesProps): ReactElement {
  const { replies, why, meanings, disabled } = props;
  const [rowH, setRowH] = useState(0);
  const [firstH, setFirstH] = useState(0);
  const [view, setView] = useState({ height: 0, content: 0, offset: 0 });
  const { onKeep } = props;
  // Hoya's why line opens at the top of the area, so a nudge is always read where it appears.
  const scrollRef = useRef<ScrollView | null>(null);
  const { whyId } = props;
  useEffect(() => {
    if (whyId !== null) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [whyId]);
  // Kept in view whatever the window: the instruction row and the first reply whole, above the cue when one shows.
  const several = replies.length > 1;
  // `firstH` is the reply with its look-here ring, which sits in its negative margin: the reply itself is 2 rings less.
  useEffect(() => onKeep(PIN_PAD + rowH + spacing.xs + Math.max(0, firstH - 2 * borderWidth.thick) + (several ? CUE_HEIGHT : spacing.xs)), [rowH, firstH, several, onKeep]);
  const more = view.height > 0 && view.content - (view.offset + view.height) > 1;
  return (
    <View style={{ flexShrink: 1 }}>
      <View
        onLayout={(e: LayoutChangeEvent) => setRowH(e.nativeEvent.layout.height)}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: touchTarget.min }}
      >
        <Body tone="secondary" weight="semibold">
          {props.tapLabel}
        </Body>
        <Button
          label={meanings ? props.shownLabel : props.showLabel}
          tone="secondary"
          size="sm"
          disabled={meanings || disabled}
          onPress={props.onShowMeanings}
          testID="role-play-show-meanings"
        />
      </View>
      <View style={{ flexShrink: 1 }}>
        <ScrollView
          ref={scrollRef}
          key={props.turn}
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs }}
          onLayout={(e: LayoutChangeEvent) => {
            const height = e.nativeEvent.layout.height;
            setView((v) => ({ ...v, height }));
          }}
          onContentSizeChange={(_w: number, content: number) => setView((v) => ({ ...v, content }))}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offset = e.nativeEvent.contentOffset.y;
            setView((v) => ({ ...v, offset }));
          }}
          scrollEventThrottle={32}
          testID="role-play-replies"
        >
          {why ? <WhyBubble parts={why} /> : null}
          {replies.map((r, i) => (
            <ReplyBubble
              key={r.id}
              reply={r}
              wrongLabel={props.wrongLabel}
              hintLabel={props.hintLabel}
              onTap={() => props.onTap(r.id)}
              refFor={(node) => props.refFor(r.id, node)}
              onLayout={i === 0 ? setFirstH : undefined}
            />
          ))}
        </ScrollView>
        {more ? <ScrollCue label={props.moreLabel} /> : null}
      </View>
    </View>
  );
}

function replyName(r: ReplyView): string {
  return [`${r.ko}, ${r.romanization}`, r.meaning].filter((s): s is string => s !== undefined).join('. ');
}

interface ReplyBubbleProps {
  reply: ReplyView;
  wrongLabel: (label: string) => string;
  hintLabel: (label: string) => string;
  onTap: () => void;
  refFor: (node: Focusable | null) => void;
  onLayout?: (height: number) => void;
}

function ReplyBubble({ reply, wrongLabel, hintLabel, onTap, refFor, onLayout }: ReplyBubbleProps): ReactElement {
  const textScale = useTypeScale();
  const locked = reply.look === 'locked';
  const ring = reply.look === 'lookHere';
  const name = locked ? wrongLabel(replyName(reply)) : ring ? hintLabel(replyName(reply)) : replyName(reply);
  return (
    <View
      onLayout={onLayout ? (e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.height) : undefined}
      // The look-here ring sits just outside the bubble (a negative margin), so it takes no room and nothing moves.
      style={{ margin: -borderWidth.thick, borderRadius: radii.xl, borderWidth: borderWidth.thick, borderColor: ring ? colors.border.focus : 'transparent' }}
      testID={ring ? 'role-play-ring' : undefined}
    >
      <Pressable
        ref={(node) => refFor(node as Focusable | null)}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ disabled: reply.disabled }}
        disabled={reply.disabled}
        onPress={onTap}
        testID={`role-play-reply-${reply.id}`}
        style={{
          minHeight: touchTarget.child,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
          borderRadius: radii.xl,
          borderWidth: locked ? borderWidth.thick : borderWidth.base,
          borderColor: locked ? colors.feedback.nudge : colors.border.subtle,
          backgroundColor: locked ? colors.feedback.nudgeLight : reply.look === 'sending' ? colors.brand.secondaryLight : colors.surface.paper,
        }}
      >
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {reply.ko}
        </Text>
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, color: colors.text.secondary }}>{reply.romanization}</Text>
        {reply.meaning ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, color: colors.text.secondary }}>{reply.meaning}</Text> : null}
        {locked ? (
          <View style={{ position: 'absolute', top: spacing.xs, right: spacing.xs }} {...hidden}>
            <Icon name="dash" size={spacing.lg} color={colors.text.secondary} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Hoya's amber line after a less natural reply: `thinking`, and quoted Korean drawn as taught Korean with its romanization. */
function WhyBubble({ parts }: { parts: KoTokenPart[] }): ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      accessibilityLiveRegion="polite"
      testID="role-play-why"
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.feedback.nudgeLight, borderRadius: radii.xl, borderWidth: borderWidth.base, borderColor: colors.feedback.nudge, padding: spacing.md }}
    >
      <View {...hidden}>
        <Hoya pose="thinking" size={touchTarget.min} />
      </View>
      <Text {...KOREAN_LINE_BREAK} style={{ flex: 1, fontSize: textScale.size.body, fontWeight: typography.weight.semibold, color: colors.text.primary, lineHeight: textScale.size.body * typography.leading.relaxed }}>
        {parts.map((part, i) =>
          'text' in part ? (
            <Text {...KOREAN_LINE_BREAK} key={i}>{part.text}</Text>
          ) : (
            <Text {...KOREAN_LINE_BREAK} key={i}>
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontWeight: typography.weight.bold, backgroundColor: colors.surface.paper }}>{` ${part.ko} `}</Text>
              {part.romanization !== '' ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.caption, fontWeight: typography.weight.regular }}>{` ${part.romanization}`}</Text> : null}
            </Text>
          ),
        )}
      </Text>
    </View>
  );
}

/**
 * "More replies below" while replies sit under the pinned area's edge (wireframe States): a fade over the partly shown
 * next reply, a chevron and the caption. Not a tap target (taps pass through) and hidden for screen readers, which
 * reach every reply in the list.
 */
function ScrollCue({ label }: { label: string }): ReactElement {
  const fade = Math.round(CUE_HEIGHT * CUE_FADE_STOP);
  return (
    <View pointerEvents="none" {...hidden} testID="role-play-more" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: CUE_HEIGHT }}>
      <View style={{ height: fade }}>
        {CUE_FADE_STEPS.map((opacity) => (
          <View key={opacity} style={{ flex: 1, backgroundColor: colors.surface.canvas, opacity }} />
        ))}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface.canvas }}>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="arrow-right" size={spacing.md} color={colors.text.secondary} />
        </View>
        <Caption tone="secondary" weight="bold">
          {label}
        </Caption>
      </View>
    </View>
  );
}
