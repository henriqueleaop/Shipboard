import { z } from 'zod';

export const suggestionFieldLimits = {
  title: 120,
  description: 2_000,
} as const;

export const suggestionStatusSchema = z.enum([
  'UNDER_REVIEW',
  'PLANNED',
  'IN_PROGRESS',
  'SHIPPED',
  'REJECTED',
]);

export const suggestionSortSchema = z.enum(['newest', 'most_voted']);

export const publicBoardResponseSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  ownerUsername: z.string(),
  githubRepositoryUrl: z.string().url().nullable(),
});

export const suggestionAuthorSchema = z.strictObject({
  username: z.string(),
});

export const createSuggestionRequestSchema = z.strictObject({
  title: z.string().trim().min(3).max(suggestionFieldLimits.title),
  description: z.string().trim().min(1).max(suggestionFieldLimits.description),
});

export const suggestionResponseSchema = z.strictObject({
  id: z.uuid(),
  boardId: z.uuid(),
  title: z.string(),
  description: z.string(),
  status: suggestionStatusSchema,
  voteCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  author: suggestionAuthorSchema,
});

export const suggestionListQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(2048).optional(),
  sort: suggestionSortSchema.default('newest'),
  status: suggestionStatusSchema.optional(),
});

export const suggestionListResponseSchema = z.strictObject({
  items: z.array(suggestionResponseSchema),
  page: z.strictObject({ nextCursor: z.string().nullable() }),
});

export const changeSuggestionStatusRequestSchema = z.strictObject({
  status: suggestionStatusSchema,
});

export type SuggestionStatus = z.infer<typeof suggestionStatusSchema>;
export type SuggestionSort = z.infer<typeof suggestionSortSchema>;
export type CreateSuggestionRequest = z.infer<
  typeof createSuggestionRequestSchema
>;
export type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;
export type SuggestionListQuery = z.infer<typeof suggestionListQuerySchema>;
