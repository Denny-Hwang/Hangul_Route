import { Body, Button, Caption, Card, Heading, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import type { StageKey } from '@hangul-route/content-schema';
import { formatNumber } from '@hangul-route/i18n';
import { useEffect, useMemo, type ReactElement } from 'react';
import { View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { stageByKey } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeStage } from '../../logic/content-locale';
import { freeBytes, megabytes, stagePackRows } from '../../logic/offline/offline-packs';
import { offlinePacks, useOfflinePacks } from '../../store/offline-packs-store';

/**
 * Offline lessons (F-CURR-002 §10 item 4, row CM-5B; wireframe `design/wireframes/pwa/save-for-offline.md`, mock
 * `design/screens/app-shell/save-for-offline.md`): a card in the Grown-up area. Stage 1 and every first volume are
 * always on the device (precached); a stage's later volumes (its Volume 2, Stage 5's book 2) and its audio pack can be
 * saved here ahead of time, with their size and the space left. Draws nothing on native (everything is in the app),
 * on a web page that cannot save (no worker in control), or on a build with no later volume yet.
 * Device-wide: the caches belong to the browser, not to one learner. Problems are calm lines, never the danger tone.
 */
export function OfflineLessonsCard(): ReactElement | null {
  const m = useMessages().caregiver.dashboard.offline;
  const locale = useLocale();
  const online = useOnline();
  const status = useOfflinePacks((s) => s.status);
  const index = useOfflinePacks((s) => s.index);
  const cached = useOfflinePacks((s) => s.cached);
  const chosen = useOfflinePacks((s) => s.chosen);
  const busy = useOfflinePacks((s) => s.busy);
  const progress = useOfflinePacks((s) => s.progress);
  const problem = useOfflinePacks((s) => s.problem);
  const space = useOfflinePacks((s) => s.space);

  useEffect(() => {
    void offlinePacks.getState().init();
  }, []);

  const rows = useMemo(() => (index === null ? [] : stagePackRows(index, cached, chosen)), [index, cached, chosen]);
  if (status !== 'ready' || rows.length === 0) return null;

  const mb = (bytes: number): string => formatNumber(locale, megabytes(bytes));
  const free = freeBytes(space);
  const notSaved = rows.filter((r) => r.state !== 'saved');
  const stageLabel = (stage: StageKey): string => {
    const def = stageByKey(stage);
    const title = def ? localizeStage(def, locale).titleEn : '';
    return m.stage(Number(stage.replace('stage', '')), title);
  };

  return (
    <Card padding="md" style={{ marginBottom: spacing.lg }} testID="dashboard-offline">
      <Heading level="prompt">{m.title}</Heading>
      <Spacer size="xs" />
      <Body size="sm" tone="secondary">
        {m.line}
      </Body>
      <Caption tone="muted">{m.opened}</Caption>
      {!online ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" testID="dashboard-offline-offline">
            {m.offlineNow}
          </Caption>
        </>
      ) : null}
      <Spacer size="sm" />
      {rows.map((row) => {
        const label = stageLabel(row.stage);
        const working = busy === row.stage || busy === 'all';
        return (
          <View
            key={row.stage}
            testID={`dashboard-offline-${row.stage}`}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: touchTarget.min,
              paddingVertical: spacing.xs,
              borderBottomWidth: 1,
              borderBottomColor: colors.border.subtle,
            }}
          >
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{label}</Body>
              <Caption tone="muted" testID={`dashboard-offline-${row.stage}-state`}>
                {`${m.size(mb(row.bytes))} · ${m.state[row.state]}`}
              </Caption>
            </View>
            {row.state !== 'saved' ? (
              <Button
                label={m.save.cta}
                accessibilityLabel={`${m.save.cta}: ${label}`}
                tone="secondary"
                size="sm"
                disabled={busy !== null || !online}
                onPress={() => void offlinePacks.getState().save(row.stage)}
                testID={`dashboard-offline-${row.stage}-save`}
              />
            ) : null}
            {row.state !== 'notSaved' || row.chosen ? (
              <Button
                label={m.remove.cta}
                accessibilityLabel={`${m.remove.cta}: ${label}`}
                tone="ghost"
                size="sm"
                disabled={busy !== null || working}
                onPress={() => void offlinePacks.getState().remove(row.stage)}
                testID={`dashboard-offline-${row.stage}-remove`}
              />
            ) : null}
          </View>
        );
      })}
      {notSaved.length > 1 ? (
        <>
          <Spacer size="sm" />
          <Button
            label={m.saveAll.cta}
            tone="primary"
            size="md"
            fullWidth
            disabled={busy !== null || !online}
            onPress={() => void offlinePacks.getState().save('all')}
            testID="dashboard-offline-save-all"
          />
        </>
      ) : null}
      <View accessibilityLiveRegion="polite">
        {progress !== null ? (
          <Caption tone="secondary" testID="dashboard-offline-progress">
            {m.saving(mb(progress.done), mb(progress.total))}
          </Caption>
        ) : null}
        {problem !== null && busy === null ? (
          <Caption tone="secondary" testID="dashboard-offline-problem">
            {m.problem[problem.reason]}
          </Caption>
        ) : null}
      </View>
      {free !== null ? (
        <>
          <Spacer size="xs" />
          <Caption tone="muted" testID="dashboard-offline-space">
            {m.space(mb(free))}
          </Caption>
        </>
      ) : null}
    </Card>
  );
}
