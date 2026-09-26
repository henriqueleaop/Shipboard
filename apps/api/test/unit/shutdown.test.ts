import { describe, expect, it, vi } from 'vitest';

import { createShutdownHandler } from '../../src/app/shutdown.js';

describe('shutdown handler', () => {
  it('cleans up once when shutdown is requested repeatedly', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const stopTelemetry = vi.fn().mockResolvedValue(undefined);
    const shutdown = createShutdownHandler({
      close,
      stopTelemetry,
      log: vi.fn(),
    });
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')]);
    expect(close).toHaveBeenCalledOnce();
    expect(stopTelemetry).toHaveBeenCalledOnce();
  });
  it('reports cleanup failure', async () => {
    const log = vi.fn();
    const shutdown = createShutdownHandler({
      close: vi.fn().mockRejectedValue(new Error('close failed')),
      stopTelemetry: vi.fn(),
      log,
    });
    await expect(shutdown('SIGINT')).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('api.shutdown_failed', expect.any(Object));
  });
});
