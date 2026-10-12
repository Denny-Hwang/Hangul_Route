'use client';

import { borderWidth, colors, spacing } from '@hangul-route/design-system/tokens';
import { PIP_SIZE, cursorMarkerParts, markerBand, pipInk, pipParts, type PipPart } from '@hangul-route/design-system/pip-geometry';
import type { CSSProperties } from 'react';
import type { RosterSummary } from '@/lib/console/api';
import { journeyStrip, type JourneySegment } from '@/lib/console/journey-strip';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The journey strip on a roster card (F-ROUTE-001 section 3.12, R-9a; wireframe
 * `design/wireframes/console/roster.md` "Journey strip"): "Learning Route" (LR-1), seven drawn segments (one
 * per stage, the My route shape vocabulary of `design/components/PipRow/spec.md`), "On Stage N",
 * and a `<details>` with one line per stage. The segments are decoration (`aria-hidden`); a
 * visually hidden list carries the same facts as words. Nothing when the summary has no readable
 * journey, and never on a school space. Every word comes from the dictionary.
 */

const SIZE = PIP_SIZE.stage;
const BAND = markerBand(SIZE);

/** Stage state -> drawn parts. Every state differs in geometry, not only in ink (spec section 3.14). */
function segmentParts(segment: JourneySegment): PipPart[] {
  switch (segment.state) {
    case 'complete':
      return pipParts('done', SIZE);
    case 'known':
      return pipParts('known', SIZE);
    case 'explored':
      // The check of a done pip without its disc: explored is never drawn as complete.
      return pipParts('done', SIZE).filter((part) => part.kind === 'path');
    case 'open':
      return pipParts('open', SIZE);
    case 'later':
      return pipParts('later', SIZE);
  }
}

function Part({ part, accent }: { part: PipPart; accent: string }): JSX.Element {
  const stroke = part.stroke === undefined ? undefined : pipInk(part.stroke, accent);
  if (part.kind === 'circle') {
    return (
      <circle
        cx={part.cx}
        cy={part.cy}
        r={part.r}
        fill={pipInk(part.fill, accent)}
        stroke={stroke}
        strokeWidth={part.strokeWidth}
        strokeDasharray={part.dash === undefined ? undefined : part.dash.join(' ')}
      />
    );
  }
  return <path d={part.d} fill={pipInk(part.fill, accent)} stroke={stroke} strokeWidth={part.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
}

/** One segment: the cursor marker band on top (drawn only on the stage the learner is on), the shape below. */
function Segment({ segment }: { segment: JourneySegment }): JSX.Element {
  const accent = colors.stage[segment.stage];
  return (
    <svg width={SIZE} height={SIZE + BAND} viewBox={`0 0 ${SIZE} ${SIZE + BAND}`} focusable="false">
      {segment.here ? cursorMarkerParts(SIZE).map((part, i) => <Part key={`m${i}`} part={part} accent={accent} />) : null}
      <g transform={`translate(0 ${BAND})`}>
        {segmentParts(segment).map((part, i) => (
          <Part key={i} part={part} accent={accent} />
        ))}
      </g>
    </svg>
  );
}

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: borderWidth.thin,
  height: borderWidth.thin,
  margin: -borderWidth.thin,
  padding: spacing.none,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: spacing.none,
};

export function JourneyStrip({ kind, summary }: { kind: string; summary: Pick<RosterSummary, 'journey'> | null }): JSX.Element | null {
  const { locale } = useConsoleLocale();
  const strip = journeyStrip(kind, summary?.journey, locale);
  if (strip === null) return null;
  return (
    <div data-testid="journey-strip" style={{ position: 'relative', margin: `${spacing.xxs}px 0` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: spacing.sm, rowGap: spacing.xxs }}>
        <span>{strip.title}</span>
        <span data-testid="journey-segments" aria-hidden="true" style={{ display: 'inline-flex', gap: spacing.xs, lineHeight: 0 }}>
          {strip.segments.map((segment) => (
            <Segment key={segment.stage} segment={segment} />
          ))}
        </span>
        {strip.onStage ? <span>{strip.onStage}</span> : null}
      </div>
      <ul data-testid="journey-words" style={visuallyHidden}>
        {strip.segments.map((segment) => (
          <li key={segment.stage}>{segment.text}</li>
        ))}
      </ul>
      <details>
        <summary style={{ cursor: 'pointer', paddingBlock: spacing.xxs }}>{strip.details}</summary>
        <ul style={{ margin: `${spacing.xxs}px 0 0`, paddingLeft: spacing.lg }}>
          {strip.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
