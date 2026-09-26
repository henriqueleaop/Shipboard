export interface ShutdownDependencies {
  close: () => Promise<void>;
  stopTelemetry: () => Promise<void>;
  log: (
    event: string,
    details: { signal?: string; errorCode?: string },
  ) => void;
}

export const shutdownTimeoutMs = 5_000;

export function createShutdownHandler(
  dependencies: ShutdownDependencies,
  timeoutMs = shutdownTimeoutMs,
) {
  let inFlight: Promise<boolean> | undefined;

  return (signal: string): Promise<boolean> => {
    inFlight ??= (async () => {
      dependencies.log('api.shutdown_started', { signal });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      });

      try {
        const closeResult = await Promise.race([
          Promise.resolve()
            .then(dependencies.close)
            .then(
              () => 'ok' as const,
              () => 'failed' as const,
            ),
          timeout,
        ]);
        const telemetryResult = await Promise.race([
          Promise.resolve()
            .then(dependencies.stopTelemetry)
            .then(
              () => 'ok' as const,
              () => 'failed' as const,
            ),
          timeout,
        ]);
        if (closeResult === 'timeout' || telemetryResult === 'timeout') {
          throw new Error('Shutdown timed out.');
        }
        if (closeResult === 'failed' || telemetryResult === 'failed') {
          throw new Error('Shutdown cleanup failed.');
        }
        dependencies.log('api.shutdown_completed', { signal });
        return true;
      } catch {
        dependencies.log('api.shutdown_failed', {
          errorCode: 'SHUTDOWN_FAILED',
        });
        return false;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
    return inFlight;
  };
}
