import { SCENE_ART_REGISTRY } from '@hangul-route/design-system/scene-art';
import { SceneSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { Metadata } from 'next';
import { SheetView, type ThumbStory } from '../../../components/design-preview/SheetView';
import { FindingList, PreviewShell, ReviewChecklist, StatRow, Tag, artFrame, frame, mono, muted } from '../../../components/design-preview/sheet-ui';
import { readStoryFiles } from '../../../lib/scene-sheet/read-stories';
import { buildSceneSheet, type SheetScene, type SheetStory } from '../../../lib/scene-sheet/sheet';

/**
 * /design-preview/scenes — the story-art contact sheet (F-STORY-002 §3.9.6).
 * Reads content/stories/*.json at build time (drafts included and marked) and
 * draws every scene with the plain-DOM scene-art renderer, beside its brief,
 * its narration and cited facts, its layers and its findings. Not linked from
 * the landing page; noindex.
 */
export const metadata: Metadata = {
  title: 'Story scenes · design preview',
  robots: { index: false, follow: false },
};

const RENDER_WIDTH = 320;
const TALE_ORIGINS = new Set(['traditional', 'adapted']);

function ArtStatus({ scene }: { scene: SheetScene }): JSX.Element {
  if (scene.art) return <span style={muted}>{scene.art.setting}</span>;
  return <Tag tone="draft">{scene.artPending ? 'art pending' : 'no art yet'}</Tag>;
}

function Narration({ scene }: { scene: SheetScene }): JSX.Element {
  return (
    <p style={{ margin: 0, lineHeight: typography.leading.relaxed }}>
      {scene.narration.map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span key={i} data-kw style={{ display: 'inline-block', padding: `0 ${spacing.xs}px`, borderRadius: radii.sm, backgroundColor: colors.brand.primaryLight, color: colors.text.primary }}>
            <span lang="ko">{part.ko}</span> <em>{part.romanization}</em> · {part.en}
          </span>
        ),
      )}
    </p>
  );
}

function SceneRow({ story, scene }: { story: SheetStory; scene: SheetScene }): JSX.Element {
  const cell = { minWidth: 0, fontSize: typography.size.bodySm, color: colors.text.primary } as const;
  return (
    <article
      data-testid="scene-row"
      data-scene={scene.key}
      style={{ display: 'grid', gridTemplateColumns: `${RENDER_WIDTH}px repeat(4, minmax(200px, 1fr))`, gap: spacing.lg, padding: `${spacing.md}px 0`, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}
    >
      <div style={cell}>
        <div style={{ ...artFrame, width: 'fit-content' }}>
          <SceneSvg art={scene.art} theme={story.theme} width={RENDER_WIDTH} />
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs }}>
          <strong style={mono}>{scene.level === 'listen' ? scene.id : `${scene.level} ${scene.id}`}</strong>
          <ArtStatus scene={scene} />
        </div>
        {scene.art ? <p style={{ ...muted, margin: `${spacing.xs}px 0 0` }}>alt: {scene.art.altEn}</p> : null}
      </div>
      <div style={cell}>
        <h4 style={{ ...muted, margin: `0 0 ${spacing.xs}px` }}>Brief</h4>
        <p style={{ margin: 0 }}>{scene.brief ?? '(no brief)'}</p>
      </div>
      <div style={cell}>
        <h4 style={{ ...muted, margin: `0 0 ${spacing.xs}px` }}>Narration and evidence</h4>
        <Narration scene={scene} />
        <ul style={{ margin: `${spacing.sm}px 0 0`, paddingLeft: spacing.lg, display: 'grid', gap: spacing.xs }}>
          {scene.facts.map((f) => (
            <li key={f.id} style={{ fontSize: typography.size.caption, color: colors.text.secondary }}>
              <code style={mono}>{f.id}</code> {f.claimEn} <span style={{ color: colors.text.muted }}>({f.sources.join('; ')})</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={cell}>
        <h4 style={{ ...muted, margin: `0 0 ${spacing.xs}px` }}>Layers</h4>
        {scene.layers.length === 0 ? (
          <p style={{ ...muted, margin: 0 }}>None</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', ...mono }}>
            <thead>
              <tr>
                {['ref', 'x', 'y', 's', 'z'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', paddingRight: spacing.sm, color: colors.text.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scene.layers.map((l, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: spacing.sm, whiteSpace: 'nowrap' }}>{l.ref}</td>
                  <td style={{ paddingRight: spacing.sm }}>{l.x}</td>
                  <td style={{ paddingRight: spacing.sm }}>{l.y}</td>
                  <td style={{ paddingRight: spacing.sm }}>{l.s}</td>
                  <td>{l.z}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={cell}>
        <h4 style={{ ...muted, margin: `0 0 ${spacing.xs}px` }}>Findings</h4>
        <FindingList findings={scene.findings} />
      </div>
    </article>
  );
}

function StoryHeader({ story }: { story: SheetStory }): JSX.Element {
  return (
    <header>
      <h2 style={{ fontSize: typography.size.title, color: colors.text.primary, margin: 0 }}>
        {story.titleEn} <span lang="ko" style={{ fontSize: typography.size.bodyLg, color: colors.text.secondary, fontWeight: 400 }}>{story.titleKo}</span>
      </h2>
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center', margin: `${spacing.sm}px 0` }}>
        <Tag tone={story.state === 'ready' ? 'ready' : 'draft'}>{story.state}</Tag>
        <Tag>{story.kind}</Tag>
        <Tag tone={TALE_ORIGINS.has(story.origin) ? 'tale' : 'plain'}>{story.origin}</Tag>
        <Tag>{`verification passes: ${story.passes}`}</Tag>
        <code style={muted}>{story.file}</code>
      </div>
      {story.findings.length > 0 ? (
        <details style={{ margin: `${spacing.xs}px 0 ${spacing.sm}px` }}>
          <summary style={{ ...muted, cursor: 'pointer' }}>{`Story findings (${story.findings.length})`}</summary>
          <FindingList findings={story.findings} />
        </details>
      ) : null}
    </header>
  );
}

export default function ScenesPreviewPage(): JSX.Element {
  const sheet = buildSceneSheet(readStoryFiles(), SCENE_ART_REGISTRY);
  const { counts } = sheet;
  const rows = sheet.stories.map((story) => (
    <section key={story.id} data-testid="story-section" id={story.id.replace('story:', '')} style={{ margin: `${spacing.xxl}px 0`, overflowX: 'auto' }}>
      <StoryHeader story={story} />
      {story.scenes.map((scene) => (
        <SceneRow key={scene.key} story={story} scene={scene} />
      ))}
    </section>
  ));
  const thumbs: ThumbStory[] = sheet.stories.map((story) => ({
    id: story.id,
    titleEn: story.titleEn,
    theme: story.theme,
    scenes: story.scenes.map((scene) => ({ key: scene.key, id: scene.id, ...(scene.art ? { art: scene.art } : {}) })),
  }));

  return (
    <PreviewShell
      title="Story scenes: contact sheet"
      links={[
        { href: '/design-preview', label: '← design preview' },
        { href: '/design-preview/scenes/library', label: 'Scene-art library →' },
      ]}
      intro={
        <p style={{ margin: 0 }}>
          Every scene of every story in <code style={mono}>content/stories</code>, drafts included, drawn from its <code style={mono}>art</code> data with the
          scene-art kit (F-STORY-002 §3.9). Each row shows the picture, the illustration brief, the narration with the facts it cites, the layers and the
          findings of <code style={mono}>checkScene</code> and <code style={mono}>lintStory</code>. Scenes without art show the tinted fallback panel the
          reader uses.
        </p>
      }
    >
      <StatRow
        items={[
          { label: 'Stories', value: counts.stories, testId: 'count-stories' },
          { label: 'Scenes', value: counts.scenes, testId: 'count-scenes' },
          { label: 'With art', value: counts.withArt, testId: 'count-with-art' },
          { label: 'Art pending', value: counts.artPending, testId: 'count-art-pending' },
          { label: 'Draft stories', value: counts.draft, testId: 'count-draft' },
          { label: 'Errors', value: counts.errors, testId: 'count-errors' },
          { label: 'Warnings', value: counts.warnings, testId: 'count-warnings' },
        ]}
      />
      <ReviewChecklist />
      {sheet.failed.length > 0 ? (
        <section style={{ ...frame, padding: spacing.md }}>
          <h2 style={{ fontSize: typography.size.bodyLg, margin: 0 }}>Files that did not load</h2>
          <FindingList findings={sheet.failed.map((f) => ({ rule: f.file, severity: 'error' as const, message: f.message }))} />
        </section>
      ) : null}
      <SheetView rows={rows} thumbs={thumbs} />
    </PreviewShell>
  );
}
