import { z } from 'zod';

export const problemSchema = z.strictObject({
  type: z.url(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  instance: z.string(),
  code: z.string(),
  requestId: z.string(),
  traceId: z.string().optional(),
  errors: z
    .array(
      z.strictObject({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type Problem = z.infer<typeof problemSchema>;
