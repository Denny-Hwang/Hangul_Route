import { Hoya, Icon, borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '@hangul-route/design-system';
import type { LectureDeck } from '@hangul-route/content-schema';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions, type PressableStateCallbackType, type TextStyle, type ViewStyle } from 'react-native';
import { radioAfter, recentDayLabel, type RecentState } from '../../logic/lecture/home-view';
import { buildQuickDeck, canChoose, quickFull, quickGroups, toggleChoice, type QuickGroupId, type QuickItem, type QuickSource } from '../../logic/lecture/quick-lesson';
import type { RecentItem } from '../../logic/lecture/recent';
import type { LanguageOption } from '../../logic/locale/language-picker';

/**
 * The presenter home (F-TCH-004 §3.12; design `design/screens/presenter/home.md`,
 * mocks `home.html` and `home-empty.html`, README D2, D14, D19): Recent lessons
 * and Quick lesson on a teacher page in real pixels (not stage-scaled).
 *
 * Header: Hoya, the h1, the session language chips (a radiogroup: one tab stop,
 * arrows move and select) and Keys and help. Below 900 px one column with Recent
 * first; from 900 px Recent left and Quick lesson right. Recent rows show the
 * deck title and the day only: a deck has no name field, so no row can hold a
 * learner's name. With storage off the Recent list is replaced by one line and
 * Quick lesson still works. No text is below `typography.size.body` (D2).
 *
 * Everything outside comes in as props (the presenter's own dictionary and
 * locale, the Recent state, the bundle's Quick lesson source), so the screen
 * reads no learner store (§3.9).
 */
export interface PresenterHomeProps {
  /** The dictionary of the presenter's session language. */
  messages: Messages;
  locale: UiLocale;
  /** The chips; fewer than two draws none (`showLanguagePickers`). */
  languages: readonly LanguageOption[];
  /** The chip chosen in this session, or null; only this, never the device locale, goes into a built deck. */
  sessionLocale: UiLocale | null;
  onLanguage: (locale: UiLocale) => void;
  /** Opens the Help overlay (PR 9); without it the Keys and help button is not drawn, so it never leads nowhere. */
  onHelp?: () => void;
  recent: RecentState;
  onResume: (item: RecentItem) => void;
  onStartOver: (item: RecentItem) => void;
  onRemove: (deckId: string) => void;
  quick: QuickSource;
  onBuild: (deck: LectureDeck) => void;
  /** Landing after Exit or an invalid link: focus goes to the h1. */
  focusTitle?: boolean;
  /** Injected for tests and screenshots. */
  now?: () => Date;
  rng?: () => number;
}

type Focusable = PressableStateCallbackType & { focused?: boolean };

/** The `border.focus` ring outside the control on keyboard focus (README D19); nothing moves at rest. */
function ring(focused: boolean | undefined): ViewStyle {
  if (!focused) return {};
  // react-native-web draws CSS outlines; the native style type does not list them.
  const outline = { outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: borderWidth.base };
  return outline as ViewStyle;
}

const text = (size: number, weight: keyof typeof typography.weight, color: string): TextStyle => ({
  fontSize: size,
  fontWeight: typography.weight[weight],
  color,
  lineHeight: Math.round(size * typography.leading.normal),
});

function H({ level, children, style }: { level: 1 | 2 | 3; children: string; style: TextStyle }): React.ReactElement {
  return (
    <Text role="heading" aria-level={level} style={style}>
      {children}
    </Text>
  );
}

/**
 * The page's pill buttons as the mock draws them (`mock/presenter.css` `.btn`): paper with a
 * `border.strong` outline, or `brand.primaryDark` when primary; disabled is `surface.sunken`
 * (shape and fill, not colour of the text alone). `compact` is the 64 px row and header size.
 */
function HomeButton({
  label,
  onPress,
  primary,
  compact,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  compact?: boolean;
  disabled?: boolean;
  testID?: string;
}): React.ReactElement {
  const fill = disabled ? colors.surface.sunken : primary ? colors.brand.primaryDark : colors.surface.paper;
  const edge = disabled ? colors.surface.sunken : primary ? colors.brand.primaryDark : colors.border.strong;
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      aria-disabled={disabled === true}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ focused }: Focusable) => ({
        minHeight: compact ? touchTarget.min : touchTarget.hero,
        minWidth: compact ? touchTarget.min : touchTarget.hero,
        paddingVertical: compact ? spacing.xs : spacing.sm,
        paddingHorizontal: compact ? spacing.lg : spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.pill,
        borderWidth: borderWidth.base,
        borderColor: edge,
        backgroundColor: fill,
        ...ring(focused),
      })}
    >
      <Text
        style={{
          ...text(compact ? typography.size.body : typography.size.bodyLg, 'bold', primary && !disabled ? colors.text.onPrimary : colors.text.primary),
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const GROUP_KEY: Record<QuickGroupId, keyof Messages['learner']['presenter']['home']['quick']['group']> = {
  episodes: 'episodes',
  lessons: 'lessons',
  letterSets: 'letterSets',
  topics: 'topics',
  stories: 'stories',
};

export function PresenterHomeScreen(props: PresenterHomeProps): React.ReactElement {
  const { messages, locale } = props;
  const m = messages.learner.presenter;
  const { width } = useWindowDimensions();
  const wide = width >= layout.breakpoint.wide;
  const gutter = wide ? layout.gutter.wide : width >= layout.breakpoint.regular ? layout.gutter.regular : layout.gutter.compact;
  const titleRef = useRef<Text>(null);

  useEffect(() => {
    if (props.focusTitle) (titleRef.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, [props.focusTitle]);

  const recent = <RecentPanel {...props} />;
  const quick = <QuickPanel {...props} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface.paper }} contentContainerStyle={{ flexGrow: 1 }} testID="presenter-home">
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Hoya pose="waving" size={touchTarget.min} />
            <Text ref={titleRef} role="heading" aria-level={1} {...{ tabIndex: -1 }} testID="presenter-home-title" style={text(typography.size.title, 'bold', colors.text.primary)}>
              {m.home.title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
            {props.languages.length >= 2 ? (
              <LanguageRadios options={props.languages} selected={locale} onSelect={props.onLanguage} label={m.language.title} />
            ) : null}
            {props.onHelp ? <HomeButton label={m.home.help.cta} onPress={props.onHelp} compact testID="presenter-home-help" /> : null}
          </View>
        </View>
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
            <View style={{ flex: 1, minWidth: 0 }}>{recent}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{quick}</View>
          </View>
        ) : (
          <View style={{ gap: spacing.xl }}>
            {recent}
            {quick}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/** README D19: one tab stop on the chosen chip; arrows, Home and End move and select. */
function LanguageRadios({
  options,
  selected,
  onSelect,
  label,
}: {
  options: readonly LanguageOption[];
  selected: UiLocale;
  onSelect: (locale: UiLocale) => void;
  label: string;
}): React.ReactElement {
  const refs = useRef(new Map<UiLocale, View | null>());
  const locales = options.map((o) => o.locale);
  const onKey = (e: { key: string; preventDefault?: () => void }): void => {
    const next = radioAfter(locales, selected, e.key);
    if (next === null) return;
    e.preventDefault?.();
    if (next !== selected) onSelect(next);
    refs.current.get(next)?.focus?.();
  };
  return (
    <View role="radiogroup" aria-label={label} testID="presenter-home-language" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const on = o.locale === selected;
        return (
          <Pressable
            key={o.locale}
            ref={(el) => {
              refs.current.set(o.locale, el);
            }}
            role="radio"
            aria-checked={on}
            accessibilityState={{ checked: on }}
            tabIndex={on ? 0 : -1}
            onPress={() => {
              if (!on) onSelect(o.locale);
            }}
            {...{ onKeyDown: onKey, lang: o.htmlLang }}
            testID={`presenter-home-language-${o.locale}`}
            style={({ focused }: Focusable) => ({
              minHeight: touchTarget.min,
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              borderRadius: radii.pill,
              borderWidth: on ? borderWidth.thick : borderWidth.base,
              borderColor: on ? colors.text.primary : colors.border.strong,
              backgroundColor: colors.surface.paper,
              ...ring(focused),
            })}
          >
            <Text style={text(typography.size.body, 'bold', colors.text.primary)}>{o.endonym}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RecentPanel({ messages, locale, recent, onResume, onStartOver, onRemove, now }: PresenterHomeProps): React.ReactElement {
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
    <Text
      testID={testID}
      style={{
        ...text(typography.size.body, 'regular', colors.text.secondary),
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
                <Text style={{ ...text(typography.size.bodyLg, 'bold', colors.text.primary), overflowWrap: 'anywhere' } as TextStyle}>{item.deck.title}</Text>
                <Text style={text(typography.size.body, 'regular', colors.text.secondary)}>{recentDayLabel(locale, day, item.savedAt, today)}</Text>
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
      <Text ref={headingRef} role="heading" aria-level={2} {...{ tabIndex: -1 }} style={text(typography.size.prompt, 'bold', colors.text.primary)}>
        {m.title}
      </Text>
      {body}
    </View>
  );
}

function QuickPanel({ messages, sessionLocale, quick, onBuild, now, rng }: PresenterHomeProps): React.ReactElement {
  const m = messages.learner.presenter.home.quick;
  const groups = useMemo(() => quickGroups(quick, { consonants: m.consonants, vowels: m.vowels }), [quick, m.consonants, m.vowels]);
  const items = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [chosen, setChosen] = useState<readonly string[]>([]);
  // A new bundle (a language switch) keeps the choices that still exist.
  useEffect(() => {
    setChosen((c) => c.filter((key) => items.some((i) => i.key === key)));
  }, [items]);
  const full = quickFull(chosen, items);
  const build = (): void => {
    const deck = buildQuickDeck(chosen, items, {
      now: (now ?? (() => new Date()))(),
      rng: rng ?? Math.random,
      fallbackTitle: m.title,
      // Only a chip the teacher chose is kept with the deck; with none it opens in the device language.
      ...(sessionLocale !== null ? { uiLocale: sessionLocale } : {}),
    });
    if (deck) onBuild(deck);
  };
  return (
    <View role="region" aria-label={m.title} style={{ gap: spacing.md }} testID="presenter-home-quick">
      <H level={2} style={text(typography.size.prompt, 'bold', colors.text.primary)}>
        {m.title}
      </H>
      <Text style={text(typography.size.body, 'regular', colors.text.secondary)}>{m.line}</Text>
      {groups.map((group) => (
        <View key={group.id} style={{ gap: spacing.xs }}>
          <H level={3} style={{ ...text(typography.size.body, 'bold', colors.text.secondary), paddingTop: spacing.sm }}>
            {m.group[GROUP_KEY[group.id]]}
          </H>
          <View style={{ gap: spacing.xs }}>
            {group.items.map((item) => (
              <QuickRow
                key={item.key}
                item={item}
                detail={item.detail.kind === 'minutes' ? m.minutes(item.detail.n) : m.letters(item.detail.n)}
                on={chosen.includes(item.key)}
                disabled={!canChoose(chosen, item.key, items)}
                onToggle={() => setChosen((c) => toggleChoice(c, item.key, items))}
              />
            ))}
          </View>
        </View>
      ))}
      <View
        style={{
          borderTopWidth: borderWidth.thin,
          borderTopColor: colors.border.subtle,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text role="status" aria-live="polite" testID="presenter-home-chosen" style={{ ...text(typography.size.body, 'regular', colors.text.primary), flexShrink: 1 }}>
          {chosen.length === 0 ? m.nothing : full ? `${m.chosen(chosen.length)} ${m.full}` : m.chosen(chosen.length)}
        </Text>
        <HomeButton label={m.build.cta} onPress={build} primary disabled={chosen.length === 0} testID="presenter-home-build" />
      </View>
      <Text style={text(typography.size.body, 'regular', colors.text.secondary)}>{messages.learner.presenter.language.note}</Text>
    </View>
  );
}

function QuickRow({
  item,
  detail,
  on,
  disabled,
  onToggle,
}: {
  item: QuickItem;
  detail: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <Pressable
      role="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      accessibilityState={{ checked: on, disabled }}
      // Named by its title and detail texts (no label is put together in code); a row that does not
      // fit stays in the tab order, marked disabled, so the reason in the status line can be found.
      onPress={() => {
        if (!disabled) onToggle();
      }}
      testID={`presenter-quick-${item.key}`}
      style={({ focused }: Focusable) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: touchTarget.min,
        paddingVertical: spacing.sm - (on ? borderWidth.thick - borderWidth.thin : 0),
        paddingHorizontal: spacing.md - (on ? borderWidth.thick - borderWidth.thin : 0),
        borderWidth: on ? borderWidth.thick : borderWidth.thin,
        borderColor: on ? colors.text.primary : colors.border.subtle,
        borderRadius: radii.md,
        backgroundColor: disabled ? colors.surface.sunken : colors.surface.paper,
        ...ring(focused),
      })}
    >
      <View
        style={{
          width: spacing.xxl,
          height: spacing.xxl,
          borderWidth: borderWidth.thick,
          borderColor: colors.text.primary,
          borderRadius: radii.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {on ? <Icon name="check" size={spacing.xl} color={colors.text.primary} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={text(typography.size.body, 'bold', colors.text.primary)}>{item.title}</Text>
        <Text style={text(typography.size.body, 'regular', colors.text.secondary)}>{detail}</Text>
      </View>
    </Pressable>
  );
}
