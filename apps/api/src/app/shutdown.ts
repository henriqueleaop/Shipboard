export interface ShutdownDependencies {
  close: () => Promise<void>;
  stopTelemetry: () => Promise<void>;
  log: (event: string, details: { signal?: string; error?: Error }) => void;
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

      const cleanup = Promise.allSettled([
        Promise.resolve().then(dependencies.close),
        Promise.resolve().then(dependencies.stopTelemetry),
      ]);

      try {
        const result = await Promise.race([cleanup, timeout]);
        if (result === 'timeout') {
          throw new Error('Shutdown timed out.');
        }
        const failed = result.find((step) => step.status === 'rejected');
        if (failed?.status === 'rejected') {
          throw failed.reason instanceof Error
            ? failed.reason
            : new Error('Shutdown cleanup failed.');
        }
        dependencies.log('api.shutdown_completed', { signal });
        return true;
      } catch (error) {
        dependencies.log('api.shutdown_failed', {
          error:
            error instanceof Error
              ? error
              : new Error('Unknown shutdown error'),
        });
        return false;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
    return inFlight;
  };
}
