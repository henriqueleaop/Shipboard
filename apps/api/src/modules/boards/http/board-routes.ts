import {
  boardResponseSchema,
  createBoardRequestSchema,
  ownedBoardsQuerySchema,
  ownedBoardsResponseSchema,
  updateBoardRequestSchema,
  type BoardResponse,
} from '@shipboard/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AppConfig } from '../../../app/config.js';
import type { Principal } from '../../../shared/types/principal.js';
import { sendProblem } from '../../../shared/http/problem.js';
import {
  createBoard,
  editBoard,
  ownedBoard,
  ownedBoards,
} from '../application/board-use-cases.js';
import type { BoardUnitOfWork } from '../application/ports/board-store.js';
import type { Board } from '../domain/board.js';

const idSchema = z.uuid();
const keySchema = z.uuid();

function present(board: Board): BoardResponse {
  return boardResponseSchema.parse({
    id: board.id,
    ownerId: board.ownerId,
    name: board.name,
    slug: board.slug,
    description: board.description,
    visibility: board.visibility,
    githubRepositoryUrl: board.githubRepositoryUrl,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    version: board.version,
  });
}

function badInput(
  request: FastifyRequest,
  reply: Parameters<typeof sendProblem>[1],
) {
  return sendProblem(
    request,
    reply,
    400,
    'VALIDATION_FAILED',
    'Invalid request',
    'Check the request fields.',
  );
}

function encodeCursor(value: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify([value.createdAt.toISOString(), value.id]),
  ).toString('base64url');
}

function decodeCursor(value: string) {
  try {
    const data: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString(),
    );
    const result = z.tuple([z.iso.datetime(), z.uuid()]).safeParse(data);
    if (!result.success) return null;
    return { createdAt: new Date(result.data[0]), id: result.data[1] };
  } catch {
    return null;
  }
}

export function registerBoardRoutes(
  app: FastifyInstance,
  unit: BoardUnitOfWork,
  resolvePrincipal: (request: FastifyRequest) => Promise<Principal | null>,
  config: AppConfig,
) {
  app.register(async (scope) => {
    const principals = new WeakMap<FastifyRequest, Principal>();
    scope.addHook('preHandler', async (request, reply) => {
      const actor = await resolvePrincipal(request);
      if (!actor) {
        return sendProblem(
          request,
          reply,
          401,
          'AUTH_REQUIRED',
          'Authentication required',
          'Sign in to continue.',
        );
      }
      if (
        request.method !== 'GET' &&
        request.headers.origin !== config.WEB_ORIGIN
      ) {
        return sendProblem(
          request,
          reply,
          403,
          'ORIGIN_DENIED',
          'Origin denied',
          'This request origin is not allowed.',
        );
      }
      principals.set(request, actor);
      reply.header('cache-control', 'no-store');
    });
    const actorFor = (request: FastifyRequest) => {
      const actor = principals.get(request);
      if (!actor) throw new Error('Authenticated principal missing.');
      return actor;
    };

    scope.post('/api/v1/boards', async (request, reply) => {
      const parsed = createBoardRequestSchema.safeParse(request.body);
      if (!parsed.success) return badInput(request, reply);
      const rawKey = request.headers['idempotency-key'];
      if (
        rawKey !== undefined &&
        keySchema.safeParse(rawKey).success === false
      ) {
        return badInput(request, reply);
      }
      const { board, replayed } = await createBoard(
        unit,
        actorFor(request),
        parsed.data,
        typeof rawKey === 'string' ? rawKey : undefined,
      );
      if (replayed) {
        request.log.info({ event: 'idempotency.replayed', boardId: board.id });
      } else {
        request.log.info({
          event: 'board.created',
          boardId: board.id,
          actorId: board.ownerId,
        });
      }
      return reply
        .header('location', `/api/v1/boards/${board.id}`)
        .header('etag', `"${board.version}"`)
        .code(201)
        .send(present(board));
    });

    scope.get('/api/v1/boards', async (request, reply) => {
      const query = ownedBoardsQuerySchema.safeParse(request.query);
      if (!query.success) return badInput(request, reply);
      const cursor = query.data.cursor
        ? decodeCursor(query.data.cursor)
        : undefined;
      if (query.data.cursor && !cursor) return badInput(request, reply);
      const result = await ownedBoards(
        unit,
        actorFor(request),
        query.data.limit,
        cursor ?? undefined,
      );
      return reply.code(200).send(
        ownedBoardsResponseSchema.parse({
          items: result.items.map(present),
          page: {
            nextCursor: result.nextCursor
              ? encodeCursor(result.nextCursor)
              : null,
          },
        }),
      );
    });

    scope.get<{ Params: { boardId: string } }>(
      '/api/v1/boards/:boardId',
      async (request, reply) => {
        if (!idSchema.safeParse(request.params.boardId).success) {
          return badInput(request, reply);
        }
        const board = await ownedBoard(
          unit,
          actorFor(request),
          request.params.boardId,
        );
        return reply
          .header('etag', `"${board.version}"`)
          .code(200)
          .send(present(board));
      },
    );

    scope.patch<{ Params: { boardId: string } }>(
      '/api/v1/boards/:boardId',
      async (request, reply) => {
        const changes = updateBoardRequestSchema.safeParse(request.body);
        if (
          !idSchema.safeParse(request.params.boardId).success ||
          !changes.success
        ) {
          return badInput(request, reply);
        }
        const match = request.headers['if-match'];
        if (match === undefined) {
          return sendProblem(
            request,
            reply,
            428,
            'PRECONDITION_REQUIRED',
            'Version required',
            'Send the current ETag in If-Match.',
          );
        }
        if (typeof match !== 'string' || !/^"[1-9]\d*"$/.test(match)) {
          return badInput(request, reply);
        }
        const version = Number(match.slice(1, -1));
        if (!Number.isSafeInteger(version)) return badInput(request, reply);
        const board = await editBoard(
          unit,
          actorFor(request),
          request.params.boardId,
          version,
          changes.data,
        );
        request.log.info({
          event: 'board.updated',
          boardId: board.id,
          actorId: board.ownerId,
        });
        return reply
          .header('etag', `"${board.version}"`)
          .code(200)
          .send(present(board));
      },
    );
  });
}
