import { GROWN_UP_PREFIXES, SHELL_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { bounceFor } from '../bounce';

/**
 * F-APP-001 section 3.4, bounce rule (A-6): a learner bundle that boots on a grown-up path (the
 * host's single-page fallback answered a URL with no file) sends the tab to the persona entry of
 * the prefix: `/parent*` to `/parent`, `/teach*` to `/teach`, anything else to `/signin`.
 */
describe('bounceFor', () => {
  it('maps every grown-up prefix to its persona entry, with the telemetry prefix code', () => {
    expect(bounceFor('/parent/space/zzz')).toEqual({ prefix: 'parent', target: '/parent' });
    expect(bounceFor('/teach/does-not-exist')).toEqual({ prefix: 'teach', target: '/teach' });
    expect(bounceFor('/teach/space/zzz')).toEqual({ prefix: 'teach', target: '/teach' });
    expect(bounceFor('/signin/x')).toEqual({ prefix: 'signin', target: '/signin' });
    expect(bounceFor('/start/x')).toEqual({ prefix: 'start', target: '/signin' });
    expect(bounceFor('/start')).toEqual({ prefix: 'start', target: '/signin' });
    expect(bounceFor('/account/zzz')).toEqual({ prefix: 'account', target: '/signin' });
    expect(bounceFor('/account/billing')).toEqual({ prefix: 'account', target: '/signin' });
    expect(bounceFor('/teach.html')).toEqual({ prefix: 'teach', target: '/teach' });
    expect(bounceFor('/parent.txt')).toEqual({ prefix: 'parent', target: '/parent' });
  });

  it('never bounces a path to itself, so a host without the console page cannot loop', () => {
    for (const pathname of ['/parent', '/parent/', '/teach', '/teach/', '/signin', '/signin/']) {
      expect(bounceFor(pathname), pathname).toBeNull();
    }
  });

  it('leaves learner paths, learner roots and near misses alone', () => {
    for (const pathname of ['/', '', '/browse', '/present', '/teacher', '/parents', '/billing', '/Teach/x', '/x/teach', '/index.html']) {
      expect(bounceFor(pathname), pathname).toBeNull();
    }
  });

  it('keeps the query keys an entry reads (persona, as, lang) and drops the rest', () => {
    expect(bounceFor('/start', '?persona=teacher&lang=ko&next=%2Fx')).toEqual({ prefix: 'start', target: '/signin?persona=teacher&lang=ko' });
    expect(bounceFor('/teach/zzz', '?as=parent&id=sp_1')).toEqual({ prefix: 'teach', target: '/teach?as=parent' });
    expect(bounceFor('/parent/space', '?id=sp_1&learner=lr_1')).toEqual({ prefix: 'parent', target: '/parent' });
    expect(bounceFor('/account/billing', '')).toEqual({ prefix: 'account', target: '/signin' });
  });

  it('every prefix code is one the Worker keeps for shell.path_bounced', () => {
    const allowed = SHELL_TELEMETRY_PAYLOADS['shell.path_bounced']?.prefix ?? [];
    for (const prefix of GROWN_UP_PREFIXES) {
      const bounce = bounceFor(`${prefix}/zzz`);
      expect(bounce, prefix).not.toBeNull();
      expect(allowed).toContain(bounce?.prefix);
    }
  });
});
