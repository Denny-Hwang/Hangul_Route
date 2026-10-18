import { Hoya, Icon, borderWidth, colors, layout, radii, shadows, spacing, touchTarget, useTypeScale, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { PRESET_DEFAULT_MINUTES, resolvePreset, type ChooserGroup, type LectureDeck, type LecturePreset, type PresetContext, type PresetMinutes, type StageKey } from '@hangul-route/content-schema';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type TextStyle } from 'react-native';
import { lengthOf, type HomeSnapshot } from '../../logic/lecture/home-state';
import { recentDayLabel, type RecentState } from '../../logic/lecture/home-view';
import { firstStageOf } from '../../logic/lecture/preset-source';
import { buildQuickDeck } from '../../logic/lecture/quick-lesson';
import type { RecentItem } from '../../logic/lecture/recent';
import { DisplayButton } from '../../components/DisplayButton';
import { HomeButton, Line, ring, text, type Focusable } from './home-parts';
import { LessonChooser } from './LessonChooser';
import { PresetCards } from './PresetCards';

/**
 * The presenter home (F-TCH-004 §3.12; AMENDMENTS-LECTURE-V2 sections 4, 7 item 3 and 18, row
 * LV-3; design `design/screens/presenter/presets.md`, mocks `presets*.html`): a teacher page in
 * real pixels (not stage-scaled) whose type follows the chosen text size (`useTypeScale`).
 *
 * - **Top row**: the one **Back** at the top left (section 7 item 3): with an app page before
 *   `/present` in this tab it goes back (`onBack`, `history.back()` with its fallback), otherwise it
 *   is a plain link to the app root `/` (`backHref`; every new tab the console, All lessons and E5
 *   open); at the right the Display (Aa) control (the device's one language and text size; the
 *   presenter has no language chips) and Keys and help. Then Hoya and the h1, **Lecture mode**.
 * - **Ready-made lessons** first (`PresetCards`); **Recent lessons** beside them from 900 px, below
 *   them on narrower screens; **Customize** under both, folded, holding the grouped chooser
 *   (`LessonChooser`), which replaces the flat Quick lesson list.
 * - The open card, its chips, Customize, the chooser and the scroll position live in the home's
 *   kept state (`state`, section 18.2), owned by the presenter root, so Back from the start screen
 *   shows the page exactly as it was.
 *
 * Recent rows show the deck title and the day only: a deck has no name field, so no row can hold a
 * learner's name. Everything outside comes in as props, so the screen reads no learner store (§3.9).
 */
export interface PresenterHomeProps {
  /** The dictionary of the presenter's language (the device's). */
  messages: Messages;
  locale: UiLocale;
  /** Opens the Display (Aa) sheet; without it the Aa button is not drawn. */
  onDisplay?: () => void;
  /** Opens the Help overlay (PR 9); without it the Keys and help button is not drawn, so it never leads nowhere. */
  onHelp?: () => void;
  /** Back to the page before `/present` in this tab (`leavePresenter`); used when `backHref` is absent. */
  onBack?: () => void;
  /** Back as a plain link (to the app root) when this tab has no app page before `/present`. */
  backHref?: string;
  recent: RecentState;
  onResume: (item: RecentItem) => void;
  onStartOver: (item: RecentItem) => void;
  onRemove: (deckId: string) => void;
  /** The ready-made lessons' context (`presenterPresetContext`). */
  presetCtx: PresetContext;
  onPreset: (preset: LecturePreset, minutes: PresetMinutes, stage: StageKey) => void;
  /** Customize's chooser groups in the presenter language (`presenterChooserGroups`). */
  groups: readonly ChooserGroup[];
  onBuild: (deck: LectureDeck) => void;
  /** The home's kept state and its changes (section 18.2). */
  state: HomeSnapshot;
  onState: (patch: Partial<HomeSnapshot>) => void;
  /** Where the page was scrolled to when it was left; reported back while it scrolls. */
  onScroll?: (y: number) => void;
  /** Landing after Exit or an invalid link: focus goes to the h1. */
  focusTitle?: boolean;
  /** Landing from the preview's Customize: focus goes to the Customize button (scrolled into view). */
  focusCustomize?: boolean;
  /** Injected for tests and screenshots. */
  now?: () => Date;
  rng?: () => number;
}

const REM = 16;
/** Recent's column beside the presets from 900 px (`presets.md` item 4, `--side-col`). */
const SIDE_COLUMN_REM = 18;
const CUSTOMIZE_PANEL = 'presenter-customize-panel';
/** How long the home waits for its content to grow tall enough to restore the kept scroll position. */
const RESTORE_WAIT_MS = 2000;

function BackControl({ label, onBack, href }: { label: string; onBack?: () => void; href?: string }): React.ReactElement | null {
  const ts = useTypeScale().size;
  if (href === undefined && onBack === undefined) return null;
  const look = ({ focused }: Focusable) => ({
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    ...ring(focused),
  });
  const body = (
    <>
      <Icon name="arrow-left" size={spacing.xl} color={colors.text.primary} />
      <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'bold', colors.text.primary)}>
        {label}
      </Text>
    </>
  );
  // A plain link to the app root: the anchor navigates by itself, so nothing is handed over.
  if (href !== undefined) {
    return (
      <Pressable role="link" {...{ href }} accessibilityLabel={label} testID="presenter-home-back" style={look}>
        {body}
      </Pressable>
    );
  }
  return (
    <Pressable role="button" accessibilityLabel={label} onPress={onBack} testID="presenter-home-back" style={look}>
      {body}
    </Pressable>
  );
}

export function PresenterHomeScreen(props: PresenterHomeProps): React.ReactElement {
  const scale = useTypeScale();
  const ts = scale.size;
  const { messages, state, onState } = props;
  const m = messages.learner.presenter;
  const { width } = useWindowDimensions();
  const wide = width >= layout.breakpoint.wide;
  const gutter = wide ? layout.gutter.wide : width >= layout.breakpoint.regular ? layout.gutter.regular : layout.gutter.compact;
  const titleRef = useRef<Text>(null);
  const customizeRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Back to a page that was scrolled: the h1 takes focus without moving the page (section 18.2).
    if (props.focusTitle) (titleRef.current as unknown as { focus?: (options?: { preventScroll?: boolean }) => void } | null)?.focus?.({ preventScroll: state.scrollY > 0 });
    // Only on arrival (`state.scrollY` is read, not watched): a later scroll does not move focus again.
  }, [props.focusTitle]);
  useEffect(() => {
    if (props.focusCustomize) customizeRef.current?.focus?.();
  }, [props.focusCustomize]);

  // The scroll position kept on Back (section 18.2): restored once the page is tall enough to scroll that far
  // (the content grows as Recent loads and Customize lays out). Until then no scroll is reported back, so a
  // position clamped on the way is never kept in its place.
  const restoreTo = useRef(props.focusCustomize ? 0 : state.scrollY);
  const viewHeight = useRef(0);
  const contentHeight = useRef(0);
  const restore = (): void => {
    const y = restoreTo.current;
    if (y <= 0 || viewHeight.current <= 0 || contentHeight.current - viewHeight.current < y) return;
    scrollRef.current?.scrollTo({ y, animated: false });
    restoreTo.current = 0;
  };
  const onContentSize = (_w: number, h: number): void => {
    contentHeight.current = h;
    restore();
  };
  // A page that never grows that tall (a text size changed meanwhile) stops waiting, so its own scroll is kept again.
  useEffect(() => {
    const timer = setTimeout(() => {
      restoreTo.current = 0;
    }, RESTORE_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (restoreTo.current > 0) return;
    props.onScroll?.(e.nativeEvent.contentOffset.y);
  };
  /**
   * Leaving the home: the position is read from the page itself first, since the last scroll event can
   * still be on its way (react-native-web reports the end of a scroll 100 ms after it).
   */
  const leaving = <A extends unknown[]>(go: (...args: A) => void) => (...args: A): void => {
    const node = (scrollRef.current as unknown as { getScrollableNode?: () => { scrollTop?: unknown } | null } | null)?.getScrollableNode?.();
    if (restoreTo.current <= 0 && typeof node?.scrollTop === 'number') props.onScroll?.(node.scrollTop);
    go(...args);
  };

  const stages = useMemo(() => props.groups.flatMap((g) => (g.stage !== null && g.rows.some((r) => r.kind === 'episode') ? [g.id as StageKey] : [])), [props.groups]);
  const defaultStage = useMemo((): StageKey => {
    if (state.open === null) return 'stage1';
    const resolved = resolvePreset(state.open, lengthOf(state, state.open, PRESET_DEFAULT_MINUTES[state.open]), { ...props.presetCtx, stage: state.stage });
    return firstStageOf(resolved.blocks) ?? 'stage1';
  }, [state, props.presetCtx]);

  const build = leaving((): void => {
    const deck = buildQuickDeck(state.chosen, props.groups, {
      now: (props.now ?? (() => new Date()))(),
      rng: props.rng ?? Math.random,
      fallbackTitle: m.presets.chooser.tray.title,
    });
    if (deck) props.onBuild(deck);
  });

  const presets = <PresetCards messages={messages} ctx={props.presetCtx} stages={stages} state={state} onState={onState} onStart={leaving(props.onPreset)} />;
  const recent = <RecentPanel {...props} onResume={leaving(props.onResume)} onStartOver={leaving(props.onStartOver)} />;
  const sideWidth = SIDE_COLUMN_REM * REM * scale.factor;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.surface.paper }}
      contentContainerStyle={{ flexGrow: 1 }}
      onContentSizeChange={onContentSize}
      onLayout={(e) => {
        viewHeight.current = e.nativeEvent.layout.height;
        restore();
      }}
      onScroll={onScroll}
      scrollEventThrottle={100}
      testID="presenter-home"
    >
      <View
        role="main"
        style={{
          width: '100%',
          maxWidth: layout.maxWidth.full,
          alignSelf: 'center',
          paddingTop: spacing.lg,
          paddingBottom: spacing.jumbo,
          paddingHorizontal: gutter,
          gap: spacing.xl,
        }}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <BackControl label={messages.common.buttons.back} {...(props.backHref !== undefined ? { href: props.backHref } : {})} {...(props.onBack ? { onBack: props.onBack } : {})} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' }}>
              {props.onDisplay ? <DisplayButton onPress={props.onDisplay} testID="presenter-home-display" /> : null}
              {props.onHelp ? <HomeButton label={m.home.help.cta} onPress={props.onHelp} compact testID="presenter-home-help" /> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, maxWidth: '100%' }}>
            <Hoya pose="waving" size={touchTarget.min} />
            <Text {...KOREAN_LINE_BREAK} ref={titleRef} role="heading" aria-level={1} {...{ tabIndex: -1 }} testID="presenter-home-title" style={{ ...text(ts.title, 'bold', colors.text.primary), flexShrink: 1 }}>
              {m.home.title}
            </Text>
          </View>
        </View>
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
            <View style={{ flex: 1, minWidth: 0 }}>{presets}</View>
            <View style={{ width: sideWidth, maxWidth: '40%' }}>{recent}</View>
          </View>
        ) : (
          <View style={{ gap: spacing.xl }}>
            {presets}
            {recent}
          </View>
        )}
        <View role="region" aria-label={m.presets.customize.cta} testID="presenter-home-customize" style={{ gap: spacing.md, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, paddingTop: spacing.xl }}>
          <View style={{ alignItems: 'flex-start' }}>
            <HomeButton
              buttonRef={customizeRef}
              label={m.presets.customize.cta}
              compact
              icon={state.customize ? 'dash' : 'plus'}
              expanded={state.customize}
              controls={CUSTOMIZE_PANEL}
              onPress={() => onState({ customize: !state.customize })}
              testID="presenter-home-customize-toggle"
            />
          </View>
          <Line>{m.presets.customize.lead}</Line>
          <View nativeID={CUSTOMIZE_PANEL} {...{ id: CUSTOMIZE_PANEL }} style={state.customize ? undefined : { display: 'none' }}>
            {state.customize ? <LessonChooser messages={messages} groups={props.groups} state={state} onState={onState} defaultStage={defaultStage} onBuild={build} /> : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function RecentPanel({ messages, locale, recent, onResume, onStartOver, onRemove, now }: PresenterHomeProps): React.ReactElement {
  const ts = useTypeScale().size;
  const m = messages.learner.presenter.home.recent;
  // After a remove, focus moves to the next row's remove button (or the one before), else the h2,
  // so keyboard and screen-reader focus never falls to the page body.
  const removeRefs = useRef(new Map<string, View | null>());
  const headingRef = useRef<Text>(null);
  const [focusAfterRemove, setFocusAfterRemove] = useState<{ target: string | null } | null>(null);
  const items = recent.status === 'ready' ? recent.list.items : null;
  useEffect(() => {
    if (focusAfterRemove === null) return;
    const target = focusAfterRemove.target === null ? undefined : removeRefs.current.get(focusAfterRemove.target);
    if (target) target.focus?.();
    else (headingRef.current as unknown as { focus?: () => void } | null)?.focus?.();
    setFocusAfterRemove(null);
  }, [items, focusAfterRemove]);
  const remove = (deckId: string): void => {
    const ids = (items ?? []).map((i) => i.deck.id);
    const at = ids.indexOf(deckId);
    setFocusAfterRemove({ target: ids[at + 1] ?? ids[at - 1] ?? null });
    onRemove(deckId);
  };
  const day = { today: messages.common.notes.date.today, yesterday: messages.common.notes.date.yesterday };
  const today = (now ?? (() => new Date()))();
  const line = (copy: string, testID: string): React.ReactElement => (
    <Text {...KOREAN_LINE_BREAK}
      testID={testID}
      style={{
        ...text(ts.body, 'regular', colors.text.secondary),
        padding: spacing.lg,
        borderWidth: borderWidth.base,
        borderStyle: 'dashed',
        borderColor: colors.border.strong,
        borderRadius: radii.lg,
      }}
    >
      {copy}
    </Text>
  );
  let body: React.ReactElement | null;
  if (recent.status === 'loading') body = null;
  else if (recent.status === 'off') body = line(m.storageOff, 'presenter-home-recent-off');
  else if (recent.list.items.length === 0) body = line(m.empty, 'presenter-home-recent-empty');
  else
    body = (
      <View role="list" style={{ gap: spacing.md }}>
        {recent.list.items.map((item) => (
          <View
            key={item.deck.id}
            role="listitem"
            testID={`presenter-recent-${item.deck.id}`}
            style={{
              borderWidth: borderWidth.thin,
              borderColor: colors.border.subtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              gap: spacing.sm,
              backgroundColor: colors.surface.paper,
              ...shadows.card,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text {...KOREAN_LINE_BREAK} style={{ ...text(ts.bodyLg, 'bold', colors.text.primary), overflowWrap: 'anywhere' } as TextStyle}>{item.deck.title}</Text>
                <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'regular', colors.text.secondary)}>{recentDayLabel(locale, day, item.savedAt, today)}</Text>
              </View>
              <Pressable
                role="button"
                aria-label={messages.a11y.presenter.removeRecent(item.deck.title)}
                ref={(el) => {
                  removeRefs.current.set(item.deck.id, el);
                }}
                onPress={() => remove(item.deck.id)}
                testID={`presenter-recent-remove-${item.deck.id}`}
                style={({ focused }: Focusable) => ({
                  width: touchTarget.min,
                  height: touchTarget.min,
                  borderRadius: radii.circle,
                  borderWidth: borderWidth.base,
                  borderColor: colors.border.strong,
                  backgroundColor: colors.surface.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...ring(focused),
                })}
              >
                <Icon name="close" size={spacing.xl} color={colors.text.primary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <HomeButton label={m.resume.cta} onPress={() => onResume(item)} primary compact testID={`presenter-recent-resume-${item.deck.id}`} />
              <HomeButton label={m.startOver.cta} onPress={() => onStartOver(item)} compact testID={`presenter-recent-startover-${item.deck.id}`} />
            </View>
          </View>
        ))}
      </View>
    );
  return (
    <View role="region" aria-label={m.title} style={{ gap: spacing.md }} testID="presenter-home-recent">
      <Text {...KOREAN_LINE_BREAK} ref={headingRef} role="heading" aria-level={2} {...{ tabIndex: -1 }} style={text(ts.prompt, 'bold', colors.text.primary)}>
        {m.title}
      </Text>
      {body}
    </View>
  );
}
