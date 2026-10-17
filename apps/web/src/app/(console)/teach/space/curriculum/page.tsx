'use client';

import { CATALOG, PACES, ThemeKeySchema, WEEKDAYS, generateCurriculum, type CurriculumDraft, type PaceId, type StageKey, type ThemeKey, type Weekday } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Chip, ChipGroup, ShortPlanLine, SuggestedTag, WarningList, WeekTable, onRadioKeys } from '@/components/console/CurriculumParts';
import { Button, Muted, Notice, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsole } from '@/components/console/use-console';
import type { Roster } from '@/lib/console/api';
import { contentGatingEnabled } from '@/lib/console/config';
import {
  FOCUS_CHOICES,
  LENGTH_CHOICES,
  MAX_DAYS_OFF,
  MINUTE_CHOICES,
  PACE_CHOICES,
  STARTING_POINT_IDS,
  defaultsFor,
  draftPlanBody,
  followProposal,
  freeDaysView,
  learnerProblem,
  leftOutNeutral,
  lengthPreviewText,
  levelHint,
  paceOf,
  pacePatch,
  prefilledState,
  relearnedState,
  spaceCoverage,
  statsText,
  suggestedPace,
  toParams,
  unlockedStagesForSpace,
  weekGroups,
  weekdayLabel,
  weeksOf,
  wizardProblem,
  wizardProposal,
  type ProposalContext,
  type SpaceCoverage,
  type WizardProblem,
  type WizardState,
} from '@/lib/console/curriculum';
import { dateKey } from '@/lib/console/plans';
import { ROUTES, spaceIdFrom } from '@/lib/console/routing';
import { spaceSubPageBack } from '@/lib/console/page-back';
import { headRem, rem } from '@/lib/console/rem';

const STEPS = 4;

const inputStyle: CSSProperties = {
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: rem(typography.size.bodySm),
  borderRadius: radii.md,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
};

const labelStyle: CSSProperties = { display: 'block', fontSize: rem(typography.size.caption), color: colors.text.muted, marginBottom: spacing.xs };

/**
 * console/curriculum-wizard — F-PLAN-002 section 3.8 (wireframe console/curriculum-planner A-D).
 * Four steps; the generator runs in the page (no network), and **Use this route** saves an
 * unpublished plan with its meta and opens the plan builder on it. The wizard starts from
 * `proposeRoute` (PR P2-6b, FP-B5; OD-12 / OD-13): the suggested pace and length are pre-selected
 * and tagged *Suggested*, each length carries one honest preview line, and the start, focus,
 * themes and motivation are prefilled; the length follows the start and the pace until the
 * grown-up picks one. The step controls wait for the roster, so a route always knows its audience.
 */
function CurriculumInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console.curriculum;
  // Fixed for the visit, so a date rolling over while the wizard is open never empties a step.
  const [today] = useState(() => dateKey(new Date()));
  const [roster, setRoster] = useState<Roster | null>(null);
  const [unlocked, setUnlocked] = useState<StageKey[]>(['stage1']);
  // F-ENT-003 section 3.9.3: whether this viewer knows the space is uncovered (read only while the free-plan switch is on).
  const [coverage, setCoverage] = useState<SpaceCoverage>('unknown');
  const [state, setState] = useState<WizardState>(() => defaultsFor('class', [], today));
  // Once the grown-up changes anything, a late roster no longer resets the form to its defaults.
  const touched = useRef(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<'cantReach' | 'saveFailed' | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);

  // Next and Back unmount the focused button: move focus to the page heading, which names the step.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    // A coverage from an earlier load never outlives it (as the roster page does).
    setCoverage('unknown');
    const gating = contentGatingEnabled();
    const [r, e, memberships] = await Promise.all([api.roster(spaceId), api.entitlements(), gating ? api.listSpaces() : null]);
    if (!r.ok) {
      setError('cantReach');
      return;
    }
    setRoster(r.data);
    const kind = r.data.space.kind === 'family' ? 'family' : 'class';
    // Without the entitlement list the route plans Stage 1 only and lists the rest as locked: honest, never more than allowed.
    const stages: StageKey[] = e.ok ? unlockedStagesForSpace(e.data, r.data.space, new Date()) : ['stage1'];
    setUnlocked(stages);
    // The audience always follows the roster; a form already touched keeps its other choices. An
    // untouched form starts from the proposal for this roster and tier (P2-6b).
    setState((s) =>
      touched.current
        ? { ...s, audience: kind, learnerId: kind === 'family' && r.data.learners.some((l) => l.id === s.learnerId) ? s.learnerId : null }
        : prefilledState(kind, { learners: r.data.learners, unlockedStages: stages, today }),
    );
    if (gating) setCoverage(spaceCoverage(e.ok ? e.data : null, memberships?.ok ? memberships.data : null, r.data.space, new Date()));
  }, [api, spaceId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const audience = roster?.space.kind === 'family' ? 'family' : 'class';
  const learners = useMemo(() => roster?.learners ?? [], [roster]);

  const context: ProposalContext = useMemo(() => ({ learners, unlockedStages: unlocked, today }), [learners, unlocked, today]);

  const update = (patch: Partial<WizardState>): void => {
    touched.current = true;
    setState((s) => ({ ...s, ...patch }));
  };

  // A change of the start, the learner or the pace: the length follows the new suggestion until the grown-up picks one.
  const updateAndFollow = (patch: Partial<WizardState>): void => {
    touched.current = true;
    setState((s) => followProposal({ ...s, ...patch }, context));
  };

  const problem: WizardProblem | null = wizardProblem(state, today);
  const loading = roster === null;
  const noLearner = learnerProblem(state, learners.length);
  const draft: CurriculumDraft | null = useMemo(() => {
    const params = toParams(state, unlocked);
    if (!params || problem !== null) return null;
    try {
      return generateCurriculum(params, CATALOG);
    } catch {
      return null;
    }
  }, [state, unlocked, problem]);
  // F-ENT-003 section 3.9.3: an uncovered space with the free-plan switch on (null otherwise: today's wording). Only the preview step shows it.
  const free = useMemo(() => (step === STEPS && draft ? freeDaysView(draft, coverage, contentGatingEnabled()) : null), [step, draft, coverage]);
  // The switch is on but this viewer cannot tell the coverage: neutral product words, no link (section 3.11).
  const neutral = leftOutNeutral(coverage, contentGatingEnabled());
  // The *Suggested* length and the line under each length chip (step 2 only: four generator runs).
  const pace = paceOf(state);
  const proposal = useMemo(
    () => (step === 2 && roster !== null ? wizardProposal(state, context) : null),
    // The proposal reads the start, the learner, the pace, the start day and the motivation; nothing else of the form.
    [step, roster, context, state.audience, state.start, state.learnerId, pace, state.startDate, state.motivation],
  );

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const hint = audience === 'class' || learners.length >= 3 ? levelHint(learners) : null;
  const weeks = weeksOf(state);
  const suggested = suggestedPace(state, learners);

  const problemText = (p: WizardProblem): string => {
    switch (p) {
      case 'no-length':
        return c.rhythm.chooseLength;
      case 'bad-weeks':
        return c.rhythm.badWeeks;
      case 'start-past':
        return c.rhythm.startPast;
      case 'break-missing':
        return c.rhythm.breakMissing;
      case 'break-reversed':
        return c.rhythm.breakReversed;
      case 'too-many-breaks':
        return c.rhythm.tooManyBreaks;
      case 'too-many':
        return c.rhythm.tooMany;
    }
  };

  const pickLearner = (id: string): void => {
    if (!id) {
      update({ learnerId: null });
      return;
    }
    // The proposal for this learner (FP-B5); what the grown-up already chose stays.
    touched.current = true;
    setState((s) => relearnedState(s, context, id));
  };

  const toggleDay = (day: Weekday): void => {
    updateAndFollow({ rhythmPicked: true, sessionDays: state.sessionDays.includes(day) ? state.sessionDays.filter((d) => d !== day) : [...state.sessionDays, day] });
  };

  const toggleTheme = (theme: ThemeKey): void => {
    update({ goalsPicked: true, themes: state.themes.includes(theme) ? state.themes.filter((t) => t !== theme) : [...state.themes, theme] });
  };

  const save = async (): Promise<void> => {
    if (!api || !draft || loading || noLearner) return;
    setBusy(true);
    setError(null);
    const result = await api.savePlan(spaceId, draftPlanBody(draft, state, locale));
    setBusy(false);
    if (!result.ok) {
      setError('saveFailed');
      return;
    }
    router.push(ROUTES.spacePlan(spaceId, result.data.id, roster?.space.kind));
  };

  const rows = draft ? weekGroups(draft.weeks, draft.items, undefined, locale).rows : [];
  const stats = draft ? statsText(draft.stats, locale) : null;
  const shorter = free?.shorter ?? null;
  // **Use {weeks} weeks** re-runs the preview with that length preset; the long plan stays allowed.
  // The button unmounts with the short-plan line, so focus moves to the page heading (as Next and Back do).
  const pickShorter = (): void => {
    if (!shorter) return;
    update({ length: shorter.length });
    heading.current?.focus();
  };

  return (
    <AdultFrame onSignOut={signOut} back={spaceSubPageBack(spaceId, roster?.space.kind, c.back(roster?.space.name ?? null))} title={roster ? c.pageTitle(roster.space.name) : c.title}>
      {!api ? <Notice tone="nudge">{m.console.shell.noApi}</Notice> : null}
      {error === 'cantReach' ? (
        <div style={{ ...panelStyle, marginBottom: spacing.md }}>
          <p style={{ margin: 0 }}>{m.console.cantReach}</p>
          <Button onClick={() => void load()}>{m.console.tryAgain}</Button>
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.md }}>
        <h1 ref={heading} tabIndex={-1} style={{ fontSize: headRem(typography.size.title), margin: 0 }}>{step === STEPS ? c.preview.title : c.title}</h1>
        <span style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm) }}>{c.step(step, STEPS)}</span>
      </div>

      {step === 1 ? (
        <section aria-label={c.start.title}>
          {audience === 'family' && learners.length > 0 ? (
            <label style={{ display: 'block', marginBottom: spacing.lg }}>
              <span style={labelStyle}>{c.learner.label}</span>
              <select value={state.learnerId ?? ''} onChange={(e) => pickLearner(e.target.value)} style={inputStyle} data-testid="route-learner">
                <option value="">{c.learner.choose}</option>
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.sm}px` }}>{c.start.title}</h2>
          <div role="radiogroup" aria-label={c.start.label} onKeyDown={onRadioKeys} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.sm }}>
            {STARTING_POINT_IDS.map((id) => (
              <Chip key={id} wide selected={state.start === id} disabled={loading} onClick={() => updateAndFollow({ start: id })} testId={`start-${id}`}>
                <span style={{ display: 'block', fontWeight: typography.weight.bold }}>{c.start.points[id].title}</span>
                <span style={{ display: 'block', color: colors.text.secondary, fontSize: rem(typography.size.caption) }}>{c.start.points[id].line}</span>
              </Chip>
            ))}
          </div>
          {hint ? <Muted>{c.start.hint[audience](c.start.points[hint].title)}</Muted> : null}
          {noLearner ? (
            <Notice tone="nudge">
              <span data-testid="route-problem">{c.learner.required}</span>
            </Notice>
          ) : null}
          <div style={{ marginTop: spacing.lg }}>
            <Button tone="primary" disabled={loading || noLearner !== null} onClick={() => setStep(2)} testId="route-next">
              {c.next.cta}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-label={c.rhythm.title}>
          <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.md}px` }}>{c.rhythm.title}</h2>
          <ChipGroup label={c.rhythm.pace}>
            {PACE_CHOICES.map((id: PaceId) => (
              <Chip key={id} selected={pace === id} onClick={() => updateAndFollow({ ...pacePatch(id), rhythmPicked: true })} testId={`pace-${id}`}>
                {c.rhythm.paceOption(c.rhythm.paces[id], PACES[id])}
                {suggested === id ? <SuggestedTag /> : null}
              </Chip>
            ))}
          </ChipGroup>
          {pace === null ? (
            <div style={{ margin: `-${spacing.sm}px 0 ${spacing.lg}px` }}>
              <Muted>{c.rhythm.offChips}</Muted>
            </div>
          ) : null}
          <ChipGroup label={c.rhythm.length} grid>
            {LENGTH_CHOICES.map((choice) => {
              const option = choice === 'custom' ? undefined : proposal?.options.find((o) => o.id === choice);
              return (
                <Chip key={choice} wide selected={state.length === choice} onClick={() => update({ length: choice, lengthPicked: true })} testId={`length-${choice}`}>
                  <span style={{ display: 'block', fontWeight: typography.weight.bold }}>
                    {c.rhythm.lengths[choice].cta}
                    {proposal?.defaultId === choice ? <SuggestedTag /> : null}
                  </span>
                  {option ? (
                    <span style={{ display: 'block', color: colors.text.secondary, fontSize: rem(typography.size.caption), fontWeight: typography.weight.regular }} data-testid={`length-line-${choice}`}>
                      {lengthPreviewText(option, locale)}
                    </span>
                  ) : null}
                </Chip>
              );
            })}
          </ChipGroup>
          {state.length === 'custom' ? (
            <label style={{ display: 'block', marginBottom: spacing.lg }}>
              <span style={labelStyle}>{c.rhythm.weeks}</span>
              <input
                type="number"
                min={1}
                max={52}
                value={Number.isFinite(state.customWeeks) ? state.customWeeks : ''}
                onChange={(e) => update({ customWeeks: e.target.valueAsNumber })}
                style={inputStyle}
              />
            </label>
          ) : null}
          <label style={{ display: 'block', marginBottom: spacing.lg }}>
            <span style={labelStyle}>{c.rhythm.startDate}</span>
            <input type="date" min={today} value={state.startDate} onChange={(e) => update({ startDate: e.target.value })} style={inputStyle} />
          </label>
          <ChipGroup label={c.rhythm.days} role="group">
            {WEEKDAYS.map((day) => (
              <Chip key={day} role="checkbox" selected={state.sessionDays.includes(day)} onClick={() => toggleDay(day)} testId={`day-${day}`}>
                {weekdayLabel(day, locale)}
              </Chip>
            ))}
          </ChipGroup>
          <Muted>{c.rhythm.daysHint[audience]}</Muted>
          {state.sessionDays.length > 0 ? (
            <div style={{ marginBottom: spacing.lg }}>
              <Muted>{c.rhythm.daysChosen(state.sessionDays.length)}</Muted>
            </div>
          ) : null}
          <ChipGroup label={c.rhythm.minutes}>
            {MINUTE_CHOICES.map((n) => (
              <Chip key={n} selected={state.minutesPerSession === n} onClick={() => update({ minutesPerSession: n, rhythmPicked: true })}>
                {c.rhythm.minutesOption(n)}
              </Chip>
            ))}
          </ChipGroup>
          <div style={{ marginBottom: spacing.lg }}>
            <div style={labelStyle}>{c.rhythm.daysOff}</div>
            <Muted>{c.rhythm.daysOffHint}</Muted>
            {state.daysOff.map((range, k) => (
              <div key={k} style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: spacing.sm }}>
                <label>
                  <span style={labelStyle}>{c.rhythm.breakFrom}</span>
                  <input type="date" value={range.from} onChange={(e) => update({ daysOff: state.daysOff.map((r, i) => (i === k ? { ...r, from: e.target.value } : r)) })} style={inputStyle} />
                </label>
                <label>
                  <span style={labelStyle}>{c.rhythm.breakTo}</span>
                  <input type="date" value={range.to} onChange={(e) => update({ daysOff: state.daysOff.map((r, i) => (i === k ? { ...r, to: e.target.value } : r)) })} style={inputStyle} />
                </label>
                <button
                  type="button"
                  aria-label={c.rhythm.removeBreak(k + 1)}
                  title={c.rhythm.removeBreak(k + 1)}
                  onClick={() => update({ daysOff: state.daysOff.filter((_, i) => i !== k) })}
                  style={{ ...inputStyle, cursor: 'pointer', minHeight: spacing.xxxl }}
                >
                  {c.rhythm.remove.cta}
                </button>
              </div>
            ))}
            <Button disabled={state.daysOff.length >= MAX_DAYS_OFF} onClick={() => update({ daysOff: [...state.daysOff, { from: '', to: '' }] })}>
              {c.rhythm.addBreak.cta}
            </Button>
          </div>
          {problem === null && draft && weeks !== null ? <Notice>{c.rhythm.sessionsNote(draft.stats.sessions, weeks)}</Notice> : null}
          {problem !== null ? (
            <Notice tone="nudge">
              <span data-testid="route-problem">{problemText(problem)}</span>
            </Notice>
          ) : null}
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button onClick={() => setStep(1)}>{c.previous.cta}</Button>
            <Button tone="primary" disabled={problem !== null} onClick={() => setStep(3)} testId="route-next">
              {c.next.cta}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section aria-label={c.goals.title}>
          <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.md}px` }}>{c.goals.title}</h2>
          <ChipGroup label={c.goals.focusLabel}>
            {FOCUS_CHOICES.map((focus) => (
              <Chip key={focus} selected={state.focus === focus} onClick={() => update({ focus, focusPicked: true })}>
                {c.goals.focus[focus]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup label={c.goals.themes} role="group">
            {ThemeKeySchema.options.map((theme) => {
              const at = state.themes.indexOf(theme);
              return (
                <Chip key={theme} role="checkbox" selected={at >= 0} onClick={() => toggleTheme(theme)}>
                  {at >= 0 ? c.goals.themeChosen(at + 1, c.goals.themeNames[theme]) : c.goals.themeNames[theme]}
                </Chip>
              );
            })}
          </ChipGroup>
          <Muted>{c.goals.themesHint}</Muted>
          <label style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', margin: `${spacing.md}px 0`, minHeight: spacing.xxxl }}>
            <input type="checkbox" checked={state.culturalAnchors} onChange={(e) => update({ culturalAnchors: e.target.checked })} />
            {c.goals.anchors}
          </label>
          <label style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', minHeight: spacing.xxxl }}>
            <input type="checkbox" checked={state.includeComingSoon} onChange={(e) => update({ includeComingSoon: e.target.checked })} />
            {c.goals.comingSoon}
          </label>
          <Muted>{c.goals.comingSoonLine}</Muted>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.lg }}>
            <Button onClick={() => setStep(2)}>{c.previous.cta}</Button>
            <Button tone="primary" onClick={() => setStep(4)} testId="route-see">
              {c.goals.see.cta}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 4 && !draft ? (
        <section aria-label={c.preview.title}>
          <Notice tone="nudge">
            <span data-testid="route-problem">{problem !== null ? problemText(problem) : c.preview.empty}</span>
          </Notice>
          <Button onClick={() => setStep(problem !== null ? 2 : 3)} testId="route-change">
            {c.preview.change.cta}
          </Button>
        </section>
      ) : null}

      {step === 4 && draft ? (
        <section aria-label={c.preview.title}>
          {stats ? <p style={{ margin: `0 0 ${spacing.md}px`, color: colors.text.secondary }} data-testid="route-stats">{stats}</p> : <Notice>{c.preview.empty}</Notice>}
          <WarningList warnings={draft.warnings} locale={locale} billingLink={audience === 'class'} free={free} neutral={neutral} />
          {stats ? (
            <div style={{ ...panelStyle, padding: spacing.md, marginBottom: spacing.md }}>
              <WeekTable rows={rows} locale={locale} />
            </div>
          ) : null}
          {free?.short && free.lastWeek !== null ? (
            <ShortPlanLine lastWeek={free.lastWeek} storiesAfter={free.storiesAfter} soonAfter={free.soonAfter} shorterWeeks={shorter?.weeks ?? null} onUseWeeks={pickShorter} />
          ) : null}
          {error === 'saveFailed' ? <Notice tone="nudge">{c.preview.saveFailed}</Notice> : null}
          {stats ? <Muted>{c.preview.draftNote}</Muted> : null}
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md }}>
            <Button onClick={() => setStep(3)} testId="route-change">
              {c.preview.change.cta}
            </Button>
            {stats ? (
              <Button tone="primary" disabled={busy || !api || loading || noLearner !== null} onClick={() => void save()} testId="route-use">
                {busy ? c.preview.saving.cta : c.preview.use.cta}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </AdultFrame>
  );
}

export default function CurriculumPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <CurriculumInner />
    </Suspense>
  );
}
