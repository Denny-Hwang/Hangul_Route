'use client';

import { normalizeJoinCode } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import type { ApiResult, ConsoleApi } from '@/lib/console/api';
import { moveError, type ClassMoveDestination, type MoveError, type MoveErrorKey, type OutgoingMove } from '@/lib/console/class-moves';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { ClassCodeField, MoveButton, TransferSheet } from './TransferParts';

/**
 * [TV] The teacher's Move sheet (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D7, TV-D8; wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 1, mock notes `design/screens/class-moves/README.md`).
 *
 * Step 1 "Where to?": one radio per class the teacher manages (`destinations`, a direct move), or "A class of another
 * teacher" with the shipped class-code field and **Find class** (a preview that writes nothing). Step 2 confirms: a
 * direct move happens at once ("The family gets a short notice."), another teacher's class has to accept. Done says
 * which. Every word comes from `console.teacherMove`; every value is a token; nothing is red. The learner id travels in
 * request bodies only.
 */

export type TeacherMoveApi = Pick<ConsoleApi, 'classMoveDestinations' | 'previewClassMove' | 'createClassMove'>;

export interface TeacherMoveSheetProps {
  /** The source class (the acting space). */
  spaceId: string;
  learner: { id: string; name: string };
  api: TeacherMoveApi;
  online: boolean;
  onClose: () => void;
  /** The move happened (direct) or was sent (accept). */
  onDone: (move: OutgoingMove) => void;
  /** A page state the sheet cannot show: the lock (the entry points hide), a sign-out, a class this account no longer manages. */
  onPageState: (state: 'locked' | 'signIn' | 'forbidden') => void;
}

type Target = { kind: 'own'; destination: ClassMoveDestination } | { kind: 'code'; destination: ClassMoveDestination; code: string; direct: boolean };
type Step = 'pick' | 'confirm' | 'done';
const OTHER = 'other';

const radioRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  minHeight: touchTarget.min,
  padding: `0 ${spacing.md}px`,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.md,
  backgroundColor: colors.surface.paper,
  fontSize: typography.size.body,
  color: colors.text.primary,
  cursor: 'pointer',
};
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginTop: spacing.lg };
const lineStyle: CSSProperties = { margin: `0 0 ${spacing.sm}px`, fontSize: typography.size.body, color: colors.text.primary, lineHeight: typography.leading.relaxed };

export function TeacherMoveSheet({ spaceId, learner, api, online, onClose, onDone, onPageState }: TeacherMoveSheetProps): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.teacherMove;
  const legendId = useId();
  const [destinations, setDestinations] = useState<ClassMoveDestination[] | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Target | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState<null | 'loading' | 'looking' | 'moving'>('loading');
  const [error, setError] = useState<MoveErrorKey | null>(null);
  const [done, setDone] = useState<OutgoingMove | null>(null);

  /** Handles a failed answer; true when the sheet should look the code up again. */
  const fail = useCallback(
    (result: ApiResult<unknown>): boolean => {
      const err: MoveError | null = moveError(result);
      if (!err) return false;
      if (err.kind === 'locked' || err.kind === 'signIn' || err.kind === 'forbidden') {
        onPageState(err.kind);
        return false;
      }
      if (err.kind === 'refind') return true;
      setError(err.key);
      return false;
    },
    [onPageState],
  );

  useEffect(() => {
    let live = true;
    void api.classMoveDestinations(spaceId, learner.id).then((r) => {
      if (!live) return;
      setBusy(null);
      if (r.ok) {
        setDestinations(r.data);
        if (r.data.length === 0) setChoice(OTHER);
      } else if (!fail(r)) {
        setDestinations([]);
        setChoice(OTHER);
      }
    });
    return () => {
      live = false;
    };
  }, [api, spaceId, learner.id, fail]);

  const find = async (typed: string): Promise<void> => {
    setError(null);
    const normalized = normalizeJoinCode(typed);
    if (!online) return setError('offline');
    if (!normalized) {
      setFound(null);
      return setError('codeNotFound');
    }
    setBusy('looking');
    const r = await api.previewClassMove(spaceId, { learnerId: learner.id, code: normalized });
    setBusy(null);
    if (!r.ok) {
      setFound(null);
      fail(r);
      return;
    }
    setFound({ kind: 'code', destination: r.data.destination, code: normalized, direct: r.data.direct });
  };

  const target: Target | null = choice === OTHER ? found : (() => {
    const own = destinations?.find((d) => d.id === choice);
    return own ? { kind: 'own', destination: own } : null;
  })();
  const direct = target?.kind === 'own' || (target?.kind === 'code' && target.direct);

  const move = async (): Promise<void> => {
    if (!target) return;
    setError(null);
    if (!online) return setError('offline');
    setBusy('moving');
    const body = target.kind === 'code' ? { learnerId: learner.id, destinationSpaceId: target.destination.id, code: target.code } : { learnerId: learner.id, destinationSpaceId: target.destination.id };
    const r = await api.createClassMove(spaceId, body);
    setBusy(null);
    if (r.ok) {
      setDone(r.data);
      setStep('done');
      return;
    }
    // The code now opens another class: nothing was sent; back to step 1 with a fresh lookup.
    if (fail(r) && target.kind === 'code') {
      setStep('pick');
      await find(target.code);
    }
  };

  const errorText = (key: MoveErrorKey | null): string | null => {
    if (key === null) return null;
    const name = learner.name;
    const cls = target?.destination.name ?? '';
    switch (key) {
      case 'full':
        return t.errors.full(cls);
      case 'capLearner':
        return t.errors.capLearner(name);
      case 'alreadyMember':
        return t.errors.alreadyMember(name, cls);
      case 'alreadyOpen':
        return t.errors.alreadyOpen(name);
      case 'sameSpace':
        return t.errors.sameSpace(name);
      default:
        return t.errors[key];
    }
  };
  const errorLine = errorText(error);

  if (step === 'done' && done) {
    return (
      <TransferSheet title={t.sheetTitle(learner.name)} onClose={() => onDone(done)} testId="teacher-move-sheet">
        <p role="status" data-testid="teacher-move-done" style={lineStyle}>
          {done.status === 'moved' ? t.moved(learner.name, done.to.name) : t.sent(done.to.name)}
        </p>
        <div style={rowStyle}>
          <MoveButton primary onClick={() => onDone(done)} testId="teacher-move-finish">
            {t.done.cta}
          </MoveButton>
        </div>
      </TransferSheet>
    );
  }

  if (step === 'confirm' && target) {
    return (
      <TransferSheet title={t.sheetTitle(learner.name)} onClose={onClose} testId="teacher-move-sheet">
        <section data-testid="teacher-move-confirm">
          <h3 style={{ margin: `0 0 ${spacing.sm}px`, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold }}>
            {direct ? t.confirmDirect(learner.name, target.destination.name) : t.confirmAccept(learner.name, target.destination.name)}
          </h3>
          <p style={lineStyle}>{direct ? t.directLine : t.acceptLine(target.destination.name)}</p>
          <p style={lineStyle}>{t.keeps(learner.name)}</p>
        </section>
        {errorLine ? (
          <p role="alert" data-testid="teacher-move-error" style={{ ...lineStyle, fontWeight: typography.weight.semibold }}>
            {errorLine}
          </p>
        ) : null}
        <div style={rowStyle}>
          <MoveButton onClick={() => setStep('pick')} disabled={busy === 'moving'} testId="teacher-move-back">
            {t.back.cta}
          </MoveButton>
          <MoveButton primary waiting={busy === 'moving'} onClick={() => void move()} testId="teacher-move-go">
            {direct ? (busy === 'moving' ? t.moving.cta : t.moveNow.cta) : busy === 'moving' ? t.sending.cta : t.send.cta}
          </MoveButton>
        </div>
      </TransferSheet>
    );
  }

  return (
    <TransferSheet title={t.sheetTitle(learner.name)} onClose={onClose} testId="teacher-move-sheet">
      {busy === 'loading' ? (
        <p role="status" style={{ ...lineStyle, color: colors.text.secondary }}>
          {t.loading}
        </p>
      ) : (
        <fieldset aria-labelledby={legendId} style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <legend id={legendId} style={{ padding: 0, marginBottom: spacing.sm, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold }}>
            {t.whereTo}
          </legend>
          {destinations && destinations.length > 0 ? (
            <p style={{ margin: 0, fontSize: typography.size.bodySm, color: colors.text.secondary, fontWeight: typography.weight.semibold }}>{t.yourClasses}</p>
          ) : (
            <p style={{ margin: 0, color: colors.text.secondary }} data-testid="teacher-move-no-class">
              {t.noOtherClass}
            </p>
          )}
          {(destinations ?? []).map((d) => (
            <label key={d.id} style={radioRow} data-testid="teacher-move-own">
              <input
                type="radio"
                name="teacher-move-target"
                value={d.id}
                checked={choice === d.id}
                onChange={() => {
                  setChoice(d.id);
                  setError(null);
                }}
              />
              <span style={{ overflowWrap: 'anywhere' }}>{d.name}</span>
            </label>
          ))}
          <label style={radioRow} data-testid="teacher-move-other">
            <input
              type="radio"
              name="teacher-move-target"
              value={OTHER}
              checked={choice === OTHER}
              onChange={() => {
                setChoice(OTHER);
                setError(null);
              }}
            />
            <span>{t.otherTeacher}</span>
          </label>
        </fieldset>
      )}
      {choice === OTHER ? (
        <div style={{ marginTop: spacing.md }} data-testid="teacher-move-code">
          <ClassCodeField
            value={code}
            onChange={(next) => {
              setCode(next);
              setError(null);
              setFound((prev) => (prev?.kind === 'code' && normalizeJoinCode(next) !== prev.code ? null : prev));
            }}
            label={messages.console.space.codeLabel.class}
            rules={messages.caregiver.join.code.rules}
            error={errorLine}
            disabled={busy !== null}
          />
          <MoveButton waiting={busy === 'looking'} onClick={() => void find(code)} testId="teacher-move-find">
            {busy === 'looking' ? messages.console.transfer.start.looking.cta : messages.console.transfer.start.find.cta}
          </MoveButton>
          {found ? (
            <p data-testid="teacher-move-found" style={{ ...lineStyle, marginTop: spacing.md, fontWeight: typography.weight.semibold }}>
              {found.destination.name}
            </p>
          ) : null}
        </div>
      ) : errorLine ? (
        <p role="alert" data-testid="teacher-move-error" style={{ ...lineStyle, marginTop: spacing.md, fontWeight: typography.weight.semibold }}>
          {errorLine}
        </p>
      ) : null}
      <div style={rowStyle}>
        <MoveButton onClick={onClose} testId="teacher-move-cancel">
          {messages.console.transfer.actions.cancel.cta}
        </MoveButton>
        <MoveButton primary waiting={!target} onClick={() => setStep('confirm')} testId="teacher-move-continue">
          {t.continue.cta}
        </MoveButton>
      </div>
    </TransferSheet>
  );
}
