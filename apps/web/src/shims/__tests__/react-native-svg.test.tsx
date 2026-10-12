import { HeritageCardArt } from '@hangul-route/design-system/components/HeritageCardArt';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from '../react-native-svg';

/**
 * The web's `react-native-svg` (aliased in next.config.js, vitest.config.ts
 * and tsconfig.json): the design system's HeritageCardArt draws the same
 * shapes as DOM SVG, so the WordArt contact sheet can review the real card
 * art at 96 and 64 px (F-VOC-002 §3.11).
 */
describe('react-native-svg on the web', () => {
  it('maps Svg to an svg element, its label to role img with aria-label and its testID to data-testid', () => {
    const html = renderToStaticMarkup(<Svg width={64} height={64} viewBox="0 0 200 200" testID="art" accessibilityLabel="rice" />);
    expect(html).toBe('<svg width="64" height="64" viewBox="0 0 200 200" data-testid="art" role="img" aria-label="rice"></svg>');
  });

  it('leaves an unlabelled Svg without a role', () => {
    expect(renderToStaticMarkup(<Svg width={8} height={8} />)).toBe('<svg width="8" height="8"></svg>');
  });

  it('maps every shape the card art uses to its DOM element, props kept', () => {
    const html = renderToStaticMarkup(
      <Svg>
        <G opacity={0.5} transform="rotate(10 50 50)">
          <Circle cx={1} cy={2} r={3} fill="red" />
          <Ellipse cx={1} cy={2} rx={3} ry={4} />
          <Line x1={0} y1={0} x2={5} y2={5} strokeLinecap="round" />
          <Path d="M0 0 L1 1" strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="0,0 1,1 2,0" />
          <Rect x={0} y={0} width={4} height={4} rx={1} />
        </G>
      </Svg>,
    );
    expect(html).toBe(
      '<svg><g opacity="0.5" transform="rotate(10 50 50)"><circle cx="1" cy="2" r="3" fill="red"></circle><ellipse cx="1" cy="2" rx="3" ry="4"></ellipse>' +
        '<line x1="0" y1="0" x2="5" y2="5" stroke-linecap="round"></line><path d="M0 0 L1 1" stroke-width="2" stroke-linejoin="round"></path>' +
        '<polygon points="0,0 1,1 2,0"></polygon><rect x="0" y="0" width="4" height="4" rx="1"></rect></g></svg>',
    );
  });

  it('renders the real HeritageCardArt of every launch reuse, each its own drawing and not the fallback', () => {
    const fallback = renderToStaticMarkup(<HeritageCardArt cardId="card:none" size={64} accessibilityLabel="x" />);
    const ids = ['rice', 'kimchi', 'kimbap', 'tiger', 'mountain', 'sea', 'moon', 'book', 'hanbok', 'seollal', 'chuseok', 'yutnori', 'gayageum'].map((c) => `card:${c}`);
    const drawn = ids.map((cardId) => renderToStaticMarkup(<HeritageCardArt cardId={cardId} size={64} accessibilityLabel="x" />));
    for (const html of drawn) {
      expect(html.startsWith('<svg width="64" height="64" viewBox="0 0 200 200"')).toBe(true);
      expect(html).not.toBe(fallback);
      expect(html).not.toMatch(/testID|accessibilityLabel|strokeWidth|<text|<image/);
    }
    expect(new Set(drawn).size).toBe(ids.length);
  });
});
