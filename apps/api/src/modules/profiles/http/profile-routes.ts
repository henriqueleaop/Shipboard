import {
  publicProfileSchema,
  publicProfileQuerySchema,
  updateProfileRequestSchema,
  usernameSchema,
} from '@shipboard/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Principal } from '../../../shared/types/principal.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { ProfileAccess } from '../application/ports/profile-access.js';

const profileCursorSchema = z.tuple([
  z.string(),
  z.iso.datetime({ offset: true }),
  z.uuid(),
]);

function encodeCursor(
  username: string,
  value: { createdAt: Date; id: string },
) {
  return Buffer.from(
    JSON.stringify([username, value.createdAt.toISOString(), value.id]),
  ).toString('base64url');
}

function decodeCursor(raw: string, username: string) {
  try {
    const value = profileCursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString()),
    );
    if (!value.success || value.data[0] !== username) return null;
    return { createdAt: new Date(value.data[1]), id: value.data[2] };
  } catch {
    return null;
  }
}

export function registerProfileRoutes(
  app: FastifyInstance,
  profiles: ProfileAccess,
  resolvePrincipal: (request: FastifyRequest) => Promise<Principal | null>,
) {
  app.get<{ Params: { username: string } }>(
    '/api/v1/public/profiles/:username',
    async (request, reply) => {
      if (!usernameSchema.safeParse(request.params.username).success)
        return sendProblem(
          request,
          reply,
          404,
          'PROFILE_NOT_FOUND',
          'Profile not found',
          'The requested profile does not exist.',
        );
      const parsed = publicProfileQuerySchema.safeParse(request.query);
      if (!parsed.success)
        return sendProblem(
          request,
          reply,
          400,
          'VALIDATION_FAILED',
          'Invalid profile query',
          'Check the page cursor and limit.',
        );
      const cursor = parsed.data.cursor
        ? decodeCursor(parsed.data.cursor, request.params.username)
        : undefined;
      if (parsed.data.cursor && !cursor)
        return sendProblem(
          request,
          reply,
          400,
          'VALIDATION_FAILED',
          'Invalid profile query',
          'Check the page cursor and limit.',
        );
      const profile = await profiles.publicByUsername(
        request.params.username,
        parsed.data.limit,
        cursor ?? undefined,
      );
      if (!profile)
        return sendProblem(
          request,
          reply,
          404,
          'PROFILE_NOT_FOUND',
          'Profile not found',
          'The requested profile does not exist.',
        );
      const { nextCursor, ...publicProfile } = profile;
      return reply.header('cache-control', 'public, max-age=60').send(
        publicProfileSchema.parse({
          ...publicProfile,
          page: {
            nextCursor: nextCursor
              ? encodeCursor(request.params.username, nextCursor)
              : null,
          },
        }),
      );
    },
  );

  app.patch('/api/v1/me/profile', async (request, reply) => {
    const actor = await resolvePrincipal(request);
    if (!actor)
      return sendProblem(
        request,
        reply,
        401,
        'AUTH_REQUIRED',
        'Authentication required',
        'Sign in to continue.',
      );
    const parsed = updateProfileRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return sendProblem(
        request,
        reply,
        400,
        'VALIDATION_FAILED',
        'Invalid profile',
        'Check the username.',
      );
    const profile = await profiles.updateUsername(
      actor.id,
      parsed.data.username,
    );
    request.log.info({ event: 'profile.username_updated', actorId: actor.id });
    return reply.header('cache-control', 'no-store').send(profile);
  });
}
