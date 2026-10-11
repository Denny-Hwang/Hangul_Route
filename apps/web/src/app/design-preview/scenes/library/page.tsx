import { HOYA_POSES, SCENE_ART_REGISTRY, type ItemDef } from '@hangul-route/design-system/scene-art';
import { SceneSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, spacing, typography } from '@hangul-route/design-system/tokens';
import type { Metadata } from 'next';
import { HoyaSvg } from '../../../../components/design-preview/HoyaReference';
import { FindingList, PreviewShell, ReviewChecklist, StatRow, Swatches, Tag, artFrame, frame, mono, muted } from '../../../../components/design-preview/sheet-ui';
import { buildLibrary, previewScene, type LibraryEntry } from '../../../../lib/scene-sheet/library';

/**
 * /design-preview/scenes/library — every scene-art setting, prop and Hoya pose
 * (F-STORY-002 §3.9.6) at full size, at 96 px and as the thumb variant, with
 * the facts a reviewer checks: kind, box, colour tokens, shape count, bytes,
 * source and accuracy note. Hoya's data port stands beside the shipped
 * component for the parity check. Not linked from the landing page; noindex.
 */
export const metadata: Metadata = {
  title: 'Scene-art library · design preview',
  robots: { index: false, follow: false },
};

const FULL = 320;
const SMALL = 96;

function Render({ item, width, variant = 'full', label }: { item: ItemDef; width: number; variant?: 'full' | 'thumb'; label: string }): JSX.Element {
  const { art, registry } = previewScene(item, SCENE_ART_REGISTRY);
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ ...artFrame, width: 'fit-content' }}>
        <SceneSvg art={art} registry={registry} width={width} variant={variant} />
      </div>
      <figcaption style={{ ...muted, marginTop: spacing.xxs }}>{label}</figcaption>
    </figure>
  );
}

function Facts({ entry }: { entry: LibraryEntry }): JSX.Element {
  const row = (k: string, v: JSX.Element | string | number): JSX.Element => (
    <tr key={k}>
      <th style={{ textAlign: 'left', verticalAlign: 'top', paddingRight: spacing.md, color: colors.text.muted, fontWeight: 400, ...mono }}>{k}</th>
      <td style={{ fontSize: typography.size.bodySm, color: colors.text.primary, paddingBottom: spacing.xs }}>{v}</td>
    </tr>
  );
  return (
    <table style={{ borderCollapse: 'collapse' }}>
      <tbody>
        {row('kind', `${entry.kind} · z ${entry.z}`)}
        {row('box', `${entry.box.w} x ${entry.box.h}`)}
        {row('colours', <Swatches tokens={entry.colors} />)}
        {entry.tintable ? row('tintable', <code style={mono}>{entry.tintable}</code>) : null}
        {row('size', `${entry.shapes} shapes · ${entry.bytes} bytes`)}
        {row('alt', entry.alt)}
        {entry.sourceRef
          ? row(
              'source',
              <a href={entry.sourceRef.url} rel="noreferrer noopener" target="_blank" style={{ color: colors.brand.secondary }}>
                {`${entry.sourceRef.title} (${entry.sourceRef.publisher}, accessed ${entry.sourceRef.accessed})`}
              </a>,
            )
          : null}
        {entry.accuracyNote ? row('accuracy', entry.accuracyNote) : null}
        {row('findings', <FindingList findings={entry.findings} />)}
      </tbody>
    </table>
  );
}

function ItemCard({ entry }: { entry: LibraryEntry }): JSX.Element {
  const item = SCENE_ART_REGISTRY[entry.id]!;
  return (
    <article data-testid="library-item" data-item={entry.id} style={{ ...frame, padding: spacing.md, display: 'grid', gap: spacing.md }}>
      <h3 style={{ margin: 0, ...mono, fontSize: typography.size.bodySm, color: colors.text.primary }}>{entry.id}</h3>
      <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Render item={item} width={FULL} label="full" />
        <Render item={item} width={SMALL} label="96 px" />
        <Render item={item} width={SMALL} variant="thumb" label="thumb" />
      </div>
      <Facts entry={entry} />
    </article>
  );
}

function Group({ id, title, entries }: { id: string; title: string; entries: readonly LibraryEntry[] }): JSX.Element {
  return (
    <section id={id} style={{ margin: `${spacing.xxl}px 0` }}>
      <h2 style={{ fontSize: typography.size.title, color: colors.text.primary, borderBottom: `${borderWidth.base}px solid ${colors.border.subtle}`, paddingBottom: spacing.sm }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 560px), 1fr))', gap: spacing.lg }}>
        {entries.map((e) => (
          <ItemCard key={e.id} entry={e} />
        ))}
      </div>
    </section>
  );
}

export default function SceneLibraryPage(): JSX.Element {
  const lib = buildLibrary(SCENE_ART_REGISTRY);
  const all = [...lib.settings, ...lib.props, ...lib.hoya];
  const findings = all.flatMap((e) => e.findings);
  return (
    <PreviewShell
      title="Scene-art library"
      links={[
        { href: '/design-preview', label: '← design preview' },
        { href: '/design-preview/scenes', label: '← story scenes' },
      ]}
      intro={
        <p style={{ margin: 0 }}>
          Every registered setting, prop and Hoya pose of the scene-art kit (<code style={mono}>SCENE_ART_REGISTRY</code>), drawn by the same renderer as the
          contact sheet. A prop is shown alone on a blank canvas, scaled to fit; its box, colours and budgets are listed beside it.
        </p>
      }
    >
      <StatRow
        items={[
          { label: 'Settings', value: lib.settings.length, testId: 'count-settings' },
          { label: 'Props', value: lib.props.length, testId: 'count-props' },
          { label: 'Hoya poses', value: lib.hoya.length, testId: 'count-hoya' },
          { label: 'Errors', value: findings.filter((f) => f.severity === 'error').length, testId: 'count-errors' },
        ]}
      />
      <ReviewChecklist />
      <Group id="settings" title="Settings" entries={lib.settings} />
      <Group id="props" title="Props" entries={lib.props} />
      <section id="hoya" style={{ margin: `${spacing.xxl}px 0` }}>
        <h2 style={{ fontSize: typography.size.title, color: colors.text.primary, borderBottom: `${borderWidth.base}px solid ${colors.border.subtle}`, paddingBottom: spacing.sm }}>Hoya: data port beside the shipped component</h2>
        <p style={{ color: colors.text.secondary, maxWidth: 900 }}>
          Left: <code style={mono}>hoyaNodes(pose)</code> as a scene layer. Right: the shipped <code style={mono}>Hoya.tsx</code> mirror from{' '}
          <code style={mono}>/design-preview</code>. They should match. Hoya&apos;s own palette is outside the prop and scene colour caps.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: spacing.lg }}>
          {lib.hoya.map((entry, i) => {
            const pose = HOYA_POSES[i]!;
            return (
              <article key={entry.id} data-testid="hoya-pose" data-pose={pose} style={{ ...frame, padding: spacing.md, display: 'grid', gap: spacing.sm }}>
                <h3 style={{ margin: 0, ...mono, fontSize: typography.size.bodySm }}>
                  {entry.id} <Tag>palette exempt</Tag>
                </h3>
                <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-end' }}>
                  <Render item={SCENE_ART_REGISTRY[entry.id]!} width={160} label="data port" />
                  <figure style={{ margin: 0 }}>
                    <div style={{ ...artFrame, width: 120, justifyContent: 'center' }}>
                      <HoyaSvg pose={pose} size={102} />
                    </div>
                    <figcaption style={{ ...muted, marginTop: spacing.xxs }}>shipped</figcaption>
                  </figure>
                </div>
                <Swatches tokens={entry.colors} />
                <FindingList findings={entry.findings} />
              </article>
            );
          })}
        </div>
      </section>
    </PreviewShell>
  );
}
