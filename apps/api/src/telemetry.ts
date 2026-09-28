import { metrics, type Counter, type Histogram } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  PeriodicExportingMetricReader,
  type MetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';

import type { AppConfig } from './app/config.js';

let httpMetrics:
  | { requestCount: Counter; requestDuration: Histogram; errorCount: Counter }
  | undefined;
let databaseCheckDuration: Histogram | undefined;
let feedbackEvents: Counter | undefined;

export type FeedbackEvent =
  | 'suggestion.created'
  | 'suggestion.replayed'
  | 'suggestion.status_changed'
  | 'suggestion.forbidden'
  | 'suggestion.conflict'
  | 'vote.created'
  | 'vote.removed';

export function recordFeedbackEvent(event: FeedbackEvent): void {
  feedbackEvents?.add(1, { event });
}

let sdk: NodeSDK | undefined;

interface TelemetryExporters {
  traceExporter?: SpanExporter;
  metricReader?: MetricReader;
}

function otlpUrl(endpoint: string, signal: 'traces' | 'metrics'): string {
  const base = endpoint
    .replace(/\/?v1\/(?:traces|metrics)\/?$/, '')
    .replace(/\/$/, '');
  return `${base}/v1/${signal}`;
}

export async function startTelemetry(
  config: AppConfig,
  exporters: TelemetryExporters = {},
): Promise<void> {
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;
  sdk = new NodeSDK({
    serviceName: config.OTEL_SERVICE_NAME,
    logRecordProcessors: [],
    traceExporter: exporters.traceExporter
      ? undefined
      : endpoint
        ? new OTLPTraceExporter({ url: otlpUrl(endpoint, 'traces') })
        : undefined,
    spanProcessors: exporters.traceExporter
      ? [new SimpleSpanProcessor(exporters.traceExporter)]
      : endpoint
        ? undefined
        : [],
    metricReaders: exporters.metricReader
      ? [exporters.metricReader]
      : endpoint
        ? [
            new PeriodicExportingMetricReader({
              exporter: new OTLPMetricExporter({
                url: otlpUrl(endpoint, 'metrics'),
              }),
            }),
          ]
        : [],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) =>
            request.url?.startsWith('/api/auth/') ?? false,
        },
      }),
    ],
  });
  await sdk.start();
  const meter = metrics.getMeter('shipboard-api');
  httpMetrics = {
    requestCount: meter.createCounter('shipboard.http.requests'),
    requestDuration: meter.createHistogram('shipboard.http.duration_ms'),
    errorCount: meter.createCounter('shipboard.http.errors'),
  };
  databaseCheckDuration = meter.createHistogram(
    'shipboard.database.check_duration_ms',
  );
  feedbackEvents = meter.createCounter('shipboard.feedback.events');
}

export async function stopTelemetry(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
  httpMetrics = undefined;
  databaseCheckDuration = undefined;
  feedbackEvents = undefined;
}

export function recordDatabaseCheck(
  available: boolean,
  durationMs: number,
): void {
  databaseCheckDuration?.record(durationMs, {
    outcome: available ? 'available' : 'unavailable',
  });
}

export function recordHttpRequest(
  statusCode: number,
  durationMs: number,
): void {
  const attributes = { statusCode };
  httpMetrics?.requestCount.add(1, attributes);
  httpMetrics?.requestDuration.record(durationMs, attributes);
  if (statusCode >= 400) httpMetrics?.errorCount.add(1, attributes);
}
