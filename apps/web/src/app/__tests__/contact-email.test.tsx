import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL } from '../../data/contact';
import AboutPage from '../about/page';
import HomePage from '../page';
import PrivacyPage from '../privacy/page';
import TermsPage from '../terms/page';

/**
 * Contact address (owner decision 2026-10-10): every public page shows the one
 * real mailbox, hello@hangulroute.com — the address /teach/billing already
 * uses. The privacy policy promises an answer, so the address must receive
 * mail: Cloudflare Email Routing for it is docs/launch/owner-runbook.md Step 13.
 */
const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

const pages: ReadonlyArray<[string, string]> = [
  ['landing footer', textOf(renderToStaticMarkup(<HomePage />))],
  ['about', textOf(renderToStaticMarkup(<AboutPage />))],
  ['privacy', textOf(renderToStaticMarkup(<PrivacyPage />))],
  ['terms', textOf(renderToStaticMarkup(<TermsPage />))],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('contact address', () => {
  it('is hello@hangulroute.com', () => {
    expect(CONTACT_EMAIL).toBe('hello@hangulroute.com');
  });

  for (const [name, text] of pages) {
    it(`${name} shows it, and no other address`, () => {
      expect(text).toContain(CONTACT_EMAIL);
      expect([...new Set(text.match(EMAIL_RE) ?? [])]).toEqual([CONTACT_EMAIL]);
    });
  }

  it('the owner runbook has the step that makes the address receive mail (Email Routing)', () => {
    const runbook = readFileSync(join(appDir, '..', '..', '..', '..', 'docs', 'launch', 'owner-runbook.md'), 'utf8');
    const step = /### Step 13\. [^\n]*Email Routing[^\n]*\n([\s\S]*?)(?=\n## |\n### |$)/.exec(runbook)?.[1] ?? '';
    expect(step).toContain(CONTACT_EMAIL);
    expect(step).toContain('Verified');
  });

  it('no page source still carries a @hangulroute.example placeholder address', () => {
    const offenders = sourceFiles(appDir).filter((file) => /@hangulroute\.example/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => file.slice(appDir.length))).toEqual([]);
  });
});
