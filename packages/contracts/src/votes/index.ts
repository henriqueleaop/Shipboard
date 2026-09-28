import { z } from 'zod';

export const voteStateResponseSchema = z.strictObject({
  suggestionId: z.uuid(),
  voted: z.boolean(),
  voteCount: z.number().int().nonnegative(),
});

export const myVotesQuerySchema = z.strictObject({
  suggestionIds: z.string().transform((value, context) => {
    const ids = value.split(',');
    if (
      ids.length < 1 ||
      ids.length > 50 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !z.uuid().safeParse(id).success)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Choose 1 to 50 distinct suggestion IDs.',
      });
      return z.NEVER;
    }
    return ids;
  }),
});

export const myVotesResponseSchema = z.strictObject({
  items: z.array(
    z.strictObject({ suggestionId: z.uuid(), voted: z.boolean() }),
  ),
});
