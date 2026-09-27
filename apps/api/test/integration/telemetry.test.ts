import { Writable } from 'node:stream';

import { context, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it, vi } from 'vitest';

import { readConfig } from '../../src/app/config.js';
import {
  recordDatabaseCheck,
  recordHttpRequest,
  startTelemetry,
  stopTelemetry,
} from '../../src/telemetry.js';

describe('API telemetry', () => {
  it('propagates a valid trace context and exports spans and HTTP metrics in memory', async () => {
    const logs: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    const spanExporter = new InMemorySpanExporter();
    const metricExporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE,
    );
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60_000,
    });
    const config = readConfig({
      AUTH_SECRET: 'test-auth-secret-at-least-thirty-two-characters',
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    });
    await startTelemetry(config, { traceExporter: spanExporter, metricReader });
    const { buildApp } = await import('../../src/app/build-app.js');
    const app = await buildApp(config, logStream, {
      check: async () => undefined,
      close: async () => undefined,
    });

    const traceId = '0123456789abcdef0123456789abcdef';
    const traceparent = `00-${traceId}-0123456789abcdef-01`;
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
        headers: { traceparent, 'x-request-id': 'telemetry-test-123' },
      });
      expect(response.statusCode).toBe(200);
      const readiness = await app.inject({
        method: 'GET',
        url: '/health/ready',
        headers: { traceparent, 'x-request-id': 'readiness-trace-123' },
      });
      expect(readiness.statusCode).toBe(200);
      expect(
        spanExporter
          .getFinishedSpans()
          .some(
            (finished) =>
              finished.name === 'database.readiness' &&
              finished.spanContext().traceId === traceId,
          ),
      ).toBe(true);

      const failingApp = await buildApp(config, logStream, {
        check: async () => {
          throw new Error('secret-database-url-fixture');
        },
        close: async () => undefined,
      });
      try {
        const failure = await failingApp.inject('/health/ready');
        expect(failure.statusCode).toBe(503);
        expect(failure.body).not.toContain('secret-database-url-fixture');
      } finally {
        await failingApp.close();
      }
      expect(logs.join('')).not.toContain('secret-database-url-fixture');
      expect(
        logs.some(
          (line) =>
            line.includes('http.request_received') && line.includes(traceId),
        ),
      ).toBe(true);

      const parent = propagation.extract(context.active(), { traceparent });
      expect(trace.getSpanContext(parent)?.traceId).toBe(traceId);
      const span = trace
        .getTracer('shipboard-test')
        .startSpan('propagation-check', {}, parent);
      expect(span.spanContext().traceId).toBe(traceId);
      expect(span.isRecording()).toBe(true);
      span.end();
      await vi.waitFor(
        () => {
          expect(
            spanExporter
              .getFinishedSpans()
              .some((finished) => finished.spanContext().traceId === traceId),
          ).toBe(true);
        },
        { timeout: 2_000 },
      );

      recordHttpRequest(500, 7);
      recordDatabaseCheck(true, 3);
      await metricReader.forceFlush();
      const metricNames = metricExporter
        .getMetrics()
        .flatMap((resource) => resource.scopeMetrics)
        .flatMap((scope) => scope.metrics)
        .map((metric) => metric.descriptor.name);
      expect(metricNames).toEqual(
        expect.arrayContaining([
          'shipboard.http.requests',
          'shipboard.http.duration_ms',
          'shipboard.http.errors',
          'shipboard.database.check_duration_ms',
        ]),
      );

      app.log.info(
        {
          password: 'secret-password-fixture',
          req: {
            headers: {
              authorization: 'secret-token-fixture',
              cookie: 'secret-cookie-fixture',
            },
          },
        },
        'redaction-check',
      );
      expect(logs.join('')).not.toContain('secret-password-fixture');
      expect(logs.join('')).not.toContain('secret-token-fixture');
      expect(logs.join('')).not.toContain('secret-cookie-fixture');
    } finally {
      await app.close();
      await stopTelemetry();
    }
  }, 15_000);
});
