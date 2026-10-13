import type { MetadataRoute } from 'next';
import { siteRobots } from '../lib/site-surface';

/** `out/robots.txt` (F-SITE-002 §3.10, S-9). Static, as the site is a static export. */
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return siteRobots();
}
