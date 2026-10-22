import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { learnerStart, signIn } from '../../lib/site-links';
import { SiteShell } from './SiteShell';
import { Bullets, Closing, Fold, Folds, Lines, PageHead, PlansBlock, PrimaryAction, SecondaryAction, Section, Steps, TwoColumns } from './site-parts';

export interface TeachersPageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * `/teachers` (F-SITE-002 §3.6, appendix B.4; wireframe design/wireframes/site/teachers.md; mock
 * design/screens/site/persona-page.md, same parts). Primary action Sign in as a teacher (the teacher
 * sign-in intro through `site-links`), secondary Try it as a learner. Set up in minutes is three numbered steps (one
 * row on wide screens); Plan and assign and See how the class is doing sit side by side on wide screens. The class
 * section adds one line per live claim (the browse line also needs paid plans on sale). Never a ranking, no price.
 */
export function TeachersPage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: TeachersPageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const T = t.persona.teachers;
  const teacherSignIn = signIn('teacher', locale);
  const classLines = [
    T.class.body,
    ...(showsClaim(claims, 'teacherReports', locale) ? [T.class.reports] : []),
    ...(showsClaim(claims, 'learningRoute', locale) ? [T.class.route] : []),
    ...(showsClaim(claims, 'feedbackNotes', locale) ? [T.class.notes] : []),
    ...(showsClaim(claims, 'browseAsLearner', locale) ? [T.class.browse] : []),
    ...(showsClaim(claims, 'lectureMode', locale) ? [T.class.lecture] : []),
  ];
  return (
    <SiteShell locale={locale} page="/teachers" current="teachers">
      <PageHead title={T.title} lead={T.lead}>
        <PrimaryAction href={teacherSignIn}>{T.signIn}</PrimaryAction>
        <SecondaryAction href={learnerStart(locale)}>{T.tryIt}</SecondaryAction>
      </PageHead>

      <Section id="teachers-setup" title={T.setup.title}>
        <Steps wide items={[T.setup.steps.space, T.setup.steps.code, T.setup.steps.devices]} />
      </Section>

      <TwoColumns
        left={
          <Section id="teachers-plan" title={T.plan.title}>
            <Bullets items={[T.plan.bullets.pick, T.plan.bullets.planner]} />
          </Section>
        }
        right={
          <Section id="teachers-class" title={T.class.title}>
            <Lines items={classLines} />
          </Section>
        }
      />

      <Section id="teachers-privacy" title={T.privacy.title}>
        <Bullets items={[T.privacy.bullets.initials, T.privacy.bullets.ads]} />
      </Section>

      <PlansBlock id="teachers-plans" locale={locale} claims={claims} />

      <Section id="teachers-faq" title={t.persona.faqTitle} hiddenTitle>
        <Folds>
          {[T.faq.students, T.faq.ranking, T.faq.try].map(({ q, a }) => (
            <Fold key={q} summary={q}>
              <p style={{ margin: 0 }}>{a}</p>
            </Fold>
          ))}
        </Folds>
      </Section>

      <Closing id="teachers-closing" line={t.persona.closing.teachers}>
        <PrimaryAction href={teacherSignIn}>{T.signIn}</PrimaryAction>
      </Closing>
    </SiteShell>
  );
}
