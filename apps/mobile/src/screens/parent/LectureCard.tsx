import { Body, Button, Card, Heading, Icon, KOREAN_LINE_BREAK, Spacer, borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import React, { useId, useState } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { appPresetContext, nextLessonHref } from '../../logic/lecture-entry/next-lesson';
import { emptySnapshot } from '../../logic/my-route/view';
import { routeNext, type RouteNext } from '../../logic/route-next';
import { openPresenter, presenterRootExists } from '../../platform/present-handoff';
import { PRESENTER_PATH } from '../../platform/presenter';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { useProgressStore } from '../../store/progress-store';
import { routeNextInputFor } from '../../store/route-next-input';

/**
 * The Lecture mode card in the grown-up area of the learner app (AMENDMENTS-LECTURE-V2 section 3 E5, row LV-6;
 * design `design/screens/lecture-entry/learner-card.md`, mock `mock/learner-card-states.html`). After
 * `GrownUpHomeCard` on the dashboard, which is behind the grown-up gate. Web only, as `GateLessonsButton` (the
 * presenter is a root of the web build), and only while `flags.lectureModeEnabled` is on (LV-D1, on by default since LV-7):
 * otherwise it draws nothing, never a disabled control.
 *
 * - **Next lesson for {name}**, one row per learner on this device once that learner's progress is read: the deck is
 *   built in the app root from that learner's `routeNext` (N3) and holds quest ids only; the name stays on this
 *   screen (sections 7 item 4 and 8).
 * - **Open lecture mode**: the presenter home (`/present`), nothing handed over.
 *
 * Both open the presenter in a new tab with no opener (section 7 item 3), inside the tap so no pop-up blocker stops
 * it. The dashboard stays open after the 15-minute grown-up session ends, so every press asks the gate again
 * (`gateOpensDirectlyNow`, as See report and Open all lessons do): closed, the PIN screen opens and nothing is built;
 * back here with the gate open, one more tap opens the tab. When the browser gives no tab, a line under the card says
 * so. Nothing here writes progress or sends telemetry (the presenter sends `lecture.start` itself, section 11).
 */

type PresetWords = Messages['learner']['presenter']['presets'];

export interface LectureLearner {
  id: string;
  /** Shown on this screen only ("Next lesson for {name}"); never passed to the deck or the link. */
  name: string;
}

/**
 * The presenter link for one learner's Next lesson, read from the stores of the app root (section 4.2 N3): the
 * learner's progress, plans and access give `routeNext` through `routeNextInputFor`, the same input the dashboard's
 * Learning Route row reads, so the two never drift apart. A fresh deck per press (its own id and clock). Null when no
 * deck could be built, so the row falls back to the presenter home.
 */
export function learnerNextLessonHref(profileId: string, words: PresetWords, now: Date = new Date()): string | null {
  const snapshot = useProgressStore.getState().byProfile[profileId] ?? emptySnapshot(profileId);
  let next: RouteNext | null;
  try {
    next = routeNext(routeNextInputFor(profileId, now));
  } catch {
    // Content that could not be read: Next lesson then starts from its fallback (Hangul week 1).
    next = null;
  }
  try {
    return nextLessonHref(appPresetContext({ next, quests: snapshot.quests, now }), words, { now, rng: Math.random });
  } catch {
    // A deck that could not be resolved or encoded (for example too large for a link): the presenter home instead.
    return null;
  }
}

/** The keyboard focus ring (`colors.border.focus`, 3:1 against the card); react-native-web draws CSS outlines. */
function focusRing(focused: boolean | undefined): ViewStyle {
  if (!focused) return {};
  return { outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: -borderWidth.thick } as ViewStyle;
}

/** A hidden copy of the hint, so a screen reader on the web hears it too (react-native-web drops `accessibilityHint`). */
function WebHint({ id, text }: { id: string; text: string }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK} id={id} style={{ display: 'none' }}>
      {text}
    </Text>
  );
}

function NextRow({ label, hint, onPress, first, testID }: { label: string; hint: string; onPress: () => void; first: boolean; testID: string }): React.ReactElement {
  const hintId = useId();
  return (
    <Pressable
      aria-describedby={hintId}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => ({
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? borderWidth.thin : 0,
        borderBottomWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        backgroundColor: pressed || focused ? colors.surface.sunken : colors.surface.paper,
        ...focusRing(focused),
      })}
    >
      <Body weight="semibold" style={{ flex: 1 }}>
        {label}
      </Body>
      <Icon name="arrow-right" size={spacing.xl} color={colors.text.primary} />
      <WebHint id={hintId} text={hint} />
    </Pressable>
  );
}

export function LectureCard({
  learners,
  onGate,
  opensDirectly = gateOpensDirectlyNow,
  open = openPresenter,
  hrefFor = learnerNextLessonHref,
}: {
  learners: readonly LectureLearner[];
  /** The PIN screen, when the grown-up session has lapsed (`PinEntry { next: 'LectureMode' }`). */
  onGate: () => void;
  opensDirectly?: () => boolean;
  /** Opens a presenter link in a new tab; false when the browser gave none. */
  open?: (href: string) => boolean;
  hrefFor?: (profileId: string, words: PresetWords) => string | null;
}): React.ReactElement | null {
  const messages = useMessages();
  const m = messages.caregiver.lecture;
  const hydratedFor = useProgressStore((s) => s.hydratedFor);
  // How many presses in a row the browser gave no tab: 0 shows no line. The count keys the line, so each blocked
  // press draws a fresh node and the polite live region says it again.
  const [blocked, setBlocked] = useState(0);
  if (Platform.OS !== 'web' || !flags.lectureModeEnabled || !presenterRootExists()) return null;

  const press = (href: () => string): void => {
    if (!opensDirectly()) {
      // An earlier "did not open" line would be stale after the PIN round trip.
      setBlocked(0);
      onGate();
      return;
    }
    let target: string;
    try {
      target = href();
    } catch {
      // Never a dead button: a link that could not be built opens the presenter home.
      target = PRESENTER_PATH;
    }
    const opened = open(target);
    setBlocked((n) => (opened ? 0 : n + 1));
  };
  // Nothing is drawn for a learner until their progress is read, so a row never names a next lesson from nothing.
  const rows = learners.filter((l) => hydratedFor.has(l.id));

  return (
    <>
      <Card padding="md" testID="dashboard-lecture">
        <Heading level="prompt" testID="dashboard-lecture-title">
          {m.title}
        </Heading>
        <Spacer size="xs" />
        <Body tone="secondary">{m.body}</Body>
        <Spacer size="sm" />
        {rows.length > 0 ? (
          <>
            <View role="list" testID="dashboard-lecture-rows">
              {rows.map((learner, i) => (
                <View key={learner.id} role="listitem">
                  <NextRow
                    label={m.next(learner.name)}
                    hint={m.opensTab}
                    first={i === 0}
                    // The name stays on this screen: the deck is built from the learner's id.
                    onPress={() => press(() => hrefFor(learner.id, messages.learner.presenter.presets) ?? PRESENTER_PATH)}
                    testID={`dashboard-lecture-next-${learner.id}`}
                  />
                </View>
              ))}
            </View>
            <Spacer size="sm" />
          </>
        ) : null}
        {/* End-aligned (the mock): the Button sets its own alignSelf, so the box around it moves to the end. */}
        <View style={{ alignSelf: 'flex-end', maxWidth: '100%' }}>
          <Button label={m.open.cta} accessibilityHint={m.opensTab} tone="ghost" size="md" onPress={() => press(() => PRESENTER_PATH)} testID="dashboard-lecture-open" />
        </View>
        <View role="status" aria-live="polite" accessibilityLiveRegion="polite">
          {blocked > 0 ? (
            <Body key={blocked} size="sm" tone="secondary" testID="dashboard-lecture-blocked">
              {m.blocked}
            </Body>
          ) : null}
        </View>
      </Card>
      <Spacer size="lg" />
    </>
  );
}
