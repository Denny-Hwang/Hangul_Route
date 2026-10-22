import { SCHOOL_ADMIN_CAP } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { CONTACT_EMAIL } from '../../data/contact';
import { showsCapture } from '../../data/site-captures';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { createAccount, learnerStart, signIn } from '../../lib/site-links';
import { cardShadow } from '../../lib/site-style';
import { SiteCapture } from './SiteCapture';
import { SiteShell } from './SiteShell';
import {
  AppTextLink,
  Bullets,
  Closing,
  ClosingActions,
  Fold,
  Folds,
  Lines,
  PageHead,
  PlansBlock,
  PrimaryAction,
  SecondaryAction,
  Section,
  Steps,
  TwoColumns,
} from './site-parts';

export interface TeachersPageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * `/teachers` (F-SITE-002 §3.6, appendix B.4, amended by AMENDMENTS-SITE-NEWUSER §3.6; wireframes
 * design/wireframes/site/teachers.md and newuser-grown-up-pages.md; mocks design/screens/site/persona-page.md and
 * design/screens/site/newuser/mock/<locale>/teachers.html). [SN] Create first: Create a free class (the create view of
 * /signin through `site-links`), secondary Try it as a learner, "Already have an account? Sign in" under them; the
 * closing block the same. Set up in minutes is three numbered steps (one row on wide screens); Plan and assign and See
 * how the class is doing sit side by side on wide screens, the class section adding one line per live claim (the
 * browse line also needs paid plans on sale). Then the media row (the class page under `teacherReports`, the Lecture
 * mode slide under `lectureMode`; one alone takes the row, none leaves no row) and "Use it across a whole school"
 * (every fact live, so no claim gates it; the administrator cap from content-schema, the address from `data/contact.ts`
 * as plain text; no school seat figure, owner decision (b) 2026-10-21). While plans are not on sale the administrators line names no plan and the size line names no product
 * (OD-SN-13). Never a ranking, no price, no plan term.
 */
export function TeachersPage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: TeachersPageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const T = t.persona.teachers;
  const create = createAccount('teacher', locale);
  const haveAccount = <AppTextLink href={signIn('teacher', locale)}>{t.persona.haveAccount}</AppTextLink>;
  const classPage = showsCapture(claims, 'class-list', locale) && showsCapture(claims, 'class-list-narrow', locale);
  const slide = showsCapture(claims, 'lecture-slide', locale);
  const S = T.schools;
  const schoolLines = [
    S.space,
    S.admins(SCHOOL_ADMIN_CAP),
    // The owner manages the plan only once plans are on sale (review round 3, T3).
    ...(claims.paidPlans === 'inApp' ? [S.ownerPlan] : []),
    S.moves,
    // OD-SN-13: `sizeContract` (naming the School Contract) waits for the owner; until then no product is named.
    // OD-SN-11 / owner decision (b) 2026-10-21: no seat figure (the school cap is also the free school limit).
    S.size(CONTACT_EMAIL),
  ];
  const classLines = [
    T.class.body,
    ...(showsClaim(claims, 'teacherReports', locale) ? [T.class.reports] : []),
    ...(showsClaim(claims, 'learningRoute', locale) ? [T.class.route] : []),
    ...(showsClaim(claims, 'feedbackNotes', locale) ? [T.class.notes] : []),
    ...(showsClaim(claims, 'browseAsLearner', locale) ? [T.class.browse] : []),
    ...(showsClaim(claims, 'lectureMode', locale) ? [T.class.lecture] : []),
  ];
  return (
    <SiteShell locale={locale} page="/teachers" current="teachers" claims={claims}>
      <PageHead title={T.title} lead={T.lead} after={haveAccount}>
        <PrimaryAction href={create}>{T.create}</PrimaryAction>
        <SecondaryAction href={learnerStart(locale, claims)}>{T.tryIt}</SecondaryAction>
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

      {classPage || slide ? (
        <div className={classPage && slide ? 'hr-site-media hr-site-media-pair' : 'hr-site-media'} style={{ paddingBottom: spacing.lg }}>
          {classPage ? (
            <figure style={{ margin: 0 }}>
              <div
                style={{
                  backgroundColor: colors.surface.paper,
                  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
                  borderRadius: radii.lg,
                  boxShadow: cardShadow(),
                  overflow: 'hidden',
                }}
              >
                <SiteCapture locale={locale} name="class-list-narrow" wide="class-list" alt={t.captures.classList} />
              </div>
            </figure>
          ) : null}
          {slide ? (
            <figure style={{ margin: 0 }}>
              <div style={{ backgroundColor: colors.text.primary, padding: spacing.sm, borderRadius: radii.lg }}>
                <SiteCapture locale={locale} name="lecture-slide" alt={t.captures.lectureSlide} style={{ borderRadius: radii.sm }} />
              </div>
            </figure>
          ) : null}
        </div>
      ) : null}

      <Section id="teachers-schools" title={S.title}>
        <ul
          role="list"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: spacing.sm, lineHeight: typography.leading.relaxed, color: colors.text.secondary }}
        >
          {schoolLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>

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
        <ClosingActions>
          <PrimaryAction href={create}>{T.create}</PrimaryAction>
          {haveAccount}
        </ClosingActions>
      </Closing>
    </SiteShell>
  );
}
