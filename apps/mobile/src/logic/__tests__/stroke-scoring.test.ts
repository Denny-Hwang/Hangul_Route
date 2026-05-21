import { describe, expect, it } from 'vitest';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../stroke-scoring';

describe('scoreTrace', () => {
  const target = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  ];

  it('returns coverage 0 and visitedDrawn=false on empty drawn', () => {
    const r = scoreTrace({ target, drawn: [] });
    expect(r.coverage).toBe(0);
    expect(r.visitedDrawn).toBe(false);
  });

  it('returns coverage 0 and visitedDrawn=false when drawn strokes are empty arrays', () => {
    const r = scoreTrace({ target, drawn: [[], []] });
    expect(r.coverage).toBe(0);
    expect(r.visitedDrawn).toBe(false);
  });

  it('returns coverage 1.0 when drawn perfectly overlaps the target', () => {
    // Densely sample the same path
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 75, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 25 },
        { x: 100, y: 50 },
        { x: 100, y: 75 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    expect(r.coverage).toBeGreaterThan(0.95);
  });

  it('returns ~0.5 coverage when drawn covers half the target', () => {
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    // Top half horizontal segment covered well; vertical leg untouched
    expect(r.coverage).toBeGreaterThan(0.35);
    expect(r.coverage).toBeLessThan(0.7);
  });

  it('respects the tolerance — drawn far outside fails', () => {
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 500, y: 500 },
        { x: 600, y: 600 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    expect(r.coverage).toBe(0);
    expect(r.visitedDrawn).toBe(true);
  });

  it('a drawing inside default tolerance passes the threshold', () => {
    // Slightly imperfect L-shape but within 24-unit tolerance throughout
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 2, y: 1 },
        { x: 20, y: 2 },
        { x: 40, y: 3 },
        { x: 60, y: 2 },
        { x: 80, y: 4 },
        { x: 100, y: 5 },
        { x: 101, y: 25 },
        { x: 100, y: 50 },
        { x: 102, y: 75 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
  });

  it('returns one coverage value per target stroke', () => {
    const multiTarget = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({
      target: multiTarget,
      drawn: [
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
      ],
    });
    expect(r.perStrokeCoverage).toHaveLength(2);
    // First stroke covered, second not
    expect(r.perStrokeCoverage[0]!).toBeGreaterThan(0.7);
    expect(r.perStrokeCoverage[1]!).toBe(0);
  });

  it('empty target returns coverage 0', () => {
    const r = scoreTrace({ target: [], drawn: [[{ x: 0, y: 0 }]] });
    expect(r.coverage).toBe(0);
    expect(r.perStrokeCoverage).toEqual([]);
  });
});
