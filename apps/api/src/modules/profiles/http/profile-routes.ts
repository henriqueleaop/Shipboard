import {
  publicProfileSchema,
  updateProfileRequestSchema,
  usernameSchema,
} from '@shipboard/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { Principal } from '../../../shared/types/principal.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { ProfileAccess } from '../application/ports/profile-access.js';

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
      const profile = await profiles.publicByUsername(request.params.username);
      if (!profile)
        return sendProblem(
          request,
          reply,
          404,
          'PROFILE_NOT_FOUND',
          'Profile not found',
          'The requested profile does not exist.',
        );
      return reply
        .header('cache-control', 'public, max-age=60')
        .send(publicProfileSchema.parse(profile));
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
