import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  context,
  propagation,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import {
  liveHealthResponseSchema,
  readyHealthResponseSchema,
  unavailableHealthResponseSchema,
} from '@shipboard/contracts';
import Fastify, { LogController, type FastifyInstance } from 'fastify';

import type { AppConfig } from './config.js';
import { createDatabase } from '../infrastructure/database/client.js';
import { createAuth } from '../infrastructure/auth/create-auth.js';
import { registerAuthRoutes } from '../infrastructure/auth/auth-routes.js';
import { BoardError } from '../modules/boards/application/board-error.js';
import { registerBoardRoutes } from '../modules/boards/http/board-routes.js';
import { createBoardUnitOfWork } from '../modules/boards/infrastructure/persistence/board-store.drizzle.js';
import { createBoardAccess } from '../modules/boards/index.js';
import { SuggestionError } from '../modules/suggestions/application/suggestion-error.js';
import { registerSuggestionRoutes } from '../modules/suggestions/http/suggestion-routes.js';
import { createSuggestionUnitOfWork } from '../modules/suggestions/infrastructure/persistence/suggestion-store.drizzle.js';
import { VoteError } from '../modules/votes/application/vote-use-cases.js';
import { registerVoteRoutes } from '../modules/votes/http/vote-routes.js';
import { DrizzleVoteStore } from '../modules/votes/infrastructure/persistence/vote-store.drizzle.js';
import { sendProblem } from '../shared/http/problem.js';
import {
  recordDatabaseCheck,
  recordFeedbackEvent,
  recordHttpRequest,
} from '../telemetry.js';

const requestIdPattern = /^[A-Za-z0-9._-]{8,128}$/;
const requestStartedAt = new WeakMap<object, number>();
const readinessDeadlineMs = 1_900;

export type DatabaseCheck = Pick<
  ReturnType<typeof createDatabase>,
  'check' | 'close'
>;

function hasDatabaseClient(
  value: DatabaseCheck | ReturnType<typeof createDatabase>,
): value is ReturnType<typeof createDatabase> {
  return 'db' in value;
}

async function checkWithinDeadline(database: DatabaseCheck): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      database.check().then(
        () => true,
        () => false,
      ),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), readinessDeadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function requestTraceId(headers: Record<string, unknown>): string | undefined {
  const active = trace.getSpanContext(context.active());
  const extracted = propagation.extract(context.active(), headers);
  return active?.traceId ?? trace.getSpanContext(extracted)?.traceId;
}

function problem(
  status: number,
  title: string,
  requestId: string,
  instance: string,
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
    instance,
    traceId,
  };
}

export async function buildApp(
  config: AppConfig,
  logStream?: Writable,
  database?: DatabaseCheck,
): Promise<FastifyInstance> {
  const app = Fastify({
    logController: new LogController({ disableRequestLogging: true }),
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

  const activeDatabase =
    database ??
    createDatabase(config.DATABASE_URL, () => {
      app.log.warn({
        event: 'database.idle_connection_failed',
        errorCode: 'DATABASE_UNAVAILABLE',
      });
    });

  app.addHook('onClose', async () => activeDatabase.close());

  await app.register(helmet);
  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'If-Match',
      'Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: ['ETag', 'Location', 'Retry-After', 'X-Request-Id'],
  });
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
    if (reply.statusCode === 429) {
      reply.type('application/problem+json');
      reply.header('cache-control', 'no-store');
    }
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

  app.get(
    '/health/live',
    { config: { rateLimit: false } },
    async (_request, reply) => {
      return reply
        .code(200)
        .send(liveHealthResponseSchema.parse({ status: 'ok' }));
    },
  );

  app.get(
    '/health/ready',
    { config: { rateLimit: false } },
    async (request, reply) => {
      const startedAt = performance.now();
      const parent = propagation.extract(context.active(), request.headers);
      const available = await context.with(parent, () =>
        trace
          .getTracer('shipboard-api')
          .startActiveSpan('database.readiness', async (span) => {
            try {
              const success = await checkWithinDeadline(activeDatabase);
              if (!success) {
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: 'database unavailable',
                });
              }
              return success;
            } finally {
              span.end();
            }
          }),
      );
      recordDatabaseCheck(available, performance.now() - startedAt);
      reply.header('cache-control', 'no-store');
      if (available) {
        request.log.info({
          event: 'database.readiness_succeeded',
          requestId: request.id,
          traceId: requestTraceId(request.headers),
        });
        return reply
          .code(200)
          .send(readyHealthResponseSchema.parse({ status: 'ok' }));
      }
      request.log.warn({
        event: 'database.readiness_failed',
        errorCode: 'DATABASE_UNAVAILABLE',
        requestId: request.id,
        traceId: requestTraceId(request.headers),
      });
      return reply
        .type('application/problem+json')
        .code(503)
        .send(
          unavailableHealthResponseSchema.parse({
            type: 'https://shipboard.dev/problems/service-unavailable',
            title: 'Service unavailable',
            status: 503,
            detail: 'A required dependency is unavailable.',
            instance: '/health/ready',
            code: 'SERVICE_UNAVAILABLE',
            requestId: request.id,
            traceId: requestTraceId(request.headers),
          }),
        );
    },
  );

  if (hasDatabaseClient(activeDatabase)) {
    const auth = createAuth(config, activeDatabase.db);
    const { principal } = registerAuthRoutes(app, auth, config);
    const boardUnit = createBoardUnitOfWork(activeDatabase);
    registerBoardRoutes(app, boardUnit, principal, config);
    registerSuggestionRoutes(
      app,
      createSuggestionUnitOfWork(activeDatabase),
      createBoardAccess(boardUnit),
      principal,
      config,
    );
    registerVoteRoutes(
      app,
      new DrizzleVoteStore(activeDatabase.db),
      principal,
      config,
    );
  }

  app.setNotFoundHandler((request, reply) => {
    return reply
      .type('application/problem+json')
      .code(404)
      .send(
        problem(
          404,
          'Not found',
          request.id,
          request.url.split('?')[0]!,
          requestTraceId(request.headers),
        ),
      );
  });
  app.setErrorHandler((error, request, reply) => {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 429
    ) {
      return sendProblem(
        request,
        reply,
        429,
        'RATE_LIMITED',
        'Too many requests',
        'Wait for the current request window, then try again.',
      );
    }
    if (error instanceof VoteError) {
      request.log.info({
        event: 'vote.operation_rejected',
        errorCode: error.code,
        requestId: request.id,
      });
      return sendProblem(
        request,
        reply,
        404,
        error.code,
        'Vote operation failed',
        'The requested resource does not exist.',
      );
    }
    if (error instanceof SuggestionError) {
      if (error.code === 'SUGGESTION_FORBIDDEN')
        recordFeedbackEvent('suggestion.forbidden');
      if (error.code === 'SUGGESTION_STALE')
        recordFeedbackEvent('suggestion.conflict');
      const status = {
        SUGGESTION_NOT_FOUND: 404,
        BOARD_NOT_FOUND: 404,
        SUGGESTION_FORBIDDEN: 403,
        SUGGESTION_STALE: 412,
        IDEMPOTENCY_KEY_REUSED: 409,
        IDEMPOTENCY_IN_PROGRESS: 409,
      }[error.code];
      if (error.code === 'IDEMPOTENCY_IN_PROGRESS')
        reply.header('retry-after', '1');
      request.log.info({
        event: 'suggestion.operation_rejected',
        errorCode: error.code,
        requestId: request.id,
      });
      return sendProblem(
        request,
        reply,
        status,
        error.code,
        'Suggestion operation failed',
        error.code === 'SUGGESTION_STALE'
          ? 'The suggestion changed. Reload it before editing again.'
          : 'The requested suggestion operation could not be completed.',
      );
    }
    if (error instanceof BoardError) {
      const status = {
        BOARD_NOT_FOUND: 404,
        BOARD_FORBIDDEN: 403,
        BOARD_STALE: 412,
        SLUG_CONFLICT: 409,
        IDEMPOTENCY_KEY_REUSED: 409,
        IDEMPOTENCY_IN_PROGRESS: 409,
      }[error.code];
      if (error.code === 'IDEMPOTENCY_IN_PROGRESS') {
        reply.header('retry-after', '1');
      }
      request.log.info({
        event: 'board.operation_rejected',
        errorCode: error.code,
        requestId: request.id,
      });
      return sendProblem(
        request,
        reply,
        status,
        error.code,
        'Board operation failed',
        error.code === 'BOARD_STALE'
          ? 'The board changed. Reload it before editing again.'
          : 'The requested board operation could not be completed.',
      );
    }
    request.log.error({
      event: 'http.unexpected_error',
      requestId: request.id,
      errorCode: 'UNEXPECTED_ERROR',
    });
    return reply
      .type('application/problem+json')
      .code(500)
      .send(
        problem(
          500,
          'Internal server error',
          request.id,
          request.url.split('?')[0]!,
          requestTraceId(request.headers),
        ),
      );
  });

  return app;
}
