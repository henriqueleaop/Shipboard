import { z } from 'zod';

const databaseUrlSchema = z
  .url()
  .refine((value) =>
    ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
  );

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).max(255).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    LOG_LEVEL: z
      .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: databaseUrlSchema,
    AUTH_SECRET: z
      .string()
      .min(32)
      .refine((value) => !value.toLowerCase().includes('replace')),
    AUTH_BASE_URL: z.url().default('http://localhost:3001'),
    AUTH_ALLOW_INSECURE_LOCAL: z.enum(['true', 'false']).default('false'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_SERVICE_NAME: z.string().min(1).max(100).default('shipboard-api'),
  })
  .superRefine((value, context) => {
    const web = new URL(value.WEB_ORIGIN);
    const api = new URL(value.AUTH_BASE_URL);
    const local = [web.hostname, api.hostname].every(
      (host) => host === 'localhost' || host === '127.0.0.1',
    );
    if (
      value.NODE_ENV === 'production' &&
      (web.protocol !== 'https:' || api.protocol !== 'https:') &&
      !(local && value.AUTH_ALLOW_INSECURE_LOCAL === 'true')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Production authentication requires HTTPS.',
        path: ['AUTH_BASE_URL'],
      });
    }
    if (value.AUTH_ALLOW_INSECURE_LOCAL === 'true' && !local) {
      context.addIssue({
        code: 'custom',
        message: 'Local cookie exception requires loopback origins.',
        path: ['AUTH_ALLOW_INSECURE_LOCAL'],
      });
    }
  });

export type AppConfig = z.infer<typeof environmentSchema>;

export function readConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error('Environment configuration is invalid.');
  }

  return result.data;
}

export function readMigrationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): { DATABASE_URL: string } {
  const result = z
    .object({ DATABASE_URL: databaseUrlSchema })
    .safeParse(environment);
  if (!result.success) throw new Error('Environment configuration is invalid.');
  return result.data;
}
