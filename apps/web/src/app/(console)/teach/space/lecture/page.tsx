'use client';

import { ACTIVITY_PRESETS, type LectureBlock, type RomanizationMode, type UiLocale } from '@hangul-route/content-schema';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { LOCALE_META } from '@hangul-route/i18n';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } from '@/data/lecture-catalogue.generated';
import { stage1Episodes, stage1Quests } from '@/data/stage1-catalog';
import type { PlanView, Roster } from '@/lib/console/api';
import { appUrl } from '@/lib/console/config';
import {
  aboutMinutes,
  blockMinutes,
  buildDeck,
  catalogueTitle,
  classCodeBlock,
  deckPicker,
  lectureSourceFrom,
  moveBlock,
  pickerChoices,
  planBlocks,
  presenterUrl,
  revisitBlock,
  rosterMessage,
  titleProblem,
  updateBlock,
  type LectureSource,
  type PickerChoice,
} from '@/lib/console/lecture';
import { answerReady, appOriginOf, openPresenter, type OpenedDeck } from '@/lib/console/lecture-link';
import { latestPublished } from '@/lib/console/plans';
import { classRollup } from '@/lib/console/rollup';
import { ROUTES, type SpaceError, spaceErrorText, spaceIdFrom } from '@/lib/console/routing';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

const QUIZ_ROUNDS = [3, 5, 8, 10] as const;
const ACTIVITY_MINUTES = [1, 2, 3, 5, 10, 15] as const;

const h2Style: CSSProperties = { fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` };
const sectionStyle: CSSProperties = { ...panelStyle, marginBottom: spacing.lg };
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: `${spacing.xs}px 0` };
const selectStyle: CSSProperties = { padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}`, backgroundColor: colors.surface.paper, color: colors.text.primary };
const rowButtonStyle: CSSProperties = {
  minWidth: spacing.xxxl,
  minHeight: spacing.xxxl,
  padding: `${spacing.xs}px ${spacing.md}px`,
  borderRadius: radii.pill,
  border: `1px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: typography.size.bodySm,
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};
const choiceStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, marginRight: spacing.lg, minHeight: spacing.xxl };
const blockChoiceStyle: CSSProperties = { ...choiceStyle, display: 'flex' };

/** console/lecture-setup — F-TCH-004 §3.11, wireframe `classroom/lecture-presenter.md` screen K. */
function LectureInner(): JSX.Element {
  const params = useSearchParams();
  const spaceId = spaceIdFrom(params);
  const preselected = lectureSourceFrom(params);
  const { ready, session, api, signOut, m, locale } = useConsole();
  const { available } = useConsoleLocale();
  const c = m.console;
  const l = c.lecture;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [error, setError] = useState<SpaceError | null>(null);
  const [source, setSource] = useState<LectureSource>('catalogue');
  const [blocks, setBlocks] = useState<LectureBlock[]>([]);
  const [title, setTitle] = useState('');
  const [romanization, setRomanization] = useState<RomanizationMode>('always');
  const [strokeGuide, setStrokeGuide] = useState(true);
  const [sound, setSound] = useState(true);
  const [uiLocale, setUiLocale] = useState<UiLocale | null>(null);
  const [picker, setPicker] = useState<PickerChoice>('numbers');
  const [blocked, setBlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  // The presenter tabs this page opened, each with its deck and roster: the only windows a `ready` is answered for.
  const opened = useRef(new Map<unknown, OpenedDeck>());
  const now = useMemo(() => new Date(), []);

  const rollup = roster ? classRollup(roster.learners, now) : null;
  const revisit = rollup ? revisitBlock(rollup.revisit) : null;

  const choose = useCallback((next: LectureSource, from: { plan: PlanView | null; revisit: LectureBlock | null }): void => {
    setSource(next);
    if (next === 'plan' && from.plan) {
      setBlocks(planBlocks(from.plan));
      setTitle(from.plan.title.slice(0, 60));
    } else if (next === 'revisit' && from.revisit) {
      setBlocks([from.revisit]);
      setTitle('');
    } else {
      setBlocks([]);
      setTitle('');
    }
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [rosterRes, plansRes] = await Promise.all([api.roster(spaceId), api.listPlans(spaceId)]);
    if (!rosterRes.ok) {
      setError(rosterRes.error === 'forbidden' ? 'forbidden' : rosterRes.error === 'not_found' ? 'gone' : 'cantReach');
      return;
    }
    const latest = plansRes.ok ? latestPublished(plansRes.data) : null;
    const revisitNow = revisitBlock(classRollup(rosterRes.data.learners, new Date()).revisit);
    setRoster(rosterRes.data);
    setPlan(latest);
    setPicker(pickerChoices(rosterRes.data).initial);
    const start: LectureSource = preselected === 'revisit' && revisitNow ? 'revisit' : latest && preselected !== 'revisit' ? 'plan' : 'catalogue';
    choose(start, { plan: latest, revisit: revisitNow });
  }, [api, spaceId, preselected, choose]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const origin = appOriginOf(appUrl());
    const onMessage = (event: MessageEvent): void => {
      answerReady({ origin: event.origin, source: event.source, data: event.data }, { appOrigin: origin, opened: opened.current });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const problem = roster ? titleProblem(title, roster) : 'empty';
  const choices = roster ? pickerChoices(roster) : null;
  const canPresent = roster !== null && blocks.length > 0 && problem === null;
  const hasCode = blocks.some((b) => b.kind === 'class-code');
  const codeBlock = roster ? classCodeBlock(roster.joinCode) : null;
  const namesMode = picker === 'names' || picker === 'initials';
  const presenterLocale = uiLocale ?? locale;

  const deckFor = (r: Roster) =>
    buildDeck({
      title,
      blocks,
      options: { romanization, strokeGuide, sound, uiLocale: presenterLocale },
      picker: deckPicker(picker, r),
      source,
      now: new Date(),
      rng: Math.random,
    });

  const open = (): void => {
    if (!roster || !canPresent) return;
    const deck = deckFor(roster);
    const result = openPresenter(window, presenterUrl(appUrl(), deck));
    setBlocked(!result.ok);
    if (result.ok) opened.current.set(result.win, { deckId: deck.id, roster: rosterMessage(deck.id, picker, roster) });
  };

  const copy = async (): Promise<void> => {
    if (!roster || !canPresent) return;
    if (hasCode && !window.confirm(l.copyHasCode)) return;
    try {
      await navigator.clipboard.writeText(presenterUrl(appUrl(), deckFor(roster)));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const add = (block: LectureBlock): void => {
    setBlocks((current) => [...current, block]);
    setCopied(false);
  };
  const has = (match: (b: LectureBlock) => boolean): boolean => blocks.some(match);

  /** Rows without their own selects (quiz and activity rows are named by their selects). */
  const rowLabel = (block: LectureBlock): JSX.Element => {
    const content = catalogueTitle(block);
    if (content !== null) return <span>{content}</span>;
    switch (block.kind) {
      case 'revisit':
        return (
          <span>
            {l.source.revisit} <span lang="ko">{block.chars.join(' ')}</span>
          </span>
        );
      case 'jamo-set':
        return <span>{l.outline.block.letters(block.jamoIds.length)}</span>;
      case 'cards':
        return <span>{l.outline.block.cards(block.cardIds.length)}</span>;
      default:
        return <span>{l.outline.block.classCode}</span>;
    }
  };

  const rowControls = (block: LectureBlock, index: number): JSX.Element | null => {
    if (block.kind === 'quiz') {
      return (
        <select aria-label={l.outline.addQuiz.cta} value={block.rounds} style={selectStyle} onChange={(e) => setBlocks((b) => updateBlock(b, index, { ...block, rounds: Number(e.target.value) }))}>
          {QUIZ_ROUNDS.map((n) => (
            <option key={n} value={n}>
              {l.outline.block.quiz(n)}
            </option>
          ))}
        </select>
      );
    }
    if (block.kind === 'activity') {
      return (
        <>
          <select aria-label={l.outline.addActivity.cta} value={block.preset} style={selectStyle} onChange={(e) => setBlocks((b) => updateBlock(b, index, { ...block, preset: ACTIVITY_PRESETS.find((p) => p === e.target.value) ?? block.preset }))}>
            {ACTIVITY_PRESETS.map((p) => (
              <option key={p} value={p}>
                {l.activity[p]}
              </option>
            ))}
          </select>
          <select aria-label={l.outline.minutes(block.minutes)} value={block.minutes} style={selectStyle} onChange={(e) => setBlocks((b) => updateBlock(b, index, { ...block, minutes: Number(e.target.value) }))}>
            {ACTIVITY_MINUTES.map((n) => (
              <option key={n} value={n}>
                {l.outline.minutes(n)}
              </option>
            ))}
          </select>
        </>
      );
    }
    return null;
  };

  return (
    <ConsoleShell onSignOut={signOut} title={roster ? l.titleFor(roster.space.name) : l.title}>
      <Muted>
        <Link href={ROUTES.space(spaceId)}>{l.back(roster?.space.name ?? null)}</Link>
      </Muted>
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {error ? (
        <div style={sectionStyle}>
          <p style={{ margin: 0 }}>{spaceErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}

      {roster && choices ? (
        <>
          <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.xs}px` }}>{l.title}</h1>
          <Muted>{l.intro}</Muted>

          <section style={sectionStyle} aria-label={l.source.title}>
            <h2 style={h2Style}>{l.source.title}</h2>
            <label style={blockChoiceStyle}>
              <input type="radio" name="source" checked={source === 'plan'} disabled={!plan} onChange={() => choose('plan', { plan, revisit })} />
              {plan ? l.source.plan(plan.title, plan.items.length) : l.source.noPlan}
            </label>
            <label style={blockChoiceStyle}>
              <input type="radio" name="source" checked={source === 'catalogue'} onChange={() => choose('catalogue', { plan, revisit })} />
              {l.source.catalogue}
            </label>
            <label style={blockChoiceStyle}>
              <input type="radio" name="source" checked={source === 'revisit'} disabled={!revisit} onChange={() => choose('revisit', { plan, revisit })} />
              {revisit && revisit.kind === 'revisit' ? (
                <span>
                  {l.source.revisit}: <span lang="ko">{revisit.chars.join(' ')}</span>
                </span>
              ) : (
                l.source.noRevisit
              )}
            </label>
          </section>

          {source === 'catalogue' ? (
            <section style={sectionStyle} aria-label={l.catalogue.title}>
              <h2 style={h2Style}>{l.catalogue.title}</h2>
              <h3 style={{ fontSize: typography.size.body, margin: `${spacing.sm}px 0` }}>{l.catalogue.stage1}</h3>
              {stage1Episodes.map((e) => (
                <div key={e.id} style={{ marginBottom: spacing.sm }}>
                  <div style={rowStyle}>
                    <strong>{l.catalogue.line(e.titleEn, blockMinutes({ kind: 'episode', id: e.id }))}</strong>
                    <Button disabled={has((b) => b.kind === 'episode' && b.id === e.id)} onClick={() => add({ kind: 'episode', id: e.id })}>
                      {has((b) => b.kind === 'episode' && b.id === e.id) ? l.catalogue.added.cta : l.catalogue.add.cta}
                    </Button>
                  </div>
                  {e.questIds.map((qid) => {
                    const q = stage1Quests.find((x) => x.id === qid);
                    const added = has((b) => b.kind === 'quest' && b.id === qid);
                    return (
                      <div key={qid} style={{ ...rowStyle, paddingLeft: spacing.md, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
                        <span>{l.catalogue.line(q?.titleEn ?? qid, q?.estimatedMinutes ?? null)}</span>
                        <Button disabled={added} onClick={() => add({ kind: 'quest', id: qid })}>
                          {added ? l.catalogue.added.cta : l.catalogue.add.cta}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {LECTURE_STORIES.length > 0 ? <h3 style={{ fontSize: typography.size.body, margin: `${spacing.sm}px 0` }}>{l.catalogue.stories}</h3> : null}
              {LECTURE_STORIES.map((s) => {
                const added = has((b) => b.kind === 'story' && b.storyId === s.id);
                return (
                  <div key={s.id} style={rowStyle}>
                    <span>{l.catalogue.line(s.titleEn, s.minutes)}</span>
                    <Button disabled={added} onClick={() => add({ kind: 'story', storyId: s.id, checks: true })}>
                      {added ? l.catalogue.added.cta : l.catalogue.add.cta}
                    </Button>
                  </div>
                );
              })}
              {LECTURE_VOCAB_TOPICS.length > 0 ? <h3 style={{ fontSize: typography.size.body, margin: `${spacing.sm}px 0` }}>{l.catalogue.vocab}</h3> : null}
              {LECTURE_VOCAB_TOPICS.map((t) => {
                const added = has((b) => b.kind === 'vocab' && b.topicId === t.id);
                return (
                  <div key={t.id} style={rowStyle}>
                    <span>{l.catalogue.topicLine(t.titleEn, t.words)}</span>
                    <Button disabled={added} onClick={() => add({ kind: 'vocab', topicId: t.id })}>
                      {added ? l.catalogue.added.cta : l.catalogue.add.cta}
                    </Button>
                  </div>
                );
              })}
            </section>
          ) : null}

          <section style={sectionStyle} aria-label={l.outline.title}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
              <h2 style={h2Style}>{l.outline.title}</h2>
              <span style={{ color: colors.text.muted }}>{l.outline.about(aboutMinutes(blocks))}</span>
            </div>
            {blocks.length === 0 ? <Muted>{l.outline.empty}</Muted> : null}
            <ol style={{ margin: 0, paddingLeft: spacing.lg }} data-testid="lecture-outline">
              {blocks.map((block, index) => (
                <li key={`${block.kind}-${index}`} style={{ color: colors.text.secondary }}>
                  <div style={rowStyle}>
                    <span style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                      {rowControls(block, index) ?? rowLabel(block)}
                    </span>
                    <span style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
                      <span style={{ color: colors.text.muted, fontSize: typography.size.bodySm }}>{l.outline.minutes(blockMinutes(block))}</span>
                      <button type="button" aria-label={l.outline.up} disabled={index === 0} onClick={() => setBlocks((b) => moveBlock(b, index, index - 1))} style={{ ...rowButtonStyle, opacity: index === 0 ? 0.5 : 1 }}>
                        ↑
                      </button>
                      <button type="button" aria-label={l.outline.down} disabled={index === blocks.length - 1} onClick={() => setBlocks((b) => moveBlock(b, index, index + 1))} style={{ ...rowButtonStyle, opacity: index === blocks.length - 1 ? 0.5 : 1 }}>
                        ↓
                      </button>
                      <button type="button" onClick={() => setBlocks((b) => b.filter((_, i) => i !== index))} style={rowButtonStyle}>
                        {l.outline.remove}
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <Button onClick={() => add({ kind: 'quiz', from: 'previous', rounds: 5 })}>{l.outline.addQuiz.cta}</Button>
              <Button onClick={() => add({ kind: 'activity', preset: 'say-together', minutes: 3 })}>{l.outline.addActivity.cta}</Button>
              {codeBlock ? (
                <Button disabled={hasCode} onClick={() => add(codeBlock)}>
                  {l.outline.addClassCode.cta}
                </Button>
              ) : null}
            </div>
          </section>

          <section style={sectionStyle} aria-label={l.options.title}>
            <h2 style={h2Style}>{l.options.title}</h2>
            <div style={rowStyle}>
              <span>{l.options.romanization}</span>
              <span>
                <label style={choiceStyle}>
                  <input type="radio" name="romanization" checked={romanization === 'always'} onChange={() => setRomanization('always')} />
                  {l.options.romanizationAlways}
                </label>
                <label style={choiceStyle}>
                  <input type="radio" name="romanization" checked={romanization === 'tap'} onChange={() => setRomanization('tap')} />
                  {l.options.romanizationTap}
                </label>
              </span>
            </div>
            <label style={blockChoiceStyle}>
              <input type="checkbox" checked={strokeGuide} onChange={(e) => setStrokeGuide(e.target.checked)} />
              {l.options.strokeGuide}
            </label>
            <Muted>{l.options.strokeNote}</Muted>
            <label style={blockChoiceStyle}>
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
              {l.options.sound}
            </label>
            {available.length > 1 ? (
              <label style={blockChoiceStyle}>
                <span>{l.options.language}</span>
                <select value={presenterLocale} style={selectStyle} onChange={(e) => setUiLocale(available.find((a) => a === e.target.value) ?? null)}>
                  {available.map((option) => (
                    <option key={option} value={option} lang={LOCALE_META[option].htmlLang}>
                      {LOCALE_META[option].endonym}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>

          <section style={sectionStyle} aria-label={l.picker.title}>
            <h2 style={h2Style}>{l.picker.title}</h2>
            {choices.offered.map((mode) => (
              <label key={mode} style={choiceStyle}>
                <input type="radio" name="picker" checked={picker === mode} onChange={() => setPicker(mode)} />
                {l.picker.mode[mode]}
              </label>
            ))}
            {roster.space.settings.anonymizeRoster ? <Muted>{l.picker.hidden}</Muted> : null}
            {namesMode ? <Notice>{l.picker.privacy}</Notice> : null}
          </section>

          <section style={sectionStyle} aria-label={l.titleField.label}>
            <Field name="title" label={l.titleField.label} value={title} onChange={(v) => setTitle(v)} placeholder={l.titleField.placeholder} maxLength={60} required />
            <Muted>{l.titleField.hint}</Muted>
            {title.trim().length > 0 && problem !== null ? (
              <p role="alert" style={{ color: colors.text.primary, backgroundColor: colors.feedback.nudgeLight, borderRadius: radii.md, padding: spacing.sm, margin: 0 }}>
                {l.titleProblem[problem]}
              </p>
            ) : null}
          </section>

          <section style={sectionStyle} aria-label={l.check.title}>
            <h2 style={h2Style}>{l.check.title}</h2>
            <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
              <li>{l.check.offline}</li>
              <li>{l.check.voice}</li>
              <li>{l.check.screen}</li>
              <li>{l.check.progress}</li>
              <li>{l.check.prepare}</li>
            </ul>
          </section>

          {blocked ? <Notice tone="nudge">{l.popupBlocked}</Notice> : null}
          {blocks.length === 0 ? <Muted>{l.nothing}</Muted> : null}
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button tone="primary" disabled={!canPresent} onClick={open} testId="open-presenter">
              {l.open.cta}
            </Button>
            <Button disabled={!canPresent} onClick={() => void copy()} testId="copy-presenter-link">
              {copied ? l.copied.cta : l.copyLink.cta}
            </Button>
          </div>
          {namesMode ? <Muted>{l.copyNoNames}</Muted> : null}
        </>
      ) : null}
    </ConsoleShell>
  );
}

export default function LecturePage(): JSX.Element {
  return (
    <Suspense fallback={<ConsoleShell>{null}</ConsoleShell>}>
      <LectureInner />
    </Suspense>
  );
}
