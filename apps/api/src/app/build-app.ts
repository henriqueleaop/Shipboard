import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { context, propagation, trace } from '@opentelemetry/api';
import { liveHealthResponseSchema } from '@shipboard/contracts';
import Fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from './config.js';
import { recordHttpRequest } from '../telemetry.js';

const requestIdPattern = /^[A-Za-z0-9._-]{8,128}$/;
const requestStartedAt = new WeakMap<object, number>();

function problem(
  status: number,
  title: string,
  requestId: string,
  traceId: string,
) {
  return {
    type: `https://shipboard.dev/problems/${status === 404 ? 'not-found' : 'internal-error'}`,
    title,
    status,
    detail:
      status === 404
        ? 'The requested resource does not exist.'
        : 'An unexpected error occurred.',
    code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
    requestId,
    traceId,
  };
}

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      base: { service: config.OTEL_SERVICE_NAME, environment: config.NODE_ENV },
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'password',
      ],
    },
    requestIdHeader: 'x-request-id',
    genReqId: (request) => {
      const requested = request.headers['x-request-id'];
      return typeof requested === 'string' && requestIdPattern.test(requested)
        ? requested
        : randomUUID();
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.addHook('onRequest', async (request) => {
    requestStartedAt.set(request, performance.now());
    const extracted = propagation.extract(context.active(), request.headers);
    const spanContext = trace.getSpan(extracted)?.spanContext();
    request.log.info({
      event: 'http.request_received',
      requestId: request.id,
      traceId: spanContext?.traceId,
    });
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  app.addHook('onResponse', async (request, reply) => {
    recordHttpRequest(
      reply.statusCode,
      performance.now() - (requestStartedAt.get(request) ?? performance.now()),
    );
    request.log.info({
      event: 'http.request_completed',
      requestId: request.id,
      statusCode: reply.statusCode,
    });
  });

  app.get('/health/live', async (_request, reply) => {
    return reply
      .code(200)
      .send(liveHealthResponseSchema.parse({ status: 'ok' }));
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .type('application/problem+json')
      .code(404)
      .send(problem(404, 'Not found', request.id, request.id));
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error({
      event: 'http.unexpected_error',
      requestId: request.id,
      err: error,
    });
    return reply
      .type('application/problem+json')
      .code(500)
      .send(problem(500, 'Internal server error', request.id, request.id));
  });

  return app;
}
