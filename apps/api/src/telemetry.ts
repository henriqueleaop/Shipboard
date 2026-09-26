import { metrics } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

import type { AppConfig } from './app/config.js';

const meter = metrics.getMeter('shipboard-api');
const requestCount = meter.createCounter('shipboard.http.requests');
const requestDuration = meter.createHistogram('shipboard.http.duration_ms');
const errorCount = meter.createCounter('shipboard.http.errors');

let sdk: NodeSDK | undefined;

export async function startTelemetry(config: AppConfig): Promise<void> {
  sdk = new NodeSDK({
    serviceName: config.OTEL_SERVICE_NAME,
    traceExporter: config.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPTraceExporter({ url: config.OTEL_EXPORTER_OTLP_ENDPOINT })
      : undefined,
    instrumentations: [getNodeAutoInstrumentations()],
  });
  await sdk.start();
}

export async function stopTelemetry(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}

export function recordHttpRequest(
  statusCode: number,
  durationMs: number,
): void {
  const attributes = { statusCode };
  requestCount.add(1, attributes);
  requestDuration.record(durationMs, attributes);
  if (statusCode >= 400) errorCount.add(1, attributes);
}
