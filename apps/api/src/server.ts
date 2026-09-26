import { pathToFileURL } from 'node:url';

import { buildApp } from './app/build-app.js';
import { readConfig } from './app/config.js';
import { createShutdownHandler } from './app/shutdown.js';
import { startTelemetry, stopTelemetry } from './telemetry.js';

export async function main(): Promise<void> {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  try {
    const config = readConfig();
    await startTelemetry(config);
    const createdApp = await buildApp(config);
    app = createdApp;
    await createdApp.listen({ host: config.HOST, port: config.PORT });
    createdApp.log.info({
      event: 'api.started',
      host: config.HOST,
      port: config.PORT,
    });
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
            process.exitCode = success ? 0 : 1;
          }),
      );
    }
  } catch (error) {
    app?.log.error({ event: 'api.start_failed', err: error });
    await stopTelemetry();
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
