import { pathToFileURL } from 'node:url';

import { readConfig } from './app/config.js';
import { createShutdownHandler } from './app/shutdown.js';
import { startTelemetry, stopTelemetry } from './telemetry.js';

export async function main(): Promise<void> {
  let app:
    | Awaited<ReturnType<typeof import('./app/build-app.js').buildApp>>
    | undefined;
  let database:
    | ReturnType<
        typeof import('./infrastructure/database/client.js').createDatabase
      >
    | undefined;
  try {
    const config = readConfig();
    await startTelemetry(config);
    const { createDatabase } = await import(
      './infrastructure/database/client.js'
    );
    database = createDatabase(config.DATABASE_URL, () => {
      app?.log.warn({
        event: 'database.idle_connection_failed',
        errorCode: 'DATABASE_UNAVAILABLE',
      });
    });
    const { buildApp } = await import('./app/build-app.js');
    const createdApp = await buildApp(config, undefined, database);
    app = createdApp;
    const shutdown = createShutdownHandler({
      close: () => createdApp.close(),
      stopTelemetry,
      log: (event, details) => createdApp.log.info({ event, ...details }),
    });
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(
        signal,
        () =>
          void shutdown(signal).then((success) => {
            if (success) process.exitCode = 0;
            else process.exit(1);
          }),
      );
    }
    await createdApp.listen({ host: config.HOST, port: config.PORT });
    createdApp.log.info({
      event: 'api.started',
      host: config.HOST,
      port: config.PORT,
    });
  } catch {
    app?.log.error({ event: 'api.start_failed', errorCode: 'STARTUP_FAILED' });
    const cleanup = createShutdownHandler({
      close: async () => {
        if (app) await app.close();
        else await database?.close();
      },
      stopTelemetry,
      log: (event, details) => app?.log.info({ event, ...details }),
    });
    if (!(await cleanup('startup-failure'))) process.exit(1);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
