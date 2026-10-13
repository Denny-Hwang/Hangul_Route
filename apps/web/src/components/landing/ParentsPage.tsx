import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { learnerStart, signIn } from '../../lib/site-links';
import { sitePath } from '../../lib/site-path';
import { SiteShell } from './SiteShell';
import { Body, Bullets, Closing, Fold, Folds, Lines, PageHead, PlansBlock, PrimaryAction, SecondaryAction, Section, TextLink, TwoColumns } from './site-parts';

export interface ParentsPageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * `/parents`, the page for parents, grandparents and every caregiver (F-SITE-002 §3.5, appendix B.3; wireframe
 * design/wireframes/site/parents.md; mock design/screens/site/persona-page.md). Primary action Sign in as a parent
 * (the parent sign-in intro through `site-links`, never the teacher router), secondary Start learning. On wide screens What they
 * learn and Safe by design sit left, Follow along and Plans right. Follow along adds one line per live claim; the
 * browse line also needs paid plans on sale (`showsClaim`). No price, no ranking, no age range.
 */
export function ParentsPage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: ParentsPageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const P = t.persona.parents;
  const parentSignIn = signIn('parent');
  const follow = [
    P.follow.body,
    ...(showsClaim(claims, 'parentReports', locale) ? [P.follow.reports] : []),
    ...(showsClaim(claims, 'learningRoute', locale) ? [P.follow.route] : []),
    ...(showsClaim(claims, 'feedbackNotes', locale) ? [P.follow.notes] : []),
    ...(showsClaim(claims, 'browseAsLearner', locale) ? [P.follow.browse] : []),
  ];
  const whatSee = showsClaim(claims, 'parentReports', locale) ? P.faq.whatSee.reports : P.faq.whatSee.a;
  return (
    <SiteShell locale={locale} page="/parents" current="parents">
      <PageHead title={P.title} lead={P.lead}>
        <PrimaryAction href={parentSignIn}>{P.signIn}</PrimaryAction>
        <SecondaryAction href={learnerStart(locale)}>{t.nav.start}</SecondaryAction>
      </PageHead>

      <TwoColumns
        left={
          <>
            <Section id="parents-learn" title={P.learn.title}>
              <Body>{P.learn.body}</Body>
              <TextLink href={sitePath(locale, '/learners')}>{P.learn.link}</TextLink>
            </Section>
            <Section id="parents-safe" title={P.safe.title}>
              <Bullets items={[P.safe.bullets.ads, P.safe.bullets.backup, P.safe.bullets.gate, P.safe.bullets.siblings]} />
            </Section>
          </>
        }
        right={
          <>
            <Section id="parents-follow" title={P.follow.title}>
              <Lines items={follow} />
            </Section>
            <PlansBlock id="parents-plans" locale={locale} claims={claims} />
          </>
        }
      />

      <Section id="parents-faq" title={t.persona.faqTitle} hiddenTitle>
        <Folds>
          {[P.faq.account, P.faq.learnAlong, { q: P.faq.whatSee.q, a: whatSee }].map(({ q, a }) => (
            <Fold key={q} summary={q}>
              <p style={{ margin: 0 }}>{a}</p>
            </Fold>
          ))}
        </Folds>
      </Section>

      <Closing id="parents-closing" line={t.persona.closing.parents}>
        <PrimaryAction href={parentSignIn}>{P.signIn}</PrimaryAction>
      </Closing>
    </SiteShell>
  );
}
