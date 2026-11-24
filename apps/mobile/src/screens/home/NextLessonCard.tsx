import { Button, Caption, Card, ConfirmSheet, Heading, Spacer } from '@hangul-route/design-system';
import { useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { LinkButton } from '../../components/LinkButton';
import { useMessages } from '../../i18n/use-messages';
import type { HomeNextLesson } from '../../logic/placement/home-card';
import type { HeroResume } from './use-hero-resume';

/** The hero's eyebrow, which names its region. */
const HERO_EYEBROW_ID = 'home-next-lesson-eyebrow';

/**
 * The Next lesson hero (owner request 2026-10-16, item 8): F-ENT-003's one next above the three mission cards,
 * so a new learner's first card is a lesson, with its length and one full-width Start or Continue. The three
 * F-HW-001 slots below it are unchanged.
 *
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2, wireframe `home/next-lesson-resume.md`): with `resume`, a lesson
 * left in the middle, the button reads Continue whatever the learner has done (its tap is the same: the player opens the
 * saved step), and under it, so the button never moves when the read lands, one caption ("You can go on from step 3 of 5.",
 * also the button's hint) and a quiet Start again, which asks first (`ConfirmSheet`, Keep my place first and filled) and
 * then runs `onStartAgain`. Without `resume` the card is as it was.
 */
export function NextLessonCard({
  lesson,
  title,
  where,
  goal,
  week,
  resume = null,
  onStart,
  onStartAgain,
  onRoute,
}: {
  lesson: HomeNextLesson;
  title: string;
  /** "Stage 1 · Meet the Letters · lesson 1 of 3" (section 9.1); null when the lesson's place is unknown. */
  where: string | null;
  /** The weekly plan's goal line ("Goal: Stage 2 · Words"), folded in from the Home route strip; null without a plan goal. */
  goal: string | null;
  /** "Week 3 of your weekly plan"; null without a running plan. */
  week: string | null;
  /** [LR] The lesson goes on from this step (null: the plain hero). */
  resume?: HeroResume | null;
  onStart: () => void;
  /** [LR] Start again was confirmed: forget the saved run, then open the lesson (the screen's job). */
  onStartAgain?: () => void;
  /** See your Learning Route (the Route tab); null while the Learning Route is off. */
  onRoute: (() => void) | null;
}): ReactElement {
  const m = useMessages();
  const copy = m.learner.home.next;
  const [asking, setAsking] = useState(false);
  const cta = lesson.cta === 'start' && resume === null ? copy.start.cta : copy.continue.cta;
  const resumeLine = resume === null ? undefined : copy.resume.line(resume.step, resume.total);
  return (
    // A region named by its eyebrow ("Next lesson"), so a screen reader's landmarks find it (home-hero.md).
    <View testID="home-next-lesson" role="region" aria-labelledby={HERO_EYEBROW_ID}>
      <Card padding="md" elevation="card">
        <View id={HERO_EYEBROW_ID}>
          <Caption tone="secondary" weight="semibold">
            {copy.heading}
          </Caption>
        </View>
        <Spacer size="xxs" />
        <Heading level="prompt">{title}</Heading>
        {where !== null ? (
          <Caption tone="secondary" testID="home-next-lesson-where">
            {where}
          </Caption>
        ) : null}
        <Caption tone="muted">{copy.minutes(lesson.minutes)}</Caption>
        {goal !== null ? (
          <Caption tone="muted" testID="home-next-lesson-goal">
            {goal}
          </Caption>
        ) : null}
        {week !== null ? (
          <Caption tone="muted" testID="home-next-lesson-week">
            {week}
          </Caption>
        ) : null}
        <Spacer size="md" />
        {/* touchTarget.hero (96): the one big way in on Home (section 9.1). */}
        <Button
          label={cta}
          accessibilityLabel={copy.a11y(cta, title)}
          accessibilityHint={resumeLine}
          tone="primary"
          size="hero"
          fullWidth
          onPress={onStart}
          testID="home-next-lesson-start"
        />
        {resumeLine !== undefined ? (
          <>
            {/* After the button, so it never moves when the saved run is read (test 14). Secondary tone, as the where line. */}
            <Spacer size="sm" />
            <Caption tone="secondary" testID="home-next-lesson-resume">
              {resumeLine}
            </Caption>
            <View style={{ alignSelf: 'flex-start' }}>
              <LinkButton label={copy.resume.startAgain.cta} onPress={() => setAsking(true)} testID="home-next-lesson-start-again" />
            </View>
          </>
        ) : null}
        {onRoute !== null ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <LinkButton label={copy.route.cta} icon="route" onPress={onRoute} testID="home-next-lesson-route" />
          </View>
        ) : null}
      </Card>
      {resume !== null ? (
        <ConfirmSheet
          visible={asking}
          title={copy.resume.sheet.title}
          message={copy.resume.sheet.message}
          cancelLabel={copy.resume.sheet.keep.cta}
          confirmLabel={copy.resume.startAgain.cta}
          safeFilled
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onStartAgain?.();
          }}
          testID="home-start-again"
        />
      ) : null}
    </View>
  );
}
