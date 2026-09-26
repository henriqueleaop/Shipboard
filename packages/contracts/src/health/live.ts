import { z } from 'zod';

export const liveHealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type LiveHealthResponse = z.infer<typeof liveHealthResponseSchema>;
