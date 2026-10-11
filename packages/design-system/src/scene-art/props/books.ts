/**
 * Book and box props (F-STORY-002 §3.9.4, PR 2.3b). Books are drawn closed:
 * covers are blank, stored books lie flat, and pages show only as edges,
 * never as text.
 */
import type { ItemDef } from '../types';

export const BOOK_THREAD_BOUND: ItemDef = {
  id: 'prop:book-thread-bound',
  kind: 'object',
  box: { w: 44, h: 60 },
  z: 'mid',
  alt: 'A closed Joseon thread-bound book with a blank cover, stitched with red thread',
  tags: { heritage: true },
  sourceRef: { title: '사침안정법 (四針眼訂法)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0080104', accessed: '2026-10-11' },
  accuracyNote:
    'A closed book bound on its right edge with red thread through five holes, the Korean way the entry describes (four holes were the norm in China and Japan). The cover is pale yellow for the gardenia-dyed thick paper the entry names; its stamped pattern is left out. The title slip sits at the upper left and is blank, and the page block is one pale bar. No title, seal or inscription is drawn.',
  nodes: [
    { t: 'ellipse', cx: 22, cy: 58, rx: 21, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 2, y: 2, w: 40, h: 54, r: 1, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'base' },
    { t: 'rect', x: 5, y: 5, w: 28, h: 48, stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'rect', x: 8, y: 8, w: 9, h: 24, fill: 'surface.paper', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M34 9 V51 M34 9 H42 M34 20 H42 M34 31 H42 M34 42 H42 M34 51 H42', stroke: 'brand.primary', sw: 'base' },
    { t: 'rect', x: 4, y: 56, w: 36, h: 2, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin' },
    { t: 'line', x1: 8, y1: 57, x2: 36, y2: 57, stroke: 'border.strong', sw: 'thin', det: true },
  ],
};

export const BOOKS_CASE: ItemDef = {
  id: 'prop:books-case',
  kind: 'object',
  box: { w: 120, h: 70 },
  z: 'mid',
  alt: 'An open wooden case holding stacks of old thread-bound books laid flat, red binding thread showing on their spines',
  tags: { heritage: true },
  sourceRef: { title: '포쇄(曝曬)', publisher: '한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', url: 'https://encykorea.aks.ac.kr/Article/E0060156', accessed: '2026-10-11' },
  accuracyNote:
    'Thread-bound books have soft paper covers and were normally kept lying flat in stacks rather than stood on end like modern books; the entry has two sheets of paper laid between the books before each set was wrapped in oiled paper and red cloth and sealed in a wooden chest with herbs. Here the case is drawn open, with two shelves, and the wrapping is left off so the viewer can see the stored books. The bound edges face out, showing the red thread of the Korean five-hole binding. Volume counts and sizes are generic.',
  nodes: [
    { t: 'ellipse', cx: 60, cy: 68, rx: 58, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 0, y: 4, w: 120, h: 60, r: 3, fill: 'text.secondary' },
    { t: 'rect', x: 5, y: 9, w: 110, h: 24, fill: 'surface.sunken' },
    { t: 'rect', x: 5, y: 37, w: 110, h: 22, fill: 'surface.sunken' },
    // top shelf: three stacks of 4, 3 and 5 volumes
    { t: 'rect', x: 9, y: 17, w: 30, h: 16, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 45, y: 21, w: 30, h: 12, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 81, y: 13, w: 30, h: 20, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M9 21 H39 M9 25 H39 M9 29 H39 M45 25 H75 M45 29 H75 M81 17 H111 M81 21 H111 M81 25 H111 M81 29 H111', stroke: 'text.secondary', sw: 'base', o: 0.6 },
    { t: 'path', d: 'M14 17 V33 M19 17 V33 M24 17 V33 M29 17 V33 M34 17 V33 M50 21 V33 M55 21 V33 M60 21 V33 M65 21 V33 M70 21 V33 M86 13 V33 M91 13 V33 M96 13 V33 M101 13 V33 M106 13 V33', stroke: 'brand.primary', sw: 'thin' },
    // bottom shelf: three stacks of 5, 3 and 4 volumes
    { t: 'rect', x: 9, y: 39, w: 30, h: 20, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 45, y: 47, w: 30, h: 12, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'rect', x: 81, y: 43, w: 30, h: 16, fill: 'feedback.nudgeLight', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M9 43 H39 M9 47 H39 M9 51 H39 M9 55 H39 M45 51 H75 M45 55 H75 M81 47 H111 M81 51 H111 M81 55 H111', stroke: 'text.secondary', sw: 'base', o: 0.6 },
    { t: 'path', d: 'M14 39 V59 M19 39 V59 M24 39 V59 M29 39 V59 M34 39 V59 M50 47 V59 M55 47 V59 M60 47 V59 M65 47 V59 M70 47 V59 M86 43 V59 M91 43 V59 M96 43 V59 M101 43 V59 M106 43 V59', stroke: 'brand.primary', sw: 'thin' },
    { t: 'rect', x: 6, y: 64, w: 12, h: 4, r: 1, fill: 'text.secondary' },
    { t: 'rect', x: 102, y: 64, w: 12, h: 4, r: 1, fill: 'text.secondary' },
  ],
};

export const DOCUMENT_BOX: ItemDef = {
  id: 'prop:document-box',
  kind: 'object',
  box: { w: 64, h: 44 },
  z: 'mid',
  alt: 'A closed wooden document box tied with a red cord',
  accuracyNote:
    'A generic closed wooden box tied with a red cord, as the story brief describes. It is not a copy of any surviving chest or of the historians\' own draft boxes, whose exact look the sources do not show, so no inscription, seal or hardware beyond one plain plate is drawn.',
  nodes: [
    { t: 'ellipse', cx: 32, cy: 42, rx: 31, ry: 2, fill: 'text.secondary', o: 0.08, det: true },
    { t: 'rect', x: 0, y: 12, w: 64, h: 30, r: 3, fill: 'text.primary' },
    { t: 'rect', x: 0, y: 4, w: 64, h: 12, r: 3, fill: 'text.secondary' },
    { t: 'line', x1: 4, y1: 24, x2: 60, y2: 24, stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'line', x1: 4, y1: 33, x2: 60, y2: 33, stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M26 4 V42 M38 4 V42 M32 10 Q22 0 24 8 Q26 12 32 10 Q42 0 40 8 Q38 12 32 10', stroke: 'brand.primary', sw: 'base' },
    { t: 'rect', x: 28, y: 22, w: 8, h: 8, r: 1, fill: 'feedback.nudge' },
  ],
};
