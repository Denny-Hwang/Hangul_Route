import { Body, Button, Caption, Card, Heading, Pill, spacing } from '@hangul-route/design-system';
import { DURATION_IDS, type DurationId, type PaceId, type StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { flags } from '../../config/flags';
import { bandLabel } from '../../logic/placement/copy';
import { draftOfOffer, grownUpWarningText, grownUpWarnings, type PlanOffer } from '../../logic/placement/plan-offer';
import { PACE_IDS, proposalSkippedEvent, proposedEvent } from '../../logic/route/proposal-flow';
import { track } from '../../platform/telemetry';
import { acceptPlanOffer, applyPlanUpdate, loadPlanOffer } from '../../store/plan-offer-store';
import { useProgressStore } from '../../store/progress-store';
import { useRouteStore } from '../../store/route-store';
import { useAccessTier } from '../../store/tier-store';
import { PaceChips } from '../placement/PlanParts';
import { RadioTile } from '../placement/parts';

/**
 * The report's "Suggested weekly plan" card (F-PLC-001 section 3.9, AM-5, AM-10; wireframe
 * journey/my-route-overview.md K2 and K3), at the top of the report while `flags.routeEnabled`
 * is on. The grown-up is already through the gate: **Use this plan** makes the plan at once.
 * The basis in words, the pace chips, the three lengths with the suggested one selected, the
 * warnings in plain words (no price, no plan name, no purchase button), **Change** (the
 * proposal screen) and **Not now**. After a retake that found a later start, **Update the plan**.
 */

type Outcome = 'made' | 'updated' | 'hidden' | null;

export interface SuggestedPlanCardProps {
  profileId: string;
  name: string;
  messages: Messages;
  stageTitle: (key: StageKey) => string;
  onChange: () => void;
}

export function SuggestedPlanCard({ profileId, name, messages, stageTitle, onChange }: SuggestedPlanCardProps): React.ReactElement | null {
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  const tier = useAccessTier(profileId);
  const [offer, setOffer] = useState<PlanOffer | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  // Read again when the results, the plan or the tier change (a saved start, a plan made elsewhere).
  useEffect(() => {
    if (!flags.routeEnabled) return;
    let live = true;
    void loadPlanOffer(profileId, true, new Date()).then((next) => {
      if (live) setOffer(next);
    });
    return () => {
      live = false;
    };
  }, [profileId, snapshot, tier]);

  if (!flags.routeEnabled) return null;
  const m = messages.caregiver.placementReport.plan;
  if (outcome === 'hidden' || (offer === null && outcome === null)) return null;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {outcome === 'made' || outcome === 'updated' ? (
        <Card padding="md" testID="placement-report-plan-done">
          <Body weight="semibold">{outcome === 'made' ? m.made(name) : m.updated}</Body>
        </Card>
      ) : offer?.kind === 'new' ? (
        <NewPlanCard offer={offer} profileId={profileId} name={name} messages={messages} stageTitle={stageTitle} onChange={onChange} onDone={setOutcome} />
      ) : offer?.kind === 'update' ? (
        <UpdateCard profileId={profileId} name={name} messages={messages} offer={offer} onDone={setOutcome} />
      ) : null}
    </View>
  );
}

function useProposedOnce(profileId: string, offer: PlanOffer): void {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const proposal = offer.kind === 'new' ? offer.byPace[offer.pace] : offer.proposal;
    if (proposal === undefined) return;
    const event = proposedEvent(profileId, 'parent', proposal);
    void track({ name: event.name, profileId, payload: { ...event.payload } });
  }, [profileId, offer]);
}

function NewPlanCard({
  offer,
  profileId,
  name,
  messages,
  stageTitle,
  onChange,
  onDone,
}: {
  offer: Extract<PlanOffer, { kind: 'new' }>;
  profileId: string;
  name: string;
  messages: Messages;
  stageTitle: (key: StageKey) => string;
  onChange: () => void;
  onDone: (outcome: Outcome) => void;
}): React.ReactElement | null {
  const m = messages.caregiver.placementReport.plan;
  const t = messages.learner.weeklyPlan.proposal;
  const [pace, setPace] = useState<PaceId>(offer.pace);
  const [picked, setPicked] = useState<DurationId | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const acting = useRef(false);
  useProposedOnce(profileId, offer);

  const proposal = offer.byPace[pace];
  // Until the grown-up picks a length, the suggested one follows the pace.
  const length = picked ?? proposal?.defaultId ?? '4-week';
  const draft = useMemo(() => (proposal === undefined ? null : draftOfOffer(proposal, length)), [proposal, length]);
  if (proposal === undefined) return null;
  const level = proposal.params.level;
  const warnings = grownUpWarnings(draft);

  const use = async (): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setFailed(false);
    const changed = pace !== offer.pace || length !== proposal.defaultId;
    const route = await acceptPlanOffer(profileId, proposal, { changed, length }, new Date());
    acting.current = false;
    setBusy(false);
    if (route === null) setFailed(true);
    else onDone('made');
  };

  const notNow = (): void => {
    void useRouteStore.getState().markDismissed(profileId, new Date().toISOString());
    const event = proposalSkippedEvent(profileId, 'parent');
    void track({ name: event.name, profileId, payload: { ...event.payload } });
    onDone('hidden');
  };

  return (
    <Card padding="md" testID="placement-report-plan">
      <Heading level="prompt">{m.title(name)}</Heading>
      <Body tone="secondary" testID="placement-report-plan-basis">
        {m.basis(`${stageTitle(level.stage)} · ${bandLabel(messages, level)}`, proposal.params.sessionsPerWeek, proposal.params.minutesPerSession)}
      </Body>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <Body weight="semibold">{m.paceTitle}</Body>
        <PaceChips
          t={t}
          selected={pace}
          available={PACE_IDS.filter((id) => offer.byPace[id] !== undefined)}
          onSelect={(next) => {
            setPace(next);
            setPicked(null);
          }}
          label={m.paceTitle}
          testIDPrefix="placement-report-plan-pace"
        />
      </View>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={m.lengthTitle}>
        <Body weight="semibold">{m.lengthTitle}</Body>
        {DURATION_IDS.map((id) => {
          const suggested = id === proposal.defaultId;
          return (
            <RadioTile
              key={id}
              selected={length === id}
              onPress={() => setPicked(id)}
              accessibilityLabel={suggested ? `${t.length[id]}, ${m.suggested}` : t.length[id]}
              testID={`placement-report-plan-length-${id}`}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
                <Body weight="semibold">{t.length[id]}</Body>
                {suggested ? <Pill label={m.suggested} tone="primary" size="sm" /> : null}
              </View>
            </RadioTile>
          );
        })}
      </View>

      {warnings.length > 0 ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }} testID="placement-report-plan-warnings">
          <Body weight="semibold">{m.headsUp}</Body>
          {warnings.map((w) => (
            <Caption key={w.code} tone="secondary">
              {grownUpWarningText(messages, w)}
            </Caption>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button label={m.usePlan} tone="primary" size="lg" fullWidth disabled={busy || draft === null} onPress={() => void use()} testID="placement-report-plan-use" />
        {failed ? (
          <Body tone="secondary" align="center" testID="placement-report-plan-failed">
            {m.failed}
          </Body>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label={m.change} tone="ghost" size="lg" fullWidth disabled={busy} onPress={onChange} testID="placement-report-plan-change" />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={m.notNow} tone="ghost" size="lg" fullWidth disabled={busy} onPress={notNow} testID="placement-report-plan-not-now" />
          </View>
        </View>
      </View>
    </Card>
  );
}

function UpdateCard({
  profileId,
  name,
  messages,
  offer,
  onDone,
}: {
  profileId: string;
  name: string;
  messages: Messages;
  offer: Extract<PlanOffer, { kind: 'update' }>;
  onDone: (outcome: Outcome) => void;
}): React.ReactElement {
  const m = messages.caregiver.placementReport.plan;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const acting = useRef(false);
  useProposedOnce(profileId, offer);

  const update = async (): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setFailed(false);
    const ok = await applyPlanUpdate(profileId, new Date());
    acting.current = false;
    setBusy(false);
    if (ok) onDone('updated');
    else setFailed(true);
  };

  return (
    <Card padding="md" testID="placement-report-plan-update">
      <Heading level="prompt">{m.laterStart(name)}</Heading>
      <Body tone="secondary">{m.laterLine}</Body>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button label={m.updatePlan} tone="primary" size="lg" fullWidth disabled={busy} onPress={() => void update()} testID="placement-report-plan-update-cta" />
        {failed ? (
          <Body tone="secondary" align="center">
            {m.failed}
          </Body>
        ) : null}
      </View>
    </Card>
  );
}
