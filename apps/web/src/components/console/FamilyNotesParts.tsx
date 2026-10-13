'use client';

import type { NoteReportReason, NotesMode } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  blockRowLabel,
  classModeChoices,
  oneTimeCardLine,
  prefsChangedLine,
  receivedLines,
  reportReasonChoices,
  senderRows,
  showOneTimeCard,
  type ReceivedLine,
} from '@/lib/console/family-notes';
import { familyActionProblem, type FamilyNotePrefs, type NoteBlock, type NoteSender, type NotesApi, type OversightNote } from '@/lib/console/notes';
import { reactionGlyph } from '@/lib/console/notes-page';
import { NOTES_CSS } from './NotesParts';
import { MoveButton, TransferSheet } from './TransferParts';

/**
 * The family Received tab and panel D (F-FEEDBACK-001 FB-12, sections 6.10 item 5, 7.2, 7.7 and 8.2 to 8.5; wireframe
 * console/family-notes.md; screen spec design/screens/notes/family-notes.md; mocks `family.html`,
 * `family-states.html`). Every note to one learner from every space, withdrawn ones included, with the sending
 * account's name on a family note and never a teacher's; Hide, Report and Stop notes from this sender per row; the
 * class-notes setting with the one-time card and the disclosure line; the stopped senders with Allow again; and, on the
 * family settings page, who may send. Words come from FB-10's view models and `console.notes.family`; problems are
 * amber sentences, never red.
 */

const ROOT_FONT_PX = 16;
const rem = (px: number): string => `${px / ROOT_FONT_PX}rem`;
const px = (value: number): string => `${value}px`;

/** Glyph on rows, the disclosure and the Saved line (design/screens/notes/README.md, Constants). */
const GLYPH_ROW = 20;
/** The one-time card's buttons keep a readable width before they wrap (mock `notes.css`, `.one-time`). */
const CARD_BUTTON_MIN = '8rem';
/** A disabled switch reads as unavailable by its muted track (the console's disabled buttons use the same 0.5). */
const DISABLED_OPACITY = 0.5;

const focusRing = `outline:${px(borderWidth.thick)} solid ${colors.border.focus};outline-offset:${px(borderWidth.base)}`;

export const FAMILY_NOTES_CSS = `
.hr-fnotes-line{display:flex;flex-wrap:wrap;column-gap:${rem(spacing.xs)}}
.hr-fnotes-actions{display:flex;flex-wrap:wrap;gap:${rem(spacing.sm)};padding-top:${rem(spacing.xs)}}
.hr-fnotes-card{display:flex;flex-direction:column;gap:${rem(spacing.md)};padding:${rem(spacing.lg)};border-radius:${px(radii.lg)};background:${colors.brand.secondaryLight}}
.hr-fnotes-card p{font-weight:${typography.weight.semibold};overflow-wrap:anywhere}
.hr-fnotes-card .hr-fnotes-actions>*{flex:1 1 ${CARD_BUTTON_MIN}}
.hr-fnotes-disclosure{display:flex;align-items:center;gap:${rem(spacing.sm)};width:100%;min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border:${px(borderWidth.thin)} solid ${colors.border.strong};border-radius:${px(radii.md)};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-weight:${typography.weight.bold};text-align:left;cursor:pointer;overflow-wrap:anywhere}
.hr-fnotes-disclosure svg{flex:none}
.hr-fnotes-disclosure[aria-expanded="true"] svg{transform:rotate(90deg)}
.hr-fnotes-settings{display:flex;flex-direction:column;gap:${rem(spacing.md)};padding:${rem(spacing.lg)};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-top:none;border-radius:0 0 ${px(radii.md)} ${px(radii.md)};background:${colors.surface.paper}}
.hr-fnotes-settings h3{font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold}}
.hr-fnotes-choices{display:flex;flex-direction:column;gap:${rem(spacing.sm)};border:none;margin:0;padding:0;min-width:0}
.hr-fnotes-choices legend{padding:0;margin-bottom:${rem(spacing.sm)};font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold}}
.hr-fnotes-choice{display:flex;align-items:center;gap:${rem(spacing.md)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} ${rem(spacing.md)};border:${px(borderWidth.base)} solid ${colors.border.strong};border-radius:${px(radii.md)};background:${colors.surface.paper};cursor:pointer;font-weight:${typography.weight.semibold};overflow-wrap:anywhere}
.hr-fnotes-choice input{width:${px(spacing.xl)};height:${px(spacing.xl)};margin:0;flex:none;accent-color:${colors.brand.primary}}
.hr-fnotes-choice:has(input:checked){border-color:${colors.brand.primary}}
.hr-fnotes-choice:has(input:focus-visible),.hr-fnotes-disclosure:focus-visible,.hr-fnotes-switch:focus-visible{${focusRing}}
.hr-fnotes-saved{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};color:${colors.feedback.successDark};font-weight:${typography.weight.semibold};font-size:${rem(typography.size.bodySm)}}
.hr-fnotes-stack{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-fnotes-stopped{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:${rem(spacing.sm)}}
.hr-fnotes-stopped span{overflow-wrap:anywhere;min-width:0}
.hr-fnotes-quote{display:flex;flex-direction:column;gap:${rem(spacing.xs)};padding:${rem(spacing.md)} ${rem(spacing.lg)};border-radius:${px(radii.md)};background:${colors.surface.sunken}}
.hr-fnotes-quote p{margin:0;overflow-wrap:anywhere}
.hr-fnotes-preset{font-weight:${typography.weight.bold}}
.hr-fnotes-sheet{display:flex;flex-direction:column;gap:${rem(spacing.lg)};color:${colors.text.primary}}
.hr-fnotes-sheet p{margin:0}
.hr-fnotes-senders{display:flex;flex-direction:column;gap:${rem(spacing.md)};color:${colors.text.primary}}
.hr-fnotes-senders h2{margin:0;font-size:${rem(typography.size.bodyLg)}}
.hr-fnotes-senders p{margin:0}
.hr-fnotes-sender{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:${rem(spacing.sm)};min-height:${px(touchTarget.min)};padding:${rem(spacing.xs)} 0;border-bottom:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-fnotes-sender-name{font-weight:${typography.weight.semibold};overflow-wrap:anywhere;min-width:0}
.hr-fnotes-switch{display:inline-flex;align-items:center;gap:${rem(spacing.sm)};min-height:${px(touchTarget.min)};padding:0 ${rem(spacing.sm)};border:none;background:transparent;color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.semibold};cursor:pointer}
.hr-fnotes-track{position:relative;width:${px(spacing.jumbo)};height:${px(spacing.xxl)};flex:none;box-sizing:border-box;border-radius:${px(radii.pill)};background:${colors.surface.sunken};border:${px(borderWidth.base)} solid ${colors.border.shape}}
.hr-fnotes-thumb{position:absolute;top:${px(spacing.xxs)};left:${px(spacing.xxs)};width:${px(spacing.xl)};height:${px(spacing.xl)};border-radius:${px(radii.circle)};background:${colors.border.shape}}
.hr-fnotes-switch[aria-checked="true"] .hr-fnotes-track{background:${colors.brand.primary};border-color:${colors.brand.primary}}
.hr-fnotes-switch[aria-checked="true"] .hr-fnotes-thumb{left:auto;right:${px(spacing.xxs)};background:${colors.surface.paper}}
.hr-fnotes-switch:disabled{cursor:default;color:${colors.text.muted}}
.hr-fnotes-switch:disabled .hr-fnotes-track{opacity:${DISABLED_OPACITY}}
`;

/** Free words are shown as typed; Hangul in them is marked Korean for screen readers (section 6.11). */
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
const wordsLang = (text: string): string | undefined => (HANGUL.test(text) ? 'ko' : undefined);

type ListState = 'loading' | 'ready' | 'error';
type Sheet = { kind: 'hide' | 'report' | 'block'; line: ReceivedLine };

/** One received note (wireframe A): the day and sender line, who sent it inside the family, the words, a neutral status, the actions that still apply. */
function ReceivedRowCard({ line, rowId, m, onAction }: { line: ReceivedLine; rowId: string; m: Messages; onAction: (kind: Sheet['kind']) => void }): JSX.Element {
  const { view, raw, day } = line;
  const f = m.console.notes.family;
  const glyph = reactionGlyph(raw.reaction);
  return (
    <li className="hr-notes-card" data-testid="received-row">
      <p className="hr-notes-to hr-fnotes-line" id={rowId}>
        {day ? (
          <>
            <span>{day}</span>
            <span className="hr-notes-sep" aria-hidden="true">
              ·
            </span>
          </>
        ) : null}
        <span>{view.from}</span>
      </p>
      {view.sentBy ? <p className="hr-notes-meta">{view.sentBy}</p> : null}
      <p>{view.preset}</p>
      {view.text ? (
        <p className="hr-notes-words" lang={wordsLang(view.text)}>
          {view.text}
        </p>
      ) : null}
      {view.quest ? <p className="hr-notes-meta">{m.console.notes.composer.preview.quest(view.quest)}</p> : null}
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
      {view.canHide || view.canReport || view.canBlock ? (
        <div className="hr-fnotes-actions">
          {view.canHide ? (
            <button type="button" className="hr-notes-btn" aria-describedby={rowId} onClick={() => onAction('hide')}>
              {f.actions.hide.cta}
            </button>
          ) : null}
          {view.canReport ? (
            <button type="button" className="hr-notes-btn" aria-describedby={rowId} onClick={() => onAction('report')}>
              {f.actions.report.cta}
            </button>
          ) : null}
          {view.canBlock ? (
            <button type="button" className="hr-notes-btn" aria-describedby={rowId} onClick={() => onAction('block')}>
              {f.actions.block.cta}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The Received tab of one learner (wireframe A, B, C): rows newest first with Show older, the one-time card, the
 * settings disclosure (class notes, the disclosure line, stopped senders) and the sheets for Hide, Report and Stop.
 * Hide, report, stop, allow again and the setting all need the network; a refusal is an amber line and the change snaps back.
 */
export function ReceivedPanel({
  notesApi,
  familyId,
  learner,
  m,
  locale,
}: {
  notesApi: NotesApi;
  familyId: string;
  learner: { id: string; displayName: string };
  m: Messages;
  locale: UiLocale;
}): JSX.Element {
  const f = m.console.notes.family;
  const ids = useId();
  const [rows, setRows] = useState<OversightNote[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [listState, setListState] = useState<ListState>('loading');
  const [olderBusy, setOlderBusy] = useState(false);
  const [prefs, setPrefs] = useState<FamilyNotePrefs | null>(null);
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [reason, setReason] = useState<NoteReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  // Only the newest blocks read may draw: an earlier answer arriving last never undoes a newer one.
  const latestBlocks = useRef(0);
  // Each Saved is a new message: a polite region repeating the same words is not read again, so every second one
  // carries an invisible no-break space.
  const saves = useRef(0);
  const choiceRef = useRef<{ focus?: () => void } | null>(null);
  const [focusChoice, setFocusChoice] = useState(false);

  const loadList = useCallback(async (): Promise<void> => {
    const call = ++latest.current;
    setListState('loading');
    setRows([]);
    const result = await notesApi.oversight(familyId, learner.id);
    if (call !== latest.current) return;
    if (result.ok) {
      setRows(result.data.rows);
      setNext(result.data.next);
      setListState('ready');
    } else setListState('error');
  }, [notesApi, familyId, learner.id]);

  /**
   * After Hide, Report, Stop or Allow again: the rows read again from the Worker in place, as deep as Show older had
   * gone, so loaded older notes stay and nothing flashes back to the skeleton. A failed read keeps the rows drawn.
   */
  const refreshList = useCallback(async (): Promise<void> => {
    const call = ++latest.current;
    const depth = rows.length;
    const result = await notesApi.oversight(familyId, learner.id);
    if (!result.ok) return;
    const fresh = [...result.data.rows];
    let cursor = result.data.next;
    while (cursor !== null && fresh.length < depth) {
      const more = await notesApi.oversight(familyId, learner.id, cursor);
      if (!more.ok) break;
      fresh.push(...more.data.rows);
      cursor = more.data.next;
    }
    if (call !== latest.current) return;
    setRows(fresh);
    setNext(cursor);
    setListState('ready');
  }, [notesApi, familyId, learner.id, rows.length]);

  const loadBlocks = useCallback(async (): Promise<void> => {
    const call = ++latestBlocks.current;
    const result = await notesApi.blocks(familyId, learner.id);
    if (call !== latestBlocks.current) return;
    setBlocks(result.ok ? result.data : []);
  }, [notesApi, familyId, learner.id]);

  const loadPrefs = useCallback(async (): Promise<void> => {
    const result = await notesApi.prefs(familyId, learner.id);
    setPrefs(result.ok ? result.data : null);
  }, [notesApi, familyId, learner.id]);

  useEffect(() => {
    void loadList();
    void loadPrefs();
    void loadBlocks();
  }, [loadList, loadPrefs, loadBlocks]);

  useEffect(() => {
    if (focusChoice && open) {
      choiceRef.current?.focus?.();
      setFocusChoice(false);
    }
  }, [focusChoice, open]);

  const older = async (): Promise<void> => {
    if (next === null || olderBusy) return;
    const call = latest.current;
    setOlderBusy(true);
    const result = await notesApi.oversight(familyId, learner.id, next);
    setOlderBusy(false);
    if (call !== latest.current) return;
    if (result.ok) {
      setRows((now) => [...now, ...result.data.rows]);
      setNext(result.data.next);
    } else setNotice(f.error);
  };

  /** A setting change: drawn at once, saved on the Worker, snapped back with a line when refused. Any answer here acknowledges the card. */
  const savePrefs = async (classes: NotesMode, after?: () => void): Promise<void> => {
    if (!prefs || busy) return;
    const before = prefs;
    setBusy(true);
    setNotice(null);
    setSaved(false);
    setPrefs({ ...prefs, classes });
    const result = await notesApi.putPrefs(familyId, learner.id, { classes, acknowledge: true });
    setBusy(false);
    if (result.ok) {
      setPrefs(result.data);
      setSaved(true);
      saves.current += 1;
      setAnnounce(saves.current % 2 === 0 ? `${f.settings.saved}\u00a0` : f.settings.saved);
    } else {
      setPrefs(before);
      setNotice(familyActionProblem(result.failure, 'prefs', locale));
    }
    after?.();
  };

  const closeSheet = (): void => {
    setSheet(null);
    setReason(null);
  };

  const confirmSheet = async (): Promise<void> => {
    if (!sheet || busy) return;
    const noteId = sheet.line.raw.id;
    setBusy(true);
    setNotice(null);
    const result =
      sheet.kind === 'hide'
        ? await notesApi.hide(familyId, learner.id, noteId)
        : sheet.kind === 'block'
          ? await notesApi.block(familyId, learner.id, noteId)
          : await notesApi.report(familyId, learner.id, noteId, { reason: reason ?? 'other' });
    setBusy(false);
    const kind = sheet.kind;
    closeSheet();
    if (!result.ok) {
      setNotice(familyActionProblem(result.failure, kind, locale));
      return;
    }
    void refreshList();
    if (kind === 'block') void loadBlocks();
  };

  const allowAgain = async (block: NoteBlock): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await notesApi.unblock(familyId, learner.id, block.senderRef);
    setBusy(false);
    if (!result.ok) {
      setNotice(familyActionProblem(result.failure, 'unblock', locale));
      return;
    }
    void loadBlocks();
    void refreshList();
  };

  const lines = receivedLines(rows, new Date(), locale);
  const settingsId = `${ids}-settings`;
  const changed = prefs ? prefsChangedLine(prefs.updatedBy, locale) : null;

  let list: JSX.Element;
  if (listState === 'loading' && rows.length === 0) {
    list = (
      <div className="hr-notes-rows" aria-busy="true" data-testid="received-loading">
        <div className="hr-notes-skeleton" />
        <div className="hr-notes-skeleton" />
        <div className="hr-notes-skeleton" />
      </div>
    );
  } else if (listState === 'error' && rows.length === 0) {
    list = (
      <div className="hr-notes-state" role="alert">
        <p>{f.error}</p>
        <button type="button" className="hr-notes-btn" onClick={() => void loadList()}>
          {f.retry.cta}
        </button>
      </div>
    );
  } else if (rows.length === 0) {
    list = <p className="hr-notes-quiet">{f.empty(learner.displayName)}</p>;
  } else {
    list = (
      <>
        <ul className="hr-notes-rows">
          {lines.map((line, i) => (
            <ReceivedRowCard
              key={line.raw.id}
              line={line}
              rowId={`${ids}-row-${i}`}
              m={m}
              onAction={(kind) => {
                setNotice(null);
                setReason(null);
                setSheet({ kind, line });
              }}
            />
          ))}
        </ul>
        {next !== null ? (
          <button type="button" className="hr-notes-btn" style={{ alignSelf: 'flex-start' }} onClick={() => void older()} disabled={olderBusy} aria-busy={olderBusy || undefined}>
            {f.older.cta}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <>
      <style>{FAMILY_NOTES_CSS}</style>
      <p className="hr-notes-hidden" role="status" aria-live="polite">
        {announce}
      </p>
      {notice ? (
        <p className="hr-notes-problem" role="alert">
          {notice}
        </p>
      ) : null}
      {prefs && showOneTimeCard(prefs, rows) ? (
        <section className="hr-fnotes-card" aria-label={f.settings.classes} data-testid="one-time-card">
          <p>{oneTimeCardLine(prefs.classes, locale)}</p>
          <div className="hr-fnotes-actions">
            <button type="button" className="hr-notes-btn" disabled={busy} onClick={() => void savePrefs(prefs.classes)}>
              {f.oneTimeCard.keep.cta}
            </button>
            <button
              type="button"
              className="hr-notes-btn"
              disabled={busy}
              onClick={() =>
                void savePrefs(prefs.classes, () => {
                  setOpen(true);
                  setFocusChoice(true);
                })
              }
            >
              {f.oneTimeCard.change.cta}
            </button>
          </div>
        </section>
      ) : null}
      {list}
      <div>
        <button type="button" className="hr-fnotes-disclosure" aria-expanded={open} aria-controls={settingsId} onClick={() => setOpen((now) => !now)}>
          <IconSvg name="arrow-right" size={GLYPH_ROW} color={colors.text.secondary} />
          <span>{f.settings.title(learner.displayName)}</span>
        </button>
        {open ? (
          <div className="hr-fnotes-settings" id={settingsId}>
            {prefs ? (
              <fieldset className="hr-fnotes-choices">
                <legend>{f.settings.classes}</legend>
                {classModeChoices(locale).map((choice) => (
                  <label key={choice.id} className="hr-fnotes-choice">
                    <input
                      type="radio"
                      name={`${ids}-classes`}
                      value={choice.id}
                      checked={prefs.classes === choice.id}
                      disabled={busy}
                      ref={(el) => {
                        if (prefs.classes === choice.id) choiceRef.current = el;
                      }}
                      onChange={() => void savePrefs(choice.id)}
                    />
                    <span>{choice.label}</span>
                  </label>
                ))}
                <p className="hr-notes-quiet">{f.settings.familyAlways}</p>
                {changed ? <p className="hr-notes-quiet">{changed}</p> : null}
                {saved ? (
                  <p className="hr-fnotes-saved">
                    <IconSvg name="check" size={GLYPH_ROW} color={colors.feedback.successDark} />
                    {f.settings.saved}
                  </p>
                ) : null}
              </fieldset>
            ) : null}
            <p className="hr-notes-quiet">{f.disclosure(learner.displayName)}</p>
            {blocks.length > 0 ? (
              <div className="hr-fnotes-stack">
                <h3>{f.settings.stopped.title}</h3>
                {blocks.map((block, i) => (
                  <div key={block.senderRef} className="hr-fnotes-stopped">
                    <span id={`${ids}-stopped-${i}`}>{blockRowLabel(block, locale)}</span>
                    <button type="button" className="hr-notes-btn" aria-describedby={`${ids}-stopped-${i}`} disabled={busy} onClick={() => void allowAgain(block)}>
                      {f.settings.stopped.allowAgain.cta}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {sheet ? <FamilyActionSheet sheet={sheet} learner={learner.displayName} reason={reason} busy={busy} m={m} locale={locale} onReason={setReason} onConfirm={() => void confirmSheet()} onClose={closeSheet} /> : null}
    </>
  );
}

/** Sheet B (Report) and the Hide and Stop confirms (screen spec, Sheets). */
function FamilyActionSheet({
  sheet,
  learner,
  reason,
  busy,
  m,
  locale,
  onReason,
  onConfirm,
  onClose,
}: {
  sheet: Sheet;
  learner: string;
  reason: NoteReportReason | null;
  busy: boolean;
  m: Messages;
  locale: UiLocale;
  onReason: (reason: NoteReportReason) => void;
  onConfirm: () => void;
  onClose: () => void;
}): JSX.Element {
  const f = m.console.notes.family;
  const ids = useId();
  if (sheet.kind === 'report') {
    const { view } = sheet.line;
    return (
      <TransferSheet title={f.report.title} onClose={onClose} closeLabel={m.console.notes.composer.close} testId="report-sheet">
        <div className="hr-fnotes-sheet">
          <div className="hr-fnotes-quote">
            <p className="hr-notes-meta">{view.from}</p>
            <p className="hr-fnotes-preset">{view.preset}</p>
            {view.text ? (
              <p className="hr-notes-words" lang={wordsLang(view.text)}>
                {view.text}
              </p>
            ) : null}
          </div>
          <fieldset className="hr-fnotes-choices">
            <legend id={`${ids}-why`}>{f.report.why}</legend>
            {reportReasonChoices(learner, locale).map((choice) => (
              <label key={choice.id} className="hr-fnotes-choice">
                <input type="radio" name={`${ids}-reason`} value={choice.id} checked={reason === choice.id} onChange={() => onReason(choice.id)} />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="hr-notes-quiet">{f.report.line}</p>
          <div className="hr-compose-actions">
            <MoveButton primary waiting={reason === null || busy} describedBy={reason === null ? `${ids}-why` : undefined} onClick={onConfirm} testId="report-submit">
              {f.report.submit.cta}
            </MoveButton>
            <MoveButton onClick={onClose}>{f.report.cancel.cta}</MoveButton>
          </div>
        </div>
      </TransferSheet>
    );
  }
  const hide = sheet.kind === 'hide';
  return (
    <TransferSheet title={hide ? f.hideConfirm.title(learner) : f.blockConfirm.title} onClose={onClose} closeLabel={m.console.notes.composer.close} testId={hide ? 'hide-sheet' : 'block-sheet'}>
      <div className="hr-fnotes-sheet">
        <p>{hide ? f.hideConfirm.body(learner) : f.blockConfirm.body(learner)}</p>
        <div className="hr-compose-actions">
          <MoveButton primary waiting={busy} onClick={onConfirm} testId="family-confirm">
            {hide ? f.hideConfirm.cta : f.blockConfirm.cta}
          </MoveButton>
          <MoveButton onClick={onClose}>{hide ? f.hideConfirm.cancel.cta : f.blockConfirm.cancel.cta}</MoveButton>
        </div>
      </div>
    </TransferSheet>
  );
}

/**
 * Panel D on the family settings page (`console/family-notes.md` D, OD-17, rule 8.2-b): the family's adults, the
 * owner always sending, each caregiver with a **Can send notes** switch named by the person. Only the owner turns a
 * switch; other caregivers read the same list with the switches disabled. A switch is drawn at once and snaps back with
 * a line when the Worker refuses it.
 */
export function NoteSendersPanel({ notesApi, familyId, viewerAccountId, m, locale }: { notesApi: NotesApi; familyId: string; viewerAccountId: string; m: Messages; locale: UiLocale }): JSX.Element | null {
  const f = m.console.notes.family;
  const s = f.senders;
  const ids = useId();
  const [senders, setSenders] = useState<NoteSender[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setFailed(false);
    const result = await notesApi.noteSenders(familyId);
    if (result.ok) setSenders(result.data);
    else setFailed(true);
  }, [notesApi, familyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (accountId: string, canSend: boolean): Promise<void> => {
    if (!senders || busy) return;
    const before = senders;
    setBusy(accountId);
    setNotice(null);
    setSenders(senders.map((x) => (x.accountId === accountId ? { ...x, canSend } : x)));
    const result = await notesApi.setNoteSender(familyId, accountId, canSend);
    setBusy(null);
    if (!result.ok) {
      setSenders(before);
      setNotice(familyActionProblem(result.failure, 'senders', locale));
    }
  };

  if (!senders && !failed) return null;
  const view = senders ? senderRows(senders, viewerAccountId, locale) : null;
  return (
    <section className="hr-fnotes-senders" aria-labelledby={`${ids}-title`} data-testid="note-senders" style={{ padding: spacing.lg, backgroundColor: colors.surface.paper, borderRadius: radii.lg, border: `${borderWidth.thin}px solid ${colors.border.subtle}`, marginBottom: spacing.lg }}>
      <style>
        {NOTES_CSS}
        {FAMILY_NOTES_CSS}
      </style>
      <h2 id={`${ids}-title`}>{s.title}</h2>
      {notice ? (
        <p className="hr-notes-problem" role="alert">
          {notice}
        </p>
      ) : null}
      {view ? (
        <>
          <div>
            {view.rows.map((row, i) => (
              <div key={row.accountId} className="hr-fnotes-sender">
                <span className="hr-fnotes-sender-name" id={`${ids}-name-${i}`}>
                  {row.name}
                </span>
                {row.always ? (
                  <span className="hr-notes-quiet">{s.always}</span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    className="hr-fnotes-switch"
                    aria-checked={row.canSend}
                    aria-labelledby={`${ids}-name-${i} ${ids}-label-${i}`}
                    disabled={!row.switchable || busy !== null}
                    onClick={() => void toggle(row.accountId, !row.canSend)}
                  >
                    <span id={`${ids}-label-${i}`}>{s.canSend}</span>
                    <span className="hr-fnotes-track" aria-hidden="true">
                      <span className="hr-fnotes-thumb" />
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="hr-notes-quiet">{s.line}</p>
        </>
      ) : (
        <div className="hr-notes-state" role="alert">
          <p>{f.error}</p>
          <button type="button" className="hr-notes-btn" onClick={() => void load()}>
            {f.retry.cta}
          </button>
        </div>
      )}
    </section>
  );
}
