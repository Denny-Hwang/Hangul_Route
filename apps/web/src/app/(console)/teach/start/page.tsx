'use client';

import { APP_ROUTES } from '@hangul-route/content-schema';
import { LegacyRedirect } from '@/components/console/LegacyRedirect';

/**
 * `/teach/start` on the app host (F-APP-001 A-4b, sections 3.7 and 3.13): the first-space page
 * moved to `/start`; old links and bookmarks are forwarded there with their query.
 */
export default function TeachStartRedirect(): JSX.Element {
  return <LegacyRedirect to={APP_ROUTES.start} />;
}
