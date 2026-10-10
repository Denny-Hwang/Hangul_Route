import { Hono } from 'hono';
import { ok } from '../envelope';

export const cardRoutes = new Hono();

/**
 * GET /api/cards/catalog — returns the Heritage Card catalog metadata.
 * In a full deployment the catalog is served from R2 + content-schema validated.
 * For prototype, returns a minimal embedded catalog so apps can boot offline.
 */
const CATALOG: Array<{ id: string; titleEn: string; rarity: string; theme: string; stage: string }> = [
  { id: 'card:tiger', titleEn: 'Tiger', rarity: 'legendary', theme: 'nature', stage: 'stage1' },
  { id: 'card:book', titleEn: 'Book', rarity: 'common', theme: 'letters', stage: 'stage1' },
  { id: 'card:kimchi', titleEn: 'Kimchi', rarity: 'common', theme: 'life', stage: 'stage1' },
  { id: 'card:seollal', titleEn: 'Lunar New Year', rarity: 'rare', theme: 'rites', stage: 'stage1' },
  { id: 'card:yutnori', titleEn: 'Yut Game', rarity: 'rare', theme: 'crafts', stage: 'stage1' },
];

cardRoutes.get('/catalog', (c) => ok(c, { cards: CATALOG }));
