import { problemSchema } from '@shipboard/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  code: string,
  title: string,
  detail: string,
  errors?: { path: string; code: string; message: string }[],
) {
  return reply
    .type('application/problem+json')
    .code(status)
    .send(
      problemSchema.parse({
        type: `https://shipboard.dev/problems/${code.toLowerCase().replaceAll('_', '-')}`,
        title,
        status,
        detail,
        instance: request.url.split('?')[0],
        code,
        requestId: request.id,
        ...(errors ? { errors } : {}),
      }),
    );
}
