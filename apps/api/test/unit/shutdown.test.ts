import { describe, expect, it, vi } from 'vitest';

import { createShutdownHandler } from '../../src/app/shutdown.js';

describe('shutdown handler', () => {
  it('cleans up once when shutdown is requested repeatedly', async () => {
    const order: string[] = [];
    const close = vi.fn(async () => {
      order.push('close');
    });
    const stopTelemetry = vi.fn(async () => {
      order.push('telemetry');
    });
    const shutdown = createShutdownHandler({
      close,
      stopTelemetry,
      log: vi.fn(),
    });
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')]);
    expect(close).toHaveBeenCalledOnce();
    expect(stopTelemetry).toHaveBeenCalledOnce();
    expect(order).toEqual(['close', 'telemetry']);
  });
  it('reports cleanup failure', async () => {
    const log = vi.fn();
    const stopTelemetry = vi.fn().mockResolvedValue(undefined);
    const shutdown = createShutdownHandler({
      close: vi.fn().mockRejectedValue(new Error('close failed')),
      stopTelemetry,
      log,
    });
    await expect(shutdown('SIGINT')).resolves.toBe(false);
    expect(stopTelemetry).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('api.shutdown_failed', {
      errorCode: 'SHUTDOWN_FAILED',
    });
  });

  it('returns a failure within the deadline when cleanup hangs', async () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn(() => new Promise<void>(() => undefined));
      const stopTelemetry = vi.fn().mockResolvedValue(undefined);
      const log = vi.fn();
      const shutdown = createShutdownHandler(
        { close, stopTelemetry, log },
        100,
      );
      const result = shutdown('SIGTERM');
      await vi.advanceTimersByTimeAsync(100);
      await expect(result).resolves.toBe(false);
      expect(close).toHaveBeenCalledOnce();
      expect(stopTelemetry).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith('api.shutdown_failed', {
        errorCode: 'SHUTDOWN_FAILED',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
