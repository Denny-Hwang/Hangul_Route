'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { SpaceKind } from '@hangul-route/content-schema';
import { Button, ConsoleShell, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { SpaceListItem } from '@/lib/console/api';
import { COPY } from '@/lib/console/copy';
import { KIND_GROUP, ROUTES, groupSpaces, statusLine } from '@/lib/console/routing';

const ORDER: SpaceKind[] = ['family', 'class', 'school'];

/** console/home — F-CONSOLE-001 §3.4. Counts only; no names, no percentages. */
export default function HomePage(): JSX.Element {
  const { ready, session, api, signOut } = useConsole();
  const [items, setItems] = useState<SpaceListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setFailed(false);
    const result = await api.listSpaces();
    if (result.ok) setItems(result.data);
    else setFailed(true);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;
  const groups = items ? groupSpaces(items) : null;

  return (
    <ConsoleShell onSignOut={signOut} title={`Hi, ${session.displayName}`}>
      {!api ? <Notice tone="nudge">The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.</Notice> : null}
      {failed ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{COPY.cantReach}</p>
          <Muted>{items ? 'Showing the last list we loaded.' : ''}</Muted>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}
      {groups && items?.length === 0 && !failed ? (
        <div style={{ ...panelStyle, textAlign: 'center' }}>
          <p style={{ margin: `0 0 ${spacing.md}px` }}>{COPY.noSpaces}</p>
          <Link href={`${ROUTES.start}?from=home`}>
            <Button tone="primary">{COPY.createSpace}</Button>
          </Link>
        </div>
      ) : null}
      {groups
        ? ORDER.filter((kind) => groups[kind].length > 0).map((kind) => (
            <section key={kind} style={{ marginBottom: spacing.xl }}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{KIND_GROUP[kind]}</h2>
              <div style={{ display: 'grid', gap: spacing.sm }}>
                {groups[kind].map((item) => (
                  <article key={item.space.id} style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, opacity: item.space.archivedAt ? 0.6 : 1 }}>
                    <div>
                      <div style={{ fontWeight: typography.weight.bold }}>
                        {item.space.name}
                        {item.space.archivedAt ? <span style={{ color: colors.text.muted }}> (archived)</span> : null}
                      </div>
                      <div style={{ color: colors.text.secondary, fontSize: typography.size.bodySm }}>{statusLine(item)}</div>
                    </div>
                    <Link href={ROUTES.space(item.space.id)}>
                      <Button>Open →</Button>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))
        : null}
      {items ? (
        <Link href={`${ROUTES.start}?from=home`}>
          <Button>+ New space</Button>
        </Link>
      ) : null}
    </ConsoleShell>
  );
}
