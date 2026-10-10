import { describe, expect, it } from 'vitest';
import { strokesForJamo, type JamoStrokePoint } from '../../content/jamo-strokes';
import { scoreTrace } from '../stroke-scoring';
import { directionNudgeFor, failMessage, passMessage } from '../trace-copy';

type Pt = JamoStrokePoint;

function walk(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 0; s < steps; s++) {
      out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** What the child sees after drawing `drawn` over `jamoId` and passing. */
function messageFor(jamoId: string, drawn: Pt[][]): string {
  const target = strokesForJamo(jamoId)!;
  const r = scoreTrace({ target, drawn, checkOrder: true, checkDirection: true });
  return passMessage(r.orderCorrect ?? null, directionNudgeFor(r));
}

const LEFT_TO_RIGHT = /left-to-right/i;

describe('passMessage on closed loops', () => {
  it.each(['jamo:ieung', 'jamo:mieum', 'jamo:ieung-batchim', 'jamo:mieum-batchim'])(
    '%s drawn the skeleton way gets the praise, no nudge',
    (id) => {
      const target = strokesForJamo(id)!;
      expect(messageFor(id, target.map(walk))).toBe('Beautiful! That looks like the letter.');
    },
  );

  it.each(['jamo:ieung', 'jamo:mieum', 'jamo:ieung-batchim', 'jamo:mieum-batchim'])(
    '%s drawn round the other way never gets the left-to-right nudge',
    (id) => {
      const target = strokesForJamo(id)!;
      const reversed = target.map((s) => walk([...s].reverse()));
      const nudge = directionNudgeFor(
        scoreTrace({ target, drawn: reversed, checkDirection: true }),
      );
      expect(nudge).toBe('loop');
      const msg = messageFor(id, reversed);
      expect(msg).not.toMatch(LEFT_TO_RIGHT);
      expect(msg).toBe('Nice! Next time, try going around the other way.');
    },
  );
});

describe('passMessage on open strokes', () => {
  it('a backwards open stroke keeps the left-to-right nudge', () => {
    const target = strokesForJamo('jamo:giyeok')!;
    const msg = messageFor('jamo:giyeok', target.map((s) => walk([...s].reverse())));
    expect(msg).toBe('Nice! Try drawing left-to-right next time.');
  });

  it('a mix of a backwards open stroke and a backwards loop uses the open-stroke hint', () => {
    // ㅎ = tick + bar + circle: reverse everything.
    const target = strokesForJamo('jamo:hieut')!;
    const msg = messageFor('jamo:hieut', target.map((s) => walk([...s].reverse())));
    expect(msg).toMatch(LEFT_TO_RIGHT);
  });
});

describe('directionNudgeFor', () => {
  it('is none without direction data', () => {
    expect(directionNudgeFor({})).toBe('none');
  });
  it('is none when every direction is right', () => {
    expect(directionNudgeFor({ directionsPerTarget: [true, true], closedPerTarget: [false, true] })).toBe('none');
  });
  it('is loop when only a loop is wrong', () => {
    expect(directionNudgeFor({ directionsPerTarget: [true, false], closedPerTarget: [false, true] })).toBe('loop');
  });
  it('is open when an open stroke is wrong, even if a loop is too', () => {
    expect(directionNudgeFor({ directionsPerTarget: [false, false], closedPerTarget: [false, true] })).toBe('open');
  });
  it('treats a missing closed flag as an open stroke', () => {
    expect(directionNudgeFor({ directionsPerTarget: [false] })).toBe('open');
  });
});

describe('passMessage / failMessage precedence', () => {
  it('order beats any direction nudge', () => {
    expect(passMessage(false, 'loop')).toMatch(/top line first/);
    expect(passMessage(false, 'open')).toMatch(/top line first/);
  });
  it('failMessage coaches order only in strict mode', () => {
    expect(failMessage(true, false)).toMatch(/right order/);
    expect(failMessage(false, false)).toBe('Try again — start at the top!');
    expect(failMessage(true, true)).toBe('Try again — start at the top!');
  });
});
