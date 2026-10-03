import {
  changeSuggestionStatusRequestSchema,
  createSuggestionRequestSchema,
  publicBoardResponseSchema,
  suggestionListQuerySchema,
  suggestionListResponseSchema,
  suggestionResponseSchema,
  type SuggestionResponse,
  type SuggestionSort,
  type SuggestionStatus,
} from '@shipboard/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AppConfig } from '../../../app/config.js';
import type { BoardAccess } from '../../boards/index.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { Principal } from '../../../shared/types/principal.js';
import {
  changeSuggestionStatus,
  createSuggestion,
  listSuggestions,
  suggestionDetail,
} from '../application/suggestion-use-cases.js';
import type {
  SuggestionCursor,
  SuggestionUnitOfWork,
  SuggestionWithCount,
} from '../application/ports/suggestion-store.js';
import { SuggestionError } from '../application/suggestion-error.js';
import { recordFeedbackEvent } from '../../../telemetry.js';

const idSchema = z.uuid();
const cursorSchema = z.tuple([
  z.uuid(),
  z.enum(['newest', 'most_voted']),
  z.string().nullable(),
  z.iso.datetime({ offset: true }),
  z.uuid(),
  z.number().int().nonnegative(),
]);

function present(
  row: Pick<SuggestionWithCount, 'suggestion' | 'voteCount' | 'authorUsername'>,
): SuggestionResponse {
  const value = row.suggestion;
  return suggestionResponseSchema.parse({
    id: value.id,
    boardId: value.boardId,
    title: value.title,
    description: value.description,
    status: value.status,
    voteCount: row.voteCount,
    version: value.version,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    author: { username: row.authorUsername },
  });
}

function badInput(request: FastifyRequest, reply: FastifyReply) {
  return sendProblem(
    request,
    reply,
    400,
    'VALIDATION_FAILED',
    'Invalid request',
    'Check the request fields.',
  );
}

function encodeCursor(
  boardId: string,
  sort: SuggestionSort,
  status: SuggestionStatus | undefined,
  cursor: SuggestionCursor,
) {
  return Buffer.from(
    JSON.stringify([
      boardId,
      sort,
      status ?? null,
      cursor.createdAt,
      cursor.id,
      cursor.voteCount,
    ]),
  ).toString('base64url');
}

function decodeCursor(
  raw: string,
  boardId: string,
  sort: SuggestionSort,
  status: SuggestionStatus | undefined,
): SuggestionCursor | null {
  try {
    const value = cursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString()),
    );
    if (
      !value.success ||
      value.data[0] !== boardId ||
      value.data[1] !== sort ||
      value.data[2] !== (status ?? null)
    )
      return null;
    return {
      createdAt: value.data[3],
      id: value.data[4],
      voteCount: value.data[5],
    };
  } catch {
    return null;
  }
}

export function registerSuggestionRoutes(
  app: FastifyInstance,
  unit: SuggestionUnitOfWork,
  boards: BoardAccess,
  resolvePrincipal: (request: FastifyRequest) => Promise<Principal | null>,
  config: AppConfig,
) {
  const publicBoard = async (
    request: FastifyRequest,
    username: string,
    slug: string,
  ) => {
    const actor = await resolvePrincipal(request);
    return boards.publicByIdentity(username, slug, actor?.id);
  };
  const legacyPublicBoard = (slug: string) => boards.legacyPublicBySlug(slug);
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = await resolvePrincipal(request);
    if (!actor) {
      sendProblem(
        request,
        reply,
        401,
        'AUTH_REQUIRED',
        'Authentication required',
        'Sign in to continue.',
      );
      return null;
    }
    if (
      request.method !== 'GET' &&
      request.headers.origin !== config.WEB_ORIGIN
    ) {
      sendProblem(
        request,
        reply,
        403,
        'ORIGIN_DENIED',
        'Origin denied',
        'This request origin is not allowed.',
      );
      return null;
    }
    reply.header('cache-control', 'no-store');
    return actor;
  };

  app.get<{ Params: { username: string; slug: string } }>(
    '/api/v1/public/boards/:username/:slug',
    async (request, reply) => {
      const found = await publicBoard(
        request,
        request.params.username,
        request.params.slug,
      );
      if (!found) throw new SuggestionError('BOARD_NOT_FOUND');
      const { board, ownerUsername } = found;
      return reply.send(
        publicBoardResponseSchema.parse({
          id: board.id,
          name: board.name,
          slug: board.slug,
          description: board.description,
          ownerUsername,
          githubRepositoryUrl: board.githubRepositoryUrl,
        }),
      );
    },
  );

  app.get<{ Params: { slug: string } }>(
    '/api/v1/public/boards/:slug',
    async (request, reply) => {
      const found = await legacyPublicBoard(request.params.slug);
      if (!found) throw new SuggestionError('BOARD_NOT_FOUND');
      const { board, ownerUsername } = found;
      return reply.send(
        publicBoardResponseSchema.parse({
          id: board.id,
          name: board.name,
          slug: board.slug,
          description: board.description,
          ownerUsername,
          githubRepositoryUrl: board.githubRepositoryUrl,
        }),
      );
    },
  );

  const list = async (
    request: FastifyRequest,
    reply: FastifyReply,
    boardId: string,
    owner?: Principal,
  ) => {
    const parsed = suggestionListQuerySchema.safeParse(request.query);
    if (!idSchema.safeParse(boardId).success || !parsed.success)
      return badInput(request, reply);
    const { sort, status, limit } = parsed.data;
    const cursor = parsed.data.cursor
      ? decodeCursor(parsed.data.cursor, boardId, sort, status)
      : undefined;
    if (parsed.data.cursor && !cursor) return badInput(request, reply);
    const result = await listSuggestions(unit, boards, boardId, {
      limit,
      sort,
      status,
      cursor: cursor ?? undefined,
      owner,
    });
    return reply.send(
      suggestionListResponseSchema.parse({
        items: result.items.map(present),
        page: {
          nextCursor: result.nextCursor
            ? encodeCursor(boardId, sort, status, result.nextCursor)
            : null,
        },
      }),
    );
  };

  app.get<{ Params: { username: string; slug: string } }>(
    '/api/v1/public/boards/:username/:slug/suggestions',
    async (request, reply) => {
      const found = await publicBoard(
        request,
        request.params.username,
        request.params.slug,
      );
      if (!found) throw new SuggestionError('BOARD_NOT_FOUND');
      return list(request, reply, found.board.id);
    },
  );

  app.get<{ Params: { slug: string } }>(
    '/api/v1/public/boards/:slug/suggestions',
    async (request, reply) => {
      const found = await legacyPublicBoard(request.params.slug);
      if (!found) throw new SuggestionError('BOARD_NOT_FOUND');
      return list(request, reply, found.board.id);
    },
  );

  app.get<{ Params: { username: string; slug: string; suggestionId: string } }>(
    '/api/v1/public/boards/:username/:slug/suggestions/:suggestionId',
    async (request, reply) => {
      if (!idSchema.safeParse(request.params.suggestionId).success)
        return badInput(request, reply);
      const found = await publicBoard(
        request,
        request.params.username,
        request.params.slug,
      );
      if (!found) throw new SuggestionError('BOARD_NOT_FOUND');
      return reply.send(
        present(
          await suggestionDetail(
            unit,
            boards,
            found.board.id,
            request.params.suggestionId,
          ),
        ),
      );
    },
  );

  app.get<{ Params: { slug: string; suggestionId: string } }>(
    '/api/v1/public/boards/:slug/suggestions/:suggestionId',
    async (request, reply) => {
      if (!idSchema.safeParse(request.params.suggestionId).success)
        return badInput(request, reply);
      const found = await legacyPublicBoard(request.params.slug);
      if (!found) throw new SuggestionError('BOARD_NOT_FOUND');
      return reply.send(
        present(
          await suggestionDetail(
            unit,
            boards,
            found.board.id,
            request.params.suggestionId,
          ),
        ),
      );
    },
  );

  app.get<{ Params: { boardId: string } }>(
    '/api/v1/boards/:boardId/suggestions',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      return list(request, reply, request.params.boardId, actor);
    },
  );

  app.post<{ Params: { boardId: string } }>(
    '/api/v1/boards/:boardId/suggestions',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      const parsed = createSuggestionRequestSchema.safeParse(request.body);
      const key = request.headers['idempotency-key'];
      if (
        !idSchema.safeParse(request.params.boardId).success ||
        !parsed.success ||
        !idSchema.safeParse(key).success ||
        typeof key !== 'string'
      )
        return badInput(request, reply);
      const { suggestion, replayed, location } = await createSuggestion(
        unit,
        actor,
        request.params.boardId,
        parsed.data,
        key,
      );
      request.log.info({
        event: replayed ? 'suggestion.replayed' : 'suggestion.created',
        suggestionId: suggestion.id,
        boardId: suggestion.boardId,
      });
      recordFeedbackEvent(
        replayed ? 'suggestion.replayed' : 'suggestion.created',
      );
      const persisted = await unit.store.find(suggestion.id);
      if (!persisted) throw new SuggestionError('SUGGESTION_NOT_FOUND');
      return reply
        .header('location', location)
        .header('etag', `"${suggestion.version}"`)
        .code(201)
        .send(present(persisted));
    },
  );

  app.patch<{ Params: { boardId: string; suggestionId: string } }>(
    '/api/v1/boards/:boardId/suggestions/:suggestionId/status',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      const parsed = changeSuggestionStatusRequestSchema.safeParse(
        request.body,
      );
      if (
        !idSchema.safeParse(request.params.boardId).success ||
        !idSchema.safeParse(request.params.suggestionId).success ||
        !parsed.success
      )
        return badInput(request, reply);
      const match = request.headers['if-match'];
      if (match === undefined)
        return sendProblem(
          request,
          reply,
          428,
          'PRECONDITION_REQUIRED',
          'Version required',
          'Send the current ETag in If-Match.',
        );
      if (typeof match !== 'string' || !/^"[1-9]\d*"$/.test(match))
        return badInput(request, reply);
      const expected = Number(match.slice(1, -1));
      if (!Number.isSafeInteger(expected)) return badInput(request, reply);
      const result = await changeSuggestionStatus(
        unit,
        boards,
        actor,
        request.params.boardId,
        request.params.suggestionId,
        expected,
        parsed.data.status,
      );
      if (result.changed) {
        recordFeedbackEvent('suggestion.status_changed');
        request.log.info({
          event: 'suggestion.status_changed',
          suggestionId: result.suggestion.id,
          boardId: result.suggestion.boardId,
          actorId: actor.id,
          status: result.suggestion.status,
        });
      }
      const persisted = await unit.store.find(result.suggestion.id);
      if (!persisted) throw new SuggestionError('SUGGESTION_NOT_FOUND');
      return reply
        .header('etag', `"${result.suggestion.version}"`)
        .send(present(persisted));
    },
  );
}
