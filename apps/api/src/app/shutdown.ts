export interface ShutdownDependencies {
  close: () => Promise<void>;
  stopTelemetry: () => Promise<void>;
  log: (event: string, details: { signal?: string; error?: Error }) => void;
}

export function createShutdownHandler(dependencies: ShutdownDependencies) {
  let inFlight: Promise<boolean> | undefined;

  return (signal: string): Promise<boolean> => {
    inFlight ??= (async () => {
      try {
        dependencies.log('api.shutdown_started', { signal });
        await dependencies.close();
        await dependencies.stopTelemetry();
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
      }
    })();
    return inFlight;
  };
}
