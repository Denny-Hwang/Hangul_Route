'use client';

import { FAMILY_LABEL_IDS, type FamilyLabelId, type NotePresetId, type SpaceKind } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  composerCheck,
  counterAnnouncement,
  groupByDay,
  notePreview,
  presetGroups,
  recipientRows,
  sendProblem,
  sendResultLines,
  sentRowView,
  textCounter,
  type NoteRecipient,
  type NotesApi,
  type SentNoteRow,
  type SentRowView,
} from '@/lib/console/notes';
import { composerPrefill, questOptions, reactionGlyph } from '@/lib/console/notes-page';
import { ROUTES } from '@/lib/console/routing';
import { stageTitle } from '@/lib/console/stage-titles';
import { MoveButton, TransferSheet } from './TransferParts';

/**
 * The notes page's parts (F-FEEDBACK-001 FB-11a, section 6.13; screen specs design/screens/notes/sent-list.md,
 * composer.md, family-notes.md Sent tab; mocks `sent.html`, `composer.html`, `family.html`): the sent list and the
 * composer sub-view. Every word and every check comes from FB-10's view models (`lib/console/notes.ts`). Nothing is
 * sorted or filtered by status, opens or answers (section 9); a class sender never reads "Opened"; problems are amber
 * sentences, never red.
 */

const ROOT_FONT_PX = 16;
const rem = (px: number): string => `${px / ROOT_FONT_PX}rem`;
const px = (value: number): string => `${value}px`;

/** Glyph on list rows and status lines (design/screens/notes/README.md, Constants). */
const GLYPH_ROW = 20;
/** The quest title keeps a readable line before the Remove button wraps under it (README, Constants). */
const QUEST_TITLE_MIN = '10rem';

const focusRing = `outline:${px(borderWidth.thick)} solid ${colors.border.focus};outline-offset:${px(borderWidth.base)}`;

export const NOTES_CSS = `
.hr-notes{display:flex;flex-direction:column;gap:${rem(spacing.lg)};max-width:${px(layout.maxWidth.reading)};color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-notes p,.hr-notes h1,.hr-notes h2,.hr-notes h3,.hr-notes ul{margin:0;padding:0}
.hr-notes ul{list-style:none}
.hr-notes-back{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};align-self:flex-start;color:${colors.brand.secondaryDark};font-weight:${typography.weight.semibold};text-decoration:underline}
.hr-notes-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:${rem(spacing.md)}}
.hr-notes-head h1{font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere;min-width:0}
.hr-notes-btn{display:inline-flex;align-items:center;justify-content:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};min-width:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.xl)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};text-decoration:none;cursor:pointer}
.hr-notes-primary{background:${colors.brand.primary};border-color:${colors.brand.primary};color:${colors.text.onPrimary}}
.hr-notes-btn:focus-visible,.hr-notes-back:focus-visible,.hr-notes-tab:focus-visible,.hr-notes-select:focus-visible,.hr-notes-input:focus-visible{${focusRing}}
.hr-notes-quiet{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};line-height:${typography.leading.relaxed}}
.hr-notes-field-inline{display:flex;flex-wrap:wrap;align-items:center;gap:${rem(spacing.sm)};font-weight:${typography.weight.semibold}}
.hr-notes-select{min-height:${px(touchTarget.min)};max-width:100%;padding:0 ${rem(spacing.lg)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold}}
.hr-notes-tabs{display:flex;gap:${rem(spacing.xs)};border-bottom:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-notes-tab{min-height:${px(touchTarget.min)};min-width:${px(touchTarget.min)};padding:0 ${rem(spacing.lg)};border:none;border-bottom:${px(borderWidth.thick)} solid transparent;background:transparent;color:${colors.text.secondary};font:inherit;font-weight:${typography.weight.semibold};cursor:pointer}
.hr-notes-tab[aria-selected="true"]{color:${colors.text.primary};font-weight:${typography.weight.bold};border-bottom-color:${colors.brand.primary}}
.hr-notes-panel{display:flex;flex-direction:column;gap:${rem(spacing.lg)}}
.hr-notes-day{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-notes-day>h2{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold}}
.hr-notes-rows{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-notes-card{display:flex;flex-direction:column;gap:${rem(spacing.xs)};padding:${rem(spacing.md)} ${rem(spacing.lg)};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-radius:${px(radii.lg)};background:${colors.surface.paper};min-width:0}
.hr-notes-to{font-weight:${typography.weight.bold};overflow-wrap:anywhere}
.hr-notes-words{overflow-wrap:anywhere;line-height:${typography.leading.relaxed}}
.hr-notes-meta{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};overflow-wrap:anywhere}
.hr-notes-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:${rem(spacing.md)};row-gap:${rem(spacing.xs)};padding-top:${rem(spacing.xs)}}
.hr-notes-foot .hr-notes-btn{margin-left:auto}
.hr-notes-status{display:flex;flex-wrap:wrap;align-items:center;column-gap:${rem(spacing.sm)};row-gap:${rem(spacing.xxs)};color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-notes-sep{color:${colors.text.muted}}
.hr-notes-answer{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};font-weight:${typography.weight.semibold};color:${colors.text.primary}}
.hr-notes-skeleton{height:${px(touchTarget.hero)};border-radius:${px(radii.lg)};background:${colors.surface.sunken}}
.hr-notes-state{display:flex;flex-direction:column;align-items:flex-start;gap:${rem(spacing.md)};padding:${rem(spacing.xl)} ${rem(spacing.lg)};border-radius:${px(radii.lg)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-notes-problem{padding:${rem(spacing.sm)} ${rem(spacing.md)};border-left:${px(borderWidth.thick)} solid ${colors.feedback.nudge};border-radius:${px(radii.sm)};background:${colors.feedback.nudgeLight};color:${colors.text.primary};font-weight:${typography.weight.semibold};line-height:${typography.leading.relaxed};overflow-wrap:anywhere}
.hr-notes-hidden{position:absolute;width:${px(borderWidth.thin)};height:${px(borderWidth.thin)};margin:-${px(borderWidth.thin)};padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.hr-compose{display:flex;flex-direction:column;gap:${rem(spacing.xl)};color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal}}
.hr-compose p,.hr-compose h3{margin:0}
.hr-compose fieldset{border:none;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-compose legend,.hr-compose-step-title{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:${rem(spacing.sm)};padding:0;margin-bottom:${rem(spacing.xs)};font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold}}
.hr-compose-num{display:inline-flex;align-items:center;justify-content:center;width:${px(spacing.xxl)};height:${px(spacing.xxl)};border-radius:${px(radii.circle)};background:${colors.surface.sunken};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};flex:none}
.hr-compose-req{color:${colors.text.muted};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold}}
.hr-compose-row{display:flex;flex-wrap:wrap;align-items:center;column-gap:${rem(spacing.md)};row-gap:${rem(spacing.xxs)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.md)};border-radius:${px(radii.md)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};cursor:pointer;font-weight:${typography.weight.semibold}}
.hr-compose-row:has(input:checked){border:${px(borderWidth.base)} solid ${colors.brand.primary}}
.hr-compose-row:has(input:focus-visible){${focusRing}}
.hr-compose-row input{width:${px(spacing.xl)};height:${px(spacing.xl)};margin:0;flex:none;accent-color:${colors.brand.primary}}
.hr-compose-row-name{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.hr-compose-row-note{flex:1 1 100%;min-width:0;padding-left:calc(${px(spacing.xl)} + ${rem(spacing.md)});color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.regular};overflow-wrap:anywhere}
.hr-compose-row-off{background:${colors.surface.sunken};border-color:${colors.border.subtle};cursor:default}
.hr-compose-row-off .hr-compose-row-name{color:${colors.text.muted}}
.hr-compose-picker{display:flex;flex-direction:column;gap:${rem(spacing.xs)};margin-left:${rem(spacing.xl)};padding-left:${rem(spacing.md)};border-left:${px(borderWidth.base)} solid ${colors.border.subtle}}
.hr-compose-sub{font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};color:${colors.text.secondary}}
.hr-compose-groups{display:flex;flex-direction:column;gap:${rem(spacing.md)}}
.hr-compose-group{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-notes-input{width:100%;box-sizing:border-box;min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border:${px(borderWidth.base)} solid ${colors.border.strong};border-radius:${px(radii.md)};background:${colors.surface.paper};color:${colors.text.primary};font:inherit}
.hr-notes-input[aria-invalid="true"]{border:${px(borderWidth.thick)} solid ${colors.text.primary}}
.hr-compose-counter{align-self:flex-end;color:${colors.text.muted};font-size:${rem(typography.size.bodySm)}}
.hr-compose-quest{display:flex;flex-wrap:wrap;align-items:center;gap:${rem(spacing.sm)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-radius:${px(radii.md)};background:${colors.surface.paper}}
.hr-compose-quest-title{flex:1 1 ${QUEST_TITLE_MIN};min-width:0;font-weight:${typography.weight.semibold};overflow-wrap:anywhere}
.hr-compose-needed{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold}}
.hr-compose-preview{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-compose-preview h3{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold}}
.hr-compose-preview-card{display:flex;flex-direction:column;gap:${rem(spacing.xs)};padding:${rem(spacing.lg)};border-radius:${px(radii.lg)};background:${colors.surface.canvas};border:${px(borderWidth.thin)} solid ${colors.border.strong}}
.hr-compose-preview-preset{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};overflow-wrap:anywhere}
.hr-compose-actions{display:flex;flex-wrap:wrap;gap:${rem(spacing.sm)}}
.hr-compose-actions>*{flex:1 1 12rem}
.hr-compose-result{display:flex;flex-direction:column;gap:${rem(spacing.xs)};padding:${rem(spacing.lg)};border-radius:${px(radii.md)};background:${colors.feedback.successLight};outline:none}
.hr-compose-result p:first-child{font-weight:${typography.weight.bold}}
`;

/** Free words are shown as typed; Hangul in them is marked Korean for screen readers (section 6.11). */
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
const wordsLang = (text: string): string | undefined => (HANGUL.test(text) ? 'ko' : undefined);

export type SentListState = 'loading' | 'ready' | 'error';

/** One sent note (wireframe console/notes-sent.md A): who it went to, the preset, the words, the quest, a neutral status. */
function SentRowCard({ view, raw, rowId, quest, onTakeBack, m }: { view: SentRowView; raw: SentNoteRow; rowId: string; quest: string | null; onTakeBack: () => void; m: Messages }): JSX.Element {
  const glyph = raw.to === 'learner' ? reactionGlyph(raw.reaction) : null;
  return (
    <li className="hr-notes-card" data-testid="sent-row">
      <p className="hr-notes-to" id={rowId}>
        {view.to}
      </p>
      {view.byOther ? <p className="hr-notes-meta">{view.byOther}</p> : null}
      {view.signed ? <p className="hr-notes-meta">{view.signed}</p> : null}
      <p>{view.preset}</p>
      {view.text ? (
        <p className="hr-notes-words" lang={wordsLang(view.text)}>
          {view.text}
        </p>
      ) : null}
      {quest ? <p className="hr-notes-meta">{quest}</p> : null}
      <div className="hr-notes-foot">
        <p className="hr-notes-status">
          <span>{view.status}</span>
          {view.reaction ? (
            <>
              <span className="hr-notes-sep" aria-hidden="true">
                ·
              </span>
              <span className="hr-notes-answer">
                {glyph ? <IconSvg name={glyph} size={GLYPH_ROW} /> : null}
                {view.reaction}
              </span>
            </>
          ) : null}
        </p>
        {view.canTakeBack ? (
          <button type="button" className="hr-notes-btn" aria-describedby={rowId} onClick={onTakeBack}>
            {m.console.notes.sent.takeBack.cta}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** The sent list: rows under Today / Yesterday / a date, in the API's send-time order, then Show older. */
export function SentList({
  state,
  rows,
  hasMore,
  olderBusy,
  kind,
  m,
  locale,
  onRetry,
  onOlder,
  onTakeBack,
  onNewNote,
}: {
  state: SentListState;
  rows: readonly SentNoteRow[];
  hasMore: boolean;
  olderBusy: boolean;
  kind: SpaceKind;
  m: Messages;
  locale: UiLocale;
  onRetry: () => void;
  onOlder: () => void;
  onTakeBack: (view: SentRowView, raw: SentNoteRow) => void;
  /** Absent for a viewer whose role does not send here: the empty state then offers no send action. */
  onNewNote?: () => void;
}): JSX.Element {
  const s = m.console.notes.sent;
  const baseId = useId();
  if (state === 'loading' && rows.length === 0) {
    return (
      <div className="hr-notes-rows" aria-busy="true" data-testid="sent-loading">
        <div className="hr-notes-skeleton" />
        <div className="hr-notes-skeleton" />
        <div className="hr-notes-skeleton" />
      </div>
    );
  }
  if (state === 'error' && rows.length === 0) {
    return (
      <div className="hr-notes-state" role="alert">
        <p>{s.error}</p>
        <button type="button" className="hr-notes-btn" onClick={onRetry}>
          {s.retry.cta}
        </button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="hr-notes-state">
        <p>{s.empty}</p>
        {onNewNote ? (
          <button type="button" className="hr-notes-btn hr-notes-primary" onClick={onNewNote}>
            {/* The page's own primary: Send a note on a family's Sent tab (family-notes.md), New note in a class. */}
            {kind === 'family' ? m.console.notes.sendNote.cta : m.console.notes.newNote.cta}
          </button>
        ) : null}
      </div>
    );
  }
  const preview = m.console.notes.composer.preview;
  let index = 0;
  return (
    <>
      {groupByDay(rows, new Date(), locale).map((group, g) => (
        <section key={`${group.day}-${g}`} className="hr-notes-day" aria-labelledby={`${baseId}-day-${g}`}>
          <h2 id={`${baseId}-day-${g}`}>{group.day}</h2>
          <ul className="hr-notes-rows">
            {group.rows.map((raw) => {
              const view = sentRowView(raw, kind, locale);
              const rowId = `${baseId}-row-${index++}`;
              return <SentRowCard key={view.key} view={view} raw={raw} rowId={rowId} quest={view.quest ? preview.quest(view.quest) : null} onTakeBack={() => onTakeBack(view, raw)} m={m} />;
            })}
          </ul>
        </section>
      ))}
      {hasMore ? (
        <button type="button" className="hr-notes-btn" onClick={onOlder} disabled={olderBusy} aria-busy={olderBusy || undefined}>
          {s.older.cta}
        </button>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The composer sub-view (wireframe console/note-composer.md)

export interface ComposerSpace {
  id: string;
  kind: SpaceKind;
  name: string;
  archived: boolean;
}

type ToMode = 'everyone' | 'learners';

/**
 * The composer, a labelled dialog over the notes page (full height below 45em, `TransferSheet`): To, Pick an
 * encouragement, a few words, a quest, Sign as (family), the preview, Send. `closedLine` words a picked quest the
 * learner may not open (F-ENT-003, never a price or a link). `onClose(sent)` drops `&compose=1`.
 */
export function NoteComposer({
  notesApi,
  space,
  prefillLearner,
  prefillQuest,
  closedLine,
  m,
  locale,
  onClose,
}: {
  notesApi: NotesApi;
  space: ComposerSpace;
  prefillLearner: string | null;
  prefillQuest: string | null;
  closedLine: (questId: string) => string | null;
  m: Messages;
  locale: UiLocale;
  onClose: (sent: boolean) => void;
}): JSX.Element {
  const c = m.console.notes.composer;
  const side = space.kind === 'family' ? 'family' : 'class';
  const ids = useId();
  const [recipients, setRecipients] = useState<NoteRecipient[] | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<ToMode>('learners');
  const [picked, setPicked] = useState<string[]>([]);
  const [presetId, setPresetId] = useState<NotePresetId | null>(null);
  const [text, setText] = useState('');
  const [announce, setAnnounce] = useState('');
  const [questId, setQuestId] = useState<string | null>(prefillQuest);
  const [questPicking, setQuestPicking] = useState(false);
  const [label, setLabel] = useState<FamilyLabelId>('family');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);
  const [sentAny, setSentAny] = useState(false);
  const resultRef = useRef<{ focus?: () => void } | null>(null);
  const latest = useRef(0);

  const loadRecipients = useCallback(async (): Promise<void> => {
    if (space.archived) return;
    const call = ++latest.current;
    setRecipients(null);
    setLoadProblem(null);
    const r = await notesApi.recipients(space.id);
    if (call !== latest.current) return;
    if (!r.ok) {
      setLoadProblem(sendProblem(r.failure, space.kind, locale));
      return;
    }
    setRecipients(r.data);
    setPicked(composerPrefill(recipientRows(r.data, space.kind, locale), space.kind, prefillLearner));
    // `locale` only words the problem line; a language switch must not reload or reset the form.
  }, [notesApi, space.archived, space.id, space.kind, prefillLearner]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  useEffect(() => {
    if (result) resultRef.current?.focus?.();
  }, [result]);

  const close = (): void => onClose(sentAny);
  const rows = recipients ? recipientRows(recipients, space.kind, locale) : [];
  const check = composerCheck({ spaceKind: space.kind, to: mode === 'everyone' ? { kind: 'everyone' } : { kind: 'learners', ids: picked }, presetId, text, questId, label: side === 'family' ? label : null }, locale);
  const counter = textCounter(text, locale);
  const preview = notePreview({ spaceKind: space.kind, spaceName: space.name, presetId, text, questId, label: side === 'family' ? label : null }, locale);
  const questTitle = questId ? (preview.quest ?? null) : null;
  const closed = questId ? closedLine(questId) : null;
  const problemId = `${ids}-problem`;
  const counterId = `${ids}-counter`;
  const neededId = `${ids}-needed`;
  const recipientsProblemId = `${ids}-recipients`;
  const sendErrorId = `${ids}-send-error`;
  const sendReason = check.textProblem ? problemId : check.questNeeded ? neededId : check.recipientsProblem ? recipientsProblemId : sendError ? sendErrorId : undefined;

  const send = async (): Promise<void> => {
    if (!check.canSend || !check.body || sending) return;
    setSending(true);
    setSendError(null);
    const r = await notesApi.send(space.id, check.body);
    setSending(false);
    if (r.ok) {
      setResult(sendResultLines(r.data, space.kind, locale));
      if (r.data.sent > 0) setSentAny(true);
    } else setSendError(sendProblem(r.failure, space.kind, locale));
  };

  const sendAnother = (): void => {
    setResult(null);
    setPresetId(null);
    setText('');
    setAnnounce('');
    setQuestId(null);
    setQuestPicking(false);
    void loadRecipients();
  };

  const toggle = (id: string): void => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));

  const onText = (value: string): void => {
    const before = textCounter(text, locale).count;
    const after = textCounter(value, locale).count;
    setText(value);
    const line = counterAnnouncement(before, after, locale);
    if (line) setAnnounce(line);
  };

  let body: JSX.Element;
  if (space.archived) {
    body = <p className="hr-notes-problem">{c.errors.archived[side]}</p>;
  } else if (loadProblem) {
    body = (
      <p className="hr-notes-problem" role="alert">
        {loadProblem}
      </p>
    );
  } else if (recipients === null) {
    body = (
      <div className="hr-notes-rows" aria-busy="true" data-testid="recipients-loading">
        <div className="hr-notes-skeleton" />
        <div className="hr-notes-skeleton" />
      </div>
    );
  } else if (recipients.length === 0) {
    body = (
      <div className="hr-notes-state">
        <p>{c.empty[side]}</p>
        <Link className="hr-notes-btn" href={ROUTES.space(space.id, space.kind)}>
          {c.backToRoster.cta}
        </Link>
      </div>
    );
  } else if (result) {
    body = (
      <div className="hr-compose-result" role="status" tabIndex={-1} ref={(el) => void (resultRef.current = el)} data-testid="compose-result">
        {result.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <div className="hr-compose-actions">
          <button type="button" className="hr-notes-btn" onClick={sendAnother}>
            {c.result.another.cta}
          </button>
          <button type="button" className="hr-notes-btn hr-notes-primary" onClick={() => onClose(true)}>
            {c.result.done.cta}
          </button>
        </div>
      </div>
    );
  } else {
    const everyone = side === 'family' ? c.to.everyone.family(space.name, recipients.length) : c.to.everyone.class(space.name, recipients.length);
    body = (
      <>
        <fieldset>
          <legend>
            <span className="hr-compose-num" aria-hidden="true">
              1
            </span>
            {c.to.title}
          </legend>
          <label className="hr-compose-row">
            <input type="radio" name="note-to" value="everyone" checked={mode === 'everyone'} onChange={() => setMode('everyone')} />
            <span className="hr-compose-row-name">{everyone}</span>
          </label>
          <label className="hr-compose-row">
            <input type="radio" name="note-to" value="learners" checked={mode === 'learners'} onChange={() => setMode('learners')} />
            <span className="hr-compose-row-name">{c.to.choose}</span>
          </label>
          {mode === 'learners' ? (
            <div className="hr-compose-picker" role="group" aria-labelledby={`${ids}-picker`}>
              <p className="hr-compose-sub" id={`${ids}-picker`}>
                {c.to.picker[side]}
              </p>
              {rows.map((row, i) => {
                const lineId = `${ids}-learner-${i}`;
                return (
                  <label key={row.id} className={`hr-compose-row${row.selectable ? '' : ' hr-compose-row-off'}`}>
                    <input
                      type="checkbox"
                      checked={row.selectable && picked.includes(row.id)}
                      disabled={!row.selectable}
                      aria-describedby={row.line ? lineId : undefined}
                      onChange={() => toggle(row.id)}
                    />
                    <span className="hr-compose-row-name">{row.name}</span>
                    {row.line ? (
                      <span className="hr-compose-row-note" id={lineId}>
                        {row.line}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          ) : null}
          {check.recipientsProblem ? (
            <p className="hr-notes-problem" id={recipientsProblemId}>
              {check.recipientsProblem}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>
            <span className="hr-compose-num" aria-hidden="true">
              2
            </span>
            {c.preset.title} <span className="hr-compose-req">{c.preset.required}</span>
          </legend>
          <div className="hr-compose-groups">
            {presetGroups(side === 'family' ? 'family' : 'teacher', locale)
              .filter((group) => group.presets.length > 0)
              .map((group) => (
                <div key={group.id} className="hr-compose-group" role="group" aria-labelledby={`${ids}-group-${group.id}`}>
                  <h3 className="hr-compose-sub" id={`${ids}-group-${group.id}`}>
                    {group.title}
                  </h3>
                  {group.presets.map((preset) => (
                    <label key={preset.id} className="hr-compose-row">
                      <input type="radio" name="note-preset" value={preset.id} checked={presetId === preset.id} onChange={() => setPresetId(preset.id)} />
                      <span className="hr-compose-row-name">{preset.text}</span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        </fieldset>

        <div className="hr-compose-group">
          <label className="hr-compose-step-title" htmlFor={`${ids}-text`}>
            <span className="hr-compose-num" aria-hidden="true">
              3
            </span>
            {c.text.label}
          </label>
          <input
            id={`${ids}-text`}
            type="text"
            className="hr-notes-input"
            value={text}
            aria-invalid={check.textProblem ? true : undefined}
            aria-describedby={check.textProblem ? `${counterId} ${problemId}` : counterId}
            onChange={(event) => onText(event.target.value)}
          />
          <p className="hr-compose-counter" id={counterId}>
            {counter.line}
          </p>
          <p className="hr-notes-hidden" aria-live="polite">
            {announce}
          </p>
          {check.textProblem ? (
            <p className="hr-notes-problem" id={problemId}>
              {check.textProblem}
            </p>
          ) : null}
        </div>

        <div className="hr-compose-group">
          <p className="hr-compose-step-title">
            <span className="hr-compose-num" aria-hidden="true">
              4
            </span>
            {c.quest.title}
          </p>
          {questId && questTitle ? (
            <div className="hr-compose-quest">
              <IconSvg name="book" size={GLYPH_ROW} color={colors.brand.primaryDark} />
              <span className="hr-compose-quest-title" data-testid="compose-quest">
                {questTitleOf(questId)}
              </span>
              <button type="button" className="hr-notes-btn" onClick={() => setQuestId(null)}>
                {c.quest.remove.cta}
              </button>
            </div>
          ) : questPicking ? (
            <label className="hr-compose-group">
              <span className="hr-compose-sub">{c.quest.pickerTitle}</span>
              <select
                className="hr-notes-select"
                value=""
                aria-describedby={check.questNeeded ? neededId : undefined}
                onChange={(event) => {
                  if (event.target.value) {
                    setQuestId(event.target.value);
                    setQuestPicking(false);
                  }
                }}
              >
                {/* A labelled placeholder, never picked: a screen reader hears what the list is for, not a blank entry. */}
                <option value="" disabled>
                  {c.quest.choose.cta}
                </option>
                {questOptions(stageTitle).map((group) => (
                  <optgroup key={group.stage} label={group.title}>
                    {group.quests.map((quest) => (
                      <option key={quest.id} value={quest.id}>
                        {quest.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : (
            <button type="button" className="hr-notes-btn" style={{ alignSelf: 'flex-start' }} aria-describedby={check.questNeeded ? neededId : undefined} onClick={() => setQuestPicking(true)}>
              {c.quest.choose.cta}
            </button>
          )}
          {closed ? <p className="hr-notes-quiet">{closed}</p> : null}
          {check.questNeeded ? (
            <p className="hr-compose-needed" id={neededId}>
              {c.quest.needed}
            </p>
          ) : null}
        </div>

        {side === 'family' ? (
          <label className="hr-compose-group">
            <span className="hr-compose-step-title">
              <span className="hr-compose-num" aria-hidden="true">
                5
              </span>
              {c.signAs}
            </span>
            <select className="hr-notes-select" style={{ alignSelf: 'flex-start' }} value={label} onChange={(event) => setLabel(event.target.value as FamilyLabelId)}>
              {FAMILY_LABEL_IDS.map((id) => (
                <option key={id} value={id}>
                  {m.common.notes.familyLabels[id]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <section className="hr-compose-preview" aria-labelledby={`${ids}-preview`}>
          <h3 id={`${ids}-preview`}>{c.preview.title}</h3>
          <div className="hr-compose-preview-card">
            {preview.preset ? <p className="hr-compose-preview-preset">{preview.preset}</p> : null}
            {preview.text ? (
              <p className="hr-notes-words" lang={wordsLang(preview.text)}>
                {preview.text}
              </p>
            ) : null}
            <p className="hr-notes-meta">{preview.from}</p>
            {preview.quest ? <p className="hr-notes-meta">{preview.quest}</p> : null}
          </div>
          <p className="hr-notes-quiet">{c.preview.language}</p>
          {side === 'class' ? <p className="hr-notes-quiet">{c.preview.disclosure}</p> : null}
        </section>

        {sendError ? (
          <p className="hr-notes-problem" role="alert" id={sendErrorId}>
            {sendError}
          </p>
        ) : null}
        <div className="hr-compose-actions">
          <MoveButton primary waiting={!check.canSend || sending} describedBy={sendReason} onClick={() => void send()} testId="compose-send">
            {sending ? c.sending : c.send.cta}
          </MoveButton>
          <MoveButton onClick={close}>{c.cancel.cta}</MoveButton>
        </div>
      </>
    );
  }

  return (
    <TransferSheet title={c.title} onClose={close} closeLabel={c.close} testId="note-composer">
      <div className="hr-compose">{body}</div>
    </TransferSheet>
  );
}

/** A catalogue quest's title (content, not a dictionary string). */
function questTitleOf(questId: string): string {
  for (const group of questOptions(stageTitle)) {
    const quest = group.quests.find((q) => q.id === questId);
    if (quest) return quest.title;
  }
  return questId;
}

/** The family page's tab list (section 6.12: arrow keys move between tabs). FB-11a has the Sent tab; FB-12 adds Received. */
export function NotesTabs<T extends string>({ tabs, current, label, labelOf, panelId, onSelect }: { tabs: readonly T[]; current: T; label: string; labelOf: (tab: T) => string; panelId: string; onSelect: (tab: T) => void }): JSX.Element {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  // The roving tab stop follows the selection: the newly selected tab takes the focus (section 6.12, arrow-key tabs).
  const select = (next: T | undefined): void => {
    if (next === undefined) return;
    onSelect(next);
    buttons.current.get(next)?.focus();
  };
  const move = (from: T, step: number): void => {
    const at = tabs.indexOf(from);
    select(tabs[(at + step + tabs.length) % tabs.length]);
  };
  return (
    <div className="hr-notes-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab}
          ref={(node) => {
            if (node) buttons.current.set(tab, node);
            else buttons.current.delete(tab);
          }}
          type="button"
          role="tab"
          className="hr-notes-tab"
          id={`${panelId}-tab-${tab}`}
          aria-selected={tab === current}
          aria-controls={panelId}
          tabIndex={tab === current ? 0 : -1}
          onClick={() => onSelect(tab)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') move(tab, 1);
            else if (event.key === 'ArrowLeft') move(tab, -1);
            else if (event.key === 'Home') select(tabs[0]);
            else if (event.key === 'End') select(tabs[tabs.length - 1]);
            else return;
            event.preventDefault();
          }}
        >
          {labelOf(tab)}
        </button>
      ))}
    </div>
  );
}
