import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';

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

function requestTraceId(headers: Record<string, unknown>): string | undefined {
  const active = trace.getSpanContext(context.active());
  const extracted = propagation.extract(context.active(), headers);
  return active?.traceId ?? trace.getSpanContext(extracted)?.traceId;
}

function problem(
  status: number,
  title: string,
  requestId: string,
  traceId?: string,
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

export async function buildApp(
  config: AppConfig,
  logStream?: Writable,
): Promise<FastifyInstance> {
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
      stream: logStream,
    },
    requestIdHeader: false,
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
    request.log.info({
      event: 'http.request_received',
      requestId: request.id,
      traceId: requestTraceId(request.headers),
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
      traceId: requestTraceId(request.headers),
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
      .send(
        problem(404, 'Not found', request.id, requestTraceId(request.headers)),
      );
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
      .send(
        problem(
          500,
          'Internal server error',
          request.id,
          requestTraceId(request.headers),
        ),
      );
  });

  return app;
}
