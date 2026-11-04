'use client';

import { WEEKDAYS, type CurriculumDraft, type CurriculumMeta, type Weekday } from '@hangul-route/content-schema';
import { borderWidth, colors, layout, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Chip, ChipGroup, ItemText, KindBadge, SuggestedTag } from '@/components/console/CurriculumParts';
import { Button, Muted, Notice, panelStyle } from '@/components/console/ui';
import type { PlanView } from '@/lib/console/api';
import {
  CLASS_LENGTH_CHOICES,
  MAX_CLASS_DAYS,
  MINUTE_CHOICES,
  PRACTICE_COUNT_CHOICES,
  classDaysOf,
  dateRangeText,
  defaultsFor,
  meetingProblem,
  practiceCountOf,
  weekdayLabel,
  type BlendMode,
  type ClassLengthChoice,
  type MinuteChoice,
  type RepaceResult,
  type WizardState,
} from '@/lib/console/curriculum';
import {
  addPracticeParams,
  addPracticePrefill,
  blendOfPlan,
  blendPreviewText,
  changePractice,
  classDateText,
  classDaysSoFar,
  cycleRows,
  moveClassDay,
  nextClassDay,
  planPracticeDays,
  practiceDaysOfState,
  practiceFits,
  practiceLine,
  stopPracticeParams,
  thisWeekClasses,
  type CycleRow,
} from '@/lib/console/curriculum-blend';
import { useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * Class days and practice days on the console (AMENDMENTS-ROUTE-CLASS-BLEND sections 10.1, 10.2 and 14; wireframe
 * `console/curriculum-wizard.md` section "Meeting", M1 to M4; mocks `design/screens/route-blend/`; row BL-4): the
 * wizard's meeting block, the preview's header and cycle table, and the readout's class lines and plan changes. The
 * pages render them only behind `routeBlendEnabled()`. Tokens only, every word from `console.curriculum.blend`; tags
 * are words, never colour alone; no learner is listed, sorted or compared, and nothing asks whether class happened.
 */

const labelStyle: CSSProperties = { display: 'block', fontSize: rem(typography.size.caption), color: colors.text.muted, marginBottom: spacing.xs };
const selectStyle: CSSProperties = {
  minHeight: spacing.xxxl,
  padding: `${spacing.xs}px ${spacing.sm}px`,
  fontSize: rem(typography.size.bodySm),
  borderRadius: radii.md,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
};
const linkButton: CSSProperties = {
  minHeight: spacing.xxxl,
  padding: `0 ${spacing.xs}px`,
  background: 'none',
  border: 'none',
  color: colors.brand.primary,
  fontSize: rem(typography.size.bodySm),
  fontWeight: typography.weight.semibold,
  textDecoration: 'underline',
  cursor: 'pointer',
};

/** The two slots of the practice row ("[3] times a week × [10] min each time"; ko "주 [3]회 × 한 번에 [10]분"): no letters, so no locale (nor the pseudo-locale) rewrites them. */
const SLOT_N = '\u2063\u2460\u2063';
const SLOT_M = '\u2063\u2461\u2063';

/** What the teacher changed in the meeting block; the page applies it. */
export type MeetingPatch = Partial<Pick<WizardState, 'lectureDays' | 'lectureMinutes' | 'practicePerWeek' | 'practiceMinutes' | 'practiceDays' | 'blendMode'>>;

/**
 * "How does this class meet?" (section 10.1; wireframe M1 / M2): Class weekday chips (1 to 5) and Class length; the
 * practice row (0 to 7 times a week × minutes, in the locale's word order); the suggested practice days with **Change
 * days**; and, with 1 or more practice days, the two mode cards (overlap preselected, *Suggested*, BL-OD-1). One
 * column that wraps: nothing sideways and no scroll area of its own (assumption c).
 */
export function MeetingBlock({ state, onChange, locale }: { state: WizardState; onChange: (patch: MeetingPatch) => void; locale: UiLocale }): JSX.Element {
  const m = useMessages().console.curriculum;
  const b = m.blend;
  const [refused, setRefused] = useState(false);
  const [changing, setChanging] = useState(state.practiceDays !== null && state.practiceDays !== undefined);
  const classDays = classDaysOf(state);
  const perWeek = practiceCountOf(state);
  const practiceDays = practiceDaysOfState(state);
  const line = classDays.length > 0 ? practiceLine(classDays, practiceDays, locale) : null;
  const own = state.practiceDays ?? null;

  const toggleClassDay = (day: Weekday): void => {
    if (classDays.includes(day)) {
      setRefused(false);
      onChange({ lectureDays: classDays.filter((d) => d !== day) });
    } else if (classDays.length >= MAX_CLASS_DAYS) {
      // A sixth class day is refused with one line beside the chips (wireframe M1).
      setRefused(true);
    } else {
      setRefused(false);
      onChange({ lectureDays: [...classDays, day] });
    }
  };
  const toggleChange = (): void => {
    if (!changing && own === null) onChange({ practiceDays });
    setChanging(!changing);
  };
  const togglePracticeDay = (day: Weekday): void => {
    const current = own ?? practiceDays;
    if (current.includes(day)) onChange({ practiceDays: current.filter((d) => d !== day) });
    else if (current.length < perWeek) onChange({ practiceDays: [...current, day] });
  };
  const [before = '', middle = '', after = ''] = b.practice.inline(SLOT_N, SLOT_M).split(new RegExp(`${SLOT_N}|${SLOT_M}`));

  return (
    <section aria-labelledby="meeting-title" data-testid="meeting-block" style={{ ...panelStyle, marginBottom: spacing.lg }}>
      <h3 id="meeting-title" style={{ fontSize: rem(typography.size.body), margin: `0 0 ${spacing.md}px` }}>
        {b.meeting.title}
      </h3>
      <ChipGroup label={b.classDays} role="group">
        {WEEKDAYS.map((day) => (
          <Chip key={day} role="checkbox" selected={classDays.includes(day)} onClick={() => toggleClassDay(day)} testId={`class-day-${day}`}>
            {weekdayLabel(day, locale)}
          </Chip>
        ))}
      </ChipGroup>
      {refused ? (
        <div role="status" style={{ margin: `-${spacing.sm}px 0 ${spacing.md}px` }}>
          <Muted>{b.meeting.maxClassDays}</Muted>
        </div>
      ) : null}
      <label style={{ display: 'block', marginBottom: spacing.lg }}>
        <span style={labelStyle}>{b.classLength}</span>
        <select value={state.lectureMinutes ?? 30} onChange={(e) => onChange({ lectureMinutes: Number(e.target.value) as ClassLengthChoice })} style={selectStyle} data-testid="class-length">
          {CLASS_LENGTH_CHOICES.map((n) => (
            <option key={n} value={n}>
              {m.rhythm.minutesOption(n)}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-labelledby="practice-row" style={{ marginBottom: spacing.lg }}>
        <span id="practice-row" style={labelStyle}>
          {b.practice.row}
        </span>
        <div data-testid="practice-inline" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, color: colors.text.primary, fontSize: rem(typography.size.bodySm) }}>
          {before.trim() ? <span>{before.trim()}</span> : null}
          <select aria-label={b.practice.days} value={perWeek} onChange={(e) => onChange({ practicePerWeek: Number(e.target.value), practiceDays: null })} style={selectStyle} data-testid="practice-count">
            {PRACTICE_COUNT_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {middle.trim() ? <span>{middle.trim()}</span> : null}
          <select aria-label={b.practice.minutes} value={state.practiceMinutes ?? 10} onChange={(e) => onChange({ practiceMinutes: Number(e.target.value) as MinuteChoice })} style={selectStyle} data-testid="practice-minutes">
            {MINUTE_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {after.trim() ? <span>{after.trim()}</span> : null}
        </div>
        {line ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            <span data-testid="practice-line" style={{ color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
              {line}
            </span>
            <button type="button" aria-expanded={changing} aria-controls="practice-days" onClick={toggleChange} style={linkButton} data-testid="practice-change">
              {b.practice.change.cta}
            </button>
          </div>
        ) : null}
        {line && changing ? (
          <div id="practice-days" style={{ marginTop: spacing.sm }}>
            <ChipGroup label={b.practice.daysLabel} role="group">
              {WEEKDAYS.map((day) => (
                <Chip key={day} role="checkbox" selected={(own ?? practiceDays).includes(day)} onClick={() => togglePracticeDay(day)} testId={`practice-day-${day}`}>
                  {weekdayLabel(day, locale)}
                </Chip>
              ))}
            </ChipGroup>
            {meetingProblem(state) === 'practice-days' ? <Muted>{b.practice.pickDays(perWeek)}</Muted> : null}
          </div>
        ) : null}
      </div>
      {perWeek >= 1 ? (
        <ChipGroup label={b.mode.title} grid>
          {(['overlap', 'split'] as const satisfies readonly BlendMode[]).map((mode) => (
            <Chip key={mode} wide selected={(state.blendMode ?? 'overlap') === mode} onClick={() => onChange({ blendMode: mode })} testId={`blend-mode-${mode}`}>
              <span style={{ display: 'block', fontWeight: typography.weight.bold }}>
                {b.mode[mode]}
                {mode === 'overlap' ? <SuggestedTag /> : null}
              </span>
              <span style={{ display: 'block', color: colors.text.secondary, fontSize: rem(typography.size.caption), fontWeight: typography.weight.regular }}>
                {mode === 'overlap' ? b.mode.overlapHint : b.mode.splitHint}
              </span>
            </Chip>
          ))}
        </ChipGroup>
      ) : null}
    </section>
  );
}

/** The preview header of a blended draft (section 10.2; wireframe M3): sessions, per day, totals, the first class. */
export function BlendPreviewHeader({ draft, locale }: { draft: CurriculumDraft; locale: UiLocale }): JSX.Element | null {
  const text = blendPreviewText(draft, locale);
  if (!text) return null;
  return (
    <div data-testid="blend-preview-header" style={{ margin: `0 0 ${spacing.md}px`, color: colors.text.secondary, display: 'grid', gap: spacing.xs }}>
      <p style={{ margin: 0, color: colors.text.primary }}>{text.header}</p>
      <p style={{ margin: 0 }}>{text.perDay}</p>
      <p style={{ margin: 0 }}>{text.average}</p>
      <p style={{ margin: 0 }}>{text.start}</p>
      {text.endsOn ? <p style={{ margin: 0 }}>{text.endsOn}</p> : null}
    </div>
  );
}

/** Below the regular breakpoint the cycle table becomes cards, each cell introduced by its column name (wireframe M3). */
const NARROW_CSS = `.hr-cycle-cards{display:none}@media (max-width:${layout.breakpoint.regular - 1}px){.hr-cycle-table{display:none}.hr-cycle-cards{display:block}}`;

function ClassCell({ row, locale }: { row: CycleRow; locale: UiLocale }): JSX.Element {
  const b = useMessages().console.curriculum.blend.preview;
  return (
    <>
      <div style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>{classDateText(row.classDate, locale)}</div>
      {!row.classHeld ? (
        <div>{b.noClass}</div>
      ) : row.classItems.length === 0 ? (
        row.kind === 'review' ? <div>{b.classReview}</div> : null
      ) : (
        <ul style={{ margin: 0, paddingLeft: spacing.lg }}>
          {row.classItems.map((item) => (
            <li key={`${item.kind}:${item.id}:${item.index}`}>
              <ItemText item={{ ...item, date: null }} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PracticeCellView({ row, locale }: { row: CycleRow; locale: UiLocale }): JSX.Element {
  const m = useMessages().console.curriculum;
  const b = m.blend.preview;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: spacing.xs }}>
      {row.practice.map((cell) => (
        <li key={cell.date}>
          <span style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>{classDateText(cell.date, locale)}</span>
          <ul style={{ margin: 0, paddingLeft: spacing.lg }}>
            {cell.items.map((item) => (
              <li key={`${item.kind}:${item.id}:${item.index}`}>{item.practiceOnly ? m.preview.taggedItem(item.title, b.practiceOnlyTag) : <ItemText item={{ ...item, date: null }} locale={locale} />}</li>
            ))}
            {cell.refresh ? <li>{b.refresh}</li> : null}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * The cycle table (section 10.2; wireframe M3): one row per class cycle, the week as the row header, then dates, kind,
 * the **Class** cell and the **Practice** cell. A real table with header cells (`scope="col"`) and row headers
 * (`scope="row"`) on a regular window; cards on a phone, so the page never scrolls sideways.
 */
export function CycleTable({ rows, locale }: { rows: readonly CycleRow[]; locale: UiLocale }): JSX.Element {
  const m = useMessages().console.curriculum;
  const b = m.blend.preview;
  const cell: CSSProperties = { padding: `${spacing.sm}px`, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}`, verticalAlign: 'top', textAlign: 'left' };
  const head: CSSProperties = { ...cell, color: colors.text.muted, fontSize: rem(typography.size.caption), fontWeight: typography.weight.semibold, borderTop: 'none', whiteSpace: 'nowrap' };
  const column = (name: string): JSX.Element => <div style={{ ...labelStyle, marginTop: spacing.sm }}>{name}</div>;
  return (
    <>
      <style>{NARROW_CSS}</style>
      <div className="hr-cycle-table">
        <table aria-label={b.tableLabel} data-testid="cycle-table" style={{ borderCollapse: 'collapse', width: '100%', fontSize: rem(typography.size.bodySm), color: colors.text.secondary }}>
          <thead>
            <tr>
              <th scope="col" style={head}>{m.preview.table.week}</th>
              <th scope="col" style={head}>{m.preview.table.dates}</th>
              <th scope="col" style={head}>{m.preview.table.kind}</th>
              <th scope="col" style={head}>{b.classCol}</th>
              <th scope="col" style={head}>{b.practiceCol}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classDate} data-testid="cycle-row">
                <th scope="row" style={{ ...cell, color: colors.text.primary }}>{row.week}</th>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{dateRangeText(row.classDate, row.endDate, locale)}</td>
                <td style={cell}>
                  <KindBadge kind={row.kind} />
                </td>
                <td style={cell}>
                  <ClassCell row={row} locale={locale} />
                </td>
                <td style={cell}>
                  <PracticeCellView row={row} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="hr-cycle-cards" aria-label={b.tableLabel} style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: rem(typography.size.bodySm), color: colors.text.secondary }}>
        {rows.map((row, k) => (
          <li key={row.classDate} data-testid="cycle-card" style={{ borderTop: k === 0 ? 'none' : `${borderWidth.thin}px solid ${colors.border.subtle}`, padding: `${spacing.sm}px 0` }}>
            <h3 style={{ fontSize: rem(typography.size.bodySm), margin: 0, color: colors.text.primary }}>
              {m.builder.weekHeader(row.week, dateRangeText(row.classDate, row.endDate, locale), m.preview.kind[row.kind])}
            </h3>
            {column(b.classCol)}
            <ClassCell row={row} locale={locale} />
            {column(b.practiceCol)}
            <PracticeCellView row={row} locale={locale} />
          </li>
        ))}
      </ol>
    </>
  );
}

/** A blended draft's cycle table in the preview (the classic week table stays for every other plan). */
export function BlendPreview({ draft, locale }: { draft: CurriculumDraft; locale: UiLocale }): JSX.Element {
  const rows = cycleRows({ params: draft.params, weeks: draft.weeks, items: draft.items, refresh: draft.refresh }, locale);
  return (
    <div style={{ ...panelStyle, padding: spacing.md, marginBottom: spacing.md }}>
      <CycleTable rows={rows} locale={locale} />
    </div>
  );
}

/**
 * The readout's This week lines of a blended plan (section 10.2; wireframe M4): this week's class day with its lessons
 * first, the class's default practice days (never a learner's own), and "Class days so far: {n} of {N}" (scheduled,
 * never attendance).
 */
export function BlendThisWeek({ plan, today, locale }: { plan: { meta: CurriculumMeta; items: PlanView['items'] }; today: string; locale: UiLocale }): JSX.Element | null {
  const b = useMessages().console.curriculum.blend;
  const blend = blendOfPlan(plan.meta);
  if (!blend) return null;
  const classes = thisWeekClasses(plan.meta, plan.items, today, locale);
  const soFar = classDaysSoFar(plan.meta, today);
  const line = practiceLine(blend.lecture.days, planPracticeDays(plan.meta), locale);
  const heading: CSSProperties = { fontSize: rem(typography.size.bodySm), margin: `${spacing.sm}px 0 ${spacing.xs}px` };
  return (
    <div data-testid="blend-this-week" style={{ marginBottom: spacing.sm }}>
      {classes.map((entry) => (
        <Fragment key={entry.date}>
          <h3 style={heading}>{b.readout.classDay(classDateText(entry.date, locale))}</h3>
          {entry.items.length > 0 ? (
            <ul style={{ margin: `0 0 ${spacing.sm}px`, paddingLeft: spacing.lg, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
              {entry.items.map((item) => (
                <li key={`${item.kind}:${item.id}:${item.index}`}>
                  <ItemText item={{ ...item, date: null }} locale={locale} />
                </li>
              ))}
            </ul>
          ) : null}
        </Fragment>
      ))}
      <h3 style={heading}>{b.preview.practiceCol}</h3>
      {line ? <Muted>{line}</Muted> : null}
      {soFar ? (
        <p data-testid="class-days-so-far" style={{ margin: `${spacing.xs}px 0 0`, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
          {b.readout.classDays(soFar.n, soFar.total)}
        </p>
      ) : null}
    </div>
  );
}

type ControlStep = { at: 'idle' } | { at: 'move'; date: string } | { at: 'stop' } | { at: 'add'; state: WizardState };

/**
 * The readout's plan changes of a class curriculum (sections 10.2 and 14; wireframe M4): **Move this class day** and
 * **Stop practice days** on a blended plan, **Add practice days** on a Class only one (the meeting block, prefilled).
 * Move and Stop ask first; nothing ever asks whether class happened (BL-OD-8). Each saves the re-laid plan on the same
 * plan id through `onSave`, as Re-pace from today does, so devices reconcile on their next sync.
 */
export function BlendControls({
  plan,
  today,
  locale,
  busy,
  onSave,
}: {
  plan: PlanView & { meta: CurriculumMeta };
  today: string;
  locale: UiLocale;
  busy: boolean;
  onSave: (result: RepaceResult) => Promise<boolean>;
}): JSX.Element | null {
  const m = useMessages().console.curriculum;
  const b = m.blend;
  const [step, setStep] = useState<ControlStep>({ at: 'idle' });
  const [note, setNote] = useState<'moved' | 'changed' | 'failed' | null>(null);
  const askText = useRef<HTMLParagraphElement>(null);
  const blended = blendOfPlan(plan.meta) !== null;
  const next = blended ? nextClassDay(plan.meta, today) : null;

  useEffect(() => {
    if (step.at === 'move' || step.at === 'stop') askText.current?.focus();
  }, [step.at]);

  if (plan.meta.params.audience !== 'class') return null;

  const run = async (make: () => RepaceResult, done: 'moved' | 'changed'): Promise<void> => {
    let result: RepaceResult;
    try {
      result = make();
    } catch {
      // A stored plan this build cannot re-lay: say so, never crash the readout.
      setNote('failed');
      return;
    }
    const saved = await onSave(result);
    setNote(saved ? done : 'failed');
    if (saved) setStep({ at: 'idle' });
  };
  const nowIso = (): string => new Date().toISOString();
  const open = (next: ControlStep): void => {
    setNote(null);
    setStep(next);
  };

  const confirmPanel = (text: string, confirmLabel: string, onYes: () => void, testId: string): JSX.Element => (
    <div role="group" aria-label={text} style={{ ...panelStyle, borderColor: colors.brand.primary, marginTop: spacing.sm }} data-testid={testId}>
      <p ref={askText} tabIndex={-1} style={{ margin: `0 0 ${spacing.sm}px` }}>
        {text}
      </p>
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button tone="primary" disabled={busy} onClick={onYes} testId={`${testId}-yes`}>
          {confirmLabel}
        </Button>
        <Button onClick={() => setStep({ at: 'idle' })}>{m.readout.cancel.cta}</Button>
      </div>
    </div>
  );

  let body: ReactNode = null;
  if (step.at === 'move') {
    const date = step.date;
    body = confirmPanel(b.readout.moveAsk(classDateText(date, locale)), b.readout.moveConfirm.cta, () => void run(() => moveClassDay(plan, date, today, nowIso()), 'moved'), 'blend-move-confirm');
  } else if (step.at === 'stop') {
    const params = stopPracticeParams(plan.meta.params);
    body = confirmPanel(b.readout.stopAsk, b.readout.stopConfirm.cta, () => params && void run(() => changePractice(plan, params, today, nowIso()), 'changed'), 'blend-stop-confirm');
  } else if (step.at === 'add') {
    const state = step.state;
    const params = addPracticeParams(plan.meta.params, state);
    const fits = practiceFits(plan.meta.params, state);
    body = (
      <div style={{ marginTop: spacing.sm }} data-testid="blend-add-editor">
        <MeetingBlock state={state} onChange={(patch) => setStep({ at: 'add', state: { ...state, ...patch } })} locale={locale} />
        {!fits ? <Notice tone="nudge">{m.rhythm.tooMany}</Notice> : null}
        {meetingProblem(state) === 'no-class-day' ? <Muted>{b.meeting.pickClassDay}</Muted> : null}
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm }}>
          <Button tone="primary" disabled={busy || params === null || !fits} onClick={() => params && void run(() => changePractice(plan, params, today, nowIso()), 'changed')} testId="blend-add-save">
            {b.readout.save.cta}
          </Button>
          <Button onClick={() => setStep({ at: 'idle' })}>{m.readout.cancel.cta}</Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="blend-controls" style={{ marginTop: spacing.sm }}>
      {note === 'moved' ? <Notice tone="success">{b.readout.moved}</Notice> : null}
      {note === 'changed' ? <Notice tone="success">{b.readout.changed}</Notice> : null}
      {note === 'failed' ? <Notice tone="nudge">{b.readout.failed}</Notice> : null}
      {step.at === 'idle' ? (
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          {blended && next !== null ? (
            <Button disabled={busy} onClick={() => open({ at: 'move', date: next })} testId="blend-move">
              {b.readout.move.cta}
            </Button>
          ) : null}
          {blended ? (
            <button type="button" style={linkButton} disabled={busy} onClick={() => open({ at: 'stop' })} data-testid="blend-stop">
              {b.readout.stopPractice.cta}
            </button>
          ) : (
            <Button disabled={busy} onClick={() => open({ at: 'add', state: { ...defaultsFor('class', [], today), ...addPracticePrefill(plan.meta.params) } })} testId="blend-add">
              {b.readout.addPractice.cta}
            </Button>
          )}
        </div>
      ) : null}
      {body}
    </div>
  );
}
