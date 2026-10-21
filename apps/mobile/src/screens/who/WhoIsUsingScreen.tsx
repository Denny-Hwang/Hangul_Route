import {
  Body,
  Button,
  Heading,
  Screen,
  borderWidth,
  colors,
  radii,
  spacing,
  useEffectiveFontScale,
  useLayoutClass,
} from '@hangul-route/design-system';
import { LOCALE_META, type UiLocale } from '@hangul-route/i18n';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { GrownUpRow } from '../../components/GrownUpRow';
import { WhoTile } from '../../components/WhoTile';
import { useOnline } from '../../components/use-online';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { resetWaitState } from '../../logic/profiles/pin-reset';
import { planProfileSwitch, routeZone } from '../../logic/profiles/session';
import {
  chooserHandoff,
  grownUpRows,
  pickLanding,
  rowLabelKey,
  tileOrder,
  tileTints,
  whoPickedEvent,
  whoShownEvent,
  type GrownUpRowUse,
  type WhoMarker,
} from '../../logic/profiles/who';
import { gateRequired } from '../../logic/profiles/learner-type';
import { ROOT_HEADER } from '../../navigation/screen-header-variants';
import type { RootStackParamList } from '../../navigation/types';
import { openGrownUpArea } from '../../platform/grown-up-handoff';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { trackGateOpened, trackProfileSwitch } from '../../store/gate-telemetry';
import { arriveAtChooser } from '../../store/grown-up-session';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { heldJoin, knownUses, learnerProfiles, persistLeaving, refreshKnownUses, takeHeldJoin } from '../../store/who-chooser';
import { useBackGuard } from '../use-back-guard';

type Props = NativeStackScreenProps<RootStackParamList, 'WhoIsUsing'>;

/** `WHO_TILE_MIN` (design/screens/profiles/README.md): 8rem, 10rem from `layout.breakpoint.wide`; rem follows the text size. */
const REM = 16;
const TILE_MIN_REM = 8;
const TILE_MIN_WIDE_REM = 10;
/** The grown-up rows from `layout.breakpoint.wide` (GrownUpRow spec); one column below it. */
const ROWS_ACROSS = 3;

/** The end of the wait as a local time in the UI language ("6:40 PM", "18:40", "오후 6:40"); never throws. */
export function waitEndsAt(locale: UiLocale, readyAt: number): string {
  const date = new Date(readyAt);
  try {
    return date.toLocaleTimeString(LOCALE_META[locale].speechLang, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * [OA] "Who is using this?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.1 to 6.3 and 14, row OA-4a; wireframe
 * `design/wireframes/profiles/who-is-using.md`, mock `design/screens/profiles/who-is-using.md`). The device's one
 * chooser: a large tile per learner (one tap, no PIN), Add a learner, and the Grown-ups section, visibly secondary:
 * the pending 24-hour wait with Cancel the wait (OA-D21), then on the web the account's uses known on this browser
 * (Family, Teacher, School; `deviceUses`, row OA-4b) or Sign in as a grown-up, and the Grown-up area row. A use row
 * asks the PIN (`PinEntry { next: 'GrownUpUse', use }`, verify only) and hands off with `via: 'chooser'`; offline it
 * is disabled with Needs the internet. Rows carry generic labels only, never an account name or email (CS-7).
 * No tile shows progress, stars, a level, a streak, a space or a time (CS-6). No Back; the browser, phone and
 * Android back are swallowed (CS-5). Arriving here closes the grown-up session (CS-2).
 */
export function WhoIsUsingScreen({ navigation, route }: Props): React.ReactElement {
  const messages = useMessages();
  const w = messages.learner.who;
  const locale = useLocale();
  const { trigger } = route.params;
  const allProfiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const setActive = useProfileStore((s) => s.setActive);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const pinResetRequestedAt = useAccountStore((s) => s.pinResetRequestedAt);
  const { copy, opensDirectly } = useAudience();
  const online = useOnline();
  const layoutClass = useLayoutClass();
  const fontScale = useEffectiveFontScale();

  const learners = useMemo(() => tileOrder(learnerProfiles(allProfiles), locale), [allProfiles, locale]);
  const tints = useMemo(() => tileTints(learnerProfiles(allProfiles)), [allProfiles]);
  const marker: WhoMarker = !gateRequired({ profiles: allProfiles, parentPinHash }) ? 'none' : parentPinHash !== null ? 'pin' : 'nopin';
  const wait = resetWaitState(pinResetRequestedAt, Date.now());
  // [OA] Row OA-4b: the uses known on this browser, as read at launch, then read again on every opening.
  const [uses, setUses] = useState(() => knownUses());
  const grownUps = grownUpRows({
    os: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    uses,
    online,
    marker,
    // A wait only exists beside a PIN (Forgot PIN starts from one); none is shown without a PIN to cancel it.
    resetPending: wait.status === 'idle' || parentPinHash === null ? null : wait.readyAt,
  });
  const joining = heldJoin() !== null;

  // Arriving here, and coming back here from a PIN screen or the Grown-up area, ends any grown-up session (CS-2).
  useFocusEffect(useCallback(() => arriveAtChooser(), []));

  // The console may have written `deviceUses` since launch (a grown-up signed in in another tab).
  useEffect(() => {
    let live = true;
    void refreshKnownUses().then((read) => {
      if (live) setUses(read);
    });
    return () => {
      live = false;
    };
  }, []);

  // One `who.shown` per opening (section 15, G6), never one per focus.
  useEffect(() => {
    void track(
      whoShownEvent({
        trigger,
        learners: learners.length,
        grownUps: grownUps.rows.length,
        anyLocked: false,
        resetPending: grownUps.pending !== null,
      }),
    );
    // Pre-warm every learner's snapshot so Home renders at once after a pick (G7).
    for (const p of learners) void useProgressStore.getState().hydrate(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);

  // No Back (CS-5): every back is held; the screen's own ways on (a pick) let it go.
  const leaving = useRef(false);
  useBackGuard(navigation, () => !leaving.current, true);

  /** The zone of the route under the chooser, or `null` when it is the stack's root (launch). */
  const underZone = (): 'area' | 'gate' | 'learner' | null => {
    const state = navigation.getState();
    if (state.index <= 0) return null;
    const under = state.routes[state.index - 1]!;
    return routeZone(under.name, under.params);
  };

  /**
   * Before a grown-up row or Add a learner: what ran under the chooser is persisted and taken off the stack, so
   * coming back from there lands on the chooser, never on a quest or an old grown-up page (section 6.2).
   */
  const clearUnder = (): void => {
    const state = navigation.getState();
    const current = state.routes[state.index]!;
    if (!state.routes.slice(0, state.index).some((r) => r.name !== 'Main')) return;
    if (planProfileSwitch('resume', true).persistRequired) persistLeaving();
    navigation.reset({ index: 1, routes: [{ name: 'Main' }, { key: current.key, name: 'WhoIsUsing', params: route.params }] });
  };

  const pickLearner = (id: string): void => {
    const same = id === activeId;
    const under = underZone();
    void track(whoPickedEvent('learner'));
    if (!same) {
      if (under !== null && planProfileSwitch('resume', true).persistRequired) persistLeaving();
      trackProfileSwitch('chooser', false, Date.now(), trigger);
    }
    // setActive closes the grown-up session on a change of learner (OA-D5b).
    setActive(id);
    const landing = pickLanding({ same, under, join: heldJoin() });
    leaving.current = true;
    if (landing.kind === 'back') navigation.goBack();
    else if (landing.kind === 'join') {
      takeHeldJoin();
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'JoinSpace', params: landing.code === null ? undefined : { code: landing.code } }] });
    } else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const pickArea = (): void => {
    void track(whoPickedEvent('grown_up', 'area'));
    clearUnder();
    // The chooser closed every session, so only a device without a gate opens directly (marker `none`).
    if (opensDirectly(false)) {
      trackGateOpened('ParentDashboard', 'open');
      navigation.navigate('ParentDashboard');
    } else navigation.navigate('PinEntry', { next: 'ParentDashboard' });
  };

  /**
   * Row OA-4b, section 5.3: Family, Teacher, School or Sign in as a grown-up. The chooser closed every session, so the
   * PIN is asked whatever came before (CS-1); only a self-only device without a PIN (marker `none`) hands off at once.
   */
  const pickUse = (use: Exclude<GrownUpRowUse, 'area'>): void => {
    void track(whoPickedEvent('grown_up', use));
    clearUnder();
    if (opensDirectly(false)) {
      trackGateOpened('GrownUpUse', 'open');
      leaving.current = true;
      void openGrownUpArea(chooserHandoff(use));
    } else navigation.navigate('PinEntry', { next: 'GrownUpUse', use });
  };

  const pickAdd = (): void => {
    void track(whoPickedEvent('add'));
    clearUnder();
    if (opensDirectly(false)) {
      trackGateOpened('AddProfile', 'open');
      navigation.navigate('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
    } else navigation.navigate('PinEntry', { next: 'AddProfile' });
  };

  const pickCancelWait = (): void => {
    void track(whoPickedEvent('cancel_reset'));
    navigation.navigate('PinEntry', { next: 'CancelReset' });
  };

  // The grid (WhoTile spec): auto-fill columns of at least 8rem (10rem on a wide window), in rem so a larger text
  // size takes a column away before a name would truncate.
  const [gridWidth, setGridWidth] = useState(0);
  const gap = spacing.md;
  const measured = gridWidth > 0 ? gridWidth : Math.max(0, Math.min(layoutClass.windowWidth, layoutClass.maxWidth.reading) - 2 * layoutClass.gutter);
  const tileMin = (layoutClass.width === 'wide' ? TILE_MIN_WIDE_REM : TILE_MIN_REM) * REM * fontScale;
  const columns = Math.max(1, Math.floor((measured + gap) / (tileMin + gap)));
  const tileWidth = Math.floor((measured - gap * (columns - 1)) / columns);
  const rowsAcross = layoutClass.width === 'wide' && grownUps.rows.length > 1;
  const rowGap = spacing.sm;
  const rowWidth = Math.floor((measured - rowGap * (ROWS_ACROSS - 1)) / ROWS_ACROSS);

  // Web keyboard (section 14): the grid is one tab stop; arrow keys, Home and End move it; Enter or Space picks.
  const tileCount = learners.length + 1;
  const firstFocus = trigger === 'resume' ? Math.max(0, learners.findIndex((p) => p.id === activeId)) : 0;
  const [rove, setRove] = useState(firstFocus);
  const tileRefs = useRef<(View | null)[]>([]);
  const moveTo = (index: number): void => {
    const next = Math.min(tileCount - 1, Math.max(0, index));
    setRove(next);
    (tileRefs.current[next] as unknown as { focus?: () => void } | null)?.focus?.();
  };
  const onGridKey = (event: { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void }): void => {
    const key = event.key ?? event.nativeEvent?.key;
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    if (key === 'Home') moveTo(0);
    else if (key === 'End') moveTo(tileCount - 1);
    else if (key !== undefined && step[key] !== undefined) moveTo(rove + step[key]);
    else return;
    event.preventDefault?.();
  };

  // Focus starts on the title (section 14), on the web, where a page change leaves focus behind.
  const titleRef = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') (titleRef.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, []);

  const keyProps = Platform.OS === 'web' ? ({ onKeyDown: onGridKey } as Record<string, unknown>) : {};

  return (
    <Screen tone="canvas" scrollable header={ROOT_HEADER} width={layoutClass.width === 'wide' ? 'full' : 'reading'} testID="who-is-using">
      <View ref={titleRef} {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} style={{ outlineStyle: 'none' } as object}>
        <Heading level="title">{w.title}</Heading>
      </View>
      {joining ? (
        <View style={{ paddingTop: spacing.xs }}>
          <Body size="lg" weight="semibold" testID="who-join-caption">
            {w.joinCaption}
          </Body>
        </View>
      ) : null}

      <View style={{ paddingTop: spacing.lg, gap: spacing.sm }}>
        <Body weight="bold" tone="secondary">
          {w.learning}
        </Body>
        <View
          testID="who-tiles"
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
          {...keyProps}
        >
          {learners.map((p, i) => (
            <WhoTile
              key={p.id}
              ref={(node) => {
                tileRefs.current[i] = node;
              }}
              variant="learner"
              label={p.displayName}
              avatar={p.avatar}
              tint={tints[p.id] ?? null}
              width={tileWidth}
              accessibilityLabel={messages.a11y.who.tile(p.displayName)}
              tabStop={Platform.OS !== 'web' || i === rove}
              onFocus={() => setRove(i)}
              onPress={() => pickLearner(p.id)}
              testID={`who-tile-${i}`}
            />
          ))}
          <WhoTile
            ref={(node) => {
              tileRefs.current[learners.length] = node;
            }}
            variant="add"
            label={w.add}
            width={tileWidth}
            accessibilityLabel={copy.gatedA11y(w.add, parentPinHash !== null)}
            tabStop={Platform.OS !== 'web' || rove === learners.length}
            onFocus={() => setRove(learners.length)}
            onPress={pickAdd}
            testID="who-add"
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, gap: spacing.sm }}>
        <Body weight="bold" tone="secondary">
          {w.grownUps}
        </Body>
        {grownUps.pending !== null ? (
          // Plain text read in order with the section, not a live region (section 14).
          <View testID="who-reset-pending" style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
            <Body>{w.resetPending(waitEndsAt(locale, grownUps.pending.readyAt))}</Body>
            <Button label={w.resetCancel} tone="secondary" size="md" onPress={pickCancelWait} testID="who-reset-cancel" />
          </View>
        ) : null}
        {/* One column on a phone, three across from the wide breakpoint (GrownUpRow spec). */}
        <View testID="who-rows" style={{ flexDirection: rowsAcross ? 'row' : 'column', flexWrap: 'wrap', gap: rowGap }}>
          {grownUps.rows.map((row) => {
            const { use } = row;
            const label = use === 'area' ? copy.zoneLabel : w.use[rowLabelKey(use)];
            const caption = row.caption === 'nopin' ? w.nopinCaption : row.caption === 'offline' ? messages.learner.welcome.grownUps.needsInternet : null;
            // A row no PIN guards is named by its label alone (marker `none`, and `nopin`, where no PIN exists yet).
            const named = marker === 'pin' ? messages.a11y.who.grownUpRow(label) : label;
            return (
              <View key={use} style={rowsAcross ? { width: rowWidth } : undefined}>
                <GrownUpRow
                  label={label}
                  locked={row.locked}
                  disabled={row.disabled}
                  caption={caption}
                  accessibilityLabel={named}
                  onPress={use === 'area' ? pickArea : () => pickUse(use)}
                  testID={`who-row-${use}`}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}
