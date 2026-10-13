'use client';

import { APP_ROUTES } from '@hangul-route/content-schema';
import { LegacyRedirect } from '@/components/console/LegacyRedirect';

/**
 * `/teach/billing` on the app host (F-APP-001 A-5c, sections 3.8 and 3.13): billing moved to
 * `/account/billing` for every grown-up; old links, bookmarks and Stripe Checkout returns
 * (`?checkout=`) are forwarded there with their whole query.
 */
export default function TeachBillingRedirect(): JSX.Element {
  return <LegacyRedirect to={APP_ROUTES.billing} />;
}
