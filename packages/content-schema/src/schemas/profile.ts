import { z } from 'zod';

/**
 * Profile — single learner. A device may host many (F-PROF-001).
 * PIN is parent-managed; profile switch is friction-light for kids.
 */
export const AvatarKindSchema = z.enum([
  'hoya-orange',
  'hoya-blue',
  'hoya-green',
  'hoya-purple',
  'hoya-pink',
]);
export type AvatarKind = z.infer<typeof AvatarKindSchema>;

export const ProfileSchema = z.object({
  id: z.string().regex(/^profile:[a-z0-9-]+$/),
  displayName: z.string().min(1).max(20),
  ageGroup: z.enum(['5-7', '8-9', '10-11']),
  avatar: AvatarKindSchema,
  createdAt: z.string(),
  lastActiveAt: z.string().optional(),
  parentPinHash: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;
export const ProfileListSchema = z.array(ProfileSchema);

export const FamilySchema = z.object({
  id: z.string().regex(/^family:[a-z0-9-]+$/),
  ownerEmail: z.string().email().optional(),
  parentPinHash: z.string().optional(),
  profiles: ProfileListSchema,
  createdAt: z.string(),
});
export type Family = z.infer<typeof FamilySchema>;
