import { z } from 'zod';
import { isReservedBoardSlug } from './reserved-root-segments.js';

export const boardSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !isReservedBoardSlug(value), {
    message: 'This slug is reserved for Shipboard.',
  });

export const createBoardRequestSchema = z.strictObject({
  name: z.string().trim().min(1),
  slug: boardSlugSchema,
  description: z.string(),
});

export const updateBoardRequestSchema = createBoardRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const boardResponseSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.uuid(),
  name: z.string(),
  slug: boardSlugSchema,
  description: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  version: z.number().int().positive(),
});

export const ownedBoardsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const ownedBoardsResponseSchema = z.strictObject({
  items: z.array(boardResponseSchema),
  page: z.strictObject({ nextCursor: z.string().nullable() }),
});

export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;
export type UpdateBoardRequest = z.infer<typeof updateBoardRequestSchema>;
export type BoardResponse = z.infer<typeof boardResponseSchema>;
