'use client';

import { normalizeJoinCode } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { LOCALES, LOCALE_META, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ClassCodeField, MoveButton, TransferSheet } from '@/components/console/TransferParts';
import type { ApiResult, ConsoleApi, TransferLearnerSideView, TransferOption, TransferPreview, TransferView } from '@/lib/console/api';
import { canCancel, daysSince, isOpenTransfer, slotLabel, startError, startErrorText, statusLine, stepWord, type StartError } from '@/lib/console/transfer';
import { consentLines, consentRecord, identityLines, type ConsentLine, type ConsentSheetData } from '@/lib/console/transfer-consent';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The family side of class moves (F-SPACE-002 section 4.8 "Family page" and 4.11, PR T-6d): the consent sheet, the
 * family's request cards, Start a move and the teacher-requests switch. Design authority: the T-0b mockups
 * (`design/screens/transfer/family-page.md`, `consent-sheet.md`; spec section 7 row T-0b, owner decision 2026-10-12:
 * agent-made mocks approved by multi-agent review). Tokens only, never the danger colour; every word comes from
 * `console.transfer` or, for the consent lines, content-schema's keyed catalogue.
 */

// ---------------------------------------------------------------------------
// The reading rule: an end marker that has been in view once (consent-sheet.md, "The end sentinel")

/**
 * A scroll-position rule, as spec 4.11 words it: true once the marker has intersected the viewport (clipping by
 * the scrolling sheet included). Where the browser has no IntersectionObserver the rule cannot be measured, so the
 * button is not held back.
 */
export function useSeenOnce(): [(el: Element | null) => void, boolean] {
  const [el, setEl] = useState<Element | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return undefined;
    const Observer = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    if (!Observer) {
      setSeen(true);
      return undefined;
    }
    if (!el) return undefined;
    const observer = new Observer((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, seen]);
  return [setEl, seen];
}

// ---------------------------------------------------------------------------
// The consent sheet (consent-sheet.md)

const lineStyle: CSSProperties = { margin: `0 0 ${spacing.md}px`, fontSize: typography.size.body, lineHeight: typography.leading.relaxed, color: colors.text.primary };
const listStyle: CSSProperties = { margin: `0 0 ${spacing.md}px`, paddingInlineStart: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed };
const conditionalStyle: CSSProperties = { borderInlineStart: `${borderWidth.thick}px solid ${colors.border.strong}`, paddingInlineStart: spacing.md };
const noticeStyle: CSSProperties = { margin: `0 0 ${spacing.md}px`, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken, color: colors.text.primary };
const checkRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min, margin: `0 0 ${spacing.md}px`, cursor: 'pointer' };
const checkStyle: CSSProperties = { width: spacing.lg, height: spacing.lg, accentColor: colors.brand.primary, flexShrink: 0 };
const selectStyle: CSSProperties = {
  minHeight: touchTarget.min,
  padding: `0 ${spacing.md}px`,
  borderRadius: radii.pill,
  borderWidth: borderWidth.thin,
  borderStyle: 'solid',
  borderColor: colors.border.strong,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: typography.size.body,
};

function LineView({ line }: { line: ConsentLine }): JSX.Element | null {
  if (line.kind === 'option') return null;
  const wrap = line.conditional ? conditionalStyle : undefined;
  if (line.kind === 'list') {
    return (
      <div data-line={line.id} style={wrap}>
        <p style={{ ...lineStyle, marginBottom: spacing.xs }}>{line.text}</p>
        <ul style={listStyle}>
          {line.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <p data-line={line.id} style={{ ...lineStyle, ...wrap }}>
      {line.text}
    </p>
  );
}

export interface ConsentSheetProps {
  data: ConsentSheetData;
  /** The console's UI locale: the sheet starts there and its own switch can change it (spec 4.11 "Languages"). */
  initialLocale: UiLocale;
  /** A teacher started it: Not now ends the request for everyone, so the sheet says so. */
  notNowEnds: boolean;
  busy: boolean;
  failed: boolean;
  /** The text or the terms changed since the guardian opened it (`consent_text_stale`, `terms_changed`). */
  updated: boolean;
  onYes: (locale: UiLocale, introduce: boolean) => void;
  onNotNow: () => void;
  onClose: () => void;
}

/**
 * The record of the learner side's yes: the lines are drawn word for word in canonical order, the list of what the
 * new teacher sees is always open (no toggle), and **Yes** stays `aria-disabled` until the end marker after
 * `cannot_undo` has been in view once. The buttons follow the last line (never sticky), and the heading, not the
 * primary, takes focus first.
 */
export function ConsentSheet({ data, initialLocale, notNowEnds, busy, failed, updated, onYes, onNotNow, onClose }: ConsentSheetProps): JSX.Element {
  const [locale, setLocale] = useState<UiLocale>(initialLocale);
  const [introduce, setIntroduce] = useState(false);
  const [endRef, seen] = useSeenOnce();
  const hintId = useId();
  const switchId = useId();
  const t = getMessages(locale).console.transfer;
  const c = t.consent;
  const lines = consentLines(data, locale);
  const option = lines?.find((l) => l.kind === 'option');
  const before = lines?.filter((l) => l.kind !== 'option') ?? [];
  const summary = before.slice(0, 3);
  const rest = before.slice(3);
  const typedAt = rest.findIndex((l) => l.id === 'typed_names');
  const identity = identityLines(data.destination, locale);

  return (
    <TransferSheet title={c.title(data.learnerName, data.destination.name)} onClose={onClose} testId="consent-sheet">
      <div lang={LOCALE_META[locale].htmlLang} style={locale === 'ko' ? { wordBreak: 'keep-all' } : undefined}>
        {updated ? (
          <p role="status" style={noticeStyle} data-testid="consent-updated">
            {c.updated}
          </p>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
          <label htmlFor={switchId} style={{ fontWeight: typography.weight.bold }}>
            {c.language}
          </label>
          <select id={switchId} name="consentLocale" value={locale} onChange={(e) => setLocale(e.target.value as UiLocale)} style={selectStyle}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={LOCALE_META[l].htmlLang}>
                {LOCALE_META[l].endonym}
              </option>
            ))}
          </select>
        </div>
        {lines === null ? (
          <p style={noticeStyle} data-testid="consent-unavailable">
            {c.unavailable}
          </p>
        ) : (
          <>
            <div style={{ backgroundColor: colors.brand.secondaryLight, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.md }}>
              {summary.map((line, i) => (
                <p key={line.id} data-line={line.id} style={{ ...lineStyle, margin: i === summary.length - 1 ? 0 : lineStyle.margin, fontWeight: i === 0 ? typography.weight.bold : typography.weight.regular }}>
                  {line.text}
                </p>
              ))}
            </div>
            {rest.map((line, i) =>
              i === typedAt ? (
                <section key={line.id} aria-label={c.who} style={{ border: `${borderWidth.thin}px solid ${colors.border.subtle}`, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.md }}>
                  <p style={{ margin: `0 0 ${spacing.xs}px`, fontWeight: typography.weight.bold }}>{c.who}</p>
                  <p style={{ margin: `0 0 ${spacing.xs}px`, fontSize: typography.size.bodyLg, fontWeight: typography.weight.semibold }}>{data.destination.name}</p>
                  {identity.map((text) => (
                    <p key={text} style={{ margin: `0 0 ${spacing.xs}px`, color: colors.text.secondary }}>
                      {text}
                    </p>
                  ))}
                  <LineView line={line} />
                </section>
              ) : (
                <LineView key={line.id} line={line} />
              ),
            )}
            <div ref={endRef} data-testid="consent-end" aria-hidden style={{ height: 1 }} />
            {option ? (
              <label style={checkRowStyle} data-line={option.id}>
                <input type="checkbox" name="introduce" checked={introduce} onChange={(e) => setIntroduce(e.target.checked)} style={checkStyle} />
                <span>{option.text}</span>
              </label>
            ) : null}
          </>
        )}
        {notNowEnds ? <p style={lineStyle}>{t.lines.notNowEnds}</p> : null}
        {failed ? (
          <p role="alert" style={{ ...lineStyle, fontWeight: typography.weight.semibold }}>
            {c.failed}
          </p>
        ) : null}
        {lines !== null && !seen ? (
          <p id={hintId} style={{ ...lineStyle, color: colors.text.secondary }}>
            {c.readToEnd}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
          {lines !== null ? (
            <MoveButton primary waiting={!seen || busy} describedBy={seen ? undefined : hintId} onClick={() => onYes(locale, introduce)} testId="consent-yes">
              {failed ? c.tryAgain.cta : c.yes(data.learnerName)}
            </MoveButton>
          ) : null}
          <MoveButton disabled={busy} onClick={onNotNow} testId="consent-not-now">
            {c.notNow.cta}
          </MoveButton>
        </div>
      </div>
    </TransferSheet>
  );
}

// ---------------------------------------------------------------------------
// Shared bits of the family page

export type FamilyPageState = 'locked' | 'signIn' | 'forbidden';
export type GuardianNotice = 'familyTooNew' | 'conflicted';

const panel: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.lg,
  padding: spacing.lg,
  marginBottom: spacing.md,
};
const h2Style: CSSProperties = { fontSize: typography.size.bodyLg, margin: `${spacing.lg}px 0 ${spacing.sm}px` };
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' };

function shortDate(iso: string | null, locale: UiLocale): string {
  return iso ? formatDate(locale, iso, 'monthDay') : '';
}

/** What a failed approve / create / prefs answer means for the family page. */
export function familyFailure(result: ApiResult<unknown>): { kind: 'page'; state: FamilyPageState } | { kind: 'notice'; notice: GuardianNotice } | { kind: 'refind' } | { kind: 'line'; err: StartError } | null {
  const err = startError(result, 'family');
  if (!err) return null;
  if (err.kind === 'locked' || err.kind === 'signIn' || err.kind === 'forbidden') return { kind: 'page', state: err.kind };
  if (err.kind === 'refind') return { kind: 'refind' };
  if (!result.ok && result.code === 'consent_text_stale') return { kind: 'refind' };
  if (err.key === 'familyTooNew' || err.key === 'conflicted') return { kind: 'notice', notice: err.key };
  return { kind: 'line', err };
}

/** The sheet data of a family card (Review and agree). */
export function sheetFromView(view: TransferLearnerSideView, familyName: string): ConsentSheetData {
  return {
    learnerName: view.learner.name,
    sourceName: view.from.name,
    destination: { name: view.to.name, ownerName: view.to.ownerName, schoolName: view.to.schoolName, ageBucket: view.to.ageBucket, learnerCount: view.to.learnerCount },
    initiator: view.initiator,
    terms: {
      premiumChange: view.premiumChange,
      destinationConsentMode: view.destinationConsentMode,
      relinkAffected: view.relinkAffected,
      sourcePlansAffected: view.sourcePlansAffected,
      visibleToday: view.visibleToday,
    },
    familyName,
  };
}

// ---------------------------------------------------------------------------
// A family request card (family-page.md, "Cards and lines")

function Steps({ view }: { view: TransferLearnerSideView }): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  return (
    <ul aria-label={messages.console.transfer.a11y.steps} style={{ listStyle: 'none', margin: `${spacing.sm}px 0`, padding: 0 }}>
      {(['learner', 'source', 'destination'] as const).map((slot) => {
        const word = stepWord(slot, view, locale);
        const yes = word !== messages.console.transfer.steps.waiting;
        return (
          <li key={slot} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: spacing.xl }}>
            <IconSvg name={yes ? 'check' : 'dash'} size={20} color={yes ? colors.feedback.success : colors.text.muted} />
            <span style={{ fontWeight: typography.weight.semibold }}>{slotLabel(slot, view, locale)}</span>
            <span style={{ color: colors.text.secondary }}>{word}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface FamilyCardProps {
  view: TransferLearnerSideView;
  now: Date;
  busy: boolean;
  /** A guardian-predicate notice applies: the answer buttons are not drawn; Cancel and Not now stay. */
  answersHidden: boolean;
  onReview: () => void;
  onNotNow: () => void;
  onCancel: () => void;
}

export function FamilyRequestCard({ view, now, busy, answersHidden, onReview, onNotNow, onCancel }: FamilyCardProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  const notNowId = useId();
  const days = daysSince(view.createdAt, now);
  const needsAnswer = view.status === 'requested' && view.learnerState !== 'consented';
  const line = statusLine(view, now, locale);
  const moved = view.status === 'executed';
  const planned = view.status === 'approved' && !view.blockReason;
  const teacherStarted = view.initiator === 'source';
  return (
    <article style={{ ...panel, ...(moved ? { backgroundColor: colors.feedback.successLight } : {}) }} data-testid="family-move-card">
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <strong style={{ fontSize: typography.size.bodyLg }}>{view.learner.name}</strong>
        {needsAnswer ? <span style={{ color: colors.text.secondary, fontSize: typography.size.bodySm }}>{teacherStarted ? t.meta.askedByClass(view.from.name, days) : t.meta.askedByFamily(days)}</span> : null}
      </div>
      <p style={{ ...rowStyle, margin: `${spacing.xs}px 0`, fontWeight: typography.weight.semibold }}>
        <span>{view.from.name}</span>
        <IconSvg name="arrow-right" size={20} color={colors.text.secondary} />
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t.a11y.to}</span>
        <span>{view.to.name}</span>
      </p>
      {!moved ? <Steps view={view} /> : null}
      {line ? (
        <p style={{ ...rowStyle, margin: `${spacing.sm}px 0` }}>
          {planned ? <IconSvg name="check-circle" size={20} color={colors.feedback.success} /> : null}
          <span>{line}</span>
        </p>
      ) : null}
      {moved && view.relinkAffected ? <p style={{ margin: `${spacing.xs}px 0` }}>{t.lines.movedTablet(view.from.name)}</p> : null}
      <div style={rowStyle}>
        {needsAnswer && !answersHidden ? (
          <MoveButton primary disabled={busy} onClick={onReview} testId="family-review">
            {t.actions.review.cta}
          </MoveButton>
        ) : null}
        {needsAnswer ? (
          <MoveButton disabled={busy} describedBy={teacherStarted ? notNowId : undefined} onClick={onNotNow} testId="family-not-now">
            {t.actions.notNow.cta}
          </MoveButton>
        ) : null}
        {!needsAnswer && canCancel(view) ? (
          <MoveButton disabled={busy} onClick={onCancel} testId="family-cancel">
            {t.actions.cancel.cta}
          </MoveButton>
        ) : null}
      </div>
      {needsAnswer && teacherStarted ? (
        <p id={notNowId} style={{ margin: `${spacing.sm}px 0 0`, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
          {t.lines.notNowEnds}
        </p>
      ) : null}
    </article>
  );
}

/** A history row: the date and one neutral line, never who said no. */
export function FamilyHistoryRow({ view }: { view: TransferLearnerSideView }): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  return (
    <li style={{ padding: `${spacing.sm}px 0`, borderBottom: `${borderWidth.thin}px solid ${colors.border.subtle}` }} data-testid="family-history-row">
      <span style={{ color: colors.text.secondary }}>{shortDate(view.endedAt ?? view.createdAt, locale)}</span> · {t.history.ended}
      {view.endedFrom === 'device' ? <> {t.history.endedFromTablet(view.learner.name)}</> : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Start a move (family-page.md) and the settings family row's flow

export type FamilyStartApi = Pick<ConsoleApi, 'previewTransfer' | 'createTransfer'>;

export interface FamilyStartFlowProps {
  familyId: string;
  familyName: string;
  options: TransferOption[];
  api: FamilyStartApi;
  online: boolean;
  /** Preselects a learner and a class (the settings row's Move to a class). */
  preselect?: { learnerId: string; fromSpaceId?: string };
  onCreated: (view: TransferView) => void;
  onPageState: (state: FamilyPageState) => void;
  onNotice: (notice: GuardianNotice) => void;
  /** Hides Find class while a guardian-predicate notice applies. */
  answersHidden: boolean;
}

type Found = { data: ConsentSheetData; destinationId: string; code: string; digest: string | null };

/** Learner, then Now in, then the code: **Find class** opens the consent sheet; **Yes** creates the request with the record. */
export function FamilyStartFlow({ familyId, familyName, options, api, online, preselect, onCreated, onPageState, onNotice, answersHidden }: FamilyStartFlowProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  const movable = options.filter((o) => o.classes.length > 0);
  const [learnerId, setLearnerId] = useState(preselect?.learnerId ?? movable[0]?.learnerId ?? '');
  const learner = movable.find((o) => o.learnerId === learnerId) ?? movable[0];
  const [fromId, setFromId] = useState(preselect?.fromSpaceId ?? learner?.classes[0]?.spaceId ?? '');
  const from = learner?.classes.find((cls) => cls.spaceId === fromId) ?? learner?.classes[0];
  const [code, setCode] = useState('');
  const [error, setError] = useState<StartError | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [failed, setFailed] = useState(false);
  const [updated, setUpdated] = useState(false);
  const learnerSel = useId();
  const fromSel = useId();

  const handle = useCallback(
    (result: ApiResult<unknown>): 'refind' | 'done' => {
      const f = familyFailure(result);
      if (!f) return 'done';
      if (f.kind === 'page') onPageState(f.state);
      else if (f.kind === 'notice') {
        setFound(null);
        onNotice(f.notice);
      } else if (f.kind === 'refind') return 'refind';
      else {
        setFound(null);
        setError(f.err);
      }
      return 'done';
    },
    [onNotice, onPageState],
  );

  if (!learner || !from) return <p style={noticeStyle}>{t.start.noLearner}</p>;

  const find = async (typed: string, again = false): Promise<void> => {
    setError(null);
    setFailed(false);
    if (!online) {
      setError({ kind: 'line', key: 'offline' });
      return;
    }
    const normalized = normalizeJoinCode(typed);
    if (!normalized) {
      setError({ kind: 'line', key: 'codeNotFound' });
      return;
    }
    setBusy(true);
    const result: ApiResult<TransferPreview> = await api.previewTransfer(familyId, { learnerId: learner.learnerId, code: normalized, fromSpaceId: from.spaceId });
    setBusy(false);
    if (!result.ok) {
      setFound(null);
      handle(result);
      return;
    }
    const preview = result.data;
    if (!('termsDigest' in preview)) {
      setError({ kind: 'line', key: 'failed' });
      return;
    }
    setUpdated(again);
    setFound({
      code: normalized,
      destinationId: preview.destination.id,
      digest: preview.termsDigest,
      data: {
        learnerName: learner.name,
        sourceName: from.name,
        destination: { name: preview.destination.name, ownerName: preview.destination.ownerName, schoolName: preview.destination.schoolName, ageBucket: preview.destination.ageBucket, learnerCount: preview.destination.learnerCount },
        initiator: 'learner_side',
        terms: { premiumChange: preview.premiumChange, destinationConsentMode: preview.destinationConsentMode, relinkAffected: preview.relinkAffected, sourcePlansAffected: preview.sourcePlansAffected, visibleToday: preview.visibleToday },
        familyName,
      },
    });
  };

  const yes = async (sheetLocale: UiLocale, introduce: boolean): Promise<void> => {
    if (!found) return;
    setBusy(true);
    setFailed(false);
    const result = await api.createTransfer(familyId, {
      learnerId: learner.learnerId,
      destinationSpaceId: found.destinationId,
      code: found.code,
      fromSpaceId: from.spaceId,
      introduce,
      consent: consentRecord(sheetLocale, found.digest),
    });
    setBusy(false);
    if (result.ok) {
      setFound(null);
      setCode('');
      onCreated(result.data);
      return;
    }
    // A lost answer or a server hiccup keeps the sheet open with Try again; any other answer closes it to its line.
    const f = familyFailure(result);
    if (f?.kind === 'line' && (f.err.kind === 'line' && (f.err.key === 'offline' || f.err.key === 'failed'))) {
      setFailed(true);
      return;
    }
    if (handle(result) === 'refind') await find(found.code, true);
  };

  const errorText = error?.kind === 'line' ? startErrorText(error, learner.name, locale) : null;

  return (
    <div>
      {preselect ? null : (
        <div style={{ ...rowStyle, marginBottom: spacing.md }}>
          <label htmlFor={learnerSel} style={{ fontWeight: typography.weight.bold }}>
            {t.start.learner}
          </label>
          <select
            id={learnerSel}
            name="moveLearner"
            value={learner.learnerId}
            onChange={(e) => {
              const next = movable.find((o) => o.learnerId === e.target.value);
              setLearnerId(e.target.value);
              setFromId(next?.classes[0]?.spaceId ?? '');
              setError(null);
            }}
            style={selectStyle}
          >
            {movable.map((o) => (
              <option key={o.learnerId} value={o.learnerId}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ ...rowStyle, marginBottom: spacing.md }}>
        <label htmlFor={fromSel} style={{ fontWeight: typography.weight.bold }}>
          {t.start.nowIn}
        </label>
        <select id={fromSel} name="moveFrom" value={from.spaceId} onChange={(e) => setFromId(e.target.value)} style={selectStyle}>
          {learner.classes.map((cls) => (
            <option key={cls.spaceId} value={cls.spaceId}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>
      {learner.selfManaged ? (
        <p style={noticeStyle}>{t.lines.manageOwn(learner.name)}</p>
      ) : (
        <>
          <ClassCodeField
            value={code}
            onChange={(next) => {
              setCode(next);
              setError(null);
            }}
            label={t.start.newCode}
            rules={messages.caregiver.join.code.rules}
            error={errorText}
            disabled={busy}
          />
          {answersHidden ? null : (
            <MoveButton primary waiting={busy && !found} onClick={() => void find(code)} testId="family-find">
              {busy && !found ? t.start.looking.cta : t.start.find.cta}
            </MoveButton>
          )}
        </>
      )}
      {found ? (
        <ConsentSheet
          key={`${found.destinationId}:${found.digest ?? ''}`}
          data={found.data}
          initialLocale={locale}
          notNowEnds={false}
          busy={busy}
          failed={failed}
          updated={updated}
          onYes={(l, intro) => void yes(l, intro)}
          onNotNow={() => setFound(null)}
          onClose={() => setFound(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Move requests from teachers (family-page.md): one switch per learner

export function TeacherRequestsSwitch({ option, busy, onChange }: { option: TransferOption; busy: boolean; onChange: (on: boolean) => void }): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.transfer;
  const nameId = useId();
  return (
    <li style={{ padding: `${spacing.sm}px 0`, borderBottom: `${borderWidth.thin}px solid ${colors.border.subtle}` }} data-testid="teacher-requests-row">
      <p id={nameId} style={{ margin: 0, fontWeight: typography.weight.bold }}>
        {option.name}
      </p>
      {option.selfManaged ? (
        <p style={{ margin: `${spacing.xs}px 0 0` }}>{t.lines.manageOwn(option.name)}</p>
      ) : (
        <label style={checkRowStyle}>
          <input type="checkbox" name="blockTeacherRequests" aria-describedby={nameId} checked={option.blockTeacherRequests} disabled={busy} onChange={(e) => onChange(e.target.checked)} style={checkStyle} />
          <span>{t.start.prefs}</span>
        </label>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// The family page's body

export type FamilyMovesApi = Pick<ConsoleApi, 'transferRequests' | 'previewTransfer' | 'createTransfer' | 'approveTransfer' | 'declineTransfer' | 'cancelTransfer' | 'setTransferPrefs'>;

export interface FamilyMovesProps {
  familyId: string;
  familyName: string;
  api: FamilyMovesApi;
  online: boolean;
  refreshMs: number;
  onPageState: (state: FamilyPageState) => void;
}

/** Asked about your learners, Start a move, Move requests from teachers and the history (family-page.md). */
export function FamilyMoves({ familyId, familyName, api, online, refreshMs, onPageState }: FamilyMovesProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  const [requests, setRequests] = useState<TransferLearnerSideView[] | null>(null);
  const [options, setOptions] = useState<TransferOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<'failed' | 'sent' | null>(null);
  const [notice, setNotice] = useState<GuardianNotice | null>(null);
  const [reviewing, setReviewing] = useState<{ id: string; updated: boolean } | null>(null);
  const [sheetFailed, setSheetFailed] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [now, setNow] = useState(() => new Date());
  const lastJson = useRef<string | null>(null);

  const load = useCallback(async (): Promise<TransferLearnerSideView[] | null> => {
    const result = await api.transferRequests(familyId);
    if (!result.ok) {
      const f = familyFailure(result);
      if (f?.kind === 'page') onPageState(f.state);
      else setNote('failed');
      return null;
    }
    const views = result.data.requests.filter((v): v is TransferLearnerSideView => v.role === 'learner_side');
    const json = JSON.stringify(views);
    if (lastJson.current !== null && lastJson.current !== json) setAnnounce(t.a11y.updated);
    lastJson.current = json;
    setRequests(views);
    setOptions(result.data.options ?? []);
    setNow(new Date());
    return views;
  }, [api, familyId, onPageState, t.a11y.updated]);

  useEffect(() => {
    void load();
    const handle = setInterval(() => void load(), refreshMs);
    return () => clearInterval(handle);
  }, [load, refreshMs]);

  const act = async (run: () => Promise<ApiResult<unknown>>): Promise<ApiResult<unknown>> => {
    setBusy(true);
    setNote(null);
    const result = await run();
    setBusy(false);
    if (!result.ok) {
      const f = familyFailure(result);
      if (f?.kind === 'page') onPageState(f.state);
      else if (f?.kind === 'notice') setNotice(f.notice);
      else if (f?.kind !== 'refind') setNote('failed');
    }
    await load();
    return result;
  };

  const reviewed = reviewing ? requests?.find((v) => v.id === reviewing.id) ?? null : null;

  const approve = async (view: TransferLearnerSideView, sheetLocale: UiLocale, introduce: boolean): Promise<void> => {
    setBusy(true);
    setSheetFailed(false);
    const result = await api.approveTransfer(familyId, view.id, { slots: ['learner'], consent: consentRecord(sheetLocale, view.termsDigest), introduce });
    setBusy(false);
    if (result.ok) {
      setReviewing(null);
      await load();
      return;
    }
    const f = familyFailure(result);
    if (f?.kind === 'refind') {
      await load();
      setReviewing({ id: view.id, updated: true });
      return;
    }
    if (f?.kind === 'page') {
      setReviewing(null);
      onPageState(f.state);
      return;
    }
    if (f?.kind === 'notice') {
      setReviewing(null);
      setNotice(f.notice);
      return;
    }
    setSheetFailed(true);
  };

  if (requests === null) {
    return (
      <div aria-busy="true" data-testid="family-moves-loading">
        {note === 'failed' ? <p style={noticeStyle}>{t.states.failed}</p> : <div style={{ ...panel, minHeight: touchTarget.min * 2, backgroundColor: colors.surface.sunken }} />}
      </div>
    );
  }

  const open = requests.filter((v) => isOpenTransfer(v) || v.status === 'executed');
  const ended = requests.filter((v) => v.status === 'ended');

  return (
    <div>
      <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {announce}
      </p>
      {notice ? <p style={noticeStyle}>{t.states[notice]}</p> : null}
      {note === 'failed' ? <p style={noticeStyle}>{t.states.failed}</p> : null}
      {note === 'sent' ? <p role="status" style={{ ...noticeStyle, backgroundColor: colors.feedback.successLight }}>{t.start.sent}</p> : null}

      <h2 style={h2Style}>{t.groups.asked}</h2>
      {open.length === 0 ? <p style={{ margin: `0 0 ${spacing.md}px`, color: colors.text.secondary }}>{t.empty}</p> : null}
      {open.map((view) => (
        <FamilyRequestCard
          key={view.id}
          view={view}
          now={now}
          busy={busy}
          answersHidden={notice !== null}
          onReview={() => {
            setSheetFailed(false);
            setReviewing({ id: view.id, updated: false });
          }}
          onNotNow={() => void act(() => api.declineTransfer(familyId, view.id, { slot: 'learner' }))}
          onCancel={() => void act(() => api.cancelTransfer(familyId, view.id))}
        />
      ))}

      <h2 style={h2Style}>{t.groups.start}</h2>
      <section style={panel} aria-label={t.groups.start}>
        <FamilyStartFlow
          familyId={familyId}
          familyName={familyName}
          options={options}
          api={api}
          online={online}
          answersHidden={notice !== null}
          onCreated={() => {
            setNote('sent');
            void load();
          }}
          onPageState={onPageState}
          onNotice={setNotice}
        />
      </section>

      {options.length > 0 ? (
        <>
          <h2 style={h2Style}>{t.groups.prefs}</h2>
          <ul style={{ ...panel, listStyle: 'none' }}>
            {options.map((option) => (
              <TeacherRequestsSwitch
                key={option.learnerId}
                option={option}
                busy={busy}
                onChange={(on) => void act(() => api.setTransferPrefs(familyId, option.learnerId, { blockTeacherRequests: on }))}
              />
            ))}
          </ul>
        </>
      ) : null}

      {ended.length > 0 ? (
        <>
          <h2 style={h2Style}>{t.groups.history}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {ended.map((view) => (
              <FamilyHistoryRow key={view.id} view={view} />
            ))}
          </ul>
        </>
      ) : null}

      {reviewing && reviewed ? (
        <ConsentSheet
          key={`${reviewed.id}:${reviewed.termsDigest ?? ''}:${reviewing.updated ? 'u' : ''}`}
          data={sheetFromView(reviewed, familyName)}
          initialLocale={locale}
          notNowEnds={reviewed.initiator === 'source'}
          busy={busy}
          failed={sheetFailed}
          updated={reviewing.updated}
          onYes={(l, intro) => void approve(reviewed, l, intro)}
          onNotNow={() => {
            setReviewing(null);
            void act(() => api.declineTransfer(familyId, reviewed.id, { slot: 'learner' }));
          }}
          onClose={() => setReviewing(null)}
        />
      ) : null}
    </div>
  );
}

/** A page-level state line with the link back to the space (401, 403, locked). */
export function FamilyPageStateLine({ children }: { children: ReactNode }): JSX.Element {
  return <p style={noticeStyle}>{children}</p>;
}
