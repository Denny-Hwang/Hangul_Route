'use client';

import type { SpaceKind } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MutableRefObject, type ReactNode } from 'react';
import type { ConsoleApi } from '@/lib/console/api';
import { NameOverrides, checkRename, renameCancel, renameCheckLine, renameEdit, renameFailureLine, renameFailureOf, renameHint, renameIdle, renameOpen, renameSettled, renameSubmit, type RenameState } from '@/lib/console/rename';
import { rem } from '@/lib/console/rem';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { buttonBase } from './ui';

/**
 * The one-tap rename of a family, class or school, in the place its name is shown ([SA] AMENDMENTS-SEATS-ADMINS
 * section 5.3; wireframe design/wireframes/console/rename-inline.md, mock design/screens/console/rename-inline.md,
 * decisions D1 to D6 of design/screens/console/README.md).
 *
 * - `useSpaceRename` holds the field and the save: the name shows at once through `onName` (the page's own state, so
 *   its title, Back labels and frame follow), and comes back when the save does not land.
 * - `RenameButton` is the text button "Rename" (D1); `RenameForm` the field with Save and Cancel; `RenameTitle` puts
 *   both in a title row, the heading kept visually hidden while the field is open (D2).
 * - `useAnnouncer` is the page's one polite live region, which says "Name saved.".
 * Telemetry: none from the page (the Worker sends `space.renamed` with codes only).
 */

/** Layout rules that change with the field's own width (a container query, so a class row behaves like a phone). Tokens only. */
const RENAME_CSS = `
.hr-rn-row{display:flex;flex-wrap:wrap;align-items:center;column-gap:${spacing.md}px;row-gap:${spacing.xs}px;min-width:0}
.hr-rn-row>.hr-rn-head{flex:0 1 auto;min-width:0;overflow-wrap:anywhere}
.hr-rn-hidden{position:absolute;width:${borderWidth.thin}px;height:${borderWidth.thin}px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hr-rn{display:flex;flex-direction:column;gap:${spacing.xs}px;width:100%;container:hr-rename / inline-size}
.hr-rn-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:${spacing.sm}px}
.hr-rn-notes{display:flex;flex-direction:column;gap:${spacing.xs}px}
.hr-rn-notes:empty{display:none}
.hr-rn-actions{display:flex;flex-wrap:wrap;gap:${spacing.sm}px}
@container hr-rename (min-width:36rem){.hr-rn-grid{grid-template-columns:minmax(0,28rem) auto;grid-template-areas:"input actions" "notes notes";align-items:start}.hr-rn-input{grid-area:input}.hr-rn-actions{grid-area:actions;flex-wrap:nowrap}.hr-rn-notes{grid-area:notes}}
`;

export function RenameStyles(): JSX.Element {
  return <style>{RENAME_CSS}</style>;
}

const control: CSSProperties = { ...buttonBase, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: touchTarget.min, boxSizing: 'border-box', flex: 'none' };
const primary: CSSProperties = { ...control, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary };
const unavailable: CSSProperties = { ...control, backgroundColor: colors.surface.sunken, borderColor: colors.border.subtle, color: colors.text.muted, cursor: 'default' };
const inputStyle = (invalid: boolean, saving: boolean): CSSProperties => ({
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  minHeight: touchTarget.min,
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radii.md,
  border: `${invalid ? borderWidth.thick : borderWidth.base}px solid ${invalid ? colors.text.primary : colors.border.shape}`,
  backgroundColor: saving ? colors.surface.sunken : colors.surface.paper,
  color: colors.text.primary,
  fontSize: rem(typography.size.bodyLg),
  fontWeight: typography.weight.bold,
});
const hintStyle: CSSProperties = { margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.bodySm), lineHeight: typography.leading.relaxed };
const movesStyle: CSSProperties = { margin: 0, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.md, backgroundColor: colors.surface.sunken, color: colors.text.primary, fontSize: rem(typography.size.bodySm), lineHeight: typography.leading.relaxed };
/**
 * The input's HTML `maxLength` ([SA-0b review], section 5.3): it counts raw UTF-16 units before NFC, and a decomposed
 * Hangul paste takes up to 3 units a syllable, so 40 would cut a valid name; the 40 is checked after NFC
 * (`checkSpaceName`, shown as `tooLong(40)`).
 */
export const RENAME_INPUT_MAX = 120;

/** An IME is composing (Korean, Japanese, Chinese): Enter and Escape belong to it, never to the field. */
function composing(event: KeyboardEvent<HTMLInputElement>, held: boolean): boolean {
  return held || event.nativeEvent?.isComposing === true || event.keyCode === 229;
}

const errorStyle: CSSProperties = { margin: 0, color: colors.text.primary, fontWeight: typography.weight.semibold, lineHeight: typography.leading.relaxed };

/** The page's one polite live region (mock: "One polite live region per page"); a new line is a new node, so a repeat is read again. */
export function useAnnouncer(): { announce: (text: string) => void; region: JSX.Element } {
  const [said, setSaid] = useState<{ text: string; n: number }>({ text: '', n: 0 });
  const announce = useCallback((text: string) => setSaid((prev) => ({ text, n: prev.n + 1 })), []);
  const region = (
    <p role="status" aria-live="polite" className="hr-rn-hidden" data-testid="rename-live">
      {said.text ? <span key={said.n}>{said.text}</span> : null}
    </p>
  );
  return { announce, region };
}

export interface SpaceRename {
  state: RenameState;
  start: () => void;
  edit: (draft: string) => void;
  cancel: () => void;
  submit: () => void;
  buttonRef: MutableRefObject<HTMLButtonElement | null>;
  inputRef: MutableRefObject<HTMLInputElement | null>;
}

/**
 * The field and the save of one space's name. `name` is what the page shows; `onName` sets it (at once on Save, back
 * on a failure, to the Worker's stored name when it answers). `onOpenChange` lets a class row step its buttons aside.
 */
/** The page's `NameOverrides`, one for its life: every read numbers itself with `begin()` and draws names through `nameFor`. */
export function useNameOverrides(): NameOverrides {
  const [overrides] = useState(() => new NameOverrides());
  return overrides;
}

export function useSpaceRename({
  api,
  spaceId,
  name,
  onName,
  announce,
  onOpenChange,
}: {
  api: ConsoleApi | null;
  spaceId: string;
  name: string;
  /** The name to show: `settled` false for the optimistic one, true once the PATCH answered (see `NameOverrides`). */
  onName: (name: string, settled: boolean) => void;
  announce: (text: string) => void;
  onOpenChange?: (open: boolean) => void;
}): SpaceRename {
  const { messages } = useConsoleLocale();
  const [state, setState] = useState<RenameState>(() => renameIdle(name));
  const live = useRef(state);
  live.current = state;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpen = useRef(false);

  // The field opens with the value selected and focus in it; when it closes, focus goes back to Rename.
  useEffect(() => {
    if (state.open && !wasOpen.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (!state.open && wasOpen.current) buttonRef.current?.focus();
    if (state.open !== wasOpen.current) onOpenChange?.(state.open);
    wasOpen.current = state.open;
  }, [state.open, onOpenChange]);

  const start = useCallback(() => setState((s) => renameOpen(s, name)), [name]);
  const edit = useCallback((draft: string) => setState((s) => renameEdit(s, draft)), []);
  const cancel = useCallback(() => setState((s) => renameCancel(s)), []);
  const submit = useCallback(() => {
    const { state: next, send } = renameSubmit(live.current);
    if (send === null || !api) return;
    live.current = next;
    setState(next);
    onName(send, false);
    void api
      .renameSpace(spaceId, send)
      .catch(() => ({ ok: false as const, error: 'network' as const, status: -1 }))
      .then((result) => {
        const online = typeof navigator === 'undefined' || navigator.onLine !== false;
        const settled = renameSettled(live.current, result.ok ? { ok: true, name: result.data.space.name, changed: result.data.changed } : { ok: false, failure: renameFailureOf(result, online) });
        live.current = settled.state;
        setState(settled.state);
        onName(settled.name, true);
        if (settled.announce) announce(messages.console.rename.saved);
      });
  }, [api, spaceId, onName, announce, messages]);

  return { state, start, edit, cancel, submit, buttonRef, inputRef };
}

/**
 * The text button "Rename" (D1): secondary, `touchTarget.min`, its accessible name starts with the visible word. While
 * a save is under way it stays `aria-disabled` and `aria-busy` (it keeps its focus), so a second rename never races the
 * first.
 */
export function RenameButton({ rename, name, testId = 'rename' }: { rename: SpaceRename; name: string; testId?: string }): JSX.Element {
  const r = useConsoleLocale().messages.console.rename;
  const saving = rename.state.saving;
  return (
    <button
      type="button"
      ref={rename.buttonRef}
      style={control}
      aria-label={r.a11y(name)}
      aria-disabled={saving ? true : undefined}
      aria-busy={saving ? true : undefined}
      onClick={() => !saving && rename.start()}
      data-testid={testId}
    >
      {r.cta}
    </button>
  );
}

/**
 * The open field (mock "Open"): label, the input (the name selected, `maxLength` `RENAME_INPUT_MAX` = 120 so a long NFD
 * paste is never cut; the 40 is checked after NFC by `checkRename`), then under it the error line
 * (when any), the kind hint and the open-moves line, which are its description in that order, and Save / Cancel.
 * Save is `aria-disabled` while the value is unchanged or invalid (D3); Enter saves, Escape cancels.
 */
export function RenameForm({ rename, kind, openMoves, testId = 'rename-form' }: { rename: SpaceRename; kind: SpaceKind; openMoves: boolean; testId?: string }): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const r = messages.console.rename;
  const id = useId();
  const { state } = rename;
  const check = checkRename(state.draft, state.stored);
  const failure = state.failure ? renameFailureLine(state.failure, locale) : null;
  const errorLine = failure ?? renameCheckLine(check, locale);
  const blocked = state.saving || state.failure === 'archived' || check.state !== 'ok';
  const describedBy = [errorLine ? `${id}-error` : null, `${id}-hint`, openMoves ? `${id}-moves` : null].filter(Boolean).join(' ');
  // IME composition ([SA-0b review]): Enter and Escape during it do nothing, the implicit submit included, so a
  // Hangul name is never saved without its last syllable; Save reads the committed value once it ends.
  const imeOn = useRef(false);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if ((event.key === 'Enter' || event.key === 'Escape') && composing(event, imeOn.current)) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!state.saving) rename.cancel();
    }
  };
  return (
    <form
      className="hr-rn"
      data-testid={testId}
      onSubmit={(event) => {
        event.preventDefault();
        if (!imeOn.current) rename.submit();
      }}
    >
      <label htmlFor={`${id}-input`} style={{ fontWeight: typography.weight.semibold }}>
        {r.label}
      </label>
      <div className="hr-rn-grid">
        <input
          id={`${id}-input`}
          ref={rename.inputRef}
          className="hr-rn-input"
          name="name"
          maxLength={RENAME_INPUT_MAX}
          value={state.draft}
          readOnly={state.saving}
          aria-invalid={errorLine ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => rename.edit(event.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => (imeOn.current = true)}
          onCompositionEnd={(event) => {
            imeOn.current = false;
            rename.edit(event.currentTarget.value);
          }}
          style={inputStyle(errorLine !== null, state.saving)}
          data-testid={`${testId}-input`}
        />
        <div className="hr-rn-notes">
          {errorLine ? (
            <p id={`${id}-error`} style={errorStyle} data-testid={`${testId}-error`}>
              {errorLine}
            </p>
          ) : null}
          <p id={`${id}-hint`} style={hintStyle}>
            {renameHint(kind, locale)}
          </p>
          {openMoves ? (
            <p id={`${id}-moves`} style={movesStyle} data-testid={`${testId}-moves`}>
              {r.openMoves}
            </p>
          ) : null}
        </div>
        <div className="hr-rn-actions">
          <button type="submit" style={blocked ? unavailable : primary} aria-disabled={blocked ? true : undefined} aria-busy={state.saving ? true : undefined} data-testid={`${testId}-save`}>
            {r.save.cta}
          </button>
          <button type="button" style={state.saving ? unavailable : control} aria-disabled={state.saving ? true : undefined} onClick={() => !state.saving && rename.cancel()} data-testid={`${testId}-cancel`}>
            {r.cancel.cta}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * A title row: the heading (the page's h1, or a family's h2) with Rename right of it, wrapping under it on a phone.
 * Open, the heading stays in the page visually hidden with the stored name (D2) and the field takes its place.
 * `title` is the heading's text when it is more than the name (the school's "Maple School · school"); the field
 * always holds the name alone. Without `canRename` it is the heading alone, as before.
 */
export function RenameTitle({
  rename,
  name,
  title,
  kind,
  canRename,
  openMoves,
  heading,
  headingId,
  headingStyle,
  after,
  testId = 'rename',
}: {
  rename: SpaceRename;
  name: string;
  title?: string;
  kind: SpaceKind;
  canRename: boolean;
  openMoves: boolean;
  heading: 'h1' | 'h2';
  headingId?: string;
  headingStyle: CSSProperties;
  /** Shown after the heading text (the "(archived)" mark of a family). */
  after?: ReactNode;
  testId?: string;
}): JSX.Element {
  const Heading = heading;
  const open = canRename && rename.state.open;
  if (open) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Heading id={headingId} className="hr-rn-hidden">
          {title ?? rename.state.stored}
        </Heading>
        <RenameForm rename={rename} kind={kind} openMoves={openMoves} testId={`${testId}-form`} />
      </div>
    );
  }
  return (
    <div className="hr-rn-row">
      <Heading id={headingId} className="hr-rn-head" style={{ ...headingStyle, margin: 0 }} data-testid={`${testId}-title`}>
        {title ?? name}
        {after}
      </Heading>
      {canRename ? <RenameButton rename={rename} name={name} testId={testId} /> : null}
    </div>
  );
}

/**
 * The Name block at the top of Settings (mock boards 24 to 26): the heading "Name" (D4, the field's label word), the
 * name and Rename; open, the field in the block; archived, the name and `console.rename.archived`, no button.
 */
export function SettingsNameRow({ rename, name, kind, canRename, openMoves, archived }: { rename: SpaceRename; name: string; kind: SpaceKind; canRename: boolean; openMoves: boolean; archived: boolean }): JSX.Element {
  const r = useConsoleLocale().messages.console.rename;
  const id = useId();
  return (
    <section aria-labelledby={`${id}-name`} data-testid="settings-name" style={{ padding: spacing.lg, backgroundColor: colors.surface.paper, borderRadius: radii.lg, border: `${borderWidth.thin}px solid ${colors.border.subtle}`, marginBottom: spacing.lg }}>
      <h2 id={`${id}-name`} style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.xs}px` }}>
        {r.label}
      </h2>
      {canRename && !archived && rename.state.open ? (
        <RenameForm rename={rename} kind={kind} openMoves={openMoves} testId="settings-rename-form" />
      ) : (
        <div className="hr-rn-row">
          <p className="hr-rn-head" style={{ margin: 0, fontWeight: typography.weight.semibold }} data-testid="settings-name-text">
            {name}
          </p>
          {canRename && !archived ? <RenameButton rename={rename} name={name} testId="settings-rename" /> : null}
        </div>
      )}
      {/* Only to someone who may rename: a caregiver or a teacher who is not the owner cannot unarchive either. */}
      {archived && canRename ? <p style={hintStyle}>{r.archived}</p> : null}
    </section>
  );
}
