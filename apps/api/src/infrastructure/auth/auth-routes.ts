import {
  authProvidersResponseSchema,
  currentUserSchema,
  githubStartRequestSchema,
  githubStartResponseSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from '@shipboard/contracts';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { createAuth } from './create-auth.js';
import type { AppConfig } from '../../app/config.js';
import { sendProblem } from '../../shared/http/problem.js';
import { toPrincipal, type Principal } from '../../shared/types/principal.js';

type Auth = ReturnType<typeof createAuth>;

function responseUser(value: unknown) {
  if (!value || typeof value !== 'object' || !('user' in value)) {
    throw new Error('Authentication response has no user.');
  }
  const user = value.user;
  if (
    !user ||
    typeof user !== 'object' ||
    !('id' in user) ||
    !('email' in user)
  ) {
    throw new Error('Authentication response user is invalid.');
  }
  return currentUserSchema.parse({ id: user.id, email: user.email });
}

function validationErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: Auth,
  config: AppConfig,
) {
  async function principal(request: FastifyRequest): Promise<Principal | null> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) return null;
    return toPrincipal({ id: session.user.id, email: session.user.email });
  }

  async function forward(
    request: FastifyRequest,
    body: object | undefined,
  ): Promise<Response> {
    const url = new URL(request.url, config.AUTH_BASE_URL);
    return auth.handler(
      new Request(url, {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }

  function copyCookies(
    response: Response,
    reply: Parameters<typeof sendProblem>[1],
  ) {
    const cookies = response.headers.getSetCookie();
    if (cookies.length) reply.header('set-cookie', cookies);
    reply.header('cache-control', 'no-store');
  }

  app.post('/api/auth/sign-up/email', async (request, reply) => {
    const result = signUpRequestSchema.safeParse(request.body);
    if (!result.success) {
      return sendProblem(
        request,
        reply,
        400,
        'VALIDATION_FAILED',
        'Invalid registration',
        'Check the registration fields.',
        validationErrors(result.error),
      );
    }
    const response = await forward(request, {
      ...result.data,
      name: 'Shipboard user',
    });
    if (!response.ok) {
      return sendProblem(
        request,
        reply,
        response.status === 422 || response.status === 409 ? 409 : 400,
        'REGISTRATION_FAILED',
        'Registration failed',
        'The account could not be created.',
      );
    }
    copyCookies(response, reply);
    return reply.code(200).send(responseUser(await response.json()));
  });

  app.post('/api/auth/sign-in/email', async (request, reply) => {
    const result = signInRequestSchema.safeParse(request.body);
    if (!result.success) {
      return sendProblem(
        request,
        reply,
        400,
        'VALIDATION_FAILED',
        'Invalid login',
        'Check the login fields.',
        validationErrors(result.error),
      );
    }
    const response = await forward(request, result.data);
    if (!response.ok) {
      return sendProblem(
        request,
        reply,
        401,
        'INVALID_CREDENTIALS',
        'Authentication failed',
        'Invalid email or password.',
      );
    }
    copyCookies(response, reply);
    return reply.code(200).send(responseUser(await response.json()));
  });

  app.post('/api/auth/sign-out', async (request, reply) => {
    const response = await forward(request, {});
    copyCookies(response, reply);
    if (!response.ok) {
      return sendProblem(
        request,
        reply,
        401,
        'AUTH_REQUIRED',
        'Authentication required',
        'Sign in to continue.',
      );
    }
    return reply.code(204).send();
  });

  app.get('/api/v1/auth/providers', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return reply.code(200).send(
      authProvidersResponseSchema.parse({
        github: Boolean(config.GITHUB_CLIENT_ID),
      }),
    );
  });

  app.post('/api/auth/sign-in/social', async (request, reply) => {
    if (!config.GITHUB_CLIENT_ID) {
      return sendProblem(
        request,
        reply,
        404,
        'PROVIDER_UNAVAILABLE',
        'Provider unavailable',
        'GitHub sign-in is not configured.',
      );
    }
    const result = githubStartRequestSchema.safeParse(request.body);
    if (!result.success) {
      return sendProblem(
        request,
        reply,
        400,
        'VALIDATION_FAILED',
        'Invalid return destination',
        'Choose a valid destination within Shipboard.',
        validationErrors(result.error),
      );
    }
    const callbackURL = new URL(
      result.data.returnTo,
      config.WEB_ORIGIN,
    ).toString();
    const errorCallbackURL = new URL(
      '/login?error=github',
      config.WEB_ORIGIN,
    ).toString();
    const response = await forward(request, {
      provider: 'github',
      callbackURL,
      errorCallbackURL,
      disableRedirect: true,
    });
    if (!response.ok) {
      return sendProblem(
        request,
        reply,
        400,
        'GITHUB_SIGN_IN_FAILED',
        'GitHub sign-in failed',
        'Could not start GitHub sign-in. Try again.',
      );
    }
    copyCookies(response, reply);
    const resultBody = (await response.json()) as unknown;
    const url = githubStartResponseSchema.safeParse(
      resultBody && typeof resultBody === 'object' && 'url' in resultBody
        ? { url: resultBody.url }
        : resultBody,
    );
    if (!url.success) {
      throw new Error('GitHub sign-in did not return an authorization URL.');
    }
    return reply.code(200).send(url.data);
  });

  app.get('/api/auth/callback/github', async (request, reply) => {
    if (!config.GITHUB_CLIENT_ID) {
      return sendProblem(
        request,
        reply,
        404,
        'PROVIDER_UNAVAILABLE',
        'Provider unavailable',
        'GitHub sign-in is not configured.',
      );
    }
    const response = await forward(request, undefined);
    copyCookies(response, reply);
    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      const target = new URL(location, config.AUTH_BASE_URL);
      const webOrigin = new URL(config.WEB_ORIGIN).origin;
      if (target.origin !== webOrigin) {
        return reply
          .code(302)
          .header(
            'location',
            new URL('/login?error=github', config.WEB_ORIGIN).toString(),
          )
          .send();
      }
      if (
        target.pathname === '/login' &&
        target.searchParams.get('error') === 'github'
      ) {
        return reply
          .code(302)
          .header(
            'location',
            new URL('/login?error=github', config.WEB_ORIGIN).toString(),
          )
          .send();
      }
      return reply
        .code(response.status)
        .header('location', target.toString())
        .send();
    }
    return sendProblem(
      request,
      reply,
      400,
      'GITHUB_CALLBACK_FAILED',
      'GitHub sign-in failed',
      'Return to the login page and try again.',
    );
  });

  app.get('/api/v1/me', async (request, reply) => {
    const actor = await principal(request);
    reply.header('cache-control', 'no-store');
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
    return reply.code(200).send(currentUserSchema.parse(actor));
  });

  return { principal };
}
