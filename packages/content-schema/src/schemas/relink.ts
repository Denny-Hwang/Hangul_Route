import { z } from 'zod';
import { JoinCodeFieldSchema } from './space';

/**
 * Re-link requests — F-TCH-001 §10.1. A class student on a new device
 * asks to be bound to an existing roster learner; the teacher approves
 * within the window.
 */
export const RELINK_WINDOW_MS = 10 * 60 * 1000;

export const RelinkStatusSchema = z.enum(['pending', 'approved', 'denied', 'expired']);
export type RelinkStatus = z.infer<typeof RelinkStatusSchema>;

export const RelinkRequestSchema = z.object({
  id: z.string().regex(/^relink:[a-z0-9-]+$/),
  spaceId: z.string(),
  learnerId: z.string(),
  deviceId: z.string(),
  platform: z.string().max(20).nullable(),
  requestedAt: z.string(),
  expiresAt: z.string(),
  status: RelinkStatusSchema,
  decidedAt: z.string().nullable(),
});
export type RelinkRequest = z.infer<typeof RelinkRequestSchema>;

/** POST /api/spaces/:id/relink-requests body (no auth). */
export const RelinkCreateSchema = z.object({
  code: JoinCodeFieldSchema,
  learnerId: z.string().regex(/^profile:[a-z0-9-]+$/),
  deviceId: z.string().min(8).max(64),
  platform: z.string().trim().max(20).optional(),
});
export type RelinkCreate = z.infer<typeof RelinkCreateSchema>;

/** PATCH /api/spaces/:id/settings body — F-TCH-001 §10.3. */
export const SpaceSettingsPatchSchema = z
  .object({
    anonymizeRoster: z.boolean().optional(),
    consentMode: z.enum(['parent', 'school']).optional(),
  })
  .refine((v) => v.anonymizeRoster !== undefined || v.consentMode !== undefined, { message: 'Nothing to change' });
export type SpaceSettingsPatch = z.infer<typeof SpaceSettingsPatchSchema>;

/** Initials for anonymized rosters: "Minho Kim" → "M. K.", "Suni" → "S." */
export function rosterAlias(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ');
}
