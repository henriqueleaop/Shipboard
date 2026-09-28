import {
  myVotesQuerySchema,
  myVotesResponseSchema,
  voteStateResponseSchema,
} from '@shipboard/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AppConfig } from '../../../app/config.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { Principal } from '../../../shared/types/principal.js';
import {
  changeVote,
  myVotes,
  voteState,
} from '../application/vote-use-cases.js';
import type { VoteStore } from '../application/ports/vote-store.js';
import { recordFeedbackEvent } from '../../../telemetry.js';

const idSchema = z.uuid();

export function registerVoteRoutes(
  app: FastifyInstance,
  store: VoteStore,
  resolvePrincipal: (request: FastifyRequest) => Promise<Principal | null>,
  config: AppConfig,
) {
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
  const badInput = (request: FastifyRequest, reply: FastifyReply) =>
    sendProblem(
      request,
      reply,
      400,
      'VALIDATION_FAILED',
      'Invalid request',
      'Check the request fields.',
    );

  app.get<{ Params: { suggestionId: string } }>(
    '/api/v1/suggestions/:suggestionId/vote',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      if (!idSchema.safeParse(request.params.suggestionId).success)
        return badInput(request, reply);
      return reply.send(
        voteStateResponseSchema.parse(
          await voteState(store, actor, request.params.suggestionId),
        ),
      );
    },
  );

  app.put<{ Params: { suggestionId: string } }>(
    '/api/v1/suggestions/:suggestionId/vote',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      if (!idSchema.safeParse(request.params.suggestionId).success)
        return badInput(request, reply);
      const { state, changed } = await changeVote(
        store,
        actor,
        request.params.suggestionId,
        true,
      );
      if (changed) {
        recordFeedbackEvent('vote.created');
        request.log.info({
          event: 'vote.created',
          suggestionId: state.suggestionId,
          actorId: actor.id,
        });
      }
      return reply.send(voteStateResponseSchema.parse(state));
    },
  );

  app.delete<{ Params: { suggestionId: string } }>(
    '/api/v1/suggestions/:suggestionId/vote',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      if (!idSchema.safeParse(request.params.suggestionId).success)
        return badInput(request, reply);
      const { state, changed } = await changeVote(
        store,
        actor,
        request.params.suggestionId,
        false,
      );
      if (changed) {
        recordFeedbackEvent('vote.removed');
        request.log.info({
          event: 'vote.removed',
          suggestionId: state.suggestionId,
          actorId: actor.id,
        });
      }
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { boardId: string } }>(
    '/api/v1/boards/:boardId/my-votes',
    async (request, reply) => {
      const actor = await authenticate(request, reply);
      if (!actor) return reply;
      const parsed = myVotesQuerySchema.safeParse(request.query);
      if (
        !idSchema.safeParse(request.params.boardId).success ||
        !parsed.success
      )
        return badInput(request, reply);
      return reply.send(
        myVotesResponseSchema.parse({
          items: await myVotes(
            store,
            actor,
            request.params.boardId,
            parsed.data.suggestionIds,
          ),
        }),
      );
    },
  );
}
