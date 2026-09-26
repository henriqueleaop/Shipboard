import { z } from 'zod';

export const readyHealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export const unavailableHealthResponseSchema = z.object({
  type: z.literal('https://shipboard.dev/problems/service-unavailable'),
  title: z.literal('Service unavailable'),
  status: z.literal(503),
  detail: z.literal('A required dependency is unavailable.'),
  instance: z.literal('/health/ready'),
  code: z.literal('SERVICE_UNAVAILABLE'),
  requestId: z.string().min(1),
  traceId: z.string().optional(),
});

export type ReadyHealthResponse = z.infer<typeof readyHealthResponseSchema>;
export type UnavailableHealthResponse = z.infer<
  typeof unavailableHealthResponseSchema
>;
