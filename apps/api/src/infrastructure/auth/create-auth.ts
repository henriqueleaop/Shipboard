import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';

import type { AppConfig } from '../../app/config.js';
import type { createDatabase } from '../database/client.js';
import * as authSchema from '../database/auth-schema.js';

type Database = ReturnType<typeof createDatabase>['db'];

export function createAuth(config: AppConfig, database: Database) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: authSchema,
    }),
    secret: config.AUTH_SECRET,
    baseURL: config.AUTH_BASE_URL,
    trustedOrigins: [config.WEB_ORIGIN],
    logger: { disabled: true },
    // Raw adapter failures must reach Fastify's sanitized handler, not Better Call's console fallback.
    onAPIError: { throw: true },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    account: { accountLinking: { disableImplicitLinking: true } },
    ...(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET
      ? {
          socialProviders: {
            github: {
              clientId: config.GITHUB_CLIENT_ID,
              clientSecret: config.GITHUB_CLIENT_SECRET,
              scope: ['user:email'],
            },
          },
        }
      : {}),
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies:
        config.NODE_ENV === 'production' &&
        config.AUTH_ALLOW_INSECURE_LOCAL !== 'true',
    },
  });
}
