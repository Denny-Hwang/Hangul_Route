import { Body, Button, Caption, Card, Heading, Icon, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useOnline } from '../../components/use-online';
import { useMessages } from '../../i18n/use-messages';
import { nameHint } from '../../logic/onboarding/create-profile-form';
import { validateDisplayName } from '../../logic/profiles/profile-model';
import {
  batchEvent,
  batchJoined,
  batchPickNeedsPin,
  initialPicks,
  pickedInOrder,
  resultLines,
  runBatch,
  togglePick,
  type BatchRun,
  type ChecklistRow,
} from '../../logic/spaces/join-batch';
import { joinErrorMessage } from '../../logic/spaces/join-code';
import { track } from '../../platform/telemetry';
import { useMembershipStore } from '../../store/membership-store';
import { useUiStore } from '../../store/ui-store';
import { JoinNameField } from './JoinNameField';

/** The cub on a checklist row (mock `design/screens/profiles/who-is-joining.md`: 40). */
const ROW_AVATAR = 40;
/** The check box (24 on the mock): the type scale's largest spacing step under the row's touch target. */
const BOX = spacing.xl;

export interface JoinBatchProps {
  /** The family the lookup found. */
  space: { id: string; name: string };
  code: string;
  /** `checklistRows(...)`, in tile order. */
  rows: readonly ChecklistRow[];
  /** The grown-up gate is closed (no session): each name keeps the profile name, as on the one-learner join. */
  gateClosed: boolean;
  /** Opens the PIN screen for a fresh PIN (CS-11); the screen returns here. */
  askPin: () => void;
  /** Not this one on a name step: back to the code. */
  onCodeAgain: () => void;
  /** Done on the results. */
  onDone: () => void;
}

type Step = { kind: 'who' } | { kind: 'name'; index: number } | { kind: 'consent' } | { kind: 'running' } | { kind: 'results' };

/**
 * [OA] "Who is joining?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, sections 10.2, 10.3, 10.6, CS-11; row OA-7b;
 * wireframe `profiles/people-on-device.md` Panels D and E, mock `design/screens/profiles/who-is-joining.md` boards 1
 * to 8). Shown by Join after the lookup found a family, on a device with 2 or more learner profiles, while
 * `flags.multiJoinEnabled` is on.
 *
 * 1. The checklist: a real check box per learner (the name as its label, the caption as its description). The active
 *    learner starts checked; a locked profile starts unchecked with **Takes a family place.**; a class-scoped learner
 *    is disabled with **Linked for a class on this device.** Next asks a fresh PIN first when the pick includes anyone
 *    but the active learner (CS-11). Offline, Next stays reachable but does nothing and says it needs the internet.
 * 2. The shipped name step, once per picked learner in turn.
 * 3. One consent step naming every picked learner: joining saves each one's progress to the account (it registers a
 *    learner that never synced) and the family's grown-ups see each name and their progress. Not now goes back to the
 *    checklist and registers nobody. Yes, join asks the PIN again if it is no longer fresh.
 * 4. The joins in sequence (`membership-store.join` per learner, one `/join` each). A refused seat is a result line.
 *    The first network error stops them: the lines so far, the offline line and **Try again** for the rest. Try again
 *    asks the fresh PIN again before the rest join when they include anyone but the active learner (CS-11). One run at
 *    a time: a second tap sends nothing more.
 * 5. One result line per learner, a polite status heading, `space.join.batch` once.
 */
export function JoinBatch({ space, code, rows, gateClosed, askPin, onCodeAgain, onDone }: JoinBatchProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.join;
  const w = m.who;
  const join = useMembershipStore((s) => s.join);
  const lastPinVerifiedAt = useUiStore((s) => s.lastPinVerifiedAt);
  const online = useOnline();

  const [picks, setPicks] = useState<readonly string[]>(() => initialPicks(rows));
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.displayName])));
  const [step, setStep] = useState<Step>({ kind: 'who' });
  const [run, setRun] = useState<BatchRun | null>(null);
  // What waits on the PIN screen: the name steps (Next), the joins (Yes, join) or the rest of them (Try again).
  const [afterPin, setAfterPin] = useState<'names' | 'joins' | 'retry' | null>(null);
  const picked = pickedInOrder(picks, rows);
  const sent = useRef(false);
  // Read when the run is reported, which may be on leaving the screen.
  const pickedCount = useRef(picked.length);
  pickedCount.current = picked.length;

  const needsPin = (ids: readonly string[] = picks): boolean =>
    batchPickNeedsPin({ picks: ids, rows, lastPinVerifiedAt: useUiStore.getState().lastPinVerifiedAt, now: Date.now() });
  // Try again joins only the learners left; they need the fresh PIN (CS-11) however long the results stood.
  const retryIds = (before: BatchRun | null): string[] => before?.stop?.remaining.map((p) => p.id) ?? [];

  const report = (finished: BatchRun): void => {
    if (sent.current) return;
    sent.current = true;
    void track(batchEvent(pickedCount.current, finished.results));
  };

  // One run at a time: a second tap on Yes, join or Try again before the step re-renders sends nothing more.
  const running = useRef(false);
  const start = async (before?: BatchRun): Promise<void> => {
    if (running.current) return;
    running.current = true;
    try {
      setStep({ kind: 'running' });
      const todo = before?.stop?.remaining ?? picked.map((r) => ({ id: r.id, name: (names[r.id] ?? r.displayName).trim() }));
      const finished = await runBatch(todo, (id, name) => join(id, space.id, code, name || undefined), before);
      setRun(finished);
      setStep({ kind: 'results' });
      if (finished.stop === null || !finished.stop.retry) report(finished);
    } finally {
      running.current = false;
    }
  };

  // A run left with Try again still counts once (the grown-up left the screen instead).
  const runRef = useRef<BatchRun | null>(null);
  runRef.current = run;
  useEffect(
    () => () => {
      if (runRef.current !== null) report(runRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on leaving
    [],
  );

  // Back from the PIN screen with a fresh PIN: go on where Next, Yes, join or Try again waited.
  useEffect(() => {
    if (afterPin === null || needsPin(afterPin === 'retry' ? retryIds(runRef.current) : picks)) return;
    const next = afterPin;
    setAfterPin(null);
    if (next === 'names') setStep({ kind: 'name', index: 0 });
    else if (next === 'retry') void start(runRef.current ?? undefined);
    else void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to a new PIN only
  }, [lastPinVerifiedAt, afterPin]);

  const next = (): void => {
    if (!online || picked.length === 0) return;
    if (needsPin()) {
      setAfterPin('names');
      askPin();
      return;
    }
    setStep({ kind: 'name', index: 0 });
  };

  const consentYes = (): void => {
    if (needsPin()) {
      setAfterPin('joins');
      askPin();
      return;
    }
    void start();
  };

  const retry = (): void => {
    if (running.current) return;
    if (needsPin(retryIds(run))) {
      setAfterPin('retry');
      askPin();
      return;
    }
    void start(run ?? undefined);
  };

  if (step.kind === 'name') {
    const row = picked[step.index];
    if (row === undefined) return <></>;
    const value = gateClosed ? row.displayName : (names[row.id] ?? row.displayName);
    const unchanged = value.trim() === row.displayName;
    const hint = unchanged ? null : nameHint(value, messages.learner.createProfile.nameHint);
    const nameOk = value.trim().length > 0 && (unchanged || validateDisplayName(value) === null);
    return (
      <Card padding="lg" tone="brand" testID="join-confirm">
        {/* Whose step this is: the learner's cub and profile name, read before the field. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} testID="join-who-name-for">
          <ProfileAvatar avatar={row.avatar} size={ROW_AVATAR} />
          <Body weight="bold">{row.displayName}</Body>
        </View>
        <Spacer size="sm" />
        <Caption tone="muted">{m.confirm.seeYouAs.family}</Caption>
        <Spacer size="xs" />
        <JoinNameField
          value={value}
          onChange={(v) => setNames((s) => ({ ...s, [row.id]: v }))}
          locked={gateClosed}
          classDevice={false}
          profileName={row.displayName}
          hint={hint}
        />
        <Spacer size="md" />
        <Button
          label={m.confirm.me.cta}
          tone="primary"
          size="lg"
          fullWidth
          disabled={!nameOk}
          onPress={() => setStep(step.index + 1 < picked.length ? { kind: 'name', index: step.index + 1 } : { kind: 'consent' })}
        />
        <Spacer size="sm" />
        <Button label={m.confirm.notThis.cta} tone="ghost" size="sm" fullWidth onPress={onCodeAgain} />
      </Card>
    );
  }

  if (step.kind === 'consent') {
    return (
      <View testID="join-who-consent">
        <Heading level="prompt">{w.consentTitle(space.name)}</Heading>
        <Spacer size="md" />
        <View role="list">
          {picked.map((r, i) => (
            <View
              key={r.id}
              role="listitem"
              style={{ paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : borderWidth.thin, borderTopColor: colors.border.subtle }}
            >
              <Body>{w.consentLine((names[r.id] ?? r.displayName).trim() || r.displayName)}</Body>
            </View>
          ))}
        </View>
        <Spacer size="sm" />
        <Body tone="secondary">{w.consentSees}</Body>
        <Spacer size="lg" />
        <Button label={w.consentYes} tone="primary" size="lg" fullWidth onPress={consentYes} />
        <Spacer size="sm" />
        <Button label={w.notNow} tone="ghost" size="md" fullWidth onPress={() => setStep({ kind: 'who' })} />
      </View>
    );
  }

  if (step.kind === 'running' || step.kind === 'results') {
    const done = run?.results ?? [];
    const stop = run?.stop ?? null;
    return (
      <View testID="join-who-results">
        {/* The heading is announced once there are results: during the first run nothing has answered yet. */}
        <View role="status" aria-live="polite">
          {run !== null ? <Heading level="prompt">{w.result(batchJoined(done), picked.length)}</Heading> : null}
        </View>
        <Spacer size="md" />
        <View role="list">
          {resultLines(done, messages.caregiver).map((line, i) => (
            <View key={done[i]!.id} role="listitem" style={{ paddingVertical: spacing.xs }}>
              <Body testID={`join-who-line-${i}`}>{line}</Body>
            </View>
          ))}
        </View>
        {stop !== null ? (
          <>
            <Spacer size="sm" />
            <Body tone="secondary" testID="join-who-stop">
              {joinErrorMessage(stop.error, messages.caregiver)}
            </Body>
          </>
        ) : null}
        <Spacer size="lg" />
        {step.kind === 'running' ? (
          <Button label={m.confirm.joining.cta} tone="primary" size="lg" fullWidth disabled onPress={() => undefined} />
        ) : stop !== null && stop.retry ? (
          <Button label={w.retry} tone="primary" size="lg" fullWidth onPress={retry} />
        ) : (
          <Button label={messages.common.buttons.done} tone="primary" size="lg" fullWidth onPress={onDone} />
        )}
      </View>
    );
  }

  const nextBlocked = !online || picked.length === 0;
  return (
    <View testID="join-who">
      <Heading level="prompt">{w.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{w.hint}</Body>
      <Spacer size="md" />
      <View role="list" style={{ gap: spacing.sm }}>
        {rows.map((r) => (
          <ChecklistItem key={r.id} row={r} checked={picks.includes(r.id)} caption={r.caption === null ? null : w[r.caption]} onToggle={() => setPicks((p) => togglePick(p, r.id, rows))} />
        ))}
      </View>
      <Spacer size="lg" />
      <Button
        label={messages.common.buttons.next}
        tone="primary"
        size="lg"
        fullWidth
        softDisabled={nextBlocked}
        accessibilityHint={!online ? messages.learner.welcome.grownUps.needsInternet : undefined}
        onPress={next}
        testID="join-who-next"
      />
      {!online ? (
        <>
          <Spacer size="xs" />
          <Caption tone="muted" align="center">
            {messages.learner.welcome.grownUps.needsInternet}
          </Caption>
        </>
      ) : null}
    </View>
  );
}

/**
 * One learner on the checklist: a real check box labelled by the name, its caption as the description. A row of at
 * least `touchTarget.min`; a disabled (class-scoped) row is sunken with the name muted and cannot be checked.
 */
function ChecklistItem({ row, checked, caption, onToggle }: { row: ChecklistRow; checked: boolean; caption: string | null; onToggle: () => void }): React.ReactElement {
  const captionId = `join-who-caption-${row.id}`;
  return (
    <View role="listitem">
      <Pressable
        testID={`join-who-row-${row.id}`}
        accessibilityRole="checkbox"
        accessibilityLabel={row.displayName}
        accessibilityHint={caption ?? undefined}
        accessibilityState={{ checked, disabled: row.disabled }}
        aria-checked={checked}
        aria-disabled={row.disabled}
        aria-describedby={caption === null ? undefined : captionId}
        disabled={row.disabled}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget.min,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.md,
          borderWidth: borderWidth.thin,
          borderColor: colors.border.strong,
          backgroundColor: row.disabled ? colors.surface.sunken : colors.surface.paper,
        }}
      >
        <View
          style={{
            width: BOX,
            height: BOX,
            borderRadius: radii.xs,
            borderWidth: borderWidth.base,
            borderColor: row.disabled ? colors.text.muted : colors.text.primary,
            backgroundColor: checked ? colors.text.primary : colors.surface.paper,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Icon name="check" size={BOX - spacing.sm} color={colors.text.inverse} /> : null}
        </View>
        <ProfileAvatar avatar={row.avatar} size={ROW_AVATAR} />
        <View style={{ flex: 1 }}>
          <Body weight="bold" tone={row.disabled ? 'muted' : 'primary'}>
            {row.displayName}
          </Body>
          {caption !== null ? (
            <View nativeID={captionId}>
              <Caption tone={row.disabled ? 'muted' : 'secondary'}>{caption}</Caption>
            </View>
          ) : null}
        </View>
        {row.locked && !row.disabled ? <Icon name="lock" size={BOX} color={colors.text.secondary} /> : null}
      </Pressable>
    </View>
  );
}
